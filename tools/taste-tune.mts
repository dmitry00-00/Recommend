// Перебор вариантов счёта и обучение весов без vite (23.10): по выгрузке частей счёта (tools/taste-dump.mts → .cache/eval/
// dump-<tag>/<история>.json, формат — там же) считает те же меры, что tools/taste-eval.mts, за секунды, а не за часы:
// приложение не грузится, только сложить части заново. Меры — один в один с замером (функции там не вынимаются: файл
// сразу поднимает vite, поэтому подсчёт повторён ниже с теми же правилами — равные места по порядку пула, равные счёты
// в AUC — половина, попадание — по всем любимым сразу, AUC «по всем парам» — с весом любимых × нелюбимых).
//   npx tsx tools/taste-tune.mts --dump <tag|папка> [--variants файл.mts|.json] [--train a,b] [--tag имя] [--out папка]
//        [--folds 5] [--l2 0.001] [--neg 200] [--feats all|feed|a,b,c] [--drop year,popular] [--seed 1]
// Без --variants и --train — только встроенные (base, full, «все смотрят», соседи), чтобы сверить с taste-eval.
//   варианты: файл .mts (export default или export const variants) или .json — массив { name, weights, … } (см. Variant);
//   обучение: a — любимое против нелюбимого (про вкус, ближе к AUC); b — спрятанное любимое против всего пула (ближе к hit@K).
//   Цели для открытий (23.10: b оказалась «популярностью со вкусом» — громких в первых 6 100%, хвост 0%): c — как b, но пара
//   весит по Штеку s_i = 1/max(1,N_i)^(γ/(γ+1)) и негативы пула — пропорционально (N+1)^β, а не равномерно; cw — только веса,
//   cn — только негативы; d — смесь λ·потеря a + (1−λ)·потеря b. [--gamma 1] [--negpow 1] [--mix 0.5]; цель с числом —
//   своё γ (c:2, cw:0.5) или λ (d:0.3), например --train a,b,c:0.5,c:2,d:0.25.
// Итог — <out>/tune-<дата>-<tag>.md и .json (по умолчанию .cache/eval, вне git: там чужие истории). Лента не меняется:
// обученные веса только печатаются — что поменять в fullScore (src/lib/model/recommend.ts).
// Честные меры (23.10, по research_notes/Улучшение рекомендательного движка/evaluation.md; по умолчанию, --plain — без них):
// парные разницы по людям с base и с лучшим ручным (бутстреп по людям --boot 2000, 95% интервал; перестановка со сменой знака;
// поправка Бенджамини–Иекутиели), σ разниц и различимый на этих людях прирост; hit@K с весом Штека по «все смотрят» (γ 0…2)
// и по корзинам голова/середина/хвост; открытия в первых 6 и 50 (новизна, громкие, охват, Джини, попадания сверх «все смотрят»).
//   [--best <вариант>] — лучший ручной (по умолчанию — вариант из файла с лучшим AUC по людям)
//   npx tsx tools/taste-tune.mts --merge отчёт1.json,отчёт2.json[,…] [--tag имя] — свести отчёты по выгрузкам с разными
//        --seed разбиения: средние и разброс по семенам, сколько раз разница значима (выгрузки не делает).
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const argv = process.argv.slice(2);
const opt = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const DUMP = opt('--dump') ?? 'base';
const DIR = /[/.]/.test(DUMP) ? resolve(DUMP) : resolve(`.cache/eval/dump-${DUMP}`);
const VARIANTS = opt('--variants');
const TRAIN = (opt('--train') ?? '').split(',').filter(Boolean);
const TAG = opt('--tag') ?? DUMP.replace(/.*\//, '').replace(/^dump-/, '');
const OUT = resolve(opt('--out') ?? '.cache/eval');
const FOLDS = Number(opt('--folds') ?? 5);
const L2 = Number(opt('--l2') ?? 1e-3);
const NEG = Number(opt('--neg') ?? 200);
const SEED = Number(opt('--seed') ?? 1);
const KS = [10, 50, 150];
/** честные меры (23.10): повторов бутстрепа и перестановки; первые K для мер открытий */
const HONEST = !argv.includes('--plain');
const BOOT = Number(opt('--boot') ?? 2000);
const KD = [6, 50];
const GAMMAS = [0, 0.5, 1, 2];
/** цели для открытий (23.10): γ веса Штека пары (c, cw), степень β выбора негативов ∝ (N+1)^β (c, cn), доля a в смеси d */
const GAMMA = Number(opt('--gamma') ?? 1);
const NEGPOW = Number(opt('--negpow') ?? 1);
const MIX = Number(opt('--mix') ?? 0.5);

// ─── веса ленты ────────────────────────────────────────────────────────────────
/** счёт ленты из частей (fullScore, recommend.ts, флаги по умолчанию): scoreCandidate + разбор + якорь − засветка + послесловия +
 *  наклон; consensus в ленте выключен (опыт). Проверка: эта сумма = столбцу full. Не сошлось — подбираются сами (МНК) */
const BASE: Record<string, number> = { content: 1, essay: 1, anchor: 1, famePenalty: -1, worth: 1, boost: 1 };
/** части, которые лента знает о фильме сама (остальные — замер: «все смотрят», соседи; itemSim — пока нет) */
// 23.10: easeBin/easeLike — модель EASE (src/lib/model/ease.ts, GET /api/ease; столбцы — tools/dump-add-ease.mts); прежний набор ленты — --feats feed --drop easeBin,easeLike
const FEED = new Set(['content', 'essay', 'anchor', 'register', 'level', 'ops', 'fame', 'famePenalty', 'worth', 'boost', 'consensus', 'year', 'loud', 'itemSim', 'easeBin', 'easeLike']);
/** где часть в fullScore — для печати готовых весов (выражение; после « // » — пояснение в таблицу) */
const IN_FEED: Record<string, string> = {
  content: 'scoreCandidate(state, c.work, energy)', essay: '(c.essays ? ESSAY_BONUS : 0)', anchor: '(options.content ? options.content.weight * options.content.fit(c.work) : 0)',
  famePenalty: '(options.fame ? famePenalty(options.fame.level(c.work), options.fame.mode, state.mediaLiteracy) : 0)',
  consensus: '(options.consensus?.of(c.work) ?? 0)  // вес — CONSENSUS_WEIGHT.value', worth: '(worth ? afterwordBonus(worth, c.work) : 0)',
  boost: '(options.boost ? options.boost.weight * options.boost.fit(c.work) : 0)', level: 'levelFit  // внутри scoreCandidate, наружу не выведен',
  ops: 'opFit  // внутри scoreCandidate, наружу не выведен', register: 'registerFit(state, c.work)', fame: '(options.fame?.level(c.work) ?? 0)',
  loud: '((options.fame?.level(c.work) ?? 0) >= 2 ? 1 : 0)', year: '(c.work.year ?? 0)', itemSim: 'itemSimScore(...)  // src/lib/model/itemSim.ts, когда появится',
  easeLike: '(options.ease?.of(c.work) ?? 0)  // src/lib/model/ease.ts, GET /api/ease', easeBin: '(options.ease?.of(c.work) ?? 0)  // src/lib/model/ease.ts, GET /api/ease',
};
/** «нет значения» в ленте — выражение-условие */
const MISSING_IN_FEED: Record<string, string> = { consensus: 'options.consensus?.of(c.work) == null', fame: 'options.fame?.level(c.work) == null', itemSim: 'itemSimScore(...) == null',
  easeLike: 'options.ease?.of(c.work) == null', easeBin: 'options.ease?.of(c.work) == null' };

// ─── выгрузка ──────────────────────────────────────────────────────────────────
interface DumpFile { name: string; who: string; ok: boolean; holdout?: { mode?: string; share?: number; seed?: number }; warnings?: string[]; feats: string[]; rows: [string, number | null, ...(number | null)[]][]; ratingsTotal?: number; hiddenTotal?: number; hiddenInPool?: number
  /** как в этом прогоне сложен full (taste-dump): fame — засветка в счёте (0 при fameCap), consensus — вес меры (0 — опыт выключен), fameMode — режим засветки */
  sum?: { fame?: number; consensus?: number; anchorWeight?: number; fameMode?: string } }
interface Person {
  name: string; who: string; n: number;
  /** веса ленты в прогоне выгрузки (из sum): base именно этого человека; нет sum — общий BASE */
  base?: Record<string, number>;
  /** «убрать самые громкие» (режим strong): третий уровень в подбор не идёт — в замере счёт −1e9, так же и здесь */
  excluded?: Uint8Array;
  /** часть → значения по строкам пула; нет значения — NaN */
  col: Map<string, Float64Array>;
  /** спрятанное любимое / нелюбимое: строка с меткой (выгрузка ставит её на первую строку пула с ключом спрятанного — по ней
   *  значение, как valueOf в замере) и все строки с тем же ключом (место — лучшее из них, как ranks в замере) */
  liked: { first: number; rows: number[] }[]; disliked: { first: number; rows: number[] }[];
  /** номер фильма (ключа) в общем списке всех пулов — для охвата и Джини (23.10) */
  keys: Int32Array;
}
const KEY = new Map<string, number>();
const keyId = (k: string) => { let i = KEY.get(k); if (i == null) KEY.set(k, (i = KEY.size)); return i; };
function load(dir: string): { people: Person[]; feats: string[]; skipped: string[]; holdout?: DumpFile['holdout'] } {
  const people: Person[] = [], skipped: string[] = [];
  let feats: string[] | undefined, holdout: DumpFile['holdout'];
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
    const d = JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')) as DumpFile;
    if (!d.ok) { skipped.push(`${d.name}: ${(d.warnings ?? []).join('; ') || 'ok: false'}`); continue; }
    feats ??= d.feats; holdout ??= d.holdout;
    if (d.feats.join() !== feats.join()) throw new Error(`${f}: другие столбцы (${d.feats.join()}) — выгрузки разных версий`);
    const n = d.rows.length;
    const col = new Map(d.feats.map((k) => [k, new Float64Array(n)]));
    const cols = d.feats.map((k) => col.get(k)!);
    const byKey = new Map<string, number[]>();
    d.rows.forEach((r, i) => {
      for (let j = 0; j < cols.length; j++) { const v = r[j + 2] as number | null; cols[j][i] = v == null ? NaN : v; }
      const g = byKey.get(r[0]); if (g) g.push(i); else byKey.set(r[0], [i]);
    });
    const marked = (l: number) => d.rows.flatMap((r, i) => (r[1] === l ? [{ first: i, rows: byKey.get(r[0])! }] : []));
    const fame = col.get('fame');
    people.push({ name: d.name, who: d.who, n, col, liked: marked(1), disliked: marked(-1), keys: Int32Array.from(d.rows, (r) => keyId(r[0])),
      ...(d.sum ? { base: { ...BASE, famePenalty: -(d.sum.fame ?? 1), consensus: d.sum.consensus ?? 0 } } : {}),
      ...(d.sum?.fameMode === 'strong' && fame ? { excluded: Uint8Array.from(fame, (x) => (x === 3 ? 1 : 0)) } : {}) });
  }
  return { people, feats: feats ?? [], skipped, holdout };
}

