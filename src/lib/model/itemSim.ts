// «Похожие фильмы» (23.10, опыт `itemSim`, src/lib/model/experiments.ts). Замер на историях зрителей
// (.cache/eval/taste-2026-10-23-*) показал: соседи по вкусу различают любимое лучше модели, но им нужна длинная история
// человека и все истории других под рукой. Сходство фильмов — то же знание, свёрнутое заранее: «кто высоко оценил X,
// высоко оценивает и Y». Тогда хватает пяти–десяти оценок человека, а в приложение едет только таблица пар фильмов.
// Мера: z-оценки людей (как в consensus.ts — каждый в своей шкале), косинус по людям, оценившим оба фильма, сжатый к нулю
// (n/(n+SHRINK)): пара, которую видели трое, не бывает «очень похожей». Пар меньше чем на MIN_COMMON людях нет вовсе —
// и шум, и чужая оценка не должна угадываться по таблице. У фильма — только NEIGHBORS ближайших (сходство > 0); при
// загрузке списки делаются взаимными (Y в соседях X ⇒ X в соседях Y), иначе у короткой истории соседей почти нет.
// Счёт кандидата для человека — взвешенное сходством среднее его z-оценок по похожим фильмам, которые он оценил.
// Таблица: tools/build-item-sim.mts → src/mocks/itemSim.ts (лениво, как consensus). Замер собирает её каждому человеку без
// него самого — itemSimSums один раз, itemSimTable(sums, кто) вычитает его вклад на время отбора (не пересчёт с нуля).

// Значения — по офлайн-замеру 23.10 (tools/item-sim-eval.mts, 133 истории): больше соседей и сильнее сжатие — лучше
// (N 30→50→80: AUC 0,728→0,731→0,734, λ 5→25: +0,01, prior 0→2: +0,005); N=80 не влезает в 1,5 МБ — взято 50.
export const ITEM_SIM = {
  /** ближайших у фильма в таблице (до взаимности) */
  neighbors: 50,
  /** сжатие сходства: n/(n+shrink), n — сколько людей оценили оба */
  shrink: 25,
  /** пары меньше чем на стольких общих людях — нет */
  minCommon: 3,
  /** воображаемое сходство «как обычно» в знаменателе счёта: один слабо похожий фильм не решает */
  prior: 2,
  /** уровни сходства в упакованной таблице (символ на число) */
  levels: 64,
};
/** вес в счёте ленты (счёт около 0…1, мера — около −1…1) */
export const ITEM_SIM_WEIGHT = { value: 0.3 };

/** фильм в истории человека: его ключи (consensusKeys: первым — TMDb) и z-оценка */
export interface RatedFilm { keys: string[]; z: number }
/** таблица для счёта: ключ фильма (первый из consensusKeys) → взаимные соседи номерами и сходство */
export interface ItemSimTable {
  keys: string[]; index: Map<string, number>; nb: { j: Int32Array; s: Float32Array }[];
  /** ближайшие каждого до взаимности — для упаковки (packItemSim) */
  own?: { j: ArrayLike<number>; s: ArrayLike<number> }[];
}
/** суммы по парам фильмов — из них собирается таблица, в том числе без одного человека */
export interface ItemSimSums {
  keys: string[]; index: Map<string, number>; m: number;
  /** человек → его фильмы номерами (по возрастанию) и z */
  people: Map<string, { i: Int32Array; z: Float32Array }>;
  /** треугольник пар i<j: Σ z_i z_j, Σ z_i², Σ z_j², число общих людей — всё по людям, оценившим оба */
  dot: Float32Array; a: Float32Array; b: Float32Array; n: Uint8Array | Uint16Array;
}

const tri = (m: number, i: number, j: number) => i * m - (i * (i + 1)) / 2 + (j - i - 1);

/** Суммы по парам. В таблицу идут фильмы, которые оценили не меньше `minCommon` людей (иначе ни одной пары у них не будет).
 *  Память — 13 байт на пару (≈ 0,5 ГБ на 8,6 тыс. фильмов): собирать один раз на процесс. */
