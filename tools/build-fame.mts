// Известность произведения → src/mocks/fame.ts (17.10, «засветка топами», решение владельца).
//
// Зачем. Самые громкие фильмы, сериалы и книги — как уличный свет города: из-за них ночное небо выглядит пустым, видны
// только самые яркие звёзды. Подбор их приглушает (src/lib/model/fame.ts), чтобы стало видно остальное. Для этого нужна
// мера «насколько вещь на слуху» на весь справочник, а не на две с половиной тысячи фильмов, как .cache/attention.json.
//
// Две меры, обе открытые (CC0), без ключей:
//   разделы Википедии — на скольких языках есть статья (Wikidata `wikibase:sitelinks`): известность в мире, надолго;
//   месячные топы русской Википедии (.cache/wiki-top/<месяц>.json, топ-1000 статей) — сколько месяцев вещь была в
//   топе: громкость здесь и сейчас.
// Уровень 1–3 — по порогам ниже; 0 (тихие) в файл не идут.
//
//   npx tsx tools/build-fame.mts [--fresh]
// Кеш ответов Wikidata — .cache/fame-wd.json: второй прогон спрашивает только новые карточки.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'vite';

const ROOT = new URL('..', import.meta.url).pathname;
const CACHE = new URL('../.cache/fame-wd.json', import.meta.url);
const OUT = new URL('../src/mocks/fame.ts', import.meta.url);
const TOPS = new URL('../.cache/wiki-top/', import.meta.url);
const FRESH = process.argv.includes('--fresh');
const UA = 'transformative-media/0.1 (film analysis index; contact via repository README)';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Пороги уровней. Подобраны по распределению справочника 17.10: третий — около 2 %, второй — ещё ~6 %, первый — ~12 %. */
export const LEVELS = [
  { level: 3, links: 70, months: 6 },
  { level: 2, links: 45, months: 2 },
  { level: 1, links: 30, months: 1 },
] as const;

interface Card { id: string; title: string; externalIds?: { wikidata?: string; imdb?: string; tmdb?: number } }
interface Wd { links: number; ru?: string }

