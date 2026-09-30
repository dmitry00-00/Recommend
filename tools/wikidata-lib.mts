// Общее для инструментов, которые ходят в Wikidata (Д2 авторы, Ж1 связи): повтор запросов,
// API и SPARQL, поиск по утверждению и элемент Wikidata произведения по его ключу.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import type { IndexedWork } from './works-index.mts';

const UA = 'transformative-media/0.1 (film analysis index; contact via repository README)';
const API = 'https://www.wikidata.org/w/api.php';
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Повтор и на обрыв связи (`fetch failed`), и на 429/5xx — как в build-merit. */
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
export const wd = <T,>(params: Record<string, string>) =>
  retry<T>(params.action, () => fetch(`${API}?${new URLSearchParams({ format: 'json', ...params })}`, { headers: { 'User-Agent': UA } }));
export const sparql = <T,>(query: string) => retry<T>('sparql', () => fetch('https://query.wikidata.org/sparql', {
  method: 'POST',
  headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded', accept: 'application/sparql-results+json' },
  body: new URLSearchParams({ query }),
}));
export async function search(statement: string): Promise<string | null> {
  const r = await wd<{ query?: { search?: { title: string }[] } }>({ action: 'query', list: 'search', srsearch: `haswbstatement:${statement}`, srlimit: '1' });
  return r.query?.search?.[0]?.title ?? null;
}

export const cacheUrl = (name: string) => new URL(`../.cache/${name}`, import.meta.url);
export const readCache = <T,>(name: string, fallback: T): T =>
  (existsSync(cacheUrl(name)) ? JSON.parse(readFileSync(cacheUrl(name), 'utf8')) as T : fallback);
export const writeCache = (name: string, data: unknown) => writeFileSync(cacheUrl(name), JSON.stringify(data));

/** Элементы Wikidata произведений: из id карточки (`f-wd<N>`), externalIds.wikidata, общего
 *  .cache/wikidata-ids.json, иначе поиском `haswbstatement` — фильм P4947, сериал P345, книга
 *  P212/P957. Итог копится в .cache/credits-ids.json: ненайденное (null) второй раз не ищем,
 *  если не попросили (`retryMissing`); сбой сети не помечаем — спросим в следующий раз. */
export async function resolveWorkQids(works: IndexedWork[], opts: { retryMissing?: boolean; log?: (s: string) => void } = {}):
  Promise<Record<string, string | null>> {
  const log = opts.log ?? ((s: string) => console.error(s));
  const shared = readCache<Record<string, string | null>>('wikidata-ids.json', {});
  const ids = readCache<Record<string, string | null>>('credits-ids.json', {});
  let asked = 0, failed = 0;
  for (const w of works) {
    const known = /^f-wd(\d+)$/.exec(w.work.id)?.[1];
    const direct = known ? `Q${known}` : w.work.externalIds?.wikidata ?? shared[w.key] ?? undefined;
    if (direct) { ids[w.key] = direct; continue; }
    if (ids[w.key] !== undefined && !(opts.retryMissing && ids[w.key] === null)) continue;
    const [scheme, value] = [w.key.slice(0, w.key.indexOf(':')), w.key.slice(w.key.indexOf(':') + 1)];
    try {
      ids[w.key] = scheme === 'tmdb' ? await search(`P4947=${value}`)
        : scheme === 'imdb' ? await search(`P345=${value}`)
        : scheme === 'isbn' ? (await search(`P212=${value}`)) ?? (await search(`P957=${value}`))
        : null;
    } catch (e) {
      failed++;
      log(`  ${w.work.title}: ${(e as Error).message}`);
      continue;
    }
    if (++asked % 100 === 0) { log(`  поиск: ${asked}`); writeCache('credits-ids.json', ids); }
    await sleep(120);
  }
  writeCache('credits-ids.json', ids);
  log(`элемент известен у ${works.filter((w) => ids[w.key]).length} из ${works.length} (спрошено ${asked}, сбоев ${failed})`);
  return ids;
}
