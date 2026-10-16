// Слой данных: сигнатуры под будущие эндпоинты. Возвращает моки с задержкой,
// чтобы состояния загрузки были видны в разработке. Бизнес-логики здесь нет:
// уровень усилия, готовность, спойлерность и тексты приходят как данные.
import type { SeasonInfo } from '@/lib/seasons';
import ui, { language } from '@/i18n';
import { buildMatchIndex, diaryCsv, diaryJson, matchScored, normalizeTitle, parseExports, type DiaryRow, type ExportFile, type ImportedRecord, type ImportSource } from '@/lib/import';
import { kinopoiskFromEnv, resolveRecords, toWorkCard, tmdbFromEnv, withImages } from '@/lib/resolve';
import { ratingDeck } from '@/mocks/ratingDeck';
import { ratingDeckEn } from '@/mocks/ratingDeckEn';
import { partsInOrder } from '@/lib/deckOrder';
import { isWithheld, isHeldKey } from '@/mocks/withheldWorks';
import { trailersOwn } from '@/mocks/trailersOwn';
import type { FirstPassAnnotation } from '@/mocks/userAnnotations';
import type { SeasonDraft, SeriesDraft } from '@/mocks/seriesAnnotations';
import type { CharacterRecord } from '@/mocks/characters';
import { nameForms, nameRegex, sharedWords } from '@/lib/characters';
import { hubWeight, listLike } from '@/lib/relations';
import { draftReview, type ReviewMark } from '@/mocks/draftReview';
import { complexitySpan, deriveMap, deriveState, type RatedEntry } from '@/lib/model/deriveState';
import { difficultyOdds, expectedDifficulty, heaviness, recommend, scoreCandidate, type Candidate } from '@/lib/model/recommend';
import { contentFit, contentWeight, deriveContentTaste, onPickedShelf } from '@/lib/model/taste';
import { COLLECTIONS, collectionById, inCollection, levelPath, type Collection, type VoicePlaylist, type VoicePlaylists } from '@/lib/model/collections';
import { moodFit, parseMood } from '@/lib/mood';
import { shardOf } from '@/lib/shard';
import { groupByVoice, knownVoice, voiceOf } from '@/lib/voices';
import { webApp } from '@/lib/telegram';
import { attachLenses } from '@/lib/lenses';
import { attachSpoilers } from '@/lib/spoilers';
import { cyrillicBrands } from '@/lib/brands';
import { weightOf } from '@/lib/weights';
import { apiBase, deleteImport, togetherCall, fetchFollows, fetchLoopReport, fetchOwnerDesk, fetchTesters, loadState, postExport, postImport, prepareShareMessage, store, workMeta, type FollowRow, type StoredState } from './store';
import { displayName, parseInitData } from '@/lib/telegramAuth';
import type { LoopReport as LoopReportCore, WorkSignal } from '../../worker/loop';
export type LoopReportData = LoopReportCore & { scope: 'all' | 'me' };
import type {
  AgreementReport, AnnotationProvider, AnnotationReviewItem, AnnotationStatus, AssessmentAnswer, AssessmentMode,
  AssessmentSession, CheckInRequest, CheckInResult, CognitiveMapData, CognitiveOperation,
  AgreementCeilingData, AnnotationDiffRow, AnnotationRun, CoMention, Confidence, ContributorAnswer, ContributorProfile, ContributorTask,
  ContributorTaskKind, DiscussionPlace, ExternalAnalysis, FilmForm, QualityMetric, TagNeighbour, TropeMention, TropeTreeNode, Energy, ID, JourneyEntryData,
  JourneyStatus, PacketReport, Recommendation, RecommendationFeedback, RecommendationSlate, ReflectionPromptData, CognitiveState,
  DifficultyPrediction, Eagerness, PerceivedDifficulty, ISODate,
  CharacterView, CharacterImageView, CreditRole, MediaType, ExternalIds, Person, PersonId, RelationKind, RelationNodeKind, Session, WorkRelationView, SourceCandidate, Trajectory, TvTropesMapping, UserSettings, Voice, WorkCard, WorkDetail,
  WatchOption, DismissReason, FeedKind, Register,
} from '@/types/tmdf';
import { isFilm, isScreen, isSeries, normalizeWork, seriesHours } from '@/lib/media';
import { creditsOf, decodeCredits, leadCredits, isPersonId, sameCredit, workKey } from '@/lib/credits';
import { primaryKey, withBookWork, workKeys, type BookWorks } from '@/lib/keys';
import { desireShard, desiresOf, type DesireRecord } from '@/lib/desires';
import { cinemaSlug, freeFor, regionOptions, RU_CINEMAS, type WatchProviders } from '@/lib/cinemas';
import { planSubscriptions, type SubscriptionPlan } from '@/lib/subscriptionPlan';
import { CINEMA_PRICES, CURRENCY, type CinemaPrice } from '@/lib/cinemaPrices';


// ---------- справочники вне бандла (трек А, шаг А5) ----------
// Данные — каталог, разборы, замеры, история владельца — больше не запекаются в основной
// бандл: каждый модуль уходит отдельным куском и грузится, когда нужен. Основной бандл —
// только код. Три очереди:
//   · core — нужно ленте: грузится до первого ответа api (`ready`);
//   · catalog — справочник фильмов и история владельца: для поиска, оценок, импорта;
//     с сервером грузится фоном сразу после core, без сервера (разработка) — вместе с core,
//     потому что без него у владельца пустая история;
//   · work / curator — только на своих экранах.
// Куски лежат под /assets с хешем в имени и кэшируются браузером навсегда.
type Mod<T extends () => Promise<unknown>> = Awaited<ReturnType<T>>;
const coreImports = () => Promise.all([
  import('@/mocks'), import('@/mocks/workDetails'), import('@/mocks/externalIds'), import('@/mocks/userAnnotations'),
  import('@/mocks/candidates'), import('@/mocks/workRegisters'), import('@/mocks/registerBase'), import('@/mocks/candidateMedia'),
  import('@/mocks/catalogMedia'), import('@/mocks/sources'), import('@/mocks/essays'),
]);
type EssaysAuto = typeof import('@/mocks/essaysAuto')['essaysAuto'];
type PostsAuto = typeof import('@/mocks/postsAuto')['postsAuto'];
let mocks!: Mod<typeof coreImports>[0];
let bare!: Mod<typeof coreImports>[1]['bare'];
let workDetail!: Mod<typeof coreImports>[1]['workDetail'];
let externalIds!: Mod<typeof coreImports>[2]['externalIds'];
let userAnnotations!: Mod<typeof coreImports>[3]['userAnnotations'];
let candidateSeeds!: Mod<typeof coreImports>[4]['candidateSeeds'];
let seedToCard!: Mod<typeof coreImports>[4]['seedToCard'];
let workRegisters!: Mod<typeof coreImports>[5]['workRegisters'];
let registerBase!: Mod<typeof coreImports>[6]['registerBase'];
let candidateMedia!: Mod<typeof coreImports>[7]['candidateMedia'];
let catalogMedia!: Mod<typeof coreImports>[8]['catalogMedia'];
let searchLinks!: Mod<typeof coreImports>[9]['searchLinks'];
let essays!: Mod<typeof coreImports>[10]['essays'];
let essaysAuto!: EssaysAuto;
let postsAuto!: PostsAuto;
let essayLenses: Record<string, string> = {};
/** Свежий справочник с сервера: его раз в сутки пишет сборщик (tools/collect.mts, трек В1).
 *  Нет сервера, нет файла или сервер думает дольше четырёх секунд — берём запечённое в сборку. */
async function serverRef<T>(name: string): Promise<T | undefined> {
  if (!store.onServer) return undefined;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4000);
  try {
    const res = await fetch(`${apiBase}/api/reference/${name}`, { signal: ctrl.signal });
    return res.ok ? await res.json() as T : undefined;
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}

/** Сезоны сериалов (ЗП-17): справочник сервера, один раз за сеанс; без сервера — пусто (пометок нет). */
let seasonsLoading: Promise<Record<string, SeasonInfo>> | undefined;
export const getSeriesSeasons = (): Promise<Record<string, SeasonInfo>> =>
  (seasonsLoading ??= serverRef<Record<string, SeasonInfo>>('seriesSeasons').then((x) => x ?? {}));

/** Где смотреть по подписке (ЗП-42): справочник сервера (tools/watch-providers.mts), один раз за сеанс. Без
 *  сервера в разработке — кэш сборщика; нет и его — у карточек остаётся то, что они знали сами. */
/** Регион «где смотреть» (11.10, один сервер для всех языков): у русскоязычного — Россия; у остального — регион из языка
 *  браузера («en-IN» → IN), если он есть в справочнике, иначе регион сборки `VITE_WATCH_REGION` (по умолчанию Индия). */
const FOREIGN_REGION = ((import.meta.env.VITE_WATCH_REGION as string | undefined) || 'IN').toUpperCase();
let WATCH_REGION = language === 'ru' ? 'RU' : FOREIGN_REGION;
let watchRef: WatchProviders | undefined;
let watchLoading: Promise<void> | undefined;
const loadWatch = (): Promise<void> => (watchLoading ??= (async () => {
  watchRef = await serverRef<WatchProviders>('watchProviders')
    ?? (import.meta.env.DEV ? await fetch('/.cache/watch-providers.json').then((r) => (r.ok ? r.json() as Promise<WatchProviders> : undefined)).catch(() => undefined) : undefined);
  if (language !== 'ru') {
    const own = typeof navigator === 'undefined' ? undefined : navigator.language.split('-')[1]?.toUpperCase();
    if (own && watchRef?.regions?.includes(own)) WATCH_REGION = own;
  }
})());
/** Бесплатная легальная классика (ЗП-43): справочник `freeWatch` (tools/free-watch.mts) — правообладатель на YouTube,
 *  Викисклад, Internet Archive. Грузится, когда функция включена; в разработке — кэш сборщика. */
type FreeSource = { n: string; u: string; v: 'studio' | 'commons' | 'archive'; part?: number };
let freeRef: Record<string, FreeSource[]> | undefined;
let freeLoading: Promise<void> | undefined;
const loadFree = (): Promise<void> => (freeLoading ??= (async () => {
  const ref = await serverRef<{ works: Record<string, FreeSource[]> }>('freeWatch')
    ?? (import.meta.env.DEV ? await fetch('/.cache/free-watch.json').then((r) => (r.ok ? r.json() as Promise<{ works: Record<string, FreeSource[]> }> : undefined)).catch(() => undefined) : undefined);
  freeRef = ref?.works;
})());
/** Читать бесплатно (книги, 11.10): справочник `freeRead` (tools/free-read.mts) — Викитека, Gutenberg, Internet Archive.
 *  Русская Викитека — русскоязычным (текст свободен и по российскому праву), остальное — при английском интерфейсе. */
export type FreeRead = { n: string; u: string; v: 'wikisource' | 'gutenberg' | 'archive'; l: 'ru' | 'en' };
let readRef: Record<string, FreeRead[]> | undefined;
let readLoading: Promise<void> | undefined;
const loadFreeRead = (): Promise<void> => (readLoading ??= (async () => {
  const ref = await serverRef<{ works: Record<string, FreeRead[]> }>('freeRead')
    ?? (import.meta.env.DEV ? await fetch('/.cache/free-read.json').then((r) => (r.ok ? r.json() as Promise<{ works: Record<string, FreeRead[]> }> : undefined)).catch(() => undefined) : undefined);
  readRef = ref?.works;
})());
/** Где книгу прочитать бесплатно и законно — на языке интерфейса. */
export async function getFreeRead(book: Pick<WorkCard, 'id' | 'type' | 'externalIds'>): Promise<FreeRead[]> {
  await loadFreeRead();
  const key = workKeys(book, book.externalIds ?? externalIds[book.id]).find((k) => k.startsWith('wd:'));
  return (key && readRef?.[key] || []).filter((f) => f.l === (language === 'ru' ? 'ru' : 'en'));
}
/** Бесплатные источники фильма: по одному на правообладателя (у двухсерийного — первая серия). */
const freeFor_ = (c: WorkCard): FreeSource[] => {
  // ролики правообладателей проверены на доступность из России — остальным регионам их не показываем
  const key = freeRef && WATCH_REGION === 'RU' ? tmdbKey(c) : undefined;
  const list = key ? freeRef![key] ?? [] : [];
  return list.filter((f, i) => list.findIndex((x) => x.n === f.n) === i);
};
const tmdbKey = (c: WorkCard): string | undefined => workKeys(c, c.externalIds ?? externalIds[c.id]).find((k) => k.startsWith('tmdb:'));
/** Ключ справочника наличия: у фильма — TMDb, у сериала — IMDb (номер /tv/ у TMDb свой, 11.10). */
const watchKey = (c: WorkCard): string | undefined =>
  c.type === 'series' ? workKeys(c, c.externalIds ?? externalIds[c.id]).find((k) => k.startsWith('imdb:')) : tmdbKey(c);
/** Площадки справочника у карточки: к ссылкам, что у неё уже есть, — вид («по подписке»), недостающие — ссылкой
 *  TMDb на страницу «где смотреть» (там ссылки JustWatch на сами кинотеатры). */
function withWatch(c: WorkCard): WorkCard {
  // бесплатное от правообладателя — первым: прямая ссылка на сам фильм (ЗП-43)
  const free = freeFor_(c).map((f): WatchOption => ({ platform: f.n, url: f.u, source: 'wikidata', kind: 'free' }));
  const key = watchRef ? watchKey(c) : undefined;
  const r = key ? watchRef!.works[key]?.[WATCH_REGION] : undefined;
  if (!r && !free.length) return c;
  const own = [...free, ...(c.watch ?? []).filter((o) => !free.some((f) => f.url === o.url))];
  if (!r) return { ...c, watch: own };
  for (const { slug, kind } of regionOptions(r)) {
    const i = own.findIndex((o) => cinemaSlug(o.platform) === slug);
    if (i >= 0) { if (!own[i].kind) own[i] = { ...own[i], kind }; continue; }
    own.push({ platform: watchRef!.names[slug] ?? slug, url: r.l ?? `https://www.themoviedb.org/movie/${key!.slice(5)}/watch?locale=${WATCH_REGION}`, source: 'tmdb', kind });
  }
  return { ...c, watch: own };
}
/** Кинотеатры для «Моих подписок»: российские площадки (src/lib/cinemas.ts), которые в справочнике хоть сколько-то
 *  раз бывают по подписке; справочника нет — весь список. Иностранные из данных JustWatch по России (Sun Nxt,
 *  Artiflix) не предлагаем. Отмеченные раньше остаются в списке. */
export async function getCinemaChoices(): Promise<{ slug: string; name: string }[]> {
  await loadWatch();
  if (!watchRef) return WATCH_REGION === 'RU' ? RU_CINEMAS : [];
  const count = new Map<string, number>();
  for (const w of Object.values(watchRef.works)) for (const slug of w[WATCH_REGION]?.s ?? []) count.set(slug, (count.get(slug) ?? 0) + 1);
  const chosen = settings.subscriptions ?? [];
  // контур Global (ЗП-26): своего списка площадок нет — те, что в регионе чаще всего бывают по подписке
  if (WATCH_REGION !== 'RU') {
    return [...count].filter(([slug, n]) => n >= 10 || chosen.includes(slug)).sort((a, b) => b[1] - a[1]).slice(0, 12)
      .map(([slug]) => ({ slug, name: watchRef!.names[slug] ?? slug }));
  }
  const list = RU_CINEMAS.filter((c) => (count.get(c.slug) ?? 0) >= 10 || chosen.includes(c.slug));
  return list.length ? list : RU_CINEMAS;
}

/** «Какая подписка подходит» (15.10): «В планах» и верх ленты человека против площадок региона — сколько где есть, пара
 *  и подписки по очереди (src/lib/subscriptionPlan.ts). Лента — 60 лучших по той же оценке модели, без уже виденного. */
export interface SubscriptionPlanView extends SubscriptionPlan<WorkCard> {
  region: string; names: Record<string, string>; prices: Record<string, CinemaPrice>; currency?: string; owned: string[]; plannedCount: number;
}
export async function getSubscriptionPlan(): Promise<SubscriptionPlanView> {
  await films();
  await loadWatch();
  const keys = seenKeys();
  const planned = history().filter((e) => e.status === 'planned').map((e) => e.work);
  for (const e of history()) if (e.status !== 'finished') [e.work.id, ...keyList(e.work)].forEach((k) => keys.add(k));
  const state = ratedCount() >= MIN_RATED ? ownState() : undefined;
  const pool = state ? candidates().filter((c) => !keys.has(c.work.id)) : [];
  // верх по вкусу без разнообразия ленты (у неё не больше двух на операцию и один сериал — тогда в расчёт шло ~16)
  const liked = state ? pool.map((c) => ({ w: c.work, s: scoreCandidate(state, c.work, 'normal') })).filter((x) => x.s > 0.3 && !seen(x.w, keys))
    .sort((a, b) => b.s - a.s).slice(0, 60).map((x) => x.w) : [];
  const items = [...planned.map((work) => ({ work, planned: true })), ...liked.map((work) => ({ work, planned: false }))];
  const owned = settings.subscriptions ?? [];
  const prices = CINEMA_PRICES[WATCH_REGION] ?? {};
  const optionsOf = (w: WorkCard) => (withWatch(w).watch ?? []).map((o) => ({ slug: cinemaSlug(o.platform), kind: o.kind }));
  const plan = planSubscriptions(items, optionsOf, owned, Object.fromEntries(Object.entries(prices).map(([k, v]) => [k, v.price])));
  const names: Record<string, string> = { ...(watchRef?.names ?? {}), ...Object.fromEntries(RU_CINEMAS.map((c) => [c.slug, c.name])) };
  return { ...plan, region: WATCH_REGION, names, prices, currency: CURRENCY[WATCH_REGION], owned, plannedCount: planned.length };
}

/** Можно смотреть без доплаты — по справочнику, до картинок и живых запросов: для отбора ленты. */
const noExtra = (c: WorkCard, subscriptions: readonly string[]): boolean => freeFor(withWatch(c).watch ?? [], subscriptions);

/** Каналы реестра из базы приложения (06.10, GET /api/sources): правка канала доходит до карточки без
 *  пересборки. Нет сервера или он молчит дольше четырёх секунд — снимок из сборки. */
async function serverSources(): Promise<Mod<typeof coreImports>[9]['sources'] | undefined> {
  if (!store.onServer) return undefined;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4000);
  try {
    const res = await fetch(`${apiBase}/api/sources`, { signal: ctrl.signal });
    const list = res.ok ? await res.json() as unknown : undefined;
    return Array.isArray(list) ? list as Mod<typeof coreImports>[9]['sources'] : undefined;
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}

/** Ядро — один раз: справочнику (catalog) нужны externalIds из ядра, и если ядро ждёт ответа
 *  сервера (serverRef), справочник успевал раньше и падал на пустых externalIds (найдено 01.10). */
let coreLoading: Promise<void> | undefined;
const core = (): Promise<void> => (coreLoading ??= loadCore());
async function loadCore(): Promise<void> {
  const [[m, wd, ei, ua, cs, wr, rb, cm, ctm, src, es], freshEssays, freshPosts, freshLenses, freshSources] = await Promise.all([
    coreImports(),
    serverRef<EssaysAuto>('essaysAuto'),
    serverRef<PostsAuto>('postsAuto'),
    serverRef<Record<string, string>>('essayLenses'),
    serverSources(),
  ]);
  // запечённые в сборку индексы (~1,3 МБ сжатыми) — только если сервер свежих не дал (07.10): раньше они
  // качались всегда, и с сервером приложение тянуло их дважды
  const [ea, pa, el] = await Promise.all([
    freshEssays ? undefined : import('@/mocks/essaysAuto'),
    freshPosts ? undefined : import('@/mocks/postsAuto'),
    freshLenses ? undefined : import('@/mocks/essayLenses'),
  ]);
  if (freshSources) src.replaceSources(freshSources);
  mocks = m; bare = wd.bare; workDetail = wd.workDetail; externalIds = ei.externalIds; userAnnotations = ua.userAnnotations;
  candidateSeeds = cs.candidateSeeds; seedToCard = cs.seedToCard; workRegisters = wr.workRegisters; registerBase = rb.registerBase;
  candidateMedia = cm.candidateMedia; catalogMedia = ctm.catalogMedia; searchLinks = src.searchLinks;
  essays = es.essays; essaysAuto = freshEssays ?? ea!.essaysAuto; postsAuto = freshPosts ?? pa!.postsAuto;
  // рубрики роликов (ТВ-3г) — один раз при загрузке, на все источники: в карточке, у автора,
  // у человека и во вселенной материал один и тот же объект
  essayLenses = freshLenses ?? el!.essayLenses;
  for (const src of [essays, essaysAuto]) for (const list of Object.values(src)) attachLenses(list, essayLenses);
  // «без спойлеров» по слову автора (ДФ-8) — открыто до «Видел»; и у постов Telegram
  for (const src of [essays, essaysAuto, postsAuto]) for (const list of Object.values(src)) attachSpoilers(list);
  settings = { ...mocks.settings, ...settings };
  contributor ??= mocks.contributors[0];
}

// до загрузки — пустые: синхронный код (knownWorks, history) не падает, а просто не видит их
let userWorks: WorkCard[] = [];
let userJournal: JourneyEntryData[] = [];
let userRatings: Record<string, { rating: 1 | 2 | 3 | 4 | 5; raw: number }> = {};
let watchedWorks: WorkCard[] = [];
let filmBase: WorkCard[] = [];
let filmBaseWiki: WorkCard[] = [];
/** авторы (Д2): справочник людей и «ключ произведения → кто и в какой роли» из
 *  tools/resolve-credits.mts; карточке их подкладывает `withCredits` */
let people: Record<PersonId, Person> = {};
let workCredits: Record<string, string> = {};
/** фильмы и сериалы с полок по просьбам людей (shelves.ts → filmBaseCurated.ts): ключ → карточка */
let shelfWorks = new Map<string, WorkCard>();
/** полка → ключи её произведений по порядку */
let shelfKeys: Record<string, string[]> = {};
/** черновая разметка самых смотримых (трек Г1): ключ — фильм (`tmdb:<id>`), не карточка */
let draftAnnotations: Record<string, FirstPassAnnotation> = {};
/** черновая разметка сериалов (Е2): ключ `imdb:`, у антологии — по сезонам */
let seriesAnnotations: Record<string, SeriesDraft> = {};
/** мост «ISBN → произведение» (З1, tools/resolve-book-works.mts) */
let bookBridge: BookWorks = {};
/** метаданные книг (З3, tools/build-book-media.mts): ключ произведения → поля карточки */
let bookMedia: Record<string, Partial<WorkCard>> = {};
/** ручная разметка книг (З4, калибровка владельца): ключ произведения или `t:<название>` */
let bookAnnotations: Record<string, FirstPassAnnotation> = {};
/** черновики книг (З4, 08.10): по знанию книги, на проверке; калибровка владельца главнее */
let bookDrafts: Record<string, FirstPassAnnotation> = {};
/** стихи и циклы книг (РР-0, tools/build-book-series.mts): элемент Wikidata стихотворения; цикл → тома по порядку;
 *  том → его циклы */
let bookPoems = new Set<string>();
let bookCycles: Record<string, string[]> = {};
const cyclesOfBook = new Map<string, string[]>();
let draftMeta: { model: string; createdAt: ISODate; tmdfVersion: string; provider: AnnotationProvider } | undefined;
let catalogLoad: Promise<void> | undefined;
let filmsLoad: Promise<void> | undefined;
let booksLoad: Promise<void> | undefined;
/** книги уже в справочнике (РР-1): «Почитать» в общей ленте не ждёт их, а берёт, когда пришли */
let booksReady = false;
/** справочник фильмов пришёл (РР-5): снимок колоды больше не нужен */
let filmsReady = false;
/** обложки, кадры и регистр карточкам из Wikidata (tools/build-base-media.mts) — нужны и книгам, пришедшим позже */
let baseMedia: Record<string, Partial<WorkCard>> = {};
const loadCatalog = (): Promise<void> => catalog();
/** Превью без сервера как новый человек (ТВ-7): `?fresh` в адресе или `tm.fresh=1` в localStorage.
 *  Без сервера приложение живёт на истории владельца и демо-дневнике — холодный старт, первые
 *  ленты и правило «новичку — с разбором» там не видны. С сервером не действует. */
const freshStart: boolean = !store.onServer && (() => {
  try { return new URLSearchParams(location.search).has('fresh') || localStorage.getItem('tm.fresh') === '1'; } catch { return false; }
})();

/** Весь справочник: фильмы, сериалы, книги и история владельца. Повторный вызов ждёт ту же загрузку. */
function catalog(): Promise<void> {
  catalogLoad ??= loadFilms().then(() => Promise.all([loadBooks(), loadSeriesWiki(), loadFilmLinks()])).then(() => undefined);
  return catalogLoad;
}

/** Справочник для первой ленты и колоды (РР-1): без книг, если своих книг у человека нет. Свои есть — ждём и книги:
 *  модели вкуса нужна их разметка. */
function films(): Promise<void> {
  return loadFilms().then(() => ([...history().map((e) => e.work), ...watchedNow()].some((w) => w.type === 'book') ? loadBooks() : undefined));
}

/** Справочник под действие с произведением (РР-1): книге — с книгами, фильму и сериалу хватает `films()` — оценки в
 *  колоде новичка и отметки в ленте не тянут книги. Карточки книжного каталога — `b-…`; свои книги человека и так
 *  приводят `films()` к книгам. */
const catalogFor = (id: ID): Promise<void> => (id.startsWith('b-') ? catalog() : films());

/** Сериалы со статьёй в русской Википедии (РР-4, 15.10, tools/grow-film-base.mts --series-only): ~2 тыс. карточек и их
 *  разметка (seriesAnnotationsWiki.ts) — не в
 *  первой загрузке, как и книги (РР-1): в подбор сериалы пока не идут (Е4), они нужны поиску, страницам и импорту, то
 *  есть `catalog()`. Порядок тот же, что у справочника: убранное владельцем — мимо, уже известное — мимо. */
/** Авторы роста справочника (15.10, tools/resolve-credits.mts): люди и связи «кто снял» новых фильмов и сериалов — не в
 *  первой загрузке, приходят вместе с их карточками. */
let creditsMoreLoad: Promise<void> | undefined;
function loadCreditsMore(): Promise<void> {
  creditsMoreLoad ??= Promise.all([import('@/mocks/peopleMore'), import('@/mocks/workCreditsMore')]).then(([pm, wm]) => {
    people = { ...pm.peopleMore, ...people };
    workCredits = { ...wm.workCreditsMore, ...workCredits };
  }).catch((err) => { creditsMoreLoad = undefined; throw err; });
  return creditsMoreLoad;
}

let seriesWikiLoad: Promise<void> | undefined;
function loadSeriesWiki(): Promise<void> {
  seriesWikiLoad ??= Promise.all([loadFilms(), import('@/mocks/seriesBaseWiki'), import('@/mocks/seriesAnnotationsWiki'), loadCreditsMore()]).then(([, m, ann]) => {
    // их разметка (заход 18) — тоже отдельно от seriesAnnotations.ts, по той же причине
    seriesAnnotations = { ...ann.seriesAnnotationsWiki, ...seriesAnnotations };
    const have = new Set(filmBaseWiki.map((w) => w.id));
    const cards = m.seriesBaseWiki.filter((w) => !have.has(w.id) && !isWithheld(w)).map((w) => withCredits(normalizeWork(baseMedia[w.id] ? { ...w, ...baseMedia[w.id] } : w)));
    filmBaseWiki = [...filmBaseWiki, ...cards];
  }).catch((err) => { seriesWikiLoad = undefined; throw err; });
  return seriesWikiLoad;
}

/** Мировое кино со статьёй в русской Википедии от 10 разделов (РР-5, 15.10, tools/grow-film-base.mts --film-links 10
 *  --out filmBaseLinks): тысячи карточек и их разметка (draftAnnotationsLinks.ts) — не в первой загрузке, как сериалы
 *  РР-4. Хвост — остальное кино со статьёй в русской Википедии (filmBaseTail.ts) — только для поиска и страниц, без
 *  разметки (владелец 15.10). Первая лента обходится известным кино; после `catalog()` эти фильмы — в поиске, на страницах и в подборе
 *  (черновики подбора собираются из `draftAnnotations` на каждый запрос). */
let filmLinksLoad: Promise<void> | undefined;
function loadFilmLinks(): Promise<void> {
  filmLinksLoad ??= Promise.all([loadFilms(), import('@/mocks/filmBaseLinks'), import('@/mocks/draftAnnotationsLinks'), import('@/mocks/filmBaseTail'), loadCreditsMore()]).then(([, m, ann, tail]) => {
    draftAnnotations = { ...ann.draftAnnotationsLinks, ...draftAnnotations };
    const have = new Set(filmBaseWiki.map((w) => w.id));
    const cards = [...m.filmBaseLinks, ...tail.filmBaseTail].filter((w) => !have.has(w.id) && !isWithheld(w)).map((w) => withCredits(normalizeWork(baseMedia[w.id] ? { ...w, ...baseMedia[w.id] } : w)));
    filmBaseWiki = [...filmBaseWiki, ...cards];
  }).catch((err) => { filmLinksLoad = undefined; throw err; });
  return filmLinksLoad;
}

/** Книги (РР-1): каталог, черновики и метаданные — не в первой загрузке (вместе ~330 КБ сжатыми на 14.10, а с ростом
 *  каталога книг (РР-2, РР-3) — в разы больше). Грузятся с `catalog()` — поиск, страницы, лента и колода книг, — а
 *  первая лента кино и колода фильмов их не ждут. Порядок обработки карточек тот же, что у справочника фильмов. */
function loadBooks(): Promise<void> {
  booksLoad ??= Promise.all([loadFilms(), import('@/mocks/bookBase'), import('@/mocks/bookMedia'), import('@/mocks/bookDrafts')])
    .then(([, bb, bmd, bd]) => {
      bookMedia = bmd.bookMedia; bookDrafts = bd.bookDrafts;
      const have = new Set(filmBaseWiki.map((w) => w.id));
      const cards = bb.bookBase.filter((w) => !have.has(w.id) && !isWithheld(w)).map((w) => (baseMedia[w.id] ? { ...w, ...baseMedia[w.id] } : w));
      filmBaseWiki = [...filmBaseWiki, ...cards];
      // метаданные и обложки книг (З3) — там, где карточка сама их не принесла; авторы (Д2) — новым карточкам
      if (Object.keys(bookMedia).length) {
        const booked = (ws: WorkCard[]) => ws.map(withBookMedia);
        userWorks = booked(userWorks); watchedWorks = booked(watchedWorks);
        filmBase = booked(filmBase); filmBaseWiki = booked(filmBaseWiki);
      }
      if (Object.keys(workCredits).length) {
        const credited = (ws: WorkCard[]) => ws.map((w) => (w.type === 'book' ? withCredits(w) : w));
        userWorks = credited(userWorks); watchedWorks = credited(watchedWorks); filmBaseWiki = credited(filmBaseWiki);
      }
      booksReady = true;
    });
  return booksLoad;
}

