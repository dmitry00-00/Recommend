// Наблюдение за хостингом (18.10, владелец: «тщательно погоняем bothost» — четвёртый день приложение то открывается, то
// «404 page not found» от прокси bothost). Только пассивные проверки боевого сервера, без нагрузки:
//   · с этого Mac — /api/health раз в 15 с и главная страница раз в минуту (curl: DNS, соединение, TLS, первый байт);
//   · с узлов check-host.net (Россия, Казахстан, Европа…) — /api/health раз в 10 мин.
// Пишет .cache/host-probe/<дата>.jsonl; сводка — `--report [--hours 24]` (доступность, окна сбоев с точным временем,
// задержки, узлы). Работает до остановки (launchd tm.recomend.probe, tools/launchd/), сам по себе ничего не чинит.
//   npx tsx tools/host-probe.mts            — наблюдать
//   npx tsx tools/host-probe.mts --report   — сводка за последние сутки (--hours N — за N часов)
import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { loadEnvFile } from './env-file.mts';

loadEnvFile();
const server = (process.env.TM_SERVER ?? 'https://bot-1791394986-4062-dmitriy-00.bothost.tech').replace(/\/+$/, '');
const DIR = '.cache/host-probe';
mkdirSync(DIR, { recursive: true });
const argv = process.argv.slice(2);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const day = (d = new Date()) => d.toISOString().slice(0, 10);
const write = (row: Record<string, unknown>) => appendFileSync(`${DIR}/${day()}.jsonl`, JSON.stringify({ ...row, at: new Date().toISOString() }) + '\n');

type Row = { at: string; kind: 'local' | 'world'; path?: string; code?: number; ms?: number; dns?: number; conn?: number; tls?: number; ttfb?: number; err?: string; body?: string; node?: string; country?: string; ok?: boolean };

/** Один запрос curl с разбивкой по времени; тело — только при сбое (первые 80 знаков: «404 page not found» прокси). */
function probe(path: string): Row {
  const out = `/tmp/host-probe-${process.pid}.body`;
  const r = spawnSync('curl', ['-s', '-m', '12', '-o', out, '-H', 'cache-control: no-cache', '-w',
    '%{http_code} %{time_namelookup} %{time_connect} %{time_appconnect} %{time_starttransfer} %{time_total}', `${server}${path}`], { encoding: 'utf8' });
  const [code, dns, conn, tls, ttfb, total] = (r.stdout || '').trim().split(' ').map(Number);
  const ms = (x: number) => Math.round(x * 1000);
  const row: Row = { at: '', kind: 'local', path, code: code || 0, ms: ms(total || 0), dns: ms(dns || 0), conn: ms(conn || 0), tls: ms(tls || 0), ttfb: ms(ttfb || 0) };
  if (r.status !== 0) row.err = `curl ${r.status}`;
  if (code !== 200 && existsSync(out)) row.body = readFileSync(out, 'utf8').slice(0, 80).replace(/\s+/g, ' ');
  return row;
}

/** check-host.net: тот же /api/health с разных концов света; ответ узлов — через 10–15 с. */
async function world(): Promise<void> {
  try {
    const ask = await fetch(`https://check-host.net/check-http?host=${encodeURIComponent(`${server}/api/health`)}&max_nodes=25`,
      { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(20e3) }).then((r) => r.json()) as { request_id: string; nodes: Record<string, string[]> };
    await sleep(15e3);
    const res = await fetch(`https://check-host.net/check-result/${ask.request_id}`, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(20e3) })
      .then((r) => r.json()) as Record<string, [number, number, string, string | null, string | null][] | null>;
    for (const [node, v] of Object.entries(res)) {
      const x = v?.[0];
      write({ kind: 'world', node: node.replace('.node.check-host.net', ''), country: ask.nodes[node]?.[1],
        ok: x ? x[0] === 1 : undefined, code: x?.[3] ? Number(x[3]) : undefined, ms: x ? Math.round(x[1] * 1000) : undefined, err: x && x[0] !== 1 ? x[2] : (x ? undefined : 'нет ответа узла') });
    }
  } catch (e) { write({ kind: 'world', err: `check-host: ${(e as Error).message}` }); }
}

