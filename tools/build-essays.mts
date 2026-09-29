// Разборы с YouTube, присланные владельцем списком «фильм → ссылки» → src/mocks/essays.ts.
//   TMDB_API_KEY=… npx tsx tools/build-essays.mts <файл>
// Формат файла: строка с названием (год в конце необязателен), под ней ссылки, пустая строка —
// следующий фильм. Про ролики спрашиваем YouTube Data API (`YT_API_KEY`, 50 штук за запрос):
// название, канал, длительность, дата. Без ключа — открытый oEmbed, но там нет длительности.
// Ключ — по TMDb ID фильма, чтобы разбор прилепился к любой карточке того же фильма:
// в истории, в каталоге и в пуле кандидатов ID разные, а фильм один.
import { readFileSync, writeFileSync } from 'node:fs';
import { tmdbFromEnv } from '../src/lib/resolve/index.ts';
import { oembed, videoId, videosApi, type VideoMeta } from './youtube.mts';
import type { ExternalAnalysis } from '../src/types/tmdf.ts';

const file = process.argv[2];
if (!file) { console.error('нужен файл со списком'); process.exit(1); }
const tmdb = tmdbFromEnv(process.env.TMDB_API_KEY);
if (!tmdb) { console.error('нужен TMDB_API_KEY'); process.exit(1); }

const blocks = readFileSync(file, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean);
const ytKey = process.env.YT_API_KEY;
const allIds = blocks.map((l) => (/^https?:/.test(l) ? videoId(l) : undefined)).filter((x): x is string => Boolean(x));
const known = ytKey ? await videosApi([...new Set(allIds)], ytKey) : new Map<string, VideoMeta>();
console.error(ytKey ? `  YouTube Data API: ${known.size} из ${new Set(allIds).size} роликов` : '  без YT_API_KEY — oEmbed, без длительности');
const out: Record<string, ExternalAnalysis[]> = {};
const unmatched: string[] = [];
let current: { key: string; label: string } | undefined;

for (const line of blocks) {
  if (!/^https?:/.test(line)) {
    const m = /^(.*?)[\s,]*((?:19|20)\d{2})?$/.exec(line);
    const title = (m?.[1] ?? line).trim();
    const year = m?.[2] ? Number(m[2]) : undefined;
    // год из списка и год в базе расходятся (у «Иронии судьбы» премьера 1975-го, в TMDb 1976-й),
    // «ё» тоже пишут по-разному — поэтому четыре попытки, от самой точной к самой широкой
    const variants = [title, title.replace(/ё/g, 'е')].filter((v, i, a) => a.indexOf(v) === i);
    let found: { id: number; imdb?: string } | undefined;
    for (const v of variants) {
      found = (await tmdb.search(v, year)) ?? (await tmdb.search(v));
      if (found) break;
    }
    if (!found) { unmatched.push(line); current = undefined; console.error(`  ? ${line}`); continue; }
    current = { key: `tmdb:${found.id}`, label: line };
    console.error(`  ${line} → tmdb ${found.id}`);
    continue;
  }
  const id = videoId(line);
  if (!id || !current) { unmatched.push(line); continue; }
  const meta = known.get(id) ?? await oembed(id);
  if (!meta) { unmatched.push(line); console.error(`    ? ролик ${id}`); continue; }
  (out[current.key] ??= []).push({
    id: `yt-${id}`,
    title: meta.title,
    author: meta.author,
    platform: 'youtube',
    url: `https://www.youtube.com/watch?v=${id}`,
    language: 'ru',
    // разбор фильма почти всегда доходит до финала — открываем после просмотра
    spoilerLevel: 2,
    previewUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    ...(meta.durationMinutes ? { durationMinutes: meta.durationMinutes } : {}),
    ...(meta.publishedAt ? { publishedAt: meta.publishedAt } : {}),
  });
  console.error(`    ${meta.author} — ${meta.title}${meta.durationMinutes ? ` (${meta.durationMinutes} мин)` : ''}`);
}

writeFileSync(new URL('../src/mocks/essays.ts', import.meta.url),
  `// Сгенерировано tools/build-essays.mts (${new Date().toISOString().slice(0, 10)}): разборы с YouTube,
// присланные владельцем продукта. Ключ — «tmdb:<id>» фильма, а не ID карточки: один и тот же
// фильм в истории, каталоге и пуле имеет разные ID. Название, канал, длительность и дата —
// из YouTube Data API.
// Не править руками — перегенерировать.
import type { ExternalAnalysis } from '@/types/tmdf';

export const essays: Record<string, ExternalAnalysis[]> = ${JSON.stringify(out, null, 2)};
`);
const n = Object.values(out).reduce((s, x) => s + x.length, 0);
console.error(`→ src/mocks/essays.ts: ${n} разборов к ${Object.keys(out).length} фильмам, мимо ${unmatched.length}`);