/** Справочник без книг: фильмы, сериалы, история владельца, разметка. */
function loadFilms(): Promise<void> {
  filmsLoad ??= Promise.all([
    import('@/mocks/userHistory'), import('@/mocks/userRatings'), import('@/mocks/userWatched'),
    import('@/mocks/filmBase'), import('@/mocks/filmBaseWiki'), import('@/mocks/filmBaseMarkup'),
    serverRef<WorkCard[]>('filmBaseWiki'), import('@/mocks/draftAnnotations'), import('@/mocks/filmBaseCurated'),
    import('@/mocks/baseMedia'), import('@/mocks/people'), import('@/mocks/workCredits'), import('@/mocks/seriesAnnotations'), import('@/mocks/seriesBase'), import('@/mocks/bookWorks'), import('@/mocks/bookAnnotations'),
    import('@/mocks/filmBasePopular'), import('@/mocks/filmBaseWorld'), import('@/mocks/seriesRegisters'), import('@/mocks/bookSeries'),
  ]).then(async (mods) => {
    await core();
    // фильмы из загрузок каналов (6 тыс. карточек, ~250 КБ сжатыми) сервер отдаёт в справочнике — копию
    // из сборки грузим, только если сервер не ответил (и в разработке)
    const fch = mods[6] ? { filmBaseChannels: [] as WorkCard[] } : await import('@/mocks/filmBaseChannels');
    return [...mods, fch] as const;
  }).then(([uh, ur, uw, fb, fw, fm, freshWiki, da, fc, bm, pp, wc, sa, sb, bw, ba, fp, fwo, sr, bs, fch]) => {
    bookAnnotations = ba.bookAnnotations;
    bookPoems = new Set(bs.bookPoems); bookCycles = bs.bookCycles;
    for (const [c, vols] of Object.entries(bookCycles)) for (const v of vols) cyclesOfBook.set(v, [...(cyclesOfBook.get(v) ?? []), c]);
    // книга — произведение (З1): карточкам с ISBN — работа Open Library и элемент Wikidata по мосту
    bookBridge = bw.bookWorks;
    for (const [id, ids] of Object.entries(externalIds)) { const enriched = withBookWork(ids, bookBridge); if (enriched !== ids) (externalIds as Record<string, ExternalIds>)[id] = enriched!; }
    seriesAnnotations = sa.seriesAnnotations;
    people = pp.people; workCredits = wc.workCredits;
    draftAnnotations = da.draftAnnotations; draftMeta = da.draftAnnotationMeta;
    // сериал — свой вид (Е1): старые карточки с format:'series' (сервер, выгрузки) приводятся здесь
    const norm = (ws: readonly WorkCard[]) => ws.map((w) => {
      const n = normalizeWork(w);
      const ids = withBookWork(n.externalIds, bookBridge);
      return ids === n.externalIds ? n : { ...n, externalIds: ids };
    });
    userWorks = norm(uh.userWorks); userJournal = uh.userJournal; userRatings = ur.userRatings;
    watchedWorks = norm(uw.watchedWorks); filmBase = norm(fb.filmBase);
    // «чистый новичок» (ТВ-7): без истории владельца — справочник тот же, человек пустой
    if (freshStart) { userWorks = []; userJournal = []; userRatings = {}; watchedWorks = []; }
    filmBaseWiki = norm(freshWiki ?? [...fw.filmBaseWiki, ...fm.filmBaseMarkup]);
    // полки по просьбам людей (shelves.ts) едут со сборкой, а не с сервером: их мало и они размечены
    const seen = new Set(filmBaseWiki.map((w) => w.id));
    filmBaseWiki = [...filmBaseWiki, ...norm(fc.filmBaseCurated).filter((w) => !seen.has(w.id))];
    // сериалы с черновой разметкой из присланных профилей (Е2, tools/build-series-base.mts): без
    // карточки черновик некуда показать ни на странице, ни в кураторской
    for (const w of [...fc.filmBaseCurated, ...filmBaseWiki]) seen.add(w.id);
    filmBaseWiki = [...filmBaseWiki, ...sb.seriesBase.filter((w) => !seen.has(w.id))];
    // книги через мост с кино (З2, tools/build-book-base.mts): поиск, страницы, связи «экранизация
    // книги» ведут на карточку; в подбор без разметки не идут (З4)
    for (const w of sb.seriesBase) seen.add(w.id);
    // что люди ищут (05.10, tools/grow-film-base.mts): топы русской Википедии и классика. Сервер
    // отдаёт их в справочнике, но сборка несёт и свою копию — на случай, если сервер старее
    for (const w of filmBaseWiki) seen.add(w.id);
    filmBaseWiki = [...filmBaseWiki, ...norm(fp.filmBasePopular).filter((w) => !seen.has(w.id))];
    for (const w of fp.filmBasePopular) seen.add(w.id);
    // популярное в Индии и англоязычных странах (ЗП-22, tools/grow-film-base.mts --world) — так же
    filmBaseWiki = [...filmBaseWiki, ...norm(fwo.filmBaseWorld).filter((w) => !seen.has(w.id))];
    for (const w of fwo.filmBaseWorld) seen.add(w.id);
    // фильмы из загрузок каналов студий и агрегаторов (tools/grow-from-channels.mts, 10.10) — так же
    filmBaseWiki = [...filmBaseWiki, ...norm(fch.filmBaseChannels).filter((w) => !seen.has(w.id))];
    for (const w of fch.filmBaseChannels) seen.add(w.id);
    // книги — отдельно, по требованию (`loadBooks`, РР-1)
    // убранное владельцем (withheldWorks.ts): ни поиска, ни страниц — и из справочника старого сервера
    filmBase = filmBase.filter((w) => !isWithheld(w)); filmBaseWiki = filmBaseWiki.filter((w) => !isWithheld(w));
    // обложки, кадры и регистр карточкам из Wikidata (tools/build-base-media.mts, 30.09): без них
    // в колоде /rate и в ленте пустая плитка, а подбор не видит регистра
    const media = baseMedia = bm.baseMedia;
    // и справочнику самых смотримых (ТВ-10, 14.10): «Интерстеллар» и «Криминальное чтиво» колоды /rate — его карточки
    const withBase = (w: WorkCard) => (media[w.id] ? { ...w, ...media[w.id] } : w);
    if (Object.keys(media).length) { filmBaseWiki = filmBaseWiki.map(withBase); filmBase = filmBase.map(withBase); }
    // картинка по ключу произведения (ТВ-10, 14.10): тот же «Чужой» приходит карточкой справочника без кадра и
    // карточкой истории владельца, пула или каталога с кадром — справочнику берём известную. История — из модуля, а не
    // `userWorks`: у «чистого новичка» та пуста, а картинки фильмов не личное
    const pics = new Map<string, Pick<WorkCard, 'coverUrl' | 'stillUrl' | 'imageSource'>>();
    for (const w of [...uh.userWorks, ...uw.watchedWorks, ...Object.values(mocks.works).map((c) => ({ ...c, ...catalogMedia[c.id] })),
      ...candidateSeeds.map((s) => ({ ...seedToCard(s), ...candidateMedia[s.id] }) as WorkCard)]) {
      const k = (w.stillUrl || w.coverUrl) && workKey(w, w.externalIds ?? externalIds[w.id]);
      if (k && !pics.has(k)) pics.set(k, { ...(w.coverUrl ? { coverUrl: w.coverUrl } : {}), ...(w.stillUrl ? { stillUrl: w.stillUrl } : {}), ...(w.imageSource ? { imageSource: w.imageSource } : {}) });
    }
    const pictureOf = (w: WorkCard) => {
      const p = w.stillUrl || w.coverUrl ? undefined : pics.get(workKey(w, w.externalIds ?? externalIds[w.id]) ?? '');
      return p ? { ...w, ...p } : w;
    };
    filmBase = filmBase.map(pictureOf); filmBaseWiki = filmBaseWiki.map(pictureOf);
    // регистр сериалов (11.10, tools/build-series-registers.mts) — по ключу imdb:, где у карточки своего нет: без него
    // «подобрать словами», образец-сериал, фильтры своего списка и якорь вкуса сериалов не видели
    seriesRegs = sr.seriesRegisters;
    if (Object.keys(seriesRegs).length) {
      const regged = (ws: WorkCard[]) => ws.map((w) => {
        if (w.registers?.length || !isSeries(w)) return w;
        const imdb = (w.externalIds ?? externalIds[w.id])?.imdb;
        const r = imdb ? seriesRegs[`imdb:${imdb}`] : undefined;
        return r ? { ...w, registers: r } : w;
      });
      userWorks = regged(userWorks); watchedWorks = regged(watchedWorks);
      filmBase = regged(filmBase); filmBaseWiki = regged(filmBaseWiki);
    }
    // авторы с элементами Wikidata (Д2) — там, где карточка сама их не принесла
    if (Object.keys(workCredits).length) {
      const credited = (ws: WorkCard[]) => ws.map(withCredits);
      userWorks = credited(userWorks); watchedWorks = credited(watchedWorks);
      filmBase = credited(filmBase); filmBaseWiki = credited(filmBaseWiki);
    }
    // по ключам полок из всего справочника: «2046» уже был в нём до полки
    const onShelf = new Set(Object.values(fc.shelfKeys).flat());
    const shelfKey = (w: WorkCard) => (isSeries(w) ? w.externalIds?.imdb && `imdb:${w.externalIds.imdb}`
      : w.externalIds?.tmdb != null && `tmdb:${w.externalIds.tmdb}`);
    shelfWorks = new Map();
    for (const w of [...fc.filmBaseCurated, ...filmBase, ...filmBaseWiki]) {
      const k = shelfKey(w);
      if (k && onShelf.has(k) && !shelfWorks.has(k)) shelfWorks.set(k, w);
    }
    shelfKeys = fc.shelfKeys;
    filmsReady = true;
  });
  return filmsLoad;
}

/** Авторы карточки: свои `credits`, иначе запись резолва авторов по ключу произведения (Д2). */
function withCredits<T extends WorkCard>(w: T): T {
  if (w.credits?.length) return w;
  const credits = decodeCredits(workCredits[workKey(w, w.externalIds ?? externalIds[w.id]) ?? ''], people);
  return credits.length ? { ...w, credits } : w;
}

/** Связи произведения (Ж1) — в обе стороны: «экранизация романа», и «по этому роману сняли».
 *  По ту сторону — наша карточка, если произведение у нас есть. Порядок: откуда это (экранизация,
 *  ремейк, сиквел чего), потом что из этого выросло, потом цикл и франшиза. */
function relationsFor(work: WorkCard): WorkRelationView[] {
  const key = workKey(work, work.externalIds ?? externalIds[work.id]);
  const q = (key && relationQid.get(key)) || work.externalIds?.wikidata;
  if (!q || !relationEdges.length) return [];
  const byKey = worksByAnalysisKey();
  const view = (kind: RelationKind, direction: 'out' | 'in', other: string): WorkRelationView | undefined => {
    const n = relationNodes[other];
    if (!n) return undefined;
    // книга из каталога через мост с кино (З2) подписана своим элементом — `wd:<Q>`, даже если
    // связи собирались раньше, чем она попала в справочник
    const card = byKey.get(n.key ?? `wd:${other}`);
    return { kind, direction, qid: other, title: n.t, ...(n.y ? { year: n.y } : {}), nodeKind: n.k, ...(card ? { workId: card.id } : {}) };
  };
  const out: WorkRelationView[] = [];
  for (const [a, kind, b] of relationEdges) {
    if (kind === 'part_of' && listLike(relationNodes[b]?.t)) continue;
    const v = a === q ? view(kind, 'out', b) : b === q && kind !== 'part_of' ? view(kind, 'in', a) : undefined;
    if (v && !out.some((x) => x.qid === v.qid && x.kind === v.kind && x.direction === v.direction)) out.push(v);
  }
  const rank = (r: WorkRelationView) => (r.kind === 'part_of' ? 3 : r.direction === 'out' ? 0 : 1) * 10
    + ['adaptation_of', 'remake_of', 'sequel_of', 'part_of'].indexOf(r.kind);
  return out.sort((x, y) => rank(x) - rank(y) || (x.year ?? 9999) - (y.year ?? 9999)).slice(0, 20);
}

/** Герои через несколько произведений (И1): ключ произведения → элементы героев. */
let characters: Record<string, CharacterRecord> = {};
let charactersByKey = new Map<string, string[]>();

/** Герои произведения, которые есть и в других наших произведениях: по ним — ссылки на те
 *  произведения. Сначала самые обсуждаемые; героев не больше шести, произведений у героя — восьми
 *  с хвостом «и ещё N». Своё произведение (по любому ключу) в «ещё в» не попадает. */
/** Изображения героев (tools/character-images.mts) — отдельным куском, со страницами произведения и героя. */
let characterImages: Mod<typeof characterImagesImport>['characterImages'] = {};
const characterImagesImport = () => import('@/mocks/characterImages');
let characterImagesLoad: Promise<void> | undefined;
const loadCharacterImages = () => (characterImagesLoad ??= characterImagesImport().then((m) => { characterImages = m.characterImages; }).catch(() => undefined));
/** Своего исполнителя в этом произведении — первым: Джокер в «Джокере» — Феникс, а не Леджер. */
function characterImage(id: string, keys: readonly string[] = []): CharacterImageView | undefined {
  const c = characterImages[id];
  if (!c) return undefined;
  const own = keys.map((k) => c.byWork?.[k]).find(Boolean);
  if (own) return { url: own.img, actor: own.actor, source: 'tmdb' };
  return { url: c.img, ...(c.actor ? { actor: c.actor } : {}), source: c.src };
}
function heroesFor(work: WorkCard): CharacterView[] {
  const own = workKeys(work, work.externalIds ?? externalIds[work.id]);
  const qs = [...new Set(own.flatMap((k) => charactersByKey.get(k) ?? []))];
  if (!qs.length) return [];
  const byKey = worksByAnalysisKey();
  const out: CharacterView[] = [];
  for (const q of qs) {
    const c = characters[q];
    const seenIds = new Set<string>([work.id]);
    const elsewhere = c.works.filter((k) => !own.includes(k)).map((k) => byKey.get(k))
      .filter((w): w is WorkCard => Boolean(w && !seenIds.has(w.id) && seenIds.add(w.id)))
      .sort((a, b) => (a.year || 9999) - (b.year || 9999))
      .map((w) => ({ workId: w.id, title: w.title, ...(w.year ? { year: w.year } : {}), type: w.type }));
    const image = characterImage(q, own);
    if (elsewhere.length) out.push({ id: q, name: c.n, elsewhere, said: c.said, ...(image ? { image } : {}) });
  }
  return out.sort((a, b) => b.said - a.said || b.elsewhere.length - a.elsewhere.length).slice(0, 6);
}

/** Страница героя (И2): его версии по произведениям и видам — книги, фильмы, сериалы — и разборы,
 *  которые называют его в заголовке. Адрес — элемент Wikidata героя. */
export interface CharacterPage {
  id: string;
  name: string;
  image?: CharacterImageView;
  /** в оригинале, если отличается: «Sherlock Holmes» */
  original?: string;
  aka: string[];
  /** по видам — книги первыми (с них чаще всё начинается), внутри — по году */
  byKind: { kind: MediaType; works: { work: WorkCard; seen: boolean; analyses: number }[] }[];
  /** самое раннее из наших — часто книга, с которой герой пришёл */
  first?: WorkCard;
  /** кто играл (06.10): актёр и его кадр в роли по произведениям, по году; один актёр — один раз */
  cast: { actor: string; image: string; work: WorkCard }[];
  /** с чего начать: непросмотренное с разметкой — ближе всего к «чуть выше привычного» */
  startWith?: { work: WorkCard; level: number };
  /** разборы, называющие героя в заголовке: по его произведениям и по любым другим; обзоры не
   *  показываем (решение 29.09); подтверждённые и свежие первыми */
  analyses: { work: WorkCard; analysis: ExternalAnalysis; seen: boolean; own: boolean }[];
  discussions: DiscussionPlace[];
}

export async function getCharacter(id: string): Promise<CharacterPage | undefined> {
  await delay(200);
  await Promise.all([catalog(), workRefs(), loadCharacterImages()]);
  const c = characters[id];
  if (!c) return undefined;
  const byKey = worksByAnalysisKey();
  const keys = seenKeys();
  const seenIds = new Set([...history().filter((e) => e.status === 'finished').map((e) => e.work.id), ...watchedNow().map((w) => w.id)]);
  const isSeen = (w: WorkCard) => seenIds.has(w.id) || seen(w, keys);
  const card = (k: string) => { const raw = byKey.get(k); return raw && (isSeries(raw) ? withSeriesDraft(raw) : annotated(raw)); };

  // разборы, называющие героя: по всем ключам корпуса, к нашей карточке
  // у его произведений хватает и слова имени («Холмса»), у чужих — только «широкого» имени, которое
  // отобрала сборка (`w`: из двух слов или одно, но не обычное слово и не имя другого героя) —
  // «Шерлок в России» в подборке «что смотреть» не Холмс, «Нолан» не Билли Нолан
  const shared = sharedWords(Object.values(characters).map((x) => x.n));
  const re = nameRegex(nameForms({ ru: c.n, en: c.en, aka: c.aka }, { shared }));
  const reOther = c.w ? nameRegex(c.w) : undefined;
  const ownKeys = new Set(c.works);
  const analyses: CharacterPage['analyses'] = [];
  const perWork = new Map<string, number>();
  const seenUrl = new Set<string>();
  if (re) {
    for (const src of [essays, essaysAuto, postsAuto]) {
      for (const [k, list] of Object.entries(src)) {
        for (const a of list) {
          const own = ownKeys.has(k);
          const match = own ? re : reOther;
          // обзоры не показываем (29.09) — кроме размеченных «О персонаже» (ТВ-3ж, 06.10): разбор героя
          // у обзорного канала — ровно то, за чем пришли на его страницу
          const about = a.lens === 'character' || a.lensAlso === 'character';
          if ((a.tier === 'review' && !about) || seenUrl.has(a.url) || !match?.test(a.title) || linkVerdicts.get(a.url) === 'other_work') continue;
          const w = card(k);
          if (!w) continue;
          seenUrl.add(a.url);
          analyses.push({ work: w, analysis: a, seen: isSeen(w), own });
          perWork.set(w.id, (perWork.get(w.id) ?? 0) + 1);
        }
      }
    }
  }
  const stamp = (a: ExternalAnalysis) => (a.publishedAt ? Date.parse(a.publishedAt) : 0);
  const isAbout = (a: ExternalAnalysis) => Number(a.lens === 'character') * 2 + Number(a.lensAlso === 'character');
  analyses.sort((x, y) => Number(Boolean(x.analysis.unverified)) - Number(Boolean(y.analysis.unverified))
    || isAbout(y.analysis) - isAbout(x.analysis) || Number(y.own) - Number(x.own) || stamp(y.analysis) - stamp(x.analysis));

  // постеры — как у страницы автора: справочник картинок и TMDb (06.10; раньше у героя были одни буквы)
  const own = [...new Map(c.works.map((k) => card(k)).filter((w): w is WorkCard => Boolean(w)).map((w) => [w.id, w])).values()];
  const works = (await pictured(own.slice(0, 40), { bare: true }).then((p) => [...p, ...own.slice(40)]))
    .map((work) => ({ work, seen: isSeen(work), analyses: perWork.get(work.id) ?? 0 }))
    .sort((a, b) => (a.work.year || 9999) - (b.work.year || 9999));
  if (!works.length) return undefined;
  const byWork = characterImages[id]?.byWork ?? {};
  const workOf = new Map(works.map((x) => [x.work.id, x.work]));
  const cast: CharacterPage['cast'] = [];
  for (const k of c.works) {
    const role = byWork[k];
    const raw = role && card(k);
    const work = raw && (workOf.get(raw.id) ?? raw);
    if (work && !cast.some((x) => x.actor === role.actor)) cast.push({ actor: role.actor, image: role.img, work });
  }
  cast.sort((a, b) => (a.work.year || 9999) - (b.work.year || 9999));
  const ORDER: MediaType[] = ['book', 'film', 'series'];
  const byKind = ORDER.map((kind) => ({ kind, works: works.filter((x) => x.work.type === kind) })).filter((g) => g.works.length);

  const comfort = ownState()?.complexityComfort;
  const open = works.filter((x) => !x.seen && x.work.complexityLevel > 0);
  const pick = [...open].sort((a, b) => (comfort != null
    ? Math.abs(a.work.complexityLevel - (comfort + 1)) - Math.abs(b.work.complexityLevel - (comfort + 1))
    : a.work.complexityLevel - b.work.complexityLevel) || b.analyses - a.analyses)[0];

  const probe = { id: `h-${id}`, type: 'film', title: c.n, year: 0, creators: [], primaryOperations: [], complexityLevel: 0,
    warnings: [], barriers: [], isNicheMasterpiece: false } as WorkCard;
  const seenLink = new Set<string>();
  const discussions = [...searchLinks(probe), ...searchLinks(probe, 'place')]
    .filter((d) => (seenLink.has(d.url) ? false : (seenLink.add(d.url), true))).slice(0, 10);
  return {
    id, name: c.n, ...(c.en && c.en !== c.n ? { original: c.en } : {}), aka: (c.aka ?? []).filter((x) => x !== c.n),
    ...(characterImage(id) ? { image: characterImage(id) } : {}),
    byKind, cast, ...(works[0]?.work.year ? { first: works[0].work } : {}),
    ...(pick ? { startWith: { work: pick.work, level: pick.work.complexityLevel } } : {}),
    analyses: analyses.slice(0, 15), discussions,
  };
}

/** Герои по запросу поиска (И2): имя, оригинальное имя или синоним начинается с запроса или
 *  содержит его словом — «джокер», «холмс», «шерлок». Не больше трёх. */
export async function searchCharacters(query: string): Promise<{ id: string; name: string; works: number }[]> {
  const q = searchKey(query);
  if (q.length < 3) return [];
  await workRefs();
  const hit = (name?: string): boolean => Boolean(name && (searchKey(name).startsWith(q) || searchKey(name).split(/[\s-]+/).some((w) => w.startsWith(q))));
  return Object.entries(characters)
    .filter(([, c]) => hit(c.n) || hit(c.en) || (c.aka ?? []).some(hit))
    .sort(([, a], [, b]) => b.said - a.said)
    .slice(0, 3)
    .map(([id, c]) => ({ id, name: c.n, works: c.works.length }));
}

/** Вселенные (Ж2): связные куски графа связей. Средоточие — франшиза, иначе цикл, иначе узел с
 *  наибольшим числом связей (при равенстве — самый ранний): «Дюна» — франшиза, а у «Сталкера» без
 *  франшизы средоточием станет повесть. Считается один раз на загрузку связей. */
let universes: { hubOf: Map<string, string>; members: Map<string, string[]> } | undefined;
function universeIndex(): NonNullable<typeof universes> {
  if (universes) return universes;
  const parent = new Map<string, string>();
  const find = (x: string): string => { let r = x; while (parent.get(r) !== r) r = parent.get(r) ?? (parent.set(r, r), r); parent.set(x, r); return r; };
  const degree = new Map<string, number>();
  for (const [a, kind, b] of relationEdges) {
    // перечень («100 величайших…») не склеивает фильмы во вселенную — даже в связях, собранных до правила
    if (kind === 'part_of' && listLike(relationNodes[b]?.t)) continue;
    for (const x of [a, b]) { if (!parent.has(x)) parent.set(x, x); degree.set(x, (degree.get(x) ?? 0) + 1); }
    parent.set(find(a), find(b));
  }
  const groups = new Map<string, string[]>();
  for (const x of parent.keys()) (groups.get(find(x)) ?? groups.set(find(x), []).get(find(x))!).push(x);
  const hubOf = new Map<string, string>();
  const members = new Map<string, string[]>();
  const weight = (q: string) => hubWeight(relationNodes[q]);
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    const hub = [...list].sort((a, b) => weight(b) - weight(a) || (degree.get(b) ?? 0) - (degree.get(a) ?? 0)
      || (relationNodes[a]?.y ?? 9999) - (relationNodes[b]?.y ?? 9999))[0];
    members.set(hub, list);
    for (const q of list) hubOf.set(q, hub);
  }
  universes = { hubOf, members };
  return universes;
}

/** Вселенная произведения — если в ней хотя бы три узла: пара «фильм — роман» уже видна в связях. */
function universeFor(work: WorkCard): { id: string; title: string; size: number } | undefined {
  const key = workKey(work, work.externalIds ?? externalIds[work.id]);
  const q = (key && relationQid.get(key)) || work.externalIds?.wikidata;
  if (!q) return undefined;
  const { hubOf, members } = universeIndex();
  const hub = hubOf.get(q);
  const size = hub ? members.get(hub)!.length : 0;
  return hub && size >= 3 ? { id: hub, title: relationNodes[hub]?.t ?? hub, size } : undefined;
}

export interface UniverseMember {
  qid: string;
  title: string;
  year?: number;
  kind: RelationNodeKind;
  /** наша карточка, если произведение есть в справочнике */
  work?: WorkCard;
  seen: boolean;
}
export interface UniversePage {
  id: string;
  title: string;
  kind: RelationNodeKind;
  /** по видам — в порядке выхода; циклы и франшизы внутри вселенной не показываем как членов */
  byKind: { kind: RelationNodeKind; members: UniverseMember[] }[];
  /** порядок по сюжету: цепочки продолжений (P155/P156), от первой части к последней */
  chains: UniverseMember[][];
  startWith?: { member: UniverseMember; why: 'first' | 'near' };
  /** места разговора: кураторские по её произведениям и поиск по каналам авторов по названию вселенной */
  discussions: DiscussionPlace[];
  /** заложенная вселенная (Ж3): вики фандома и открытые API, ответившие при сборке */
  sources?: { wiki: string[]; api: { url: string; what: string; key?: boolean }[] };
  /** ролики о вселенной целиком (хронология, лор, история серии) — по решениям разметки, 02.10;
   *  эссе первыми, обзоры за ними, внутри — свежие первыми */
  essays: ExternalAnalysis[];
}

export async function getUniverse(id: string): Promise<UniversePage | undefined> {
  await delay(200);
  await Promise.all([catalog(), workRefs()]);
  const { members } = universeIndex();
  const list = members.get(id);
  const hub = relationNodes[id];
  if (!list || !hub) return undefined;
  const byKey = worksByAnalysisKey();
  const seenIds = new Set([...history().filter((e) => e.status === 'finished').map((e) => e.work.id), ...watchedNow().map((w) => w.id)]);
  const keys = seenKeys();
  const member = (q: string): UniverseMember | undefined => {
    const n = relationNodes[q];
    if (!n) return undefined;
    const raw = byKey.get(n.key ?? `wd:${q}`);
    const work = raw && (isSeries(raw) ? withSeriesDraft(raw) : annotated(raw));
    return { qid: q, title: n.t, ...(n.y ? { year: n.y } : {}), kind: n.k, ...(work ? { work } : {}),
      seen: Boolean(work && (seenIds.has(work.id) || seen(work, keys))) };
  };
  const all = list.filter((q) => q !== id).map(member).filter((m): m is UniverseMember => Boolean(m));
  const byYear = (a: UniverseMember, b: UniverseMember) => (a.year ?? 9999) - (b.year ?? 9999) || a.title.localeCompare(b.title, 'ru');
  const ORDER: RelationNodeKind[] = ['film', 'series', 'book', 'comic', 'game', 'other'];
  const byKind = ORDER.map((kind) => ({ kind, members: all.filter((m) => m.kind === kind).sort(byYear) })).filter((g) => g.members.length);

  // цепочки продолжений: A sequel_of B → B раньше A; начала — те, у кого нет «предыдущего»
  const inside = new Set(list);
  const next = new Map<string, string[]>();
  const hasPrev = new Set<string>();
  for (const [a, kind, b] of relationEdges) {
    if (kind !== 'sequel_of' || !inside.has(a) || !inside.has(b)) continue;
    (next.get(b) ?? next.set(b, []).get(b)!).push(a);
    hasPrev.add(a);
  }
  const chains: UniverseMember[][] = [];
  for (const start of [...next.keys()].filter((q) => !hasPrev.has(q))) {
    const chain: string[] = [];
    const walked = new Set<string>();
    for (let q: string | undefined = start; q && !walked.has(q); q = (next.get(q) ?? []).sort((x, y) => (relationNodes[x]?.y ?? 9999) - (relationNodes[y]?.y ?? 9999))[0]) {
      walked.add(q);
      chain.push(q);
    }
    const ms = chain.map(member).filter((m): m is UniverseMember => Boolean(m));
    if (ms.length >= 2) chains.push(ms);
  }

  // с чего начать: первая часть самой длинной цепочки, если она у нас и не видена; иначе — наше
  // непросмотренное с уровнем ближе всего к «чуть выше привычного», иначе — самое раннее наше
  const ours = all.filter((m) => m.work && !m.seen && (m.kind === 'film' || m.kind === 'series'));
  const first = [...chains].sort((a, b) => b.length - a.length)[0]?.find((m) => m.work && !m.seen);
  const comfort = ownState()?.complexityComfort;
  const near = comfort != null
    ? ours.filter((m) => m.work!.complexityLevel).sort((a, b) => Math.abs(a.work!.complexityLevel - comfort - 1) - Math.abs(b.work!.complexityLevel - comfort - 1))[0]
    : undefined;
  const startWith = first ? { member: first, why: 'first' as const } : near ? { member: near, why: 'near' as const }
    : ours.sort(byYear)[0] ? { member: ours.sort(byYear)[0], why: 'first' as const } : undefined;

  const curated = all.flatMap((m) => (m.work ? mocks.discussions.filter((d) => d.workId === m.work!.id) : []));
  const probe = { id: `u-${id}`, type: 'film', title: hub.t, year: hub.y ?? 0, creators: [], primaryOperations: [], complexityLevel: 0,
    warnings: [], barriers: [], isNicheMasterpiece: false } as WorkCard;
  const seenUrl = new Set<string>();
  const discussions = [...curated, ...searchLinks(probe), ...searchLinks(probe, 'place')]
    .filter((d) => (seenUrl.has(d.url) ? false : (seenUrl.add(d.url), true))).slice(0, 12);
  const { universeSources } = await import('@/mocks/universeSources');
  const src = universeSources[id];
  const essays = aboutOrder((await aboutVideos()).universe[id] ?? []);
  return { id, title: hub.t, kind: hub.k, byKind, chains, ...(startWith ? { startWith } : {}), discussions, essays,
    ...(src && (src.wiki.length || src.api.length) ? { sources: { wiki: src.wiki, api: src.api } } : {}) };
}

/** Предыдущая часть (ДФ-7, 14.10): «лучше после X, можно и без» в шторке — по связи «сиквел» (Ж1). Только фильм или
 *  сериал, вышедший не позже самого произведения (приквел, снятый позже, — не пререквизит: «Братство Кольца» не
 *  «после „Хоббита“»); из нескольких — ближайший по году («Дэдпул и Росомаха» — после «Дэдпула 2», не «Логана»).
 *  Виденное — мимо: напоминать незачем. */
export interface PrevPart { title: string; year?: number; /** наша карточка, если часть у нас есть: ссылка и название на языке интерфейса */ work?: WorkCard }
export async function getPrerequisite(work: WorkCard): Promise<PrevPart | undefined> {
  await Promise.all([ready, relationRefs(), work.type === 'book' ? catalog() : films()]);
  const key = workKey(work, work.externalIds ?? externalIds[work.id]);
  const q = (key && relationQid.get(key)) || work.externalIds?.wikidata;
  if (!q) return undefined;
  const year = work.year || relationNodes[q]?.y || 9999;
  const prev = relationEdges
    .filter(([a, kind, b]) => a === q && kind === 'sequel_of' && ['film', 'series'].includes(relationNodes[b]?.k) && (relationNodes[b].y ?? 0) <= year)
    .map(([, , b]) => b)
    .sort((x, y) => (relationNodes[y].y ?? 0) - (relationNodes[x].y ?? 0))[0];
  if (!prev) return undefined;
  const n = relationNodes[prev];
  const keys = seenKeys();
  const card = n.key ? knownWorks().find((w) => workKeys(w, w.externalIds ?? externalIds[w.id]).includes(n.key!)) : undefined;
  if ((n.key && keys.has(n.key)) || (card && (seen(card, keys) || history().some((e) => e.status === 'finished' && e.work.id === card.id)))) return undefined;
  return { title: n.t, ...(n.y ? { year: n.y } : {}), ...(card ? { work: card } : {}) };
}

/** Паспорт карточки по глубине (15.10): откуда произведение — книга, комикс, ремейк чего — и вселенная, если в ней
 *  хотя бы три узла. Те же связи Ж1, что на полной странице, только самое короткое: значок и название. */
export interface WorkLinks {
  basedOn?: { kind: RelationNodeKind; title: string; workId?: ID };
  remakeOf?: { title: string; workId?: ID };
  universe?: { id: string; title: string; size: number };
}
export async function getWorkLinks(work: WorkCard): Promise<WorkLinks> {
  await Promise.all([ready, relationRefs(), work.type === 'book' ? catalog() : films()]);
  const rel = relationsFor(work);
  const src = rel.find((r) => r.kind === 'adaptation_of' && r.direction === 'out');
  const remake = rel.find((r) => r.kind === 'remake_of' && r.direction === 'out');
  const universe = universeFor(work);
  return {
    ...(src ? { basedOn: { kind: src.nodeKind, title: src.title, ...(src.workId ? { workId: src.workId } : {}) } } : {}),
    ...(remake ? { remakeOf: { title: remake.title, ...(remake.workId ? { workId: remake.workId } : {}) } } : {}),
    ...(universe ? { universe } : {}),
  };
}

let filmForm: Record<string, FilmForm> = {};
/** жанры фильмов TMDb (09.10) — для якоря вкуса новичка; грузятся вместе с первой лентой */
let filmGenres: Record<string, string[]> = {};
let genresLoad: Promise<void> | undefined;
const loadGenres = (): Promise<void> =>
  (genresLoad ??= import('@/mocks/filmGenres').then((m) => { filmGenres = m.filmGenres; }).catch(() => { genresLoad = undefined; }));
