// Почему подбор не обгоняет «что смотрят все» (22.10, разбор к tools/taste-eval.mts). Только анализ: приложение не трогает.
// Те же истории (seeds/*.json) и та же спрятанная пятая часть (тот же «случай» по имени), приложение грузится в Node через
// vite так же, как в taste-eval. Для каждого человека снимается: состояние модели (комфорт, операции, вкус к регистрам),
// шкала оценок, вес якоря вкуса, и по каждому оценённому фильму из пула — признаки карточки (уровень, операции, регистры,
// жанры, страны, авторы, год, длина, известность, разборы, сериал, откуда разметка) и слагаемые счёта scoreCandidate
// (levelFit, ops, registerFit, ниша, сродство) + якорь + приглушение. Дальше без приложения:
//   покрытие разметкой; связь каждого признака с оценкой человека (z в его шкале); различение (AUC) на спрятанном —
//   у счёта приложения, у каждого слагаемого, у простых «кодировок по цели» (средняя оценка человека у этого автора,
//   жанра, страны…) и у гребневой регрессии на признаках: своя у каждого, общая по остальным людям, и общая + своя.
//   npx tsx tools/taste-why.mts [--min 20] [--only kp_,letterboxd-] [--holdout 0.2] [--median-norm] [--cached [--day 2026-10-22]]
// Сбор (долгий) кэшируется в .cache/eval/why-data-<дата>.json; --cached — только пересчёт. Итог — печать в консоль
// (сводка для .cache/eval/why-<дата>.md пишется руками). Всё вне git: там чужие истории.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';

const argv = process.argv.slice(2);
const opt = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const MIN = Number(opt('--min') ?? 20);
const HOLDOUT = Number(opt('--holdout') ?? 0.2);
const ONLY = opt('--only')?.split(',');
const CACHED = argv.includes('--cached');
const day = opt('--day') ?? new Date().toISOString().slice(0, 10);
/** --median-norm (проверка ошибки): норма шкалы — медиана человека, а не семёрка владельца из моков (src/mocks/index.ts
 *  settings.ratingNorm подмешивается всем при загрузке справочника) */
const MEDIAN_NORM = argv.includes('--median-norm');
const DATA = `.cache/eval/why-data-${day}${MEDIAN_NORM ? '-median' : ''}.json`;

interface SeedRating { workId: string; rating: number; raw?: number; work?: { creators?: string[]; externalIds?: { tmdb?: number; imdb?: string; kinopoisk?: number } } }
interface Seed { watched: { workId: string; work?: SeedRating['work'] }[]; ratings?: SeedRating[] }
const keysOf = (e: { workId: string; work?: SeedRating['work'] }) => {
  const x = e.work?.externalIds;
  return [e.workId, ...(x?.tmdb != null ? [`tmdb:${x.tmdb}`] : []), ...(x?.imdb ? [`imdb:${x.imdb}`] : []), ...(x?.kinopoisk != null ? [`kp:${x.kinopoisk}`] : [])];
};
const who = (name: string) => name.replace(/^(?:kp_|letterboxd-|tg-|trakt-)/, '').toLowerCase();
function rng(seed: string) {
  let h = 2166136261; for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 2 ** 32; };
}
const quantile = (xs: number[], q: number) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };

const seeds = new Map<string, Seed>();
for (const f of readdirSync('seeds').filter((f) => f.endsWith('.json')).sort()) {
  const name = f.replace(/\.json$/, '');
  if (ONLY && !ONLY.some((p) => name.startsWith(p))) continue;
  try {
    const s = JSON.parse(readFileSync(`seeds/${f}`, 'utf8')) as Seed;
    if ((s.ratings ?? []).filter((r) => r.raw != null).length >= MIN) seeds.set(name, s);
  } catch { /* не история */ }
}
// «что смотрят все» — как в taste-eval: у скольких людей фильм есть в истории
const people = new Map<string, Set<string>>();
for (const [name, s] of seeds) for (const e of [...s.watched, ...(s.ratings ?? [])]) for (const k of keysOf(e)) {
  if (!people.has(k)) people.set(k, new Set());
  people.get(k)!.add(who(name));
}

// ─── сбор: приложение в Node ───────────────────────────────────────────────────
/** признаки карточки — от человека не зависят */
interface Feat { id: string; keys: string[]; src: string; conf?: string; level: number; ops: [string, number][]; regs: string[]; genres: string[];
  countries: string[]; creators: string[]; year: number; dur?: number; series: boolean; niche: boolean; heavy: number; fame: number; essays: number }
/** слагаемые счёта — у каждого свои */
interface Comp { levelFit: number; ops: number; reg: number; niche: number; aff: number; time: number; content: number; fameP: number; score: number; plain: number; check: number; rank: number; rankPlain: number }
interface PersonData { name: string; rated: number; anchorWeight: number; norm: number; scaleSource: string; histRaw: number; histMarked: number; histWithGenres: number;
  state: { comfort: number; literacy: number; ops: { op: string; level: number }[]; regs: { register: string; affinity: number; n: number }[] };
  pool: number; items: Record<string, Comp>; histCreators: string[] }

