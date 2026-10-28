import type { ExternalIds, WorkCard } from '@/types/tmdf';
import { isSeries } from '@/lib/media';

/** Ключи произведения (З1, 30.09) — то, чем подписаны разборы, соседи, связи и авторы.
 *  Фильм — `tmdb:<id>`, сериал — `imdb:<id>` (номера TMDb у сериалов свои). Книга — произведение,
 *  а не издание: `wd:<Q>` (элемент Wikidata произведения), иначе `olw:<OL…W>` (работа Open Library),
 *  иначе `own:<8 знаков>` (свой ключ каталога, 27.10: книги, которых нет ни там, ни там), иначе, как раньше, `isbn:<isbn>`. ISBN — это издание: «Солярис» в двух переводах — два ISBN и
 *  одна книга, и разбор у неё один. Главный ключ — первый; остальные — запасные: ими подписаны
 *  данные прежних прогонов, и поиск по ним ведётся, пока прогон не перепишет всё новым ключом.
 *  Фильм без номера TMDb (и сериал без IMDb) — `wd:<Q>`, элемент Wikidata (решение владельца 17.10, 18.10 — в коде):
 *  советская анимация и короткий метр («Ну, погоди!», «Ёжик в тумане») у TMDb есть не всегда. Префикс `wd:` поэтому
 *  бывает и у фильма — книга ли это, решает вид карточки (`isBookEntry`), а не ключ. */

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
  if (isSeries(w)) return ids?.imdb ? [`imdb:${ids.imdb}`] : ids?.wikidata ? [`wd:${ids.wikidata}`] : [];
  if (w.type === 'book') {
    return [
      ...(ids?.wikidata ? [`wd:${ids.wikidata}`] : []),
      ...(ids?.openLibrary ? [`olw:${ids.openLibrary}`] : []),
      ...(ids?.own ? [`own:${ids.own}`] : []),
      ...(ids?.isbn ?? []).map((i) => `isbn:${i}`),
    ];
  }
  if (ids?.tmdb != null) return [`tmdb:${ids.tmdb}`];
  // фильм без TMDb — по элементу Wikidata (18.10)
  if (ids?.wikidata && w.type === 'film') return [`wd:${ids.wikidata}`];
  // карточка без вида «книга», но с ISBN (старые моки) — как книга
  return (ids?.isbn ?? []).map((i) => `isbn:${i}`);
}

export const primaryKey = (w: Keyed, ids: ExternalIds | undefined): string | undefined => workKeys(w, ids)[0];

/** Ключ книги — любого из четырёх видов. Только когда карточки нет: `wd:` с 18.10 бывает и у фильма без TMDb — с карточкой
 *  проверять `isBookEntry`. */
export const isBookKey = (key: string): boolean => /^(?:wd|olw|own|isbn):/.test(key);

/** Книга ли запись «ключ + карточка» (18.10): по виду карточки — `wd:` бывает и у фильма; `olw:`, `own:` и `isbn:` — книга всегда
 *  (старые моки с ISBN без вида «книга» — как книга, см. `workKeys`). Карточки нет — по ключу. */
export const isBookEntry = ({ key, work }: { key: string; work?: Pick<WorkCard, 'type'> }): boolean =>
  work ? work.type === 'book' || /^(?:olw|own|isbn):/.test(key) : isBookKey(key);
