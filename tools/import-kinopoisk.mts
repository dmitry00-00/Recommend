// Оценки и просмотры участника с Кинопоиска → его профиль на сервере (seeds/<ник>.json, как у
// tools/resolve-seed.mts; на сервер кладёт tools/publish-seed.mts).
//   npx tsx tools/import-kinopoisk.mts <ник в Telegram> <файлы или папки...> [--out файл] [--fast]
// Файлы — страницы профиля, сохранённые из браузера («Сохранить как», по странице на файл):
// новая «Оценки и просмотры» (/user/<id>/votes/, по 20 записей) или старая «Оценки» (по 50),
// а также CSV/список конвертера; папка — все .html/.csv/.txt в ней. Все файлы должны быть
// одного профиля Кинопоиска: страницы двух людей вперемешку скрипт не склеит.
// Что уходит в seeds: просмотренное (всё, что на страницах) и оценки 1–5 с исходной 1–10
// (`raw`: шкалу у каждого своя, её читает deriveScale). Ни ника Кинопоиска, ни токенов.
// Сопоставление: ID Кинопоиска → Wikidata (P2603) → TMDb/IMDb; чего там нет — поиск TMDb по
// названию с годом (±1). --fast — без Wikidata, только поиск (Wikidata — не чаще раза в
// секунду, первый прогон на 700 записей идёт минут десять). Найденное копится в
// .cache/kinopoisk-resolve.json — повторный прогон с новыми страницами в сеть почти не ходит.
// Уже лежащий seeds/<ник>.json не перетирается: записи присланного списка (.txt) остаются,
// кинопоисковые заменяются новыми. Папка seeds/ — чужие личные данные, в git не уходит.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { loadEnvFile } from './env-file.mts';
import { normalizeTitle, parseExport, type ImportedRecord } from '../src/lib/import/index.ts';
import { lookupFilms, tmdbFromEnv, type WikidataFilm } from '../src/lib/resolve/index.ts';
import type { WorkCard } from '../src/types/tmdf.ts';
import type { UserSeed } from '../worker/env.ts';

loadEnvFile();
const args = process.argv.slice(2);
const flag = (name: string) => { const i = args.indexOf(name); return i < 0 ? false : (args.splice(i, 1), true); };
const option = (name: string) => { const i = args.indexOf(name); return i < 0 ? undefined : args.splice(i, 2)[1]; };
const fast = flag('--fast');
const out = option('--out');
const [nick = '', ...inputs] = args;
const name = nick.replace(/^@/, '');
if (!/^[A-Za-z0-9_]{3,40}$/.test(name) || !inputs.length) {
  console.error('npx tsx tools/import-kinopoisk.mts <ник в Telegram> <файлы или папки...> [--out файл] [--fast]');
  process.exit(1);
}
const tmdb = tmdbFromEnv(process.env.TMDB_API_KEY || process.env.VITE_TMDB_API_KEY);
if (!tmdb) { console.error('нужен TMDB_API_KEY (или VITE_TMDB_API_KEY) в .env.local'); process.exit(1); }

// ─── файлы ────────────────────────────────────────────────────────────────────
const files = inputs.flatMap((p) => {
  if (!existsSync(p)) { console.error(`нет файла: ${p}`); process.exit(1); }
  return statSync(p).isDirectory()
    ? readdirSync(p).filter((f) => /\.(html?|csv|txt)$/i.test(f)).sort().map((f) => join(p, f))
    : [p];
});

/** Профиль и номер страницы — из __NEXT_DATA__ новой страницы. Только чтобы не смешать двух
 *  людей и увидеть пропуски; наружу не уходят. */
const pageInfo = (text: string): { profile?: string; page?: number } => {
  const m = text.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return {};
  try {
    const q = (JSON.parse(m[1]) as { query?: { id?: string; page?: string } }).query ?? {};
    return { profile: q.id, page: q.page ? Number(q.page) : 1 };
  } catch { return {}; }
};

