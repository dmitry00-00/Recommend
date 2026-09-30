import type { SeriesInfo } from '@/types/tmdf';
import type { ResolvedWork } from './types';

/** TMDb: постер, кадр (backdrop), название на русском, хронометраж, режиссёр. Нужен ключ v3;
 *  условия TMDb: некоммерческое использование с атрибуцией — строка `ATTRIBUTION` обязана
 *  быть на экране, где есть их изображения. Ключ в клиенте — только для разработки; в
 *  мини-приложении эти запросы делает сервер. */
export const TMDB_ATTRIBUTION = 'This product uses the TMDB API but is not endorsed or certified by TMDB.';
const API = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p';

interface FindResult { movie_results: { id: number }[]; tv_results?: { id: number }[] }
interface Movie {
  id: number; title: string; original_title: string; overview?: string; release_date?: string; runtime?: number;
  poster_path?: string | null; backdrop_path?: string | null;
  production_countries?: { name: string; iso_3166_1: string }[];
  credits?: { crew: { job: string; name: string }[] };
  images?: { backdrops: { file_path: string; iso_639_1: string | null; vote_average: number }[] };
}

interface Tv {
  id: number; name: string; original_name: string; overview?: string; first_air_date?: string; episode_run_time?: number[];
  poster_path?: string | null; backdrop_path?: string | null; origin_country?: string[];
  created_by?: { name: string }[];
  number_of_seasons?: number; number_of_episodes?: number; status?: string; type?: string;
  keywords?: { results?: { name: string }[] };
}

/** Сериал в цифрах из ответа TMDb /tv/{id} (Е1). Антология — по ключевому слову TMDb:
 *  сезоны в ней — отдельные истории, и «начать с первого сезона» к ней не относится. */
export function seriesInfo(t: Pick<Tv, 'number_of_seasons' | 'number_of_episodes' | 'episode_run_time' | 'status' | 'keywords'>): SeriesInfo {
  const ended = t.status === 'Ended' || t.status === 'Canceled';
  const running = t.status === 'Returning Series' || t.status === 'In Production';
  const anthology = t.keywords?.results?.some((k) => /anthology/i.test(k.name));
  return {
    ...(t.number_of_seasons ? { seasons: t.number_of_seasons } : {}),
    ...(t.number_of_episodes ? { episodes: t.number_of_episodes } : {}),
    ...(t.episode_run_time?.[0] ? { episodeMinutes: t.episode_run_time[0] } : {}),
    ...(ended ? { status: 'ended' as const } : running ? { status: 'running' as const } : {}),
    ...(anthology ? { anthology: true } : {}),
  };
}

interface Providers { results?: Record<string, { link?: string; flatrate?: Provider[]; rent?: Provider[]; buy?: Provider[]; free?: Provider[] }> }
interface Provider { provider_name: string; logo_path?: string; display_priority?: number }

export interface TmdbClient {
  findByImdb(imdb: string): Promise<number | undefined>;
  /** сериал по IMDb ID: Wikidata отдаёт сериалам IMDb, а не номер TMDb */
  findTvByImdb(imdb: string): Promise<number | undefined>;
  /** поиск по оригинальному названию и году — для кандидатов без внешних ID; вместе с IMDb ID */
  search(title: string, year?: number): Promise<{ id: number; imdb?: string } | undefined>;
  movie(id: number): Promise<Partial<ResolvedWork> | undefined>;
  /** сериал: поиск и карточка. ID сериалов TMDb — своё пространство, с фильмами не путать */
  searchTv(title: string, year?: number): Promise<{ id: number; imdb?: string } | undefined>;
  tv(id: number): Promise<Partial<ResolvedWork> | undefined>;
  /** где посмотреть в регионе (данные JustWatch через TMDb); ссылка одна на всех — страница TMDb */
  watch(id: number, region?: string): Promise<ResolvedWork['watch']>;
}

