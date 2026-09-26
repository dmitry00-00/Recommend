// IMDb ID по TMDb ID для всех известных нам произведений → .cache/imdb-by-tmdb.json.
//   TMDB_API_KEY=… npx tsx tools/backfill-imdb.mts
// Нужен, чтобы сводить нашу базу с чужими наборами, которые ключуются по IMDb (TV Tropes,
// MovieLens, IMDb datasets). Один запрос на фильм, результат кешируется: спрашиваем только
// то, чего в кеше нет.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { worksIndex } from './works-index.mts';

const key = process.env.TMDB_API_KEY;
const file = new URL('../.cache/imdb-by-tmdb.json', import.meta.url);
const cache: Record<string, string | null> = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};

const ids = [...new Set(worksIndex()
  .map(({ work }) => work.externalIds?.tmdb)
  .filter((t): t is number => t != null))];
const todo = ids.filter((id) => !(String(id) in cache));
console.error(`фильмов с TMDb ID: ${ids.length}, в кеше ${ids.length - todo.length}, спросим ${todo.length}`);
if (todo.length && !key) { console.error('нужен TMDB_API_KEY'); process.exit(1); }

let done = 0;
for (const id of todo) {
  const r = await fetch(`https://api.themoviedb.org/3/movie/${id}/external_ids?api_key=${key}`);
  if (r.status === 429) { await new Promise((res) => setTimeout(res, 2000)); continue; }
  cache[String(id)] = r.ok ? ((await r.json() as { imdb_id?: string }).imdb_id ?? null) : null;
  done += 1;
  if (done % 100 === 0) { console.error(`  ${done}/${todo.length}`); mkdirSync(new URL('../.cache/', import.meta.url), { recursive: true }); writeFileSync(file, JSON.stringify(cache)); }
}
mkdirSync(new URL('../.cache/', import.meta.url), { recursive: true });
writeFileSync(file, JSON.stringify(cache));
const known = Object.values(cache).filter(Boolean).length;
console.error(`→ .cache/imdb-by-tmdb.json: IMDb ID известен для ${known} из ${Object.keys(cache).length}`);
