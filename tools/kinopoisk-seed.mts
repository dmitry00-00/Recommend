// Общее для импорта с Кинопоиска: командная строка (tools/import-kinopoisk.mts) и пульт
// (tools/kinopoisk-desk.mts). Страницы профиля → записи → seeds/<ник>.json → сервер.
// Сырые страницы нигде не хранятся: наружу из разбора уходят только записи о фильмах.
// Сопоставление: ID Кинопоиска → Wikidata (P2603) → TMDb/IMDb; чего там нет — поиск TMDb по
// названию и году (оба должны совпасть). Wikidata — не чаще раза в секунду, поэтому её ответы
// кэшируются отдельно (.cache/kinopoisk-wikidata.json), карточки — в .cache/kinopoisk-resolve.json.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { loadEnvFile } from './env-file.mts';
import { normalizeTitle, parseExport, type ImportedRecord } from '../src/lib/import/index.ts';
import { lookupFilms, tmdbFromEnv, type WikidataFilm } from '../src/lib/resolve/index.ts';
import type { WorkCard } from '../src/types/tmdf.ts';
import type { UserSeed } from '../worker/env.ts';
import { isSeries } from '../src/lib/media.ts';

loadEnvFile();

export const SEEDS = 'seeds';
/** ник Telegram: так его проверяет воркер (seedKey) */
export const validNick = (s: string) => /^[A-Za-z0-9_]{3,40}$/.test(s);

// ─── страницы ─────────────────────────────────────────────────────────────────
export interface Page { name: string; records: ImportedRecord[]; profile?: string; page?: number }

/** Профиль и номер страницы — из __NEXT_DATA__ новой страницы: чтобы не смешать людей и
 *  увидеть пропуски. У старой страницы и у CSV их нет. */
function pageInfo(text: string): { profile?: string; page?: number } {
  const m = text.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return {};
  try {
    const q = (JSON.parse(m[1]) as { query?: { id?: string; page?: string } }).query ?? {};
    return { profile: q.id, page: q.page ? Number(q.page) : 1 };
  } catch { return {}; }
}

/** Текст файла → страница; не узнан формат — undefined. */
export function readPage(name: string, text: string): Page | undefined {
  const p = parseExport(text);
  return p ? { name, records: p.records, ...pageInfo(text) } : undefined;
}

export interface PagesReport { pages: number; max: number; missing: number[]; repeated: number[]; lastFull: boolean }

/** Повторы и пропуски страниц; последняя — та, где записей меньше двадцати. */
export function pagesReport(pages: Page[]): PagesReport | undefined {
  const numbered = pages.filter((p) => p.page != null);
  if (!numbered.length) return undefined;
  const nums = numbered.map((p) => p.page!);
  const max = Math.max(...nums);
  return {
    pages: new Set(nums).size, max,
    missing: Array.from({ length: max }, (_, i) => i + 1).filter((n) => !nums.includes(n)),
    repeated: [...new Set(nums.filter((n, i) => nums.indexOf(n) !== i))],
    lastFull: numbered.find((p) => p.page === max)!.records.length >= 20,
  };
}

/** Одна запись на ID Кинопоиска (или название с годом); запись с оценкой главнее. */
export function mergeRecords(pages: Page[]): ImportedRecord[] {
  const byKey = new Map<string, ImportedRecord>();
  for (const r of pages.flatMap((p) => p.records)) {
    const key = r.externalIds?.kinopoisk != null ? `kp:${r.externalIds.kinopoisk}`
      : r.externalIds?.imdb ?? (r.externalIds?.tmdb != null ? `tmdb:${r.externalIds.tmdb}` : `t:${r.type}:${r.title.toLowerCase()}:${r.year ?? ''}`);
    const seen = byKey.get(key);
    if (!seen || (seen.rating == null && r.rating != null)) byKey.set(key, r);
  }
  return [...byKey.values()].filter((r) => r.type === 'film' || r.type === 'series');
}

