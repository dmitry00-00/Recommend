// Ось «стоило» в подборе (17.10, решение владельца): «понравилось» и «стоило» — разные оси, подбор учитывает
// «стоило» отдельно. Вход — послесловия (afterword.ts): «Стоило ли?», темп для человека и что держало.
//
// Главное решение — считать не «стоило» само по себе, а расхождение с тем, что угадывается по оценке (inferWorth).
// Иначе включение оси тащит обратно вкус по оценкам («ещё того же»), который у насмотренного нарочно гаснет к
// FADE_AT (taste.ts): на сотне оценок неспрошенное «стоило» — это просто «понравилось» ещё раз. Поэтому:
//   явный ответ — вес 1, сигнал = знак(worth) − знак(inferWorth(оценка));
//   неспрошенное с оценкой 1–2 или 4–5 — вес 0,4 и нулевой сигнал: оно не тянет, но разбавляет — один ответ
//     среди сорока похожих по жанру просмотров значит меньше, чем один из двух;
//   «Нормально» без ответа — нет сигнала вовсе.
// «Пусто» (оценка ≥ 4, worth ≤ 2) и «мимо, но стоило» (оценка ≤ 2, worth ≥ 4) — расхождения, ради которых
// вопрос и задаётся: их сигнал усилен в DIVERGE раз. Без единого явного ответа профиля нет — подбор как прежде.
//
// Темп и «что держало» — вопросы о человеке. Связываются только с тем, что есть в карточке (WorkCard):
//   темп — барьеры «Медленный темп» и «Долгий хронометраж» (или длительность ≥ 150 минут);
//   держало — операции разметки (сюжет → причины, герои → чужие глаза, идея → обобщение) и жанры TMDb для мира.
import type { AfterHook, AfterPace, Afterword, CognitiveOperation, WorkCard } from '@/types/tmdf';
import { countryRu } from '@/lib/countries';
import { HOOKS, inferWorth, type Score } from './afterword';

export interface WorthEntry { work: WorkCard; rating?: Score }

/** Опция подбора (RecommendOptions.afterwords). `get` — послесловие по id работы (подходит Map), `entries` — просмотренное
 *  с оценками (то же, что идёт в deriveState), `genresOf` — жанры TMDb, как у якоря вкуса; без них жанры молчат. */
export interface AfterwordInput {
  get(workId: string): Afterword | undefined;
  entries: readonly WorthEntry[];
  genresOf?: (work: WorkCard) => string[];
}

/** Вес оси «стоило» в счёте (счёт ~0…1, порог 0,3). Сходство 1 — сдвиг примерно на уровень сложности
 *  (0,4 × 1/3 ≈ 0,13): выбирает между близкими по силе и снимает «пустое», но не вытягивает неподходящее. */
export const WORTH_WEIGHT = 0.15;
/** Во сколько раз расхождение («пусто», «мимо, но стоило») сильнее остальных ответов. */
export const DIVERGE = 1.25;
/** Вес неспрошенного (угаданного по оценке) — только как разбавитель. */
export const INFERRED_WEIGHT = 0.4;
/** Штраф за признак темпа, на котором человек говорил «затянуто», — при полной нетерпимости. */
export const PACE_WEIGHT = 0.06;
/** Наклон к тому, что держит человека, — при «всегда одно и то же»; только вверх. */
export const HOOK_WEIGHT = 0.05;
/** С какого числа ответов про «держало» наклон включается: два ответа — ещё не привычка. */
export const HOOK_MIN = 3;

const PRIOR = 1;
const SIGN: Record<number, number> = { 1: -1, 2: -0.6, 3: 0, 4: 0.6, 5: 1 };
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
/** Россия и СССР — одно, как в taste.ts. */
const countryKey = (c: string): string => { const ru = countryRu(c); return ru === 'СССР' ? 'Россия' : ru; };
/** Ключи авторов: элемент Wikidata (credits, кроме сценаристов) и имя строкой. Имя одного режиссёра приходит то
 *  по-русски, то латиницей («Гай Ричи» в истории, «Guy Ritchie» в справочнике) — элемент их сводит, где он есть. */
export function authorKeys(work: WorkCard): string[] {
  const ids = (work.credits ?? []).filter((c) => c.role !== 'writer').slice(0, 2).map((c) => c.personId);
  return [...new Set([...ids, ...work.creators.slice(0, 2).map((n) => n.trim().toLowerCase())])];
}

export type WorthKind = 'empty' | 'worthy_miss' | 'plain';
/** Какой это ответ: «пусто», «мимо, но стоило» или обычный. */
export function worthKind(rating: Score | undefined, worth: Score): WorthKind {
  if (rating != null && rating >= 4 && worth <= 2) return 'empty';
  if (rating != null && rating <= 2 && worth >= 4) return 'worthy_miss';
  return 'plain';
}

