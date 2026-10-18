// Трейлеры с сервера (17.10, владелец): раньше клиент искал трейлер в момент смахивания карточки — прокси TMDb,
// русский, потом английский, — и на 200 фильмах справочника русский находился у 15 %, у 43 % не находилось ничего,
// а ожидание было на глазах у человека. Теперь их собирают ночью (tools/trailers.mts: TMDb, Wikidata, каналы
// прокатчиков, проверка YouTube) и кладут справочником `trailers` (tools/publish-reference.mts).
//
// GET /api/trailers?keys=tmdb:27205,tv:1399 — до 40 ключей (фильм `tmdb:<n>`, сериал `tv:<n>` — номер TMDb из ряда
// /tv/, фильм без TMDb — `wd:Q…`, 18.10), ответ `{ [ключ]: TrailerItem[] }` только для ключей из справочника. `[]` — проверено, роликов нет (живой TMDb
// спрашивать незачем); ключа в ответе нет — работа не проверена. Без справочника — `{}`, а не ошибка.
import type { Env } from './env';

/** Ролик справочника. k — id YouTube; l — язык ('ru', 'en', … или '' — неизвестен); t — трейлер или тизер; s — источник
 *  (own — trailersOwn.ts, ch — канал прокатчика, tmdb, wd — Wikidata); n — название; o — официальный (TMDb);
 *  d — дата публикации; ru: 0 — закрыт в России (годится не-русским зрителям). */
export interface TrailerItem { k: string; l: string; t: 'T' | 'S'; s: 'own' | 'ch' | 'tmdb' | 'wd'; n?: string; o?: 1; d?: string; ru?: 0 }
export interface TrailersFile { at: string; works: Record<string, TrailerItem[]> }

// imdb:tt… — сериал: клиент номера /tv/ не знает, сборщик кладёт его ролики и под IMDb (17.10);
// wd:Q… — фильм без TMDb, ролик P1651 его элемента Wikidata (решение владельца 17.10, 18.10)
export const TRAILER_KEY = /^(?:(?:tmdb|tv):\d{1,8}|imdb:tt\d{5,10}|wd:Q\d{1,12})$/;
export const MAX_TRAILER_KEYS = 40;

/** Ключи из `?keys=`: через запятую, без повторов, чужие отбрасываются, больше 40 — только первые 40. */
export function trailerKeys(raw: string | null | undefined): string[] {
  const out: string[] = [];
  for (const k of (raw ?? '').split(',')) {
    const key = k.trim();
    if (!TRAILER_KEY.test(key) || out.includes(key)) continue;
    out.push(key);
    if (out.length >= MAX_TRAILER_KEYS) break;
  }
  return out;
}

/** Только запрошенные ключи, которые есть в справочнике. */
export function pickWorks(works: Record<string, TrailerItem[]>, keys: string[]): Record<string, TrailerItem[]> {
  const out: Record<string, TrailerItem[]> = {};
  for (const k of keys) if (Object.prototype.hasOwnProperty.call(works, k)) out[k] = works[k];
  return out;
}

// Справочник — разобранным в памяти до смены файла: на bothost REFERENCE.get — это stat и буфер из памяти
// (server/index.js), на Cloudflare — чтение R2, поэтому заглядываем не чаще раза в минуту; новая публикация
// сбрасывает копию сразу (forgetTrailers из putReference).
let held: { etag: string; checked: number; works: Record<string, TrailerItem[]> } | undefined;
export const forgetTrailers = () => { held = undefined; loading = undefined; };
// одно чтение на всех (18.10, проверка перед выкладкой): одновременные первые запросы не разбирают 5 МБ каждый сам
let loading: Promise<Record<string, TrailerItem[]>> | undefined;

function trailerWorks(env: Env): Promise<Record<string, TrailerItem[]>> {
  if (held && Date.now() - held.checked < 60e3) return Promise.resolve(held.works);
  return (loading ??= readTrailerWorks(env).finally(() => { loading = undefined; }));
}

async function readTrailerWorks(env: Env): Promise<Record<string, TrailerItem[]>> {
  const object = await env.REFERENCE?.get('trailers.json').catch(() => null);
  if (!object) { held = { etag: '', checked: Date.now(), works: {} }; return held.works; }
  if (held && held.etag && held.etag === object.httpEtag) {
    await object.body.cancel?.().catch(() => undefined);
    held.checked = Date.now();
    return held.works;
  }
  try {
    const data = JSON.parse(await new Response(object.body).text()) as Partial<TrailersFile>;
    held = { etag: object.httpEtag, checked: Date.now(), works: data.works && typeof data.works === 'object' ? data.works : {} };
  } catch (err) {
    console.error('trailers.json:', err);
    held = { etag: '', checked: Date.now(), works: held?.works ?? {} };
  }
  return held.works;
}

export async function getTrailers(env: Env, url: URL): Promise<Response> {
  const keys = trailerKeys(url.searchParams.get('keys'));
  const works = keys.length ? await trailerWorks(env) : {};
  // справочник меняется раз в сутки: час в кэше телефона и прокси не страшен
  return Response.json(pickWorks(works, keys), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
}
