// Есть ли у людей рост уровня (25.10, шаг 1 отчёта «Рекомендации за пределами кинотеатров»): меняется ли со временем
// сложность (complexityLevel разметки) того, что человек смотрит и что ему нравится. От ответа зависит, обещать «на шаг
// сложнее» (рост по высоте) или «на шаг дальше» (по ширине).
//
// Истории — seeds/*.json. Время: у Letterboxd — дата записи (`at`), у Кинопоиска дат нет, только место в списке «По порядку»
// (`listPos`, 0 — последняя оценка; tools/kinopoisk-seed.mts) — тогда время = доля пути по списку от первой оценки (0) к
// последней (1). Уровень вещи — из приложения: оно грузится через vite один раз, все вещи историй гидрируются одной
// пачкой, history() отдаёт их с разметкой (как лента видит). Нет уровня (0) — вещь мимо.
//
// На человека: «понравилось» — оценка не ниже его 70-го процентиля (как в taste-eval), центр — 0,7-квантиль уровня
// понравившегося (как complexityComfort). Считается:
//   наклон — МНК уровня по времени (за всю историю, 0 → 1; у Letterboxd ещё и в год) — по всему оценённому и по понравившемуся;
//   ранняя и поздняя треть — центр понравившегося;
//   прогноз последней пятой части понравившегося: «стоит на месте» (центр всего раньше), «последнее» (центр последней пятой
//   части раньше) и «тренд» (прямая по раньше) — у кого ошибка меньше;
//   нуль — те же оценки с перемешанным временем (200 раз): какая доля людей с наклоном > 0 и какой средний наклон бывают
//   случайно.
//   npx tsx tools/level-drift.mts [--min 30] [--fresh]
// Итог — .cache/eval/level-drift-<дата>.json и .md (вне git: там чужие истории); уровни вещей — .cache/eval/level-map.json.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';

const argv = process.argv.slice(2);
const opt = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const MIN = Number(opt('--min') ?? 30);
const MAP = '.cache/eval/level-map.json';

interface Ext { tmdb?: number; imdb?: string; kinopoisk?: number }
interface SeedRating { workId: string; rating: number; raw?: number; at?: string; listPos?: number; work?: { externalIds?: Ext; year?: number } & Record<string, unknown> }
interface Seed { watched: { workId: string; at?: string; listPos?: number; work?: SeedRating['work'] }[]; ratings?: SeedRating[] }
const keysOf = (e: { workId: string; work?: SeedRating['work'] }) => {
  const x = e.work?.externalIds;
  return [e.workId, ...(x?.tmdb != null ? [`tmdb:${x.tmdb}`] : []), ...(x?.imdb ? [`imdb:${x.imdb}`] : []), ...(x?.kinopoisk != null ? [`kp:${x.kinopoisk}`] : [])];
};

const seeds = new Map<string, Seed>();
for (const f of readdirSync('seeds').filter((f) => f.endsWith('.json')).sort()) {
  try {
    const s = JSON.parse(readFileSync(`seeds/${f}`, 'utf8')) as Seed;
    if ((s.ratings ?? []).filter((r) => r.raw != null).length >= MIN) seeds.set(f.replace(/\.json$/, ''), s);
  } catch { /* не история */ }
}

