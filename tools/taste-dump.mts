// Выгрузка частей счёта (23.10): одна выгрузка — перебор отдельно. Замер (tools/taste-eval.mts) на каждый вариант модели
// гонял всё приложение заново (20 мин на 104 истории, 2–4 ГБ); здесь приложение грузится по разу на человека, и на каждого
// кандидата его пула пишутся все слагаемые счёта ленты (scoreParts / contentParts, src/lib/model/recommend.ts), «как фильм
// оценили другие» (таблица без этого человека), «что смотрят все» и соседи по вкусу — как в замере. Перебор весов и вариантов
// дальше — tools/taste-tune.mts, без vite, за секунды. Формат файла — у тюнера и ниже (`write`), менять только вместе.
//   npx tsx tools/taste-dump.mts [--min 20] [--only kp_,letterboxd-] [--holdout 0.2] [--holdout-mode random|recent] [--seed 1]
//        [--exp levelCurve] [--cw 0.3] [--tag имя] [--fresh] [--timeout 300] [--visible 10] [--visible-mode random|popular]
// --visible N (23.10, холодный старт, .cache/eval/cold-start-2310.md): спрятанное и метки прежние, но приложение из
// неспрятанного видит только N оценок — случайные (rng(имя#short)) или N самых известных (как tools/cold-start-eval.mts);
// истории с неспрятанным меньше 40 — мимо, чтобы корзины N были на одних людях. Тег по умолчанию — с -vN / -vNp.
// Итог — .cache/eval/dump-<tag>/<история>.json (вне git: там чужие истории), по файлу на историю сразу, как посчитана;
// повторный запуск пропускает выгруженные с ok: true при тех же ключах (--fresh — заново).
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { createServer, createServerModuleRunnerTransport } from 'vite';
import { ESModulesEvaluator, ModuleRunner } from 'vite/module-runner';
import { ratedCountFrom } from '../src/lib/model/candidates.ts';
import { consensusFrom } from '../src/lib/model/consensus.ts';
import { EXPERIMENTS } from '../src/lib/model/experiments.ts';
import { ITEM_SIM, itemSimSums, itemSimTable, type RatedFilm } from '../src/lib/model/itemSim.ts';
import { NEIGHBOR_SHORT } from '../src/lib/model/neighbors.ts';
import { peopleZ } from './consensus-data.mts';
import { keysOf as simKeysOf, peopleFilms } from './item-sim-data.mts';
import { identityOf } from './seed-identity.mts';

const argv = process.argv.slice(2);
const opt = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const MIN = Number(opt('--min') ?? 20);
const HOLDOUT = Number(opt('--holdout') ?? 0.2);
/** что прятать: random — случайную долю (как taste-eval), recent — последние по дате оценки (нет дат — случайно, с пометкой) */
const MODE = (opt('--holdout-mode') ?? 'random') as 'random' | 'recent';
if (MODE !== 'random' && MODE !== 'recent') throw new Error(`--holdout-mode: random или recent, не ${MODE}`);
/** 1 — та же спрятанная доля, что у taste-eval (случай по имени); другое — другая доля, для проверки на нескольких */
const SEED = Number(opt('--seed') ?? 1);
const ONLY = opt('--only')?.split(',');
const EXP = (opt('--exp') ?? '').split(',').filter(Boolean);
// опечатка в имени опыта — сразу, а не ok: false у каждой истории через полчаса
for (const e of EXP) if (!(e in EXPERIMENTS)) throw new Error(`нет такого опыта: ${e} (есть: ${Object.keys(EXPERIMENTS).join(', ')})`);
const CW = opt('--cw') != null ? Number(opt('--cw')) : undefined;
/** видно только N неспрятанных оценок (23.10): random — случайные N, popular — N самых известных; нет ключа — вся история */
const VISIBLE = opt('--visible') != null ? Number(opt('--visible')) : undefined;
if (VISIBLE != null && !(Number.isInteger(VISIBLE) && VISIBLE > 0)) throw new Error(`--visible: целое > 0, не ${opt('--visible')}`);
const VMODE = (opt('--visible-mode') ?? 'random') as 'random' | 'popular';
if (VMODE !== 'random' && VMODE !== 'popular') throw new Error(`--visible-mode: random или popular, не ${VMODE}`);
/** как в cold-start-eval: неспрятанного не меньше этого, иначе история мимо (корзины N — на одних людях) */
const VISIBLE_MIN = 40;
const TAG = opt('--tag') ?? [EXP.length ? EXP.join('+') : 'base', MODE === 'recent' ? 'recent' : '', SEED !== 1 ? `s${SEED}` : '',
  VISIBLE != null ? `v${VISIBLE}${VMODE === 'popular' ? 'p' : ''}` : ''].filter(Boolean).join('-');
