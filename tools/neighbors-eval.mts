// Лёгкий замер соседей по вкусу (23.10) — тем же расчётом, что сервер (src/lib/model/neighbors.ts), без vite и без
// приложения: минуты, а не часы, как tools/taste-eval.mts. У каждого истории прячем ту же пятую часть, что в taste-eval
// (тот же «случай» по имени), соседей ищем по остальному среди других людей (тот же человек под другой историей — не
// сосед), и различаем спрятанное любимое (верх 30% шкалы человека) от нелюбимого (низ 30%) счётом соседей; фильм без
// сигнала — 0. Отличие от taste-eval: проверяется всё спрятанное, а не только то, что есть в пуле кандидатов ленты.
//   npx tsx tools/neighbors-eval.mts [--min 20] [--holdout 0.2] [--k 30] [--support 3,1] [--common 8] [--shrink 20]
// Итог — в консоль (только числа, без имён); по людям — в .cache/eval/neighbors-<дата>.json (вне git).
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { NEIGHBOR, buildPool, keysOfRating, mineIn, neighborScores, personZ, type Rated } from '../src/lib/model/neighbors.ts';
import { identityOf } from './seed-identity.mts';

const argv = process.argv.slice(2);
const opt = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const MIN = Number(opt('--min') ?? 20);
const HOLDOUT = Number(opt('--holdout') ?? 0.2);
const K = Number(opt('--k') ?? NEIGHBOR.k);
const SUPPORT = (opt('--support') ?? `${NEIGHBOR.minSupport},1`).split(',').map(Number);
const COMMON = Number(opt('--common') ?? NEIGHBOR.minCommon);
const SHRINK = Number(opt('--shrink') ?? NEIGHBOR.shrink);

interface SeedRating { workId: string; rating: number; raw?: number; work?: { type?: string; externalIds?: { tmdb?: number; imdb?: string } } }
const seeds = new Map<string, SeedRating[]>();
for (const f of readdirSync('seeds').filter((f) => f.endsWith('.json')).sort()) {
  try {
    const r = ((JSON.parse(readFileSync(`seeds/${f}`, 'utf8')) as { ratings?: SeedRating[] }).ratings ?? []).filter((x) => x.raw != null);
    if (r.length >= MIN) seeds.set(f.replace(/\.json$/, ''), r);
  } catch { /* не история */ }
}
const rated = (r: SeedRating): Rated => ({ keys: keysOfRating(r.workId, r.work), raw: r.raw! });
// набор — люди целиком (истории одного человека — вместе, первая главнее); себя каждый пропускает по id
const byWho = new Map<string, Rated[]>();
for (const [name, list] of seeds) { const w = identityOf(name); byWho.set(w, [...(byWho.get(w) ?? []), ...list.map(rated)]); }
const pool = buildPool([...byWho].map(([id, list]) => ({ id, films: personZ(list) })));
console.error(`историй ${seeds.size}, людей ${byWho.size}, фильмов в наборе ${pool.filmKeys.length}`);

// тот же «случай», что в tools/taste-eval.mts: та же спрятанная пятая часть
function rng(seed: string) {
  let h = 2166136261; for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 2 ** 32; };
}
const quantile = (xs: number[], q: number) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
function auc(pos: number[], neg: number[]): number | undefined {
  if (!pos.length || !neg.length) return undefined;
  let s = 0; for (const p of pos) for (const n of neg) s += p > n ? 1 : p === n ? 0.5 : 0;
  return s / (pos.length * neg.length);
}

interface Row { name: string; ratings: number; liked: number; disliked: number; gated: boolean; by: Record<string, { auc?: number; neighbors: number; covered: number }> }
const rows: Row[] = [];
const t0 = Date.now();
for (const [name, list] of seeds) {
  const rand = rng(name);
  const hidden = new Set(list.filter(() => rand() < HOLDOUT).map((r) => r.workId));
  const visible = list.filter((r) => !hidden.has(r.workId));
  const mine = mineIn(pool, personZ(visible.map(rated)));
  const raws = list.map((r) => r.raw!);
  const hi = quantile(raws, 0.7), lo = quantile(raws, 0.3);
  const test = list.filter((r) => hidden.has(r.workId)).map((r) => ({ r, film: rated(r).keys.map((k) => pool.keyFilm.get(k)).find((x) => x != null) }));
  const liked = test.filter((x) => x.r.raw! >= hi && x.r.raw! > lo), disliked = test.filter((x) => x.r.raw! <= lo && x.r.raw! < hi);
  const me = identityOf(name);
  const row: Row = { name, ratings: list.length, liked: liked.length, disliked: disliked.length, gated: visible.length < NEIGHBOR.minRated, by: {} };
  for (const s of SUPPORT) {
    const { scores, neighbors } = neighborScores(pool, mine, { k: K, minCommon: COMMON, shrink: SHRINK, minSupport: s, skip: (p) => p.id === me });
    const v = (x: { film?: number }) => (x.film != null ? scores.get(x.film) ?? 0 : 0);
    const covered = test.filter((x) => x.film != null && scores.has(x.film)).length / (test.length || 1);
    row.by[`support${s}`] = { auc: auc(liked.map(v), disliked.map(v)), neighbors, covered };
  }
  rows.push(row);
}
const pairs = (m: string, only = (_: Row) => true) => {
  let s = 0, n = 0;
  for (const r of rows.filter(only)) { const v = r.by[m].auc; if (v == null) continue; const w = r.liked * r.disliked; s += v * w; n += w; }
  return n ? s / n : undefined;
};
const mean = (xs: (number | undefined)[]) => { const v = xs.filter((x): x is number => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : undefined; };
const f = (x?: number) => (x == null ? '—' : x.toFixed(3));
console.log(`людей ${rows.length}, k ${K}, общих ≥ ${COMMON}, сжатие ${SHRINK}, ${((Date.now() - t0) / 1000).toFixed(1)} с`);
for (const m of Object.keys(rows[0]?.by ?? {})) {
  console.log(`${m}: AUC по всем парам ${f(pairs(m))}, среднее по людям ${f(mean(rows.map((r) => r.by[m].auc)))}, `
    + `с соседями ${rows.filter((r) => r.by[m].neighbors > 0).length}/${rows.length}, в среднем соседей ${f(mean(rows.map((r) => r.by[m].neighbors)))}, `
    + `спрятанного с сигналом ${f(mean(rows.map((r) => r.by[m].covered)))}; без «малых» (< ${NEIGHBOR.minRated} видимых) ${f(pairs(m, (r) => !r.gated))}`);
}
mkdirSync('.cache/eval', { recursive: true });
writeFileSync(`.cache/eval/neighbors-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ at: new Date().toISOString(), k: K, common: COMMON, shrink: SHRINK, rows }, null, 1));
