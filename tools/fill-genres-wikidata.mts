// Жанры и страны для якоря вкуса — из Wikidata (23.10): тот же пул и тот же выход, что у tools/fill-genres-tmdb.mts, но
// источник — Wikidata (CC0). Зачем: по исследованию (reports/Улучшение рекомендательного движка.md) условия TMDb запрещают
// коммерческое использование без письменного соглашения и упоминают запрет на обучение моделей; владелец выбирает
// источник по сравнению — оно здесь же (--stats/прогон печатает и пишет .cache/eval/genres-tmdb-vs-wikidata-2310.md).
//   npx tsx tools/fill-genres-wikidata.mts [--stats] [--pool] [--limit N] [--classes]
//     --stats — без сети и без записи выхода: покрытие и сравнение по кэшу; --pool — спрашивать только пул подбора;
//     --limit N — не больше N запросов SPARQL; --classes — вывести частые жанры Wikidata без соответствия (для таблицы)
// Ключи — номера, что у карточек уже есть: фильм — externalIds.tmdb → P4947, сериал — номер сериала TMDb → P4983,
// оба — IMDb → P345, элемент Wikidata (id `f-wd<N>`, externalIds.wikidata, .cache/credits-ids.json, wikidata-ids.json) —
// напрямую. Из элемента: жанры P136 (и P31 — только «мультфильм/документальный/телефильм/реалити…»: эти у Wikidata часто
// не жанр, а вид), страны P495 (P17 при пустом P495 не берём — это место съёмок/студии, а не происхождение).
// Жанры Wikidata сводятся к нашим 24 (те же названия, что у TMDb в filmGenres.ts) таблицей GENRE_Q; поджанры без строки в
// таблице — к ближайшему предку по P279 (до трёх шагов вверх). Страны — код ISO (P297), исторические — как у countryRu.
// Выход — .cache/filmGenres.wikidata-2310.ts, тот же вид, что src/mocks/filmGenres.ts (filmGenres — прежний набор как
// был, filmGenresFill — из Wikidata, filmCountries — из Wikidata тем, у чьей карточки стран нет). В src/mocks не пишет.
// Кэш — .cache/wikidata-genres/{items,classes,countries}.jsonl (строка на ключ: повтор в сеть не ходит). Вежливо: запрос
// SPARQL не чаще раза в секунду, по 250 ключей, User-Agent проекта, повтор на 429/5xx с паузой.
//
// Итоговые файлы (23.10, решение владельца: жанры и страны — Wikidata, TMDb — только для новинок):
//   npx tsx tools/fill-genres-wikidata.mts --final [--net]
// (ночной сбор, tools/collect.mts; заменяет tools/film-genres.mts). Без --net — только кэш; с --net — докачка: Wikidata —
// ключи, которых ещё не спрашивали (SPARQL ≤ 1 запроса в секунду), TMDb — только новинки без жанров Wikidata (номер,
// которого нет в .cache/tmdb-genres). Пишет два ленивых куска:
//   src/mocks/filmGenres.ts — `filmGenres`, прежний набор TMDb (.cache/tmdb-tags.json) тем же текстом, что у
//     tools/film-genres.mts: лента без флага прежняя, и кусок того же размера (~26 КБ brotli);
//   src/mocks/filmGenresFill.ts — грузится только с флагом anchorFill: `filmGenresFill` — тем, кого прежний набор не знает,
//     жанры Wikidata, а у новинки без них — TMDb; `filmCountries` — страны Wikidata (P495) тем, у чьей карточки стран нет.
// Отдельным куском, а не в filmGenres.ts: дозаполнение ~150 КБ brotli, без флага новичку его качать незачем.
// Новинка — год карточки ≥ 2025 или год неизвестен у карточки из filmBaseMore: туда ночной сбор с сентября пишет «вышедшее
// за 90 дней» и месячные топы Википедии, и год 0 там — почти всегда фильм, о котором Wikidata ещё мало знает.
import { appendFileSync, copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadEnvFile } from './env-file.mts';
import { brotliCompressSync, gzipSync } from 'node:zlib';
import { works as catalogWorks } from '../src/mocks/index.ts';
import { externalIds } from '../src/mocks/externalIds.ts';
import { catalogMedia } from '../src/mocks/catalogMedia.ts';
import { userWorks } from '../src/mocks/userHistory.ts';
import { watchedWorks } from '../src/mocks/userWatched.ts';
import { candidateSeeds, seedToCard } from '../src/mocks/candidates.ts';
import { candidateMedia } from '../src/mocks/candidateMedia.ts';
import { filmBase } from '../src/mocks/filmBase.ts';
import { filmBaseWiki } from '../src/mocks/filmBaseWiki.ts';
import { filmBaseMarkup } from '../src/mocks/filmBaseMarkup.ts';
import { filmBaseCurated } from '../src/mocks/filmBaseCurated.ts';
import { filmBasePopular } from '../src/mocks/filmBasePopular.ts';
import { filmBaseWorld } from '../src/mocks/filmBaseWorld.ts';
import { filmBaseChannels } from '../src/mocks/filmBaseChannels.ts';
import { seriesBase } from '../src/mocks/seriesBase.ts';
import { seriesBaseWiki } from '../src/mocks/seriesBaseWiki.ts';
import { filmBaseLinks } from '../src/mocks/filmBaseLinks.ts';
import { filmBaseTail } from '../src/mocks/filmBaseTail.ts';
import { filmBaseMore } from '../src/mocks/filmBaseMore.ts';
import { baseMedia } from '../src/mocks/baseMedia.ts';
import { baseMediaLate } from '../src/mocks/baseMediaLate.ts';
import { draftAnnotations } from '../src/mocks/draftAnnotations.ts';
import { draftAnnotationsLinks } from '../src/mocks/draftAnnotationsLinks.ts';
import { seriesAnnotations } from '../src/mocks/seriesAnnotations.ts';
import { seriesAnnotationsWiki } from '../src/mocks/seriesAnnotationsWiki.ts';
import { isFilm, isSeries, normalizeWork } from '../src/lib/media.ts';
import { primaryKey } from '../src/lib/keys.ts';
import { countryRu } from '../src/lib/countries.ts';
import type { ExternalIds, WorkCard } from '../src/types/tmdf.ts';

const t0 = Date.now();
const args = process.argv.slice(2);
const STATS = args.includes('--stats');
const POOL_ONLY = args.includes('--pool');
const CLASSES = args.includes('--classes');
const LIMIT = Number(args[args.indexOf('--limit') + 1]) || Infinity;
/** итоговый файл в src/mocks (см. шапку); сеть — только с --net */
const FINAL = args.includes('--final');
const NET = FINAL ? args.includes('--net') : !STATS;
const FINAL_OUT = 'src/mocks/filmGenres.ts';
const FILL_OUT = 'src/mocks/filmGenresFill.ts';
const OUT = '.cache/filmGenres.wikidata-2310.ts';
const EVAL = '.cache/eval/genres-tmdb-vs-wikidata-2310.md';
const DIR = '.cache/wikidata-genres';
const TMDB_DIR = '.cache/tmdb-genres';
mkdirSync(DIR, { recursive: true });
mkdirSync('.cache/eval', { recursive: true });

// ── жанры: Wikidata → наши ────────────────────────────────────────────────────────────────────────────
/** Наши жанры — те же, что у fill-genres-tmdb (буква на жанр, порядок не менять). */
const LETTERS = ['драма', 'боевик', 'комедия', 'триллер', 'приключения', 'мелодрама', 'криминал', 'фантастика', 'фэнтези', 'ужасы',
  'семейный', 'история', 'детектив', 'мультфильм', 'военный', 'музыка', 'документальный', 'вестерн', 'телевизионный фильм',
  'детский', 'новости', 'реалити-шоу', 'мыльная опера', 'ток-шоу'];
const letterOf = new Map(LETTERS.map((g, i) => [g, String.fromCharCode(97 + i)]));
/** «детское» у TMDb: фильму — «семейный», сериалу — «детский» (жанр Kids есть только у сериалов) */
const KIDS = '*детское';
/** Элемент жанра Wikidata → наши жанры. Пустой список — «знаем, но не жанр TMDb» (дальше по P279 не идём): ЛГБТ-тема,
 *  экранизация, подростковое, эротика и т. п. — у TMDb им соответствия нет. Нет строки — ищем предка по P279.
 *  Составлено 23.10 по частым жанрам пула (см. --classes); подпись — английская метка элемента. */
