// Подбор в два шага (23.10, опыт twoStage, src/lib/model/candidates.ts) — оффлайн-замер по готовым выгрузкам частей счёта
// (tools/taste-dump.mts → .cache/eval/dump-<tag>/, формат — там же), без vite: сетка квот отбора × порядок второго шага
// (full — как в ленте; обученный счёт цели a и b — сырые веса из tune-…-final-<tag>.md, строки «Как вариант для --variants»)
// × правило «одно место в первых 6 — лучшему тихому». Меры — те же, что в tools/taste-tune.mts (оттуда не импортируются: файл
// сразу читает выгрузку и пишет отчёт, поэтому подсчёт повторён с теми же правилами): AUC по парам и по людям, hit@10/50/150,
// hit Штека γ=1, корзины голова/середина/хвост по «что смотрят все», открытия @6/@50 (новизна, громкие, охват, Джини,
// попадания сверх «все смотрят») + доля тихих в 6; парные разницы с base — бутстреп по людям и перестановка, как там.
//   npx tsx tools/tune-two-stage.mts [--dumps frozen,frozen-full] [--weights tag=файл.md,…] [--out .cache/eval/two-stage-2310]
//        [--boot 2000] [--seed 1] [--check]
// --check — сверить быстрый отбор (заранее отсортированные списки источников) с twoStageOrder на нескольких людях и квотах.
// Итог — <out>.md и <out>.json (в .cache — чужие истории, не коммитить). Лента не меняется.
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { TWO_STAGE, twoStageOrder, type CandidateRow, type TwoStageQuotas } from '../src/lib/model/candidates.ts';

const argv = process.argv.slice(2);
const opt = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const DUMPS = (opt('--dumps') ?? 'frozen,frozen-full').split(',').filter(Boolean);
const WEIGHTS = new Map((opt('--weights') ?? '').split(',').filter(Boolean).map((s) => s.split('=') as [string, string]));
const OUT = resolve(opt('--out') ?? '.cache/eval/two-stage-2310');
const BOOT = Number(opt('--boot') ?? 2000);
const SEED = Number(opt('--seed') ?? 1);
const CHECK = argv.includes('--check');
const KS = [10, 50, 150];
const KD = [6, 50];
/** правила «места тихим»: в первых k не меньше m тихих — места равномерно (k = 6, m = 1 → шестое; m = 2 → третье и шестое);
 *  на месте, где тихих пока меньше положенного, а следующее по порядку не тихое, — лучшее неиспользованное тихое по счёту
 *  второго шага (среди отобранных, нет таких — по пулу). s1 — правило из задания, s2 и s17 — сильнее, для сравнения */
interface Rule { key: string; title: string; k: number; m: number }
const RULES: (Rule | null)[] = [null, { key: 's1', title: 'тихий в 6', k: 6, m: 1 }, { key: 's2', title: '2 тихих в 6', k: 6, m: 2 }, { key: 's17', title: 'треть 50 тихие', k: 50, m: 17 }];
const rTitle = (r: Rule | null) => (r ? ` + ${r.title}` : '');
/** тихое для доли «тихих в 6» — одно определение на все варианты (как TWO_STAGE), чтобы доли сравнивались */
const QUIET_REF = { fame: TWO_STAGE.quietFame, popular: TWO_STAGE.quietPopular };

// ─── сетка ─────────────────────────────────────────────────────────────────────
// Полная: 4 × 3 × 3 × 3 × 3 = 324 набора квот × 3 порядка × правило да/нет. Перебор дешёвый — списки источников
// сортируются один раз на человека и порядок, отбор — проход по ним, так что сетку не урезаем.
const GRID = { discovery: [0, 15, 30, 60], popular: [100, 150, 300], consensus: [50, 100, 200], anchor: [0, 50, 100], quietPopular: [0, 3, 10] };
// --grid "discovery=3,6,10;popular=50,100" — своя сетка (не названное — как выше); --steps full,a — только эти порядки
for (const part of (opt('--grid') ?? '').split(';').filter(Boolean)) {
  const [k, v] = part.split('='); if (!(k in GRID)) throw new Error(`--grid: нет квоты ${k} (есть ${Object.keys(GRID).join(', ')})`);
  GRID[k as keyof typeof GRID] = v.split(',').map(Number);
}
const quotaSets: TwoStageQuotas[] = [];
for (const discovery of GRID.discovery) for (const popular of GRID.popular) for (const consensus of GRID.consensus)
  for (const anchor of GRID.anchor) for (const quietPopular of GRID.quietPopular)
    quotaSets.push({ popular, consensus, anchor, discovery, quietFame: TWO_STAGE.quietFame, quietPopular });
const qName = (q: TwoStageQuotas) => `p${q.popular} c${q.consensus} a${q.anchor} d${q.discovery} qp${q.quietPopular}`;
const isDefault = (q: TwoStageQuotas) => qName(q) === qName(TWO_STAGE);

// ─── выгрузка ──────────────────────────────────────────────────────────────────
interface DumpFile { name: string; who: string; ok: boolean; feats: string[]; rows: [string, number | null, ...(number | null)[]][]; holdout?: unknown; sum?: { fameMode?: string } }
interface TrainedW { weights: Record<string, number>; missing: Record<string, number> }
interface Person {
  name: string; who: string; n: number;
  popular: Float64Array; consensus: Float64Array; anchor: Float64Array; fame: Float64Array; loud: Float64Array;
  /** счёт второго шага: full (лента), a, b */
  score: Record<Step, Float64Array>;
  liked: { first: number; rows: number[] }[]; disliked: { first: number; rows: number[] }[];
  keys: Int32Array;
}
type Step = 'full' | 'a' | 'b';
const STEPS: Step[] = (opt('--steps') ?? 'full,a,b').split(',') as Step[];
const STEP_TITLE: Record<Step, string> = { full: 'full (лента)', a: 'обучено a', b: 'обучено b' };

