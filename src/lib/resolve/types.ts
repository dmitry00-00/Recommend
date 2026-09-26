import type { ExternalIds, ImageSource, MediaType, WatchOption } from '@/types/tmdf';

/** Что резолвер знает о произведении: всё, из чего собирается `WorkCard` без разметки. */
export interface ResolvedWork {
  type: MediaType;
  title?: string;
  originalTitle?: string;
  year?: number;
  creators?: string[];
  countries?: string[];
  durationMinutes?: number;
  pages?: number;
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