// ─── меры (как в taste-eval) ───────────────────────────────────────────────────
/** доля пар «любимое выше нелюбимого»; равные — половина */
function auc(pos: number[], neg: number[]): number | undefined {
  if (!pos.length || !neg.length) return undefined;
  let s = 0; for (const p of pos) for (const n of neg) s += p > n ? 1 : p === n ? 0.5 : 0;
  return s / (pos.length * neg.length);
}
/** места по счёту: выше — раньше, равные — в порядке пула (устойчивая сортировка, как в замере) */
function rankOf(score: Float64Array): Int32Array {
  const order = Array.from({ length: score.length }, (_, i) => i).sort((a, b) => score[b] - score[a] || a - b);
  const at = new Int32Array(score.length);
  order.forEach((idx, r) => { at[idx] = r; });
  return at;
}
/** место в порядке → доля от 1 (верх) до 0 (низ) — как pct в замере (смеси «модель + соседи») */
function pct(score: Float64Array): Float64Array {
  const at = rankOf(score), out = new Float64Array(score.length);
  for (let i = 0; i < out.length; i++) out[i] = 1 - at[i] / out.length;
  return out;
}
/** best — лучшее место каждого спрятанного любимого (порядок p.liked), top — строки пула на первых местах (до max KD) — для честных мер */
interface PersonMeasure { name: string; liked: number; disliked: number; pool: number; hit: number[]; auc?: number; best: number[]; top: Int32Array }
function measure(p: Person, score: Float64Array, rank = rankOf(score)): PersonMeasure {
  const best = p.liked.map((g) => Math.min(...g.rows.map((i) => rank[i])));
  const top = new Int32Array(Math.min(p.n, Math.max(...KD))).fill(-1);
  for (let i = 0; i < p.n; i++) if (rank[i] < top.length) top[rank[i]] = i;
  return { name: p.name, liked: p.liked.length, disliked: p.disliked.length, pool: p.n,
    hit: KS.map((k) => p.liked.length ? best.filter((b) => b < k).length / p.liked.length : 0),
    auc: auc(p.liked.map((g) => score[g.first]), p.disliked.map((g) => score[g.first])), best, top };
}
interface Summary { people: number; liked: number; disliked: number; auc?: number; aucPerPerson?: number; hit: number[]; random: number[] }
const mean = (xs: (number | undefined)[]) => { const v = xs.filter((x): x is number => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : undefined; };
function summarize(rows: PersonMeasure[]): Summary {
  let s = 0, w = 0;
  for (const r of rows) { if (r.auc == null) continue; s += r.auc * r.liked * r.disliked; w += r.liked * r.disliked; }
  const liked = rows.reduce((a, r) => a + r.liked, 0);
  const pool = mean(rows.map((r) => r.pool)) ?? 1;
  return { people: rows.length, liked, disliked: rows.reduce((a, r) => a + r.disliked, 0), auc: w ? s / w : undefined,
    aucPerPerson: mean(rows.map((r) => r.auc)), hit: KS.map((_, i) => liked ? rows.reduce((a, r) => a + r.hit[i] * r.liked, 0) / liked : 0),
    random: KS.map((k) => k / pool) };
}

// ─── варианты ──────────────────────────────────────────────────────────────────
/** Вариант счёта: Σ вес × часть (нет значения → fill, по умолчанию 0, как `?? 0` в ленте) + надбавка за «нет значения». */
export interface Variant {
  name: string;
  /** веса поверх base (не названное — как в base); from: 'zero' — только названное */
  weights?: Record<string, number>;
  from?: 'base' | 'zero';
  /** нет значения → это число (по умолчанию 0) */
  fill?: Record<string, number>;
  /** надбавка к счёту, когда у части нет значения (признак «нет значения» из обучения) */
  missing?: Record<string, number>;
  /** части, которые сперва переводятся в место в пуле человека 0…1 (как смеси в замере) */
  pct?: string[];
  /** громких (loud = 1) в первых k — не больше max, лишние опускаются сразу за k (как опыт fameCap, только по порядку пула) */
  loudCap?: { k: number; max: number };
  /** не убирать третий уровень при режиме strong (по умолчанию убирается, как в ленте и замере; «без приглушения» замера — не убирает) */
  keepExcluded?: boolean;
  /** свой счёт строки (только в .mts): части по имени, нет значения — null; i — номер строки в пуле */
  score?: (r: Record<string, number | null>, i: number) => number;
}
const get = (p: Person, f: string) => { const c = p.col.get(f); if (!c) throw new Error(`нет части ${f} (есть: ${[...p.col.keys()].join(', ')})`); return c; };
function scoreVariant(p: Person, v: Variant, base: Record<string, number>): Float64Array {
  const out = new Float64Array(p.n);
  if (v.score) {
    const names = [...p.col.keys()], cols = names.map((f) => p.col.get(f)!);
    for (let i = 0; i < p.n; i++) {
      const r: Record<string, number | null> = {};
      names.forEach((f, j) => { const x = cols[j][i]; r[f] = Number.isNaN(x) ? null : x; });
      out[i] = v.score(r, i);
    }
    return out;
  }
  const w = { ...(v.from === 'zero' ? {} : p.base ?? base), ...(v.weights ?? {}) };
  for (const [f, wf] of Object.entries(w)) {
    if (!wf) continue;
    const c = get(p, f), fill = v.fill?.[f] ?? 0;
    let x = Float64Array.from(c, (y) => (Number.isNaN(y) ? fill : y));
    if (v.pct?.includes(f)) x = pct(x);
    for (let i = 0; i < p.n; i++) out[i] += wf * x[i];
  }
  for (const [f, m] of Object.entries(v.missing ?? {})) { const c = get(p, f); for (let i = 0; i < p.n; i++) if (Number.isNaN(c[i])) out[i] += m; }
  return out;
}
/** предел громких в первых k: порядок пула, лишние громкие — сразу после k; AUC тогда — по новому месту */
function capRank(p: Person, score: Float64Array, cap: { k: number; max: number }): Int32Array {
  const loud = get(p, 'loud');
  const order = Array.from({ length: p.n }, (_, i) => i).sort((a, b) => score[b] - score[a] || a - b);
  const top: number[] = [], held: number[] = [], rest: number[] = [];
  let louds = 0;
  for (const i of order) {
    if (top.length >= cap.k) rest.push(i);
    else if (loud[i] >= 1 && louds >= cap.max) held.push(i);
    else { top.push(i); if (loud[i] >= 1) louds++; }
  }
  const at = new Int32Array(p.n);
  [...top, ...held, ...rest].forEach((idx, r) => { at[idx] = r; });
  return at;
}
function runVariant(people: Person[], v: Variant, base: Record<string, number>): { rows: PersonMeasure[]; sum: Summary } {
  const rows = people.map((p) => {
    const s = scoreVariant(p, v, base);
    if (p.excluded && !v.keepExcluded) p.excluded.forEach((x, i) => { if (x) s[i] = -1e9; });
    if (!v.loudCap) return measure(p, s);
    const at = capRank(p, s, v.loudCap);
    return measure(p, Float64Array.from(at, (r) => -r), at);
  });
  return { rows, sum: summarize(rows) };
}
/** встроенные — как способы замера: модель, без приглушения, «все смотрят», соседи, «модель + соседи» */
function builtins(feats: string[]): Variant[] {
  const has = (f: string) => feats.includes(f);
  const pop = (r: Record<string, number | null>, i: number) => (r.popular ?? 0) + i * 1e-9;
  return [
    { name: 'base (веса ленты)' },
    ...(has('full') ? [{ name: 'full (столбец выгрузки)', from: 'zero' as const, weights: { full: 1 } }] : []),
    { name: 'без приглушения топов', weights: { famePenalty: 0 }, keepExcluded: true },
    ...(has('popular') ? [{ name: '«что смотрят все»', score: pop }] : []),
    ...(has('neighbors') ? [{ name: 'соседи по вкусу', score: (r: Record<string, number | null>, i: number) => (r.neighbors ?? 0) + pop(r, i) * 1e-6 }] : []),
  ];
}
/** «модель + соседи» в замере — среднее мест «без приглушения» и соседей (с их мелкими добавками для равных) */
function modelNeighbors(people: Person[], base: Record<string, number>): { rows: PersonMeasure[]; sum: Summary } {
  const rows = people.map((p) => {
    const plain = pct(scoreVariant(p, { name: '', weights: { famePenalty: 0 } }, base));
    const pop = get(p, 'popular'), nb = get(p, 'neighbors');
    const nbs = pct(Float64Array.from(nb, (x, i) => (Number.isNaN(x) ? 0 : x) + ((Number.isNaN(pop[i]) ? 0 : pop[i]) + i * 1e-9) * 1e-6));
    return measure(p, Float64Array.from(plain, (x, i) => (x + nbs[i]) / 2));
  });
  return { rows, sum: summarize(rows) };
}

// ─── проверка base = full ──────────────────────────────────────────────────────
/** решение A x = b (A — симметричная положительно определённая, Холецкий); A портится */
function solve(A: Float64Array, b: Float64Array, d: number): Float64Array {
  for (let j = 0; j < d; j++) {
    let s = A[j * d + j];
    for (let k = 0; k < j; k++) s -= A[j * d + k] ** 2;
    const l = Math.sqrt(Math.max(s, 1e-12));
    A[j * d + j] = l;
    for (let i = j + 1; i < d; i++) { let t = A[i * d + j]; for (let k = 0; k < j; k++) t -= A[i * d + k] * A[j * d + k]; A[i * d + j] = t / l; }
  }
  const y = new Float64Array(d);
  for (let i = 0; i < d; i++) { let t = b[i]; for (let k = 0; k < i; k++) t -= A[i * d + k] * y[k]; y[i] = t / A[i * d + i]; }
  for (let i = d - 1; i >= 0; i--) { let t = y[i]; for (let k = i + 1; k < d; k++) t -= A[k * d + i] * y[k]; y[i] = t / A[i * d + i]; }
  return y;
}
/** сумма base против full; не сошлось — МНК full по частям (нет значения → 0): какие веса на самом деле у столбца full */
function checkBase(people: Person[], feats: string[]): { maxErr: number; fitted?: Record<string, number>; fitErr?: number } {
  let maxErr = 0;
  for (const p of people) {
    const s = scoreVariant(p, { name: '' }, BASE), full = get(p, 'full');
    for (let i = 0; i < p.n; i++) maxErr = Math.max(maxErr, Math.abs(s[i] - full[i]));
  }
  if (maxErr < 1e-6) return { maxErr };
  const xs = feats.filter((f) => f !== 'full'), d = xs.length + 1;
  const A = new Float64Array(d * d), b = new Float64Array(d), row = new Float64Array(d);
  for (const p of people) {
    const cols = xs.map((f) => get(p, f)), full = get(p, 'full');
    for (let i = 0; i < p.n; i++) {
      cols.forEach((c, j) => { row[j] = Number.isNaN(c[i]) ? 0 : c[i]; }); row[d - 1] = 1;
      for (let a = 0; a < d; a++) { b[a] += row[a] * full[i]; for (let c = 0; c <= a; c++) A[a * d + c] += row[a] * row[c]; }
    }
  }
  for (let a = 0; a < d; a++) { for (let c = 0; c < a; c++) A[c * d + a] = A[a * d + c]; A[a * d + a] += 1e-9; }
  const w = solve(A, b, d);
  const fitted = Object.fromEntries(xs.map((f, j) => [f, Math.round(w[j] * 1e6) / 1e6]).filter(([, x]) => x !== 0)) as Record<string, number>;
  let fitErr = 0;
  for (const p of people) {
    const s = scoreVariant(p, { name: '', from: 'zero', weights: fitted }, {}), full = get(p, 'full');
    for (let i = 0; i < p.n; i++) fitErr = Math.max(fitErr, Math.abs(s[i] + w[d - 1] - full[i]));
  }
  return { maxErr, fitted, fitErr };
}

// ─── обучение ──────────────────────────────────────────────────────────────────
// Парное ранжирование (логистическая регрессия на разностях пар, RankNet в линейном виде), а не поточечная: обе меры — про
// порядок ВНУТРИ человека (AUC — пары любимое/нелюбимое, hit@K — место среди его пула). Поточечная регрессия тратила бы
// веса на различия МЕЖДУ людьми (у кого больше любимых, у кого длиннее история и сильнее якорь) и на перекос классов;
// на разностях пар их нет, свободного члена нет, а логистическая потеря на парах — гладкая замена самому AUC.
// Цели: a — пары (спрятанное любимое, спрятанное нелюбимое) того же человека, все; b — (спрятанное любимое, строка пула
// не из любимых), по --neg случайных на каждое любимое (пул — всё непросмотренное, в нём и спрятанное «середина»/нелюбимое).
// Пропуски: нет значения → 0 и отдельный признак «нет значения» (f∅), если пропуски у части вообще встречаются;
// стандартизация по пулу обучающих людей, L2 на стандартизованные веса, Ньютон (IRLS) с Холецким — признаков ~30.
// Цели для открытий (23.10). b выигрывает hit@K, ставя известное выше неизвестного: любимые в основном из головы (просмотренное
// другими чаще просмотрено и тобой), а равномерные негативы — в основном хвост пула, так что «громкость» сама отделяет пары.
// c лечит обе стороны: (1) пара весит s_i — вес Штека спрятанного любимого (как hit Штека в честных мерах), угаданный
// малоизвестный стоит дороже угаданного хита; (2) негативы берутся ∝ (N_j+1)^β (+1 — чтобы и никем не оценённое могло попасть;
// β = 1 — примерно как популярность самих любимых, см. «средний log2(N+1)» в отчёте), тогда у пары известность обеих сторон
// близка и выигрыш — только во вкусе. cw — только (1), cn — только (2). d — смесь λ·a + (1−λ)·b: средние потери a и b
// с весами λ и 1−λ (на каждой паре вес λ/пар a или (1−λ)/пар b), чтобы сравнить «поправку на вкус» без поправки на известность.
type Target = 'a' | 'b' | 'c' | 'cw' | 'cn' | 'd';
const TARGETS: Record<Target, string> = { a: 'любимое против нелюбимого', b: 'спрятанное любимое против всего пула',
  c: 'как b, пара по весу Штека, негативы ∝ популярности', cw: 'как b, пара по весу Штека (негативы равномерно)', cn: 'как b, негативы ∝ популярности (веса пар равные)',
  d: 'смесь a и b (взвешенная сумма потерь)' };
/** цель с параметром: name — как в таблицах (a, b — как прежде; c γ=1, d λ=0.5) */
interface Goal { target: Target; name: string; title: string; gamma?: number; negpow?: number; mix?: number }
function goalOf(spec: string): Goal {
  const m = /^(a|b|cw|cn|c|d)(?::([\d.]+))?$/.exec(spec);
  if (!m) throw new Error(`цель ${spec}: есть ${Object.keys(TARGETS).join(', ')} (c, cw — с :γ, d — с :λ)`);
  const target = m[1] as Target, x = m[2] == null ? undefined : Number(m[2]);
  if (target === 'a' || target === 'b') return { target, name: target, title: TARGETS[target] };
  if (target === 'd') { const mix = x ?? MIX; return { target, name: `d λ=${mix}`, title: `${TARGETS.d}: ${mix}·a + ${+(1 - mix).toFixed(6)}·b`, mix }; }
  const gamma = target === 'cn' ? undefined : x ?? GAMMA, negpow = target === 'cw' ? undefined : NEGPOW;
  return { target, name: `${target}${gamma != null ? ` γ=${gamma}` : ''}${negpow != null && negpow !== 1 ? ` β=${negpow}` : ''}`, title: TARGETS[target], gamma, negpow };
}
interface Design { cols: string[]; src: { f: string; miss: boolean }[]; mean: Float64Array; sd: Float64Array }
/** признаки: часть (нет значения → 0) и «нет значения», только меняющиеся в обучающем пуле */
function design(train: Person[], feats: string[]): Design {
  const src: { f: string; miss: boolean }[] = [];
  for (const f of feats) { src.push({ f, miss: false }); if (train.some((p) => get(p, f).some(Number.isNaN))) src.push({ f, miss: true }); }
  const val = (c: Float64Array, i: number, miss: boolean) => (miss ? (Number.isNaN(c[i]) ? 1 : 0) : Number.isNaN(c[i]) ? 0 : c[i]);
  const st = src.map(({ f, miss }) => {
    let n = 0, s = 0, s2 = 0;
    for (const p of train) { const c = get(p, f); for (let i = 0; i < p.n; i++) { const x = val(c, i, miss); n++; s += x; s2 += x * x; } }
    const m = s / n;
    return { m, sd: Math.sqrt(Math.max(0, s2 / n - m * m)) };
  });
  const keep = src.map((_, j) => st[j].sd > 1e-9);
  const src2 = src.filter((_, j) => keep[j]), st2 = st.filter((_, j) => keep[j]);
  return { cols: src2.map(({ f, miss }) => (miss ? `${f}∅` : f)), src: src2, mean: Float64Array.from(st2, (x) => x.m), sd: Float64Array.from(st2, (x) => x.sd) };
}
/** стандартизованные признаки человека: строка i → X[i*d … i*d+d) */
function features(p: Person, D: Design): Float64Array {
  const d = D.cols.length, X = new Float64Array(p.n * d);
  D.src.forEach(({ f, miss }, j) => {
    const c = get(p, f);
    for (let i = 0; i < p.n; i++) { const x = miss ? (Number.isNaN(c[i]) ? 1 : 0) : Number.isNaN(c[i]) ? 0 : c[i]; X[i * d + j] = (x - D.mean[j]) / D.sd[j]; }
  });
  return X;
}
/** детерминированный «случай» (как rng в замере, по строке) */
function rng(seed: string) {
  let h = 2166136261; for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 2 ** 32; };
}
/** разности пар (любимое − другое) по цели; W — вес пары (только у c, cw, cn, d; у a, b — все по 1), stat — известность сторон пар */
interface Pairs { Z: Float32Array; n: number; W?: Float64Array; stat?: { pos: number; posW: number; neg: number } }
function pairs(train: Person[], D: Design, goal: Goal): Pairs {
  const target = goal.target;
  if (target === 'a' || target === 'b') return pairsAB(train, D, target);
  if (target === 'd') {
    // смесь (23.10): пары a и b вместе, у каждой вес λ/пар a или (1−λ)/пар b — сумма весов 1, потеря = λ·La + (1−λ)·Lb
    const A = pairsAB(train, D, 'a'), B = pairsAB(train, D, 'b'), lam = goal.mix!;
    const Z = new Float32Array(A.Z.length + B.Z.length); Z.set(A.Z); Z.set(B.Z, A.Z.length);
    const W = new Float64Array(A.n + B.n); W.fill(A.n ? lam / A.n : 0, 0, A.n); W.fill(B.n ? (1 - lam) / B.n : 0, A.n);
    return { Z, n: A.n + B.n, W };
  }
  // c, cw, cn (23.10): как b, но вес пары — Штек любимого (c, cw) и негативы ∝ (N+1)^β (c, cn); N — popular, нет значения → 0
  const d = D.cols.length, chunks: Float32Array[] = [], wch: Float64Array[] = [];
  let n = 0, sp = 0, spw = 0, sw = 0, sn = 0, nn = 0;
  for (const p of train) {
    const X = features(p, D), pop = get(p, 'popular'), N = (i: number) => (Number.isNaN(pop[i]) ? 0 : pop[i]);
    const likedRows = new Set(p.liked.flatMap((g) => g.rows));
    const rand = rng(`${SEED}:${p.name}`);
    const m = p.liked.length * NEG;
    if (!m) continue;
    let cum: Float64Array | undefined;
    if (goal.negpow != null) { cum = new Float64Array(p.n); let t = 0; for (let i = 0; i < p.n; i++) { if (!likedRows.has(i)) t += (N(i) + 1) ** goal.negpow; cum[i] = t; } }
    const draw = (): number => {
      if (!cum) { let j; do j = Math.floor(rand() * p.n); while (likedRows.has(j)); return j; }
      const u = rand() * cum[p.n - 1];
      let lo = 0, hi = p.n - 1; while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid] > u) hi = mid; else lo = mid + 1; }
      return lo;
    };
    const Z = new Float32Array(m * d), W = new Float64Array(m);
    let k = 0;
    for (const g of p.liked) {
      const w = goal.gamma != null ? steckW(N(g.first), goal.gamma) : 1, lg = Math.log2(N(g.first) + 1);
      sp += lg; spw += w * lg; sw += w;
      for (let r = 0; r < NEG; r++) { const j = draw(); sn += Math.log2(N(j) + 1); nn++; for (let c = 0; c < d; c++) Z[k * d + c] = X[g.first * d + c] - X[j * d + c]; W[k] = w; k++; }
    }
    chunks.push(Z); wch.push(W); n += m;
  }
  const Z = new Float32Array(n * d), W = new Float64Array(n);
  let off = 0, wo = 0; for (let c = 0; c < chunks.length; c++) { Z.set(chunks[c], off); off += chunks[c].length; W.set(wch[c], wo); wo += wch[c].length; }
  const liked = train.reduce((a, p) => a + p.liked.length, 0);
  return { Z, n, W, stat: { pos: sp / (liked || 1), posW: spw / (sw || 1), neg: sn / (nn || 1) } };
}
function pairsAB(train: Person[], D: Design, target: 'a' | 'b'): { Z: Float32Array; n: number } {
  const d = D.cols.length, chunks: Float32Array[] = [];
  let n = 0;
  for (const p of train) {
    const X = features(p, D);
    const others: number[] = [];
    if (target === 'a') others.push(...p.disliked.map((g) => g.first));
    const likedRows = new Set(p.liked.flatMap((g) => g.rows));
    const rand = rng(`${SEED}:${p.name}`);
    const m = target === 'a' ? p.liked.length * others.length : p.liked.length * NEG;
    if (!m) continue;
    const Z = new Float32Array(m * d);
    let k = 0;
    for (const g of p.liked) {
      const negs = target === 'a' ? others : Array.from({ length: NEG }, () => { let j; do j = Math.floor(rand() * p.n); while (likedRows.has(j)); return j; });
      for (const j of negs) { for (let c = 0; c < d; c++) Z[k * d + c] = X[g.first * d + c] - X[j * d + c]; k++; }
    }
    chunks.push(Z); n += m;
  }
  const Z = new Float32Array(n * d);
  let off = 0; for (const c of chunks) { Z.set(c, off); off += c.length; }
  return { Z, n };
}
const sig = (x: number) => (x >= 0 ? 1 / (1 + Math.exp(-x)) : Math.exp(x) / (1 + Math.exp(x)));
const log1pexp = (x: number) => (x > 30 ? x : x < -30 ? Math.exp(x) : Math.log1p(Math.exp(x)));
/** минимум средней log(1 + e^(−w·z)) + L2/2·|w|² — Ньютон с уполовиниванием шага; W (23.10) — веса пар, средняя тогда Σ W·l / Σ W
 *  (без W — все по 1: те же числа, что до весов) */
