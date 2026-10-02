// Слой данных: сигнатуры под будущие эндпоинты. Возвращает моки с задержкой,
// чтобы состояния загрузки были видны в разработке. Бизнес-логики здесь нет:
// уровень усилия, готовность, спойлерность и тексты приходят как данные.
import ru from '@/i18n/ru';
import { parseExports, toJourneyEntries, type ImportOutcome, type ImportSource } from '@/lib/import';
import { kinopoiskFromEnv, resolveRecords, toWorkCard, tmdbFromEnv, withImages } from '@/lib/resolve';
import { ratingDeck } from '@/mocks/ratingDeck';
import type { FirstPassAnnotation } from '@/mocks/userAnnotations';
import type { SeasonDraft, SeriesDraft } from '@/mocks/seriesAnnotations';
import type { CharacterRecord } from '@/mocks/characters';
import { nameForms, nameRegex, sharedWords } from '@/lib/characters';
import { hubWeight, listLike } from '@/lib/relations';
import { draftReview, type ReviewMark } from '@/mocks/draftReview';
import { deriveMap, deriveState, type RatedEntry } from '@/lib/model/deriveState';
import { difficultyOdds, expectedDifficulty, recommend, scoreCandidate, type Candidate } from '@/lib/model/recommend';
import { knownVoice, voiceOf } from '@/lib/voices';
import { apiBase, fetchLoopReport, loadState, store, type StoredState } from './store';
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
  CharacterView, CreditRole, MediaType, ExternalIds, Person, PersonId, RelationKind, RelationNodeKind, Session, WorkRelationView, SourceCandidate, Trajectory, TvTropesMapping, UserSettings, Voice, WorkCard, WorkDetail,
} from '@/types/tmdf';
import { isFilm, isScreen, isSeries, normalizeWork, seriesHours } from '@/lib/media';
import { creditsOf, decodeCredits, isPersonId, sameCredit, workKey } from '@/lib/credits';
import { primaryKey, withBookWork, workKeys, type BookWorks } from '@/lib/keys';


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
  import('@/mocks/catalogMedia'), import('@/mocks/sources'), import('@/mocks/essays'), import('@/mocks/essaysAuto'), import('@/mocks/postsAuto'),
]);
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
let essaysAuto!: Mod<typeof coreImports>[11]['essaysAuto'];
let postsAuto!: Mod<typeof coreImports>[12]['postsAuto'];
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

/** Ядро — один раз: справочнику (catalog) нужны externalIds из ядра, и если ядро ждёт ответа
 *  сервера (serverRef), справочник успевал раньше и падал на пустых externalIds (найдено 01.10). */