const GENRE_Q: Record<string, string[]> = {
  // основные «… film» — у фильмов
  Q130232: ['драма'], // drama film
  Q157443: ['комедия'], // comedy film
  Q188473: ['боевик'], // action film
  Q2484376: ['триллер'], // thriller film
  Q319221: ['приключения'], // adventure film
  Q1054574: ['мелодрама'], // romance film
  Q959790: ['криминал'], // crime film
  Q471839: ['фантастика'], // science fiction film
  Q157394: ['фэнтези'], // fantasy film
  Q200092: ['ужасы'], // horror film
  Q1361932: ['семейный'], // family film
  Q17013749: ['история'], // historical film
  Q1200678: ['детектив'], // mystery film
  Q202866: ['мультфильм'], // animated film
  Q369747: ['военный'], // war film
  Q842256: ['музыка'], // musical film
  Q93204: ['документальный'], // documentary film
  Q172980: ['вестерн'], // Western film
  Q506240: ['телевизионный фильм'], // television film
  Q2143665: [KIDS], // children's film
  // составные и частые поджанры — прямо: у них предки бывают пёстрыми или уводят не туда
  Q859369: ['комедия', 'драма'], // comedy drama
  Q860626: ['комедия', 'мелодрама'], // romantic comedy
  Q645928: ['драма', 'история'], // biographical film
  Q1535153: ['боевик', 'фантастика'], // superhero film
  Q1033891: ['боевик'], // martial arts film
  Q853630: ['ужасы'], // slasher film
  Q590103: ['триллер'], // psychological thriller
  Q185867: ['криминал'], // film noir
  Q2421031: ['криминал'], // neo-noir
  Q5778924: ['комедия'], // black comedy film
  Q138603203: ['комедия'], // satirical film
  Q2297927: ['триллер'], // spy film
  Q846544: ['боевик'], // disaster film
  Q1342372: ['ужасы'], // monster film
  Q3072049: ['ужасы'], // zombie film
  Q31888058: ['ужасы'], // ghost film
  Q3634883: ['фэнтези'], // supernatural film
  Q1341051: ['фантастика'], // post-apocalyptic film
  Q1065444: ['фантастика'], // kaiju
  Q275934: ['фантастика'], // tokusatsu
  Q224700: ['комедия', 'ужасы'], // comedy horror
  Q222639: ['приключения', 'боевик'], // swashbuckler film
  Q23745: ['мыльная опера', 'драма'], // telenovela
  Q2321734: ['криминал', 'детектив'], // police procedural
  Q11304653: ['триллер'], // suspense film
  Q1919632: ['мелодрама'], // melodrama (фильм)
  Q191489: ['мелодрама'], // melodrama
  Q7168625: ['история', 'драма'], // historical drama
  Q22025254: ['история', 'драма'], // sageuk
  Q3327002: ['история'], // medieval film
  Q1339864: ['драма'], // sport film — у TMDb спорта нет, такие фильмы у него драмы
  Q2973201: ['драма'], // political film
  Q622370: ['драма'], // docudrama — не документальный, хоть и подкласс documentary
  Q80930: ['драма'], // tragedy
  Q3272147: ['ужасы'], // found footage film
  Q699: ['фэнтези'], // fairy tale
  Q28026639: ['семейный'], // Christmas film
  Q663106: ['комедия'], // buddy film
  Q109733358: ['музыка'], // music-themed film
  Q3072043: ['музыка'], // dance film
  Q430525: ['музыка'], // concert film
  Q2743: ['музыка'], // musical play
  Q132083517: ['музыка'], // musical
  Q3541116: ['криминал'], // true crime
  Q47009776: ['фантастика'], // apocalyptic film
  Q3919251: ['фантастика'], // apocalyptic fiction
  Q197949: ['фантастика'], // post-apocalyptic fiction
  Q104123273: ['фантастика'], // post-apocalyptic television series
  Q5769663: ['ужасы'], // Gothic film
  Q113259281: ['ужасы'], // zombie fiction
  Q7644030: ['фэнтези'], // supernatural fiction
  Q101860688: ['фэнтези'], // paranormal television program
  Q56320653: ['триллер'], // espionage television series
  Q9503: ['триллер'], // suspense
  Q482612: ['драма'], // Korean drama
  Q36279: ['драма', 'история'], // biography
  Q111956902: ['военный'], // war fiction
  Q754803: ['боевик', 'приключения'], // wuxia
  Q1436734: ['приключения'], // adventure
  Q170539: ['комедия'], // parody
  Q738473: ['мелодрама'], // romance
  Q83267: ['криминал'], // crime
  Q309: ['история'], // history
  // «знаем, но не жанр TMDb» — дальше по P279 не идём
  Q2973181: [], // speculative fiction film (иначе «фэнтези» уводило к «комедии» через предков)
  Q9326077: [], // speculative fiction
  Q1146335: [], // teen film
  Q20442589: [], // LGBTQ-related film
  Q85133165: [], // LGBT-related television series
  Q128146451: [], // LGBTQ+ television program
  Q52162262: [], // film based on a literary work
  Q599558: [], // erotic film
  Q181001: [], // erotica
  Q652256: [], // epic film
  Q226730: [], // silent film
  Q459290: [], // independent film
  Q21401869: [], // flashback film
  Q1135802: [], // art film
  Q336144: [], // anthology film
  Q23653: [], // anthology series
  Q21192427: [], // crossover fiction
  Q1067324: [], // exploitation film
  Q1935609: [], // propaganda film
  Q790192: [], // experimental film
  Q8812380: [], // pseudo-documentary
  Q223770: [], // B movie
  Q1711400: [], // youth series
  Q861402: [], // educational television
  // жанры вообще (у сериалов и части фильмов P136 — они, а не «… film»)
  Q25372: ['драма'], // drama
  Q21010853: ['драма'], // drama fiction
  Q1366112: ['драма'], // drama television series
  Q40831: ['комедия'], // comedy
  Q60548032: ['комедия'], // humor
  Q128758: ['комедия'], // satire
  Q182015: ['триллер'], // thriller
  Q24925: ['фантастика'], // science fiction
  Q132311: ['фэнтези'], // fantasy
  Q16575965: ['ужасы'], // horror fiction
  Q5937792: ['криминал'], // crime fiction
  Q186424: ['детектив'], // detective fiction
  Q6585139: ['детектив'], // mystery fiction
  Q1762165: ['боевик'], // action fiction
  Q21802675: ['приключения'], // adventure fiction
  Q19765983: ['мелодрама'], // romantic fiction
  Q1196408: ['история'], // historical fiction
  Q21590660: ['вестерн'], // Western
  Q4164344: ['документальный'], // documentary
  Q11425: ['мультфильм'], // animation
  Q1107: ['мультфильм'], // anime
  Q10901350: ['мультфильм'], // anime and manga
  // сериалы
  Q581714: ['мультфильм'], // animated series
  Q117467246: ['мультфильм'], // animated television series
  Q63952888: ['мультфильм'], // anime television series
  Q343782: ['боевик'], // action television series
  Q56064758: ['приключения'], // adventure television series
  Q110593091: ['боевик', 'приключения'], // action and adventure television program
  Q1273568: [KIDS], // children's television series
  Q27912070: [KIDS], // children's television program
  Q178840: ['семейный'], // family television series
  Q9335577: ['криминал'], // crime television series
  Q20220309: ['ужасы'], // horror television series
  Q121388434: ['ужасы'], // horror television program
  Q141622854: ['боевик', 'фантастика'], // superhero television series
  Q101720774: ['боевик', 'фантастика'], // superhero television program
  Q84270297: ['мелодрама'], // romance television series
  Q133307276: ['мелодрама'], // romance television program
  Q101898470: ['детектив'], // mystery television series
  Q121438606: ['детектив'], // detective and mystery television program
  Q102245189: ['военный'], // war television series
  Q121608489: ['военный'], // war television program
  Q7603925: ['документальный'], // documentary television program
  Q6942441: ['музыка'], // music television
  Q622812: ['ток-шоу'], // talk show
  Q23739: ['мыльная опера'], // soap opera
  Q1358344: ['новости'], // news program
  Q15416: [], // television program
  Q5398426: [], // television series
  Q7724161: [], // television serial
  Q1259759: [], // miniseries
  Q11424: [], // film
  Q24862: [], // short film
  Q8253: [], // fiction
};
/** Из P31 (вид элемента) берём только эти жанры: остальные P31 — «фильм», «сериал», «мини-сериал» и т. п. */
const FROM_P31 = new Set(['мультфильм', 'документальный', 'телевизионный фильм', 'реалити-шоу', 'ток-шоу', 'мыльная опера', 'новости']);
const DEPTH = 3;

