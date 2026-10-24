// EASE (23.10, Steck 2019, «Embarrassingly Shallow Autoencoders»): линейная модель «фильм → фильм» с закрытым решением,
// в открытых сравнениях — лучшая из простых на малых данных (research_notes/Улучшение рекомендательного движка/
// collaborative_filtering.md). Веса B = I − P·diag(1/P_jj), P = (XᵀX + λI)⁻¹, счёт человека — x·B. Обращать фильмы×фильмы
// (15 тыс.²) незачем: людей ~135, и по тождеству Вудбери P = (I − Xᵀ·K⁻¹·X)/λ, K = XXᵀ + λI (люди×люди). Тогда
//   s_j = x_j − (x_j − y_j)/d_j,  y = Xᵀ·K⁻¹·(X·x),  d_j = 1 − c_jᵀ·K⁻¹·c_j  (c_j — столбец фильма: кто его оценил),
// всё — проходы по ненулевым X, без плотных матриц: обучение — K⁻¹ (135³) и d (Σ по фильмам квадрата числа оценивших),
// счёт — проход по оценкам человека и по ненулевым X. Это точный EASE, не приближение.
// Матрица — три вида (`kind`): 'bin' — «оценил» (что человек посмотрит), 'like' — «оценил выше своей середины» (медианы
// своих z; медиана — высшая оценка — тогда высшие: что понравится), 'zw' — 1 + max(0, z) (оценил, любимое — тяжелее). Входной вектор человека — тем же правилом
// по его собственным оценкам. Для замера — обучение без одного человека (`skip`): его строки в X нет, K⁻¹ — на остальных.
// Наружу (клиенту) — только счёт фильма, и лишь по фильмам, которые оценили не меньше `minRaters` других: X — чужие
// истории, она живёт на сервере, как у соседей (worker/neighbors.ts). Сервер (24.10, worker/ease.ts, опыт `ease`) обращает K
// раз на набор, а спрашивающего вынимает из готовой модели (easeWithout — блочное обращение, тоже точно).
// Без импортов (как neighbors.ts): модуль может собирать и esbuild воркера.

export const EASE = {
  /** регуляризация: замер 23.10 (tools/dump-add-ease.mts --sweep, λ 10–1000) — плоско, 200 лучше всего у like, у bin ±0,3 п. */
  lambda: 200,
  /** фильм, который оценили меньше стольких (без самого человека), — без счёта (null): и шум, и личные данные */
  minRaters: 3,
  /** сервер (GET /api/ease): у участника меньше стольких оценок — счёта нет вовсе (источника нет, лента — LEARNED_B):
   *  веса LEARNED_E обучены на историях от 20 оценок, из которых видно 80% — не меньше 16 */
  minRated: 16,
  /** точность в ответе: счёт × scale, целым. Замер 24.10 на настоящих историях: |bin| — медиана 0,014, у 10% меньше 0,0012,
   *  вес в ленте ~11 — ошибка округления ≤ 0,0006 счёта ленты; при 1000 мелкие стали бы нулями, а выигрыш — 15% сжатого */
  scale: 10000,
};

export type EaseKind = 'bin' | 'like' | 'zw';
/** фильм в истории: его ключи (consensusKeys — первым TMDb) и z-оценка в шкале человека */
export interface EaseFilm { keys: string[]; z: number }

export interface EaseData {
  kind: EaseKind;
  /** фильм → первый ключ; index — любой ключ фильма → номер */
  keys: string[]; index: Map<string, number>;
  /** люди (строки X) и их ненулевые: номера фильмов по возрастанию и значения */
  who: string[]; rows: { i: Int32Array; v: Float64Array }[];
  /** столбцы X: кто оценил фильм (номера людей) и значения */
  cols: { a: Int32Array; v: Float64Array }[];
  /** XXᵀ, люди×люди */
  gram: Float64Array;
  /** сколько людей оценили фильм (с любой оценкой — и у 'like', где в X только любимое) и чьи это фильмы — для порога minRaters */
  ratedBy: Int32Array; seen: Int32Array[];
}

/** значения строки X (и входного вектора) по z-оценкам человека; 0 — нет в строке */
export function easeValues(kind: EaseKind, z: number[]): number[] {
  if (kind === 'bin') return z.map(() => 1);
  if (kind === 'zw') return z.map((x) => 1 + Math.max(0, x));
  // медиана — высшая оценка (у кого больше половины «десяток»): «выше середины» пусто — тогда любимое = высшая
  const s = [...z].sort((a, b) => a - b), med = s.length ? s[Math.floor(s.length / 2)] : 0;
  const above = z.some((x) => x > med);
  return z.map((x) => (above ? x > med : x >= med) ? 1 : 0);
}