let coreLoading: Promise<void> | undefined;
const core = (): Promise<void> => (coreLoading ??= loadCore());
async function loadCore(): Promise<void> {
  const [[m, wd, ei, ua, cs, wr, rb, cm, ctm, src, es, ea, pa], freshEssays, freshPosts] = await Promise.all([
    coreImports(),
    serverRef<Mod<typeof coreImports>[11]['essaysAuto']>('essaysAuto'),
    serverRef<Mod<typeof coreImports>[12]['postsAuto']>('postsAuto'),
  ]);
  mocks = m; bare = wd.bare; workDetail = wd.workDetail; externalIds = ei.externalIds; userAnnotations = ua.userAnnotations;
  candidateSeeds = cs.candidateSeeds; seedToCard = cs.seedToCard; workRegisters = wr.workRegisters; registerBase = rb.registerBase;
  candidateMedia = cm.candidateMedia; catalogMedia = ctm.catalogMedia; searchLinks = src.searchLinks;
  essays = es.essays; essaysAuto = freshEssays ?? ea.essaysAuto; postsAuto = freshPosts ?? pa.postsAuto;
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
let draftMeta: { model: string; createdAt: ISODate; tmdfVersion: string; provider: AnnotationProvider } | undefined;
let catalogLoad: Promise<void> | undefined;
const loadCatalog = (): Promise<void> => catalog();
/** Справочник фильмов и история владельца. Повторный вызов ждёт ту же загрузку. */
function catalog(): Promise<void> {
  catalogLoad ??= Promise.all([
    import('@/mocks/userHistory'), import('@/mocks/userRatings'), import('@/mocks/userWatched'),
    import('@/mocks/filmBase'), import('@/mocks/filmBaseWiki'), import('@/mocks/filmBaseMarkup'),
    serverRef<WorkCard[]>('filmBaseWiki'), import('@/mocks/draftAnnotations'), import('@/mocks/filmBaseCurated'),
    import('@/mocks/baseMedia'), import('@/mocks/people'), import('@/mocks/workCredits'), import('@/mocks/seriesAnnotations'), import('@/mocks/seriesBase'), import('@/mocks/bookWorks'), import('@/mocks/bookBase'), import('@/mocks/bookMedia'), import('@/mocks/bookAnnotations'),
  ]).then(async (mods) => { await core(); return mods; }).then(([uh, ur, uw, fb, fw, fm, freshWiki, da, fc, bm, pp, wc, sa, sb, bw, bb, bmd, ba]) => {
    bookMedia = bmd.bookMedia; bookAnnotations = ba.bookAnnotations;
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
    filmBaseWiki = [...filmBaseWiki, ...bb.bookBase.filter((w) => !seen.has(w.id))];
    // обложки, кадры и регистр карточкам из Wikidata (tools/build-base-media.mts, 30.09): без них
    // в колоде /rate и в ленте пустая плитка, а подбор не видит регистра
    const media = bm.baseMedia;
    if (Object.keys(media).length) filmBaseWiki = filmBaseWiki.map((w) => (media[w.id] ? { ...w, ...media[w.id] } : w));
    // метаданные и обложки книг (З3) — там, где карточка сама их не принесла
    if (Object.keys(bookMedia).length) {
      const booked = (ws: WorkCard[]) => ws.map(withBookMedia);
      userWorks = booked(userWorks); watchedWorks = booked(watchedWorks);
      filmBase = booked(filmBase); filmBaseWiki = booked(filmBaseWiki);
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
  });
  return catalogLoad;
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
    if (elsewhere.length) out.push({ id: q, name: c.n, elsewhere, said: c.said });
  }
  return out.sort((a, b) => b.said - a.said || b.elsewhere.length - a.elsewhere.length).slice(0, 6);
}

/** Страница героя (И2): его версии по произведениям и видам — книги, фильмы, сериалы — и разборы,
 *  которые называют его в заголовке. Адрес — элемент Wikidata героя. */
export interface CharacterPage {
  id: string;
  name: string;
  /** в оригинале, если отличается: «Sherlock Holmes» */
  original?: string;
  aka: string[];
  /** по видам — книги первыми (с них чаще всё начинается), внутри — по году */
  byKind: { kind: MediaType; works: { work: WorkCard; seen: boolean; analyses: number }[] }[];
  /** самое раннее из наших — часто книга, с которой герой пришёл */
  first?: WorkCard;
  /** с чего начать: непросмотренное с разметкой — ближе всего к «чуть выше привычного» */
  startWith?: { work: WorkCard; level: number };
  /** разборы, называющие героя в заголовке: по его произведениям и по любым другим; обзоры не
   *  показываем (решение 29.09); подтверждённые и свежие первыми */
  analyses: { work: WorkCard; analysis: ExternalAnalysis; seen: boolean; own: boolean }[];
  discussions: DiscussionPlace[];
}

export async function getCharacter(id: string): Promise<CharacterPage | undefined> {
  await delay(200);
  await Promise.all([catalog(), workRefs()]);
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
          if (a.tier === 'review' || seenUrl.has(a.url) || !match?.test(a.title) || linkVerdicts.get(a.url) === 'other_work') continue;
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
  analyses.sort((x, y) => Number(Boolean(x.analysis.unverified)) - Number(Boolean(y.analysis.unverified))
    || Number(y.own) - Number(x.own) || stamp(y.analysis) - stamp(x.analysis));

  const works = [...new Map(c.works.map((k) => card(k)).filter((w): w is WorkCard => Boolean(w)).map((w) => [w.id, w])).values()]
    .map((work) => ({ work, seen: isSeen(work), analyses: perWork.get(work.id) ?? 0 }))
    .sort((a, b) => (a.work.year || 9999) - (b.work.year || 9999));
  if (!works.length) return undefined;
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
    byKind, ...(works[0]?.work.year ? { first: works[0].work } : {}),
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

let filmForm: Record<string, FilmForm> = {};
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
const ready: Promise<void> = (async () => {
  const [state] = await Promise.all([loadState(), core(), store.onServer ? undefined : catalog()]);
  // с сервером справочник фильмов догружается фоном: ленте он не нужен
  if (store.onServer) catalog().catch(() => undefined);
  if (state === 'unreachable') { unreachable = true; return; }
  if (!state) return;
  hydrate(state);
})();

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

// Картинки: TMDb по ключу из окружения (только разработка), обложки книг — всегда.
const tmdb = tmdbFromEnv(import.meta.env.VITE_TMDB_API_KEY);
// прокси есть только у страницы, которую отдал сервер; из файла (standalone) — нет
const kp = import.meta.env.VITE_KP_PROXY === '1' && typeof location !== 'undefined' && location.protocol.startsWith('http')
  ? kinopoiskFromEnv('proxy') : undefined;
// Карточки из бандла не несут внешних ID — подкладываем их из externalIds.ts перед обогащением.
// Обогащение не должно держать экран: не успело за 6 секунд — карточки уходят как есть,
// а результат осядет в кэше к следующему разу.
// авторы из справочника (Д3) — сразу при карточке: подпись под названием берёт оттуда русское имя
// режиссёра, а не то, что пришло с карточкой («Miller», «陆川»; 02.10)
const withMedia = (c: WorkCard): WorkCard => withCredits(withBookMedia({ ...c, ...catalogMedia[c.id], externalIds: c.externalIds ?? catalogMedia[c.id]?.externalIds ?? externalIds[c.id] }));
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
const pictured = (cards: WorkCard[]) => {
  const withIds = cards.map(withMedia);
  return Promise.race([
    withImages(withIds, tmdb, kp),
    new Promise<WorkCard[]>((r) => setTimeout(() => r(withIds), 6000)),
  ]);
};

// История участника в моке: сгенерированная из его экспорта + импортированная в сессии.
// Карточки истории получают первичную разметку (userAnnotations, черновик модели) и оценку
// участника (userRatings) — оценка не показывается, это вес для модели. Дубли одного фильма
// из разных файлов экспорта (один — по ID Кинопоиска, другой — по TMDb) схлопываются.
const imported: JourneyEntryData[] = [];
const withRegisters = (w: WorkCard): WorkCard => (w.registers?.length || !workRegisters[w.id] ? w : { ...w, registers: workRegisters[w.id] });
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
 *  справочнике не было — по названию. Черновиков книг пока нет: они — после калибровки. */
const bookDraftFor = (w: WorkCard): FirstPassAnnotation | undefined => {
  const byKey = workKeys(w, w.externalIds ?? externalIds[w.id]).map((k) => bookAnnotations[k]).find(Boolean);
  if (byKey) return byKey;
  const t = (s?: string) => s?.toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  return [w.title, w.originalTitle].map((x) => x && bookAnnotations[`t:${t(x)}`]).find(Boolean) || undefined;
};
const draftFor = (w: WorkCard): FirstPassAnnotation | undefined => {
  if (w.type === 'book') return bookDraftFor(w);
  // сериал (Е4): черновик сериала — и для модели: оценённый и досмотренный сериал теперь
  // свидетельство вкуса, как фильм
  if (isSeries(w)) return seriesDraftFor(w);
  const tmdb = (w.externalIds ?? externalIds[w.id])?.tmdb;
  if (tmdb == null) return undefined;
  // отклонённый куратором черновик (Г3) не используется: лучше без разметки, чем с неверной
  const draft = reviewMarks()[`draft:tmdb:${tmdb}`]?.status === 'rejected' ? undefined : draftAnnotations[`tmdb:${tmdb}`];
  return ownAnnotationByTmdb().get(tmdb) ?? draft;
};
/** Черновик сериала (Е2): страница произведения, кураторская, а с Е4 — модель и подбор. */
const seriesDraftFor = (w: WorkCard): SeriesDraft | undefined => {
  if (!isSeries(w)) return undefined;
  const key = workKey(w, w.externalIds ?? externalIds[w.id]);
  return key && reviewMarks()[`draft:${key}`]?.status !== 'rejected' ? seriesAnnotations[key] : undefined;
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
const baseJournal = (): JourneyEntryData[] => (store.onServer ? serverJournal : [...userJournal, ...mocks.journal]);
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
  await delay(0);
  await catalog();
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
  session = { user: { id: 'demo', name: ru.login.demoName, source: 'demo' }, verified: false, startedAt: new Date().toISOString() };
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
  return [...catalog, ...pool, ...extra].filter((c) => !seen(c.work, keys));
}
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
  return h != null && h > 10 ? [ru.seriesDiary.hours(h)] : [];
};
/** Новичок в сериалах: ни одного сериала в дневнике и в просмотренном — ему только короткое. */
const seriesNovice = (): boolean =>
  ![...history().map((e) => e.work), ...watchedNow()].some((w) => isSeries(w));
/** размеченное с полки — кандидатами; без разметки (и сериалы, трек Е) в подбор не идут */
const shelfCandidates = (works: WorkCard[]): Candidate[] => works.flatMap((w) => {
  const a = draftFor(w);
  return a ? [{ work: annotated(w), what: a.what }] : [];
});

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

/** Сколько досмотренного с разметкой: только от него модель и считает состояние. */
const ratedCount = (): number =>
  history().filter((e) => e.status === 'finished' && e.work.complexityLevel > 0 && e.work.primaryOperations.length).length;

export async function getSlate(energy: Energy = 'normal'): Promise<RecommendationSlate> {
  await delay(240);
  await reconnect();
  // Новый участник: подбирать не от чего. Честно говорим, сколько оценок не хватает, а не
  // подсовываем чужую ленту — моки сценария годятся для разработки, но не для живого человека.
  const rated = ratedCount();
  if (store.onServer && rated < MIN_RATED) {
    return { id: 's-cold', generatedAt: new Date().toISOString(), energy, items: [], coldStart: { rated, needed: MIN_RATED } };
  }
  // справочник с полками и черновой разметкой: на сервере он грузится фоном, а пул без него беднее
  await catalog();
  const state = ownState();
  // Есть размеченная история — подбор по ней из пула; нет — слейт из моков (сценарий системы).
  const base = state
    ? { id: `s-${energy}-${Date.now().toString(36)}`, generatedAt: new Date().toISOString(), energy, items: recommend(state, candidates(), energy, 6, today(), { seriesNovice: seriesNovice() }) }
    : mocks.slates[energy];
  const keys = seenKeys();
  // отложенное в планы, начатое и брошенное — тоже не предлагаем: планы лежат в архиве,
  // начатое стоит над лентой, брошенное человек уже попробовал
  for (const e of history()) if (e.status !== 'finished') [e.work.id, ...keyList(e.work)].forEach((k) => keys.add(k));
  const items = base.items.filter((r) => !seen(r.work, keys) && !keys.has(r.work.id));
  // фокус на полке: одно место в ленте — лучшее с выбранных полок, если такого там ещё нет
  const focus = state ? await focusPick(state, energy, items, keys) : undefined;
  if (focus) items.splice(Math.min(items.length, 5), 1, focus);
  // «дальше во вселенной» (Ж3) — отдельным местом, сверх слотов развития: одно не подменяет другое
  const next = state ? await universePick(state, energy, items, keys) : undefined;
  if (next) items.splice(Math.min(items.length, 2), 0, next);
  const works = await pictured(items.map((r) => r.work));
  for (const r of items) slateWorks.set(r.id, r.work.id);
  // показы — знаменатель «принятия слейта» (трек Б2); не ответил сервер — лента важнее
  if (store.onServer && items.length) {
    store.impressions(base.id, energy, items.map((r, rank) => ({ recId: r.id, workId: r.work.id, slot: r.slot, rank }))).catch(() => undefined);
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
    && scoreCandidate(state, w, energy) >= 0.3);
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
      explanation: { ...rec.explanation, why: `${sequel ? ru.today.universeSequel(w.title) : ru.today.universeMore(universe, w.title)} ${rec.explanation.why}` } };
  }
  return undefined;
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
  return { ...pick, explanation: { ...pick.explanation, why: ru.today.fromShelf(shelf.title) + pick.explanation.why } };
}