async function collect(): Promise<{ feats: Record<string, Feat>; persons: PersonData[] }> {
  const { createServer } = await import('vite');
  const mem = new Map<string, string>();
  const g = globalThis as Record<string, unknown>;
  g.localStorage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => mem.set(k, String(v)), removeItem: (k: string) => mem.delete(k), clear: () => mem.clear(), key: () => null, length: 0 };
  g.sessionStorage = g.localStorage;
  g.location = new URL('http://localhost/?fresh');
  g.window = globalThis; g.addEventListener = () => {}; g.removeEventListener = () => {};
  const realTimeout = globalThis.setTimeout;
  g.setTimeout = ((fn: () => void, ms?: number, ...rest: unknown[]) => realTimeout(fn, (ms ?? 0) <= 300 ? 0 : ms, ...rest)) as typeof setTimeout;
  g.document = { documentElement: { lang: 'ru', dataset: {}, style: { setProperty() {} } }, addEventListener() {}, querySelector: () => null, createElement: () => ({ style: {} }) };

  // весь пул (вместе с виденным — по нему и сверяем оценки), слагаемые счёта повторены здесь и сверены со scoreCandidate
  const HOOK = `
import { ESSAY_BONUS as __EB, registerFit as __rf, heaviness as __hv, timePenalty as __tp } from '@/lib/model/recommend';
import { famePenalty as __fp, fameExcluded as __fx } from '@/lib/model/fame';
import { opLoad as __ol, deriveScale as __ds } from '@/lib/model/deriveState';
export const __hydrate = hydrate;
export async function __why(wantKeys) {
  await films();
  await loadGenres();
  await loadFame();
  const rated = ratedCount();
  const anchorWeight = contentWeight(rated, MIN_RATED);
  const state = ownState();
  if (!state) return undefined;
  const hist = history();
  const scale = __ds(hist.map((e) => e.raw).filter((r) => r != null), settings.ratingNorm);
  const anchor = deriveContentTaste(hist.filter((e) => e.status === 'finished'), genresOf, settings.ratingNorm, settings.tasteShelves, countriesOf);
  const fame = fameOpts().fame;
  const seenK = seenKeys();
  const catIds = new Set(Object.keys(mocks.works));
  const seedIds = new Set(candidateSeeds.map((s) => s.id));
  const conf = new Map(draftSources(false).map((d) => [d.work.id, d.annotation.confidence]));
  const strong = new Set([...state.operations].sort((a, b) => b.level - a.level).slice(0, 3).map((o) => o.op));
  const opLvl = new Map(state.operations.map((o) => [o.op, o.level]));
  const target = state.complexityComfort + 0.4;
  const all = candidatePool().map((c) => {
    const w = c.work;
    const levelFit = Math.max(0, 1 - Math.abs(w.complexityLevel - target) / 3);
    let of = 0, wt = 0;
    for (const oi of w.primaryOperations) { const l = opLvl.get(oi.op); if (l == null) continue; const gap = __ol(w.complexityLevel, oi.intensity) - l;
      of += (gap < -1.5 ? 0.4 : gap <= 1.5 ? 1 : gap <= 3 ? 0.6 : 0.2) * oi.intensity; wt += oi.intensity; }
    const ops = wt ? of / wt : 0.5;
    const reg = __rf(state, w);
    const niche = w.isNicheMasterpiece ? (state.mediaLiteracy >= 6 ? 0.1 : -0.15) : 0;
    const aff = strong.has(w.primaryOperations[0]?.op) ? 0.04 : 0;
    const time = __tp(w, 'normal');
    const content = contentFit(anchor ?? { genres: {}, countries: {}, creators: {} }, w, genresOf, countriesOf);
    const sc = scoreCandidate(state, w, 'normal');
    const check = sc - ((0.4 * levelFit + 0.3 * ops + 0.3 * reg) + niche + aff - time);
    const plain = sc + (c.essays ? __EB : 0) + (anchorWeight ? anchorWeight * content : 0);
    const lvl = fame ? fame.level(w) : undefined;
    const fameP = fame ? __fp(lvl, fame.mode, state.mediaLiteracy) : 0;
    const score = fame && __fx(lvl, fame.mode) ? -1e9 : plain - fameP;
    return { c, w, keys: [w.id, ...keyList(w)], seen: seen(w, seenK), comp: { levelFit, ops, reg, niche, aff, time, content, fameP, score, plain, check } };
  });
  // места — среди того, что модель предложила бы (без виденного), как в taste-eval
  const open = all.filter((x) => !x.seen);
  const place = (f) => { const m = new Map(); [...open].sort((a, b) => b.comp[f] - a.comp[f]).forEach((x, i) => m.set(x, i)); return m; };
  const r1 = place('score'), r2 = place('plain');
  const want = new Set(wantKeys);
  const items = {}, feats = {};
  for (const x of all) {
    if (!x.keys.some((k) => want.has(k))) continue;
    const w = x.w;
    items[w.id] = { ...x.comp, rank: r1.get(x) ?? -1, rankPlain: r2.get(x) ?? -1 };
    feats[w.id] = { id: w.id, keys: x.keys, src: catIds.has(w.id) ? 'catalog' : seedIds.has(w.id) ? 'pool' : 'draft', conf: conf.get(w.id),
      level: w.complexityLevel, ops: w.primaryOperations.map((o) => [o.op, o.intensity]), regs: w.registers ?? [], genres: genresOf(w),
      countries: w.countries ?? [], creators: w.creators.slice(0, 2), year: w.year, dur: w.durationMinutes, series: isSeries(w),
      niche: w.isNicheMasterpiece, heavy: __hv(w), fame: fameLevels[w.id] ?? 0, essays: x.c.essays ?? 0 };
  }
  return { rated, anchorWeight, norm: scale.norm, scaleSource: scale.source, pool: open.length,
    histRaw: hist.filter((e) => e.raw != null).length,
    histMarked: hist.filter((e) => e.status === 'finished' && e.work.complexityLevel > 0 && e.work.primaryOperations.length).length,
    histWithGenres: hist.filter((e) => genresOf(e.work).length).length,
    histCreators: [...new Set(hist.flatMap((e) => e.work.creators.slice(0, 2)))],
    state: { comfort: state.complexityComfort, literacy: state.mediaLiteracy, ops: state.operations.map((o) => ({ op: o.op, level: o.level })), regs: state.registerTaste ?? [] },
    items, feats };
}`;
  const vite = await createServer({ root: process.cwd(), server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] },
    plugins: [{ name: 'taste-why', enforce: 'post', transform(code, id) { if (id.endsWith('/src/api/index.ts')) return `${code}\n${HOOK}`; } }] });
  const feats: Record<string, Feat> = {};
  const persons: PersonData[] = [];
  for (const [name, seed] of seeds) {
    const t0 = Date.now();
    const rand = rng(name);
    const rated = (seed.ratings ?? []).filter((r) => r.raw != null);
    const hidden = new Set(rated.filter(() => rand() < HOLDOUT).map((r) => r.workId));
    const at = new Date().toISOString();
    mem.clear(); mem.set('tm.fresh', '1');
    vite.moduleGraph.invalidateAll();
    const api = await vite.ssrLoadModule('/src/api/index.ts');
    await api.getRatingDeck();
    api.__hydrate({ settings: MEDIAN_NORM ? { ratingNorm: undefined } : {}, predictions: [], verdicts: [],
      watched: seed.watched.filter((w) => !hidden.has(w.workId)).map((w) => ({ workId: w.workId, watched: true, ...(w.work ? { work: w.work } : {}) })),
      ratings: rated.filter((r) => !hidden.has(r.workId)).map((r) => ({ workId: r.workId, rating: r.rating, raw: r.raw, ...(r.work ? { work: r.work } : {}), at })) });
    const out = await api.__why(rated.flatMap(keysOf));
    if (!out) { console.error(`${name}: модель не собралась`); continue; }
    Object.assign(feats, out.feats);
    const { feats: _f, ...rest } = out;
    persons.push({ name, ...rest });
    console.error(`${name}: оценок ${rated.length}, модель видит ${out.rated}, в пуле ${Object.keys(out.items).length} · ${((Date.now() - t0) / 1000).toFixed(0)} с`);
  }
  await vite.close();
  return { feats, persons };
}

