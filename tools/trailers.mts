// Трейлеры заранее (17.10, владелец): раньше трейлер искался на клиенте в момент смахивания карточки ленты — прокси
// TMDb, русский, потом английский. Замер на 200 фильмах справочника: русский трейлер у 15 %, только английский у 42 %,
// ничего у 43 %, и всё это — ожиданием на глазах у человека. Теперь собираем ночью и отдаём с сервера
// (GET /api/trailers, worker/trailers.ts). Источники, по старшинству:
//   • own  — подобранные владельцем (src/mocks/trailersOwn.ts), главнее всех;
//   • ch   — ролики каналов прокатчиков (.cache/trailers-channels.json, пишет tools/trailers-channels.mts);
//   • tmdb — /videos одним запросом на работу (`include_video_language=ru,en,null`: русские, английские и без языка
//            разом — проверено 17.10 на «Начале», «Интерстелларе», «Игре престолов»); официальный выше;
//   • wd   — Wikidata: YouTube (P1651) с ролью «трейлер» (P3831 = Q622550) у фильмов (P4947) и сериалов (P4983);
//            у фильма без TMDb (ключ `wd:Q…`, 18.10) — по самому элементу, и это его единственный источник, кроме своих.
// Ролики проверяет YouTube Data API (videos.list, по 50 за единицу квоты): удалённые, закрытые, не встраиваемые и
// с возрастным ограничением — прочь; закрытые в России — `ru: 0` (годятся не-русским зрителям). Проверка — ротацией:
// новые сразу, известные — седьмая часть за ночь (tools/trailers-lib.mts, dueForCheck).
// Итог — .cache/trailers.json `{ at, works: { 'tmdb:<n>' | 'tv:<n>' | 'imdb:tt<n>' (сериал, двойник tv:) | 'wd:Q<n>' (фильм без TMDb): TrailerItem[] } }`, не больше четырёх роликов на
// работу (лучший трейлер и тизер по-русски и по-английски); `[]` — проверено, роликов нет; ключа нет — не проверено.
// Публикует tools/publish-reference.mts (справочник `trailers`).
//   npx tsx tools/trailers.mts [--minutes 15] [--limit N] [--shuffle] [--fresh] [--yt-calls 600] [--dry]
// Кэш — .cache/trailers/: tmdb.json (ответ TMDb по работе: перепрос через 60 дней, у фильмов этого и прошлого года —
// через 7: трейлеры выходят до премьеры), youtube.json (проверка роликов), wd-*.json (Wikidata раз в 7 дней; wd-qid.json —
// по элементам фильмов без TMDb, каждый элемент раз в 7 дней).
// Первый полный прогон — ~46 тыс. работ (42 тыс. фильмов и 4,8 тыс. сериалов), TMDb отвечает ~20 работ в секунду: идёт
// частями — по 15 минут за ночь (~15 тыс. работ, три ночи), или одним ручным `--minutes 60 --yt-calls 2000` (~45 минут).
// Проверенное не теряется: кэш пишется каждые 500 ответов.
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { loadEnvFile } from './env-file.mts';
import { idsOf, worksIndex } from './works-index.mts';
import { sparql } from './wikidata-lib.mts';
import { trailersOwn } from '../src/mocks/trailersOwn.ts';
import { isSeries } from '../src/lib/media.ts';
import {
  applyMeta, dueForCheck, fromTmdb, isSeriesKey, lang2, pickTrailers, toCheck, VIDEO_KEY, videoMeta, wdTrailerQuery, wdTrailerRows,
  type Candidate, type TmdbVideo, type VideoMeta, type YtVideo,
} from './trailers-lib.mts';
import type { TrailerItem, TrailersFile } from '../worker/trailers.ts';

loadEnvFile();
const argv = process.argv.slice(2);
const arg = (k: string) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
const MINUTES = Number(arg('--minutes')) || 15;
const LIMIT = Number(arg('--limit')) || Infinity;
const YT_CALLS = Number(arg('--yt-calls')) || 600;   // 600 единиц из 10 000 в сутки: остальное — разборам и классике
const FRESH = argv.includes('--fresh');
const SHUFFLE = argv.includes('--shuffle');          // случайная выборка для замера, а не голова справочника
const DRY = argv.includes('--dry');
const tmdbKey = process.env.TMDB_API_KEY ?? process.env.VITE_TMDB_API_KEY;
const ytKey = process.env.YT_API_KEY;
if (!tmdbKey) { console.error('нужен TMDB_API_KEY (или VITE_TMDB_API_KEY) в .env.local'); process.exit(2); }

