// Бесплатная легальная классика (ЗП-43, 10.10): где фильм выложен целиком и законно — ссылкой на источник, мы
// ничего не храним. Источники — свойства Wikidata у фильмов с ключом TMDb, а у фильмов без него (ключ `wd:Q…`, решение
// владельца 17.10; 18.10) — те же свойства прямо по элементу:
//   • YouTube (P1651) — только каналы правообладателей (OFFICIAL ниже): студии, Госфильмофонд, лицензиат RVISION,
//     архивы и студии других стран; плюс ролики этих каналов, опознанные tools/grow-from-channels.mts.
//     Ролик проверяется YouTube API: жив, публичный, длиннее 40 минут (не трейлер и не отрывок), не закрыт в России.
//     Перезаливщики («Классика жанра», «Кинематограф СССР»…) не берутся, даже если ролик целый;
//   • Wikimedia Commons (P10) с ролью «полное видео» (Q89347362) — там только свободные лицензии;
//   • Internet Archive (P724) — только с пометкой «общественное достояние» (P6216 = Q19652).
// Приложение по этому справочнику (`freeWatch`) ставит в ленту полку «Бесплатно: классика» и кнопку
// «Смотреть бесплатно» с источником.
//   npx tsx tools/free-watch.mts [--dry]
// Кэш — .cache/free-watch/ (ответы Wikidata раз в 7 дней, сведения о роликах раз в 14), итог — .cache/free-watch.json.
// Сайты «Мосфильма» и Rutube/VK Видео с иностранного адреса не открываются (ЗП-8) — зеркала добавим оттуда.
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { loadEnvFile } from './env-file.mts';
import { worksIndex } from './works-index.mts';

loadEnvFile();
const DRY = process.argv.includes('--dry');
const ytKey = process.env.YT_API_KEY;
const DIR = '.cache/free-watch';
const OUT = '.cache/free-watch.json';
mkdirSync(DIR, { recursive: true });
const day = 86400e3;

/** Каналы правообладателей: id канала → как назвать источник у фильма. Новый канал — сюда, после проверки, что он
 *  официальный (студия, фильмофонд, прокатчик с лицензией), а не перезаливщик. Канал ФБК не берём: в России
 *  организация признана экстремистской, ссылки на её материалы — риск для приложения и людей. */
