// Пополнение справочника тем, что люди ищут (05.10): чтобы новый человек, набрав в поиске три
// фильма, находил их, а не пустырь. Повод: на живой встрече из трёх искомых фильмов двух не было.
//
//   npx tsx tools/grow-film-base.mts [--months 36] [--min-views 0] [--write] [--fresh]
//
// Сигнал спроса — месячные топ-1000 русской Википедии (Wikimedia Pageviews, открыто, без ключа):
// статья, попавшая в топ месяца, — это то, о чём в тот месяц читали массово. Фильмы и сериалы из
// этих топов опознаются в Wikidata по статье (CC0, решение владельца 23.09: новое — только оттуда),
// ключи TMDb и IMDb Wikidata хранит сама (P4947, P345, у сериалов P4983).
//
// Без --write — только замер: сколько популярного у нас есть и чего нет (→ .cache/grow-film-base.json).
// С --write — недостающее пишется в src/mocks/filmBasePopular.ts; прежние карточки остаются.
// Разметки у карточек нет: её дописывают черновиком (tools/draft-annotate.mts), как у остальных.
//
// --world (ЗП-22, 07.10) — то же для английской сборки и Индии:
//   npx tsx tools/grow-film-base.mts --world [--months 36] [--every 3] [--countries IN,US,GB,CA,AU] [--min-days 2] [--write]
// Спрос — суточные топ-1000 по странам (Wikimedia Pageviews, `top-per-country`: месячных по странам нет,
// поэтому берём каждые --every сутки). Статьи английской и индийских Википедий (хинди, тамильская,
// телугу, малаялам и др.) опознаются в Wikidata так же. Классика — по числу разделов Википедии:
// индийское кино (страна P495 — Индия) от 12, англоязычное (США, Великобритания, Канада, Австралия,
// Ирландия, Новая Зеландия) от 30. Замер — по регионам: Индия отдельно, англоязычные страны вместе;
// очередь черновой разметки (300 самых смотримых в каждом срезе) — в .cache/grow-film-base-world.json.
// --canon (12.10) — мировой канон по числу разделов Википедии для всех стран сразу: страны --origin и пороги
// выше оставляли дыры («Умберто Д.», «Три цвета: Белый», «Запрещённые игры», «Король-рыбак» — 30–39 разделов).
// Фильмы от --canon-links (25) из любой страны и от --canon-world-links (15), если среди стран производства нет
// США и Великобритании; сериалы — от --canon-series-links (20) и мировые от того же --canon-world-links.
// Карточки — в src/mocks/filmBaseWorld.ts: отдельно от русских топов, чтобы английская сборка (ЗП-20)
// могла брать их сама, а индекс разборов не искал однословные английские названия в русских текстах.
//
// Волна В (17.10):
//   • классы фильма в запросах классики и канона — и аниме-фильм (Q20650540), телефильм (Q506240), полнометражный
//     мультфильм (Q29168811): «Принцесса Мононоке», «Твоё имя», «Классный мюзикл» были вне канона. Аниме-сериалы
//     массово не добираем (решение владельца 17.10) — их классы в запросы классики не входят;
//   • --ru-shorts — советская и российская анимация и короткий метр со статьёй в русской Википедии («Ну, погоди!»,
//     «Ёжик в тумане», «Каток и скрипка»; решение владельца 17.10 — брать): короткометражный фильм и мультфильм,
//     мультфильм, полнометражный мультфильм; страна — СССР, Россия, РСФСР;
//   • --wd-keys — фильм без номера TMDb (P4947) заводится с ключом `wd:Q…` (externalIds.wikidata; решение владельца
//     17.10). Без флага — как раньше, «без ключа — завести нельзя». С 18.10 клиент и сервер ключ `wd:` у фильма знают
//     (src/lib/keys.ts workKeys, tools/wd-keys-test.mts); постер — tools/build-base-media.mts (P18 из Commons);
//   • --from history,kinopoisk,fresh[:ДНЕЙ],file:ПУТЬ — кандидаты не из топов, а по ключам: карточки истории владельца
//     (userHistory, userWatched — у них есть QID, IMDb или TMDb), опознанное импортом Кинопоиска
//     (.cache/kinopoisk-resolve.json, .cache/kinopoisk-wikidata.json; номер Кинопоиска → элемент по P2603, иначе по
//     TMDb P4947 и IMDb P345), вышедшее за последние ДНЕЙ (P577/P580, по умолчанию 90) и список QID из файла. Всё —
//     через Wikidata (решение владельца 23.09), сведения — тем же набором полей. С --from топы и классика не читаются;
//   • «уже есть» — по справочнику без истории владельца и демо-каталога (tools/base-have.mts): прежде 134 фильма
//     числились «есть», потому что были карточками истории, а у сервера и нового человека их нет;
//   • --report ПУТЬ — замер не в .cache/grow-film-base.json; в замере — откуда кандидат (`src`).
import { plainTitle } from './wikidata-lib.mts';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { loadEnvFile } from './env-file.mts';
import { worksIndex, analysisKeys } from './works-index.mts';
import { BASE_MODULES, baseHave, type BaseModule } from './base-have.mts';
import { draftAnnotations } from './draft-annotations.mts';
import { seriesAnnotations } from './series-annotations.mts';
import { draftReview } from '../src/mocks/draftReview.ts';
import type { WorkCard } from '../src/types/tmdf.ts';
import { isWithheld } from '../src/mocks/withheldWorks.ts';
import { adultOf } from './adult-lib.mts';

const argv = process.argv.slice(2);
const opt = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const MONTHS = Number(opt('--months') ?? 36);
const MIN_VIEWS = Number(opt('--min-views') ?? 0);
const WRITE = argv.includes('--write');
const FRESH = argv.includes('--fresh');
const WORLD = argv.includes('--world');
/** 17.10: фильм без TMDb — с ключом `wd:Q…` */
const WD_KEYS = argv.includes('--wd-keys');
/** 17.10: советская и российская анимация и короткий метр — отдельным запросом классики */
const RU_SHORTS = argv.includes('--ru-shorts');
/** 17.10: кандидаты по ключам — history, kinopoisk, fresh[:дней], file:путь */
const FROM = (opt('--from') ?? '').split(',').map((x) => x.trim()).filter(Boolean);
const COUNTRIES = (opt('--countries') ?? 'IN,US,GB,CA,AU').split(',').map((c) => c.trim().toUpperCase()).filter(Boolean);
const EVERY = Math.max(1, Number(opt('--every') ?? 3));
// суточный топ шумный: статья, мелькнувшая один раз, — чаще новость дня, чем то, что смотрят
const MIN_DAYS = Number(opt('--min-days') ?? (WORLD ? 2 : 1));
/** регион спроса: Индия отдельно, англоязычные страны вместе */
const regionOf = (c: string) => (c === 'IN' ? 'IN' : 'EN');
/** Википедии, чьи статьи опознаём в режиме --world: английская и крупные индийские */
const WIKIS = new Set(['en', 'hi', 'ta', 'te', 'ml', 'kn', 'mr', 'bn', 'gu', 'pa']);
// --out NAME (РР-5, 15.10): новые карточки — в свой модуль src/mocks/NAME.ts (ленивый, не в первой загрузке), а не в
// filmBasePopular; прежние карточки этого модуля перегенерируются, как у основного
const OUT_NAME = opt('--out') ?? (WORLD ? 'filmBaseWorld' : 'filmBasePopular');
// --world: в справочник — первые TOP каждого региона по просмотрам и классика (англоязычная — от 35 разделов)
const TOP = Number(opt('--top') ?? 1500);
const EN_CLASSIC_LINKS = 35;
// глубина очереди разметки: первые QUEUE каждого среза (второй круг ЗП-22 — 600 по индийским срезам)
const QUEUE = Number(opt('--queue') ?? 300);
// поисковый шум: «xXx» набирает просмотры запросом «xxx», а не фильмом
const NOISE = /^(en|hi):(XXX|xXx|ट्रिपल एक्स)/;
/** (без \b: в JS он не знает кириллицы) название без уточнения в скобках («Ему (фильм)», «Мадисон (телесериал)», «Kantara 2 (film)») и без раздела */
const cleanTitle = (t: string) => t.replace(/^[a-z]{2,3}:/, '')
  .replace(/\s*\((?:[^()]*(?:фильм|сериал|телесериал|мультфильм|мини-сериал|film|movie|TV series|miniseries|web series)[^()]*)\)$/iu, '').trim();