const FRESH = argv.includes('--fresh');
/** предел ожидания модуля от vite, с: по умолчанию у него 60 с, и под нагрузкой большие модули справочника не успевали */
const TIMEOUT = Number(opt('--timeout') ?? 300) * 1000;
const DIR = `.cache/eval/dump-${TAG}`;
// stage (23.10, только при --exp twoStage): −место строки в порядке подбора в два шага, как его строит лента (twoStageSort поверх
// full, квоты TWO_STAGE_FEED, «сколько оценили» — без этого человека); тюнеру — вариантом { from: 'zero', weights: { stage: 1 } },
// в обучение не брать (--drop stage)
const TWO = EXP.includes('twoStage');
const FEATS = ['content', 'essay', 'anchor', 'register', 'level', 'ops', 'fame', 'famePenalty', 'worth', 'boost',
  'consensus', 'popular', 'neighbors', 'itemSim', 'year', 'loud', 'full', ...(TWO ? ['stage'] : [])];

interface SeedRating { workId: string; rating: number; raw?: number; work?: { externalIds?: { tmdb?: number; imdb?: string; kinopoisk?: number } } }
interface Seed { watched: ({ workId: string; work?: SeedRating['work'] } & Record<string, unknown>)[]; ratings?: (SeedRating & Record<string, unknown>)[] }
const keysOf = (e: { workId: string; work?: SeedRating['work'] }) => {
  const x = e.work?.externalIds;
  return [e.workId, ...(x?.tmdb != null ? [`tmdb:${x.tmdb}`] : []), ...(x?.imdb ? [`imdb:${x.imdb}`] : []), ...(x?.kinopoisk != null ? [`kp:${x.kinopoisk}`] : [])];
};
const canon = (e: { workId: string; work?: SeedRating['work'] }) => { const k = keysOf(e); return k.find((x) => x.startsWith('tmdb:')) ?? k.find((x) => x.startsWith('imdb:')) ?? e.workId; };
const readSeed = (name: string): Seed | undefined => { try { return JSON.parse(readFileSync(`seeds/${name}.json`, 'utf8')) as Seed; } catch { return undefined; } };
const ratedOf = (s: Seed) => (s.ratings ?? []).filter((r) => r.raw != null);