const OFFICIAL: Record<string, string> = {
  'UCEK3tT7DcfWGWJpNEDBdWog': 'Мосфильм', 'UCC2mTjSz2Hohl3zDBTCqF1Q': 'Мосфильм', 'UCm5U4zqpahzyNXBv5ZT51Jw': 'Мосфильм',
  'UCO4955GoiqlIB0yyybBx6KQ': 'Киностудия Горького', 'UCI0vmWwhBJL43NDhGyLiT4Q': 'Госфильмофонд России',
  'UCxh_TkSralaVxmsLNYCXeoQ': 'Одесская киностудия', 'UC4NbKSNLUi9C1h-eA3xwRCw': 'Беларусьфильм',
  'UCRHoFkwx_6WG4hGU6_aPysQ': 'Кыргызфильм', 'UC3JWIAd7Yuanzzfv0WSB84Q': 'Казахфильм',
  'UC6FwzVftf5AQrXYhQ5FdzRA': 'RVISION', 'UCTKpdDNg-FgqRDg7TbIOgoQ': 'RVISION', 'UC2PfZn5S_Qd_O62u44juiIA': 'RVISION',
  'UCak7m0ywMcCDUYDgqdNA7zA': 'Свердловская киностудия (RVISION)', 'UCVXEfYCFdyQ9nkoNJY-uYWA': 'Мельница',
  'UCqkV9XN8eN32zED6oQ4rOSQ': 'СТВ', 'UC-qQJ-PiW3wfNhfxL0tQD9Q': 'Пятый канал', 'UCBOmfqgTZi7yDp4-3Lr_3lA': 'Shemaroo',
  // правообладатели и архивы других стран и бывшего СССР (владелец, 11.10)
  'UCvH6u_Qzn5RQdz9W198umDw': 'Корейский киноархив', 'UClAEnyvAkPzPjnHZPVgv7zQ': 'SF Studios', 'UCEKWXRsfUHkan-D_ljU8Asw': 'Rajshri',
  'UCqn5zYxHQqHpLC3qGXfIjJg': 'Ultra', 'UCJm60FFiYSH2mJONr6vnV_A': 'Toei', 'UCQYYekTKCb1y12sas08T6gQ': 'Toei Animation',
  'UCUXc-JwLAU7ktxtLsJNnwqA': 'Toei', 'UCDfCiE-3C9jLNk7p-WeW4-w': 'Shaw Brothers', 'UCF4K73aOl0zLKtI_5kYRxwQ': 'ARTE',
  'UClo03hULFynpoX3w1Jv7fhw': 'ARTE', 'UC8mnCoCi6eTQN0t8zapHYrA': 'STUDIOCANAL', 'UCqtTk35tEY4EyJGq7bOUGEQ': 'Azərbaycanfilm',
  'UC8fYVDv7o80fhX3Jat9uB7A': 'Национальный киноцентр Армении', 'UCEnrVkHgwvoVlkcQmBKR2_Q': 'Довженко-Центр',
  'UCkuTggETs84-JTFuTTZe-Zw': 'Довженко-Центр', 'UCHS2LM1n3f5cyL-ebgkqyLw': 'Союзмультфильм',
};
/** Каналы, где фильм выложен на время (Toei: кинотеатр — две недели, самурайское кино — по расписанию): их ролики
 *  перепроверяем раз в двое суток, а не в 14, — иначе кнопка ведёт на снятый ролик. */
const SHORT_LIVED = new Set(['UCJm60FFiYSH2mJONr6vnV_A', 'UCUXc-JwLAU7ktxtLsJNnwqA']);
const metaAge = (m: { at: string; ch?: string }) => (m.ch && SHORT_LIVED.has(m.ch) ? 2 : 14) * day;
const MIN_SECONDS = 40 * 60;

