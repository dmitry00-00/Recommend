import type { ISODate, MediaType } from '@/types/tmdf';

/** letterboxd — экспорт аккаунта; letterboxd_import — импорт-формат Letterboxd (его отдают
 *  конвертеры с Кинопоиска); kinopoisk — текстовый список «не найдено» того же конвертера. */
/** trakt — выгрузка Trakt (JSON-файлы в форме их API: watched-*, ratings-*, watchlist-*, history-*; ЗП-25). */
/** plain_list — просто список названий, по одному в строке: так люди присылают просмотренное
 *  чаще всего, и у владельца именно так пришло 70% истории (22.09). Оценок и дат там нет. */
export type ImportSource =
  | 'letterboxd' | 'letterboxd_import' | 'imdb' | 'goodreads' | 'storygraph' | 'kinopoisk' | 'plain_list' | 'trakt';
/** Вид записи. С Е5 (30.09) сериал — полноправный вид (`MediaType` включает `'series'`):
 *  сопоставляется и резолвится, как фильм. Псевдоним оставлен для чужого кода. */
export type ImportedMediaType = MediaType;
/** Файл выгрузки: текст, а с именем — когда формат по содержимому не отличить (`watched.csv` и
 *  `watchlist.csv` Letterboxd — одинаковые колонки). */
export type ExportFile = string | { name: string; text: string };
export type ImportStatus = 'finished' | 'in_progress' | 'planned';

/** Одна строка чужого экспорта, приведённая к общему виду. Оценка — по шкале 0–10,
 *  чтобы источники были сравнимы; в интерфейс она не попадает (правило 4). */
export interface ImportedRecord {
  source: ImportSource;
  type: ImportedMediaType;
  /** может быть пустым, если у источника есть только ID — тогда сопоставление по ID */
  title: string;
  originalTitle?: string;
  year?: number;
  status: ImportStatus;
  rating?: number;
  date?: ISODate;
  rewatch?: boolean;
  externalIds?: { imdb?: string; tmdb?: number; kinopoisk?: number; isbn?: string[] };
}
