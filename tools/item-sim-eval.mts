// Офлайн-замер «похожих фильмов» (23.10, опыт `itemSim`, src/lib/model/itemSim.ts) — без vite и без приложения, только
// seeds/*.json: у каждой истории с 20+ оценками прячется пятая часть (тот же «случай» по имени, что в tools/taste-eval.mts),
// таблица собирается без этого человека (itemSimTable(sums, кто)), и по спрятанному — различение (AUC) любимого
// (верхние 30% шкалы человека) и нелюбимого (нижние 30%). Рядом — соседи по вкусу (как в taste-eval) и «что смотрят все».
// Пул кандидатов приложения здесь не строится: меряется всё спрятанное («все») и только то, что есть в таблице («в таблице»).
// «·10» — у человека видно лишь `--short` случайных оценок, «·10поп» — его `--short` самых известных (как у нового зрителя
// после колоды оценок: она из известного), спрятанное то же.
//   npx tsx tools/item-sim-eval.mts [--min 20] [--n 20,30,50] [--shrink 10] [--prior 0,0.5,2] [--short 10]
// Итог — в консоль и .cache/eval/item-sim-<дата>.json (вне git).
import { mkdirSync, writeFileSync } from 'node:fs';
import { ITEM_SIM, itemSimScore, itemSimSums, itemSimTable, limitItemSim, personZ } from '../src/lib/model/itemSim.ts';
import { peopleFilms, storiesRated } from './item-sim-data.mts';
import { identityOf as who } from './seed-identity.mts';

const argv = process.argv.slice(2);
const opt = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const list = (n: string, d: number[]) => (opt(n)?.split(',').map(Number) ?? d);
const MIN = Number(opt('--min') ?? 20);
const NS = list('--n', [ITEM_SIM.neighbors]);
const SHRINKS = list('--shrink', [ITEM_SIM.shrink]);
const PRIORS = list('--prior', [ITEM_SIM.prior]);
const SHORT = Number(opt('--short') ?? 10);
const HOLDOUT = 0.2;

const t0 = Date.now();
const stories = storiesRated(MIN);
const people = peopleFilms(MIN, stories);
const sums = itemSimSums(people);
console.error(`историй ${stories.size}, людей ${people.size}, фильмов в таблице ${sums.m}, суммы за ${((Date.now() - t0) / 1000).toFixed(0)} с, память ${mb()}`);
function mb() { return `${Math.round(process.memoryUsage().rss / 1e6)} МБ`; }

// «что смотрят все»: сколько людей оценили фильм (по первому ключу)
const raters = new Map<string, Set<string>>();
for (const [p, films] of people) for (const f of films) { const k = f.keys[0]; if (!raters.has(k)) raters.set(k, new Set()); raters.get(k)!.add(p); }
// соседи по вкусу — как в taste-eval: z по истории, косинус на общих (≥8), сжатие n/(n+20), 30 ближайших, +1 в знаменателе
const zOf = (rs: { raw: number; keys: string[] }[]) => {
  const v = rs.map((r) => r.raw), m = v.reduce((a, b) => a + b, 0) / v.length;
  const sd = Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length) || 1;
  return new Map(rs.filter((r) => r.keys.length).map((r) => [r.keys[0], (r.raw - m) / sd]));
};
const zAll = new Map([...stories].map(([name, rs]) => [name, zOf(rs)]));
function neighborScores(name: string, mine: Map<string, number>): Map<string, number> {
  const sims: { z: Map<string, number>; sim: number }[] = [];
  for (const [other, z] of zAll) {
    if (who(other) === who(name)) continue;
    let dot = 0, a = 0, b = 0, n = 0;
    for (const [k, zu] of mine) { const zv = z.get(k); if (zv == null) continue; dot += zu * zv; a += zu * zu; b += zv * zv; n++; }
    if (n < 8 || !a || !b) continue;
    const sim = (dot / Math.sqrt(a * b)) * (n / (n + 20));
    if (sim > 0) sims.push({ z, sim });
  }
  sims.sort((x, y) => y.sim - x.sim);
  const num = new Map<string, number>(), den = new Map<string, number>();
  for (const { z, sim } of sims.slice(0, 30)) for (const [k, zv] of z) { num.set(k, (num.get(k) ?? 0) + sim * zv); den.set(k, (den.get(k) ?? 0) + sim); }
  return new Map([...num].map(([k, v]) => [k, v / (den.get(k)! + 1)]));
}

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

/** метод → (подмножество → [Σ auc·пары, Σ пары, Σ auc по людям, людей, покрытие]) */
const acc = new Map<string, { s: number; w: number; pp: number; np: number; cov: number; tot: number }>();
const add = (method: string, set: string, pos: number[], neg: number[], cov: number) => {
  const a = auc(pos, neg); if (a == null) return;
  const k = `${method}|${set}`, x = acc.get(k) ?? { s: 0, w: 0, pp: 0, np: 0, cov: 0, tot: 0 };
  const w = pos.length * neg.length; x.s += a * w; x.w += w; x.pp += a; x.np++; x.cov += cov; x.tot += pos.length + neg.length;
  acc.set(k, x);
};

