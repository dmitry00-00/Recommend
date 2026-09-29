// Разовая проверка: отличаются ли разобранные фильмы по форме от неразобранных. Не часть сборки.
import { essays } from '../src/mocks/essays.ts';
import { essaysAuto } from '../src/mocks/essaysAuto.ts';
import { postsAuto } from '../src/mocks/postsAuto.ts';
import { filmForm } from '../src/mocks/filmForm.ts';
import { voices, voiceKeys } from '../src/mocks/voices.ts';
import type { ExternalAnalysis } from '../src/types/tmdf.ts';

const byId = new Map(voices.map((v) => [v.id, v]));
const vid = (a: ExternalAnalysis) => {
  const h = /^tg-([^-]+)-/.exec(a.id)?.[1];
  const k = h ? `tg:${h}` : `yt:${a.author}`;
  return voiceKeys[k] ?? k;
};
const covered = new Set<string>();
for (const src of [essays, essaysAuto, postsAuto]) for (const [k, list] of Object.entries(src))
  for (const a of list) if (byId.get(vid(a))?.role !== 'platform') covered.add(k);

const keys = Object.keys(filmForm);
const yes = keys.filter((k) => covered.has(k));
const no = keys.filter((k) => !covered.has(k));
console.log(`фильмов с формой ${keys.length}: разобрано автором ${yes.length}, нет ${no.length}\n`);

const med = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const F = ['wordsPerMinute', 'silentShare', 'longestSilenceMinutes', 'rareWordShare'] as const;
console.log('признак                  разобранные   нет   разница');
for (const f of F) {
  const a = med(yes.map((k) => filmForm[k][f]));
  const b = med(no.map((k) => filmForm[k][f]));
  console.log(`  ${f.padEnd(22)} ${String(a).padStart(7)} ${String(b).padStart(7)}   ${(((a - b) / b) * 100).toFixed(0)}%`);
}
// год — главный подозреваемый: разбирают свежее и знаменитое, а не «медленное»
console.log('\nдоля разобранных по децилям тишины (100 = молчит дольше всех):');
for (let d = 0; d < 10; d++) {
  const band = keys.filter((k) => filmForm[k].silencePercentile >= d * 10 && filmForm[k].silencePercentile < d * 10 + 10);
  const hit = band.filter((k) => covered.has(k)).length;
  console.log(`  ${String(d * 10).padStart(3)}–${String(d * 10 + 9).padStart(3)}  n=${String(band.length).padStart(4)}  разобрано ${(100 * hit / (band.length || 1)).toFixed(1)}%`);
}
