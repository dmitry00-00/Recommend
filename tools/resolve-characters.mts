// Герои через несколько произведений (И1): Шерлок Холмс, Джокер, Дракула — те, кто проходит через два
// и больше наших произведений (worksIndex) и кого называют в разборах. Пишет src/mocks/characters.ts;
// приложение показывает на странице произведения «этот герой есть и в…», дальше — страница героя (И2).
//   npx tsx tools/resolve-characters.mts [--fresh] [--retry-missing] [--limit N] [--dry]
//
// 1. Элемент Wikidata произведения — общий с авторами и связями (.cache/credits-ids.json).
// 2. Герои произведения — SPARQL пачками по 50: P674, обратное P1441 и роль P161 → P453.
//    Кэш — .cache/characters.json (сырые пары «произведение — герой»).
// 3. Сведения о героях — пачками по 50: метки ru/en, русские синонимы, «основано на» (P144) и
//    вымышленный ли (P31/P279* Q95074). Кэш — .cache/character-info.json.
// 4. Отбор (tools/characters-lib.mts): версии сведены к исходному герою, два и больше наших
//    произведения, назван хотя бы в одном заголовке разбора (essays, essaysAuto, postsAuto, каталог).
//    Отсеянное — .cache/characters-dropped.tsv.
// 5. Заложенные герои (.cache/westeros-seed.json — tools/seed-westeros.mts): персонажи «Песни льда и
//    огня» по книгам и сезонам — к своему элементу Wikidata или отдельным героем; правило отбора то же.
import { writeFileSync } from 'node:fs';
import { worksIndex } from './works-index.mts';
import { readCache, resolveWorkQids, sleep, sparql, writeCache } from './wikidata-lib.mts';
import { characterWorks, charactersSource, mergeSeeded, pickCharacters, type CharBinding, type CharInfo } from './characters-lib.mts';
import { seededHeroes, type WesterosSeed } from './westeros-lib.mts';
import { essays } from '../src/mocks/essays.ts';
import { essaysAuto } from '../src/mocks/essaysAuto.ts';
import { postsAuto } from '../src/mocks/postsAuto.ts';
import { externalAnalyses } from '../src/mocks/index.ts';

const args = process.argv.slice(2);
const has = (f: string) => args.includes(f);
const FRESH = has('--fresh'), DRY = has('--dry'), RETRY = has('--retry-missing');
const LIMIT = Number(args[args.indexOf('--limit') + 1]) || Infinity;

type Cell = { value: string };
type Rows = { results: { bindings: Record<string, Cell | undefined>[] } };
const qid = (s: string) => s.split('/').pop()!;

const works = worksIndex({ all: true }).slice(0, LIMIT);
console.error(`произведений: ${works.length}`);
const ids = await resolveWorkQids(works, { retryMissing: RETRY });
const keysOfWork = new Map<string, string[]>();
for (const w of works) { const q = ids[w.key]; if (q) (keysOfWork.get(q) ?? keysOfWork.set(q, []).get(q)!).push(w.key); }

// ---------- 2. герои произведений ----------
const pairs: Record<string, string[]> = FRESH ? {} : readCache('characters.json', {});
const todo = [...keysOfWork.keys()].filter((q) => !pairs[q]);
console.error(`героев искать у ${todo.length} произведений`);
for (let i = 0; i < todo.length; i += 50) {
  const chunk = todo.slice(i, i + 50);
  const query = `SELECT DISTINCT ?work ?char WHERE {
  VALUES ?work { ${chunk.map((q) => `wd:${q}`).join(' ')} }
  { ?work wdt:P674 ?char } UNION { ?char wdt:P1441 ?work } UNION { ?work p:P161 ?st . ?st pq:P453 ?char }
  FILTER(isIRI(?char))
}`;
  try {
    const r = await sparql<Rows>(query);
    const by = new Map<string, string[]>(chunk.map((q) => [q, []]));
    for (const b of r.results.bindings) by.get(qid(b.work!.value))?.push(qid(b.char!.value));
    for (const [q, list] of by) pairs[q] = [...new Set(list)];
  } catch (e) { console.error(`  пачка ${i}: ${(e as Error).message}`); }
  if (i % 500 === 0) { console.error(`  ${i}/${todo.length}`); writeCache('characters.json', pairs); }
  await sleep(400);
}
writeCache('characters.json', pairs);
const rows: CharBinding[] = [...keysOfWork.keys()].flatMap((w) => (pairs[w] ?? []).map((char) => ({ work: w, char })));

