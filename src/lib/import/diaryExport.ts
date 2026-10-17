// Выгрузка дневника (ДФ-14): CSV в импорт-формате Letterboxd с добавочными колонками и полный JSON.
// CSV читается обратно нашим же импортом без потерь (`letterboxdImport` знает добавочные колонки);
// Letterboxd берёт из него фильмы по tmdbID/imdbID, лишние колонки пропускает.
import type { AbandonReason, Afterword, ExternalIds, ISODate, JourneyStatus, MediaType, PerceivedDifficulty } from '@/types/tmdf';

export interface DiaryRow {
  workId: string;
  type: MediaType;
  title: string;
  originalTitle?: string;
  year?: number;
  status: JourneyStatus;
  /** оценка 1–5 приложения */
  rating?: 1 | 2 | 3 | 4 | 5;
  /** исходная оценка импорта по шкале 0–10 — точнее, чем `rating` */
  raw?: number;
  startedAt?: ISODate;
  finishedAt?: ISODate;
  ids: ExternalIds;
  perceivedDifficulty?: PerceivedDifficulty;
  abandonReason?: AbandonReason;
  reflections?: { promptId: string; answer: string }[];
  /** отмечено списком «уже видел», без дневника */
  seenList?: boolean;
  /** послесловие (17.10): «стоило ли», темп, что держало */
  afterword?: Afterword;
}

/** Первые семь — колонки импорта Letterboxd, дальше наши; Worth/Pace/Hook — послесловие (17.10), импорт их пропускает. */
export const DIARY_COLUMNS = [
  'Title', 'Year', 'Rating10', 'WatchedDate', 'Rewatch', 'tmdbID', 'imdbID',
  'Type', 'Status', 'StartedDate', 'OriginalTitle', 'WikidataID', 'KinopoiskID', 'ISBN', 'OpenLibraryID', 'TmdbTvID',
  'Worth', 'Pace', 'Hook',
] as const;

const cell = (v: string | number | undefined): string => {
  const s = v == null ? '' : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Оценка по шкале 0–10: исходная из импорта, иначе 1–5 приложения вдвое (5 → 10, как пять звёзд Letterboxd). */
export const rating10 = (r: Pick<DiaryRow, 'rating' | 'raw'>): number | undefined => r.raw ?? (r.rating != null ? r.rating * 2 : undefined);

export function diaryCsv(rows: DiaryRow[]): string {
  const lines = rows.map((r) => [
    r.title, r.year, rating10(r), r.finishedAt, '',
    // у сериала номер TMDb из своего пространства: Letterboxd по нему найдёт не тот фильм
    r.type === 'film' ? r.ids.tmdb : undefined, r.ids.imdb,
    r.type, r.status, r.startedAt, r.originalTitle, r.ids.wikidata, r.ids.kinopoisk, r.ids.isbn?.join(' '), r.ids.openLibrary,
    r.type === 'series' ? r.ids.tmdb : undefined,
    r.afterword?.worth, r.afterword?.pace, r.afterword?.hook,
  ].map(cell).join(','));
  // BOM — чтобы Excel узнал UTF-8 и не показал кириллицу кракозябрами; наш разбор его снимает
  return `\uFEFF${[DIARY_COLUMNS.join(','), ...lines].join('\r\n')}\r\n`;
}

export function diaryJson(rows: DiaryRow[], exportedAt: string): string {
  return JSON.stringify({
    format: 'recomend-diary', version: 1, exportedAt,
    entries: rows.map((r) => ({ ...r, rating10: rating10(r) })),
  }, null, 2);
}
