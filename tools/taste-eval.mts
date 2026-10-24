// Замер подбора на чужих историях (22.10): угадывает ли модель вкус человека. Истории — seeds/*.json (импорт Кинопоиска,
// Letterboxd, присланные списки). У каждого прячем пятую часть оценок, подбор видит остальное и выстраивает весь пул
// кандидатов — ровно тем счётом, что и лента (scoreCandidate + разбор + якорь вкуса + засветка топами; без ограничений
// разнообразия: они про шестёрку, а не про порядок). Дальше по спрятанному:
//   попадание@K — какая доля спрятанных любимых (верхние 30% шкалы самого человека) оказалась в первых K пула;
//   различение (AUC) — как часто любимое из спрятанного стоит выше нелюбимого (нижние 30%): 0,5 — наугад, 1 — всегда.
// Различение — главное: оно про вкус, а не про известность. Для сравнения — «что смотрят все»: сколько ДРУГИХ людей
// из тех же историй видели фильм (самый сильный простой соперник), наугад, и «соперник-кандидат» — соседи по вкусу
// (22.10, только здесь: люди, оценившие общее так же, и что они ставят выше своего обычного) и его смеси с моделью. Приложение грузится в Node через vite,
// как в tools/seed-slate.mts; на каждого человека — заново, чтобы истории не смешивались.
//   npx tsx tools/taste-eval.mts [--min 20] [--only kp_,letterboxd-] [--holdout 0.2] [--exp consensus,fameCap] [--cw 0.3] [--tag имя]
//        [--seeds <каталог>] [--max N]
// --seeds (24.10): истории из другого каталога в том же формате — эталон MovieLens (tools/movielens-seeds.py, на внешнем
// диске; только внутренний опыт). «Все смотрят», соседи, consensus, «сколько оценили» и itemSim тогда — из этого же
// набора, наши seeds/ не подмешиваются; --max N — мерить первых N историй по имени, таблицы — по всему набору.
// --exp learnedBlend,ease (24.10): обученный счёт с EASE (LEARNED_E) — EASE на каждого человека без него, из того же набора.
// Итог — .cache/eval/taste-<дата>.json и .md (вне git: там чужие истории); с --seeds тег по умолчанию — имя каталога.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer, createServerModuleRunnerTransport } from 'vite';
import { ESModulesEvaluator, ModuleRunner } from 'vite/module-runner';
import { ratedCountFrom } from '../src/lib/model/candidates.ts';
import { consensusFrom } from '../src/lib/model/consensus.ts';
import { itemSimSums, itemSimTable } from '../src/lib/model/itemSim.ts';
import { EASE, easeData, easeFit, easeInput, easePack, easeScores, type EaseFilm, type EasePacked } from '../src/lib/model/ease.ts';
import { peopleZ } from './consensus-data.mts';
import { peopleFilms, storiesRated } from './item-sim-data.mts';
import { identityOf } from './seed-identity.mts';

const argv = process.argv.slice(2);
const opt = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const MIN = Number(opt('--min') ?? 20);
const HOLDOUT = Number(opt('--holdout') ?? 0.2);
const ONLY = opt('--only')?.split(',');
// опыты над подбором (src/lib/model/experiments.ts): включаются в этом процессе, лента приложения не меняется
const EXP = (opt('--exp') ?? '').split(',').filter(Boolean);
// имя итога: опыты — в своём файле, чтобы не затирать замер без них
const CW = opt('--cw') != null ? Number(opt('--cw')) : undefined;
// другой набор историй (--seeds): итог — под его именем, наши замеры не затираются
const SEEDS = (opt('--seeds') ?? 'seeds').replace(/\/+$/, '');
const SET = SEEDS === 'seeds' ? '' : SEEDS.split('/').pop()!;
const TAG = opt('--tag') ?? [SET, EXP.join('+')].filter(Boolean).join('-');
const MAX = opt('--max') != null ? Number(opt('--max')) : Infinity;
const KS = [10, 50, 150];