const DIR = '.cache/trailers';
const TMDB = `${DIR}/tmdb.json`;
const YT = `${DIR}/youtube.json`;
const CHANNELS = '.cache/trailers-channels.json';
const OUT = '.cache/trailers.json';
mkdirSync(DIR, { recursive: true });
const day = 86400e3;
const started = Date.now();
const deadline = started + MINUTES * 60e3;
// на проверку YouTube и запись итога — последние две минуты предела (а на коротком пределе — пятая часть)
const tmdbDeadline = deadline - Math.min(2 * 60e3, MINUTES * 12e3);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Запрос вместе с чтением ответа — под обычным таймером (17.10): таймер AbortSignal.timeout не держит процесс, и при
 *  повисшем ответе Node выходил посреди сбора («unsettled top-level await»), не записав справочник. Обрыв — undefined. */
type Got = { status: number; ok: boolean; retryAfter: number; body?: unknown };
function getJson(url: string, init: RequestInit, ms: number): Promise<Got | undefined> {
  const ctrl = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const limit = new Promise<undefined>((done) => { timer = setTimeout(() => { ctrl.abort(); done(undefined); }, ms); });
  const work = (async (): Promise<Got> => {
    const r = await fetch(url, { ...init, signal: ctrl.signal });
    const body = r.ok ? await r.json() : undefined;
    return { status: r.status, ok: r.ok, retryAfter: Number(r.headers.get('retry-after') ?? 0), body };
  })().catch(() => undefined);
  return Promise.race([work, limit]).finally(() => clearTimeout(timer));
}
/** Запись через временный файл: шаг снимают по пределу времени (SIGKILL), недописанный JSON сломал бы следующую ночь. */
const save = (file: string, data: unknown) => {
  if (DRY) return;
  writeFileSync(`${file}.${process.pid}.tmp`, JSON.stringify(data));
  renameSync(`${file}.${process.pid}.tmp`, file);
};
const load = <T,>(file: string, fallback: T): T => {
  try { return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) as T : fallback; } catch { return fallback; }
};

// ─── какие работы ─────────────────────────────────────────────────────────────
// фильм — `tmdb:<n>` (ключ справочника); сериал — `tv:<n>`: номер /tv/ из кэша сезонов (tools/series-seasons.mts,
// IMDb → TMDb), как у tools/watch-providers.mts, — у сериала в справочнике ключ `imdb:`, а номера TMDb фильмов и
// сериалов пересекаются
const seasonsRaw = load<Record<string, { tv?: number | null }>>('.cache/series-seasons/raw.json', {});
const thisYear = new Date().getFullYear();
interface Job { key: string; path: string; year?: number }
const jobs = new Map<string, Job>();
// сериал на клиенте знает только IMDb (номера /tv/ у карточки нет, 17.10) — в справочник он же ключом-двойником
const seriesAlias = new Map<string, string>();
/** фильмы без TMDb — элементы Wikidata (ключ `wd:Q…`, 18.10) */
const wdFilms = new Set<string>();
for (const w of worksIndex({ all: true })) {
  if (w.work.type === 'book') continue;
  if (isSeries(w.work)) {
    const tv = (w.key.startsWith('imdb:') ? seasonsRaw[w.key.slice(5)]?.tv : undefined) ?? idsOf(w.work)?.tmdb;
    if (tv && Number(tv) > 0 && !jobs.has(`tv:${tv}`)) jobs.set(`tv:${tv}`, { key: `tv:${tv}`, path: `tv/${tv}/videos`, year: w.work.year });
    if (tv && Number(tv) > 0 && /^imdb:tt\d+$/.test(w.key)) seriesAlias.set(w.key, `tv:${tv}`);
  } else if (/^tmdb:\d+$/.test(w.key) && !jobs.has(w.key)) {
    jobs.set(w.key, { key: w.key, path: `movie/${w.key.slice(5)}/videos`, year: w.work.year });
  } else if (/^wd:Q\d+$/.test(w.key)) {
    // фильм без TMDb (18.10): TMDb спрашивать не о чем — только Wikidata по элементу
    wdFilms.add(w.key.slice(3));
  }
}

// ─── TMDb ─────────────────────────────────────────────────────────────────────
type TmdbEntry = { at: string; v: Candidate[] };
const tmdb = load<Record<string, TmdbEntry>>(TMDB, {});
const tmdbAge = (j: Job) => ((j.year ?? 0) >= thisYear - 1 ? 7 : 60) * day;
const stale = (j: Job) => FRESH || !tmdb[j.key] || Date.now() - Date.parse(tmdb[j.key].at) > tmdbAge(j);
// новые — первыми (в порядке справочника: каталог и история раньше хвоста), потом давно проверенные
let todo = [...jobs.values()].filter(stale)
  .sort((a, b) => Number(Boolean(tmdb[a.key])) - Number(Boolean(tmdb[b.key])) || (tmdb[a.key]?.at ?? '').localeCompare(tmdb[b.key]?.at ?? ''));