function readWeights(file: string): Record<'a' | 'b', TrainedW> {
  const md = readFileSync(file, 'utf8'), out: Partial<Record<'a' | 'b', TrainedW>> = {};
  for (const line of md.split('\n')) {
    const m = /^\{"name":"обучено (a|b)"/.exec(line);
    if (m) { const v = JSON.parse(line) as TrainedW; out[m[1] as 'a' | 'b'] = { weights: v.weights, missing: v.missing ?? {} }; }
  }
  if (!out.a || !out.b) throw new Error(`${file}: нет строк «обучено a/b» (Как вариант для --variants)`);
  return out as Record<'a' | 'b', TrainedW>;
}

function load(dir: string, W: Record<'a' | 'b', TrainedW>, KEY: Map<string, number>): { people: Person[]; skipped: string[]; holdout?: unknown } {
  const people: Person[] = [], skipped: string[] = [];
  let holdout: unknown;
  const keyId = (k: string) => { let i = KEY.get(k); if (i == null) KEY.set(k, (i = KEY.size)); return i; };
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
    const d = JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')) as DumpFile;
    if (!d.ok) { skipped.push(d.name); continue; }
    holdout ??= d.holdout;
    if (d.sum?.fameMode === 'strong') throw new Error(`${f}: режим strong (третий уровень вне подбора) — замер его не учитывает`);
    const n = d.rows.length, at = (c: string) => { const j = d.feats.indexOf(c); if (j < 0) throw new Error(`${f}: нет столбца ${c}`); return j + 2; };
    const colOf = (c: string) => { const j = at(c); return Float64Array.from(d.rows, (r) => (r[j] == null ? NaN : (r[j] as number))); };
    const sc = (w: TrainedW) => {
      const out = new Float64Array(n);
      for (const [c, x] of Object.entries(w.weights)) { if (!x) continue; const j = at(c); d.rows.forEach((r, i) => { out[i] += x * ((r[j] as number | null) ?? 0); }); }
      for (const [c, x] of Object.entries(w.missing)) { const j = at(c); d.rows.forEach((r, i) => { if (r[j] == null) out[i] += x; }); }
      return out;
    };
    const byKey = new Map<string, number[]>();
    d.rows.forEach((r, i) => { const g = byKey.get(r[0]); if (g) g.push(i); else byKey.set(r[0], [i]); });
    const marked = (l: number) => d.rows.flatMap((r, i) => (r[1] === l ? [{ first: i, rows: byKey.get(r[0])! }] : []));
    people.push({ name: d.name, who: d.who, n, popular: colOf('popular'), consensus: colOf('consensus'), anchor: colOf('anchor'), fame: colOf('fame'), loud: colOf('loud'),
      score: { full: colOf('full'), a: sc(W.a), b: sc(W.b) }, liked: marked(1), disliked: marked(-1), keys: Int32Array.from(d.rows, (r) => keyId(r[0])) });
  }
  return { people, skipped, holdout };
}

// ─── отбор (быстрый, тот же порядок, что selectRows/twoStageOrder) ─────────────
const nz = (x: number) => (Number.isNaN(x) ? 0 : x);
/** номера строк с ключом (NaN — не берутся), по ключу ↓, счёту ↓, номеру ↑ — как take() в selectRows */
function sortedBy(n: number, key: (i: number) => number, s: Float64Array): Int32Array {
  const idx: number[] = []; const val = new Float64Array(n);
  for (let i = 0; i < n; i++) { const v = key(i); if (Number.isNaN(v)) continue; val[i] = v; idx.push(i); }
  idx.sort((a, b) => val[b] - val[a] || s[b] - s[a] || a - b);
  return Int32Array.from(idx);
}
interface Prepared { ordS: Int32Array; ordPop: Int32Array; ordCons: Int32Array; ordAnc: Int32Array; ordQuiet: Map<number, Int32Array> }
function prepare(p: Person, s: Float64Array): Prepared {
  const ordS = Int32Array.from({ length: p.n }, (_, i) => i).sort((a, b) => s[b] - s[a] || a - b);
  const counted = p.popular.some((x) => !Number.isNaN(x));
  const ordQuiet = new Map<number, Int32Array>();
  for (const qp of new Set([...GRID.quietPopular, QUIET_REF.popular, TWO_STAGE.quietPopular]))
    ordQuiet.set(qp, ordS.filter((i) => nz(p.fame[i]) <= TWO_STAGE.quietFame && nz(p.popular[i]) <= qp));
  return { ordS, ordPop: sortedBy(p.n, (i) => (counted ? nz(p.popular[i]) : nz(p.fame[i])), s),
    ordCons: sortedBy(p.n, (i) => p.consensus[i], s), ordAnc: sortedBy(p.n, (i) => p.anchor[i], s), ordQuiet };
}
const mark = { buf: new Int32Array(0), gen: 0 };
/** порядок подбора: отобранные по счёту, за ними остальные по счёту (twoStageOrder); q — null: весь пул по счёту */
function orderOf(p: Person, pr: Prepared, q: TwoStageQuotas | null): Int32Array {
  if (!q || p.n <= q.popular + q.consensus + q.anchor + q.discovery) return pr.ordS.slice();
  if (mark.buf.length < p.n) mark.buf = new Int32Array(p.n);
  const g = ++mark.gen, m = mark.buf;
  const take = (ord: Int32Array, k: number) => { for (let j = 0; j < ord.length && k > 0; j++) if (m[ord[j]] !== g) { m[ord[j]] = g; k--; } };
  take(pr.ordPop, q.popular); take(pr.ordCons, q.consensus); take(pr.ordAnc, q.anchor);
  if (q.quietFame !== TWO_STAGE.quietFame) throw new Error('quietFame вне сетки');
  take(pr.ordQuiet.get(q.quietPopular)!, q.discovery);
  const out = new Int32Array(p.n); let a = 0, b = 0;
  for (const i of pr.ordS) if (m[i] === g) a++;
  for (const i of pr.ordS) { if (m[i] === g) out[b++] = i; else out[a++] = i; }
  return out;
}
function slotRule(p: Person, order: Int32Array, qp: number, rule: Rule | null): Int32Array {
  if (!rule) return order;
  const n = p.n, quiet = (i: number) => nz(p.fame[i]) <= TWO_STAGE.quietFame && nz(p.popular[i]) <= qp;
  const slots = new Set(Array.from({ length: rule.m }, (_, j) => Math.floor(((j + 1) * rule.k) / rule.m) - 1));
  // pulled — места в order, взятые вперёд на места тихих (возрастают); nat — следующее по порядку не взятое
  const out = new Int32Array(n), pulled: number[] = [], isPulled = new Set<number>();
  let nat = 0, qi = 0, have = 0, due = 0, r = 0;
  for (; r < Math.min(rule.k, n); r++) {
    while (isPulled.has(nat)) nat++;
    let at = nat;
    if (slots.has(r) && ++due > have && !quiet(order[nat])) {
      qi = Math.max(qi, nat + 1);
      while (qi < n && (isPulled.has(qi) || !quiet(order[qi]))) qi++;
      if (qi < n) at = qi;
    }
    if (at === nat) nat++; else { pulled.push(at); isPulled.add(at); }
    out[r] = order[at]; if (quiet(order[at])) have++;
  }
  // остальное — по порядку с nat, без взятых вперёд (кусками)
  let from = nat;
  for (const x of pulled) { if (x < from) continue; out.set(order.subarray(from, x), r); r += x - from; from = x + 1; }
  out.set(order.subarray(from), r);
  return out;
}