// ── страны: элемент → код ISO ────────────────────────────────────────────────────────────────────────
/** Страны без своего P297 (исторические и «королевства») — коды как у TMDb и countryRu (SU, XC, XG, YU). */
const COUNTRY_Q: Record<string, string> = {
  // СССР и союзные республики — СССР (фильмы «Грузия-фильма», Довженко и др. Wikidata помечает республикой)
  Q15180: 'SU', // Soviet Union
  Q2184: 'SU', Q2305208: 'SU', // Russian SFSR (два элемента)
  Q133356: 'SU', Q2895: 'SU', Q130229: 'SU', Q131337: 'SU', Q192180: 'SU', Q484578: 'SU', Q132856: 'SU', Q130280: 'SU',
  Q170895: 'SU', Q199711: 'SU', Q173761: 'SU', Q545205: 'SU', // Украинская, Белорусская, Грузинская, Азербайджанская, Латвийская,
  // Узбекская, Армянская, Эстонская, Молдавская, Таджикская, Литовская ССР, ЗСФСР
  Q34266: 'RU', Q139319: 'RU', // Russian Empire, Russian Republic (1917)
  Q33946: 'XC', Q853348: 'XC', Q140359: 'XC', // Czechoslovakia, ЧССР, Первая республика
  Q16957: 'XG', // German Democratic Republic
  Q713750: 'DE', Q43287: 'DE', Q41304: 'DE', Q7318: 'DE', Q1206012: 'DE', // ФРГ, Германская империя, Веймар, Третий рейх
  Q83286: 'YU', Q36704: 'YU', Q838261: 'YU', Q37024: 'YU', // СФРЮ, Королевство, СРЮ, Сербия и Черногория — «Югославия»
  Q55: 'NL', Q29999: 'NL', // Netherlands (у этого элемента P297 нет — он у королевства)
  Q756617: 'DK', // Kingdom of Denmark
  Q174193: 'GB', Q161885: 'GB', Q21: 'GB', Q22: 'GB', Q25: 'GB', // Великобритания в прежних границах, Англия, Шотландия, Уэльс
  Q172579: 'IT', // Kingdom of Italy
  Q1054923: 'HK', // British Hong Kong
  Q121932: 'BG', Q147909: 'BG', // НРБ, Царство Болгария
  Q211274: 'PL', Q207272: 'PL', // ПНР, Вторая Речь Посполитая
  Q16410: 'HU', Q600018: 'HU', // ВНР, Королевство Венгрия
  Q842794: 'RO', // СРР
  Q129286: 'IN', // British Raj
  Q13426199: 'CN', Q29520: 'CN', Q19188: 'CN', // Китайская Республика (1912–1949), China, mainland China
  Q188712: 'JP', // Empire of Japan
  Q212056: 'MN', // МНР
  Q152750: 'CZ', // Protectorate of Bohemia and Moravia
  Q28513: 'AT', Q518101: 'AT', // Австро-Венгрия, Первая Австрийская республика
  Q70802: 'FR', // French Third Republic
  Q467864: 'AL', // НСРА
};

// ── кэш ───────────────────────────────────────────────────────────────────────────────────────────────
/** Найденное по ключу: `p` — свойство (P4947/P4983/P345) или `Q` (элемент напрямую), `v` — значение; `it` — элементы
 *  (q, жанры P136, виды P31, страны P495); пусто — Wikidata не знает. */
type Item = { q: string; g: string[]; t: string[]; c: string[] };
type Row = { p: string; v: string; it: Item[] };
type Cls = { q: string; up: string[]; en?: string };
type Country = { q: string; iso?: string; t: string[]; en?: string };
const readJsonl = <T,>(f: string): T[] =>
  existsSync(f) ? readFileSync(f, 'utf8').split('\n').filter(Boolean).flatMap((l: string) => { try { return [JSON.parse(l) as T]; } catch { return []; } }) : [];
const rows = new Map(readJsonl<Row>(`${DIR}/items.jsonl`).map((r) => [`${r.p}=${r.v}`, r]));
const classes = new Map(readJsonl<Cls>(`${DIR}/classes.jsonl`).map((r) => [r.q, r]));
const countries = new Map(readJsonl<Country>(`${DIR}/countries.jsonl`).map((r) => [r.q, r]));
const put = (name: string, row: object) => appendFileSync(`${DIR}/${name}.jsonl`, JSON.stringify(row) + '\n');

// ── карточки и пул — как в fill-genres-tmdb.mts (тот же порядок копий, тот же candidatePool) ───────────
const media = (w: WorkCard): WorkCard => {
  const m = baseMedia[w.id] ?? baseMediaLate[w.id];
  return normalizeWork(m ? { ...w, ...m } : w);
};
const idsOf = (w: WorkCard): ExternalIds | undefined => w.externalIds ?? catalogMedia[w.id]?.externalIds ?? externalIds[w.id];
const catalogCards = Object.values(catalogWorks).map((w) => ({ ...w, ...catalogMedia[w.id], externalIds: idsOf(w) }) as WorkCard);
const seedCards = candidateSeeds.map((s) => ({ ...seedToCard(s), ...candidateMedia[s.id] }) as WorkCard);
const ordered: WorkCard[] = [
  ...userWorks, ...[...filmBase, ...filmBaseWiki, ...filmBaseMarkup, ...filmBaseCurated, ...seriesBase, ...filmBasePopular, ...filmBaseWorld,
    ...filmBaseChannels, ...seriesBaseWiki, ...filmBaseLinks, ...filmBaseTail, ...filmBaseMore].map(media),
  ...watchedWorks, ...catalogCards, ...seedCards,
].map(normalizeWork);
const cardOf = new Map<string, WorkCard>();
const tvFromId = new Map<string, number>();
/** Элемент Wikidata ключа — со всех копий карточки (у первой копии его может не быть) */
const qidOf = new Map<string, string>();
for (const w of ordered) {
  if (w.type === 'book') continue;
  const k = primaryKey(w, idsOf(w));
  if (!k || !(isFilm(w) || isSeries(w))) continue;
  if (!cardOf.has(k)) cardOf.set(k, w);
  const tv = /^l-tmdbtv(\d+)$/.exec(w.id)?.[1];
  const imdb = idsOf(w)?.imdb;
  if (tv && imdb && isSeries(w)) tvFromId.set(imdb, Number(tv));
  const q = /^f-wd(\d+)$/.exec(w.id)?.[1] ? `Q${/^f-wd(\d+)$/.exec(w.id)![1]}` : idsOf(w)?.wikidata;
  if (q && /^Q\d+$/.test(q) && !qidOf.has(k)) qidOf.set(k, q);
}
for (const f of ['.cache/credits-ids.json', '.cache/wikidata-ids.json']) {
  if (!existsSync(f)) continue;
  for (const [k, q] of Object.entries(JSON.parse(readFileSync(f, 'utf8')) as Record<string, string | null>)) {
    if (q && /^Q\d+$/.test(q) && cardOf.has(k) && !qidOf.has(k)) qidOf.set(k, q);
  }
}
for (const k of cardOf.keys()) if (k.startsWith('wd:') && !qidOf.has(k)) qidOf.set(k, k.slice(3));

const pool = new Set<string>();
for (const w of [...catalogCards, ...seedCards]) {
  const k = w.type !== 'book' && w.primaryOperations.length && w.complexityLevel ? primaryKey(w, idsOf(w)) : undefined;
  if (k && cardOf.has(k)) pool.add(k);
}
const firstPool = new Set(pool);
for (const [k, a] of Object.entries(draftAnnotations)) if (a.confidence !== 'low' && cardOf.has(k)) firstPool.add(k);
for (const k of Object.keys(seriesAnnotations)) if (cardOf.has(k) && isSeries(cardOf.get(k)!)) firstPool.add(k);
for (const [k, a] of Object.entries({ ...draftAnnotationsLinks, ...draftAnnotations })) if (a.confidence !== 'low' && cardOf.has(k)) pool.add(k);
for (const k of Object.keys({ ...seriesAnnotationsWiki, ...seriesAnnotations })) if (cardOf.has(k) && isSeries(cardOf.get(k)!)) pool.add(k);
const poolKeys = [...pool];
const allKeys = [...cardOf.keys()];

// ── TMDb — для сравнения: то же, что видит fill-genres-tmdb (кэш .cache/tmdb-genres, tmdb-tags) ────────
const TMDB_GENRE: Record<number, string[]> = {
  28: ['боевик'], 12: ['приключения'], 16: ['мультфильм'], 35: ['комедия'], 80: ['криминал'], 99: ['документальный'],
  18: ['драма'], 10751: ['семейный'], 14: ['фэнтези'], 36: ['история'], 27: ['ужасы'], 10402: ['музыка'], 9648: ['детектив'],
  10749: ['мелодрама'], 878: ['фантастика'], 10770: ['телевизионный фильм'], 53: ['триллер'], 10752: ['военный'], 37: ['вестерн'],
  10759: ['боевик', 'приключения'], 10762: ['детский'], 10763: ['новости'], 10764: ['реалити-шоу'], 10765: ['фантастика', 'фэнтези'],
  10766: ['мыльная опера'], 10767: ['ток-шоу'], 10768: ['военный'],
};
type Hit = { id: number; g?: number[]; pc?: string[]; oc?: string[]; none?: true };
const movieHits = new Map(readJsonl<Hit>(`${TMDB_DIR}/movie.jsonl`).map((h) => [h.id, h]));
const tvHits = new Map(readJsonl<Hit>(`${TMDB_DIR}/tv.jsonl`).map((h) => [h.id, h]));
const finds = new Map(readJsonl<{ imdb: string; tv?: number }>(`${TMDB_DIR}/find.jsonl`).map((h) => [h.imdb, h]));
const filmTags: Record<string, { genres?: string[] }> = existsSync('.cache/tmdb-tags.json') ? JSON.parse(readFileSync('.cache/tmdb-tags.json', 'utf8')) : {};
const tvTags: Record<string, { tv?: number; genres?: string[] }> = existsSync('.cache/tmdb-tv-tags.json') ? JSON.parse(readFileSync('.cache/tmdb-tv-tags.json', 'utf8')) : {};
const known = (gs: string[]) => [...new Set(gs.map((g) => g.toLowerCase()))].filter((g) => letterOf.has(g));
const tmdbOf = (w: WorkCard) => idsOf(w)?.tmdb;
const tvOf = (w: WorkCard): number | undefined => {
  const imdb = idsOf(w)?.imdb;
  return imdb ? tvFromId.get(imdb) ?? tvTags[imdb]?.tv ?? finds.get(imdb)?.tv : undefined;
};
/** прежний набор (src/mocks/filmGenres.ts до 23.10) — только фильмы с номером TMDb */
const genresBefore = (w: WorkCard): string[] => {
  const t = isFilm(w) ? tmdbOf(w) : undefined;
  return t != null ? known(filmTags[String(t)]?.genres ?? []) : [];
};
const tmdbHit = (w: WorkCard): Hit | undefined => {
  if (isFilm(w)) { const t = tmdbOf(w); return t != null ? movieHits.get(t) : undefined; }
  const tv = tvOf(w);
  return tv != null ? tvHits.get(tv) : undefined;
};
const tmdbGenres = (w: WorkCard): string[] => {
  const before = genresBefore(w);
  if (before.length) return before;
  const h = tmdbHit(w);
  if (h?.g?.length) return [...new Set(h.g.flatMap((i) => TMDB_GENRE[i] ?? []))];
  const imdb = idsOf(w)?.imdb;
  return isSeries(w) && imdb ? known(tvTags[imdb]?.genres ?? []) : [];
};
const tmdbCountries = (w: WorkCard): string[] => {
  const h = tmdbHit(w);
  if (!h || h.none) return [];
  const [a, b] = isSeries(w) ? [h.oc, h.pc] : [h.pc, h.oc];
  return [...new Set((a?.length ? a : b ?? []).map((c) => (c === 'XI' ? 'GB' : c)))];
};
const cardCountries = (w: WorkCard): string[] => w.countries ?? [];

