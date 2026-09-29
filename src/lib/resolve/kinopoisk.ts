import type { ResolvedWork } from './types';

/** kinopoiskapiunofficial.tech — сторонний сервис поверх данных Кинопоиска (не API Яндекса):
 *  русское описание, постер, широкая обложка, кадры, страны, онлайн-кинотеатры. Бесплатный
 *  ключ — 500 запросов в день, поэтому на фильм — два запроса (карточка и где посмотреть),
 *  кадры отдельно и по необходимости. Картинки лежат на CDN Яндекса и могут исчезнуть —
 *  это допущение разработки, не продакшена; условия Кинопоиска такой доступ не разрешают,
 *  в мини-приложении источник должен стоять за сервером и быть заменяемым (21.09, решение
 *  владельца продукта). Оценки из ответа не берём. */
const API = 'https://kinopoiskapiunofficial.tech/api';

interface Film {
  kinopoiskId: number; imdbId?: string | null; nameRu?: string | null; nameOriginal?: string | null;
  year?: number | null; filmLength?: number | null; posterUrl?: string | null; posterUrlPreview?: string | null;
  coverUrl?: string | null; shortDescription?: string | null; description?: string | null;
  countries?: { country: string }[]; genres?: { genre: string }[]; webUrl?: string;
}
interface Still { imageUrl: string; previewUrl: string }
interface Source { url: string; platform: string; logoUrl?: string }

export interface KinopoiskClient {
  film(kinopoiskId: number): Promise<Partial<ResolvedWork> | undefined>;
  findByImdb(imdb: string): Promise<number | undefined>;
  stills(kinopoiskId: number, limit?: number): Promise<string[]>;
  watch(kinopoiskId: number): Promise<ResolvedWork['watch']>;
}

/** `apiKey` — прямой доступ (генераторы, сервер); без ключа — через прокси `/kp-api`
 *  dev-сервера, который подставляет ключ сам (браузеру сервис напрямую закрыт: CORS). */
export function createKinopoisk(apiKey?: string, fetcher: typeof fetch = fetch, base = apiKey ? API : '/kp-api'): KinopoiskClient {
  // Лимит исчерпан — до конца сессии не ходим: каждый лишний запрос всё равно вернёт 402
  let exhausted = false;
  const get = async <T>(path: string): Promise<T | undefined> => {
    if (exhausted) throw new Error('kinopoisk quota');
    const res = await fetcher(`${base}${path}`, {
      headers: { ...(apiKey ? { 'X-API-KEY': apiKey } : {}), Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 404) return undefined;
    if (res.status === 402 || res.status === 429) { exhausted = true; throw new Error('kinopoisk quota'); }
    if (!res.ok) throw new Error(`kinopoisk ${res.status}`);
    return (await res.json()) as T;
  };
  return {
    async film(id) {
      const f = await get<Film>(`/v2.2/films/${id}`);
      if (!f) return undefined;
      return {
        title: f.nameRu ?? undefined,
        originalTitle: f.nameOriginal ?? undefined,
        year: f.year ?? undefined,
        durationMinutes: f.filmLength ?? undefined,
        countries: f.countries?.map((c) => c.country),
        coverUrl: f.posterUrl ?? undefined,
        stillUrl: f.coverUrl ?? undefined,
        imageSource: f.posterUrl || f.coverUrl ? 'kinopoisk_unofficial' : undefined,
        blurb: f.shortDescription ?? f.description ?? undefined,
        externalIds: { kinopoisk: f.kinopoiskId, imdb: f.imdbId ?? undefined },
      };
    },
    async findByImdb(imdb) {
      const r = await get<{ items: Film[] }>(`/v2.2/films?imdbId=${encodeURIComponent(imdb)}&page=1`);
      return r?.items[0]?.kinopoiskId;
    },
    async stills(id, limit = 3) {
      const r = await get<{ items: Still[] }>(`/v2.2/films/${id}/images?type=STILL&page=1`);
      return (r?.items ?? []).slice(0, limit).map((s) => s.imageUrl);
    },
    async watch(id) {
      const r = await get<{ items: Source[] }>(`/v2.2/films/${id}/external_sources?page=1`);
      // Список приходит с дублями («Wink» и «Кинотеатр Wink», «Смотрёшка» и «smotreshka») —
      // оставляем первое упоминание каждой площадки.
      const seen = new Set<string>();
      const key = (name: string) => name.toLowerCase().replace(/^кинотеатр\s+/, '').replace(/[^a-zа-яё0-9]/g, '')
        .replace(/^smotreshka$/, 'смотрёшка');
      return (r?.items ?? [])
        .filter((s) => { const k = key(s.platform); if (seen.has(k)) return false; seen.add(k); return true; })
        .map((s) => ({ platform: s.platform, url: s.url, logoUrl: s.logoUrl, source: 'kinopoisk_unofficial' as const }));
    },
  };
}
