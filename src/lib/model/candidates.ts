// Подбор в два шага (23.10, опыт `twoStage`, src/lib/model/experiments.ts). Замер (.cache/eval/taste-2026-10-23-frozen-*.md):
// модель ранжирует весь пул (~14 тыс.) и тянет наверх малоизвестное, похожее по разбору, — любимых среди первых 150 у неё
// 4%, а у «что смотрят все» 21%. Поэтому сначала отбор кандидатов (несколько сотен) из источников, у которых попадание
// выше, и только потом порядок внутри — тем же fullScore, что и раньше:
//  - «что смотрят все» — по числу оценивших у нас (таблица src/mocks/consensusCount.ts; не пришла — по уровню известности,
//    src/lib/model/fame.ts);
//  - высокая оценка других — мера consensus (src/lib/model/consensus.ts);
//  - похожее на любимое человека по жанрам, странам и авторам — якорь вкуса (src/lib/model/taste.ts);
//  - «открытия» — квота малоизвестного, лучшего по счёту модели: без неё лента стала бы лентой хитов, а засветку топами
//    владелец решил приглушать (17.10).
// Каждый источник добавляет столько НОВЫХ кандидатов, сколько ему положено (уже взятое другим не считается), — размер отбора
// предсказуем: сумма квот. Равные внутри источника — по счёту модели. Пул не больше суммы квот — отбор его не трогает.
// Две формы: по строкам чисел (`selectRows`/`twoStageOrder` — для тюнера по выгрузке, tools/taste-tune.mts) и по кандидатам
// ленты (`twoStageSelect`/`twoStageSort` — для recommend() и замера, tools/taste-eval.mts); вторая сводит кандидатов к строкам
// и зовёт первую, так что порядок один.
import type { WorkCard } from '@/types/tmdf';
import type { RecommendOptions } from './recommend';
import { MIN_PEOPLE } from './consensus';

/** Квоты источников и граница «малоизвестного» — константы для перебора (тюнер передаёт свои). */
export interface TwoStageQuotas {
  /** «что смотрят все»: больше всего оценивших (нет числа — выше уровень известности) */
  popular: number;
  /** выше всего оценили другие */
  consensus: number;
  /** ближе всего к любимому по якорю вкуса */
  anchor: number;
  /** открытия: лучшие по счёту модели среди малоизвестного */
  discovery: number;
  /** малоизвестное — уровень известности не выше этого (0 — нет в списке известности вовсе) */
  quietFame: number;
  /** …и оценивших у нас не больше этого (когда число известно) */
  quietPopular: number;
}
/** Квоты по умолчанию для перебора по выгрузке (tools/tune-two-stage.mts: от них «тихие в 6» и строка «по умолчанию»). */
export const TWO_STAGE: TwoStageQuotas = { popular: 150, consensus: 100, anchor: 100, discovery: 30, quietFame: 0, quietPopular: 3 };
/** Квоты ленты (23.10, решение владельца): «колено» оффлайн-замера .cache/eval/two-stage-2310.md и -ext.md (сетка 144 наборов
 *  на выгрузках frozen и frozen-full, второй шаг — full): 100 «все смотрят» + 6 открытий, без consensus и якоря. На выгрузке —
 *  hit@50 8,2%, hit@150 18,1%, новизна в первых 6 — 5,67 (без отбора 4,04), хвоста 2,3%. Тихое для открытий — нет в списке
 *  известности и нет в таблице «сколько оценили» (src/mocks/consensusCount.ts: там фильмы, оценённые не меньше чем MIN_PEOPLE
 *  людьми, — значит, «тихое» здесь — оценили меньше трёх; в выгрузке popular — у скольких в истории, без порога). */
export const TWO_STAGE_FEED: TwoStageQuotas = { popular: 100, consensus: 0, anchor: 0, discovery: 6, quietFame: 0, quietPopular: 0 };

/** Строка кандидата: столбцы выгрузки (.cache/eval/dump-*, формат — scratchpad dump-format.md). Нет значения — null/undefined. */
export interface CandidateRow {
  popular?: number | null;
  consensus?: number | null;
  anchor?: number | null;
  fame?: number | null;
  /** fullScore — счёт модели, порядок второго шага */
  full: number;
}

const num = (x: number | null | undefined): number | undefined => (x == null || !Number.isFinite(x) ? undefined : x);