// ─── уровни вещей из приложения ────────────────────────────────────────────────
async function levelMap(): Promise<Record<string, number>> {
  if (existsSync(MAP) && !argv.includes('--fresh')) return JSON.parse(readFileSync(MAP, 'utf8'));
  const { createServer, createServerModuleRunnerTransport } = await import('vite');
  const { ESModulesEvaluator, ModuleRunner } = await import('vite/module-runner');
  const mem = new Map<string, string>();
  const g = globalThis as Record<string, unknown>;
  g.localStorage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => mem.set(k, String(v)), removeItem: (k: string) => mem.delete(k), clear: () => mem.clear(), key: () => null, length: 0 };
  g.sessionStorage = g.localStorage;
  g.location = new URL('http://localhost/?fresh');
  g.window = globalThis; g.addEventListener = () => {}; g.removeEventListener = () => {};
  const realTimeout = globalThis.setTimeout;
  g.setTimeout = ((fn: () => void, ms?: number, ...rest: unknown[]) => realTimeout(fn, (ms ?? 0) <= 300 ? 0 : ms, ...rest)) as typeof setTimeout;
  g.document = { documentElement: { lang: 'ru', dataset: {}, style: { setProperty() {} } }, addEventListener() {}, querySelector: () => null, createElement: () => ({ style: {} }) };
  // вещи с разметкой — как их видит история приложения (annotated + правки справочника)
  const HOOK = `
export async function __levels() {
  await films(); await loadFixes();
  return history().map((e) => ({ keys: [e.work.id, ...keyList(e.work)], level: e.work.complexityLevel ?? 0 }));
}
export const __hydrate = hydrate;`;
  const vite = await createServer({ root: process.cwd(), server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] },
    plugins: [{ name: 'level-drift', enforce: 'post', transform(code, id) { if (id.endsWith('/src/api/index.ts')) return `${code}\n${HOOK}`; } }] });
  const runner = new ModuleRunner({ root: process.cwd(), hmr: false, sourcemapInterceptor: false,
    transport: { ...createServerModuleRunnerTransport({ channel: vite.environments.ssr.hot }), timeout: 300_000 } }, new ESModulesEvaluator());
  mem.set('tm.fresh', '1');
  const api = await runner.import('/src/api/index.ts');
  await api.getRatingDeck();
  const works = new Map<string, SeedRating>();
  for (const s of seeds.values()) for (const r of s.ratings ?? []) if (!works.has(r.workId)) works.set(r.workId, r);
  const at = new Date().toISOString();
  api.__hydrate({ settings: {}, predictions: [], verdicts: [], watched: [],
    ratings: [...works.values()].map((r) => ({ workId: r.workId, rating: 3, raw: 6, ...(r.work ? { work: r.work } : {}), at })) });
  const rows = await api.__levels() as { keys: string[]; level: number }[];
  await vite.close();
  const out: Record<string, number> = {};
  for (const r of rows) if (r.level > 0) for (const k of r.keys) out[k] ??= r.level;
  mkdirSync('.cache/eval', { recursive: true });
  writeFileSync(MAP, JSON.stringify(out));
  console.log(`уровни: вещей в пачке ${works.size}, в истории ${rows.length}, с уровнем ${rows.filter((r) => r.level > 0).length}`);
  return out;
}
const LEVEL = await levelMap();
const levelOf = (r: SeedRating) => { for (const k of keysOf(r)) if (LEVEL[k]) return LEVEL[k]; return null; };

// ─── счёт ──────────────────────────────────────────────────────────────────────
const quantile = (xs: number[], q: number) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
const median = (xs: number[]) => quantile(xs, 0.5);
const slope = (pts: { t: number; v: number }[]) => {
  const n = pts.length; if (n < 3) return null;
  const mt = pts.reduce((a, p) => a + p.t, 0) / n, mv = pts.reduce((a, p) => a + p.v, 0) / n;
  const sxx = pts.reduce((a, p) => a + (p.t - mt) ** 2, 0);
  return sxx ? pts.reduce((a, p) => a + (p.t - mt) * (p.v - mv), 0) / sxx : null;
};
function rng(seed: string) {
  let h = 2166136261; for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 2 ** 32; };
}
const center = (xs: number[]) => quantile(xs, 0.7);

interface Pt { t: number; v: number; liked: boolean; year: number | null }
interface Person { name: string; clock: 'date' | 'order'; n: number; liked: number; spanYears: number | null;
  slopeAll: number; slopeLiked: number | null; slopeLikedPerYear: number | null; early: number; late: number;
  pred: { flat: number; recent: number; trend: number } | null; yearSlope: number | null;
  /** поправки: уровень минус средний уровень фильмов того же пятилетия выпуска; наклон без первой пятой части истории */
  slopeLikedAdj?: number | null; slopeLikedTail?: number | null }