if (SHUFFLE) for (let i = todo.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [todo[i], todo[j]] = [todo[j], todo[i]]; }
todo = todo.slice(0, LIMIT);
const nSeries = [...jobs.keys()].filter((k) => k.startsWith('tv:')).length;
console.error(`работ с TMDb: ${jobs.size} (фильмов ${jobs.size - nSeries}, сериалов ${nSeries}), проверено раньше ${[...jobs.keys()].filter((k) => tmdb[k]).length}, к запросу ${todo.length}`);

const bearer = tmdbKey.includes('.');
/** Ответ TMDb: 404 — работы нет (проверено, роликов нет), 429/5xx и обрыв — повтор, остальное — ошибка. */
async function tmdbGet(path: string): Promise<{ results?: TmdbVideo[] } | null> {
  const qs = new URLSearchParams({ include_video_language: 'ru,en,null', ...(bearer ? {} : { api_key: tmdbKey! }) });
  for (let attempt = 0; ; attempt++) {
    const r = await getJson(`https://api.themoviedb.org/3/${path}?${qs}`,
      bearer ? { headers: { Authorization: `Bearer ${tmdbKey}` } } : {}, 15000);
    if (r?.ok) return r.body as { results?: TmdbVideo[] };
    if (r?.status === 404) return null;
    if (r && r.status !== 429 && r.status < 500) throw new Error(`tmdb ${r.status}`);
    if (attempt >= 3) throw new Error(`tmdb ${r?.status ?? 'нет ответа'}`);
    await sleep(Math.max((r?.retryAfter ?? 0) * 1000, 1000 * 2 ** attempt));
  }
}

let asked = 0, failed = 0, fatal = '';
const askedKeys = new Set<string>();
const queue = [...todo];
// восемь сразу: у TMDb потолок около 40–50 запросов в секунду, ответ — 0,2–0,4 с
await Promise.all(Array.from({ length: 8 }, async () => {
  for (let j = queue.shift(); j; j = queue.shift()) {
    if (Date.now() > tmdbDeadline || failed > 50 || fatal) return;
    try {
      const res = await tmdbGet(j.path);
      tmdb[j.key] = { at: new Date().toISOString(), v: (res?.results ?? []).map(fromTmdb).filter((c): c is Candidate => Boolean(c)) };
      askedKeys.add(j.key);
      asked += 1;
      if (asked % 500 === 0) { save(TMDB, tmdb); console.error(`  TMDb ${asked}/${todo.length}`); }
    } catch (e) {
      failed += 1;
      const msg = (e as Error).message;
      if (/tmdb 40[13]/.test(msg)) fatal = msg;   // ключ не принят — дальше спрашивать бессмысленно
      console.error(`  ${j.key}: ${msg}`);
    }
  }
}));
save(TMDB, tmdb);
if (fatal) console.error(`TMDb: ${fatal} — запросы остановлены`);
const left = todo.length - asked - failed;
console.error(`TMDb: спрошено ${asked}, ошибок ${failed}${left > 0 ? `, не успели ${left} (предел ${MINUTES} мин) — продолжим в следующий раз` : ''}`);

// ─── Wikidata ─────────────────────────────────────────────────────────────────
// язык ролика — квалификатор «язык» (P407) с кодом ISO 639-1 (P218); у большинства его нет — язык тогда скажет YouTube
type WdRow = { key: string; k: string; l: string };
const WD_QUERY = (prop: string) => `SELECT ?tmdb ?x ?code WHERE { ?f wdt:${prop} ?tmdb ; p:P1651 ?st . ?st ps:P1651 ?x ; pq:P3831 wd:Q622550 .
  OPTIONAL { ?st pq:P407 ?lq . ?lq wdt:P218 ?code } }`;