/** Шаг 1 по строкам: номера отобранных строк. Пул не больше суммы квот — все. */
export function selectRows(rows: readonly CandidateRow[], q: TwoStageQuotas = TWO_STAGE): Set<number> {
  const total = q.popular + q.consensus + q.anchor + q.discovery;
  if (rows.length <= total) return new Set(rows.keys());
  const picked = new Set<number>();
  const take = (key: (r: CandidateRow) => number | undefined, n: number, only?: (r: CandidateRow) => boolean) => {
    if (n <= 0) return;
    const idx: number[] = [];
    const val = new Float64Array(rows.length);
    rows.forEach((r, i) => {
      if (picked.has(i) || (only && !only(r))) return;
      const v = key(r);
      if (v === undefined) return;
      val[i] = v; idx.push(i);
    });
    idx.sort((a, b) => val[b] - val[a] || rows[b].full - rows[a].full || a - b);
    for (const i of idx.slice(0, n)) picked.add(i);
  };
  // число оценивших есть хоть у кого-то — по нему (нет у фильма — ноль); нет ни у кого — по уровню известности
  const counted = rows.some((r) => num(r.popular) !== undefined);
  take((r) => (counted ? num(r.popular) : num(r.fame)) ?? 0, q.popular);
  take((r) => num(r.consensus), q.consensus);
  take((r) => num(r.anchor), q.anchor);
  take((r) => r.full, q.discovery, (r) => (num(r.fame) ?? 0) <= q.quietFame && (num(r.popular) ?? 0) <= q.quietPopular);
  return picked;
}

/** Оба шага по строкам: номера строк в порядке подбора — отобранные по счёту модели, за ними остальные тоже по счёту
 *  (хвост нужен замеру: AUC и места спрятанного вне отбора). Тюнер: место строки i — позиция i в этом массиве. */
export function twoStageOrder(rows: readonly CandidateRow[], q: TwoStageQuotas = TWO_STAGE): number[] {
  const keep = selectRows(rows, q);
  const byFull = (a: number, b: number) => rows[b].full - rows[a].full || a - b;
  const all = [...rows.keys()];
  return [...all.filter((i) => keep.has(i)).sort(byFull), ...all.filter((i) => !keep.has(i)).sort(byFull)];
}

/** Откуда ленте брать числа источников. По умолчанию — из того, что recommend() уже получает (известность, consensus,
 *  якорь вкуса); `twoStage` в опциях добавляет или заменяет: число оценивших, якорь и у длинной истории (у неё
 *  options.content нет — вес якоря погас), свои квоты. */
export interface TwoStageInputs {
  popular?: (w: WorkCard) => number | undefined;
  fame?: (w: WorkCard) => number | undefined;
  consensus?: (w: WorkCard) => number | undefined;
  anchor?: (w: WorkCard) => number | undefined;
  quotas?: Partial<TwoStageQuotas>;
}

/** Кандидаты ленты → строки и квоты (`options.twoStage.quotas` поверх TWO_STAGE_FEED). */
function feedRows(scored: readonly { c: { work: WorkCard }; score: number }[], options: RecommendOptions): { rows: CandidateRow[]; q: TwoStageQuotas } {
  const own = options.twoStage ?? {};
  const fame = options.fame;
  const src: TwoStageInputs = {
    fame: fame ? (w) => fame.level(w) : undefined,
    consensus: options.consensus?.of,
    anchor: options.content?.fit,
    ...own,
  };
  const rows: CandidateRow[] = scored.map(({ c: { work: w }, score }) => ({
    popular: src.popular?.(w), fame: src.fame?.(w), consensus: src.consensus?.(w), anchor: src.anchor?.(w), full: score,
  }));
  return { rows, q: { ...TWO_STAGE_FEED, ...own.quotas } };
}

/** Шаг 1 для ленты: из оценённых кандидатов (`score` — fullScore) — номера отобранных. */
export function twoStageSelect<T extends { c: { work: WorkCard }; score: number }>(scored: readonly T[], options: RecommendOptions): Set<number> {
  const { rows, q } = feedRows(scored, options);
  return selectRows(rows, q);
}

/** Оба шага для ленты (23.10): кандидаты в порядке `twoStageOrder` — отобранные по счёту, за ними остальные тоже по счёту.
 *  Пул не урезается: отбор только ставит вперёд (иначе лента кончилась бы, как только отобранные разобраны). Равные — в
 *  порядке входа, как у устойчивой сортировки по счёту: когда отобраны все (пул не больше суммы квот), порядок ровно прежний. */
export function twoStageSort<T extends { c: { work: WorkCard }; score: number }>(scored: readonly T[], options: RecommendOptions): T[] {
  const { rows, q } = feedRows(scored, options);
  return twoStageOrder(rows, q).map((i) => scored[i]);
}

/** «Сколько человек оценили» (23.10, источник popular): человек → (ключ фильма → z-оценка; tools/consensus-data.mts) ⇒ ключ
 *  фильма → число людей. Меньше MIN_PEOPLE — фильма нет (как в таблице consensus: ни один человек не угадывается); `skip` — без
 *  этого человека (замер). Таблица ленты — tools/build-consensus.mts → src/mocks/consensusCount.ts. */
export function ratedCountFrom(people: Map<string, Map<string, number>>, skip?: string): Map<string, number> {
  const n = new Map<string, number>();
  for (const [who, zs] of people) {
    if (who === skip) continue;
    for (const k of zs.keys()) n.set(k, (n.get(k) ?? 0) + 1);
  }
  for (const [k, c] of n) if (c < MIN_PEOPLE) n.delete(k);
  return n;
}