let done = 0;
for (const [name, rated] of stories) {
  const t1 = Date.now();
  const rand = rng(name);
  const hidden = new Set(rated.filter(() => rand() < HOLDOUT).map((r) => r.workId));
  const visible = rated.filter((r) => !hidden.has(r.workId) && r.keys.length);
  const me = who(name);
  const raws = rated.map((r) => r.raw);
  const hi = quantile(raws, 0.7), lo = quantile(raws, 0.3);
  const test = rated.filter((r) => hidden.has(r.workId) && r.keys.length);
  const liked = test.filter((r) => r.raw >= hi && r.raw > lo), disliked = test.filter((r) => r.raw <= lo && r.raw < hi);
  if (!liked.length || !disliked.length) continue;
  const pop = (r: { keys: string[] }) => [...(raters.get(r.keys[0]) ?? [])].filter((p) => p !== me).length;
  const mine = personZ(visible);
  const sr = rng(`${name}#short`);
  const shortVis = [...visible].map((r) => ({ r, x: sr() })).sort((a, b) => a.x - b.x).slice(0, SHORT).map((x) => x.r);
  const mineShort = personZ(shortVis);
  const popVis = [...visible].sort((a, b) => pop(b) - pop(a)).slice(0, SHORT);
  const minePop = personZ(popVis);
  const inTable = (r: { keys: string[] }) => sums.index.has(r.keys[0]);
  const sets: Record<string, (r: (typeof test)[number]) => boolean> = { 'все': () => true, 'в таблице': inTable };
  const measure = (method: string, score: (r: (typeof test)[number]) => number | null) => {
    for (const [set, f] of Object.entries(sets)) {
      const L = liked.filter(f), D = disliked.filter(f);
      const v = (r: (typeof test)[number]) => { const s = score(r); return (s ?? 0) + pop(r) * 1e-6; };
      const cov = [...L, ...D].filter((r) => score(r) != null).length;
      add(method, set, L.map(v), D.map(v), cov);
    }
  };
  measure('популярное', () => 0);
  const nb = neighborScores(name, zOf(visible));
  measure('соседи', (r) => nb.get(r.keys[0]) ?? null);
  const nbShort = neighborScores(name, zOf(shortVis));
  measure(`соседи·${SHORT}`, (r) => nbShort.get(r.keys[0]) ?? null);
  const nbPop = neighborScores(name, zOf(popVis));
  measure(`соседи·${SHORT}поп`, (r) => nbPop.get(r.keys[0]) ?? null);
  for (const shrink of SHRINKS) {
    const full = itemSimTable(sums, me, { neighbors: Math.max(...NS), shrink });
    for (const n of NS) {
      const t = n === Math.max(...NS) ? full : limitItemSim(full, n);
      for (const prior of PRIORS) {
        const tag = `itemSim N${n} λ${shrink} p${prior}`;
        measure(tag, (r) => itemSimScore(t, r.keys, mine, prior));
        measure(`${tag} ·${SHORT}`, (r) => itemSimScore(t, r.keys, mineShort, prior));
        measure(`${tag} ·${SHORT}поп`, (r) => itemSimScore(t, r.keys, minePop, prior));
        // смесь с соседями: среднее мест не посчитать без пула — сумма мер
        measure(`${tag} +соседи`, (r) => { const a = itemSimScore(t, r.keys, mine, prior), b = nb.get(r.keys[0]); return a == null && b == null ? null : (a ?? 0) + (b ?? 0); });
      }
    }
  }
  done++;
  if (done % 10 === 0 || done === 1) console.error(`${done}/${stories.size} ${name}: ${((Date.now() - t1) / 1000).toFixed(1)} с, память ${mb()}`);
}

const out = [...acc].map(([k, x]) => { const [method, set] = k.split('|'); return { method, set, auc: x.s / x.w, aucPerPerson: x.pp / x.np, people: x.np, coverage: x.cov / x.tot }; });
out.sort((a, b) => a.set.localeCompare(b.set) || b.auc - a.auc);
for (const set of Object.keys({ 'все': 1, 'в таблице': 1 })) {
  console.log(`\n── ${set} ── (AUC по всем парам · среднее по людям · людей · есть сигнал)`);
  for (const r of out.filter((r) => r.set === set)) console.log(`${r.method.padEnd(34)} ${r.auc.toFixed(3)}  ${r.aucPerPerson.toFixed(3)}  ${String(r.people).padStart(3)}  ${(r.coverage * 100).toFixed(0)}%`);
}
mkdirSync('.cache/eval', { recursive: true });
const day = new Date().toISOString().slice(0, 10);
writeFileSync(`.cache/eval/item-sim-${day}.json`, JSON.stringify({ at: new Date().toISOString(), min: MIN, ns: NS, shrinks: SHRINKS, priors: PRIORS, short: SHORT, out }, null, 1));
console.error(`всего ${((Date.now() - t0) / 1000).toFixed(0)} с, память ${mb()}`);
