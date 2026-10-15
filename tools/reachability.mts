// Замер доступности сервера из российских и казахстанских сетей (ХЮ-1, 13.10).
//
//   npx tsx tools/reachability.mts [--server https://…] [--per 2] [--dry]
//
// Зачем: с 09.06.2025 провайдеры России режут соединения с частью зарубежных хостингов примерно на 16 КБ — рукопожатие
// проходит, потом соединение замирает; мобильный интернет регионов местами пускает только «белый список». Наш сервер —
// bothost в Нидерландах (HANDOFF «Один сервер для всех языков»); попадает ли он под это — неизвестно, а от ответа
// зависят запасной веб-вход (ЗП-19) и приглашения из России.
//
// Как: зонды Globalping (бесплатно, без ключа; GLOBALPING_TOKEN — больше лимит) стоят и у домашних и мобильных
// провайдеров — Ростелеком, МТС, Билайн, Дом.ру, МГТС, Казахтелеком, Kar-Tel. Тело ответа они читают только до 10 КБ,
// поэтому большой файл порог не покажет — сервер отдаёт `/api/probe?kb=N` (worker/probe.ts): gzip, в заголовке
// которого N КБ балласта; строку «tm-probe ok» зонд видит, только если соединение пропустило больше N КБ.
// Три замера на одних и тех же зондах: 0 КБ (сервер отвечает), 8 КБ (ниже порога), 32 КБ (выше порога).
//   0 ✓ 8 ✓ 32 ✓ — доступен;  0 ✓ 8 ✓ 32 ✗ — режут на ~16 КБ;  0 ✗ — не открывается совсем.
// Сервер без `/api/probe` (сборка до 13.10) — меряется только `/api/health`: открывается ли вообще.
//
// Итог: таблица в консоли, `.cache/reachability/<дата>.json` и `.cache/reachability/latest.md`.
// Контрольные зонды — Нидерланды и Германия: там всё должно проходить, иначе виноват сам сервер или замер.
import { mkdirSync, writeFileSync } from 'node:fs';
import { loadEnvFile } from './env-file.mts';

loadEnvFile();
const argv = process.argv.slice(2);
const arg = (name: string) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : undefined; };
const server = new URL(arg('server') ?? process.env.TM_SERVER ?? 'https://bot-1791394986-4062-dmitriy-00.bothost.tech');
const PER = Math.max(1, Math.min(5, Number(arg('per') ?? 2)));
const DRY = argv.includes('--dry');
const API = 'https://api.globalping.io/v1/measurements';
const UA = 'recomend-reachability/0.1 (https://github.com/dmitry00-00/Recommend)';
const token = process.env.GLOBALPING_TOKEN;
const OUT = '.cache/reachability';

/** Группа зондов: сеть по номеру AS или страна. Номера — по списку зондов Globalping на 13.10. */
const GROUPS: { name: string; magic: string; region: 'RU' | 'KZ' | 'контроль' }[] = [
  { name: 'Ростелеком', magic: 'AS12389', region: 'RU' },
  { name: 'МТС', magic: 'AS8359', region: 'RU' },
  { name: 'Билайн', magic: 'AS3216', region: 'RU' },
  { name: 'Дом.ру', magic: 'AS25446', region: 'RU' },
  { name: 'Дом.ру', magic: 'AS51570', region: 'RU' },
  { name: 'МГТС', magic: 'AS25513', region: 'RU' },
  { name: 'Россия, прочие', magic: 'RU', region: 'RU' },
  { name: 'Казахтелеком', magic: 'AS9198', region: 'KZ' },
  { name: 'Kar-Tel (Билайн KZ)', magic: 'AS21299', region: 'KZ' },
  { name: 'Казахстан, прочие', magic: 'KZ', region: 'KZ' },
  { name: 'Нидерланды', magic: 'NL', region: 'контроль' },
  { name: 'Германия', magic: 'DE', region: 'контроль' },
];
const groupOf = new Map(GROUPS.filter((g) => g.magic.startsWith('AS')).map((g) => [Number(g.magic.slice(2)), g]));

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const headers = { 'content-type': 'application/json', 'user-agent': UA, ...(token ? { authorization: `Bearer ${token}` } : {}) };

