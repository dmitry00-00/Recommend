// Жанры и страны для якоря вкуса (23.10): якорь (src/lib/model/taste.ts) почти слеп — жанры в пуле подбора были примерно
// у трети карточек (filmGenres.ts знал только фильмы из .cache/tmdb-tags.json, сериалы не знал совсем), страны — у
// четверти (их приносят карточки и baseMedia.ts, а ленивым модулям справочника — никто). Здесь — дозаполнение из TMDb по
// номерам, которые у карточек уже есть: фильм — externalIds.tmdb → `/movie/<id>`; сериал — номер сериала TMDb из
// .cache/tmdb-tv-tags.json (его пишет build-series-registers), из id `l-tmdbtv<id>`, а без него `/find` по IMDb →
// `/tv/<id>`. Ключи — те же, что у разборов (src/lib/keys.ts): фильм `tmdb:<id>`, сериал `imdb:<tt…>`.
//   npx tsx tools/fill-genres-tmdb.mts [--stats] [--pool] [--limit N]
//     --stats — без сети и без записи: только покрытие по кэшу; --pool — спрашивать только пул подбора (без хвоста справочника)
// Выход — .cache/filmGenres.with-fill-2310.ts (до решения 23.10 — src/mocks/filmGenres.ts): `filmGenres` — тот же вид, что прежде
// (ключ → жанры по-русски, как у фильмов TMDb; составные жанры сериалов разложены, как в build-series-registers), и
// `filmCountries` — ключ → коды ISO стран (countryRu переводит их сам). В файле — сжато (буква на жанр, коды через
// пробел), разворачивается при загрузке куска. Заменяет tools/film-genres.mts: жанры из .cache/tmdb-tags.json тоже здесь.
// Кэш ответов — .cache/tmdb-genres/{movie,tv,find}.jsonl (дописывается по строке на ответ: повтор в сеть не ходит,
// прерванный прогон докачивает). Вежливо: не больше ~18 запросов в секунду.
import { appendFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { brotliCompressSync } from 'node:zlib';
import { loadEnvFile } from './env-file.mts';
import { works as catalogWorks } from '../src/mocks/index.ts';
import { externalIds } from '../src/mocks/externalIds.ts';
import { catalogMedia } from '../src/mocks/catalogMedia.ts';
import { userWorks } from '../src/mocks/userHistory.ts';
import { watchedWorks } from '../src/mocks/userWatched.ts';
import { candidateSeeds, seedToCard } from '../src/mocks/candidates.ts';
import { candidateMedia } from '../src/mocks/candidateMedia.ts';
import { filmBase } from '../src/mocks/filmBase.ts';
import { filmBaseWiki } from '../src/mocks/filmBaseWiki.ts';
import { filmBaseMarkup } from '../src/mocks/filmBaseMarkup.ts';
import { filmBaseCurated } from '../src/mocks/filmBaseCurated.ts';
import { filmBasePopular } from '../src/mocks/filmBasePopular.ts';
import { filmBaseWorld } from '../src/mocks/filmBaseWorld.ts';
import { filmBaseChannels } from '../src/mocks/filmBaseChannels.ts';
import { seriesBase } from '../src/mocks/seriesBase.ts';
import { seriesBaseWiki } from '../src/mocks/seriesBaseWiki.ts';
import { filmBaseLinks } from '../src/mocks/filmBaseLinks.ts';
import { filmBaseTail } from '../src/mocks/filmBaseTail.ts';
import { filmBaseMore } from '../src/mocks/filmBaseMore.ts';
import { baseMedia } from '../src/mocks/baseMedia.ts';
import { baseMediaLate } from '../src/mocks/baseMediaLate.ts';
import { draftAnnotations } from '../src/mocks/draftAnnotations.ts';
import { draftAnnotationsLinks } from '../src/mocks/draftAnnotationsLinks.ts';
import { seriesAnnotations } from '../src/mocks/seriesAnnotations.ts';
import { seriesAnnotationsWiki } from '../src/mocks/seriesAnnotationsWiki.ts';
import { isFilm, isSeries, normalizeWork } from '../src/lib/media.ts';
import { primaryKey } from '../src/lib/keys.ts';
import type { ExternalIds, WorkCard } from '../src/types/tmdf.ts';

const args = process.argv.slice(2);
const STATS = args.includes('--stats');
const POOL_ONLY = args.includes('--pool');
const LIMIT = Number(args[args.indexOf('--limit') + 1]) || Infinity;
// 23.10: выбрана Wikidata (tools/fill-genres-wikidata.mts --final пишет src/mocks) — здесь выход только для сравнения
const OUT = '.cache/filmGenres.with-fill-2310.ts';
const DIR = '.cache/tmdb-genres';
mkdirSync(DIR, { recursive: true });

// ── жанры ─────────────────────────────────────────────────────────────────────────────────────────────
/** Жанры TMDb по номеру — названия те же, что TMDb отдаёт фильмам на ru-RU (и что уже в filmGenres.ts). Номера, а не
 *  названия ответа: перевод у TMDb правят, а ключи якоря и полок вкуса (TASTE_SHELVES) должны остаться теми же. Составные
 *  жанры сериалов раскладываются на жанры фильмов, как в build-series-registers. */
const GENRE_ID: Record<number, string[]> = {
  28: ['боевик'], 12: ['приключения'], 16: ['мультфильм'], 35: ['комедия'], 80: ['криминал'], 99: ['документальный'],
  18: ['драма'], 10751: ['семейный'], 14: ['фэнтези'], 36: ['история'], 27: ['ужасы'], 10402: ['музыка'], 9648: ['детектив'],
  10749: ['мелодрама'], 878: ['фантастика'], 10770: ['телевизионный фильм'], 53: ['триллер'], 10752: ['военный'], 37: ['вестерн'],
  // сериалы
  10759: ['боевик', 'приключения'], 10762: ['детский'], 10763: ['новости'], 10764: ['реалити-шоу'], 10765: ['фантастика', 'фэнтези'],
  10766: ['мыльная опера'], 10767: ['ток-шоу'], 10768: ['военный'],
};
/** Буква на жанр — в файле (раскладка в самом куске). Порядок не менять: новые — в конец. */
const LETTERS = ['драма', 'боевик', 'комедия', 'триллер', 'приключения', 'мелодрама', 'криминал', 'фантастика', 'фэнтези', 'ужасы',
  'семейный', 'история', 'детектив', 'мультфильм', 'военный', 'музыка', 'документальный', 'вестерн', 'телевизионный фильм',
  'детский', 'новости', 'реалити-шоу', 'мыльная опера', 'ток-шоу'];
const letterOf = new Map(LETTERS.map((g, i) => [g, String.fromCharCode(97 + i)]));
const fromIds = (ids: number[]): string[] => [...new Set(ids.flatMap((i) => GENRE_ID[i] ?? []))];
/** Составные жанры сериалов в .cache/tmdb-tv-tags.json уже разложены; «НФ и Фэнтези» там — оба. */
const known = (gs: string[]) => [...new Set(gs.map((g) => g.toLowerCase()))].filter((g) => letterOf.has(g));

// ── кэш ответов ───────────────────────────────────────────────────────────────────────────────────────
/** Ответ TMDb, урезанный до нужного: номера жанров, страны производства, страны происхождения; `none` — 404. */
type Hit = { id: number; g?: number[]; pc?: string[]; oc?: string[]; none?: true };
type Found = { imdb: string; tv?: number; movie?: number };
const readJsonl = <T,>(name: string): T[] => {
  const f = `${DIR}/${name}.jsonl`;
  return existsSync(f) ? readFileSync(f, 'utf8').split('\n').filter(Boolean).flatMap((l) => { try { return [JSON.parse(l) as T]; } catch { return []; } }) : [];
};
const movieHits = new Map(readJsonl<Hit>('movie').map((h) => [h.id, h]));
const tvHits = new Map(readJsonl<Hit>('tv').map((h) => [h.id, h]));
const finds = new Map(readJsonl<Found>('find').map((h) => [h.imdb, h]));
const put = (name: string, row: object) => appendFileSync(`${DIR}/${name}.jsonl`, JSON.stringify(row) + '\n');

const filmTags: Record<string, { genres?: string[] }> = existsSync('.cache/tmdb-tags.json') ? JSON.parse(readFileSync('.cache/tmdb-tags.json', 'utf8')) : {};
const tvTags: Record<string, { tv?: number; genres?: string[]; none?: true }> = existsSync('.cache/tmdb-tv-tags.json') ? JSON.parse(readFileSync('.cache/tmdb-tv-tags.json', 'utf8')) : {};

// ── карточки: какая из копий достанется подбору ──────────────────────────────────────────────────────
// Порядок — как у загрузки справочника и `draftSources` (src/api/index.ts): история, справочник (с baseMedia), запасные
// копии и ленивые модули, присланное просмотренное. Карточка ключа — первая; страны — её (с наложением baseMedia).
const media = (w: WorkCard): WorkCard => {
  const m = baseMedia[w.id] ?? baseMediaLate[w.id];
  return normalizeWork(m ? { ...w, ...m } : w);
};
const idsOf = (w: WorkCard): ExternalIds | undefined => w.externalIds ?? catalogMedia[w.id]?.externalIds ?? externalIds[w.id];
const catalogCards = Object.values(catalogWorks).map((w) => ({ ...w, ...catalogMedia[w.id], externalIds: idsOf(w) }) as WorkCard);
const seedCards = candidateSeeds.map((s) => ({ ...seedToCard(s), ...candidateMedia[s.id] }) as WorkCard);
const ordered: WorkCard[] = [
  ...userWorks, ...[...filmBase, ...filmBaseWiki, ...filmBaseMarkup, ...filmBaseCurated, ...seriesBase, ...filmBasePopular, ...filmBaseWorld,
    ...filmBaseChannels, ...seriesBaseWiki, ...filmBaseLinks, ...filmBaseTail, ...filmBaseMore].map(media),
  ...watchedWorks, ...catalogCards, ...seedCards,
].map(normalizeWork);
const cardOf = new Map<string, WorkCard>();
/** номер сериала TMDb по IMDb — из id карточки `l-tmdbtv<id>` */
const tvFromId = new Map<string, number>();
for (const w of ordered) {
  if (w.type === 'book') continue;
  const k = primaryKey(w, idsOf(w));
  if (!k || !(isFilm(w) || isSeries(w))) continue;
  if (!cardOf.has(k)) cardOf.set(k, w);
  const tv = /^l-tmdbtv(\d+)$/.exec(w.id)?.[1];
  const imdb = idsOf(w)?.imdb;
  if (tv && imdb && isSeries(w)) tvFromId.set(imdb, Number(tv));
}

// пул подбора (`candidatePool`): каталог с разметкой, зёрна кандидатов, черновики фильмов (кроме неуверенных) и сериалов
const pool = new Set<string>();
for (const w of [...catalogCards, ...seedCards]) {
  const k = w.type !== 'book' && w.primaryOperations.length && w.complexityLevel ? primaryKey(w, idsOf(w)) : undefined;
  if (k && cardOf.has(k)) pool.add(k);
}
// пул первой ленты — без разметки ленивых модулей (draftAnnotationsLinks, seriesAnnotationsWiki: приходят с `catalog()`)
const firstPool = new Set(pool);
for (const [k, a] of Object.entries(draftAnnotations)) if (a.confidence !== 'low' && cardOf.has(k)) firstPool.add(k);
for (const k of Object.keys(seriesAnnotations)) if (cardOf.has(k) && isSeries(cardOf.get(k)!)) firstPool.add(k);
for (const [k, a] of Object.entries({ ...draftAnnotationsLinks, ...draftAnnotations })) if (a.confidence !== 'low' && cardOf.has(k)) pool.add(k);
for (const k of Object.keys({ ...seriesAnnotationsWiki, ...seriesAnnotations })) if (cardOf.has(k) && isSeries(cardOf.get(k)!)) pool.add(k);

// ── что знаем ─────────────────────────────────────────────────────────────────────────────────────────
const tmdbOf = (w: WorkCard) => idsOf(w)?.tmdb;
const tvOf = (w: WorkCard): number | undefined => {
  const imdb = idsOf(w)?.imdb;
  if (!imdb) return undefined;
  return tvFromId.get(imdb) ?? tvTags[imdb]?.tv ?? finds.get(imdb)?.tv;
};
/** Жанры, которые видит якорь сейчас: `genresOf` в src/api/index.ts — только фильм с номером TMDb. */
const genresBefore = (w: WorkCard): string[] => {
  const t = isFilm(w) ? tmdbOf(w) : undefined;
  return t != null ? filmTags[String(t)]?.genres ?? [] : [];
};
const hitOf = (w: WorkCard): Hit | undefined => {
  if (isFilm(w)) { const t = tmdbOf(w); return t != null ? movieHits.get(t) : undefined; }
  const tv = tvOf(w);
  return tv != null ? tvHits.get(tv) : undefined;
};
const genresAfter = (w: WorkCard): string[] => {
  const before = genresBefore(w);
  if (before.length) return known(before);
  const h = hitOf(w);
  if (h?.g?.length) return fromIds(h.g);
  const imdb = idsOf(w)?.imdb;
  return isSeries(w) && imdb ? known(tvTags[imdb]?.genres ?? []) : [];
};
/** Страны у сериала — страны происхождения (так их пишет seriesBase), у фильма — производства. */
const countriesOf = (w: WorkCard, h: Hit | undefined): string[] => {
  if (!h || h.none) return [];
  const [a, b] = isSeries(w) ? [h.oc, h.pc] : [h.pc, h.oc];
  // XI — Северная Ирландия у TMDb: кода ISO у неё нет, countryRu оставил бы «XI» — значит Великобритания
  return [...new Set((a?.length ? a : b ?? []).map((c) => (c === 'XI' ? 'GB' : c)))];
};
const countriesBefore = (w: WorkCard): string[] => w.countries ?? [];

function coverage(label: string, keys: string[], after: boolean) {
  const rows = { film: [0, 0, 0], series: [0, 0, 0] } as Record<'film' | 'series', [number, number, number]>;
  for (const k of keys) {
    const w = cardOf.get(k)!;
    const r = rows[isSeries(w) ? 'series' : 'film'];
    r[0] += 1;
    if ((after ? genresAfter(w) : genresBefore(w)).length) r[1] += 1;
    if (countriesBefore(w).length || (after && countriesOf(w, hitOf(w)).length)) r[2] += 1;
  }
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 1000) / 10}%` : '—');
  const all = [rows.film[0] + rows.series[0], rows.film[1] + rows.series[1], rows.film[2] + rows.series[2]];
  console.log(`${label}: всего ${all[0]} — жанры ${pct(all[1], all[0])}, страны ${pct(all[2], all[0])}; `
    + `фильмы ${rows.film[0]} (жанры ${pct(rows.film[1], rows.film[0])}, страны ${pct(rows.film[2], rows.film[0])}), `
    + `сериалы ${rows.series[0]} (жанры ${pct(rows.series[1], rows.series[0])}, страны ${pct(rows.series[2], rows.series[0])})`);
}
const poolKeys = [...pool];
const allKeys = [...cardOf.keys()];
console.log('— до —');
coverage('пул первой ленты', [...firstPool], false);
coverage('пул подбора', poolKeys, false);
coverage('весь справочник кино', allKeys, false);

// ── сеть ──────────────────────────────────────────────────────────────────────────────────────────────
const needs = (w: WorkCard) => !genresBefore(w).length || !countriesBefore(w).length;
const want = (POOL_ONLY ? poolKeys : [...poolKeys, ...allKeys.filter((k) => !pool.has(k))]).filter((k) => needs(cardOf.get(k)!));
{
  const ws = want.map((k) => cardOf.get(k)!);
  const films = ws.filter((w) => isFilm(w)), series = ws.filter((w) => isSeries(w));
  console.log(`пробелы: фильмов ${films.length} (с номером TMDb ${films.filter((w) => tmdbOf(w) != null).length}), `
    + `сериалов ${series.length} (с IMDb ${series.filter((w) => idsOf(w)?.imdb).length}, с номером сериала TMDb ${series.filter((w) => tvOf(w) != null).length})`);
}

if (!STATS) {
  loadEnvFile();
  const key = process.env.TMDB_API_KEY ?? process.env.VITE_TMDB_API_KEY;
  if (!key) { console.error('нужен TMDB_API_KEY (или VITE_TMDB_API_KEY) в .env.local'); process.exit(1); }
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  // не чаще раза в 55 мс (~18 в секунду) на все потоки вместе
  let next = 0;
  const slot = async () => { const now = Date.now(); const at = Math.max(now, next); next = at + 55; if (at > now) await sleep(at - now); };
  const api = async <T,>(path: string): Promise<T | null | undefined> => {
    for (let a = 0; a < 4; a++) {
      await slot();
      const r = await fetch(`https://api.themoviedb.org/3${path}${path.includes('?') ? '&' : '?'}api_key=${key}`).catch(() => undefined);
      if (r?.status === 404) return null;
      if (r?.ok) return await r.json() as T;
      const wait = Number(r?.headers.get('retry-after')) || 2 * (a + 1);
      await sleep(wait * 1000);
    }
    return undefined;
  };
  type Detail = { genres?: { id: number }[]; production_countries?: { iso_3166_1: string }[]; origin_country?: string[] };
  const hit = (id: number, d: Detail | null): Hit => (d === null ? { id, none: true }
    : { id, g: (d.genres ?? []).map((g) => g.id), pc: (d.production_countries ?? []).map((c) => c.iso_3166_1), oc: d.origin_country ?? [] });

  const jobs: (() => Promise<void>)[] = [];
  const queued = new Set<string>();
  for (const k of want) {
    const w = cardOf.get(k)!;
    if (isFilm(w)) {
      const t = tmdbOf(w);
      if (t == null || movieHits.has(t) || queued.has(`m${t}`)) continue;
      queued.add(`m${t}`);
      jobs.push(async () => { const d = await api<Detail>(`/movie/${t}?language=ru-RU`); if (d !== undefined) { const h = hit(t, d); movieHits.set(t, h); put('movie', h); } });
    } else {
      const imdb = idsOf(w)?.imdb;
      if (!imdb || queued.has(imdb)) continue;
      queued.add(imdb);
      const tv0 = tvOf(w);
      if (tv0 != null && tvHits.has(tv0)) continue;
      if (tv0 == null && finds.has(imdb)) continue; // TMDb сериала не знает — уже спрашивали
      jobs.push(async () => {
        let tv = tv0;
        if (tv == null) {
          const f = await api<{ tv_results?: { id: number }[]; movie_results?: { id: number }[] }>(`/find/${imdb}?external_source=imdb_id`);
          if (f === undefined) return;
          const row: Found = { imdb, ...(f?.tv_results?.[0] ? { tv: f.tv_results[0].id } : {}), ...(f?.movie_results?.[0] ? { movie: f.movie_results[0].id } : {}) };
          finds.set(imdb, row); put('find', row);
          tv = row.tv;
        }
        if (tv == null || tvHits.has(tv)) return;
        const d = await api<Detail>(`/tv/${tv}?language=ru-RU`);
        if (d !== undefined) { const h = hit(tv, d); tvHits.set(tv, h); put('tv', h); }
      });
    }
  }
  const todo = jobs.slice(0, LIMIT);
  console.log(`спросить TMDb: ${todo.length} (из ${jobs.length})`);
  let done = 0;
  const started = Date.now();
  await Promise.all(Array.from({ length: 6 }, async () => {
    for (let j = todo.shift(); j; j = todo.shift()) {
      await j();
      if (++done % 500 === 0) console.log(`  ${done} за ${Math.round((Date.now() - started) / 1000)} с`);
    }
  }));
}

