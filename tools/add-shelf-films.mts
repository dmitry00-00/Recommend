// Полки (src/mocks/shelves.ts) и канон массового зрителя (src/mocks/massCanon.ts, 30.09) →
// карточки того, чего нет в справочнике (29.09).
//   npx tsx tools/add-shelf-films.mts [--dry]        — ключ TMDb из .env.local; потом
//   npx tsx tools/profile-deck.mts — список первых оценок с каноном
//
// Выход — src/mocks/filmBaseCurated.ts: карточки (дополняется, не затирается) и ключи полок.
// Карточка — как у справочника: без разметки, в подбор фильм попадает, когда у него появится
// черновая разметка в draftAnnotations.ts. Регистр ставим сразу — теми же жанрами и ключевыми
// словами TMDb, что и у остальных (tools/register-tags.mts).
// Ключ фильма — `tmdb:<id>`, сериала — `imdb:<id>`: номера TMDb у фильмов и сериалов пересекаются.
import { writeFileSync } from 'node:fs';
import { loadEnvFile } from './env-file.mts';
import { worksIndex, analysisKey } from './works-index.mts';
import { pick } from './register-tags.mts';
import { tmdbFromEnv } from '../src/lib/resolve/index.ts';
import { shelves } from '../src/mocks/shelves.ts';
import { massCanonList } from '../src/mocks/massCanon.ts';
import { filmBaseCurated } from '../src/mocks/filmBaseCurated.ts';
import type { WorkCard } from '../src/types/tmdf.ts';

loadEnvFile();
const key = process.env.TMDB_API_KEY ?? process.env.VITE_TMDB_API_KEY;
if (!key) { console.error('нужен TMDB_API_KEY (или VITE_TMDB_API_KEY) в .env.local'); process.exit(1); }
const DRY = process.argv.includes('--dry');

const get = async <T,>(path: string, extra: Record<string, string> = {}): Promise<T> => {
  const bearer = key.includes('.');
  const qs = new URLSearchParams({ language: 'ru-RU', ...extra, ...(bearer ? {} : { api_key: key }) });
  const r = await fetch(`https://api.themoviedb.org/3/${path}?${qs}`, bearer ? { headers: { Authorization: `Bearer ${key}` } } : undefined);
  if (!r.ok) throw new Error(`tmdb ${path} ${r.status}`);
  return await r.json() as T;
};

interface Named { name: string }
interface Movie {
  title: string; original_title: string; release_date?: string; runtime?: number; imdb_id?: string;
  genres?: Named[]; keywords?: { keywords?: Named[] }; credits?: { crew?: { job: string; name: string }[] };
}
interface Tv {
  name: string; original_name: string; first_air_date?: string; episode_run_time?: number[];
  created_by?: Named[]; genres?: Named[]; keywords?: { results?: Named[] }; external_ids?: { imdb_id?: string };
}

const card = (id: string, title: string, original: string, date: string | undefined, creators: string[],
  minutes: number | undefined, ids: WorkCard['externalIds'], genres: Named[] = [], keywords: Named[] = [], series = false): WorkCard => ({
  id, type: 'film', ...(series ? { format: 'series' as const } : {}),
  title, ...(original && original !== title ? { originalTitle: original } : {}),
  ...(date ? { year: Number(date.slice(0, 4)) } : {}),
  creators, primaryOperations: [], complexityLevel: 0, warnings: [], barriers: [], isNicheMasterpiece: false,
  ...(minutes ? { durationMinutes: minutes } : {}),
  externalIds: ids,
  registers: pick(genres.map((g) => g.name), keywords.map((k) => k.name)),
});

// кто уже есть — по ключу; для сериалов ключ по IMDb узнаём только из TMDb, поэтому запрос всё равно
const known = new Map(worksIndex({ all: true }).map((w) => [w.key, w.work]));
for (const w of filmBaseCurated) { const k = analysisKey(w); if (k) known.set(k, w); }

const added: WorkCard[] = [];
const shelfKeys: Record<string, string[]> = {};

/** фильм по номеру TMDb → карточка (если её ещё нет) */
async function addMovie(id: number, title?: string, registers?: WorkCard['registers']): Promise<void> {
  const k = `tmdb:${id}`;
  if (known.has(k)) return;
  const j = await get<Movie>(`movie/${id}`, { append_to_response: 'keywords,credits' });
  const directors = (j.credits?.crew ?? []).filter((c) => c.job === 'Director').map((c) => c.name);
  const c0 = card(`f-tmdb${id}`, title ?? j.title, j.original_title, j.release_date, directors, j.runtime,
    { tmdb: id, ...(j.imdb_id ? { imdb: j.imdb_id } : {}) }, j.genres, j.keywords?.keywords);
  const c = registers ? { ...c0, registers } : c0;
  known.set(k, c); added.push(c);
}
for (const [name, shelf] of Object.entries(shelves)) {
  shelfKeys[name] = [];
  for (const item of shelf.items) {
    const { ref, title, registers } = typeof item === 'string' ? { ref: item } : item;
    const m = /^(movie|tv)\/(\d+)$/.exec(ref);
    if (!m) { console.error(`${name}: не понял «${ref}» — нужно movie/<id> или tv/<id>`); continue; }
    const fix = (c: WorkCard): WorkCard => (registers ? { ...c, registers } : c);
    const id = Number(m[2]);
    if (m[1] === 'movie') {
      shelfKeys[name].push(`tmdb:${id}`);
      await addMovie(id, title, registers);
    } else {
      const j = await get<Tv>(`tv/${id}`, { append_to_response: 'keywords,external_ids' });
      const imdb = j.external_ids?.imdb_id;
      if (!imdb) { console.error(`${name}: у сериала tv/${id} «${j.name}» нет IMDb — ключа нет, пропускаю`); continue; }
      const k = `imdb:${imdb}`;
      shelfKeys[name].push(k);
      if (known.has(k)) continue;
      const c = fix(card(`f-tmdbtv${id}`, title ?? j.name, j.original_name, j.first_air_date, (j.created_by ?? []).map((p) => p.name),
        j.episode_run_time?.[0], { imdb }, j.genres, j.keywords?.results, true));
      known.set(k, c); added.push(c);
    }
  }
}

