// Слой данных: сигнатуры под будущие эндпоинты. Возвращает моки с задержкой,
// чтобы состояния загрузки были видны в разработке. Бизнес-логики здесь нет:
// уровень усилия, готовность, спойлерность и тексты приходят как данные.
import ru from '@/i18n/ru';
import { parseExports, toJourneyEntries, type ImportOutcome, type ImportSource } from '@/lib/import';
import { kinopoiskFromEnv, resolveRecords, toWorkCard, tmdbFromEnv, withImages } from '@/lib/resolve';
import { ratingDeck } from '@/mocks/ratingDeck';
import { deriveMap, deriveState, type RatedEntry } from '@/lib/model/deriveState';
import { difficultyOdds, expectedDifficulty, recommend, type Candidate } from '@/lib/model/recommend';
import { knownVoice, voiceOf } from '@/lib/voices';
import { apiBase, fetchLoopReport, loadState, store, type StoredState } from './store';
import { displayName, parseInitData } from '@/lib/telegramAuth';
import type { LoopReport as LoopReportCore } from '../../worker/loop';
export type LoopReportData = LoopReportCore & { scope: 'all' | 'me' };
import type {
  AgreementReport, AnnotationProvider, AnnotationReviewItem, AnnotationStatus, AssessmentAnswer, AssessmentMode,
  AssessmentSession, CheckInRequest, CheckInResult, CognitiveMapData, CognitiveOperation,
  AgreementCeilingData, AnnotationDiffRow, AnnotationRun, CoMention, Confidence, ContributorAnswer, ContributorProfile, ContributorTask,
  ContributorTaskKind, DiscussionPlace, ExternalAnalysis, FilmForm, QualityMetric, TagNeighbour, TropeMention, TropeTreeNode, Energy, ID, JourneyEntryData,
  JourneyStatus, PacketReport, RecommendationFeedback, RecommendationSlate, ReflectionPromptData,
  DifficultyPrediction, Eagerness, PerceivedDifficulty,
  Session, SourceCandidate, Trajectory, TvTropesMapping, UserSettings, Voice, WorkCard, WorkDetail,
} from '@/types/tmdf';


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
let catalogLoad: Promise<void> | undefined;
const loadCatalog = (): Promise<void> => catalog();
/** Справочник фильмов и история владельца. Повторный вызов ждёт ту же загрузку. */
function catalog(): Promise<void> {
  catalogLoad ??= Promise.all([
    import('@/mocks/userHistory'), import('@/mocks/userRatings'), import('@/mocks/userWatched'),
    import('@/mocks/filmBase'), import('@/mocks/filmBaseWiki'),
    serverRef<WorkCard[]>('filmBaseWiki'),
  ]).then(([uh, ur, uw, fb, fw, freshWiki]) => {
    userWorks = uh.userWorks; userJournal = uh.userJournal; userRatings = ur.userRatings;
    watchedWorks = uw.watchedWorks; filmBase = fb.filmBase; filmBaseWiki = freshWiki ?? fw.filmBaseWiki;
  });
  return catalogLoad;
}

