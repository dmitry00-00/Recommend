import type { ExternalIds, WorkCard } from '@/types/tmdf';
import type { ImportedRecord } from '@/lib/import/types';
import type { ResolvedWork } from './types';
import { fromWikidata, lookupFilms } from './wikidata';
import { createTmdb, type TmdbClient } from './tmdb';
import { createKinopoisk, type KinopoiskClient } from './kinopoisk';
import { lookupBook } from './openLibrary';

export { createTmdb, TMDB_ATTRIBUTION } from './tmdb';
export { createKinopoisk } from './kinopoisk';
export { lookupFilms } from './wikidata';
export { lookupBook } from './openLibrary';
export type { ResolvedWork } from './types';

export interface ResolveOptions {
  tmdb?: TmdbClient;
  kp?: KinopoiskClient;
  fetcher?: typeof fetch;
}

/** Своё поле главнее внешнего; пустое (undefined, '', []) не считается своим. */
const pick = <T>(own: T | undefined, ext: T | undefined): T | undefined =>
  own === undefined || own === '' || (Array.isArray(own) && !own.length) ? ext : own;

const merge = (base: ResolvedWork, add: Partial<ResolvedWork> | undefined, source: ResolvedWork['sources'][number]): ResolvedWork => {
  if (!add) return base;
  const ids: ExternalIds = { ...base.externalIds };
  for (const k of ['imdb', 'tmdb', 'wikidata', 'kinopoisk'] as const) {
    if (ids[k] == null && add.externalIds?.[k] != null) (ids as Record<string, unknown>)[k] = add.externalIds[k];
  }
  if (!ids.isbn?.length && add.externalIds?.isbn?.length) ids.isbn = add.externalIds.isbn;
  return {
    type: base.type,
    title: pick(base.title, add.title),
    originalTitle: pick(base.originalTitle, add.originalTitle),
    year: pick(base.year, add.year),
    creators: pick(base.creators, add.creators),
    countries: pick(base.countries, add.countries),
    durationMinutes: pick(base.durationMinutes, add.durationMinutes),
    pages: pick(base.pages, add.pages),
    coverUrl: pick(base.coverUrl, add.coverUrl),
    stillUrl: pick(base.stillUrl, add.stillUrl),
    imageSource: pick(base.imageSource, add.imageSource),
    blurb: pick(base.blurb, add.blurb),
    watch: pick(base.watch, add.watch),
    externalIds: ids,
    sources: [...base.sources, source],
  };
};

/** Записи импорта → всё, что можно узнать без разметки: сначала Wikidata пачкой (ID и базовые
 *  поля), потом TMDb по одному (картинки, русское название) — если есть клиент, потом
 *  Open Library для книг. Собственные поля записи (название со страницы Кинопоиска, год)
 *  главнее внешних: это то, что человек видел у себя. */
export async function resolveRecords(records: ImportedRecord[], options: ResolveOptions = {}): Promise<ResolvedWork[]> {
  const fetcher = options.fetcher ?? fetch;
  const base: ResolvedWork[] = records.map((r) => ({
    type: r.type === 'book' ? 'book' : 'film',
    title: r.title || undefined,
    originalTitle: r.originalTitle,
    year: r.year,
    externalIds: { ...r.externalIds },
    sources: [],
  }));

  const kp = base.filter((w) => w.type === 'film' && w.externalIds.kinopoisk != null).map((w) => String(w.externalIds.kinopoisk));
  const imdbOnly = base.filter((w) => w.type === 'film' && w.externalIds.kinopoisk == null && w.externalIds.imdb).map((w) => w.externalIds.imdb!);
  const [byKp, byImdb] = await Promise.all([
    kp.length ? lookupFilms('kinopoisk', kp, fetcher) : new Map(),
    imdbOnly.length ? lookupFilms('imdb', imdbOnly, fetcher) : new Map(),
  ]);

  const out: ResolvedWork[] = [];
  for (const w of base) {
    let cur = w;
    if (cur.type === 'film') {
      const wd = (cur.externalIds.kinopoisk != null ? byKp.get(String(cur.externalIds.kinopoisk)) : undefined)
        ?? (cur.externalIds.imdb ? byImdb.get(cur.externalIds.imdb) : undefined);
      if (wd) cur = merge(cur, fromWikidata(wd), 'wikidata');
      if (options.kp && cur.externalIds.kinopoisk != null) {
        try {
          const kpId = cur.externalIds.kinopoisk;
          cur = merge(cur, await options.kp.film(kpId), 'kinopoisk_unofficial');
          cur = merge(cur, { watch: await options.kp.watch(kpId) }, 'kinopoisk_unofficial');
        } catch { /* лимит или сбой — карточка без картинок Кинопоиска */ }
      }
      if (options.tmdb) {
        try {
          const id = cur.externalIds.tmdb ?? (cur.externalIds.imdb ? await options.tmdb.findByImdb(cur.externalIds.imdb) : undefined);
          if (id != null) {
            cur = merge(cur, await options.tmdb.movie(id), 'tmdb');
            if (!cur.watch?.length) cur = merge(cur, { watch: await options.tmdb.watch(id) }, 'tmdb');
          }
        } catch { /* TMDb недоступен — карточка остаётся без картинок */ }
      }
    } else {
      const isbn = cur.externalIds.isbn?.[0];
      if (isbn) {
        try { cur = merge(cur, await lookupBook(isbn, fetcher), 'open_library'); } catch { /* без обложки */ }
      }
    }
    out.push(cur);
  }
  return out;
}