/** X по историям: человек → фильмы; один фильм под несколькими ключами — один (по любому общему ключу, первая запись главнее) */
export function easeData(people: Map<string, EaseFilm[]>, kind: EaseKind): EaseData {
  const index = new Map<string, number>(), keys: string[] = [];
  const who = [...people.keys()];
  const rows = who.map((w) => {
    const films = people.get(w)!;
    const vals = easeValues(kind, films.map((f) => f.z));
    const m = new Map<number, number>(), all = new Set<number>();
    films.forEach((f, n) => {
      if (!f.keys.length) return;
      let i = f.keys.map((k) => index.get(k)).find((x) => x != null);
      if (i == null) { i = keys.length; keys.push(f.keys[0]); }
      for (const k of f.keys) if (!index.has(k)) index.set(k, i);
      all.add(i);
      if (!m.has(i) && vals[n]) m.set(i, vals[n]);
    });
    const order = [...m.keys()].sort((x, y) => x - y);
    return { i: Int32Array.from(order), v: Float64Array.from(order, (i) => m.get(i)!), all: Int32Array.from(all) };
  });
  const ratedBy = new Int32Array(keys.length);
  for (const r of rows) for (const i of r.all) ratedBy[i]++;
  const ca: number[][] = keys.map(() => []), cv: number[][] = keys.map(() => []);
  rows.forEach((r, a) => r.i.forEach((i, n) => { ca[i].push(a); cv[i].push(r.v[n]); }));
  const cols = ca.map((a, i) => ({ a: Int32Array.from(a), v: Float64Array.from(cv[i]) }));
  const U = who.length, gram = new Float64Array(U * U);
  for (const c of cols) for (let x = 0; x < c.a.length; x++) for (let y = 0; y < c.a.length; y++) gram[c.a[x] * U + c.a[y]] += c.v[x] * c.v[y];
  return { kind, keys, index, who, rows: rows.map(({ i, v }) => ({ i, v })), cols, gram, ratedBy, seen: rows.map((r) => r.all) };
}

export interface EaseModel {
  data: EaseData; lambda: number;
  /** кого нет в X: 1 — строки человека нет (замер «без него», сервер — сам спрашивающий и его двойник) */
  out: Uint8Array;
  /** K⁻¹, люди×люди (строка/столбец того, кого нет, — нули, кроме 1 на диагонали: в суммы он не входит) */
  Ki: Float64Array;
  /** d_j = λ·P_jj = 1 − c_jᵀK⁻¹c_j; raters — сколько оценили фильм (с любой оценкой, без skip) */
  d: Float64Array; raters: Int32Array;
}

/** Обучение: K⁻¹ (Холецкий) и d. `skip` — человек (или несколько), которого в X нет (замер «без него»): ~10 мс на 135 людях */
export function easeFit(data: EaseData, lambda = EASE.lambda, skip?: string | readonly string[]): EaseModel {
  const U = data.who.length, out = new Uint8Array(U);
  for (const w of skip == null ? [] : typeof skip === 'string' ? [skip] : skip) { const s = data.who.indexOf(w); if (s >= 0) out[s] = 1; }
  const K = new Float64Array(U * U);
  for (let a = 0; a < U; a++) for (let b = 0; b < U; b++) K[a * U + b] = out[a] || out[b] ? (a === b ? 1 : 0) : data.gram[a * U + b] + (a === b ? lambda : 0);
  const Ki = invSpd(K, U);
  const raters = Int32Array.from(data.ratedBy);
  for (let s = 0; s < U; s++) if (out[s]) for (const j of data.seen[s]) raters[j]--;
  const d = new Float64Array(data.keys.length);
  data.cols.forEach((c, j) => { d[j] = 1 - quad(c, out, Ki, U); });
  return { data, lambda, out, Ki, d, raters };
}

/** c_jᵀ·K⁻¹·c_j по тем, кто в X */
function quad(c: { a: Int32Array; v: Float64Array }, out: Uint8Array, Ki: Float64Array, U: number): number {
  let q = 0;
  for (let x = 0; x < c.a.length; x++) {
    const a = c.a[x]; if (out[a]) continue;
    const row = a * U;
    for (let y = 0; y < c.a.length; y++) { const b = c.a[y]; if (!out[b]) q += c.v[x] * Ki[row + b] * c.v[y]; }
  }
  return q;
}

