// Признание и устройство фильма из Wikidata → .cache/merit.json.
//   npx tsx tools/build-merit.mts [--fresh]
//
// Четыре вещи одним проходом, все CC0:
//   P166  награды      — мера «заслуживал», которой у нас не было вовсе. Структурный путь
//                        через форму провалился (замер 24.09: темп речи и тишина разбор не
//                        предсказывают), а фестивальное признание — прямое утверждение людей,
//                        которые кино смотрят профессионально;
//   P1411 номинации    — то же слабее: дошёл до отбора, но не взял;
//   P136  жанр         — у карточек расширения разметки нет никакой, `primaryOperations` пуст;
//   P495  страна       — без неё «мало зрителей на Trakt» не отличить от «нет русского кино
//                        на англоязычном сервисе» (замер 25.09);
//   плюс ruwiki        — имя статьи для тех фильмов, которым его никогда не искали: из-за них
//                        отбор `--both` в tools/overlooked.mts показывает меньшинство.
//
// Q-код берём из id карточки, где он есть (`f-wd<N>` — это расширение по Wikidata), иначе
// ищем по tmdb. Соответствие не меняется, поэтому лежит в .cache/wikidata-ids.json и на
// втором прогоне не запрашивается.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { worksIndex } from './works-index.mts';

const FRESH = process.argv.includes('--fresh');
const UA = 'transformative-media/0.1 (film analysis index; contact via repository README)';
const API = 'https://www.wikidata.org/w/api.php';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Повтор ловит и брошенное исключение, а не только код ответа: `fetch failed` — это обрыв
 *  связи, он не возвращает статус, и на прогоне 25.09 пролетал мимо сторожа, убивая всю пачку. */
async function retry<T>(what: string, run: () => Promise<Response>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      const r = await run();
      if (r.ok) return await r.json() as T;
      if (attempt >= 4 || (r.status !== 429 && r.status < 500)) throw new Error(`${r.status} ${what}`);
      await sleep(Math.max(Number(r.headers.get('retry-after') ?? 0) * 1000, 2000 * 2 ** attempt));
    } catch (e) {
      if (attempt >= 4) throw e;
      await sleep(2000 * 2 ** attempt);
    }
  }
}

const get = <T>(params: Record<string, string>): Promise<T> => {
  const qs = new URLSearchParams({ format: 'json', ...params });
  return retry<T>(params.action, () => fetch(`${API}?${qs}`, { headers: { 'User-Agent': UA, accept: 'application/json' } }));
};

/** Заявления тянем запросом, а не выгрузкой сущностей: `wbgetentities` отдаёт у фильма все
 *  claims разом — три мегабайта на двадцать пять штук, потому что там весь актёрский состав.
 *  Тот же набор через SPARQL — 46 КБ на полсотни (замер 26.09). */
async function sparql<T>(query: string): Promise<T> {
  return retry<T>('sparql', () => fetch('https://query.wikidata.org/sparql', {
    method: 'POST',
    headers: {
      'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded',
      accept: 'application/sparql-results+json',
    },
    body: new URLSearchParams({ query }),
  }));
}

const idsFile = new URL('../.cache/wikidata-ids.json', import.meta.url);
const outFile = new URL('../.cache/merit.json', import.meta.url);
const ids: Record<string, string | null> = !FRESH && existsSync(idsFile) ? JSON.parse(readFileSync(idsFile, 'utf8')) : {};

interface Merit {
  q: string; awards: string[]; nominations: string[]; genres: string[]; countries: string[];
  ruArticle?: string; year?: number; title: string;
}
const out: Record<string, Merit> = !FRESH && existsSync(outFile) ? JSON.parse(readFileSync(outFile, 'utf8')) : {};

const poolFile = new URL('../.cache/mentions.json', import.meta.url);
const pool = existsSync(poolFile) ? new Set(Object.keys(JSON.parse(readFileSync(poolFile, 'utf8')))) : null;
const works = worksIndex().filter((w) => !pool || pool.has(w.key));
console.error(`карточек в работе: ${works.length}`);

// ---------- 1. Q-коды ----------
let asked = 0;
for (const w of works) {
  if (ids[w.key] !== undefined) continue;
  const embedded = /^f-wd(\d+)$/.exec(w.work.id)?.[1];
  if (embedded) { ids[w.key] = `Q${embedded}`; continue; }
  const tmdb = w.work.externalIds?.tmdb;
  if (!tmdb) { ids[w.key] = null; continue; }
  try {
    const r = await get<{ query?: { search?: { title: string }[] } }>(
      { action: 'query', list: 'search', srsearch: `haswbstatement:P4947=${tmdb}`, srlimit: '1' });
    ids[w.key] = r.query?.search?.[0]?.title ?? null;
  } catch (e) {
    console.error(`  ${w.work.title}: ${(e as Error).message}`);
    continue;  // не помечаем: повторится на следующем прогоне
  }
  asked += 1;
  if (asked % 100 === 0) { console.error(`  поиск по tmdb: ${asked}`); writeFileSync(idsFile, JSON.stringify(ids)); }
  await sleep(120);
}
writeFileSync(idsFile, JSON.stringify(ids));
const known = works.filter((w) => ids[w.key]);
console.error(`Q-код известен у ${known.length} из ${works.length}`);

