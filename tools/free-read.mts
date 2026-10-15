// Читать бесплатно и легально (книжный трек, 11.10): где текст книги открыт законно — ссылкой на источник, мы ничего
// не храним. Как «Бесплатно: классика» у фильмов (tools/free-watch.mts), только источники книжные, из Wikidata —
// у самого произведения и у его изданий (P747):
//   • Викитека — статья проекта о произведении или издании (ru, en): туда кладут только свободные тексты;
//   • Project Gutenberg (P2034) — электронная книга;
//   • Internet Archive (P724) — только с пометкой «общественное достояние» (P6216 = Q19652) у самого утверждения.
// Русская Викитека требует свободы текста и по российскому праву, английская и Gutenberg — по американскому: поэтому
// приложение показывает русскую Викитеку русскоязычным, остальное — при английском интерфейсе (`l` у источника).
//   npx tsx tools/free-read.mts [--dry]
// Кэш ответов Wikidata — .cache/free-read/ (раз в 7 дней), итог — .cache/free-read.json, публикует publish-reference
// (`freeRead`).
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { worksIndex } from './works-index.mts';

const DRY = process.argv.includes('--dry');
const DIR = '.cache/free-read';
const OUT = '.cache/free-read.json';
const UA = 'recomend/0.1 (https://github.com/dmitry00-00/Recommend)';
const day = 86400e3;
mkdirSync(DIR, { recursive: true });

type Row = Record<string, { value: string }>;
async function sparql(query: string): Promise<Row[]> {
  for (let a = 0; a < 4; a++) {
    const r = await fetch('https://query.wikidata.org/sparql', {
      method: 'POST', body: new URLSearchParams({ query }),
      headers: { 'User-Agent': UA, Accept: 'application/sparql-results+json', 'Content-Type': 'application/x-www-form-urlencoded' },
    }).catch(() => undefined);
    if (r?.ok) { const j = await r.json().catch(() => undefined) as { results: { bindings: Row[] } } | undefined; if (j) return j.results.bindings; }
    await new Promise((z) => setTimeout(z, 3000 * (a + 1)));
  }
  throw new Error('wikidata: нет ответа');
}
/** Ответ Wikidata по пачке — из кэша, если свежий: пачка определяется своими элементами. */
async function cached(name: string, ids: string[], query: string): Promise<Row[]> {
  const file = `${DIR}/${name}-${ids[0]}-${ids.length}.json`;
  if (existsSync(file) && Date.now() - statSync(file).mtimeMs < 7 * day) {
    const c = JSON.parse(readFileSync(file, 'utf8')) as { ids: string[]; rows: Row[] };
    if (c.ids.join() === ids.join()) return c.rows;
  }
  const rows = await sparql(query);
  if (!DRY) writeFileSync(file, JSON.stringify({ ids, rows }));
  await new Promise((z) => setTimeout(z, 800));
  return rows;
}

const works = worksIndex({ all: true }).filter((w) => w.work.type === 'book' && w.key.startsWith('wd:')).map((w) => w.key.slice(3));
const qids = [...new Set(works)].sort();
// издание → произведение: источник издания показываем у произведения
const owner = new Map<string, string>(qids.map((q) => [q, q]));
for (let i = 0; i < qids.length; i += 100) {
  const part = qids.slice(i, i + 100);
  for (const r of await cached('editions', part, `SELECT ?w ?e WHERE { VALUES ?w { ${part.map((q) => `wd:${q}`).join(' ')} } ?w wdt:P747 ?e }`)) {
    const e = r.e.value.split('/').pop()!;
    if (!owner.has(e)) owner.set(e, r.w.value.split('/').pop()!);
  }
}
const all = [...owner.keys()].sort();
const rows: Row[] = [];
for (let i = 0; i < all.length; i += 150) {
  const part = all.slice(i, i + 150);
  rows.push(...await cached('sources', part, `SELECT ?e ?src ?val WHERE { VALUES ?e { ${part.map((q) => `wd:${q}`).join(' ')} }
    { ?a schema:about ?e ; schema:isPartOf ?site . FILTER(?site IN (<https://ru.wikisource.org/>, <https://en.wikisource.org/>)) BIND(STR(?site) AS ?src) BIND(STR(?a) AS ?val) }
    UNION { ?e wdt:P2034 ?g . BIND("gutenberg" AS ?src) BIND(?g AS ?val) }
    UNION { ?e p:P724 ?st . ?st ps:P724 ?ia . ?st pq:P6216 wd:Q19652 . BIND("archive" AS ?src) BIND(?ia AS ?val) } }`));
}

/** Источник у книги: n — название, u — ссылка, v — вид, l — язык интерфейса, которому его показывать. */
export type FreeRead = { n: string; u: string; v: 'wikisource' | 'gutenberg' | 'archive'; l: 'ru' | 'en' };
const out: Record<string, FreeRead[]> = {};
// сначала — у самого произведения, потом у изданий: статья о произведении в Викитеке — оглавление переводов
rows.sort((a, b) => Number(owner.get(a.e.value.split('/').pop()!) !== a.e.value.split('/').pop()) - Number(owner.get(b.e.value.split('/').pop()!) !== b.e.value.split('/').pop()));
for (const r of rows) {
  const e = r.e.value.split('/').pop()!;
  const src = r.src.value, val = r.val.value;
  const f: FreeRead = src === 'https://ru.wikisource.org/' ? { n: 'Викитека', u: val, v: 'wikisource', l: 'ru' }
    : src === 'https://en.wikisource.org/' ? { n: 'Wikisource', u: val, v: 'wikisource', l: 'en' }
    : src === 'gutenberg' ? { n: 'Project Gutenberg', u: `https://www.gutenberg.org/ebooks/${val}`, v: 'gutenberg', l: 'en' }
    : { n: 'Internet Archive', u: `https://archive.org/details/${val}`, v: 'archive', l: 'en' };
  const list = (out[`wd:${owner.get(e)}`] ??= []);
  // по одной ссылке каждого вида на язык: десять изданий в Gutenberg человеку не нужны
  if (!list.some((x) => x.v === f.v && x.l === f.l)) list.push(f);
}
const by = (v: string, l?: string) => Object.values(out).filter((xs) => xs.some((x) => x.v === v && (!l || x.l === l))).length;
console.log(`книг в справочнике: ${qids.length}, изданий: ${all.length - qids.length}; читать бесплатно — ${Object.keys(out).length}: `
  + `Викитека ${by('wikisource', 'ru')}, Wikisource ${by('wikisource', 'en')}, Gutenberg ${by('gutenberg')}, Internet Archive ${by('archive')}`);
if (!DRY) { writeFileSync(OUT, JSON.stringify({ at: new Date().toISOString(), works: out })); console.log(`→ ${OUT}`); }