interface SeedRating { workId: string; rating: number; raw?: number; work?: { externalIds?: { tmdb?: number; imdb?: string; kinopoisk?: number } } }
interface Seed { watched: { workId: string; work?: SeedRating['work'] }[]; ratings?: SeedRating[] }
const keysOf = (e: { workId: string; work?: SeedRating['work'] }) => {
  const x = e.work?.externalIds;
  return [e.workId, ...(x?.tmdb != null ? [`tmdb:${x.tmdb}`] : []), ...(x?.imdb ? [`imdb:${x.imdb}`] : []), ...(x?.kinopoisk != null ? [`kp:${x.kinopoisk}`] : [])];
};

// ─── истории ───────────────────────────────────────────────────────────────────
const seeds = new Map<string, Seed>();
for (const f of readdirSync(SEEDS).filter((f) => f.endsWith('.json')).sort()) {
  const name = f.replace(/\.json$/, '');
  // полное имя — ровно эта история; приставка («kp_», «letterboxd-») — все с ней (полное имя приставкой не считается: kp_1 ≠ kp_12)
  if (ONLY && !ONLY.some((p) => name === p || (/[_-]$/.test(p) && name.startsWith(p)))) continue;
  try {
    const s = JSON.parse(readFileSync(`${SEEDS}/${f}`, 'utf8')) as Seed;
    if ((s.ratings ?? []).filter((r) => r.raw != null).length >= MIN) seeds.set(name, s);
  } catch { /* не история */ }
}
/** один человек под разными историями (a_researcher: Letterboxd, Telegram, список) — для соседей и «все смотрят» он один:
 *  иначе его же вторая история подсказала бы спрятанное. Кто есть кто — tools/seed-identity.mts: группы по составу и оценкам
 *  из tools/seed-dupes.mts, без них — по имени без приставки источника */
const who = identityOf;
// «что смотрят все»: у скольких людей фильм есть в истории — по любому его ключу
const people = new Map<string, Set<string>>();
for (const [name, s] of seeds) for (const e of [...s.watched, ...(s.ratings ?? [])]) for (const k of keysOf(e)) {
  if (!people.has(k)) people.set(k, new Set());
  people.get(k)!.add(who(name));
}
// «похожий вкус» (22.10, офлайн — в приложении его нет): оценка в шкале самого человека (z: сколько его разбросов от его
// же среднего), фильм — по ключу TMDb, иначе IMDb, иначе id записи
const canon = (e: { workId: string; work?: SeedRating['work'] }) => { const k = keysOf(e); return k.find((x) => x.startsWith('tmdb:')) ?? k.find((x) => x.startsWith('imdb:')) ?? e.workId; };
function zOf(list: SeedRating[]): Map<string, number> {
  const raws = list.map((r) => r.raw!);
  const m = raws.reduce((a, b) => a + b, 0) / raws.length;
  const sd = Math.sqrt(raws.reduce((a, b) => a + (b - m) ** 2, 0) / raws.length) || 1;
  return new Map(list.map((r) => [canon(r), (r.raw! - m) / sd]));
}
const zAll = new Map([...seeds].map(([name, s]) => [name, zOf((s.ratings ?? []).filter((r) => r.raw != null))]));
const NEIGHBORS = 30;
const MIN_COMMON = 8;
/** соседи по вкусу: косинус z-оценок на общих фильмах, сжатый к нулю при малом числе общих; дальше счёт фильма — средняя
 *  z-оценка соседей с весом сходства (+1 в знаменателе: фильм, который оценил один сосед, не взлетает) */
