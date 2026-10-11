// Пополнение справочника из каналов, где лежат сами фильмы (10.10): киностудии, правообладатели,
// архивы и агрегаторы бесплатного кино. Их загрузки — готовый список произведений, даже когда ссылку
// на ролик мы не даём (лицензия агрегатора не проверена, ролик заблокирован в регионе, это трейлер).
//
//   npx tsx tools/grow-from-channels.mts [--write] [--fresh]
//
// Ролик → варианты названия (кавычки, сегменты между «//», «|», « - », хвост капсом после кликбейта),
// год из заголовка и режиссёр («реж.», «Режиссёр:», «Director:», «Directed by»). Опознание в Wikidata
// (CC0, решение владельца 23.09: новое — только оттуда), двумя путями:
//   · по режиссёру — название ищется в его фильмографии (P57), из тёзок — с годом ±1;
//   · по году — точная подпись ru/en (как есть, с заглавной, «Каждое Слово») и год ±1, единственный кандидат.
// Без режиссёра и года не опознаём: «Небо», «Отель», «Юрка» без них — обычные слова.
//
// Без --write — только замер (→ .cache/channel-films.json). С --write недостающее с ключом (TMDb у фильма,
// IMDb у сериала) пишется в src/mocks/filmBaseChannels.ts; прежние карточки остаются. Разметку дописывает
// черновик (tools/draft-annotate.mts). Ссылок на ролики здесь нет — их даёт tools/free-watch.mts по своим правилам.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { loadEnvFile } from './env-file.mts';
import { worksIndex, analysisKeys, idsOf } from './works-index.mts';
import type { WorkCard } from '../src/types/tmdf.ts';

loadEnvFile();
const argv = process.argv.slice(2);
const WRITE = argv.includes('--write');
const FRESH = argv.includes('--fresh');
const key = process.env.YT_API_KEY;
if (!key) { console.error('нужен YT_API_KEY в .env.local'); process.exit(2); }

