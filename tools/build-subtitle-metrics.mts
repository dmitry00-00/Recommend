// Форма фильма, посчитанная по субтитрам: сколько в нём говорят, как плотно и какими словами.
//   npx tsx tools/build-subtitle-metrics.mts [--limit N]
// Зачем: `complexityLevel` у нас проставлен руками у 43 произведений, а нужен у тысячи.
// Разметка чужими тегами (TV Tropes) эту дыру не закрывает — она про «о чём», а не «сколько
// требует». Плотность речи, длина пауз и доля редких слов считаются механически и метят
// ровно в нагрузку. Результат — .cache/subtitle-metrics.json, тексты субтитров не храним.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { OPUS_RU, parseCues, words, imdbOf } from './opus-subtitles.mts';
import { zipIndex, zipRead, type ZipEntry } from './remote-zip.mts';
import { worksIndex } from './works-index.mts';

const limit = Number(process.argv.includes('--limit') ? process.argv[process.argv.indexOf('--limit') + 1] : 0) || 0;
const cacheDir = new URL('../.cache/', import.meta.url);
if (!existsSync(cacheDir)) mkdirSync(cacheDir);
const imdbByTmdb: Record<string, string | null> = JSON.parse(readFileSync(new URL('imdb-by-tmdb.json', cacheDir), 'utf8'));

const ours = new Map<string, { key: string; title: string; year?: number; minutes?: number; marked: boolean }>();
for (const { key, work } of worksIndex()) {
  if (work.type !== 'film') continue;
  const imdb = work.externalIds?.imdb ?? (work.externalIds?.tmdb != null ? imdbByTmdb[String(work.externalIds.tmdb)] : null);
  if (!imdb || ours.has(imdb)) continue;
  ours.set(imdb, {
    key, title: work.title, year: work.year, minutes: work.durationMinutes,
    marked: Boolean(work.complexityLevel && work.primaryOperations?.length),
  });
}
console.log('наших фильмов с IMDb:', ours.size, '| из них с длительностью:', [...ours.values()].filter((w) => w.minutes).length);

const index = await zipIndex(OPUS_RU);
const byFilm = new Map<string, ZipEntry[]>();
let split = 0;
for (const entry of index) {
  const id = imdbOf(entry.name);
  if (!id || !ours.has(id.imdb)) continue;
  if (id.parts > 1) { split++; continue; } // фильм, разрезанный на диски: время в каждом куске своё
  byFilm.set(id.imdb, [...(byFilm.get(id.imdb) ?? []), entry]);
}
console.log('фильмов найдено в корпусе:', byFilm.size, `(${Math.round((100 * byFilm.size) / ours.size)}%)`,
  '| пропущено кусков многодисковых:', split);

/** До трёх переводов на фильм: по каждому считаем своё, в карточку кладём медиану —
 *  один кривой рип не должен решать за фильм. */
const PER_FILM = 3;
const chosen = [...byFilm.entries()].map(([imdb, list]) => [imdb, list.sort((a, b) => b.size - a.size).slice(0, PER_FILM)] as const);
const files = chosen.reduce((n, [, l]) => n + l.length, 0);
console.log('файлов к загрузке:', files, '≈', Math.round(chosen.reduce((n, [, l]) => n + l.reduce((s, e) => s + e.compressed, 0), 0) / 1e6), 'МБ');

interface FileStat {
  cues: number; tokens: number; spanMin: number; speechSec: number;
  wpm: number; speechShare: number; meanCueSec: number; wordsPerCue: number;
  gap30Share: number; maxGapSec: number; meanWordLen: number; ttr: number;
}