function fit(Z: Float32Array, n: number, d: number, l2: number, W?: Float64Array): { w: Float64Array; loss: number; iters: number } {
  let w = new Float64Array(d);
  const nw = W ? W.reduce((a, x) => a + x, 0) : n;
  const lossOf = (w: Float64Array) => {
    let s = 0;
    for (let k = 0; k < n; k++) { let m = 0; for (let c = 0; c < d; c++) m += w[c] * Z[k * d + c]; s += (W ? W[k] : 1) * log1pexp(-m); }
    return s / nw + (l2 / 2) * w.reduce((a, x) => a + x * x, 0);
  };
  let loss = lossOf(w), iters = 0;
  for (; iters < 30; iters++) {
    const g = new Float64Array(d), H = new Float64Array(d * d);
    for (let k = 0; k < n; k++) {
      const o = k * d;
      let m = 0; for (let c = 0; c < d; c++) m += w[c] * Z[o + c];
      const wk = W ? W[k] : 1, q = sig(-m), h = wk * (q * (1 - q)), wq = wk * q;
      for (let a = 0; a < d; a++) { const za = Z[o + a]; g[a] -= wq * za; const hz = h * za; for (let c = 0; c <= a; c++) H[a * d + c] += hz * Z[o + c]; }
    }
    for (let a = 0; a < d; a++) { g[a] = g[a] / nw + l2 * w[a]; for (let c = 0; c <= a; c++) H[a * d + c] /= nw; H[a * d + a] += l2; for (let c = 0; c < a; c++) H[c * d + a] = H[a * d + c]; }
    const step = solve(H, g, d);
    let t = 1, next = w, nextLoss = Infinity;
    for (; t > 1e-4; t /= 2) { next = Float64Array.from(w, (x, c) => x - t * step[c]); nextLoss = lossOf(next); if (nextLoss <= loss) break; }
    if (!(nextLoss <= loss)) break;
    const done = loss - nextLoss < 1e-10;
    w = next; loss = nextLoss;
    if (done) break;
  }
  return { w, loss, iters };
}
interface Trained { D: Design; w: Float64Array; loss: number; iters: number; pairs: number; stat?: Pairs['stat'] }
function train(people: Person[], feats: string[], goal: Goal): Trained {
  const D = design(people, feats);
  const { Z, n, W, stat } = pairs(people, D, goal);
  const { w, loss, iters } = fit(Z, n, D.cols.length, L2, W);
  return { D, w, loss, iters, pairs: n, ...(stat ? { stat } : {}) };
}
/** счёт обученного по сырым частям: Σ (w/sd)·x — свободный член для порядка не нужен */
function rawWeights(t: Trained): Record<string, number> { return Object.fromEntries(t.D.cols.map((c, j) => [c, t.w[j] / t.D.sd[j]])); }
function scoreTrained(p: Person, t: Trained): Float64Array {
  const X = features(p, t.D), d = t.D.cols.length, out = new Float64Array(p.n);
  for (let i = 0; i < p.n; i++) { let s = 0; for (let c = 0; c < d; c++) s += t.w[c] * X[i * d + c]; out[i] = s; }
  return out;
}
/** части по людям: who — один человек целиком в одной части; порядок — перемешан детерминированно */
function folds(people: Person[], k: number): Person[][] {
  const whos = [...new Set(people.map((p) => p.who))].sort();
  const rand = rng(`folds:${SEED}`);
  for (let i = whos.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [whos[i], whos[j]] = [whos[j], whos[i]]; }
  const part = new Map(whos.map((w, i) => [w, i % k]));
  return Array.from({ length: k }, (_, f) => people.filter((p) => part.get(p.who) === f));
}

