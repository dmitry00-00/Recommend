// Вкладка «Сводка» общего пульта (tools/desk.mts, http://127.0.0.1:8721/dash/) — 04.10.
//
// Одна страница о состоянии данных: последний ночной сбор (шаги, предупреждения, контрольные
// замеры), история сборов, конвейер, разметка людьми по дням, покрытие разметкой, точность
// опознавателя по способам, каналы по ярусам и разметка для подбора (кто без неё, а о нём говорят).
// Только чтение: всё берётся из файлов, которые пишут сборщик и шаги конвейера; сеть не нужна.
// Разметку для подбора считает tools/annotation-gap.mts — из кеша, а когда кеш старше черновиков
// или индекса, пересчитывается (около пяти секунд).
//
// Хост и заголовок x-desk проверяет общий пульт.
import type { IncomingMessage, ServerResponse } from 'node:http';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { status } from './pipeline.mts';
import { channelMeta } from './youtube-channels.mts';

const ROOT = new URL('../', import.meta.url);
const at = (p: string) => new URL(p, ROOT);
const PAGE = new URL('./dash-desk.html', import.meta.url);
const mt = (p: string) => { try { return statSync(at(p)).mtimeMs; } catch { return 0; } };
const readJson = <T,>(p: string, d: T): T => { try { return JSON.parse(readFileSync(at(p), 'utf8')) as T; } catch { return d; } };
const num = (s: string) => Number(s.replace(/[\s %]/g, '').replace(',', '.'));

// ─── ночной сбор ──────────────────────────────────────────────────────────────
interface Step { name: string; ok: boolean; secs?: number; code?: string }
function lastCollect() {
  const dir = at('.cache/collect/');
  const logs = existsSync(dir) ? readdirSync(dir).filter((f) => /^\d{4}-\d\d-\d\d-\d\d-\d\d\.log$/.test(f)).sort() : [];
  const file = logs.at(-1);
  if (!file) return undefined;
  const lines = readFileSync(new URL(file, dir), 'utf8').split('\n');
  const steps: Step[] = [];
  const warnings: string[] = [];
  const metrics: { label: string; was: string; now: string; delta: string }[] = [];
  let cur: Step | undefined, block: 'metrics' | 'warn' | undefined;
  for (const l of lines) {
    const s = /^── ([^:]+?)(?::|$)/.exec(l);
    if (s) { block = s[1] === 'контрольные замеры' ? 'metrics' : undefined; cur = { name: s[1], ok: true }; if (!block) steps.push(cur); continue; }
    const done = /^ {3}(готово|ОШИБКА \(код ([^)]*)\)) за (\d+) с/.exec(l);
    if (done && cur) { cur.ok = done[1] === 'готово'; cur.secs = Number(done[3]); if (done[2]) cur.code = done[2]; continue; }
    if (/^ПРЕДУПРЕЖДЕНИЯ/.test(l)) { block = 'warn'; continue; }
    if (block === 'warn' && /^\s+!/.test(l)) { warnings.push(l.replace(/^\s+!\s*/, '')); continue; }
    if (block === 'metrics') {
      // колонки разделены двумя и больше пробелами; в числах — неразрывный пробел между разрядами
      const m = /^ {2}\S/.test(l) ? l.trim().split(/\s{2,}/) : [];
      if (m.length === 4 && m[0] !== 'число') metrics.push({ label: m[0], was: m[1], now: m[2], delta: m[3] });
      else if (m.length === 3 && m[0] !== 'число') metrics.push({ label: m[0], was: m[1], now: m[2], delta: '' });
    }
  }
  const stamp = file.slice(0, -4);
  return { file: `.cache/collect/${file}`, at: `${stamp.slice(0, 10)}T${stamp.slice(11, 13)}:${stamp.slice(14, 16)}`, steps, warnings, metrics,
    failed: steps.filter((s) => !s.ok).map((s) => s.name), secs: steps.reduce((a, s) => a + (s.secs ?? 0), 0) };
}

/** История сборов: .cache/collect/history.tsv (дата, фильмов, не подтверждено, доля) и снимки замеров. */
function history() {
  const tsv = existsSync(at('.cache/collect/history.tsv')) ? readFileSync(at('.cache/collect/history.tsv'), 'utf8').trim().split('\n').slice(1) : [];
  const runs = tsv.map((l) => l.split('\t')).filter((r) => r.length >= 4)
    .map(([d, films, unv, share]) => ({ at: `${d.slice(0, 10)}T${d.slice(11, 13)}:${d.slice(14, 16)}`, films: num(films), unverified: num(unv), share: num(share) }));
  const snaps = readJson<{ snapshots?: { at: string; metrics: Record<string, number> }[] }>('.cache/collect-metrics.json', {}).snapshots ?? [];
  return { runs, snaps };
}