const INDIA = 'Q668';
// индийское — страна производства Индия без США и Великобритании: «Живая сталь» и «Судья Дредд» числят
// Индию в странах из-за Reliance, а «Миллионер из трущоб» — британское кино
const indian = (r: { origin?: string[] }) => Boolean(r.origin?.includes(INDIA) && !r.origin.includes('Q30') && !r.origin.includes('Q145'));
loadEnvFile();
const root = new URL('../', import.meta.url);
// Викимедиа просит представляться; строго латиницей (заголовок — ByteString)
const UA = 'recomend/0.1 (https://github.com/dmitry00-00/Recommend)';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function get<T>(url: string, form?: Record<string, string>): Promise<T | undefined> {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const res = await fetch(url, form
        ? { method: 'POST', body: new URLSearchParams(form), headers: { 'User-Agent': UA, accept: 'application/sparql-results+json', 'content-type': 'application/x-www-form-urlencoded' } }
        : { headers: { 'User-Agent': UA, accept: 'application/json' } });
      if (res.ok) return await res.json() as T;
      if (res.status === 404) return undefined;
      if (res.status === 429) await sleep((Number(res.headers.get('retry-after')) || 5) * 1000);
    } catch { /* сеть дрогнула */ }
    await sleep(1000 * (attempt + 1));
  }
  return undefined;
}

// ── 1. месячные топы ──────────────────────────────────────────────────────────
const TOP_DIR = new URL('.cache/wiki-top/', root);
mkdirSync(TOP_DIR, { recursive: true });
type Top = { article: string; views: number }[];
const now = new Date();
// ключ — название статьи; в режиме --world с языком раздела: «en:Dangal (film)», «hi:दंगल (फ़िल्म)».
// months — сколько раз статья была в топе: месяцев, а в --world суток по странам; by — просмотры по регионам
const views = new Map<string, { views: number; months: number; links?: number; by?: Record<string, number>; src?: string[] }>();
/** откуда кандидат (17.10): «топы», имя запроса классики, источник --from — для замера по пунктам */
const tag = (k: string, src: string) => { const v = views.get(k); if (v && !v.src?.includes(src)) v.src = [...(v.src ?? []), src]; };
if (WORLD) {
  const DIR = new URL('country/', TOP_DIR);
  mkdirSync(DIR, { recursive: true });
  // свежие сутки выкладываются с задержкой — начинаем с позавчера
  const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - 2 * 864e5;
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - MONTHS, now.getUTCDate());
  const days: string[] = [];
  for (let t = end; t >= start; t -= EVERY * 864e5) days.push(new Date(t).toISOString().slice(0, 10));
  const jobs = days.flatMap((d) => COUNTRIES.map((c) => ({ d, c })));
  let fetched = 0;
  let failed = 0;
  // по четыре запроса разом: 1800 суток-стран подряд — четверть часа
  for (let i = 0; i < jobs.length; i += 4) {
    await Promise.all(jobs.slice(i, i + 4).map(async ({ d, c }) => {
      const file = new URL(`${c}-${d}.json`, DIR);
      let top: [string, string, number][] | undefined = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : undefined;
      if (!top) {
        const r = await get<{ items?: { articles: { article: string; project: string; views_ceil: number }[] }[] }>(
          `https://wikimedia.org/api/rest_v1/metrics/pageviews/top-per-country/${c}/all-access/${d.replace(/-/g, '/')}`);
        const arts = r?.items?.[0]?.articles;
        if (!arts) { failed++; return; }
        // храним только статьи нужных Википедий: сутки целиком — 90 КБ
        top = arts.flatMap(({ article, project, views_ceil }) => {
          const m = /^([a-z]+)\.wikipedia$/.exec(project);
          return m && WIKIS.has(m[1]) ? [[m[1], article, views_ceil] as [string, string, number]] : [];
        });
        writeFileSync(file, JSON.stringify(top));
        fetched++;
      }
      const region = regionOf(c);
      for (const [lang, article, v] of top) {
        // служебные страницы («Special:Search», «File:…», «विशेष:खोज»): после двоеточия у них нет пробела
        if (/^[^:_]+:[^_]/.test(article)) continue;
        const k = `${lang}:${article.replace(/_/g, ' ')}`;
        const prev = views.get(k) ?? { views: 0, months: 0, by: {} };
        prev.views += v;
        prev.months += 1;
        prev.by![region] = (prev.by![region] ?? 0) + v;
        views.set(k, prev);
      }
    }));
    if (fetched && fetched % 200 < 4) console.error(`  суток-стран получено ${fetched}, из кэша ${i + 4 - fetched - failed}`);
  }
  for (const [k, v] of views) if (v.months < MIN_DAYS) views.delete(k);
  console.error(`суток ${days.length} × стран ${COUNTRIES.length}: новых ${fetched}, не получено ${failed}; статей в топах (от ${MIN_DAYS} раз): ${views.size}`);
}
for (let m = 1; m <= (WORLD || FROM.length ? 0 : MONTHS); m++) {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - m, 1));
  const ym = `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  const file = new URL(`${ym.replace('/', '-')}.json`, TOP_DIR);
  let top: Top | undefined = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : undefined;
  if (!top) {
    const r = await get<{ items?: { articles: Top }[] }>(`https://wikimedia.org/api/rest_v1/metrics/pageviews/top/ru.wikipedia/all-access/${ym}/all-days`);
    top = r?.items?.[0]?.articles.map(({ article, views }) => ({ article, views }));
    if (!top) { console.error(`  топ ${ym} не получен`); continue; }
    writeFileSync(file, JSON.stringify(top));
    await sleep(300);
  }
  for (const { article, views: v } of top) {
    if (/^(Служебная|Special|Википедия|Файл|Категория|Портал|Шаблон|Обсуждение|Заглавная_страница)/.test(article)) continue;
    const t = article.replace(/_/g, ' ');
    const prev = views.get(t) ?? { views: 0, months: 0 };
    views.set(t, { ...prev, views: prev.views + v, months: prev.months + 1 });
    tag(t, 'топы');
  }
}
if (!WORLD) console.error(`статей в топах за ${MONTHS} мес.: ${views.size}`);

// ── 1б. классика ──────────────────────────────────────────────────────────────
// Топы месяца — это то, о чём читают сейчас: премьеры, сериалы сезона, годовщины. Классику, которую
// человек наберёт в поиске первой («Крёстный отец», «Иван Васильевич меняет профессию»), в месячный
// топ выносит редко. Её берём из Wikidata: число разделов Википедии, где есть статья, — мера того,
// насколько вещь знают в мире. Советскому и российскому кино мировое число занижает признание,
// поэтому порог у него свой, ниже. Мера — `links`, просмотров у таких записей нет.
// --series-links N (РР-4, 15.10): мировые сериалы от N разделов, а не от 25 — «всё, у чего есть статья в русской
// Википедии», при N=1; --series-only — в справочник только сериалы (фильмы из топов этим заходом не пишем)
const SERIES_LINKS = Number(opt('--series-links') ?? 25);
const SERIES_ONLY = argv.includes('--series-only');
// --film-links N (РР-5, 15.10): мировые фильмы со статьёй в русской Википедии от N разделов, а не от 40; --films-only —
// в справочник только фильмы
const FILM_LINKS = Number(opt('--film-links') ?? 40);
const FILMS_ONLY = argv.includes('--films-only');
// --film-links-max M — верхняя граница (хвост РР-5: от 1 до 9 разделов — запрос «все фильмы» Wikidata не тянет)
const FILM_LINKS_MAX = opt('--film-links-max') ? Number(opt('--film-links-max')) : undefined;
// классы фильма в запросах классики (17.10): + аниме-фильм, телефильм, полнометражный мультфильм. Имя запроса — с
// пометкой `k2`: ответы прежних запросов лежат в кэше под старыми именами и новых классов не знают
const FILM_VALUES = 'VALUES ?c { wd:Q11424 wd:Q202866 wd:Q24869 wd:Q20650540 wd:Q506240 wd:Q29168811 }';
const K = '-k2';
const SPARQL: Record<string, string> = {
  [(FILM_LINKS === 40 && !FILM_LINKS_MAX ? 'films-world' : `films-world-${FILM_LINKS}${FILM_LINKS_MAX ? `-${FILM_LINKS_MAX}` : ''}`) + K]: `${FILM_VALUES} ?f wdt:P31 ?c; wikibase:sitelinks ?n. FILTER(?n >= ${FILM_LINKS}${FILM_LINKS_MAX ? ` && ?n <= ${FILM_LINKS_MAX}` : ''})`,
  ['films-ru' + K]: `${FILM_VALUES} VALUES ?k { wd:Q15180 wd:Q159 } ?f wdt:P31 ?c; wdt:P495 ?k; wikibase:sitelinks ?n. FILTER(?n >= 8)`,
  // 17.10: советская и российская анимация и короткий метр — все со статьёй в русской Википедии (501 вещь, у 384 есть
  // TMDb; у «Ну, погоди!» нет — без --wd-keys не заведётся)
  ...(RU_SHORTS ? { 'films-ru-shorts': 'VALUES ?c { wd:Q24862 wd:Q17517379 wd:Q202866 wd:Q29168811 } VALUES ?k { wd:Q15180 wd:Q159 wd:Q2184 } ?f wdt:P31 ?c; wdt:P495 ?k; wikibase:sitelinks ?n.' } : {}),
  [SERIES_LINKS === 25 ? 'series-world' : `series-world-${SERIES_LINKS}`]: `VALUES ?c { wd:Q5398426 wd:Q1259759 wd:Q581714 wd:Q63952888 wd:Q117467246 } ?f wdt:P31 ?c; wikibase:sitelinks ?n. FILTER(?n >= ${SERIES_LINKS})`,
  'series-ru': 'VALUES ?c { wd:Q5398426 wd:Q1259759 } ?f wdt:P31 ?c; wdt:P495 wd:Q159; wikibase:sitelinks ?n. FILTER(?n >= 3)',
};
// --world: индийское кино мир знает хуже, чем Индия, — порог ниже; англоязычное — выше, его и так много
const FILMS = FILM_VALUES;
const SERIES_Q = 'VALUES ?c { wd:Q5398426 wd:Q1259759 wd:Q581714 }';
const ANGLO = 'VALUES ?k { wd:Q30 wd:Q145 wd:Q16 wd:Q408 wd:Q27 wd:Q664 }';
// --origin KR,JP,ES… (ЗП-35, 07.10): кино стран — классика по числу разделов Википедии для каждой страны
// производства (порог --origin-links, по умолчанию 15) и срез «в справочнике / с разметкой» по стране
const ORIGIN_Q: Record<string, string> = { KR: 'Q884', AR: 'Q414', IR: 'Q794', DK: 'Q35', SE: 'Q34', ES: 'Q29', CN: 'Q148',
  IN: 'Q668', JP: 'Q17', HK: 'Q8646', MX: 'Q96', FR: 'Q142', IT: 'Q38', DE: 'Q183', TW: 'Q865', TR: 'Q43', BR: 'Q155', PL: 'Q36' };