interface Probe { country: string; city: string; asn: number; network: string }
interface HttpResult { status: string; statusCode?: number; rawBody?: string | null; rawOutput?: string; timings?: { total?: number } }
interface Measurement { id: string; status: string; results: { probe: Probe; result: HttpResult }[] }

async function start(path: string, locations: unknown): Promise<string> {
  const body = { type: 'http', target: server.hostname, locations, measurementOptions: { protocol: server.protocol === 'http:' ? 'HTTP' : 'HTTPS', ...(server.port ? { port: Number(server.port) } : {}), request: { method: 'GET', path: path.split('?')[0], query: path.split('?')[1] } } };
  const r = await fetch(API, { method: 'POST', headers, body: JSON.stringify(body) });
  const j = await r.json() as { id?: string; error?: { message?: string; type?: string } };
  if (!r.ok || !j.id) throw new Error(`globalping ${r.status}: ${j.error?.message ?? JSON.stringify(j)}`);
  return j.id;
}

async function result(id: string): Promise<Measurement> {
  for (let i = 0; i < 40; i++) {
    await sleep(i ? 2500 : 4000);
    // в rawBody бывают управляющие символы — JSON разбираем нестрого
    const text = await fetch(`${API}/${id}`, { headers: { 'user-agent': UA } }).then((r) => r.text());
    const m = JSON.parse(text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ' ')) as Measurement;
    if (m.status !== 'in-progress') return m;
  }
  throw new Error(`globalping: замер ${id} не закончился`);
}

const verdict = (r?: HttpResult, mark = 'tm-probe ok') =>
  !r ? '—' : r.status === 'finished' && r.statusCode === 200 && (r.rawBody ?? '').includes(mark) ? '✓' : '✗';
const why = (r: HttpResult | undefined, mark: string) => !r || verdict(r, mark) === '✓' ? '' : (r.statusCode ? `HTTP ${r.statusCode}` : (r.rawOutput ?? r.status).split('\n')[0].slice(0, 60));

// есть ли на сервере точка замера (сборки до 13.10 её не знают)
const hasProbe = await fetch(new URL('/api/probe?kb=0', server)).then(async (r) => r.ok && (await r.text()).includes('tm-probe ok')).catch(() => false);
const STEPS = hasProbe
  ? [{ kb: 0, path: '/api/probe?kb=0' }, { kb: 8, path: '/api/probe?kb=8' }, { kb: 32, path: '/api/probe?kb=32' }]
  : [{ kb: 0, path: '/api/health' }];
console.log(`сервер ${server.origin}; ${hasProbe ? 'точка /api/probe есть — меряем порог 16 КБ' : 'точки /api/probe нет (сборка до 13.10) — меряем только, открывается ли /api/health'}`);
console.log(`группы: ${GROUPS.map((g) => `${g.name} ${g.magic}`).join(', ')}; до ${PER} зондов в группе`);
if (DRY) process.exit(0);

const locations = GROUPS.map((g) => ({ magic: g.magic, limit: PER }));
const runs: { kb: number; path: string; m: Measurement }[] = [];
let first: string | undefined;
for (const s of STEPS) {
  // второй и третий замер — на тех же зондах, что первый (Globalping принимает номер прежнего замера вместо мест)
  const id = await start(s.path, first ?? locations);
  first ??= id;
  const m = await result(id);
  runs.push({ ...s, m });
  console.log(`  ${s.path}: ${m.results.length} зондов`);
}

