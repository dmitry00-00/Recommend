// Разовая выборка для оценки точности привязок. Не часть сборки.
import { postsAuto } from '../src/mocks/postsAuto.ts';
import { filmBase } from '../src/mocks/filmBase.ts';
import { filmBaseWiki } from '../src/mocks/filmBaseWiki.ts';
import { watchedWorks } from '../src/mocks/userWatched.ts';

const byKey = new Map<string, string>();
for (const w of [...filmBase, ...filmBaseWiki]) {
  const id = w.externalIds?.tmdb;
  if (id) byKey.set(`tmdb:${id}`, `${w.title} (${w.year ?? '—'})`);
}

const rows: { work: string; author: string; title: string }[] = [];
for (const [key, list] of Object.entries(postsAuto)) {
  for (const a of list) rows.push({ work: byKey.get(key) ?? key, author: a.author ?? '?', title: (a.title ?? '').slice(0, 110) });
}
console.log(`всего привязок: ${rows.length}, произведений: ${Object.keys(postsAuto).length}`);

const N = Math.max(1, Math.floor(rows.length / 24));
for (let i = 0; i < rows.length; i += N) {
  const r = rows[i];
  console.log(`\n[${i}] ${r.work}\n   ← ${r.author}: ${r.title}`);
}

const keys = new Set(Object.keys(postsAuto));
const seen = watchedWorks.filter((w) => w.externalIds?.tmdb);
const hit = seen.filter((w) => keys.has(`tmdb:${w.externalIds!.tmdb}`));
console.log(`\n--- просмотрено с tmdb: ${seen.length}, из них с разборами: ${hit.length} (${Math.round((hit.length / seen.length) * 100)}%)`);