function neighborScores(name: string, mine: Map<string, number>): Map<string, number> {
  const sims: { z: Map<string, number>; sim: number }[] = [];
  for (const [other, z] of zAll) {
    if (who(other) === who(name)) continue;
    let dot = 0, a = 0, b = 0, n = 0;
    for (const [k, zu] of mine) { const zv = z.get(k); if (zv == null) continue; dot += zu * zv; a += zu * zu; b += zv * zv; n++; }
    if (n < MIN_COMMON || !a || !b) continue;
    const sim = (dot / Math.sqrt(a * b)) * (n / (n + 20));
    if (sim > 0) sims.push({ z, sim });
  }
  sims.sort((x, y) => y.sim - x.sim);
  const num = new Map<string, number>(), den = new Map<string, number>();
  for (const { z, sim } of sims.slice(0, NEIGHBORS)) for (const [k, zv] of z) { num.set(k, (num.get(k) ?? 0) + sim * zv); den.set(k, (den.get(k) ?? 0) + sim); }
  return new Map([...num].map(([k, v]) => [k, v / (den.get(k)! + 1)]));
}
console.error(`историй с ${MIN}+ оценками${SET ? ` (${SEEDS})` : ''}: ${seeds.size}${Number.isFinite(MAX) ? `, мерим первые ${Math.min(MAX, seeds.size)}` : ''}`);
// «как оценили другие» (опыт consensus): z-оценки всех людей, каждому таблица — без него
// и обученному счёту (опыт learnedBlend, 23.10): мера — его часть
const withCons = EXP.includes('consensus') || EXP.includes('learnedBlend');
// подбор в два шага (опыт twoStage, 23.10): «сколько человек оценили» — из тех же z-оценок, каждому без него (ratedCountFrom,
// как src/mocks/consensusCount.ts: фильмы, оценённые не меньше чем тремя другими), иначе он сам добавлял бы себе «популярности»
const withCount = EXP.includes('twoStage');
const peopleCons = withCons || withCount ? peopleZ(MIN, SEEDS) : new Map<string, Map<string, number>>();
// «похожие фильмы» обученному счёту (learnedBlend, 23.10): суммы по парам — один раз (≈ 0,5 ГБ), каждому таблица без него
// (itemSimTable(суммы, кто)), как consensus: иначе таблица из src/mocks/itemSim.ts подсказала бы человеку его же спрятанное.
// И опыту itemSim (24.10) — по той же причине, а у чужого набора (--seeds) таблица из src/mocks — вовсе не его люди
const withSim = EXP.includes('learnedBlend') || EXP.includes('itemSim');
const withEase = EXP.includes('ease');
if (withEase && !EXP.includes('learnedBlend')) console.error('опыт ease без learnedBlend ничего не меняет: EASE — часть обученного счёта (--exp learnedBlend,ease)');
// истории с оценками (item-sim-data) — itemSim и EASE читают один раз; держим их весь прогон только при ease (вход человека)
const stories = withEase ? storiesRated(MIN, SEEDS) : undefined;
const simPeople = withSim || withEase ? peopleFilms(MIN, stories ?? storiesRated(MIN, SEEDS)) : undefined;
const simSums = withSim ? itemSimSums(simPeople!) : undefined;
// EASE обученному счёту (опыт ease, 24.10) — как столбцы easeBin/easeLike выгрузки (tools/dump-add-ease.mts) и как ответ
// GET /api/ease: X — те же истории, что замеряются (--seeds), по строке на человека; модель — без самого человека (его строк
// в X нет), вход — только НЕспрятанные его оценки, z — по ним же. Ответ — тем же easePack, что у сервера: клиент ищет
// фильмы так же, как в ленте
const easeX = withEase ? { bin: easeData(simPeople!, 'bin'), like: easeData(simPeople!, 'like') } : undefined;
simPeople?.clear();
function easeFor(name: string, hidden: Set<string>): EasePacked | undefined {
  if (!easeX) return undefined;
  const vis = (stories!.get(name) ?? []).filter((r) => !hidden.has(r.workId) && r.keys.length);
  if (!vis.length) return undefined;
  const mean = vis.reduce((a, r) => a + r.raw, 0) / vis.length;
  const sd = Math.sqrt(vis.reduce((a, r) => a + (r.raw - mean) ** 2, 0) / vis.length) || 1;
  const films: EaseFilm[] = vis.map((r) => ({ keys: r.keys, z: (r.raw - mean) / sd }));
  const me = who(name);
  const bin = easeFit(easeX.bin, EASE.lambda, me), like = easeFit(easeX.like, EASE.lambda, me);
  const xb = easeInput(easeX.bin, films);
  return easePack(easeX.bin, easeScores(bin, xb), easeScores(like, easeInput(easeX.like, films)), new Set(xb.keys()));
}