// ---------- 2. заявления ----------
type Cell = { value: string };
type Row = { item: Cell; awards?: Cell; noms?: Cell; genres?: Cell; countries?: Cell; ru?: Cell };
const qid = (url: string) => url.split('/').pop()!;
const list = (c?: Cell) => (c?.value ? c.value.split(',').map(qid) : []);

const todo = known.filter((w) => !out[w.key]);
console.error(`заявления: осталось ${todo.length}`);
const byQ = new Map(todo.map((w) => [ids[w.key]!, w]));
for (let i = 0; i < todo.length; i += 50) {
  const chunk = todo.slice(i, i + 50);
  const query = `SELECT ?item
  (GROUP_CONCAT(DISTINCT ?a; separator=",") AS ?awards)
  (GROUP_CONCAT(DISTINCT ?n; separator=",") AS ?noms)
  (GROUP_CONCAT(DISTINCT ?g; separator=",") AS ?genres)
  (GROUP_CONCAT(DISTINCT ?c; separator=",") AS ?countries)
  (SAMPLE(?ruA) AS ?ru)
WHERE {
  VALUES ?item { ${chunk.map((w) => `wd:${ids[w.key]}`).join(' ')} }
  OPTIONAL { ?item wdt:P166 ?a }
  OPTIONAL { ?item wdt:P1411 ?n }
  OPTIONAL { ?item wdt:P136 ?g }
  OPTIONAL { ?item wdt:P495 ?c }
  OPTIONAL { ?ruA schema:about ?item ; schema:isPartOf <https://ru.wikipedia.org/> }
} GROUP BY ?item`;
  try {
    const r = await sparql<{ results: { bindings: Row[] } }>(query);
    for (const b of r.results.bindings) {
      const w = byQ.get(qid(b.item.value));
      if (!w) continue;
      out[w.key] = {
        q: qid(b.item.value), title: w.work.title, year: w.work.year,
        awards: list(b.awards), nominations: list(b.noms),
        genres: list(b.genres), countries: list(b.countries),
        ruArticle: b.ru?.value ? decodeURIComponent(qid(b.ru.value)).replace(/_/g, ' ') : undefined,
      };
    }
  } catch (e) {
    console.error(`  пачка ${i}: ${(e as Error).message}`);
  }
  if (i % 250 === 0) { console.error(`  ${i}/${todo.length}`); writeFileSync(outFile, JSON.stringify(out)); }
  await sleep(400);
}
writeFileSync(outFile, JSON.stringify(out));

// ---------- 3. названия наград и жанров ----------
const labelsFile = new URL('../.cache/wikidata-labels.json', import.meta.url);
const labels: Record<string, string> = existsSync(labelsFile) ? JSON.parse(readFileSync(labelsFile, 'utf8')) : {};
const need = [...new Set(Object.values(out).flatMap((m) => [...m.awards, ...m.nominations, ...m.genres, ...m.countries]))]
  .filter((q) => !labels[q]);
console.error(`названий разобрать: ${need.length}`);
for (let i = 0; i < need.length; i += 50) {
  try {
    const r = await get<{ entities?: Record<string, { labels?: Record<string, { value: string }> }> }>(
      { action: 'wbgetentities', ids: need.slice(i, i + 50).join('|'), props: 'labels', languages: 'ru|en' });
    for (const [q, e] of Object.entries(r.entities ?? {})) {
      const l = e.labels?.ru?.value ?? e.labels?.en?.value;
      if (l) labels[q] = l;
    }
  } catch (e) { console.error(`  названия ${i}: ${(e as Error).message}`); }
  await sleep(200);
}
writeFileSync(labelsFile, JSON.stringify(labels));

const all = Object.values(out);
const withAwards = all.filter((m) => m.awards.length);
console.error(`\n→ .cache/merit.json: ${all.length} фильмов`);
console.error(`   с наградами: ${withAwards.length}, с номинациями: ${all.filter((m) => m.nominations.length).length}`);
console.error(`   с жанром: ${all.filter((m) => m.genres.length).length}, со страной: ${all.filter((m) => m.countries.length).length}`);
console.error(`   ru-статья: ${all.filter((m) => m.ruArticle).length}`);
const top = [...all].sort((a, b) => b.awards.length - a.awards.length).slice(0, 5);
for (const m of top) console.error(`   ${m.title} (${m.year ?? '—'}): наград ${m.awards.length} — ${m.awards.slice(0, 3).map((q) => labels[q] ?? q).join(', ')}`);
