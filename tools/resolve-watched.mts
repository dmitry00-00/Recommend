// Разбор списка просмотренного, присланного участником текстом → src/mocks/userWatched.ts.
//   TMDB_API_KEY=… npx tsx tools/resolve-watched.mts <файл со списком>
// Одна строка — одно название, год в конце необязателен. Поиск по TMDb (ru), внешние ID и
// картинки; несопоставленное печатается списком, чтобы участник поправил название.
import { readFileSync, writeFileSync } from 'node:fs';
import { tmdbFromEnv } from '../src/lib/resolve/index.ts';
import type { WorkCard } from '../src/types/tmdf.ts';

const file = process.argv[2];
if (!file) { console.error('нужен файл со списком'); process.exit(1); }
const tmdb = tmdbFromEnv(process.env.TMDB_API_KEY);
if (!tmdb) { console.error('нужен TMDB_API_KEY'); process.exit(1); }

const lines = readFileSync(file, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean);
const works: WorkCard[] = [];
const unmatched: string[] = [];

for (const line of lines) {
  const m = /^(.*?)[\s,]*((?:19|20)\d{2})?$/.exec(line);
  const title = (m?.[1] ?? line).trim();
  const year = m?.[2] ? Number(m[2]) : undefined;
  try {
    // «ё» в списке участника и «е» в базе — частая причина промаха, пробуем оба написания
    const variants = [title, title.replace(/ё/g, 'е')].filter((v, i, a) => a.indexOf(v) === i);
    let found: { id: number; imdb?: string } | undefined;
    for (const v of variants) {
      found = (await tmdb.search(v, year)) ?? (year ? await tmdb.search(v) : undefined);
      if (found) break;
    }
    if (!found) { unmatched.push(line); continue; }
    const t = await tmdb.movie(found.id);
    if (!t?.title) { unmatched.push(line); continue; }
    works.push({
      id: `l-tmdb${found.id}`, type: 'film', title: t.title, originalTitle: t.originalTitle, year: t.year ?? year ?? 0,
      creators: t.creators ?? [], countries: t.countries, coverUrl: t.coverUrl, stillUrl: t.stillUrl,
      imageSource: t.imageSource, blurb: t.blurb, durationMinutes: t.durationMinutes,
      primaryOperations: [], complexityLevel: 0, warnings: [], barriers: [], isNicheMasterpiece: false,
      externalIds: { tmdb: found.id, ...(found.imdb ? { imdb: found.imdb } : {}) },
    });
    console.error(`  ${line} → ${t.title} (${t.year}) ${t.creators?.[0] ?? ''}`);
  } catch (e) {
    console.error(`  ${line}: ${(e as Error).message}`);
    unmatched.push(line);
  }
}

const header = `// Сгенерировано tools/resolve-watched.mts (${new Date().toISOString().slice(0, 10)}) из списка
// просмотренного, присланного участником текстом (не «любимое»: оценки в основном около 7 из 10,
// часть 8–9, часть 5–6). Разметки и оценок нет — это свидетельство о выборе, а не о предпочтении:
// показывает, что участник смотрит на самом деле, и что ему больше не надо предлагать.
// Не править руками — перегенерировать.
import type { WorkCard } from '@/types/tmdf';

export const watchedWorks: WorkCard[] = `;
writeFileSync(new URL('../src/mocks/userWatched.ts', import.meta.url),
  `${header}${JSON.stringify(works, null, 2)};\n\nexport const watchedUnmatched: string[] = ${JSON.stringify(unmatched, null, 2)};\n`);
console.error(`→ src/mocks/userWatched.ts: ${works.length} из ${lines.length}, не найдено ${unmatched.length}`);
if (unmatched.length) console.error(unmatched.map((u) => `  ? ${u}`).join('\n'));