const ORIGINS = (opt('--origin') ?? '').split(',').map((c) => c.trim().toUpperCase()).filter((c) => ORIGIN_Q[c]);
const ORIGIN_LINKS = Number(opt('--origin-links') ?? 15);
const CANON = argv.includes('--canon');
const CANON_LINKS = Number(opt('--canon-links') ?? 25);
const CANON_WORLD_LINKS = Number(opt('--canon-world-links') ?? 15);
const CANON_SERIES_LINKS = Number(opt('--canon-series-links') ?? 20);
/** не США и не Великобритания среди стран производства: их кино и так в справочнике гуще всего */
const NOT_ANGLO = 'FILTER NOT EXISTS { ?f wdt:P495 ?ak. VALUES ?ak { wd:Q30 wd:Q145 } }';
const notAnglo = (r: { origin?: string[] }) => !r.origin?.includes('Q30') && !r.origin?.includes('Q145');
/** канон: фильм от CANON_LINKS разделов, сериал от CANON_SERIES_LINKS; не англо-американское — от CANON_WORLD_LINKS */
const canonical = (r: { type: string; links?: number; origin?: string[] }) => CANON && (
  (r.links ?? 0) >= (r.type === 'series' ? CANON_SERIES_LINKS : CANON_LINKS) || (notAnglo(r) && (r.links ?? 0) >= CANON_WORLD_LINKS));
const SPARQL_CANON: Record<string, string> = CANON ? {
  [`canon-films-${CANON_LINKS}${K}`]: `${FILMS} ?f wdt:P31 ?c; wikibase:sitelinks ?n. FILTER(?n >= ${CANON_LINKS})`,
  [`canon-films-world-${CANON_WORLD_LINKS}${K}`]: `${FILMS} ?f wdt:P31 ?c; wikibase:sitelinks ?n. FILTER(?n >= ${CANON_WORLD_LINKS}) ${NOT_ANGLO}`,
  [`canon-series-${CANON_SERIES_LINKS}`]: `${SERIES_Q} ?f wdt:P31 ?c; wikibase:sitelinks ?n. FILTER(?n >= ${CANON_SERIES_LINKS})`,
  [`canon-series-world-${CANON_WORLD_LINKS}`]: `${SERIES_Q} ?f wdt:P31 ?c; wikibase:sitelinks ?n. FILTER(?n >= ${CANON_WORLD_LINKS}) ${NOT_ANGLO}`,
} : {};
/** кино страны: она в странах производства, США и Великобритании там нет (совместное с Голливудом — не её школа) */
const ofCountry = (c: string) => (r: { origin?: string[] }) => Boolean(r.origin?.includes(ORIGIN_Q[c]) && !r.origin.includes('Q30') && !r.origin.includes('Q145'));
const SPARQL_WORLD: Record<string, string> = {
  ['in-films' + K]: `${FILMS} ?f wdt:P31 ?c; wdt:P495 wd:Q668; wikibase:sitelinks ?n. FILTER(?n >= 12)`,
  'in-series': `${SERIES_Q} ?f wdt:P31 ?c; wdt:P495 wd:Q668; wikibase:sitelinks ?n. FILTER(?n >= 5)`,
  ['en-films' + K]: `${FILMS} ${ANGLO} ?f wdt:P31 ?c; wdt:P495 ?k; wikibase:sitelinks ?n. FILTER(?n >= 30)`,
  'en-series': `${SERIES_Q} ${ANGLO} ?f wdt:P31 ?c; wdt:P495 ?k; wikibase:sitelinks ?n. FILTER(?n >= 15)`,
};
const WIKI = WORLD ? 'en' : 'ru';
if (!argv.includes('--no-classics') && !FROM.length) {
  const originQ = Object.fromEntries(ORIGINS.map((c) => [`origin-${c}-${ORIGIN_LINKS}${K}`, `${FILM_VALUES} ?f wdt:P31 ?c; wdt:P495 wd:${ORIGIN_Q[c]}; wikibase:sitelinks ?n. FILTER(?n >= ${ORIGIN_LINKS})`]));
  for (const [name, where] of Object.entries(WORLD ? { ...SPARQL_WORLD, ...originQ, ...SPARQL_CANON } : SPARQL)) {
    const file = new URL(`sparql-${name}.json`, TOP_DIR);
    let got: [string, number][] | undefined = existsSync(file) && !FRESH ? JSON.parse(readFileSync(file, 'utf8')) : undefined;
    if (!got) {
      const q = `SELECT DISTINCT ?a ?n WHERE { ${where} ?a schema:about ?f; schema:isPartOf <https://${WIKI}.wikipedia.org/>. }`;
      const r = await get<{ results: { bindings: { a: { value: string }; n: { value: string } }[] } }>(
        `https://query.wikidata.org/sparql?${new URLSearchParams({ query: q, format: 'json' })}`);
      got = r?.results.bindings.map((b) => [decodeURIComponent(b.a.value.replace(`https://${WIKI}.wikipedia.org/wiki/`, '')).replace(/_/g, ' '), Number(b.n.value)]);
      // 18.10: запрос по шести классам фильма разом (en-films-k2 — англоязычное кино от 30 разделов) не укладывается в минуту
      // Wikidata — по одному классу и вместе
      if (!got && where.includes(FILM_VALUES)) {
        const parts: [string, number][] = [];
        let ok = true;
        for (const c of FILM_VALUES.match(/wd:Q\d+/g) ?? []) {
          await sleep(2000);
          const pq = `SELECT DISTINCT ?a ?n WHERE { ${where.replace(FILM_VALUES, `VALUES ?c { ${c} }`)} ?a schema:about ?f; schema:isPartOf <https://${WIKI}.wikipedia.org/>. }`;
          const pr = await get<{ results: { bindings: { a: { value: string }; n: { value: string } }[] } }>(
            `https://query.wikidata.org/sparql?${new URLSearchParams({ query: pq, format: 'json' })}`);
          if (!pr) { ok = false; console.error(`  запрос ${name}, класс ${c} не прошёл`); break; }
          for (const b of pr.results.bindings) parts.push([decodeURIComponent(b.a.value.replace(`https://${WIKI}.wikipedia.org/wiki/`, '')).replace(/_/g, ' '), Number(b.n.value)]);
        }
        if (ok) got = [...new Map(parts).entries()];
      }
      if (!got) { console.error(`  запрос ${name} не прошёл`); continue; }
      writeFileSync(file, JSON.stringify(got));
    }
    for (const [title, n] of got) {
      const t = WORLD ? `en:${title}` : title;
      views.set(t, { ...(views.get(t) ?? { views: 0, months: 0 }), links: Math.max(n, views.get(t)?.links ?? 0) });
      tag(t, name.replace(K, ''));
    }
    console.error(`  ${name}: ${got.length}`);
  }
  console.error(`вместе с классикой: ${views.size}`);
}