const people: Person[] = [];
const pointsOf = new Map<string, Pt[]>();
let skipped = 0;
for (const [name, s] of seeds) {
  const watchedWhen = new Map(s.watched.map((w) => [w.workId, w]));
  const rated = (s.ratings ?? []).filter((r) => r.raw != null);
  const likedFrom = quantile(rated.map((r) => r.raw!), 0.7);
  const dated = rated.filter((r) => r.at ?? watchedWhen.get(r.workId)?.at).length;
  const placed = rated.filter((r) => (r.listPos ?? watchedWhen.get(r.workId)?.listPos) != null).length;
  const clock = dated >= 0.8 * rated.length ? 'date' : placed >= 0.8 * rated.length ? 'order' : null;
  if (!clock) { skipped++; continue; }
  const raw: { time: number; v: number; liked: boolean; year: number | null }[] = [];
  for (const r of rated) {
    const v = levelOf(r); if (v == null) continue;
    const w = watchedWhen.get(r.workId);
    const time = clock === 'date' ? Date.parse((r.at ?? w?.at)!) : -((r.listPos ?? w?.listPos) as number);
    if (!Number.isFinite(time)) continue;
    raw.push({ time, v, liked: r.raw! >= likedFrom, year: typeof r.work?.year === 'number' ? r.work.year : null });
  }
  if (raw.length < MIN) { skipped++; continue; }
  const t0 = Math.min(...raw.map((p) => p.time)), t1 = Math.max(...raw.map((p) => p.time));
  if (t1 === t0) { skipped++; continue; }
  // время → 0…1 от первой оценки к последней; при датах — ещё и годы
  const pts: Pt[] = raw.map((p) => ({ t: (p.time - t0) / (t1 - t0), v: p.v, liked: p.liked, year: p.year })).sort((a, b) => a.t - b.t);
  const spanYears = clock === 'date' ? (t1 - t0) / (365.25 * 864e5) : null;
  const liked = pts.filter((p) => p.liked);
  if (liked.length < 10) { skipped++; continue; }
  const third = Math.floor(liked.length / 3);
  // прогноз последней пятой части понравившегося по тому, что было раньше
  const cut = Math.floor(liked.length * 0.8), before = liked.slice(0, cut), after = liked.slice(cut);
  const target = center(after.map((p) => p.v));
  const sl = slope(before);
  const mt = before.reduce((a, p) => a + p.t, 0) / before.length, mv = before.reduce((a, p) => a + p.v, 0) / before.length;
  const tAfter = after.reduce((a, p) => a + p.t, 0) / after.length;
  const trendGuess = sl == null ? center(before.map((p) => p.v)) : Math.min(10, Math.max(1, center(before.map((p) => p.v)) + sl * (tAfter - mt) + 0 * mv));
  const pred = after.length >= 3 ? {
    flat: Math.abs(center(before.map((p) => p.v)) - target),
    recent: Math.abs(center(before.slice(-Math.max(3, Math.floor(before.length / 4))).map((p) => p.v)) - target),
    trend: Math.abs(trendGuess - target),
  } : null;
  const sLiked = slope(liked);
  const withYear = pts.filter((p) => p.year != null).map((p) => ({ t: p.t, v: p.year! }));
  people.push({ name, clock, n: pts.length, liked: liked.length, spanYears,
    slopeAll: slope(pts)!, slopeLiked: sLiked, slopeLikedPerYear: sLiked != null && spanYears && spanYears >= 1 ? sLiked / spanYears : null,
    early: center(liked.slice(0, third).map((p) => p.v)), late: center(liked.slice(-third).map((p) => p.v)),
    pred, yearSlope: slope(withYear) });
  pointsOf.set(name, pts);
}

