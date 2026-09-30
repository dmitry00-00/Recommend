// Связи между произведениями (Ж1): экранизация, сиквел, ремейк, часть цикла или франшизы — по
// Wikidata — для всего, что мы знаем (worksIndex). Пишет src/mocks/workRelations.ts; приложение
// показывает связи на странице произведения, дальше на них встанут вселенные (Ж2), слот «дальше
// во вселенной» (Ж3) и сторож экранизаций (Ж4).
//   npx tsx tools/resolve-relations.mts [--fresh] [--retry-missing] [--limit N] [--dry]
//
// 1. Элемент Wikidata произведения — общий с резолвом авторов (tools/wikidata-lib.mts,
//    .cache/credits-ids.json): кто прогнал одно, тому второе ищет только новое.
// 2. Связи — SPARQL пачками по 50: P144 (основано на), P155/P156 (предыдущее/следующее), P179
//    (часть серии), P8345 (медиафраншиза); у той стороны — метки ru/en, год (P577) и класс P31.
//    Кэш — .cache/relations.json.
// 3. Мок: узлы — те, что встречаются в рёбрах; у наших — ключ произведения.
import { writeFileSync } from 'node:fs';
import { worksIndex } from './works-index.mts';
import { isSeries } from '../src/lib/media.ts';
import type { RelationNodeKind, WorkCard } from '../src/types/tmdf.ts';
import { readCache, resolveWorkQids, sleep, sparql, writeCache } from './wikidata-lib.mts';
import { parseRelations, relationsSource, type RelBinding, type RelEdge, type RelNode } from './relations-lib.mts';

const args = process.argv.slice(2);
const has = (f: string) => args.includes(f);
const FRESH = has('--fresh'), DRY = has('--dry'), RETRY = has('--retry-missing');
const LIMIT = Number(args[args.indexOf('--limit') + 1]) || Infinity;

/** Кэш по элементу: сырые строки SPARQL — разбор дешёвый, а правила разбора ещё будут меняться. */
const cache: Record<string, RelBinding[]> = FRESH ? {} : readCache('relations.json', {});

const kindOfWork = (w: WorkCard): RelationNodeKind => (w.type === 'book' ? 'book' : isSeries(w) ? 'series' : 'film');
const works = worksIndex({ all: true }).slice(0, LIMIT);
console.error(`произведений: ${works.length}`);
const ids = await resolveWorkQids(works, { retryMissing: RETRY });
const withQ = works.filter((w) => ids[w.key]);

const todo = [...new Set(withQ.map((w) => ids[w.key]!))].filter((q) => !cache[q]);
console.error(`связи искать: ${todo.length}`);
for (let i = 0; i < todo.length; i += 50) {
  const chunk = todo.slice(i, i + 50);
  const query = `SELECT ?item ?prop ?target ?ru ?en ?year ?cls WHERE {
  VALUES ?item { ${chunk.map((q) => `wd:${q}`).join(' ')} }
  VALUES (?prop ?claim) { (wd:P144 wdt:P144) (wd:P155 wdt:P155) (wd:P156 wdt:P156) (wd:P179 wdt:P179) (wd:P8345 wdt:P8345) }
  ?item ?claim ?target .
  FILTER(isIRI(?target))
  OPTIONAL { ?target rdfs:label ?ru FILTER(LANG(?ru) = "ru") }
  OPTIONAL { ?target rdfs:label ?en FILTER(LANG(?en) = "en") }
  OPTIONAL { ?target wdt:P577 ?year }
  OPTIONAL { ?target wdt:P31 ?cls }
}`;
  try {
    type Cell = { value: string };
    const r = await sparql<{ results: { bindings: Record<string, Cell | undefined>[] } }>(query);
    const byItem = new Map<string, RelBinding[]>(chunk.map((q) => [q, []]));
    for (const b of r.results.bindings) {
      const item = b.item!.value.split('/').pop()!;
      byItem.get(item)?.push({ item: b.item!.value, prop: b.prop!.value, target: b.target!.value,
        ...(b.ru ? { ru: b.ru.value } : {}), ...(b.en ? { en: b.en.value } : {}), ...(b.year ? { year: b.year.value } : {}), ...(b.cls ? { cls: b.cls.value } : {}) });
    }
    for (const [q, rows] of byItem) cache[q] = rows;
  } catch (e) {
    console.error(`  пачка ${i}: ${(e as Error).message}`);
  }
  if (i % 500 === 0) { console.error(`  ${i}/${todo.length}`); writeCache('relations.json', cache); }
  await sleep(400);
}
writeCache('relations.json', cache);

// ---------- разбор ----------
const own = new Map<string, RelationNodeKind>();
const ownNodes = new Map<string, RelNode & { key: string }>();
for (const w of withQ) {
  const q = ids[w.key]!;
  own.set(q, kindOfWork(w.work));
  if (!ownNodes.has(q)) ownNodes.set(q, { t: w.work.title, ...(w.work.year ? { y: w.work.year } : {}), k: kindOfWork(w.work), key: w.key });
}
const rows = [...new Set(withQ.map((w) => ids[w.key]!))].flatMap((q) => cache[q] ?? []);
const { nodes, edges } = parseRelations(rows, own);
// наши — со своим названием и ключом: так приложение находит карточку по ту сторону связи
const all = new Map<string, RelNode & { key?: string }>([...nodes, ...ownNodes]);
const valid: RelEdge[] = edges.filter(([a, , b]) => all.has(a) && all.has(b));

const count = (k: string) => valid.filter((e) => e[1] === k).length;
const linkedOwn = new Set(valid.flatMap(([a, , b]) => [a, b]).filter((q) => ownNodes.has(q)));
console.error(`\nсвязей: ${valid.length} — экранизаций ${count('adaptation_of')}, сиквелов ${count('sequel_of')}, ремейков ${count('remake_of')}, частей ${count('part_of')}`);
console.error(`наших произведений со связями: ${linkedOwn.size} из ${withQ.length}; связей между двумя нашими: ${valid.filter(([a, , b]) => ownNodes.has(a) && ownNodes.has(b)).length}`);
if (DRY) process.exit(0);
writeFileSync(new URL('../src/mocks/workRelations.ts', import.meta.url), relationsSource(all, valid));
console.error('→ src/mocks/workRelations.ts');