let filmForm: Record<string, FilmForm> = {};
let tagNeighbours: Record<string, TagNeighbour[]> = {};
let filmTropes: Record<string, TropeMention[]> = {};
let comentions: Record<string, CoMention[]> = {};
let workRefsLoad: Promise<void> | undefined;
/** Замеры и соседи по фильму — только экран «Произведение». */
function workRefs(): Promise<void> {
  workRefsLoad ??= Promise.all([
    import('@/mocks/filmForm'), import('@/mocks/tagNeighbours'), import('@/mocks/filmTropes'), import('@/mocks/comentions'),
    serverRef<Record<string, CoMention[]>>('comentions'),
  ]).then(([ff, tn, ft, cm, freshCo]) => {
    filmForm = ff.filmForm; tagNeighbours = tn.tagNeighbours; filmTropes = ft.filmTropes; comentions = freshCo ?? cm.comentions;
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
  const [state] = await Promise.all([loadState(), loadCore(), store.onServer ? undefined : catalog()]);
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
const withMedia = (c: WorkCard): WorkCard => ({ ...c, ...catalogMedia[c.id], externalIds: c.externalIds ?? catalogMedia[c.id]?.externalIds ?? externalIds[c.id] });
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
const annotated = (w: WorkCard): WorkCard => {
  const a = userAnnotations[w.id];
  const r = withRegisters(w);
  return a && !w.primaryOperations.length
    ? { ...r, primaryOperations: a.ops.map(([op, intensity]) => ({ op, intensity })), complexityLevel: a.level,
        barriers: a.barriers, warnings: a.warnings, isNicheMasterpiece: a.niche }
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

/** Сколько оценок нужно, чтобы подбор стал подбором, а не угадыванием. */
export const MIN_RATED = 10;

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
const declaredSeen = (): WorkCard[] => watchedNow().map(withRegisters);

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
  return [...catalog, ...pool].filter((c) => !seen(c.work, keys));
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
    || (ids.kinopoisk != null && keys.has(`kp:${ids.kinopoisk}`)) || ids.isbn?.some((i) => keys.has(`isbn:${i}`))));
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
  const state = ownState();
  // Есть размеченная история — подбор по ней из пула; нет — слейт из моков (сценарий системы).
  const base = state
    ? { id: `s-${energy}-${Date.now().toString(36)}`, generatedAt: new Date().toISOString(), energy, items: recommend(state, candidates(), energy, 6, today()) }
    : mocks.slates[energy];
  const keys = seenKeys();
  // отложенное в планы, начатое и брошенное — тоже не предлагаем: планы лежат в архиве,
  // начатое стоит над лентой, брошенное человек уже попробовал
  for (const e of history()) if (e.status !== 'finished') [e.work.id, ...keyList(e.work)].forEach((k) => keys.add(k));
  const items = base.items.filter((r) => !seen(r.work, keys) && !keys.has(r.work.id));
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

// ---------- первые оценки (холодный старт) ----------

export interface RatingItem { work: WorkCard; rating?: 1 | 2 | 3 | 4 | 5 }
export interface RatingDeck { items: RatingItem[]; rated: number; needed: number }

/** Карточка фильма из колоды: справочник истории, пул подбора или каталог — с разметкой,
 *  регистрами и кадром. */
function deckCard(id: ID): WorkCard | undefined {
  const fromHistory = userWorks.find((w) => w.id === id);
  if (fromHistory) return annotated(fromHistory);
  const candidate = candidateCard(id);
  if (candidate) return withRegisters(candidate);
  const catalog = (mocks.works as Record<string, WorkCard>)[id];
  return catalog ? withRegisters(withMedia(catalog)) : undefined;
}

export async function getRatingDeck(): Promise<RatingDeck> {
  await delay(160);
  await catalog();
  // Своё просмотренное — первым: если участник прислал список (или отметил виденное сам), ему
  // проще и честнее оценить это, чем угадывать по общей колоде. Сериалы не оцениваем: подбор
  // только по фильмам. Общая колода — следом, без того, что уже есть в своём списке.
  const own = watchedNow().filter((w) => w.type === 'film' && w.format !== 'series').map(withRegisters);
  const keys = new Set(own.flatMap((w) => [w.id, ...keyList(w)]));
  const common = ratingDeck
    .map((id) => deckCard(id))
    .filter((w): w is WorkCard => Boolean(w) && !keys.has(w!.id) && !keyList(w!).some((k) => keys.has(k)));
  const items = [...own, ...common]
    .map((work) => ({ work, ...(ratingOf(work.id) ? { rating: ratingOf(work.id)!.rating } : {}) }));
  return { items, rated: ratedCount(), needed: MIN_RATED };
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
  const own = history().find((e) => e.work.id === id)?.work ?? candidateCard(id)
    ?? watchedNow().find((w) => w.id === id) ?? filmBase.find((w) => w.id === id) ?? filmBaseWiki.find((w) => w.id === id);
  const detail = workDetail(id) ?? (own ? bare(own) : undefined);
  if (!detail) return undefined;
  const [card] = await pictured([{ ...detail, externalIds: detail.externalIds ?? externalIds[id] }]);
  const nearby = nearbyFor(card);
  const form = formFor(card);
  const similarByTags = tagsFor(card);
  const tropeMentions = tropesFor(card);
  return {
    ...detail, ...card,
    externalAnalyses: analysesFor(card, detail.externalAnalyses),
    ...(nearby.length ? { nearby } : {}),
    ...(form ? { form } : {}),
    ...(similarByTags.length ? { similarByTags } : {}),
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
    const key = ids?.tmdb != null ? `tmdb:${ids.tmdb}` : ids?.isbn?.length ? `isbn:${ids.isbn[0]}` : work.id;
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
        if (work) watchedAdded.set(row.workId, work);
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
      if (work) watchedAdded.set(workId, work);
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

export async function checkIn(entryId: ID, request: CheckInRequest): Promise<CheckInResult> {
  await delay(320);
  // Настоящая запись дневника, а не мок сценария: раньше чек-ин уходил на сервер с чужим
  // workId, и петля считала бы не тот фильм (найдено 24.09)
  const entry = [...imported, ...baseJournal()].find((e) => e.id === entryId);
  const result = buildCheckInResult(entryId, request);
  if (entry) {
    entry.status = request.status;
    entry.finishedAt = new Date().toISOString();
    if (request.perceivedDifficulty) entry.perceivedDifficulty = request.perceivedDifficulty;
    if (request.abandonReason) entry.abandonReason = request.abandonReason;
    result.entry = withPrediction({ ...entry });
    const state = ownState();
    if (state) {
      result.newState = state;
      // «что дальше» — из настоящего подбора, а не из сценария с книгой (найдено 24.09)
      const next = recommend(state, candidates(), settings.energy ?? 'normal', 1, today())[0];
      if (next) result.nextRecommendation = next;
    }
  }
  await store.checkIn(entryId, entry?.work.id ?? result.entry.work.id, {
    status: request.status,
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
  ...i, status: reviewed.get(i.annotationId) ?? i.status, signals: curator.signals[i.annotationId],
});

export async function getCuratorQueue(filters?: { status?: AnnotationStatus; provider?: AnnotationProvider }): Promise<AnnotationReviewItem[]> {
  await delay(260);
  await curatorRefs();
  return mocks.curatorQueue.map(queueItem)
    .filter((i) => (!filters?.status || i.status === filters.status) && (!filters?.provider || i.provider === filters.provider))
    .sort((a, b) => CONF_ORDER[a.overallConfidence] - CONF_ORDER[b.overallConfidence]);
}

export async function getAnnotation(id: ID): Promise<AnnotationReviewItem | undefined> {
  await delay(200);
  await curatorRefs();
  const item = mocks.curatorQueue.find((i) => i.annotationId === id);
  return item && queueItem(item);
}

/** Сверх §17 (22.09): решение по аннотации, разница черновика и публикации, таксономия,
 *  прогоны, качество и потолок — данные кураторских экранов, у которых эндпоинтов не было. */
export async function reviewAnnotation(id: ID, decision: 'approve' | 'reject'): Promise<AnnotationReviewItem | undefined> {
  await delay(240);
  await curatorRefs();
  const item = mocks.curatorQueue.find((i) => i.annotationId === id);
  if (!item) return undefined;
  reviewed.set(id, decision === 'approve' ? 'approved' : 'rejected');
  return queueItem(item);
}

export async function getAnnotationDiff(id: ID): Promise<AnnotationDiffRow[]> {
  await delay(180);
  await curatorRefs();
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
  const ids = work.externalIds ?? externalIds[work.id];
  const keys = [
    ...(ids?.tmdb != null ? [`tmdb:${ids.tmdb}`] : []),
    ...(ids?.isbn ?? []).map((isbn) => `isbn:${isbn}`),
  ];
  const self = new Set(keys);
  return keys.flatMap((k) => comentions[k] ?? []).filter((c) => !self.has(c.key));
}

/** Темп речи и тишины: замер по субтитрам, ключ тот же, что у разборов. Есть только у
 *  фильмов и только у тех, что нашлись в корпусе (889 из 1030). */
function formFor(work: WorkCard): FilmForm | undefined {
  if (work.type !== 'film') return undefined;
  const tmdb = (work.externalIds ?? externalIds[work.id])?.tmdb;
  return tmdb != null ? filmForm[`tmdb:${tmdb}`] : undefined;
}

/** Кому приписывают те же теги. Себя из списка убираем на всякий случай — ключ у карточки
 *  и у соседа один и тот же формат. */
function tagsFor(work: WorkCard): TagNeighbour[] {
  if (work.type !== 'film') return [];
  const tmdb = (work.externalIds ?? externalIds[work.id])?.tmdb;
  if (tmdb == null) return [];
  const key = `tmdb:${tmdb}`;
  return (tagNeighbours[key] ?? []).filter((t) => t.key !== key);
}

/** Приёмы, отмеченные на TV Tropes: есть у 289 фильмов из 1030. Те, что уже разобраны
 *  руками в `tropeInsights`, из списка убираем — иначе один приём стоит в карточке дважды,
 *  и во второй раз без объяснения, как он тут работает. */
function tropesFor(work: WorkCard): TropeMention[] {
  if (work.type !== 'film') return [];
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
  const ids = work.externalIds ?? externalIds[work.id];
  const keys = [
    ...(ids?.tmdb != null ? [`tmdb:${ids.tmdb}`] : []),
    ...(ids?.isbn ?? []).map((isbn) => `isbn:${isbn}`),
  ];
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
  return { voice, items };
}

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
    ...watchedNow(),
    ...filmBase,
    // фильмы, о которых говорят каналы (Wikidata, 23.09): нужны, чтобы разборы было к чему
    // привязывать; разметки у них нет, в подбор не идут
    ...filmBaseWiki,
  ];
}

/** Карточки по ключу разбора — чтобы задание «тот ли фильм» знало, о чём спрашивает. */
function worksByAnalysisKey(): Map<string, WorkCard> {
  const out = new Map<string, WorkCard>();
  for (const w of knownWorks()) {
    const ids = w.externalIds ?? externalIds[w.id];
    // ключ тот же, что у генераторов: фильм — по TMDb, книга — по ISBN
    const key = ids?.tmdb != null ? `tmdb:${ids.tmdb}` : ids?.isbn?.length ? `isbn:${ids.isbn[0]}` : undefined;
    if (key && !out.has(key)) out.set(key, w);
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
    const key = w.externalIds.kinopoisk != null ? `kp${w.externalIds.kinopoisk}` : w.externalIds.imdb
      ?? (w.externalIds.tmdb != null ? `tmdb${w.externalIds.tmdb}` : w.externalIds.isbn?.[0]);
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