// ─── приложение в Node ─────────────────────────────────────────────────────────
const mem = new Map<string, string>();
const g = globalThis as Record<string, unknown>;
g.localStorage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => mem.set(k, String(v)), removeItem: (k: string) => mem.delete(k), clear: () => mem.clear(), key: () => null, length: 0 };
g.sessionStorage = g.localStorage;
g.location = new URL('http://localhost/?fresh');
g.window = globalThis; g.addEventListener = () => {}; g.removeEventListener = () => {};
const realTimeout = globalThis.setTimeout;
g.setTimeout = ((fn: () => void, ms?: number, ...rest: unknown[]) => realTimeout(fn, (ms ?? 0) <= 300 ? 0 : ms, ...rest)) as typeof setTimeout;
g.document = { documentElement: { lang: 'ru', dataset: {}, style: { setProperty() {} } }, addEventListener() {}, querySelector: () => null, createElement: () => ({ style: {} }) };

// внутренние функции открываются только этому процессу: состояние с «сервера» и счёт всего пула
const HOOK = `
import { fullScore as __full } from '@/lib/model/recommend';
import { fameExcluded as __fx } from '@/lib/model/fame';
export const __hydrate = hydrate;
import { setExperiments as __setExp } from '@/lib/model/experiments';
import { CONSENSUS_WEIGHT as __CW } from '@/lib/model/consensus';
import { twoStageSort as __ts } from '@/lib/model/candidates';
import { easeUnpack as __easeUnpack } from '@/lib/model/ease';
export async function __rank(exp = [], cons, weight, sim, cnt, ease) {
  __setExp(exp);
  // EASE (опыт ease) — без самого человека и по его видимым оценкам (замер собирает сам); loadEase без сервера таблицу не тронет
  if (ease) easeT = __easeUnpack(ease);
  // «сколько оценили» (twoStage) — без самого человека; loadConsensusCount таблицу из src/mocks уже не поставит (??=)
  if (cnt) consensusCountTable = cnt;
  // «как оценили другие» — таблица без самого человека (замер собирает её сам), вес — из --cw
  if (cons) consensusTable = cons;
  // «похожие фильмы» (learnedBlend) — тоже без него: loadItemSim таблицу из src/mocks уже не поставит (itemSimT ??=)
  if (sim) itemSimT = sim;
  if (weight != null) __CW.value = weight;
  await films();
  if (EXPERIMENTS.fullPool) await Promise.all([loadFilmLinks(), loadSeriesWiki()]);
  const rated = ratedCount();
  const anchorWeight = contentWeight(rated, MIN_RATED);
  if (anchorWeight) await loadGenres();
  await loadFame();
  const state = ownState();
  if (!state) return undefined;
  const anchor = anchorWeight ? deriveContentTaste(history().filter((e) => e.status === 'finished'), genresOf, settings.ratingNorm, settings.tasteShelves, countriesOf) : undefined;
  // счёт — тот же, что у ленты (fullScore); «без приглушения» — без засветки топами
  const opts = { ...(anchor ? { content: { weight: anchorWeight, fit: (w) => contentFit(anchor, w, genresOf, countriesOf) } } : {}), ...pickOpts() };
  const { fame: _f, ...noFame } = opts;
  const cs = candidates();
  const list = cs.map((c) => {
    const lvl = opts.fame ? opts.fame.level(c.work) : undefined;
    const score = opts.fame && __fx(lvl, opts.fame.mode) ? -1e9 : __full(state, c, 'normal', opts);
    return { keys: [c.work.id, ...keyList(c.work)], score, plain: __full(state, c, 'normal', noFame) };
  });
  // подбор в два шага (опыт twoStage, 23.10): порядок пула — тот же, что строит лента (recommend → twoStageSort поверх full,
  // квоты TWO_STAGE_FEED), а счёт модели заменён местом в нём (−место): попадание и AUC — по этому порядку. Исключённое
  // засветкой в отбор не идёт, как и в ленте, — остаётся внизу (−1e9). «Без приглушения» (plain) — прежний full, без отбора
  if (EXPERIMENTS.twoStage) {
    const live = cs.map((c, i) => ({ c, score: list[i].score, i })).filter((x) => x.score > -1e9);
    __ts(live, opts).forEach((x, pos) => { list[x.i].score = -pos; });
  }
  return { rated, list };
}`;
const vite = await createServer({ root: process.cwd(), server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] },
  plugins: [{ name: 'taste-eval', enforce: 'post', transform(code, id) { if (id.endsWith('/src/api/index.ts')) return `${code}\n${HOOK}`; } }] });
