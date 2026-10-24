// Порядок колоды первых оценок (23.10, опыт `deckOrder`, src/lib/deckOrder.ts): «как сейчас» против HELF против «по
// популярности» — офлайн, без vite и приложения, только seeds/*.json. Каждый человек — новичок: идёт по колоде сверху,
// оценивает карточку, если фильм есть в его истории (оценка — его же), иначе «не смотрел» — пропуск; после N оценок (5, 10,
// 15) по ним предсказывается спрятанное. Сигналы — как в tools/cold-start-eval.mts: «похожие фильмы» (itemSim, таблица без
// него), соседи по вкусу (nb, minCommon 3), их смеси с «как оценили другие» (consensus без него) по правилу w = n/(n+10), часть
// обученного счёта (LB). Спрятанное — пятая часть истории (тот же «случай» по имени, что в cold-start-eval), без всех фильмов
// всех порядков колоды: проверочный набор у человека один для всех порядков. Метки — верх/низ 30% всей истории; AUC
// любимое/нелюбимое и hit@50 — доля спрятанного любимого в первых 50 кандидатов (фильмы, которые оценили ≥ 3 других).
// HELF, число оценивших и «как оценили другие» — каждому без него самого. Порядки:
//   сейчас     — снимок колоды (deckCards.ts: ratingDeck + partsInOrder), как у нового человека в приложении;
//   helf       — byDeckScore по HELF (как в приложении при опыте deckOrder);
//   pop        — по числу оценивших в seeds;
//   helf·место — энтропия из seeds, «известность» — место в нынешней колоде (самые смотримые по пяти сигналам profile-deck):
//                на случай, если seeds (киноманы) плохо меряют, что видел массовый зритель;
//   случ       — колода в случайном порядке (у каждого свой);
//   пул-helf, пул-pop — не колода: первые 51 по HELF / по числу оценивших из всех фильмов seeds (предел «если бы колоду
//                собирали заново», без разметки и без правил колоды).
// Один человек под несколькими историями — одна, самая длинная (tools/seed-identity.mts). «Видел» = есть оценка в истории.
//   npx tsx tools/deck-order-eval.mts [--min 20] [--film-min 5] [--ns 5,10,15] [--limit 0] [--deck ru,en]
// --film-min — с какого числа оценивших фильм входит в суммы сходства: 5 (по умолчанию) ≈ 0,3 ГБ и пара минут; 3 — как
// таблица приложения (src/mocks/itemSim.ts), ≈ 0,7–0,9 ГБ. Итог — в консоль (только числа) и .cache/eval/deck-order-<дата>.json.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { SHRINK as C_SHRINK } from '../src/lib/model/consensus.ts';
import { ITEM_SIM, itemSimSums, itemSimTable, personZ as itemZ } from '../src/lib/model/itemSim.ts';
import { buildPool, mineIn, neighborScores, personZ as nbZ } from '../src/lib/model/neighbors.ts';
import { DECK_ORDER, byDeckScore, helf, partsInOrder } from '../src/lib/deckOrder.ts';
import { peopleFilms, storiesRated } from './item-sim-data.mts';
import { identityOf } from './seed-identity.mts';
import { deckLists, filmStats } from './build-deck-order.mts';

const argv = process.argv.slice(2);
const opt = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const MIN = Number(opt('--min') ?? 20);
const FILM_MIN = Number(opt('--film-min') ?? 5);
const NS = (opt('--ns') ?? '5,10,15').split(',').map(Number);
const LIMIT = Number(opt('--limit') ?? 0);
const DECKS = (opt('--deck') ?? 'ru,en').split(',') as ('ru' | 'en')[];
const HOLDOUT = 0.2, HITK = 50, K_RULE = 10, NB_COMMON = 3;
const mb = () => `${Math.round(process.memoryUsage().rss / 1e6)} МБ`;
const LB_SRC = readFileSync('src/lib/model/recommend.ts', 'utf8');
const lbNum = (re: RegExp) => { const m = re.exec(LB_SRC); if (!m) throw new Error(`LEARNED_B: нет ${re}`); return Number(m[1]); };
const LB = { consensus: lbNum(/LEARNED_B = \{[^}]*?\bconsensus: (-?[\d.]+)/), itemSim: lbNum(/LEARNED_B = \{[^}]*?\bitemSim: (-?[\d.]+)/), missing: lbNum(/missing: \{[^}]*?\bitemSim: (-?[\d.]+)/) };

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
type Sig = Float64Array;
function std(a: Sig): Sig {
  let m = 0; for (const x of a) m += x; m /= a.length || 1;
  let v = 0; for (const x of a) v += (x - m) ** 2; const sd = Math.sqrt(v / (a.length || 1)) || 1;
  return a.map((x) => (x - m) / sd);
}
const mix = (b: Sig, p: Sig, w: number) => b.map((x, i) => (1 - w) * x + w * p[i]);
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : NaN; };

