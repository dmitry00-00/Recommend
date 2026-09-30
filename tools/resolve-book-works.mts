// Книга — произведение, а не издание (З1): ISBN → работа Open Library → элемент Wikidata.
//   npx tsx tools/resolve-book-works.mts [--fresh] [--dry]
// 1. Open Library: /isbn/<isbn>.json — издание, в нём `works[0].key` = «/works/OL…W».
// 2. Wikidata: элемент с Open Library ID (P648) этой работы — `haswbstatement:P648=OL…W`; иначе
//    элемент издания (P648 = OL…M издания) и его «издание произведения» (P629). ISBN напрямую в
//    Wikidata не ищем: он там с дефисами, а поиск по цифрам — полный перебор. Нашлось — ключ
//    книги `wd:`, иначе `olw:`.
// Все ISBN всех книг справочника (у карточки их бывает несколько — издания). Кэш —
// .cache/book-works.json; итог — src/mocks/bookWorks.ts. После него — перегенерировать всё, что
// подписано ключом (ночной сборщик сделает сам; до того приложение ищет и по старым `isbn:`).
import { writeFileSync } from 'node:fs';
import { worksIndex } from './works-index.mts';
import { externalIds } from '../src/mocks/externalIds.ts';
import { readCache, search, sleep, wd, writeCache } from './wikidata-lib.mts';

const args = process.argv.slice(2);
const FRESH = args.includes('--fresh'), DRY = args.includes('--dry');
const UA = 'transformative-media/0.1 (book index; contact via repository README)';

type Entry = { olw?: string; wd?: string; miss?: true };
const cache: Record<string, Entry> = FRESH ? {} : readCache('book-works.json', {});

// книги — без моста: он и строится здесь
const books = worksIndex({ all: true, isbnKeys: true }).filter((w) => w.work.type === 'book' || /^(?:isbn|olw|wd):/.test(w.key));
const idsOf = (w: (typeof books)[number]['work']) => w.externalIds ?? externalIds[w.id];
const isbns = [...new Set(books.flatMap((b) => idsOf(b.work)?.isbn ?? []))];
console.error(`книг: ${books.length}, ISBN: ${isbns.length}`);

let asked = 0;
for (const isbn of isbns) {
  if (cache[isbn] && !cache[isbn].miss) continue;
  const entry: Entry = {};
  try {
    const r = await fetch(`https://openlibrary.org/isbn/${isbn}.json`, { headers: { 'User-Agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(20000) });
    let edition: string | undefined;
    if (r.ok) {
      const ed = await r.json() as { key?: string; works?: { key: string }[] };
      const olw = ed.works?.[0]?.key?.split('/').pop();
      if (olw && /^OL\d+W$/.test(olw)) entry.olw = olw;
      edition = ed.key?.split('/').pop();
    }
    entry.wd = (entry.olw ? await search(`P648=${entry.olw}`) : null) ?? undefined;
    if (!entry.wd && edition && /^OL\d+M$/.test(edition)) {
      // в Wikidata бывает элемент издания (с Open Library ID издания) — берём его «издание произведения» (P629)
      const ed = await search(`P648=${edition}`);
      if (ed) {
        const e = await wd<{ entities?: Record<string, { claims?: { P629?: { mainsnak: { datavalue?: { value: { id: string } } } }[] } }> }>(
          { action: 'wbgetentities', ids: ed, props: 'claims' });
        entry.wd = e.entities?.[ed]?.claims?.P629?.[0]?.mainsnak.datavalue?.value.id ?? undefined;
      }
    }
  } catch (e) {
    console.error(`  ${isbn}: ${(e as Error).message}`);
    continue; // сбой сети — спросим в следующий раз
  }
  cache[isbn] = entry.olw || entry.wd ? entry : { miss: true };
  if (++asked % 20 === 0) writeCache('book-works.json', cache);
  await sleep(300);
}
writeCache('book-works.json', cache);

const out: Record<string, { olw?: string; wd?: string }> = {};
for (const [isbn, e] of Object.entries(cache)) if (isbns.includes(isbn) && (e.olw || e.wd)) out[isbn] = { ...(e.olw ? { olw: e.olw } : {}), ...(e.wd ? { wd: e.wd } : {}) };
const found = Object.values(out);
console.error(`произведение найдено у ${found.length} ISBN из ${isbns.length}: с элементом Wikidata ${found.filter((e) => e.wd).length}, только Open Library ${found.filter((e) => !e.wd).length}`);
// одна книга — одно произведение: разные ISBN одной карточки должны прийти к одному ключу
for (const b of books) {
  const keys = new Set((idsOf(b.work)?.isbn ?? []).map((i) => out[i]?.wd ?? out[i]?.olw).filter(Boolean));
  if (keys.size > 1) console.error(`  ${b.work.title}: издания ведут к разным произведениям (${[...keys].join(', ')}) — проверить`);
}
// и наоборот: две разные книги не должны сойтись в одно произведение — иначе справочник склеит их
// в одну (ключ общий). Такой мост не пишем, обе книги остаются со своими ISBN
const owner = new Map<string, string>();
for (const b of books) {
  const isbnList = idsOf(b.work)?.isbn ?? [];
  const hit = isbnList.map((i) => out[i]).find(Boolean);
  const key = hit?.wd ?? hit?.olw;
  if (!key) continue;
  const prev = owner.get(key);
  if (prev && prev !== b.work.title) {
    console.error(`  «${prev}» и «${b.work.title}» сходятся в одно произведение ${key} — мост снят, проверить руками`);
    for (const x of books.filter((y) => y.work.title === prev || y.work.title === b.work.title)) for (const i of idsOf(x.work)?.isbn ?? []) delete out[i];
  } else owner.set(key, b.work.title);
}
if (DRY) process.exit(0);
const rows = Object.entries(out).sort(([a], [b]) => a.localeCompare(b)).map(([i, e]) => `  ${JSON.stringify(i)}: ${JSON.stringify(e)},`);
writeFileSync(new URL('../src/mocks/bookWorks.ts', import.meta.url), `// Сгенерировано tools/resolve-book-works.mts (З1) — руками не править.
// ISBN (издание) → произведение: работа Open Library (olw) и элемент Wikidata (wd). По нему книга
// получает ключ \`wd:\`/\`olw:\` вместо \`isbn:\` (src/lib/keys.ts).

export const bookWorks: Record<string, { olw?: string; wd?: string }> = {
${rows.join('\n')}
};
`);
console.error('→ src/mocks/bookWorks.ts');