// ─── кэши ─────────────────────────────────────────────────────────────────────
const CARDS = '.cache/kinopoisk-resolve.json';
const WIKIDATA = '.cache/kinopoisk-wikidata.json';
const load = <T,>(path: string): T => (existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {}) as T;
const save = (path: string, v: unknown) => { mkdirSync('.cache', { recursive: true }); writeFileSync(path, JSON.stringify(v)); };
/** kp → карточка; только найденное */
const cards = load<Record<string, WorkCard>>(CARDS);
/** kp → элемент Wikidata или null («там нет», проверено) */
const wikidata = load<Record<string, WikidataFilm | null>>(WIKIDATA);
const cardKey = (r: ImportedRecord) => `${r.type}:${r.externalIds!.kinopoisk}`;

// Wikimedia просит представляться и не чаще раза в секунду; очередь общая на процесс
let wdLast = 0;
const wikidataFetch: typeof fetch = async (url, init) => {
  const wait = wdLast + 1000 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  wdLast = Date.now();
  return fetch(url, { ...init, headers: { ...(init?.headers as Record<string, string>), 'User-Agent': 'TransformativeMedia/0.1 (dev tool; kinopoisk import)' } });
};

// ─── сопоставление ────────────────────────────────────────────────────────────
const blank = { primaryOperations: [], complexityLevel: 0, warnings: [], barriers: [], isNicheMasterpiece: false };
const near = (a?: number, b?: number) => a == null || b == null || Math.abs(a - b) <= 1;
/** Найденное поиском, а не по ID, должно совпасть и годом (±1), и названием — русским или
 *  оригинальным: одного года мало («Парни» 2020 поиск TMDb отдавал как The Right Stuff). */
const sameTitle = (r: ImportedRecord, t: { title?: string; originalTitle?: string }) =>
  [t.title, t.originalTitle].some((x) => x && normalizeTitle(x) === normalizeTitle(r.title));

type Tmdb = NonNullable<ReturnType<typeof tmdbFromEnv>>;

async function resolve(r: ImportedRecord, tmdb: Tmdb): Promise<WorkCard | undefined> {
  const kp = r.externalIds?.kinopoisk;
  const w = kp != null ? wikidata[String(kp)] ?? undefined : undefined;
  const imdb = w?.imdb ?? r.externalIds?.imdb;
  const wdId = w ? { wikidata: w.wikidata } : {};
  const kpId = kp != null ? { kinopoisk: kp } : {};
  if (r.type === 'series') {
    let id = imdb ? await tmdb.findTvByImdb(imdb) : undefined;
    const byId = id != null;
    let foundImdb = imdb;
    if (id == null && r.title) {
      const hit = await tmdb.searchTv(r.title, r.year) ?? (r.year ? await tmdb.searchTv(r.title) : undefined);
      if (hit) { id = hit.id; foundImdb = imdb ?? hit.imdb; }
    }
    const t = id != null ? await tmdb.tv(id) : undefined;
    if (id == null || !t || (!byId && !(near(t.year, r.year) && sameTitle(r, t)))) return undefined;
    return {
      id: `l-tmdbtv${id}`, type: 'series', ...(t.series ? { series: t.series } : {}),
      title: r.title || t.title || '', originalTitle: t.originalTitle, year: r.year ?? t.year ?? 0,
      creators: t.creators ?? [], countries: t.countries, coverUrl: t.coverUrl, stillUrl: t.stillUrl,
      imageSource: t.imageSource, blurb: t.blurb, durationMinutes: t.durationMinutes, ...blank,
      // у сериалов номера TMDb свои — во внешние ключи их не кладём, ключ сериала — IMDb
      externalIds: { ...(foundImdb ? { imdb: foundImdb } : {}), ...kpId, ...wdId },
    };
  }
  let id = w?.tmdb ?? r.externalIds?.tmdb ?? (imdb ? await tmdb.findByImdb(imdb) : undefined);
  const byId = id != null;
  let foundImdb = imdb;
  if (id == null && r.title) {
    const hit = await tmdb.search(r.title, r.year) ?? (r.year ? await tmdb.search(r.title) : undefined);
    if (hit) { id = hit.id; foundImdb = hit.imdb; }
  }
  const m = id != null ? await tmdb.movie(id) : undefined;
  if (id == null || !m || (!byId && !(near(m.year, r.year) && sameTitle(r, m)))) return undefined;
  return {
    id: `l-tmdb${id}`, type: 'film',
    title: r.title || m.title || '', originalTitle: m.originalTitle, year: r.year ?? m.year ?? 0,
    creators: m.creators?.length ? m.creators : w?.creators ?? [], countries: m.countries ?? w?.countries,
    coverUrl: m.coverUrl, stillUrl: m.stillUrl, imageSource: m.imageSource, blurb: m.blurb,
    durationMinutes: m.durationMinutes ?? w?.durationMinutes, ...blank,
    externalIds: { tmdb: id, ...(foundImdb ? { imdb: foundImdb } : {}), ...kpId, ...wdId },
  };
}