let data: { feats: Record<string, Feat>; persons: PersonData[] };
if (CACHED && existsSync(DATA)) data = JSON.parse(readFileSync(DATA, 'utf8'));
else {
  data = await collect();
  mkdirSync('.cache/eval', { recursive: true });
  writeFileSync(DATA, JSON.stringify(data));
}

// ─── разбор ────────────────────────────────────────────────────────────────────
const { feats } = data;
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const sd = (xs: number[]) => { const m = mean(xs); return Math.sqrt(mean(xs.map((x) => (x - m) ** 2))); };
function corr(x: number[], y: number[]): number {
  const mx = mean(x), my = mean(y); let a = 0, b = 0, c = 0;
  for (let i = 0; i < x.length; i++) { a += (x[i] - mx) * (y[i] - my); b += (x[i] - mx) ** 2; c += (y[i] - my) ** 2; }
  return b && c ? a / Math.sqrt(b * c) : NaN;
}
function auc(pos: number[], neg: number[]): number | undefined {
  if (!pos.length || !neg.length) return undefined;
  let s = 0; for (const p of pos) for (const n of neg) s += p > n ? 1 : p === n ? 0.5 : 0;
  return s / (pos.length * neg.length);
}
const f3 = (x?: number) => (x == null || Number.isNaN(x) ? '—' : x.toFixed(3));
const f2 = (x?: number) => (x == null || Number.isNaN(x) ? '—' : x.toFixed(2));
const pc = (x: number) => `${(x * 100).toFixed(0)}%`;

/** одна оценка человека, сведённая с карточкой пула */
interface Obs { id: string; raw: number; z: number; hidden: boolean; liked: boolean; disliked: boolean; f: Feat; c: Comp; pop: number; cons: number }
/** «как оценили другие»: z-оценки всех людей по любому ключу фильма (без самого человека) — общее мнение, не вкус */
const zBy = new Map<string, { who: string; z: number }[]>();
for (const [name, s] of seeds) {
  const rs = (s.ratings ?? []).filter((r) => r.raw != null); const raws = rs.map((r) => r.raw!);
  const m0 = raws.reduce((a, b) => a + b, 0) / raws.length; const s0 = Math.sqrt(raws.reduce((a, b) => a + (b - m0) ** 2, 0) / raws.length) || 1;
  for (const r of rs) for (const k of keysOf(r)) { if (!zBy.has(k)) zBy.set(k, []); zBy.get(k)!.push({ who: who(name), z: (r.raw! - m0) / s0 }); }
}
const consensus = (keys: string[], me: string): number => {
  const seen = new Map<string, number>();
  for (const k of keys) for (const x of zBy.get(k) ?? []) if (x.who !== me && !seen.has(x.who)) seen.set(x.who, x.z);
  const zs = [...seen.values()];
  return zs.reduce((a, b) => a + b, 0) / (zs.length + 2);
};
interface P { d: PersonData; me: string; all: number; vis: number; obs: Obs[]; creatorSame: number; creatorBoth: number }
const ps: P[] = [];
for (const d of data.persons) {
  const seed = seeds.get(d.name); if (!seed) continue;
  const rand = rng(d.name);
  const rated = (seed.ratings ?? []).filter((r) => r.raw != null);
  const hidden = new Set(rated.filter(() => rand() < HOLDOUT).map((r) => r.workId));
  const raws = rated.map((r) => r.raw!);
  const m = mean(raws), s = sd(raws) || 1;
  const hi = quantile(raws, 0.7), lo = quantile(raws, 0.3);
  const byKey = new Map<string, string>();
  for (const id of Object.keys(d.items)) for (const k of feats[id].keys) if (!byKey.has(k)) byKey.set(k, id);
  const me = who(d.name);
  const seenIds = new Set<string>();
  const obs: Obs[] = [];
  let creatorSame = 0, creatorBoth = 0;
  for (const r of rated) {
    const id = keysOf(r).map((k) => byKey.get(k)).find(Boolean);
    if (!id || seenIds.has(id)) continue;
    seenIds.add(id);
    const f = feats[id];
    // автор строкой в карточке истории (её приносит импорт) и в карточке пула — одна ли это строка
    const sc = (r.work?.creators ?? []).slice(0, 2);
    if (sc.length && f.creators.length) { creatorBoth++; if (sc.some((c) => f.creators.includes(c))) creatorSame++; }
    const pop = Math.max(0, ...f.keys.map((k) => [...(people.get(k) ?? [])].filter((p) => p !== me).length));
    obs.push({ id, raw: r.raw!, z: (r.raw! - m) / s, hidden: hidden.has(r.workId), liked: r.raw! >= hi && r.raw! > lo, disliked: r.raw! <= lo && r.raw! < hi, f, c: d.items[id], pop, cons: consensus(f.keys, me) });
  }
  ps.push({ d, me, all: rated.length, vis: rated.length - hidden.size, obs, creatorSame, creatorBoth });
}
const out: string[] = [];
const say = (s = '') => { out.push(s); console.log(s); };