// ─── истории: сводка без самих историй ─────────────────────────────────────────
// истории целиком (313 МБ JSON) в памяти не держим: здесь — только z-оценки и «кто что видел», каждая история читается
// заново, когда до неё дошла очередь
const who = identityOf;
function zOf(list: SeedRating[]): Map<string, number> {
  const raws = list.map((r) => r.raw!);
  const m = raws.reduce((a, b) => a + b, 0) / raws.length;
  const sd = Math.sqrt(raws.reduce((a, b) => a + (b - m) ** 2, 0) / raws.length) || 1;
  return new Map(list.map((r) => [canon(r), (r.raw! - m) / sd]));
}
const names: string[] = [];
const zAll = new Map<string, Map<string, number>>();
/** «что смотрят все»: ключ фильма → люди, у кого он в истории (как в taste-eval: по любому ключу) */
const people = new Map<string, Set<string>>();
for (const f of readdirSync('seeds').filter((f) => f.endsWith('.json')).sort()) {
  const name = f.replace(/\.json$/, '');
  // полное имя — ровно эта история; приставка («kp_», «letterboxd-») — все с ней
  if (ONLY && !ONLY.some((p) => name === p || (/[_-]$/.test(p) && name.startsWith(p)))) continue;
  const s = readSeed(name);
  if (!s || ratedOf(s).length < MIN) continue;
  names.push(name);
  zAll.set(name, zOf(ratedOf(s)));
  for (const e of [...s.watched, ...(s.ratings ?? [])]) for (const k of keysOf(e)) {
    if (!people.has(k)) people.set(k, new Set());
    people.get(k)!.add(who(name));
  }
}
const NEIGHBORS = 30;
const MIN_COMMON = 8;
/** соседи по вкусу — ровно как в taste-eval: косинус z-оценок на общих, сжатый к нулю при малом числе общих */
function neighborScores(name: string, mine: Map<string, number>, minCommon = MIN_COMMON): Map<string, number> {
  const sims: { z: Map<string, number>; sim: number }[] = [];
  for (const [other, z] of zAll) {
    if (who(other) === who(name)) continue;
    let dot = 0, a = 0, b = 0, n = 0;
    for (const [k, zu] of mine) { const zv = z.get(k); if (zv == null) continue; dot += zu * zv; a += zu * zu; b += zv * zv; n++; }
    if (n < minCommon || !a || !b) continue;
    const sim = (dot / Math.sqrt(a * b)) * (n / (n + 20));
    if (sim > 0) sims.push({ z, sim });
  }
  sims.sort((x, y) => y.sim - x.sim);
  const num = new Map<string, number>(), den = new Map<string, number>();
  for (const { z, sim } of sims.slice(0, NEIGHBORS)) for (const [k, zv] of z) { num.set(k, (num.get(k) ?? 0) + sim * zv); den.set(k, (den.get(k) ?? 0) + sim); }
  return new Map([...num].map(([k, v]) => [k, v / (den.get(k)! + 1)]));
}
// «как оценили другие»: z-оценки всех людей (все истории, как в taste-eval), каждому таблица — без него
const peopleCons = peopleZ(MIN);
// «похожие фильмы» обученному счёту (опыт learnedBlend, 23.10): суммы по парам — один раз (≈ 0,5 ГБ), каждому таблица без
// него (itemSimTable(суммы, кто)), как consensus; столбец itemSim тогда — из приложения, без опыта — пустой, как прежде
const simPeople = EXP.includes('learnedBlend') || (VISIBLE != null && VMODE === 'popular') ? peopleFilms(MIN) : undefined;
const simSums = EXP.includes('learnedBlend') ? itemSimSums(simPeople!) : undefined;
console.error(`историй с ${MIN}+ оценками: ${names.length} → ${DIR}`);

// ─── что прятать ───────────────────────────────────────────────────────────────
/** детерминированный «случай» по имени — тот же, что в taste-eval */
function rng(seed: string) {
  let h = 2166136261; for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 2 ** 32; };
}
/** дата оценки: у самой оценки или у записи просмотренного; в seeds/*.json на 23.10 дат нет ни у кого (импорт их не
 *  сохраняет) — recent тогда честно падает на случайное */
const DATE_FIELDS = ['at', 'date', 'ratedAt', 'watchedAt', 'finishedAt'];
const dateOf = (o: Record<string, unknown> | undefined): number | undefined => {
  for (const f of DATE_FIELDS) { const v = o?.[f]; const t = typeof v === 'string' || typeof v === 'number' ? Date.parse(String(v)) : NaN; if (Number.isFinite(t)) return t; }
  return undefined;
};
function holdout(name: string, seed: Seed, rated: (SeedRating & Record<string, unknown>)[]): { hidden: Set<string>; mode: 'random' | 'recent'; warnings: string[] } {
  const warnings: string[] = [];
  if (MODE === 'recent') {
    const watchedAt = new Map(seed.watched.map((w) => [w.workId, dateOf(w)]));
    const dated: { id: string; t: number }[] = [];
    for (const r of rated) { const t = dateOf(r) ?? watchedAt.get(r.workId); if (t != null) dated.push({ id: r.workId, t }); }
    // дат меньше чем у 80% оценок — «последние» уже не последние
    if (dated.length >= 0.8 * rated.length && dated.length) {
      if (dated.length < rated.length) warnings.push(`recent: без даты ${rated.length - dated.length} из ${rated.length} оценок — они не прячутся`);
      const n = Math.round(HOLDOUT * rated.length);
      return { hidden: new Set(dated.sort((a, b) => b.t - a.t).slice(0, n).map((x) => x.id)), mode: 'recent', warnings };
    }
    // у Кинопоиска дат в скачанных страницах нет, но есть место в списке «По порядку» (`listPos`, 0 — последняя оценка;
    // tools/kinopoisk-seed.mts, 23.10) — тогда «последние» = с наименьшим местом
    const watchedPos = new Map(seed.watched.map((w) => [w.workId, (w as Record<string, unknown>).listPos]));
    const placed: { id: string; p: number }[] = [];
    for (const r of rated) { const p = r.listPos ?? watchedPos.get(r.workId); if (typeof p === 'number') placed.push({ id: r.workId, p }); }
    if (placed.length >= 0.8 * rated.length && placed.length) {
      warnings.push(`recent: по месту в списке Кинопоиска (дат нет)${placed.length < rated.length ? `, без места ${rated.length - placed.length} — не прячутся` : ''}`);
      const n = Math.round(HOLDOUT * rated.length);
      return { hidden: new Set(placed.sort((a, b) => a.p - b.p).slice(0, n).map((x) => x.id)), mode: 'recent', warnings };
    }
    warnings.push(`recent: дат у оценок нет (${dated.length} из ${rated.length}) — спрятано случайно`);
  }
  const rand = rng(SEED === 1 ? name : `${name}#${SEED}`);
  return { hidden: new Set(rated.filter(() => rand() < HOLDOUT).map((r) => r.workId)), mode: 'random', warnings };
}
const quantile = (xs: number[], q: number) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };

// ─── видно только N (--visible, 23.10) ─────────────────────────────────────────
// Ровно как tools/cold-start-eval.mts: видимое — неспрятанные оценки, у которых есть ключи таблицы сходства (keysOf
// item-sim-data); random — первые N в порядке rng(имя#short); popular — N самых известных, известность — сколько других
// людей оценили фильм среди фильмов таблицы «похожие фильмы» (как itemSimSums: фильм — по первому ключу, прочие ключи — на
// него, оценили не меньше ITEM_SIM.minCommon), нет в таблице — 0; равные — в порядке rng(имя#pop).
interface PopIndex { index: Map<string, number>; cnt: Int32Array; mine: Map<string, Set<number>> }
function popIndex(people: Map<string, RatedFilm[]>, minCommon = ITEM_SIM.minCommon): PopIndex {
  const c0 = new Map<string, number>();
  for (const films of people.values()) for (const f of films) if (f.keys.length) c0.set(f.keys[0], (c0.get(f.keys[0]) ?? 0) + 1);
  const keys = [...c0].filter(([, c]) => c >= minCommon).map(([k]) => k).sort();
  const index = new Map(keys.map((k, i) => [k, i]));
  for (const films of people.values()) for (const f of films) {
    const i = f.keys.length ? index.get(f.keys[0]) : undefined;
    if (i != null) for (const k of f.keys.slice(1)) if (!index.has(k)) index.set(k, i);
  }
  const cnt = new Int32Array(keys.length), mine = new Map<string, Set<number>>();
  for (const [p, films] of people) {
    const set = new Set(films.map((f) => (f.keys.length ? index.get(f.keys[0]) : undefined)).filter((i): i is number => i != null));
    for (const i of set) cnt[i]++;
    mine.set(p, set);
  }
  return { index, cnt, mine };
}
/** известность записи для человека `me`: сколько других оценили (первый ключ, что есть в таблице), без него самого */
function popOf(pi: PopIndex, me: string, keys: string[]): number {
  let i: number | undefined;
  for (const k of keys) { i = pi.index.get(k); if (i != null) break; }
  return i == null ? 0 : pi.cnt[i] - (pi.mine.get(me)?.has(i) ? 1 : 0);
}
/** какие N из видимого видит приложение (`all` — неспрятанные с ключами таблицы, в порядке истории) */
function pickVisible<R extends { keys: string[] }>(name: string, all: R[], n: number, mode: 'random' | 'popular', pop: (r: R) => number): R[] {
  if (mode === 'random') { const sr = rng(`${name}#short`); return all.map((r) => ({ r, x: sr() })).sort((a, b) => a.x - b.x).map((x) => x.r).slice(0, n); }
  const pr = rng(`${name}#pop`);
  return all.map((r) => ({ r, p: pop(r), x: pr() })).sort((a, b) => b.p - a.p || a.x - b.x).map((x) => x.r).slice(0, n);
}
const pops = VISIBLE != null && VMODE === 'popular' ? popIndex(simPeople!) : undefined;
// ─── конец «видно только N» ────────────────────────────────────────────────────

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
// предупреждения приложения («известность не загрузилась» и т. п.) — в warnings текущей истории
let warns: string[] = [];
const realWarn = console.warn.bind(console);
console.warn = (...a: unknown[]) => { warns.push(a.map((x) => (x instanceof Error ? x.message : String(x))).join(' ').slice(0, 300)); realWarn(...a); };