// предел ожидания модуля — 300 с (23.10): у vite 6.4 он transport.timeout ?? 60 с, а исполнитель ssrLoadModule строит
// транспорт сам, без предела, — под нагрузкой известность, правки справочника и тексты черновиков не грузились у 4–5 историй
// из 104 («transport invoke timed out after 60000ms»). Свой исполнитель на том же транспорте сервера — то же, что ssrLoadModule
const runner = new ModuleRunner({ root: process.cwd(), hmr: false, sourcemapInterceptor: false,
  transport: { ...createServerModuleRunnerTransport({ channel: vite.environments.ssr.hot }), timeout: 300_000 } }, new ESModulesEvaluator());

// ─── счёт ──────────────────────────────────────────────────────────────────────
/** детерминированный «случай» по имени: тот же человек — та же спрятанная пятая часть */
function rng(seed: string) {
  let h = 2166136261; for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 2 ** 32; };
}
const quantile = (xs: number[], q: number) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
/** доля пар «любимое выше нелюбимого»; равные — половина */
function auc(pos: number[], neg: number[]): number | undefined {
  if (!pos.length || !neg.length) return undefined;
  let s = 0; for (const p of pos) for (const n of neg) s += p > n ? 1 : p === n ? 0.5 : 0;
  return s / (pos.length * neg.length);
}

/** способы выстроить пул: модель как в ленте, без приглушения, «все смотрят», соседи и смеси (среднее мест в порядке) */
const METHODS = {
  model: 'модель (как в ленте)', plain: 'модель без приглушения топов', popular: '«что смотрят все»', neighbors: 'соседи по вкусу',
  modelNeighbors: 'модель + соседи', popularNeighbors: '«все смотрят» + соседи',
} as const;
type Method = keyof typeof METHODS;
const NAMES = Object.keys(METHODS) as Method[];
interface Row { name: string; ratings: number; inPool: number; pool: number; liked: number; disliked: number; neighbors: number;
  by: Record<Method, { hit: number[]; auc?: number }> }