// ── 2. опознание в Wikidata по статье ─────────────────────────────────────────
interface Claim { mainsnak?: { datavalue?: { value: unknown } } }
interface Entity { id?: string; missing?: string; labels?: Record<string, { value: string }>; claims?: Record<string, Claim[]>; sitelinks?: Record<string, { title: string }> }
// 17.10: + полнометражный мультфильм, короткометражный фильм и мультфильм (срез --ru-shorts и карточки истории)
const FILM = new Set(['Q11424', 'Q506240', 'Q24869', 'Q202866', 'Q20650540', 'Q93204', 'Q29168811', 'Q24862', 'Q17517379']);
const SERIES = new Set(['Q5398426', 'Q1259759', 'Q581714', 'Q63952888', 'Q526877', 'Q117467246']);

// у сериала подпись — создатель (P170), а не режиссёр: P57 у сериала — режиссёр какой-то из серий
// origin — страны производства (P495, элементы Wikidata): по ним срез «индийское кино»
type Found = { qid: string; type: 'film' | 'series'; title: string; originalTitle?: string; year: number; director?: string; creator?: string; tmdb?: number; imdb?: string; origin?: string[];
  /** номер Кинопоиска (P2603) — у кандидатов --from: импорт узнаёт карточку по нему (src/lib/import/match.ts) */
  kp?: number };
type Cached = Found | { none: true };
const CACHE = new URL(WORLD ? '.cache/grow-film-base-world.wd.json' : '.cache/grow-film-base.wd.json', root);
const cache: Record<string, Cached> = !FRESH && existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : {};
// классы сменились (17.10: полнометражный мультфильм, короткий метр) — «не фильм» по статье спрашиваем заново
const SIG = [...FILM, ...SERIES].join(' ');
if ((cache as Record<string, unknown>)._classes !== SIG) {
  for (const [t, c] of Object.entries(cache)) if (c && typeof c === 'object' && 'none' in c) delete cache[t];
  (cache as Record<string, unknown>)._classes = SIG;
}
type Row = Record<string, { value: string } | undefined>;
const ALL = [...FILM, ...SERIES].map((q) => `wd:${q}`).join(' ');
// ── 1в. кандидаты по ключам (--from, 17.10) ───────────────────────────────────
// Не статья, а элемент: история владельца и импорт Кинопоиска уже знают QID, IMDb, TMDb или номер Кинопоиска. Номер →
// элемент по P2603/P4947/P345, затем сведения тем же набором полей, что у опознания по статье. Ключ в `views` — `wd:Q…`
// (с названием статьи не спутать). Кэш — .cache/grow-film-base.keys.json (--fresh — заново).
type Seed = { qid?: string; kp?: number; tmdb?: number; imdb?: string; src: string };
const seeds: Seed[] = [];
const FRESH_DAYS = Number(/^fresh:(\d+)$/.exec(FROM.find((x) => x.startsWith('fresh')) ?? '')?.[1] ?? 90);
const FRESH_LINKS = Number(opt('--fresh-links') ?? 3);
const sparqlRows = async (query: string) => (await get<{ results: { bindings: Row[] } }>('https://query.wikidata.org/sparql', { query }))?.results.bindings;
if (FROM.includes('history')) {
  const { userWorks } = await import('../src/mocks/userHistory.ts');
  const { watchedWorks } = await import('../src/mocks/userWatched.ts');
  for (const [src, list] of [['история', userWorks], ['присланный список', watchedWorks]] as const) for (const w of list as WorkCard[]) {
    if (w.type === 'book') continue;
    const x = w.externalIds ?? {};
    seeds.push({ src, qid: x.wikidata ?? (/^f-wd(\d+)$/.exec(w.id)?.[1] ? `Q${/^f-wd(\d+)$/.exec(w.id)![1]}` : undefined), kp: x.kinopoisk, tmdb: w.type === 'film' ? x.tmdb : undefined, imdb: x.imdb });
  }
}
if (FROM.includes('kinopoisk')) {
  // импорт профилей: карточки сопоставления (TMDb, только ключи) и ответы Wikidata по номеру Кинопоиска
  const res = existsSync(new URL('.cache/kinopoisk-resolve.json', root)) ? JSON.parse(readFileSync(new URL('.cache/kinopoisk-resolve.json', root), 'utf8')) as Record<string, WorkCard | null> : {};
  const kpwd = existsSync(new URL('.cache/kinopoisk-wikidata.json', root)) ? JSON.parse(readFileSync(new URL('.cache/kinopoisk-wikidata.json', root), 'utf8')) as Record<string, { wikidata?: string } | null> : {};
  for (const [k, c] of Object.entries(res)) {
    const kp = Number(k.split(':').pop()) || c?.externalIds?.kinopoisk;
    const x = c?.externalIds ?? {};
    seeds.push({ src: 'кинопоиск', qid: x.wikidata ?? (kp ? kpwd[String(kp)]?.wikidata : undefined), kp, tmdb: c?.type === 'film' ? x.tmdb : undefined, imdb: x.imdb });
  }
  // номера без элемента в прошлый раз (null) — спросим снова: элементы Wikidata дописывают
  for (const [kp, v] of Object.entries(kpwd)) if (!v && !res[`film:${kp}`] && !res[`series:${kp}`]) seeds.push({ src: 'кинопоиск', kp: Number(kp) });
}
for (const f of FROM.filter((x) => x.startsWith('file:'))) {
  const list = JSON.parse(readFileSync(f.slice(5), 'utf8')) as (string | Omit<Seed, 'src'>)[];
  for (const x of list) seeds.push(typeof x === 'string' ? { qid: x, src: f.slice(5) } : { ...x, src: f.slice(5) });
}
const KEYS_FILE = new URL('.cache/grow-film-base.keys.json', root);
const keyCache: { by: Record<string, string | null>; info: Record<string, Cached> } = !FRESH && existsSync(KEYS_FILE)
  ? JSON.parse(readFileSync(KEYS_FILE, 'utf8')) : { by: {}, info: {} };
