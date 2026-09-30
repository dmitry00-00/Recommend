import type { Credit } from '@/types/tmdf';
import type { ResolvedWork } from './types';

/** Wikidata как хаб идентификаторов и базовых полей. CC0, без ключа, CORS открыт (`origin=*`).
 *  Не SPARQL, а обычный API: поиск элемента по внешнему ID (`haswbstatement`) и выгрузка
 *  утверждений пачками — сервис запросов под нагрузкой отвечает по полминуты или 5xx,
 *  API отвечает стабильно. Свойства: P2603 — ID Кинопоиска, P345 — IMDb, P4947 — TMDb,
 *  P57 — режиссёр, P58 — сценарист, P495 — страна, P2047 — хронометраж, P577 — дата выхода, P1476 —
 *  оригинальное название. К самому Кинопоиску не обращаемся: только к его ID. */
const API = 'https://www.wikidata.org/w/api.php';
const BATCH = 50;
const PROPS = { kinopoisk: 'P2603', imdb: 'P345', tmdb: 'P4947', director: 'P57', writer: 'P58', country: 'P495', duration: 'P2047', published: 'P577', original: 'P1476' } as const;

export interface WikidataFilm {
  wikidata: string;
  kinopoisk?: number;
  imdb?: string;
  tmdb?: number;
  title?: string;
  originalTitle?: string;
  year?: number;
  creators: string[];
  /** режиссёры с элементами Wikidata (Д1); в старом кэше `.cache/kinopoisk-wikidata.json` их нет */
  credits?: Credit[];
  countries: string[];
  durationMinutes?: number;
}

type Claim = { mainsnak: { datavalue?: { value: unknown } }; rank: string };
type Entity = { id: string; labels?: Record<string, { value: string }>; claims?: Record<string, Claim[]> };

async function api<T>(params: Record<string, string>, fetcher: typeof fetch): Promise<T> {
  const qs = new URLSearchParams({ format: 'json', origin: '*', ...params });
  // 429 — слишком часто: ждём, сколько попросят (Retry-After), и пробуем снова; 5xx — тоже
  for (let attempt = 0; ; attempt++) {
    const res = await fetcher(`${API}?${qs}`, { signal: AbortSignal.timeout(20000) });
    if (res.ok) return (await res.json()) as T;
    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt >= 4) throw new Error(`wikidata ${res.status}`);
    const after = Number(res.headers.get('retry-after')) || 0;
    await new Promise((r) => setTimeout(r, Math.max(after * 1000, 1500 * 2 ** attempt)));
  }
}

/** Элементы по пачке внешних ID одним поиском: `haswbstatement:P2603=a|P2603=b|…` (ИЛИ).
 *  Поиск по одному на сотнях ID Wikidata режет (429, Retry-After полминуты), пачкой — в
 *  сорок раз меньше запросов. Какой элемент к какому ID — видно потом по его утверждениям. */
const SEARCH_BATCH = 40;
async function findItems(prop: string, keys: string[], fetcher: typeof fetch): Promise<string[]> {
  const r = await api<{ query?: { search: { title: string }[] } }>({
    action: 'query', list: 'search', srsearch: `haswbstatement:${keys.map((k) => `${prop}=${k}`).join('|')}`,
    srlimit: String(Math.min(keys.length * 2, 500)), srnamespace: '0',
  }, fetcher);
  return r.query?.search.map((s) => s.title) ?? [];
}

async function entities(ids: string[], props: string, fetcher: typeof fetch): Promise<Record<string, Entity>> {
  const out: Record<string, Entity> = {};
  for (let i = 0; i < ids.length; i += BATCH) {
    const r = await api<{ entities?: Record<string, Entity> }>({
      action: 'wbgetentities', ids: ids.slice(i, i + BATCH).join('|'), props, languages: 'ru|en',
    }, fetcher);
    Object.assign(out, r.entities ?? {});
  }
  return out;
}

const values = (e: Entity, prop: string): unknown[] =>
  (e.claims?.[prop] ?? []).filter((c) => c.rank !== 'deprecated').map((c) => c.mainsnak.datavalue?.value).filter((v) => v !== undefined);