// 1. покрытие и доставка оценок
say('## 1. Покрытие разметкой и доставка оценок');
const tot = (f: (p: P) => number) => ps.reduce((a, p) => a + f(p), 0);
say(`людей ${ps.length}; оценок ${tot((p) => p.all)}; дошло до истории с оценкой ${tot((p) => p.d.histRaw)}; размечено в истории (видит модель) ${tot((p) => p.d.histMarked)} `
  + `(${pc(tot((p) => p.d.histMarked) / tot((p) => p.vis))} видимых ей оценок); в пуле кандидатов ${tot((p) => p.obs.length)} (${pc(tot((p) => p.obs.length) / tot((p) => p.all))})`);
const srcCount = new Map<string, number>();
for (const p of ps) for (const o of p.obs) { const k = o.f.src === 'draft' ? `draft:${o.f.conf ?? '?'}` : o.f.src; srcCount.set(k, (srcCount.get(k) ?? 0) + 1); }
say(`откуда разметка у оценённого в пуле: ${[...srcCount].map(([k, v]) => `${k} ${v}`).join(', ')}`);
say(`шкала: ${ps.map((p) => `${p.d.name.replace(/^letterboxd-/, 'lb-')} норма ${p.d.norm}`).slice(0, 0).join('')}нормы — ${[...new Set(ps.map((p) => p.d.norm))].sort().join(', ')}; источник — ${[...new Set(ps.map((p) => p.d.scaleSource))].join(', ')}`);
const anchorOff = ps.filter((p) => !p.d.anchorWeight);
say(`якорь вкуса выключен (вес 0, ≥${50} размеченных) у ${anchorOff.length} из ${ps.length}; у них оценок в сумме ${anchorOff.reduce((a, p) => a + p.all, 0)} из ${tot((p) => p.all)}`);
say(`история с жанрами TMDb: ${pc(tot((p) => p.d.histWithGenres) / tot((p) => p.d.histRaw))}`);
const badCheck = ps.flatMap((p) => p.obs.filter((o) => Math.abs(o.c.check) > 1e-9)).length;
say(`сверка слагаемых со scoreCandidate: расхождений ${badCheck}`);
// авторы: совпадают ли строки авторов истории и пула
{
  let both = 0, hit = 0;
  for (const p of ps) { const hc = new Set(p.d.histCreators); for (const o of p.obs.filter((x) => x.hidden)) { if (!o.f.creators.length) continue; both++; if (o.f.creators.some((c) => hc.has(c))) hit++; } }
  say(`спрятанное, у чьего автора есть другой фильм в истории человека (по строке имени): ${pc(hit / (both || 1))} из ${both}`);
  say(`один и тот же фильм: автор в карточке истории и в карточке пула совпадает строкой у ${pc(tot((p) => p.creatorSame) / tot((p) => p.creatorBoth))} из ${tot((p) => p.creatorBoth)}`);
  const unmarked = ps.flatMap((p) => p.obs.filter((o) => !o.f.level)).length;
  say(`в пуле без разметки (счёт 0): ${unmarked} оценённых`);
  const fs2 = Object.values(feats).filter((f) => !f.series);
  say(`карточки пула (оценённые): жанры TMDb есть у ${pc(fs2.filter((f) => f.genres.length).length / fs2.length)} фильмов, длина — у ${pc(fs2.filter((f) => f.dur).length / fs2.length)}, страна — у ${pc(fs2.filter((f) => f.countries.length).length / fs2.length)}`);
}

// 2. сверка с taste-eval и различение слагаемых на спрятанном
say('\n## 2. Различение на спрятанном (AUC любимое > нелюбимого, по всем парам, вес = любимых×нелюбимых)');
type Scorer = (o: Obs, p: P) => number;
const hiddenAllOf = (it: (o: Obs) => boolean) => ps.reduce((a, p) => a + p.obs.filter((o) => o.hidden && it(o)).length, 0);
function pooled(score: Scorer, filter: (p: P) => boolean = () => true, item: (o: Obs) => boolean = () => true): { all?: number; per?: number; n: number } {
  let s = 0, w = 0; const per: number[] = []; let n = 0;
  for (const p of ps.filter(filter)) {
    const t = p.obs.filter((o) => o.hidden && item(o));
    const pos = t.filter((o) => o.liked).map((o) => score(o, p)), neg = t.filter((o) => o.disliked).map((o) => score(o, p));
    const a = auc(pos, neg); if (a == null) continue;
    s += a * pos.length * neg.length; w += pos.length * neg.length; per.push(a); n++;
  }
  return { all: w ? s / w : undefined, per: per.length ? mean(per) : undefined, n };
}
const comps: [string, Scorer][] = [
  ['счёт как в ленте (score)', (o) => o.c.score], ['«как оценили другие» (средняя z других людей)', (o) => o.cons], ['без приглушения (plain)', (o) => o.c.plain], ['«все смотрят» (pop)', (o) => o.pop],
  ['levelFit', (o) => o.c.levelFit], ['opFit', (o) => o.c.ops], ['registerFit', (o) => o.c.reg], ['ниша (niche)', (o) => o.c.niche],
  ['сродство ведущей операции', (o) => o.c.aff], ['якорь contentFit (даже если вес 0)', (o) => o.c.content], ['−приглушение (−fameP)', (o) => -o.c.fameP],
  ['известность (fame 0…3)', (o) => o.f.fame], ['число разборов', (o) => o.f.essays], ['уровень сложности как есть', (o) => o.f.level],
  ['год', (o) => o.f.year], ['−год', (o) => -o.f.year], ['длина', (o) => o.f.dur ?? 0],
];
say('| признак | AUC по парам | AUC среднее по людям | людей |'); say('|---|---|---|---|');
for (const [n, f] of comps) { const r = pooled(f); say(`| ${n} | ${f3(r.all)} | ${f3(r.per)} | ${r.n} |`); }
// качество разметки: тот же счёт на спрятанном только с уверенными черновиками и только со средними
for (const [lab, it] of [['черновик high', (o: Obs) => o.f.src === 'draft' && o.f.conf === 'high'], ['черновик medium', (o: Obs) => o.f.src === 'draft' && o.f.conf === 'medium'], ['ручная (каталог и пул)', (o: Obs) => o.f.src !== 'draft']] as const) {
  const r = [(o: Obs) => o.c.plain, (o: Obs) => o.c.levelFit, (o: Obs) => o.f.level, (o: Obs) => o.pop, (o: Obs) => o.cons].map((f) => pooled(f, () => true, it));
  say(`${lab}: спрятанных ${hiddenAllOf(it)}; AUC plain / levelFit / уровень / «все смотрят» / мнение других — ${r.map((x) => f3(x.all)).join(' / ')}`);
}
// разброс слагаемых
const hiddenAll = ps.flatMap((p) => p.obs.filter((o) => o.hidden));
const share = (f: (o: Obs) => boolean) => pc(hiddenAll.filter(f).length / hiddenAll.length);
say(`\nразброс на спрятанном: opFit = 1 у ${share((o) => o.c.ops === 1)}; registerFit = 0.5 (нейтрально) у ${share((o) => o.c.reg === 0.5)}; levelFit ≥ 0.8 у ${share((o) => o.c.levelFit >= 0.8)}; `
  + `ст. откл. levelFit ${f3(sd(hiddenAll.map((o) => o.c.levelFit)))}, opFit ${f3(sd(hiddenAll.map((o) => o.c.ops)))}, registerFit ${f3(sd(hiddenAll.map((o) => o.c.reg)))}, `
  + `fameP ${f3(sd(hiddenAll.map((o) => o.c.fameP)))}, вклад якоря ${f3(sd(hiddenAll.map((o, i) => o.c.plain - o.c.score + o.c.fameP + 0 * i)))}`);
