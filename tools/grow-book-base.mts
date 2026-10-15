// Книги, которые ищут (книжный трек, 11.10): как tools/grow-film-base.mts для кино — чтобы человек, набрав в
// поиске три любимые книги, находил их. Справочник книг до сих пор рос только через мост с кино (экранизации,
// упоминания у эссеистов и книжных каналов) — школьная программа и громкие новинки в нём есть не всегда.
//
//   npx tsx tools/grow-book-base.mts [--min-links 60] [--fresh]
//
// Два сигнала, оба открытые и без ключа:
//   • спрос — месячные топ-1000 русской Википедии (.cache/wiki-top/ГГГГ-ММ.json, их скачивает grow-film-base):
//     статья о книге в топе месяца — то, что в тот месяц читали массово (школа, экранизация, новость);
//   • канон — книги с русской статьёй и статьями в --min-links разделах Википедии и больше (P31 — литературное
//     произведение, роман, повесть, рассказ, пьеса, поэма, сборник).
// Книга опознаётся в Wikidata (CC0, решение владельца 23.09: новое — только оттуда). Итог — .cache/book-popular.json:
// { at, books: [{ qid, title, author, year, views, months, links, had }] } по убыванию спроса; недостающие заводит
// tools/build-book-base.mts (источник 6). Кэш опознания — .cache/book-popular.wd.json.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { worksIndex } from './works-index.mts';
import { withheldWorks } from '../src/mocks/withheldWorks.ts';

const argv = process.argv.slice(2);
const opt = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const MIN_LINKS = Number(opt('--min-links') ?? 60);
const FRESH = argv.includes('--fresh');
const UA = 'recomend/0.1 (https://github.com/dmitry00-00/Recommend)';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Классы письменного произведения (P31): литературное произведение, роман, повесть, рассказ, пьеса, поэма,
 *  стихотворение, сборник рассказов, цикл, книга. Голое «письменное произведение» не берём — так помечены и статьи,
 *  и законы. */
const BOOK = ['Q7725634', 'Q8261', 'Q149537', 'Q49084', 'Q25379', 'Q5185279', 'Q1279564', 'Q12106333', 'Q1371849', 'Q277759', 'Q571', 'Q17518870'];
type Row = Record<string, { value: string } | undefined>;
async function sparql(query: string): Promise<Row[] | undefined> {
  for (let a = 0; a < 4; a++) {
    const r = await fetch('https://query.wikidata.org/sparql', {
      method: 'POST', body: new URLSearchParams({ query }),
      headers: { 'User-Agent': UA, Accept: 'application/sparql-results+json', 'Content-Type': 'application/x-www-form-urlencoded' },
    }).catch(() => undefined);
    if (r?.ok) { const j = await r.json().catch(() => undefined) as { results: { bindings: Row[] } } | undefined; if (j) return j.results.bindings; }
    await sleep(3000 * (a + 1));
  }
  return undefined;
}
const lit = (t: string) => `"${t.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"@ru`;
const qidOf = (u?: { value: string }) => u?.value.split('/').pop();

// ─── спрос: месячные топы русской Википедии ─────────────────────────────────
const views = new Map<string, { views: number; months: number }>();
for (const f of readdirSync('.cache/wiki-top').filter((f) => /^\d{4}-\d{2}\.json$/.test(f))) {
  for (const { article, views: v } of JSON.parse(readFileSync(`.cache/wiki-top/${f}`, 'utf8')) as { article: string; views: number }[]) {
    if (/^[^:_]+:[^_]/.test(article)) continue;   // служебные: «Служебная:Поиск», «Файл:…»
    const t = article.replace(/_/g, ' ');
    const p = views.get(t) ?? { views: 0, months: 0 };
    p.views += v; p.months += 1; views.set(t, p);
  }
}
// фильмы и сериалы из тех же топов grow-film-base уже опознал — книгами они не будут
const films = existsSync('.cache/grow-film-base.wd.json') ? JSON.parse(readFileSync('.cache/grow-film-base.wd.json', 'utf8')) as Record<string, { none?: true }> : {};
type Found = { qid: string; title: string; author?: string; year?: number; links: number };
const CACHE = '.cache/book-popular.wd.json';
const cache: Record<string, Found | { none: true }> = !FRESH && existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : {};
const todo = [...views.keys()].filter((t) => !cache[t] && !(films[t] && !films[t].none));
console.error(`статей в топах: ${views.size}, к опознанию: ${todo.length}`);
const FIELDS = `OPTIONAL { ?f rdfs:label ?ru FILTER(lang(?ru) = 'ru') } OPTIONAL { ?f wdt:P50 ?au . ?au rdfs:label ?aun FILTER(lang(?aun) = 'ru') }
    OPTIONAL { ?f wdt:P577 ?date } ?f wikibase:sitelinks ?links`;