// внутренние функции — только этому процессу. Счёт — тот же, что у ленты и taste-eval (fullScore с теми же опциями), плюс
// его слагаемые. Ленивые куски (известность, правки справочника, тексты черновиков, жанры) ждём явно и проверяем: упавший
// сбрасывает свой promise — пробуем ещё, не вышло — история ok: false. Фон приложения (тексты и разборы целиком через 6 с)
// отменяем: подбору он не нужен (essaysOf отвечает по индексу то же), а держал бы прежнюю копию приложения в памяти
const HOOK = `
import { fullScore as __full, scoreParts as __parts, contentParts as __cparts, SCORE_WEIGHTS as __SW, CURVE_WEIGHTS as __CWS } from '@/lib/model/recommend';
import { famePenalty as __fp } from '@/lib/model/fame';
import { setExperiments as __setExp, EXPERIMENTS as __EX } from '@/lib/model/experiments';
import { CONSENSUS_WEIGHT as __CW, consensusOf as __cof } from '@/lib/model/consensus';
import { loadAnchorCredits as __anchorCredits } from '@/lib/model/taste';
import { twoStageSort as __ts } from '@/lib/model/candidates';
import { fameExcluded as __fx } from '@/lib/model/fame';
export const __hydrate = hydrate;
export async function __dump(exp = [], cons, weight, sim, cnt) {
  __setExp(exp);
  // «сколько оценили» (twoStage) — без самого человека, как consensus
  if (cnt) consensusCountTable = cnt;
  if (sim) itemSimT = sim;
  // таблица без самого человека — всегда (столбец consensus); в счёт она идёт, только если включён опыт consensus
  consensusTable = cons;
  if (weight != null) __CW.value = weight;
  await films();
  if (EXPERIMENTS.fullPool) await Promise.all([loadFilmLinks(), loadSeriesWiki()]);
  clearTimeout(backgroundTimer); backgroundStarted = true;
  const fails = [];
  const need = async (what, load, ok) => { for (let i = 0; i < 3; i++) { await load(); if (ok()) return; } fails.push(what); };
  await need('известность', loadFame, () => fameLoad !== undefined && Object.keys(fameLevels).length > 0);
  await need('правки справочника', loadFixes, () => fixesLoad !== undefined);
  await need('тексты черновиков', draftTexts, () => textsLoad !== undefined);
  if (__EX.anchorKeep) await __anchorCredits();
  const rated = ratedCount();
  const anchorWeight = contentWeight(rated, MIN_RATED);
  // жанры — только якорю вкуса, как в ленте и taste-eval
  if (anchorWeight) await need('жанры', loadGenres, () => genresLoad !== undefined && Object.keys(filmGenres).length > 0);
  const state = ownState();
  if (!state) return { rated, fails };
  const anchor = anchorWeight ? deriveContentTaste(history().filter((e) => e.status === 'finished'), genresOf, settings.ratingNorm, settings.tasteShelves, countriesOf) : undefined;
  // shortHistory (23.10): число оценок для поправки r(n) — как в itemSimOpts (оценки с ключами таблицы); если его уже
  // передаёт само приложение (pickOpts), главнее оно. Без опыта поля нет — опции прежние
  const __n = __EX.shortHistory ? history().filter((e) => e.rating != null && consensusKeys(e.work.type, e.work.externalIds ?? externalIds[e.work.id]).length).length : undefined;
  const opts = { ...(__n != null ? { rated: __n } : {}), ...(anchor ? { content: { weight: anchorWeight, fit: (w) => contentFit(anchor, w, genresOf, countriesOf) } } : {}), ...pickOpts() };
  const cs = candidates();
  const rows = cs.map((c) => {
    const w = c.work, ids = w.externalIds ?? externalIds[w.id];
    const series = w.type === 'series' || w.type === 'anime';
    const p = __parts(state, c, 'normal', opts), cp = __cparts(state, w, 'normal');
    const lvl = fameOf(w);
    return { keys: [w.id, ...keyList(w)],
      key: ids?.tmdb != null ? (series ? 'tmdbtv:' : 'tmdb:') + ids.tmdb : ids?.imdb ? 'imdb:' + ids.imdb : w.id,
      content: p.content, essay: p.essay, anchor: p.anchor, register: cp?.register ?? null, level: cp?.level ?? null, ops: cp?.ops ?? null,
      fame: lvl ?? 0, famePenalty: opts.fame ? __fp(lvl, opts.fame.mode, state.mediaLiteracy) : 0, worth: p.worth, boost: p.boost,
      consensus: __cof(cons, w, ids) ?? null, itemSim: opts.itemSim ? opts.itemSim.of(w) ?? null : null, year: w.year ?? null, loud: (lvl ?? 0) >= 2 ? 1 : 0, full: __full(state, c, 'normal', opts) };
  });
  // подбор в два шага (twoStage, 23.10): место в порядке ленты; исключённое засветкой в отбор не идёт (как в recommend) — внизу
  if (__EX.twoStage) {
    const live = cs.map((c, i) => ({ c, score: rows[i].full, i })).filter((x) => !(opts.fame && __fx(opts.fame.level(x.c.work), opts.fame.mode)));
    rows.forEach((r) => { r.stage = -cs.length; });
    __ts(live, opts).forEach((x, pos) => { rows[x.i].stage = -pos; });
  }
  return { rated, fails, rows, anchorWeight, fameMode: opts.fame?.mode ?? 'off', consensusWeight: opts.consensus?.weight ?? 0,
    fameInFull: Boolean(opts.fame) && !__EX.fameCap, weights: __EX.levelCurve ? __CWS : __SW };
}`;
const vite = await createServer({ root: process.cwd(), server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] },
  plugins: [{ name: 'taste-dump', enforce: 'post', transform(code, id) { if (id.endsWith('/src/api/index.ts')) return `${code}\n${HOOK}`; } }] });