// 1. все карточки справочника — теми же модулями, что грузит приложение
const vite = await createServer({ root: ROOT, server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' });
const FILES = ['filmBase', 'filmBaseWiki', 'filmBasePopular', 'filmBaseWorld', 'filmBaseLinks', 'filmBaseTail', 'filmBaseMore', 'filmBaseCurated', 'filmBaseChannels', 'seriesBase', 'seriesBaseWiki', 'bookBase'];
const cards: Card[] = [];
for (const f of FILES) {
  const m = await vite.ssrLoadModule(`/src/mocks/${f}.ts`);
  const arr = Object.values(m).find(Array.isArray) as Card[] | undefined;
  if (arr) cards.push(...arr);
}
await vite.close();
const qidOf = (c: Card): string | undefined => c.externalIds?.wikidata ?? (/-wd(\d+)$/.exec(c.id)?.[1] ? `Q${/-wd(\d+)$/.exec(c.id)![1]}` : undefined);
const byQid = new Map<string, string[]>();
const byImdb = new Map<string, string[]>();
// только номер TMDb (основной справочник filmBase): «f-tmdb775» — фильм, «l-tmdbtv1433» — сериал
const byTmdb = new Map<string, string[]>();
const push = (m: Map<string, string[]>, k: string, id: string) => m.set(k, [...(m.get(k) ?? []), id]);
for (const c of cards) {
  const q = qidOf(c);
  if (q) push(byQid, q, c.id);
  else if (c.externalIds?.imdb) push(byImdb, c.externalIds.imdb, c.id);
  else {
    const t = c.externalIds?.tmdb ?? Number(/-tmdb(\d+)$/.exec(c.id)?.[1]);
    const tv = /-tmdbtv(\d+)$/.exec(c.id)?.[1];
    if (tv) push(byTmdb, `tv:${tv}`, c.id);
    else if (t) push(byTmdb, `film:${t}`, c.id);
  }
}
console.log(`карточек ${cards.length}: по Wikidata ${byQid.size}, по IMDb ${byImdb.size}, по TMDb ${byTmdb.size}`);

// 2. Wikidata: разделы и русская статья
const cache: Record<string, Wd> = !FRESH && existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : {};
const imdbQ: Record<string, string> = (cache as unknown as { _imdb?: Record<string, string> })._imdb ?? {};
async function sparql(query: string): Promise<{ results: { bindings: Record<string, { value: string }>[] } }> {
  // повтор ловит и сбой соединения, и обрыв при чтении ответа (таймаут тела, 17.10)
  for (let attempt = 0; ; attempt++) {
    try {
      const r = await fetch('https://query.wikidata.org/sparql', {
        method: 'POST', headers: { 'user-agent': UA, accept: 'application/sparql-results+json', 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ query }), signal: AbortSignal.timeout(120_000),
      });
      if (r.ok) return await r.json() as never;
      if (attempt >= 5) throw new Error(`Wikidata: ${r.status} после 6 попыток`);
    } catch (err) {
      if (attempt >= 5) throw err;
    }
    await sleep(5000 * (attempt + 1));
  }
}
const save = () => writeFileSync(CACHE, JSON.stringify({ ...cache, _imdb: imdbQ, _tmdb: (cache as unknown as { _tmdb?: unknown })._tmdb ?? tmdbQ0 }));
const tmdbQ0: Record<string, string> = {};
// IMDb → элемент, для карточек без номера Wikidata
const imdbTodo = [...byImdb.keys()].filter((k) => !(k in imdbQ));
for (let i = 0; i < imdbTodo.length; i += 200) {
  const part = imdbTodo.slice(i, i + 200);
  const res = await sparql(`SELECT ?q ?imdb WHERE { VALUES ?imdb { ${part.map((x) => `"${x.replace(/[^\w]/g, '')}"`).join(' ')} } ?q wdt:P345 ?imdb }`);
  for (const k of part) imdbQ[k] = '';
  for (const b of res.results.bindings) imdbQ[b.imdb.value] = b.q.value.split('/').pop()!;
  save();
  process.stdout.write(`\rIMDb → Wikidata ${Math.min(i + 200, imdbTodo.length)}/${imdbTodo.length}`);
  await sleep(1000);
}
if (imdbTodo.length) console.log();
for (const [imdb, ids] of byImdb) if (imdbQ[imdb]) for (const id of ids) push(byQid, imdbQ[imdb], id);
// TMDb → элемент: фильм P4947, сериал P4983
const tmdbQ: Record<string, string> = (cache as unknown as { _tmdb?: Record<string, string> })._tmdb ?? {};
const tmdbTodo = [...byTmdb.keys()].filter((k) => !(k in tmdbQ));
for (const kind of ['film', 'tv'] as const) {
  const part0 = tmdbTodo.filter((k) => k.startsWith(`${kind}:`));
  for (let i = 0; i < part0.length; i += 200) {
    const part = part0.slice(i, i + 200);
    const prop = kind === 'film' ? 'P4947' : 'P4983';
    const res = await sparql(`SELECT ?q ?t WHERE { VALUES ?t { ${part.map((k) => `"${k.split(':')[1].replace(/\D/g, '')}"`).join(' ')} } ?q wdt:${prop} ?t }`);
    for (const k of part) tmdbQ[k] = '';
    for (const b of res.results.bindings) tmdbQ[`${kind}:${b.t.value}`] = b.q.value.split('/').pop()!;
    writeFileSync(CACHE, JSON.stringify({ ...cache, _imdb: imdbQ, _tmdb: tmdbQ }));
    await sleep(1000);
  }
}
for (const [k, ids] of byTmdb) if (tmdbQ[k]) for (const id of ids) push(byQid, tmdbQ[k], id);
const todo = [...byQid.keys()].filter((q) => !(q in cache));
for (let i = 0; i < todo.length; i += 300) {
  const part = todo.slice(i, i + 300);
  const res = await sparql(`SELECT ?q ?n ?ru WHERE { VALUES ?q { ${part.map((q) => `wd:${q.replace(/[^Q\d]/g, '')}`).join(' ')} }
    ?q wikibase:sitelinks ?n .
    OPTIONAL { ?a schema:about ?q ; schema:isPartOf <https://ru.wikipedia.org/> ; schema:name ?ru } }`);
  for (const q of part) cache[q] = { links: 0 };
  for (const b of res.results.bindings) {
    const q = b.q.value.split('/').pop()!;
    cache[q] = { links: Number(b.n.value), ...(b.ru ? { ru: b.ru.value } : {}) };
  }
  save();
  process.stdout.write(`\rразделы Википедии ${Math.min(i + 300, todo.length)}/${todo.length}`);
  await sleep(1000);
}
if (todo.length) console.log();

// 3. месячные топы русской Википедии
const months = new Map<string, number>();
const tops = existsSync(TOPS) ? readdirSync(TOPS).filter((f) => /^\d{4}-\d{2}\.json$/.test(f)) : [];
for (const f of tops) {
  const list = JSON.parse(readFileSync(new URL(f, TOPS), 'utf8')) as { article: string }[];
  for (const a of new Set(list.map((x) => x.article.replace(/_/g, ' ')))) months.set(a, (months.get(a) ?? 0) + 1);
}

// 4. уровни
const fame: Record<string, number> = {};
const tally = [0, 0, 0, 0];
for (const [q, ids] of byQid) {
  const wd = cache[q];
  if (!wd) continue;
  const m = wd.ru ? months.get(wd.ru) ?? 0 : 0;
  const level = LEVELS.find((l) => wd.links >= l.links || m >= l.months)?.level ?? 0;
  tally[level] += ids.length;
  if (level) for (const id of ids) fame[id] = level;
}
console.log(`месяцев топа: ${tops.length}; уровни: 3 — ${tally[3]}, 2 — ${tally[2]}, 1 — ${tally[1]}, тихих — ${tally[0]}`);

const groups = [3, 2, 1].map((l) => Object.keys(fame).filter((id) => fame[id] === l).sort());
writeFileSync(OUT, `// Сгенерировано tools/build-fame.mts (${new Date().toISOString().slice(0, 10)}): насколько произведение на слуху — разделы
// Википедии (Wikidata, CC0) и месяцы в топе русской Википедии. 3 — самые громкие, 1 — заметные; тихих нет в списке.
// Подбор приглушает громкие (src/lib/model/fame.ts). Не править руками — перегенерировать.
const level = (ids: string): [string, number][] => ids.split(' ').filter(Boolean).map((id) => [id, 0]);
const at = (l: number, ids: string) => level(ids).map(([id]) => [id, l] as [string, number]);
export const fame: Record<string, number> = Object.fromEntries([
${groups.map((ids, i) => `  ...at(${3 - i}, '${ids.join(' ')}'),`).join('\n')}
]);
`);
console.log(`записано: ${Object.keys(fame).length} → src/mocks/fame.ts`);
process.exit(0);
