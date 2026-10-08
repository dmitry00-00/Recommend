// Лицо и пара слов об авторе (06.10): страница режиссёра, создателя сериала, писателя (/person/:id) —
// фото, описание одной строкой и годы жизни из Wikidata. Пишет src/mocks/peopleInfo.ts.
//   npx tsx tools/resolve-people-info.mts [--fresh] [--dry]
//
// Кто: люди из workCredits.ts в ролях режиссёра (d), создателя сериала (c) и автора книги (a) —
// те, у кого есть своя страница с работами. Сценаристы без других ролей — нет: их страниц
// почти не открывают, а запросов это удвоило бы.
// Что: P18 (изображение) → ссылка на Commons с шириной 240, schema:description по-русски (нет —
// английское), P569/P570 — годы рождения и смерти. Кэш — .cache/people-info.json (по элементу,
// и «ничего не нашлось» тоже): повторный прогон спрашивает только новых.
import { writeFileSync } from 'node:fs';
import { readCache, sleep, sparql, writeCache } from './wikidata-lib.mts';
import { workCredits } from '../src/mocks/workCredits.ts';

export interface PersonInfo { img?: string; d?: string; b?: number; x?: number }

const FRESH = process.argv.includes('--fresh');
const DRY = process.argv.includes('--dry');
const BATCH = 150;

const wanted = new Set<string>();
for (const line of Object.values(workCredits)) {
  for (const part of line.split(',')) {
    const [q, role] = part.split(':');
    if (/^Q\d+$/.test(q) && /[dca]/.test(role ?? '')) wanted.add(q);
  }
}
const cache = FRESH ? {} : readCache<Record<string, PersonInfo>>('people-info.json', {});
const todo = [...wanted].filter((q) => !(q in cache));
console.error(`людей с ролью режиссёра, создателя или автора: ${wanted.size}, спросить: ${todo.length}`);

type Row = Record<string, { value: string; 'xml:lang'?: string } | undefined>;
const year = (v?: string) => (v ? Number(/^-?\d{1,4}/.exec(v)?.[0]) || undefined : undefined);
for (let i = 0; i < todo.length && !DRY; i += BATCH) {
  const chunk = todo.slice(i, i + BATCH);
  const r = await sparql<{ results: { bindings: Row[] } }>(`SELECT ?p ?img ?d ?b ?x WHERE {
    VALUES ?p { ${chunk.map((q) => `wd:${q}`).join(' ')} }
    OPTIONAL { ?p wdt:P18 ?img }
    OPTIONAL { ?p schema:description ?d FILTER(LANG(?d) IN ("ru", "en")) }
    OPTIONAL { ?p wdt:P569 ?b }
    OPTIONAL { ?p wdt:P570 ?x }
  }`);
  for (const q of chunk) cache[q] = {};
  for (const row of r.results.bindings) {
    const q = row.p!.value.split('/').pop()!;
    const c = cache[q];
    if (row.img && !c.img) c.img = `${row.img.value.replace(/^http:/, 'https:')}?width=240`;
    // русское описание сильнее английского
    if (row.d && (!c.d || row.d['xml:lang'] === 'ru')) c.d = row.d.value;
    if (row.b && !c.b) c.b = year(row.b.value);
    if (row.x && !c.x) c.x = year(row.x.value);
  }
  writeCache('people-info.json', cache);
  console.error(`  ${Math.min(i + BATCH, todo.length)}/${todo.length}`);
  await sleep(1000);
}

const out: Record<string, PersonInfo> = {};
for (const q of [...wanted].sort()) {
  const c = cache[q];
  if (c && (c.img || c.d)) out[q] = c;
}
console.error(`с фото ${Object.values(out).filter((c) => c.img).length}, с описанием ${Object.values(out).filter((c) => c.d).length} из ${wanted.size}`);
if (!DRY) {
  writeFileSync(new URL('../src/mocks/peopleInfo.ts', import.meta.url),
    `// Сгенерировано tools/resolve-people-info.mts — руками не править. Автор (элемент Wikidata) → фото (Commons),
// описание одной строкой, годы рождения и смерти — для шапки страницы автора.
export interface PersonInfo { img?: string; d?: string; b?: number; x?: number }

export const peopleInfo: Record<string, PersonInfo> = ${JSON.stringify(out)};
`);
}
