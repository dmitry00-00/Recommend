// Неопознанное из историй Кинопоиска (unmatchedKinopoisk в seeds/*.json) → Wikidata по номеру Кинопоиска (P2603) → TMDb
// (23.10). При импорте (tools/kinopoisk-seed.mts) у ~2,5 тыс. номеров Wikidata ответила «нет» или нашёлся элемент без
// TMDb-фильма, а сериал по P4983 штатный разбор не ищет; поиск TMDb по названию с годом тоже не совпал — записи выпали из
// замера и из «как оценили другие». Здесь — свежий SPARQL пачками (P2603 → P4947 фильм, P4983 сериал, P345 IMDb, P31 вид,
// P577 год) и карточки в формате штатного resolve(): l-tmdb<id> / l-tmdbtv<id>, externalIds с kinopoisk и wikidata.
// Оценку (её в строке unmatched нет) берём из скачанных страниц профиля (папка помощника и «Профили»), тем же разбором,
// что импорт; страниц нет — запись только в просмотренное. Сам Кинопоиск не открываем.
//   npx tsx tools/match-unmatched-wikidata.mts           — пробный прогон: запросы (с кэшем), итоги, файлы не трогает
//   npx tsx tools/match-unmatched-wikidata.mts --apply   — то же и запись историй; перед ней копия seeds/ в .cache/seeds-backup-2310/
// Кэш ответов — .cache/wikidata-kp/ (Wikidata — kp.json, TMDb — tmdb.json): повтор после переимпорта идёт без сети.
// Переимпорт истории (import-kinopoisk) снова соберёт её без этих карточек — после него скрипт запустить ещё раз.
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { mergeRecords, readPage, splitBundle, type Page } from './kinopoisk-seed.mts';
import { addressees, HELPER_DIR, kpSeed } from './addressees.mts';
import { tmdbFromEnv } from '../src/lib/resolve/index.ts';
import type { WorkCard } from '../src/types/tmdf.ts';

const APPLY = process.argv.includes('--apply');
const SEEDS = 'seeds';
const DIR = '.cache/wikidata-kp';
const BACKUP = '.cache/seeds-backup-2310';
/** история моложе этого — её, возможно, прямо сейчас пишет автоимпорт: откладываем в конец */
const FRESH_MS = 120e3;
const BATCH = 300;
mkdirSync(DIR, { recursive: true });

const load = <T,>(f: string, d: T): T => (existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) as T : d);
const saveAtomic = (f: string, v: unknown, indent?: number) => { writeFileSync(`${f}.tmp`, JSON.stringify(v, null, indent)); renameSync(`${f}.tmp`, f); };

// ─── строки unmatched ─────────────────────────────────────────────────────────
// формат buildSeed: «Название (год) — kinopoisk.ru/film|series/<номер>/»
interface Line { title: string; year?: number; type: 'film' | 'series'; kp: string; raw: string }
const LINE = /^(.*?)(?: \((\d{4})\))? — kinopoisk\.ru\/(film|series)\/(\d+)\/$/;
function parseLine(s: string): Line | undefined {
  const m = LINE.exec(s);
  if (!m) return undefined;
  return { title: m[1] === '(без названия)' ? '' : m[1], ...(m[2] ? { year: Number(m[2]) } : {}), type: m[3] as Line['type'], kp: m[4], raw: s };
}

type Seed = { username?: string; version?: string; watched: { workId: string; work: unknown; tmdb?: number; imdb?: string; from?: 'kinopoisk' }[];
  ratings?: { workId: string; rating: number; raw?: number; work?: unknown }[]; unmatchedKinopoisk?: string[] };
const seedFiles = () => readdirSync(SEEDS).filter((f) => f.endsWith('.json')).sort();

// ─── Wikidata ─────────────────────────────────────────────────────────────────
interface Wd { q: string; tmdb?: number; tmdbTv?: number; imdb?: string; kinds: string[]; years: number[]; ru?: string; en?: string }
/** kp → элемент или null (SPARQL ответил, элемента с этим P2603 нет) */
const WD_FILE = `${DIR}/kp.json`;
const wd = load<Record<string, Wd | null>>(WD_FILE, {});