const keyed: Record<string, Cached> = {};
if (FROM.length) {
  if (FROM.some((x) => x.startsWith('fresh'))) {
    // вышло за FRESH_DAYS дней: фильм — по дате выхода (P577), сериал — по началу показа (P580) или выходу; в окне и не
    // раньше, с русской меткой. Два запроса: с «P577|P580» и проверкой статьи разом Wikidata не укладывалась в минуту
    const since = new Date(Date.now() - FRESH_DAYS * 864e5).toISOString().slice(0, 10), till = now.toISOString().slice(0, 10);
    const win = (p: string) => `?f ${p} ?d. FILTER(?d >= "${since}T00:00:00Z"^^xsd:dateTime && ?d <= "${till}T23:59:59Z"^^xsd:dateTime)
      FILTER NOT EXISTS { ?f ${p} ?d0 FILTER(?d0 < "${since}T00:00:00Z"^^xsd:dateTime) }`;
    for (const [cls, p] of [[FILM, 'wdt:P577'], [SERIES, 'wdt:P580|wdt:P577']] as const) {
      const rows = await sparqlRows(`SELECT DISTINCT ?f WHERE { VALUES ?c { ${[...cls].map((q) => `wd:${q}`).join(' ')} } ?f wdt:P31 ?c; wikibase:sitelinks ?n.
        FILTER(?n >= ${FRESH_LINKS}) ${win(p)} ?f rdfs:label ?ru FILTER(lang(?ru) = 'ru') }`);
      if (!rows) console.error(`  свежее (${cls === FILM ? 'фильмы' : 'сериалы'}): запрос не прошёл`);
      for (const b of rows ?? []) seeds.push({ qid: b.f!.value.split('/').pop(), src: `вышло за ${FRESH_DAYS} дн.` });
      await sleep(1000);
    }
  }
  // номер → элемент: Кинопоиск P2603, TMDb P4947, IMDb P345 — пачками по 200
  for (const [prop, field] of [['P2603', 'kp'], ['P4947', 'tmdb'], ['P345', 'imdb']] as const) {
    const ask = [...new Set(seeds.filter((x) => !x.qid && x[field] != null).map((x) => String(x[field])))].filter((v) => !(`${field}:${v}` in keyCache.by));
    for (let i = 0; i < ask.length; i += 200) {
      const part = ask.slice(i, i + 200);
      const rows = await sparqlRows(`SELECT ?v ?f WHERE { VALUES ?v { ${part.map((v) => JSON.stringify(v)).join(' ')} } ?f wdt:${prop} ?v }`);
      if (!rows) { console.error(`  ${prop}: пачка ${i / 200} не получена`); await sleep(5000); continue; }
      for (const v of part) keyCache.by[`${field}:${v}`] = null;
      for (const b of rows) keyCache.by[`${field}:${b.v!.value}`] = b.f!.value.split('/').pop()!;
      await sleep(1000);
    }
    for (const x of seeds) if (!x.qid && x[field] != null) x.qid = keyCache.by[`${field}:${x[field]}`] ?? undefined;
  }
  const lost = seeds.filter((x) => !x.qid);
  console.error(`кандидатов по ключам: ${seeds.length}; без элемента Wikidata: ${lost.length}${lost.length ? ` (${[...new Set(lost.map((x) => x.src))].join(', ')})` : ''}`);
  // сведения об элементах — те же поля, что у опознания по статье, плюс статья ru, число разделов, номер Кинопоиска
  const qs = [...new Set(seeds.map((x) => x.qid).filter((q): q is string => Boolean(q)))].filter((q) => !keyCache.info[q]);
  for (let i = 0; i < qs.length; i += 150) {
    const part = qs.slice(i, i + 150);
    const rows = await sparqlRows(`SELECT ?f ?c ?ru ?en ?art ?n ?date ?start ?dir ?cr ?tmdb ?imdb ?kp ?k WHERE {
      VALUES ?f { ${part.map((q) => `wd:${q}`).join(' ')} } VALUES ?c { ${ALL} } ?f wdt:P31 ?c; wikibase:sitelinks ?n.
      OPTIONAL { ?f rdfs:label ?ru FILTER(lang(?ru) = 'ru') } OPTIONAL { ?f rdfs:label ?en FILTER(lang(?en) = 'en') }
      OPTIONAL { ?a schema:about ?f; schema:isPartOf <https://ru.wikipedia.org/>; schema:name ?art }
      OPTIONAL { ?f wdt:P577 ?date } OPTIONAL { ?f wdt:P580 ?start } OPTIONAL { ?f wdt:P57 ?dir } OPTIONAL { ?f wdt:P170 ?cr }
      OPTIONAL { ?f wdt:P4947 ?tmdb } OPTIONAL { ?f wdt:P345 ?imdb } OPTIONAL { ?f wdt:P2603 ?kp } OPTIONAL { ?f wdt:P495 ?k } }`);
    if (!rows) { console.error(`  сведения: пачка ${i / 150} не получена`); await sleep(5000); continue; }
    const got = new Map<string, Found & { links: number }>();
    for (const b of rows) {
      const qid = b.f!.value.split('/').pop()!, c = b.c!.value.split('/').pop()!;
      const year = Number((b.date ?? b.start)?.value.slice(0, 4)) || 0;
      const f = got.get(qid) ?? { qid, type: 'film' as const, title: b.ru?.value ?? (b.art ? cleanTitle(b.art.value) : undefined) ?? b.en?.value ?? qid, year, links: Number(b.n?.value ?? 0) };
      if (SERIES.has(c)) f.type = 'series';
      if (b.en && b.en.value !== f.title) f.originalTitle = b.en.value;
      if (year && (!f.year || year < f.year)) f.year = year;
      if (b.dir && !f.director) f.director = b.dir.value.split('/').pop();
      if (b.cr && !f.creator) f.creator = b.cr.value.split('/').pop();
      if (b.tmdb && !f.tmdb && Number(b.tmdb.value)) f.tmdb = Number(b.tmdb.value);
      if (b.imdb && !f.imdb) f.imdb = b.imdb.value;
      if (b.kp && !f.kp && Number(b.kp.value)) f.kp = Number(b.kp.value);
      const k = b.k?.value.split('/').pop();
      if (k && !f.origin?.includes(k)) f.origin = [...(f.origin ?? []), k];
      got.set(qid, f);
    }
    for (const q of part) keyCache.info[q] = got.get(q) ?? { none: true };
    if (i % 1500 === 0) writeFileSync(KEYS_FILE, JSON.stringify(keyCache));
    await sleep(1000);
  }
  writeFileSync(KEYS_FILE, JSON.stringify(keyCache));
  let notScreen = 0;
  for (const x of seeds) {
    if (!x.qid) continue;
    const c = keyCache.info[x.qid];
    if (!c || 'none' in c) { notScreen++; continue; }
    const k = `wd:${x.qid}`;
    keyed[k] = c;
    if (!views.has(k)) views.set(k, { views: 0, months: 0, links: (c as Found & { links?: number }).links });
    tag(k, x.src);
  }
  console.error(`по ключам опознано фильмов и сериалов: ${Object.keys(keyed).length}; элемент не фильм и не сериал (класс P31): ${notScreen}`);
}
const todo = [...views.keys()].filter((t) => !cache[t] && !keyed[t]);
console.error(`к опознанию в Wikidata: ${todo.length} (в кэше ${views.size - todo.length})`);
// Через SPARQL, а не wbgetentities (05.10): в топах полно статей о людях и странах, и пачка из 50
// записей целиком весила 8 МБ и шла 10 с. Запрос возвращает только фильмы и сериалы и только нужные
// поля; статью узнаём по её названию (schema:name), чтобы не гадать, как Wikidata кодирует адрес.
const lit = (t: string, lang: string) => `"${t.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"@${lang}`;
// ключ → раздел Википедии и название статьи; в русском режиме ключ — само название
const split = (k: string): [string, string] => (WORLD ? [k.slice(0, k.indexOf(':')), k.slice(k.indexOf(':') + 1)] : ['ru', k]);
// пачки по 200 статей одного раздела: у названия в запросе — язык раздела
const batches: { lang: string; keys: string[] }[] = [];
for (const k of todo) {
  const lang = split(k)[0];
  const last = batches.findLast((b) => b.lang === lang);
  if (last && last.keys.length < 200) last.keys.push(k); else batches.push({ lang, keys: [k] });
}
for (let i = 0; i < batches.length; i++) {
  const { lang, keys: batch } = batches[i];
  const titles = new Map(batch.map((k) => [split(k)[1], k]));
  const q = `SELECT ?t ?f ?c ?ru ?en ?date ?start ?dir ?cr ?tmdb ?imdb ?k WHERE {
    VALUES ?t { ${[...titles.keys()].map((t) => lit(t, lang)).join(' ')} }
    ?a schema:name ?t; schema:isPartOf <https://${lang}.wikipedia.org/>; schema:about ?f.
    VALUES ?c { ${ALL} } ?f wdt:P31 ?c.
    OPTIONAL { ?f rdfs:label ?ru FILTER(lang(?ru) = 'ru') } OPTIONAL { ?f rdfs:label ?en FILTER(lang(?en) = 'en') }
    OPTIONAL { ?f wdt:P577 ?date } OPTIONAL { ?f wdt:P580 ?start } OPTIONAL { ?f wdt:P57 ?dir } OPTIONAL { ?f wdt:P170 ?cr }
    OPTIONAL { ?f wdt:P4947 ?tmdb } OPTIONAL { ?f wdt:P345 ?imdb }${WORLD ? ' OPTIONAL { ?f wdt:P495 ?k }' : ''} }`;
  const r = await get<{ results: { bindings: Row[] } }>('https://query.wikidata.org/sparql', { query: q });
  if (!r) { console.error(`  пачка ${i} не получена`); await sleep(5000); continue; }
  const got = new Map<string, Found>();
  for (const b of r.results.bindings) {
    const t = titles.get(b.t!.value) ?? b.t!.value, qid = b.f!.value.split('/').pop()!, c = b.c!.value.split('/').pop()!;
    const year = Number((b.date ?? b.start)?.value.slice(0, 4)) || 0;
    const f = got.get(t) ?? { qid, type: 'film' as const, title: b.ru?.value ?? b.en?.value ?? t, year };
    if (SERIES.has(c)) f.type = 'series';
    if (b.en && b.en.value !== f.title) f.originalTitle = b.en.value;
    if (year && (!f.year || year < f.year)) f.year = year;
    if (b.dir && !f.director) f.director = b.dir.value.split('/').pop();
    if (b.cr && !f.creator) f.creator = b.cr.value.split('/').pop();
    if (b.tmdb && !f.tmdb && Number(b.tmdb.value)) f.tmdb = Number(b.tmdb.value);
    if (b.imdb && !f.imdb) f.imdb = b.imdb.value;
    const k = b.k?.value.split('/').pop();
    if (k && !f.origin?.includes(k)) f.origin = [...(f.origin ?? []), k];
    got.set(t, f);
  }
  for (const t of batch) cache[t] = got.get(t) ?? { none: true };
  if (i % 5 === 4) { writeFileSync(CACHE, JSON.stringify(cache)); console.error(`  ${(i + 1) * 200} из ${todo.length}`); }
  await sleep(1000);
}
writeFileSync(CACHE, JSON.stringify(cache));