// ─── меры (как в taste-tune) ───────────────────────────────────────────────────
interface PM { liked: number; disliked: number; pool: number; hit: number[]; auc?: number; best: number[]; top: Int32Array }
/** score — для AUC (равные — половина, как у вариантов без отбора в taste-tune); нет — AUC по месту (как capRank там) */
function measure(p: Person, order: Int32Array, score?: Float64Array): PM {
  const rank = new Int32Array(p.n); order.forEach((idx, r) => { rank[idx] = r; });
  const best = p.liked.map((g) => Math.min(...g.rows.map((i) => rank[i])));
  const v = (i: number) => (score ? score[i] : -rank[i]);
  let auc: number | undefined;
  if (p.liked.length && p.disliked.length) {
    let s = 0; for (const l of p.liked) { const x = v(l.first); for (const d of p.disliked) { const y = v(d.first); s += x > y ? 1 : x === y ? 0.5 : 0; } }
    auc = s / (p.liked.length * p.disliked.length);
  }
  return { liked: p.liked.length, disliked: p.disliked.length, pool: p.n, best, auc, top: order.slice(0, Math.max(...KD)),
    hit: KS.map((k) => (p.liked.length ? best.filter((b) => b < k).length / p.liked.length : 0)) };
}
const steckW = (n: number, g: number) => 1 / Math.max(1, n) ** (g / (g + 1));
function hitW(r: PM, lp: number[], k: number, g: number): [number, number] | undefined {
  if (!r.liked) return undefined;
  let s = 0, h = 0; r.best.forEach((b, j) => { const w = steckW(lp[j], g); s += w; if (b < k) h += w; });
  return [h / s, s];
}
function bucketCuts(people: Person[]): { head: number; tail: number; share: number[] } {
  const cnt = new Map<number, number>(); let tot = 0;
  for (const p of people) for (const x of p.popular) { const v = nz(x); cnt.set(v, (cnt.get(v) ?? 0) + 1); tot++; }
  const vals = [...cnt.keys()].sort((a, b) => a - b);
  let below = 0, tail = vals[0], bestT = Infinity;
  for (const v of vals) { below += cnt.get(v)!; if (Math.abs(below / tot - 0.5) < bestT) { bestT = Math.abs(below / tot - 0.5); tail = v; } }
  let above = 0, head = vals[vals.length - 1], bestH = Infinity;
  for (const v of [...vals].reverse()) { if (v <= tail) break; above += cnt.get(v)!; if (Math.abs(above / tot - 0.2) < bestH) { bestH = Math.abs(above / tot - 0.2); head = v; } }
  let h = 0, t = 0; for (const [v, c] of cnt) { if (v >= head) h += c; else if (v <= tail) t += c; }
  return { head, tail, share: [h / tot, 1 - h / tot - t / tot, t / tot] };
}
const bucketOf = (x: number, c: { head: number; tail: number }) => (x >= c.head ? 0 : x <= c.tail ? 2 : 1);
interface Disc { novelty: number; loud: number; coverage: number; gini: number; beyondPop: number; beyondShare: number; quiet: number }
interface Ctx { people: Person[]; lp: number[][]; cuts: ReturnType<typeof bucketCuts>; P: number; allKeys: number; popBest: number[][]; nov: (p: Person, i: number) => number }
function discovery(cx: Ctx, rows: PM[], k: number): Disc {
  const shows = new Map<number, number>();
  let nov = 0, loud = 0, m = 0, beyond = 0, liked = 0, quiet = 0;
  cx.people.forEach((p, u) => {
    for (const i of rows[u].top.subarray(0, k)) {
      m++; shows.set(p.keys[i], (shows.get(p.keys[i]) ?? 0) + 1);
      nov += cx.nov(p, i); loud += p.loud[i] >= 1 ? 1 : 0;
      if (nz(p.fame[i]) <= QUIET_REF.fame && nz(p.popular[i]) <= QUIET_REF.popular) quiet++;
    }
    liked += rows[u].liked;
    rows[u].best.forEach((b, j) => { if (b < k && cx.popBest[u][j] >= k) beyond++; });
  });
  const c = [...shows.values()].sort((a, b) => a - b), n = cx.allKeys, z = n - c.length, sum = c.reduce((a, b) => a + b, 0);
  let g = 0; c.forEach((x, j) => { g += (2 * (z + j + 1) - n - 1) * x; });
  return { novelty: nov / m, loud: loud / m, coverage: shows.size / n, gini: sum ? g / (n * sum) : 0, beyondPop: beyond, beyondShare: liked ? beyond / liked : 0, quiet: quiet / m };
}
interface Res {
  name: string; step: Step | 'pop'; quotas: TwoStageQuotas | null; rule: string;
  aucPairs?: number; aucPerson?: number; hit: number[]; steck: number[]; buckets: Record<string, number[]>; disc: Record<string, Disc>;
}
const HK = [50, 150];
function summarize(cx: Ctx, name: string, step: Res['step'], quotas: TwoStageQuotas | null, rule: string, rows: PM[]): Res {
  let s = 0, w = 0; for (const r of rows) { if (r.auc == null) continue; s += r.auc * r.liked * r.disliked; w += r.liked * r.disliked; }
  const aucs = rows.flatMap((r) => (r.auc == null ? [] : [r.auc]));
  const liked = rows.reduce((a, r) => a + r.liked, 0);
  const steck = HK.map((k) => { let h = 0, t = 0; rows.forEach((r, u) => { const x = hitW(r, cx.lp[u], k, 1); if (x) { h += x[0] * x[1]; t += x[1]; } }); return t ? h / t : 0; });
  const buckets = Object.fromEntries(HK.map((k) => [String(k), [0, 1, 2].map((b) => { let h = 0, n = 0; rows.forEach((r, u) => r.best.forEach((x, j) => { if (bucketOf(cx.lp[u][j], cx.cuts) !== b) return; n++; if (x < k) h++; })); return n ? h / n : NaN; })]));
  return { name, step, quotas, rule, aucPairs: w ? s / w : undefined, aucPerson: aucs.length ? aucs.reduce((a, b) => a + b, 0) / aucs.length : undefined,
    hit: KS.map((_, i) => (liked ? rows.reduce((a, r) => a + r.hit[i] * r.liked, 0) / liked : 0)), steck, buckets,
    disc: Object.fromEntries(KD.map((k) => [String(k), discovery(cx, rows, k)])) };
}