const genresOf = (work: WorkCard): string[] => {
  if (!isFilm(work)) return [];
  const tmdb = (work.externalIds ?? externalIds[work.id])?.tmdb;
  return tmdb != null ? filmGenres[`tmdb:${tmdb}`] ?? [] : [];
};
let tagNeighbours: Record<string, TagNeighbour[]> = {};
let filmTropes: Record<string, TropeMention[]> = {};
let comentions: Record<string, CoMention[]> = {};
let relationNodes: Record<string, { t: string; y?: number; k: RelationNodeKind; key?: string }> = {};
let relationEdges: [string, RelationKind, string][] = [];
/** ключ произведения → элемент Wikidata, по узлам связей */
let relationQid = new Map<string, string>();
let relationsLoad: Promise<void> | undefined;
/** Связи и вселенные (Ж1–Ж3) — странице произведения, вселенной и ленте (слот «дальше во вселенной»). */
function relationRefs(): Promise<void> {
  relationsLoad ??= import('@/mocks/workRelations').then((wr) => {
    relationNodes = wr.relationNodes; relationEdges = wr.relationEdges;
    relationQid = new Map(Object.entries(relationNodes).flatMap(([q, n]) => (n.key ? [[n.key, q] as [string, string]] : [])));
    universes = undefined;
  });
  return relationsLoad;
}
let workRefsLoad: Promise<void> | undefined;
/** Замеры и соседи по фильму — только экран «Произведение». */
function workRefs(): Promise<void> {
  workRefsLoad ??= Promise.all([
    import('@/mocks/filmForm'), import('@/mocks/tagNeighbours'), import('@/mocks/filmTropes'), import('@/mocks/comentions'),
    serverRef<Record<string, CoMention[]>>('comentions'), relationRefs(), import('@/mocks/characters'),
  ]).then(([ff, tn, ft, cm, freshCo, , ch]) => {
    filmForm = ff.filmForm; tagNeighbours = tn.tagNeighbours; filmTropes = ft.filmTropes; comentions = freshCo ?? cm.comentions;
    characters = ch.characters;
    charactersByKey = new Map();
    for (const [q, c] of Object.entries(characters)) for (const k of c.works) (charactersByKey.get(k) ?? charactersByKey.set(k, []).get(k)!).push(q);
  });
  return workRefsLoad;
}

const curatorImports = () => Promise.all([import('@/mocks/curator'), import('@/mocks/sourcesAuto'), import('@/mocks/linkTasks')]);
let curator!: Mod<typeof curatorImports>[0];
let sourceCandidates!: Mod<typeof curatorImports>[1]['sourceCandidates'];
let linkCheckTasks!: Mod<typeof curatorImports>[2]['linkCheckTasks'];
let curatorLoad: Promise<void> | undefined;
/** Кураторская и задания участника — свои экраны, свои данные. */
function curatorRefs(): Promise<void> {
  curatorLoad ??= Promise.all([curatorImports(), serverRef<Mod<typeof curatorImports>[1]['sourceCandidates']>('sourcesAuto')])
    .then(([[c, sa, lt], freshSources]) => { curator = c; sourceCandidates = freshSources ?? sa.sourceCandidates; linkCheckTasks = lt.linkCheckTasks; });
  return curatorLoad;
}

/** Состояние участника с сервера (если он настроен) раскладывается по тем же структурам, в
 *  которых жила правка в памяти. Пока оно едет, ни одна функция api не отвечает: иначе лента
 *  успеет посчитаться по пустому просмотренному, а потом дёрнется. */
let unreachable = false;
/** Профиль с сервера — тот же запрос, что ждёт `ready`; первые экраны нового человека (РР-5) ждут только его. */
const stateLoad = loadState();
/** `ready` прошёл: ядро пришло, профиль разложен (`hydrate`) */
let readyDone = false;
const ready: Promise<void> = (async () => {
  const [state] = await Promise.all([stateLoad, core(), store.onServer ? undefined : films()]);
  // с сервером справочник фильмов догружается фоном — через 3 с (ДФ-21): на медленной сети его мегабайты иначе
  // отнимают сеть и главный поток у первой отрисовки; экран, которому он нужен раньше, позовёт его сам. Книги в прогрев
  // не входят (РР-1): их зовёт `catalog()` — поиск, страницы, книжные лента и колода
  if (store.onServer) setTimeout(() => { films().catch(() => undefined); }, 3000);
  if (state === 'unreachable') { unreachable = true; return; }
  if (!state) return;
  hydrate(state);
})().finally(() => { readyDone = true; });

/** Новый человек (РР-5): профиль пуст — ни оценок, ни дневника, ни просмотренного, ни полок вкуса — и в этой вкладке он
 *  ещё ничего не отметил. Его первые экраны — холодный старт «Сегодня» и колода /rate — отвечают сразу, не дожидаясь
 *  ядра с индексами разборов (~1,5 МБ с сервера) и справочника фильмов (2,7 МБ): ответ им известен и без них. Отдаёт
 *  настройки из профиля; не новый, сервер молчит или без сервера на истории владельца — undefined. */
async function newcomer(): Promise<Partial<UserSettings> | undefined> {
  if (!store.onServer && !freshStart) return undefined;
  if (ratings.size || watchedAdded.size || watchedRemoved.size || imported.length || serverJournal.length) return undefined;
  const state = store.onServer ? await stateLoad : undefined;
  if (state === 'unreachable') return undefined;
  if (state?.ratings?.length || state?.journal?.length || state?.watched?.length || state?.settings?.tasteShelves?.length) return undefined;
  return state?.settings ?? {};
}

/** Сервер не ответил при запуске — пробуем ещё раз, когда человек жмёт «Повторить». */
export class OfflineError extends Error {
  constructor() { super('offline'); this.name = 'OfflineError'; }
}
async function reconnect(): Promise<void> {
  if (!unreachable) return;
  const state = await loadState();
  if (state === 'unreachable') throw new OfflineError();
  unreachable = false;
  if (state) hydrate(state);
}

const delay = (ms: number) => ready.then(() => new Promise<void>((r) => setTimeout(r, ms)));

// прокси есть только у страницы, которую отдал сервер; из файла (standalone) — нет
const served = typeof location !== 'undefined' && location.protocol.startsWith('http');
// Картинки: TMDb — через прокси `/tmdb-api` сервера (ключ знает только он, в сборку не попадает:
// 13.10), обложки книг — всегда.
const tmdb = served ? tmdbFromEnv('proxy') : undefined;
// Кинопоиск — с обрывом через 3 с (ТВ-10, 14.10): отказ по исчерпанному лимиту он отдаёт через 15–25 с, и всё это время
// запрос держал одно из шести соединений браузера с нашим сервером — картинки TMDb стояли за ним в очереди
const kp = import.meta.env.VITE_KP_PROXY === '1' && served
  ? kinopoiskFromEnv('proxy', (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(3000) })) : undefined;
// Карточки из бандла не несут внешних ID — подкладываем их из externalIds.ts перед обогащением.
// Обогащение не должно держать экран: не успело за 6 секунд — карточки уходят как есть,
// а результат осядет в кэше к следующему разу.
// авторы из справочника (Д3) — сразу при карточке: подпись под названием берёт оттуда русское имя
// режиссёра, а не то, что пришло с карточкой («Miller», «陆川»; 02.10)
const withMedia = (c: WorkCard): WorkCard => withWatch(withCredits(withBookMedia({ ...c, ...catalogMedia[c.id], externalIds: c.externalIds ?? catalogMedia[c.id]?.externalIds ?? externalIds[c.id] })));
/** Книге — метаданные Wikidata и Open Library (З3) по любому её ключу. Своё главнее: заполняем
 *  пустое; название — русским, если у карточки оно не по-русски (из экспорта Goodreads приходит
 *  английское), а прежнее уходит в оригинальное. */
function withBookMedia(w: WorkCard): WorkCard {
  if (w.type !== 'book') return w;
  const m = workKeys(w, w.externalIds ?? externalIds[w.id]).map((k) => bookMedia[k]).find(Boolean);
  if (!m) return w;
  const cyr = (s?: string) => Boolean(s && /[а-яё]/i.test(s));
  const retitle = m.title && !cyr(w.title) && cyr(m.title);
  return {
    ...w,
    ...(retitle ? { title: m.title!, originalTitle: w.originalTitle ?? w.title } : {}),
    ...(!w.originalTitle && !retitle && m.originalTitle && m.originalTitle !== w.title ? { originalTitle: m.originalTitle } : {}),
    ...(!w.year && m.year ? { year: m.year } : {}),
    ...(!w.creators.length && m.creators?.length ? { creators: m.creators } : {}),
    ...(!w.pages && m.pages ? { pages: m.pages } : {}),
    ...(!w.coverUrl && m.coverUrl ? { coverUrl: m.coverUrl, imageSource: m.imageSource } : {}),
    ...(!w.registers?.length && m.registers?.length ? { registers: m.registers } : {}),
  };
}
/** Не больше шести карточек в сети разом (ТВ-10, 14.10): сорок карточек страницы автора — это сотня запросов, и в шесть
 *  соединений браузера (HTTP/1.1) они шли вперемешку — первые запросы всех, потом вторые, — так что к сроку не
 *  успевала ни одна. По очереди первые успевают, остальные дозаписываются в кэш к следующему разу. */
let picturing = 0;
const pictureQueue: (() => void)[] = [];
async function pictureSlot<T>(f: () => Promise<T>): Promise<T> {
  if (picturing >= 6) await new Promise<void>((r) => pictureQueue.push(r));
  picturing += 1;
  try { return await f(); } finally { picturing -= 1; pictureQueue.shift()?.(); }
}
/** Картинки и «где посмотреть» с сети. Срок — каждой карточке свой (ТВ-10, 14.10): общий на весь список отдавал всё
 *  как было, если не успела хоть одна, — страница автора не получала ни одной обложки. `bare` — только карточкам без
 *  картинки: спискам (автор, герой) «где посмотреть» не нужно, а запрос за ним держал очередь. */
const pictured = (cards: WorkCard[], opts: { bare?: boolean } = {}) => {
  const withIds = cards.map(withMedia);
  const late = new Promise<void>((r) => setTimeout(r, 6000));
  return Promise.all(withIds.map((c) => (opts.bare && (c.stillUrl || c.coverUrl) ? c
    : Promise.race([pictureSlot(() => withImages([c], tmdb, kp)).then(([x]) => x), late.then(() => c)]))));
};

// История участника в моке: сгенерированная из его экспорта + импортированная в сессии.
// Карточки истории получают первичную разметку (userAnnotations, черновик модели) и оценку
// участника (userRatings) — оценка не показывается, это вес для модели. Дубли одного фильма
// из разных файлов экспорта (один — по ID Кинопоиска, другой — по TMDb) схлопываются.
const imported: JourneyEntryData[] = [];
/** регистр сериалов по ключу imdb: (tools/build-series-registers.mts) — заполняется со справочником */
let seriesRegs: Record<string, Register[]> = {};
const withRegisters = (w: WorkCard): WorkCard => {
  if (w.registers?.length) return w;
  // сериал — по своей таблице: карточки из журнала сервера мимо загрузки справочника проходят здесь
  const imdb = isSeries(w) ? (w.externalIds ?? externalIds[w.id])?.imdb : undefined;
  const r = (imdb && seriesRegs[`imdb:${imdb}`]) || workRegisters[w.id];
  return r ? { ...w, registers: r } : w;
};
/** Черновая разметка по фильму: карточка одного фильма приходит из справочника, из присланных
 *  профилей (`l-tmdb…`) и из истории с разными id, а разметка у фильма одна. Сериалы — нет:
 *  номера TMDb у них свои, и разметка сериалов — отдельный трек (Е2). */
// Разметка истории владельца привязана к id его карточек (u-kp…): у присланных профилей те же
// фильмы приходят как l-tmdb…, и без этого моста их разметка не находилась
let ownByTmdb: Map<number, FirstPassAnnotation> | undefined;
const ownAnnotationByTmdb = (): Map<number, FirstPassAnnotation> => {
  if (ownByTmdb) return ownByTmdb;
  const map = new Map<number, FirstPassAnnotation>();
  for (const w of userWorks) {
    const tmdb = (w.externalIds ?? externalIds[w.id])?.tmdb;
    if (tmdb != null && userAnnotations[w.id] && reviewMarks()[`own:${w.id}`]?.status !== 'rejected') map.set(tmdb, userAnnotations[w.id]);
  }
  if (userWorks.length) ownByTmdb = map; // до загрузки справочника не запоминаем пустое
  return map;
};
/** Разметка книги (З4): ручная калибровка владельца — по ключу произведения, а если книги в
 *  справочнике не было — по названию; без неё — черновик (08.10, кроме отклонённых куратором). */
const bookDraftFor = (w: WorkCard): FirstPassAnnotation | undefined => {
  const keys = workKeys(w, w.externalIds ?? externalIds[w.id]);
  const byKey = keys.map((k) => bookAnnotations[k]).find(Boolean);
  if (byKey) return byKey;
  const t = (s?: string) => s?.toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const byTitle = [w.title, w.originalTitle].map((x) => x && bookAnnotations[`t:${t(x)}`]).find(Boolean);
  if (byTitle) return byTitle;
  // отложенное владельцем (heldWorks, 16.10 — религиозные тексты, эзотерика, Ленин): карточка есть, черновика нет — в подбор не идёт
  if (keys.some(isHeldKey)) return undefined;
  return keys.filter((k) => reviewMarks()[`draft:${k}`]?.status !== 'rejected').map((k) => bookDrafts[k]).find(Boolean);
};
const draftFor = (w: WorkCard): FirstPassAnnotation | undefined => {
  if (w.type === 'book') return bookDraftFor(w);
  // сериал (Е4): черновик сериала — и для модели: оценённый и досмотренный сериал теперь
  // свидетельство вкуса, как фильм
  if (isSeries(w)) return seriesDraftFor(w);
  const tmdb = (w.externalIds ?? externalIds[w.id])?.tmdb;
  if (tmdb == null) return undefined;
  // отклонённый куратором черновик (Г3) не используется: лучше без разметки, чем с неверной; отложенное владельцем
  // (heldWorks, 13.10) — без черновика, в подбор не идёт
  const draft = reviewMarks()[`draft:tmdb:${tmdb}`]?.status === 'rejected' || isHeldKey(`tmdb:${tmdb}`) ? undefined : draftAnnotations[`tmdb:${tmdb}`];
  return ownAnnotationByTmdb().get(tmdb) ?? draft;
};
/** Черновик сериала (Е2): страница произведения, кураторская, а с Е4 — модель и подбор. */
const seriesDraftFor = (w: WorkCard): SeriesDraft | undefined => {
  if (!isSeries(w)) return undefined;
  const key = workKey(w, w.externalIds ?? externalIds[w.id]);
  return key && reviewMarks()[`draft:${key}`]?.status !== 'rejected' && !isHeldKey(key) ? seriesAnnotations[key] : undefined;
};
const withSeriesDraft = (w: WorkCard): WorkCard => {
  const a = seriesDraftFor(w);
  return a && !w.primaryOperations.length
    ? { ...w, primaryOperations: a.ops.map(([op, intensity]) => ({ op, intensity })), complexityLevel: a.level,
        barriers: a.barriers, warnings: a.warnings, isNicheMasterpiece: a.niche }
    : w;
};
const annotated = (w: WorkCard): WorkCard => {
  const a = (reviewMarks()[`own:${w.id}`]?.status === 'rejected' ? undefined : userAnnotations[w.id]) ?? draftFor(w);
  const r = withRegisters(w);
  // у книги объём — свой барьер (З4): больше 500 страниц — «Большой объём», если разметчик его не поставил
  const big = w.type === 'book' && (w.pages ?? 0) > 500 && a && !a.barriers.includes('Большой объём') ? ['Большой объём'] : [];
  return a && !w.primaryOperations.length
    ? { ...r, primaryOperations: a.ops.map(([op, intensity]) => ({ op, intensity })), complexityLevel: a.level,
        barriers: [...big, ...a.barriers], warnings: a.warnings, isNicheMasterpiece: a.niche }
    : r;
};
const entryKey = (e: JourneyEntryData): string => {
  const ids = e.work.externalIds;
  return ids?.kinopoisk != null ? `kp:${ids.kinopoisk}` : ids?.imdb ? `imdb:${ids.imdb}` : ids?.tmdb != null ? `tmdb:${ids.tmdb}` : e.work.id;
};
/** Чья это история. Без сервера — владельца: моки собраны из его экспорта, и приложение так
 *  разрабатывалось. С сервером у каждого своя и приходит из профиля (`hydrate`); у нового
 *  участника она пуста, пока он не оценит хоть что-то. */
const serverJournal: JourneyEntryData[] = [];
let profile: StoredState['profile'];
const baseJournal = (): JourneyEntryData[] => (store.onServer || freshStart ? serverJournal : [...userJournal, ...mocks.journal]);
const baseWatched = (): WorkCard[] => (store.onServer ? [] : watchedWorks);

/** Оценки уже виденного: с сервера или поставленные в этой вкладке. Без сервера под ними
 *  лежат оценки владельца из экспорта. */
const ratings = new Map<ID, { rating: 1 | 2 | 3 | 4 | 5; raw?: number }>();
const ratedCards = new Map<ID, WorkCard>();
const ratingOf = (id: ID) => ratings.get(id) ?? (store.onServer ? undefined : userRatings[id]);

/** Оценённое, чего нет в дневнике, — тоже досмотренное: без дат, но с весом. Так новый
 *  участник собирает себе историю, с которой модели есть от чего считать. */
const ratedEntries = (journal: JourneyEntryData[]): JourneyEntryData[] => {
  const inJournal = new Set(journal.map((e) => e.work.id));
  return [...ratedCards.entries()]
    .filter(([id]) => ratings.has(id) && !inJournal.has(id))
    .map(([id, work]) => ({ id: `r-${id}`, work, status: 'finished' as const, reflections: [], stateChanges: [] }));
};

/** Норма шкалы (OPS-6, 30.09). Импорт в приложении спрашивает, какая оценка значит «нормально»,
 *  а присланная история (seeds → сервер) приезжает без этого вопроса: у одного участника медиана
 *  10, и модель, беря медиану за норму, не видела, что ему нравится. Спрашиваем один раз, когда
 *  оценок по десятибалльной шкале набралось хотя бы 10 и нормы нет; ответ — в настройках. */
export async function getScaleQuestion(): Promise<{ median: number; count: number; options: number[] } | undefined> {
  // новому человеку спрашивать о шкале не по чему, и тянуть справочник ради этого незачем (РР-5)
  if (await newcomer()) return undefined;
  await delay(0);
  // на «Сегодня» при открытии — справочник без книг (РР-1): вопросу нужна только история
  await films();
  if (settings.ratingNorm) return undefined;
  const raws = history().map((e) => e.raw).filter((r): r is number => r != null).sort((a, b) => a - b);
  if (raws.length < 10) return undefined;
  const median = raws[Math.floor(raws.length / 2)];
  return { median, count: raws.length, options: [4, 5, 6, 7, 8, 9, 10] };
}

/** Сколько оценок нужно, чтобы подбор стал подбором, а не угадыванием. */
// 02.10: первая лента — после пяти оценок, а не десяти (порог входа); модели состояния хватает
// трёх досмотренных (deriveState), дальше подбор уточняется по ходу
export const MIN_RATED = 5;
/** Новый человек для подбора (ТВ-2): пока оценок меньше, первые три кадра — с разбором. */
export const NOVICE_RATED = 20;

const history = (): RatedEntry[] => {
  const seenKey = new Set<string>();
  const out: RatedEntry[] = [];
  const journal = [...imported, ...baseJournal()];
  for (const e of [...journal, ...ratedEntries(journal)]) {
    const keys = [entryKey(e), e.work.externalIds?.imdb && `imdb:${e.work.externalIds.imdb}`, e.work.externalIds?.tmdb != null && `tmdb:${e.work.externalIds.tmdb}`]
      .filter((k): k is string => Boolean(k));
    if (keys.some((k) => seenKey.has(k))) continue;
    keys.forEach((k) => seenKey.add(k));
    const r = ratingOf(e.work.id);
    out.push({ ...e, work: annotated(e.work), rating: r?.rating, raw: r?.raw });
  }
  return out;
};
const today = () => new Date().toISOString().slice(0, 10);
const USER_ID = 'u-self';

// ---------- вход ----------
// В продукте это единственный эндпоинт, где сервер обязан считать HMAC от `initData`
// (`verifyInitData` в `src/lib/telegramAuth.ts`) и только потом выдать сессию. Здесь сервера
// нет: разбираем строку, проверяем свежесть и честно помечаем сессию непроверенной.
let session: Session | undefined;

export async function getSession(): Promise<Session | undefined> {
  await delay(120);
  return session;
}

export async function loginWithTelegram(raw: string): Promise<Session> {
  await delay(260);
  const { user, authDate } = parseInitData(raw);
  if (!user) throw new Error('telegram: в initData нет пользователя');
  // сутки — тот же срок, который Telegram советует серверу
  if (authDate && Date.now() - authDate.getTime() > 86400 * 1000) throw new Error('telegram: initData просрочена');
  session = {
    user: {
      id: `tg${user.id}`,
      name: displayName(user),
      username: user.username,
      photoUrl: user.photoUrl,
      source: 'telegram',
    },
    verified: false,
    startedAt: new Date().toISOString(),
  };
  return session;
}

/** Вход без Telegram: смотреть можно, но это демонстрация — сессии на сервере нет. */
export async function loginAsDemo(): Promise<Session> {
  await delay(160);
  session = { user: { id: 'demo', name: ui.login.demoName, source: 'demo' }, verified: false, startedAt: new Date().toISOString() };
  return session;
}

export async function logout(): Promise<void> {
  await delay(120);
  session = undefined;
}

/** Правка просмотренного, сделанная в поиске: бэкенда нет, поэтому живёт в памяти вкладки.
 *  Присланный список при этом не трогаем — из него можно только «снять», и снятое видно. */
const watchedAdded = new Map<ID, WorkCard>();
const watchedRemoved = new Set<ID>();

/** Просмотренное, каким оно стало сейчас: присланный список минус снятое плюс добавленное.
 *  Добавленное идёт первым и в обратном порядке: человек только что отметил фильм и должен
 *  увидеть его сразу, а не искать в хвосте присланного списка. */
function watchedNow(): WorkCard[] {
  return [...[...watchedAdded.values()].reverse(), ...baseWatched().filter((w) => !watchedRemoved.has(w.id))];
}

/** Что участник назвал просмотренным списком, без дат и оценок: в дневник не идёт (там
 *  нечего показывать), но в подбор идёт — и как «уже видел», и как свидетельство вкуса. */
const declaredSeen = (): WorkCard[] => watchedNow().map(annotated);

/** Вкус по регистру считается относительно того, что вообще снимают (registerBase), а не
 *  относительно нашего пула: пул собран руками и сам перекошен. */
const taste = () => ({ alsoSeen: declaredSeen(), base: registerBase, ratingNorm: settings.ratingNorm });

/** Состояние и карта из истории — когда она размечена; иначе моки. */
const ownState = () => deriveState(USER_ID, history(), today(), taste());

/** Пул кандидатов: каталог моков (с объяснениями) + размеченный пул; всё, что уже видели, — вон. */
function candidates(): Candidate[] {
  const keys = seenKeys();
  const catalog: Candidate[] = Object.values(mocks.works)
    .filter((w) => w.primaryOperations.length && w.complexityLevel)
    .map((w) => ({ work: withRegisters(withMedia(w)), what: mocks.explanations[w.id]?.what ?? workDetail(w.id)?.synopsis ?? '' }));
  const pool: Candidate[] = candidateSeeds.map((s) => ({ work: withRegisters({ ...seedToCard(s), ...candidateMedia[s.id] }), what: s.what }));
  // полки по просьбам людей: размеченное оттуда — тоже кандидаты (сериалы ждут трека Е)
  const shelf = shelfCandidates([...shelfWorks.values()]);
  const inPool = new Set([...catalog, ...pool].flatMap((c) => keyList(c.work)));
  const extra = [...shelf, ...draftCandidates()].filter((c) => {
    const k = keyList(c.work);
    if (k.some((x) => inPool.has(x))) return false;
    for (const x of k) inPool.add(x);
    return true;
  });
  // сколько авторов человек увидит во вкладке «Обзоры» (ТВ-2): та же группировка, что у карточки
  // (`useVoices`): только авторы, без яруса review и без постов — посты во вкладке «Обсуждения»
  // книги — не в общем пуле: у них своя лента и «Почитать» (`bookPool`); старые книжные карточки каталога-сценария
  // («Мастер и Маргарита», w16) иначе вставали в ленту кино как фильмы (11.10, прогон профиля «Эпизодов»)
  return [...catalog, ...pool, ...extra].filter((c) => c.work.type !== 'book' && !seen(c.work, keys))
    .map((c) => ({ ...c, essays: visibleAuthors(analysesFor(c.work, workDetail(c.work.id)?.externalAnalyses)) }));
}
const visibleAuthors = (list: ExternalAnalysis[]): number =>
  groupByVoice(list).filter((g) => g.items.some((a) => a.platform !== 'telegram')).length;
/** Черновая разметка (Г1) — тоже в подбор (решение 30.09): ~400 размеченных фильмов списка
 *  первых оценок и истории владельца. Проверяем не вручную заранее, а по тому, как люди их
 *  принимают: петля прогноза считает промахи по фильму (worker/loop.ts, `byWork`), кураторская
 *  ставит такие черновики первыми. Неуверенные (low — в основном фильмы 2025–2026 по завязке) и
 *  отклонённые куратором в подбор не идут. */
const draftCandidates = (): Candidate[] => draftSources(false)
  .filter((d) => d.annotation.confidence !== 'low' && reviewMarks()[d.id]?.status !== 'rejected')
  .map((d) => (isSeries(d.work) ? seriesCandidate(d) : { work: annotated(d.work), what: d.annotation.what }));

/** Сериал кандидатом (Е4): у антологии — сезон со своей разметкой (первый по порядку, повторы
 *  того же сериала отсекает `candidates`); длина, если известна, — первым барьером. */
function seriesCandidate(d: DraftSource): Candidate {
  const a = d.annotation;
  const base = withRegisters(d.work);
  const series = d.season ? { ...base.series, anthology: true } : base.series;
  const card: WorkCard = { ...base, ...(series ? { series } : {}),
    primaryOperations: a.ops.map(([op, intensity]) => ({ op, intensity })), complexityLevel: a.level,
    barriers: [...timeBarrier({ ...base, ...(series ? { series } : {}) }), ...a.barriers], warnings: a.warnings, isNicheMasterpiece: a.niche };
  return { work: card, what: a.what, ...(d.season ? { season: d.season } : {}) };
}
const timeBarrier = (w: WorkCard): string[] => {
  const h = seriesHours(w);
  return h != null && h > 10 ? [ui.seriesDiary.hours(h)] : [];
};
/** Новичок в сериалах: ни одного сериала в дневнике и в просмотренном — ему только короткое. */
const seriesNovice = (): boolean =>
  ![...history().map((e) => e.work), ...watchedNow()].some((w) => isSeries(w));
/** размеченное с полки — кандидатами; без разметки (и сериалы, трек Е) в подбор не идут */
const shelfCandidates = (works: WorkCard[]): Candidate[] => works.flatMap((w) => {
  const a = draftFor(w);
  return a ? [{ work: annotated(w), what: a.what }] : [];
});

/** Культурные подборки (ЗП-45, шаг 2): фильмы пула ленты по правилу полки (`src/lib/model/collections.ts`), без
 *  просмотренного. У каждого — первый автор разбора; на одном уровне с разбором — раньше. */
export interface CollectionItem {
  work: WorkCard; what: string; essays: number; voice?: string;
  /** у подборки голоса — разбор этого фильма у её автора */
  essay?: { title: string; url: string; minutes?: number };
}
export interface CollectionSummary { id: string; films: number; essayed: number; title?: string; voice?: string }
export interface CollectionPage { id: string; items: CollectionItem[]; easier: number; title?: string; voice?: string; voiceId?: string }
const collectionPool = (c: Collection, pool = candidates()): CollectionItem[] => pool
  .filter((x) => isFilm(x.work) && x.work.complexityLevel && inCollection(c, x.work, genresOf(x.work)))
  .map((x) => {
    const first = groupByVoice(analysesFor(x.work, workDetail(x.work.id)?.externalAnalyses)).find((g) => g.items.some((a) => a.platform !== 'telegram'));
    return { work: x.work, what: x.what, essays: x.essays ?? 0, ...(first ? { voice: first.voice.title } : {}) };
  });

/** Подборки голосов (ЗП-45, шаг 3): плейлисты эссеистов (tools/voice-playlists.mts), справочник `voicePlaylists`;
 *  в разработке — кэш сборщика. */
let voiceLists: VoicePlaylist[] | undefined;
let voiceListsLoading: Promise<void> | undefined;
const loadVoiceLists = (): Promise<void> => (voiceListsLoading ??= (async () => {
  const ref = await serverRef<VoicePlaylists>('voicePlaylists')
    ?? (import.meta.env.DEV ? await fetch('/.cache/voice-playlists.json').then((r) => (r.ok ? r.json() as Promise<VoicePlaylists> : undefined)).catch(() => undefined) : undefined);
  voiceLists = ref?.lists ?? [];
})());
/** Фильмы плейлиста из пула ленты — те, у которых разбор этого ролика человек видит (язык, ярус «эссе», автор). */
function voiceListPool(l: VoicePlaylist, byKey: Map<string, Candidate>): { items: CollectionItem[]; voice?: Voice } {
  const items: CollectionItem[] = [];
  let voice: Voice | undefined;
  for (const [video, key] of l.items) {
    const c = byKey.get(key);
    if (!c || items.some((x) => x.work.id === c.work.id)) continue;
    const a = analysesFor(c.work, workDetail(c.work.id)?.externalAnalyses).find((x) => x.url.includes(video) && x.tier !== 'review');
    const v = a && voiceOf(a);
    if (!a || !v || v.role !== 'author') continue;
    voice ??= v;
    items.push({ work: c.work, what: c.what, essays: c.essays ?? 0, voice: v.title, essay: { title: a.title, url: a.url, ...(a.durationMinutes ? { minutes: a.durationMinutes } : {}) } });
  }
  return { items, voice };
}
const poolByKey = (pool: Candidate[]): Map<string, Candidate> => {
  const out = new Map<string, Candidate>();
  for (const c of pool) if (isFilm(c.work) && c.work.complexityLevel) for (const k of keyList(c.work)) if (!out.has(k)) out.set(k, c);
  return out;
};
/** полка подборки голоса — не меньше стольких фильмов, которые человек увидит */
const VOICE_LIST_MIN = 5;

export async function getCollections(): Promise<{ themes: CollectionSummary[]; voices: CollectionSummary[] }> {
  await delay(120);
  await Promise.all([catalog(), loadGenres(), loadVoiceLists()]);
  const pool = candidates();
  const themes = COLLECTIONS.map((c) => {
    const items = collectionPool(c, pool);
    return { id: c.id, films: items.length, essayed: items.filter((x) => x.essays > 0).length };
  });
  const byKey = poolByKey(pool);
  const voices = (voiceLists ?? []).flatMap((l): CollectionSummary[] => {
    const { items, voice } = voiceListPool(l, byKey);
    return items.length >= VOICE_LIST_MIN ? [{ id: `pl-${l.id}`, films: items.length, essayed: items.length, title: l.title, voice: voice?.title ?? l.channel }] : [];
  }).sort((a, b) => b.films - a.films);
  return { themes, voices };
}
/** `easier` — с какого места полка идёт проще уровня человека (нет такого — длина списка). */
export async function getCollection(id: string): Promise<CollectionPage | undefined> {
  await delay(160);
  await Promise.all([catalog(), loadGenres(), loadVoiceLists()]);
  const comfort = ownState()?.complexityComfort ?? 5;
  const path = (list: CollectionItem[]) => {
    // на одном уровне — сначала с разборами
    const items = levelPath([...list].sort((a, b) => b.essays - a.essays), (x) => x.work.complexityLevel ?? 0, comfort);
    const easier = items.findIndex((x) => (x.work.complexityLevel ?? 0) < comfort - 1);
    return { items, easier: easier < 0 ? items.length : easier };
  };
  if (id.startsWith('pl-')) {
    const l = voiceLists?.find((x) => `pl-${x.id}` === id);
    if (!l) return undefined;
    const { items, voice } = voiceListPool(l, poolByKey(candidates()));
    return { id, ...path(items), title: l.title, voice: voice?.title ?? l.channel, ...(voice ? { voiceId: voice.id } : {}) };
  }
  const c = collectionById(id);
  return c ? { id, ...path(collectionPool(c)) } : undefined;
}

/** Полки для экрана настроек: что можно выбрать фокусом. */
export async function getShelves(): Promise<{ id: string; title: string; why: string; films: number }[]> {
  await delay(120);
  await catalog();
  const { shelves } = await import('@/mocks/shelves');
  return Object.entries(shelves).map(([id, s]) => ({
    id, title: s.title, why: s.why,
    films: shelfCandidates((shelfKeys[id] ?? []).flatMap((k) => shelfWorks.get(k) ?? [])).length,
  }));
}