async function watch(): Promise<never> {
  console.log(`наблюдаю ${server}: health раз в 15 с, главная раз в минуту, check-host раз в 10 мин → ${DIR}/`);
  let tick = 0;
  let worldAt = 0;
  for (;;) {
    const started = Date.now();
    const h = probe('/api/health');
    write(h as Record<string, unknown>);
    if (h.code !== 200) console.log(`${new Date().toISOString()} health ${h.code} ${h.err ?? ''} ${h.body ?? ''}`);
    if (tick % 4 === 0) write(probe('/') as Record<string, unknown>);
    if (Date.now() - worldAt > 10 * 60e3) { worldAt = Date.now(); void world(); }
    tick += 1;
    await sleep(Math.max(1000, 15e3 - (Date.now() - started)));
  }
}

function report(hours: number): void {
  const since = Date.now() - hours * 3600e3;
  const rows: Row[] = readdirSync(DIR).filter((f) => f.endsWith('.jsonl')).sort()
    .flatMap((f) => readFileSync(`${DIR}/${f}`, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as Row))
    .filter((r) => Date.parse(r.at) >= since);
  const local = rows.filter((r) => r.kind === 'local');
  const pct = (a: number, b: number) => (b ? `${((100 * a) / b).toFixed(2)} %` : '—');
  const q = (xs: number[], p: number) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : 0; };
  const t = (iso: string) => new Date(iso).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow', hour12: false });
  console.log(`сводка за ${hours} ч (${rows.length ? t(rows[0].at) : '—'} … ${rows.length ? t(rows[rows.length - 1].at) : '—'}, время московское)`);
  for (const path of ['/api/health', '/']) {
    const xs = local.filter((r) => r.path === path);
    const ok = xs.filter((r) => r.code === 200);
    const by = new Map<string, number>();
    for (const r of xs) if (r.code !== 200) { const k = `${r.code}${r.body ? ` «${r.body.slice(0, 30)}»` : ''}${r.err ? ` ${r.err}` : ''}`; by.set(k, (by.get(k) ?? 0) + 1); }
    console.log(`\n${path}: проверок ${xs.length}, доступно ${pct(ok.length, xs.length)}; ответ p50 ${q(ok.map((r) => r.ms ?? 0), 0.5)} мс, p95 ${q(ok.map((r) => r.ms ?? 0), 0.95)} мс, максимум ${q(ok.map((r) => r.ms ?? 0), 1)} мс`);
    for (const [k, n] of [...by].sort((a, b) => b[1] - a[1])) console.log(`  сбой ${k}: ${n}`);
  }
  // окна сбоев: подряд идущие не-200 по health, с длительностью
  const hs = local.filter((r) => r.path === '/api/health');
  const windows: { from: string; to: string; n: number; what: string }[] = [];
  for (const r of hs) {
    if (r.code === 200) continue;
    const last = windows[windows.length - 1];
    const prevIdx = hs.indexOf(r) - 1;
    if (last && prevIdx >= 0 && hs[prevIdx].code !== 200) { last.to = r.at; last.n += 1; } else windows.push({ from: r.at, to: r.at, n: 1, what: `${r.code}${r.body ? ` ${r.body.slice(0, 24)}` : ''}${r.err ? ` ${r.err}` : ''}` });
  }
  console.log(`\nокна сбоев /api/health: ${windows.length}`);
  for (const w of windows.slice(-40)) console.log(`  ${t(w.from)} — ${t(w.to)} (${w.n} проверок подряд, ~${Math.max(15, (Date.parse(w.to) - Date.parse(w.from)) / 1000 + 15)} с): ${w.what}`);
  const wr = rows.filter((r) => r.kind === 'world' && r.node);
  const nodes = new Map<string, { n: number; ok: number; country?: string; fails: string[] }>();
  for (const r of wr) { const x = nodes.get(r.node!) ?? { n: 0, ok: 0, country: r.country, fails: [] }; x.n += 1; if (r.ok) x.ok += 1; else x.fails.push(`${t(r.at)} ${r.err ?? r.code}`); nodes.set(r.node!, x); }
  console.log(`\ncheck-host.net: узлов ${nodes.size}, замеров ${wr.length}, доступно ${pct(wr.filter((r) => r.ok).length, wr.length)}`);
  for (const [n, x] of [...nodes].sort((a, b) => a[1].ok / a[1].n - b[1].ok / b[1].n).slice(0, 25)) {
    console.log(`  ${n.padEnd(5)} ${(x.country ?? '').padEnd(12)} ${pct(x.ok, x.n).padStart(8)} из ${x.n}${x.fails.length ? `; сбои: ${x.fails.slice(-3).join('; ')}` : ''}`);
  }
}

if (argv.includes('--report')) report(Number(argv[argv.indexOf('--hours') + 1]) || 24);
else await watch();