// попадание: место спрятанных любимых в порядке пула
{
  const liked = hiddenAll.filter((o) => o.liked);
  for (const k of [10, 50, 150]) say(`попадание@${k}: score ${pc(liked.filter((o) => o.c.rank >= 0 && o.c.rank < k).length / liked.length)}, plain ${pc(liked.filter((o) => o.c.rankPlain >= 0 && o.c.rankPlain < k).length / liked.length)}`);
  say(`медианное место спрятанного любимого: score ${quantile(liked.map((o) => o.c.rank), 0.5)}, plain ${quantile(liked.map((o) => o.c.rankPlain), 0.5)}; нелюбимого: score ${quantile(hiddenAll.filter((o) => o.disliked).map((o) => o.c.rank), 0.5)} из ~${Math.round(mean(ps.map((p) => p.d.pool)))}`);
}

// 3. признаки и оценка (всё оценённое в пуле, внутри человека)
say('\n## 3. Признаки и оценка: корреляция с z-оценкой внутри человека (все оценённые в пуле)');
const OPS = ['pattern_recognition', 'causal_reasoning', 'perspective_taking', 'analogical_thinking', 'synthesis', 'abstraction', 'metacognition', 'critical_analysis'];
const REGS = ['folk_gothic', 'body_visceral', 'cold_clinical', 'genre_idea', 'puzzle_noir', 'absurd_satire', 'quiet_realism', 'myth_adventure'];
const cnt = (xs: string[]) => { const m = new Map<string, number>(); for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1); return [...m].sort((a, b) => b[1] - a[1]); };
const allObs = ps.flatMap((p) => p.obs);
const GENRES = cnt(allObs.flatMap((o) => o.f.genres)).filter(([, n]) => n >= 200).map(([g]) => g);
/** страны у карточек то по-английски (TMDb), то по-русски (Кинопоиск, Wikidata), то кодом — сводим частые */
const CTRY: Record<string, string> = {
  'United States of America': 'США', 'United States': 'США', US: 'США', 'United Kingdom': 'Великобритания', GB: 'Великобритания', France: 'Франция', FR: 'Франция',
  Germany: 'Германия', 'West Germany': 'Германия', ФРГ: 'Германия', DE: 'Германия', Italy: 'Италия', IT: 'Италия', Japan: 'Япония', JP: 'Япония', Canada: 'Канада', CA: 'Канада',
  'South Korea': 'Южная Корея', KR: 'Южная Корея', Spain: 'Испания', ES: 'Испания', China: 'Китай', 'Hong Kong': 'Гонконг', Australia: 'Австралия', Sweden: 'Швеция',
  Denmark: 'Дания', Belgium: 'Бельгия', India: 'Индия', Poland: 'Польша', Ireland: 'Ирландия', Mexico: 'Мексика',
  Russia: 'Россия/СССР', RU: 'Россия/СССР', SU: 'Россия/СССР', 'Soviet Union': 'Россия/СССР', СССР: 'Россия/СССР', Россия: 'Россия/СССР',
};
const ctry = (c: string) => CTRY[c] ?? c;
const COUNTRIES = cnt(allObs.flatMap((o) => [...new Set(o.f.countries.map(ctry))])).slice(0, 12).map(([c]) => c);
const numeric: [string, (o: Obs) => number][] = [
  ['уровень', (o) => o.f.level], ['год', (o) => o.f.year], ['длина', (o) => o.f.dur ?? NaN], ['известность', (o) => o.f.fame], ['«все смотрят»', (o) => Math.log1p(o.pop)],
  ['разборы (log)', (o) => Math.log1p(o.f.essays)], ['сериал', (o) => +o.f.series], ['ниша', (o) => +o.f.niche], ['тяжесть', (o) => o.f.heavy], ['операций', (o) => o.f.ops.length],
  ...OPS.map((op): [string, (o: Obs) => number] => [`оп:${op}`, (o) => o.f.ops.find((x) => x[0] === op)?.[1] ?? 0]),
  ...REGS.map((r): [string, (o: Obs) => number] => [`рег:${r}`, (o) => +o.f.regs.includes(r)]),
  ...GENRES.map((g): [string, (o: Obs) => number] => [`жанр:${g}`, (o) => +o.f.genres.includes(g)]),
  ...COUNTRIES.map((c): [string, (o: Obs) => number] => [`страна:${c}`, (o) => +o.f.countries.map(ctry).includes(c)]),
];
const rows3: { n: string; pooled: number; meanR: number; same: number; het: number; people: number }[] = [];
for (const [n, f] of numeric) {
  const rs: number[] = [], ns: number[] = [];
  const X: number[] = [], Y: number[] = [];
  for (const p of ps) {
    const o = p.obs.filter((x) => !Number.isNaN(f(x)));
    if (o.length < 30) continue;
    const r = corr(o.map(f), o.map((x) => x.z));
    if (Number.isNaN(r)) continue;
    rs.push(r); ns.push(o.length); o.forEach((x) => { X.push(f(x)); Y.push(x.z); });
  }
  if (!rs.length) continue;
  const mr = rs.reduce((a, r, i) => a + r * ns[i], 0) / ns.reduce((a, b) => a + b, 0);
  // разнородность: разброс r между людьми против того, что дал бы случай (1/√n)
  const het = sd(rs) / Math.sqrt(mean(ns.map((k) => 1 / k)));
  rows3.push({ n, pooled: corr(X, Y), meanR: mr, same: rs.filter((r) => Math.sign(r) === Math.sign(mr)).length / rs.length, het, people: rs.length });
}
rows3.sort((a, b) => Math.abs(b.meanR) - Math.abs(a.meanR));
say('| признак | r общий | r средний (вес n) | у скольких тот же знак | разнородность (1 = как случай) | людей |'); say('|---|---|---|---|---|---|');
for (const r of rows3) say(`| ${r.n} | ${f3(r.pooled)} | ${f3(r.meanR)} | ${pc(r.same)} | ${f2(r.het)} | ${r.people} |`);