/** Каналы с фильмами целиком. Агрегаторы PlayNetwork и зарубежные — только как список: права не проверены. */
const CHANNELS: Record<string, string> = {
  // студии и архивы (ссылки на них даёт free-watch.mts)
  'UCEK3tT7DcfWGWJpNEDBdWog': 'Мосфильм', 'UCO4955GoiqlIB0yyybBx6KQ': 'Киностудия Горького', 'UCqkV9XN8eN32zED6oQ4rOSQ': 'СТВ',
  'UC6FwzVftf5AQrXYhQ5FdzRA': 'RVISION', 'UCTKpdDNg-FgqRDg7TbIOgoQ': 'RVISION', 'UC2PfZn5S_Qd_O62u44juiIA': 'RVISION',
  'UCVXEfYCFdyQ9nkoNJY-uYWA': 'Мельница', 'UC-qQJ-PiW3wfNhfxL0tQD9Q': 'Пятый канал', 'UCI0vmWwhBJL43NDhGyLiT4Q': 'Госфильмофонд',
  'UC4NbKSNLUi9C1h-eA3xwRCw': 'Беларусьфильм', 'UCoSZkP0mVJd1S5GUGALzdnA': 'Централ Партнершип', 'UCVaMdsRR2bSvr6THJHRCkdQ': 'Central Partnership International',
  'UCK3AJaBVixx5BvCPLI2Ho9g': 'RWV Film', 'UCC2mTjSz2Hohl3zDBTCqF1Q': 'Мосфильм (детский)', 'UCm5U4zqpahzyNXBv5ZT51Jw': 'Мосфильм (детский)',
  'UCxh_TkSralaVxmsLNYCXeoQ': 'Одесская киностудия', 'UCak7m0ywMcCDUYDgqdNA7zA': 'Свердловская киностудия', 'UCRHoFkwx_6WG4hGU6_aPysQ': 'Кыргызфильм',
  'UC3JWIAd7Yuanzzfv0WSB84Q': 'Казахфильм', 'UCBOmfqgTZi7yDp4-3Lr_3lA': 'Shemaroo', 'UCHS2LM1n3f5cyL-ebgkqyLw': 'Союзмультфильм',
  'UCqtTk35tEY4EyJGq7bOUGEQ': 'Azərbaycanfilm', 'UC8fYVDv7o80fhX3Jat9uB7A': 'Национальный киноцентр Армении', 'UCEnrVkHgwvoVlkcQmBKR2_Q': 'Довженко-Центр',
  'UCkuTggETs84-JTFuTTZe-Zw': 'Ukrainian animation (Довженко-Центр)', 'UCUALYmnkEmx8vlxIbpr2gmw': 'Arzu Film', 'UCHumSHRFQ8skiHTY75sxytQ': 'Gülşah Film',
  // агрегаторы на русском (PlayNetwork и др.)
  'UCK1w3HDRsujJFu_6VWEXaig': 'Боевик TV', 'UCou5DjpAyhFQwJHs8E_OSOA': 'Хиты и Премьеры', 'UCWkCCLw3wfTfx2PB2u-soAw': 'Фильмотека',
  'UCZS0acoBRpNJV2Tmr_T3urQ': 'Огненный Рубеж', 'UCOU3h_6nBWtxtbWJo6ohmtw': 'Кинополе', 'UCOD2veMoMj5jy6K0pGt55Bw': 'FILMSTER',
  'UCdy4E9igBBGLe-RMA0f9UVQ': 'VideoLand',
  // зарубежные агрегаторы
  // правообладатели и архивы других стран (владелец, 10.10)
  'UCvH6u_Qzn5RQdz9W198umDw': 'Korean Classic Film (KOFA)', 'UClAEnyvAkPzPjnHZPVgv7zQ': 'SF Studios Classics', 'UCEKWXRsfUHkan-D_ljU8Asw': 'Rajshri',
  'UCqn5zYxHQqHpLC3qGXfIjJg': 'Ultra Indian Cinema', 'UCJm60FFiYSH2mJONr6vnV_A': 'Toei Jidaigeki', 'UCQYYekTKCb1y12sas08T6gQ': 'Toei Animation',
  'UCUXc-JwLAU7ktxtLsJNnwqA': 'Toei Theater Online', 'UCHjj-qlJhYWDacFwnaewV6Q': 'KADOKAWA映画', 'UCDfCiE-3C9jLNk7p-WeW4-w': 'Shaw Brothers Cinema',
  'UC3ar28GS6o1p0m_wabfk2zw': 'Pen Movies', 'UCyoXW-Dse7fURq30EWl_CUA': 'Goldmines', 'UCoZFpq-IbJ70KUzoorS09wQ': 'Uzbekkino (RizaNova)',
  'UCVFYikepF-avelvuIaQ_lHA': 'Popcornflix', 'UCpHaAKu74UHvcYCi2g_PvBQ': 'Shout! Studios', 'UCGhGr_hznZxISOI_kaLWpfw': 'China Movie Channel (CCTV-6)',
  // Франция и Германия: ARTE, StudioCanal — правообладатели; Boxoffice, Netzkino, Free Movies DE — агрегаторы
  'UCF4K73aOl0zLKtI_5kYRxwQ': 'ARTE Film', 'UClo03hULFynpoX3w1Jv7fhw': 'ARTE Cinéma', 'UC8mnCoCi6eTQN0t8zapHYrA': 'STUDIOCANAL Germany',
  'UCMQMViObVfaALDRtFnmUWgA': 'Allociné Films Complets', 'UCo4GrGKoYsBmlAQhXWgEU-w': 'Boxoffice Action FR', 'UCwP1wo41m_YaxpupmNfe9iA': 'Boxoffice 4K Full Movies',
  'UCQltP9CZKGug5kTf6cppVgg': 'Boxoffice Films Complets FR', 'UCSE5n4XCVfHmerDydpRymjA': 'Boxoffice 4K FR', 'UCGkHFrwE8KEuOHPVsIOskAg': 'Netzkino',
  'UCzEM7lABab3RcmVAZXbYhig': 'Free Movies Deutschland',
  'UCQIrvVPHrt2cN14ktGA2Snw': 'Cinéma Cinémas', 'UCIk43JAOwpgW5c33-QS82nw': 'CINDIE', 'UCycDFnpMeWzaITQSD1dWsOA': 'Cult Cinema Classics', 'UCGBzBkV-MinlBvHBzZawfLQ': 'Movie Central',
  'UCfaHLNTlxzrCGyOGfvyfbaQ': 'Free Movie Central', 'UCO_uaCblOdLFMmg2CZZkkUQ': 'Classic Movie Central', 'UC_MyK1SmeN2Sji4uBEckYaA': 'Disaster Zone Movies',
  'UC8IHAQMuiJdY6ALuhG7iU8Q': 'FilmRise Movies', 'UCE34fwgW7kWr7tc7YiOWtRw': 'PizzaFlix',
};