// ─── таблицы: один раз ─────────────────────────────────────────────────────────
const t0 = Date.now();
const stories = storiesRated(MIN);
const people = peopleFilms(MIN, stories);
const stats = filmStats(people);
const P = people.size;
const sums = itemSimSums(people, FILM_MIN);
const M = sums.m;
const cnt = new Float64Array(M), zsum = new Float64Array(M);
for (const p of sums.people.values()) for (let x = 0; x < p.i.length; x++) { cnt[p.i[x]]++; zsum[p.i[x]] += p.z[x]; }
const pool = buildPool([...people].map(([id, films]) => ({ id, films })));
const nbFilm = Int32Array.from(sums.keys, (k) => pool.keyFilm.get(k) ?? -1);
const decks = await deckLists();
// фильмы seeds для «пула»: не сериалы, номер в сводке → ключи
const filmOnly = stats.keys.map((ks) => !ks.some((k) => k.startsWith('tmdbtv:')));
console.error(`людей ${P}, фильмов в суммах сходства ${M} (≥ ${FILM_MIN} оценивших), в сводке ${stats.keys.length} · ${((Date.now() - t0) / 1000).toFixed(0)} с, ${mb()}`);

type Story = { name: string; rated: { workId: string; raw: number; keys: string[] }[] };
const byWho = new Map<string, Story>();
for (const [name, rated] of stories) {
  const w = identityOf(name), was = byWho.get(w);
  if (!was || rated.length > was.rated.length) byWho.set(w, { name, rated });
}
const source = (name: string) => (name.startsWith('kp_') ? 'kp' : name.startsWith('letterboxd-') ? 'lb' : 'прочие');

const ORDERS = ['сейчас', 'helf', 'pop', 'helf·место', 'случ', 'пул-helf', 'пул-pop'] as const;
type Order = (typeof ORDERS)[number];
const SIGNALS = ['itemSim', 'nb3', 'cons→itemSim', 'pop+cons→itemSim', 'cons→is+nb3', 'LB'] as const;
// накопители
interface Walk { to5: number[]; to10: number[]; reach5: number; reach10: number; unseen10: number[]; unseen15: number[]; got: Record<number, number[]>; n: number }
const walks = new Map<string, Walk>();
const walkOf = (k: string) => { let w = walks.get(k); if (!w) walks.set(k, (w = { to5: [], to10: [], reach5: 0, reach10: 0, unseen10: [], unseen15: [], got: {}, n: 0 })); return w; };
interface Acc { s: number; w: number; pp: number; np: number; hit: number; liked: number }
const acc = new Map<string, Acc>();
function measure(key: string, score: Sig, pos: number[], neg: number[], C: number, tie: Sig): void {
  const sc = score.map((x, i) => x + tie[i]);
  const a = auc(pos.map((i) => sc[i]), neg.map((i) => sc[i]));
  let x = acc.get(key);
  if (!x) acc.set(key, (x = { s: 0, w: 0, pp: 0, np: 0, hit: 0, liked: 0 }));
  if (a != null) { const w = pos.length * neg.length; x.s += a * w; x.w += w; x.pp += a; x.np++; }
  // любимое в первых K: выше него меньше K кандидатов
  const sorted = Float64Array.from(sc).sort();
  for (const p of pos) {
    const v = sc[p];
    let lo = 0, hi = C; while (lo < hi) { const md = (lo + hi) >> 1; if (sorted[md] <= v) lo = md + 1; else hi = md; }
    if (C - lo < HITK) x.hit++;
  }
  x.liked += pos.length;
}