// ---------- первые оценки (холодный старт) ----------

export interface RatingItem { work: WorkCard; rating?: 1 | 2 | 3 | 4 | 5 }
export interface RatingDeck {
  items: RatingItem[];
  /** отдельный ряд сериалов (Е4): своё просмотренное, потом размеченные с разборами */
  series: RatingItem[];
  rated: number;
  needed: number;
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

export async function getRatingDeck(): Promise<RatingDeck> {
  await delay(160);
  await catalog();
  // Своё просмотренное — первым: если участник прислал список (или отметил виденное сам), ему
  // проще и честнее оценить это, чем угадывать по общей колоде. Общая колода — следом, без того,
  // что уже есть в своём списке. Сериалы — отдельным рядом (Е4): их оценки тоже идут в модель.
  const own = watchedNow().filter(isFilm).map(annotated);
  const keys = new Set(own.flatMap((w) => [w.id, ...keyList(w)]));
  const common = ratingDeck
    .map((id) => deckCard(id))
    .filter((w): w is WorkCard => Boolean(w) && !keys.has(w!.id) && !keyList(w!).some((k) => keys.has(k)));
  const withRating = (work: WorkCard) => ({ work, ...(ratingOf(work.id) ? { rating: ratingOf(work.id)!.rating } : {}) });
  const items = [...own, ...common].map(withRating);
  return { items, series: seriesDeck().map(withRating), rated: ratedCount(), needed: MIN_RATED };
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
  await catalog();
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

export async function sendRecommendationFeedback(id: ID, feedback: RecommendationFeedback): Promise<{ ok: true }> {
  await delay(160);
  // принял / отложил / отказался и почему — это половина ответа на вопрос «работает ли
  // подбор»; пока отклики нигде не копились, сравнивать его было не с чем
  await store.feedback(id, slateWorks.get(id), feedback.action, feedback.reason, feedback.eagerness);
  return { ok: true } as const;
}

/** Страница произведения. Неизвестный id — undefined, экран показывает «нет такого». */
export async function getWork(id: ID): Promise<WorkDetail | undefined> {
  await delay(200);
  await Promise.all([catalog(), workRefs()]);
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
  };
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
    const names = [work.title, work.originalTitle].filter(Boolean).map((t) => searchKey(t as string));
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
}

export async function setWatched(workId: ID, watched: boolean): Promise<{ ok: true }> {
  await delay(120);
  await catalog();
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
  await catalog();
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
  await catalog();
  // засчиталась ли оценка в порог первой ленты: туда идут только размеченные фильмы (их знает модель)
  const before = ratedCount();
  const result = await markWorkInner(workId, outcome);
  return { ...result, counted: result.rated > before };
}

/** Сколько оценок не хватает до первой ленты (0 — лента есть; без сервера порога нет). */
export async function coldStartLeft(): Promise<number> {
  await delay(0);
  return store.onServer ? Math.max(0, MIN_RATED - ratedCount()) : 0;
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
  await catalog();
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

export async function getSettings(): Promise<UserSettings> {
  await delay(140);
  return settings;
}

export async function updateSettings(patch: Partial<UserSettings>): Promise<UserSettings> {
  await delay(160);
  settings = { ...settings, ...patch };
  await store.settings(patch);
  return settings;
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
    s.harder ? ru.curator.loopHarder(s.harder) : '', s.easier ? ru.curator.loopEasier(s.easier) : '',
    s.abandonFit ? ru.curator.loopAbandon(s.abandonFit) : '', s.dismissFit ? ru.curator.loopDismiss(s.dismissFit) : '',
  ].filter(Boolean);
  return `${parts.join(' · ')} (${ru.curator.loopChecks(s.checks)})`;
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
    work: { id: d.work.id, type: d.work.type, title: d.season ? ru.curator.seasonOf(d.work.title, d.season) : d.work.title,
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
    const opName = (op: CognitiveOperation) => ru.operations[op]?.short ?? op;
    return [
      { path: ru.curator.draftFields.what, draft: a.what, current: null, confidence: conf },
      { path: ru.curator.draftFields.level, draft: String(a.level), current: null, confidence: conf },
      { path: ru.curator.draftFields.ops, draft: a.ops.map(([op, x]) => `${opName(op)} ${x.toFixed(1)}`).join(', '), current: null, confidence: conf },
      { path: ru.curator.draftFields.barriers, draft: a.barriers.join(', ') || '—', current: null },
      { path: ru.curator.draftFields.warnings, draft: a.warnings.join(', ') || '—', current: null },
      { path: ru.curator.draftFields.niche, draft: a.niche ? ru.curator.draftFields.yes : ru.curator.draftFields.no, current: null },
      // поправки сезонов обычного сериала (Е2): что в сезоне иначе, чем в сериале
      ...Object.entries(d.seasons ?? {}).map(([n, x]) => ({
        path: ru.curator.draftFields.season(Number(n)), draft: `${ru.curator.draftFields.level.toLowerCase()} ${x.level} · ${x.what}`, current: null, confidence: x.confidence,
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
  for (const a of extra) {
    if (haveUrl.has(a.url) || haveTitle.has(norm(a.title))) continue;
    haveUrl.add(a.url);
    haveTitle.add(norm(a.title));
    out.push(a);
  }
  return out;
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
    .map((i) => ({ ...i, analyses: [...i.analyses].sort((x, y) => stamp(y) - stamp(x)) }))
    .sort((a, b) => stamp(b.analyses[0]) - stamp(a.analyses[0]));
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
}

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
  const about = aboutOrder(isPersonId(ref) ? (await aboutVideos()).person[ref] ?? [] : []);
  // человек без работ в каталоге, но с роликами о нём — страница всё равно есть
  if ((!byWork.size && !about.length) || !name) return undefined;
  const person: Person = known ?? { id: ref, name };

  const analyses: PersonPage['analyses'] = [];
  const count = new Map<string, number>();
  for (const { work, key } of byWork.values()) {
    if (!key) continue;
    const seen = seenIds.has(work.id) || seenKeys.has(key);
    const seenUrl = new Set<string>();
    for (const src of [essays, essaysAuto, postsAuto]) {
      for (const a of src[key] ?? []) {
        if (a.tier === 'review' || seenUrl.has(a.url) || linkVerdicts.get(a.url) === 'other_work') continue;
        seenUrl.add(a.url);
        analyses.push({ work, analysis: a, seen });
      }
    }
    count.set(key, seenUrl.size);
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
    person, wikidata: Boolean(known), roles, works, analyses: analyses.slice(0, 24), about,
    ...(pick ? { startWith: { work: pick.work, why: comfort != null ? 'near' as const : 'entry' as const, level: pick.work.complexityLevel } } : {}),
    trajectories,
  };
}

/** Ролики о франшизе и о человеке (src/mocks/essaysAbout.ts, 02.10) — подгружаются со страницей. */
let aboutLoad: Promise<{ universe: Record<string, ExternalAnalysis[]>; person: Record<string, ExternalAnalysis[]> }> | undefined;
const aboutVideos = () => (aboutLoad ??= import('@/mocks/essaysAbout').then((m) => m.essaysAbout));
/** эссе первыми, обзоры за ними; внутри — свежие первыми */
const aboutOrder = (list: ExternalAnalysis[]): ExternalAnalysis[] => [...list].sort((a, b) =>
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
  const work = mocks.works[workId] ?? history().find((e) => e.work.id === workId)?.work;
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

/** Импорт собственной истории: экспорты Letterboxd / IMDb / Goodreads / StoryGraph, файлы
 *  конвертера с Кинопоиска или сохранённые из браузера страницы «Оценки» профиля — сразу
 *  несколько файлов одного человека. Разбор на клиенте; сюда — уже текст файлов. Каталог с внешними ID — как его вернёт
 *  резолвер. Неразобранный формат — undefined. Записи в дневник пока не сохраняются:
 *  эндпоинта нет, экран показывает результат сопоставления. */
export async function importHistory(files: string | string[]): Promise<(ImportOutcome & { sources: ImportSource[]; resolved: number }) | undefined> {
  await delay(300);
  await loadCatalog();
  const parsed = parseExports(Array.isArray(files) ? files : [files]);
  if (!parsed.sources.length) return undefined;
  // Сверяемся со всем, что уже знаем: каталог, история, присланный список и справочник из
  // мастер-списка. Иначе знакомый фильм уходит в резолвер по сети и заводится второй раз.
  const catalog = [
    ...Object.values(mocks.works).map((w) => ({ ...w, externalIds: w.externalIds ?? externalIds[w.id] })),
    ...userWorks, ...watchedNow(), ...filmBase,
  ];
  const today = new Date().toISOString().slice(0, 10);
  const outcome = toJourneyEntries(parsed.records, catalog, today);
  // Чего нет в каталоге — резолвим во внешних базах и заводим карточки без разметки
  const resolved = await resolveRecords(outcome.unmatched, { tmdb, kp });
  const unmatched: ImportOutcome['unmatched'] = [];
  resolved.forEach((w, i) => {
    const r = outcome.unmatched[i];
    // у сериала номер TMDb — из своего пространства: в ключе он с фильмом совпадать не должен
    const key = w.externalIds.kinopoisk != null ? `kp${w.externalIds.kinopoisk}` : w.externalIds.imdb
      ?? (w.externalIds.tmdb != null ? `${w.type === 'series' ? 'tmdbtv' : 'tmdb'}${w.externalIds.tmdb}` : w.externalIds.isbn?.[0]);
    const card = key ? toWorkCard(w, `u-${key}`) : undefined;
    if (!card?.title) { unmatched.push(r); return; }
    outcome.entries.push({
      id: `uj-${key}`, work: card, status: r.status,
      startedAt: r.status === 'planned' ? undefined : r.date ?? today,
      finishedAt: r.status === 'finished' ? r.date ?? today : undefined,
      reflections: [], stateChanges: [],
    });
  });
  const known = new Set(history().map((e) => e.id));
  imported.unshift(...outcome.entries.filter((e) => !known.has(e.id)));
  return { sources: parsed.sources, resolved: outcome.unmatched.length - unmatched.length, ...outcome, unmatched };
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

export async function isOwnerSession(): Promise<boolean> {
  await delay(0);
  return Boolean(profile?.owner);
}

/** Отчёт петли: калибровка, совпадения, отказы, принятие слейта. Без сервера — нечего считать. */
export async function getLoopReport(scope: 'all' | 'me' = 'all'): Promise<LoopReportData | undefined> {
  await delay(120);
  return (await fetchLoopReport(scope)) as LoopReportData | undefined;
}
