// Справочник инлайн-поиска (`inlineIndex`, tools/inline-index.mts → publish-reference) в памяти сервера. Вынесен из
// worker/inline.ts (19.10): им пользуются и поиск карточек, и подбор «вместе» (worker/togetherPick.ts) — название, год,
// картинка и вид произведения по его ключу.
import type { Env } from './env';

export interface Entry { p: string; k: 'film' | 'series' | 'book' | 'character'; t: string; o?: string; y?: number; s?: string; a?: string[]; i?: string; r?: number }
export interface InlineIdx { at: number; list: Entry[]; keys: string[][]; byId?: Map<string, Entry> }

/** Что знаем о произведении по ключу: название, год, картинка, вид, подпись (режиссёр/автор). */
export interface Known { t: string; y?: number; i?: string; k?: string; s?: string }

let cache: InlineIdx | undefined;
export const norm = (s: string) => s.normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

export async function inlineIndex(env: Env): Promise<InlineIdx | undefined> {
  if (cache && Date.now() - cache.at < 10 * 60e3) return cache;
  const object = await env.REFERENCE?.get('inlineIndex.json');
  if (!object) return cache;
  const list = JSON.parse(await new Response(object.body).text()) as Entry[];
  cache = { at: Date.now(), list, keys: list.map((e) => [e.t, e.o, ...(e.a ?? [])].filter((x): x is string => Boolean(x)).map(norm)) };
  return cache;
}

/** Параметр ссылки `?startapp=` по ключу произведения — тот же, что у «Поделиться»: `tmdb:123` → `w-tmdb_123`. */
export const paramOf = (key: string): string | undefined => {
  const p = `w-${key.replace(':', '_')}`;
  return /^[A-Za-z0-9_-]{1,64}$/.test(p) ? p : undefined;
};

/** Справочник по ключу произведения (`tmdb:123`, `imdb:tt…`, `kp:…`). Нет справочника — всегда undefined. */
export function lookupIn(idx: InlineIdx | undefined): (key: string) => Known | undefined {
  if (idx && !idx.byId) idx.byId = new Map(idx.list.map((e) => [e.p, e]));
  return (key: string) => {
    const p = paramOf(key);
    const e = p ? idx?.byId?.get(p) : undefined;
    return e && { t: e.t, k: e.k, ...(e.y ? { y: e.y } : {}), ...(e.i ? { i: e.i } : {}), ...(e.s ? { s: e.s } : {}) };
  };
}