// ─── разметка людьми ──────────────────────────────────────────────────────────
function verdicts() {
  const v = readJson<{ videos?: Record<string, { key: string | null; why?: string; from?: string; at?: string; guess?: boolean }> }>('tools/markup-verdicts.json', {}).videos ?? {};
  const byDay = new Map<string, Record<string, number>>();
  const from = new Map<string, number>();
  const kinds = { film: 0, notFilm: 0, other: 0, about: 0 };
  for (const x of Object.values(v)) {
    const f = x.from ?? 'таблица';
    from.set(f, (from.get(f) ?? 0) + 1);
    if (x.key) kinds.film++; else if (x.why === 'не про фильм') kinds.notFilm++; else if (x.why === 'о франшизе' || x.why === 'о человеке') kinds.about++; else kinds.other++;
    if (!x.at) continue;
    const d = byDay.get(x.at) ?? byDay.set(x.at, {}).get(x.at)!;
    d[f] = (d[f] ?? 0) + 1;
  }
  const days = [...byDay].sort(([a], [b]) => a.localeCompare(b)).slice(-30).map(([day, by]) => ({ day, n: Object.values(by).reduce((a, b) => a + b, 0), by }));
  return { total: Object.keys(v).length, from: Object.fromEntries(from), kinds, days };
}

// ─── разметка для подбора ─────────────────────────────────────────────────────
const GAP = '.cache/annotation-gap.json';
function gap(fresh: boolean): unknown {
  const inputs = ['src/mocks/draftAnnotations.ts', 'src/mocks/userAnnotations.ts', 'src/mocks/seriesAnnotations.ts', 'src/mocks/essaysAuto.ts', 'src/mocks/postsAuto.ts', 'src/mocks/draftReview.ts'];
  if (fresh || !mt(GAP) || inputs.some((p) => mt(p) > mt(GAP))) {
    const r = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['--yes', 'tsx', 'tools/annotation-gap.mts', '--top', '0'],
      { cwd: at('.').pathname, encoding: 'utf8', timeout: 120_000 });
    if (r.status !== 0 && !mt(GAP)) return { error: (r.stderr || r.stdout || 'не посчиталось').trim().split('\n').slice(-3).join(' ') };
  }
  const g = readJson<{ at: string; totals: unknown; rows: { weight: number }[] }>(GAP, { at: '', totals: {}, rows: [] });
  const bands = [5, 2, 1, 0.5].map((th) => ({ th, n: g.rows.filter((r) => r.weight >= th).length }));
  return { at: g.at, totals: g.totals, bands, top: g.rows.slice(0, 15) };
}

// ─── сводка ───────────────────────────────────────────────────────────────────
function summary(fresh: boolean) {
  const cov = readJson<{ at?: string; globalPrecision?: number; totals?: Record<string, number> }>('.cache/markup-coverage.json', {});
  const prec = readJson<{ at?: string; method?: Record<string, { right: number; wrong: number; p: number; lb: number }>; trusted?: string[]; weak?: string[] }>('.cache/link-precision.json', {});
  const meta = channelMeta();
  const tiers = { essay: 0, review: 0, links: 0, book: 0, en: 0 };
  for (const m of Object.values(meta)) {
    if (m.via) tiers.links++; else if (m.tier === 'essay') tiers.essay++; else tiers.review++;
    if (m.medium === 'book') tiers.book++;
    if (m.language === 'en') tiers.en++;
  }
  const git = spawnSync('git', ['--no-optional-locks', 'status', '--porcelain'], { cwd: at('.').pathname, encoding: 'utf8' });
  const dirty = git.status === 0 ? git.stdout.split('\n').filter(Boolean).length : undefined;
  const lastCommit = spawnSync('git', ['--no-optional-locks', 'log', '-1', '--format=%h %cI %s'], { cwd: at('.').pathname, encoding: 'utf8' }).stdout?.trim();
  return {
    at: new Date().toISOString(),
    collect: lastCollect(), history: history(),
    stages: status().map((s) => ({ id: s.id, title: s.title, group: s.group, state: s.state, why: s.why, lastAt: s.lastAt, pending: s.pending?.text })),
    verdicts: verdicts(),
    coverage: cov.totals ? { at: cov.at, precision: cov.globalPrecision, ...cov.totals } : undefined,
    methods: prec.method ? { at: prec.at, method: prec.method, trusted: prec.trusted?.length ?? 0, weak: prec.weak?.length ?? 0 } : undefined,
    channels: { all: Object.keys(meta).length, ...tiers },
    annotation: gap(fresh),
    git: { dirty, lastCommit },
  };
}

