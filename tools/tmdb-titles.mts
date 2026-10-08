// Чужое название по TMDb (ЗП-23, 07.10) — два последних класса ошибок английских привязок:
//   · тёзка поближе по году: «Missing - Movie Review» (2023) — не «Пропавший без вести» 1982 года, а
//     скринлайф 2023-го; «Joy Ride» (2023 / 2001). Ролик вышел, когда в прокате был другой фильм с тем же
//     названием, — он о нём;
//   · наше название — хвост чужого: «Avengers Doomsday Marketing» — не сериал «Doomsday» 2022 года, а
//     «Avengers: Doomsday». Слова перед названием вместе с ним — настоящее название из TMDb. «Star Wars:
//     Andor» так не срежется: в TMDb сериал называется «Andor».
// Тёзка — только заметный (`MIN_VOTES` голосов в TMDb): у названий вроде «Missing» десятки безвестных
// короткометражек. Ответы TMDb — в .cache/tmdb-titles.json, второй прогон в сеть не ходит.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

export interface TmdbTitle { id: string; title: string; original: string; year?: number; votes: number; tv?: true }

const FILE = new URL('../.cache/tmdb-titles.json', import.meta.url);
const cache: Record<string, TmdbTitle[]> = existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf8')) : {};
let dirty = 0;
const MIN_VOTES = 150;

/** Название для сравнения: регистр, знаки, «&» и «and», артикль в начале — не в счёт. */
export const normTitle = (s: string): string => s.toLowerCase().replace(/&/g, ' and ').replace(/[’']/g, '')
  .replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/^(?:the|a|an) /, '');

async function search(query: string): Promise<TmdbTitle[]> {
  const key = normTitle(query);
  if (cache[key]) return cache[key];
  const token = process.env.VITE_TMDB_API_KEY ?? process.env.TMDB_API_KEY;
  if (!token) return [];
  const url = new URL('https://api.themoviedb.org/3/search/multi');
  url.searchParams.set('query', query);
  url.searchParams.set('include_adult', 'false');
  const bearer = token.length > 40;
  if (!bearer) url.searchParams.set('api_key', token);
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, { headers: bearer ? { authorization: `Bearer ${token}` } : {} }).catch(() => undefined);
    if (res?.status === 429) { await new Promise((r) => setTimeout(r, 1500)); continue; }
    if (!res?.ok) return [];
    const body = await res.json() as { results?: { id: number; media_type: string; title?: string; name?: string; original_title?: string; original_name?: string; release_date?: string; first_air_date?: string; vote_count?: number }[] };
    const out = (body.results ?? []).filter((r) => r.media_type === 'movie' || r.media_type === 'tv').map((r) => ({
      id: `tmdb:${r.media_type === 'tv' ? 'tv/' : ''}${r.id}`,
      title: r.title ?? r.name ?? '', original: r.original_title ?? r.original_name ?? '',
      year: Number((r.release_date || r.first_air_date || '').slice(0, 4)) || undefined,
      votes: r.vote_count ?? 0, ...(r.media_type === 'tv' ? { tv: true as const } : {}),
    }));
    cache[key] = out;
    if (++dirty % 50 === 0) save();
    return out;
  }
  return [];
}

export function save() { if (dirty) writeFileSync(FILE, JSON.stringify(cache)); }

const same = (t: TmdbTitle, name: string) => [t.title, t.original].some((x) => x && normTitle(x) === normTitle(name));

// ролик о старой вещи: ретро, пересмотр, издание (07.10 — «The Abyss (Special Edition)», «Does THE CROW Still Hold Up»)
const RETRO = /\b(?:retro(?:spective)?|revisit(?:ed|ing)?|rewatch|years later|anniversary|classic|holds? up|look(?:ing)? back|special edition|director'?s cut|remaster(?:ed)?|restor(?:ed|ation)|4k|blu-?ray|criterion|original vs|vs\.? remake|book vs)/i;
// о сериале: тёзка-сериал у фильма — только при разговоре о сериале («Willow Review Episode 7», «WATCHMEN (HBO) 1x4»)
const SERIES = /\b(?:seasons?|episodes?|series|tv show|show|s\d{1,2}\s*e\d{1,3}|\d{1,2}x\d{1,2}|hbo|disney\+|netflix|prime video|apple tv|after-?show|finale|premiere)\b/i;
const BOOK = /\b(?:books?|read(?:ing)?|novel|chapters?|audiobook)\b/i;
// до выхода тёзки о нём говорят трейлер и анонс; рецензия за год до тёзки — о старом
const AHEAD = /\b(?:trailers?|teasers?|first look|announce\w*|cast(?:ing)?|reboot|remake|leaks?|rumou?rs?)\b/i;

/** Заметный тёзка, вышедший около даты ролика (в тот же год или годом раньше; годом позже — только
 *  трейлер и анонс), а наша вещь старше ролика лет на пять. Год нашей вещи в тексте, ретро-слова — ролик
 *  о ней. Тёзка-сериал у фильма — только когда ролик говорит о сериале. `ownIds` — ключи TMDb нашей вещи. */
export async function nearNamesake(name: string, year: number | undefined, publishedAt: string | undefined, ownIds: string[],
  video: { title: string; description?: string; kind: 'film' | 'series' | 'book' }): Promise<TmdbTitle | undefined> {
  const pub = publishedAt ? Number(publishedAt.slice(0, 4)) : NaN;
  if (!year || !Number.isFinite(pub) || pub - year < 5) return undefined;
  if (new RegExp(`\\b${year}\\b`).test(`${video.title}\n${video.description ?? ''}`) || RETRO.test(video.title)) return undefined;
  // у книги тёзка — экранизация: ролик о ней, только если он о фильме или сериале и не о книге
  // («Fahrenheit 451 - Book Review», «we read The Count of Monte Cristo» — о романе)
  if (video.kind === 'book' && (BOOK.test(video.title) || !(SERIES.test(video.title) || /\b(?:movie|film)\b/i.test(video.title)))) return undefined;
  const film = video.kind === 'film';
  const found = await search(name);
  return found.find((t) => same(t, name) && !ownIds.includes(t.id) && t.year != null && Math.abs(t.year - year) >= 3
    && t.year >= pub - 1 && (t.year <= pub || (t.year === pub + 1 && AHEAD.test(video.title))) && t.votes >= MIN_VOTES
    && (!t.tv || !film || SERIES.test(video.title)));
}

/** Слова перед нашим названием в заголовке вместе с ним — заметное чужое название из TMDb («Avengers
 *  Doomsday» → «Avengers: Doomsday»). Берём одно, два и три слова с заглавной перед названием. */
export async function longerTitle(videoTitle: string, name: string, ownNames: string[], ownIds: string[]): Promise<TmdbTitle | undefined> {
  const at = videoTitle.toLowerCase().indexOf(name.toLowerCase());
  if (at <= 0) return undefined;
  const words = videoTitle.slice(0, at).replace(/[:\-–—|]+\s*$/, '').trim().split(/\s+/).filter(Boolean);
  const own = new Set(ownNames.map(normTitle));
  for (let k = 1; k <= Math.min(3, words.length); k++) {
    const lead = words.slice(-k);
    if (!/^[A-Z0-9]/.test(lead[0])) break;
    const span = `${lead.join(' ')} ${name}`;
    if (own.has(normTitle(span))) return undefined;
    const hit = (await search(span)).find((t) => same(t, span) && !ownIds.includes(t.id) && t.votes >= MIN_VOTES);
    if (hit) return hit;
  }
  return undefined;
}
