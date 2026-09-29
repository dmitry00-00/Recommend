// Темп речи и тишины по каждому фильму — из замеров субтитров в слой данных.
//   npx tsx tools/build-film-form.mts
// Вход — .cache/subtitle-metrics.json (tools/build-subtitle-metrics.mts).
// В карточку идут только числа и место среди измеренных: «сложно» или «легко» из них не
// выводим — на 35 размеченных руками фильмах связь с уровнем сложности не подтверждена
// (tools/subtitles-report.mts). Зато сам замер честный и проверяемый.
import { readFileSync, writeFileSync } from 'node:fs';
import type { FilmForm } from '../src/types/tmdf.ts';

interface Row {
  key: string; title: string; files: number;
  wpm: number; gap30Share: number; maxGapSec: number; rareShare: number; wpmSpread: number | null;
}
const metrics: Record<string, Row> = JSON.parse(readFileSync(new URL('../.cache/subtitle-metrics.json', import.meta.url), 'utf8'));
const rows = Object.values(metrics);
if (!rows.length) { console.error('нет замеров — сначала tools/build-subtitle-metrics.mts'); process.exit(1); }

/** Место среди измеренных: одно число «38 слов в минуту» ничего не говорит, пока не ясно,
 *  много это или мало. Считаем по тем же 889 фильмам, что и замерили. */
function percentile(sorted: number[], value: number): number {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (sorted[mid] < value) lo = mid + 1; else hi = mid; }
  return Math.round((100 * lo) / (sorted.length - 1));
}
const wpmSorted = rows.map((r) => r.wpm).sort((a, b) => a - b);
const gapSorted = rows.map((r) => r.gap30Share).sort((a, b) => a - b);

const out: Record<string, FilmForm> = {};
for (const r of rows.sort((a, b) => a.key.localeCompare(b.key))) {
  out[r.key] = {
    wordsPerMinute: Math.round(r.wpm),
    silentShare: Number(r.gap30Share.toFixed(2)),
    longestSilenceMinutes: Number((r.maxGapSec / 60).toFixed(1)),
    rareWordShare: Number(r.rareShare.toFixed(2)),
    speechPercentile: percentile(wpmSorted, r.wpm),
    silencePercentile: percentile(gapSorted, r.gap30Share),
    sources: r.files,
    ...(r.wpmSpread != null ? { spreadWordsPerMinute: Math.round(r.wpmSpread) } : {}),
  };
}

const header = `// Сгенерировано tools/build-film-form.mts (${new Date().toISOString().slice(0, 10)}): темп речи и
// тишины по субтитрам (корпус OPUS OpenSubtitles, русские дорожки). Ключ — ключ разбора
// («tmdb:<id>»). Это замер формы, а не оценка сложности: связь с уровнем на наших
// размеченных фильмах пока не подтверждена, поэтому в карточке показываем число и место
// среди ${rows.length} измеренных, а вывод оставляем человеку.
// Не править руками — перегенерировать.
import type { FilmForm } from '@/types/tmdf';

export const filmForm: Record<string, FilmForm> = `;
writeFileSync(new URL('../src/mocks/filmForm.ts', import.meta.url), `${header}${JSON.stringify(out, null, 1)};\n`);
console.log('→ src/mocks/filmForm.ts:', Object.keys(out).length, 'фильмов');