// ── что спрашивать ────────────────────────────────────────────────────────────────────────────────────
/** Запросы ключа по старшинству: номер TMDb своего вида, IMDb, элемент напрямую. Берётся первый, что нашёл элемент. */
const asksOf = (k: string): [string, string][] => {
  const w = cardOf.get(k)!;
  const ids = idsOf(w);
  const out: [string, string][] = [];
  if (isFilm(w) && ids?.tmdb != null) out.push(['P4947', String(ids.tmdb)]);
  if (isSeries(w)) { const tv = tvOf(w); if (tv != null) out.push(['P4983', String(tv)]); }
  if (ids?.imdb && /^tt\d+$/.test(ids.imdb)) out.push(['P345', ids.imdb]);
  const q = qidOf.get(k);
  if (q) out.push(['Q', q]);
  return out;
};
const itemsOf = (k: string): Item[] => {
  for (const [p, v] of asksOf(k)) { const r = rows.get(`${p}=${v}`); if (r?.it.length) return r.it; }
  return [];
};

// ── сеть ──────────────────────────────────────────────────────────────────────────────────────────────
const UA = 'transformative-media/0.1 (recomend: genre/country fill for taste anchor; https://github.com/dmitry00-00/Recommend)';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let lastAt = 0, asked = 0, failed = 0;
type Binding = Record<string, { value: string } | undefined>;
async function sparql(query: string): Promise<Binding[] | undefined> {
  for (let a = 0; a < 5; a++) {
    // не чаще раза в секунду — от начала прошлого запроса
    const wait = lastAt + 1000 - Date.now();
    if (wait > 0) await sleep(wait);
    lastAt = Date.now();
    asked++;
    const r = await fetch('https://query.wikidata.org/sparql', {
      method: 'POST',
      headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded', accept: 'application/sparql-results+json' },
      body: new URLSearchParams({ query }),
      signal: AbortSignal.timeout(90_000),
    }).catch((e: Error) => { console.log(`  сбой связи: ${e.message}`); return undefined; });
    if (r?.ok) {
      const j = await r.json().catch(() => undefined) as { results?: { bindings?: Binding[] } } | undefined;
      if (j?.results?.bindings) return j.results.bindings;
    }
    if (r && r.status !== 429 && r.status < 500 && !r.ok) { console.log(`  SPARQL ${r.status}: ${(await r.text()).slice(0, 200)}`); break; }
    const ra = Number(r?.headers.get('retry-after')) || 0;
    await sleep(Math.max(ra * 1000, 5000 * 2 ** a));
  }
  failed++;
  return undefined;
}
const qOf = (uri?: string) => uri?.replace('http://www.wikidata.org/entity/', '');
const split = (s?: string) => (s ? s.split(' ').map((x) => qOf(x)!).filter((x) => /^Q\d+$/.test(x)) : []);
const BATCH = 250;
let budget = LIMIT;

async function askItems(p: string, values: string[]) {
  for (let i = 0; i < values.length && budget > 0; i += BATCH, budget--) {
    const part = values.slice(i, i + BATCH);
    const vals = p === 'Q' ? part.map((q) => `wd:${q}`).join(' ') : part.map((v) => JSON.stringify(v)).join(' ');
    const head = p === 'Q' ? `VALUES ?item { ${vals} } BIND(STRAFTER(STR(?item), "/entity/") AS ?v)` : `VALUES ?v { ${vals} } ?item wdt:${p} ?v .`;
    const b = await sparql(`SELECT ?v ?item (GROUP_CONCAT(DISTINCT ?g; separator=" ") AS ?gs) (GROUP_CONCAT(DISTINCT ?t; separator=" ") AS ?ts)
  (GROUP_CONCAT(DISTINCT ?c; separator=" ") AS ?cs) WHERE {
  ${head}
  OPTIONAL { ?item wdt:P136 ?g }
  OPTIONAL { ?item wdt:P31 ?t }
  OPTIONAL { ?item wdt:P495 ?c }
} GROUP BY ?v ?item`);
    if (!b) continue; // сбой — не помечаем, спросим в следующий раз
    const by = new Map<string, Item[]>(part.map((v) => [v, []]));
    for (const x of b) {
      const v = x.v?.value, q = qOf(x.item?.value);
      if (!v || !q || !by.has(v)) continue;
      // элемент напрямую, но такого нет (удалён/перенаправлен без видов) — не элемент
      const it: Item = { q, g: split(x.gs?.value), t: split(x.ts?.value), c: split(x.cs?.value) };
      if (p === 'Q' && !it.t.length && !it.g.length && !it.c.length) continue;
      by.get(v)!.push(it);
    }
    for (const [v, it] of by) { const r: Row = { p, v, it }; rows.set(`${p}=${v}`, r); put('items', r); }
    if (asked % 20 === 0) console.log(`  ${p}: ${Math.min(i + BATCH, values.length)}/${values.length} за ${Math.round((Date.now() - t0) / 1000)} с`);
  }
}
async function askClasses(qs: string[]) {
  for (let i = 0; i < qs.length && budget > 0; i += 400, budget--) {
    const part = qs.slice(i, i + 400);
    const b = await sparql(`SELECT ?c (GROUP_CONCAT(DISTINCT ?u; separator=" ") AS ?us) (SAMPLE(?l) AS ?en) WHERE {
  VALUES ?c { ${part.map((q) => `wd:${q}`).join(' ')} }
  OPTIONAL { ?c wdt:P279 ?u }
  OPTIONAL { ?c rdfs:label ?l FILTER(LANG(?l) = "en") }
} GROUP BY ?c`);
    if (!b) continue;
    const seen = new Set<string>();
    for (const x of b) {
      const q = qOf(x.c?.value);
      if (!q) continue;
      seen.add(q);
      const r: Cls = { q, up: split(x.us?.value), ...(x.en?.value ? { en: x.en.value } : {}) };
      classes.set(q, r); put('classes', r);
    }
    for (const q of part) if (!seen.has(q)) { const r: Cls = { q, up: [] }; classes.set(q, r); put('classes', r); }
  }
}
async function askCountries(qs: string[]) {
  for (let i = 0; i < qs.length && budget > 0; i += 400, budget--) {
    const part = qs.slice(i, i + 400);
    const b = await sparql(`SELECT ?c (SAMPLE(?i) AS ?iso) (GROUP_CONCAT(DISTINCT ?t; separator=" ") AS ?ts) (SAMPLE(?l) AS ?en) WHERE {
  VALUES ?c { ${part.map((q) => `wd:${q}`).join(' ')} }
  OPTIONAL { ?c wdt:P297 ?i }
  OPTIONAL { ?c wdt:P31 ?t }
  OPTIONAL { ?c rdfs:label ?l FILTER(LANG(?l) = "en") }
} GROUP BY ?c`);
    if (!b) continue;
    const seen = new Set<string>();
    for (const x of b) {
      const q = qOf(x.c?.value);
      if (!q) continue;
      seen.add(q);
      const r: Country = { q, ...(x.iso?.value ? { iso: x.iso.value } : {}), t: split(x.ts?.value), ...(x.en?.value ? { en: x.en.value } : {}) };
      countries.set(q, r); put('countries', r);
    }
    for (const q of part) if (!seen.has(q)) { const r: Country = { q, t: [] }; countries.set(q, r); put('countries', r); }
  }
}