// ─── честные меры (23.10) ──────────────────────────────────────────────────────
// По evaluation.md: единица — человек. Разница варианта и опоры по человеку d_u, итог — взвешенное среднее Σ w·d / Σ w с тем же
// весом, что у меры в таблице (AUC по парам — любимых×нелюбимых, AUC по людям — 1, hit@K — число любимых, hit Штека — Σ весов
// его любимых), поэтому Δ ровно равна разнице чисел в таблицах. Бутстреп — люди с возвращением (общие для всех вариантов
// выборки), перестановка — смена знака d_u (p = (1 + #|ср.| ≥ |набл.|) / (1 + повторов)), поправка БИ — по вариантам в
// каждом столбце отдельно. Человек — who: две истории одного человека в бутстрепе и перестановке идут вместе (кластер).
// σ — разброс по людям средней (без весов) d_u его историй; различимо (α 0,05, мощность 0,8) δ ≈ 2,8·σ/√n.
interface Metric { key: string; title: string; pp: boolean; val: (r: PersonMeasure, u: number) => [number, number] | undefined }
interface Paired { delta: number; lo: number; hi: number; p: number; q?: number; sd: number; n: number }
/** вес Штека s_i = 1 / max(1, N_i)^(γ/(γ+1)), N_i — сколько людей оценили фильм («все смотрят», без самого человека) */
const steckW = (n: number, g: number) => 1 / Math.max(1, n) ** (g / (g + 1));
/** hit@K человека с весом Штека: [Σ s·попал / Σ s, Σ s]; γ = 0 — обычный hit@K */
function hitW(r: PersonMeasure, lp: number[], k: number, g: number): [number, number] | undefined {
  if (!r.liked) return undefined;
  let s = 0, h = 0;
  r.best.forEach((b, j) => { const w = steckW(lp[j], g); s += w; if (b < k) h += w; });
  return [h / s, s];
}
/** Б–И: q_(i) = min_{j ≥ i} p_(j)·m·c(m)/j, c(m) = Σ 1/k */
function by(ps: number[]): number[] {
  const m = ps.length, c = Array.from({ length: m }, (_, k) => 1 / (k + 1)).reduce((a, b) => a + b, 0);
  const order = ps.map((_, i) => i).sort((a, b) => ps[a] - ps[b]), q = new Array<number>(m);
  let run = 1;
  for (let j = m - 1; j >= 0; j--) { run = Math.min(run, (ps[order[j]] * m * c) / (j + 1)); q[order[j]] = Math.min(1, run); }
  return q;
}
/** cl — номер человека (who) у каждой истории; выборки бутстрепа и знаки — общие для всех вариантов */
function makePaired(cl: Int32Array, B: number, seed: number) {
  const n = cl.length, C = Math.max(-1, ...cl) + 1;
  const rb = rng(`boot:${seed}`), rp = rng(`perm:${seed}`);
  const IDX = Int32Array.from({ length: B * C }, () => Math.floor(rb() * C)), SGN = Uint8Array.from({ length: B * C }, () => (rp() < 0.5 ? 1 : 0));
  const stat = new Float64Array(B), A = new Float64Array(C), Bc = new Float64Array(C), Dm = new Float64Array(C), Dn = new Int32Array(C);
  return (ref: PersonMeasure[], v: PersonMeasure[], m: Metric): Paired | undefined => {
    A.fill(0); Bc.fill(0); Dm.fill(0); Dn.fill(0);
    let sw = 0, swd = 0;
    for (let u = 0; u < n; u++) {
      const a = m.val(v[u], u), b = m.val(ref[u], u);
      if (!a || !b || !(b[1] > 0)) continue;
      const d = a[0] - b[0], c = cl[u];
      A[c] += b[1]; Bc[c] += b[1] * d; Dm[c] += d; Dn[c]++; sw += b[1]; swd += b[1] * d;
    }
    let cnt = 0, s1 = 0, s2 = 0;
    for (let c = 0; c < C; c++) if (Dn[c]) { const x = Dm[c] / Dn[c]; cnt++; s1 += x; s2 += x * x; }
    if (!sw || cnt < 2) return undefined;
    const obs = swd / sw;
    for (let k = 0; k < B; k++) { let a = 0, b = 0; for (let j = 0; j < C; j++) { const c = IDX[k * C + j]; a += A[c]; b += Bc[c]; } stat[k] = a ? b / a : obs; }
    const sorted = Float64Array.from(stat).sort();
    let hits = 0;
    for (let k = 0; k < B; k++) { let b = 0; for (let c = 0; c < C; c++) b += (SGN[k * C + c] ? -1 : 1) * Bc[c]; if (Math.abs(b) >= Math.abs(swd) - 1e-12) hits++; }
    const sm = s1 / cnt;
    return { delta: obs, lo: sorted[Math.floor(0.025 * B)], hi: sorted[Math.min(B - 1, Math.ceil(0.975 * B) - 1)], p: (1 + hits) / (1 + B), sd: Math.sqrt(Math.max(0, (s2 - cnt * sm * sm) / (cnt - 1))), n: cnt };
  };
}
/** корзины по «все смотрят»: порог головы — доля пула с popular ≥ h ближе всего к 20%, хвоста — с popular ≤ t ближе всего к 50% */
function bucketCuts(people: Person[]): { head: number; tail: number; share: number[] } {
  const cnt = new Map<number, number>(); let tot = 0;
  for (const p of people) for (const x of get(p, 'popular')) { const v = Number.isNaN(x) ? 0 : x; cnt.set(v, (cnt.get(v) ?? 0) + 1); tot++; }
  const vals = [...cnt.keys()].sort((a, b) => a - b);
  let below = 0, tail = vals[0], bestT = Infinity;
  for (const v of vals) { below += cnt.get(v)!; if (Math.abs(below / tot - 0.5) < bestT) { bestT = Math.abs(below / tot - 0.5); tail = v; } }
  let above = 0, head = vals[vals.length - 1], bestH = Infinity;
  for (const v of [...vals].reverse()) { if (v <= tail) break; above += cnt.get(v)!; if (Math.abs(above / tot - 0.2) < bestH) { bestH = Math.abs(above / tot - 0.2); head = v; } }
  let h = 0, t = 0; for (const [v, c] of cnt) { if (v >= head) h += c; else if (v <= tail) t += c; }
  return { head, tail, share: [h / tot, 1 - h / tot - t / tot, t / tot] };
}
const bucketOf = (x: number, c: { head: number; tail: number }) => (x >= c.head ? 0 : x <= c.tail ? 2 : 1);
const BUCKETS = ['голова', 'середина', 'хвост'];
interface Discovery { novelty?: number; loud?: number; coverage: number; gini: number; beyondPop?: number; beyondShare?: number }
/** меры открытий по первым k: новизна −log2((N+1)/(людей+1)) (людей — не меньше max N + 1), доля громких, охват (разных фильмов в первых k у всех / фильмов
 *  во всех пулах), Джини по числу показов (фильмы всех пулов, нули тоже), спрятанное любимое в первых k, которого нет в первых k
 *  у «все смотрят» */
