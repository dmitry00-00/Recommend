// Заранее заложенные вселенные (Ж3): популярные франшизы и циклы из tools/universe-seeds.mts.
//   npx tsx tools/seed-universes.mts [--fresh] [--no-ping]
// 1. Элемент Wikidata франшизы — поиском по английской метке (wbsearchentities), с проверкой
//    класса: франшиза, вымышленная вселенная, киносерия, книжная серия, цикл. Итог — в
//    .cache/universe-seeds.json; не нашлось — строка отчёта, чтобы поправить метку в списке.
// 2. Состав — SPARQL: всё, у чего медиафраншиза (P8345), серия (P179) или вымышленная вселенная
//    (P1434) — эта; с метками, годом, классом, IMDb (P345) и TMDb (P4947) — по ним находим наши
//    карточки. Итог — .cache/universe-members.json; его подхватывает tools/resolve-relations.mts
//    (рёбра «часть» к франшизе) — так вселенная полна, даже если у нас в справочнике две её части.
// 3. Вики и API пингуются (--no-ping — не проверять); доступное — в src/mocks/universeSources.ts,
//    страница вселенной показывает его строкой «Энциклопедии и данные».
// 4. Фильмы и сериалы вселенных, которых у нас нет, — в .cache/universe-missing.tsv: кандидаты
//    в справочник (добавлять — через полки и tools/add-shelf-films.mts, руками решает владелец).
import { writeFileSync } from 'node:fs';
import { worksIndex } from './works-index.mts';
import { universeSeeds } from './universe-seeds.mts';
import { readCache, sleep, sparql, wd, writeCache } from './wikidata-lib.mts';

const args = process.argv.slice(2);
const FRESH = args.includes('--fresh'), PING = !args.includes('--no-ping');

const HUB_CLASSES = new Set(['Q196600', 'Q559618', 'Q24856', 'Q277759', 'Q1667921', 'Q7058673']);
const qids: Record<string, string | null> = FRESH ? {} : readCache('universe-seeds.json', {});
// по какой метке искали (02.10): найденное не спрашиваем, ненайденное — только если метку поправили
const askedAs: Record<string, string> = FRESH ? {} : readCache('universe-seeds-asked.json', {});
for (const seed of universeSeeds) {
  if (qids[seed.id] || (qids[seed.id] === null && askedAs[seed.id] === seed.en)) continue;
  askedAs[seed.id] = seed.en;
  try {
    const found = await wd<{ search?: { id: string }[] }>({ action: 'wbsearchentities', search: seed.en, language: 'en', type: 'item', limit: '10' });
    const ids = (found.search ?? []).map((x) => x.id);
    const ents = ids.length ? await wd<{ entities?: Record<string, { claims?: { P31?: { mainsnak: { datavalue?: { value: { id: string } } } }[] } }> }>(
      { action: 'wbgetentities', ids: ids.join('|'), props: 'claims' }) : {};
    // первый по выдаче из тех, чей класс — франшиза, вселенная или цикл
    qids[seed.id] = ids.find((id) => (ents.entities?.[id]?.claims?.P31 ?? []).some((c) => HUB_CLASSES.has(c.mainsnak.datavalue?.value.id ?? ''))) ?? null;
  } catch (e) {
    console.error(`  ${seed.ru}: ${(e as Error).message}`);
    continue;
  }
  await sleep(200);
}
writeCache('universe-seeds.json', qids);
writeCache('universe-seeds-asked.json', askedAs);
const lost = universeSeeds.filter((s) => !qids[s.id]);
console.error(`вселенных: ${universeSeeds.length}, найдено в Wikidata: ${universeSeeds.length - lost.length}`);
if (lost.length) console.error(`  не нашлось (поправить метку en в tools/universe-seeds.mts): ${lost.map((s) => `${s.ru} («${s.en}»)`).join(', ')}`);