// ─── что ждёт владельца (06.10) ─────────────────────────────────────────────────
// Наверху «Сводки» — дела, а не состояние: сколько привязок спорят, сколько роликов слабых рубрик не
// проверено, что ждёт опознания, что упало ночью. Те же числа — у вкладок в общей полосе (desk-shell.js).
// Очередь «Проверки» считается в том же процессе пульта и кешируется там же — здесь почти бесплатно.
interface Todo { id: string; n: number; text: string; href?: string; run?: string; level: 'act' | 'info' }
async function todo(): Promise<{ items: Todo[]; badges: Record<string, number>; running?: string }> {
  const items: Todo[] = [];
  const { checkRows } = await import('./check-desk.mts');
  const g: Record<string, number> = {};
  for (const r of checkRows()) g[r.group] = (g[r.group] ?? 0) + 1;
  if (g.spor) items.push({ id: 'spor', n: g.spor, text: 'спорных привязок — модель не согласна с опознавателем', href: '/check/#g=spor', level: 'act' });
  if (g.check) items.push({ id: 'check', n: g.check, text: 'привязок без проверки', href: '/check/#g=check', level: 'act' });
  if (g.gap) items.push({ id: 'gap', n: g.gap, text: 'роликов без привязки, где модель нашла фильм', href: '/check/#g=gap', level: 'act' });
  const { readLensFile, readLensVerdicts } = await import('./lens-lib.mts');
  const { WEAK } = await import('./lens-desk.mts');
  const human = readLensVerdicts();
  const weakTodo = Object.entries(readLensFile().items).filter(([id, l]) => !human[id] && WEAK.includes(l.lens)).length;
  if (weakTodo) items.push({ id: 'lens', n: weakTodo, text: 'роликов слабых рубрик не проверено', href: '/lens/#lens=weak', level: 'act' });
  const st = status();
  for (const s of st) {
    if (s.state === 'error') items.push({ id: `err-${s.id}`, n: 1, text: `шаг «${s.title}» упал${s.why ? `: ${s.why}` : ''}`, run: s.id, level: 'act' });
  }
  const unknown = st.find((s) => s.id === 'typed')?.pending;
  if (unknown?.n) items.push({ id: 'unknown', n: unknown.n, text: '«нет у нас» ждут опознания', run: 'typed', level: 'act' });
  const c = lastCollect();
  if (c?.failed.length) items.push({ id: 'collect', n: c.failed.length, text: `ночью упало: ${c.failed.join(', ')}`, level: 'act' });
  const dirty = st.find((s) => s.id === 'commit')?.pending;
  if (dirty?.n) items.push({ id: 'git', n: dirty.n, text: 'файлов данных не закоммичено', level: 'info' });
  // экран «Разметка» в приложении: когда очередь ушла на телефон и когда забирали решения
  const age = (p: string) => (mt(p) ? Math.round((Date.now() - mt(p)) / 36e5) : undefined);
  const q = age('.cache/owner-queue.json'), pulled = age('.cache/owner-pull.json');
  if (q != null) items.push({ id: 'phone', n: 0, text: `очередь на телефон — ${q ? `${q} ч назад` : 'только что'}${pulled != null ? `, решения забраны ${pulled ? `${pulled} ч назад` : 'только что'}` : ', решений с телефона ещё не забирали'}`, level: 'info' });
  const { runState } = await import('./pipeline.mts');
  const r = runState();
  const running = r && !r.finishedAt ? st.find((s) => s.id === r.current)?.title : undefined;
  return { items, badges: { check: g.spor ?? 0, lens: weakTodo }, ...(running ? { running } : {}) };
}

const send = (res: ServerResponse, code: number, body: unknown, type = 'application/json; charset=utf-8') => {
  res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
};

/** Вкладка общего пульта: `path` — адрес внутри вкладки. Хост и x-desk проверил tools/desk.mts. */
export async function dashRoute(req: IncomingMessage, res: ServerResponse, path: string): Promise<void> {
  const u = new URL(path, 'http://x');
  // общий пульт передаёт путь без строки запроса — параметры берём из полного адреса
  const params = new URL(req.url ?? '/', 'http://x').searchParams;
  if (req.method !== 'GET') return send(res, 404, { error: 'not_found' });
  if (u.pathname === '/') return send(res, 200, readFileSync(PAGE, 'utf8'), 'text/html; charset=utf-8');
  if (u.pathname === '/api/summary') return send(res, 200, summary(params.has('fresh')));
  if (u.pathname === '/api/todo') return send(res, 200, await todo());
  return send(res, 404, { error: 'not_found' });
}