const want = POOL_ONLY ? poolKeys : [...poolKeys, ...allKeys.filter((k) => !pool.has(k))];
if (NET) {
  // по старшинству: сначала основной номер у всех, затем запасные — только тем, кого основной не нашёл
  for (const p of ['P4947', 'P4983', 'P345', 'Q']) {
    const values = new Set<string>();
    for (const k of want) {
      if (itemsOf(k).length) continue;
      for (const [pp, v] of asksOf(k)) if (pp === p && !rows.has(`${p}=${v}`)) values.add(v);
    }
    if (values.size) { console.log(`спросить ${p}: ${values.size}`); await askItems(p, [...values]); }
  }
  // классы жанров и их предки до DEPTH шагов
  let level = new Set<string>();
  for (const k of want) for (const it of itemsOf(k)) for (const q of [...it.g, ...it.t]) level.add(q);
  for (let d = 0; d <= DEPTH && level.size; d++) {
    const ask = [...level].filter((q) => !classes.has(q));
    if (ask.length) { console.log(`классы, шаг ${d}: ${ask.length}`); await askClasses(ask); }
    const next = new Set<string>();
    for (const q of level) if (!GENRE_Q[q]) for (const u of classes.get(q)?.up ?? []) next.add(u);
    level = next;
  }
  const cs = new Set<string>();
  for (const k of want) for (const it of itemsOf(k)) for (const c of it.c) if (!countries.has(c)) cs.add(c);
  if (cs.size) { console.log(`страны: ${cs.size}`); await askCountries([...cs]); }
  console.log(`SPARQL: ${asked} запросов, сбоев ${failed}, ${Math.round((Date.now() - t0) / 1000)} с`);
  if (asked) put('runs', { at: new Date().toISOString(), asked, failed, sec: Math.round((Date.now() - t0) / 1000) });
}

// ── сведение ──────────────────────────────────────────────────────────────────────────────────────────
const memo = new Map<string, string[]>();
/** Наши жанры класса Wikidata: строка таблицы, иначе — ближайшие предки по P279 (по каждой ветви — первый с соответствием). */
function mapClass(q: string, depth = 0, path = new Set<string>()): string[] {
  if (GENRE_Q[q]) return GENRE_Q[q];
  if (depth === 0 && memo.has(q)) return memo.get(q)!;
  let out: string[] = [];
  if (depth < DEPTH && !path.has(q)) {
    path.add(q);
    out = [...new Set((classes.get(q)?.up ?? []).flatMap((u) => mapClass(u, depth + 1, path)))];
    path.delete(q);
  }
  if (depth === 0) memo.set(q, out);
  return out;
}
const kids = (gs: string[], series: boolean) => [...new Set(gs.map((g) => (g === KIDS ? (series ? 'детский' : 'семейный') : g)))];
function wdGenres(k: string): string[] {
  const w = cardOf.get(k)!;
  const gs: string[] = [];
  for (const it of itemsOf(k)) {
    for (const q of it.g) gs.push(...mapClass(q));
    for (const q of it.t) gs.push(...mapClass(q).filter((g) => FROM_P31.has(g)));
  }
  const series = isSeries(w);
  // «телевизионный фильм» у сериала — не жанр (P31 «телефильм» бывает у мини-сериалов)
  return kids(gs, series).filter((g) => letterOf.has(g) && !(series && g === 'телевизионный фильм'));
}
const unknownCountries = new Map<string, number>();
function isoOf(q: string): string | undefined {
  if (COUNTRY_Q[q]) return COUNTRY_Q[q];
  const c = countries.get(q);
  if (c?.iso) return c.iso;
  unknownCountries.set(q, (unknownCountries.get(q) ?? 0) + 1);
  return undefined;
}
function wdCountries(k: string): string[] {
  return [...new Set(itemsOf(k).flatMap((it) => it.c.flatMap((q) => isoOf(q) ?? [])))];
}