async function wikidata(kind: 'film' | 'tv'): Promise<WdRow[]> {
  const file = `${DIR}/wd-${kind}.json`;
  const old = load<WdRow[] | undefined>(file, undefined);
  if (old && !FRESH && Date.now() - statSync(file).mtimeMs < 7 * day) return old;
  try {
    const j = await sparql<{ results: { bindings: Record<string, { value: string }>[] } }>(WD_QUERY(kind === 'film' ? 'P4947' : 'P4983'));
    const rows = j.results.bindings
      .filter((b) => /^\d{1,8}$/.test(b.tmdb?.value ?? '') && VIDEO_KEY.test(b.x?.value ?? ''))
      .map((b) => ({ key: `${kind === 'film' ? 'tmdb' : 'tv'}:${b.tmdb.value}`, k: b.x.value, l: lang2(b.code?.value) }));
    save(file, rows);
    return rows;
  } catch (e) {
    console.error(`Wikidata (${kind}): ${(e as Error).message} — ${old ? 'берём прошлый ответ' : 'без Wikidata'}`);
    return old ?? [];
  }
}
const wdRows = [...await wikidata('film'), ...await wikidata('tv')];
// фильмы без TMDb (18.10): по элементу, пачками по 300; ответ по каждому элементу живёт 7 дней
type WdQid = Record<string, { at: string; v: { k: string; l: string }[] }>;
const WD_QID_FILE = `${DIR}/wd-qid.json`;
const wdQid = load<WdQid>(WD_QID_FILE, {});
const wdAsk = [...wdFilms].filter((q) => FRESH || !wdQid[q] || Date.now() - Date.parse(wdQid[q].at) > 7 * day);
for (let i = 0; i < wdAsk.length; i += 300) {
  const part = wdAsk.slice(i, i + 300);
  try {
    const j = await sparql<{ results: { bindings: Record<string, { value: string }>[] } }>(wdTrailerQuery(part));
    const at = new Date().toISOString();
    for (const [q, v] of Object.entries(wdTrailerRows(part, j.results.bindings))) wdQid[q] = { at, v };
  } catch (e) {
    console.error(`Wikidata (фильмы без TMDb, пачка ${i / 300 + 1}): ${(e as Error).message} — ${part.some((q) => wdQid[q]) ? 'берём прошлый ответ' : 'не проверены'}`);
  }
  await sleep(1000);
}
save(WD_QID_FILE, wdQid);
for (const q of wdFilms) for (const r of wdQid[q]?.v ?? []) wdRows.push({ key: `wd:${q}`, k: r.k, l: r.l });
if (wdFilms.size) console.error(`фильмов без TMDb: ${wdFilms.size}, спрошено в Wikidata ${wdAsk.length}, с трейлером ${[...wdFilms].filter((q) => wdQid[q]?.v.length).length}`);
const wdBy = new Map<string, Candidate[]>();
for (const r of wdRows) {
  if (!jobs.has(r.key) && !(r.key.startsWith('wd:') && wdFilms.has(r.key.slice(3)))) continue;
  const list = wdBy.get(r.key) ?? wdBy.set(r.key, []).get(r.key)!;
  if (!list.some((c) => c.k === r.k)) list.push({ k: r.k, l: r.l, t: 'T', s: 'wd' });
}

// ─── каналы прокатчиков и свои ────────────────────────────────────────────────
// файл каналов пишет tools/trailers-channels.mts: `{ at, works: { key: { k, l, t, n, ch }[] } }`; нет файла — без них
type ChItem = { k?: unknown; l?: unknown; t?: unknown; n?: unknown; ch?: unknown };
const channels = load<{ works?: Record<string, ChItem[]> }>(CHANNELS, {}).works ?? {};
const chBy = new Map<string, Candidate[]>();
for (const [key, list] of Object.entries(channels)) {
  if (!Array.isArray(list)) continue;
  const ok = list.filter((x) => typeof x.k === 'string' && VIDEO_KEY.test(x.k))
    .map((x): Candidate => ({ k: x.k as string, l: lang2(typeof x.l === 'string' ? x.l : ''), t: x.t === 'S' ? 'S' : 'T', s: 'ch', ...(typeof x.n === 'string' && x.n ? { n: x.n.slice(0, 120) } : {}) }));
  if (ok.length) chBy.set(key, ok);
}
const ownBy = new Map<string, Candidate[]>();
for (const [key, x] of Object.entries(trailersOwn)) if (VIDEO_KEY.test(x.key)) ownBy.set(key, [{ k: x.key, l: lang2(x.lang), t: 'T', s: 'own', n: x.name }]);

// в справочник — проверенные в TMDb и свои: работа без ответа TMDb — «не проверена», клиент спросит TMDb сам; фильм без
// TMDb — проверенный в Wikidata (`[]` — трейлера нет: клиенту больше спросить негде)
const outKeys = [...jobs.keys(), ...[...wdFilms].map((q) => `wd:${q}`)].filter((k) => tmdb[k] || ownBy.has(k) || (k.startsWith('wd:') && wdQid[k.slice(3)]));
const candidates = new Map<string, Candidate[]>();
// сериал (18.10): первый сезон или общий — раньше поздних сезонов (trailers-lib.mts, seasonRank)
for (const k of outKeys) candidates.set(k, toCheck([...(ownBy.get(k) ?? []), ...(chBy.get(k) ?? []), ...(tmdb[k]?.v ?? []), ...(wdBy.get(k) ?? [])], isSeriesKey(k)));