// свой исполнитель модулей вместо ssrLoadModule (23.10): у vite 6.4 предел ожидания модуля — transport.timeout ?? 60 с
// (vite/dist/node/module-runner.js, invoke), а исполнитель ssrLoadModule строит транспорт сам, без предела — не задать.
// Здесь тот же транспорт сервера, но с пределом. И между историями — clearCache() вместо invalidateAll(): приложение
// исполняется заново (своё состояние у каждого), а перекодировать модули справочника заново не нужно — они те же
const runner = new ModuleRunner({ root: process.cwd(), hmr: false, sourcemapInterceptor: false,
  transport: { ...createServerModuleRunnerTransport({ channel: vite.environments.ssr.hot }), timeout: TIMEOUT } }, new ESModulesEvaluator());

// ─── выгрузка ──────────────────────────────────────────────────────────────────
type Label = 1 | -1 | 0 | null;
interface DumpRow { keys: string[]; key: string; full: number; [f: string]: unknown }
interface Dumped { rated: number; fails: string[]; rows?: DumpRow[]; anchorWeight?: number; fameMode?: string; consensusWeight?: number; fameInFull?: boolean; weights?: Record<string, number> }
/** округление до 1e-8: сумма частей сходится с full точнее 1e-6 (проверка тюнера), а файл вдвое меньше */
const r8 = (x: unknown) => (typeof x === 'number' ? Math.round(x * 1e8) / 1e8 : x ?? null);
// visible/visibleMode — только при --visible: у прежних выгрузок ключи те же, и повторный запуск их не перевыгружает
const params = { mode: MODE, share: HOLDOUT, seed: SEED, exp: EXP.join(','), cw: CW ?? null, min: MIN,
  ...(VISIBLE != null ? { visible: VISIBLE, visibleMode: VMODE } : {}) };