// ── итоговый файл (--final, 23.10) ─────────────────────────────────────────────────────────────────────
if (FINAL) {
  /** прежний набор — ровно как пишет tools/film-genres.mts: ключи по номеру, жанры как в кэше (не через known) */
  const before: Record<string, string[]> = {};
  for (const id of Object.keys(filmTags).sort((a, b) => Number(a) - Number(b))) {
    const g = filmTags[id].genres ?? [];
    if (g.length) before[`tmdb:${id}`] = g;
  }

  // новинки: год ≥ 2025 или год 0 у карточки из filmBaseMore (см. шапку)
  const moreKeys = new Set(filmBaseMore.map((w) => primaryKey(normalizeWork(w), idsOf(w))).filter((k): k is string => Boolean(k)));
  const isNew = (k: string) => { const y = cardOf.get(k)!.year || 0; return y >= 2025 || (!y && moreKeys.has(k)); };
  const tmdbNeeded = (k: string) => !before[k] && isNew(k) && !wdGenres(k).length;
  {
    const fresh = allKeys.filter(isNew), zero = fresh.filter((k) => !cardOf.get(k)!.year);
    console.log(`новинок: ${fresh.length} (в пуле подбора ${fresh.filter((k) => pool.has(k)).length}; год 0 из filmBaseMore — ${zero.length}), `
      + `без жанров Wikidata и прежнего набора — ${fresh.filter(tmdbNeeded).length} (год 0 — ${zero.filter(tmdbNeeded).length})`);
  }

  if (NET) {
    // TMDb — только новинки без жанров Wikidata, номер которых ещё не спрашивали (ответы — в тот же кэш, что у fill-genres-tmdb)
    loadEnvFile();
    const key = process.env.TMDB_API_KEY ?? process.env.VITE_TMDB_API_KEY;
    const ask = allKeys.filter(tmdbNeeded).map((k) => cardOf.get(k)!).filter((w) => !tmdbHit(w));
    if (ask.length && !key) console.log(`TMDb: новинок без жанров ${ask.length}, но нет TMDB_API_KEY — пропускаю`);
    else if (ask.length) {
      type Detail = { genres?: { id: number }[]; production_countries?: { iso_3166_1: string }[]; origin_country?: string[] };
      const api = async <T,>(path: string): Promise<T | null | undefined> => {
        for (let a = 0; a < 3; a++) {
          await sleep(100); // ~10 в секунду: новинок за ночь — десятки
          const r = await fetch(`https://api.themoviedb.org/3${path}${path.includes('?') ? '&' : '?'}api_key=${key}`, { signal: AbortSignal.timeout(30_000) }).catch(() => undefined);
          if (r?.status === 404) return null;
          if (r?.ok) return await r.json() as T;
          await sleep((Number(r?.headers.get('retry-after')) || 2 * (a + 1)) * 1000);
        }
        return undefined;
      };
      const hit = (id: number, d: Detail | null): Hit => (d === null ? { id, none: true }
        : { id, g: (d.genres ?? []).map((g) => g.id), pc: (d.production_countries ?? []).map((c) => c.iso_3166_1), oc: d.origin_country ?? [] });
      const tmdbPut = (name: string, row: object) => appendFileSync(`${TMDB_DIR}/${name}.jsonl`, JSON.stringify(row) + '\n');
      let n = 0;
      for (const w of ask) {
        if (isFilm(w)) {
          const t = tmdbOf(w);
          if (t == null || movieHits.has(t)) continue;
          const d = await api<Detail>(`/movie/${t}?language=ru-RU`);
          if (d !== undefined) { const h = hit(t, d); movieHits.set(t, h); tmdbPut('movie', h); n++; }
          continue;
        }
        const imdb = idsOf(w)?.imdb;
        if (!imdb) continue;
        let tv = tvOf(w);
        if (tv == null && !finds.has(imdb)) {
          const f = await api<{ tv_results?: { id: number }[]; movie_results?: { id: number }[] }>(`/find/${imdb}?external_source=imdb_id`);
          if (f === undefined) continue;
          const row = { imdb, ...(f?.tv_results?.[0] ? { tv: f.tv_results[0].id } : {}), ...(f?.movie_results?.[0] ? { movie: f.movie_results[0].id } : {}) };
          finds.set(imdb, row); tmdbPut('find', row); n++;
          tv = row.tv;
        }
        if (tv == null || tvHits.has(tv)) continue;
        const d = await api<Detail>(`/tv/${tv}?language=ru-RU`);
        if (d !== undefined) { const h = hit(tv, d); tvHits.set(tv, h); tmdbPut('tv', h); n++; }
      }
      console.log(`TMDb: новинок без жанров Wikidata ${ask.length}, запросов ${n}`);
    }
  }

  // дозаполнение: жанры тем, кого прежний набор не знает (Wikidata, у новинки без неё — TMDb); страны Wikidata — тем, у
  // чьей карточки их нет. Ключ → [буквы жанров, коды стран, жанры из TMDb]
  const fill = new Map<string, [string, string, boolean]>();
  for (const k of allKeys) {
    const w = cardOf.get(k)!;
    let g: string[] = [], fromTmdb = false;
    if (!before[k]) {
      g = wdGenres(k);
      if (!g.length && tmdbNeeded(k)) { g = tmdbGenres(w).filter((x) => letterOf.has(x)); fromTmdb = g.length > 0; }
    }
    const c = !cardCountries(w).length ? wdCountries(k) : [];
    if (!g.length && !c.length) continue;
    fill.set(k, [g.map((x) => letterOf.get(x)!).join(''), c.join(''), fromTmdb]);
  }
  const badCode = [...new Set([...fill.values()].flatMap(([, c]) => c.match(/../g) ?? []))].filter((c) => !/^[A-Z]{2}$/.test(c));
  if (badCode.length) { console.error(`коды стран не из двух латинских букв: ${badCode.join(', ')}`); process.exit(1); }
  // Сжато (23.10): кусок грузится с первой лентой новичка, а ключей ~45 тыс. По виду ключа — номера по возрастанию, запись —
  // «шаг номера в base36,жанры строчными буквами + коды стран подряд», через «;». Ключи не того вида (у IMDb — номер не
  // восстанавливается до семи цифр) — как есть, в X.
  const PREFIX: [string, RegExp][] = [['tmdb:', /^tmdb:(\d+)$/], ['imdb:tt', /^imdb:tt(\d{7,})$/], ['wd:Q', /^wd:Q(\d+)$/]];
  const lanes = new Map<string, [number, string][]>(PREFIX.map(([p]) => [p, []]));
  const raw: Record<string, string> = {};
  for (const [k, [g, c]] of fill) {
    const v = g + c;
    const hit = PREFIX.find(([, re]) => re.test(k));
    const n = hit ? Number(hit[1].exec(k)![1]) : NaN;
    const back = hit && (hit[0] === 'imdb:tt' ? `imdb:tt${String(n).padStart(7, '0')}` : `${hit[0]}${n}`);
    if (hit && back === k && Number.isSafeInteger(n)) lanes.get(hit[0])!.push([n, v]); else raw[k] = v;
  }
  const D: Record<string, string> = {};
  for (const [p, xs] of lanes) {
    xs.sort((a, b) => a[0] - b[0]);
    let prev = 0;
    D[p] = xs.map(([n, v]) => { const s = `${(n - prev).toString(36)},${v}`; prev = n; return s; }).join(';');
  }
  const day = new Date().toISOString().slice(0, 10);
  // прежний набор — тем же текстом, что писал tools/film-genres.mts (меняется только строка «сгенерировано»)
  const oldSrc = `// Сгенерировано tools/fill-genres-wikidata.mts --final (${day}): жанры фильмов TMDb по-русски,
// ключ — «tmdb:<id фильма>». Нужны якорю вкуса новичка (src/lib/model/taste.ts). Прежний набор (.cache/tmdb-tags.json),
// как писал tools/film-genres.mts; дозаполненное Wikidata и страны — src/mocks/filmGenresFill.ts. Не править руками — перегенерировать.
export const filmGenres: Record<string, string[]> = {
${Object.entries(before).map(([k, g]) => `  ${JSON.stringify(k)}: ${JSON.stringify(g)},`).join('\n')}
};
`;
  const fillSrc = `// Сгенерировано tools/fill-genres-wikidata.mts --final (${day}): дозаполнение жанров и стран для якоря вкуса
// (src/lib/model/taste.ts, флаг anchorFill). Ленивый кусок: loadGenres в src/api/index.ts грузит его только с флагом.
// Ключ — как у разборов: фильм «tmdb:<id>», сериал «imdb:<tt…>», фильм без TMDb — «wd:<Q>». Жанры — тем, кого не знает
// src/mocks/filmGenres.ts: Wikidata (CC0, P136/P31), у новинок без неё — TMDb; страны — Wikidata (P495), только тем, у
// чьей карточки их нет. В D — по виду ключа: «шаг номера в base36,буквы жанров (G) + коды ISO стран подряд», через «;».
// Не править руками — перегенерировать.
const G = ${JSON.stringify(LETTERS)};
const D: Record<string, string> = ${JSON.stringify(D, null, 0).replace(/^\{/, '{\n').replace(/","/g, '",\n"').replace(/\}$/, '\n}')};
const X: Record<string, string> = ${JSON.stringify(raw)};
/** жанры по-русски тем, кого нет в filmGenres: фильмы «tmdb:»/«wd:» и сериалы «imdb:» (составные жанры TMDb разложены) */
export const filmGenresFill: Record<string, string[]> = {};
/** ключ → коды ISO стран происхождения, если у карточки стран нет; перевод — countryRu */
export const filmCountries: Record<string, string[]> = {};
const shared = new Map<string, string[]>();
const list = (s: string, step: number, at: (i: number) => string) => {
  const hit = shared.get(s);
  if (hit) return hit;
  const out: string[] = [];
  for (let i = 0; i < s.length; i += step) out.push(at(i));
  shared.set(s, out);
  return out;
};
const put = (k: string, v: string) => {
  let i = 0;
  while (i < v.length && v.charCodeAt(i) >= 97) i++;
  if (i) filmGenresFill[k] = list(v.slice(0, i), 1, (j) => G[v.charCodeAt(j) - 97]);
  if (i < v.length) { const c = v.slice(i); filmCountries[k] = list(c, 2, (j) => c.slice(j, j + 2)); }
};
for (const p in D) {
  let n = 0;
  for (const e of D[p].split(';')) {
    const j = e.indexOf(',');
    n += parseInt(e.slice(0, j), 36);
    put(p + (p === 'imdb:tt' ? String(n).padStart(7, '0') : n), e.slice(j + 1));
  }
}
for (const k in X) put(k, X[k]);
`;
  // сначала — в .cache и проверка: прежний экспорт ровно тот же, дозаполнение разворачивается в то, что задумано
  mkdirSync('.cache/film-genres-next', { recursive: true });
  const nextOld = '.cache/film-genres-next/filmGenres.ts', nextFill = '.cache/film-genres-next/filmGenresFill.ts';
  writeFileSync(nextOld, oldSrc);
  writeFileSync(nextFill, fillSrc);
  const stamp = `?t=${Date.now()}`;
  const mo = await import(pathToFileURL(resolve(nextOld)).href + stamp) as { filmGenres: Record<string, string[]> };
  const mf = await import(pathToFileURL(resolve(nextFill)).href + stamp) as { filmGenresFill: Record<string, string[]>; filmCountries: Record<string, string[]> };
  if (JSON.stringify(mo.filmGenres) !== JSON.stringify(before)) { console.error(`filmGenres не совпал с прежним набором — src/mocks не тронут`); process.exit(1); }
  const wantG = Object.fromEntries([...fill].filter(([, [g]]) => g).map(([k, [g]]) => [k, Array.from(g, (x) => LETTERS[x.charCodeAt(0) - 97])]));
  const wantC = Object.fromEntries([...fill].filter(([, [, c]]) => c).map(([k, [, c]]) => [k, c.match(/../g)!]));
  const same = (a: Record<string, string[]>, b: Record<string, string[]>) =>
    Object.keys(a).length === Object.keys(b).length && Object.keys(a).every((k) => JSON.stringify(a[k]) === JSON.stringify(b[k]));
  if (!same(mf.filmGenresFill, wantG) || !same(mf.filmCountries, wantC)) { console.error('дозаполнение не разворачивается в задуманное — src/mocks не тронут'); process.exit(1); }
  copyFileSync(nextOld, FINAL_OUT);
  copyFileSync(nextFill, FILL_OUT);

  // покрытие с флагом anchorFill — как увидит якорь: жанры filmGenres ?? filmGenresFill, страны — карточки, иначе filmCountries
  const pct = (a: number, b: number) => (b ? `${(Math.round((a / b) * 1000) / 10).toFixed(1)}%` : '—');
  const cover = (label: string, keys: string[]) => {
    let g = 0, c = 0, g0 = 0, c0 = 0;
    for (const k of keys) {
      const w = cardOf.get(k)!;
      if (isFilm(w) && mo.filmGenres[k]) g0++;
      if (cardCountries(w).length) c0++;
      if (mo.filmGenres[k] ?? mf.filmGenresFill[k]) g++;
      if (cardCountries(w).length || mf.filmCountries[k]) c++;
    }
    console.log(`${label}: ${keys.length} — жанры ${pct(g0, keys.length)} → ${pct(g, keys.length)}, страны ${pct(c0, keys.length)} → ${pct(c, keys.length)}`);
  };
  cover('пул первой ленты', [...firstPool]);
  cover('пул подбора', poolKeys);
  cover('весь справочник кино', allKeys);
  const filled = [...fill.values()].filter(([g]) => g), tm = filled.filter(([, , t]) => t).length;
  const nOld = Object.keys(before).length;
  console.log(`→ ${FINAL_OUT}: прежний набор TMDb, ${nOld} фильмов; → ${FILL_OUT}: ${fill.size} ключей — жанры ${filled.length} `
    + `(Wikidata ${filled.length - tm}, TMDb-новинки ${tm}), страны Wikidata ${Object.keys(wantC).length}`);
  console.log(`  жанры из TMDb итого: ${nOld + tm} записей из ${nOld + filled.length} (прежний набор ${nOld} + новинки ${tm})`);
  for (const [f, s] of [[FINAL_OUT, oldSrc], [FILL_OUT, fillSrc]] as const) {
    console.log(`  ${f}: ${Math.round(statSync(f).size / 1024)} КБ, gzip ${Math.round(gzipSync(s).length / 1024)} КБ, brotli ${Math.round(brotliCompressSync(s).length / 1024)} КБ`);
  }
  process.exit(0);
}