// поправка на год выпуска: средний уровень оценённого по пятилетиям (по всем людям) — поздние оценки чаще новые фильмы,
// и если уровень у новых другой, «рост» был бы сдвигом года, а не вкуса
const byBin = new Map<number, { s: number; n: number }>();
for (const pts of pointsOf.values()) for (const p of pts) if (p.year != null) {
  const b = Math.floor(p.year / 5); const x = byBin.get(b) ?? { s: 0, n: 0 }; x.s += p.v; x.n++; byBin.set(b, x);
}
const binMean = (y: number) => { const x = byBin.get(Math.floor(y / 5)); return x && x.n >= 30 ? x.s / x.n : null; };
for (const p of people) {
  const liked = pointsOf.get(p.name)!.filter((x) => x.liked);
  p.slopeLikedAdj = slope(liked.flatMap((x) => { const m = x.year != null ? binMean(x.year) : null; return m == null ? [] : [{ t: x.t, v: x.v - m }]; }));
  p.slopeLikedTail = slope(liked.filter((x) => x.t >= 0.2));
}
const decades = [...byBin].filter(([, x]) => x.n >= 30).sort((a, b) => a[0] - b[0]).map(([b, x]) => `${b * 5}: ${(x.s / x.n).toFixed(2)} (${x.n})`);

// нуль: то же, но время внутри человека перемешано
const NULL_RUNS = 200;
const nullPos: number[] = [], nullMean: number[] = [];
const rand = rng('level-drift');
for (let k = 0; k < NULL_RUNS; k++) {
  let pos = 0, sum = 0, n = 0;
  for (const p of people) {
    const pts = pointsOf.get(p.name)!.filter((x) => x.liked);
    const ts = pts.map((x) => x.t);
    for (let i = ts.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [ts[i], ts[j]] = [ts[j], ts[i]]; }
    const s = slope(pts.map((x, i) => ({ t: ts[i], v: x.v })));
    if (s == null) continue;
    n++; sum += s; if (s > 0) pos++;
  }
  nullPos.push(pos / n); nullMean.push(sum / n);
}

const pos = (xs: (number | null | undefined)[]) => { const v = xs.filter((x): x is number => x != null); return { positive: v.filter((x) => x > 0).length / Math.max(1, v.length), median: v.length ? median(v) : null, mean: v.reduce((a, x) => a + x, 0) / Math.max(1, v.length) }; };
const group = (ps: Person[]) => {
  const sl = ps.map((p) => p.slopeLiked).filter((x): x is number => x != null);
  const sa = ps.map((p) => p.slopeAll);
  const withPred = ps.filter((p) => p.pred);
  const mae = (k: 'flat' | 'recent' | 'trend') => withPred.reduce((a, p) => a + p.pred![k], 0) / Math.max(1, withPred.length);
  const best = { flat: 0, recent: 0, trend: 0 };
  for (const p of withPred) { const m = Math.min(p.pred!.flat, p.pred!.recent, p.pred!.trend); for (const k of ['flat', 'recent', 'trend'] as const) if (p.pred![k] === m) { best[k]++; break; } }
  const perYear = ps.map((p) => p.slopeLikedPerYear).filter((x): x is number => x != null);
  return {
    people: ps.length, ratings: ps.reduce((a, p) => a + p.n, 0),
    liked: { positive: sl.filter((x) => x > 0).length / sl.length, meanSlope: sl.reduce((a, x) => a + x, 0) / sl.length, medianSlope: median(sl),
      bigUp: sl.filter((x) => x >= 1).length, bigDown: sl.filter((x) => x <= -1).length },
    all: { positive: sa.filter((x) => x > 0).length / sa.length, meanSlope: sa.reduce((a, x) => a + x, 0) / sa.length },
    earlyLate: { early: median(ps.map((p) => p.early)), late: median(ps.map((p) => p.late)), up: ps.filter((p) => p.late > p.early).length, down: ps.filter((p) => p.late < p.early).length },
    perYear: perYear.length ? { people: perYear.length, median: median(perYear), positive: perYear.filter((x) => x > 0).length / perYear.length } : null,
    predict: { people: withPred.length, mae: { flat: mae('flat'), recent: mae('recent'), trend: mae('trend') }, best },
    yearSlope: median(ps.map((p) => p.yearSlope).filter((x): x is number => x != null)),
    adj: pos(ps.map((p) => p.slopeLikedAdj)), tail: pos(ps.map((p) => p.slopeLikedTail)),
  };
};
const all = group(people), byDate = group(people.filter((p) => p.clock === 'date')), byOrder = group(people.filter((p) => p.clock === 'order'));
const nullStats = { positive: { mean: nullPos.reduce((a, x) => a + x, 0) / NULL_RUNS, p95: quantile(nullPos, 0.95), p05: quantile(nullPos, 0.05) },
  meanSlope: { p95: quantile(nullMean, 0.95), p05: quantile(nullMean, 0.05) } };