const candidateCard = (id: ID): WorkCard | undefined => {
  const s = candidateSeeds.find((x) => x.id === id);
  return s ? { ...seedToCard(s), ...candidateMedia[s.id] } : undefined;
};

/** Что участник уже видел — по внешним ID; такие кадры на «Сегодня» не предлагаются. */
function seenKeys(): Set<string> {
  const keys = new Set<string>();
  const all = [...history().filter((e) => e.status === 'finished').map((e) => e.work), ...watchedNow()];
  for (const w of all) {
    const ids = w.externalIds ?? externalIds[w.id];
    if (ids?.imdb) keys.add(`imdb:${ids.imdb}`);
    if (ids?.tmdb != null) keys.add(`tmdb:${ids.tmdb}`);
    if (ids?.kinopoisk != null) keys.add(`kp:${ids.kinopoisk}`);
    ids?.isbn?.forEach((i) => keys.add(`isbn:${i}`));
    // книга как произведение (З1): другое издание той же книги — тоже «уже читал»
    if (w.type === 'book') workKeys(w, ids).forEach((k) => keys.add(k));
  }
  return keys;
}
/** Внешние ключи карточки строками — чтобы узнать один фильм под разными id. */
function keyList(work: WorkCard): string[] {
  const ids = work.externalIds ?? externalIds[work.id];
  return [ids?.imdb && `imdb:${ids.imdb}`, ids?.tmdb != null && `tmdb:${ids.tmdb}`].filter((k): k is string => Boolean(k));
}

function seen(work: WorkCard, keys: Set<string>): boolean {
  const ids = work.externalIds ?? externalIds[work.id];
  return Boolean(ids && ((ids.imdb && keys.has(`imdb:${ids.imdb}`)) || (ids.tmdb != null && keys.has(`tmdb:${ids.tmdb}`))
    || (ids.kinopoisk != null && keys.has(`kp:${ids.kinopoisk}`)) || ids.isbn?.some((i) => keys.has(`isbn:${i}`))
    || (work.type === 'book' && workKeys(work, ids).some((k) => keys.has(k)))));
}

const tvTropesMappings: TvTropesMapping[] = [
  { source: 'Unreliable Narrator', target: 'Ненадёжный рассказчик', usage: 'straight',
    status: 'approved', attribution: 'TV Tropes, CC BY-NC-SA' },
  { source: 'Rashomon Style', target: 'Несовместимые показания', usage: 'deconstruction',
    status: 'needs_review', attribution: 'TV Tropes, CC BY-NC-SA' },
  { source: 'Mind Screw', status: 'rejected', attribution: 'нет соответствия в TMDF' },
];

/** Ход диагностики в моке: сессия помнит, сколько отвечено, и отдаёт следующее задание;
 *  задания кончились — сессия завершена. `cp-1` заведена заранее как контрольная точка,
 *  до которой в §17 пока нет своего эндпоинта (её назначает сервер, а не экран). */
const sessions = new Map<ID, { mode: AssessmentMode; answered: number; checkpoint?: boolean; paused?: boolean }>([
  ['cp-1', { mode: 'quick', answered: 0, checkpoint: true }],
]);

function sessionView(id: ID): AssessmentSession | undefined {
  const s = sessions.get(id);
  if (!s) return undefined;
  const items = mocks.assessmentItems;
  const total = s.mode === 'quick' ? 8 : 24;
  const minutes = s.mode === 'quick' ? 6 : 22;
  const done = s.answered >= items.length;
  return {
    id, mode: s.mode,
    status: done ? 'completed' : s.paused ? 'paused' : 'in_progress',
    progress: {
      answered: s.answered, estimatedTotal: total,
      estimatedMinutesLeft: Math.max(1, Math.round(minutes * (1 - s.answered / total))),
    },
    currentItem: done ? undefined : items[s.answered],
  };
}

function buildCheckInResult(entryId: ID, request: CheckInRequest): CheckInResult {
  const entry = mocks.journal.find((e) => e.id === entryId) ?? mocks.journal[1];
  return {
    entry: withPrediction({ ...entry, status: request.status, perceivedDifficulty: request.perceivedDifficulty }),
    newState: mocks.state,
    debrief: mocks.debrief,
    nextRecommendation: mocks.slates.normal.items[1],
    trajectoryUpdate: { trajectoryId: mocks.trajectories[0].id, replanned: false },
  };
}

/** Какому произведению принадлежала рекомендация: отклик приходит по id рекомендации, а
 *  считать потом придётся по фильмам. Живёт в памяти вкладки — на сервере это же знание
 *  появится, когда слейт начнёт собираться там. */
const slateWorks = new Map<ID, ID>();
/** Карточка рекомендации — уровень и признаки уходят с откликом (МА-1/МА-2): у сервера разметки нет. */
const slateCards = new Map<ID, WorkCard>();

/** Сколько досмотренного с разметкой: только от него модель и считает состояние. */
const ratedCount = (): number =>
  history().filter((e) => e.status === 'finished' && e.work.complexityLevel > 0 && e.work.primaryOperations.length).length;

/** Сколько оценок до первой ленты (10.10): страница фильма зовёт новичка собрать ленту. Без сервера на
 *  истории владельца — лента есть всегда (`needed: 0`). */
export async function getTasteProgress(): Promise<{ rated: number; needed: number }> {
  await ready;
  if (!store.onServer && !freshStart) return { rated: ratedCount(), needed: 0 };
  await catalog();
  return { rated: ratedCount(), needed: MIN_RATED };
}

/** Лента. `more` (ТВ-11, «Ещё фильмы»): уже показанные фильмы — следующая шестёрка той же
 *  модели без них; без вставок «фокус» и «дальше во вселенной» и без правила «первые три с
 *  разбором» — это продолжение ленты, а не её начало. */
/** Лента с учётом подписок (ЗП-42): экран передаёт, только если функция включена. */
export interface SlateOptions { subscriptions?: boolean; /** полка бесплатной классики (ЗП-43) */ freeClassics?: boolean; /** «Почитать» — книга в ленте (11.10) */ books?: boolean;
  /** что подбирать (11.10): 'book' — ленту из книг, по той же модели; нет — кино и сериалы */ kind?: FeedKind;
  /** первый вход свайпом (ДФ-2): при 0–4 оценках не холодный старт, а общая лента от среднего уровня */ general?: boolean }

export async function getSlate(energy: Energy = 'normal', more?: ID[], opts: SlateOptions = {}): Promise<RecommendationSlate> {
  // новому человеку подбирать не от чего — холодный старт сразу, без ядра (РР-5); при входе свайпом (ДФ-2) — общая лента
  if (!opts.general && await newcomer()) return { id: 's-cold', generatedAt: new Date().toISOString(), energy, items: [], coldStart: { rated: 0, needed: MIN_RATED } };
  await delay(240);
  await reconnect();
  // Новый участник: подбирать не от чего. Честно говорим, сколько оценок не хватает, а не
  // подсовываем чужую ленту — моки сценария годятся для разработки, но не для живого человека.
  const rated = ratedCount();
  const cold = (store.onServer || freshStart) && rated < MIN_RATED;
  if (cold && !opts.general) {
    return { id: 's-cold', generatedAt: new Date().toISOString(), energy, items: [], coldStart: { rated, needed: MIN_RATED } };
  }
  // общая лента (ДФ-2) — та же сборка, с подписью «пока общая» и счётом оценок
  if (cold) return { ...(await slateFor(energy, more, opts, rated, newcomerState)), general: { rated, needed: MIN_RATED } };
  return slateFor(energy, more, opts, rated);
}

/** Уровень, от которого собирается общая лента (ДФ-2): у колоды первых оценок он 2–4, лента — на шаг выше. Операций
 *  нет — подбор держится уровня, разборов и разнообразия. Как только оценок хватит на свою карту (от трёх
 *  досмотренных), берётся она. */
const NEWCOMER_LEVEL = 4;
const newcomerState = (): CognitiveState => ({
  userId: USER_ID, asOf: today(), operations: [], complexityComfort: NEWCOMER_LEVEL, mediaLiteracy: 4, overallConfidence: 'low', source: 'activity',
});

async function slateFor(energy: Energy, more: ID[] | undefined, opts: SlateOptions, rated: number, fallback?: () => CognitiveState): Promise<RecommendationSlate> {
  // справочник с полками и черновой разметкой: на сервере он грузится фоном, а пул без него беднее. Книги (РР-1) ждёт
  // только лента книг; «Почитать» в общей ленте их не ждёт — зовёт и берёт, когда пришли
  await (opts.kind === 'book' ? catalog() : films());
  if (opts.books && !booksReady) loadBooks().catch(() => undefined);
  const state = ownState() ?? fallback?.();
  // Есть размеченная история — подбор по ней из пула; нет — слейт из моков (сценарий системы).
  // уже показанное в этой ленте («Ещё фильмы») и отказанное на срок — до подбора, чтобы шестёрка была полной
  const shown = new Set([...(more ?? []), ...hiddenFromFeed()]);
  // мои подписки (ЗП-42): «только доступное» — отбор из того, что можно смотреть без доплаты
  const subs = opts.subscriptions ? settings.subscriptions ?? [] : [];
  const subsOnly = opts.subscriptions && settings.subscriptionsOnly;
  // справочник грузим, когда функция включена: вид площадки («по подписке», «бесплатно») нужен и карточке без подписок
  const books = opts.kind === 'book';
  if (opts.subscriptions && !books) await loadWatch();
  if (opts.freeClassics && !books) await loadFree();
  const keys = seenKeys();
  // отложенное в планы, начатое и брошенное — тоже не предлагаем: планы лежат в архиве,
  // начатое стоит над лентой, брошенное человек уже попробовал
  for (const e of history()) if (e.status !== 'finished') [e.work.id, ...keyList(e.work)].forEach((k) => keys.add(k));
  // отказанное — и для вставок («фокус», «дальше во вселенной»)
  for (const id of shown) keys.add(id);
  // лента книг (11.10): шесть книг по той же модели — без вставок кино (вселенная, классика, фокус на полке)
  if (books) {
    const items = state ? recommend(state, bookPool(keys), energy, 6, today()).map((r) => ({ ...r, id: `rec-book-${r.work.id}` })) : [];
    return finishSlate({ id: `s-book-${energy}-${Date.now().toString(36)}`, generatedAt: new Date().toISOString(), energy, items }, items);
  }
  const pool = candidates().filter((c) => !shown.has(c.work.id) && (!subsOnly || noExtra(c.work, subs)));
  // якорь вкуса (09.10): пока оценок мало, первая лента держится ближе к оценённому — по жанру,
  // стране и авторам; с ростом истории вес гаснет, и подбор идёт по уровню и операциям
  const anchorWeight = contentWeight(rated, MIN_RATED);
  if (anchorWeight) await loadGenres();
  // и полки вкуса, выбранные на экране первых оценок (ЗП-45)
  const anchor = anchorWeight ? deriveContentTaste(history().filter((e) => e.status === 'finished'), genresOf, settings.ratingNorm, settings.tasteShelves) : undefined;
  const content = anchor ? { weight: anchorWeight, fit: (w: WorkCard) => contentFit(anchor, w, genresOf) } : undefined;
  const base = state
    ? { id: `s-${energy}-${Date.now().toString(36)}`, generatedAt: new Date().toISOString(), energy, items: recommend(state, pool, energy, 6, today(), { seriesNovice: seriesNovice(), ...(!more && rated < NOVICE_RATED ? { essayFirst: 3 } : {}), ...(content ? { content } : {}) }) }
    : more ? { ...mocks.slates[energy], items: [] } : mocks.slates[energy];
  const items = base.items.filter((r) => !seen(r.work, keys) && !keys.has(r.work.id));
  // доступное без доплаты — вперёд, порядок внутри групп прежний (ЗП-42); новичку первые три с разбором
  // важнее — их не двигаем
  if (subs.length && !subsOnly && rated >= NOVICE_RATED) {
    const ok = items.filter((r) => noExtra(r.work, subs));
    items.splice(0, items.length, ...ok, ...items.filter((r) => !ok.includes(r)));
  }
  // фокус на полке: одно место в ленте — лучшее с выбранных полок, если такого там ещё нет
  const focus = state && !more ? await focusPick(state, energy, items, keys) : undefined;
  if (focus) items.splice(Math.min(items.length, 5), 1, focus);
  // Вставки — сверх слотов развития, одно не подменяет другое, но в порции одна (ДФ-19, 15.10): лента не длиннее
  // семи до «Ещё фильмы»; вставки сменяют друг друга по дням, а не встают все разом (было до девяти мест)
  const inserts: { rec: Recommendation; at: number }[] = [];
  // «дальше во вселенной» (Ж3); новичку первые три — с разбором (ТВ-2): вставка встаёт за ними, а не третьей —
  // продолжение вселенной часто без разборов («Хоббит», «В поисках Дори»: прогон профилей 06.10, ТВ-7)
  const next = state && !more ? await universePick(state, energy, items, keys) : undefined;
  if (next) inserts.push({ rec: next, at: rated < NOVICE_RATED ? 3 : 2 });
  // бесплатная классика (ЗП-43) — ближе к концу шестёрки
  const free = state && !more && opts.freeClassics ? freePick(state, energy, items, keys) : undefined;
  if (free) inserts.push({ rec: free, at: 4 });
  // «Почитать» (книжный трек, 11.10) — в конце шестёрки
  const book = state && !more && opts.books && booksReady ? bookPick(state, energy, items, keys) : undefined;
  if (book) inserts.push({ rec: book, at: items.length });
  const insert = inserts.length ? inserts[Math.floor(Date.parse(today()) / 864e5) % inserts.length] : undefined;
  if (insert) items.splice(Math.min(items.length, insert.at), 0, insert.rec);
  return finishSlate(base, items);
}

/** Картинки, разборы и обсуждения к подобранному; показы — на сервер. */
async function finishSlate(base: RecommendationSlate, items: Recommendation[]): Promise<RecommendationSlate> {
  const energy = base.energy;
  const works = await pictured(items.map((r) => r.work));
  for (const r of items) { slateWorks.set(r.id, r.work.id); slateCards.set(r.id, r.work); }
  // показы — знаменатель «принятия слейта» (трек Б2); не ответил сервер — лента важнее. С ними — уровень и
  // признаки показанного и снимок карты: от первого снимка сервер считает «сдвиг» (МА-1)
  if (store.onServer && items.length) {
    const span = complexitySpan(history(), settings.ratingNorm);
    store.impressions(base.id, energy, items.map((r, rank) => ({ recId: r.id, workId: r.work.id, slot: r.slot, rank, ...workMeta(r.work) })), span)
      .catch(() => undefined);
  }
  return {
    ...base,
    items: items.map((r, i) => ({
      ...r,
      work: works[i],
      analyses: analysesFor(works[i], workDetail(r.work.id)?.externalAnalyses),
      discussions: placesFor(works[i]),
    })),
  };
}

/** Подбор по настроению (ЗП-16): что понято из запроса и до шести фильмов под него. */
export interface MoodSlate { query: string; understood: string[]; like?: WorkCard; items: { work: WorkCard; what: string; fit: number }[]; /** сколько кандидатов подошло под запрос */ matched?: number; pool?: number }

/** «Что-то тихое про семью, не грустное» → лента. Словарь (`parseMood`) отсеивает и ранжирует кандидатов по запросу;
 *  если вкус человека известен, из сорока лучших по запросу модель берёт то, что по силам ему (`recommend`), — так
 *  запрос решает «что», а модель — «какое из этого». Без вкуса (новичок) — лучшие по запросу, при равенстве —
 *  с большим числом разборов. Образец («по типу …») ищется в справочнике: его регистры — в запрос, сам он — мимо. */
export async function getMoodSlate(text: string, energy: Energy = 'normal', opts: { kind?: FeedKind } = {}): Promise<MoodSlate> {
  // запрос «подобрать словами» (МА-3): что люди просят — словарю формулировок; открытия из ответа — `card` с place = mood
  if (text.trim()) store.event({ kind: 'mood_query', place: opts.kind ?? 'screen', detail: text.trim().slice(0, 120) }).catch(() => undefined);
  await delay(160);
  await reconnect();
  const q = parseMood(text);
  // книги (11.10): из ленты книг — по книгам, если в запросе не назван фильм или сериал; из ленты кино — если назвали
  // книгу («что почитать», «роман про …»). Справочник книг — только им (РР-1): запрос из ленты кино его не ждёт
  const books = q.kind === 'book' || (opts.kind === 'book' && !q.kind);
  await (books ? catalog() : films());
  if (books && !q.kind) q.kind = 'book';
  const out: MoodSlate = { query: text, understood: q.understood, items: [] };
  if (!q.understood.length) return out;
  let like: WorkCard | undefined;
  if (q.like) {
    like = await findLike(q.like, books);
    if (like) {
      const regs = withRegisters(annotated(like)).registers ?? [];
      for (const r of regs) q.registers[r] = (q.registers[r] ?? 0) + 0.8;
      out.like = like;
    }
  }
  const skip = new Set(like ? [like.id, ...keyList(like)] : []);
  for (const e of history()) if (e.status !== 'finished') [e.work.id, ...keyList(e.work)].forEach((k) => skip.add(k));
  // книгам — книжный пул (без прочитанного и отказанного), кино — общий
  const fits = (books ? bookPool(new Set([...seenKeys(), ...hiddenFromFeed()])) : candidates())
    .filter((c) => !skip.has(c.work.id) && !keyList(c.work).some((k) => skip.has(k)))
    .map((c) => ({ c, fit: moodFit(q, c) + (q.canon ? Math.min(1, (c.essays ?? 0) / 6) * 0.3 : 0) }))
    .filter((x) => x.fit >= 0.25)
    .sort((a, b) => b.fit - a.fit || (b.c.essays ?? 0) - (a.c.essays ?? 0));
  const fitOf = new Map(fits.map((x) => [x.c.work.id, x.fit]));
  out.matched = fits.length;
  const state = ownState();
  const picked = state && ratedCount() >= MIN_RATED
    ? recommend(state, fits.slice(0, 40).map((x) => x.c), q.energy ?? energy, 6, today(), { seriesNovice: seriesNovice(), maxSeries: q.kind === 'series' ? 6 : 2 })
      .map((r) => ({ work: r.work, what: r.explanation.what }))
    : [];
  // модель отсеяла всё (не по силам) или вкуса ещё нет — лучшие по запросу
  const list = picked.length >= 3 ? picked : fits.slice(0, 6).map((x) => ({ work: x.c.work, what: x.c.what }));
  const works = await pictured(list.map((x) => x.work));
  out.items = list.map((x, i) => ({ work: works[i], what: x.what, fit: Math.round((fitOf.get(x.work.id) ?? 0) * 100) / 100 }));
  return out;
}

/** «Ещё три таких же» (ДФ-5): новичку, пришедшему по ссылке на карточку, — соседи из пула того же уровня и регистра,
 *  как образец «по типу …» у подбора по настроению. Уровень — не дальше единицы; ближе те, у кого больше общих регистров
 *  и приёмов; при равенстве — с разборами (без них карточке нечего показать). Виденное и уже отмеченное — мимо. */
export async function getSimilar(id: ID, n = 3): Promise<WorkCard[]> {
  await reconnect();
  await catalog();
  const found = candidateCard(id) ?? history().find((e) => e.work.id === id)?.work ?? watchedNow().find((w) => w.id === id)
    ?? filmBase.find((w) => w.id === id) ?? filmBaseWiki.find((w) => w.id === id);
  if (!found) return [];
  const self = withRegisters(isSeries(found) ? withSeriesDraft(found) : annotated(found));
  if (!self.complexityLevel) return [];
  const skip = new Set([self.id, ...keyList(self)]);
  for (const e of history()) [e.work.id, ...keyList(e.work)].forEach((k) => skip.add(k));
  const pool = self.type === 'book' ? bookPool(new Set([...seenKeys(), ...hiddenFromFeed()])) : candidates();
  const regs = new Set<string>(self.registers ?? []);
  const ops = new Set<string>(self.primaryOperations.map((o) => o.op));
  const overlap = (a: Set<string>, b: string[]) => {
    const common = b.filter((x) => a.has(x)).length;
    return a.size && b.length ? common / (a.size + b.length - common) : 0;
  };
  const near = pool
    .filter((c) => c.work.complexityLevel && Math.abs(c.work.complexityLevel - self.complexityLevel) <= 1
      && !skip.has(c.work.id) && !keyList(c.work).some((k) => skip.has(k)))
    .map((c) => ({
      work: c.work,
      score: overlap(regs, c.work.registers ?? []) + 0.5 * overlap(ops, c.work.primaryOperations.map((o) => o.op))
        - 0.4 * Math.abs(c.work.complexityLevel - self.complexityLevel)
        + 0.3 * Math.min(1, (c.essays ?? 0) / 3) + (isSeries(c.work) === isSeries(self) ? 0.2 : 0),
    }))
    .sort((a, b) => b.score - a.score);
  // одно название — один раз: сезоны антологии и дубли справочника иначе заняли бы все три места
  const picked: WorkCard[] = [];
  const titles = new Set<string>();
  for (const x of near) {
    const t = normalizeTitle(x.work.title);
    if (titles.has(t)) continue;
    titles.add(t);
    picked.push(x.work);
    if (picked.length === n) break;
  }
  return pictured(picked);
}

/** Образец «по типу …» (ЗП-16). Название в запросе стоит в косвенном падеже («по типу „Иллюзии обмана“»,
 *  «Пикника на обочине») — поиск по точной строке его не находит. Второй заход — по основам слов: у слова длиннее
 *  четырёх букв отрезается окончание (до двух букв), слова идут подряд с начала слова названия. Образец — того же
 *  вида, что подбор: в книгах книга, в кино фильм или сериал. */
async function findLike(text: string, books: boolean): Promise<WorkCard | undefined> {
  const sameKind = (w: WorkCard) => (w.type === 'book') === books;
  const direct = (await searchWorks(text, 5)).map((h) => h.work).find(sameKind);
  if (direct) return direct;
  const words = searchKey(text).replace(/[^\p{L}\p{N}\s]+/gu, ' ').split(/\s+/).filter(Boolean);
  if (!words.length) return undefined;
  const stem = (w: string) => (w.length > 4 ? w.slice(0, Math.max(4, w.length - 2)) : w);
  const re = new RegExp(`(?:^|\\s)${words.map((w) => `${stem(w)}\\S*`).join('\\s+')}`);
  const name = (t?: string) => (t ? searchKey(t).replace(/[^\p{L}\p{N}\s]+/gu, ' ').replace(/\s+/g, ' ') : '');
  // короче название — ближе к запросу: «Иллюзия обмана», а не «Иллюзия обмана 2»; при равных — с разметкой
  // (по ней образец и работает) и раньше вышедшее: «Твин Пикс» 1990, а не возвращение 2017-го
  const marked = (w: WorkCard) => (annotated(w).primaryOperations.length ? 0 : 1);
  return knownWorks().filter((w) => sameKind(w) && [w.title, w.originalTitle].some((t) => re.test(name(t))))
    .sort((a, b) => a.title.length - b.title.length || marked(a) - marked(b) || (a.year || 9999) - (b.year || 9999))[0];
}

/** «Дальше во вселенной» (Ж3): продолжение того, что человек видел и досмотрел. Сначала — прямое
 *  продолжение (сиквел) последнего досмотренного из вселенной; нет — лучшее по модели непросмотренное
 *  той же вселенной (другая экранизация того же романа, часть франшизы). Модель здесь не решает,
 *  брать ли, — только отсекает совсем не по силам (оценка ниже 0,3) и не размеченное: иначе слот
 *  развития и слот вселенной стали бы одним и тем же. */
async function universePick(state: CognitiveState, energy: Energy, items: Recommendation[], keys: Set<string>): Promise<Recommendation | undefined> {
  await relationRefs();
  if (!relationEdges.length) return undefined;
  const { hubOf } = universeIndex();
  const byKey = worksByAnalysisKey();
  const taken = new Set(items.flatMap((r) => [r.work.id, ...keyList(r.work)]));
  const qOf = (w: WorkCard) => { const k = workKey(w, w.externalIds ?? externalIds[w.id]); return (k && relationQid.get(k)) || w.externalIds?.wikidata; };
  const cardOf = (q: string) => { const k = relationNodes[q]?.key; const w = k ? byKey.get(k) : undefined; return w && (isSeries(w) ? withSeriesDraft(w) : annotated(w)); };
  const open = (w: WorkCard | undefined): w is WorkCard => Boolean(w && w.complexityLevel && w.primaryOperations.length
    && !seen(w, keys) && !keys.has(w.id) && !taken.has(w.id) && !keyList(w).some((k) => taken.has(k)) && (isScreen(w))
    && scoreCandidate(state, w, energy) >= 0.3
    // продолжение тоже подчиняется силе (10.10): «Полегче» — без слишком трудного и без тяжёлого по настроению,
    // «Готов к сложному» — без слишком простого. Раньше «Ганнибал» уровня 3 стоял во всех трёх лентах
    && !(energy === 'low' && (expectedDifficulty(state, w, energy) === 'too_hard' || heaviness(w) >= 0.4))
    && !(energy === 'high' && expectedDifficulty(state, w, energy) === 'too_easy'));
  // от свежего к старому: досмотренное из дневника, потом просмотренное списком
  const done = [...history().filter((e) => e.status === 'finished').sort((a, b) => (b.finishedAt ?? '').localeCompare(a.finishedAt ?? '')).map((e) => e.work), ...watchedNow()];
  for (const w of done) {
    const q = qOf(w);
    const hub = q && hubOf.get(q);
    if (!q || !hub) continue;
    const sequel = relationEdges.filter(([, kind, b]) => kind === 'sequel_of' && b === q).map(([a]) => cardOf(a)).find(open);
    const pick = sequel ?? [...(universeIndex().members.get(hub) ?? [])].map(cardOf).filter(open)
      .sort((a, b) => scoreCandidate(state, b, energy) - scoreCandidate(state, a, energy))[0];
    if (!pick) continue;
    const [rec] = recommend(state, [{ work: pick, what: draftFor(pick)?.what ?? workDetail(pick.id)?.synopsis ?? '' }], energy, 1, today(), { maxSeries: 1 });
    if (!rec) continue;
    const universe = relationNodes[hub]?.t ?? '';
    return { ...rec, id: `rec-universe-${pick.id}`, slot: 'universe',
      explanation: { ...rec.explanation, why: `${sequel ? ui.today.universeSequel(w.title) : ui.today.universeMore(universe, w.title)} ${rec.explanation.why}` } };
  }
  return undefined;
}

/** Полка бесплатной легальной классики (ЗП-43): лучший по модели фильм из тех, что выложены правообладателем или
 *  лежат в общественном достоянии, — если в ленте такого ещё нет. Порог модели тот же, что у остальных. */
function freePick(state: CognitiveState, energy: Energy, items: Recommendation[], keys: Set<string>): Recommendation | undefined {
  if (!freeRef || items.some((r) => freeFor_(r.work).length)) return undefined;
  const pool = candidates().filter((c) => freeFor_(c.work).length && !seen(c.work, keys) && !keys.has(c.work.id) && !items.some((r) => r.work.id === c.work.id));
  const [rec] = recommend(state, pool, energy, 1, today());
  return rec ? { ...rec, id: `rec-free-${rec.work.id}`, slot: 'free' } : undefined;
}

/** «Почитать» (книжный трек, 11.10): одна книга по силам из размеченных — калибровка владельца и черновики (З4),
 *  неуверенные (low) не берём. Книги в общий пул подбора не идут (`draftSources` — только кино): шкала у них та же,
 *  но модель вкуса считается по фильмам — книга стоит отдельным местом, сверх фильмов, и помечена. Порог модели тот
 *  же: книга совсем не по силам или слишком простая не пройдёт. */
function bookPick(state: CognitiveState, energy: Energy, items: Recommendation[], keys: Set<string>): Recommendation | undefined {
  if (items.some((r) => r.work.type === 'book')) return undefined;
  const [rec] = recommend(state, bookPool(keys), energy, 1, today());
  return rec ? { ...rec, id: `rec-book-${rec.work.id}`, slot: 'book' } : undefined;
}
/** Книги для подбора: справочник и история с разметкой (не low), не прочитанные и не отказанные, и только те, чья
 *  очередь (`bookTurn`). */
function bookPool(keys: Set<string>): Candidate[] {
  const pool: Candidate[] = [];
  const taken = new Set<string>();
  const read = seenKeys();
  for (const w of [...filmBaseWiki, ...watchedWorks]) {
    if (w.type !== 'book' || taken.has(w.id) || seen(w, keys) || keys.has(w.id) || !bookTurn(w, read)) continue;
    const a = bookDraftFor(w);
    if (!a || a.confidence === 'low') continue;
    taken.add(w.id);
    const work = annotated(w);
    pool.push({ work, what: a.what, essays: visibleAuthors(analysesFor(work, workDetail(w.id)?.externalAnalyses)) });
  }
  return pool;
}

/** Очередь книги в подборе (РР-0, решения владельца 14.10): стихотворение в подбор не идёт — только каталог и поиск;
 *  из цикла — первый непрочитанный том (отказался от него — цикл ждёт, следующий том не подставляем); карточка цикла,
 *  у которого есть наши тома, сама не предлагается. `read` — прочитанное (`seenKeys`), у книги ключ `wd:<элемент>`. */
function bookTurn(w: WorkCard, read: Set<string>): boolean {
  const q = (w.externalIds ?? externalIds[w.id])?.wikidata;
  if (!q) return true;
  if (bookPoems.has(q) || bookCycles[q]) return false;
  return (cyclesOfBook.get(q) ?? []).every((c) => !read.has(`wd:${c}`) && bookCycles[c].find((v) => !read.has(`wd:${v}`)) === q);
}

/** Лучшее с полок, выбранных участником, — если в ленте с них ещё ничего нет. Порог модели
 *  не снимаем: фильм, который совсем не по силам или слишком прост, фокус не протащит. */
async function focusPick(state: CognitiveState, energy: Energy, items: Recommendation[], keys: Set<string>): Promise<Recommendation | undefined> {
  const chosen = settings.shelves ?? [];
  if (!chosen.length) return undefined;
  const { shelves } = await import('@/mocks/shelves');
  const onShelf = new Map<string, string>();
  for (const id of chosen) for (const k of shelfKeys[id] ?? []) if (!onShelf.has(k)) onShelf.set(k, id);
  if (items.some((r) => keyList(r.work).some((k) => onShelf.has(k)))) return undefined;
  const pool = shelfCandidates([...onShelf.keys()].flatMap((k) => shelfWorks.get(k) ?? []))
    .filter((c) => !seen(c.work, keys) && !keys.has(c.work.id));
  const [pick] = recommend(state, pool, energy, 1, today());
  if (!pick) return undefined;
  const shelf = shelves[onShelf.get(keyList(pick.work).find((k) => onShelf.has(k))!)!];
  return { ...pick, explanation: { ...pick.explanation, why: ui.today.fromShelf(shelf.title) + pick.explanation.why } };
}

// ---------- первые оценки (холодный старт) ----------

export interface RatingItem { work: WorkCard; rating?: 1 | 2 | 3 | 4 | 5 }
export interface RatingDeck {
  items: RatingItem[];
  /** отдельный ряд сериалов (Е4): своё просмотренное, потом размеченные с разборами */
  series: RatingItem[];
  /** ряд книг (11.10, за флагом `readShelf`): своё прочитанное, потом размеченные с обложкой — по числу разборов */
  books?: RatingItem[];
  rated: number;
  needed: number;
  /** снимок колоды нового человека (РР-5): полная придёт следом и подменит его */
  partial?: boolean;
}

/** Колода нового человека сразу (РР-5): снимок (`deckCards`, tools/build-deck-cards.mts) без ядра и справочника фильмов;
 *  полную (`getRatingDeck`) экран зовёт следом и подменяет снимок, сохраняя оценки, поставленные на нём. Не новый
 *  человек или справочник уже пришёл — undefined: сразу полная. */
export async function getQuickDeck(): Promise<RatingDeck | undefined> {
  if (filmsReady || !(await newcomer())) return undefined;
  const { deckCards, deckSource } = await import('@/mocks/deckCards');
  const en = language === 'en';
  // снимок снят с другой колоды (её перегенерировали, а tools/build-deck-cards.mts — нет): лучше полная, чем чужая
  if ((en ? deckSource.en : deckSource.ru) !== (en ? ratingDeckEn : ratingDeck).join(',')) return undefined;
  return { items: (en ? deckCards.en : deckCards.ru).map((work) => ({ work })), series: [], rated: 0, needed: MIN_RATED, partial: true };
}