// ---------- 3. сведения о героях ----------
// только у тех, кто встречается хотя бы дважды: остальным и сводиться не с кем, кроме исходного героя,
// а исходного спросим вторым кругом
const count = new Map<string, number>();
for (const r of rows) count.set(r.char, (count.get(r.char) ?? 0) + 1);
const info: Record<string, CharInfo> = FRESH ? {} : readCache('character-info.json', {});
async function describe(list: string[]): Promise<void> {
  for (let i = 0; i < list.length; i += 50) {
    const chunk = list.slice(i, i + 50);
    const query = `SELECT ?c ?ru ?en ?alias ?root ?fic WHERE {
  VALUES ?c { ${chunk.map((q) => `wd:${q}`).join(' ')} }
  OPTIONAL { ?c rdfs:label ?ru FILTER(LANG(?ru) = "ru") }
  OPTIONAL { ?c rdfs:label ?en FILTER(LANG(?en) = "en") }
  OPTIONAL { ?c skos:altLabel ?alias FILTER(LANG(?alias) = "ru") }
  OPTIONAL { ?c wdt:P144 ?root }
  BIND(EXISTS { ?c wdt:P31/wdt:P279* wd:Q95074 } AS ?fic)
}`;
    try {
      const r = await sparql<Rows>(query);
      const acc = new Map<string, CharInfo>(chunk.map((q) => [q, { fictional: false }]));
      for (const b of r.results.bindings) {
        const e = acc.get(qid(b.c!.value))!;
        if (b.ru) e.ru ??= b.ru.value;
        if (b.en) e.en ??= b.en.value;
        if (b.alias && !(e.aka ??= []).includes(b.alias.value)) e.aka.push(b.alias.value);
        if (b.root) e.root ??= qid(b.root.value);
        if (b.fic?.value === 'true') e.fictional = true;
      }
      for (const [q, e] of acc) info[q] = e;
    } catch (e) { console.error(`  сведения, пачка ${i}: ${(e as Error).message}`); }
    await sleep(400);
  }
  writeCache('character-info.json', info);
}
await describe([...count].filter(([q, n]) => n >= 2 && !info[q]).map(([q]) => q));
// версии героя, встретившиеся по разу, тоже сводятся к исходному — для этого нужны и они, и исходный
const once = [...count].filter(([q, n]) => n === 1 && !info[q]).map(([q]) => q);
await describe(once);
const roots = [...new Set(Object.values(info).map((i) => i.root).filter((q): q is string => Boolean(q && !info[q])))];
await describe(roots);
const infoMap = new Map(Object.entries(info));

// ---------- 4. отбор ----------
const byChar = characterWorks(rows, keysOfWork, infoMap);
// заложенные герои Вестероса (tools/seed-westeros.mts): книги и сезоны из An API of Ice and Fire
const westeros = readCache<WesterosSeed | null>('westeros-seed.json', null);
if (westeros) {
  const heroes = seededHeroes(westeros, keysOfWork, new Set(works.map((w) => w.key)));
  const added = mergeSeeded(byChar, infoMap, heroes);
  console.error(`заложенные герои Вестероса: ${heroes.length} с нашими произведениями, пар «герой — произведение» прибавилось ${added}`);
}
const titles = [essays, essaysAuto, postsAuto].flatMap((src) => Object.values(src).flat().map((a) => a.title))
  .concat(externalAnalyses.map((a) => a.title));
const { kept, dropped } = pickCharacters(byChar, infoMap, titles);
writeFileSync(new URL('../.cache/characters-dropped.tsv', import.meta.url),
  ['герой\tэлемент\tпроизведений\tразборов\tпочему', ...dropped.filter((d) => d.works.length >= 2 || d.said)
    .sort((a, b) => b.works.length - a.works.length).map((d) => [d.n, d.q, d.works.length, d.said, d.why].join('\t'))].join('\n') + '\n');
console.error(`\nгероев: ${kept.length} (из ${byChar.size} вымышленных; в двух и больше произведениях, но не названы в разборах: ${dropped.filter((d) => d.why !== 'одно произведение').length})`);
for (const c of kept.slice(0, 30)) console.error(`  ${c.n}: произведений ${c.works.length}, разборов ${c.said}`);
if (DRY) process.exit(0);
writeFileSync(new URL('../src/mocks/characters.ts', import.meta.url), charactersSource(kept));
console.error('→ src/mocks/characters.ts; отсеянное — .cache/characters-dropped.tsv');
