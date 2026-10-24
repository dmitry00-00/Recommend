// Состояние участника из его истории: какие операции и на каком уровне нагружали
// произведения, которые он досмотрел и которые ему понравились. Это грубая эвристика
// этапа 1 (ROADMAP §5: IRT и Брэдли–Терри — этап 4): взвешенный квантиль нагрузки, диапазон
// от числа наблюдений, тренд — последний год против остального. Оценки участника —
// вес наблюдения, не показатель; в интерфейс они не попадают.
import type {
  CognitiveMapData, CognitiveOperation, CognitiveState, Confidence, ISODate, JourneyEntryData, OperationEstimate,
  Register, RegisterAffinity, StateHistoryPoint, WorkCard,
} from '@/types/tmdf';
import { operationKeys } from '@/lib/operations';
import { EXPERIMENTS } from '@/lib/model/experiments';

export interface RatedEntry extends JourneyEntryData {
  rating?: 1 | 2 | 3 | 4 | 5;
  /** оценка в шкале источника (0–10), если она была: семёрка — не то же самое, что восьмёрка */
  raw?: number;
}

/** Нагрузка операции в произведении: уровень сложности, смягчённый интенсивностью. */
export const opLoad = (level: number, intensity: number): number => level * (0.6 + 0.4 * intensity);

/** Шкала оценок у каждого своя. Один ставит семёрку тому, что «не жалко времени, сделано
 *  компетентно», другой той же семёркой ругается, третий пользуется только пятёркой и
 *  десяткой. Поэтому вес наблюдения считается не от абсолютного числа, а от места оценки в
 *  собственном распределении участника: норма — его медиана (или то, что он сам назвал
 *  нормой), выше нормы вес растёт до единицы, ниже — падает до 0.15. Ранговый расчёт
 *  включается, когда оценок хватает; на малых числах — ровная линейка от нормы.
 *  Это первое приближение: по-настоящему шкала — отдельная работа (ROADMAP). */
export interface RatingScale {
  /** оценка, которая у этого участника значит «нормально»: выше — понравилось */
  norm: number;
  /** вес наблюдения 0.15–1 */
  weight: (raw?: number, rating?: number) => number;
  source: 'stated' | 'derived' | 'default';
}

const DEFAULT_NORM = 7;

export function deriveScale(raws: number[], stated?: number): RatingScale {
  const sorted = [...raws].sort((a, b) => a - b);
  const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : DEFAULT_NORM;
  const norm = stated ?? median;
  const source: RatingScale['source'] = stated != null ? 'stated' : sorted.length >= 8 ? 'derived' : 'default';
  const above = sorted.filter((r) => r > norm);
  const below = sorted.filter((r) => r < norm);
  const enough = sorted.length >= 8 && above.length >= 3 && below.length >= 3;
  const weight = (raw?: number, rating?: number): number => {
    if (raw == null) {
      // оценки нет: смотрел, но не оценил — считаем чуть ниже нормы
      return rating == null ? 0.55 : rating >= 4 ? 1 : rating === 3 ? 0.5 : 0.25;
    }
    if (raw === norm) return 0.55;
    if (!enough) return clamp(0.55 + 0.15 * (raw - norm), 0.15, 1);
    if (raw > norm) return 0.6 + 0.4 * (above.filter((r) => r <= raw).length / above.length);
    return 0.15 + 0.3 * (below.filter((r) => r < raw).length / below.length);
  };
  return { norm, weight, source };
}

/** Шкала по умолчанию — пока оценок нет: тогда вес берётся из приведённой 1–5. */
const defaultScale = deriveScale([]);