/** Карточка фильма из колоды: справочник истории, пул подбора или каталог — с разметкой,
 *  регистрами и кадром. */
function deckCard(id: ID): WorkCard | undefined {
  const fromHistory = userWorks.find((w) => w.id === id);
  if (fromHistory) return annotated(fromHistory);
  const candidate = candidateCard(id);
  if (candidate) return withRegisters(candidate);
  const catalog = (mocks.works as Record<string, WorkCard>)[id];
  if (catalog) return withCredits(withRegisters(withMedia(catalog)));
  // самые смотримые из справочника — с черновой разметкой (трек Г1)
  const base = filmBase.find((w) => w.id === id) ?? filmBaseWiki.find((w) => w.id === id) ?? watchedWorks.find((w) => w.id === id);
  return base ? withCredits(annotated(base)) : undefined;
}

export async function getRatingDeck(opts: { books?: boolean } = {}): Promise<RatingDeck> {
  await delay(160);
  // ряд книг — только с книгами (РР-1); колода фильмов их не ждёт
  await (opts.books ? catalog() : films());
  // Своё просмотренное — первым: если участник прислал список (или отметил виденное сам), ему
  // проще и честнее оценить это, чем угадывать по общей колоде. Общая колода — следом, без того,
  // что уже есть в своём списке. Сериалы — отдельным рядом (Е4): их оценки тоже идут в модель.
  const own = watchedNow().filter(isFilm).map(annotated);
  const keys = new Set(own.flatMap((w) => [w.id, ...keyList(w)]));
  // английскому интерфейсу — своя колода (ЗП-20): русская ранжирована русской аудиторией
  const common = (language === 'en' ? ratingDeckEn : ratingDeck)
    .map((id) => deckCard(id))
    .filter((w): w is WorkCard => Boolean(w) && !keys.has(w!.id) && !keyList(w!).some((k) => keys.has(k)));
  const withRating = (work: WorkCard) => ({ work, ...(ratingOf(work.id) ? { rating: ratingOf(work.id)!.rating } : {}) });
  // полки вкуса (ЗП-45): фильмы выбранных полок — вперёд, порядок внутри («самые смотримые сверху») прежний
  const picks = settings.tasteShelves ?? [];
  if (picks.length) await loadGenres();
  const ordered = partsInOrder(common);
  const mine = picks.length ? ordered.filter((w) => onPickedShelf(w, picks, genresOf)) : [];
  const items = [...own, ...mine, ...ordered.filter((w) => !mine.includes(w))].map(withRating);
  return { items, series: seriesDeck().map(withRating), ...(opts.books ? { books: bookDeck().map(withRating) } : {}), rated: ratedCount(), needed: MIN_RATED };
}

/** Ряд книг в /rate (11.10): читателю, который смотрит мало, первую ленту проще собрать по книгам — оценки книг
 *  идут в счёт порога и в модель, как сериалы. Своё прочитанное первым, дальше размеченные (не low) с обложкой —
 *  у кого больше разборов, та и известнее. */
function bookDeck(): RatingItem['work'][] {
  const own = watchedNow().filter((w) => w.type === 'book').map(annotated);
  const keys = new Set(own.flatMap((w) => [w.id, ...keyList(w)]));
  const counted = new Map<ID, number>();
  const count = (w: WorkCard) => counted.get(w.id) ?? (counted.set(w.id, analysesFor(w).length), counted.get(w.id)!);
  const common = bookPool(new Set()).map((c) => c.work)
    .filter((w) => w.coverUrl && !keys.has(w.id) && !keyList(w).some((k) => keys.has(k)))
    .sort((a, b) => count(b) - count(a));
  const seen = new Set<string>();
  return [...own, ...common].filter((w) => (seen.has(w.id) ? false : (seen.add(w.id), true))).slice(0, 24);
}

/** Ряд сериалов в /rate (Е4): своё просмотренное первым, дальше размеченные (не low) с обложкой —
 *  у кого больше разборов, тот и известнее. Двадцать с небольшим: это ряд, а не вторая колода. */
function seriesDeck(): WorkCard[] {
  const own = watchedNow().filter(isSeries).map(annotated);
  const keys = new Set(own.flatMap((w) => [w.id, ...keyList(w)]));
  const counted = new Map<ID, number>();
  const count = (w: WorkCard) => counted.get(w.id) ?? (counted.set(w.id, analysesFor(w).length), counted.get(w.id)!);
  const common = draftSources(false)
    .filter((d) => isSeries(d.work) && !d.season && d.annotation.confidence !== 'low' && (d.work.coverUrl || d.work.stillUrl))
    .map((d) => annotated(d.work))
    // у антологии в очереди сезоны, а в колоде — сериал целиком
    .concat(draftSources(false).filter((d) => d.season === 1 && (d.work.coverUrl || d.work.stillUrl)).map((d) => annotated(d.work)))
    .filter((w) => !keys.has(w.id) && !keyList(w).some((k) => keys.has(k)))
    .sort((a, b) => count(b) - count(a));
  const seen = new Set<string>();
  return [...own, ...common].filter((w) => (seen.has(w.id) ? false : (seen.add(w.id), true))).slice(0, 24);
}

/** Оценить виденное (1–5) или снять оценку. Оценка — вес для модели, наружу она не уходит. */
export async function rateWork(workId: ID, rating: 1 | 2 | 3 | 4 | 5 | null): Promise<{ rated: number; needed: number }> {
  await delay(60);
  await catalogFor(workId);
  const work = deckCard(workId) ?? knownWorks().find((w) => w.id === workId);
  if (rating == null) {
    ratings.delete(workId);
    ratedCards.delete(workId);
  } else if (work) {
    ratings.set(workId, { rating });
    ratedCards.set(workId, work);
  }
  await store.rating(workId, rating, work);
  return { rated: ratedCount(), needed: MIN_RATED };
}

/** Колода первого входа свайпом (ДФ-2): 12 узнаваемых фильмов с верха колоды первых оценок — снимок сразу, если человек
 *  новый, иначе полная. Один фильм на режиссёра: верх колоды — три «Властелина колец» подряд, а нужен разброс. Уже
 *  оценённое не показываем. */
export const START_DECK = 12;
export async function getStartDeck(): Promise<WorkCard[]> {
  const deck = (await getQuickDeck()) ?? (await getRatingDeck());
  const leads = new Set<string>();
  const out: WorkCard[] = [];
  for (const { work, rating } of deck.items) {
    if (rating || ratingOf(work.id)) continue;
    const lead = leadCredits(work)[0]?.name ?? work.creators[0];
    if (lead && leads.has(lead)) continue;
    if (lead) leads.add(lead);
    out.push(work);
    if (out.length >= START_DECK) break;
  }
  return out;
}

/** «Не моё» на первом входе (ДФ-2): фильм не из ленты — отказ по ключу произведения, как «Не моё» в ленте: насовсем. */
export async function dismissWork(workId: ID): Promise<void> {
  dismissals.set(workId, { reason: 'not_interested', at: new Date().toISOString() });
  await store.feedback(`start-${workId}`, workId, 'dismiss', 'not_interested');
}

/** Шаг первого входа (ДФ-2): сравнение свайпа с колодой /rate — кто дошёл до ленты, сколько отметил. Замер, не учёт. */
let startPassedNow = false;
/** Первый вход пройден в этом запуске (ДФ-2): «Сегодня» не уводит обратно на /start, даже если настройка не дошла до сервера. */
export const startPassed = (): boolean => startPassedNow;
export function noteOnboard(step: 'swipe_done' | 'swipe_skip' | 'favorites_done' | 'favorites_skip', detail?: string): void {
  if (step.startsWith('favorites')) startPassedNow = true;
  store.event({ kind: 'onboard', place: step, ...(detail ? { detail } : {}) }).catch(() => undefined);
}

/** Отказы на фильмы ленты (10.10, решение владельца): «Не сейчас» раньше ничего не значило для подбора — с
 *  той же историей фильм возвращался при следующей сборке ленты, и кнопка казалась сломанной. Теперь фильм
 *  уходит на срок по причине: «Не моё» и «Уже знаю» — насовсем, «Недоступно» — на 30 дней, «Тяжело сейчас»
 *  и без причины — на 14. Последний отказ по фильму приходит с сервера в профиле. */
const dismissals = new Map<ID, { reason?: DismissReason; at: string }>();
const HIDE_DAYS: Record<DismissReason, number> = { not_interested: Infinity, already_know: Infinity, unavailable: 30, too_heavy_now: 14, other: 14 };
function hiddenFromFeed(now = Date.now()): Set<ID> {
  const out = new Set<ID>();
  for (const [id, d] of dismissals) {
    const days = HIDE_DAYS[d.reason ?? 'other'] ?? 14;
    if (days === Infinity || now - Date.parse(d.at) < days * 864e5) out.add(id);
  }
  return out;
}

export async function sendRecommendationFeedback(id: ID, feedback: RecommendationFeedback): Promise<{ ok: true }> {
  await delay(160);
  const workId = slateWorks.get(id);
  // «Видел» тоже уходит отказом с причиной «уже знаю», но его держит история просмотренного
  if (feedback.action === 'dismiss' && workId) dismissals.set(workId, { reason: feedback.reason, at: new Date().toISOString() });
  // принял / отложил / отказался и почему — это половина ответа на вопрос «работает ли
  // подбор»; пока отклики нигде не копились, сравнивать его было не с чем
  await store.feedback(id, slateWorks.get(id), feedback.action, feedback.reason, feedback.eagerness, workMeta(slateCards.get(id)));
  return { ok: true } as const;
}

/** Где открыли материал: шторка (лента, архив, поиск), страница фильма, автора, человека,
 *  вселенной, героя. */
export type OpenPlace = 'sheet' | 'work' | 'voice' | 'person' | 'universe' | 'character';
export interface MaterialOpen {
  url: string; workId?: ID; platform: ExternalAnalysis['platform']; lens?: string; lensAlso?: string; tier?: string;
  place: OpenPlace; shelf?: string; shelves: boolean; at: string;
  /** чей материал (голос реестра) и сколько минут ролик — для «дочитывания по автору» (МА-3) */
  voiceId: string; minutes?: number;
}
/** Открытия этого запуска — без сервера ими проверяется, что замер пишется (ТВ-3г). */
export const openLog: MaterialOpen[] = [];

/** Открыли материал (ТВ-3г). Рубрика пишется всегда, и когда полок не видно: этап 1 выката —
 *  замер, что открывают по рубрикам, без их показа (ТВ-3в). `shelf` — полка, на которой стоял
 *  человек (нет — «все»), `shelves` — видел ли он полки вообще. Не дошло — не беда: замер, не учёт. */
export function noteOpen(a: ExternalAnalysis, ctx: { place: OpenPlace; workId?: ID; shelf?: string; shelves?: boolean }): void {
  const event: MaterialOpen = {
    url: a.url, platform: a.platform, place: ctx.place, shelves: Boolean(ctx.shelves), at: new Date().toISOString(),
    voiceId: voiceOf(a).id, ...(a.durationMinutes ? { minutes: a.durationMinutes } : {}),
    ...(ctx.workId ? { workId: ctx.workId } : {}), ...(a.lens ? { lens: a.lens } : {}), ...(a.lensAlso ? { lensAlso: a.lensAlso } : {}),
    ...(a.tier ? { tier: a.tier } : {}), ...(ctx.shelf ? { shelf: ctx.shelf } : {}),
  };
  openLog.push(event);
  if (openLog.length > 200) openLog.shift();
  watchReturn(store.open({ ...event }).catch(() => undefined));
}

/** Сколько человек был в открытом материале (МА-3): от открытия до возврата в приложение. Возврат — вкладка снова
 *  видна, окно снова в фокусе или Telegram вернул мини-приложение (`activated`, Bot API 8.0); если приложение так и не
 *  уходило на второй план (ролик открылся поверх и закрылся мгновенно) или человек не вернулся — замера нет. Меньше двух
 *  секунд — не уходил. Ждём один материал: следующее открытие заменяет прежнее. */
let away: { id: Promise<string | undefined>; at: number; left: boolean } | undefined;
function watchReturn(id: Promise<string | undefined>): void {
  away = { id, at: Date.now(), left: false };
  listenReturn();
}
let listening = false;
function listenReturn(): void {
  if (listening || typeof document === 'undefined') return;
  listening = true;
  const leave = () => { if (away) away.left = true; };
  const back = () => {
    const a = away;
    if (!a?.left) return;
    away = undefined;
    const seconds = (Date.now() - a.at) / 1000;
    if (seconds >= 2) a.id.then((id) => (id ? store.dwell(id, seconds) : undefined)).catch(() => undefined);
  };
  document.addEventListener('visibilitychange', () => (document.visibilityState === 'hidden' ? leave() : back()));
  window.addEventListener('blur', leave);
  window.addEventListener('focus', back);
  const wa = webApp();
  wa?.onEvent('deactivated', leave);
  wa?.onEvent('activated', back);
}

/** Поделился (МА-3): что — фильм, сериал, книга, герой, «выбрать вместе», приглашение в приложение; как — карточкой-
 *  сообщением (выбрал чат), окном «переслать», системным «Поделиться», скопировал ссылку. Не дошло — не беда. */
export type ShareWhat = 'film' | 'series' | 'book' | 'character' | 'together' | 'friend';
export type ShareHow = 'message' | 'telegram' | 'shared' | 'copied';
export function noteShare(what: ShareWhat, how: ShareHow, workId?: ID): void {
  store.event({ kind: 'share_sent', ...(workId ? { workId } : {}), place: placeNow(), detail: `${what}:${how}` }).catch(() => undefined);
}

/** Ответ на вопрос приложения (МА-3): `scale` — какая оценка у человека обычная. */
export function noteSurvey(survey: 'scale', answer: string | number): void {
  store.event({ kind: 'survey_answered', place: placeNow(), detail: `${survey}:${answer}` }).catch(() => undefined);
}

/** Удалить аккаунт (ЗП-5): на сервере — всё о участнике, здесь — токен и всё локальное приложения (`tm.*`).
 *  Без сервера (разработка) стирать нечего, кроме локального. Не удалось на сервере — бросаем: локальное не трогаем,
 *  иначе человек решит, что всё стёрто, а на сервере останется. */
export async function deleteAccount(): Promise<void> {
  if (store.onServer) await store.deleteAccount();
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k?.startsWith('tm.')) keys.push(k); }
    keys.forEach((k) => localStorage.removeItem(k));
    sessionStorage.clear();
  } catch { /* хранилище недоступно — на сервере уже стёрто */ }
}

// ---------- выбор компанией (ЗП-11) ----------

export interface TogetherCard {
  id: ID; title: string; year?: number; image?: string; about?: string; essays?: number; kind?: 'film' | 'series'; watch?: WatchOption[];
  /** голос критика у совпадения (ДФ-13): один разбор без спойлеров */
  voice?: { author: string; title: string; url: string };
}
export type TogetherVote = 'yes' | 'maybe' | 'no' | 'veto' | 'seen';
export interface TogetherRow {
  workId: ID; yes: number; maybe: number; no: number; veto: number; seen: number;
  yesNames: string[]; maybeNames: string[]; seenNames: string[]; fit: number | null; match: boolean;
}
export interface TogetherState {
  id: string; createdAt: string; open: boolean; mineSession: boolean; owner: string | null;
  deck: TogetherCard[]; votes: Record<ID, TogetherVote>; people: { name: string; n: number; me: boolean }[];
  /** одновременное раскрытие (ДФ-13): до него `tally` пуст, `revealAt` — когда откроется по времени */
  revealed: boolean; revealAt?: string; tally: TogetherRow[];
}
const TOGETHER_SIZE = 10;

/** Десятка на вечер: подбор по профилю того, кто собирает (та же модель, что у ленты, обычная сила),
 *  только фильмы. Вперёд — те, у которых есть «где смотреть» и разборы: компании нужно куда нажать, а
 *  нам — показать, чем мы не «топ-10 недели». Отложенное в планы не убираем: это как раз то, что хотелось. */
async function togetherDeck(): Promise<TogetherCard[]> {
  await catalog();
  const pool = candidates().filter((c) => isScreen(c.work) && !isSeries(c.work));
  const byId = new Map(pool.map((c) => [c.work.id, c]));
  const state = ownState();
  // истории нет — модели не от чего считать: десятка из самых обсуждаемых
  const ranked = state ? recommend(state, pool, 'normal', 40, today(), { maxSeries: 0 }).map((r) => byId.get(r.work.id) ?? { work: r.work, what: '', essays: 0 }) : [];
  // модель могла отдать меньше — добираем самыми обсуждаемыми
  const rest = pool.filter((c) => !ranked.some((r) => r.work.id === c.work.id)).sort((a, b) => (b.essays ?? 0) - (a.essays ?? 0));
  const bonus = (c: Candidate) => (c.work.watch?.length ? 2 : 0) + ((c.essays ?? 0) > 0 ? 1 : 0);
  const pick = [...ranked, ...rest].map((c, i) => ({ c, i })).sort((a, b) => bonus(b.c) - bonus(a.c) || a.i - b.i).slice(0, TOGETHER_SIZE).map((x) => x.c);
  const works = await pictured(pick.map((c) => c.work));
  return pick.map((c, i) => {
    const w = works[i];
    const about = (draftFor(w)?.what ?? c.what ?? workDetail(w.id)?.synopsis ?? '').slice(0, 300);
    // голос критика для совпадения: проверенный ролик или статья без спойлеров — смотреть ещё только предстоит
    const v = analysesFor(w, workDetail(w.id)?.externalAnalyses)
      .find((a) => a.platform !== 'telegram' && !a.unverified && !a.spoilerLevel && a.tier !== 'review');
    return {
      id: w.id, title: w.title, ...(w.year ? { year: w.year } : {}),
      ...((w.stillUrl ?? w.coverUrl) ? { image: w.stillUrl ?? w.coverUrl } : {}),
      ...(about ? { about } : {}), essays: c.essays ?? 0,
      ...(w.watch?.length ? { watch: w.watch.slice(0, 3).map((o) => ({ platform: o.platform, url: o.url, source: o.source })) } : {}),
      ...(v ? { voice: { author: v.author, title: v.title, url: v.url } } : {}),
    };
  });
}

/** Собрать десятку и завести сессию; вернуть её id. Без сервера выбирать не с кем — ошибка. */
/** Собрать десятку. `chat` — ключ из команды /together в чате (ЗП-11, 11.10): тогда сервер сам публикует туда
 *  приглашение голосовать; `posted` — название чата (null — личка с ботом), если приглашение ушло. */
export async function createTogether(chat?: string): Promise<{ id: string; posted?: string | null }> {
  if (!store.onServer) throw new Error('no_server');
  const deck = await togetherDeck();
  const r = await togetherCall<{ id: string; chat?: string | null }>('/api/together', { method: 'POST', body: JSON.stringify({ deck, ...(chat ? { chat } : {}) }) });
  if (!r?.body?.id) throw new Error(`together: ${r?.status ?? 'нет ответа'}`);
  return { id: r.body.id, ...(r.body.chat !== undefined ? { posted: r.body.chat } : {}) };
}

export async function getTogether(id: string): Promise<TogetherState | 'missing'> {
  const r = await togetherCall<TogetherState>(`/api/together/${encodeURIComponent(id)}`);
  if (r?.status === 404) return 'missing';
  if (!r?.body) throw new Error(`together: ${r?.status ?? 'нет ответа'}`);
  return r.body;
}

/** Что эта десятка значит для меня: насколько фильм подходит моему профилю (модель, 0..1 — это мой вклад
 *  в «пересечение вкусов») и видел ли я его уже. У нового участника (меньше MIN_RATED оценок) вкуса ещё
 *  нет — `fit` не отправляем, чтобы не тянуть итог к случайному. */
export async function togetherMine(deck: TogetherCard[]): Promise<Record<ID, { fit?: number; seen: boolean }>> {
  await catalog();
  const keys = seenKeys();
  const state = ratedCount() >= MIN_RATED ? ownState() : undefined;
  const out: Record<ID, { fit?: number; seen: boolean }> = {};
  for (const c of deck) {
    const w = deckCard(c.id) ?? candidates().find((x) => x.work.id === c.id)?.work;
    const fit = state && w?.complexityLevel ? Math.max(0, Math.min(1, scoreCandidate(state, w, settings.energy ?? 'normal'))) : undefined;
    out[c.id] = { seen: Boolean(w && (seen(w, keys) || keys.has(w.id))), ...(fit != null && Number.isFinite(fit) ? { fit } : {}) };
  }
  return out;
}

export async function voteTogether(id: string, workId: ID, vote: TogetherVote, fit?: number): Promise<void> {
  const r = await togetherCall<{ ok: true }>(`/api/together/${encodeURIComponent(id)}/vote`, {
    method: 'PUT', body: JSON.stringify({ workId, vote, ...(fit != null ? { fit } : {}) }),
  });
  if (!r?.body) throw new Error(`vote: ${r?.status ?? 'нет ответа'}`);
}

/** Создатель открывает итог сразу, не дожидаясь всех (ДФ-13). */
export async function revealTogether(id: string): Promise<void> {
  const r = await togetherCall<{ ok: true }>(`/api/together/${encodeURIComponent(id)}/reveal`, { method: 'POST', body: '{}' });
  if (!r?.body) throw new Error(`reveal: ${r?.status ?? 'нет ответа'}`);
}

