// Послесловие (17.10, владелец): когда спрашивать «Стоило ли?» после оценки и какой один вопрос о человеке задать.
//
// «Понравилось» и «стоило» чаще совпадают, ценность — в расхождениях. Поэтому «Стоило ли?» — не всегда:
//   «Нормально» — всегда: исход непредсказуем;
//   «Хорошо/Отлично» — если вещь лёгкая для человека (ниже его привычного уровня): там «понравилось, но пусто»;
//   «Слабо/Мимо» — если вещь сложная для человека или громкая/канон: там «не понравилось, но стоило»;
//   остальным — изредка (≈1 из 10, устойчиво по работе), чтобы проверять, верно ли угадываем неспрошенное.
// Неспрошенное угадывается мягко (inferWorth) и весит меньше заданного.
// Дополнительный вопрос — один, по очереди «темп» / «что держало», не чаще чем через просмотр.
import type { AfterHook, AfterPace, Afterword } from '@/types/tmdf';

export type Score = 1 | 2 | 3 | 4 | 5;
export type Extra = 'pace' | 'hook';
export const PACES: AfterPace[] = ['slow', 'ok', 'fast'];
export const HOOKS: AfterHook[] = ['plot', 'characters', 'world', 'idea'];

/** насколько ниже/выше привычного уровня вещь должна быть, чтобы расхождение было вероятным */
const GAP = 1.5;
/** доля «контрольных» вопросов там, где ответ угадывается */
const SAMPLE = 0.1;

export interface AskInput {
  rating: Score;
  /** уровень сложности вещи (WorkCard.complexityLevel), если размечен */
  workLevel?: number;
  /** привычный уровень человека (CognitiveState.complexityComfort), если посчитан */
  comfort?: number;
  /** известность 0–3 (src/mocks/fame.ts) или признак канона */
  fame?: number;
  workId: string;
}

/** Устойчивое «случайное» число 0..1 по id работы: один и тот же фильм у человека всегда в одной корзине. */
export function stableUnit(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 10000) / 10000;
}

export function shouldAskWorth({ rating, workLevel, comfort, fame = 0, workId }: AskInput): boolean {
  if (rating === 3) return true;
  const gap = workLevel != null && comfort != null ? workLevel - comfort : 0;
  if (rating >= 4 && gap <= -GAP) return true;
  if (rating <= 2 && (gap >= GAP || fame >= 2)) return true;
  return stableUnit(`worth:${workId}`) < SAMPLE;
}

/** Угаданное «стоило» для неспрошенного: совпадает с оценкой, «Нормально» — неизвестно. */
export function inferWorth(rating: Score): Score | undefined {
  return rating >= 4 ? 4 : rating <= 2 ? 2 : undefined;
}

/** Какой дополнительный вопрос задать после этого просмотра: по очереди, не два просмотра подряд.
 *  `asked` — сколько послесловий с доп. вопросом уже есть, `lastWasExtra` — был ли он в прошлый раз. */
export function nextExtra(asked: number, lastWasExtra: boolean): Extra | null {
  if (lastWasExtra) return null;
  return asked % 2 === 0 ? 'pace' : 'hook';
}

/** Сколько в истории доп. вопросов и был ли последний — для nextExtra. Записи сортируются по `at`. */
export function extraHistory(afterwords: Iterable<Afterword>): { asked: number; lastWasExtra: boolean } {
  const list = [...afterwords].filter((a) => a.at).sort((a, b) => (a.at! < b.at! ? -1 : 1));
  const asked = list.filter((a) => a.pace || a.hook).length;
  const last = list[list.length - 1];
  return { asked, lastWasExtra: Boolean(last && (last.pace || last.hook)) };
}