/** выгружено ли уже: ok: true и те же ключи (иначе — заново: в папке не должны смешаться разные прогоны) */
function done(file: string): boolean {
  if (FRESH || !existsSync(file)) return false;
  try {
    const d = JSON.parse(readFileSync(file, 'utf8')) as { ok?: boolean; params?: typeof params };
    return d.ok === true && JSON.stringify(d.params) === JSON.stringify(params);
  } catch { return false; }
}
/** файл истории: сначала во временный, потом переименование — оборванный прогон не оставит половину файла */
function write(file: string, head: Record<string, unknown>, rows: unknown[][]): void {
  const json = `${JSON.stringify(head).slice(0, -1)},"rows":[\n${rows.map((r) => JSON.stringify(r)).join(',\n')}\n]}\n`;
  writeFileSync(`${file}.tmp`, json);
  renameSync(`${file}.tmp`, file);
}
mkdirSync(DIR, { recursive: true });
let skipped = 0, failed = 0, short = 0;
const tAll = Date.now();
for (const name of names) {
  const file = `${DIR}/${name}.json`;
  if (done(file)) { skipped++; continue; }
  const t0 = Date.now();
  const seed = readSeed(name)!;
  const rated = ratedOf(seed);
  const { hidden, mode, warnings } = holdout(name, seed, rated);
  // --visible: приложение видит только N неспрятанных (vis), спрятанное и метки прежние
  let vis: Set<SeedRating> | undefined, visOf = 0;
  if (VISIBLE != null) {
    const all = rated.filter((r) => !hidden.has(r.workId)).map((r) => ({ r, keys: simKeysOf(r as Parameters<typeof simKeysOf>[0]) })).filter((x) => x.keys.length);
    if (all.length < VISIBLE_MIN) { short++; console.error(`${name}: неспрятанного ${all.length} < ${VISIBLE_MIN} — мимо (--visible)`); continue; }
    visOf = all.length;
    vis = new Set(pickVisible(name, all, VISIBLE, VMODE, (x) => popOf(pops!, who(name), x.keys)).map((x) => x.r));
  }
  const seen = (r: SeedRating) => (vis ? vis.has(r) : !hidden.has(r.workId));
  const visIds = vis && new Set([...vis].map((r) => r.workId));
  const head = { name, who: who(name), holdout: { mode, share: HOLDOUT, seed: SEED, ...(mode !== MODE ? { requested: MODE } : {}) },
    ok: false, warnings, ratingsTotal: rated.length, hiddenTotal: hidden.size,
    // что спрятано — списком (23.10): дописывающим столбцы (dump-add-itemsim/-ease) не повторять holdout() — recent по месту
    // в списке им не воспроизвести, да и история с тех пор могла вырасти
    hiddenIds: [...hidden], hiddenInPool: 0, params,
    ...(vis ? { visible: { n: vis.size, mode: VMODE, of: visOf }, visibleIds: [...vis].map((r) => r.workId) } : {}) } as Record<string, unknown>;
  warns = [];
  let dumped: Dumped | undefined;
  try {
    mem.clear(); mem.set('tm.fresh', '1');
    // приложение — заново: своё состояние у каждой истории, прежняя копия уходит сборщику
    runner.clearCache();
    const api = await runner.import('/src/api/index.ts');
    await api.getRatingDeck();
    const at = new Date().toISOString();
    api.__hydrate({ settings: {}, predictions: [], verdicts: [],
      watched: seed.watched.filter((w) => (visIds ? visIds.has(w.workId) : !hidden.has(w.workId))).map((w) => ({ workId: w.workId, watched: true, ...(w.work ? { work: w.work } : {}) })),
      ratings: rated.filter(seen).map((r) => ({ workId: r.workId, rating: r.rating, raw: r.raw, ...(r.work ? { work: r.work } : {}), at })) });
    dumped = await api.__dump(EXP, consensusFrom(peopleCons, who(name)), CW, simSums ? itemSimTable(simSums, who(name)) : undefined,
      TWO ? ratedCountFrom(peopleCons, who(name)) : undefined) as Dumped;
  } catch (err) {
    warnings.push(`приложение упало: ${err instanceof Error ? err.message : String(err)}`.slice(0, 500));
  }
  warnings.push(...warns.map((w) => `приложение: ${w}`));
  if (dumped?.fails.length) warnings.push(`не загрузилось: ${dumped.fails.join(', ')}`);
  if (dumped && !dumped.rows) warnings.push('модель не собралась (мало размеченного)');
  if (!dumped?.rows) { write(file, { ...head, feats: FEATS }, []); failed++; console.error(`${name}: ok: false — ${warnings.join('; ')}`); continue; }

  // «что смотрят все» и соседи — только по видимому подбору (спрятанное в свой вектор не идёт), без самого человека
  const me = who(name);
  const others = (keys: string[]) => Math.max(0, ...keys.map((k) => { const s = people.get(k); return s ? s.size - (s.has(me) ? 1 : 0) : 0; }));
  const mineRated = rated.filter(seen);
  // shortHistory: у короткой истории соседи — с меньшим числом общих (NEIGHBOR_SHORT, neighbors.ts)
  const nb = neighborScores(name, zOf(mineRated), EXP.includes('shortHistory') && mineRated.length < NEIGHBOR_SHORT.below ? NEIGHBOR_SHORT.minCommon : MIN_COMMON);
  const list = dumped.rows;
  // метки спрятанного — как в taste-eval: первая строка пула с этим ключом; любимое/нелюбимое — верх и низ 30% шкалы человека
  const rowOf = new Map<string, number>();
  list.forEach((c, i) => c.keys.forEach((k) => { if (!rowOf.has(k)) rowOf.set(k, i); }));
  const raws = rated.map((r) => r.raw!);
  const hi = quantile(raws, 0.7), lo = quantile(raws, 0.3);
  const label = new Map<number, Label>();
  let inPool = 0;
  for (const r of rated) {
    if (!hidden.has(r.workId)) continue;
    const k = keysOf(r).find((x) => rowOf.has(x));
    if (!k) continue;
    inPool++;
    const i = rowOf.get(k)!;
    if (!label.has(i)) label.set(i, r.raw! >= hi && r.raw! > lo ? 1 : r.raw! <= lo && r.raw! < hi ? -1 : 0);
  }
  // --visible: неспрятанное, но невидимое приложение в пул пустило (оно о нём не знает) — из пула вон, как в выгрузке целой
  // истории (там его убирает само приложение) и в cold-start-eval: человек это уже смотрел. Меченое спрятанное — остаётся
  const unseen = new Set<string>();
  if (visIds) for (const e of [...seed.watched, ...(seed.ratings ?? [])]) if (!hidden.has(e.workId) && !visIds.has(e.workId)) keysOf(e).forEach((k) => unseen.add(k));
  const keep = (c: DumpRow, i: number) => !unseen.size || label.has(i) || !c.keys.some((k) => unseen.has(k));
  const rows = list.flatMap((c, i) => {
    if (!keep(c, i)) return [];
    const n = Math.max(...c.keys.map((k) => nb.get(k) ?? -Infinity));
    const v: Record<string, unknown> = { ...c, popular: others(c.keys), neighbors: Number.isFinite(n) ? n : null, itemSim: c.itemSim ?? null };
    return [[c.key, label.get(i) ?? null, ...FEATS.map((f) => r8(v[f]))]];
  });
  if (visIds) head.unseenDropped = list.length - rows.length;
  head.ok = !dumped.fails.length;
  head.hiddenInPool = inPool;
  // как сложить full из частей при этом прогоне (тюнеру — для проверки): full = content + essay + anchor − fame·famePenalty
  // + consensus·(consensus ?? 0) + worth + boost; content = (Σ вес·доля уровня/операций/регистра) / Σ весов + остаток
  write(file, { ...head, feats: FEATS, rated: dumped.rated, pool: rows.length,
    sum: { fame: dumped.fameInFull ? 1 : 0, consensus: dumped.consensusWeight, anchorWeight: dumped.anchorWeight, fameMode: dumped.fameMode, content: dumped.weights } }, rows);
  if (!head.ok) failed++;
  console.error(`${name}: оценок ${rated.length} (модель видит ${dumped.rated}), спрятано ${hidden.size}, в пуле ${inPool}, пул ${rows.length}`
    + `${head.ok ? '' : ' · ok: false'}${warnings.length ? ` · ${warnings.join('; ').slice(0, 300)}` : ''} · ${((Date.now() - t0) / 1000).toFixed(0)} с`);
  dumped = undefined;
  (globalThis as { gc?: () => void }).gc?.();
}
await runner.close();
await vite.close();
console.error(`готово: ${names.length - skipped - short} выгружено (ok: false — ${failed}), пропущено уже выгруженных ${skipped}`
  + `${VISIBLE != null ? `, коротких для --visible ${short}` : ''} · ${((Date.now() - tAll) / 60000).toFixed(1)} мин → ${DIR}`);