const parsed: { file: string; records: ImportedRecord[]; profile?: string; page?: number }[] = [];
for (const file of files) {
  const text = readFileSync(file, 'utf8');
  const p = parseExport(text);
  if (!p) { console.error(`  не узнал формат, пропускаю: ${basename(file)}`); continue; }
  parsed.push({ file, records: p.records, ...pageInfo(text) });
}
const profiles = new Map<string, string[]>();
for (const p of parsed) if (p.profile) profiles.set(p.profile, [...(profiles.get(p.profile) ?? []), basename(p.file)]);
if (profiles.size > 1) {
  console.error('файлы от разных профилей Кинопоиска — запускайте по одному человеку:');
  for (const list of profiles.values()) console.error(`  ${list.length} файлов: ${list.slice(0, 3).join(', ')}${list.length > 3 ? ', …' : ''}`);
  process.exit(1);
}

// страницы: повторы и пропуски (последняя страница — та, где записей меньше двадцати)
const pages = parsed.filter((p) => p.page != null);
if (pages.length) {
  const nums = pages.map((p) => p.page!);
  const max = Math.max(...nums);
  const missing = Array.from({ length: max }, (_, i) => i + 1).filter((n) => !nums.includes(n));
  const repeated = [...new Set(nums.filter((n, i) => nums.indexOf(n) !== i))];
  const last = pages.find((p) => p.page === max)!;
  console.error(`страниц ${new Set(nums).size} из ${max}${repeated.length ? `, повторы: ${repeated.join(', ')}` : ''}`);
  if (missing.length) console.error(`  ✗ не хватает страниц: ${missing.join(', ')}`);
  if (last.records.length >= 20) console.error(`  ? на странице ${max} полные 20 записей — возможно, это не последняя`);
}

// склейка: одна запись на ID Кинопоиска (или название с годом), первая с оценкой выигрывает
const byKey = new Map<string, ImportedRecord>();
for (const r of parsed.flatMap((p) => p.records)) {
  const key = r.externalIds?.kinopoisk != null ? `kp:${r.externalIds.kinopoisk}`
    : r.externalIds?.imdb ?? (r.externalIds?.tmdb != null ? `tmdb:${r.externalIds.tmdb}` : `t:${r.type}:${r.title.toLowerCase()}:${r.year ?? ''}`);
  const seen = byKey.get(key);
  if (!seen || (seen.rating == null && r.rating != null)) byKey.set(key, r);
}
const records = [...byKey.values()].filter((r) => r.type === 'film' || r.type === 'series');
const rated = records.filter((r) => r.rating != null && r.rating > 0).length;
console.error(`записей ${records.length}: фильмов ${records.filter((r) => r.type === 'film').length}, сериалов ${records.filter((r) => r.type === 'series').length}, с оценкой ${rated}`);

// ─── сопоставление ────────────────────────────────────────────────────────────
const CACHE = '.cache/kinopoisk-resolve.json';
const cache: Record<string, WorkCard> = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : {};
const saveCache = () => { mkdirSync('.cache', { recursive: true }); writeFileSync(CACHE, JSON.stringify(cache)); };
const cacheKey = (r: ImportedRecord) => `${r.type}:${r.externalIds!.kinopoisk}`;
const todo = records.filter((r) => r.externalIds?.kinopoisk == null || !cache[cacheKey(r)]);

// Wikimedia просит представляться и не чаще раза в секунду
let wdCalls = 0;
let wdLast = 0;
const wikidataFetch: typeof fetch = async (url, init) => {
  const wait = wdLast + 1000 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  wdLast = Date.now();
  if (++wdCalls % 50 === 0) console.error(`  wikidata: ${wdCalls} запросов`);
  return fetch(url, { ...init, headers: { ...(init?.headers as Record<string, string>), 'User-Agent': 'TransformativeMedia/0.1 (dev tool; kinopoisk import)' } });
};
const kpIds = todo.map((r) => r.externalIds?.kinopoisk).filter((k): k is number => k != null).map(String);
let wd = new Map<string, WikidataFilm>();
if (!fast && kpIds.length) {
  console.error(`wikidata: ищу ${kpIds.length} ID Кинопоиска (~${Math.ceil(kpIds.length / 60)} мин)…`);
  wd = await lookupFilms('kinopoisk', kpIds, wikidataFetch);
  console.error(`  нашлось ${wd.size}`);
}