const rows: Row[] = [];
for (const [name, seed] of [...seeds].slice(0, MAX)) {
  const t0 = Date.now();
  const rand = rng(name);
  const rated = (seed.ratings ?? []).filter((r) => r.raw != null);
  const hidden = new Set(rated.filter(() => rand() < HOLDOUT).map((r) => r.workId));
  const at = new Date().toISOString();
  mem.clear(); mem.set('tm.fresh', '1');
  vite.moduleGraph.invalidateAll();
  const api = await runner.import('/src/api/index.ts');
  await api.getRatingDeck();
  api.__hydrate({ settings: {}, predictions: [], verdicts: [],
    watched: seed.watched.filter((w) => !hidden.has(w.workId)).map((w) => ({ workId: w.workId, watched: true, ...(w.work ? { work: w.work } : {}) })),
    ratings: rated.filter((r) => !hidden.has(r.workId)).map((r) => ({ workId: r.workId, rating: r.rating, raw: r.raw, ...(r.work ? { work: r.work } : {}), at })) });
  const ranked = await api.__rank(EXP, withCons ? consensusFrom(peopleCons, who(name)) : undefined, CW, simSums ? itemSimTable(simSums, who(name)) : undefined,
    withCount ? ratedCountFrom(peopleCons, who(name)) : undefined, easeFor(name, hidden)) as { rated: number; list: { keys: string[]; score: number; plain: number }[] } | undefined;
  if (!ranked) { console.error(`${name}: модель не собралась (мало размеченного)`); continue; }

  const me = who(name);
  const others = (keys: string[]) => Math.max(0, ...keys.map((k) => [...(people.get(k) ?? [])].filter((p) => p !== me).length));
  // соседи — только по тому, что подбор видел (спрятанное в свой вектор не идёт)
  const mine = zOf(rated.filter((r) => !hidden.has(r.workId)));
  const nb = neighborScores(name, mine);
  const base = ranked.list.map((c, i) => {
    const popular = others(c.keys) + i * 1e-9;
    // без сигнала соседей — 0 («как обычно у соседей»); равные — по «все смотрят», чуть-чуть
    const n = Math.max(...c.keys.map((k) => nb.get(k) ?? -Infinity));
    return { keys: c.keys, model: c.score, plain: c.plain, popular, neighbors: (Number.isFinite(n) ? n : 0) + popular * 1e-6 };
  });
  /** место в порядке → доля от 1 (верх) до 0 (низ) */
  const pct = (field: 'plain' | 'popular' | 'neighbors') => {
    const order = base.map((_, i) => i).sort((x, y) => base[y][field] - base[x][field]);
    const out = new Array<number>(base.length);
    order.forEach((idx, r) => { out[idx] = 1 - r / base.length; });
    return out;
  };
  const [pPlain, pPop, pNb] = [pct('plain'), pct('popular'), pct('neighbors')];
  const list = base.map((c, i) => ({ ...c, modelNeighbors: (pPlain[i] + pNb[i]) / 2, popularNeighbors: (pPop[i] + pNb[i]) / 2 }));
  const ranks = Object.fromEntries(NAMES.map((m) => {
    const at = new Map<string, number>();
    [...list].sort((a, b) => b[m] - a[m]).forEach((c, i) => c.keys.forEach((k) => { if (!at.has(k)) at.set(k, i); }));
    return [m, at];
  })) as Record<Method, Map<string, number>>;
  const valueOf = new Map<string, (typeof list)[number]>();
  for (const c of list) for (const k of c.keys) if (!valueOf.has(k)) valueOf.set(k, c);

  // спрятанное, которое есть в пуле: только по нему и можно судить
  const raws = rated.map((r) => r.raw!);
  const hi = quantile(raws, 0.7), lo = quantile(raws, 0.3);
  const test = rated.filter((r) => hidden.has(r.workId)).map((r) => ({ r, key: keysOf(r).find((k) => valueOf.has(k)) })).filter((x) => x.key);
  const liked = test.filter((x) => x.r.raw! >= hi && x.r.raw! > lo);
  const disliked = test.filter((x) => x.r.raw! <= lo && x.r.raw! < hi);
  const measure = (m: Method) => ({
    hit: KS.map((k) => liked.length ? liked.filter((x) => ranks[m].get(x.key!)! < k).length / liked.length : 0),
    auc: auc(liked.map((x) => valueOf.get(x.key!)![m]), disliked.map((x) => valueOf.get(x.key!)![m])),
  });
  const row: Row = { name, ratings: rated.length, inPool: test.length, pool: list.length, liked: liked.length, disliked: disliked.length,
    neighbors: nb.size ? new Set([...zAll.keys()].filter((o) => who(o) !== me)).size : 0,
    by: Object.fromEntries(NAMES.map((m) => [m, measure(m)])) as Row['by'] };
  rows.push(row);
  const f = (x?: number) => (x == null ? ' — ' : x.toFixed(2));
  console.error(`${name}: оценок ${rated.length} (модель видит ${ranked.rated}), спрятано в пуле ${test.length} (любимых ${liked.length}, нелюбимых ${disliked.length}), `
    + `фильмов с сигналом соседей ${nb.size} · AUC ${NAMES.map((m) => `${m} ${f(row.by[m].auc)}`).join(' / ')} · ${((Date.now() - t0) / 1000).toFixed(0)} с`);
}
await runner.close();
await vite.close();