function discovery(people: Person[], rows: PersonMeasure[], k: number, popBest?: number[][]): Discovery {
  const shows = new Map<number, number>(), all = new Set<number>();
  let nov = 0, loud = 0, m = 0, beyond = 0, liked = 0;
  const hasPop = people[0].col.has('popular'), hasLoud = people[0].col.has('loud');
  const P = Math.max(people.length, ...people.map((p) => (hasPop ? get(p, 'popular').reduce((a, x) => (x > a ? x : a), 0) + 1 : 0))) + 1;
  people.forEach((p, u) => {
    for (const key of p.keys) all.add(key);
    const pop = hasPop ? get(p, 'popular') : undefined, ld = hasLoud ? get(p, 'loud') : undefined;
    for (const i of rows[u].top.subarray(0, k)) {
      if (i < 0) continue;
      m++; shows.set(p.keys[i], (shows.get(p.keys[i]) ?? 0) + 1);
      if (pop) nov += -Math.log2(((Number.isNaN(pop[i]) ? 0 : pop[i]) + 1) / P);
      if (ld) loud += ld[i] >= 1 ? 1 : 0;
    }
    liked += rows[u].liked;
    if (popBest) rows[u].best.forEach((b, j) => { if (b < k && popBest[u][j] >= k) beyond++; });
  });
  const c = [...shows.values()].sort((a, b) => a - b), n = all.size, z = n - c.length, sum = c.reduce((a, b) => a + b, 0);
  let g = 0; c.forEach((x, j) => { g += (2 * (z + j + 1) - n - 1) * x; });
  return { ...(hasPop ? { novelty: nov / m } : {}), ...(hasLoud ? { loud: loud / m } : {}), coverage: shows.size / n, gini: sum ? g / (n * sum) : 0,
    ...(popBest ? { beyondPop: beyond, beyondShare: liked ? beyond / liked : 0 } : {}) };
}

// ─── свод отчётов по семенам (--merge) ─────────────────────────────────────────
interface HonestCand { name: string; summary: Summary; steck?: Record<string, number[]>; buckets?: Record<string, number[]>; discovery: Record<string, Discovery>; vs: Record<string, Record<string, Paired>> }
interface HonestOut { boot: number; seed: number; holdout?: DumpFile['holdout']; refs: Record<string, string>; metrics: { key: string; title: string; pp: boolean }[]; cuts?: ReturnType<typeof bucketCuts>; cands: HonestCand[] }
if (opt('--merge')) {
  const files = opt('--merge')!.split(',').filter(Boolean);
  const reps = files.map((f) => { const j = JSON.parse(readFileSync(f, 'utf8')) as { dump: string; honest?: HonestOut }; if (!j.honest) throw new Error(`${f}: нет honest (прогон с --plain или старый отчёт)`); return { f, dump: j.dump, h: j.honest }; });
  const names = reps[0].h.cands.map((c) => c.name).filter((nm) => reps.every((r) => r.h.cands.some((c) => c.name === nm)));
  const at = (r: typeof reps[0], nm: string) => r.h.cands.find((c) => c.name === nm)!;
  const ms = (xs: (number | undefined)[]) => { const v = xs.filter((x): x is number => x != null && Number.isFinite(x)); if (!v.length) return undefined; const m = v.reduce((a, b) => a + b, 0) / v.length; return { m, sd: v.length > 1 ? Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (v.length - 1)) : 0 }; };
  const f = (x: ReturnType<typeof ms>, pp = false, sign = false) => x == null ? '—' : pp ? `${sign && x.m >= 0 ? '+' : ''}${(x.m * 100).toFixed(1)} ± ${(x.sd * 100).toFixed(1)}` : `${sign && x.m >= 0 ? '+' : ''}${x.m.toFixed(3)} ± ${x.sd.toFixed(3)}`;
  const metrics = reps[0].h.metrics, R = reps.length;
  const md: string[] = [`# Свод честных мер по ${R} выгрузкам — ${new Date().toISOString().slice(0, 10)}`, '',
    'Выгрузки (разные семена разбиения):', '', ...reps.map((r) => `- ${r.dump} — разбиение ${JSON.stringify(r.h.holdout ?? {})}, отчёт ${r.f}`), '',
    ...(new Set(reps.map((r) => JSON.stringify(r.h.holdout ?? {}))).size < R ? ['ВНИМАНИЕ: у части отчётов одно и то же разбиение — разброс ниже показывает только случайность обучения и бутстрепа, не разбиения.', ''] : []),
    `Среднее ± разброс (выборочное σ) по выгрузкам; hit — в пп. «значимо» — в скольких выгрузках q(БИ) < 0,05 (+ лучше опоры / − хуже). Варианты — только те, что есть во всех ${R}.`, '',
    '## Меры', '', '| вариант | AUC по парам | AUC по людям | ' + KS.map((k) => `hit@${k}, пп`).join(' | ') + ' | hit@150 Штек γ=1, пп | hit@150 хвост, пп | новизна@6 | громких@6 | охват@50 |', `|---|---|---|${KS.map(() => '---').join('|')}|---|---|---|---|---|`,
    ...names.map((nm) => { const c = reps.map((r) => at(r, nm));
      return `| ${nm} | ${f(ms(c.map((x) => x.summary.auc)))} | ${f(ms(c.map((x) => x.summary.aucPerPerson)))} | ${KS.map((_, i) => f(ms(c.map((x) => x.summary.hit[i])), true)).join(' | ')} | ${f(ms(c.map((x) => x.steck?.['150']?.[GAMMAS.indexOf(1)])), true)} | ${f(ms(c.map((x) => x.buckets?.['150']?.[2])), true)} | ${f(ms(c.map((x) => x.discovery['6']?.novelty)))} | ${f(ms(c.map((x) => x.discovery['6']?.loud)), true)} | ${f(ms(c.map((x) => x.discovery['50']?.coverage)), true)} |`; }), ''];
  for (const ref of ['base', 'best']) {
    const refNames = [...new Set(reps.map((r) => r.h.refs[ref]).filter(Boolean))];
    if (!refNames.length) continue;
    md.push(`## Δ к ${ref === 'base' ? 'base' : 'лучшему ручному'} (${refNames.join(' / ')})`, '', `| вариант | ${metrics.map((m) => `${m.title}: Δ${m.pp ? ', пп' : ''}, значимо`).join(' | ')} |`, `|---|${metrics.map(() => '---').join('|')}|`);
    for (const nm of names) {
      const v = reps.map((r) => at(r, nm).vs[ref]);
      if (v.every((x) => !x || !Object.keys(x).length)) continue;
      md.push(`| ${nm} | ${metrics.map((m) => { const xs = v.map((x) => x?.[m.key]); const up = xs.filter((x) => x?.q != null && x.q < 0.05 && x.delta > 0).length, dn = xs.filter((x) => x?.q != null && x.q < 0.05 && x.delta < 0).length;
        return `${f(ms(xs.map((x) => x?.delta)), m.pp, true)}, ${up ? `+${up}` : ''}${up && dn ? ' ' : ''}${dn ? `−${dn}` : ''}${!up && !dn ? '0' : ''}/${R}`; }).join(' | ')} |`);
    }
    md.push('');
  }
  md.push('## σ разниц к base по людям (среднее по выгрузкам) и различимый прирост δ ≈ 2,8·σ/√n', '', `| вариант | ${metrics.map((m) => `${m.title}: σ / δ`).join(' | ')} |`, `|---|${metrics.map(() => '---').join('|')}|`,
    ...names.filter((nm) => reps.some((r) => Object.keys(at(r, nm).vs.base ?? {}).length)).map((nm) => `| ${nm} | ${metrics.map((m) => { const xs = reps.map((r) => at(r, nm).vs.base?.[m.key]).filter((x): x is Paired => !!x); const sd = ms(xs.map((x) => x.sd)), n = ms(xs.map((x) => x.n));
      return sd && n ? `${(sd.m * (m.pp ? 100 : 1)).toFixed(m.pp ? 1 : 3)} / ${(2.8 * sd.m / Math.sqrt(n.m) * (m.pp ? 100 : 1)).toFixed(m.pp ? 1 : 3)}` : '—'; }).join(' | ')} |`), '');
  mkdirSync(OUT, { recursive: true });
  const file = `${OUT}/tune-${new Date().toISOString().slice(0, 10)}-${opt('--tag') ?? 'merged'}`;
  writeFileSync(`${file}.md`, `${md.join('\n')}\n`);
  console.log(md.join('\n'));
  console.error(`свод: ${file}.md`);
  process.exit(0);
}