// ─── парные разницы с base (как честные меры taste-tune) ───────────────────────
function rng(seed: string) {
  let h = 2166136261; for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 2 ** 32; };
}
interface Metric { key: string; title: string; pp: boolean; val: (r: PM, u: number) => [number, number] | undefined }
interface Paired { delta: number; lo: number; hi: number; p: number }
function makePaired(cl: Int32Array, B: number, seed: number) {
  const n = cl.length, C = Math.max(-1, ...cl) + 1;
  const rb = rng(`boot:${seed}`), rp = rng(`perm:${seed}`);
  const IDX = Int32Array.from({ length: B * C }, () => Math.floor(rb() * C)), SGN = Uint8Array.from({ length: B * C }, () => (rp() < 0.5 ? 1 : 0));
  const stat = new Float64Array(B), A = new Float64Array(C), Bc = new Float64Array(C);
  return (ref: PM[], v: PM[], m: Metric): Paired | undefined => {
    A.fill(0); Bc.fill(0);
    let sw = 0, swd = 0;
    for (let u = 0; u < n; u++) {
      const a = m.val(v[u], u), b = m.val(ref[u], u);
      if (!a || !b || !(b[1] > 0)) continue;
      const d = a[0] - b[0], c = cl[u]; A[c] += b[1]; Bc[c] += b[1] * d; sw += b[1]; swd += b[1] * d;
    }
    if (!sw) return undefined;
    const obs = swd / sw;
    for (let k = 0; k < B; k++) { let a = 0, b = 0; for (let j = 0; j < C; j++) { const c = IDX[k * C + j]; a += A[c]; b += Bc[c]; } stat[k] = a ? b / a : obs; }
    const sorted = Float64Array.from(stat).sort();
    let hits = 0;
    for (let k = 0; k < B; k++) { let b = 0; for (let c = 0; c < C; c++) b += (SGN[k * C + c] ? -1 : 1) * Bc[c]; if (Math.abs(b) >= Math.abs(swd) - 1e-12) hits++; }
    return { delta: obs, lo: sorted[Math.floor(0.025 * B)], hi: sorted[Math.min(B - 1, Math.ceil(0.975 * B) - 1)], p: (1 + hits) / (1 + B) };
  };
}

/** порядок «лучше по попаданиям»: hit@50 (видимое в ленте), затем hit@150, Штек@150 */
const byHits = (x: Res, y: Res) => y.hit[1] - x.hit[1] || y.hit[2] - x.hit[2] || y.steck[1] - x.steck[1];
// ─── прогон одной выгрузки ─────────────────────────────────────────────────────
interface DumpOut { tag: string; people: number; liked: number; disliked: number; pool: number; skipped: string[]; weightsFile: string; holdout?: unknown;
  cuts: ReturnType<typeof bucketCuts>; likedIn: number[]; refs: Res[]; grid: Res[]; paired: { name: string; vs: Record<string, Paired | undefined> }[]; best?: string[]; frontier: string[]; knee: string[] }