// ── 3. замер покрытия ─────────────────────────────────────────────────────────
// свои прежние карточки не в счёт: их перегенерируем заново, чтобы поправки (подпись, год) доходили и до них.
// «Есть» — справочник без истории владельца и демо-каталога (17.10, tools/base-have.mts): карточка истории у сервера
// и нового человека не видна, и 134 фильма из-за неё не заводились («Субстанция», «Джентльмены», «Меню»)
const OUT = new URL(`src/mocks/${OUT_NAME}.ts`, root);
const prev: WorkCard[] = existsSync(OUT) ? (await import(OUT.href))[OUT_NAME] as WorkCard[] : [];
const index = worksIndex({ all: true });
const have = baseHave({ except: OUT_NAME in BASE_MODULES ? [OUT_NAME as BaseModule] : [] });
// фильм без TMDb — `wd:Q…` (--wd-keys, решение владельца 17.10); сериал — по-прежнему только с IMDb
const keyOf = (f: Found) => (f.type === 'series' ? (f.imdb ? `imdb:${f.imdb}` : undefined)
  : f.tmdb ? `tmdb:${f.tmdb}` : WD_KEYS ? `wd:${f.qid}` : undefined);
const isHad = (f: Found) => have.has(f.qid) || [keyOf(f), f.tmdb && f.type === 'film' ? `tmdb:${f.tmdb}` : undefined, f.imdb ? `imdb:${f.imdb}` : undefined].some((k) => k && have.has(k));

const rows = [...views].flatMap(([article, v]) => {
  const c = cache[article] ?? keyed[article];
  if (!c || typeof c !== 'object' || 'none' in c || NOISE.test(article)) return [];
  // испорченная русская подпись в Wikidata: у «Salaam Namaste» стояло «russian» — тогда название английское
  const junk = /^[a-z]+$/.test(c.title) && c.originalTitle;
  const title = cleanTitle(junk ? c.originalTitle! : c.title);
  return [{ article, ...v, ...c, title, originalTitle: junk ? undefined : c.originalTitle && cleanTitle(c.originalTitle), had: isHad(c), key: keyOf(c) }];
}).filter((r) => r.views >= MIN_VIEWS).sort((a, b) => b.views - a.views || (b.links ?? 0) - (a.links ?? 0));
// одна вещь под двумя статьями (переименование) — оставляем ту, где просмотров больше
// В --world одна вещь — это и статья английской Википедии, и статья на хинди: просмотры складываем
const seenQ = new Map<string, (typeof rows)[number]>();
const uniq = rows.filter((r) => {
  const first = seenQ.get(r.qid);
  if (!first) { seenQ.set(r.qid, r); return true; }
  if (WORLD) {
    first.views += r.views; first.months += r.months;
    if (r.links) first.links = Math.max(first.links ?? 0, r.links);
    for (const [g, v] of Object.entries(r.by ?? {})) first.by = { ...first.by, [g]: (first.by?.[g] ?? 0) + v };
  }
  return false;
});

// --world: что берём в справочник — первые TOP каждого региона, индийская классика и англоязычная от 35 разделов.
// У индийских новинок в Wikidata часто нет даты выхода (P577) — год спрашиваем у TMDb по ключу
const chosen = new Set<string>();
async function fillYears(rs: typeof uniq) {
  const key = process.env.TMDB_API_KEY ?? process.env.VITE_TMDB_API_KEY;
  if (!key || !rs.length) { if (rs.length) console.error(`без года ${rs.length}: нет TMDB_API_KEY`); return; }
  const FILE = new URL('.cache/grow-film-base-world.years.json', root);
  const years: Record<string, number> = existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf8')) : {};
  let asked = 0;
  const one = async (r: (typeof uniq)[number]) => {
    const k = r.key ?? r.qid;
    if (years[k] === undefined) {
      let d: string | undefined;
      if (r.type === 'film' && r.tmdb) d = (await get<{ release_date?: string }>(`https://api.themoviedb.org/3/movie/${r.tmdb}?api_key=${key}`))?.release_date;
      else if (r.imdb) {
        const j = await get<{ tv_results?: { first_air_date?: string }[]; movie_results?: { release_date?: string }[] }>(
          `https://api.themoviedb.org/3/find/${r.imdb}?api_key=${key}&external_source=imdb_id`);
        d = j?.tv_results?.[0]?.first_air_date ?? j?.movie_results?.[0]?.release_date;
      }
      years[k] = Number(d?.slice(0, 4)) || 0;
      asked++;
    }
    if (years[k]) r.year = years[k];
  };
  for (let i = 0; i < rs.length; i += 8) await Promise.all(rs.slice(i, i + 8).map(one));
  if (asked) writeFileSync(FILE, JSON.stringify(years));
  console.error(`год из TMDb: спрошено ${asked}, с годом ${rs.filter((r) => r.year).length} из ${rs.length}`);
}
if (WORLD) {
  const top = (g: string) => uniq.filter((r) => r.months && r.by?.[g]).sort((a, b) => b.by![g] - a.by![g]).slice(0, TOP);
  // кино стран — и то, что мелькало в топах («Идеальные дни», «Монстр» 2023): срез страны их считает, справочник — тоже
  const classic = uniq.filter((r) => (!r.months && (indian(r) || (r.links ?? 0) >= EN_CLASSIC_LINKS))
    || ORIGINS.some((c) => ofCountry(c)(r) && (r.links ?? 0) >= ORIGIN_LINKS) || canonical(r));
  for (const r of [...top('IN'), ...top('EN'), ...classic]) chosen.add(r.qid);
  await fillYears(uniq.filter((r) => !r.year && chosen.has(r.qid)));
}
const share = (xs: typeof uniq) => `${xs.filter((r) => r.had).length} из ${xs.length} (${Math.round(100 * xs.filter((r) => r.had).length / Math.max(1, xs.length))}%)`;
const report = (label: string, xs: typeof uniq, cuts: number[]) => {
  console.log(`${label}: есть у нас ${share(xs)}`);
  for (const n of cuts) if (xs.length > n) console.log(`  первые ${n}: ${share(xs.slice(0, n))}`);
};
const inTops = uniq.filter((r) => r.months), classics = uniq.filter((r) => !r.months);
console.log('');
if (!WORLD) {
  report(`фильмы в топах ru.wikipedia за ${MONTHS} мес.`, inTops.filter((r) => r.type === 'film'), [100, 300]);
  report('сериалы в топах', inTops.filter((r) => r.type === 'series'), [100, 300]);
  report('классика вне топов, фильмы', classics.filter((r) => r.type === 'film').sort((a, b) => (b.links ?? 0) - (a.links ?? 0)), [300, 1000]);
  report('классика вне топов, сериалы', classics.filter((r) => r.type === 'series').sort((a, b) => (b.links ?? 0) - (a.links ?? 0)), [300]);
}

// ── 3б. --world: срезы по регионам и очередь разметки ─────────────────────────
// «С разметкой» — как в tools/annotation-gap.mts: каталог с операциями или черновик, не отклонённый куратором;
// черновик low есть, но в подбор не идёт — считается отдельно
const curated = new Set(index.filter((x) => x.work.primaryOperations.length && x.work.complexityLevel).map((x) => x.key));
const markOf = (k?: string) => (!k ? undefined : curated.has(k) ? 'high'
  : draftReview[`draft:${k}`]?.status === 'rejected' ? undefined : (draftAnnotations[k] ?? seriesAnnotations[k])?.confidence);