let done = 0;
for (const [me, { name, rated }] of byWho) {
  if (LIMIT && done >= LIMIT) break;
  const rand = rng(name);
  const hidden = new Set(rated.filter(() => rand() < HOLDOUT).map((r) => r.workId));
  // оценка человека по любому ключу фильма (первая главнее) — вся история: колоду он оценивает, что бы ни было спрятано
  const rawOf = new Map<string, number>();
  for (const r of rated) for (const k of r.keys) if (!rawOf.has(k)) rawOf.set(k, r.raw);
  const t1 = Date.now();
  // без человека: число оценивших и HELF по сводке, «что смотрят все» и «как оценили другие» по суммам
  const st = stats.people.get(me);
  const mineBin = new Map<number, number>();
  if (st) for (let x = 0; x < st.f.length; x++) mineBin.set(st.f[x], st.bin[x]);
  const Pm = P - (st ? 1 : 0);
  const binsO = (f: number) => { const b = Int32Array.from(stats.bins[f]); const my = mineBin.get(f); if (my != null) b[my]--; return b; };
  const nO = (f: number) => stats.bins[f].reduce((a, b) => a + b, 0) - (mineBin.has(f) ? 1 : 0);
  const fOf = (keys: string[]) => keys.map((k) => stats.index.get(k)).find((x) => x != null);
  const helfO = (keys: string[]) => { const f = fOf(keys); return f != null && nO(f) >= DECK_ORDER.minPeople ? helf(binsO(f), Pm) : undefined; };
  const popOf = (keys: string[]) => { const f = fOf(keys); return f != null ? nO(f) : 0; };
  // колоды всех порядков
  type Card = { title: string; year?: number; keys: string[] };
  const orders: Record<string, Record<Order, Card[]>> = {};
  const rr = rng(`${name}#deck`);
  for (const d of DECKS) {
    const list = decks[d];
    const at = new Map(list.map((c, i) => [c, i]));
    const hm = (a: number, b: number) => (a + b > 0 ? (2 * a * b) / (a + b) : 0);
    const hn = (c: Card) => { const f = fOf(c.keys); if (f == null || nO(f) < DECK_ORDER.minPeople) return undefined; const b = binsO(f), n = nO(f); let h = 0; for (const x of b) if (x) { const p = x / n; h -= p * Math.log(p); } return h / Math.log(5); };
    orders[d] = {
      'сейчас': list,
      helf: byDeckScore(list, (c) => helfO(c.keys)),
      pop: byDeckScore(list, (c) => popOf(c.keys)),
      'helf·место': byDeckScore(list, (c) => { const h = hn(c); return h == null ? undefined : hm(h, 1 - at.get(c)! / list.length); }),
      'случ': partsInOrder(list.map((c) => ({ c, x: rr() })).sort((a, b) => a.x - b.x).map((x) => x.c)),
      'пул-helf': [], 'пул-pop': [],
    };
  }
  // пул: первые по HELF / по числу оценивших среди всех фильмов seeds (без человека); длина — как у колоды
  const poolTop = (by: (f: number) => number | undefined, len: number) => stats.keys.map((ks, f) => ({ f, ks, v: filmOnly[f] && nO(f) >= DECK_ORDER.minPeople ? by(f) : undefined }))
    .filter((x) => x.v != null).sort((a, b) => b.v! - a.v!).slice(0, len).map((x) => ({ title: x.ks[0], keys: x.ks }));
  for (const d of DECKS) {
    orders[d]['пул-helf'] = poolTop((f) => helf(binsO(f), Pm), decks[d].length);
    orders[d]['пул-pop'] = poolTop((f) => nO(f), decks[d].length);
  }
  // проверочный набор: спрятанное без фильмов всех колод
  const sIdx = (keys: string[]) => { for (const k of keys) { const i = sums.index.get(k); if (i != null) return i; } return -1; };
  const excluded = new Set<number>();
  for (const d of DECKS) for (const o of ORDERS) for (const c of orders[d][o]) { const i = sIdx(c.keys); if (i >= 0) excluded.add(i); }
  const mine = sums.people.get(me);
  const popO = Float64Array.from(cnt), zO = Float64Array.from(zsum);
  if (mine) for (let x = 0; x < mine.i.length; x++) { popO[mine.i[x]]--; zO[mine.i[x]] -= mine.z[x]; }
  const seenIdx = new Set(rated.filter((r) => !hidden.has(r.workId)).map((r) => sIdx(r.keys)).filter((i) => i >= 0));
  const candList: number[] = [];
  for (let i = 0; i < M; i++) if (popO[i] >= 3 && !seenIdx.has(i) && !excluded.has(i)) candList.push(i);
  const C = candList.length, pos2c = new Map(candList.map((i, c) => [i, c]));
  const raws = rated.map((r) => r.raw), hi = quantile(raws, 0.7), lo = quantile(raws, 0.3);
  const pos: number[] = [], neg: number[] = [], lab = new Set<number>();
  for (const r of rated) {
    if (!hidden.has(r.workId)) continue;
    const c = pos2c.get(sIdx(r.keys));
    if (c == null || lab.has(c)) continue;
    lab.add(c);
    if (r.raw >= hi && r.raw > lo) pos.push(c); else if (r.raw <= lo && r.raw < hi) neg.push(c);
  }
  const usable = pos.length > 0 && neg.length > 0;
  const sPop = std(Float64Array.from(candList, (i) => Math.log1p(popO[i])));
  const consRaw = Float64Array.from(candList, (i) => Math.round((zO[i] / (popO[i] + C_SHRINK)) * 100) / 100);
  const sCons = std(consRaw), sPC = std(sPop.map((x, c) => x + sCons[c]));
  const tie = sPop.map((x) => x * 1e-6);
  const simT = usable ? itemSimTable(sums, me) : undefined;
  if (usable) for (const [b, s] of [['pop', sPop], ['cons', sCons], ['pop+cons', sPC]] as const) measure(`—|${b}`, s, pos, neg, C, tie);

  for (const d of DECKS) for (const o of ORDERS) {
    const deck = orders[d][o];
    // проход по колоде: оценённое (его оценка) и сколько карточек до 5-й и 10-й оценки
    const vis: { keys: string[]; raw: number }[] = [];
    const w = walkOf(`${d}|${o}`), wsrc = walkOf(`${d}|${o}|${source(name)}`);
    let unseen10 = 0, unseen15 = 0;
    deck.forEach((c, i) => {
      const raw = c.keys.map((k) => rawOf.get(k)).find((x) => x != null);
      if (raw == null) { if (i < 10) unseen10++; if (i < 15) unseen15++; return; }
      vis.push({ keys: c.keys, raw });
      for (const x of [w, wsrc]) { if (vis.length === 5) { x.to5.push(i + 1); x.reach5++; } if (vis.length === 10) { x.to10.push(i + 1); x.reach10++; } }
    });
    for (const x of [w, wsrc]) {
      x.n++; x.unseen10.push(unseen10 / Math.min(10, deck.length)); x.unseen15.push(unseen15 / Math.min(15, deck.length));
      for (const n of NS) (x.got[n] ??= []).push(Math.min(n, vis.length));
    }
    if (!usable || !simT) continue;
    for (const n of NS) {
      const v = vis.slice(0, n);
      const k = `${d}|${o}|${n}`;
      if (!v.length) { for (const s of SIGNALS) measure(`${k}|${s}`, s === 'LB' ? std(Float64Array.from(consRaw, (x) => LB.consensus * x + LB.missing)) : /cons/.test(s) ? (s.startsWith('pop') ? sPC : sCons) : new Float64Array(C), pos, neg, C, tie); continue; }
      const z = itemZ(v);
      const mz = new Map<number, number>();
      for (const [key, val] of z) { const i = simT.index.get(key); if (i != null && !mz.has(i)) mz.set(i, val); }
      const isRaw = new Float64Array(C), isHas = new Uint8Array(C);
      for (let c = 0; c < C; c++) {
        const { j, s } = simT.nb[candList[c]];
        let num = 0, den = 0;
        for (let q = 0; q < j.length; q++) { const zz = mz.get(j[q]); if (zz == null) continue; num += s[q] * zz; den += s[q]; }
        if (den) { isRaw[c] = num / (den + ITEM_SIM.prior); isHas[c] = 1; }
      }
      const sIs = std(isRaw);
      const { scores } = neighborScores(pool, mineIn(pool, nbZ(v)), { minCommon: NB_COMMON, skip: (p) => p.id === me });
      const nbRaw = new Float64Array(C);
      for (let c = 0; c < C; c++) { const f = nbFilm[candList[c]]; const val = f >= 0 ? scores.get(f) : undefined; if (val != null) nbRaw[c] = val; }
      const sNb = std(nbRaw), sIsNb = std(sIs.map((x, c) => x + sNb[c]));
      const wr = v.length / (v.length + K_RULE);
      measure(`${k}|itemSim`, sIs, pos, neg, C, tie);
      measure(`${k}|nb3`, sNb, pos, neg, C, tie);
      measure(`${k}|cons→itemSim`, mix(sCons, sIs, wr), pos, neg, C, tie);
      measure(`${k}|pop+cons→itemSim`, mix(sPC, sIs, wr), pos, neg, C, tie);
      measure(`${k}|cons→is+nb3`, mix(sCons, sIsNb, wr), pos, neg, C, tie);
      measure(`${k}|LB`, Float64Array.from({ length: C }, (_, c) => LB.consensus * consRaw[c] + (isHas[c] ? LB.itemSim * isRaw[c] : LB.missing)), pos, neg, C, tie);
    }
  }
  done++;
  if (done % 20 === 0 || done === 1) console.error(`${done}: ${rated.length} оценок, кандидатов ${C}, ${pos.length}+/${neg.length}− · ${((Date.now() - t1) / 1000).toFixed(1)} с, ${mb()}`);
}