// ─── прогон ────────────────────────────────────────────────────────────────────
if (!statSync(DIR, { throwIfNoEntry: false })?.isDirectory()) { console.error(`нет выгрузки: ${DIR} (tools/taste-dump.mts --tag ${DUMP})`); process.exit(1); }
const t0 = Date.now();
const { people, feats, skipped, holdout } = load(DIR);
console.error(`выгрузка ${DIR}: людей ${people.length}${skipped.length ? `, пропущено ${skipped.length} (ok: false)` : ''}, частей ${feats.length}, пул ~${Math.round(mean(people.map((p) => p.n)) ?? 0)} · ${((Date.now() - t0) / 1000).toFixed(1)} с`);
if (!people.length) process.exit(1);

const check = feats.includes('full') ? checkBase(people, feats) : undefined;
let base = BASE, baseNote = 'столбца full нет — base не сверен';
if (check) {
  const from = people.some((x) => x.base) ? `веса из sum выгрузки, ${[...new Set(people.map((x) => JSON.stringify(x.base ?? BASE)))].join(' / ')}` : 'веса BASE';
  if (check.maxErr < 1e-6) baseNote = `base = full: сумма частей (${from}) совпала со столбцом full (расхождение до ${check.maxErr.toExponential(1)})`;
  else if (check.fitErr != null && check.fitErr < 1e-6) {
    base = check.fitted!;
    baseNote = `ВНИМАНИЕ: сумма с весами ленты ≠ full (до ${check.maxErr.toFixed(4)}); full = ${JSON.stringify(check.fitted)} точно (до ${check.fitErr.toExponential(1)}) — base взят из подбора, поправить BASE`;
  } else baseNote = `ВНИМАНИЕ: сумма с весами ленты ≠ full (до ${check.maxErr.toFixed(4)}), и линейно по частям full не собирается (МНК ${JSON.stringify(check.fitted)}, остаток до ${check.fitErr?.toFixed(4)}) — части выгружены не так, как ждёт тюнер`;
}
console.error(baseNote);

// варианты: встроенные + из файла
let mine: Variant[] = [];
if (VARIANTS) {
  if (VARIANTS.endsWith('.json')) mine = JSON.parse(readFileSync(VARIANTS, 'utf8')) as Variant[];
  else { const m = await import(pathToFileURL(resolve(VARIANTS)).href) as { default?: Variant[]; variants?: Variant[] }; mine = m.variants ?? m.default ?? []; }
}
const results: { name: string; sum: Summary; rows?: PersonMeasure[]; note?: string }[] = [];
const t1 = Date.now();
for (const v of [...builtins(feats), ...mine]) results.push({ name: v.name, ...runVariant(people, v, base) });
if (feats.includes('popular') && feats.includes('neighbors')) results.splice(results.length - mine.length, 0, { name: 'модель + соседи (места)', ...modelNeighbors(people, base) });
console.error(`вариантов ${results.length} · ${((Date.now() - t1) / 1000).toFixed(1)} с`);

// обучение
const FEATS = (() => {
  const all = feats.filter((f) => f !== 'full');
  const spec = opt('--feats') ?? 'all';
  const drop = new Set((opt('--drop') ?? '').split(',').filter(Boolean));
  const list = spec === 'all' ? all : spec === 'feed' ? all.filter((f) => FEED.has(f)) : spec.split(',');
  for (const f of list) if (!feats.includes(f)) throw new Error(`нет части ${f}`);
  return list.filter((f) => !drop.has(f));
})();
interface TrainOut { target: Target; goal: Goal; folds: { people: number; sum: Summary; iters: number; pairs: number }[]; oof: Summary; foldMean: Summary; all: Trained; raw: Record<string, number>; oofRows: PersonMeasure[] }
const trained: TrainOut[] = [];
for (const spec of TRAIN) {
  const goal = goalOf(spec), target = goal.target;
  if (goal.gamma != null || goal.negpow != null) { if (!feats.includes('popular')) throw new Error(`цель ${goal.name}: в выгрузке нет popular`); }
  const parts = folds(people, FOLDS), oofRows: PersonMeasure[] = [], fo: TrainOut['folds'] = [];
  for (let f = 0; f < parts.length; f++) {
    const test = parts[f]; if (!test.length) continue;
    const tr = people.filter((p) => !test.includes(p));
    const t = train(tr, FEATS, goal);
    const rows = test.map((p) => measure(p, scoreTrained(p, t)));
    oofRows.push(...rows);
    fo.push({ people: test.length, sum: summarize(rows), iters: t.iters, pairs: t.pairs });
    console.error(`обучение ${goal.name}, часть ${f + 1}/${parts.length}: учились на ${tr.length}, мерим на ${test.length}, пар ${t.pairs}, шагов ${t.iters} · AUC ${summarize(rows).auc?.toFixed(3)} · ${((Date.now() - t1) / 1000).toFixed(0)} с`);
  }
  const ms = (pick: (s: Summary) => number | undefined) => mean(fo.map((x) => pick(x.sum)));
  const foldMean: Summary = { people: people.length, liked: 0, disliked: 0, auc: ms((s) => s.auc), aucPerPerson: ms((s) => s.aucPerPerson),
    hit: KS.map((_, i) => ms((s) => s.hit[i]) ?? 0), random: summarize(oofRows).random };
  const all = train(people, FEATS, goal);
  trained.push({ target, goal, folds: fo, oof: summarize(oofRows), foldMean, all, raw: rawWeights(all), oofRows });
}

// ─── итог ──────────────────────────────────────────────────────────────────────
const day = new Date().toISOString().slice(0, 10);
const p = (x?: number) => (x == null ? '—' : `${(x * 100).toFixed(0)}%`);
const a = (x?: number) => (x == null ? '—' : x.toFixed(3));
const n4 = (x: number) => (Math.abs(x) < 5e-5 ? '0' : Math.abs(x) >= 100 ? x.toFixed(1) : x.toPrecision(3));
const line = (name: string, s: Summary) => `| ${name} | ${a(s.auc)} | ${a(s.aucPerPerson)} | ${s.hit.map(p).join(' | ')} |`;
const head = ['| вариант | AUC по всем парам | AUC среднее по людям | ' + KS.map((k) => `hit@${k}`).join(' | ') + ' |', `|---|---|---|${KS.map(() => '---').join('|')}|`];
const s0 = results[0].sum;
const feedBase = people[0].base ?? base;
/** обученные веса в шкале ленты: content = 1, если он есть и положителен; иначе — разброс счёта как у full */
function feedWeights(t: TrainOut): { w: Record<string, number>; scale: string; shift?: number } {
  let k: number, scale: string;
  if ((t.raw.content ?? 0) > 0) { k = 1 / t.raw.content; scale = 'content = 1'; }
  else {
    const sdOf = (xs: Float64Array) => { const m = xs.reduce((a, b) => a + b, 0) / xs.length; return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length); };
    const ratio = mean(people.map((pp) => feats.includes('full') ? sdOf(get(pp, 'full')) / (sdOf(scoreTrained(pp, t.all)) || 1) : undefined));
    k = ratio ?? 1; scale = feats.includes('full') ? 'разброс счёта как у full' : 'как обучено';
  }
  const w = Object.fromEntries(Object.entries(t.raw).map(([c, x]) => [c, x * k]));
  // сдвиг к порогу ленты 0,3: чтобы над ним осталось столько же пула, сколько сейчас у full
  let shift: number | undefined;
  if (feats.includes('full')) {
    const above: number[] = [], sc: number[] = [];
    for (const pp of people) {
      const full = get(pp, 'full'); let m = 0; for (const x of full) if (x > 0.3) m++; above.push(m / pp.n);
      const s = scoreVariant(pp, { name: '', from: 'zero', weights: Object.fromEntries(Object.entries(w).filter(([c]) => !c.endsWith('∅'))), missing: Object.fromEntries(Object.entries(w).filter(([c]) => c.endsWith('∅')).map(([c, x]) => [c.slice(0, -1), x])) }, {});
      const sorted = [...s].sort((x, y) => y - x); sc.push(0.3 - sorted[Math.min(sorted.length - 1, Math.floor((m / pp.n) * sorted.length))]);
    }
    shift = [...sc].sort((x, y) => x - y)[Math.floor(sc.length / 2)];
  }
  return { w, scale, shift };
}
/** что у цели не как у b (23.10): пустая строка у a и b */
const goalNote = (g: Goal) => g.target === 'a' || g.target === 'b' ? ''
  : g.target === 'd' ? `; потеря = ${g.mix}·(средняя по парам a) + ${+(1 - g.mix!).toFixed(6)}·(средняя по парам b), у b на каждое любимое ${NEG} случайных строк пула`
  : `, на каждое любимое ${NEG} строк пула ${g.negpow != null ? `∝ (popular+1)^${g.negpow}` : 'случайно'}, вес пары ${g.gamma != null ? `по Штеку 1/max(1,N)^(γ/(γ+1)), γ = ${g.gamma}` : '1'}`;