const blank = { primaryOperations: [], complexityLevel: 0, warnings: [], barriers: [], isNicheMasterpiece: false };
const near = (a?: number, b?: number) => a == null || b == null || Math.abs(a - b) <= 1;
/** Найденное поиском, а не по ID, должно совпасть и годом (±1), и названием — русским или
 *  оригинальным: одного года мало («Парни» 2020 поиск TMDb отдавал как The Right Stuff). */
const sameTitle = (r: ImportedRecord, t: { title?: string; originalTitle?: string }) =>
  [t.title, t.originalTitle].some((x) => x && normalizeTitle(x) === normalizeTitle(r.title));

async function resolve(r: ImportedRecord): Promise<WorkCard | undefined> {
  const kp = r.externalIds?.kinopoisk;
  const w = kp != null ? wd.get(String(kp)) : undefined;
  const imdb = w?.imdb ?? r.externalIds?.imdb;
  if (r.type === 'series') {
    let id = imdb ? await tmdb!.findTvByImdb(imdb) : undefined;
    let ids = { imdb };
    const byId = id != null;
    if (id == null && r.title) {
      const hit = await tmdb!.searchTv(r.title, r.year) ?? (r.year ? await tmdb!.searchTv(r.title) : undefined);
      if (hit) { id = hit.id; ids = { imdb: imdb ?? hit.imdb }; }
    }
    const t = id != null ? await tmdb!.tv(id) : undefined;
    // найденное поиском, а не по ID, проверяем годом и названием: иначе ремейк или тёзка
    if (id == null || !t || (!byId && !(near(t.year, r.year) && sameTitle(r, t)))) return undefined;
    return {
      id: `l-tmdbtv${id}`, type: 'film', format: 'series',
      title: r.title || t.title || '', originalTitle: t.originalTitle, year: r.year ?? t.year ?? 0,
      creators: t.creators ?? [], countries: t.countries, coverUrl: t.coverUrl, stillUrl: t.stillUrl,
      imageSource: t.imageSource, blurb: t.blurb, durationMinutes: t.durationMinutes, ...blank,
      // у сериалов номера TMDb свои — во внешние ключи их не кладём, ключ сериала — IMDb
      externalIds: { ...(ids.imdb ? { imdb: ids.imdb } : {}), ...(kp != null ? { kinopoisk: kp } : {}), ...(w ? { wikidata: w.wikidata } : {}) },
    };
  }
  let id = w?.tmdb ?? r.externalIds?.tmdb ?? (imdb ? await tmdb!.findByImdb(imdb) : undefined);
  let found = imdb;
  const byId = id != null;
  if (id == null && r.title) {
    const hit = await tmdb!.search(r.title, r.year) ?? (r.year ? await tmdb!.search(r.title) : undefined);
    if (hit) { id = hit.id; found = hit.imdb; }
  }
  const m = id != null ? await tmdb!.movie(id) : undefined;
  if (id == null || !m || (!byId && !(near(m.year, r.year) && sameTitle(r, m)))) return undefined;
  return {
    id: `l-tmdb${id}`, type: 'film',
    title: r.title || m.title || '', originalTitle: m.originalTitle, year: r.year ?? m.year ?? 0,
    creators: m.creators?.length ? m.creators : w?.creators ?? [], countries: m.countries ?? w?.countries,
    coverUrl: m.coverUrl, stillUrl: m.stillUrl, imageSource: m.imageSource, blurb: m.blurb,
    durationMinutes: m.durationMinutes ?? w?.durationMinutes, ...blank,
    externalIds: { tmdb: id, ...(found ? { imdb: found } : {}), ...(kp != null ? { kinopoisk: kp } : {}), ...(w ? { wikidata: w.wikidata } : {}) },
  };
}