// ── сравнение ─────────────────────────────────────────────────────────────────────────────────────────
const pct = (a: number, b: number) => (b ? `${(Math.round((a / b) * 1000) / 10).toFixed(1)}%` : '—');
const ruSet = (cs: string[]) => new Set(cs.map((c) => countryRu(c)));
const jaccard = (a: string[], b: string[]) => {
  const A = new Set(a), B = new Set(b);
  const inter = [...A].filter((x) => B.has(x)).length;
  return inter / (A.size + B.size - inter || 1);
};
/** Составные жанры сериалов TMDb («Боевик и приключения», «НФ и фэнтези») — одной парой: иначе Wikidata «наказана» за
 *  то, что пишет одно из двух */
const fold = (gs: string[]) => [...new Set(gs.map((g) => (g === 'приключения' ? 'боевик' : g === 'фэнтези' ? 'фантастика' : g)))];
const year = (w: WorkCard) => w.year || 0;
function bucketsOf(k: string): string[] {
  const w = cardOf.get(k)!;
  const cs = new Set([...ruSet(cardCountries(w)), ...ruSet(tmdbCountries(w)), ...ruSet(wdCountries(k))]);
  const out: string[] = [];
  if (cs.has('СССР') || (cs.has('Россия') && year(w) && year(w) < 1992)) out.push('советское');
  else if (cs.has('Россия')) out.push('российское');
  if (isSeries(w)) out.push('сериалы'); else out.push('фильмы');
  if (year(w) >= 2025) out.push('новинки 2025–2026');
  if (k.startsWith('wd:')) out.push('без TMDb (ключ wd:)');
  return out;
}

type Acc = { n: number; gW: number; gT: number; gU: number; gF: number; cCard: number; cW: number; cT: number; cWc: number; cTc: number; cU: number;
  both: number; jac: number; jacF: number; exact: number; cBoth: number; cSame: number; cOver: number; cBothCard: number; cSameCard: number;
  nW: number; nT: number; prec: number; rec: number; anyHit: number };
const acc = (): Acc => ({ n: 0, gW: 0, gT: 0, gU: 0, gF: 0, cCard: 0, cW: 0, cT: 0, cWc: 0, cTc: 0, cU: 0, both: 0, jac: 0, jacF: 0, exact: 0, cBoth: 0, cSame: 0, cOver: 0, cBothCard: 0, cSameCard: 0, nW: 0, nT: 0, prec: 0, rec: 0, anyHit: 0 });
const diffs: { k: string; w: WorkCard; kind: string; t: string; d: string; j: number }[] = [];
function measure(keys: string[], collect = false) {
  const total = acc();
  const by = new Map<string, Acc>();
  for (const k of keys) {
    const w = cardOf.get(k)!;
    const gW = wdGenres(k), gT = tmdbGenres(w);
    const cW = wdCountries(k), cT = tmdbCountries(w), cC = cardCountries(w);
    const bs = ['всего', ...bucketsOf(k)];
    for (const b of bs) {
      const a = b === 'всего' ? total : by.get(b) ?? by.set(b, acc()).get(b)!;
      a.n++;
      if (gW.length) a.gW++;
      if (gT.length) a.gT++;
      if (gW.length || gT.length) a.gU++;
      if (genresBefore(w).length || gW.length) a.gF++;
      if (cC.length) a.cCard++;
      if (cW.length) a.cW++;
      if (cT.length) a.cT++;
      if (cC.length || cW.length) a.cWc++;
      if (cC.length || cT.length) a.cTc++;
      if (cC.length || cW.length || cT.length) a.cU++;
      if (gW.length && gT.length) {
        a.both++; a.jac += jaccard(gW, gT); a.jacF += jaccard(fold(gW), fold(gT));
        if (jaccard(gW, gT) === 1) a.exact++;
        // точность (доля жанров WD, что есть у TMDb), полнота (доля жанров TMDb, что есть у WD), хоть один общий
        const W = new Set(gW), T = new Set(gT), inter = [...W].filter((x) => T.has(x)).length;
        a.nW += W.size; a.nT += T.size; a.prec += inter / W.size; a.rec += inter / T.size; if (inter) a.anyHit++;
      }
      if (cW.length && cT.length) {
        a.cBoth++;
        const W = ruSet(cW), T = ruSet(cT);
        if (W.size === T.size && [...W].every((x) => T.has(x))) a.cSame++;
        if ([...W].some((x) => T.has(x))) a.cOver++;
      }
      if (cW.length && cC.length) {
        a.cBothCard++;
        const W = ruSet(cW), C = ruSet(cC);
        if ([...W].some((x) => C.has(x))) a.cSameCard++;
      }
    }
    if (collect && gW.length && gT.length && jaccard(gW, gT) < 0.34) diffs.push({ k, w, kind: 'жанры', t: gT.join(', '), d: gW.join(', '), j: jaccard(gW, gT) });
    if (collect && cW.length && cT.length && ![...ruSet(cW)].some((x) => ruSet(cT).has(x))) diffs.push({ k, w, kind: 'страны', t: cT.join(' '), d: cW.join(' '), j: 0 });
  }
  return { total, by };
}