const md: string[] = [
  `# Перебор и обучение весов — ${day} · выгрузка ${DUMP}`, '',
  `Людей ${s0.people}, спрятано любимых ${s0.liked} и нелюбимых ${s0.disliked}, пул ~${Math.round(mean(people.map((x) => x.n)) ?? 0)}.${skipped.length ? ` Пропущено (ok: false): ${skipped.length}.` : ''}`, '',
  `Проверка: ${baseNote}.`, '',
  `## Варианты`, '', ...head,
  ...results.map((r) => line(r.name, r.sum)),
  `| наугад | 0.500 | 0.500 | ${s0.random.map(p).join(' | ')} |`, '',
];
if (mine.length) md.push('Варианты из файла:', '', '```json', ...mine.map((v) => JSON.stringify({ ...v, score: v.score ? '(функция)' : undefined })), '```', '');
for (const t of trained) {
  const fw = feedWeights(t);
  const g = t.goal, st = t.all.stat;
  md.push(`## Обучение ${g.name}: ${g.title}`, '',
    `Парное ранжирование, ${FOLDS} частей по людям (who), L2 = ${L2}${t.target === 'b' ? `, на каждое любимое ${NEG} случайных строк пула` : ''}${goalNote(g)}; признаки: ${FEATS.join(', ')}.`, '',
    ...(st ? [`Известность сторон пар (обучение на всех): средний log2(N+1) любимых ${st.pos.toFixed(2)} (с весами пар ${st.posW.toFixed(2)}), негативов ${st.neg.toFixed(2)} — чем ближе, тем меньше «громкость» сама отделяет пары.`, ''] : []),
    ...head, line('base (веса ленты)', s0), line('обучено, на чужих частях (все люди вместе)', t.oof), line(`обучено, среднее по ${t.folds.length} частям`, t.foldMean), '',
    '| часть | людей | пар | шагов | AUC по парам | AUC по людям | ' + KS.map((k) => `hit@${k}`).join(' | ') + ' |', `|---|---|---|---|---|---|${KS.map(() => '---').join('|')}|`,
    ...t.folds.map((f, i) => `| ${i + 1} | ${f.people} | ${f.pairs} | ${f.iters} | ${a(f.sum.auc)} | ${a(f.sum.aucPerPerson)} | ${f.sum.hit.map(p).join(' | ')} |`), '',
    `Веса, обученные на всех (${t.all.pairs} пар, шагов ${t.all.iters}): стандартизованный — вклад части на один её разброс; «в ленте» — шкала ${fw.scale}.`, '',
    '| признак | стандартизованный | на сырую часть | в ленте (шкала) | в ленте сейчас | где в fullScore |', '|---|---|---|---|---|---|',
    ...t.all.D.cols.map((c, j) => {
      const f = c.replace(/∅$/, ''), miss = c.endsWith('∅');
      const where = miss ? `нет значения: + w (сейчас ${f} ?? 0)` : FEED.has(f) ? (IN_FEED[f] ?? '—') : 'в ленте нет (только замер)';
      return `| ${c} | ${n4(t.all.w[j])} | ${n4(t.raw[c])} | ${n4(fw.w[c])} | ${miss ? '0' : n4(feedBase[f] ?? 0)} | ${where} |`;
    }), '',
    'Что поменять в fullScore (src/lib/model/recommend.ts), если включать — за флагом в experiments.ts; ленту этот прогон не трогал:', '', '```ts',
    `// taste-tune ${day}, цель ${g.name} (${g.title}), шкала ${fw.scale}${fw.shift != null ? `; сдвиг к порогу 0.3 (столько же пула над ним, как у full): ${fw.shift >= 0 ? '+' : ''}${fw.shift.toFixed(3)}` : ''}`,
    'return ' + t.all.D.cols.filter((c) => FEED.has(c.replace(/∅$/, ''))).map((c) => {
      const f = c.replace(/∅$/, ''), x = fw.w[c];
      const term = c.endsWith('∅') ? `(${MISSING_IN_FEED[f] ?? `${f} == null`} ? 1 : 0)` : IN_FEED[f]?.replace(/\s*\/\/.*$/, '') ?? f;
      return `${x < 0 ? '- ' : '+ '}${n4(Math.abs(x))} * ${term}`;
    }).join('\n  ').replace(/^\+ /, '') + ';',
    ...(t.all.D.cols.some((c) => !FEED.has(c.replace(/∅$/, ''))) ? [`// без проводки в ленту (только замер): ${t.all.D.cols.filter((c) => !FEED.has(c.replace(/∅$/, ''))).map((c) => `${c} ${n4(fw.w[c])}`).join(', ')} — для ленты учить с --feats feed`] : []),
    '```', '',
    'Как вариант для --variants (сырые веса, проверить перебором):', '', '```json',
    JSON.stringify({ name: `обучено ${g.name}`, from: 'zero', weights: Object.fromEntries(Object.entries(t.raw).filter(([c]) => !c.endsWith('∅')).map(([c, x]) => [c, +x.toPrecision(4)])),
      missing: Object.fromEntries(Object.entries(t.raw).filter(([c]) => c.endsWith('∅')).map(([c, x]) => [c.slice(0, -1), +x.toPrecision(4)])) }), '```', '');
}
// честные меры (23.10): кандидаты — все варианты (кроме full — он равен base) и обученные на чужих частях
let honest: HonestOut | undefined;
if (HONEST) {
  const t2 = Date.now();
  const byName = (rows: PersonMeasure[]) => { const m = new Map(rows.map((r) => [r.name, r])); return people.map((pp) => m.get(pp.name)!); };
  const cands = [...results.filter((r) => !r.name.startsWith('full')).map((r) => ({ name: r.name, rows: r.rows!, sum: r.sum, manual: mine.some((v) => v.name === r.name) })),
    ...trained.map((t) => ({ name: `обучено ${t.goal.name} (на чужих частях)`, rows: byName(t.oofRows), sum: t.oof, manual: false }))];
  const hasPop = feats.includes('popular');
  const lp = people.map((pp) => { const pop = hasPop ? get(pp, 'popular') : undefined; return pp.liked.map((g) => (pop && !Number.isNaN(pop[g.first]) ? pop[g.first] : 0)); });
  const ki = (k: number) => KS.indexOf(k);
  const metrics: Metric[] = [
    { key: 'aucPairs', title: 'AUC по парам', pp: false, val: (r) => (r.auc == null ? undefined : [r.auc, r.liked * r.disliked]) },
    { key: 'aucPerson', title: 'AUC по людям', pp: false, val: (r) => (r.auc == null ? undefined : [r.auc, 1]) },
    ...[50, 150].filter((k) => ki(k) >= 0).map((k) => ({ key: `hit${k}`, title: `hit@${k}`, pp: true, val: (r: PersonMeasure) => (r.liked ? [r.hit[ki(k)], r.liked] as [number, number] : undefined) })),
    ...(hasPop ? [{ key: 'steck150', title: 'hit@150 Штек γ=1', pp: true, val: (r: PersonMeasure, u: number) => hitW(r, lp[u], 150, 1) }] : []),
  ];
  const whoId = new Map<string, number>(), cl = Int32Array.from(people, (pp) => { let i = whoId.get(pp.who); if (i == null) whoId.set(pp.who, (i = whoId.size)); return i; });
  const pair = makePaired(cl, BOOT, SEED);
  const base0 = cands[0];
  const bestOpt = opt('--best');
  const best = bestOpt ? cands.find((c) => c.name === bestOpt) : [...cands.filter((c) => c.manual)].sort((x, y) => (y.sum.aucPerPerson ?? 0) - (x.sum.aucPerPerson ?? 0))[0];
  if (bestOpt && !best) throw new Error(`--best ${bestOpt}: нет такого варианта`);
  const vs: Record<string, Map<string, Record<string, Paired>>> = { base: new Map(), best: new Map() };
  for (const [ref, rc] of [['base', base0], ['best', best]] as const) {
    if (!rc) continue;
    const others = cands.filter((c) => c !== rc && !(ref === 'best' && c === base0));
    for (const m of metrics) {
      const res = others.map((c) => pair(rc.rows, c.rows, m));
      const q = by(res.map((x) => x?.p ?? 1));
      others.forEach((c, i) => { const x = res[i]; if (!x) return; x.q = q[i]; const o = vs[ref].get(c.name) ?? {}; o[m.key] = x; vs[ref].set(c.name, o); });
    }
  }
  const popRes = results.find((r) => r.name === '«что смотрят все»');
  const popBest = popRes?.rows!.map((r) => r.best);
  const cuts = hasPop ? bucketCuts(people) : undefined;
  const hk = [50, 150];
  const hc: HonestCand[] = cands.map((c) => {
    const steck = hasPop ? Object.fromEntries(hk.map((k) => [String(k), GAMMAS.map((g) => { let h = 0, s = 0; c.rows.forEach((r, u) => { const x = hitW(r, lp[u], k, g); if (x) { h += x[0] * x[1]; s += x[1]; } }); return s ? h / s : 0; })])) : undefined;
    const buckets = cuts ? Object.fromEntries(hk.map((k) => [String(k), BUCKETS.map((_, b) => { let h = 0, n = 0; c.rows.forEach((r, u) => r.best.forEach((x, j) => { if (bucketOf(lp[u][j], cuts) !== b) return; n++; if (x < k) h++; })); return n ? h / n : NaN; })])) : undefined;
    return { name: c.name, summary: c.sum, ...(steck ? { steck } : {}), ...(buckets ? { buckets } : {}),
      discovery: Object.fromEntries(KD.map((k) => [String(k), discovery(people, c.rows, k, popBest)])),
      vs: { base: vs.base.get(c.name) ?? {}, best: vs.best.get(c.name) ?? {} } };
  });
  const likedIn = cuts ? BUCKETS.map((_, b) => lp.reduce((a, xs) => a + xs.filter((x) => bucketOf(x, cuts) === b).length, 0)) : [];
  honest = { boot: BOOT, seed: SEED, holdout, refs: { base: base0.name, ...(best ? { best: best.name } : {}) }, metrics: metrics.map(({ key, title, pp }) => ({ key, title, pp })), ...(cuts ? { cuts } : {}), cands: hc };
  console.error(`честные меры: ${cands.length} вариантов, ${metrics.length} мер, бутстреп/перестановка ${BOOT} · ${((Date.now() - t2) / 1000).toFixed(1)} с`);

  // таблицы
  const sg = (x: number, pp: boolean) => `${x >= 0 ? '+' : '−'}${pp ? (Math.abs(x) * 100).toFixed(1) : Math.abs(x).toFixed(3)}`;
  const pv = (x: number) => (x < 0.001 ? '<0.001' : x.toFixed(3));
  const cell = (x?: Paired, pp = false) => (x ? `${x.q != null && x.q < 0.05 ? '**' : ''}${sg(x.delta, pp)} [${sg(x.lo, pp)}; ${sg(x.hi, pp)}]${x.q != null && x.q < 0.05 ? '**' : ''} p ${pv(x.p)} q ${pv(x.q ?? 1)}` : '—');
  const pp1 = (x?: number) => (x == null || Number.isNaN(x) ? '—' : `${(x * 100).toFixed(1)}%`);
  md.push(`## Честные меры (23.10)`, '',
    `По research_notes/Улучшение рекомендательного движка/evaluation.md. Единица — человек (who): людей ${whoId.size}, историй ${people.length}; истории одного человека в бутстрепе и перестановке идут вместе. Разбиение выгрузки: ${JSON.stringify(holdout ?? {})}.`,
    `Δ = взвешенное среднее разниц по людям с весом меры (AUC по парам — любимых×нелюбимых, по людям — 1, hit — число любимых, Штек — Σ весов), т. е. ровно разница чисел в таблицах; [интервал] — 95% бутстреп по людям (${BOOT} повторов), p — перестановка со сменой знака (${BOOT}), q — поправка Бенджамини–Иекутиели по вариантам в столбце; **жирным** — q < 0,05. hit — в процентных пунктах. «Обучено … (на чужих частях)» — меры на людях, на которых не учились.`, '');
  for (const ref of ['base', 'best'] as const) {
    const rc = ref === 'base' ? base0 : best; if (!rc) continue;
    md.push(`### Δ к ${ref === 'base' ? 'base' : `лучшему ручному: ${rc.name}`}`, '');
    if (ref === 'best') md.push(`Лучший ручной — ${bestOpt ? 'задан --best' : 'вариант из файла с лучшим AUC по людям'}; выбран на тех же людях, поэтому его собственный перевес над base завышен (проклятие победителя), а разницы с ним — осторожная оценка.`, '');
    md.push(`| вариант | ${metrics.map((m) => `${m.title}${m.pp ? ', пп' : ''}`).join(' | ')} |`, `|---|${metrics.map(() => '---').join('|')}|`,
      ...hc.filter((c) => Object.keys(c.vs[ref]).length).map((c) => `| ${c.name} | ${metrics.map((m) => cell(c.vs[ref][m.key], m.pp)).join(' | ')} |`), '');
  }
  const sds = (k: string) => hc.map((c) => c.vs.base[k]).filter((x): x is Paired => !!x && x.sd > 0);
  md.push('### σ разниц с base по людям и различимый прирост', '',
    `n ≈ (2,8·σ/δ)² (двусторонний α 0,05, мощность 0,8): на ${whoId.size} людях различим прирост δ ≈ 2,8·σ/√n. σ — разброс по людям разницы (среднее по его историям, без весов; для hit и AUC по парам это приближение: в таблице Δ взвешена).`, '',
    `| вариант | ${metrics.map((m) => `${m.title}: σ → δ${m.pp ? ', пп' : ''}`).join(' | ')} |`, `|---|${metrics.map(() => '---').join('|')}|`,
    ...hc.filter((c) => Object.keys(c.vs.base).length).map((c) => `| ${c.name} | ${metrics.map((m) => { const x = c.vs.base[m.key]; const k = m.pp ? 100 : 1, dg = m.pp ? 1 : 3; return x ? `${(x.sd * k).toFixed(dg)} → ${(2.8 * x.sd / Math.sqrt(x.n) * k).toFixed(dg)}` : '—'; }).join(' | ')} |`), '',
    ...metrics.map((m) => { const xs = sds(m.key).map((x) => x.sd).sort((a, b) => a - b); if (!xs.length) return ''; const med = xs[Math.floor(xs.length / 2)], n = sds(m.key)[0].n, k = m.pp ? 100 : 1, dg = m.pp ? 1 : 3;
      const ds = m.pp ? [0.005, 0.01, 0.02] : [0.01, 0.02, 0.03];
      return `- ${m.title}: σ медиана ${(med * k).toFixed(dg)} (от ${(xs[0] * k).toFixed(dg)} до ${(xs[xs.length - 1] * k).toFixed(dg)}), на ${n} людях различимо ≈ ${(2.8 * med / Math.sqrt(n) * k).toFixed(dg)}${m.pp ? ' пп' : ''}; людей нужно для ${ds.map((d) => `${m.pp ? `${d * 100} пп` : d} — ${Math.ceil((2.8 * med / d) ** 2)}`).join(', ')}`; }).filter(Boolean), '');
  if (hasPop) {
    md.push('### hit@K с поправкой на популярность (Штек)', '',
      `Вес спрятанного любимого s_i = 1 / max(1, N_i)^(γ/(γ+1)), N_i — сколько других людей оценили фильм (столбец popular); hit = Σ s·попал / Σ s по всем любимым всех людей вместе (как hit в таблице вариантов: γ = 0 — ровно он). γ = 0 — любимое пропущено наугад, γ > 0 — популярное легче попадает в оценки, его попадание весит меньше. Если «все смотрят» выигрывает при γ = 0 и проигрывает при γ ≥ 0,5 — его перевес в засветке, не во вкусе.`, '',
      `| вариант | ${hk.flatMap((k) => GAMMAS.map((g) => `@${k} γ=${g}`)).join(' | ')} |`, `|---|${hk.flatMap(() => GAMMAS.map(() => '---')).join('|')}|`,
      ...hc.map((c) => `| ${c.name} | ${hk.flatMap((k) => c.steck![String(k)].map(pp1)).join(' | ')} |`), '');
  }
  if (cuts) {
    md.push('### hit@K по корзинам популярности', '',
      `Корзины по popular строки пула (все пулы всех людей вместе; у равных значений порог не режет): голова — popular ≥ ${cuts.head} (${pp1(cuts.share[0])} строк пула, цель 20%), хвост — popular ≤ ${cuts.tail} (${pp1(cuts.share[2])}, цель 50%), середина — между (${pp1(cuts.share[1])}). Порог — то значение, при котором доля ближе всего к цели (popular — целые, равных много, точно 20/30/50 не нарезать). Спрятанных любимых: голова ${likedIn[0]}, середина ${likedIn[1]}, хвост ${likedIn[2]} (в голове ${pp1(likedIn[0] / (likedIn[0] + likedIn[1] + likedIn[2] || 1))}: просмотренное другими чаще просмотрено и тобой). hit по корзине — доля её любимых в первых K всего пула.`, '',
      `| вариант | ${hk.flatMap((k) => BUCKETS.map((b) => `@${k} ${b}`)).join(' | ')} |`, `|---|${hk.flatMap(() => BUCKETS.map(() => '---')).join('|')}|`,
      ...hc.map((c) => `| ${c.name} | ${hk.flatMap((k) => c.buckets![String(k)].map(pp1)).join(' | ')} |`), '');
  }
  md.push('### Открытия: первые 6 и 50', '',
    `Новизна — среднее −log2((N+1)/(людей+1)) по фильмам в первых k (N — popular; больше — малоизвестнее; у фильма, которого никто не оценил, ${(-Math.log2(1 / (people.length + 1))).toFixed(2)}). Громких — доля loud = 1. Охват — разных фильмов в первых k у всех людей / фильмов во всех пулах (${KEY.size}). Джини — по числу показов фильмов всех пулов (0 — поровну, 1 — всем одно). Сверх «все смотрят» — спрятанных любимых в первых k варианта, которых нет в первых k у «что смотрят все» (сколько и доля от всех любимых).`, '',
    `| вариант | ${KD.flatMap((k) => [`новизна@${k}`, `громких@${k}`, `охват@${k}`, `Джини@${k}`, `сверх «все смотрят»@${k}`]).join(' | ')} |`, `|---|${KD.flatMap(() => ['---', '---', '---', '---', '---']).join('|')}|`,
    ...hc.map((c) => `| ${c.name} | ${KD.flatMap((k) => { const d = c.discovery[String(k)]; return [d.novelty?.toFixed(2) ?? '—', pp1(d.loud), pp1(d.coverage), d.gini.toFixed(3), d.beyondPop == null ? '—' : `${d.beyondPop} (${pp1(d.beyondShare)})`]; }).join(' | ')} |`), '');
  console.log(['', `Δ к base (AUC по людям; hit@150, пп):`, ...hc.filter((c) => c.vs.base.aucPerson).map((c) => `  ${c.name}: ${cell(c.vs.base.aucPerson)} · ${cell(c.vs.base.hit150, true)}`)].join('\n'));
}
md.push(`## По людям (AUC)`, '', `| история | в пуле | любимых / нелюбимых | ${results.map((r) => r.name).join(' | ')} |`, `|---|---|---|${results.map(() => '---').join('|')}|`,
  ...results[0].rows!.map((r, i) => `| ${r.name} | ${r.pool} | ${r.liked} / ${r.disliked} | ${results.map((x) => a(x.rows![i].auc)).join(' | ')} |`));
mkdirSync(OUT, { recursive: true });
const file = `${OUT}/tune-${day}${TAG ? `-${TAG}` : ''}`;
writeFileSync(`${file}.md`, `${md.join('\n')}\n`);
writeFileSync(`${file}.json`, JSON.stringify({ at: new Date().toISOString(), dump: DIR, base, baseNote, check,
  variants: results.map((r) => ({ name: r.name, summary: r.sum })),
  trained: trained.map((t) => ({ target: t.target, ...(t.goal.name !== t.target ? { goal: t.goal, stat: t.all.stat } : {}), feats: FEATS, l2: L2, neg: NEG, folds: t.folds, oof: t.oof, foldMean: t.foldMean, cols: t.all.D.cols,
    std: Array.from(t.all.w), raw: t.raw, feed: feedWeights(t) })), ...(honest ? { honest } : {}) }, null, 1));
console.log([...md.slice(0, md.indexOf('## Варианты') + 5 + results.length), ...trained.flatMap((t) => [`обучение ${t.goal.name}: на чужих частях ${line('', t.oof)}`])].join('\n'));
console.error(`итог: ${file}.md · ${((Date.now() - t0) / 1000).toFixed(1)} с`);