// 4. модели на признаках: спрятанное, тем же AUC
say('\n## 4. Простые модели на тех же карточках (обучение — видимые 80%, проверка — спрятанное, тот же AUC)');
/** «кодировка по цели»: средняя z человека у фильмов с тем же значением признака на обучении, сжатая к 0 */
function te(key: (o: Obs) => string[], prior = 3): Scorer {
  const cache = new Map<P, Map<string, [number, number]>>();
  return (o, p) => {
    let m = cache.get(p);
    if (!m) { m = new Map(); for (const x of p.obs.filter((y) => !y.hidden)) for (const k of key(x)) { const v = m.get(k) ?? [0, 0]; m.set(k, [v[0] + x.z, v[1] + 1]); } cache.set(p, m); }
    const ks = key(o); if (!ks.length) return 0;
    return mean(ks.map((k) => { const v = m!.get(k); return v ? v[0] / (v[1] + prior) : 0; }));
  };
}
const decade = (o: Obs) => [`${Math.floor(o.f.year / 10) * 10}`];
const scorers: [string, Scorer][] = [
  ['автор (режиссёр) — средняя z у его фильмов', te((o) => o.f.creators)],
  ['жанр', te((o) => o.f.genres)], ['страна', te((o) => [...new Set(o.f.countries.map(ctry))])], ['десятилетие', te(decade)],
  ['уровень сложности', te((o) => [`${o.f.level}`])], ['регистр', te((o) => o.f.regs)], ['ведущая операция', te((o) => (o.f.ops[0] ? [o.f.ops[0][0]] : []))],
  ['известность', te((o) => [`${o.f.fame}`])],
];
say('| кодировка по цели | AUC по парам | AUC среднее по людям |'); say('|---|---|---|');
for (const [n, f] of scorers) { const r = pooled(f); say(`| ${n} | ${f3(r.all)} | ${f3(r.per)} |`); }