/** Язык названий канала: название ищется и в подписи этого языка, если письменность не даёт его сама
 *  («Le Jour se lève» — французская подпись, английская — «Daybreak»; украинская и казахская — не русская). */
const CH_LANG: Record<string, string> = {
  'UCF4K73aOl0zLKtI_5kYRxwQ': 'de', 'UC8mnCoCi6eTQN0t8zapHYrA': 'de', 'UCGkHFrwE8KEuOHPVsIOskAg': 'de', 'UCzEM7lABab3RcmVAZXbYhig': 'de',
  'UClo03hULFynpoX3w1Jv7fhw': 'fr', 'UCMQMViObVfaALDRtFnmUWgA': 'fr', 'UCo4GrGKoYsBmlAQhXWgEU-w': 'fr', 'UCQltP9CZKGug5kTf6cppVgg': 'fr',
  'UCSE5n4XCVfHmerDydpRymjA': 'fr', 'UCQIrvVPHrt2cN14ktGA2Snw': 'fr', 'UCIk43JAOwpgW5c33-QS82nw': 'es', 'UClAEnyvAkPzPjnHZPVgv7zQ': 'sv',
  'UCEKWXRsfUHkan-D_ljU8Asw': 'hi', 'UCqn5zYxHQqHpLC3qGXfIjJg': 'hi', 'UCBOmfqgTZi7yDp4-3Lr_3lA': 'hi', 'UC3JWIAd7Yuanzzfv0WSB84Q': 'kk',
  'UCqtTk35tEY4EyJGq7bOUGEQ': 'az', 'UC8fYVDv7o80fhX3Jat9uB7A': 'hy', 'UCEnrVkHgwvoVlkcQmBKR2_Q': 'uk', 'UCkuTggETs84-JTFuTTZe-Zw': 'uk',
  'UCUALYmnkEmx8vlxIbpr2gmw': 'tr', 'UC3ar28GS6o1p0m_wabfk2zw': 'hi', 'UCyoXW-Dse7fURq30EWl_CUA': 'hi', 'UCoZFpq-IbJ70KUzoorS09wQ': 'uz', 'UCHumSHRFQ8skiHTY75sxytQ': 'tr',
};

const root = new URL('../', import.meta.url);
const DIR = new URL('.cache/channel-films/', root);
mkdirSync(DIR, { recursive: true });
const UA = 'recomend/0.1 (https://github.com/dmitry00-00/Recommend)';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const day = 86400e3;
const now = new Date();