/** Ключ v3 (32 hex) идёт параметром `api_key`; токен чтения v4 (JWT с точками) — заголовком Bearer. */
export function createTmdb(apiKey: string, fetcher: typeof fetch = fetch, language = 'ru-RU'): TmdbClient {
  const bearer = apiKey.includes('.');
  const get = async <T>(path: string, params: Record<string, string> = {}): Promise<T | undefined> => {
    const qs = new URLSearchParams({ language, ...params, ...(bearer ? {} : { api_key: apiKey }) });
    const res = await fetcher(`${API}${path}?${qs}`, bearer ? { headers: { Authorization: `Bearer ${apiKey}` } } : undefined);
    if (res.status === 404) return undefined;
    if (!res.ok) throw new Error(`tmdb ${res.status}`);
    return (await res.json()) as T;
  };
  return {
    async findByImdb(imdb) {
      const r = await get<FindResult>(`/find/${imdb}`, { external_source: 'imdb_id' });
      return r?.movie_results[0]?.id;
    },
    async findTvByImdb(imdb) {
      const r = await get<FindResult>(`/find/${imdb}`, { external_source: 'imdb_id' });
      return r?.tv_results?.[0]?.id;
    },
    async search(title, year) {
      const r = await get<{ results: { id: number }[] }>('/search/movie', { query: title, ...(year ? { year: String(year) } : {}) });
      const id = r?.results[0]?.id;
      if (id == null) return undefined;
      const ext = await get<{ imdb_id?: string | null }>(`/movie/${id}/external_ids`);
      return { id, imdb: ext?.imdb_id ?? undefined };
    },
    async movie(id) {
      const m = await get<Movie>(`/movie/${id}`, { append_to_response: 'credits,images', include_image_language: 'null,en' });
      if (!m) return undefined;
      // кадр без надписей предпочтительнее: он ложится в рамку как кадр, а не как афиша
      const textless = m.images?.backdrops.find((b) => b.iso_639_1 === null)?.file_path ?? m.backdrop_path ?? undefined;
      return {
        title: m.title || undefined,
        originalTitle: m.original_title || undefined,
        year: m.release_date ? Number(m.release_date.slice(0, 4)) || undefined : undefined,
        durationMinutes: m.runtime || undefined,
        countries: m.production_countries?.map((c) => c.name),
        creators: m.credits?.crew.filter((c) => c.job === 'Director').map((c) => c.name),
        coverUrl: m.poster_path ? `${IMG}/w342${m.poster_path}` : undefined,
        stillUrl: textless ? `${IMG}/w780${textless}` : undefined,
        imageSource: m.poster_path || textless ? 'tmdb' : undefined,
        blurb: m.overview || undefined,
        externalIds: { tmdb: m.id },
      };
    },
    async searchTv(title, year) {
      const r = await get<{ results: { id: number }[] }>('/search/tv', { query: title, ...(year ? { first_air_date_year: String(year) } : {}) });
      const id = r?.results[0]?.id;
      if (id == null) return undefined;
      const ext = await get<{ imdb_id?: string | null }>(`/tv/${id}/external_ids`);
      return { id, imdb: ext?.imdb_id ?? undefined };
    },
    async tv(id) {
      const t = await get<Tv>(`/tv/${id}`, { append_to_response: 'keywords' });
      if (!t) return undefined;
      return {
        title: t.name || undefined,
        originalTitle: t.original_name || undefined,
        year: t.first_air_date ? Number(t.first_air_date.slice(0, 4)) || undefined : undefined,
        durationMinutes: t.episode_run_time?.[0] || undefined,
        countries: t.origin_country,
        creators: t.created_by?.map((c) => c.name),
        coverUrl: t.poster_path ? `${IMG}/w342${t.poster_path}` : undefined,
        stillUrl: t.backdrop_path ? `${IMG}/w780${t.backdrop_path}` : undefined,
        imageSource: t.poster_path || t.backdrop_path ? 'tmdb' : undefined,
        blurb: t.overview || undefined,
        series: seriesInfo(t),
      };
    },
    async watch(id, region = 'RU') {
      const p = await get<Providers>(`/movie/${id}/watch/providers`);
      const r = p?.results?.[region];
      if (!r) return [];
      const seen = new Set<string>();
      const all = [...(r.flatrate ?? []), ...(r.free ?? []), ...(r.rent ?? []), ...(r.buy ?? [])]
        .sort((a, b) => (a.display_priority ?? 99) - (b.display_priority ?? 99));
      return all.filter((x) => !seen.has(x.provider_name) && seen.add(x.provider_name)).map((x) => ({
        platform: x.provider_name,
        url: r.link ?? `https://www.themoviedb.org/movie/${id}/watch?locale=${region}`,
        logoUrl: x.logo_path ? `${IMG}/w92${x.logo_path}` : undefined,
        source: 'tmdb' as const,
      }));
    },
  };
}