// ---------- состав ----------
type Member = { q: string; t: string; y?: number; cls: string[]; imdb?: string; tmdb?: number };
const members: Record<string, Member[]> = FRESH ? {} : readCache('universe-members.json', {});
for (const seed of universeSeeds) {
  const hub = qids[seed.id];
  if (!hub || members[hub]) continue;
  const query = `SELECT ?m ?ru ?en ?year ?cls ?imdb ?tmdb WHERE {
  { ?m wdt:P8345 wd:${hub} } UNION { ?m wdt:P179 wd:${hub} } UNION { ?m wdt:P1434 wd:${hub} }
  OPTIONAL { ?m rdfs:label ?ru FILTER(LANG(?ru) = "ru") }
  OPTIONAL { ?m rdfs:label ?en FILTER(LANG(?en) = "en") }
  OPTIONAL { ?m wdt:P577 ?year }
  OPTIONAL { ?m wdt:P31 ?cls }
  OPTIONAL { ?m wdt:P345 ?imdb }
  OPTIONAL { ?m wdt:P4947 ?tmdb }
} LIMIT 3000`;
  try {
    type Cell = { value: string };
    const r = await sparql<{ results: { bindings: Record<string, Cell | undefined>[] } }>(query);
    const byQ = new Map<string, Member>();
    for (const b of r.results.bindings) {
      const q = b.m!.value.split('/').pop()!;
      const m = byQ.get(q) ?? { q, t: '', cls: [] };
      m.t ||= b.ru?.value ?? b.en?.value ?? '';
      const y = b.year ? Number(b.year.value.slice(0, 4)) : undefined;
      if (y && (!m.y || y < m.y)) m.y = y;
      const c = b.cls?.value.split('/').pop();
      if (c && !m.cls.includes(c)) m.cls.push(c);
      if (b.imdb) m.imdb ??= b.imdb.value;
      if (b.tmdb) m.tmdb ??= Number(b.tmdb.value);
      byQ.set(q, m);
    }
    members[hub] = [...byQ.values()].filter((m) => m.t && !/^Q\d+$/.test(m.t));
    console.error(`  ${seed.ru}: ${members[hub].length}`);
  } catch (e) {
    console.error(`  ${seed.ru}: ${(e as Error).message}`);
  }
  await sleep(500);
}
writeCache('universe-members.json', members);

// ---------- вики и API ----------
// ответ сайта помним неделю (02.10): мёртвый адрес иначе стоит по десять секунд таймаута каждый прогон
const REACH_DAYS = 7;
const reachCache: Record<string, { ok: boolean; at: string }> = FRESH ? {} : readCache('universe-reach.json', {});
const reach = async (url: string): Promise<boolean> => {
  if (!PING) return true;
  const c = reachCache[url];
  if (c && Date.now() - Date.parse(c.at) < REACH_DAYS * 864e5) return c.ok;
  let ok = false;
  try {
    const r = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(10000), headers: { 'User-Agent': 'transformative-media/0.1' } });
    ok = r.status < 500 && r.status !== 404;
  } catch { ok = false; }
  reachCache[url] = { ok, at: new Date().toISOString() };
  return ok;
};
const sources: Record<string, { id: string; ru: string; wiki: string[]; api: { url: string; what: string; key?: boolean }[] }> = {};
const dead: string[] = [];
for (const seed of universeSeeds) {
  const hub = qids[seed.id];
  if (!hub) continue;
  const wiki: string[] = [];
  for (const w of seed.wiki ?? []) (await reach(`${w}/api.php?action=query&meta=siteinfo&format=json`) ? wiki.push(w) : dead.push(w));
  const api: { url: string; what: string; key?: boolean }[] = [];
  for (const a of seed.api ?? []) (await reach(a.url) ? api.push(a) : dead.push(a.url));
  sources[hub] = { id: seed.id, ru: seed.ru, wiki, api };
}
writeCache('universe-reach.json', reachCache);
if (dead.length) console.error(`не отвечают (проверить адрес): ${dead.join(', ')}`);
writeFileSync(new URL('../src/mocks/universeSources.ts', import.meta.url), `// Сгенерировано tools/seed-universes.mts (Ж3) — руками не править; список — tools/universe-seeds.mts.
// Элемент Wikidata франшизы → вики фандома и открытые API, которые ответили при прогоне.

export const universeSources: Record<string, { id: string; ru: string; wiki: string[]; api: { url: string; what: string; key?: boolean }[] }> = ${JSON.stringify(sources, null, 2)};
`);

// ---------- чего у нас нет ----------
const keys = new Set(worksIndex({ all: true }).map((w) => w.key));
const FILMISH = new Set(['Q11424', 'Q202866', 'Q24862', 'Q506240', 'Q20650540', 'Q29168811', 'Q5398426', 'Q1259759', 'Q63952888', 'Q581714', 'Q117467246']);
const rows: string[] = ['вселенная\tназвание\tгод\ttmdb\timdb'];
for (const seed of universeSeeds) {
  const hub = qids[seed.id];
  for (const m of hub ? members[hub] ?? [] : []) {
    if (!m.cls.some((c) => FILMISH.has(c))) continue;
    if ((m.tmdb != null && keys.has(`tmdb:${m.tmdb}`)) || (m.imdb && keys.has(`imdb:${m.imdb}`))) continue;
    rows.push([seed.ru, m.t, m.y ?? '', m.tmdb ?? '', m.imdb ?? ''].join('\t'));
  }
}
writeFileSync(new URL('../.cache/universe-missing.tsv', import.meta.url), rows.join('\n') + '\n');
console.error(`составов: ${Object.keys(members).length}; фильмов и сериалов вселенных, которых у нас нет: ${rows.length - 1} → .cache/universe-missing.tsv`);
console.error('→ src/mocks/universeSources.ts; дальше — tools/resolve-relations.mts');
