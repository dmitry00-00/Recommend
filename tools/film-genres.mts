// Жанры фильмов TMDb для якоря вкуса новичка (09.10): кэш .cache/tmdb-tags.json (его пополняет
// build-base-media) → src/mocks/filmGenres.ts. Только фильмы: ключ кэша — id фильма TMDb, у
// сериалов свои id, которые с ним пересекаются. Ключевые слова не выгружаем — они тяжёлые, а
// жанра на первую ленту хватает.
//   npx tsx tools/film-genres.mts
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const cacheFile = '.cache/tmdb-tags.json';
const outFile = 'src/mocks/filmGenres.ts';
if (!existsSync(cacheFile)) { console.error(`нет ${cacheFile} — сначала build-base-media`); process.exit(1); }
const cache: Record<string, { genres?: string[] }> = JSON.parse(readFileSync(cacheFile, 'utf8'));

const out: Record<string, string[]> = {};
for (const id of Object.keys(cache).sort((a, b) => Number(a) - Number(b))) {
  const g = cache[id].genres ?? [];
  if (g.length) out[`tmdb:${id}`] = g;
}
const lines = Object.entries(out).map(([k, g]) => `  ${JSON.stringify(k)}: ${JSON.stringify(g)},`);
writeFileSync(outFile, `// Сгенерировано tools/film-genres.mts (${new Date().toISOString().slice(0, 10)}): жанры фильмов TMDb по-русски,
// ключ — «tmdb:<id фильма>». Нужны якорю вкуса новичка (src/lib/model/taste.ts).
// Не править руками — перегенерировать.
export const filmGenres: Record<string, string[]> = {
${lines.join('\n')}
};
`);
console.log(`жанры: ${lines.length} фильмов → ${outFile}`);
