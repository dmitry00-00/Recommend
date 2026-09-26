// Базовая частота регистров «по миру»: доля фильмов каждого регистра в широкой выборке TMDb.
//   TMDB_API_KEY=… TAGS_CACHE=/…/tmdb-tags.json npx tsx tools/build-register-base.mts [страниц]
// Нужна, чтобы вкус считался относительно того, что вообще снимают, а не относительно нашего
// пула: пул собран руками и сам перекошен, на нём «смотрит ужасы втрое чаще обычного»
// превращается в «как все». Выборка — популярное за последние десятилетия, без фильтра по жанру.
import { writeFileSync } from 'node:fs';
import { pick, tagSource } from './register-tags.mts';
import { registerKeys } from '../src/lib/registers.ts';
import type { Register } from '../src/types/tmdf.ts';

const key = process.env.TMDB_API_KEY;
if (!key) { console.error('нужен TMDB_API_KEY'); process.exit(1); }
const pages = Number(process.argv[2] ?? 15);
const { tags, save } = tagSource();

const ids: number[] = [];
for (let page = 1; page <= pages; page += 1) {
  const qs = new URLSearchParams({ api_key: key, language: 'ru-RU', sort_by: 'popularity.desc', page: String(page),
    'vote_count.gte': '200', 'primary_release_date.gte': '1960-01-01', include_adult: 'false' });
  const r = await fetch(`https://api.themoviedb.org/3/discover/movie?${qs}`);
  if (!r.ok) { console.error(`discover ${r.status}`); break; }
  const j = await r.json() as { results: { id: number }[] };
  ids.push(...j.results.map((x) => x.id));
}

const counts: Partial<Record<Register, number>> = {};
let total = 0;
for (const id of ids) {
  const t = await tags(id);
  for (const r of pick(t.genres, t.keywords)) { counts[r] = (counts[r] ?? 0) + 1; total += 1; }
}
save();
const base: Record<string, number> = {};
for (const r of registerKeys) base[r] = Math.round(((counts[r] ?? 0) / Math.max(1, total)) * 1000) / 1000;
writeFileSync(new URL('../src/mocks/registerBase.ts', import.meta.url),
  `// Сгенерировано tools/build-register-base.mts (${new Date().toISOString().slice(0, 10)}): доля регистров
// в широкой выборке TMDb (${ids.length} фильмов, популярное с 1960-го, без фильтра по жанру) — то,
// относительно чего считается вкус участника. Не править руками — перегенерировать.
import type { Register } from '@/types/tmdf';

export const registerBase: Record<Register, number> = ${JSON.stringify(base, null, 2)};
`);
console.error(`→ src/mocks/registerBase.ts по ${ids.length} фильмам:`);
console.error(registerKeys.map((r) => `  ${r.padEnd(16)}${((base[r] ?? 0) * 100).toFixed(1)}%`).join('\n'));