// ─── сборка сида ──────────────────────────────────────────────────────────────
export interface Progress { phase: 'wikidata' | 'tmdb'; done: number; total: number }
export interface BuildOptions {
  fast?: boolean;
  /** куда писать; по умолчанию seeds/<ник>.json */
  target?: string;
  log?: (line: string) => void;
  progress?: (p: Progress) => void;
}
export interface SeedResult {
  target: string; watched: number; kept: number; ratings: number;
  unmatched: string[]; dist: number[]; median?: number;
}

type Stored = UserSeed & {
  username: string; unmatched?: string[]; unmatchedKinopoisk?: string[]; resolvedAt?: string; publishedAt?: string;
};

/** Записи → seeds/<ник>.json. Сеть упала на полпути — файл не пишется (найденное остаётся в
 *  кэше, повтор продолжит с места): полупустой сид опаснее, чем никакого. */
export async function buildSeed(name: string, records: ImportedRecord[], o: BuildOptions = {}): Promise<SeedResult> {
  const log = o.log ?? (() => {});
  const tmdb = tmdbFromEnv(process.env.TMDB_API_KEY || process.env.VITE_TMDB_API_KEY);
  if (!tmdb) throw new Error('нужен TMDB_API_KEY (или VITE_TMDB_API_KEY) в .env.local');

  const todo = records.filter((r) => r.externalIds?.kinopoisk == null || !cards[cardKey(r)]);
  if (!o.fast) {
    const ask = [...new Set(todo.map((r) => r.externalIds?.kinopoisk).filter((k): k is number => k != null).map(String))]
      .filter((k) => !(k in wikidata));
    if (ask.length) log(`wikidata: ${ask.length} ID Кинопоиска, ~${Math.ceil(ask.length / 50)} мин`);
    if (ask.length) o.progress?.({ phase: 'wikidata', done: 0, total: ask.length });
    // пачками по 40 (один поиск в Wikidata), с записью после каждой: обрыв не съедает сделанное. Пачка, где не нашлось
    // ничего, — скорее сбой сети, чем правда: «нет в Wikidata» для неё не запоминаем
    for (let i = 0; i < ask.length; i += 40) {
      const chunk = ask.slice(i, i + 40);
      const found = await lookupFilms('kinopoisk', chunk, wikidataFetch);
      for (const k of chunk) if (found.has(k)) wikidata[k] = found.get(k)!; else if (found.size) wikidata[k] = null;
      save(WIKIDATA, wikidata);
      o.progress?.({ phase: 'wikidata', done: Math.min(i + 40, ask.length), total: ask.length });
    }
  }

  const matched = new Map<ImportedRecord, WorkCard>();
  const unmatched: string[] = [];
  let done = 0;
  let failed = 0;
  for (const r of records) {
    const key = r.externalIds?.kinopoisk != null ? cardKey(r) : undefined;
    let card = key ? cards[key] : undefined;
    if (!card) {
      try { card = await resolve(r, tmdb); } catch (err) {
        failed++;
        log(`✗ ${r.title}: ${(err as Error).message}`);
        if (failed >= 5 && failed > done / 5) {
          save(CARDS, cards);
          throw new Error(`TMDb не отвечает (${(err as Error).message}) — проверьте сеть и запустите снова, сделанное сохранено`);
        }
      }
      if (card && key) cards[key] = card;
      done++;
      if (done % 25 === 0) save(CARDS, cards);
      o.progress?.({ phase: 'tmdb', done, total: todo.length });
    }
    if (card) matched.set(r, card);
    else {
      const where = r.externalIds?.kinopoisk != null ? ` — kinopoisk.ru/${r.type === 'series' ? 'series' : 'film'}/${r.externalIds.kinopoisk}/` : '';
      unmatched.push(`${r.title || '(без названия)'}${r.year ? ` (${r.year})` : ''}${where}`);
    }
  }
  save(CARDS, cards);

  const watched: UserSeed['watched'] = [];
  const ratings: NonNullable<UserSeed['ratings']> = [];
  const taken = new Set<string>();
  for (const [r, work] of matched) {
    if (taken.has(work.id)) continue; // два ID Кинопоиска на одну карточку TMDb (перезалив и т. п.)
    taken.add(work.id);
    watched.push({
      workId: work.id, work, from: 'kinopoisk',
      ...(!isSeries(work) && work.externalIds?.tmdb != null ? { tmdb: work.externalIds.tmdb } : {}),
      ...(work.externalIds?.imdb ? { imdb: work.externalIds.imdb } : {}),
    });
    if (r.rating != null && r.rating > 0) {
      ratings.push({ workId: work.id, rating: Math.min(5, Math.max(1, Math.round(r.rating / 2))), raw: r.rating, work });
    }
  }

  const target = o.target ?? `${SEEDS}/${name}.json`;
  const prev = existsSync(target) ? JSON.parse(readFileSync(target, 'utf8')) as Stored : undefined;
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

  const raws = ratings.map((x) => x.raw!).sort((a, b) => a - b);
  return {
    target, watched: watched.length, kept: kept.length, ratings: ratings.length, unmatched,
    dist: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => raws.filter((x) => x === v).length),
    median: raws.length ? raws[Math.floor(raws.length / 2)] : undefined,
  };
}