/** Где человек: первый сегмент адреса (`#/today`, `#/journal`, `#/works/…`) — для замера, не для логики. */
const placeNow = (): string => (typeof location === 'undefined' ? '' : location.hash.replace(/^#\/?/, '').split(/[/?]/)[0] || 'today');
/** Карточка, уже отмеченная в этот запуск: шторка перерисовывается при каждой смене вкладки, а
 *  воронке нужно «открыл карточку», а не «перерисовал». Сервер всё равно считает пары «человек — фильм — день». */
const cardsNoted = new Map<ID, number>();

/** Открыли карточку произведения (ЗП-3): знаменатель для «Смотреть» и «открыл разбор». Не дошло — не беда. */
/** Трейлер (15.10, владелец): смахивание карточки ленты влево — трейлер нового фильма важнее, чем убрать, скорее всего,
 *  уже виденное («Не сейчас» осталось в карточке). Ролики фильма — из TMDb через прокси сервера (ключ на сервере):
 *  официальный трейлер на YouTube, русский, потом английский; нет трейлера — тизер. Нет id TMDb или роликов — undefined,
 *  и смахивание работает по-старому. Ответ — на сессию: лента спрашивает только то, что смахнули. */
export interface Trailer { key: string; name: string; lang: string }
/** Можно ли искать трейлер: фильм или сериал с id TMDb. */
export const trailerSource = (work: WorkCard): boolean => work.type !== 'book' && (work.externalIds ?? externalIds[work.id])?.tmdb != null;
const trailers = new Map<string, Promise<Trailer | undefined>>();
export function getTrailer(work: WorkCard): Promise<Trailer | undefined> {
  const ids = work.externalIds ?? externalIds[work.id];
  const tmdb = ids?.tmdb;
  if (tmdb == null || work.type === 'book') return Promise.resolve(undefined);
  // подобранный владельцем (trailersOwn.ts) — главнее TMDb; у сериала номер TMDb из другого ряда, с фильмами не сверяем
  const own = !isSeries(work) ? trailersOwn[`tmdb:${tmdb}`] : undefined;
  if (own) return Promise.resolve(own);
  const path = `${isSeries(work) ? 'tv' : 'movie'}/${tmdb}/videos`;
  const cached = trailers.get(path);
  if (cached) return cached;
  type Video = { key: string; name: string; site: string; type: string; official?: boolean; iso_639_1?: string; published_at?: string };
  const ask = (lang: string) => fetch(`/tmdb-api/${path}?language=${lang}`).then((r) => (r.ok ? r.json() : { results: [] }))
    .then((b: { results?: Video[] }) => (b.results ?? []).filter((v) => v.site === 'YouTube' && /^[\w-]{11}$/.test(v.key)));
  const pick = (vs: Video[]) => [...vs].sort((a, b) =>
    Number(b.type === 'Trailer') - Number(a.type === 'Trailer') || Number(b.type === 'Teaser') - Number(a.type === 'Teaser')
    || Number(Boolean(b.official)) - Number(Boolean(a.official)) || (b.published_at ?? '').localeCompare(a.published_at ?? ''))
    .find((v) => v.type === 'Trailer' || v.type === 'Teaser');
  const got = (async () => {
    const order = language === 'ru' ? ['ru-RU', 'en-US'] : ['en-US'];
    for (const lang of order) {
      const v = pick(await ask(lang));
      if (v) return { key: v.key, name: v.name, lang: v.iso_639_1 ?? lang.slice(0, 2) };
    }
    return undefined;
  })().catch(() => undefined);
  trailers.set(path, got);
  return got;
}

/** Трейлер открыт — в воронку рядом с «Смотреть» (`watch`): помогает ли трейлер дойти до просмотра. */
export function noteTrailer(workId: ID, place = placeNow()): void {
  if (!store.onServer) return;
  store.event({ kind: 'trailer', workId, place }).catch(() => undefined);
}

export function noteCard(workId: ID, place = placeNow()): void {
  const last = cardsNoted.get(workId);
  if (last && Date.now() - last < 30 * 60e3) return;
  cardsNoted.set(workId, Date.now());
  store.event({ kind: 'card', workId, place }).catch(() => undefined);
}

/** Нажали «Смотреть в …» (ЗП-3): переход в онлайн-кинотеатр. */
export function noteWatch(workId: ID | undefined, platform: string): void {
  store.event({ kind: 'watch', ...(workId ? { workId } : {}), place: placeNow(), detail: platform }).catch(() => undefined);
}

/** Страница произведения. Неизвестный id — undefined, экран показывает «нет такого». */
export async function getWork(id: ID): Promise<WorkDetail | undefined> {
  await delay(200);
  await Promise.all([catalog(), workRefs(), loadCharacterImages()]);
  // карточка ищется везде, где мы знаем произведения: дневник, пул, присланное просмотренное,
  // справочник. Просмотренного тут раньше не было, и ссылка на него (например из «рядом
  // называют») упиралась в «такого произведения нет» (23.09)
  const found = history().find((e) => e.work.id === id)?.work ?? candidateCard(id)
    ?? watchedNow().find((w) => w.id === id) ?? filmBase.find((w) => w.id === id) ?? filmBaseWiki.find((w) => w.id === id);
  const own = found && withSeriesDraft(found);
  const detail = workDetail(id) ?? (own ? bare(own) : undefined);
  if (!detail) return undefined;
  const [pic] = await pictured([{ ...detail, externalIds: detail.externalIds ?? externalIds[id] }]);
  const card = withCredits(pic);
  const nearby = nearbyFor(card);
  const form = formFor(card);
  const similarByTags = tagsFor(card);
  const relations = relationsFor(card);
  const universe = universeFor(card);
  const heroes = heroesFor(card);
  const tropeMentions = tropesFor(card);
  return {
    ...detail, ...card,
    externalAnalyses: analysesFor(card, detail.externalAnalyses),
    ...(nearby.length ? { nearby } : {}),
    ...(form ? { form } : {}),
    ...(similarByTags.length ? { similarByTags } : {}),
    ...(relations.length ? { relations } : {}),
    ...(universe ? { universe } : {}),
    ...(heroes.length ? { heroes } : {}),
    ...(tropeMentions.length ? { tropeMentions } : {}),
    // желания героев (14.10): черновики агентов — если у карточки нет своих, ручных
    ...(detail.characters?.length ? {} : await desiresFor(card)),
  };
}

// Желания героев — 64 куска src/mocks/desires/NN.json по хэшу ключа (src/lib/desires.ts): странице нужен один кусок,
// весь справочник желаний в первую загрузку не идёт.
const desireShards = import.meta.glob<{ default: Record<string, DesireRecord> }>('../mocks/desires/*.json');
const desireShardCache = new Map<string, Promise<Record<string, DesireRecord>>>();
async function desiresFor(w: WorkCard): Promise<Partial<Pick<WorkDetail, 'desireModel' | 'characters'>>> {
  const key = primaryKey(w, w.externalIds ?? externalIds[w.id]);
  const load = key ? desireShards[`../mocks/desires/${desireShard(key)}.json`] : undefined;
  if (!key || !load) return {};
  const shard = desireShard(key);
  const all = desireShardCache.get(shard) ?? desireShardCache.set(shard, load().then((m) => m.default).catch(() => ({}))).get(shard)!;
  const r = (await all)[key];
  return r ? desiresOf(r) : {};
}

/** Описания карточек справочника (07.10): 16 долей по id (src/lib/shard.ts), подгружаются по одной — при старте
 *  их не грузим (было 1,4 МБ из 3,6 МБ справочника обложек). */
const blurbShards = import.meta.glob<{ blurbs: Record<string, string> }>('../mocks/baseBlurbs/*.ts');
async function baseBlurb(id: ID): Promise<string | undefined> {
  const load = blurbShards[`../mocks/baseBlurbs/${shardOf(id)}.ts`];
  return load ? (await load()).blurbs[id] : undefined;
}

/** «Сюжет» в карточке: текст и, если лицензия требует, источник со ссылкой. */
export interface Plot { text: string; source?: { name: string; url: string } }
/** «Сюжет» в карточке: описание из подробностей, иначе — из справочника (TMDb). Раньше у карточек справочника
 *  описание лежало в сборке, но в «Сюжет» не попадало — там было «описания нет». У книги (11.10) — вступление статьи
 *  Википедии на языке интерфейса (tools/book-blurbs.mts), с источником: лицензия CC BY-SA. */
export async function getPlot(id: ID): Promise<Plot | undefined> {
  const d = await getWork(id);
  const own = d?.synopsis?.trim() || d?.blurb?.trim();
  if (own) return { text: own };
  if (d?.type === 'book') {
    const key = workKeys(d, d.externalIds ?? externalIds[d.id]).find((k) => k.startsWith('wd:'));
    const b = key ? (await import('@/mocks/bookBlurbs')).bookBlurbs[key]?.[language === 'ru' ? 'ru' : 'en'] : undefined;
    if (b) return { text: b.t, source: { name: ui.plot.wikipedia, url: b.u } };
  }
  const base = d ? await baseBlurb(d.id) : undefined;
  return base ? { text: base } : undefined;
}

/** «Поделиться» (05.10): у друга нет карточки с нашим id (у истории свои `u-kp…`), поэтому в ссылку
 *  идёт внешний ключ произведения — тот же, что у разборов (`tmdb:`, `imdb:` у сериала, `wd:`/`olw:`/`isbn:`
 *  у книги), без ключа — Кинопоиск, и только в крайнем случае id карточки. Параметр запуска Telegram
 *  (`startapp`) знает лишь буквы, цифры, `_` и `-`: двоеточие становится `_`. */
export function shareParam(work: WorkCard): string | undefined {
  const ids = work.externalIds ?? externalIds[work.id];
  const key = primaryKey(work, ids) ?? (ids?.kinopoisk != null ? `kp:${ids.kinopoisk}` : undefined);
  const param = key ? `w-${key.replace(':', '_')}` : `c-${work.id}`;
  return /^[A-Za-z0-9_-]{1,64}$/.test(param) ? param : undefined;
}

/** Карточка-сообщение для «Поделиться» (06.10): постер, название, строка о произведении и кнопка. */
export interface ShareCard { param: string; title: string; year?: number; kind?: 'film' | 'series' | 'book' | 'character' | 'together'; by?: string; about?: string; image?: string }
export async function prepareShare(card: ShareCard): Promise<string | undefined> {
  // подписи и кнопка в чате — на языке приложения того, кто делится
  return store.onServer ? prepareShareMessage({ ...card, lang: language }).catch(() => undefined) : undefined;
}

/** Карточка по параметру из ссылки «Поделиться»: id, который знает `getWork`, или undefined. */
export async function openShared(param: string): Promise<ID | undefined> {
  await Promise.all([catalog(), workRefs()]);
  const byId = /^c-(.+)$/.exec(param)?.[1];
  const m = /^w-([a-z]+)_(.+)$/.exec(param);
  const all = [...history().map((e) => e.work), ...candidates().map((c) => c.work), ...watchedNow(), ...filmBase, ...filmBaseWiki];
  if (byId) return all.find((w) => w.id === byId)?.id ?? candidateCard(byId)?.id;
  if (!m) return undefined;
  const key = `${m[1]}:${m[2]}`;
  return all.find((w) => {
    const ids = w.externalIds ?? externalIds[w.id];
    return m[1] === 'kp' ? String(ids?.kinopoisk ?? '') === m[2] : workKeys(w, ids).includes(key);
  })?.id;
}

/** Поиск по всему, что мы знаем: каталог, история, пул, просмотренное и справочник фильмов.
 *  Ищем по названию и по оригинальному названию — «Rashomon» и «Расёмон» должны находиться
 *  одинаково. Диакритика и «ё» складываются: иначе «Расемон» не найдёт «Расёмон». */
const searchKey = (s: string) => s.normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase().replace(/ё/g, 'е').trim();

export interface SearchHit { work: WorkCard; watched: boolean; watching?: boolean }

export async function searchWorks(query: string, limit = 40): Promise<SearchHit[]> {
  await delay(140);
  await catalog();
  const q = searchKey(query);
  const watched = new Set(watchedNow().map((w) => w.id));
  const watching = new Set(history().filter((e) => e.status === 'in_progress').map((e) => e.work.id));
  // регистры нужны экрану «мой список» для фильтров — без них фильтровать нечем
  // свой список отдаём целиком: обрезанный на сороковом, он выглядит как потерянные отметки
  if (!q) return watchedNow().map((work) => ({ work: withRegisters(work), watched: true }));
  const seenKey = new Set<string>();
  const hits: { work: WorkCard; rank: number }[] = [];
  for (const work of knownWorks()) {
    const ids = work.externalIds ?? externalIds[work.id];
    // один и тот же фильм лежит и в каталоге, и в справочнике — показываем один раз
    const key = primaryKey(work, ids) ?? work.id;
    if (seenKey.has(key)) continue;
    // и марка кириллицей: «дьявол носит прада» (src/lib/brands.ts)
    const names = [work.title, work.originalTitle, cyrillicBrands(work.title)].filter(Boolean).map((t) => searchKey(t as string));
    // точное совпадение выше начала строки, начало — выше вхождения в середину
    const rank = Math.min(...names.map((n) => (n === q ? 0 : n.startsWith(q) ? 1 : n.includes(q) ? 2 : 9)));
    if (rank === 9) continue;
    seenKey.add(key);
    hits.push({ work, rank });
  }
  hits.sort((a, b) => a.rank - b.rank || (b.work.year ?? 0) - (a.work.year ?? 0));
  return hits.slice(0, limit).map(({ work }) => ({ work: withRegisters(work), watched: watched.has(work.id), watching: watching.has(work.id) }));
}

/** Отметить просмотренным или снять отметку. Бэкенда нет: правка живёт в памяти вкладки
 *  и действует на подбор сразу — отмеченное перестаёт предлагаться на «Сегодня», а вкус
 *  по регистру пересчитывается вместе с ним. */
/** Карточка, пришедшая снаружи, обязана стать карточкой контракта: у неё могли не дожить
 *  обязательные поля (сервер хранил её в другой версии приложения, или запись сделал другой
 *  клиент). Без этого экран, читающий `primaryOperations[0]`, падает целиком — проверено. */
function asCard(raw: Partial<WorkCard> & { id: ID }): WorkCard {
  return {
    type: 'film', title: raw.id, year: 0, creators: [], primaryOperations: [], complexityLevel: 1,
    warnings: [], barriers: [], isNicheMasterpiece: false,
    ...raw,
  } as WorkCard;
}

/** Разложить серверное состояние по структурам слоя данных. Карточку берём с сервера, если
 *  своей не нашлось: человек мог отметить фильм на другом устройстве, где справочник был
 *  другой версии. */
function hydrate(state: StoredState | undefined): void {
  if (!state) return;
  settings = { ...settings, ...state.settings };
  profile = state.profile;
  if (state.profile?.telegram) {
    session = {
      user: { id: state.profile.username ?? 'tg', name: state.profile.firstName ?? state.profile.username ?? '', username: state.profile.username, source: 'telegram' },
      verified: true,
      startedAt: new Date().toISOString(),
    };
  }
  const cardFor = (id: ID, raw?: WorkCard): WorkCard | undefined =>
    (raw ? asCard(raw) : undefined) ?? knownWorks().find((w) => w.id === id);
  for (const row of state.journal ?? []) {
    const work = cardFor(row.work_id, row.work);
    if (!work) continue;
    serverJournal.push({
      id: row.entry_id, work, status: row.status as JourneyStatus,
      ...(row.progress != null ? { progress: row.progress } : {}),
      ...(row.started_at ? { startedAt: row.started_at } : {}),
      ...(row.finished_at ? { finishedAt: row.finished_at } : {}),
      ...(row.eagerness ? { eagerness: row.eagerness as Eagerness } : {}),
      ...(row.inferred ? { inferred: true } : {}),
      ...(row.series?.kind === 'book' ? { bookProgress: (({ kind: _k, ...b }) => b)(row.series) }
        : row.series?.season ? { seriesProgress: row.series } : {}),
      reflections: [], stateChanges: [],
    });
  }
  for (const r of state.ratings ?? []) {
    const work = cardFor(r.workId, r.work);
    if (!work) continue;
    ratings.set(r.workId, { rating: r.rating, ...(r.raw != null ? { raw: r.raw } : {}) });
    ratedCards.set(r.workId, work);
  }
  // сервер отдаёт свежее первым; кладём от старого к новому — watchedNow() развернёт обратно
  for (const row of [...state.watched].reverse()) {
    const declared = baseWatched().some((w) => w.id === row.workId);
    if (row.watched) {
      watchedRemoved.delete(row.workId);
      if (!declared) {
        const work = knownWorks().find((w) => w.id === row.workId) ?? (row.work ? asCard(row.work) : undefined);
        if (work) watchedAdded.set(row.workId, normalizeWork(work));
      }
    } else {
      watchedAdded.delete(row.workId);
      if (declared) watchedRemoved.add(row.workId);
    }
  }
  for (const p of state.predictions) {
    let modelOdds: DifficultyPrediction['modelOdds'];
    try { modelOdds = p.model_p ? JSON.parse(p.model_p) : undefined; } catch { modelOdds = undefined; }
    predictions.set(p.work_id, {
      expected: p.expected as PerceivedDifficulty, ...(p.model ? { model: p.model as PerceivedDifficulty } : {}),
      ...(modelOdds ? { modelOdds } : {}), at: p.at.slice(0, 10),
    });
  }
  for (const v of state.verdicts) linkVerdicts.set(v.url, v.verdict);
  for (const d of state.dismissals ?? []) dismissals.set(d.workId, { reason: d.reason as DismissReason | undefined, at: d.at });
}

export async function setWatched(workId: ID, watched: boolean): Promise<{ ok: true }> {
  await delay(120);
  await catalogFor(workId);
  const declared = baseWatched().some((w) => w.id === workId);
  if (watched) {
    watchedRemoved.delete(workId);
    if (!declared && !watchedAdded.has(workId)) {
      const work = knownWorks().find((w) => w.id === workId);
      if (work) watchedAdded.set(workId, normalizeWork(work));
    }
  } else {
    watchedAdded.delete(workId);
    if (declared) watchedRemoved.add(workId);
  }
  // сервер узнаёт о факте, а не о том, как мы его показали: карточку кладём рядом, чтобы
  // список открылся и там, где наших моков нет
  await store.watched(workId, watched, watchedAdded.get(workId) ?? knownWorks().find((w) => w.id === workId));
  return { ok: true } as const;
}

export async function getMap(): Promise<CognitiveMapData> {
  await delay(260);
  return deriveMap(USER_ID, history(), today(), taste()) ?? mocks.map;
}

export async function getTrajectories(): Promise<Trajectory[]> {
  await delay(220);
  return mocks.trajectories;
}

export async function getTrajectory(id: ID): Promise<Trajectory | undefined> {
  await delay(200);
  return mocks.trajectories.find((t) => t.id === id);
}

export async function createTrajectory(input: { operations?: CognitiveOperation[]; peakWorkId?: ID }): Promise<Trajectory> {
  await delay(480);
  return mocks.trajectories[0];
}

/** Дневник: моки + история из собственного экспорта + импорт в этой сессии; свежее — выше. */
export async function getJourney(status?: JourneyStatus): Promise<JourneyEntryData[]> {
  // у нового человека дневник пуст — без ядра (РР-5)
  if (await newcomer()) return [];
  await delay(220);
  // Дневник не обогащаем на лету: сотня записей — сотни запросов; картинки истории
  // приходят готовыми из генератора (userHistory.ts), каталожные — из catalogMedia.ts.
  return history()
    .filter((e) => !status || e.status === status)
    .sort((a, b) => (b.finishedAt ?? b.startedAt ?? '').localeCompare(a.finishedAt ?? a.startedAt ?? ''))
    // оценка участника — вес для модели, наружу не уходит (правило 4); разборы, наоборот,
    // в архиве самое ценное: просмотр закончен, спойлеров бояться нечего
    .map(({ rating: _rating, raw: _raw, ...e }) => {
      const work = withMedia(e.work);
      const analyses = analysesFor(work);
      return withPrediction({ ...e, work, ...(analyses.length ? { analyses } : {}) });
    });
}

/** Прогнозы, сделанные в этой сессии: ключ — id произведения. В продукте это запись на
 *  сервере в момент старта; здесь живёт до перезагрузки. */
const predictions = new Map<ID, DifficultyPrediction>();

/** Начало просмотра. `expected` — что участник ответил на вопрос «как думаете, как пойдёт?»;
 *  рядом кладём то, чего ждала модель, чтобы потом сверять обоих с тем, как оказалось. */
/** Начать. Кнопки «Начать смотреть» в карточке больше нет (24.09): она выдавала приложение за
 *  кинотеатр и требовала помнить о себе перед просмотром. Старт — либо переход в онлайн-
 *  кинотеатр со страницы «Смотреть» (`inferred`: человек, вероятно, смотрит — потом
 *  переспросим), либо «Смотрю» в поиске и на странице фильма — для просмотра вне приложения. */
export async function startWork(workId: ID, expected?: PerceivedDifficulty, opts: { inferred?: boolean } = {}): Promise<JourneyEntryData | undefined> {
  await delay(180);
  await catalogFor(workId);
  const known = history().find((e) => e.work.id === workId && e.status !== 'finished');
  // из планов в «смотрю»: та же запись — «насколько хотелось» остаётся при ней
  // уже смотрит — второй переход в кинотеатр ничего не меняет (и время старта не сбивает)
  if (known?.status === 'in_progress') return withPrediction(known);
  if (known?.status === 'planned') {
    // history() отдаёт копии — меняем и саму запись в списке, иначе после перезаписи ленты
    // фильм снова оказался бы «в планах»
    const at = new Date().toISOString();
    for (const e of [known, (store.onServer ? serverJournal : imported).find((x) => x.id === known.id)]) {
      if (e) { e.status = 'in_progress'; e.startedAt = at; e.inferred = opts.inferred || undefined; }
    }
  }
  const work = known?.work ?? candidateCard(workId) ?? knownWorks().find((w) => w.id === workId);
  if (!work) return undefined;
  const state = ownState();
  const model = state ? expectedDifficulty(state, work) : undefined;
  const modelOdds = state ? difficultyOdds(state, work) : undefined;
  if (expected) {
    predictions.set(workId, {
      expected, ...(model ? { model } : {}), ...(modelOdds ? { modelOdds } : {}),
      at: new Date().toISOString().slice(0, 10),
    });
  }
  // Запись в дневнике — всегда, а не только когда есть прогноз: без неё нечего спросить
  // «как пошло?», и петля пустая (трек Б3). Прогноз модели кладём и без прогноза человека —
  // сверять модель с фактом можно и так.
  const entry: JourneyEntryData = known ?? {
    id: `j-${workId}-${Date.now().toString(36)}`, work, status: 'in_progress',
    startedAt: new Date().toISOString(), ...(opts.inferred ? { inferred: true } : {}), reflections: [], stateChanges: [],
  };
  if (!known) (store.onServer ? serverJournal : imported).unshift(entry);
  await store.start(workId, work, expected, model, entry.id, modelOdds, opts.inferred);
  return withPrediction(entry);
}

/** Облегчённый учёт (02.10): «посмотрел» — с оценкой в одно касание или без неё, «бросил» — без
 *  расспросов. Под капотом — те же записи, что у подробного дневника: начатое или отложенное
 *  закрывается чек-ином, оценка уходит в модель (`rateWork`), брошенное становится записью
 *  `abandoned` — для подбора по силам это самый ценный сигнал. Просмотренное без оценки и без
 *  записи — «уже видел» (`setWatched`): в подбор не попадёт, но и вкус не уточнит. */
export async function markWork(workId: ID, outcome: { status: 'finished' | 'abandoned'; rating?: 1 | 2 | 3 | 4 | 5 }): Promise<{ rated: number; needed: number; counted: boolean }> {
  await catalogFor(workId);
  // засчиталась ли оценка в порог первой ленты: туда идут только размеченные фильмы (их знает модель)
  const before = ratedCount();
  const result = await markWorkInner(workId, outcome);
  return { ...result, counted: result.rated > before };
}

/** Сколько оценок не хватает до первой ленты (0 — лента есть; без сервера порога нет). */
export async function coldStartLeft(): Promise<number> {
  await delay(0);
  return store.onServer || freshStart ? Math.max(0, MIN_RATED - ratedCount()) : 0;
}

async function markWorkInner(workId: ID, outcome: { status: 'finished' | 'abandoned'; rating?: 1 | 2 | 3 | 4 | 5 }): Promise<{ rated: number; needed: number }> {
  const open = history().find((e) => e.work.id === workId && (e.status === 'in_progress' || e.status === 'planned'));
  if (outcome.status === 'abandoned') {
    const entry = open?.status === 'in_progress' ? open : await startWork(workId);
    if (entry) await checkIn(entry.id, { status: 'abandoned' });
    return { rated: ratedCount(), needed: MIN_RATED };
  }
  if (open) await checkIn(open.id, { status: 'finished', ...(outcome.rating ? { rating: outcome.rating } : {}) });
  if (outcome.rating) return rateWork(workId, outcome.rating);
  if (!open) await setWatched(workId, true);
  return { rated: ratedCount(), needed: MIN_RATED };
}

/** «Ещё не смотрел»: начатое возвращается в планы. `expired` — вопрос остался без ответа;
 *  `undo` — отмена сразу после «Смотрю», в наблюдения не идёт. */
export async function notWatched(entryId: ID, reason: 'not_watched' | 'expired' | 'undo' = 'not_watched'): Promise<void> {
  const list = store.onServer ? serverJournal : imported;
  const entry = list.find((e) => e.id === entryId && e.status === 'in_progress');
  if (!entry) return;
  const before = { status: entry.status, inferred: entry.inferred };
  entry.status = 'planned';
  entry.inferred = undefined;
  try {
    await store.unstart(entryId, entry.work.id, reason);
  } catch (err) {
    Object.assign(entry, before);
    throw err;
  }
}

/** «В планы»: запись дневника planned с «насколько хочется». Возвращает её id — для отмены. */
export async function planWork(workId: ID, eagerness?: Eagerness): Promise<ID | undefined> {
  await catalogFor(workId);
  const existing = history().find((e) => e.work.id === workId && e.status !== 'finished');
  if (existing) return existing.id;
  const work = candidateCard(workId) ?? knownWorks().find((w) => w.id === workId);
  if (!work) return undefined;
  const entry: JourneyEntryData = {
    id: `j-${workId}-${Date.now().toString(36)}`, work, status: 'planned',
    startedAt: new Date().toISOString(), ...(eagerness ? { eagerness } : {}), reflections: [], stateChanges: [],
  };
  const list = store.onServer ? serverJournal : imported;
  list.unshift(entry);
  try {
    await store.plan(entry.id, workId, work, eagerness);
  } catch (err) {
    list.splice(list.indexOf(entry), 1);
    throw err;
  }
  return entry.id;
}

/** Убрать из планов (отмена свайпа или передумал). Начатое так не удалить. */
export async function unplanWork(entryId: ID): Promise<void> {
  const list = store.onServer ? serverJournal : imported;
  const at = list.findIndex((e) => e.id === entryId && e.status === 'planned');
  if (at < 0) return;
  const [entry] = list.splice(at, 1);
  try {
    await store.unplan(entryId);
  } catch (err) {
    list.splice(at, 0, entry);
    throw err;
  }
}

/** Прогноз приезжает в записи дневника: по нему строится сверка после просмотра. */
function withPrediction<T extends JourneyEntryData>(entry: T): T {
  const prediction = entry.prediction ?? predictions.get(entry.work.id);
  return prediction ? { ...entry, prediction } : entry;
}

export async function getReflectionPrompts(entryId: ID): Promise<ReflectionPromptData[]> {
  await delay(180);
  return mocks.reflectionPrompts;
}

/** Сериал (Е3): где я сейчас — сезон и серия у начатого. */
export async function setSeriesProgress(entryId: ID, season: number, episode?: number): Promise<JourneyEntryData | undefined> {
  const entry = [...imported, ...baseJournal()].find((e) => e.id === entryId && e.status === 'in_progress');
  if (!entry || season < 1) return undefined;
  const before = entry.seriesProgress;
  entry.seriesProgress = { season, ...(episode ? { episode } : {}), ...(before?.done ? { done: before.done } : {}) };
  try {
    await store.progress(entryId, entry.work.id, { series: entry.seriesProgress });
  } catch (err) {
    entry.seriesProgress = before;
    throw err;
  }
  return withPrediction({ ...entry });
}

/** Книга (З5): где я сейчас — часть и страница у начатого. */
export async function setBookProgress(entryId: ID, where: { part?: number; page?: number }): Promise<JourneyEntryData | undefined> {
  const entry = [...imported, ...baseJournal()].find((e) => e.id === entryId && e.status === 'in_progress');
  if (!entry || entry.work.type !== 'book') return undefined;
  const before = entry.bookProgress;
  entry.bookProgress = { ...(where.part ? { part: where.part } : {}), ...(where.page ? { page: where.page } : {}), ...(before?.done ? { done: before.done } : {}) };
  try {
    await store.progress(entryId, entry.work.id, { book: entry.bookProgress });
  } catch (err) {
    entry.bookProgress = before;
    throw err;
  }
  return withPrediction({ ...entry });
}

/** Последний ли сезон: сезонов столько, и сериал больше не выходит. */
const lastSeason = (work: WorkCard, season: number): boolean =>
  Boolean(work.series?.seasons && season >= work.series.seasons && work.series.status !== 'running');

export async function checkIn(entryId: ID, request: CheckInRequest): Promise<CheckInResult> {
  await delay(320);
  // Настоящая запись дневника, а не мок сценария: раньше чек-ин уходил на сервер с чужим
  // workId, и петля считала бы не тот фильм (найдено 24.09)
  const entry = [...imported, ...baseJournal()].find((e) => e.id === entryId);
  const result = buildCheckInResult(entryId, request);
  // сериал (Е3): чек-ин после сезона; сериал заканчивается, только если сезон последний
  const season = entry && isSeries(entry.work) ? request.season : undefined;
  const seasonOnly = season != null && request.status === 'finished' && !request.last && !lastSeason(entry!.work, season);
  if (entry && season != null) {
    const done = [...(entry.seriesProgress?.done ?? []).filter((d) => d.season !== season)];
    if (request.status === 'finished') {
      done.push({ season, ...(request.perceivedDifficulty ? { perceived: request.perceivedDifficulty } : {}), at: new Date().toISOString().slice(0, 10) });
    }
    done.sort((a, b) => a.season - b.season);
    // брошенному оставляем серию, на которой остановились; досмотренный сезон её обнуляет
    const episode = request.status === 'abandoned' ? entry.seriesProgress?.episode : undefined;
    entry.seriesProgress = { season: seasonOnly ? season + 1 : season, ...(episode ? { episode } : {}), ...(done.length ? { done } : {}) };
  }
  // книга (З5): чек-ин после части, если человек отмечает части; книга кончается по «дочитал книгу»
  const part = entry && entry.work.type === 'book' ? request.part : undefined;
  const partOnly = part != null && request.status === 'finished' && !request.last;
  if (entry && part != null) {
    const done = [...(entry.bookProgress?.done ?? []).filter((d) => d.part !== part)];
    if (request.status === 'finished') {
      done.push({ part, ...(request.perceivedDifficulty ? { perceived: request.perceivedDifficulty } : {}), at: new Date().toISOString().slice(0, 10) });
    }
    done.sort((a, b) => a.part - b.part);
    // брошенной книге — страница, на которой остановились; дочитанная часть страницу не сбрасывает
    const page = entry.bookProgress?.page;
    entry.bookProgress = { part: partOnly ? part + 1 : part, ...(page ? { page } : {}), ...(done.length ? { done } : {}) };
  }
  if (entry && (seasonOnly || partOnly)) {
    result.entry = withPrediction({ ...entry });
  } else if (entry) {
    entry.status = request.status;
    entry.finishedAt = new Date().toISOString();
    if (request.perceivedDifficulty) entry.perceivedDifficulty = request.perceivedDifficulty;
    if (request.abandonReason) entry.abandonReason = request.abandonReason;
    result.entry = withPrediction({ ...entry });
    const state = ownState();
    if (state) {
      result.newState = state;
      // «что дальше» — из настоящего подбора, а не из сценария с книгой (найдено 24.09)
      const next = recommend(state, candidates(), settings.energy ?? 'normal', 1, today(), { seriesNovice: seriesNovice() })[0];
      if (next) result.nextRecommendation = next;
    }
  }
  await store.checkIn(entryId, entry?.work.id ?? result.entry.work.id, {
    // досмотрен сезон, а не сериал: запись остаётся «смотрю», в петле это не «досмотрел»
    status: seasonOnly ? 'season_finished' : partOnly ? 'part_finished' : request.status,
    ...(entry?.bookProgress && entry.work.type === 'book' ? { book: entry.bookProgress } : entry?.seriesProgress ? { series: entry.seriesProgress } : {}),
    perceived: request.perceivedDifficulty,
    reason: request.abandonReason,
    // МА-1/МА-2: уровень досмотренного и «стоило ли» (ДФ-10)
    ...workMeta(entry ? annotated(entry.work) : undefined),
    ...(request.worth ? { worth: request.worth, ...(request.worthWhy ? { worthWhy: request.worthWhy } : {}) } : {}),
    payload: request,
  });
  return result;
}

export async function startAssessment(mode: AssessmentMode): Promise<AssessmentSession> {
  await delay(260);
  const id = `as-${mode}-${sessions.size + 1}`;
  sessions.set(id, { mode, answered: 0 });
  return sessionView(id)!;
}

/** Сверх §17: текущее состояние сессии по id — экран /assessment/:id открывается и по
 *  прямой ссылке, и после паузы. */
export async function getAssessment(id: ID): Promise<AssessmentSession | undefined> {
  await delay(200);
  return sessionView(id);
}

/** `null` — задание пропущено. */
export async function answerAssessment(id: ID, itemId: ID, response: AssessmentAnswer | null): Promise<AssessmentSession> {
  await delay(160);
  const s = sessions.get(id);
  if (!s) throw new Error('no session');
  if (s.answered < mocks.assessmentItems.length && mocks.assessmentItems[s.answered].id === itemId) s.answered += 1;
  s.paused = false;
  return sessionView(id)!;
}

/** Сверх §17: пауза — на сервере, чтобы сессия пережила закрытие мини-приложения. */
export async function pauseAssessment(id: ID): Promise<AssessmentSession | undefined> {
  await delay(120);
  const s = sessions.get(id);
  if (s) s.paused = true;
  return sessionView(id);
}

/** Карта по итогам: для контрольной точки — с новой точкой истории (причина «checkpoint»). */
export async function completeAssessment(id: ID): Promise<CognitiveMapData> {
  await delay(400);
  const s = sessions.get(id);
  if (!s?.checkpoint) return mocks.map;
  const last = mocks.map.history[mocks.map.history.length - 1];
  const asOf = new Date().toISOString().slice(0, 10);
  // повтор заданий сузил диапазон у двух операций — уточнение, не рост
  const narrowed = new Set<CognitiveOperation>(['perspective_taking', 'metacognition']);
  const operations = last.operations.map((o) => (narrowed.has(o.op)
    ? { ...o, range: [o.range[0] + 0.4, o.range[1] - 0.4] as [number, number] }
    : o));
  return {
    ...mocks.map,
    state: {
      ...mocks.map.state, asOf, source: 'checkpoint',
      operations: mocks.map.state.operations.map((o) => (narrowed.has(o.op)
        ? { ...o, range: [o.range[0] + 0.4, o.range[1] - 0.4] as [number, number] }
        : o)),
    },
    history: [...mocks.map.history, {
      asOf, operations,
      cause: { kind: 'checkpoint', label: 'Контрольная точка', changeType: 'refined_estimate' },
    }],
  };
}

// Настройки в моке живут в памяти: экран «Профиль» меняет их, остальные экраны видят.
// заполняется при загрузке core (mocks.settings) и поверх — с сервера
let settings: UserSettings = {} as UserSettings;
/** Разбор на языке, который участник выбрал в настройках (`materialLanguages`, по умолчанию
 *  только русский). Вес обсуждения в рейтинге (`weightsByKey`) язык не учитывает: это сигнал
 *  о произведении, а не то, что показываем. */
const shownLanguage = (a: ExternalAnalysis): boolean => (settings.materialLanguages ?? ['ru']).includes(a.language === 'en' ? 'en' : 'ru');

/** Категория участника (ТВ-3в, 06.10): админ (владелец) — всё; тестер — все полки, без статистики и
 *  механики; участник — полки по доле выката. Без сервера в разработке — админ: превью показывает всё. */
export type Role = 'admin' | 'tester' | 'user';
export function sessionRole(): Role {
  if (profile?.role) return profile.role;
  if (profile?.owner) return 'admin';
  return !store.onServer && import.meta.env.DEV ? 'admin' : 'user';
}
/** Механика (карта операций, уровни, прогноз) — данные трансформативного обучения, только админу:
 *  остальным переключатель выключен, что бы ни лежало в сохранённых настройках. */
const visibleSettings = (s: UserSettings): UserSettings => (sessionRole() === 'admin' ? s : { ...s, showDetails: false });

export async function getSettings(): Promise<UserSettings> {
  // новому человеку — настройки из профиля, пока ядро едет (РР-5); после `ready` — как всегда: правки этой вкладки главнее
  const fresh = readyDone ? undefined : await newcomer();
  if (fresh) return visibleSettings({ ...settings, ...fresh });
  await delay(140);
  return visibleSettings(settings);
}

export async function updateSettings(patch: Partial<UserSettings>): Promise<UserSettings> {
  await delay(160);
  settings = { ...settings, ...patch };
  await store.settings(patch);
  return visibleSettings(settings);
}

/** Тестеры (ТВ-3в): список ведёт админ в настройках. Без сервера — пусто. */
export interface Tester { username: string; at: string }
// ─── подписки на разборы (06.10) ─────────────────────────────────────────────
/** Подписка: герой — элемент Wikidata; произведение — ключ разборов и все ключи карточки. */
export type FollowTarget = { kind: 'work'; ref: string; keys: string[]; title: string } | { kind: 'character'; ref: string; title: string };
export type Follow = FollowRow;
/** Следить можно только на сервере: сводку присылает бот. */
export const followsAvailable = (): boolean => store.onServer;
let followList: Promise<Follow[]> | undefined;
const followListeners = new Set<(list: Follow[]) => void>();
export function getFollows(): Promise<Follow[]> {
  followList ??= fetchFollows().then((r) => r?.follows ?? []).catch(() => { followList = undefined; return []; });
  return followList;
}
export function onFollowsChange(fn: (list: Follow[]) => void): () => void {
  followListeners.add(fn);
  return () => { followListeners.delete(fn); };
}
/** Подписаться или отписаться; для отписки хватает вида и ссылки — строка из списка подписок подходит. */
export async function setFollow(t: FollowTarget | Follow, on: boolean): Promise<Follow[]> {
  const r = await fetchFollows({ kind: t.kind, ref: t.ref, title: t.title, ...('keys' in t ? { keys: t.keys } : {}), on });
  const list = r?.follows ?? [];
  followList = Promise.resolve(list);
  for (const fn of followListeners) fn(list);
  return list;
}
/** Подписка на произведение: ключи, по которым к карточке приходят разборы. */
export function followOfWork(work: WorkCard): FollowTarget | undefined {
  const keys = workKeys(work, work.externalIds ?? externalIds[work.id]).filter((k) => /^[a-z]{2,10}:[A-Za-z0-9_.-]{1,40}$/.test(k));
  return keys.length ? { kind: 'work', ref: keys[0], keys, title: work.title } : undefined;
}

export async function getTesters(): Promise<Tester[]> {
  return (await fetchTesters())?.testers ?? [];
}
export async function setTester(username: string, on: boolean): Promise<Tester[]> {
  return (await fetchTesters({ username, on }))?.testers ?? [];
}

/** Решения куратора в сессии: статус поверх мока. Самое неуверенное — первым. */
const reviewed = new Map<ID, AnnotationStatus>();
const CONF_ORDER: Record<Confidence, number> = { low: 0, medium: 1, high: 2 };
const queueItem = (i: AnnotationReviewItem): AnnotationReviewItem => ({
  ...i, status: reviewed.get(i.annotationId) ?? reviewMarks()[i.annotationId]?.status ?? i.status, signals: curator.signals[i.annotationId],
});

// ---------- поток проверки черновой разметки (трек Г3) ----------
// Очередь кураторской собирается из настоящих черновиков: разметка фильмов из списка первых
// оценок (draftAnnotations.ts, ключ — фильм) и первичная разметка истории владельца
// (userAnnotations.ts). Порядок — сначала фильмы колоды /rate (их оценивают новые люди первыми),
// потом самое неуверенное. Поток — по 20 в день: «Сегодня» показывает решённое за сегодня и
// столько нерешённых, чтобы вместе вышло 20.
// Решения живут в браузере куратора (localStorage) поверх draftReview.ts — того, что уже
// приехало со сборкой; «Скачать решения» → tools/apply-review.mts → draftReview.ts.
export const REVIEW_DAILY = 20;
const REVIEW_KEY = 'tm.review';
let localMarks: Record<string, ReviewMark> | undefined;
function reviewMarks(): Record<string, ReviewMark> {
  if (!localMarks) {
    try { localMarks = JSON.parse(localStorage.getItem(REVIEW_KEY) ?? '{}') as Record<string, ReviewMark>; } catch { localMarks = {}; }
  }
  return { ...draftReview, ...localMarks };
}
function markReview(id: ID, status: ReviewMark['status']): void {
  reviewMarks();
  localMarks = { ...localMarks, [id]: { status, at: new Date().toISOString() } };
  try { localStorage.setItem(REVIEW_KEY, JSON.stringify(localMarks)); } catch { /* приватное окно — решение живёт до перезагрузки */ }
  ownByTmdb = undefined;   // отклонённая первичная разметка больше не в счёт
}
const localDay = (iso: string): string => new Date(iso).toLocaleDateString('sv');   // ГГГГ-ММ-ДД по местному времени

// Сигналы петли по черновику: work_id из отчёта → id аннотации через карточку и её TMDb.
// Только владельцу и только с сервером; отчёт перечитывается не чаще раза в пять минут.
let loopSignals: Map<ID, WorkSignal> | undefined;
let loopSignalsAt = 0;
async function loadLoopSignals(): Promise<void> {
  if (!store.onServer || !profile?.owner || Date.now() - loopSignalsAt < 300e3) return;
  loopSignalsAt = Date.now();
  const report = await fetchLoopReport('all').catch(() => undefined) as LoopReportData | undefined;
  if (!report?.byWork) return;
  const cards = new Map(knownWorks().map((w) => [w.id, w]));
  const map = new Map<ID, WorkSignal>();
  for (const [workId, s] of Object.entries(report.byWork)) {
    if (!s.score) continue;
    const w = cards.get(workId);
    const tmdb = w && (w.externalIds ?? externalIds[w.id])?.tmdb;
    const id = userAnnotations[workId] ? `own:${workId}` : tmdb != null && draftAnnotations[`tmdb:${tmdb}`] ? `draft:tmdb:${tmdb}` : undefined;
    if (!id) continue;
    const prev = map.get(id);
    map.set(id, prev ? Object.fromEntries(Object.keys(s).map((k) => [k, (prev as never)[k] + (s as never)[k]])) as unknown as WorkSignal : s);
  }
  loopSignals = map;
}
const loopText = (s: WorkSignal | undefined): string | undefined => {
  if (!s?.score) return undefined;
  const parts = [
    s.harder ? ui.curator.loopHarder(s.harder) : '', s.easier ? ui.curator.loopEasier(s.easier) : '',
    s.abandonFit ? ui.curator.loopAbandon(s.abandonFit) : '', s.dismissFit ? ui.curator.loopDismiss(s.dismissFit) : '',
  ].filter(Boolean);
  return `${parts.join(' · ')} (${ui.curator.loopChecks(s.checks)})`;
};

interface DraftSource { id: ID; key?: string; annotation: FirstPassAnnotation; work: WorkCard; own: boolean;
  /** сериал (Е2): сезон антологии — отдельная единица проверки; поправки сезонов обычного сериала */
  season?: number; seasons?: SeriesDraft['seasons'] }
/** Все черновики с карточками, в порядке проверки. */
function draftSources(ordered = true): DraftSource[] {
  const cards = new Map<string, WorkCard>();
  for (const w of [...userWorks, ...filmBase, ...filmBaseWiki, ...watchedWorks]) {
    const t = (w.externalIds ?? externalIds[w.id])?.tmdb;
    if (t != null && !isSeries(w) && !cards.has(`tmdb:${t}`)) cards.set(`tmdb:${t}`, w);
  }
  const deckOrder = new Map<string, number>();
  if (ordered) ratingDeck.forEach((id, i) => {
    const w = deckCard(id);
    const t = w && (w.externalIds ?? externalIds[w.id])?.tmdb;
    if (t != null && !deckOrder.has(`tmdb:${t}`)) deckOrder.set(`tmdb:${t}`, i);
    deckOrder.set(`own:${id}`, deckOrder.get(`own:${id}`) ?? i);
  });
  const out: DraftSource[] = [];
  for (const [key, annotation] of Object.entries(draftAnnotations)) {
    const work = cards.get(key);
    if (work) out.push({ id: `draft:${key}`, key, annotation, work, own: false });
  }
  // сериалы (Е2): карточка — по ключу `imdb:`; у антологии проверяется каждый сезон
  const seriesCards = new Map<string, WorkCard>();
  for (const w of [...watchedWorks, ...filmBaseWiki, ...userWorks]) {
    const k = isSeries(w) ? workKey(w, w.externalIds ?? externalIds[w.id]) : undefined;
    if (k && !seriesCards.has(k)) seriesCards.set(k, w);
  }
  for (const [key, d] of Object.entries(seriesAnnotations)) {
    const work = seriesCards.get(key);
    if (!work) continue;
    if (d.anthology && d.seasons) {
      for (const [n, season] of Object.entries(d.seasons)) {
        out.push({ id: `draft:${key}#s${n}`, key, annotation: season, work, own: false, season: Number(n) });
      }
    } else out.push({ id: `draft:${key}`, key, annotation: d, work, own: false, ...(d.seasons ? { seasons: d.seasons } : {}) });
  }
  for (const w of userWorks) {
    const annotation = userAnnotations[w.id];
    if (annotation) out.push({ id: `own:${w.id}`, annotation, work: w, own: true });
  }
  if (!ordered) return out;
  const signal = (d: DraftSource) => loopSignals?.get(d.id)?.score ?? 0;
  const rank = (d: DraftSource) => deckOrder.get(d.key ?? '') ?? deckOrder.get(`own:${d.work.id}`) ?? Number.POSITIVE_INFINITY;
  // сначала те, где люди разошлись с разметкой (петля, byWork), потом колода, потом неуверенное
  return out.sort((a, b) => signal(b) - signal(a) || rank(a) - rank(b) || CONF_ORDER[a.annotation.confidence] - CONF_ORDER[b.annotation.confidence]
    || Number(a.own) - Number(b.own));
}
function draftItem(d: DraftSource): AnnotationReviewItem {
  const low = d.annotation.confidence === 'low';
  return {
    annotationId: d.id,
    work: { id: d.work.id, type: d.work.type, title: d.season ? ui.curator.seasonOf(d.work.title, d.season) : d.work.title,
      year: d.season ? (d.seasons?.[d.season]?.year ?? (d.annotation as SeasonDraft).year ?? d.work.year) : d.work.year, creators: d.work.creators ?? [] },
    status: reviewMarks()[d.id]?.status ?? 'needs_review',
    tmdfVersion: draftMeta?.tmdfVersion ?? '0.3.1',
    provider: draftMeta?.provider ?? 'anthropic_api',
    model: draftMeta?.model ?? '',
    modelTier: 'heavy',
    overallConfidence: d.annotation.confidence,
    lowConfidenceFields: low ? ['level', 'operations'] : [],
    validationErrors: [],
    knowledgeSufficiency: low ? 'partial' : 'sufficient',
    usage: { inputTokens: 0, outputTokens: 0, durationMs: 0, costUsd: 0 },
    isGold: false,
    createdAt: draftMeta?.createdAt ?? today(),
    ...(loopSignals?.get(d.id)?.score ? { loop: loopText(loopSignals.get(d.id)), loopScore: loopSignals.get(d.id)!.score } : {}),
  };
}
const allQueueItems = (): AnnotationReviewItem[] => [...draftSources().map(draftItem), ...mocks.curatorQueue.map(queueItem)];

/** Сегодняшняя порция: решённое сегодня (по времени решения) и нерешённые до 20. */
function todayBatch(items: AnnotationReviewItem[]): AnnotationReviewItem[] {
  const marks = reviewMarks();
  const day = localDay(new Date().toISOString());
  const decided = items.filter((i) => marks[i.annotationId] && localDay(marks[i.annotationId].at) === day);
  const open = items.filter((i) => i.status === 'needs_review').slice(0, Math.max(0, REVIEW_DAILY - decided.length));
  return [...open, ...decided];
}

export interface ReviewProgress { today: number; daily: number; left: number; approved: number; rejected: number }
export async function getReviewProgress(): Promise<ReviewProgress> {
  await ready;
  await catalog();
  await curatorRefs();
  const marks = reviewMarks();
  const day = localDay(new Date().toISOString());
  const drafts = draftSources();
  const status = (id: ID) => marks[id]?.status;
  return {
    today: Object.values(marks).filter((m) => localDay(m.at) === day).length,
    daily: REVIEW_DAILY,
    left: drafts.filter((d) => !status(d.id)).length,
    approved: drafts.filter((d) => status(d.id) === 'approved').length,
    rejected: drafts.filter((d) => status(d.id) === 'rejected').length,
  };
}

export async function getCuratorQueue(filters?: { status?: AnnotationStatus; provider?: AnnotationProvider; today?: boolean }): Promise<AnnotationReviewItem[]> {
  await delay(260);
  await catalog();
  await curatorRefs();
  await loadLoopSignals();
  const items = allQueueItems()
    .filter((i) => (!filters?.status || i.status === filters.status) && (!filters?.provider || i.provider === filters.provider));
  // порядок черновиков — порядок проверки (колода, неуверенное); у старых моков — по уверенности
  return filters?.today ? todayBatch(items) : items;
}

/** Следующая нерешённая в сегодняшней порции — после решения ревью сразу открывает её. */
export async function nextInBatch(): Promise<ID | undefined> {
  const batch = await getCuratorQueue({ today: true });
  return batch.find((i) => i.status === 'needs_review')?.annotationId;
}

export async function getAnnotation(id: ID): Promise<AnnotationReviewItem | undefined> {
  await delay(200);
  await catalog();
  await curatorRefs();
  await loadLoopSignals();
  return allQueueItems().find((i) => i.annotationId === id);
}

/** Сверх §17 (22.09): решение по аннотации, разница черновика и публикации, таксономия,
 *  прогоны, качество и потолок — данные кураторских экранов, у которых эндпоинтов не было. */
export async function reviewAnnotation(id: ID, decision: 'approve' | 'reject'): Promise<AnnotationReviewItem | undefined> {
  await delay(240);
  await catalog();
  await curatorRefs();
  const status = decision === 'approve' ? 'approved' : 'rejected';
  if (id.startsWith('draft:') || id.startsWith('own:')) {
    if (!draftSources().some((d) => d.id === id)) return undefined;
    markReview(id, status);
    return allQueueItems().find((i) => i.annotationId === id);
  }
  const item = mocks.curatorQueue.find((i) => i.annotationId === id);
  if (!item) return undefined;
  reviewed.set(id, status);
  return queueItem(item);
}

/** Решения по черновикам — файлом для tools/apply-review.mts. */
export async function exportReviewDecisions(): Promise<{ file: string; count: number }> {
  const marks = reviewMarks();
  const own = Object.fromEntries(Object.entries(marks).filter(([id]) => id.startsWith('draft:') || id.startsWith('own:')));
  return { file: JSON.stringify({ exportedAt: new Date().toISOString(), decisions: own }, null, 1), count: Object.keys(own).length };
}

export async function getAnnotationDiff(id: ID): Promise<AnnotationDiffRow[]> {
  await delay(180);
  await catalog();
  await curatorRefs();
  const d = draftSources().find((x) => x.id === id);
  if (d) {
    const a = d.annotation;
    const conf = a.confidence;
    const opName = (op: CognitiveOperation) => ui.operations[op]?.short ?? op;
    return [
      { path: ui.curator.draftFields.what, draft: a.what, current: null, confidence: conf },
      { path: ui.curator.draftFields.level, draft: String(a.level), current: null, confidence: conf },
      { path: ui.curator.draftFields.ops, draft: a.ops.map(([op, x]) => `${opName(op)} ${x.toFixed(1)}`).join(', '), current: null, confidence: conf },
      { path: ui.curator.draftFields.barriers, draft: a.barriers.join(', ') || '—', current: null },
      { path: ui.curator.draftFields.warnings, draft: a.warnings.join(', ') || '—', current: null },
      { path: ui.curator.draftFields.niche, draft: a.niche ? ui.curator.draftFields.yes : ui.curator.draftFields.no, current: null },
      // поправки сезонов обычного сериала (Е2): что в сезоне иначе, чем в сериале
      ...Object.entries(d.seasons ?? {}).map(([n, x]) => ({
        path: ui.curator.draftFields.season(Number(n)), draft: `${ui.curator.draftFields.level.toLowerCase()} ${x.level} · ${x.what}`, current: null, confidence: x.confidence,
      })),
    ];
  }
  const item = mocks.curatorQueue.find((i) => i.annotationId === id);
  // Без готовой разницы — по неуверенным полям: значение черновика неизвестно, публикации нет.
  return curator.diffs[id] ?? (item?.lowConfidenceFields ?? []).map((path) => ({ path, draft: '…', current: null, confidence: 'low' as const }));
}

export async function getTaxonomy(): Promise<TropeTreeNode[]> {
  await delay(200);
  await curatorRefs();
  return curator.taxonomy;
}

export async function getRuns(): Promise<AnnotationRun[]> {
  await delay(200);
  await curatorRefs();
  return curator.runs;
}

export async function getQualityMetrics(): Promise<QualityMetric[]> {
  await delay(220);
  await curatorRefs();
  return curator.qualityMetrics;
}

export async function getAgreementCeiling(): Promise<AgreementCeilingData> {
  await delay(160);
  await curatorRefs();
  return curator.ceiling;
}

export async function getContributorReliability(): Promise<Record<ID, string>> {
  await delay(160);
  await curatorRefs();
  return curator.reliability;
}

export async function exportAnnotationPacket(input: { workIds: ID[]; layers: string[] }): Promise<{ packetId: string }> {
  await delay(520);
  return { packetId: mocks.packetReport.packetId };
}

export async function importAnnotationResults(packetId: ID, files: unknown[]): Promise<PacketReport> {
  await delay(520);
  return mocks.packetReport;
}

export async function getGoldSet(): Promise<AnnotationReviewItem[]> {
  await delay(200);
  return mocks.curatorQueue.filter((i) => i.isGold);
}

export async function getEvaluation(): Promise<AgreementReport[]> {
  await delay(240);
  return mocks.agreement;
}

export async function getContributors(): Promise<ContributorProfile[]> {
  await delay(200);
  return mocks.contributors;
}

export async function getAgreement(): Promise<AgreementReport[]> {
  await delay(240);
  return mocks.agreement;
}

export async function getTvTropesMappings(): Promise<TvTropesMapping[]> {
  await delay(220);
  return tvTropesMappings;
}

/** Кандидаты в источники: кого репостят и на кого ссылаются каналы, которые мы уже читаем.
 *  Собрано из выгрузок Telegram генератором; человеком не подтверждено. */
export async function getSourceCandidates(): Promise<SourceCandidate[]> {
  await delay(200);
  await curatorRefs();
  return sourceCandidates;
}

/** Разобранные в сессии задания уходят из ленты; «только моё» — по истории участника. */
const doneTasks = new Set<ID>();
// профиль участника-эксперта — из моков, когда они загрузятся (см. loadCore)
let contributor!: ContributorProfile;

export async function getContributorTasks(filter?: { kind?: ContributorTaskKind; onlyMine?: boolean }): Promise<ContributorTask[]> {
  await delay(220);
  await Promise.all([catalog(), curatorRefs()]);
  const keys = filter?.onlyMine ? seenKeys() : null;
  const mine = (t: ContributorTask) => {
    const p = t.payload;
    return p.kind === 'pairwise' ? seen(p.left, keys!) || seen(p.right, keys!) : seen(p.work, keys!);
  };
  // Задания на проверку автонайденных разборов идут первыми: они дешёвые и их видно в карточке
  // свои — история, каталог, пул и присланный список; справочник уходит в хвост очереди
  const ownIds = new Set([
    ...history().map((e) => e.work.id), ...Object.keys(mocks.works),
    ...candidateSeeds.map((c) => c.id), ...watchedNow().map((w) => w.id),
  ]);
  const link = linkCheckTasks(worksByAnalysisKey(), ownIds, [essaysAuto, postsAuto]).filter((t) => {
    const p = t.payload;
    return p.kind === 'link_check' && !linkVerdicts.has(p.analysis.url);
  });
  return [...link, ...mocks.contributorTasks]
    .filter((t) => !doneTasks.has(t.id))
    .filter((t) => !filter?.kind || t.kind === filter.kind)
    .filter((t) => !keys || mine(t));
}

export async function submitContributorAnswer(taskId: ID, answer: ContributorAnswer): Promise<{ ok: true }> {
  await delay(180);
  await Promise.all([catalog(), curatorRefs()]);
  let task: ContributorTask | undefined = mocks.contributorTasks.find((t) => t.id === taskId);
  if (answer.kind === 'link_check') {
    task = linkCheckTasks(worksByAnalysisKey(), undefined, [essaysAuto, postsAuto]).find((t) => t.id === taskId);
    const p = task?.payload;
    // вердикт применяется сразу: в карточке разбор либо теряет пометку «не проверено», либо уходит
    if (p?.kind === 'link_check') {
      linkVerdicts.set(p.analysis.url, answer.verdict);
      await store.verdict(p.analysis.url, p.work.id, answer.verdict);
    }
  }
  if (task && !doneTasks.has(taskId)) {
    doneTasks.add(taskId);
    const c = contributor.contribution;
    contributor = { ...contributor, contribution: { ...c, tasksCompleted: c.tasksCompleted + 1, worksCovered: c.worksCovered + 1 } };
  }
  return { ok: true } as const;
}

/** Кого называют рядом: ключ тот же, что у разборов (у фильма TMDb, у книги ISBN).
 *  Себя из списка убираем — одна и та же карточка приходит и своим ключом, и чужим. */
function nearbyFor(work: WorkCard): CoMention[] {
  // все ключи: у книги — произведение и старые `isbn:` (З1)
  const keys = workKeys(work, work.externalIds ?? externalIds[work.id]);
  const self = new Set(keys);
  return keys.flatMap((k) => comentions[k] ?? []).filter((c) => !self.has(c.key));
}

/** Темп речи и тишины: замер по субтитрам, ключ тот же, что у разборов. Есть только у
 *  фильмов и только у тех, что нашлись в корпусе (889 из 1030). */
function formFor(work: WorkCard): FilmForm | undefined {
  if (!isFilm(work)) return undefined;
  const tmdb = (work.externalIds ?? externalIds[work.id])?.tmdb;
  return tmdb != null ? filmForm[`tmdb:${tmdb}`] : undefined;
}

/** Кому приписывают те же теги. Себя из списка убираем на всякий случай — ключ у карточки
 *  и у соседа один и тот же формат. */
function tagsFor(work: WorkCard): TagNeighbour[] {
  if (!isFilm(work)) return [];
  const tmdb = (work.externalIds ?? externalIds[work.id])?.tmdb;
  if (tmdb == null) return [];
  const key = `tmdb:${tmdb}`;
  return (tagNeighbours[key] ?? []).filter((t) => t.key !== key);
}

/** Приёмы, отмеченные на TV Tropes: есть у 289 фильмов из 1030. Те, что уже разобраны
 *  руками в `tropeInsights`, из списка убираем — иначе один приём стоит в карточке дважды,
 *  и во второй раз без объяснения, как он тут работает. */
function tropesFor(work: WorkCard): TropeMention[] {
  if (!isFilm(work)) return [];
  const tmdb = (work.externalIds ?? externalIds[work.id])?.tmdb;
  if (tmdb == null) return [];
  const already = new Set((workDetail(work.id)?.tropeInsights ?? []).map((t) => t.name.toLowerCase()));
  return (filmTropes[`tmdb:${tmdb}`] ?? []).filter((t) => !already.has(t.name.toLowerCase()));
}

/** Разборы произведения: те, что в деталях мока, плюс присланные владельцем ролики. Ключ у
 *  роликов — TMDb ID фильма: одна и та же «Матрица» в истории, каталоге и пуле имеет разные
 *  ID карточки, а разбор у неё общий. */
function analysesFor(work: WorkCard, detail?: ExternalAnalysis[]): ExternalAnalysis[] {
  // ключи разбора: у фильма — TMDb, у книги — ISBN. ISBN у книги не один (издания разные,
  // а разбор один), поэтому ищем по всем, какие у карточки есть
  const keys = workKeys(work, work.externalIds ?? externalIds[work.id]);
  const pick = (src: Record<string, ExternalAnalysis[]>) => keys.flatMap((k) => src[k] ?? []);
  // сначала подтверждённое (прислано владельцем, размечено), потом найденное по названию;
  // на найденное накладывается вердикт участника: «про другое» — вон, «про это» — снимаем
  // пометку «не проверено» (в моке вердикт живёт до перезагрузки, в продукте — на сервере)
  const auto = [...pick(essaysAuto), ...pick(postsAuto)]
    .map((a) => ({ a, verdict: linkVerdicts.get(a.url) }))
    .filter(({ verdict }) => verdict !== 'other_work')
    .map(({ a, verdict }) => (verdict === 'about_this' ? { ...a, unverified: undefined } : a));
  const extra = [...pick(essays), ...auto];
  // канал анонсирует свой же ролик его заголовком — в карточке это один и тот же разбор
  // на двух площадках; оставляем первый (подтверждённый ролик идёт раньше поста)
  const norm = (t: string) => t.toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9]+/g, ' ').trim();
  const haveUrl = new Set((detail ?? []).map((a) => a.url));
  const haveTitle = new Set((detail ?? []).map((a) => norm(a.title)));
  const out: ExternalAnalysis[] = [...(detail ?? [])];
  attachLenses(out, essayLenses);
  attachSpoilers(out);
  for (const a of extra) {
    if (haveUrl.has(a.url) || haveTitle.has(norm(a.title))) continue;
    haveUrl.add(a.url);
    haveTitle.add(norm(a.title));
    out.push(a);
  }
  return out.filter(shownLanguage);
}