const ownKeys = new Set(prev.flatMap((w) => analysisKeys(w)));
const slices = WORLD ? {
  'Индия: самое смотримое': inTops.filter((r) => r.by?.IN).sort((a, b) => b.by!.IN - a.by!.IN),
  'Индия: индийское кино и сериалы': inTops.filter((r) => r.by?.IN && indian(r)).sort((a, b) => b.by!.IN - a.by!.IN),
  'англоязычные страны: самое смотримое': inTops.filter((r) => r.by?.EN).sort((a, b) => b.by!.EN - a.by!.EN),
  'классика индийского кино (вне топов)': classics.filter(indian).sort((a, b) => (b.links ?? 0) - (a.links ?? 0)),
  // кино стран: и классика, и то, что было в топах, — по числу разделов Википедии
  ...(CANON ? { 'мировой канон': uniq.filter(canonical).sort((a, b) => (b.links ?? 0) - (a.links ?? 0)) } : {}),
  ...Object.fromEntries(ORIGINS.map((c) => [`кино страны ${c}`, uniq.filter((r) => ofCountry(c)(r) && (r.links ?? 0) >= ORIGIN_LINKS).sort((a, b) => (b.links ?? 0) - (a.links ?? 0))])),
} : {};
const queue = new Map<string, (typeof uniq)[number] & { slice: string; rank: number }>();
if (WORLD) {
  for (const [label, xs] of Object.entries(slices)) {
    const stat = (n: number) => {
      const ys = xs.slice(0, n);
      const inBase = ys.filter((r) => r.had || (r.key && ownKeys.has(r.key))).length;
      const marked = ys.filter((r) => { const m = markOf(r.key); return m && m !== 'low'; }).length;
      const low = ys.filter((r) => markOf(r.key) === 'low').length;
      return `первые ${ys.length}: в справочнике ${inBase}, с разметкой ${marked}${low ? ` (+ low ${low})` : ''}`;
    };
    // цель ЗП-22 — 300 самых смотримых в Индии с разметкой: на каком месте среза набирается 300 размеченных
    let marked = 0;
    const at300 = xs.findIndex((r) => { const m = markOf(r.key); if (m && m !== 'low') marked++; return marked === 300; });
    console.log(`${label} (${xs.length}) — ${stat(100)}; ${stat(300)}; ${stat(600)}; 300 размеченных — ${at300 >= 0 ? `в первых ${at300 + 1}` : `не набирается (${marked})`}`);
    if (process.env.DEBUG_SLICE && label.includes(process.env.DEBUG_SLICE)) for (const r of xs.slice(0, 100).filter((r) => !(r.had || (r.key && ownKeys.has(r.key))))) console.log('   ', r.title, r.key, r.had, markOf(r.key), r.article);
    // в очередь черновой разметки — первые QUEUE каждого среза: то, что у нас без разметки и с ключом
    xs.slice(0, QUEUE).forEach((r, rank) => {
      if (r.key && !markOf(r.key) && !queue.has(r.key)) queue.set(r.key, { ...r, slice: label, rank: rank + 1 });
    });
  }
  console.log(`к черновой разметке (первые ${QUEUE} срезов, без разметки): ${queue.size}`);
}
// аниме-фильм вне топов — от --anime-links разделов (25, как канон; 17.10): Ghibli, Синкай, «Акира» — да, а десятки
// фильмов «Дораэмона», «Детектива Конана», «Покемона» от 15 разделов (порог мирового канона) — массовый добор аниме, его
// владелец не хочет (17.10). Класс P31 спрашиваем только у кандидатов вне справочника
const ANIME_LINKS = Number(opt('--anime-links') ?? CANON_LINKS);
const anime = new Set<string>();
{
  const ask = uniq.filter((r) => !r.had && !r.months && r.type === 'film' && (r.links ?? 0) < ANIME_LINKS).map((r) => r.qid);
  for (let i = 0; i < ask.length; i += 400) {
    const rows = await sparqlRows(`SELECT ?f WHERE { VALUES ?f { ${ask.slice(i, i + 400).map((q) => `wd:${q}`).join(' ')} } ?f wdt:P31 wd:Q20650540 }`);
    for (const b of rows ?? []) anime.add(b.f!.value.split('/').pop()!);
    await sleep(1000);
  }
  if (anime.size) console.error(`аниме-фильмов вне топов от ${ANIME_LINKS} разделов и ниже — не берём: ${anime.size}`);
}
// не фильмы (18.10): игры, трейлеры, тизеры, реклама и промо-ролики — у них бывает и класс фильма (у «Grand Theft Auto VI:
// An Extended Look» — короткометражный мультфильм и телеспецвыпуск рядом с «трейлером видеоигры»), и с --from fresh они
// пролезали в свежее. Правило по P31: у элемента есть класс видеоигра или промо-фильм, либо подкласс (P279*) трейлера,
// трейлера видеоигры, геймплейного трейлера или рекламы. Спрашиваем только кандидатов вне справочника; ответы — в кэше
// .cache/grow-film-base.notfilm.json (при смене списка классов — заново)
const NOT_FILM_DIRECT = ['Q7889', 'Q104880835'];
const NOT_FILM_DEEP = ['Q622550', 'Q65972034', 'Q99839991', 'Q37038'];
const notFilm = new Set<string>();
{
  const FILE = new URL('.cache/grow-film-base.notfilm.json', root);
  const sig = [...NOT_FILM_DIRECT, '|', ...NOT_FILM_DEEP].join(' ');
  let known: { _sig?: string; q: Record<string, 1 | 0> } = existsSync(FILE) && !FRESH ? JSON.parse(readFileSync(FILE, 'utf8')) : { q: {} };
  if (known._sig !== sig) known = { _sig: sig, q: {} };
  const ask = [...new Set(uniq.filter((r) => !r.had).map((r) => r.qid))].filter((q) => !(q in known.q));
  for (let i = 0; i < ask.length; i += 300) {
    const part = ask.slice(i, i + 300);
    const rows = await sparqlRows(`SELECT DISTINCT ?f WHERE { VALUES ?f { ${part.map((q) => `wd:${q}`).join(' ')} } ?f wdt:P31 ?c.
      FILTER(?c IN (${NOT_FILM_DIRECT.map((q) => `wd:${q}`).join(', ')}) || EXISTS { VALUES ?bad { ${NOT_FILM_DEEP.map((q) => `wd:${q}`).join(' ')} } ?c wdt:P279* ?bad }) }`);
    if (!rows) { console.error(`  не фильмы: пачка ${i / 300} не получена — спросим в следующий раз`); await sleep(5000); continue; }
    for (const q of part) known.q[q] = 0;
    for (const b of rows) known.q[b.f!.value.split('/').pop()!] = 1;
    await sleep(1000);
  }
  writeFileSync(FILE, JSON.stringify(known));
  for (const r of uniq) if (known.q[r.qid] === 1) notFilm.add(r.qid);
  const shown = uniq.filter((r) => notFilm.has(r.qid) && !r.had);
  if (shown.length) console.error(`не фильмы (игры, трейлеры, реклама по P31) — не берём: ${shown.length} (${shown.slice(0, 5).map((r) => r.title).join(', ')})`);
}
// порнография (18.10, tools/adult-lib.mts: P31/P136 — порнофильм, хентай, порнография с подклассами) — в справочник не идёт:
// ни новой карточкой, ни прежней своего модуля. Эротика заводится, но в подбор не идёт — её ключи кладёт в heldWorks
// tools/adult-sweep.mts (ночной сбор, после роста справочника)
const adult = await adultOf([...uniq.filter((r) => !r.had).map((r) => r.qid), ...prev.map((c) => `Q${c.id.replace(/^f-wd/, '')}`)]);
const porn = new Set([...adult].filter(([, k]) => k === 'porn').map(([q]) => q));
{
  const shown = uniq.filter((r) => porn.has(r.qid) && !r.had);
  const prevPorn = prev.filter((c) => porn.has(`Q${c.id.replace(/^f-wd/, '')}`));
  if (shown.length || prevPorn.length) console.error(`порно по P31/P136 — не берём: ${shown.length} кандидатов, из прежних карточек модуля уходит ${prevPorn.length} (${[...new Set([...shown.map((r) => r.title), ...prevPorn.map((c) => c.title)])].slice(0, 12).join(', ')})`);
  const ero = uniq.filter((r) => adult.get(r.qid) === 'erotic' && !r.had).length;
  if (ero) console.error(`эротика по P31/P136 — заводится, в подбор не пойдёт (heldWorks, tools/adult-sweep.mts): ${ero}`);
}
const noKey = uniq.filter((r) => !r.had && !r.key);
console.log(`без ключа (нет TMDb у фильма / IMDb у сериала) — завести нельзя: ${noKey.length}`);
const seenKey = new Set<string>();
const missing = uniq.filter((r) => !r.had && r.key && !anime.has(r.qid) && !notFilm.has(r.qid) && !porn.has(r.qid) && !isWithheld({ type: r.type, externalIds: { ...(r.tmdb ? { tmdb: r.tmdb } : {}), ...(r.imdb ? { imdb: r.imdb } : {}), wikidata: r.qid } }) && (!WORLD || chosen.has(r.qid) || r.article.startsWith('wd:')) && (!SERIES_ONLY || r.type === 'series') && (!FILMS_ONLY || r.type === 'film') && !seenKey.has(r.key) && seenKey.add(r.key));
const line = (r: (typeof uniq)[number]) => `  ${`${r.title}${r.year ? ` (${r.year})` : ''}`.padEnd(48)} ${r.type === 'series' ? 'сериал' : 'фильм '} ${r.months ? `${String(r.views).padStart(9)} · ${r.months} ${WORLD ? 'сут.' : 'мес.'}` : `разделов ${r.links}`}`;
console.log(`\nнет у нас (${missing.length}), первые 30 из топов:`);
for (const r of missing.filter((r) => r.months).slice(0, 30)) console.log(line(r));
console.log(`\nпервые 30 из классики:`);
for (const r of missing.filter((r) => !r.months).sort((a, b) => (b.links ?? 0) - (a.links ?? 0)).slice(0, 30)) console.log(line(r));
// по источникам (17.10): сколько добавит каждый — топы, запрос классики, --from
// новое — то, чего нет и в прежних карточках своего модуля (их «нет у нас» перегенерирует, а не добавляет)
const prevIds = new Set(prev.map((w) => w.id)), prevKeys = new Set(prev.flatMap((w) => analysisKeys(w)));
const isNew = (r: (typeof uniq)[number]) => !prevIds.has(`f-wd${r.qid.slice(1)}`) && !(r.key && prevKeys.has(r.key));
const added = missing.filter(isNew);
const bySrc = new Map<string, { add: number; noKey: number; wd: number }>();
const missingSet = new Set(missing);
for (const r of uniq.filter((r) => !r.had && isNew(r))) for (const src of r.src ?? ['?']) {
  const e = bySrc.get(src) ?? { add: 0, noKey: 0, wd: 0 };
  if (missingSet.has(r)) { e.add++; if (r.key?.startsWith('wd:')) e.wd++; } else if (!r.key) e.noKey++;
  bySrc.set(src, e);
}
console.log(`\nновых карточек (нет и в прежнем ${OUT_NAME}): ${added.length}`);
console.log(`\nпо источникам — добавится (из них с ключом wd:) / без ключа: ${[...bySrc].map(([k, e]) => `${k} +${e.add}${e.wd ? ` (wd: ${e.wd})` : ''}${e.noKey ? ` / ${e.noKey}` : ''}`).join('; ')}`);
const REPORT = new URL(opt('--report') ?? (WORLD ? '.cache/grow-film-base-world.json' : '.cache/grow-film-base.json'), `file://${process.cwd()}/`);
writeFileSync(REPORT, JSON.stringify({ at: now.toISOString(), months: MONTHS, from: FROM, bySrc: Object.fromEntries(bySrc), added: added.map((r) => r.qid), missing, noKey }, null, 1));

