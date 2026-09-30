// Пересказы сюжетов CMU Movie Summary Corpus по нашим фильмам — как вход для будущей
// автоматической разметки.
//   npx tsx tools/cmu-summaries.mts [путь к папке MovieSummaries]
// Корпус (Bamman, O'Connor, Smith, ACL 2013) — 42 306 пересказов из Википедии плюс
// метаданные из Freebase. Лицензия CC BY-SA: тексты держим только в .cache (в репозиторий
// не попадают), наружу из них пойдут признаки, а не пересказы.
// Сведение по названию и году: у корпуса нет ни IMDb, ни TMDb, а Freebase давно мёртв.
import { createReadStream, existsSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { worksIndex } from './works-index.mts';
import { isScreen } from '../src/lib/media.ts';

const dir = process.argv[2] ?? new URL('../.cache/cmu/MovieSummaries', import.meta.url).pathname;
if (!existsSync(`${dir}/movie.metadata.tsv`)) { console.error(`нет ${dir}/movie.metadata.tsv`); process.exit(1); }

/** Диакритика в названиях гуляет: Rashômon в одном месте, Rashomon в другом. */
const norm = (s: string) => s.normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase()
  .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

const byName = new Map<string, { id: string; year?: number; name: string }[]>();
const meta = createInterface({ input: createReadStream(`${dir}/movie.metadata.tsv`, 'utf8'), crlfDelay: Infinity });
for await (const line of meta) {
  const c = line.split('\t');
  if (c.length < 4) continue;
  const key = norm(c[2] ?? '');
  if (!key) continue;
  const year = /^(\d{4})/.exec(c[3] ?? '')?.[1];
  (byName.get(key) ?? byName.set(key, []).get(key)!).push({ id: c[0], name: c[2], year: year ? Number(year) : undefined });
}

const summary = new Map<string, string>();
const plots = createInterface({ input: createReadStream(`${dir}/plot_summaries.txt`, 'utf8'), crlfDelay: Infinity });
for await (const line of plots) {
  const tab = line.indexOf('\t');
  if (tab > 0) summary.set(line.slice(0, tab), line.slice(tab + 1));
}
console.log(`в корпусе: ${byName.size} названий, ${summary.size} пересказов`);

const ours = worksIndex().filter(({ work }) => isScreen(work));
const out: Record<string, { wikiId: string; title: string; year: number; matchedAs: string; chars: number; text: string }> = {};
let old = 0;
let oldHit = 0;
for (const { key, work } of ours) {
  const isOld = (work.year ?? 0) <= 2012;
  if (isOld) old += 1;
  for (const name of [work.originalTitle, work.title].filter(Boolean) as string[]) {
    const found = (byName.get(norm(name)) ?? [])
      .filter((c) => !c.year || !work.year || Math.abs(c.year - work.year) <= 1)
      .find((c) => summary.has(c.id));
    if (!found) continue;
    const text = summary.get(found.id)!;
    out[key] = { wikiId: found.id, title: work.title, year: work.year, matchedAs: found.name, chars: text.length, text };
    if (isOld) oldHit += 1;
    break;
  }
}
const n = Object.keys(out).length;
console.log(`наших фильмов ${ours.length}, с пересказом ${n} (${Math.round((100 * n) / ours.length)}%)`);
console.log(`до 2013 года: ${oldHit} из ${old} (${Math.round((100 * oldHit) / old)}%)`);
console.log(`2013 и позже: ${n - oldHit} из ${ours.length - old} — корпус собран в 2013, новее в нём нет ничего`);
writeFileSync(new URL('../.cache/cmu-summaries.json', import.meta.url), JSON.stringify(out));
console.log('→ .cache/cmu-summaries.json (в репозиторий не идёт: CC BY-SA)');