// ─── итог ──────────────────────────────────────────────────────────────────────
const mean = (xs: (number | undefined)[]) => { const v = xs.filter((x): x is number => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : undefined; };
/** различение по всем парам сразу: у кого больше спрятанного, тот и весит больше — короткие истории не шумят */
const pairs = (m: Method) => {
  let s = 0, n = 0;
  for (const r of rows) { const v = r.by[m].auc; if (v == null) continue; const w = r.liked * r.disliked; s += v * w; n += w; }
  return n ? s / n : undefined;
};
/** попадание — по всем любимым сразу */
const micro = (m: Method, i: number) => {
  const total = rows.reduce((s, r) => s + r.liked, 0);
  return total ? rows.reduce((s, r) => s + r.by[m].hit[i] * r.liked, 0) / total : 0;
};
const poolMean = mean(rows.map((r) => r.pool)) ?? 1;
const summary = {
  people: rows.length, liked: rows.reduce((s, r) => s + r.liked, 0), disliked: rows.reduce((s, r) => s + r.disliked, 0), pool: Math.round(poolMean),
  auc: Object.fromEntries(NAMES.map((m) => [m, pairs(m)])) as Record<Method, number | undefined>,
  aucPerPerson: Object.fromEntries(NAMES.map((m) => [m, mean(rows.map((r) => r.by[m].auc))])) as Record<Method, number | undefined>,
  hit: Object.fromEntries(KS.map((k, i) => [k, { ...Object.fromEntries(NAMES.map((m) => [m, micro(m, i)])), random: k / poolMean }])) as Record<number, Record<string, number>>,
};
const day = new Date().toISOString().slice(0, 10);
mkdirSync('.cache/eval', { recursive: true });
writeFileSync(`.cache/eval/taste-${day}${TAG ? `-${TAG}` : ''}.json`, JSON.stringify({ at: new Date().toISOString(), holdout: HOLDOUT, min: MIN, summary, rows }, null, 1));
const p = (x?: number) => (x == null ? '—' : `${(x * 100).toFixed(0)}%`);
const a = (x?: number) => (x == null ? '—' : x.toFixed(3));
const md = [
  `# Замер подбора на историях — ${day}${SET ? ` · набор ${SET}` : ''}${EXP.length ? ` · опыты: ${EXP.join(', ')}` : ''}`, '',
  `Людей ${summary.people}, спрятано любимых ${summary.liked} и нелюбимых ${summary.disliked}, пул кандидатов ~${summary.pool}.`, '',
  `| | ${NAMES.map((m) => METHODS[m]).join(' | ')} | наугад |`, `|---|${NAMES.map(() => '---').join('|')}|---|`,
  `| различение по всем парам (AUC) | ${NAMES.map((m) => a(summary.auc[m])).join(' | ')} | 0.500 |`,
  `| различение, среднее по людям | ${NAMES.map((m) => a(summary.aucPerPerson[m])).join(' | ')} | 0.500 |`,
  ...KS.map((k) => `| попадание@${k} | ${NAMES.map((m) => p(summary.hit[k][m])).join(' | ')} | ${p(summary.hit[k].random)} |`),
  '', `| история | оценок | в пуле | любимых / нелюбимых | ${NAMES.map((m) => `AUC ${METHODS[m]}`).join(' | ')} |`, `|---|---|---|---|${NAMES.map(() => '---').join('|')}|`,
  ...rows.map((r) => `| ${r.name} | ${r.ratings} | ${r.inPool} | ${r.liked} / ${r.disliked} | ${NAMES.map((m) => a(r.by[m].auc)).join(' | ')} |`),
].join('\n');
writeFileSync(`.cache/eval/taste-${day}${TAG ? `-${TAG}` : ''}.md`, `${md}\n`);
console.log(md.split('\n').slice(0, 11).join('\n'));
