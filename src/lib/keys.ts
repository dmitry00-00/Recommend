import type { ExternalIds, WorkCard } from '@/types/tmdf';
import { isSeries } from '@/lib/media';

/** Ключи произведения (З1, 30.09) — то, чем подписаны разборы, соседи, связи и авторы.
 *  Фильм — `tmdb:<id>`, сериал — `imdb:<id>` (номера TMDb у сериалов свои). Книга — произведение,
 *  а не издание: `wd:<Q>` (элемент Wikidata произведения), иначе `olw:<OL…W>` (работа Open Library),
 *  иначе, как раньше, `isbn:<isbn>`. ISBN — это издание: «Солярис» в двух переводах — два ISBN и
 *  одна книга, и разбор у неё один. Главный ключ — первый; остальные — запасные: ими подписаны
 *  данные прежних прогонов, и поиск по ним ведётся, пока прогон не перепишет всё новым ключом. */

type Keyed = Pick<WorkCard, 'type'> & { format?: 'series' };

/** Мост «ISBN → произведение» (tools/resolve-book-works.mts): у карточки книги самой по себе
 *  элемента Wikidata и работы Open Library может не быть — только ISBN из экспорта. */
export type BookWorks = Readonly<Record<string, { olw?: string; wd?: string }>>;

/** Внешние ключи книги, дополненные мостом по ISBN. */
export function withBookWork(ids: ExternalIds | undefined, bridge: BookWorks = {}): ExternalIds | undefined {
  if (!ids?.isbn?.length || (ids.wikidata && ids.openLibrary)) return ids;
  const hit = ids.isbn.map((i) => bridge[i]).find(Boolean);
  if (!hit) return ids;
  return { ...ids, ...(!ids.openLibrary && hit.olw ? { openLibrary: hit.olw } : {}), ...(!ids.wikidata && hit.wd ? { wikidata: hit.wd } : {}) };
}

export function workKeys(w: Keyed, ids: ExternalIds | undefined): string[] {
  if (isSeries(w)) return ids?.imdb ? [`imdb:${ids.imdb}`] : [];
  if (w.type === 'book') {
    return [
      ...(ids?.wikidata ? [`wd:${ids.wikidata}`] : []),
      ...(ids?.openLibrary ? [`olw:${ids.openLibrary}`] : []),
      ...(ids?.isbn ?? []).map((i) => `isbn:${i}`),
    ];
  }
  if (ids?.tmdb != null) return [`tmdb:${ids.tmdb}`];
  // карточка без вида «книга», но с ISBN (старые моки) — как книга
  return (ids?.isbn ?? []).map((i) => `isbn:${i}`);
}

export const primaryKey = (w: Keyed, ids: ExternalIds | undefined): string | undefined => workKeys(w, ids)[0];

/** Ключ книги — любого из трёх видов. */
export const isBookKey = (key: string): boolean => /^(?:wd|olw|isbn):/.test(key);