// ── 1. загрузки каналов (заголовок и начало описания), раз в 14 дней ─────────
type Upload = { id?: string; t: string; d: string };
const UPLOADS = new URL('uploads.json', DIR);
const uploads: Record<string, { at: string; items: Upload[] }> = existsSync(UPLOADS) ? JSON.parse(readFileSync(UPLOADS, 'utf8')) : {};
for (const ch of Object.keys(CHANNELS)) {
  // кэш без номеров роликов (до 11.10) — перечитать: по номерам полка бесплатной классики берёт ссылки
  const withIds = !uploads[ch]?.items.length || Boolean(uploads[ch].items[0].id);
  if (!FRESH && uploads[ch] && withIds && now.getTime() - Date.parse(uploads[ch].at) < 14 * day) continue;
  const items: Upload[] = [];
  let page = '';
  do {
    const qs = new URLSearchParams({ part: 'snippet', playlistId: `UU${ch.slice(2)}`, maxResults: '50', key, ...(page ? { pageToken: page } : {}) });
    const r = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?${qs}`).then((x) => x.json()).catch(() => undefined) as unknown as
      { items?: { snippet: { title: string; description?: string; resourceId?: { videoId?: string } } }[]; nextPageToken?: string } | undefined;
    if (!r) { console.error(`  ${CHANNELS[ch]}: нет ответа`); break; }
    items.push(...(r.items ?? []).map((i) => ({ id: i.snippet.resourceId?.videoId, t: i.snippet.title, d: (i.snippet.description ?? '').slice(0, 700) })));
    page = r.nextPageToken ?? '';
  } while (page);
  uploads[ch] = { at: now.toISOString(), items };
  writeFileSync(UPLOADS, JSON.stringify(uploads));
  console.error(`  ${CHANNELS[ch]}: ${items.length}`);
}

// ── 2. разбор ролика ─────────────────────────────────────────────────────────
const JUNK = /смотреть|онлайн|бесплатно|full\s*hd|\bhd\b|4k|полная версия|full movie|film complet|película completa|художественный фильм|премьера|трейлер|trailer|shorts|#|отрывок|сцена из|эфир|в кино с|выпуск|программ/iu;
const GENRE = /^(?:фильм|сериал|кино|драма|комедия|мелодрама|детектив|боевик|триллер|ужасы|фэнтези|фантастика|военн\S*|криминальн\S*|историческ\S*|приключен\S*|музыкальн\S*|документальн\S*|мультфильм|мультсериал|советские фильмы|movie|film|western|thriller|action|comedy|drama|romance)(?:[\s,.]+\S+)*$/iu;
const SERIES_MARK = /(?<!\p{L})(?:\d+\s*[-–]\s*\d+\s+сери[ий]|сери[яи]\s+\d|\d+\s+сери[яй]|все серии|заключительные серии|сериал|\(\d+\s+сезон\))/iu;
interface Item { ch: string; id?: string; t: string; names: string[]; year?: number; dirs: string[]; series: boolean }
function parse(ch: string, t: string, d: string, id?: string): Item {
  const s = t.replace(/[🔥💔🎥🎬🔴✪★⭐️]/gu, ' ');
  const year = Number((/(?:^|[^\d])((?:18|19|20)\d{2})(?:\s*г\.?)?(?:[^\d]|$)/.exec(s) ?? [])[1]) || undefined;
  // режиссёр: «реж. Имя Фамилия», «Directed by …» в заголовке; «Режиссёр: …», «Director: …» в описании
  const dirs: string[] = [];
  const inTitle = /(?:реж(?:\.|исс[её]р[ыа]?)|directed by)\s*[:—–-]?\s*([^,()\n|]{3,60})/giu;
  const inText = /(?:Режисс[её]р[ыа]?|Director|Réalisateur|Directed by|Dirección|Regi|監督|감독|导演|導演)\s*[:：—–-]?\s*([^\n]{2,80})/giu;
  for (const m of [...s.matchAll(inTitle), ...d.matchAll(inText)]) {
    for (const p of m[1].split(/,|、|，|\s+и\s+|\s+and\s+|;|\s{2,}|／|\//)) {
      const x = p.replace(/[.—–-]\s*.*$/, '').replace(/\s+/g, ' ').trim();
      // японские, китайские и корейские имена — без заглавных: 2–6 знаков письменности
      if (/^\p{Lu}[\p{L}.'-]+(?:\s+[\p{L}.'-]+){1,3}$/u.test(x) || /^[\p{Script=Han}\p{Script=Hangul}\p{Script=Katakana}]{2,6}$/u.test(x.replace(/\s/g, ''))) dirs.push(x.replace(/(?<=[\p{Script=Han}\p{Script=Hangul}])\s+(?=[\p{Script=Han}\p{Script=Hangul}])/gu, ''));
    }
  }
  const names = new Set<string>();
  for (const m of s.matchAll(/[«"“「『]([^»"”」』]{1,80})[»"”」』]/gu)) names.add(m[1]);
  const segs = s.split(/\s*(?:\/\/|\||\s\/\s|\sI\s|\s[—–-]\s|\.\s|!\s|\(|\)|[【】［］「」『』｜／]|\s+[-–]\s*)\s*/u).map((x) => x.trim()).filter(Boolean);
  for (let g of segs) {
    g = g.replace(/(?:\d+\s*[-–]\s*\d+\s+)?сери[ийя]\s*\d*(?:\s*[-–]\s*\d+)?|\d+\s+сери[яй]|заключительные серии|все серии(?: подряд)?/giu, ' ')
      .replace(/(?:18|19|20)\d{2}\s*г?\.?/g, ' ').replace(/\s+/g, ' ').trim();
    if (g.length < 2 || JUNK.test(g) || GENRE.test(g) || /^\d+$/.test(g)) continue;
    names.add(g);
    // кликбейт перед названием капсом: «Крис ХЕМСВОРТ в военном боевике НЕУЛОВИМЫЕ» → хвост капсом
    const caps = /((?:\p{Lu}[\p{Lu}\d:,.!?-]*\s*){1,8})$/u.exec(g);
    if (caps && caps[1].trim() !== g && caps[1].trim().length > 2) names.add(caps[1].trim());
    const after = /(?:в\s+(?:фильме|сериале|\S+\s+(?:боевике|комедии|драме|детективе|триллере|фильме|мелодраме))|история|драма|детектив|комедия|фильм)\s+(.+)$/iu.exec(g);
    if (after) names.add(after[1]);
  }
  // в японском и китайском названия короче: «砂の器» — три знака
  const clean = [...names].map((n) => n.replace(/[.!?,:;]+$/, '').trim()).filter((n) => (n.length >= 2 || /\p{Script=Han}/u.test(n)) && n.length <= 80);
  return { ch, ...(id ? { id } : {}), t, names: clean, year, dirs: [...new Set(dirs)], series: SERIES_MARK.test(s) };
}
const items = Object.entries(uploads).filter(([ch]) => CHANNELS[ch]).flatMap(([ch, u]) => u.items.map((x) => parse(ch, x.t, x.d, x.id)));
console.error(`роликов ${items.length}, с режиссёром ${items.filter((i) => i.dirs.length).length}, с годом ${items.filter((i) => i.year).length}`);

// ── 3. Wikidata ──────────────────────────────────────────────────────────────
const FILM = ['Q11424', 'Q506240', 'Q24869', 'Q202866', 'Q20650540', 'Q93204'];
const SERIES = ['Q5398426', 'Q1259759', 'Q581714', 'Q63952888', 'Q526877', 'Q117467246'];
const ALL = [...FILM, ...SERIES].map((q) => `wd:${q}`).join(' ');
/** Языки подписи по письменности названия: кириллица — ru, латиница — en, иероглифы и кана — ja и zh, хангыль — ko. */
const langsOf = (n: string): string[] => (/\p{Script=Hangul}/u.test(n) ? ['ko'] : /\p{Script=Hiragana}|\p{Script=Katakana}/u.test(n) ? ['ja']
  : /\p{Script=Han}/u.test(n) ? ['ja', 'zh'] : /\p{Script=Cyrillic}/u.test(n) ? ['ru'] : ['en']);
const lit = (t: string, lang: string) => `"${t.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"@${lang}`;
type Row = Record<string, { value: string; 'xml:lang'?: string }>;
async function sparql(q: string): Promise<Row[] | undefined> {
  for (let a = 0; a < 4; a++) {
    const r = await fetch('https://query.wikidata.org/sparql', {
      method: 'POST', body: new URLSearchParams({ query: q }),
      headers: { 'User-Agent': UA, Accept: 'application/sparql-results+json', 'Content-Type': 'application/x-www-form-urlencoded' },
    }).catch(() => undefined);
    // ответ бывает оборван посреди тела («other side closed») — тогда повтор
    if (r?.ok) { const j = await r.json().catch(() => undefined) as { results: { bindings: Row[] } } | undefined; if (j) return j.results.bindings; }
    await sleep(3000 * (a + 1));
  }
  return undefined;
}
type W = { qid: string; series: boolean; ru?: string; en?: string; own?: string[]; year?: number; tmdb?: string; imdb?: string };
const WD = new URL('wd.json', DIR);
const cache: { dir: Record<string, W[]>; lab: Record<string, W[]> } = !FRESH && existsSync(WD) ? JSON.parse(readFileSync(WD, 'utf8')) : { dir: {}, lab: {} };
const addRow = (b: Row, acc: Map<string, W>) => {
  const qid = b.f.value.split('/').pop()!;
  const w = acc.get(qid) ?? { qid, series: false };
  if (SERIES.includes(b.c.value.split('/').pop()!)) w.series = true;
  if (b.ru) w.ru = b.ru.value;
  if (b.en) w.en = b.en.value;
  if (b.own && !w.own?.includes(b.own.value)) w.own = [...(w.own ?? []), b.own.value];
  const y = Number((b.date?.value ?? '').slice(0, 4));
  if (y && (!w.year || y < w.year)) w.year = y;
  if (b.tmdb) w.tmdb = b.tmdb.value;
  if (b.imdb) w.imdb = b.imdb.value;
  acc.set(qid, w);
};
const FIELDS = `OPTIONAL { ?f rdfs:label ?ru FILTER(lang(?ru)='ru') } OPTIONAL { ?f rdfs:label ?en FILTER(lang(?en)='en') }
  OPTIONAL { ?f rdfs:label ?own FILTER(lang(?own) IN ('ja', 'ko', 'zh', 'fr', 'de', 'es', 'sv', 'hi')) } OPTIONAL { ?f wdt:P577 ?date } OPTIONAL { ?f wdt:P4947 ?tmdb } OPTIONAL { ?f wdt:P345 ?imdb }`;
// ключ группы — язык и строка: «Paris» по-французски и по-английски — разные запросы
const SEP = '\u0001';
const group = (rows: Row[]) => {
  const by = new Map<string, Map<string, W>>();
  for (const r of rows) { const n = `${r.n['xml:lang']}${SEP}${r.n.value}`; if (!by.has(n)) by.set(n, new Map()); addRow(r, by.get(n)!); }
  return by;
};
const merged = (by: ReturnType<typeof group>, n: string, langs: string[]) => [...new Map(langs.flatMap((l) => [...(by.get(`${l}${SEP}${n}`) ?? [])])).values()];

// режиссёры: «Имя Фамилия» и «Фамилия Имя» (Мосфильм пишет «Дружинина Светлана»)
const swap = (n: string) => { const p = n.split(' '); return p.length === 2 ? `${p[1]} ${p[0]}` : n; };
const dirNames = [...new Set(items.flatMap((i) => i.dirs))].filter((n) => !cache.dir[n]);
console.error(`режиссёров к опознанию ${dirNames.length}`);
for (let i = 0; i < dirNames.length; i += 80) {
  const b = dirNames.slice(i, i + 80);
  const vals = [...new Set(b.flatMap((n) => [...langsOf(n).map((l) => lit(n, l)), ...(langsOf(n)[0] === 'ru' ? [lit(swap(n), 'ru')] : [])]))];
  const rows = await sparql(`SELECT ?n ?f ?c ?ru ?en ?own ?date ?tmdb ?imdb WHERE { VALUES ?n { ${vals.join(' ')} }
    ?d rdfs:label ?n; wdt:P31 wd:Q5. ?f wdt:P57 ?d. VALUES ?c { ${ALL} } ?f wdt:P31 ?c. ${FIELDS} }`);
  if (!rows) { console.error(`  пачка режиссёров ${i} не получена`); continue; }
  const by = group(rows);
  for (const n of b) cache.dir[n] = [...new Map([...merged(by, n, langsOf(n)), ...merged(by, swap(n), ['ru'])].map((w) => [w.qid, w])).values()];
  writeFileSync(WD, JSON.stringify(cache));
  await sleep(800);
}
// названия — только у роликов с годом или без режиссёра; три написания: как есть, с заглавной, «Каждое Слово»
const sentence = (n: string) => n.charAt(0).toUpperCase() + n.slice(1).toLowerCase();
const titleCase = (n: string) => n.toLowerCase().replace(/(^|\s)(\p{L})/gu, (_, a: string, b: string) => a + b.toUpperCase());
const variants = (n: string) => [...new Set([n, sentence(n), titleCase(n)])];
// ключ кэша — само название (языки по письменности) или «язык␁название» для языка канала
const labKeys = (it: Item) => it.names.flatMap(variants).flatMap((n) => [n, ...(CH_LANG[it.ch] && !langsOf(n).includes(CH_LANG[it.ch]) ? [`${CH_LANG[it.ch]}${SEP}${n}`] : [])]);
const ofKey = (k: string): [string, string[]] => (k.includes(SEP) ? [k.slice(k.indexOf(SEP) + 1), [k.slice(0, k.indexOf(SEP))]] : [k, langsOf(k)]);
const labNames = [...new Set(items.filter((i) => i.year || !i.dirs.length).flatMap(labKeys))].filter((n) => !cache.lab[n]);
console.error(`названий к опознанию ${labNames.length}`);
for (let i = 0; i < labNames.length; i += 150) {
  const b = labNames.slice(i, i + 150);
  const rows = await sparql(`SELECT ?n ?f ?c ?ru ?en ?own ?date ?tmdb ?imdb WHERE { VALUES ?n { ${b.flatMap((k) => { const [n, ls] = ofKey(k); return ls.map((l) => lit(n, l)); }).join(' ')} }
    ?f rdfs:label ?n. VALUES ?c { ${ALL} } ?f wdt:P31 ?c. ${FIELDS} }`);
  if (!rows) { console.error(`  пачка названий ${i} не получена`); continue; }
  const by = group(rows);
  for (const k of b) cache.lab[k] = merged(by, ...ofKey(k));
  if ((i / 150) % 10 === 9) { writeFileSync(WD, JSON.stringify(cache)); console.error(`  ${i + b.length} из ${labNames.length}`); }
  await sleep(500);
}
writeFileSync(WD, JSON.stringify(cache));

// ── 4. сопоставление и замер ─────────────────────────────────────────────────
const OUT_NAME = 'filmBaseChannels';
const OUT = new URL(`src/mocks/${OUT_NAME}.ts`, root);
const prev: WorkCard[] = existsSync(OUT) ? (await import(OUT.href))[OUT_NAME] as WorkCard[] : [];
const ownIds = new Set(prev.map((w) => w.id));
const have = new Set<string>();
for (const { work } of worksIndex({ all: true })) {
  if (ownIds.has(work.id)) continue;
  for (const k of analysisKeys(work)) have.add(k);
  const ids = idsOf(work);
  if (ids?.tmdb != null) have.add(`tmdb:${ids.tmdb}`);
  if (ids?.imdb) have.add(`imdb:${ids.imdb}`);
  const q = /^f-wd(\d+)$/.exec(work.id);
  if (q) have.add(`Q${q[1]}`);
}
const had = (w: W) => have.has(w.qid) || Boolean(w.tmdb && have.has(`tmdb:${w.tmdb}`)) || Boolean(w.imdb && have.has(`imdb:${w.imdb}`));
const keyed = (w: W) => Boolean(w.series ? w.imdb : w.tmdb);
const fold = (s: string) => s.toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const near = (a?: number, b?: number) => Boolean(a && b && Math.abs(a - b) <= 1);

const found = new Map<string, { w: W; via: 'режиссёр' | 'год'; ch: Set<string>; t: string }>();
let matched = 0;
// ролик → фильм (TMDb) для полки бесплатной классики (tools/free-watch.mts берёт ролики каналов из OFFICIAL)
const videos: Record<string, { tmdb: number; ch: string }> = {};
for (const it of items) {
  const said = new Set(it.names.map(fold));
  let pick: W | undefined, via: 'режиссёр' | 'год' = 'режиссёр';
  const filmography = it.dirs.flatMap((d) => cache.dir[d] ?? []);
  const byName = filmography.filter((w) => [w.ru, w.en, ...(w.own ?? [])].some((l) => l && said.has(fold(l))));
  if (byName.length) pick = byName.find((w) => near(w.year, it.year)) ?? (byName.length === 1 ? byName[0] : byName.find((w) => w.series === it.series));
  if (!pick && it.year) {
    const cand = labKeys(it).flatMap((k) => cache.lab[k] ?? []).filter((w) => near(w.year, it.year));
    const uniq = [...new Map(cand.map((w) => [w.qid, w])).values()];
    if (uniq.length === 1) { pick = uniq[0]; via = 'год'; }
  }
  if (!pick) continue;
  matched += 1;
  if (it.id && pick.tmdb && !pick.series) videos[it.id] = { tmdb: Number(pick.tmdb), ch: it.ch };
  const e = found.get(pick.qid) ?? { w: pick, via, ch: new Set<string>(), t: it.t };
  e.ch.add(CHANNELS[it.ch]);
  found.set(pick.qid, e);
}
const all = [...found.values()];
const missing = all.filter((e) => !had(e.w) && keyed(e.w));
console.log(`роликов ${items.length}, опознано ${matched}; произведений ${all.length}, нет в справочнике ${all.filter((e) => !had(e.w)).length}, из них с ключом ${missing.length}`);
const perCh = new Map<string, [number, number]>();
for (const e of all) for (const c of e.ch) {
  const p = perCh.get(c) ?? [0, 0];
  p[0] += 1;
  if (!had(e.w) && keyed(e.w)) p[1] += 1;
  perCh.set(c, p);
}
for (const [c, [a, b]] of [...perCh].sort((x, y) => y[1][1] - x[1][1])) console.log(`  ${c.padEnd(34)} опознано ${String(a).padStart(5)}, новых ${b}`);
console.log(`новых: фильмов ${missing.filter((e) => !e.w.series).length}, сериалов ${missing.filter((e) => e.w.series).length}; по режиссёру ${missing.filter((e) => e.via === 'режиссёр').length}, по году ${missing.filter((e) => e.via === 'год').length}`);
writeFileSync(new URL('.cache/channel-films.videos.json', root), JSON.stringify({ at: now.toISOString(), videos }));
writeFileSync(new URL('.cache/channel-films.json', root), JSON.stringify({ at: now.toISOString(),
  missing: missing.map((e) => ({ ...e.w, via: e.via, channels: [...e.ch], video: e.t })) }, null, 1));

// ── 5. запись карточек ───────────────────────────────────────────────────────
if (WRITE) {
  // подпись: режиссёр у фильма, создатель (P170) у сериала — как в tools/grow-film-base.mts
  const who = new Map<string, string>();
  const qs = missing.map((e) => e.w.qid);
  for (let i = 0; i < qs.length; i += 200) {
    const rows = await sparql(`SELECT ?f ?l WHERE { VALUES ?f { ${qs.slice(i, i + 200).map((q) => `wd:${q}`).join(' ')} }
      { ?f wdt:P31 ?c. VALUES ?c { ${SERIES.map((q) => `wd:${q}`).join(' ')} } ?f wdt:P170 ?d } UNION { ?f wdt:P57 ?d }
      OPTIONAL { ?d rdfs:label ?ru FILTER(lang(?ru)='ru') } OPTIONAL { ?d rdfs:label ?en FILTER(lang(?en)='en') } BIND(COALESCE(?ru, ?en) AS ?l) }`);
    for (const r of rows ?? []) { const q = r.f.value.split('/').pop()!; if (r.l && !who.has(q)) who.set(q, r.l.value); }
    await sleep(800);
  }
  // название — русская подпись, иначе английская, иначе своя (у французского фильма бывает только французская)
  const cards: WorkCard[] = missing.filter(({ w }) => w.ru ?? w.en ?? w.own?.[0]).map(({ w }) => {
    // подпись с уточнением Википедии: «Утёс (фильм, 1973)», «Элизиум (мультфильм)», «Spasms (film)»
    const title = (w.ru ?? w.en ?? w.own![0])!.replace(/\s*\((?:фильм|мультфильм|телефильм|сериал|телесериал|film|movie|TV series)(?:,?\s*\d{4})?\)$/iu, '');
    // оригинальное — английская подпись: язык у прочих подписей в кэше не хранится, и японскому фильму
    // доставалась испанская («Batallas sin honor ni humanidad»)
    const original = w.en && w.en !== title ? w.en : undefined;
    return {
      id: `f-wd${w.qid.slice(1)}`, type: w.series ? 'series' : 'film', title,
      ...(original ? { originalTitle: original } : {}),
      year: w.year ?? 0, creators: who.has(w.qid) ? [who.get(w.qid)!] : [],
      primaryOperations: [], complexityLevel: 0, warnings: [], barriers: [], isNicheMasterpiece: false,
      externalIds: { ...(!w.series && w.tmdb ? { tmdb: Number(w.tmdb) } : {}), ...(w.imdb ? { imdb: w.imdb } : {}) },
    } as WorkCard;
  });
  const ids = new Set(cards.map((c) => c.id));
  const out = [...prev.filter((c) => !ids.has(c.id)), ...cards];
  const row = (w: WorkCard) => `  c(${[w.id.replace(/^f-wd/, ''), w.type, w.title, w.originalTitle ?? '', w.year, w.creators, w.externalIds ?? {}].map((v) => JSON.stringify(v)).join(', ')}),`;
  writeFileSync(OUT, `// Сгенерировано tools/grow-from-channels.mts (${now.toISOString().slice(0, 10)}): фильмы и сериалы из загрузок
// каналов киностудий, правообладателей и агрегаторов бесплатного кино, которых не было в справочнике.
// Опознаны в Wikidata (CC0) по режиссёру или году. Ссылок на ролики здесь нет. Разметку для подбора
// дописывает черновик (draftAnnotations.ts, seriesAnnotations.ts). Не править руками — перегенерировать.
import type { ExternalIds, WorkCard } from '@/types/tmdf';

const c = (qid: string, type: 'film' | 'series', title: string, originalTitle: string, year: number, creators: string[], externalIds: ExternalIds): WorkCard => ({
  id: \`f-wd\${qid}\`, type, title, ...(originalTitle ? { originalTitle } : {}), year, creators,
  primaryOperations: [], complexityLevel: 0, warnings: [], barriers: [], isNicheMasterpiece: false, externalIds,
});

export const ${OUT_NAME}: WorkCard[] = [
${out.map(row).join('\n')}
];
`);
  console.log(`→ src/mocks/${OUT_NAME}.ts: прежних ${prev.length}, новых ${cards.length}, всего ${out.length}`);
}