// ── 4. запись карточек ────────────────────────────────────────────────────────
const who = (r: Found) => (r.type === 'series' ? r.creator : r.director);
const names = new Map<string, string>();
async function nameCreators(rs: Found[]) {
  const dirQ = [...new Set(rs.map(who).filter((d): d is string => Boolean(d) && !names.has(d!)))];
  for (let i = 0; i < dirQ.length; i += 50) {
    const r = await get<{ entities?: Record<string, Entity> }>(`https://www.wikidata.org/w/api.php?${new URLSearchParams({
      action: 'wbgetentities', format: 'json', ids: dirQ.slice(i, i + 50).join('|'), props: 'labels', languages: 'ru|en' })}`);
    for (const [q, e] of Object.entries(r?.entities ?? {})) { const n = e.labels?.ru?.value ?? e.labels?.en?.value; if (n) names.set(q, n); }
    await sleep(1000);
  }
}
const creatorsOf = (r: Found) => (who(r) && names.get(who(r)!) ? [names.get(who(r)!)!] : []);

// очередь черновой разметки (--world): ключ, название, год, автор, срез и место в нём — вход для разметчиков
// замер с --report (17.10) очередь не трогает: она — вход разметчиков от настоящего прогона
if (WORLD && queue.size && !opt('--report')) {
  await nameCreators([...queue.values()]);
  const q = [...queue.values()].map((r) => ({ key: r.key, type: r.type, title: r.title, original: r.originalTitle, year: r.year,
    creators: creatorsOf(r), slice: r.slice, rank: r.rank, inBase: r.had || ownKeys.has(r.key!) || WRITE }));
  writeFileSync(new URL('.cache/grow-film-base-world.queue.json', root), JSON.stringify(q, null, 1));
  console.log(`очередь разметки → .cache/grow-film-base-world.queue.json (${q.length})`);
}

if (WRITE) {
  await nameCreators(missing);
  // убранное владельцем (src/mocks/withheldWorks.ts) не заводим и не держим
  const cards: WorkCard[] = missing.map((r) => ({
    id: `f-wd${r.qid.slice(1)}`, type: r.type, title: plainTitle(r.title),
    ...(r.originalTitle ? { originalTitle: r.originalTitle } : {}),
    year: r.year, creators: creatorsOf(r),
    primaryOperations: [], complexityLevel: 0, warnings: [], barriers: [], isNicheMasterpiece: false,
    // элемент Wikidata — у фильма с ключом `wd:` (без TMDb: иначе у карточки нет ключа); номер Кинопоиска — у кандидатов --from
    externalIds: { ...(r.type === 'film' && r.tmdb ? { tmdb: r.tmdb } : {}), ...(r.imdb ? { imdb: r.imdb } : {}),
      ...(r.key?.startsWith('wd:') ? { wikidata: r.qid } : {}), ...(r.kp ? { kinopoisk: r.kp } : {}) },
  }) as WorkCard).filter((c) => !isWithheld(c));
  const ids = new Set(cards.map((c) => c.id));
  // прежняя карточка своего модуля, оказавшаяся не фильмом по P31 или порнографией (18.10), уходит
  const all = [...prev.filter((c) => !ids.has(c.id) && !isWithheld(c) && !notFilm.has(`Q${c.id.replace(/^f-wd/, '')}`) && !porn.has(`Q${c.id.replace(/^f-wd/, '')}`)), ...cards];
  // строка на карточку через c(): пустые поля разметки у всех одинаковы, и в полном виде
  // они были третью файла (1,4 МБ на 4450 карточек)
  const row = (w: WorkCard) => `  c(${[w.id.replace(/^f-wd/, ''), w.type, w.title, w.originalTitle ?? '', w.year, w.creators, w.externalIds ?? {}].map((v) => JSON.stringify(v)).join(', ')}),`;
  // свой модуль (--out, кроме filmBasePopular/filmBaseWorld) — общий заголовок: в него пишут и --world, и --from (18.10)
  const own = !['filmBasePopular', 'filmBaseWorld'].includes(OUT_NAME);
  writeFileSync(OUT, `// Сгенерировано tools/grow-film-base.mts${WORLD ? ' --world' : ''} (${now.toISOString().slice(0, 10)}): ${own
    ? `пополнение справочника
// (--out ${OUT_NAME}): фильмы и сериалы из топов и классики Википедии, по ключам (--from) и из запросов классики, которых не было
// в справочнике. Модуль ленивый — не в первой загрузке (src/api/index.ts, loadFilmLinks).`
    : WORLD
    ? `фильмы и сериалы из суточных
// топов Википедии по странам (Индия; ${COUNTRIES.filter((c) => c !== 'IN').join(', ')}) и классика по числу разделов Википедии
// (индийское кино, англоязычное, мировой канон --canon), которых не было в справочнике, — ЗП-22.`
    : `фильмы и сериалы из месячных
// топов русской Википедии и классика по числу разделов Википедии, которых не было в справочнике.`}
// Опознаны в Wikidata (CC0). Разметку для подбора дописывает черновик (draftAnnotations.ts,
// seriesAnnotations.ts). Не править руками — перегенерировать.
import type { ExternalIds, WorkCard } from '@/types/tmdf';

const c = (qid: string, type: 'film' | 'series', title: string, originalTitle: string, year: number, creators: string[], externalIds: ExternalIds): WorkCard => ({
  id: \`f-wd\${qid}\`, type, title, ...(originalTitle ? { originalTitle } : {}), year, creators,
  primaryOperations: [], complexityLevel: 0, warnings: [], barriers: [], isNicheMasterpiece: false, externalIds,
});

export const ${OUT_NAME}: WorkCard[] = [
${all.map(row).join('\n')}
];
`);
  console.log(`\n→ src/mocks/${OUT_NAME}.ts: прежних ${prev.length}, новых ${cards.length}, всего ${all.length}`);
}