export function itemSimSums(people: Map<string, RatedFilm[]>, minCommon = ITEM_SIM.minCommon): ItemSimSums {
  const cnt = new Map<string, number>();
  for (const films of people.values()) for (const f of films) if (f.keys.length) cnt.set(f.keys[0], (cnt.get(f.keys[0]) ?? 0) + 1);
  const keys = [...cnt].filter(([, c]) => c >= minCommon).map(([k]) => k).sort();
  const index = new Map(keys.map((k, i) => [k, i]));
  // остальные ключи фильма (IMDb) — тоже на него: в истории человека фильм может прийти и без TMDb
  for (const films of people.values()) for (const f of films) {
    const i = f.keys.length ? index.get(f.keys[0]) : undefined;
    if (i != null) for (const k of f.keys.slice(1)) if (!index.has(k)) index.set(k, i);
  }
  const m = keys.length, size = (m * (m - 1)) / 2;
  const sums: ItemSimSums = { keys, index, m, people: new Map(),
    dot: new Float32Array(size), a: new Float32Array(size), b: new Float32Array(size), n: people.size > 255 ? new Uint16Array(size) : new Uint8Array(size) };
  for (const [who, films] of people) {
    const mine = films.map((f) => ({ i: f.keys.length ? index.get(f.keys[0]) : undefined, z: f.z })).filter((x): x is { i: number; z: number } => x.i != null);
    const uniq = new Map(mine.map((x) => [x.i, x.z]));
    const order = [...uniq.keys()].sort((x, y) => x - y);
    const p = { i: Int32Array.from(order), z: Float32Array.from(order.map((i) => uniq.get(i)!)) };
    sums.people.set(who, p);
    addPerson(sums, p, 1);
  }
  return sums;
}

/** вклад человека в суммы: sign 1 — прибавить, −1 — вычесть */
function addPerson(s: ItemSimSums, p: { i: Int32Array; z: Float32Array }, sign: 1 | -1): void {
  const { m, dot, a, b, n } = s;
  for (let x = 0; x < p.i.length; x++) {
    const i = p.i[x], zi = p.z[x], base = i * m - (i * (i + 1)) / 2 - i - 1;
    for (let y = x + 1; y < p.i.length; y++) {
      const t = base + p.i[y], zj = p.z[y];
      dot[t] += sign * zi * zj; a[t] += sign * zi * zi; b[t] += sign * zj * zj; n[t] += sign;
    }
  }
}

/** Таблица из сумм; `skip` — без этого человека (замер): его вклад вычитается на время отбора и возвращается.
 *  На 8,6 тыс. фильмов — около секунды; суммы после вызова прежние. */
export function itemSimTable(s: ItemSimSums, skip?: string, opts: Partial<typeof ITEM_SIM> = {}): ItemSimTable {
  const { neighbors: N, shrink, minCommon, levels } = { ...ITEM_SIM, ...opts };
  const p = skip != null ? s.people.get(skip) : undefined;
  if (p) addPerson(s, p, -1);
  try {
    const { m, dot, a, b, n } = s;
    const topJ: Int32Array[] = [], topS: Float32Array[] = [];
    const hj = new Int32Array(N), hs = new Float32Array(N);
    for (let i = 0; i < m; i++) {
      let size = 0, minAt = 0;
      const offer = (j: number, t: number) => {
        const c = n[t];
        if (c < minCommon) return;
        const ab = a[t] * b[t];
        if (ab <= 0) return;
        const v = (dot[t] / Math.sqrt(ab)) * (c / (c + shrink));
        if (v <= 0) return;
        if (size < N) { hj[size] = j; hs[size] = v; if (size === 0 || v < hs[minAt]) minAt = size; size++; return; }
        if (v <= hs[minAt]) return;
        hj[minAt] = j; hs[minAt] = v;
        minAt = 0; for (let k = 1; k < N; k++) if (hs[k] < hs[minAt]) minAt = k;
      };
      // пары (j, i) при j < i — по столбцу, (i, j) при j > i — подряд
      for (let j = 0; j < i; j++) offer(j, tri(m, j, i));
      const row = tri(m, i, i + 1);
      for (let j = i + 1; j < m; j++) offer(j, row + (j - i - 1));
      // по убыванию сходства: limitItemSim режет хвост без пересчёта
      const order = [...Array(size).keys()].sort((x, y) => hs[y] - hs[x]);
      topJ.push(Int32Array.from(order, (k) => hj[k])); topS.push(Float32Array.from(order, (k) => quant(hs[k], levels)));
    }
    return { ...mutual(s.keys, s.index, topJ, topS), own: topJ.map((j, i) => ({ j, s: topS[i] })) };
  } finally {
    if (p) addPerson(s, p, 1);
  }
}