// Канон массового зрителя: сначала справочник по названию и точному году, нет — поиск TMDb по-русски,
// потом по оригинальному названию; из результатов — первый (TMDb сортирует по известности) с
// годом ±1, точный год вперёд. Не нашлось — строка в отчёт, канон поправить руками.
const normT = (t: string) => t.toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9]+/g, ' ').trim();
const byTitle = new Map<string, { key: string; year?: number }[]>();
for (const [k, w] of known) {
  if (!k.startsWith('tmdb:')) continue;
  for (const t of [w.title, w.originalTitle]) if (t) (byTitle.get(normT(t)) ?? byTitle.set(normT(t), []).get(normT(t))!).push({ key: k, year: w.year });
}
const canonKeys: string[] = [];
const unresolved: string[] = [];
for (const c of massCanonList) {
  const names = [c.title, c.original].filter((t): t is string => Boolean(t));
  // в справочнике — только точный год: «Остров» 2006-го (Лунгин) при ±1 находил «Остров» 2005-го
  // (Майкл Бэй). Год ±1 — уже в поиске TMDb, где точный год идёт первым
  const local = names.flatMap((t) => byTitle.get(normT(t)) ?? []).find((x) => x.year === c.year);
  if (local) { canonKeys.push(local.key); continue; }
  let found: number | undefined;
  for (const q of names) {
    const j = await get<{ results?: { id: number; release_date?: string }[] }>('search/movie', { query: q });
    const near = (j.results ?? []).filter((r) => r.release_date && Math.abs(Number(r.release_date.slice(0, 4)) - c.year) <= 1);
    found = (near.find((r) => Number(r.release_date!.slice(0, 4)) === c.year) ?? near[0])?.id;
    if (found != null) break;
  }
  if (found == null) { unresolved.push(`${c.title} (${c.year})`); continue; }
  canonKeys.push(`tmdb:${found}`);
  await addMovie(found);
}
console.error(`канон: ${massCanonList.length}, ключей ${canonKeys.length}${unresolved.length ? `, не нашлось в TMDb: ${unresolved.join(', ')}` : ''}`);

// Картинки, описание и «где посмотреть» — как у пула кандидатов (build-candidate-media.mts): без них
// карточка в ленте пустая. Догружаем всем, у кого их нет, — и заведённым раньше.
const client = tmdbFromEnv(key)!;
const cards = [...filmBaseCurated, ...added];
for (const [i, c] of cards.entries()) {
  if (c.coverUrl) continue;
  const tv = /^f-tmdbtv(\d+)$/.exec(c.id);
  const id = tv ? Number(tv[1]) : c.externalIds?.tmdb;
  if (id == null) continue;
  const t = tv ? await client.tv(id) : await client.movie(id);
  const watch = tv ? [] : await client.watch(id).catch(() => []);
  cards[i] = { ...c, coverUrl: t?.coverUrl, stillUrl: t?.stillUrl, imageSource: t?.imageSource, blurb: t?.blurb,
    ...(watch.length ? { watch } : {}), ...(t?.countries ? { countries: t.countries } : {}), durationMinutes: c.durationMinutes ?? t?.durationMinutes };
}

for (const c of added) console.error(`+ ${c.format === 'series' ? 'сериал' : 'фильм '} ${c.title} (${c.year ?? '?'}) ${c.originalTitle ?? ''} [${c.registers?.join(', ') || 'без регистра'}]`);
console.error(`полок: ${Object.keys(shelves).length}, новых карточек: ${added.length}, всего добавленных по полкам: ${filmBaseCurated.length + added.length}`);
if (DRY) process.exit(0);

writeFileSync(new URL('../src/mocks/filmBaseCurated.ts', import.meta.url),
  `// Сгенерировано tools/add-shelf-films.mts (${new Date().toISOString().slice(0, 10)}): произведения с полок
// src/mocks/shelves.ts, которых не было в справочнике; данные TMDb. Разметки у карточек нет — в подбор
// фильм идёт, когда у него есть черновик в draftAnnotations.ts. Дополняется, не затирается.
// Не править руками — поправить полку и перегенерировать.
import type { WorkCard } from '@/types/tmdf';

export const filmBaseCurated: WorkCard[] = ${JSON.stringify(cards, null, 2)};

/** полка → ключи произведений (\`tmdb:\` у фильмов, \`imdb:\` у сериалов) в её порядке */
export const shelfKeys: Record<string, string[]> = ${JSON.stringify(shelfKeys, null, 2)};

/** канон массового зрителя (src/mocks/massCanon.ts) → ключи фильмов, найденные в TMDb */
export const canonKeys: string[] = ${JSON.stringify([...new Set(canonKeys)], null, 2)};
`);