/** Карточка без разметки: операции пусты, сложность 0 — экраны показывают это словами. */
export function toWorkCard(w: ResolvedWork, id: string): WorkCard {
  return {
    id,
    type: w.type,
    title: w.title ?? w.originalTitle ?? '',
    originalTitle: w.originalTitle && w.originalTitle !== w.title ? w.originalTitle : undefined,
    year: w.year ?? 0,
    creators: w.creators ?? [],
    countries: w.countries,
    coverUrl: w.coverUrl,
    stillUrl: w.stillUrl,
    imageSource: w.imageSource,
    blurb: w.blurb,
    watch: w.watch,
    durationMinutes: w.durationMinutes,
    pages: w.pages,
    primaryOperations: [],
    complexityLevel: 0,
    warnings: [],
    barriers: [],
    isNicheMasterpiece: false,
    externalIds: w.externalIds,
  };
}

/** Картинки, описание и «где посмотреть» для уже известных карточек — по ID, с кэшем на
 *  сессию. Кинопоиск (неофициальный) — первым: у него кадр, описание по-русски и кинотеатры;
 *  без ID Кинопоиска ищем его по IMDb. TMDb — вторым, книги — Open Library всегда. */
const enrichCache = new Map<string, Partial<WorkCard>>();
const STORE_KEY = 'tm.media.v1';
const STORE_TTL = 7 * 24 * 3600 * 1000;
type Stored = Record<string, { at: number; v: Partial<WorkCard> }>;
function readStore(): Stored {
  try { return JSON.parse(globalThis.localStorage?.getItem(STORE_KEY) ?? '{}') as Stored; } catch { return {}; }
}
function remember(key: string, v: Partial<WorkCard>) {
  enrichCache.set(key, v);
  if (!Object.keys(v).length) return; // пустой результат не запоминаем: лимит сегодня — не навсегда
  try {
    const store = readStore();
    store[key] = { at: Date.now(), v };
    globalThis.localStorage?.setItem(STORE_KEY, JSON.stringify(store));
  } catch { /* приватный режим или нет места — живём с кэшем сессии */ }
}
function recall(key: string): Partial<WorkCard> | undefined {
  if (enrichCache.has(key)) return enrichCache.get(key);
  const hit = readStore()[key];
  if (hit && Date.now() - hit.at < STORE_TTL) { enrichCache.set(key, hit.v); return hit.v; }
  return undefined;
}

export async function withImages(cards: WorkCard[], tmdb?: TmdbClient, kp?: KinopoiskClient, fetcher: typeof fetch = fetch): Promise<WorkCard[]> {
  return Promise.all(cards.map(async (card) => {
    if (card.stillUrl && card.watch) return card;
    const ids = card.externalIds;
    const key = ids?.kinopoisk != null ? `kp:${ids.kinopoisk}` : ids?.tmdb != null ? `tmdb:${ids.tmdb}` : ids?.imdb ? `imdb:${ids.imdb}` : ids?.isbn?.[0] ? `isbn:${ids.isbn[0]}` : undefined;
    if (!key) return card;
    if (!recall(key)) {
      let found: Partial<WorkCard> = {};
      try {
        if (card.type === 'book' && ids?.isbn?.[0]) {
          const b = await lookupBook(ids.isbn[0], fetcher);
          found = { coverUrl: b?.coverUrl, imageSource: b?.imageSource };
        } else if (card.type === 'film') {
          if (kp) {
            const kpId = ids?.kinopoisk ?? (ids?.imdb ? await kp.findByImdb(ids.imdb) : undefined);
            if (kpId != null) {
              const f = await kp.film(kpId);
              const watch = await kp.watch(kpId).catch(() => undefined);
              found = { coverUrl: f?.coverUrl, stillUrl: f?.stillUrl, imageSource: f?.imageSource, blurb: f?.blurb, watch,
                externalIds: { ...ids, kinopoisk: kpId } };
            }
          }
          if ((!found.stillUrl || !found.watch?.length) && tmdb) {
            const id = ids?.tmdb ?? (ids?.imdb ? await tmdb.findByImdb(ids.imdb) : undefined);
            const m = id != null ? await tmdb.movie(id) : undefined;
            const watch = id != null && !found.watch?.length ? await tmdb.watch(id).catch(() => undefined) : found.watch;
            found = { ...found, coverUrl: found.coverUrl ?? m?.coverUrl, stillUrl: found.stillUrl ?? m?.stillUrl,
              imageSource: found.imageSource ?? m?.imageSource, blurb: found.blurb ?? m?.blurb, watch };
          }
        }
      } catch { /* сеть или лимит — карточка как есть */ }
      remember(key, found);
    }
    const found = recall(key) ?? {};
    return { ...card, ...found, coverUrl: card.coverUrl ?? found.coverUrl, stillUrl: card.stillUrl ?? found.stillUrl, blurb: card.blurb ?? found.blurb, watch: card.watch ?? found.watch };
  }));
}

/** Ключ → прямой клиент (Node); `'proxy'` → клиент через `/kp-api` без ключа (браузер за dev-сервером). */
export function kinopoiskFromEnv(key: string | 'proxy' | undefined, fetcher: typeof fetch = fetch): KinopoiskClient | undefined {
  if (!key) return undefined;
  return key === 'proxy' ? createKinopoisk(undefined, fetcher) : createKinopoisk(key, fetcher);
}

export function tmdbFromEnv(key: string | undefined, fetcher: typeof fetch = fetch): TmdbClient | undefined {
  return key ? createTmdb(key, fetcher) : undefined;
}