/** Все разборы одного автора по фильмам, которые мы знаем. Собирается из тех же трёх
 *  источников, что и разборы в карточке, и по тем же правилам: вердикт «про другое» убирает
 *  привязку, «про это» снимает пометку «не проверено». */
export interface VoiceWorks {
  voice: Voice;
  items: { work: WorkCard; analyses: ExternalAnalysis[] }[];
  /** о чём говорит (профиль канала, 02.10): вселенные и люди с долей, по всем каналам автора */
  profile?: { n: number; top: { id: string; kind: 'universe' | 'person'; title: string; share: number; focus: boolean }[] };
}

export async function getVoiceWorks(voiceId: string): Promise<VoiceWorks | undefined> {
  await delay(220);
  await catalog();
  const voice = knownVoice(voiceId);
  if (!voice) return undefined;
  const works = worksByAnalysisKey();
  const byKey = new Map<string, { work: WorkCard; analyses: ExternalAnalysis[] }>();
  for (const src of [essays, essaysAuto, postsAuto]) {
    for (const [key, list] of Object.entries(src)) {
      const work = works.get(key);
      if (!work) continue;
      for (const a of list) {
        if (voiceOf(a).id !== voiceId) continue;
        const verdict = linkVerdicts.get(a.url);
        if (verdict === 'other_work') continue;
        const item = byKey.get(key) ?? { work, analyses: [] };
        if (item.analyses.some((x) => x.url === a.url)) continue;
        item.analyses.push(verdict === 'about_this' ? { ...a, unverified: undefined } : a);
        byKey.set(key, item);
      }
    }
  }
  const stamp = (a: ExternalAnalysis) => (a.publishedAt ? Date.parse(a.publishedAt) : 0);
  const items = [...byKey.values()]
    .map((i) => ({ ...i, work: withMedia(i.work), analyses: [...i.analyses].sort((x, y) => stamp(y) - stamp(x)) }))
    .sort((a, b) => stamp(b.analyses[0]) - stamp(a.analyses[0]));
  // обложки (ТВ-10): свои — всем, недостающие у TMDb — первым сорока, что видны сразу; у
  // эссеиста бывают сотни разборов, и спрашивать про каждый незачем
  const head = await pictured(items.slice(0, 40).map((i) => i.work), { bare: true });
  head.forEach((w, n) => { items[n].work = w; });
  // профиль по всем каналам автора: доли складываются с весом объёма канала
  const authors = new Set(items.flatMap((i) => i.analyses.map((a) => a.author)));
  const { channelProfiles } = await import('@/mocks/channelProfiles');
  const parts = [...authors].map((a) => channelProfiles[a]).filter(Boolean);
  let profile: VoiceWorks['profile'];
  if (parts.length) {
    const n = parts.reduce((s, p) => s + p.n, 0);
    const acc = new Map<string, { id: string; kind: 'universe' | 'person'; title: string; share: number; focus: boolean }>();
    for (const p of parts) for (const t of p.top) {
      const x = acc.get(t.id) ?? { ...t, share: 0, focus: false };
      x.share += (t.share * p.n) / n;
      x.focus ||= p.focus.includes(t.id);
      acc.set(t.id, x);
    }
    const top = [...acc.values()].filter((x) => x.share >= 0.08).sort((a, b) => b.share - a.share).slice(0, 6);
    if (top.length) profile = { n: Math.round(n), top };
  }
  return { voice, items, ...(profile ? { profile } : {}) };
}

/** Страница автора-создателя (Д3): режиссёр, сценарист, шоураннер, писатель. Не путать с
 *  `/voice/:id` — там эссеист, который разбирает. */
export interface PersonPage {
  person: Person;
  /** лицо и пара слов (06.10, tools/resolve-people-info.mts): фото Commons, описание, годы жизни */
  info?: { image?: string; description?: string; born?: number; died?: number };
  /** есть элемент Wikidata — иначе человек опознан только по имени в карточках */
  wikidata: boolean;
  roles: CreditRole[];
  works: { work: WorkCard; roles: CreditRole[]; analyses: number; seen: boolean }[];
  /** разборы эссеистов о его работах — свежие первыми, обзоры не показываем (решение 29.09) */
  analyses: { work: WorkCard; analysis: ExternalAnalysis; seen: boolean }[];
  /** ролики о нём самом и его творчестве целиком — по решениям разметки (02.10) */
  about: ExternalAnalysis[];
  /** с чего начать: непросмотренное с разметкой — ближе всего к «чуть выше привычного»
   *  (`near`), а без состояния — самый доступный вход (`entry`) */
  startWith?: { work: WorkCard; why: 'near' | 'entry'; level: number };
  trajectories: { id: ID; title: string }[];
  /** почерк (14.10, tools/person-wave.mts): строка о его вещах, обычный диапазон уровня, типичные барьеры */
  style?: { what: string; lo: number; hi: number; barriers: string[] };
}

// лицо и пара слов об авторе — отдельным куском: 270 КБ нужны только странице автора
let peopleInfoCache: Promise<Record<string, { img?: string; d?: string; b?: number; x?: number }>> | undefined;
const peopleInfoLoad = () => (peopleInfoCache ??= import('@/mocks/peopleInfo').then((m) => m.peopleInfo).catch(() => ({} as Record<string, never>)));
let personStylesCache: Promise<Record<string, { lo: number; hi: number; barriers: string[]; what: string; confidence: string }>> | undefined;
const personStylesLoad = () => (personStylesCache ??= import('@/mocks/personStyles').then((m) => m.personStyles).catch(() => ({} as Record<string, never>)));

export async function getPerson(ref: string): Promise<PersonPage | undefined> {
  await delay(200);
  await Promise.all([catalog(), workRefs()]);
  const known = isPersonId(ref) ? people[ref] : undefined;
  const seenIds = new Set([...history().map((e) => e.work.id), ...watchedNow().map((w) => w.id)]);
  const seenKeys = new Set([...history().map((e) => e.work), ...watchedNow()]
    .map((w) => workKey(w, w.externalIds ?? externalIds[w.id])).filter((k): k is string => Boolean(k)));
  const byWork = new Map<string, { work: WorkCard; roles: CreditRole[]; key?: string }>();
  let name: string | undefined = known?.name;
  for (const raw of knownWorks()) {
    const w = withCredits(raw);
    const mine = creditsOf(w, people).filter((c) => sameCredit(c, ref, known));
    if (!mine.length) continue;
    name ??= mine[0].name;
    const key = workKey(w, w.externalIds ?? externalIds[w.id]);
    const id = key ?? w.id;
    const item = byWork.get(id) ?? { work: isSeries(w) ? withSeriesDraft(w) : w, roles: [], key };
    for (const c of mine) if (!item.roles.includes(c.role)) item.roles.push(c.role);
    // карточка с разметкой побеждает голую того же произведения
    if (!item.work.complexityLevel && w.complexityLevel) item.work = w;
    byWork.set(id, item);
  }
  let about = aboutOrder(isPersonId(ref) ? (await aboutVideos()).person[ref] ?? [] : []);
  // человек без работ в каталоге, но с роликами о нём — страница всё равно есть
  if ((!byWork.size && !about.length) || !name) return undefined;
  // ролики рубрики «Об авторе» (ТВ-3, 06.10) у его работ — тоже о нём: в «о нём», а не в разборы
  // фильма; и у обзорного канала — рубрика уже сказала, что ролик об авторе, а не обзор фильма
  const authorish: ExternalAnalysis[] = [];
  const person: Person = known ?? { id: ref, name };
  const pi = isPersonId(ref) ? (await peopleInfoLoad())[ref] : undefined;
  const info = pi ? { ...(pi.img ? { image: pi.img } : {}), ...(pi.d ? { description: pi.d } : {}), ...(pi.b ? { born: pi.b } : {}), ...(pi.x ? { died: pi.x } : {}) } : undefined;
  // почерк — черновик агента; с уверенностью low не показываем, как и черновики произведений
  const ps = isPersonId(ref) ? (await personStylesLoad())[ref] : undefined;
  const style = ps && ps.confidence !== 'low' ? { what: ps.what, lo: ps.lo, hi: ps.hi, barriers: ps.barriers } : undefined;

  const analyses: PersonPage['analyses'] = [];
  const count = new Map<string, number>();
  for (const { work, key } of byWork.values()) {
    if (!key) continue;
    const seen = seenIds.has(work.id) || seenKeys.has(key);
    const seenUrl = new Set<string>();
    for (const src of [essays, essaysAuto, postsAuto]) {
      for (const a of src[key] ?? []) {
        if (seenUrl.has(a.url) || linkVerdicts.get(a.url) === 'other_work') continue;
        if (a.lens === 'author' || a.lensAlso === 'author') { seenUrl.add(a.url); authorish.push(a); continue; }
        if (a.tier === 'review') continue;
        seenUrl.add(a.url);
        analyses.push({ work, analysis: a, seen });
      }
    }
    count.set(key, seenUrl.size);
  }
  if (authorish.length) {
    const have = new Set(about.map((a) => a.url));
    about = aboutOrder([...about, ...authorish.filter((a) => !have.has(a.url) && (have.add(a.url), true))]);
  }
  const stamp = (a: ExternalAnalysis) => (a.publishedAt ? Date.parse(a.publishedAt) : 0);
  analyses.sort((x, y) => Number(Boolean(x.analysis.unverified)) - Number(Boolean(y.analysis.unverified)) || stamp(y.analysis) - stamp(x.analysis));

  const works = [...byWork.values()].map(({ work, roles, key }) => ({
    work, roles, analyses: key ? count.get(key) ?? 0 : 0,
    seen: seenIds.has(work.id) || Boolean(key && seenKeys.has(key)),
  })).sort((a, b) => (a.work.year || 9999) - (b.work.year || 9999));

  // с чего начать: чуть выше привычного (зона ближайшего развития), при равенстве — где больше разборов
  const comfort = ownState()?.complexityComfort;
  const open = works.filter((x) => !x.seen && x.work.complexityLevel > 0);
  const pick = [...open].sort((a, b) => (comfort != null
    ? Math.abs(a.work.complexityLevel - (comfort + 1)) - Math.abs(b.work.complexityLevel - (comfort + 1))
    : a.work.complexityLevel - b.work.complexityLevel) || b.analyses - a.analyses)[0];

  const mineIds = new Set(works.map((x) => x.work.id));
  const mineKeys = new Set([...byWork.values()].map((x) => x.key).filter(Boolean));
  const trajectories = mocks.trajectories
    .filter((t) => t.steps.some((st) => mineIds.has(st.work.id) || mineKeys.has(workKey(st.work, st.work.externalIds ?? externalIds[st.work.id]) ?? '')))
    .map((t) => ({ id: t.id, title: t.title }));

  const roleOrder: CreditRole[] = ['director', 'creator', 'author', 'writer'];
  const roles = roleOrder.filter((r) => works.some((x) => x.roles.includes(r)));
  return {
    person, ...(info ? { info } : {}), ...(style ? { style } : {}), wikidata: Boolean(known), roles, works, analyses: analyses.slice(0, 24), about,
    ...(pick ? { startWith: { work: pick.work, why: comfort != null ? 'near' as const : 'entry' as const, level: pick.work.complexityLevel } } : {}),
    trajectories,
  };
}

/** Ролики о франшизе и о человеке (src/mocks/essaysAbout.ts, 02.10) — подгружаются со страницей. */
let aboutLoad: Promise<{ universe: Record<string, ExternalAnalysis[]>; person: Record<string, ExternalAnalysis[]> }> | undefined;
const aboutVideos = () => (aboutLoad ??= import('@/mocks/essaysAbout').then((m) => m.essaysAbout));
/** эссе первыми, обзоры за ними; внутри — свежие первыми */
const aboutOrder = (list: ExternalAnalysis[]): ExternalAnalysis[] => list.filter(shownLanguage).sort((a, b) =>
  Number(a.tier === 'review') - Number(b.tier === 'review') || (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''));

/** Вердикты по автонайденным разборам: ключ — ссылка на ролик. */
const linkVerdicts = new Map<string, 'about_this' | 'other_work' | 'unsure'>();

/** Всё, что мы вообще знаем о произведениях, одним списком: каталог, история, пул,
 *  просмотренное и справочник. Справочник — последним: если фильм уже есть в истории или
 *  каталоге, побеждает он (у него есть разметка, у справочника её нет). */
function knownWorks(): WorkCard[] {
  return [
    ...Object.values(mocks.works).map(withMedia),
    ...history().map((e) => e.work),
    // фильмы из истории владельца — часть справочника, а не его личное: по ним ищут и оценивают все
    ...userWorks.map(annotated),
    ...candidateSeeds.map((s) => ({ ...seedToCard(s), ...candidateMedia[s.id] }) as WorkCard),
    ...watchedNow().map(annotated),
    // справочник: у самых смотримых — черновая разметка (трек Г1), остальные без неё
    ...filmBase.map(annotated),
    // фильмы, о которых говорят каналы (Wikidata, 23.09): нужны, чтобы разборы было к чему
    // привязывать; разметки у них, как правило, нет
    ...filmBaseWiki.map(annotated),
  ];
}

/** Карточки по ключу разбора — чтобы задание «тот ли фильм» знало, о чём спрашивает. */
function worksByAnalysisKey(): Map<string, WorkCard> {
  const out = new Map<string, WorkCard>();
  for (const w of knownWorks()) {
    // ключи те же, что у генераторов: фильм — TMDb, сериал — IMDb, книга — произведение, а ещё
    // старые `isbn:` — ими подписаны данные прежних прогонов (З1)
    for (const key of workKeys(w, w.externalIds ?? externalIds[w.id])) if (!out.has(key)) out.set(key, w);
  }
  return out;
}

/** Места разговора: курированные (прямые ссылки) — первыми, затем поиск по каналам авторов. */
function placesFor(work: WorkCard): DiscussionPlace[] {
  return [...mocks.discussions.filter((d) => d.workId === work.id), ...searchLinks(work), ...searchLinks(work, 'place')];
}