const str = (e: Entity, prop: string): string | undefined => values(e, prop).find((v): v is string => typeof v === 'string');
const label = (e: Entity | undefined): string | undefined => e?.labels?.ru?.value ?? e?.labels?.en?.value;
const itemIds = (e: Entity, prop: string): string[] =>
  values(e, prop).map((v) => (v as { id?: string }).id).filter((id): id is string => Boolean(id));

/** Фильмы по ID Кинопоиска или IMDb. Чего в Wikidata нет — того нет в ответе. */
export async function lookupFilms(by: 'kinopoisk' | 'imdb', keys: string[], fetcher: typeof fetch = fetch): Promise<Map<string, WikidataFilm>> {
  const out = new Map<string, WikidataFilm>();
  const unique = Array.from(new Set(keys.filter(Boolean)));
  const prop = PROPS[by];
  // поиск — пачками и по очереди: параллельные запросы упираются в лимит (429)
  const items = new Set<string>();
  for (let i = 0; i < unique.length; i += SEARCH_BATCH) {
    try { (await findItems(prop, unique.slice(i, i + SEARCH_BATCH), fetcher)).forEach((q) => items.add(q)); } catch { /* пропускаем */ }
  }
  if (!items.size) return out;
  const films = await entities(Array.from(items), 'labels|claims', fetcher);
  // ID → элемент — по утверждению самого элемента (у одного элемента их бывает несколько)
  const wanted = new Set(unique);
  const found = new Map<string, string>();
  for (const e of Object.values(films)) {
    for (const v of values(e, prop)) if (typeof v === 'string' && wanted.has(v) && !found.has(v)) found.set(v, e.id);
  }
  // режиссёры и страны — отдельные элементы, нужны только их названия
  const related = new Set<string>();
  for (const e of Object.values(films)) for (const p of [PROPS.director, PROPS.writer, PROPS.country]) itemIds(e, p).forEach((id) => related.add(id));
  const names = related.size ? await entities(Array.from(related), 'labels', fetcher) : {};

  for (const [key, q] of found) {
    const e = films[q];
    if (!e) continue;
    const dur = values(e, PROPS.duration).find((v): v is { amount: string } => typeof v === 'object' && v !== null && 'amount' in v);
    const years = values(e, PROPS.published)
      .map((v) => Number((v as { time?: string }).time?.slice(1, 5))).filter((y) => y > 1800);
    const orig = values(e, PROPS.original).find((v): v is { text: string } => typeof v === 'object' && v !== null && 'text' in v);
    const tmdb = str(e, PROPS.tmdb);
    const kp = str(e, PROPS.kinopoisk);
    out.set(key, {
      wikidata: e.id,
      kinopoisk: kp ? Number(kp) : undefined,
      imdb: str(e, PROPS.imdb),
      tmdb: tmdb ? Number(tmdb) : undefined,
      title: label(e),
      originalTitle: orig?.text,
      year: years.length ? Math.min(...years) : undefined,
      creators: itemIds(e, PROPS.director).map((id) => label(names[id])).filter((n): n is string => Boolean(n)),
      // режиссёры и сценаристы (Д2); создателя сериала (P170) здесь не берём: у фильма это
      // бывает студия, а вид элемента тут неизвестен — его добирает tools/resolve-credits.mts
      credits: ([['director', PROPS.director], ['writer', PROPS.writer]] as const).flatMap(([role, prop]) =>
        itemIds(e, prop).flatMap((id): Credit[] => {
          const name = label(names[id]);
          return name ? [{ personId: id, role, name }] : [];
        })),
      countries: itemIds(e, PROPS.country).map((id) => label(names[id])).filter((n): n is string => Boolean(n)),
      durationMinutes: dur ? Math.round(Number(dur.amount)) || undefined : undefined,
    });
  }
  return out;
}

export function fromWikidata(film: WikidataFilm): Partial<ResolvedWork> {
  return {
    title: film.title,
    originalTitle: film.originalTitle,
    year: film.year,
    creators: film.creators,
    ...(film.credits?.length ? { credits: film.credits } : {}),
    countries: film.countries,
    durationMinutes: film.durationMinutes,
    externalIds: { wikidata: film.wikidata, imdb: film.imdb, tmdb: film.tmdb, kinopoisk: film.kinopoisk },
  };
}