// ─── итог ──────────────────────────────────────────────────────────────────────
const f3 = (x: number) => (Number.isFinite(x) ? x.toFixed(3) : '  —  '), p1 = (x: number) => (x * 100).toFixed(1);
const res = (key: string) => { const x = acc.get(key); return x ? { auc: x.s / (x.w || 1), aucPerPerson: x.pp / (x.np || 1), hit50: x.hit / (x.liked || 1), people: x.np } : undefined; };
console.log(`людей ${done} · ${((Date.now() - t0) / 1000).toFixed(0)} с, ${mb()}`);
console.log('без колоды (от порядка не зависит): ' + ['pop', 'cons', 'pop+cons'].map((b) => { const r = res(`—|${b}`)!; return `${b} AUC ${f3(r.auc)} hit@50 ${p1(r.hit50)}`; }).join(' · '));
const out: Record<string, unknown> = {};
for (const d of DECKS) {
  console.log(`\n══ колода ${d} ══  проход: карточек до 5-й/10-й оценки (медиана, дошли %) · «не смотрел» в первых 10/15 · оценок при N=${NS.join('/')}`);
  for (const o of ORDERS) for (const src of ['', '|kp', '|lb']) {
    const w = walks.get(`${d}|${o}${src}`);
    if (!w) continue;
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
    const line = { to5: median(w.to5), reach5: w.reach5 / w.n, to10: median(w.to10), reach10: w.reach10 / w.n, unseen10: mean(w.unseen10), unseen15: mean(w.unseen15), got: Object.fromEntries(NS.map((n) => [n, mean(w.got[n])])), people: w.n };
    out[`${d}|${o}${src}|walk`] = line;
    console.log(`${(o + (src ? ` ${src.slice(1)}` : '')).padEnd(14)} до 5: ${String(line.to5).padStart(3)} (${p1(line.reach5)}%)  до 10: ${String(line.to10).padStart(3)} (${p1(line.reach10)}%)  не смотрел ${p1(line.unseen10)}% / ${p1(line.unseen15)}%  оценок ${NS.map((n) => line.got[n].toFixed(1)).join('/')}  · ${w.n} чел.`);
  }
  for (const n of NS) {
    console.log(`\n── ${d} · N=${n} ── AUC пары / hit@50 по сигналам: ${SIGNALS.join(' | ')}`);
    for (const o of ORDERS) {
      const cells = SIGNALS.map((s) => { const r = res(`${d}|${o}|${n}|${s}`); if (r) out[`${d}|${o}|${n}|${s}`] = r; return r ? `${f3(r.auc)} ${p1(r.hit50).padStart(4)}` : '—'; });
      console.log(`${o.padEnd(11)} ${cells.join(' | ')}`);
    }
  }
}
for (const b of ['pop', 'cons', 'pop+cons']) out[`—|${b}`] = res(`—|${b}`);
mkdirSync('.cache/eval', { recursive: true });
const day = new Date().toISOString().slice(0, 10);
writeFileSync(`.cache/eval/deck-order-${day}.json`, JSON.stringify({ at: new Date().toISOString(), min: MIN, filmMin: FILM_MIN, ns: NS, people: done, deckOrder: DECK_ORDER, results: out }, null, 1));
console.error(`всего ${((Date.now() - t0) / 1000).toFixed(0)} с, память ${mb()} → .cache/eval/deck-order-${day}.json`);
