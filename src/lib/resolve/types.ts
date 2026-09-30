import type { Credit, SeriesInfo, ExternalIds, ImageSource, MediaType, WatchOption } from '@/types/tmdf';

/** Что резолвер знает о произведении: всё, из чего собирается `WorkCard` без разметки. */
export interface ResolvedWork {
  type: MediaType;
  title?: string;
  originalTitle?: string;
  year?: number;
  creators?: string[];
  /** авторы с элементом Wikidata и ролью (Д1) */
  credits?: Credit[];
  countries?: string[];
  durationMinutes?: number;
  pages?: number;
  /** сериал: сезоны, серии, идёт ли (Е1) */
  series?: SeriesInfo;
  coverUrl?: string;
  stillUrl?: string;
  imageSource?: ImageSource;
  blurb?: string;
  watch?: WatchOption[];
  externalIds: ExternalIds;
  /** откуда что пришло — для провенанса на кураторской стороне */
  sources: ('wikidata' | 'tmdb' | 'open_library' | 'kinopoisk_unofficial')[];
}

export type Fetch = typeof fetch;
