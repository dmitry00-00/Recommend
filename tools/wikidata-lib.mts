// Общее для инструментов, которые ходят в Wikidata (Д2 авторы, Ж1 связи): повтор запросов,
// API и SPARQL, поиск по утверждению и элемент Wikidata произведения по его ключу.
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import type { IndexedWork } from './works-index.mts';

const UA = 'transformative-media/0.1 (film analysis index; contact via repository README)';
const API = 'https://www.wikidata.org/w/api.php';
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Метка Wikidata без уточнения из Википедии: «Минамата (фильм)», «Тело Христово (фильм, 2019)», «Faust (2011 film)» — у части фильмов
 *  русская метка совпадает с названием статьи (11.10: 14 карточек справочника). Уточнение мешает и показу, и
 *  сопоставлению роликов — ролик «Минамата» карточку «Минамата (фильм)» не узнавал. */
export const plainTitle = (t: string): string =>
  cyrillicLookalikes(t.replace(/\s*\((?:\d{4}\s+)?(?:фильм|мультфильм|телефильм|сериал|телесериал|мини-сериал|мультсериал|аниме|film|movie|TV series|miniseries|animated series)(?:,?\s*\d{4})?\)$/iu, ''));

const LOOKALIKE: Record<string, string> = { A: 'А', B: 'В', C: 'С', E: 'Е', H: 'Н', K: 'К', M: 'М', O: 'О', P: 'Р', T: 'Т', X: 'Х', a: 'а', c: 'с', e: 'е', o: 'о', p: 'р', x: 'х', y: 'у' };
/** Латинская буква-двойник в русской метке Wikidata: «Aртур», «C приветом по планетам», «Уэйанc» (11.10). Правится
 *  одна буква в русском слове и однобуквенный предлог в начале; нарочная латиница («Духless», «SuperПерцы»,
 *  «Zомбилэнд») — не двойники или больше одной буквы, её не трогаем. */
export const cyrillicLookalikes = (t: string): string => {
  if (!/\p{Script=Cyrillic}/u.test(t)) return t;
  return t.replace(/\p{L}+/gu, (w, at: number) => {
    const latin = [...w].filter((ch) => /\p{Script=Latin}/u.test(ch));
    if (latin.length !== 1 || !LOOKALIKE[latin[0]]) return w;
    // однобуквенное слово — только предлог в начале перед русским словом («C приветом»), не «План B» и не «Эпизод V»
    if (w.length === 1 && (at !== 0 || !/^. \p{Script=Cyrillic}/u.test(t))) return w;
    return w.replace(latin[0], LOOKALIKE[latin[0]]);
  });
};

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
/** Картинка Wikimedia Commons по имени файла (P18) — прямым адресом upload.wikimedia.org (18.10): Special:FilePath
 *  отвечает редиректом, а публичным страницам (worker/pages.ts PIC_HOSTS) и og:image нужен сам файл. imageinfo с шириной
 *  отдаёт уменьшенную копию (`thumburl`) и лицензию — в справочник берём только общественное достояние и CC0, как у
 *  обложек книг (tools/build-book-media.mts): остальные лицензии требуют подписи автора у картинки. */
export const FREE_IMAGE = /^(public domain|cc0)/i;
export async function commonsImage(file: string, width = 500): Promise<{ url?: string; license?: string }> {
  const r = await retry<{ query?: { pages?: Record<string, { imageinfo?: { thumburl?: string; url?: string; extmetadata?: Record<string, { value: string }> }[] }> } }>('imageinfo',
    () => fetch(`https://commons.wikimedia.org/w/api.php?${new URLSearchParams({ action: 'query', titles: `File:${file}`, prop: 'imageinfo', iiprop: 'url|extmetadata', iiurlwidth: String(width), format: 'json', maxlag: '5' })}`,
      { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20000) }));
  const ii = Object.values(r.query?.pages ?? {})[0]?.imageinfo?.[0];
  // уменьшенные копии Commons с осени 2026 отдаёт с thumb.wikimedia.org — тот же путь лежит и на upload.wikimedia.org
  // (проверено 18.10): берём его, хост один для всех белых списков (worker/hosts.ts, worker/pages.ts)
  const url = (ii?.thumburl ?? ii?.url)?.replace(/\?.*$/, '').replace(/^https:\/\/thumb\.wikimedia\.org\//, 'https://upload.wikimedia.org/');
  return { ...(url && /^https:\/\/upload\.wikimedia\.org\//.test(url) ? { url } : {}), ...(ii?.extmetadata?.LicenseShortName ? { license: ii.extmetadata.LicenseShortName.value } : {}) };
}

export async function search(statement: string): Promise<string | null> {
  const r = await wd<{ query?: { search?: { title: string }[] } }>({ action: 'query', list: 'search', srsearch: `haswbstatement:${statement}`, srlimit: '1' });
  return r.query?.search?.[0]?.title ?? null;
}

export const cacheUrl = (name: string) => new URL(`../.cache/${name}`, import.meta.url);
export const readCache = <T,>(name: string, fallback: T): T =>
  (existsSync(cacheUrl(name)) ? JSON.parse(readFileSync(cacheUrl(name), 'utf8')) as T : fallback);
/** Запись кэша через временный файл и переименование: шаги resolve-all идут параллельно и читают одни
 *  кэши (.cache/credits-ids.json — авторы, связи, герои), и недописанный файл ломал бы JSON.parse у
 *  соседа. Переименование атомарно: сосед видит либо старый файл, либо новый целиком. */
export const writeCache = (name: string, data: unknown) => {
  const tmp = new URL(`${cacheUrl(name).href}.${process.pid}.tmp`);
  writeFileSync(tmp, JSON.stringify(data));
  renameSync(tmp, cacheUrl(name));
};

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