console.log('— после —');
coverage('пул первой ленты', [...firstPool], true);
coverage('пул подбора', poolKeys, true);
coverage('весь справочник кино', allKeys, true);

if (STATS) process.exit(0);

// ── выход ─────────────────────────────────────────────────────────────────────────────────────────────
// жанры — всем ключам, что знаем; страны — только тем, у чьей карточки их нет: остальным их уже приносит сама карточка
// (baseMedia.ts, seriesBase и др.). Лента не должна меняться без флага (23.10): прежний набор (.cache/tmdb-tags.json,
// фильмы) остаётся в `filmGenres` как был, дозаполненное — отдельно, `filmGenresFill` (в файле — с «+» впереди)
const rows: [string, string, string, boolean][] = [];
const filmsFromTags = new Set(Object.keys(filmTags).filter((id) => filmTags[id].genres?.length).map((id) => `tmdb:${id}`));
for (const k of new Set([...filmsFromTags, ...allKeys])) {
  const w = cardOf.get(k);
  const g = w ? genresAfter(w) : known(filmTags[k.slice(5)]?.genres ?? []);
  const c = w && !countriesBefore(w).length ? countriesOf(w, hitOf(w)) : [];
  if (!g.length && !c.length) continue;
  rows.push([k, g.map((x) => letterOf.get(x)!).join(''), c.join(' '), !filmsFromTags.has(k)]);
}
const num = (k: string) => Number(k.replace(/^\D+/, '')) || 0;
const kind = (k: string) => k.slice(0, k.indexOf(':'));
rows.sort((a, b) => kind(a[0]).localeCompare(kind(b[0])) || num(a[0]) - num(b[0]) || a[0].localeCompare(b[0]));
const body = rows.map(([k, g, c, fill]) => `${JSON.stringify(k)}:${JSON.stringify(`${fill && g ? '+' : ''}${g}${c ? `|${c}` : ''}`)}`).join(',\n');
writeFileSync(OUT, `// Сгенерировано tools/fill-genres-tmdb.mts (${new Date().toISOString().slice(0, 10)}): жанры и страны TMDb для якоря вкуса
// (src/lib/model/taste.ts). Ключ — как у разборов: фильм «tmdb:<id>», сериал «imdb:<tt…>». Ленивый кусок (loadGenres в
// src/api/index.ts). В файле сжато: буква на жанр (G); «+» впереди — дозаполнено 23.10 (filmGenresFill), без него —
// прежний набор фильмов (filmGenres); после «|» — коды ISO стран, только тем, у чьей карточки стран нет.
// Не править руками — перегенерировать.
const G = ${JSON.stringify(LETTERS)};
const R: Record<string, string> = {
${body}
};
const shared = new Map<string, string[]>();
const genres = (g: string) => shared.get(g) ?? shared.set(g, Array.from(g, (c) => G[c.charCodeAt(0) - 97])).get(g)!;
/** ключ «tmdb:» → жанры фильма по-русски, как отдаёт TMDb (прежний набор, до 23.10) */
export const filmGenres: Record<string, string[]> = {};
/** дозаполненное 23.10: фильмы «tmdb:», которых не было в filmGenres, и сериалы «imdb:» (составные жанры разложены) */
export const filmGenresFill: Record<string, string[]> = {};
/** ключ → коды ISO стран производства (у сериала — происхождения), если у карточки стран нет; перевод — countryRu */
export const filmCountries: Record<string, string[]> = {};
for (const k in R) {
  const v = R[k], bar = v.indexOf('|'), fill = v[0] === '+', g = v.slice(fill ? 1 : 0, bar < 0 ? undefined : bar);
  if (g) (fill ? filmGenresFill : filmGenres)[k] = genres(g);
  if (bar >= 0) filmCountries[k] = v.slice(bar + 1).split(' ');
}
`);
const size = statSync(OUT).size;
const br = brotliCompressSync(readFileSync(OUT)).length;
const withC = rows.filter((r) => r[2]).length, filled = rows.filter((r) => r[3] && r[1]).length;
console.log(`→ ${OUT}: ${rows.length} ключей (дозаполнено жанров — ${filled}, стран — ${withC}), ${Math.round(size / 1024)} КБ, brotli ${Math.round(br / 1024)} КБ`);