/** Та же модель без людей `skip` (номера строк X) — из готовой: сервер обращает K раз на набор, а спрашивающего (и его
 *  двойника) вынимает здесь. Обратная к K без строк S — из обратной ко всей (блочное обращение, точно, не приближение):
 *    K_R⁻¹ = K⁻¹_RR − K⁻¹_RS·(K⁻¹_SS)⁻¹·K⁻¹_SR,
 *  d_j — так же: c_jᵀK_R⁻¹c_j = [c_jᵀK⁻¹c_j] − gᵀ(K⁻¹_SS)⁻¹g, g = K⁻¹_SR·c_j; первая скобка — из прежнего d, кроме фильмов,
 *  которые оценил кто-то из S (у них c_j короче — пересчёт). Цена — U²·|S| и ненулевые X·|S| вместо U³ — миллисекунды. */
export function easeWithout(m: EaseModel, skip: readonly number[]): EaseModel {
  const { data, Ki } = m, U = data.who.length;
  const S = [...new Set(skip)].filter((s) => s >= 0 && s < U && !m.out[s]);
  if (!S.length) return m;
  const n = S.length, A = new Float64Array(n * n);
  for (let x = 0; x < n; x++) for (let y = 0; y < n; y++) A[x * n + y] = Ki[S[x] * U + S[y]];
  const Ai = invSpd(A, n);
  // W = K⁻¹_{:,S}·(K⁻¹_SS)⁻¹ — на него и вычитаем
  const W = new Float64Array(U * n);
  for (let a = 0; a < U; a++) for (let y = 0; y < n; y++) { let v = 0; for (let x = 0; x < n; x++) v += Ki[a * U + S[x]] * Ai[x * n + y]; W[a * n + y] = v; }
  const out = Uint8Array.from(m.out); for (const s of S) out[s] = 1;
  const K2 = new Float64Array(U * U);
  for (let a = 0; a < U; a++) for (let b = 0; b < U; b++) {
    if (out[a] || out[b]) { K2[a * U + b] = a === b ? 1 : 0; continue; }
    let v = Ki[a * U + b]; for (let y = 0; y < n; y++) v -= W[a * n + y] * Ki[b * U + S[y]];
    K2[a * U + b] = v;
  }
  const raters = Int32Array.from(m.raters);
  const touched = new Uint8Array(data.keys.length);
  for (const s of S) for (const j of data.seen[s]) raters[j]--;
  for (const s of S) for (const j of data.rows[s].i) touched[j] = 1;
  const d = new Float64Array(data.keys.length), g = new Float64Array(n);
  data.cols.forEach((c, j) => {
    let q = touched[j] ? quad(c, out, Ki, U) : 1 - m.d[j];
    g.fill(0);
    for (let k = 0; k < c.a.length; k++) { const a = c.a[k]; if (out[a]) continue; for (let x = 0; x < n; x++) g[x] += Ki[a * U + S[x]] * c.v[k]; }
    for (let x = 0; x < n; x++) for (let y = 0; y < n; y++) q -= g[x] * Ai[x * n + y] * g[y];
    d[j] = 1 - q;
  });
  return { data, lambda: m.lambda, out, Ki: K2, d, raters };
}

/** входной вектор человека: номер фильма → значение (тем же правилом, что строки X) */
export function easeInput(data: EaseData, films: EaseFilm[]): Map<number, number> {
  const vals = easeValues(data.kind, films.map((f) => f.z)), x = new Map<number, number>();
  films.forEach((f, n) => {
    if (!vals[n]) return;
    const i = f.keys.map((k) => data.index.get(k)).find((v) => v != null);
    if (i != null && !x.has(i)) x.set(i, vals[n]);
  });
  return x;
}

/** Счёт всех фильмов для входа x: s_j (NaN — фильм оценили меньше minRaters, кроме самого человека) */
export function easeScores(m: EaseModel, x: Map<number, number>, minRaters = EASE.minRaters): Float64Array {
  const { data, Ki, d, raters, out: skip } = m, U = data.who.length;
  // t = X·x (по людям), u = K⁻¹·t, y = Xᵀ·u
  const t = new Float64Array(U);
  for (const [j, xj] of x) { const c = data.cols[j]; for (let k = 0; k < c.a.length; k++) if (!skip[c.a[k]]) t[c.a[k]] += c.v[k] * xj; }
  const u = new Float64Array(U);
  for (let a = 0; a < U; a++) { if (skip[a]) continue; let v = 0; const row = a * U; for (let b = 0; b < U; b++) v += Ki[row + b] * t[b]; u[a] = v; }
  const out = new Float64Array(data.keys.length);
  data.cols.forEach((c, j) => {
    if (raters[j] < minRaters) { out[j] = NaN; return; }
    let y = 0; for (let k = 0; k < c.a.length; k++) if (!skip[c.a[k]]) y += c.v[k] * u[c.a[k]];
    const xj = x.get(j) ?? 0;
    out[j] = xj - (xj - y) / d[j];
  });
  return out;
}