/** Та же таблица с меньшим числом ближайших (замер перебирает N без пересборки) */
export function limitItemSim(t: ItemSimTable, n: number): ItemSimTable {
  if (!t.own) throw new Error('itemSim: нужна таблица из itemSimTable');
  const js = t.own.map((o) => Array.prototype.slice.call(o.j, 0, n) as number[]), ss = t.own.map((o) => Array.prototype.slice.call(o.s, 0, n) as number[]);
  return { ...mutual(t.keys, t.index, js, ss), own: js.map((j, i) => ({ j, s: ss[i] })) };
}

/** сходство — к уровню упакованной таблицы (замер видит то же, что лента) */
const quant = (v: number, levels: number) => Math.max(1, Math.min(levels - 1, Math.round(v * (levels - 1)))) / (levels - 1);

/** списки взаимные: Y в ближайших X ⇒ X среди соседей Y (то же сходство) */
function mutual(keys: string[], index: Map<string, number>, topJ: ArrayLike<number>[], topS: ArrayLike<number>[]): ItemSimTable {
  const lists: Map<number, number>[] = keys.map(() => new Map());
  topJ.forEach((js, i) => { for (let k = 0; k < js.length; k++) { const j = js[k], v = topS[i][k]; lists[i].set(j, v); if (!lists[j].has(i)) lists[j].set(i, v); } });
  return { keys, index, nb: lists.map((l) => ({ j: Int32Array.from(l.keys()), s: Float32Array.from(l.values()) })) };
}

// ─── упаковка для src/mocks/itemSim.ts ─────────────────────────────────────────
// Ключи — строкой через пробел (`tmdb:` опущено, `tmdbtv:` → `v`, `imdb:tt` → `i`); соседи фильма — по возрастанию номера:
// разница с предыдущим номером цифрами по 32 (символ 32–63 — «дальше ещё цифра», 0–31 — последняя), за ней символ уровня
// сходства; фильмы — через пробел, в порядке ключей. Без JSON-массивов: таблица в разы меньше, разбор — быстрый.
const ABC = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_';
const DEC = new Map([...ABC].map((c, i) => [c, i]));
export interface PackedItemSim { keys: string; nb: string }
const shortKey = (k: string) => k.startsWith('tmdb:') ? k.slice(5) : k.startsWith('tmdbtv:') ? `v${k.slice(7)}` : k.startsWith('imdb:tt') ? `i${k.slice(7)}` : `=${k}`;
const longKey = (k: string) => /^\d/.test(k) ? `tmdb:${k}` : k[0] === 'v' ? `tmdbtv:${k.slice(1)}` : k[0] === 'i' ? `imdb:tt${k.slice(1)}` : k.slice(1);