// гребневая регрессия
type Vec = number[];
const groups: Record<string, (o: Obs) => Vec> = {
  'мета: год, длина, известность, «все смотрят», разборы, сериал, мнение других': (o) => [o.f.year, o.f.dur ?? 100, +(o.f.dur == null), o.f.fame, Math.log1p(o.pop), Math.log1p(o.f.essays), +o.f.series, o.cons],
  'разметка: уровень, операции, регистры, ниша, тяжесть': (o) => [o.f.level, o.f.level ** 2, +o.f.niche, o.f.heavy, ...OPS.map((op) => o.f.ops.find((x) => x[0] === op)?.[1] ?? 0), ...REGS.map((r) => +o.f.regs.includes(r))],
  'жанры + страны': (o) => [...GENRES.map((g) => +o.f.genres.includes(g)), ...COUNTRIES.map((c) => +o.f.countries.map(ctry).includes(c))],
};
groups['всё вместе'] = (o) => Object.values(groups).slice(0, 3).flatMap((g) => g(o));
function solve(A: number[][], b: number[]): number[] {
  const n = b.length; const M = A.map((r, i) => [...r, b[i]]);
  for (let i = 0; i < n; i++) {
    let piv = i; for (let k = i + 1; k < n; k++) if (Math.abs(M[k][i]) > Math.abs(M[piv][i])) piv = k;
    [M[i], M[piv]] = [M[piv], M[i]];
    const d = M[i][i] || 1e-12;
    for (let k = i + 1; k < n; k++) { const f = M[k][i] / d; if (!f) continue; for (let j = i; j <= n; j++) M[k][j] -= f * M[i][j]; }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) { let s = M[i][n]; for (let j = i + 1; j < n; j++) s -= M[i][j] * x[j]; x[i] = s / (M[i][i] || 1e-12); }
  return x;
}
/** X'X и X'y по строкам (признаки уже нормированы) */
function gram(rows: Vec[], y: number[]): { A: number[][]; b: number[] } {
  const d = rows[0]?.length ?? 0; const A = Array.from({ length: d }, () => new Array(d).fill(0)); const b = new Array(d).fill(0);
  rows.forEach((r, i) => { for (let a = 0; a < d; a++) { if (!r[a]) continue; b[a] += r[a] * y[i]; for (let c = 0; c < d; c++) A[a][c] += r[a] * r[c]; } });
  return { A, b };
}
const ridge = (A: number[][], b: number[], lam: number) => solve(A.map((r, i) => r.map((v, j) => v + (i === j ? lam : 0))), b);
const dot = (a: Vec, b: Vec) => a.reduce((s, x, i) => s + x * b[i], 0);
const LAMS = [1, 10, 100, 1000];
for (const [gname, g] of Object.entries(groups)) {
  // нормировка по всем оценённым в пуле
  const raw = allObs.map(g); const d = raw[0].length;
  const mu = Array.from({ length: d }, (_, j) => mean(raw.map((r) => r[j]))), sg = Array.from({ length: d }, (_, j) => sd(raw.map((r) => r[j])) || 1);
  const vec = (o: Obs) => g(o).map((v, j) => (v - mu[j]) / sg[j]);
  const V = new Map<Obs, Vec>(); allObs.forEach((o) => V.set(o, vec(o)));
  // общая (по остальным людям): X'X каждого человека — на его видимом
  const G = new Map(ps.map((p) => { const tr = p.obs.filter((o) => !o.hidden); return [p, gram(tr.map((o) => V.get(o)!), tr.map((o) => o.z))]; }));
  const wGlobal = new Map<P, Vec>();
  for (const p of ps) {
    const A = Array.from({ length: d }, () => new Array(d).fill(0)); const b = new Array(d).fill(0);
    for (const q of ps) { if (q.me === p.me) continue; const gq = G.get(q)!; for (let i = 0; i < d; i++) { b[i] += gq.b[i]; for (let j = 0; j < d; j++) A[i][j] += gq.A[i][j]; } }
    wGlobal.set(p, ridge(A, b, 10));
  }
  // своя: λ — по 5 частям видимого; «общая + своя» — своя на остатке после общей
  const fitOwn = (p: P, resid: boolean): Vec => {
    const tr = p.obs.filter((o) => !o.hidden);
    const y = tr.map((o) => o.z - (resid ? dot(wGlobal.get(p)!, V.get(o)!) : 0));
    if (tr.length < 15) return new Array(d).fill(0);
    const folds = tr.map((_, i) => i % 5);
    const parts = [0, 1, 2, 3, 4].map((k) => gram(tr.filter((_, i) => folds[i] === k).map((o) => V.get(o)!), y.filter((_, i) => folds[i] === k)));
    const full = gram(tr.map((o) => V.get(o)!), y);
    let best = LAMS[LAMS.length - 1], bestErr = Infinity;
    for (const lam of LAMS) {
      let err = 0;
      for (let k = 0; k < 5; k++) {
        const A = full.A.map((r, i) => r.map((v, j) => v - parts[k].A[i][j])); const b = full.b.map((v, i) => v - parts[k].b[i]);
        const w = ridge(A, b, lam);
        tr.forEach((o, i) => { if (folds[i] === k) err += (y[i] - dot(w, V.get(o)!)) ** 2; });
      }
      if (err < bestErr) { bestErr = err; best = lam; }
    }
    return ridge(full.A, full.b, best);
  };
  const own = new Map(ps.map((p) => [p, fitOwn(p, false)]));
  const both = new Map(ps.map((p) => [p, fitOwn(p, true)]));
  const r1 = pooled((o, p) => dot(own.get(p)!, V.get(o)!));
  const r2 = pooled((o, p) => dot(wGlobal.get(p)!, V.get(o)!));
  const r3 = pooled((o, p) => dot(wGlobal.get(p)!, V.get(o)!) + dot(both.get(p)!, V.get(o)!));
  say(`| ${gname} | своя ${f3(r1.all)} / ${f3(r1.per)} | общая ${f3(r2.all)} / ${f3(r2.per)} | общая+своя ${f3(r3.all)} / ${f3(r3.per)} |`);
  if (gname === 'всё вместе') {
    // веса общей модели (по всем людям) — что «нравится всем»
    const A = Array.from({ length: d }, () => new Array(d).fill(0)); const b = new Array(d).fill(0);
    for (const gq of G.values()) for (let i = 0; i < d; i++) { b[i] += gq.b[i]; for (let j = 0; j < d; j++) A[i][j] += gq.A[i][j]; }
    const w = ridge(A, b, 10);
    const names = ['год', 'длина', 'длина неизвестна', 'известность', '«все смотрят»', 'разборы', 'сериал', 'мнение других', 'уровень', 'уровень²', 'ниша', 'тяжесть', ...OPS.map((x) => `оп:${x}`), ...REGS.map((x) => `рег:${x}`), ...GENRES.map((x) => `жанр:${x}`), ...COUNTRIES.map((x) => `страна:${x}`)];
    say(`веса общей модели (z на 1 ст. откл. признака), крупнейшие: ${names.map((n, i) => [n, w[i]] as const).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 14).map(([n, v]) => `${n} ${v > 0 ? '+' : ''}${v.toFixed(3)}`).join(', ')}`);
  }
}

// 5. состояние модели и любимое/нелюбимое
say('\n## 5. Состояние модели против оценок');
{
  const rows: string[] = [];
  let dl = 0, dc = 0, nn = 0, closer = 0, lvlUp = 0;
  for (const p of ps) {
    const tr = p.obs.filter((o) => !o.hidden);
    const L = tr.filter((o) => o.liked), D = tr.filter((o) => o.disliked);
    if (L.length < 5 || D.length < 5) continue;
    const ml = mean(L.map((o) => o.f.level)), md = mean(D.map((o) => o.f.level));
    const cl = mean(L.map((o) => Math.abs(o.f.level - p.d.state.comfort - 0.4))), cd = mean(D.map((o) => Math.abs(o.f.level - p.d.state.comfort - 0.4)));
    dl += ml - md; dc += cd - cl; nn++; if (cl < cd) closer++; if (ml > md) lvlUp++;
    rows.push(`${p.d.name}: комфорт ${p.d.state.comfort}, уровень любимого ${ml.toFixed(2)} / нелюбимого ${md.toFixed(2)}`);
  }
  say(`людей ${nn}: любимое в среднем сложнее нелюбимого на ${(dl / nn).toFixed(2)} уровня (у ${lvlUp} из ${nn}); любимое ближе к цели levelFit у ${closer} из ${nn} (в среднем на ${(dc / nn).toFixed(2)})`);
  const comfort = ps.map((p) => p.d.state.comfort), avgLevel = ps.map((p) => mean(p.obs.filter((o) => !o.hidden).map((o) => o.f.level)));
  say(`комфорт: от ${Math.min(...comfort)} до ${Math.max(...comfort)}, ст. откл. ${f2(sd(comfort))}; средний уровень просмотренного — ст. откл. ${f2(sd(avgLevel))}; корр. комфорта со средним уровнем ${f3(corr(comfort, avgLevel))}`);
  const regSpread = ps.filter((p) => p.d.state.regs.length).map((p) => sd(p.d.state.regs.map((r) => r.affinity)));
  say(`вкус к регистрам не собран у ${ps.filter((p) => !p.d.state.regs.length).length} из ${ps.length}`);
  say(`вкус к регистрам: средний разброс сродства ${f2(mean(regSpread))}; у скольких регистр-фаворит — ${cnt(ps.map((p) => p.d.state.regs[0]?.register ?? '—')).map(([r, n]) => `${r} ${n}`).join(', ')}`);
  const opSpread = ps.map((p) => sd(p.d.state.ops.map((o) => o.level)));
  say(`уровни операций: средний разброс внутри человека ${f2(mean(opSpread))}; людей с 8 операциями ${ps.filter((p) => p.d.state.ops.length === 8).length}`);
  // регистр: соответствует ли «смотрит чаще» тому, что «нравится»
  const pairsRA: number[] = [];
  for (const p of ps) for (const r of p.d.state.regs) {
    const tr = p.obs.filter((o) => !o.hidden && o.f.regs.includes(r.register));
    if (tr.length >= 10) pairsRA.push(r.affinity, mean(tr.map((o) => o.z)));
  }
  const aff = pairsRA.filter((_, i) => i % 2 === 0), zr = pairsRA.filter((_, i) => i % 2 === 1);
  say(`регистр (человек×регистр, ≥10 фильмов, n=${aff.length}): корр. сродства модели со средней z-оценкой фильмов этого регистра ${f3(corr(aff, zr))}`);
}