// ─── YouTube: живой, встраивается, открыт ли в России ─────────────────────────
const meta = load<Record<string, VideoMeta>>(YT, {});
const ids = [...new Set([...candidates.values()].flatMap((l) => l.map((c) => c.k)))];
// новые — вперёд: им проверка нужнее, чем очередной обход известных
const due = ids.filter((id) => FRESH || dueForCheck(id, meta[id])).sort((a, b) => Number(Boolean(meta[a])) - Number(Boolean(meta[b])));
let ytCalls = 0, ytChecked = 0;
if (due.length && !ytKey) console.error(`нет YT_API_KEY — ${due.length} роликов не проверено, берём как есть`);
for (let i = 0; ytKey && i < due.length && ytCalls < YT_CALLS && Date.now() < deadline - 30e3; i += 50) {
  const part = due.slice(i, i + 50);
  let r: Got | undefined;
  for (let attempt = 0; attempt < 3; attempt++) {
    r = await getJson(`https://www.googleapis.com/youtube/v3/videos?${new URLSearchParams({ part: 'status,contentDetails,snippet', id: part.join(','), key: ytKey, maxResults: '50' })}`,
      {}, 20000);
    if (r?.ok || (r && r.status < 500 && r.status !== 429)) break;
    await sleep(2000 * 2 ** attempt);
  }
  ytCalls += 1;
  if (!r?.ok) { console.error(`  youtube ${r?.status ?? 'нет ответа'}${r?.status === 403 ? ' (квота?)' : ''} — проверка остановлена`); break; }
  const j = r.body as { items?: YtVideo[] };
  const at = new Date().toISOString();
  // кого нет в ответе — удалён или закрыт
  for (const id of part) meta[id] = { at, ok: 0 };
  for (const v of j.items ?? []) meta[v.id] = videoMeta(v, at);
  ytChecked += part.length;
  if (ytCalls % 50 === 0) save(YT, meta);
}
save(YT, meta);
const unchecked = ids.filter((id) => !meta[id]).length;
console.error(`YouTube: роликов ${ids.length}, к проверке ${due.length}, проверено ${ytChecked} (${ytCalls} ед. квоты)${unchecked ? `, ни разу не проверено ${unchecked}` : ''}`);

// ─── справочник ───────────────────────────────────────────────────────────────
const works: Record<string, TrailerItem[]> = {};
for (const [k, list] of candidates) works[k] = pickTrailers(applyMeta(list, meta), isSeriesKey(k));
const aliases = Object.fromEntries([...seriesAlias].filter(([, tv]) => works[tv]).map(([imdb, tv]) => [imdb, works[tv]]));
const out: TrailersFile = { at: new Date().toISOString(), works: { ...works, ...aliases } };
save(OUT, out);

const playsRu = (l: TrailerItem[]) => l.some((x) => x.l === 'ru' && x.ru !== 0);
const stat = (keys: string[]) => {
  const ls = keys.map((k) => works[k]).filter(Boolean);
  const ru = ls.filter(playsRu).length;
  const en = ls.filter((l) => !playsRu(l) && l.some((x) => x.l === 'en')).length;
  const other = ls.filter((l) => l.length && !l.some((x) => x.l === 'ru' || x.l === 'en')).length;
  const none = ls.filter((l) => !l.length).length;
  const pc = (n: number) => `${ls.length ? Math.round((100 * n) / ls.length) : 0} %`;
  return `${ls.length} работ: русский ${ru} (${pc(ru)}), только английский ${en} (${pc(en)}), иной язык ${other} (${pc(other)}), ничего ${none} (${pc(none)})`;
};
const bySource = (s: TrailerItem['s']) => Object.values(works).filter((l) => l.some((x) => x.s === s)).length;
const blocked = Object.values(works).filter((l) => l.length && l.every((x) => x.ru === 0)).length;
if (askedKeys.size && askedKeys.size !== outKeys.length) console.log(`этот прогон — ${stat([...askedKeys])}`);
console.log(`источники: свои ${bySource('own')}, каналы ${bySource('ch')}, TMDb ${bySource('tmdb')}, Wikidata ${bySource('wd')}; все ролики закрыты в России — у ${blocked}`);
console.log(`трейлеры: проверено ${outKeys.length} из ${jobs.size + wdFilms.size}; ${stat(outKeys)}; ${Math.round((Date.now() - started) / 1000)} с`);