const read = (b: Row, prev?: Found): Found => {
  const year = Number(b.date?.value.slice(0, 4)) || undefined;
  return {
    qid: qidOf(b.f)!, title: prev?.title ?? b.ru?.value ?? b.t?.value ?? '', links: Number(b.links?.value ?? 0),
    author: prev?.author ?? b.aun?.value, year: prev?.year && year ? Math.min(prev.year, year) : prev?.year ?? year,
  };
};
for (let i = 0; i < todo.length; i += 200) {
  const batch = todo.slice(i, i + 200);
  const rows = await sparql(`SELECT ?t ?f ?ru ?aun ?date ?links WHERE {
    VALUES ?t { ${batch.map(lit).join(' ')} }
    ?a schema:name ?t; schema:isPartOf <https://ru.wikipedia.org/>; schema:about ?f.
    VALUES ?c { ${BOOK.map((q) => `wd:${q}`).join(' ')} } ?f wdt:P31 ?c. ${FIELDS} }`);
  if (!rows) { console.error(`  пачка ${i / 200} не получена`); continue; }
  const got = new Map<string, Found>();
  for (const b of rows) { const t = b.t!.value; got.set(t, read(b, got.get(t))); }
  for (const t of batch) cache[t] = got.get(t) ?? { none: true };
  writeFileSync(CACHE, JSON.stringify(cache));
  await sleep(1000);
}

// ─── канон: книги с русской статьёй и статьями во многих разделах ─────────────
const canon = new Map<string, Found>();
for (const c of BOOK) {
  const rows = await sparql(`SELECT ?f ?ru ?aun ?date ?links WHERE {
    ?f wdt:P31 wd:${c}; wikibase:sitelinks ?links. FILTER(?links >= ${MIN_LINKS})
    ?a schema:about ?f; schema:isPartOf <https://ru.wikipedia.org/>. ${FIELDS} }`);
  if (!rows) { console.error(`  канон ${c} не получен`); continue; }
  for (const b of rows) { const q = qidOf(b.f)!; canon.set(q, read(b, canon.get(q))); }
  await sleep(1000);
}

// ─── итог: что из этого у нас есть ──────────────────────────────────────────
const have = new Set(worksIndex({ all: true }).filter((w) => w.work.type === 'book').map((w) => w.key));
const books = new Map<string, Found & { views: number; months: number; had: boolean }>();
for (const [t, c] of Object.entries(cache)) {
  if ('none' in c) continue;
  const v = views.get(t);
  if (!v) continue;
  const prev = books.get(c.qid);
  books.set(c.qid, { ...c, views: (prev?.views ?? 0) + v.views, months: Math.max(prev?.months ?? 0, v.months), had: have.has(`wd:${c.qid}`) });
}
for (const [q, c] of canon) if (!books.has(q)) books.set(q, { ...c, views: 0, months: 0, had: have.has(`wd:${q}`) });
// не литература для подбора: священные тексты и книги Библии, списки, пророчества и предсказания (эзотерика —
// отдельной категорией, решение владельца 11.10), манифесты и законы — по английским меткам классов (P31)
const NOT_FICTION = /relig|sacred|scripture|bible|gospel|epistle|biblical|torah|quran|sutra|veda|\blist\b|prophec|predict|manifesto|law|constitution|treaty|encyclop|dictionary|grimoire|occult|talmud|mishnah|record|almanac|reference work|yearbook/i;
// у части священных текстов класс голый «literary work» — по элементу: Талмуд
const NOT_FICTION_IDS = new Set(['Q43290']);
const classes = new Map<string, string[]>();
const ids = [...books.keys()];
for (let i = 0; i < ids.length; i += 200) {
  const rows = await sparql(`SELECT ?f ?l WHERE { VALUES ?f { ${ids.slice(i, i + 200).map((q) => `wd:${q}`).join(' ')} }
    { ?f wdt:P31 ?c } UNION { ?f wdt:P136 ?c } ?c rdfs:label ?l FILTER(lang(?l) = 'en') }`) ?? [];
  for (const b of rows) { const q = qidOf(b.f)!; classes.set(q, [...(classes.get(q) ?? []), b.l!.value]); }
  await sleep(800);
}
const skipped = [...books.values()].filter((b) => (classes.get(b.qid) ?? []).some((l) => NOT_FICTION.test(l)) || /^Список /.test(b.title) || NOT_FICTION_IDS.has(b.qid) || `wd:${b.qid}` in withheldWorks);
for (const b of skipped) books.delete(b.qid);
console.error(`не литература (священные тексты, списки, пророчества, манифесты): ${skipped.length} — ${skipped.slice(0, 12).map((b) => b.title).join(', ')}…`);
const list = [...books.values()].filter((b) => b.title && !/^Q\d+$/.test(b.title))
  .sort((a, b) => b.views - a.views || b.links - a.links);
const top = list.filter((b) => b.views > 0), cn = list.filter((b) => b.views === 0);
console.log(`книги в топах русской Википедии: ${top.length}, у нас ${top.filter((b) => b.had).length}; канон (от ${MIN_LINKS} разделов): ${cn.length}, у нас ${cn.filter((b) => b.had).length}`);
console.log('нет у нас, по спросу:'); for (const b of top.filter((b) => !b.had).slice(0, 25)) console.log(`  ${b.title} — ${b.author ?? '?'} (${b.year ?? '?'}): ${Math.round(b.views / 1000)} тыс., ${b.months} мес.`);
console.log('нет у нас, канон:'); for (const b of cn.filter((b) => !b.had).slice(0, 15)) console.log(`  ${b.title} — ${b.author ?? '?'} (${b.year ?? '?'}): ${b.links} разделов`);
writeFileSync('.cache/book-popular.json', JSON.stringify({ at: new Date().toISOString(), books: list }));
console.log('→ .cache/book-popular.json');