/** Сигнал и вес одного просмотра для оси «стоило»; undefined — сигнала нет. */
export function worthSignal(rating: Score | undefined, worth: Score | undefined): { d: number; v: number } | undefined {
  const guess = rating != null ? inferWorth(rating) : undefined;
  if (worth == null) return guess == null ? undefined : { d: 0, v: INFERRED_WEIGHT };
  const d = SIGN[worth] - (guess != null ? SIGN[guess] : 0);
  return { d: worthKind(rating, worth) === 'plain' ? d : d * DIVERGE, v: 1 };
}

// ---------- темп и «что держало» ----------

export type PaceMark = 'slow' | 'long';
/** Признаки темпа в карточке — только размеченные. Быстрого/плотного темпа в разметке нет. */
export function paceMarks(work: WorkCard): PaceMark[] {
  const out: PaceMark[] = [];
  if (work.barriers.includes('Медленный темп')) out.push('slow');
  if (work.barriers.includes('Долгий хронометраж') || (work.durationMinutes ?? 0) >= 150) out.push('long');
  return out;
}
const PACE_SIGN: Record<AfterPace, number> = { slow: -1, ok: 0.5, fast: 1 };

const HOOK_OPS: Partial<Record<AfterHook, CognitiveOperation>> = {
  plot: 'causal_reasoning', characters: 'perspective_taking', idea: 'abstraction',
};
const WORLD_GENRES = new Set(['фэнтези', 'фантастика']);
/** Насколько в карточке есть то, что держит по этому ответу: 0…1. */
export function hookMatch(work: WorkCard, hook: AfterHook, genresOf?: (w: WorkCard) => string[]): number {
  const op = HOOK_OPS[hook];
  if (op) {
    const m = work.primaryOperations.find((o) => o.op === op)?.intensity ?? 0;
    return hook === 'plot' && work.barriers.includes('Без сюжета в привычном смысле') ? 0 : m;
  }
  // мир: жанры TMDb фэнтези/фантастика и «Непривычная мифология» — грубо, но это то, что есть
  const g = genresOf?.(work) ?? [];
  return g.some((x) => WORLD_GENRES.has(x)) || work.barriers.includes('Непривычная мифология') ? 1 : 0;
}

// ---------- профиль ----------

type Fold = Record<string, number>;
export interface WorthProfile {
  /** сколько явных «Стоило ли?» */
  explicit: number;
  genres: Fold; countries: Fold; creators: Fold; registers: Fold;
  /** терпимость к признаку темпа: −1 (всегда «затянуто») … 1; нет ответов — нет ключа */
  pace: Partial<Record<PaceMark, number>>;
  /** доля ответов «держало» минус равная доля (0,25); пусто — ответов меньше HOOK_MIN */
  hook: Partial<Record<AfterHook, number>>;
  genresOf?: (work: WorkCard) => string[];
}

export function deriveWorthProfile(input: AfterwordInput): WorthProfile | undefined {
  const sums = { genres: new Map<string, [number, number]>(), countries: new Map<string, [number, number]>(), creators: new Map<string, [number, number]>(), registers: new Map<string, [number, number]>() };
  const add = (m: Map<string, [number, number]>, k: string, d: number, v: number) => { const x = m.get(k) ?? [0, 0]; m.set(k, [x[0] + v * d, x[1] + v]); };
  const pace = new Map<PaceMark, [number, number]>();
  const hooks = new Map<AfterHook, number>();
  let explicit = 0;
  let hookN = 0;
  for (const e of input.entries) {
    const a = input.get(e.work.id);
    if (a?.worth) explicit += 1;
    const s = worthSignal(e.rating, a?.worth);
    if (s) {
      for (const g of new Set(input.genresOf?.(e.work) ?? [])) add(sums.genres, g, s.d, s.v);
      for (const c of new Set((e.work.countries ?? []).map(countryKey))) add(sums.countries, c, s.d, s.v);
      for (const p of authorKeys(e.work)) add(sums.creators, p, s.d, s.v);
      for (const r of new Set(e.work.registers ?? [])) add(sums.registers, r, s.d, s.v);
    }
    if (a?.pace) for (const m of paceMarks(e.work)) { const x = pace.get(m) ?? [0, 0]; pace.set(m, [x[0] + PACE_SIGN[a.pace], x[1] + 1]); }
    if (a?.hook) { hooks.set(a.hook, (hooks.get(a.hook) ?? 0) + 1); hookN += 1; }
  }
  if (!explicit && !pace.size && hookN < HOOK_MIN) return undefined;
  const fold = (m: Map<string, [number, number]>): Fold =>
    explicit ? Object.fromEntries([...m].filter(([, [s]]) => s !== 0).map(([k, [s, v]]) => [k, s / (v + PRIOR)])) : {};
  return {
    explicit,
    genres: fold(sums.genres), countries: fold(sums.countries), creators: fold(sums.creators), registers: fold(sums.registers),
    pace: Object.fromEntries([...pace].map(([m, [s, n]]) => [m, s / (n + PRIOR)])),
    hook: hookN >= HOOK_MIN ? Object.fromEntries(HOOKS.map((h) => [h, (hooks.get(h) ?? 0) / (hookN + PRIOR) - 0.25])) : {},
    ...(input.genresOf ? { genresOf: input.genresOf } : {}),
  };
}