/** Упаковать (только ближайшие каждого, взаимные пары — однажды: взаимность восстановит unpackItemSim) */
export function packItemSim(t: ItemSimTable, levels = ITEM_SIM.levels): PackedItemSim {
  const own = t.own;
  if (!own) throw new Error('itemSim: упаковывается таблица из itemSimTable');
  if (t.keys.some((k) => k.includes(' '))) throw new Error('itemSim: пробел в ключе');
  // пара, взаимная у обоих, пишется один раз — у меньшего номера
  const has = own.map((o) => new Set(Array.from(o.j)));
  const nb = own.map(({ j, s }, i) => {
    const row = Array.from(j, (x, k) => [x, s[k]] as const).filter(([x]) => !(x < i && has[x].has(i))).sort((x, y) => x[0] - y[0]);
    let out = '', prev = -1;
    for (const [x, v] of row) {
      let d = x - prev - 1; prev = x;
      const digits: number[] = [];
      do { digits.push(d & 31); d >>= 5; } while (d);
      for (let k = digits.length - 1; k > 0; k--) out += ABC[32 + digits[k]];
      out += ABC[digits[0]] + ABC[Math.max(1, Math.min(levels - 1, Math.round(v * (levels - 1))))];
    }
    return out;
  }).join(' ');
  return { keys: t.keys.map(shortKey).join(' '), nb };
}

/** Распаковать таблицу из src/mocks/itemSim.ts — со взаимными соседями */
export function unpackItemSim(p: PackedItemSim, levels = ITEM_SIM.levels): ItemSimTable {
  const keys = p.keys.split(' ').map(longKey);
  const rows = p.nb.split(' ');
  const topJ: number[][] = [], topS: number[][] = [];
  for (const r of rows) {
    const js: number[] = [], ss: number[] = [];
    let prev = -1, d = 0;
    for (let k = 0; k < r.length; k++) {
      const c = DEC.get(r[k])!;
      if (c >= 32) { d = (d << 5) | (c - 32); continue; }
      prev += ((d << 5) | c) + 1; d = 0;
      js.push(prev); ss.push(DEC.get(r[++k])! / (levels - 1));
    }
    topJ.push(js); topS.push(ss);
  }
  return mutual(keys, new Map(keys.map((k, i) => [k, i])), topJ, topS);
}

// ─── счёт ──────────────────────────────────────────────────────────────────────

/** z-оценки человека по его истории: ключ фильма (любой из consensusKeys) → z. `raw` — оценка в его шкале. */
export function personZ(entries: { keys: string[]; raw: number }[]): Map<string, number> {
  const v = entries.map((e) => e.raw);
  if (!v.length) return new Map();
  const mean = v.reduce((x, y) => x + y, 0) / v.length;
  const sd = Math.sqrt(v.reduce((x, y) => x + (y - mean) ** 2, 0) / v.length) || 1;
  return new Map(entries.flatMap((e) => e.keys.map((k) => [k, (e.raw - mean) / sd] as [string, number])));
}

/** Счёт кандидата: среднее z-оценок человека по оценённым им фильмам, похожим на кандидата, с весом сходства
 *  (+ITEM_SIM.prior в знаменателе); null — кандидата нет в таблице или похожего он ничего не оценил. */
export function itemSimScore(table: ItemSimTable, candidateKeys: string[], personRatings: Map<string, number>, prior = ITEM_SIM.prior): number | null {
  let i: number | undefined;
  for (const k of candidateKeys) { i = table.index.get(k); if (i != null) break; }
  if (i == null) return null;
  const mine = byIndex(table, personRatings);
  if (!mine.size) return null;
  const { j, s } = table.nb[i];
  let num = 0, den = 0;
  for (let k = 0; k < j.length; k++) {
    const z = mine.get(j[k]);
    if (z == null) continue;
    num += s[k] * z; den += s[k];
  }
  return den ? num / (den + prior) : null;
}

/** оценки человека номерами фильмов таблицы (по любому ключу фильма) — один раз на пару «таблица, история» */
const indexed = new WeakMap<ItemSimTable, WeakMap<Map<string, number>, Map<number, number>>>();
function byIndex(table: ItemSimTable, ratings: Map<string, number>): Map<number, number> {
  let per = indexed.get(table);
  if (!per) indexed.set(table, (per = new WeakMap()));
  let out = per.get(ratings);
  if (!out) {
    out = new Map();
    for (const [k, z] of ratings) { const i = table.index.get(k); if (i != null && !out.has(i)) out.set(i, z); }
    per.set(ratings, out);
  }
  return out;
}
