// Резолв авторов (Д2): кто режиссёр, сценарист, создатель сериала, автор книги — с элементом
// Wikidata — для всего, что мы знаем (worksIndex). Пишет src/mocks/people.ts и
// src/mocks/workCredits.ts; приложение подкладывает авторов карточкам при загрузке каталога.
//   npx tsx tools/resolve-credits.mts [--fresh] [--retry-missing] [--limit N] [--dry] [--no-tmdb]
//
// 1. Элемент Wikidata произведения: из id карточки (`f-wd<N>`), из externalIds.wikidata, из
//    общего кэша .cache/wikidata-ids.json (его ведёт build-merit), иначе поиском
//    `haswbstatement`: фильм — P4947 (TMDb), сериал — P345 (IMDb), книга — P212/P957 (ISBN;
//    издание приводится к произведению через P629 уже в запросе). Найденное и ненайденное —
//    в .cache/credits-ids.json, второй прогон не спрашивает (--retry-missing — спросить снова).
// 2. Авторы одним SPARQL на пачку в 50: P57 режиссёр, P58 сценарист, P170 создатель (только у
//    сериала), P50 автор (только у книги); только люди (P31 = Q5), метки ru и en.
// 3. Сериалу без P170 — `created_by` TMDb (нужен TMDB_API_KEY): номер человека TMDb → элемент
//    Wikidata по P4985. Без элемента человека не заводим: ключ справочника — только Q-код.
// Кэш авторов — .cache/credits.json; --fresh пересобирает его заново.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { loadEnvFile } from './env-file.mts';
import { worksIndex } from './works-index.mts';
import { isSeries } from '../src/lib/media.ts';
import type { Person, PersonId, WorkCard } from '../src/types/tmdf.ts';
import { cacheUrl, readCache, resolveWorkQids, search, sleep, sparql, wd } from './wikidata-lib.mts';
import { parseBindings, peopleSource, propsFor, toPerson, workCreditsSource, type Binding, type CreditsEntry, type Kind } from './credits-lib.mts';

loadEnvFile();
const args = process.argv.slice(2);
const has = (f: string) => args.includes(f);
const FRESH = has('--fresh'), DRY = has('--dry'), RETRY = has('--retry-missing'), NO_TMDB = has('--no-tmdb');
const LIMIT = Number(args[args.indexOf('--limit') + 1]) || Infinity;
const cache = cacheUrl;
const readJson = readCache;
const entries: Record<string, CreditsEntry> = FRESH ? {} : readJson('credits.json', {});
const names: Record<PersonId, { ru?: string; en?: string }> = FRESH ? {} : readJson('people.json', {});
const save = () => {
  writeFileSync(cache('credits.json'), JSON.stringify(entries));
  writeFileSync(cache('people.json'), JSON.stringify(names));
};

const kindOfWork = (w: Pick<WorkCard, 'type' | 'format'>): Kind => (w.type === 'book' ? 'book' : isSeries(w) ? 'series' : 'film');
const works = worksIndex({ all: true }).slice(0, LIMIT);
console.error(`произведений: ${works.length}`);

// ---------- 1. элементы Wikidata ----------
const ids = await resolveWorkQids(works, { retryMissing: RETRY });
const withQ = works.filter((w) => ids[w.key]);

// ---------- 2. авторы ----------
const todo = withQ.filter((w) => !entries[w.key] || entries[w.key].q !== ids[w.key]);
console.error(`авторов искать: ${todo.length}`);
for (let i = 0; i < todo.length; i += 50) {
  const chunk = todo.slice(i, i + 50);
  const kinds = new Map(chunk.map((w) => [ids[w.key]!, kindOfWork(w.work)]));
  // книга-издание → произведение (P629): авторство записано у произведения
  const query = `SELECT ?item ?prop ?person ?ru ?en WHERE {
  VALUES ?item { ${[...kinds.keys()].map((q) => `wd:${q}`).join(' ')} }
  OPTIONAL { ?item wdt:P629 ?edOf }
  BIND(COALESCE(?edOf, ?item) AS ?src)
  VALUES (?prop ?claim) { (wd:P57 wdt:P57) (wd:P58 wdt:P58) (wd:P170 wdt:P170) (wd:P50 wdt:P50) }
  ?src ?claim ?person .
  ?person wdt:P31 wd:Q5 .
  OPTIONAL { ?person rdfs:label ?ru FILTER(LANG(?ru) = "ru") }
  OPTIONAL { ?person rdfs:label ?en FILTER(LANG(?en) = "en") }
}`;
  try {
    type Cell = { value: string };
    const r = await sparql<{ results: { bindings: Record<string, Cell | undefined>[] } }>(query);
    const rows: Binding[] = r.results.bindings.map((b) => ({
      item: b.item!.value, prop: b.prop!.value, person: b.person!.value, ru: b.ru?.value, en: b.en?.value,
    }));
    const parsed = parseBindings(rows, (q) => kinds.get(q));
    for (const w of chunk) {
      const q = ids[w.key]!;
      entries[w.key] = { q, credits: parsed.byItem.get(q) ?? [] };
    }
    for (const [p, n] of parsed.names) names[p] = { ru: names[p]?.ru ?? n.ru, en: names[p]?.en ?? n.en };
  } catch (e) {
    console.error(`  пачка ${i}: ${(e as Error).message}`);
  }
  if (i % 500 === 0) { console.error(`  ${i}/${todo.length}`); save(); }
  await sleep(400);
}
save();

