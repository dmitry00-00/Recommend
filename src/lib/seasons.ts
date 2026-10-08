// Новый сезон в дневнике (ЗП-17, 07.10): справочник `seriesSeasons` с сервера (tools/series-seasons.mts,
// TMDb) — по ключу `imdb:tt…` последний вышедший сезон, дата его выхода и анонс следующего. Правило «ждал» —
// то же, что у утренней сводки сервера (worker/seasons.ts): досмотрел сериал до выхода сезона или закрыл все
// сезоны до нового и ещё не начал его. Брошенное и отложенное — без пометки.
import type { JourneyStatus, SeriesProgress, WorkCard } from '@/types/tmdf';

export interface SeasonInfo { n: number; at: string; total?: number; next?: { n: number; at: string }; end?: true }
export type SeasonNote = { kind: 'out'; n: number } | { kind: 'next'; n: number; at: string };

/** Ключ сериала в справочнике сезонов. */
export function seasonKey(work: Pick<WorkCard, 'id' | 'type' | 'externalIds'>): string | undefined {
  if (/^imdb:tt\d{5,10}$/.test(work.id)) return work.id;
  const imdb = work.externalIds?.imdb;
  return work.type === 'series' && imdb && /^tt\d{5,10}$/.test(imdb) ? `imdb:${imdb}` : undefined;
}

/** Что сказать о сезонах у записи дневника: вышел сезон, которого человек ждёт, или когда выйдет следующий. */
export function seasonNote(status: JourneyStatus, progress: SeriesProgress | undefined, finishedAt: string | undefined, info: SeasonInfo | undefined): SeasonNote | undefined {
  if (!info) return undefined;
  const done = Math.max(0, ...(progress?.done ?? []).map((d) => d.season));
  const caughtUp = status === 'finished'
    // досмотрел — значит, всё вышедшее к тому дню; новый сезон — тот, что вышел позже
    ? !finishedAt || info.at > finishedAt.slice(0, 10)
    : status === 'in_progress' && done >= info.n - 1 && (progress?.season ?? 0) < info.n;
  if (caughtUp && info.n >= 2) return { kind: 'out', n: info.n };
  const waiting = status === 'finished' || (status === 'in_progress' && done >= info.n);
  return waiting && info.next ? { kind: 'next', n: info.next.n, at: info.next.at } : undefined;
}