function runDump(tag: string): DumpOut {
  const dir = resolve(`.cache/eval/dump-${tag}`);
  if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) throw new Error(`нет выгрузки ${dir}`);
  const weightsFile = resolve(WEIGHTS.get(tag) ?? `.cache/eval/tune-2026-10-23-final-${tag}.md`);
  const W = readWeights(weightsFile);
  const t0 = Date.now();
  const { people, skipped, holdout } = load(dir, W, new Map());
  console.error(`${tag}: людей ${people.length}, пропущено ${skipped.length}, пул ~${Math.round(people.reduce((a, p) => a + p.n, 0) / people.length)} · ${((Date.now() - t0) / 1000).toFixed(1)} с`);

  // общие для мер: популярность спрятанного любимого, корзины, новизна, «что смотрят все»
  const lp = people.map((p) => p.liked.map((g) => nz(p.popular[g.first])));
  const cuts = bucketCuts(people);
  const P = Math.max(people.length, ...people.map((p) => p.popular.reduce((a, x) => (x > a ? x : a), 0) + 1)) + 1;
  const all = new Set<number>(); for (const p of people) for (const k of p.keys) all.add(k);
  const popScore = people.map((p) => Float64Array.from(p.popular, (x, i) => nz(x) + i * 1e-9));
  const popOrder = people.map((p, u) => Int32Array.from({ length: p.n }, (_, i) => i).sort((a, b) => popScore[u][b] - popScore[u][a] || a - b));
  const popRows = people.map((p, u) => measure(p, popOrder[u], popScore[u]));
  const cx: Ctx = { people, lp, cuts, P, allKeys: all.size, popBest: popRows.map((r) => r.best), nov: (p, i) => -Math.log2((nz(p.popular[i]) + 1) / P) };
  const likedIn = [0, 1, 2].map((b) => lp.reduce((a, xs) => a + xs.filter((x) => bucketOf(x, cuts) === b).length, 0));

  const refs: Res[] = [], grid: Res[] = [], keepRows = new Map<string, PM[]>();
  refs.push(summarize(cx, '«что смотрят все»', 'pop', null, '', popRows)); keepRows.set(refs[0].name, popRows);
  for (const step of STEPS) {
    const t1 = Date.now();
    const prep = people.map((p) => prepare(p, p.score[step]));
    if (CHECK) {
      for (const q of [TWO_STAGE, quotaSets[0], quotaSets[quotaSets.length - 1], quotaSets[137]].filter(Boolean)) for (const u of [0, 1, people.length - 1]) {
        const p = people[u], rows: CandidateRow[] = Array.from({ length: p.n }, (_, i) => ({ popular: Number.isNaN(p.popular[i]) ? null : p.popular[i], consensus: Number.isNaN(p.consensus[i]) ? null : p.consensus[i],
          anchor: Number.isNaN(p.anchor[i]) ? null : p.anchor[i], fame: Number.isNaN(p.fame[i]) ? null : p.fame[i], full: p.score[step][i] }));
        const want = twoStageOrder(rows, q), got = orderOf(p, prep[u], q);
        if (want.length !== got.length || want.some((x, j) => x !== got[j])) throw new Error(`проверка: ${step} ${qName(q)} ${p.name} — порядок не совпал с twoStageOrder`);
      }
      console.error(`проверка ${step}: быстрый отбор = twoStageOrder`);
    }
    // без двух шагов: весь пул по счёту (AUC — по счёту, как в taste-tune), с правилом и без
    const name0 = step === 'full' ? 'base (full, лента)' : `${STEP_TITLE[step]} (весь пул)`;
    for (const rule of RULES) {
      const rows = people.map((p, u) => { const o = orderOf(p, prep[u], null); return rule ? measure(p, slotRule(p, o, TWO_STAGE.quietPopular, rule)) : measure(p, o, p.score[step]); });
      const r = summarize(cx, name0 + rTitle(rule), step, null, rule?.key ?? '', rows); refs.push(r); keepRows.set(r.name, rows);
    }
    for (const q of quotaSets) for (const rule of RULES) {
      const rows = people.map((p, u) => measure(p, slotRule(p, orderOf(p, prep[u], q), q.quietPopular, rule)));
      const r = summarize(cx, `${STEP_TITLE[step]} · ${qName(q)}${rTitle(rule)}`, step, q, rule?.key ?? '', rows); grid.push(r);
      if (isDefault(q)) keepRows.set(r.name, rows);
    }
    console.error(`${tag} · ${step}: ${quotaSets.length * RULES.length} вариантов · ${((Date.now() - t1) / 1000).toFixed(1)} с`);
  }

  // выбор: не хуже base по хвосту (@50, @150) и новизне (@6, @50); среди них — больше попаданий в видимом (hit@50, затем hit@150)
  const base = refs.find((r) => r.name === 'base (full, лента)')!;
  const ok = (r: Res) => r.buckets['50'][2] >= base.buckets['50'][2] && r.buckets['150'][2] >= base.buckets['150'][2]
    && r.disc['6'].novelty >= base.disc['6'].novelty && r.disc['50'].novelty >= base.disc['50'].novelty;
  // равные по мерам варианты (часто — то же с другим правилом или квотой открытий, которой не хватило) — одной строкой
  const sig = (r: Res) => [r.hit[1], r.hit[2], r.disc['6'].novelty, r.disc['50'].novelty, r.buckets['150'][2]].map((x) => x.toFixed(4)).join();
  const distinct = (xs: Res[]) => { const seen = new Set<string>(); return xs.filter((r) => !seen.has(sig(r)) && !!seen.add(sig(r))); };
  const chosen = distinct(grid.filter(ok).sort(byHits)).slice(0, 5);
  // граница «попадания в видимом (hit@50) против новизны первых 6»: варианты, которых никто не обходит по обеим
  const every = [...refs, ...grid];
  const frontier = distinct(every.filter((r) => !every.some((x) => x.hit[1] >= r.hit[1] && x.disc['6'].novelty >= r.disc['6'].novelty && (x.hit[1] > r.hit[1] || x.disc['6'].novelty > r.disc['6'].novelty))))
    .sort((x, y) => x.disc['6'].novelty - y.disc['6'].novelty);
  const knee = frontier.filter((r) => r.disc['6'].novelty >= base.disc['6'].novelty).sort(byHits).slice(0, 3);
  // парные разницы с base: «все смотрят», обученные без двух шагов, квоты по умолчанию, лучшие «не хуже base», граница с новизной@6 ≥ base
  const want = [...new Set([...refs.map((r) => r.name).filter((n) => n !== base.name), ...grid.filter((r) => r.quotas && isDefault(r.quotas)).map((r) => r.name),
    ...chosen.map((r) => r.name), ...knee.map((r) => r.name)])];
  for (const r of [...chosen, ...knee]) if (!keepRows.has(r.name)) {
    const prep = people.map((p) => prepare(p, p.score[r.step as Step]));
    const rule = RULES.find((x) => (x?.key ?? '') === r.rule) ?? null;
    keepRows.set(r.name, people.map((p, u) => measure(p, slotRule(p, orderOf(p, prep[u], r.quotas), r.quotas!.quietPopular, rule))));
  }
  const whoId = new Map<string, number>(), cl = Int32Array.from(people, (p) => { let i = whoId.get(p.who); if (i == null) whoId.set(p.who, (i = whoId.size)); return i; });
  const pair = makePaired(cl, BOOT, SEED);
  const tailHit = (k: number) => (r: PM, u: number): [number, number] | undefined => {
    let h = 0, n = 0; r.best.forEach((x, j) => { if (bucketOf(lp[u][j], cuts) !== 2) return; n++; if (x < k) h++; }); return n ? [h / n, n] : undefined; };
  const novK = (k: number) => (r: PM, u: number): [number, number] => { const t = r.top.subarray(0, k); let s = 0; for (const i of t) s += cx.nov(people[u], i); return [s / t.length, 1]; };
  const metrics: Metric[] = [
    { key: 'aucPerson', title: 'AUC по людям', pp: false, val: (r) => (r.auc == null ? undefined : [r.auc, 1]) },
    { key: 'hit50', title: 'hit@50', pp: true, val: (r) => (r.liked ? [r.hit[1], r.liked] : undefined) },
    { key: 'hit150', title: 'hit@150', pp: true, val: (r) => (r.liked ? [r.hit[2], r.liked] : undefined) },
    { key: 'steck150', title: 'Штек γ=1 @150', pp: true, val: (r, u) => hitW(r, lp[u], 150, 1) },
    { key: 'tail150', title: 'хвост @150', pp: true, val: tailHit(150) },
    { key: 'nov6', title: 'новизна @6', pp: false, val: novK(6) },
    { key: 'nov50', title: 'новизна @50', pp: false, val: novK(50) },
  ];
  const baseRows = keepRows.get(base.name)!;
  const paired = want.map((name) => ({ name, vs: Object.fromEntries(metrics.map((m) => [m.key, pair(baseRows, keepRows.get(name)!, m)])) }));
  return { tag, people: people.length, liked: lp.reduce((a, x) => a + x.length, 0), disliked: people.reduce((a, p) => a + p.disliked.length, 0),
    pool: Math.round(people.reduce((a, p) => a + p.n, 0) / people.length), skipped, weightsFile, holdout, cuts, likedIn, refs, grid, paired, best: chosen.map((r) => r.name), frontier: frontier.map((r) => r.name), knee: knee.map((r) => r.name) };
}