// другой агент тоже ходит в Wikidata: не чаще запроса в 2 с, представляемся, на 429/5xx ждём
let wdLast = 0;
const UA = 'TransformativeMedia/0.1 (dev tool; unmatched kinopoisk -> wikidata, 23.10)';
async function sparql(query: string): Promise<Record<string, { value: string } | undefined>[]> {
  for (let attempt = 0; ; attempt++) {
    const wait = wdLast + 2000 - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    wdLast = Date.now();
    let status = 0, after = 0;
    try {
      const res = await fetch('https://query.wikidata.org/sparql', {
        method: 'POST', body: new URLSearchParams({ query }), signal: AbortSignal.timeout(90e3),
        headers: { Accept: 'application/sparql-results+json', 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
      });
      if (res.ok) return ((await res.json()) as { results: { bindings: Record<string, { value: string }>[] } }).results.bindings;
      status = res.status; after = Number(res.headers.get('retry-after')) || 0;
    } catch { /* сеть или таймаут — повтор */ } finally { wdLast = Date.now(); }
    if (status && !(status === 429 || status >= 500)) throw new Error(`wikidata sparql ${status}`);
    if (attempt >= 5) throw new Error(`wikidata sparql: ${status || 'сеть'} после ${attempt + 1} попыток`);
    const pause = Math.max(after * 1000, 15e3 * (attempt + 1));
    console.error(`  wikidata ${status || 'сеть'}: жду ${Math.round(pause / 1000)} с`);
    await new Promise((r) => setTimeout(r, pause));
  }
}

async function askWikidata(kps: string[]): Promise<void> {
  const ask = kps.filter((k) => !(k in wd));
  if (ask.length) console.error(`wikidata: ${ask.length} номеров (в кэше ${kps.length - ask.length}), пачки по ${BATCH}`);
  for (let i = 0; i < ask.length; i += BATCH) {
    const chunk = ask.slice(i, i + BATCH);
    const rows = await sparql(`SELECT ?kp ?f (SAMPLE(?tm) AS ?tmdb) (SAMPLE(?tv) AS ?tmdbTv) (SAMPLE(?im) AS ?imdb)
      (GROUP_CONCAT(DISTINCT ?kindEn; separator="|") AS ?kinds) (GROUP_CONCAT(DISTINCT STR(YEAR(?date)); separator=" ") AS ?years)
      (SAMPLE(?ru0) AS ?ru) (SAMPLE(?en0) AS ?en) WHERE {
      VALUES ?kp { ${chunk.map((k) => `"${k}"`).join(' ')} }
      ?f wdt:P2603 ?kp .
      OPTIONAL { ?f wdt:P4947 ?tm } OPTIONAL { ?f wdt:P4983 ?tv } OPTIONAL { ?f wdt:P345 ?im } OPTIONAL { ?f wdt:P577 ?date }
      OPTIONAL { ?f wdt:P31 ?kind . ?kind rdfs:label ?kindEn FILTER(lang(?kindEn) = 'en') }
      OPTIONAL { ?f rdfs:label ?ru0 FILTER(lang(?ru0) = 'ru') } OPTIONAL { ?f rdfs:label ?en0 FILTER(lang(?en0) = 'en') }
    } GROUP BY ?kp ?f`);
    // у номера бывает два элемента (фильм и его перезалив) — берём тот, где есть TMDb
    const got = new Map<string, Wd>();
    for (const r of rows) {
      const kp = r.kp?.value, q = r.f?.value.split('/').pop();
      if (!kp || !q) continue;
      const num = (v?: { value: string }) => (v && /^\d+$/.test(v.value) ? Number(v.value) : undefined);
      const w: Wd = {
        q, ...(num(r.tmdb) ? { tmdb: num(r.tmdb) } : {}), ...(num(r.tmdbTv) ? { tmdbTv: num(r.tmdbTv) } : {}),
        ...(r.imdb?.value?.startsWith('tt') ? { imdb: r.imdb.value } : {}),
        kinds: (r.kinds?.value ?? '').split('|').filter(Boolean),
        years: (r.years?.value ?? '').split(' ').map(Number).filter((y) => y > 1800),
        ...(r.ru?.value ? { ru: r.ru.value } : {}), ...(r.en?.value ? { en: r.en.value } : {}),
      };
      const had = got.get(kp);
      const score = (x: Wd) => (x.tmdb || x.tmdbTv ? 2 : 0) + (x.imdb ? 1 : 0);
      if (!had || score(w) > score(had)) got.set(kp, w);
    }
    for (const k of chunk) wd[k] = got.get(k) ?? null;
    saveAtomic(WD_FILE, wd);
    console.error(`  wikidata: ${Math.min(i + BATCH, ask.length)} из ${ask.length}, в пачке найдено ${got.size}`);
  }
}

/** вид по P31 (подписи по-английски): для отчёта; сопоставление идёт по номерам TMDb */
function kindOf(w: Wd): 'фильм' | 'сериал' | 'прочее' {
  const k = w.kinds.join(' | ').toLowerCase();
  if (/film series|series of films|franchise/.test(k) && !/television/.test(k)) return 'прочее';
  if (/series|serial|sitcom|telenovela|soap opera|miniseries|web series|television program|tv program|anime television|show/.test(k)) return 'сериал';
  if (/film|movie|cartoon|original video animation|anime/.test(k)) return 'фильм';
  return 'прочее';
}

// ─── TMDb ─────────────────────────────────────────────────────────────────────
const tmdbOrNone = tmdbFromEnv(process.env.TMDB_API_KEY || process.env.VITE_TMDB_API_KEY);
if (!tmdbOrNone) { console.error('нужен TMDB_API_KEY (или VITE_TMDB_API_KEY) в .env.local'); process.exit(1); }
const tmdb = tmdbOrNone;
const TM_FILE = `${DIR}/tmdb.json`;
/** «movie:<id>» / «tv:<id>» → ответ клиента (null — 404); «find:<tt>» → номера фильма и сериала */
const tm = load<Record<string, unknown>>(TM_FILE, {});
let tmDirty = 0, tmFailed = 0;
async function cached<T>(key: string, get: () => Promise<T | undefined>): Promise<T | undefined> {
  if (key in tm) return (tm[key] ?? undefined) as T | undefined;
  await new Promise((r) => setTimeout(r, 60)); // TMDb терпит десятки в секунду, но не спешим
  try {
    const v = await get();
    tm[key] = v ?? null;
    if (++tmDirty % 50 === 0) saveAtomic(TM_FILE, tm);
    return v;
  } catch (err) {
    if (++tmFailed >= 20) { saveAtomic(TM_FILE, tm); throw new Error(`TMDb не отвечает (${(err as Error).message}) — сделанное в кэше`); }
    return undefined;
  }
}
type Movie = NonNullable<Awaited<ReturnType<typeof tmdb.movie>>>;
type Tv = NonNullable<Awaited<ReturnType<typeof tmdb.tv>>>;
const findIds = (imdb: string) => cached(`find:${imdb}`, async () => ({ movie: await tmdb.findByImdb(imdb) ?? null, tv: await tmdb.findTvByImdb(imdb) ?? null }));

// ─── карточка, как в resolve() tools/kinopoisk-seed.mts ──────────────────────
const blank = { primaryOperations: [], complexityLevel: 0, warnings: [], barriers: [], isNicheMasterpiece: false };
type Why = 'нет в Wikidata' | 'в Wikidata без TMDb' | 'в TMDb не нашлось' | 'год не сходится' | 'название не сходится';
/** Год: строка Кинопоиска против TMDb и Wikidata (±2) — номер в Wikidata бывает приписан не тому элементу */
const yearOk = (l: Line, w: Wd, tmYear?: number) => !l.year || [tmYear, ...w.years].filter((y): y is number => y != null).length === 0
  || [tmYear, ...w.years].some((y) => y != null && Math.abs(y - l.year!) <= 2);

async function cardFor(l: Line): Promise<WorkCard | Why> {
  const w = wd[l.kp];
  if (!w) return 'нет в Wikidata';
  const ids = { kinopoisk: Number(l.kp), wikidata: w.q };
  let movie = w.tmdb, tv = w.tmdbTv;
  // номер TMDb в Wikidata бывает устаревшим (TMDb отвечает 404 — карточку слили с другой): тогда — поиск по IMDb
  if (movie != null && !(await cached<Movie>(`movie:${movie}`, () => tmdb.movie(movie!)))) movie = undefined;
  if (tv != null && !(await cached<Tv>(`tv:${tv}`, () => tmdb.tv(tv!)))) tv = undefined;
  if (w.imdb && ((l.type === 'film' && movie == null) || (l.type === 'series' && tv == null))) {
    const f = await findIds(w.imdb);
    movie ??= f?.movie ?? undefined; tv ??= f?.tv ?? undefined;
  }
  // вид — как у Кинопоиска; нет номера своего вида — берём другой (спецвыпуск-«фильм», который TMDb держит сериалом, и наоборот)
  const asSeries = l.type === 'series' ? tv != null : movie == null && tv != null;
  // название TMDb ни словом не похоже ни на строку Кинопоиска, ни на подписи Wikidata — сверяем номер с IMDb: у «Космос:
  // возможные миры» P4983 вёл на чужой сериал «World». IMDb знает другой номер — берём его; не знает ничего — номер Wikidata
  // (иностранные названия: «Die Puppenspieler», «로보트 태권 V» — совпадают с IMDb)
  const words = (x?: string) => (x ?? '').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((t) => t.length >= 3);
  const alike = (t: { title?: string; originalTitle?: string }) => {
    const a = new Set([...words(t.title), ...words(t.originalTitle)]);
    return [l.title, w.ru, w.en].flatMap(words).some((x) => a.has(x));
  };
  if (asSeries) {
    let t = await cached<Tv>(`tv:${tv}`, () => tmdb.tv(tv!));
    if (t && !alike(t) && w.imdb) {
      const other = (await findIds(w.imdb))?.tv;
      if (other != null && other !== tv) { tv = other; t = await cached<Tv>(`tv:${tv}`, () => tmdb.tv(tv!)); }
      else if (other == null) return 'название не сходится';
    }
    if (!t) return 'в TMDb не нашлось';
    if (!yearOk(l, w, t.year)) return 'год не сходится';
    return {
      id: `l-tmdbtv${tv}`, type: 'series', ...(t.series ? { series: t.series } : {}),
      title: l.title || t.title || '', originalTitle: t.originalTitle, year: l.year ?? t.year ?? 0,
      creators: t.creators ?? [], countries: t.countries, coverUrl: t.coverUrl, stillUrl: t.stillUrl,
      imageSource: t.imageSource, blurb: t.blurb, durationMinutes: t.durationMinutes, ...blank,
      // как у штатного: номер TMDb сериала во внешние ключи не кладём, ключ сериала — IMDb
      externalIds: { ...(w.imdb ? { imdb: w.imdb } : {}), ...ids },
    } as WorkCard;
  }
  if (movie == null) return w.tmdb == null && w.tmdbTv == null && !w.imdb ? 'в Wikidata без TMDb' : 'в TMDb не нашлось';
  let m = await cached<Movie>(`movie:${movie}`, () => tmdb.movie(movie!));
  if (m && !alike(m) && w.imdb) {
    const other = (await findIds(w.imdb))?.movie;
    if (other != null && other !== movie) { movie = other; m = await cached<Movie>(`movie:${movie}`, () => tmdb.movie(movie!)); }
    else if (other == null) return 'название не сходится';
  }
  if (!m) return 'в TMDb не нашлось';
  if (!yearOk(l, w, m.year)) return 'год не сходится';
  return {
    id: `l-tmdb${movie}`, type: 'film',
    title: l.title || m.title || '', originalTitle: m.originalTitle, year: l.year ?? m.year ?? 0,
    creators: m.creators ?? [], countries: m.countries,
    coverUrl: m.coverUrl, stillUrl: m.stillUrl, imageSource: m.imageSource, blurb: m.blurb,
    durationMinutes: m.durationMinutes, ...blank,
    externalIds: { tmdb: movie, ...(w.imdb ? { imdb: w.imdb } : {}), ...ids },
  } as WorkCard;
}

// ─── оценки из скачанных страниц ──────────────────────────────────────────────
const kpOfSeed = new Map<string, string>();
for (const a of addressees()) if (a.kp) kpOfSeed.set(a.seed, a.kp);
if (existsSync(HELPER_DIR)) for (const kp of readdirSync(HELPER_DIR)) if (!kpOfSeed.has(kpSeed(kp))) kpOfSeed.set(kpSeed(kp), kp);
/** kp → оценка 1–10 из страниц профиля; страниц нет — undefined */
function ratingsOf(seed: string): Map<string, number> | undefined {
  const kp = kpOfSeed.get(seed);
  if (!kp) return undefined;
  const dirs = [join(HELPER_DIR, kp), join(dirname(HELPER_DIR), kp)].filter((d) => existsSync(d) && statSync(d).isDirectory());
  const pages: Page[] = [];
  for (const d of dirs) for (const f of readdirSync(d).filter((x) => /\.(html?|csv|txt)$/i.test(x)).sort()) {
    for (const part of splitBundle(f, readFileSync(join(d, f), 'utf8'))) { const p = readPage(part.name, part.text); if (p) pages.push(p); }
  }
  if (!pages.length) return undefined;
  const out = new Map<string, number>();
  for (const r of mergeRecords(pages)) if (r.externalIds?.kinopoisk != null && r.rating != null && r.rating > 0) out.set(String(r.externalIds.kinopoisk), r.rating);
  return out;
}

// ─── справочник: есть ли карточка (src/mocks/filmBase*.ts, seriesBase*.ts) ───
function baseKeys(): Set<string> {
  const keys = new Set<string>();
  for (const f of readdirSync('src/mocks').filter((x) => /^(filmBase|seriesBase)\w*\.ts$/.test(x))) {
    const text = readFileSync(join('src/mocks', f), 'utf8');
    // карточки двух видов: развёрнутые («"tmdb": 1») и строкой через c(…) («{"tmdb":1,"imdb":"tt…"}», id `f-wd<номер>`)
    for (const m of text.matchAll(/"id":\s*"[a-z]-tmdbtv(\d+)"/g)) keys.add(`tv:${m[1]}`);
    for (const m of text.matchAll(/"tmdb":\s*(\d+)/g)) keys.add(`tmdb:${m[1]}`);
    for (const m of text.matchAll(/"imdb":\s*"(tt\d+)"/g)) keys.add(`imdb:${m[1]}`);
    for (const m of text.matchAll(/"kinopoisk":\s*(\d+)/g)) keys.add(`kp:${m[1]}`);
    for (const m of text.matchAll(/"wikidata":\s*"(Q\d+)"|c\("(\d+)", "(?:film|series)"/g)) keys.add(`wd:${m[1] ?? `Q${m[2]}`}`);
  }
  return keys;
}
const inBase = (w: WorkCard, keys: Set<string>) => {
  const tv = /^l-tmdbtv(\d+)$/.exec(w.id)?.[1];
  const e = w.externalIds ?? {};
  return (tv != null && keys.has(`tv:${tv}`)) || (w.type === 'film' && e.tmdb != null && keys.has(`tmdb:${e.tmdb}`))
    || (e.imdb != null && keys.has(`imdb:${e.imdb}`)) || (e.kinopoisk != null && keys.has(`kp:${e.kinopoisk}`))
    || (e.wikidata != null && keys.has(`wd:${e.wikidata}`));
};

// ─── проход ───────────────────────────────────────────────────────────────────
const lines = new Map<string, Line[]>(); // файл → строки
for (const f of seedFiles()) {
  const s = JSON.parse(readFileSync(join(SEEDS, f), 'utf8')) as Seed;
  const ls = (s.unmatchedKinopoisk ?? []).map(parseLine).filter((x): x is Line => Boolean(x));
  if (ls.length) lines.set(f, ls);
}
const allKp = [...new Set([...lines.values()].flat().map((l) => l.kp))];
console.error(`историй с неопознанным ${lines.size}, строк ${[...lines.values()].flat().length}, номеров Кинопоиска ${allKp.length}`);
await askWikidata(allKp);

// карточка на номер (вид — по первой строке; у одного номера он один)
const cardOf = new Map<string, WorkCard | Why>();
let n = 0;
for (const l of [...lines.values()].flat()) {
  if (cardOf.has(l.kp)) continue;
  cardOf.set(l.kp, await cardFor(l));
  if (++n % 200 === 0) console.error(`  tmdb: ${n} из ${allKp.length}`);
}
saveAtomic(TM_FILE, tm);

if (APPLY && !existsSync(BACKUP)) { cpSync(SEEDS, BACKUP, { recursive: true }); console.error(`копия seeds/ → ${BACKUP}/`); }

const stat = { files: 0, changed: 0, written: 0, watchedAdded: 0, ratingsAdded: 0, linesMatched: 0, dupes: 0, noPages: 0, addedInBase: 0, ratedInBase: 0 };
const addedWorks = new Map<string, WorkCard>();
const deferred: string[] = [];
const keys = baseKeys();

function processSeed(f: string, force = false): 'done' | 'fresh' {
  const path = join(SEEDS, f);
  const before = statSync(path).mtimeMs;
  // счёт — свой, в общий только по завершении: отложенную историю посчитаем при повторе
  const st = Object.fromEntries(Object.keys(stat).map((k) => [k, 0])) as typeof stat;
  const added = new Map<string, WorkCard>();
  const commit = () => { for (const k of Object.keys(st) as (keyof typeof stat)[]) stat[k] += st[k]; for (const [k, v] of added) addedWorks.set(k, v); return 'done' as const; };
  if (!force && Date.now() - before < FRESH_MS) return 'fresh';
  const text = readFileSync(path, 'utf8');
  const s = JSON.parse(text) as Seed;
  const ls = (s.unmatchedKinopoisk ?? []).map(parseLine).filter((x): x is Line => Boolean(x));
  const hits = ls.filter((l) => typeof cardOf.get(l.kp) === 'object');
  st.files++;
  if (!hits.length) return commit();
  st.changed++;
  const seed = f.replace(/\.json$/, '');
  const rated = ratingsOf(seed);
  if (!rated) st.noPages++;
  const have = new Set(s.watched.map((w) => w.workId));
  const haveR = new Set((s.ratings ?? []).map((r) => r.workId));
  const drop = new Set<string>();
  for (const l of hits) {
    const work = cardOf.get(l.kp) as WorkCard;
    drop.add(l.raw);
    st.linesMatched++;
    if (have.has(work.id)) { st.dupes++; continue; } // уже есть под другим номером — строка просто опознана
    have.add(work.id);
    s.watched.push({
      workId: work.id, work, from: 'kinopoisk',
      ...(work.type !== 'series' && work.externalIds?.tmdb != null ? { tmdb: work.externalIds.tmdb } : {}),
      ...(work.externalIds?.imdb ? { imdb: work.externalIds.imdb } : {}),
    });
    st.watchedAdded++;
    added.set(work.id, work);
    const base = inBase(work, keys);
    if (base) st.addedInBase++;
    const raw = rated?.get(l.kp);
    if (raw != null && !haveR.has(work.id)) {
      (s.ratings ??= []).push({ workId: work.id, rating: Math.min(5, Math.max(1, Math.round(raw / 2))), raw, work });
      haveR.add(work.id);
      st.ratingsAdded++;
      if (base) st.ratedInBase++;
    }
  }
  s.unmatchedKinopoisk = (s.unmatchedKinopoisk ?? []).filter((u) => !drop.has(u));
  // версия — как у buildSeed: хэш просмотренного и оценок
  s.version = createHash('sha1').update(JSON.stringify({ watched: s.watched, ratings: s.ratings ?? [] })).digest('hex').slice(0, 12);
  if (APPLY) {
    if (statSync(path).mtimeMs !== before) return 'fresh'; // пока читали — переписали
    writeFileSync(`${path}.tmp`, JSON.stringify(s, null, 2));
    renameSync(`${path}.tmp`, path);
    st.written++;
  }
  return commit();
}

for (const f of lines.keys()) if (processSeed(f) === 'fresh') deferred.push(f);
// отложенные — когда автоимпорт их допишет и они «остынут» (ждём до 6 минут)
for (let t = 0; deferred.length && t < 24; t++) {
  console.error(`отложено ${deferred.length} (пишутся сейчас): ${deferred.join(', ')} — жду 15 с`);
  await new Promise((r) => setTimeout(r, 15e3));
  for (const f of [...deferred]) if (processSeed(f) === 'done') deferred.splice(deferred.indexOf(f), 1);
}

// ─── итоги ────────────────────────────────────────────────────────────────────
const found = allKp.filter((k) => wd[k]);
const kinds = { фильм: 0, сериал: 0, прочее: 0 } as Record<string, number>;
for (const k of found) kinds[kindOf(wd[k]!)]++;
const matchedKp = allKp.filter((k) => typeof cardOf.get(k) === 'object');
const why: Record<string, number> = {};
for (const k of allKp) { const c = cardOf.get(k); if (typeof c === 'string') why[c] = (why[c] ?? 0) + 1; }
const matchedSeries = matchedKp.filter((k) => (cardOf.get(k) as WorkCard).type === 'series').length;
// неопознанное, по числу людей
const left = new Map<string, { line: Line; people: number; why: string }>();
for (const ls of lines.values()) for (const l of new Map(ls.map((x) => [x.kp, x])).values()) {
  const c = cardOf.get(l.kp);
  if (typeof c !== 'string') continue;
  const e = left.get(l.kp) ?? { line: l, people: 0, why: c };
  e.people++; left.set(l.kp, e);
}
const top = [...left.values()].sort((a, b) => b.people - a.people).slice(0, 20);
const leftLines = [...lines.values()].flat().filter((l) => typeof cardOf.get(l.kp) === 'string').length;
const uniqueAddedInBase = [...addedWorks.values()].filter((w) => inBase(w, keys)).length;

const out = [
  `# Неопознанное Кинопоиска → Wikidata (${new Date().toISOString().slice(0, 16)}, ${APPLY ? '--apply' : 'пробный прогон'})`, '',
  `- историй с неопознанным: ${lines.size}; строк: ${[...lines.values()].flat().length}; номеров Кинопоиска: ${allKp.length}`,
  `- нашлось в Wikidata: ${found.length} (по P31: фильм ${kinds['фильм']}, сериал ${kinds['сериал']}, прочее ${kinds['прочее']}); с TMDb-фильмом ${found.filter((k) => wd[k]!.tmdb).length}, с TMDb-сериалом ${found.filter((k) => wd[k]!.tmdbTv).length}, с IMDb ${found.filter((k) => wd[k]!.imdb).length}`,
  `- опознано до карточки: ${matchedKp.length} номеров (фильмов ${matchedKp.length - matchedSeries}, сериалов ${matchedSeries}); строк ${stat.linesMatched}`,
  `- в истории: просмотренного +${stat.watchedAdded} (уже было под другим номером ${stat.dupes}), оценок +${stat.ratingsAdded}; историй с опознанным ${stat.changed}${APPLY ? `, записано ${stat.written}` : ''}; из них без скачанных страниц (оценок не взять) ${stat.noPages}`,
  `- карточка есть в справочнике (filmBase*/seriesBase*, по tmdb/imdb/kp): добавленных записей ${stat.addedInBase} из ${stat.watchedAdded}, оценок ${stat.ratedInBase} из ${stat.ratingsAdded}; разных фильмов ${uniqueAddedInBase} из ${addedWorks.size}`,
  `- осталось неопознанным: ${left.size} номеров, ${leftLines} строк; почему: ${Object.entries(why).map(([k, v]) => `${k} ${v}`).join(', ')}`,
  ...(deferred.length ? [`- НЕ обработаны (так и пишутся): ${deferred.join(', ')}`] : []),
  '', '## Топ-20 неопознанного по числу людей', '', '| людей | название | год | вид | номер | почему |', '|---|---|---|---|---|---|',
  ...top.map((e) => `| ${e.people} | ${e.line.title} | ${e.line.year ?? ''} | ${e.line.type} | ${e.line.kp} | ${e.why} |`),
].join('\n');
writeFileSync(`${DIR}/report${APPLY ? '-apply' : ''}.md`, out + '\n');
console.log(out);