// 5б. варианты счёта, собранные из тех же слагаемых (что дали бы правки модели), — тот же AUC на спрятанном
say('\n## 5б. Варианты счёта (симуляция правок на тех же слагаемых)');
{
  const EB = 0.04;
  const base = (o: Obs, p: P) => o.c.plain - (o.f.essays ? EB : 0) - p.d.anchorWeight * o.c.content; // = scoreCandidate
  const regTE = te((o) => o.f.regs);
  const asym = (o: Obs, p: P) => { const gap = o.f.level - (p.d.state.comfort + 0.4); return gap < 0 ? Math.max(0, 1 + gap / 1.5) : Math.max(0, 1 - gap / 4); };
  const creatorTE = te((o) => o.f.creators), genreTE = te((o) => o.f.genres), countryTE = te((o) => [...new Set(o.f.countries.map(ctry))]);
  const variants: [string, Scorer][] = [
    ['как в ленте', (o) => o.c.score], ['без приглушения', (o) => o.c.plain], ['только scoreCandidate', base],
    ['scoreCandidate без levelFit', (o, p) => base(o, p) - 0.4 * o.c.levelFit], ['scoreCandidate без opFit', (o, p) => base(o, p) - 0.3 * o.c.ops],
    ['scoreCandidate без registerFit', (o, p) => base(o, p) - 0.3 * o.c.reg],
    ['plain + якорь всегда (вес 0.25)', (o, p) => base(o, p) + 0.25 * o.c.content + (o.f.essays ? EB : 0)],
    ['plain + якорь 0.5', (o, p) => base(o, p) + 0.5 * o.c.content + (o.f.essays ? EB : 0)],
    ['plain + известность вместо приглушения (+0.05·fame)', (o) => o.c.plain + 0.05 * o.f.fame],
    ['plain + мнение других (+0.3·cons)', (o) => o.c.plain + 0.3 * o.cons],
    ['plain + якорь 0.25 + мнение других 0.3', (o, p) => base(o, p) + 0.25 * o.c.content + 0.3 * o.cons],
    ['регистр по оценкам (кодировка) вместо registerFit', (o, p) => o.c.plain - 0.3 * o.c.reg + 0.3 * Math.min(1, Math.max(0, 0.5 + regTE(o, p)))],
    ['levelFit несимметричный (проще цели — вдвое хуже)', (o, p) => o.c.plain - 0.4 * o.c.levelFit + 0.4 * asym(o, p)],
    ['всё сразу: без приглушения, якорь 0.5, мнение других 0.3, регистр по оценкам, несимм. уровень', (o, p) => base(o, p) + (o.f.essays ? EB : 0) + 0.5 * o.c.content + 0.3 * o.cons
      - 0.3 * o.c.reg + 0.3 * Math.min(1, Math.max(0, 0.5 + regTE(o, p))) - 0.4 * o.c.levelFit + 0.4 * asym(o, p)],
    ['кодировки: автор + жанр + страна', (o, p) => creatorTE(o, p) + genreTE(o, p) + 0.5 * countryTE(o, p)],
    ['кодировки + мнение других', (o, p) => creatorTE(o, p) + genreTE(o, p) + 0.5 * countryTE(o, p) + o.cons],
  ];
  say('| вариант | AUC по парам | AUC среднее по людям |'); say('|---|---|---|');
  for (const [n, f] of variants) { const r = pooled(f); say(`| ${n} | ${f3(r.all)} | ${f3(r.per)} |`); }
}

// 6. по типам историй
say('\n## 6. По источникам историй (AUC по парам: счёт / plain / pop / якорь / автор)');
for (const [lab, flt] of [['Кинопоиск', (p: P) => p.d.name.startsWith('kp_')], ['Letterboxd', (p: P) => p.d.name.startsWith('letterboxd-')], ['прочие', (p: P) => !/^(kp_|letterboxd-)/.test(p.d.name)]] as const) {
  const r = [(o: Obs) => o.c.score, (o: Obs) => o.c.plain, (o: Obs) => o.pop, (o: Obs) => o.c.content, te((o) => o.f.creators)].map((f) => pooled(f as Scorer, flt));
  say(`${lab} (людей ${ps.filter(flt).length}, с парами ${r[0].n}): ${r.map((x) => f3(x.all)).join(' / ')}`);
}
writeFileSync(`.cache/eval/why-run-${day}${MEDIAN_NORM ? '-median' : ''}.txt`, `${out.join('\n')}\n`);