// ─── отчёт ─────────────────────────────────────────────────────────────────────
const outs: DumpOut[] = [];
for (const tag of DUMPS) outs.push(runDump(tag));   // по одной выгрузке: память — одна выгрузка за раз

const pc = (x?: number) => (x == null || Number.isNaN(x) ? '—' : `${(x * 100).toFixed(1)}%`);
const a3 = (x?: number) => (x == null ? '—' : x.toFixed(3));
const HEAD_HIT = ['| вариант | AUC пары | AUC люди | hit@10 | hit@50 | hit@150 | Штек@50 | Штек@150 | голова@150 | середина@150 | хвост@50 | хвост@150 |', '|---|---|---|---|---|---|---|---|---|---|---|---|'];
const lineHit = (r: Res) => `| ${r.name} | ${a3(r.aucPairs)} | ${a3(r.aucPerson)} | ${r.hit.map(pc).join(' | ')} | ${r.steck.map(pc).join(' | ')} | ${pc(r.buckets['150'][0])} | ${pc(r.buckets['150'][1])} | ${pc(r.buckets['50'][2])} | ${pc(r.buckets['150'][2])} |`;
const HEAD_DISC = ['| вариант | новизна@6 | громких@6 | тихих@6 | новизна@50 | громких@50 | тихих@50 | охват@50 | Джини@50 | сверх «все»@50 |', '|---|---|---|---|---|---|---|---|---|---|'];
const lineDisc = (r: Res) => { const d6 = r.disc['6'], d = r.disc['50']; return `| ${r.name} | ${d6.novelty.toFixed(2)} | ${pc(d6.loud)} | ${pc(d6.quiet)} | ${d.novelty.toFixed(2)} | ${pc(d.loud)} | ${pc(d.quiet)} | ${pc(d.coverage)} | ${d.gini.toFixed(3)} | ${d.beyondPop} (${pc(d.beyondShare)}) |`; };
/** компактная строка сетки: ключевые меры */
const HEAD_C = ['| вариант | AUC люди | hit@10 | hit@50 | hit@150 | Штек@150 | хвост@50 | хвост@150 | новизна@6 | тихих@6 | громких@6 | новизна@50 | громких@50 |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|'];
const lineC = (r: Res) => `| ${r.name} | ${a3(r.aucPerson)} | ${r.hit.map(pc).join(' | ')} | ${pc(r.steck[1])} | ${pc(r.buckets['50'][2])} | ${pc(r.buckets['150'][2])} | ${r.disc['6'].novelty.toFixed(2)} | ${pc(r.disc['6'].quiet)} | ${pc(r.disc['6'].loud)} | ${r.disc['50'].novelty.toFixed(2)} | ${pc(r.disc['50'].loud)} |`;
const sg = (x: number, pp: boolean) => `${x >= 0 ? '+' : '−'}${pp ? (Math.abs(x) * 100).toFixed(1) : Math.abs(x).toFixed(pp ? 1 : 3)}`;
const cell = (x: Paired | undefined, pp: boolean) => (x ? `${x.p < 0.05 ? '**' : ''}${sg(x.delta, pp)} [${sg(x.lo, pp)}; ${sg(x.hi, pp)}]${x.p < 0.05 ? '**' : ''}` : '—');

const strict = (base: Res) => (r: Res) => r.buckets['50'][2] >= base.buckets['50'][2] && r.buckets['150'][2] >= base.buckets['150'][2]
  && r.disc['6'].novelty >= base.disc['6'].novelty && r.disc['50'].novelty >= base.disc['50'].novelty;