/** счёт кандидата по его ключам из готовых счетов (easeScores); null — нет фильма или мало оценивших */
export function easeScoreOf(data: EaseData, scores: Float64Array, candidateKeys: string[]): number | null {
  for (const k of candidateKeys) { const i = data.index.get(k); if (i != null) return Number.isNaN(scores[i]) ? null : scores[i]; }
  return null;
}

/** Ответ GET /api/ease (worker/ease.ts) и таблица замера (tools/taste-eval.mts) — один вид: по фильму счёт обоих видов
 *  целыми × scale. Ключ — один на фильм, как toTable у соседей (TMDb, у сериала `tmdbtv:`, нет — IMDb); клиент ищет по
 *  consensusOf — он пробует все ключи карточки. Фильма нет в списке — нет значения (мало оценивших или нет в X; в счёте
 *  ленты — вес «нет значения»), 0 — честный ноль: нули не отбрасываем, как у соседей, — здесь «нет» и «ноль» весят по-разному.
 *  `exclude` — номера фильмов, которые не отдаём (оценённое самим: оно не в ленте, а по нему видно чужие связи). */
export interface EasePacked { scale: number; keys: string[]; bin: number[]; like: number[] }
const packKeys = new WeakMap<EaseData, string[]>();
function primaryKeys(data: EaseData): string[] {
  let out = packKeys.get(data);
  if (out) return out;
  const all: string[][] = data.keys.map(() => []);
  for (const [k, i] of data.index) all[i].push(k);
  out = all.map((ks) => ks.find((x) => x.startsWith('tmdb:') || x.startsWith('tmdbtv:')) ?? ks.find((x) => x.startsWith('imdb:')) ?? ks[0]);
  packKeys.set(data, out);
  return out;
}
export function easePack(data: EaseData, bin: Float64Array, like: Float64Array, exclude?: ReadonlySet<number>, scale = EASE.scale): EasePacked {
  const names = primaryKeys(data), out: EasePacked = { scale, keys: [], bin: [], like: [] };
  for (let j = 0; j < names.length; j++) {
    // порог minRaters у обоих видов один (ratedBy — по любой оценке), поэтому NaN у них в одних местах
    if (Number.isNaN(bin[j]) || Number.isNaN(like[j]) || exclude?.has(j)) continue;
    out.keys.push(names[j]); out.bin.push(Math.round(bin[j] * scale)); out.like.push(Math.round(like[j] * scale));
  }
  return out;
}
/** Обратно (клиент): ключ → номер и счета; кривой ответ или пустой — undefined (источника нет, а не «у всех нет значения») */
export function easeUnpack(p: unknown): { index: Map<string, number>; bin: Float64Array; like: Float64Array } | undefined {
  const x = p as Partial<EasePacked> | null;
  if (!x || !Array.isArray(x.keys) || !Array.isArray(x.bin) || !Array.isArray(x.like) || !(Number(x.scale) > 0)) return undefined;
  const n = x.keys.length, num = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
  if (!n || x.bin.length !== n || x.like.length !== n || !x.bin.every(num) || !x.like.every(num)) return undefined;
  const index = new Map<string, number>();
  x.keys.forEach((k, i) => { if (typeof k === 'string' && !index.has(k)) index.set(k, i); });
  const s = Number(x.scale);
  return { index, bin: Float64Array.from(x.bin, (v) => Number(v) / s), like: Float64Array.from(x.like, (v) => Number(v) / s) };
}

/** обращение симметричной положительно определённой (Холецкий) */
function invSpd(A: Float64Array, n: number): Float64Array {
  const L = new Float64Array(n * n);
  for (let j = 0; j < n; j++) {
    let s = A[j * n + j];
    for (let k = 0; k < j; k++) s -= L[j * n + k] ** 2;
    const l = Math.sqrt(Math.max(s, 1e-12)); L[j * n + j] = l;
    for (let i = j + 1; i < n; i++) { let t = A[i * n + j]; for (let k = 0; k < j; k++) t -= L[i * n + k] * L[j * n + k]; L[i * n + j] = t / l; }
  }
  // L⁻¹ (нижняя), затем A⁻¹ = L⁻ᵀ·L⁻¹
  const M = new Float64Array(n * n);
  for (let c = 0; c < n; c++) {
    M[c * n + c] = 1 / L[c * n + c];
    for (let i = c + 1; i < n; i++) { let t = 0; for (let k = c; k < i; k++) t -= L[i * n + k] * M[k * n + c]; M[i * n + c] = t / L[i * n + i]; }
  }
  const out = new Float64Array(n * n);
  for (let a = 0; a < n; a++) for (let b = a; b < n; b++) {
    let v = 0; for (let k = b; k < n; k++) v += M[k * n + a] * M[k * n + b];
    out[a * n + b] = v; out[b * n + a] = v;
  }
  return out;
}