const report: string[] = [];
const say = (s = '') => { console.log(s); report.push(s); };
say(`# Жанры и страны: TMDb против Wikidata (${new Date().toISOString().slice(0, 10)})`);
say();
say('Сделано tools/fill-genres-wikidata.mts. TMDb — то, что дал tools/fill-genres-tmdb.mts (прежний набор .cache/tmdb-tags.json + дозаполнение 23.10,');
say('кэш .cache/tmdb-genres); Wikidata — P136 (+ P31 для мультфильма/документального/ТВ-видов) и P495, кэш .cache/wikidata-genres.');
say('Страны «с карточкой» — свои страны карточки (baseMedia, seriesBase и др.) плюс источник там, где у карточки пусто.');
say();
function table(label: string, keys: string[]) {
  const { total, by } = measure(keys, label === 'пул подбора');
  say(`## ${label}: ${total.n}`);
  say();
  say('| корзина | n | жанры WD | жанры TMDb | жанры WD∪TMDb | прежний+WD | страны карточки | +WD | +TMDb | +оба | WD сама | TMDb сама |');
  say('|---|---|---|---|---|---|---|---|---|---|---|---|');
  const line = (b: string, a: Acc) => say(`| ${b} | ${a.n} | ${pct(a.gW, a.n)} | ${pct(a.gT, a.n)} | ${pct(a.gU, a.n)} | ${pct(a.gF, a.n)} | ${pct(a.cCard, a.n)} | ${pct(a.cWc, a.n)} | ${pct(a.cTc, a.n)} | ${pct(a.cU, a.n)} | ${pct(a.cW, a.n)} | ${pct(a.cT, a.n)} |`);
  const order = ['фильмы', 'сериалы', 'советское', 'российское', 'новинки 2025–2026', 'без TMDb (ключ wd:)'];
  line('всего', total);
  for (const b of order) if (by.has(b)) line(b, by.get(b)!);
  say();
  say('Совпадение там, где есть оба:');
  say();
  say('| корзина | жанры: оба | Жаккар | Жаккар (пары TMDb сложены) | жанры точь-в-точь | хоть один общий | точность WD | полнота WD | жанров WD / TMDb | страны: оба | страны те же | страны пересекаются | WD vs страны карточки: пересекаются |');
  say('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  const agree = (b: string, a: Acc) => say(`| ${b} | ${a.both} | ${a.both ? (a.jac / a.both).toFixed(3) : '—'} | ${a.both ? (a.jacF / a.both).toFixed(3) : '—'} | ${pct(a.exact, a.both)} | ${pct(a.anyHit, a.both)} | ${a.both ? (a.prec / a.both).toFixed(2) : '—'} | ${a.both ? (a.rec / a.both).toFixed(2) : '—'} | ${a.both ? `${(a.nW / a.both).toFixed(1)} / ${(a.nT / a.both).toFixed(1)}` : '—'} | ${a.cBoth} | ${pct(a.cSame, a.cBoth)} | ${pct(a.cOver, a.cBoth)} | ${pct(a.cSameCard, a.cBothCard)} (${a.cBothCard}) |`);
  agree('всего', total);
  for (const b of order) if (by.has(b)) agree(b, by.get(b)!);
  say();
}
table('пул первой ленты', [...firstPool]);
table('пул подбора', poolKeys);
if (!POOL_ONLY) table('весь справочник кино', allKeys);

// примеры расхождений — по 10 жанров и стран, сначала из пула первой ленты, разные корзины
{
  const pick = (kind: string) => {
    const xs = diffs.filter((d) => d.kind === kind).sort((a, b) => Number(firstPool.has(b.k)) - Number(firstPool.has(a.k)) || year(b.w) - year(a.w));
    const out: typeof xs = [];
    const step = Math.max(1, Math.floor(xs.length / 10));
    for (let i = 0; i < xs.length && out.length < 10; i += step) out.push(xs[i]);
    return out;
  };
  say(`## 20 примеров расхождений (пул подбора; жанров с Жаккаром < 0,34 — ${diffs.filter((d) => d.kind === 'жанры').length}, стран без пересечения — ${diffs.filter((d) => d.kind === 'страны').length})`);
  say();
  say('| что | ключ | название | год | TMDb | Wikidata | элемент |');
  say('|---|---|---|---|---|---|---|');
  for (const d of [...pick('жанры'), ...pick('страны')]) {
    say(`| ${d.kind} | ${d.k} | ${d.w.title.replace(/\|/g, '/')} | ${year(d.w) || '—'} | ${d.t} | ${d.d} | ${itemsOf(d.k).map((i) => i.q).join(' ')} |`);
  }
  say();
}

// какие ключи элемент нашли и чем
{
  const via = new Map<string, number>();
  let none = 0, noAsk = 0;
  for (const k of poolKeys) {
    const a = asksOf(k);
    if (!a.length) { noAsk++; continue; }
    const hit = a.find(([p, v]) => rows.get(`${p}=${v}`)?.it.length);
    if (hit) via.set(hit[0], (via.get(hit[0]) ?? 0) + 1); else none++;
  }
  say(`## Элемент Wikidata в пуле подбора`);
  say();
  say(`найден: ${[...via].map(([p, n]) => `${p === 'Q' ? 'по элементу' : p} — ${n}`).join(', ')}; не найден — ${none}; без номеров — ${noAsk}`);
  const codes = new Set<string>();
  for (const k of allKeys) for (const c of wdCountries(k)) codes.add(c);
  const raw = [...codes].filter((c) => countryRu(c) === c);
  say(`кодов стран из Wikidata: ${codes.size}; countryRu не переводит: ${raw.length ? raw.join(' ') : 'нет'}`);
  const top = [...unknownCountries].sort((a, b) => b[1] - a[1]).slice(0, 15);
  if (top.length) say(`страны без кода ISO (пропущены): ${top.map(([q, n]) => `${q} ${countries.get(q)?.en ?? ''} ×${n}`).join('; ')}`);
  say();
}

if (CLASSES) {
  // частые жанры Wikidata в пуле, которые не свелись ни к чему (для таблицы GENRE_Q)
  const freq = new Map<string, number>();
  for (const k of poolKeys) for (const it of itemsOf(k)) for (const q of it.g) if (!mapClass(q).length && !(q in GENRE_Q)) freq.set(q, (freq.get(q) ?? 0) + 1);
  console.log('— жанры без соответствия —');
  for (const [q, n] of [...freq].sort((a, b) => b[1] - a[1]).slice(0, 80)) console.log(`${n}\t${q}\t${classes.get(q)?.en ?? ''}\t↑ ${(classes.get(q)?.up ?? []).map((u) => `${u} ${classes.get(u)?.en ?? ''}`).join('; ')}`);
  const mapped = new Map<string, number>();
  for (const k of poolKeys) for (const it of itemsOf(k)) for (const q of it.g) if (!(q in GENRE_Q) && mapClass(q).length) mapped.set(q, (mapped.get(q) ?? 0) + 1);
  console.log('— сведённые через P279 (проверить) —');
  for (const [q, n] of [...mapped].sort((a, b) => b[1] - a[1]).slice(0, 60)) console.log(`${n}\t${q}\t${classes.get(q)?.en ?? ''}\t→ ${mapClass(q).join(', ')}`);
  // сверка таблицы: метка элемента должна совпадать с подписью в GENRE_Q
  const used = new Map<string, number>();
  for (const k of poolKeys) for (const it of itemsOf(k)) for (const q of [...it.g, ...it.t]) used.set(q, (used.get(q) ?? 0) + 1);
  console.log('— таблица GENRE_Q: метка Wikidata, сколько раз в пуле прямо —');
  for (const q of Object.keys(GENRE_Q)) console.log(`${q}\t${classes.get(q)?.en ?? '(нет в кэше)'}\t×${used.get(q) ?? 0}\t→ ${GENRE_Q[q].join(', ')}`);
}

{
  // время сети — по всем прогонам, что ходили в Wikidata (кэш копится; повтор без сети — секунды)
  const runs = readJsonl<{ asked: number; failed: number; sec: number }>(`${DIR}/runs.jsonl`);
  say(`время: этот прогон ${Math.round((Date.now() - t0) / 1000)} с${STATS ? ' (без сети)' : `, запросов SPARQL ${asked}, сбоев ${failed}`}; `
    + `сеть за все прогоны — ${runs.reduce((a, r) => a + r.asked, 0)} запросов за ${Math.round(runs.reduce((a, r) => a + r.sec, 0) / 60)} мин`);
}
writeFileSync(EVAL, report.join('\n') + '\n');
console.log(`→ ${EVAL}`);
if (STATS) process.exit(0);

// ── выход — тот же вид, что src/mocks/filmGenres.ts ──────────────────────────────────────────────────
// filmGenres — прежний набор фильмов (.cache/tmdb-tags.json) как был: лента без флага не меняется; filmGenresFill — жанры
// Wikidata тем, кого прежний набор не знает; filmCountries — страны Wikidata тем, у чьей карточки их нет
const out: [string, string, string, boolean][] = [];
const filmsFromTags = new Set(Object.keys(filmTags).filter((id) => filmTags[id].genres?.length).map((id) => `tmdb:${id}`));
for (const k of new Set([...filmsFromTags, ...allKeys])) {
  const w = cardOf.get(k);
  const before = filmsFromTags.has(k) ? known(filmTags[k.slice(5)]?.genres ?? []) : [];
  const g = before.length ? before : w ? wdGenres(k) : [];
  const c = w && !cardCountries(w).length ? wdCountries(k) : [];
  if (!g.length && !c.length) continue;
  out.push([k, g.map((x) => letterOf.get(x)!).join(''), c.join(' '), !before.length]);
}
const num = (k: string) => Number(k.replace(/^\D+/, '')) || 0;
const kind = (k: string) => k.slice(0, k.indexOf(':'));
out.sort((a, b) => kind(a[0]).localeCompare(kind(b[0])) || num(a[0]) - num(b[0]) || a[0].localeCompare(b[0]));
const body = out.map(([k, g, c, fill]) => `${JSON.stringify(k)}:${JSON.stringify(`${fill && g ? '+' : ''}${g}${c ? `|${c}` : ''}`)}`).join(',\n');
writeFileSync(OUT, `// Сгенерировано tools/fill-genres-wikidata.mts (${new Date().toISOString().slice(0, 10)}): жанры и страны для якоря вкуса
// (src/lib/model/taste.ts) — вариант на Wikidata (CC0) вместо дозаполнения TMDb. Вид — как у src/mocks/filmGenres.ts:
// ключ как у разборов (фильм «tmdb:<id>», сериал «imdb:<tt…>», без TMDb — «wd:<Q>»); буква на жанр (G); «+» впереди —
// из Wikidata (filmGenresFill), без него — прежний набор фильмов TMDb (filmGenres, как был); после «|» — коды ISO стран
// из Wikidata (P495), только тем, у чьей карточки стран нет. Не править руками — перегенерировать.
const G = ${JSON.stringify(LETTERS)};
const R: Record<string, string> = {
${body}
};
const shared = new Map<string, string[]>();
const genres = (g: string) => shared.get(g) ?? shared.set(g, Array.from(g, (c) => G[c.charCodeAt(0) - 97])).get(g)!;
/** ключ «tmdb:» → жанры фильма по-русски, как отдаёт TMDb (прежний набор, до 23.10) */
export const filmGenres: Record<string, string[]> = {};
/** из Wikidata (P136, P31): фильмы, которых не было в filmGenres, сериалы «imdb:» и фильмы без TMDb «wd:» */
export const filmGenresFill: Record<string, string[]> = {};
/** ключ → коды ISO стран происхождения (Wikidata P495), если у карточки стран нет; перевод — countryRu */
export const filmCountries: Record<string, string[]> = {};
for (const k in R) {
  const v = R[k], bar = v.indexOf('|'), fill = v[0] === '+', g = v.slice(fill ? 1 : 0, bar < 0 ? undefined : bar);
  if (g) (fill ? filmGenresFill : filmGenres)[k] = genres(g);
  if (bar >= 0) filmCountries[k] = v.slice(bar + 1).split(' ');
}
`);
const size = statSync(OUT).size;
const br = brotliCompressSync(readFileSync(OUT)).length;
console.log(`→ ${OUT}: ${out.length} ключей (из Wikidata жанров — ${out.filter((r) => r[3] && r[1]).length}, стран — ${out.filter((r) => r[2]).length}), `
  + `${Math.round(size / 1024)} КБ, brotli ${Math.round(br / 1024)} КБ`);