// ─── Wikidata ─────────────────────────────────────────────────────────────────
const QUERIES = {
  youtube: 'SELECT ?tmdb ?x ?role WHERE { ?f wdt:P4947 ?tmdb ; p:P1651 ?st . ?st ps:P1651 ?x . OPTIONAL { ?st pq:P3831 ?role } }',
  commons: 'SELECT ?tmdb ?x ?role WHERE { ?f wdt:P4947 ?tmdb ; p:P10 ?st . ?st ps:P10 ?x . OPTIONAL { ?st pq:P3831 ?role } }',
  archive: 'SELECT ?tmdb ?x ?role WHERE { ?f wdt:P4947 ?tmdb ; wdt:P724 ?x . OPTIONAL { ?f wdt:P6216 ?role } }',
};
type Row = { tmdb: string; x: string; role?: string };
async function sparql(name: keyof typeof QUERIES): Promise<Row[]> {
  const file = `${DIR}/wd-${name}.json`;
  if (existsSync(file) && Date.now() - statSync(file).mtimeMs < 7 * day) return JSON.parse(readFileSync(file, 'utf8')) as Row[];
  const url = `https://query.wikidata.org/sparql?${new URLSearchParams({ query: QUERIES[name] })}`;
  const r = await fetch(url, { headers: { accept: 'application/sparql-results+json', 'user-agent': 'recomend/1.0 (free-watch)' } });
  if (!r.ok) throw new Error(`wikidata ${name}: ${r.status}`);
  const j = await r.json() as { results: { bindings: Record<string, { value: string }>[] } };
  const rows = j.results.bindings.map((b) => ({ tmdb: b.tmdb.value, x: b.x.value, ...(b.role ? { role: b.role.value.replace(/^.*\//, '') } : {}) }));
  if (!DRY) writeFileSync(file, JSON.stringify(rows));
  return rows;
}

// фильм — ключом справочника: `tmdb:<n>`, без TMDb — `wd:Q…` (18.10)
const filmKey = (k: string) => /^(?:tmdb:\d+|wd:Q\d+)$/.test(k);
const ours = new Set(worksIndex({ all: true }).filter((w) => w.work.type === 'film' && filmKey(w.key)).map((w) => w.key));
type KeyRow = { key: string; x: string; role?: string };
const keyed = (rows: Row[]): KeyRow[] => rows.map((r) => ({ key: `tmdb:${r.tmdb}`, x: r.x, ...(r.role ? { role: r.role } : {}) }));

// фильмы без TMDb (18.10): общие запросы идут через P4947 и их не видят — те же свойства по элементам, пачками по 300;
// ответ по элементу живёт 7 дней (.cache/free-watch/wd-qid-<вид>.json)
const QID_QUERIES = {
  youtube: (v: string) => `SELECT ?f ?x ?role WHERE { VALUES ?f { ${v} } ?f p:P1651 ?st . ?st ps:P1651 ?x . OPTIONAL { ?st pq:P3831 ?role } }`,
  commons: (v: string) => `SELECT ?f ?x ?role WHERE { VALUES ?f { ${v} } ?f p:P10 ?st . ?st ps:P10 ?x . OPTIONAL { ?st pq:P3831 ?role } }`,
  archive: (v: string) => `SELECT ?f ?x ?role WHERE { VALUES ?f { ${v} } ?f wdt:P724 ?x . OPTIONAL { ?f wdt:P6216 ?role } }`,
};
async function sparqlQids(name: keyof typeof QID_QUERIES, qids: string[]): Promise<KeyRow[]> {
  const file = `${DIR}/wd-qid-${name}.json`;
  const cache: Record<string, { at: string; rows: { x: string; role?: string }[] }> = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
  const ask = qids.filter((q) => !cache[q] || Date.now() - Date.parse(cache[q].at) > 7 * day);
  for (let i = 0; i < ask.length; i += 300) {
    const part = ask.slice(i, i + 300);
    const url = `https://query.wikidata.org/sparql?${new URLSearchParams({ query: QID_QUERIES[name](part.map((q) => `wd:${q}`).join(' ')) })}`;
    const r = await fetch(url, { headers: { accept: 'application/sparql-results+json', 'user-agent': 'recomend/1.0 (free-watch)' } }).catch(() => undefined);
    if (!r?.ok) { console.error(`  wikidata ${name} (без TMDb): ${r?.status ?? 'нет ответа'}`); continue; }
    const j = await r.json() as { results: { bindings: Record<string, { value: string }>[] } };
    const at = new Date().toISOString();
    for (const q of part) cache[q] = { at, rows: [] };
    for (const b of j.results.bindings) {
      const q = b.f.value.replace(/^.*\//, '');
      cache[q]?.rows.push({ x: b.x.value, ...(b.role ? { role: b.role.value.replace(/^.*\//, '') } : {}) });
    }
  }
  if (!DRY) writeFileSync(file, JSON.stringify(cache));
  return qids.flatMap((q) => (cache[q]?.rows ?? []).map((r) => ({ key: `wd:${q}`, ...r })));
}
const wdQids = [...ours].filter((k) => k.startsWith('wd:')).map((k) => k.slice(3));
const [yt, commons, archive] = await Promise.all((['youtube', 'commons', 'archive'] as const)
  .map(async (n) => [...keyed(await sparql(n)), ...(wdQids.length ? await sparqlQids(n, wdQids) : [])]));

/** Источник у фильма: n — кто выложил, u — ссылка, v — вид источника. */
type Free = { n: string; u: string; v: 'studio' | 'commons' | 'archive'; part?: number };
const works: Record<string, Free[]> = {};
const add = (key: string, f: Free) => { const list = (works[key] ??= []); if (!list.some((x) => x.u === f.u)) list.push(f); };

// ─── YouTube: правообладатели, целый фильм, открыт в России ──────────────────
type Meta = { at: string; d?: number; ch?: string; st?: string; ru?: boolean; t?: string } | { at: string; gone: true };
const META = `${DIR}/youtube.json`;
const meta: Record<string, Meta> = existsSync(META) ? JSON.parse(readFileSync(META, 'utf8')) : {};
const ytRows = yt.filter((r) => ours.has(r.key) && r.role !== 'Q622550');   // Q622550 — трейлер
const ids = [...new Set(ytRows.map((r) => r.x))];
const stale = ids.filter((id) => !meta[id] || Date.now() - Date.parse(meta[id].at) > metaAge(meta[id]));
const seconds = (d?: string) => { const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(d ?? ''); return m ? Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0) : 0; };
if (stale.length && !ytKey) console.error(`нет YT_API_KEY — ${stale.length} роликов не проверено, берём из кэша`);
for (let i = 0; ytKey && i < stale.length; i += 50) {
  const part = stale.slice(i, i + 50);
  const r = await fetch(`https://www.googleapis.com/youtube/v3/videos?${new URLSearchParams({ part: 'contentDetails,snippet,status', id: part.join(','), key: ytKey })}`);
  if (!r.ok) { console.error(`  youtube ${r.status}`); break; }
  const j = await r.json() as { items?: { id: string; contentDetails: { duration: string; regionRestriction?: { allowed?: string[]; blocked?: string[] } }; snippet: { channelId: string; title: string }; status: { privacyStatus: string } }[] };
  const at = new Date().toISOString();
  for (const id of part) meta[id] = { at, gone: true };
  for (const v of j.items ?? []) {
    const rr = v.contentDetails.regionRestriction;
    meta[v.id] = { at, d: seconds(v.contentDetails.duration), ch: v.snippet.channelId, st: v.status.privacyStatus, ru: !(rr?.blocked?.includes('RU') || (rr?.allowed && !rr.allowed.includes('RU'))), t: v.snippet.title };
  }
}
if (!DRY) writeFileSync(META, JSON.stringify(meta));
let ytOk = 0;
for (const r of ytRows) {
  const m = meta[r.x];
  if (!m || 'gone' in m || m.st !== 'public' || !m.ru || (m.d ?? 0) < MIN_SECONDS || !m.ch || !OFFICIAL[m.ch]) continue;
  // двухсерийный фильм — ролик на серию: первая серия вперёд («Жестокий романс. Серия 2» не должен открываться первым)
  const part = Number(/(?:серия|часть|series|part)\s*(\d)|(\d)\s*(?:-?я\s*)?(?:серия|часть)/iu.exec(m.t ?? '')?.slice(1).find(Boolean) ?? 0);
  add(r.key, { n: OFFICIAL[m.ch], u: `https://www.youtube.com/watch?v=${r.x}`, v: 'studio', ...(part ? { part } : {}) });
  ytOk += 1;
}

// ─── загрузки каналов правообладателей целиком (10.10): Wikidata знает не всё ──
// У «Мосфильма» (@MosfilmRuOfficial — тот же UCEK3tT7…) 1575 роликов, а ссылок из Wikidata — на ~440 фильмов.
// Заголовки у студий единообразные: «Женитьба Бальзаминова (FullHD, комедия, реж. …, 1964 г.)», «Живет такой парень
// (1964)», «Карнавал 1981 (2 серия) | Комедийный фильм» — название до скобки или черты, год — первый 19xx/20xx.
// Совпадение: название целиком (без регистра, «ё», кавычек и знаков) и год ±1, только фильмы.
const SCAN = ['UCEK3tT7DcfWGWJpNEDBdWog', 'UCC2mTjSz2Hohl3zDBTCqF1Q', 'UCO4955GoiqlIB0yyybBx6KQ', 'UCI0vmWwhBJL43NDhGyLiT4Q',
  'UC4NbKSNLUi9C1h-eA3xwRCw', 'UCxh_TkSralaVxmsLNYCXeoQ', 'UCRHoFkwx_6WG4hGU6_aPysQ', 'UC3JWIAd7Yuanzzfv0WSB84Q'];
const UPLOADS = `${DIR}/uploads.json`;
const uploads: Record<string, { at: string; ids: string[] }> = existsSync(UPLOADS) ? JSON.parse(readFileSync(UPLOADS, 'utf8')) : {};
for (const ch of SCAN) {
  if (!ytKey || (uploads[ch] && Date.now() - Date.parse(uploads[ch].at) < 7 * day)) continue;
  const ids: string[] = [];
  let page = '';
  do {
    const r = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?${new URLSearchParams({ part: 'contentDetails', playlistId: `UU${ch.slice(2)}`, maxResults: '50', key: ytKey, ...(page ? { pageToken: page } : {}) })}`);
    if (!r.ok) { console.error(`  загрузки ${OFFICIAL[ch]} ${r.status}`); break; }
    const j = await r.json() as { items?: { contentDetails: { videoId: string } }[]; nextPageToken?: string };
    ids.push(...(j.items ?? []).map((x) => x.contentDetails.videoId));
    page = j.nextPageToken ?? '';
  } while (page);
  uploads[ch] = { at: new Date().toISOString(), ids };
}
if (!DRY) writeFileSync(UPLOADS, JSON.stringify(uploads));
// и ролики, которые tools/grow-from-channels.mts уже сопоставил с фильмами (по режиссёру или году) — у каналов из OFFICIAL:
// там названия на корейском, японском, хинди, и разбор «название до скобки» здесь их не узнаёт (11.10)
const matched: Record<string, { tmdb: number; ch: string }> = existsSync('.cache/channel-films.videos.json')
  ? (JSON.parse(readFileSync('.cache/channel-films.videos.json', 'utf8')) as { videos: Record<string, { tmdb: number; ch: string }> }).videos : {};
const matchedIds = Object.keys(matched).filter((id) => OFFICIAL[matched[id].ch] && ours.has(`tmdb:${matched[id].tmdb}`));
const scanIds = [...new Set([...Object.values(uploads).flatMap((u) => u.ids), ...matchedIds])];
const scanStale = scanIds.filter((id) => !meta[id] || Date.now() - Date.parse(meta[id].at) > metaAge(meta[id]));
for (let i = 0; ytKey && i < scanStale.length; i += 50) {
  const part = scanStale.slice(i, i + 50);
  const r = await fetch(`https://www.googleapis.com/youtube/v3/videos?${new URLSearchParams({ part: 'contentDetails,snippet,status', id: part.join(','), key: ytKey })}`);
  if (!r.ok) { console.error(`  youtube ${r.status}`); break; }
  const j = await r.json() as { items?: { id: string; contentDetails: { duration: string; regionRestriction?: { allowed?: string[]; blocked?: string[] } }; snippet: { channelId: string; title: string }; status: { privacyStatus: string } }[] };
  const at = new Date().toISOString();
  for (const id of part) meta[id] = { at, gone: true };
  for (const v of j.items ?? []) {
    const rr = v.contentDetails.regionRestriction;
    meta[v.id] = { at, d: seconds(v.contentDetails.duration), ch: v.snippet.channelId, st: v.status.privacyStatus, ru: !(rr?.blocked?.includes('RU') || (rr?.allowed && !rr.allowed.includes('RU'))), t: v.snippet.title };
  }
}
if (!DRY) writeFileSync(META, JSON.stringify(meta));
const fold = (x: string) => x.toLowerCase().replace(/ё/g, 'е').replace(/[«»"“”„'’.,:;!?…—–-]+/g, ' ').replace(/\s+/g, ' ').trim();
const byName = new Map<string, { key: string; year: number }[]>();
for (const w of worksIndex({ all: true })) {
  if (w.work.type !== 'film' || !filmKey(w.key) || !w.work.year) continue;
  for (const n of new Set([w.work.title, ...w.names])) {
    const k = fold(n);
    const list = byName.get(k) ?? byName.set(k, []).get(k)!;
    if (!list.some((x) => x.key === w.key)) list.push({ key: w.key, year: w.work.year });
  }
}
let scanOk = 0;
for (const id of scanIds) {
  const m = meta[id];
  if (!m || 'gone' in m || m.st !== 'public' || !m.ru || (m.d ?? 0) < MIN_SECONDS || !m.ch || !OFFICIAL[m.ch] || !m.t) continue;
  if (matched[id]) {
    const part = Number(/(?:серия|часть|part)\s*(\d)|(\d)\s*(?:-?я\s*)?(?:серия|часть)/iu.exec(m.t)?.slice(1).find(Boolean) ?? 0);
    add(`tmdb:${matched[id].tmdb}`, { n: OFFICIAL[m.ch], u: `https://www.youtube.com/watch?v=${id}`, v: 'studio', ...(part ? { part } : {}) });
    scanOk += 1;
    continue;
  }
  const year = Number(/(?<!\d)(19[2-9]\d|20[0-2]\d)(?!\d)/.exec(m.t)?.[1] ?? 0);
  const name = m.t.split(/\s*[(|\[]/)[0].replace(/[.,]?\s*(?:\d\s*(?:-?я\s*)?серия|серия\s*\d|часть\s*\d|\d\s*часть)\s*$/iu, '').replace(/\s+(?:19|20)\d{2}\s*$/, '');
  if (!year || !name.trim()) continue;
  const hits = (byName.get(fold(name)) ?? []).filter((x) => Math.abs(x.year - year) <= 1);
  if (hits.length !== 1) continue;   // тёзки одного года — не гадаем
  const part = Number(/(?:серия|часть)\s*(\d)|(\d)\s*(?:-?я\s*)?(?:серия|часть)/iu.exec(m.t)?.slice(1).find(Boolean) ?? 0);
  add(hits[0].key, { n: OFFICIAL[m.ch], u: `https://www.youtube.com/watch?v=${id}`, v: 'studio', ...(part ? { part } : {}) });
  scanOk += 1;
}
console.error(`загрузки правообладателей: роликов ${scanIds.length}, сопоставлено ${scanOk}`);

// ─── Commons: полное видео; Internet Archive: общественное достояние ─────────
let cmOk = 0, iaOk = 0;
for (const r of commons) {
  if (!ours.has(r.key) || r.role !== 'Q89347362') continue;   // «полное видео на Викискладе»
  const file = decodeURIComponent(r.x.replace(/^.*Special:FilePath\//, ''));
  add(r.key, { n: 'Викисклад', u: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file.replace(/ /g, '_'))}`, v: 'commons' });
  cmOk += 1;
}
for (const r of archive) {
  if (!ours.has(r.key) || r.role !== 'Q19652') continue;   // общественное достояние
  add(r.key, { n: 'Internet Archive', u: `https://archive.org/details/${encodeURIComponent(r.x)}`, v: 'archive' });
  iaOk += 1;
}

// студия первой: с неё смотреть привычнее, она по-русски; потом Викисклад, потом архив
const order = { studio: 0, commons: 1, archive: 2 } as const;
for (const list of Object.values(works)) list.sort((a, b) => order[a.v] - order[b.v] || (a.part ?? 0) - (b.part ?? 0));
const out = { at: new Date().toISOString(), works };
const n = Object.keys(works).length;
const by = (v: Free['v']) => Object.values(works).filter((l) => l.some((f) => f.v === v)).length;
console.log(`бесплатно и легально: ${n} фильмов — правообладатели на YouTube ${by('studio')} (роликов ${ytOk}), Викисклад ${by('commons')}, Internet Archive ${by('archive')}`);
if (!DRY) writeFileSync(OUT, JSON.stringify(out));