const cards = new Map<ImportedRecord, WorkCard>();
const unmatched: string[] = [];
let done = 0;
for (const r of records) {
  const key = r.externalIds?.kinopoisk != null ? cacheKey(r) : undefined;
  let card = key ? cache[key] : undefined;
  if (!card) {
    try { card = await resolve(r); } catch (err) { console.error(`  ✗ ${r.title}: ${(err as Error).message}`); }
    if (card && key) cache[key] = card;
    if (++done % 50 === 0) { saveCache(); console.error(`  tmdb: ${done} из ${todo.length}`); }
  }
  if (card) cards.set(r, card);
  else {
    const where = r.externalIds?.kinopoisk != null ? ` — kinopoisk.ru/${r.type === 'series' ? 'series' : 'film'}/${r.externalIds.kinopoisk}/` : '';
    unmatched.push(`${r.title || '(без названия)'}${r.year ? ` (${r.year})` : ''}${where}`);
  }
}
saveCache();

// ─── seeds/<ник>.json ─────────────────────────────────────────────────────────
type Watched = UserSeed['watched'][number];
const watched: Watched[] = [];
const ratings: NonNullable<UserSeed['ratings']> = [];
const taken = new Set<string>();
for (const [r, work] of cards) {
  if (taken.has(work.id)) continue; // два ID Кинопоиска на одну карточку TMDb (перезалив и т. п.)
  taken.add(work.id);
  watched.push({
    workId: work.id, work, from: 'kinopoisk',
    ...(work.format !== 'series' && work.externalIds?.tmdb != null ? { tmdb: work.externalIds.tmdb } : {}),
    ...(work.externalIds?.imdb ? { imdb: work.externalIds.imdb } : {}),
  });
  if (r.rating != null && r.rating > 0) {
    ratings.push({ workId: work.id, rating: Math.min(5, Math.max(1, Math.round(r.rating / 2))), raw: r.rating, work });
  }
}

const target = out ?? `seeds/${name}.json`;
type Stored = UserSeed & { username: string; unmatched?: string[]; unmatchedKinopoisk?: string[]; resolvedAt?: string };
const prev: Stored | undefined = existsSync(target) ? JSON.parse(readFileSync(target, 'utf8')) : undefined;
// записи присланного списка (resolve-seed) остаются; прежний импорт с Кинопоиска заменяется
const kept = (prev?.watched ?? []).filter((w) => w.from !== 'kinopoisk' && !taken.has(w.workId));
const body = { watched: [...kept, ...watched], ratings };
const version = createHash('sha1').update(JSON.stringify(body)).digest('hex').slice(0, 12);
const seed: Stored = {
  username: name, version, ...body,
  unmatched: prev?.unmatched ?? [], unmatchedKinopoisk: unmatched, resolvedAt: new Date().toISOString(),
};
mkdirSync(target.includes('/') ? target.slice(0, target.lastIndexOf('/')) : '.', { recursive: true });
writeFileSync(target, JSON.stringify(seed, null, 2));

const dist = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => ratings.filter((x) => x.raw === v).length);
const sorted = ratings.map((x) => x.raw!).sort((a, b) => a - b);
console.error(`→ ${target}: просмотрено ${watched.length}${kept.length ? ` (+${kept.length} из присланного списка)` : ''}, оценок ${ratings.length}, не нашлось ${unmatched.length}`);
if (ratings.length) console.error(`  оценки 1…10: ${dist.join(' ')}; медиана ${sorted[Math.floor(sorted.length / 2)]} — норму шкалы спросить у самого участника`);
if (unmatched.length) console.error(unmatched.map((u) => `  ✗ ${u}`).join('\n'));
console.error(`дальше: npx tsx tools/publish-seed.mts ${name}`);
