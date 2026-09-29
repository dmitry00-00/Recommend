// Разовый замер: вытягивает ли соупоминание роль «вкуса» вместо жанров. Не часть сборки.
import { essays } from '../src/mocks/essays.ts';
import { essaysAuto } from '../src/mocks/essaysAuto.ts';
import { postsAuto } from '../src/mocks/postsAuto.ts';
import { comentions } from '../src/mocks/comentions.ts';
import { voices, voiceKeys } from '../src/mocks/voices.ts';
import { worksIndex } from './works-index.mts';
import type { ExternalAnalysis } from '../src/types/tmdf.ts';

const all: Record<string, ExternalAnalysis[]> = {};
for (const src of [essays, essaysAuto, postsAuto]) for (const [k, v] of Object.entries(src)) all[k] = [...(all[k] ?? []), ...v];
const byId = new Map(voices.map((v) => [v.id, v]));
const vkey = (a: ExternalAnalysis) => { const h = /^tg-([^-]+)-/.exec(a.id)?.[1]; return h ? `tg:${h}` : `yt:${a.author}`; };
const vid = (a: ExternalAnalysis) => voiceKeys[vkey(a)] ?? vkey(a);
const cards = new Map(worksIndex().map((w) => [w.key, w.work]));

// покрытие: сколько авторов (не площадок) разобрали фильм
const authorsOf = new Map<string, Set<string>>();
for (const [k, list] of Object.entries(all)) {
  for (const a of list) {
    const id = vid(a);
    if (byId.get(id)?.role === 'platform') continue;
    (authorsOf.get(k) ?? authorsOf.set(k, new Set()).get(k)!).add(id);
  }
}
// что разобрал каждый автор
const mine = new Map<string, Set<string>>();
for (const [k, list] of Object.entries(all)) for (const a of list) {
  const id = vid(a); if (byId.get(id)?.role === 'platform') continue;
  (mine.get(id) ?? mine.set(id, new Set()).get(id)!).add(k);
}

console.log(`авторов ${mine.size}, фильмов с разбором автора ${authorsOf.size}\n`);
for (const who of (process.argv[2] ? [process.argv[2]] : ['ugolokhorror', 'seance2330', 'horrorreview', 'kinodziga', 'ubobra', 'kinolikbez'])) {
  const id = voiceKeys[`tg:${who}`] ?? `tg:${who}`;
  const seed = mine.get(id);
  if (!seed) { console.log(`— ${who}: нет в индексе`); continue; }
  const score = new Map<string, number>();
  for (const k of seed) for (const c of comentions[k] ?? []) {
    if (seed.has(c.key)) continue;
    score.set(c.key, (score.get(c.key) ?? 0) + c.weight);
  }
  const gaps = [...score].filter(([k]) => !authorsOf.has(k)).sort((a, b) => b[1] - a[1]);
  const covered = [...score].filter(([k]) => authorsOf.has(k)).length;
  console.log(`— ${byId.get(id)?.title ?? who}: разобрал ${seed.size}, соседей ${score.size} (из них уже разобраны кем-то ${covered}), дыр ${gaps.length}`);
  for (const [k, w] of gaps.slice(0, 6)) {
    const c = cards.get(k);
    console.log(`     ${(c?.title ?? k).padEnd(34)} ${String(c?.year ?? '—').padEnd(6)} вес ${w.toFixed(1)}`);
  }
  console.log();
}

// Что можно сказать автору честно уже сейчас: эксклюзивы (разобрал только он)
console.log('\n=== эксклюзивы: фильм разобрал только этот автор ===');
const rows: [string, number, number][] = [];
for (const [id, set] of mine) {
  const only = [...set].filter((k) => authorsOf.get(k)?.size === 1).length;
  rows.push([byId.get(id)?.title ?? id, set.size, only]);
}
for (const [t, n, only] of rows.sort((a, b) => b[1] - a[1]).slice(0, 12))
  console.log(`  ${t.padEnd(32)} разобрал ${String(n).padStart(4)}   только он ${String(only).padStart(4)}  (${Math.round(100 * only / n)}%)`);