const date = new Date().toISOString().slice(0, 10).slice(5).split('-').reverse().join('');
mkdirSync('.cache/eval', { recursive: true });
writeFileSync(`.cache/eval/level-drift-${date}.json`, JSON.stringify({ min: MIN, skipped, all, byDate, byOrder, null: nullStats, people, decades }, null, 1));
const f1 = (x: number | null | undefined) => (x == null ? '—' : x.toFixed(2));
const pc = (x: number) => `${Math.round(x * 100)}%`;
const line = (t: string, gr: ReturnType<typeof group>) => [
  `### ${t}: ${gr.people} человек, ${gr.ratings} оценок с уровнем`,
  `- понравившееся: наклон > 0 у ${pc(gr.liked.positive)}; средний наклон ${f1(gr.liked.meanSlope)}, медиана ${f1(gr.liked.medianSlope)} уровня за всю историю; ≥ +1 у ${gr.liked.bigUp}, ≤ −1 у ${gr.liked.bigDown}`,
  `- всё оценённое: наклон > 0 у ${pc(gr.all.positive)}, средний ${f1(gr.all.meanSlope)}`,
  `- центр понравившегося, ранняя треть → поздняя (медиана по людям): ${f1(gr.earlyLate.early)} → ${f1(gr.earlyLate.late)}; выше у ${gr.earlyLate.up}, ниже у ${gr.earlyLate.down}`,
  ...(gr.perYear ? [`- в год (история ≥ 1 года, ${gr.perYear.people} чел.): медиана ${f1(gr.perYear.median)}, > 0 у ${pc(gr.perYear.positive)}`] : []),
  `- прогноз последней пятой части понравившегося (${gr.predict.people} чел.), ошибка центра: «стоит на месте» ${f1(gr.predict.mae.flat)}, «последнее» ${f1(gr.predict.mae.recent)}, «тренд» ${f1(gr.predict.mae.trend)}; лучший у ${gr.predict.best.flat} / ${gr.predict.best.recent} / ${gr.predict.best.trend}`,
  `- год выпуска по времени (медиана наклона): ${f1(gr.yearSlope)} лет за историю`,
  `- с поправкой на год выпуска: наклон > 0 у ${pc(gr.adj.positive)}, средний ${f1(gr.adj.mean)}, медиана ${f1(gr.adj.median)}`,
  `- без первой пятой части истории (массовое заполнение): наклон > 0 у ${pc(gr.tail.positive)}, средний ${f1(gr.tail.mean)}, медиана ${f1(gr.tail.median)}`,
].join('\n');
const md = [`# Дрейф уровня — ${new Date().toISOString().slice(0, 10)}`, '',
  `Историй с ≥ ${MIN} оценок: ${seeds.size}, посчитано ${people.length}, мимо ${skipped} (нет времени, мало уровня или понравившегося).`, '',
  line('Все', all), '', line('С датами (Letterboxd)', byDate), '', line('По месту в списке (Кинопоиск)', byOrder), '',
  `Средний уровень оценённого по пятилетиям выпуска: ${decades.join('; ')}`, '',
  `Нуль (время перемешано, ${NULL_RUNS} раз): доля с наклоном > 0 — ${pc(nullStats.positive.mean)} (5–95%: ${pc(nullStats.positive.p05)}–${pc(nullStats.positive.p95)}); средний наклон 5–95%: ${f1(nullStats.meanSlope.p05)}…${f1(nullStats.meanSlope.p95)}`,
].join('\n');
writeFileSync(`.cache/eval/level-drift-${date}.md`, md);
console.log(md);
