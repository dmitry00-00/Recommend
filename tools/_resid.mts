// Разовая проверка: «называют, но не разбирают». Не часть сборки.
import { essays } from '../src/mocks/essays.ts';
import { essaysAuto } from '../src/mocks/essaysAuto.ts';
import { postsAuto } from '../src/mocks/postsAuto.ts';
import { comentions } from '../src/mocks/comentions.ts';
import { voices, voiceKeys } from '../src/mocks/voices.ts';
import { worksIndex } from './works-index.mts';
import type { ExternalAnalysis } from '../src/types/tmdf.ts';

const byId = new Map(voices.map((v) => [v.id, v]));
const vid = (a: ExternalAnalysis) => {
  const h = /^tg-([^-]+)-/.exec(a.id)?.[1];
  const k = h ? `tg:${h}` : `yt:${a.author}`;
  return voiceKeys[k] ?? k;
};
const byAuthor = new Set<string>(); const byPlatform = new Set<string>();
for (const src of [essays, essaysAuto, postsAuto]) for (const [k, list] of Object.entries(src))
  for (const a of list) (byId.get(vid(a))?.role === 'platform' ? byPlatform : byAuthor).add(k);

const cards = new Map(worksIndex().map((w) => [w.key, w.work]));
// сколько раз фильм вообще назван — по сумме рёбер графа соупоминаний (нижняя оценка)
const named = new Map<string, number>();
for (const [k, list] of Object.entries(comentions)) named.set(k, list.reduce((s, c) => s + c.n, 0));

const all = [...named].sort((a, b) => b[1] - a[1]);
console.log(`фильмов названо в постах: ${all.length}`);
console.log(`из них с разбором автора: ${all.filter(([k]) => byAuthor.has(k)).length}`);
console.log(`только у площадок (форсили, автор не взял): ${all.filter(([k]) => !byAuthor.has(k) && byPlatform.has(k)).length}`);
const gap = all.filter(([k]) => !byAuthor.has(k) && !byPlatform.has(k));
console.log(`никем: ${gap.length}\n`);
console.log('называют часто, но разбора нет ни у кого:');
for (const [k, n] of gap.slice(0, 14)) {
  const c = cards.get(k);
  console.log(`  ${String(n).padStart(3)} упом.  ${(c?.title ?? k).padEnd(34)} ${c?.year ?? ''}`);
}