// ─── сервер ───────────────────────────────────────────────────────────────────
export interface Published { watched: number; ratings: number; known: boolean }

/** seeds/<ник>.json → сервер (как tools/publish-seed.mts). Время отправки пишется в файл. */
export async function publishSeed(name: string): Promise<Published> {
  const server = (process.env.TM_SERVER ?? 'https://recomend.bothost.tech').replace(/\/+$/, '');
  const token = process.env.TM_ADMIN_TOKEN;
  if (!token) throw new Error('нет TM_ADMIN_TOKEN в .env.local — отправлять нечем');
  const path = `${SEEDS}/${name}.json`;
  if (!existsSync(path)) throw new Error(`нет ${path} — сначала собрать`);
  const text = readFileSync(path, 'utf8');
  const res = await fetch(`${server}/api/admin/seed/${name}`, {
    method: 'PUT', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: text,
  });
  if (!res.ok) throw new Error(`сервер ответил ${res.status} ${res.statusText}`);
  const r = await res.json() as Published;
  writeFileSync(path, JSON.stringify({ ...JSON.parse(text), publishedAt: new Date().toISOString() }, null, 2));
  return r;
}

/** Что уже лежит в seeds/: для пульта — кто собран, кто отправлен. */
export function seedSummary(name: string): { watched: number; ratings: number; unmatched: number; resolvedAt?: string; publishedAt?: string } | undefined {
  const path = `${SEEDS}/${name}.json`;
  if (!existsSync(path)) return undefined;
  const s = JSON.parse(readFileSync(path, 'utf8')) as Stored;
  return {
    watched: s.watched.length, ratings: s.ratings?.length ?? 0,
    unmatched: (s.unmatched?.length ?? 0) + (s.unmatchedKinopoisk?.length ?? 0),
    resolvedAt: s.resolvedAt, publishedAt: s.publishedAt,
  };
}