// ---------- 3. создатели сериалов из TMDb ----------
const key = process.env.TMDB_API_KEY ?? process.env.VITE_TMDB_API_KEY;
const noCreator = works.filter((w) => kindOfWork(w.work) === 'series' && entries[w.key]
  && !entries[w.key].tmdb && !entries[w.key].credits.some(([, r]) => r === 'creator'));
if (NO_TMDB || !key) {
  if (noCreator.length) console.error(`сериалов без создателя: ${noCreator.length} — TMDb ${NO_TMDB ? 'выключен' : 'без ключа'}, пропускаю`);
} else {
  const tmdb = async <T,>(path: string, extra: Record<string, string> = {}): Promise<T> => {
    const bearer = key.includes('.');
    const qs = new URLSearchParams({ language: 'ru-RU', ...extra, ...(bearer ? {} : { api_key: key }) });
    const r = await fetch(`https://api.themoviedb.org/3/${path}?${qs}`, bearer ? { headers: { Authorization: `Bearer ${key}` } } : undefined);
    if (!r.ok) throw new Error(`tmdb ${path} ${r.status}`);
    return await r.json() as T;
  };
  const personQ = readJson<Record<string, string | null>>('tmdb-people.json', {});
  let added = 0;
  for (const w of noCreator) {
    try {
      const imdb = w.key.slice('imdb:'.length);
      const found = await tmdb<{ tv_results?: { id: number }[] }>(`find/${imdb}`, { external_source: 'imdb_id' });
      const tv = found.tv_results?.[0]?.id;
      const show = tv != null ? await tmdb<{ created_by?: { id: number; name: string }[] }>(`tv/${tv}`) : undefined;
      for (const c of show?.created_by ?? []) {
        if (personQ[c.id] === undefined) { personQ[c.id] = await search(`P4985=${c.id}`); await sleep(120); }
        const q = personQ[c.id];
        if (!q) continue;
        if (!entries[w.key].credits.some(([p, r]) => p === q && r === 'creator')) { entries[w.key].credits.unshift([q, 'creator']); added++; }
        names[q] ??= {};
        names[q].ru ??= c.name; // TMDb с language=ru-RU отдаёт имя по-русски, если оно у них есть
      }
      entries[w.key].tmdb = true;
    } catch (e) {
      console.error(`  ${w.work.title}: ${(e as Error).message}`);
    }
    await sleep(60);
  }
  writeFileSync(cache('tmdb-people.json'), JSON.stringify(personQ));
  save();
  console.error(`создатели из TMDb: +${added} у ${noCreator.length} сериалов без P170`);
}

// недостающие метки людей (TMDb дал Q-код без метки en, или метки не пришли в SPARQL)
const unnamed = Object.keys(names).filter((p) => !names[p].en);
for (let i = 0; i < unnamed.length; i += 50) {
  try {
    const r = await wd<{ entities?: Record<string, { labels?: Record<string, { value: string }> }> }>(
      { action: 'wbgetentities', ids: unnamed.slice(i, i + 50).join('|'), props: 'labels', languages: 'ru|en' });
    for (const [p, e] of Object.entries(r.entities ?? {})) names[p] = { ru: e.labels?.ru?.value ?? names[p].ru, en: e.labels?.en?.value };
  } catch (e) { console.error(`  метки ${i}: ${(e as Error).message}`); }
  await sleep(200);
}
save();

// ---------- 4. моки ----------
const inIndex = new Set(works.map((w) => w.key));
const used = Object.fromEntries(Object.entries(entries).filter(([k]) => inIndex.has(k)));
const people: Record<PersonId, Person> = {};
for (const e of Object.values(used)) for (const [p] of e.credits) {
  const person = names[p] && toPerson(p, names[p]);
  if (person) people[p] = person;
}
const all = Object.values(used);
const byRole = (r: string) => all.filter((e) => e.credits.some(([, x]) => x === r)).length;
console.error(`\nс авторами: ${all.filter((e) => e.credits.length).length} из ${all.length} найденных в Wikidata`);
console.error(`  режиссёр ${byRole('director')}, сценарист ${byRole('writer')}, создатель ${byRole('creator')}, автор книги ${byRole('author')}`);
console.error(`людей в справочнике: ${Object.keys(people).length}`);
if (DRY) process.exit(0);
writeFileSync(new URL('../src/mocks/people.ts', import.meta.url), peopleSource(people));
writeFileSync(new URL('../src/mocks/workCredits.ts', import.meta.url), workCreditsSource(used, people));
console.error('→ src/mocks/people.ts, src/mocks/workCredits.ts');