const md: string[] = [`# Подбор в два шага — оффлайн-замер, ${new Date().toISOString().slice(0, 10)}`, '',
  'Отбор — `selectRows`/`twoStageOrder` (src/lib/model/candidates.ts; здесь — быстрый проход по заранее отсортированным спискам источников, ' +
  `сверен с twoStageOrder${CHECK ? ' в этом прогоне (--check): порядок совпал' : ' (--check)'}). Второй шаг — порядок внутри отобранных и выбор «открытий»: full (как в ленте) или обученный счёт a/b ` +
  '(Σ вес × часть, нет значения → 0 + надбавка «нет значения»; веса — строки «Как вариант для --variants» из tune-2026-10-23-final-<выгрузка>.md). ' +
  'Не отобранное идёт следом по тому же счёту (для AUC и мест вне отбора); AUC у вариантов с отбором и правилом — по месту, у вариантов без них — по счёту (как в taste-tune; отсюда −0,001 у «base + тихий в 6» — равные счёты, не правило).',
  `Тихое — известность ≤ quietFame = ${TWO_STAGE.quietFame} и оценивших у нас ≤ quietPopular варианта (у опор без отбора — ${TWO_STAGE.quietPopular}). Правила мест: «тихий в 6» (из задания) — если в первых 6 нет тихого, лучшее тихое по счёту второго шага (среди отобранных, нет таких — по пулу) встаёт шестым, остальные сдвигаются; для сравнения сильнее — «2 тихих в 6» (места 3 и 6) и «треть 50 тихие» (17 мест через два). «Тихих в 6/50» в таблицах — по одному определению на всех (quietPopular = ${QUIET_REF.popular}).`,
  `Сетка: discovery ${GRID.discovery.join('/')} × popular ${GRID.popular.join('/')} × consensus ${GRID.consensus.join('/')} × anchor ${GRID.anchor.join('/')} × quietPopular ${GRID.quietPopular.join('/')} = ${quotaSets.length} наборов — полностью: отбор — проход по спискам, отсортированным один раз на человека и порядок, ${quotaSets.length * 3 * RULES.length} вариантов на выгрузку — минуты. × 3 порядка × ${RULES.length} правила (нет / ${RULES.filter(Boolean).map((r) => r!.title).join(' / ')}). По умолчанию TWO_STAGE = ${qName(TWO_STAGE)}.`,
  'Условие задания «не хуже base по хвосту и новизне»: хвост@50, хвост@150 (доля угаданных любимых из хвоста по «все смотрят») и новизна@6, @50 — не ниже, чем у base (full по всему пулу, как лента без опыта).',
  'ВАЖНО: веса a/b обучены на всех людях выгрузки и меряются на них же — оптимистично (в tune на чужих частях AUC a 0,726 против 0,731 здесь); перед лентой a/b перемерить на чужих частях. Хвост — мало любимых (см. «в корзинах»), разницы в 0,5 пп там — 1–2 фильма.', ''];