// сводим по зонду: ключ — сеть, город и номер такого же зонда в выдаче (порядок в повторных замерах не обещан)
type Row = { group: string; region: string; probe: Probe; byKb: Record<number, HttpResult | undefined>; ms?: number };
const keyed = (m: Measurement) => {
  const seen = new Map<string, number>();
  return new Map(m.results.map((x) => {
    const base = `${x.probe.asn}|${x.probe.city}|${x.probe.network}`;
    const n = seen.get(base) ?? 0; seen.set(base, n + 1);
    return [`${base}|${n}`, x] as const;
  }));
};
const byRun = runs.map((r) => keyed(r.m));
const rows: Row[] = [...byRun[0]].map(([key, x]) => {
  const g = groupOf.get(x.probe.asn) ?? GROUPS.find((gg) => gg.magic === x.probe.country) ?? { name: x.probe.country, region: x.probe.country === 'RU' ? 'RU' : x.probe.country === 'KZ' ? 'KZ' : 'контроль' };
  const byKb: Row['byKb'] = {};
  runs.forEach((r, i) => { byKb[r.kb] = byRun[i].get(key)?.result; });
  return { group: g.name, region: g.region, probe: x.probe, byKb, ms: x.result.timings?.total };
});
const mark = hasProbe ? 'tm-probe ok' : '"ok":true';
const conclude = (r: Row) => {
  const v = STEPS.map((s) => verdict(r.byKb[s.kb], mark));
  if (v[0] !== '✓') return 'не открывается';
  if (!hasProbe) return 'открывается';
  if (v[2] === '✓') return 'доступен';
  return v[1] === '✓' ? 'режут на ~16 КБ' : 'режут раньше 8 КБ';
};

const lines: string[] = [];
lines.push(`# Доступность ${server.host} — ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`, '');
lines.push(hasProbe
  ? 'Замер `/api/probe`: 0 КБ — сервер отвечает, 8 КБ — ниже порога, 32 КБ — выше порога ~16 КБ (worker/probe.ts).'
  : 'На сервере нет `/api/probe` — проверено только, открывается ли `/api/health`; порог 16 КБ — после выкладки сборки от 13.10.', '');
lines.push(`| Группа | Сеть | Город | ${STEPS.map((s) => `${s.kb} КБ`).join(' | ')} | Вывод | мс | Почему нет |`);
lines.push(`|---|---|---|${STEPS.map(() => '---').join('|')}|---|---|---|`);
for (const r of rows.sort((a, b) => a.region.localeCompare(b.region) || a.group.localeCompare(b.group, 'ru'))) {
  const bad = STEPS.map((s) => why(r.byKb[s.kb], mark)).find(Boolean) ?? '';
  lines.push(`| ${r.group} | AS${r.probe.asn} ${r.probe.network} | ${r.probe.city} | ${STEPS.map((s) => verdict(r.byKb[s.kb], mark)).join(' | ')} | ${conclude(r)} | ${r.ms ?? ''} | ${bad} |`);
}
const sum = new Map<string, Map<string, number>>();
for (const r of rows) {
  const key = `${r.region} · ${r.group}`;
  const m = sum.get(key) ?? new Map<string, number>(); m.set(conclude(r), (m.get(conclude(r)) ?? 0) + 1); sum.set(key, m);
}
lines.push('', '## Итог по группам', '');
for (const [k, m] of [...sum].sort()) lines.push(`- ${k}: ${[...m].map(([c, n]) => `${c} ${n}`).join(', ')}`);
const missing = GROUPS.filter((g) => !rows.some((r) => r.group === g.name));
if (missing.length) lines.push('', `Зондов не нашлось: ${missing.map((g) => `${g.name} (${g.magic})`).join(', ')}.`);

console.log('\n' + lines.join('\n'));
mkdirSync(OUT, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
writeFileSync(`${OUT}/${stamp}.json`, JSON.stringify({ server: server.origin, hasProbe, at: new Date().toISOString(), runs: runs.map((r) => ({ kb: r.kb, path: r.path, id: r.m.id })), rows: rows.map((r) => ({ group: r.group, region: r.region, probe: r.probe, verdict: conclude(r), steps: Object.fromEntries(STEPS.map((s) => [s.kb, { ok: verdict(r.byKb[s.kb], mark) === '✓', status: r.byKb[s.kb]?.statusCode ?? r.byKb[s.kb]?.status, ms: r.byKb[s.kb]?.timings?.total }])) })) }, null, 1));
writeFileSync(`${OUT}/latest.md`, lines.join('\n') + '\n');
console.log(`\n→ ${OUT}/${stamp}.json, ${OUT}/latest.md`);