/** Сходство кандидата с «стоящим» по расхождениям: −1 (похоже на «пусто») … 1 (похоже на «стоило сверх оценки»).
 *  Жанр и автор — главное, регистр — язык, страна — подсказка. У автора берётся самый сильный знак: «пусто» у
 *  одного режиссёра — про его фильмы, а не про половину. */
export function worthFit(p: WorthProfile, work: WorkCard): number {
  if (!p.explicit) return 0;
  const genre = mean((p.genresOf?.(work) ?? []).map((g) => p.genres[g] ?? 0));
  const country = mean([...new Set((work.countries ?? []).map(countryKey))].map((c) => p.countries[c] ?? 0));
  const creators = authorKeys(work).map((x) => p.creators[x] ?? 0);
  const creator = creators.reduce((best, x) => (Math.abs(x) > Math.abs(best) ? x : best), 0);
  const register = mean((work.registers ?? []).map((r) => p.registers[r] ?? 0));
  return clamp(0.35 * genre + 0.3 * creator + 0.2 * register + 0.15 * country, -1, 1);
}

/** Штраф за темп: только там, где человек чаще говорил «затянуто», и только по размеченным признакам. ≤ 0. */
export function pacePenalty(p: WorthProfile, work: WorkCard): number {
  let t = 0;
  for (const m of paceMarks(work)) t += Math.min(0, p.pace[m] ?? 0);
  return PACE_WEIGHT * Math.max(-1, t);
}

/** Наклон к тому, что держит человека: до +0,05 при сильной привычке, 0 — при равных ответах. Только вверх:
 *  «ни разу не сказал, что держал мир» — не повод опускать фантастику, ответов для этого слишком мало. */
export function hookTilt(p: WorthProfile, work: WorkCard): number {
  let t = 0;
  for (const [h, share] of Object.entries(p.hook) as [AfterHook, number][]) if (share > 0) t += share * hookMatch(work, h, p.genresOf);
  return HOOK_WEIGHT * clamp(t / 0.75, 0, 1);
}

/** Вся поправка послесловий к счёту кандидата. */
export function afterwordBonus(p: WorthProfile, work: WorkCard): number {
  return WORTH_WEIGHT * worthFit(p, work) + pacePenalty(p, work) + hookTilt(p, work);
}

// ---------- сводка на будущее ----------

export interface AfterwordSummary {
  explicit: number;
  kinds: Record<WorthKind, number>;
  pace: Record<AfterPace, number> & { onMark: Partial<Record<PaceMark, Partial<Record<AfterPace, number>>>>; unmarked: Partial<Record<AfterPace, number>> };
  hook: Partial<Record<AfterHook, number>>;
}

/** Что накоплено в послесловиях — для экрана о себе и для будущей разметки темпа/«держало». */
export function afterwordSummary(input: AfterwordInput): AfterwordSummary {
  const out: AfterwordSummary = { explicit: 0, kinds: { empty: 0, worthy_miss: 0, plain: 0 }, pace: { slow: 0, ok: 0, fast: 0, onMark: {}, unmarked: {} }, hook: {} };
  for (const e of input.entries) {
    const a = input.get(e.work.id);
    if (!a) continue;
    if (a.worth) { out.explicit += 1; out.kinds[worthKind(e.rating, a.worth)] += 1; }
    if (a.pace) {
      out.pace[a.pace] += 1;
      const marks = paceMarks(e.work);
      for (const m of marks) { const b = (out.pace.onMark[m] ??= {}); b[a.pace] = (b[a.pace] ?? 0) + 1; }
      if (!marks.length) out.pace.unmarked[a.pace] = (out.pace.unmarked[a.pace] ?? 0) + 1;
    }
    if (a.hook) out.hook[a.hook] = (out.hook[a.hook] ?? 0) + 1;
  }
  return out;
}