const distinctR = (xs: Res[]) => { const seen = new Set<string>(); return xs.filter((r) => { const k = [r.hit[1], r.hit[2], r.disc['6'].novelty, r.disc['50'].novelty, r.buckets['150'][2]].map((x) => x.toFixed(4)).join(); return !seen.has(k) && !!seen.add(k); }); };
const pp2 = (x: number) => `${x >= 0 ? '+' : '−'}${Math.abs(x * 100).toFixed(2)} пп`, d2 = (x: number) => `${x >= 0 ? '+' : '−'}${Math.abs(x).toFixed(2)}`;
for (const o of outs) {
  const base = o.refs.find((r) => r.name === 'base (full, лента)')!, ok = strict(base);
  const defaults = o.grid.filter((r) => r.quotas && isDefault(r.quotas));
  md.push(`## Выгрузка ${o.tag}`, '',
    `Людей ${o.people}, любимых спрятано ${o.liked}, нелюбимых ${o.disliked}, пул ~${o.pool}; пропущено (ok: false): ${o.skipped.length}. Веса a/b: ${o.weightsFile.replace(/.*\/\.cache/, '.cache')}. Разбиение: ${JSON.stringify(o.holdout ?? {})}.`,
    `Корзины по «что смотрят все» (оценивших у нас): голова ≥ ${o.cuts.head}, хвост ≤ ${o.cuts.tail}; доля пула ${o.cuts.share.map(pc).join(' / ')}; спрятанных любимых в корзинах ${o.likedIn.join(' / ')}.`, '',
    '### Опоры и квоты по умолчанию — попадания', '', ...HEAD_HIT, ...o.refs.map(lineHit), ...defaults.map(lineHit), '',
    '### Опоры и квоты по умолчанию — открытия', '', ...HEAD_DISC, ...o.refs.map(lineDisc), ...defaults.map(lineDisc), '');
  md.push('### По одной квоте от умолчания (без правила)', '', 'Остальные квоты — как в TWO_STAGE.', '');
  for (const step of STEPS) {
    md.push(`#### ${STEP_TITLE[step]}`, '', ...HEAD_C);
    for (const [k, vals] of Object.entries(GRID) as [keyof typeof GRID, number[]][]) for (const v of vals) {
      const q = { ...TWO_STAGE, [k]: v }; const r = o.grid.find((x) => x.step === step && !x.rule && x.quotas && qName(x.quotas) === qName(q));
      if (r) md.push(lineC({ ...r, name: `${k} = ${v}${isDefault(q) ? ' (умолч.)' : ''}` }));
    }
    md.push('');
  }
  md.push('### Что дают правила мест (средний сдвиг по всем 324 наборам квот: с правилом − без; у опор — по всему пулу)', '',
    '| порядок | правило | hit@10 | hit@50 | hit@150 | Штек@150 | хвост@50 | хвост@150 | новизна@6 | тихих@6 | громких@6 | новизна@50 | тихих@50 | сверх «все»@50 |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const step of STEPS) for (const rule of RULES.filter(Boolean) as Rule[]) {
    const pairs = o.grid.filter((r) => r.step === step && !r.rule).map((r) => [r, o.grid.find((x) => x.step === step && x.rule === rule.key && qName(x.quotas!) === qName(r.quotas!))!] as const);
    const ref = o.refs.find((r) => r.step === step && !r.rule)!, refR = o.refs.find((r) => r.step === step && r.rule === rule.key)!;
    const groups: [string, (readonly [Res, Res])[]][] = [['отбор, среднее', pairs], ['весь пул', [[ref, refR]]]];
    for (const [label, ps] of groups) {
      const d = (f: (r: Res) => number) => ps.reduce((s, [x, y]) => s + f(y) - f(x), 0) / ps.length;
      md.push(`| ${STEP_TITLE[step]} (${label}) | ${rule.title} | ${[0, 1, 2].map((i) => pp2(d((r) => r.hit[i]))).join(' | ')} | ${pp2(d((r) => r.steck[1]))} | ${pp2(d((r) => r.buckets['50'][2]))} | ${pp2(d((r) => r.buckets['150'][2]))} | ${d2(d((r) => r.disc['6'].novelty))} | ${pp2(d((r) => r.disc['6'].quiet))} | ${pp2(d((r) => r.disc['6'].loud))} | ${d2(d((r) => r.disc['50'].novelty))} | ${pp2(d((r) => r.disc['50'].quiet))} | ${d((r) => r.disc['50'].beyondPop).toFixed(1)} |`);
    }
  }
  md.push('');
  const okRule = `хвост@50 ≥ ${pc(base.buckets['50'][2])}, хвост@150 ≥ ${pc(base.buckets['150'][2])}, новизна@6 ≥ ${base.disc['6'].novelty.toFixed(2)}, новизна@50 ≥ ${base.disc['50'].novelty.toFixed(2)}`;
  const oks = o.grid.filter(ok);
  md.push(`### Не хуже base по хвосту и новизне (${okRule}) — ${oks.length} из ${o.grid.length}`, '',
    `По порядкам: ${STEPS.map((s) => `${STEP_TITLE[s]} — ${oks.filter((r) => r.step === s).length}`).join(', ')}; по правилам: ${RULES.map((r) => `${r?.title ?? 'без правила'} — ${oks.filter((x) => x.rule === (r?.key ?? '')).length}`).join(', ')}.`, '',
    '#### Лучшие по hit@50 (затем hit@150; равные по мерам — одной строкой)', '', ...HEAD_C, ...distinctR([...oks].sort(byHits)).slice(0, 12).map(lineC), '',
    '#### Лучшие по hit@150', '', ...HEAD_C, ...distinctR([...oks].sort((x, y) => y.hit[2] - x.hit[2] || y.hit[1] - x.hit[1])).slice(0, 8).map(lineC), '');
  const byName = new Map([...o.refs, ...o.grid].map((r) => [r.name, r]));
  md.push('### Граница: попадания в видимом (hit@50) против новизны первых 6', '',
    'Варианты, которых никто не обходит сразу по hit@50 и новизне@6 (по возрастанию новизны; равные по мерам — одной строкой). Слева — «хиты», справа — «открытия».', '',
    ...HEAD_C, ...o.frontier.map((n) => lineC(byName.get(n)!)), '');
  md.push('### По порядкам: лучшее по hit@50 при новизне@6 не ниже base (без условий на хвост и @50)', '', ...HEAD_C);
  for (const step of STEPS) {
    const xs = distinctR(o.grid.filter((r) => r.step === step && r.disc['6'].novelty >= base.disc['6'].novelty).sort(byHits)).slice(0, 3);
    if (xs.length) md.push(...xs.map(lineC)); else {
      const top = o.grid.filter((r) => r.step === step).sort((x, y) => y.disc['6'].novelty - x.disc['6'].novelty)[0];
      md.push(lineC({ ...top, name: `${STEP_TITLE[step]}: ни один — самая высокая новизна@6: ${top.name}` }));
    }
  }
  md.push('', '### Лучшие по hit@50 вообще (без условий)', '', ...HEAD_C, ...distinctR([...o.grid].sort(byHits)).slice(0, 6).map(lineC), '');
  md.push(`### Парные разницы с base (по людям; [95% бутстреп ${BOOT}], **жирным** — перестановка p < 0,05, без поправки на множественность)`, '',
    'Δ — вариант − base; hit, Штек, хвост — в пп; новизна — в битах. Строки: опоры, квоты по умолчанию, пять лучших по hit@50 из «не хуже base», три лучших по hit@50 с границы при новизне@6 ≥ base.', '',
    '| вариант | AUC люди | hit@50 | hit@150 | Штек@150 | хвост@150 | новизна@6 | новизна@50 |', '|---|---|---|---|---|---|---|---|',
    ...o.paired.map((x) => `| ${x.name} | ${cell(x.vs.aucPerson, false)} | ${cell(x.vs.hit50, true)} | ${cell(x.vs.hit150, true)} | ${cell(x.vs.steck150, true)} | ${cell(x.vs.tail150, true)} | ${cell(x.vs.nov6, false)} | ${cell(x.vs.nov50, false)} |`), '');
}
md.push('## Повтор', '', 'Около 0,5 ГБ памяти и ~6 минут на обе выгрузки (по одной за раз):', '', '```', `npx tsx tools/tune-two-stage.mts --dumps ${DUMPS.join(',')}${opt('--grid') ? ` --grid "${opt('--grid')}"` : ''}${opt('--steps') ? ` --steps ${opt('--steps')}` : ''} --check --out ${OUT.replace(/.*\/recomend\//, '')}`, '```', '');
writeFileSync(`${OUT}.md`, md.join('\n'));
writeFileSync(`${OUT}.json`, JSON.stringify(outs));
console.error(`итог: ${OUT}.md, ${OUT}.json`);