function weightedQuantile(items: { value: number; weight: number }[], q: number): number {
  const sorted = [...items].sort((a, b) => a.value - b.value);
  const total = sorted.reduce((s, i) => s + i.weight, 0);
  let acc = 0;
  for (const it of sorted) {
    acc += it.weight;
    if (acc >= total * q) return it.value;
  }
  return sorted.length ? sorted[sorted.length - 1].value : 0;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

function confidenceFor(n: number): Confidence {
  return n >= 8 ? 'high' : n >= 4 ? 'medium' : 'low';
}

/** Полуширина диапазона: чем меньше наблюдений, тем шире. */
const halfRange = (n: number): number => (n >= 12 ? 0.8 : n >= 8 ? 1.1 : n >= 4 ? 1.6 : 2.4);

function estimateOp(op: CognitiveOperation, entries: RatedEntry[], asOf: ISODate, scale: RatingScale): OperationEstimate | undefined {
  const obs = entries.flatMap((e) => {
    const oi = e.work.primaryOperations.find((o) => o.op === op);
    if (!oi || oi.intensity < 0.4 || !e.work.complexityLevel) return [];
    return [{ value: opLoad(e.work.complexityLevel, oi.intensity), weight: scale.weight(e.raw, e.rating), date: e.finishedAt ?? e.startedAt }];
  });
  if (!obs.length) return undefined;
  // 70-й квантиль того, что понравилось: комфортно и с удовольствием, а не предел
  const level = clamp(weightedQuantile(obs, 0.7), 1, 10);
  const n = obs.filter((o) => o.weight >= 0.85).length;
  const h = halfRange(n);
  const yearAgo = new Date(asOf); yearAgo.setFullYear(yearAgo.getFullYear() - 1);
  const recent = obs.filter((o) => o.date && new Date(o.date) >= yearAgo);
  const older = obs.filter((o) => !(o.date && new Date(o.date) >= yearAgo));
  let trend: OperationEstimate['trend'] = 'unknown';
  if (recent.length >= 3 && older.length >= 3) {
    const diff = weightedQuantile(recent, 0.7) - weightedQuantile(older, 0.7);
    trend = diff > 0.5 ? 'up' : diff < -0.5 ? 'down' : 'flat';
  }
  return { op, level: round1(level), range: [round1(clamp(level - h, 0, 10)), round1(clamp(level + h, 0, 10))], confidence: confidenceFor(n), trend };
}

/** Вкус по регистру — из выбора, а не из оценок: что участник смотрит заметно чаще, чем
 *  встречается вокруг. Оценка, если она есть, только усиливает или гасит вес наблюдения.
 *  Почему так: оценок у большинства просмотренного нет, а сам факт «выбрал и досмотрел»
 *  есть всегда; к тому же список просмотренного участника (22.09) оказался втрое богаче
 *  ужасами, чем его же выгрузка с оценками. `corpus` — то, из чего вообще можно выбирать. */
export function deriveRegisterTaste(
  seen: { registers?: Register[]; rating?: number; raw?: number }[],
  base: Partial<Record<Register, number>>,
  scale: RatingScale = defaultScale,
): RegisterAffinity[] {
  const mine: Partial<Record<Register, number>> = {};
  const counts: Partial<Record<Register, number>> = {};
  let mineTotal = 0;
  for (const w of seen) {
    const weight = scale.weight(w.raw, w.rating);
    for (const r of w.registers ?? []) {
      mine[r] = (mine[r] ?? 0) + weight;
      counts[r] = (counts[r] ?? 0) + 1;
      mineTotal += weight;
    }
  }
  const baseTotal = Object.values(base).reduce((s, x) => s + x, 0);
  if (!mineTotal || !baseTotal) return [];
  const out: RegisterAffinity[] = [];
  for (const r of Object.keys(counts) as Register[]) {
    const n = counts[r] ?? 0;
    const ratio = ((mine[r] ?? 0) / mineTotal + 0.02) / ((base[r] ?? 0) / baseTotal + 0.02);
    // вдвое чаще, чем вокруг, — это +0.5; вдвое реже — −0.5; мало наблюдений — ближе к нулю
    const affinity = clamp(Math.log2(ratio) / 2, -1, 1) * (n / (n + 4));
    out.push({ register: r, affinity: round1(affinity), n });
  }
  return out.sort((a, b) => b.affinity - a.affinity);
}

/** Вкус по регистру — по оценкам (опыт `registerByRating`, 23.10). Почему: сродство «по выбору» с тем, как человек
 *  оценивает фильмы регистра, почти не связано (корреляция 0,08 по разбору .cache/eval/why-2026-10-22.md, п. 4) — часто
 *  смотреть не значит любить. Здесь сродство — средняя z-оценка человека у фильмов регистра: z в его же шкале (сколько его
 *  разбросов от его среднего), сжатая к нулю псевдосчётом `k` (три фильма — почти догадка, сто — уверенно) и растянутая
 *  `gain` до привычного размаха −1…+1, на который смотрят registerFit/leadRegister/likesRegister (±0,25 — порог «любит»).
 *  Регистр без оценок (только в присланном списке) — из вкуса по выбору, ослабленным `fill`: иначе он получил бы чужой
 *  штраф −0,2 «незнакомого». Оценок с регистрами меньше `min` — вкус по выбору целиком: z на малом числе — шум. */
export interface RegisterByRatingOptions { k: number; gain: number; fill: number; blend: number; min: number }
export const REGISTER_BY_RATING: RegisterByRatingOptions = { k: 8, gain: 2, fill: 0.5, blend: 0, min: 8 };

export function deriveRegisterTasteByRating(
  seen: { registers?: Register[]; rating?: number; raw?: number }[],
  base: Partial<Record<Register, number>>,
  scale: RatingScale = defaultScale,
  o: RegisterByRatingOptions = REGISTER_BY_RATING,
): RegisterAffinity[] {
  const byChoice = deriveRegisterTaste(seen, base, scale);
  // оценка в десятибалльной шкале: своя, иначе приведённая 1–5 (у части источников только звёзды)
  const rated = seen.flatMap((w) => {
    const v = w.raw ?? (w.rating != null ? w.rating * 2 : undefined);
    return v == null ? [] : [{ v, registers: w.registers ?? [] }];
  });
  if (rated.filter((w) => w.registers.length).length < o.min) return byChoice;
  const m = rated.reduce((s, w) => s + w.v, 0) / rated.length;
  const sd = Math.sqrt(rated.reduce((s, w) => s + (w.v - m) ** 2, 0) / rated.length);
  if (!sd) return byChoice;
  const sum: Partial<Record<Register, number>> = {};
  const counts: Partial<Record<Register, number>> = {};
  for (const w of rated) for (const r of w.registers) {
    sum[r] = (sum[r] ?? 0) + (w.v - m) / sd;
    counts[r] = (counts[r] ?? 0) + 1;
  }
  const choice = new Map(byChoice.map((t) => [t.register, t]));
  const out: RegisterAffinity[] = [];
  for (const r of Object.keys(counts) as Register[]) {
    const n = counts[r] ?? 0;
    const byRating = o.gain * (sum[r] ?? 0) / (n + o.k);
    out.push({ register: r, affinity: round1(clamp(byRating + o.blend * (choice.get(r)?.affinity ?? 0), -1, 1)), n });
  }
  for (const t of byChoice) if (!(t.register in counts)) out.push({ ...t, affinity: round1(o.fill * t.affinity) });
  return out.sort((a, b) => b.affinity - a.affinity);
}

export interface DeriveOptions {
  /** что участник видел сверх дневника — например, список, присланный текстом: дат и оценок нет */
  alsoSeen?: WorkCard[];
  /** доля регистров «по миру» (src/mocks/registerBase.ts): относительно неё и считается вкус */
  base?: Partial<Record<Register, number>>;
  /** что участник сам назвал своей нормой по десятибалльной шкале; иначе берётся его медиана */
  ratingNorm?: number;
}

/** Состояние из истории: только досмотренное, только размеченное. Пусто — undefined. */
export function deriveState(userId: string, entries: RatedEntry[], asOf: ISODate, taste?: DeriveOptions): CognitiveState | undefined {
  const done = entries.filter((e) => e.status === 'finished' && e.work.complexityLevel > 0 && e.work.primaryOperations.length);
  if (done.length < 3) return undefined;
  const scale = deriveScale(entries.map((e) => e.raw).filter((r): r is number => r != null), taste?.ratingNorm);
  const operations = operationKeys.map((op) => estimateOp(op, done, asOf, scale)).filter((o): o is OperationEstimate => Boolean(o));
  const loved = done.filter((e) => (e.raw != null ? e.raw > scale.norm : (e.rating ?? 4) >= 4));
  const comfort = weightedQuantile(done.map((e) => ({ value: e.work.complexityLevel, weight: scale.weight(e.raw, e.rating) })), 0.7);
  const literate = loved.filter((e) => e.work.complexityLevel >= 6 || e.work.isNicheMasterpiece).length / Math.max(1, loved.length);
  const registerTaste = taste?.base
    ? (EXPERIMENTS.registerByRating ? deriveRegisterTasteByRating : deriveRegisterTaste)(
        [...entries.filter((e) => e.status === 'finished').map((e) => ({ registers: e.work.registers, rating: e.rating, raw: e.raw })),
          ...(taste.alsoSeen ?? []).map((w) => ({ registers: w.registers }))],
        taste.base,
        scale,
      )
    : undefined;
  return {
    userId,
    asOf,
    operations,
    complexityComfort: round1(clamp(comfort, 1, 10)),
    mediaLiteracy: round1(clamp(3 + 7 * literate, 1, 10)),
    overallConfidence: confidenceFor(loved.length / 2),
    source: 'activity',
    ...(registerTaste?.length ? { registerTaste } : {}),
  };
}

/** Диапазон сложности участника (МА-1, 13.10) — для «сдвига» на сервере: та же выборка и те же веса,
 *  что у `complexityComfort` (центр — 0,7-квантиль), границы — 0,25 и 0,9: досмотр выше верхней
 *  границы — выше того, что человек обычно досматривает и любит. `median` — без весов, «привычный
 *  уровень» для proxy reward. Меньше трёх размеченных досмотров — undefined, как у deriveState. */
export interface ComplexitySpan { center: number; lo: number; hi: number; median: number; n: number }
export function complexitySpan(entries: RatedEntry[], ratingNorm?: number): ComplexitySpan | undefined {
  const done = entries.filter((e) => e.status === 'finished' && e.work.complexityLevel > 0 && e.work.primaryOperations.length);
  if (done.length < 3) return undefined;
  const scale = deriveScale(entries.map((e) => e.raw).filter((r): r is number => r != null), ratingNorm);
  const items = done.map((e) => ({ value: e.work.complexityLevel, weight: scale.weight(e.raw, e.rating) }));
  const levels = done.map((e) => e.work.complexityLevel).sort((a, b) => a - b);
  return {
    center: round1(clamp(weightedQuantile(items, 0.7), 1, 10)),
    lo: round1(weightedQuantile(items, 0.25)),
    hi: round1(weightedQuantile(items, 0.9)),
    median: round1(levels[Math.floor(levels.length / 2)]),
    n: done.length,
  };
}

/** Карта из истории: состояние, точки по кварталам (оценка на дату — по тому, что было
 *  досмотрено к тому моменту), следы — досмотренное с операциями. Целей нет: их ставит участник. */
export function deriveMap(userId: string, entries: RatedEntry[], asOf: ISODate, taste?: DeriveOptions): CognitiveMapData | undefined {
  const state = deriveState(userId, entries, asOf, taste);
  if (!state) return undefined;
  const done = entries.filter((e) => e.status === 'finished' && e.work.complexityLevel > 0 && (e.finishedAt ?? e.startedAt));
  const dates = done.map((e) => (e.finishedAt ?? e.startedAt)!).sort();
  const history: StateHistoryPoint[] = [];
  if (dates.length) {
    // точки — конец каждого квартала от первой записи до сегодня, где что-то досмотрено
    const first = new Date(dates[0]);
    const cursor = new Date(first.getFullYear(), first.getMonth() + 3 - (first.getMonth() % 3), 0);
    const end = new Date(asOf);
    let prevCount = 0;
    while (cursor < end) {
      const iso = cursor.toISOString().slice(0, 10);
      const upTo = done.filter((e) => (e.finishedAt ?? e.startedAt)! <= iso);
      if (upTo.length > prevCount) {
        const s = deriveState(userId, upTo, iso);
        if (s) {
          const last = upTo.sort((a, b) => ((a.finishedAt ?? a.startedAt)! < (b.finishedAt ?? b.startedAt)! ? 1 : -1))[0];
          history.push({
            asOf: iso,
            operations: s.operations.map((o) => ({ op: o.op, level: o.level, range: o.range })),
            cause: { kind: 'work_finished', label: last.work.title, workId: last.work.id, changeType: 'refined_estimate' },
          });
        }
        prevCount = upTo.length;
      }
      cursor.setMonth(cursor.getMonth() + 3);
    }
  }
  history.push({
    asOf,
    operations: state.operations.map((o) => ({ op: o.op, level: o.level, range: o.range })),
    cause: { kind: 'work_finished', label: 'История', changeType: 'refined_estimate' },
  });
  return {
    state,
    history,
    targets: [],
    suggestedTargets: [],
    traces: done
      .filter((e) => e.work.primaryOperations.length)
      .sort((a, b) => ((a.finishedAt ?? a.startedAt)! < (b.finishedAt ?? b.startedAt)! ? 1 : -1))
      .map((e) => ({ work: e.work, finishedAt: (e.finishedAt ?? e.startedAt)!, operations: e.work.primaryOperations })),
  };
}