export async function getDiscussions(workId: ID): Promise<DiscussionPlace[]> {
  await delay(180);
  await catalog();
  // карточка ищется там же, где у getWork: справочник и пул тоже (ТВ-5г) — раньше у них была
  // только ручная подборка мест, без поиска по каналам и чатам
  const work = mocks.works[workId] ?? history().find((e) => e.work.id === workId)?.work ?? candidateCard(workId)
    ?? watchedNow().find((w) => w.id === workId) ?? filmBase.find((w) => w.id === workId) ?? filmBaseWiki.find((w) => w.id === workId);
  return work ? placesFor(work) : mocks.discussions.filter((d) => d.workId === workId);
}

export async function getContributorProfile(): Promise<ContributorProfile> {
  await delay(180);
  return contributor;
}

export async function updateContributorProfile(patch: Partial<ContributorProfile>): Promise<ContributorProfile> {
  await delay(180);
  contributor = { ...contributor, ...patch };
  return contributor;
}

/** Импорт собственной истории (ДФ-11, 14.10): экспорты Letterboxd / IMDb / Trakt / Goodreads / StoryGraph,
 *  сохранённые страницы Кинопоиска, файлы конвертера или просто список названий — несколько файлов сразу.
 *  Разбор на клиенте; сюда — уже текст файлов. Два шага: предпросмотр (что нашли, в чём не уверены, чего нет
 *  в каталоге — до записи) и запись с меткой импорта, которую можно отменить. Ни одна строка не теряется:
 *  не нашли — своя запись без ключа; повтор и уже отмеченное — в счёт, но не второй записью. */
export type ImportRowHow = 'id' | 'exact' | 'loose' | 'resolved' | 'search' | 'own';
export interface ImportRow {
  /** номер строки в разобранной выгрузке */
  i: number;
  record: ImportedRecord;
  /** карточка, на которую легла строка; у `own` — своя, без ключа и разметки */
  work: WorkCard;
  how: ImportRowHow;
  /** другие карточки с тем же названием — для ручной замены */
  alternatives: WorkCard[];
  /** уже есть в дневнике, оценках или отметках — запись не нужна */
  already: boolean;
  /** та же карточка уже взята строкой выше этой выгрузки */
  repeat: boolean;
}
/** `loose` и `search` — человек проверяет сам: название совпало, а год или карточка под вопросом. */
export const importNeedsCheck = (r: ImportRow): boolean => r.how === 'loose' || r.how === 'search';
export interface ImportPreview { sources: ImportSource[]; rows: ImportRow[]; unrecognized: number; rated: number }
export interface ImportChoice { work?: WorkCard; own?: boolean; drop?: boolean }
export interface ImportResult { importId: string; added: number; rated: number; own: number; already: number; dropped: number }
export type ImportProgress = { stage: 'match' | 'resolve' | 'search'; done: number; total: number };

/** Своя запись для строки, которой нет ни в каталоге, ни во внешних базах: «ничего не теряется». Ключ —
 *  из вида, названия и года, чтобы повторный импорт той же выгрузки не завёл вторую. */
function ownImportCard(r: ImportedRecord): WorkCard {
  const key = `${r.type}|${normalizeTitle(r.title || r.originalTitle || '')}|${r.year ?? ''}`;
  let h = 0;
  for (let k = 0; k < key.length; k++) h = (Math.imul(h, 31) + key.charCodeAt(k)) | 0;
  return toWorkCard({ type: r.type, title: r.title || r.originalTitle, originalTitle: r.originalTitle, year: r.year, externalIds: {}, sources: [] },
    `own-${(h >>> 0).toString(36)}`);
}
const resolvedCard = (w: Awaited<ReturnType<typeof resolveRecords>>[number]): WorkCard | undefined => {
  // у сериала номер TMDb — из своего пространства: в ключе он с фильмом совпадать не должен
  const key = w.externalIds.kinopoisk != null ? `kp${w.externalIds.kinopoisk}` : w.externalIds.imdb
    ?? (w.externalIds.tmdb != null ? `${w.type === 'series' ? 'tmdbtv' : 'tmdb'}${w.externalIds.tmdb}` : w.externalIds.isbn?.[0]);
  const card = key ? toWorkCard(w, `u-${key}`) : undefined;
  return card?.title ? card : undefined;
};
/** Задачи по `limit` разом и не дольше `budgetMs`: не успели — строка остаётся своей записью. */
async function settleSome<T>(tasks: (() => Promise<T>)[], limit: number, budgetMs: number, onDone?: (n: number) => void): Promise<(T | undefined)[]> {
  const out: (T | undefined)[] = new Array(tasks.length);
  const until = Date.now() + budgetMs;
  let next = 0, done = 0;
  const worker = async () => {
    while (next < tasks.length && Date.now() < until) {
      const k = next++;
      try { out[k] = await tasks[k](); } catch { out[k] = undefined; }
      onDone?.(++done);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return out;
}

export async function previewImport(files: ExportFile | ExportFile[], onProgress?: (p: ImportProgress) => void): Promise<ImportPreview | undefined> {
  await loadCatalog();
  const parsed = parseExports(Array.isArray(files) ? files : [files]);
  if (!parsed.sources.length || !parsed.records.length) return undefined;
  const records = parsed.records;
  onProgress?.({ stage: 'match', done: 0, total: records.length });
  // Сверяемся со всем, что уже знаем: каталог, история, отметки и справочники. Иначе знакомый фильм уходит в
  // резолвер по сети и заводится второй раз.
  const index = buildMatchIndex(knownWorks().map((w) => ({ ...w, externalIds: w.externalIds ?? externalIds[w.id] })));
  const found: (ImportRow | undefined)[] = records.map((record, i) => {
    const m = matchScored(record, index);
    return m ? { i, record, work: m.work, how: m.how, alternatives: m.alternatives, already: false, repeat: false } : undefined;
  });
  // нет в каталоге, но есть внешний ID — во внешних базах (Wikidata, Кинопоиск, TMDb): по ID — уверенно
  const withIds = records.map((r, i) => ({ r, i })).filter(({ r, i }) => !found[i] && r.externalIds && Object.values(r.externalIds).some((v) => v != null && (!Array.isArray(v) || v.length)));
  if (withIds.length) {
    onProgress?.({ stage: 'resolve', done: 0, total: withIds.length });
    const resolved = await resolveRecords(withIds.map((x) => x.r), { tmdb, kp }).catch(() => []);
    resolved.forEach((w, k) => {
      const card = resolvedCard(w);
      if (card) found[withIds[k].i] = { i: withIds[k].i, record: withIds[k].r, work: card, how: 'resolved', alternatives: [], already: false, repeat: false };
    });
  }
  // без ID и без карточки — поиск TMDb по названию и году (Letterboxd и список названий ID не несут); найденное
  // — «проверьте». Не дольше 25 секунд на всё: не успели — своя запись, это не потеря
  const bare = records.map((r, i) => ({ r, i })).filter(({ r, i }) => !found[i] && r.type !== 'book' && (r.title || r.originalTitle));
  if (bare.length && tmdb) {
    onProgress?.({ stage: 'search', done: 0, total: bare.length });
    const hits = await settleSome(bare.map(({ r }) => async () => {
      const q = r.originalTitle || r.title;
      const hit = r.type === 'series' ? await tmdb.searchTv(q, r.year) : await tmdb.search(q, r.year);
      if (!hit) return undefined;
      const [w] = await resolveRecords([{ ...r, externalIds: r.type === 'series' ? (hit.imdb ? { imdb: hit.imdb } : {}) : { tmdb: hit.id, ...(hit.imdb ? { imdb: hit.imdb } : {}) } }], { tmdb });
      // найденное могло оказаться знакомой карточкой — тогда берём её, а не новую
      const known = w && matchScored({ ...r, externalIds: w.externalIds }, index);
      return known?.how === 'id' ? known.work : w ? resolvedCard(w) : undefined;
    }), 6, 25_000, (done) => onProgress?.({ stage: 'search', done, total: bare.length }));
    hits.forEach((card, k) => { if (card) found[bare[k].i] = { i: bare[k].i, record: bare[k].r, work: card, how: 'search', alternatives: [], already: false, repeat: false }; });
  }
  // что уже отмечено человеком, и повторы внутри выгрузки
  const mine = new Set<string>();
  const keysOf = (w: WorkCard) => [w.id, ...workKeys(w, w.externalIds ?? externalIds[w.id])];
  for (const e of history()) keysOf(e.work).forEach((k) => mine.add(k));
  for (const w of watchedNow()) keysOf(w).forEach((k) => mine.add(k));
  const taken = new Set<string>();
  const rows = records.map((record, i): ImportRow => {
    const row = found[i] ?? { i, record, work: ownImportCard(record), how: 'own' as const, alternatives: [], already: false, repeat: false };
    const keys = keysOf(row.work);
    row.already = keys.some((k) => mine.has(k));
    row.repeat = !row.already && keys.some((k) => taken.has(k));
    keys.forEach((k) => taken.add(k));
    return row;
  });
  return { sources: parsed.sources, rows, unrecognized: parsed.unrecognized, rated: records.filter((r) => r.rating != null && r.rating > 0).length };
}

/** Что положил каждый импорт этой вкладки — для отмены без сервера и для правки памяти после отмены. */
const importLog = new Map<string, { entryIds: string[]; ratingIds: ID[] }>();

/** Записать импорт: записи дневника (кроме уже отмеченного и повторов) и оценки с меткой импорта. Оценка
 *  выгрузки — по шкале 0–10: в 1–5 — половиной, исходная остаётся (`raw`), от неё и нормы считается вкус. */
export async function commitImport(preview: ImportPreview, choices: Record<number, ImportChoice> = {}): Promise<ImportResult> {
  const importId = `imp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const entries: JourneyEntryData[] = [];
  const rated: { workId: ID; rating: 1 | 2 | 3 | 4 | 5; raw: number; work: WorkCard }[] = [];
  let own = 0, already = 0, dropped = 0;
  const used = new Set<ID>();
  for (const row of preview.rows) {
    const choice = choices[row.i] ?? {};
    if (choice.drop) { dropped += 1; continue; }
    const work = choice.own ? ownImportCard(row.record) : choice.work ?? row.work;
    const r = row.record;
    const isOwn = choice.own || (!choice.work && row.how === 'own');
    // замена могла привести к уже отмеченному — проверяем по выбранной карточке
    const known = choice.work || choice.own ? history().some((e) => e.work.id === work.id) : row.already;
    if (r.rating != null && r.rating > 0 && r.status !== 'planned' && !ratings.has(work.id) && !rated.some((x) => x.workId === work.id)) {
      rated.push({ workId: work.id, rating: Math.min(5, Math.max(1, Math.round(r.rating / 2))) as 1 | 2 | 3 | 4 | 5, raw: r.rating, work });
    }
    if (known || used.has(work.id)) { already += 1; continue; }
    used.add(work.id);
    if (isOwn) own += 1;
    entries.push({
      id: `${importId}-${row.i}`, work, status: r.status,
      ...(r.status !== 'planned' && (r.started ?? r.date) ? { startedAt: r.started ?? r.date } : {}),
      ...(r.status === 'finished' && r.date ? { finishedAt: r.date } : {}),
      reflections: [], stateChanges: [],
    });
  }
  const write = await postImport({
    importId,
    entries: entries.map((e) => ({ entryId: e.id, workId: e.work.id, work: e.work, status: e.status, startedAt: e.startedAt, finishedAt: e.finishedAt })),
    ratings: rated,
  });
  (store.onServer ? serverJournal : imported).unshift(...entries);
  for (const x of rated) { ratings.set(x.workId, { rating: x.rating, raw: x.raw }); ratedCards.set(x.workId, x.work); }
  importLog.set(importId, { entryIds: entries.map((e) => e.id), ratingIds: rated.map((x) => x.workId) });
  return { importId, added: write?.added ?? entries.length, rated: write?.rated ?? rated.length, own, already: already + (write?.kept ?? 0), dropped };
}

/** Отменить импорт: на сервере — по метке, в памяти вкладки — то, что он положил. */
export async function undoImport(importId: string): Promise<{ removed: number; unrated: number }> {
  const server = await deleteImport(importId);
  const log = importLog.get(importId);
  if (log) {
    for (const list of [serverJournal, imported]) {
      for (let k = list.length - 1; k >= 0; k--) if (log.entryIds.includes(list[k].id)) list.splice(k, 1);
    }
    for (const id of log.ratingIds) { ratings.delete(id); ratedCards.delete(id); }
    importLog.delete(importId);
  }
  return server ?? { removed: log?.entryIds.length ?? 0, unrated: log?.ratingIds.length ?? 0 };
}


// ---------- выгрузка дневника (ДФ-14) ----------

/** Весь дневник строками выгрузки: записи, оценённое без записи и отмеченное списком «уже видел». */
async function diaryRows(): Promise<DiaryRow[]> {
  await loadCatalog();
  const base = (w: WorkCard) => ({
    workId: w.id, type: isSeries(w) ? 'series' as const : w.type, title: w.title,
    originalTitle: w.originalTitle && w.originalTitle !== w.title ? w.originalTitle : undefined,
    year: w.year || undefined, ids: w.externalIds ?? externalIds[w.id] ?? {},
  });
  const rows: DiaryRow[] = history().map((e) => ({
    ...base(e.work), status: e.status, rating: e.rating, raw: e.raw, startedAt: e.startedAt, finishedAt: e.finishedAt,
    perceivedDifficulty: e.perceivedDifficulty, abandonReason: e.abandonReason,
    reflections: e.reflections.length ? e.reflections : undefined,
  }));
  const have = new Set(rows.map((r) => r.workId));
  for (const w of watchedNow()) if (!have.has(w.id)) { have.add(w.id); rows.push({ ...base(w), status: 'finished', seenList: true }); }
  return rows;
}

export type DiaryFormat = 'csv' | 'json';
export interface DiaryFile { name: string; text: string; mime: string; count: number }

export async function diaryFile(format: DiaryFormat): Promise<DiaryFile> {
  const rows = await diaryRows();
  const name = `recomend-diary-${today()}.${format}`;
  return format === 'csv'
    ? { name, text: diaryCsv(rows), mime: 'text/csv;charset=utf-8', count: rows.length }
    : { name, text: diaryJson(rows, new Date().toISOString()), mime: 'application/json;charset=utf-8', count: rows.length };
}

/** Ссылка на файл для `downloadFile` Telegram: метод берёт только адрес, поэтому сервер держит файл час.
 *  Без сервера — undefined: тогда скачивание обычное, из памяти страницы. */
export async function diaryLink(file: DiaryFile): Promise<string | undefined> {
  if (!store.onServer) return undefined;
  const path = await postExport(file.name, file.text);
  return path ? new URL(`${apiBase}${path}`, location.href).href : undefined;
}

// ---------- петля прогноза (трек Б) ----------

/** Владелец ли вошёл: ему отчёт по всем участникам. */
/** Заявка участника: фильма нет в каталоге или автора нет в справочнике. Уходит на сервер и
 *  ложится в очередь владельцу — в каталог сама не попадает: справочник собирается руками,
 *  и чужой ввод в нём был бы дырой. Без сервера (разработка) заявке некуда идти, и мы честно
 *  говорим об этом вызывающему, а не делаем вид, что приняли. */
export async function suggest(kind: 'work' | 'voice', title: string, note?: string, context?: string): Promise<{ ok: boolean }> {
  if (!store.onServer) { await delay(120); return { ok: false }; }
  await store.suggest(kind, title.trim(), note?.trim() || undefined, context);
  return { ok: true };
}

/** Что не так в карточке (02.10): поля — ключи `WorkIssueField`. Без сервера — `ok: false`, как у заявок:
 *  в разработке сообщить некуда, и человек должен это узнать, а не думать, что отправил. */
export type WorkIssueField = 'title' | 'year' | 'people' | 'synopsis' | 'image' | 'duration' | 'type' | 'watch' | 'analyses' | 'relations' | 'heroes' | 'other';
export async function reportWorkIssue(work: Pick<WorkCard, 'id' | 'title' | 'year'>, fields: WorkIssueField[], note?: string, context?: string): Promise<{ ok: boolean }> {
  if (!store.onServer) { await delay(120); return { ok: false }; }
  await store.workIssue(work.id, work.year ? `${work.title} (${work.year})` : work.title, fields, note?.trim() || undefined, context);
  return { ok: true };
}

/** Сколько дней человек заходил (ДФ-3): с третьего предлагаем ярлык на экран телефона. Без сервера — 0. */
export async function visitDays(): Promise<number> {
  await ready;
  return profile?.visitDays ?? 0;
}

export async function isOwnerSession(): Promise<boolean> {
  await delay(0);
  return Boolean(profile?.owner);
}

/** Отчёт петли: калибровка, совпадения, отказы, принятие слейта. Без сервера — нечего считать. */
// ─── разметка владельца с телефона (06.10) ────────────────────────────────────
// Очередь собирает tools/owner-queue.mts из вкладок «Проверка» и «Рубрики» пульта, решения
// забирает tools/owner-pull.mts. Здесь только показ и запись.
export interface OwnerCheckItem {
  id: string; title: string; channel?: string; date?: string; minutes?: number; group: 'spor' | 'check' | 'gap';
  film?: string; evidence?: string;
  model?: { flag: string; says: string; film?: string; typed?: string; note?: string; conf?: number;
    also?: string[]; about?: { kind: 'universe' | 'person'; title: string } };
}
export interface OwnerLensItem { id: string; title: string; channel?: string; lens: string; also?: string; conf?: number; works: string[] }
export interface OwnerDesk {
  at: string;
  lenses: { id: string; name: string; weak: boolean }[];
  check: OwnerCheckItem[]; lens: OwnerLensItem[]; films: string[];
  /** решения, уже лежащие на сервере: ключ `${kind}:${id}` */
  decided: Set<string>;
}
export type OwnerCheckAction = 'ok' | 'set' | 'wrong' | 'notfilm' | 'several' | 'franchise' | 'person';

/** undefined — без сервера; null — очереди ещё нет (не отправлена с Mac). */
export async function getOwnerDesk(): Promise<OwnerDesk | null | undefined> {
  const r = await fetchOwnerDesk().catch((e: Error) => { if (/^owner desk: 404/.test(e.message)) return null; throw e; });
  if (!r) return r;
  const q = r.queue as Omit<OwnerDesk, 'decided'>;
  const items = (r.decisions as { items: { kind: string; id: string; clear?: boolean }[] }).items;
  return { ...q, decided: new Set(items.filter((x) => !x.clear).map((x) => `${x.kind}:${x.id}`)) };
}

export const decideOwnerCheck = (id: string, action: OwnerCheckAction, film?: string, also?: string[]) =>
  store.ownerDecision({ kind: 'check', id, action, ...(film ? { film } : {}), ...(also?.length ? { also } : {}) });
export const decideOwnerLens = (id: string, lens: string, also?: string) =>
  store.ownerDecision({ kind: 'lens', id, lens, ...(also ? { also } : {}) });
export const clearOwnerDecision = (kind: 'check' | 'lens', id: string) => store.ownerDecision({ kind, id, clear: true });

export async function getLoopReport(scope: 'all' | 'me' = 'all'): Promise<LoopReportData | undefined> {
  await delay(120);
  return (await fetchLoopReport(scope)) as LoopReportData | undefined;
}

// ---------- статистика обсуждений (02.10) ----------
/** Страница статистики: сколько и где говорят о произведении, вселенной или человеке. Считается из
 *  тех же разборов и постов, что в карточках, и по тем же правилам (вердикт «про другое» убирает
 *  привязку); подборки и новости — из разметки модели (src/mocks/mediaMentions.ts). */
export type StatsKind = 'work' | 'universe' | 'person';
export interface StatsChannel { voiceId: string; title: string; known: boolean; videos: number; posts: number }
export interface StatsWork { workId?: ID; title: string; year?: number; videos: number; posts: number }
export interface StatsPage {
  kind: StatsKind;
  id: string;
  title: string;
  /** страница, с которой пришли: карточка, вселенная, человек */
  back: string;
  totals: {
    videos: number; posts: number;
    /** из роликов и постов: эссе (без обзоров) и обзоры */
    essays: number; reviews: number;
    /** найдено по названию и не подтверждено ни уликой, ни человеком */
    unverified: number;
    /** сколько всего смотреть, минут (у роликов, где длительность известна) */
    minutes: number;
    channels: number;
    /** ролики о вселенной или человеке целиком (решения разметки) */
    about: number;
    first?: ISODate; last?: ISODate;
    /** вес обсуждения (src/lib/weights.ts): доверие × содержательность, по каналу с насыщением */
    weight: number;
    /** он же с затуханием — полвеса за полгода: о чём говорят сейчас */
    weightNow: number;
  };
  /** место по весу обсуждения среди произведений (или вселенных) с материалами; `now` — по свежему весу */
  rank?: { place: number; of: number; now?: number };
  /** по годам; если материалы укладываются в два года — по кварталам */
  timeline: { period: string; videos: number; posts: number }[];
  channels: StatsChannel[];
  /** вселенная и человек: по произведениям */
  works?: StatsWork[];
  /** чем подтверждены привязки: улики, человек, прислано вручную, без подтверждения */
  evidence: { kind: string; n: number }[];
  /** с чем называют вместе (соупоминания в постах), без своих же произведений */
  nearby: CoMention[];
  /** из разметки модели: в подборках, в роликах о нескольких, в новостях */
  mentions?: { list: number; several: number; news: number; labels: number };
}

/** Все материалы по набору ключей — без повторов и без отвергнутых привязок. */
function materialsOf(keys: Iterable<string>): { key: string; a: ExternalAnalysis }[] {
  const out: { key: string; a: ExternalAnalysis }[] = [];
  const seenUrl = new Set<string>();
  for (const key of keys) {
    for (const src of [essays, essaysAuto, postsAuto]) {
      for (const raw of src[key] ?? []) {
        const verdict = linkVerdicts.get(raw.url);
        if (verdict === 'other_work' || seenUrl.has(raw.url) || !shownLanguage(raw)) continue;
        seenUrl.add(raw.url);
        out.push({ key, a: verdict === 'about_this' ? { ...raw, unverified: undefined } : raw });
      }
    }
  }
  return out;
}

/** Вес обсуждения по каждому ключу — для места в рейтинге (src/lib/weights.ts): за всё время и
 *  «сейчас» (полвеса за полгода). Считается один раз. */
let keyWeights: Map<string, { all: number; now: number }> | undefined;
const recordTrustImport = () => import('@/mocks/recordTrust');
let trust: Awaited<ReturnType<typeof recordTrustImport>>['recordTrust'] = {};
const voiceKey = (a: ExternalAnalysis) => voiceOf(a).id;
function weightsByKey(): Map<string, { all: number; now: number }> {
  if (keyWeights) return keyWeights;
  const lists = new Map<string, ExternalAnalysis[]>();
  for (const src of [essays, essaysAuto, postsAuto]) {
    for (const [key, list] of Object.entries(src)) {
      const have = lists.get(key) ?? lists.set(key, []).get(key)!;
      for (const a of list) if (linkVerdicts.get(a.url) !== 'other_work' && !have.some((x) => x.url === a.url)) have.push(a);
    }
  }
  keyWeights = new Map([...lists].map(([k, l]) => [k, { all: weightOf(l, voiceKey, { trust }), now: weightOf(l, voiceKey, { trust, fresh: true }) }]));
  return keyWeights;
}

function rankWith(mine: { all: number; now: number }, all: { all: number; now: number }[]): StatsPage['rank'] {
  if (!(mine.all > 0)) return undefined;
  return { place: all.filter((x) => x.all > mine.all).length + 1, of: all.filter((x) => x.all > 0).length,
    ...(mine.now > 0.05 ? { now: all.filter((x) => x.now > mine.now).length + 1 } : {}) };
}

/** Ключи разборов у произведения вселенной: по карточке (у книги их несколько), иначе — ключ узла. */
function memberKeys(q: string, byKey: Map<string, WorkCard>): string[] {
  const n = relationNodes[q];
  if (!n?.key) return [];
  const card = byKey.get(n.key);
  return card ? workKeys(card, card.externalIds ?? externalIds[card.id]) : [n.key];
}

const mentionsImport = () => import('@/mocks/mediaMentions');
let mentionsLoad: ReturnType<typeof mentionsImport> | undefined;
const mediaMentions = () => (mentionsLoad ??= mentionsImport());

export async function getStats(kind: StatsKind, id: string): Promise<StatsPage | undefined> {
  await delay(150);
  await Promise.all([catalog(), workRefs(), recordTrustImport().then((m) => { if (trust !== m.recordTrust) { trust = m.recordTrust; keyWeights = undefined; } })]);
  const byKey = worksByAnalysisKey();
  let title: string;
  let back: string;
  let about: ExternalAnalysis[] = [];
  /** ключ → произведение: для разбивки по произведениям */
  const groups = new Map<string, { workId?: ID; title: string; year?: number; keys: string[] }>();
  let rank: StatsPage['rank'];

  if (kind === 'work') {
    const work = await getWork(id);
    if (!work) return undefined;
    title = work.title;
    back = `/works/${id}`;
    const keys = workKeys(work, work.externalIds ?? externalIds[work.id]);
    groups.set(id, { workId: id, title: work.title, ...(work.year ? { year: work.year } : {}), keys });
    const ws = weightsByKey();
    const mine = keys.map((k) => ws.get(k)).filter(Boolean).sort((a, b) => b!.all - a!.all)[0];
    rank = mine ? rankWith(mine, [...ws.values()]) : undefined;
  } else if (kind === 'universe') {
    const { members } = universeIndex();
    const list = members.get(id);
    const hub = relationNodes[id];
    if (!list || !hub) return undefined;
    title = hub.t;
    back = `/universe/${id}`;
    about = (await aboutVideos()).universe[id] ?? [];
    for (const q of list) {
      const keys = memberKeys(q, byKey);
      if (!keys.length) continue;
      const n = relationNodes[q]!;
      const card = byKey.get(keys[0]) ?? byKey.get(n.key!);
      groups.set(q, { ...(card ? { workId: card.id } : {}), title: n.t, ...(n.y ? { year: n.y } : {}), keys });
    }
    // место среди вселенных: сумма весов по произведениям
    const ws = weightsByKey();
    const sum = (qs: string[]) => qs.reduce((s, q) => {
      const w = relationNodes[q]?.key ? ws.get(relationNodes[q]!.key!) : undefined;
      return { all: s.all + (w?.all ?? 0), now: s.now + (w?.now ?? 0) };
    }, { all: 0, now: 0 });
    rank = rankWith(sum(list), [...members.values()].filter((qs) => qs.length >= 3).map(sum));
  } else {
    const known = isPersonId(id) ? people[id] : undefined;
    let name = known?.name;
    for (const raw of knownWorks()) {
      const w = withCredits(raw);
      const mine = creditsOf(w, people).filter((c) => sameCredit(c, id, known));
      if (!mine.length) continue;
      name ??= mine[0].name;
      const keys = workKeys(w, w.externalIds ?? externalIds[w.id]);
      const gid = keys[0] ?? w.id;
      if (!groups.has(gid)) groups.set(gid, { workId: w.id, title: w.title, ...(w.year ? { year: w.year } : {}), keys });
    }
    about = isPersonId(id) ? (await aboutVideos()).person[id] ?? [] : [];
    if (!name || (!groups.size && !about.length)) return undefined;
    title = name;
    back = `/person/${id}`;
  }

  const items = materialsOf([...groups.values()].flatMap((g) => g.keys));
  const seenUrl = new Set(items.map((x) => x.a.url));
  const all = [...items.map((x) => x.a), ...about.filter((a) => !seenUrl.has(a.url))];
  const isPost = (a: ExternalAnalysis) => a.platform === 'telegram';
  const dates = all.map((a) => a.publishedAt).filter((d): d is ISODate => Boolean(d)).sort();

  // по времени: годы, а если всё уместилось в два года — кварталы
  const years = new Set(dates.map((d) => d.slice(0, 4)));
  const period = (d: string) => (years.size <= 2 ? `${d.slice(0, 4)}·${Math.floor((Number(d.slice(5, 7)) - 1) / 3) + 1}` : d.slice(0, 4));
  const tl = new Map<string, { period: string; videos: number; posts: number }>();
  if (dates.length) {
    // пустые периоды между первым и последним тоже показываем: провал — тоже сведения
    const [y0, y1] = [Number(dates[0].slice(0, 4)), Number(dates[dates.length - 1].slice(0, 4))];
    for (let y = y0; y <= y1; y++) {
      if (years.size <= 2) for (let q = 1; q <= 4; q++) tl.set(`${y}·${q}`, { period: `${y}·${q}`, videos: 0, posts: 0 });
      else tl.set(String(y), { period: String(y), videos: 0, posts: 0 });
    }
    if (years.size <= 2) {
      const first = period(dates[0]), last = period(dates[dates.length - 1]);
      for (const k of [...tl.keys()]) if (k < first || k > last) tl.delete(k);
    }
  }
  for (const a of all) {
    if (!a.publishedAt) continue;
    const slot = tl.get(period(a.publishedAt));
    if (slot) { if (isPost(a)) slot.posts++; else slot.videos++; }
  }

  const ch = new Map<string, StatsChannel>();
  for (const a of all) {
    const v = voiceOf(a);
    const c = ch.get(v.id) ?? { voiceId: v.id, title: v.short ?? v.title, known: Boolean(knownVoice(v.id)), videos: 0, posts: 0 };
    if (isPost(a)) c.posts++; else c.videos++;
    ch.set(v.id, c);
  }
  const channels = [...ch.values()].sort((a, b) => b.videos + b.posts - a.videos - a.posts || a.title.localeCompare(b.title, 'ru'));

  const ev = new Map<string, number>();
  for (const a of all) {
    const k = a.evidence ?? (a.unverified ? 'none' : 'manual');
    ev.set(k, (ev.get(k) ?? 0) + 1);
  }
  const EV_ORDER = ['human', 'manual', 'link', 'year', 'original', 'channel', 'tag', 'lore', 'playlist', 'none'];
  const evidence = [...ev].map(([k, n]) => ({ kind: k, n })).sort((a, b) => EV_ORDER.indexOf(a.kind) - EV_ORDER.indexOf(b.kind));

  let works: StatsWork[] | undefined;
  if (kind !== 'work') {
    const per = new Map<string, { videos: number; posts: number }>();
    const keyGroup = new Map<string, string>();
    for (const [gid, g] of groups) for (const k of g.keys) keyGroup.set(k, gid);
    for (const { key, a } of items) {
      const gid = keyGroup.get(key)!;
      const x = per.get(gid) ?? { videos: 0, posts: 0 };
      if (isPost(a)) x.posts++; else x.videos++;
      per.set(gid, x);
    }
    works = [...groups].map(([gid, g]) => ({ ...(g.workId ? { workId: g.workId } : {}), title: g.title, ...(g.year ? { year: g.year } : {}), ...(per.get(gid) ?? { videos: 0, posts: 0 }) }))
      .filter((w) => w.videos + w.posts > 0)
      .sort((a, b) => b.videos + b.posts - a.videos - a.posts || (a.year ?? 9999) - (b.year ?? 9999));
  }

  // соседи по постам: у вселенной и человека — сумма по произведениям, свои же — вон
  const own = new Set([...groups.values()].flatMap((g) => g.keys));
  const near = new Map<string, CoMention>();
  for (const k of own) for (const c of comentions[k] ?? []) {
    if (own.has(c.key)) continue;
    const x = near.get(c.key);
    near.set(c.key, x ? { ...x, n: x.n + c.n, weight: Math.max(x.weight, c.weight) } : { ...c });
  }
  const nearby = [...near.values()].sort((a, b) => b.n - a.n || b.weight - a.weight).slice(0, 8);

  const mm = await mediaMentions().then((m) => m.mediaMentions).catch(() => undefined);
  let mentions: StatsPage['mentions'];
  if (mm?.labels) {
    const m = { list: 0, several: 0, news: 0, labels: mm.labels };
    for (const k of own) { const x = mm.works[k]; if (x) { m.list += x.list ?? 0; m.several += x.several ?? 0; m.news += x.news ?? 0; } }
    mentions = m;
  }

  return {
    kind, id, title, back,
    totals: {
      videos: all.filter((a) => !isPost(a)).length,
      posts: all.filter(isPost).length,
      essays: all.filter((a) => a.tier !== 'review').length,
      reviews: all.filter((a) => a.tier === 'review').length,
      unverified: all.filter((a) => a.unverified).length,
      minutes: all.reduce((s, a) => s + (a.durationMinutes ?? 0), 0),
      channels: channels.length,
      about: about.length,
      ...(dates.length ? { first: dates[0], last: dates[dates.length - 1] } : {}),
      weight: Math.round(weightOf(all, voiceKey, { trust }) * 10) / 10,
      weightNow: Math.round(weightOf(all, voiceKey, { trust, fresh: true }) * 10) / 10,
    },
    ...(rank ? { rank } : {}),
    timeline: [...tl.values()],
    channels,
    ...(works ? { works } : {}),
    evidence,
    nearby,
    ...(mentions ? { mentions } : {}),
  };
}