function statsOf(xml: string, into: Map<string, number>): FileStat | undefined {
  const cues = parseCues(xml);
  if (cues.length < 100) return undefined; // не субтитры фильма, а подпись или обрывок
  const first = cues[0].start;
  const last = cues[cues.length - 1].end;
  const spanMin = (last - first) / 60;
  if (spanMin < 20) return undefined;
  const speechSec = cues.reduce((s, c) => s + (c.end - c.start), 0);
  let tokens = 0;
  let letters = 0;
  const firstTokens: string[] = [];
  for (const c of cues) {
    for (const w of words(c.text)) {
      tokens++; letters += w.length;
      into.set(w, (into.get(w) ?? 0) + 1);
      if (firstTokens.length < 2000) firstTokens.push(w);
    }
  }
  if (tokens < 500) return undefined;
  let gapSec = 0;
  let maxGap = 0;
  for (let i = 1; i < cues.length; i++) {
    const gap = cues[i].start - cues[i - 1].end;
    if (gap > 30) gapSec += gap;
    if (gap > maxGap) maxGap = gap;
  }
  return {
    cues: cues.length, tokens, spanMin, speechSec,
    wpm: tokens / spanMin,
    speechShare: speechSec / (last - first),
    meanCueSec: speechSec / cues.length,
    wordsPerCue: tokens / cues.length,
    gap30Share: gapSec / (last - first),
    maxGapSec: maxGap,
    meanWordLen: letters / tokens,
    ttr: new Set(firstTokens).size / Math.max(1, firstTokens.length),
  };
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

/** Берём файлы пачками: object storage отдаёт Range быстро, но долбить его в сто потоков незачем. */
async function pool<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: size }, async () => {
    for (let i = next++; i < items.length; i = next++) out[i] = await fn(items[i]);
  }));
  return out;
}

const work = limit ? chosen.slice(0, limit) : chosen;
let done = 0;
let failed = 0;
const perFilm = await pool(work, 8, async ([imdb, entries]) => {
  const stats: FileStat[] = [];
  // словарь копим один на фильм, а не на файл: три перевода одного фильма — один словарь,
  // иначе счётчики всех фильмов разом не помещаются в память
  const counts = new Map<string, number>();
  for (const entry of entries) {
    try {
      const s = statsOf(await zipRead(entry, OPUS_RU), counts);
      if (s) stats.push(s);
    } catch { failed++; }
  }
  if (++done % 100 === 0) process.stdout.write(`  ${done}/${work.length}\n`);
  return [imdb, stats, counts] as const;
});
console.log('фильмов с пригодными субтитрами:', perFilm.filter(([, s]) => s.length).length, '| сбоев чтения:', failed);

// Ядро языка считаем по самому корпусу: внешний частотный словарь тут лишний, а «редкое
// слово» нам нужно относительно того, как вообще говорят в кино.
const CORE = 5000;
const total = new Map<string, number>();
for (const [, stats, counts] of perFilm) if (stats.length) for (const [w, n] of counts) total.set(w, (total.get(w) ?? 0) + n);
const core = new Set([...total.entries()].sort((a, b) => b[1] - a[1]).slice(0, CORE).map(([w]) => w));
console.log('разных слов в корпусе:', total.size, '| ядро:', core.size);

const out: Record<string, unknown> = {};
for (const [imdb, stats, counts] of perFilm) {
  if (!stats.length) continue;
  let outside = 0;
  let all = 0;
  for (const [w, n] of counts) { all += n; if (!core.has(w)) outside += n; }
  const meta = ours.get(imdb)!;
  const pick = (f: (s: FileStat) => number) => Number(median(stats.map(f)).toFixed(4));
  out[imdb] = {
    key: meta.key, title: meta.title, year: meta.year, minutes: meta.minutes, marked: meta.marked,
    files: stats.length,
    wpm: pick((s) => s.wpm),
    speechShare: pick((s) => s.speechShare),
    meanCueSec: pick((s) => s.meanCueSec),
    wordsPerCue: pick((s) => s.wordsPerCue),
    gap30Share: pick((s) => s.gap30Share),
    maxGapSec: pick((s) => s.maxGapSec),
    meanWordLen: pick((s) => s.meanWordLen),
    ttr: pick((s) => s.ttr),
    rareShare: Number((outside / all).toFixed(4)),
    spanMin: pick((s) => s.spanMin),
    // разброс между переводами одного фильма — сколько из метрики шум, а сколько фильм
    wpmSpread: stats.length > 1 ? Number((Math.max(...stats.map((s) => s.wpm)) - Math.min(...stats.map((s) => s.wpm))).toFixed(2)) : null,
  };
}
writeFileSync(new URL('subtitle-metrics.json', cacheDir), JSON.stringify(out, null, 1));
writeFileSync(new URL('ru-core-words.json', cacheDir), JSON.stringify([...core], null, 0));
console.log('→ .cache/subtitle-metrics.json:', Object.keys(out).length, 'фильмов');
