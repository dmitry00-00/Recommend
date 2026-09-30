// Контракт данных Transformative Media — §16 общего промпта.
// После старта разработки источник истины — OpenAPI бэкенда, и этот файл
// генерируется из него. До тех пор он и есть контракт: компоненты и слой
// данных типизируются только отсюда.

export type ID = string;
export type ISODate = string;
export type MediaType = 'film' | 'book';

export type CognitiveOperation =
  | 'pattern_recognition' | 'causal_reasoning' | 'perspective_taking' | 'analogical_thinking'
  | 'synthesis' | 'abstraction' | 'metacognition' | 'critical_analysis';

export type TropeUsageType = 'straight' | 'deconstruction' | 'subversion' | 'reconstruction' | 'meta';
/** Ценностный заряд исполнения (шкала Макки): позитив → противоположность → противоречие →
 *  отрицание отрицания — негатив, который выглядит как позитив. Вторая ось к TropeUsageType. */
export type ValueCharge = 'positive' | 'contrary' | 'contradictory' | 'negation_of_negation';
/** Есть ли у произведения герой с читаемой целью. 'none' — сам по себе барьер артхауса. */
export type DesireModel = 'goal_driven' | 'diffuse' | 'none';
export type StretchLevel = 'easy_entry' | 'productive' | 'challenge';
export type Confidence = 'low' | 'medium' | 'high';
export type SpoilerLevel = 0 | 1 | 2;
export type Energy = 'low' | 'normal' | 'high';
export type StateChangeType = 'refined_estimate' | 'observed_growth';
export type RecommendationSlot = 'next_step' | 'stretch' | 'side_step' | 'preparation';
export type StepStatus = 'locked' | 'available' | 'in_progress' | 'completed' | 'skipped';
export type JourneyStatus = 'planned' | 'in_progress' | 'finished' | 'abandoned';
export type PerceivedDifficulty = 'too_easy' | 'just_right' | 'too_hard';
export type AbandonReason = 'too_hard' | 'not_engaging' | 'no_time' | 'distracted' | 'other';
export type DismissReason = 'too_heavy_now' | 'not_interested' | 'already_know' | 'unavailable' | 'other';
export type FamiliarityLevel = 'unknown' | 'seen' | 'remember_well' | 'revisited' | 'analyzed';
export type AssessmentMode = 'quick' | 'full';
export type ContributorRole = 'expert' | 'community';
export type ContributorTaskKind =
  | 'pairwise' | 'trope_check' | 'barrier_vote' | 'mechanism_note' | 'desire_check'
  /** «тот ли это фильм»: подтверждение разбора, найденного автоматически по названию */
  | 'link_check';
export type AnnotationStatus =
  | 'queued' | 'annotating' | 'validation_failed' | 'needs_review' | 'approved' | 'published' | 'rejected';
export type AnnotationProvider =
  | 'local' | 'packet' | 'anthropic_api' | 'human' | 'expert_consensus' | 'tvtropes';

// ---------- произведения ----------

export interface OperationIntensity { op: CognitiveOperation; intensity: number }

/** Откуда изображения: TMDb (постер и кадр, по ключу, с атрибуцией), Open Library (обложки),
 *  неофициальный API Кинопоиска (постер, кадр, описание, где посмотреть; сторонний сервис). */
export type ImageSource = 'tmdb' | 'open_library' | 'kinopoisk_unofficial';

/** Где посмотреть легально: онлайн-кинотеатр и ссылка на страницу произведения там. */
export interface WatchOption {
  platform: string;
  url: string;
  logoUrl?: string;
  source: 'kinopoisk_unofficial' | 'tmdb';
}

export interface WorkCard {
  id: ID;
  type: MediaType;
  /** 'series' — сериал: его можно отметить виденным (это свидетельство вкуса), но в подбор и
   *  в колоду оценок он не идёт — модель считает по фильмам */
  format?: 'series';
  title: string;
  originalTitle?: string;
  year: number;
  creators: string[];
  countries?: string[];
  /** постер или обложка */
  coverUrl?: string;
  /** кадр из фильма (backdrop TMDb / обложка Кинопоиска) — то, что ложится в рамку и на баннер */
  stillUrl?: string;
  imageSource?: ImageSource;
  /** короткое описание из источника — для истории и архива, где нет объяснения рекомендации */
  blurb?: string;
  watch?: WatchOption[];
  durationMinutes?: number;
  pages?: number;
  /** пусто — произведение ещё не размечено (импорт истории, резолвер) */
  primaryOperations: OperationIntensity[];
  /** 0 — не размечено */
  complexityLevel: number;
  warnings: string[];
  barriers: string[];
  isNicheMasterpiece: boolean;
  externalIds?: ExternalIds;
  signals?: ExternalSignal[];
  /** тональный регистр — ось вкуса; пусто — не размечено */
  registers?: Register[];
}

/** Тональный регистр — «как произведение с вами разговаривает». Ось вкуса, а не сложности.
 *  Появился, когда список просмотренного участника (22.09) оказался втрое богаче фольклорным
 *  ужасом, чем выгрузка с оценками, по которой строилась модель: уровень и операции такого
 *  различия не видят вовсе. Оценки регистр не предсказывает и не должен — он про то, что
 *  человек выбирает смотреть. Один-два на произведение; пусто — не размечено. */
export type Register =
  | 'folk_gothic' | 'body_visceral' | 'cold_clinical' | 'genre_idea'
  | 'puzzle_noir' | 'absurd_satire' | 'quiet_realism' | 'myth_adventure';

export interface Prerequisite {
  kind?: 'work' | 'concept' | 'context';
  label: string;
  work?: WorkCard;
  necessity?: 'required' | 'helpful';
  met?: boolean;
}

export interface TropeInsightData {
  tropeId: ID;
  tropePath: string[];
  name: string;
  usage: TropeUsageType;
  operations: CognitiveOperation[];
  spoilerLevel: SpoilerLevel;
  plainExplanation: string;
  charge?: ValueCharge;
}

/** Явное и подавленное желание персонажа. Подавленное — интерпретация, поэтому с уверенностью;
 *  visibility — мера спроса на перспективу: 0 проговорено, 1 читается по поступкам,
 *  2 только по устройству и противоречиям. */
export interface CharacterDesire {
  character: string;
  explicit: string;
  suppressed?: string;
  visibility: 0 | 1 | 2;
  spoilerLevel: SpoilerLevel;
  confidence: Confidence;
}

/** Идентификаторы во внешних базах — хаб Wikidata, остальное подтягивается по нему. */
export interface ExternalIds {
  wikidata?: string;
  imdb?: string;
  tmdb?: number;
  kinopoisk?: number;
  isbn?: string[];
  openLibrary?: string;
  fantlab?: number;
}

/** Внешний сигнал с провенансом и лицензией — как attribution у отображений TV Tropes.
 *  Это улика о барьере, не оценка качества: в ленте числа не показываются. */
export interface ExternalSignal {
  kind: 'polarization' | 'critic_audience_gap' | 'vote_count' | 'availability';
  source: 'tmdb' | 'trakt' | 'fantlab' | 'imdb_dataset' | 'movielens' | 'open_library' | 'google_books';
  value: number;
  fetchedAt: ISODate;
  license: string;
}

export interface ExternalAnalysis {
  id: ID;
  title: string;
  author: string;
  platform: 'youtube' | 'vk' | 'telegram' | 'article' | 'podcast' | 'other';
  url: string;
  language: string;
  spoilerLevel: SpoilerLevel;
  operations?: CognitiveOperation[];
  /** превью ролика или поста: без него список разборов — стопка одинаковых прямоугольников */
  previewUrl?: string;
  /** сколько это смотреть: разбор на полтора часа — другое решение, чем на десять минут */
  durationMinutes?: number;
  publishedAt?: ISODate;
  /** рубрики канала, под которыми вышел пост («#спгс», «#тревожныйсмотр»): канал сам ими
   *  говорит, что это за пост, и это короче любого нашего описания */
  tags?: string[];
  /** найдено автоматически по названию и человеком не подтверждено: показывается отдельно и
   *  с оговоркой, потому что совпадение названий врёт (ролик про «Тёмного рыцаря» ловится
   *  на «Джокера»). Подтверждает кураторская. */
  unverified?: boolean;
  /** чем привязка подтверждена без человека: ссылка на страницу фильма, год рядом с
   *  названием или оригинальное название (tools/evidence.mts, трек В3). Есть улика — нет
   *  `unverified`. `human` — сильнее всех: пару подтвердил человек в таблице разметки
   *  (tools/markup-verdicts.json), догадкам машины эта привязка больше не подчиняется. */
  evidence?: 'link' | 'year' | 'original' | 'human';
  /** ярус канала (src/mocks/sources.ts): `review` — обзорщик. Обзоры в приложении не
   *  показываем (решение владельца 29.09): они нужны подбору — широкий спектр параметров
   *  фильма и поправки к модели, — а не человеку; иначе лента скатывается в каталог
   *  треш-обзоров. Нет поля — эссе или пост. */
  tier?: 'review';
}

/** Выход автора: где его ещё можно читать, смотреть и спрашивать. Один автор ведёт канал
 *  на YouTube, канал в Telegram и чат при нём — в карточке это одно лицо с несколькими
 *  выходами, а не три разных источника. */
export interface VoiceOutlet {
  kind: 'youtube' | 'telegram' | 'chat';
  title: string;
  url: string;
}

/** Автор разборов как лицо, а не как строка в поле `author`: под одним именем у нас
 *  «4то за Персонаж?» на YouTube и «Что за персонаж?» в Telegram. Площадки
 *  (`platform`) и студии (`studio`) заведены здесь же, чтобы их можно было узнать и
 *  не показывать среди разборов: их материал — анонс своей премьеры, а не разбор. */
export interface Voice {
  id: ID;
  title: string;
  /** подпись под иконкой: одна строка, длинное имя обрезается многоточием */
  short: string;
  role: 'author' | 'platform' | 'studio';
  avatarUrl?: string;
  outlets: VoiceOutlet[];
}

/** Материалы одного автора об одном произведении: ролики и посты вместе, потому что в
 *  карточке выбирают автора, а не платформу. */
export interface WorkVoice {
  voice: Voice;
  items: ExternalAnalysis[];
}

export interface WorkDetail extends WorkCard {
  synopsis: string;
  whatItDoes: { op: CognitiveOperation; description: string }[];
  tropeInsights: TropeInsightData[];
  prerequisites: Prerequisite[];
  inTrajectories: { trajectoryId: ID; title: string; stepOrder: number }[];
  relatedWorks: { relation: 'prepares_for' | 'continues' | 'contrasts' | 'similar_structure'; work: WorkCard }[];
  externalAnalyses: ExternalAnalysis[];
  /** кого называют в одном посте с этим — сигнал разговора, не наша похожесть */
  nearby?: CoMention[];
  /** темп речи и тишины, посчитанный по субтитрам */
  form?: FilmForm;
  /** кому приписывают те же теги — похожесть по чужим описаниям */
  similarByTags?: TagNeighbour[];
  /** приёмы, отмеченные на TV Tropes: не наша разметка, показывается с оговоркой */
  tropeMentions?: TropeMention[];
  contributorsCredit: string[];
  desireModel?: DesireModel;
  characters?: CharacterDesire[];
}

// ---------- модель пользователя ----------

export interface OperationEstimate {
  op: CognitiveOperation;
  level: number;
  range: [number, number];
  confidence: Confidence;
  trend: 'up' | 'flat' | 'down' | 'unknown';
}

/** Насколько участнику заходит регистр: −1 — избегает, 0 — ровно, +1 — любит.
 *  `n` — на скольких произведениях это видно (меньше четырёх — почти догадка). */
export interface RegisterAffinity {
  register: Register;
  affinity: number;
  n: number;
}

export interface CognitiveState {
  userId: ID;
  asOf: ISODate;
  operations: OperationEstimate[];
  complexityComfort: number;
  mediaLiteracy: number;
  overallConfidence: Confidence;
  source: 'assessment_quick' | 'assessment_full' | 'activity' | 'checkpoint';
  /** вкус по регистру из истории — не показатель развития, а то, на каком языке с участником говорить */
  registerTaste?: RegisterAffinity[];
}

export interface DevelopmentTarget {
  id: ID;
  operations: CognitiveOperation[];
  label: string;
  source: 'user' | 'system_suggested';
  createdAt: ISODate;
  active: boolean;
}

export interface StateChangeCause {
  kind: 'assessment' | 'work_finished' | 'work_abandoned' | 'reflection' | 'checkpoint';
  label: string;
  workId?: ID;
  changeType: StateChangeType;
}

export interface StateHistoryPoint {
  asOf: ISODate;
  operations: { op: CognitiveOperation; level: number; range: [number, number] }[];
  cause: StateChangeCause;
}

export interface CognitiveMapData {
  state: CognitiveState;
  history: StateHistoryPoint[];
  targets: DevelopmentTarget[];
  suggestedTargets: DevelopmentTarget[];
  traces: { work: WorkCard; finishedAt: ISODate; operations: OperationIntensity[] }[];
}

// ---------- рекомендации ----------

export interface RecommendationExplanation {
  what: string;
  why: string;
  whyNow: string;
  whatNext: string;
}

export interface TrajectoryStepData {
  order: number;
  work: WorkCard;
  purpose: string;
  status: StepStatus;
  stretch: StretchLevel;
  operationsIntroduced: CognitiveOperation[];
  operationsReinforced: CognitiveOperation[];
}

export interface Readiness {
  ready: boolean;
  missing: Prerequisite[];
  preparationPath?: TrajectoryStepData[];
}

export interface Recommendation {
  id: ID;
  work: WorkCard;
  slot: RecommendationSlot;
  stretch: StretchLevel;
  targetOperations: CognitiveOperation[];
  explanation: RecommendationExplanation;
  readiness: Readiness;
  trajectoryId?: ID;
  createdAt: ISODate;
  /** разборы авторов и места разговора прямо на кадре — то, что видно и без механики (21.09) */
  analyses?: ExternalAnalysis[];
  discussions?: DiscussionPlace[];
}

export interface RecommendationSlate {
  id: ID;
  generatedAt: ISODate;
  energy: Energy;
  items: Recommendation[];
  /** подбирать пока не от чего: у участника меньше оценок, чем нужно модели */
  coldStart?: { rated: number; needed: number };
}

/** «Насколько хочется» — ожидание до просмотра, 1–5. Не оценка увиденного: модели нужны обе,
 *  иначе не отличить «не угадали с фильмом» от «угадали, но человек так и не дошёл». */
export type Eagerness = 1 | 2 | 3 | 4 | 5;

export interface RecommendationFeedback {
  action: 'start' | 'save' | 'dismiss';
  reason?: DismissReason;
  eagerness?: Eagerness;
  comment?: string;
}

// ---------- маршруты ----------

export interface Trajectory {
  id: ID;
  title: string;
  kind: 'development' | 'peak_path';
  target: DevelopmentTarget;
  peakWork?: WorkCard;
  steps: TrajectoryStepData[];
  progress: number;
  replanHistory: { at: ISODate; reason: string }[];
  createdAt: ISODate;
}

// ---------- дневник и после просмотра ----------

export interface ReflectionPromptData {
  id: ID;
  op: CognitiveOperation;
  question: string;
  kind: 'free_text' | 'choice';
  options?: string[];
}

/** Прогноз перед началом: чего ждёт участник и чего ждала модель. После просмотра он
 *  сверяется с `perceivedDifficulty` — это единственные собственные данные приложения, по
 *  которым видно, угадывает подбор или нет (ROADMAP, этап 1). Участнику показывается его
 *  собственная сверка; строка про модель — внутренняя, её видно только с механикой. */
export interface DifficultyPrediction {
  expected: PerceivedDifficulty;
  /** чего ждала модель на момент старта: проверяем не участника, а себя */
  model?: PerceivedDifficulty;
  /** то же вероятностями — для калибровки (Брайер) */
  modelOdds?: Record<PerceivedDifficulty, number>;
  at: ISODate;
}

export interface JourneyEntryData {
  id: ID;
  work: WorkCard;
  status: JourneyStatus;
  progress?: number;
  startedAt?: ISODate;
  finishedAt?: ISODate;
  perceivedDifficulty?: PerceivedDifficulty;
  /** что участник (и модель) ждали до начала — для сверки после */
  prediction?: DifficultyPrediction;
  abandonReason?: AbandonReason;
  /** отложено в планы свайпом: насколько хотелось (1–5) */
  eagerness?: Eagerness;
  /** «смотрит» выведено из перехода в онлайн-кинотеатр, а не отмечено руками */
  inferred?: boolean;
  reflections: { promptId: ID; answer: string }[];
  stateChanges: { op: CognitiveOperation; delta: number; changeType: StateChangeType }[];
  /** разборы этого произведения — в архиве они и нужны: после просмотра спойлеров бояться нечего */
  analyses?: ExternalAnalysis[];
}

export interface CheckInRequest {
  status: 'finished' | 'abandoned';
  perceivedDifficulty?: PerceivedDifficulty;
  abandonReason?: AbandonReason;
  reflections?: { promptId: ID; answer: string }[];
  rating?: 1 | 2 | 3 | 4 | 5;
}

export interface Debrief {
  summary: string;
  tropeInsights: TropeInsightData[];
  externalAnalyses: ExternalAnalysis[];
}

export interface CheckInResult {
  entry: JourneyEntryData;
  newState: CognitiveState;
  debrief?: Debrief;
  nextRecommendation?: Recommendation;
  trajectoryUpdate?: { trajectoryId: ID; replanned: boolean; reason?: string };
}

// ---------- диагностика ----------

export type AssessmentResponse =
  | { type: 'single_choice'; options: { id: ID; label: string }[] }
  | { type: 'multi_choice'; options: { id: ID; label: string }[] }
  | { type: 'scale'; min: number; max: number; minLabel: string; maxLabel: string }
  | { type: 'free_text'; maxLength: number }
  | { type: 'ordering'; items: { id: ID; label: string }[] }
  | { type: 'familiarity_grid'; works: WorkCard[]; levels: FamiliarityLevel[] };

export interface AssessmentItemData {
  id: ID;
  kind: 'media_familiarity' | 'scenario' | 'pattern' | 'perspective' | 'self_report' | 'reading_background';
  prompt: string;
  body?: string;
  targetOperations: CognitiveOperation[];
  response: AssessmentResponse;
}

/** Ответ на задание — по одному варианту на каждый вид `AssessmentResponse`; `null` — пропуск. */
export type AssessmentAnswer =
  | { type: 'single_choice'; optionId: ID }
  | { type: 'multi_choice'; optionIds: ID[] }
  | { type: 'scale'; value: number }
  | { type: 'free_text'; text: string }
  | { type: 'ordering'; order: ID[] }
  | { type: 'familiarity_grid'; levels: Record<ID, FamiliarityLevel> };

export interface AssessmentSession {
  id: ID;
  mode: AssessmentMode;
  status: 'in_progress' | 'paused' | 'completed';
  progress: { answered: number; estimatedTotal: number; estimatedMinutesLeft: number };
  currentItem?: AssessmentItemData;
}

// ---------- настройки ----------

export interface UserSettings {
  language: 'ru' | 'en';
  mediaTypes: MediaType[];
  spoilerLevel: SpoilerLevel;
  excludedWarnings: string[];
  showDetails: boolean;
  researchConsent: boolean;
  theme: 'system' | 'light' | 'dark';
  /** уровень усилия, с которым собирается «Сегодня»; нет — 'normal' (21.09: из экрана в настройки) */
  energy?: Energy;
  /** какая оценка по десятибалльной шкале значит у участника «нормально»: у одного это 7
   *  («не жалею о времени»), у другого 5, третий ставит только 8–10. Нет — модель берёт его
   *  медиану. Спрашивается, а не угадывается (замечание владельца 22.09). */
  ratingNorm?: number;
  /** полки, на которых участник попросил фокус (shelves.ts): в «Сегодня» одно место — с полки */
  shelves?: string[];
}

// ---------- вход ----------

/** Кто в сессии. Имя и аватар — из Telegram; «демо» — вход без Telegram, данные не сохраняются. */
export interface AuthUser {
  id: ID;
  name: string;
  username?: string;
  photoUrl?: string;
  source: 'telegram' | 'demo';
}

export interface Session {
  user: AuthUser;
  /** подпись `initData` проверена сервером. В моке всегда false: проверять нечем и незачем —
   *  токен бота в клиенте не живёт (см. `src/lib/telegramAuth.ts`). */
  verified: boolean;
  startedAt: ISODate;
}

// ---------- экспертный контур ----------

export interface ContributorProfile {
  id: ID;
  displayName: string;
  role: ContributorRole;
  bio?: string;
  links: { label: string; url: string }[];
  creditConsent: 'public_name' | 'anonymous';
  contribution: { tasksCompleted: number; worksCovered: number; scalesRefined: string[] };
}

export type ContributorTaskPayload =
  | { kind: 'pairwise'; op: CognitiveOperation; dimension: 'demand' | 'activation';
      question: string; left: WorkCard; right: WorkCard }
  | { kind: 'trope_check'; work: WorkCard;
      candidates: { tropeId: ID; name: string; definition: string }[] }
  | { kind: 'barrier_vote'; work: WorkCard; barriers: { kind: string; label: string }[] }
  | { kind: 'mechanism_note'; work: WorkCard; op: CognitiveOperation; prompt: string }
  | { kind: 'desire_check'; work: WorkCard; candidates: CharacterDesire[] }
  | { kind: 'link_check'; work: WorkCard; analysis: ExternalAnalysis };

export interface ContributorTask {
  id: ID;
  kind: ContributorTaskKind;
  instructions: string;
  estimatedSeconds: number;
  payload: ContributorTaskPayload;
}

export type ContributorAnswer =
  | { kind: 'pairwise'; choice: 'left' | 'right' | 'equal' | 'cant_judge' }
  | { kind: 'trope_check'; items: { tropeId: ID; verdict: 'present' | 'absent' | 'unsure'; usage?: TropeUsageType }[]; missing?: string[] }
  | { kind: 'barrier_vote'; items: { kind: string; severity: 0 | 1 | 2 | 3 | null }[] }
  | { kind: 'mechanism_note'; text: string; referenceUrl?: string }
  | { kind: 'desire_check'; items: { character: string; verdict: 'agree' | 'disagree' | 'unsure'; alternative?: string }[] }
  | { kind: 'link_check'; verdict: 'about_this' | 'other_work' | 'unsure' };

// ---------- кураторская ----------

export interface AnnotationReviewItem {
  annotationId: ID;
  work: Pick<WorkCard, 'id' | 'type' | 'title' | 'year' | 'creators'>;
  status: AnnotationStatus;
  tmdfVersion: string;
  provider: AnnotationProvider;
  model: string;
  modelTier: 'light' | 'standard' | 'heavy';
  overallConfidence: Confidence;
  lowConfidenceFields: string[];
  validationErrors: { path: string; message: string }[];
  knowledgeSufficiency: 'sufficient' | 'partial' | 'insufficient';
  usage: { inputTokens: number; outputTokens: number; durationMs: number; costUsd: number };
  isGold: boolean;
  createdAt: ISODate;
  /** внешние сигналы, на которые опиралась разметка, — с провенансом (сверх §16, 22.09) */
  signals?: ExternalSignal[];
}

export interface AgreementReport {
  field: string;
  raterGroup: 'experts' | 'community' | 'all';
  raters: number;
  alpha: number;
  status: 'reliable' | 'tentative' | 'unreliable';
}

export interface PacketReport {
  packetId: string;
  works: number;
  layers: string[];
  files: number;
  passed: number;
  failed: number;
  rows: { file: string; status: 'ok' | 'fail'; note: string }[];
}

/** Место, где об этом говорили: ссылка ведёт в конкретное сообщение, а не в чат вообще. */
export interface DiscussionPlace {
  id: ID;
  workId: ID;
  kind: 'telegram_chat' | 'telegram_channel' | 'youtube_channel' | 'comments' | 'forum' | 'other';
  title: string;
  why: string;
  url: string;
  /** когда там об этом говорили; настоящее время не обещаем */
  lastTalkedAt?: string;
  language: string;
  spoilers: boolean;
  curatedBy?: string;
  /** не конкретный разбор, а ссылка в поиск по каналу: такие собираются в одну строку */
  search?: boolean;
}

/** Канал, на который ссылаются или которого репостят наши источники, — кандидат в источники.
 *  Собирается из наших же экспортов (`tools/build-source-index.mts`); к самому каналу мы не
 *  ходим, поэтому знаем о нём только то, что сказали о нём другие. Подтверждает человек. */
export interface SourceCandidate {
  id: ID;
  /** как его подписывают те, кто на него ссылается */
  title: string;
  handle?: string;
  url?: string;
  /** сколько раз на него сослались */
  mentions: number;
  /** сколько раз его репостнули — это сильнее ссылки: чужой текст поставили к себе в ленту */
  reposts: number;
  /** кто из наших источников его знает */
  by: string[];
  lastAt?: ISODate;
  /** первая строка поста, в котором он встретился: видно, в каком разговоре */
  sample?: string;
}

/** «Рядом называют»: произведение, которое в постах каналов упоминают в одном посте с этим.
 *  Это не похожесть по смыслу и не рекомендация — это то, как о кино говорят. Сигнал чужой:
 *  его делаем не мы, поэтому им можно проверять нашу собственную близость. */
export interface CoMention {
  /** ключ разбора того, кого называют рядом: «tmdb:<id>» или «isbn:<isbn>» */
  key: string;
  /** карточка, которой этот ключ достался в нашей базе: по ней открывается произведение */
  workId: ID;
  title: string;
  year?: number;
  /** в скольких постах они встретились вместе */
  n: number;
  /** теснота связи с поправкой на то, что о ком-то пишут каждый день */
  weight: number;
}

/** Приём, отмеченный на TV Tropes. Это не наша разметка: `usage` и операции здесь неизвестны,
 *  поэтому в `tropeInsights` такому не место — там утверждение о том, как приём работает,
 *  а тут только «на вики этот приём у фильма отмечен». Показывается отдельно и с оговоркой,
 *  как и разборы, найденные автоматически. Название и объяснение — свои
 *  (tools/trope-dictionary.ts): тексты TV Tropes под CC BY-NC-SA, и копировать их нельзя. */
export interface TropeMention {
  /** «tvtropes:UnreliableNarrator» */
  tropeId: ID;
  /** как называем по-русски */
  name: string;
  /** что это за приём вообще — одна фраза, не про этот фильм */
  explanation: string;
  /** страница приёма на вики */
  url: string;
  spoilerLevel: SpoilerLevel;
}

/** «Описывают похоже»: фильм, которому зрители MovieLens приписывают те же теги. Третий
 *  независимый сигнал рядом с CoMention: тот про то, кого называют вместе русские каналы,
 *  этот — про то, как кино описывают англоязычные зрители. Проверено, что они согласуются
 *  между собой и не дублируют замер формы по субтитрам. */
export interface TagNeighbour {
  /** ключ разбора соседа: «tmdb:<id>» */
  key: string;
  workId: ID;
  title: string;
  year?: number;
  /** близость в пространстве 1084 тегов, 0–1 */
  similarity: number;
}

/** Форма фильма, посчитанная по субтитрам, а не описанная словами: сколько в нём говорят,
 *  как долго молчат, какими словами. Это замер, а не оценка: в карточке показываем число и
 *  с чем его сравнивать, но не выводим из него «сложно» или «легко» — связь с уровнем
 *  сложности на наших 35 размеченных фильмах пока не подтверждена.
 *  Источник — корпус OPUS OpenSubtitles (русские субтитры); текстов у себя не держим. */
export interface FilmForm {
  /** слов в минуту разговора — плотность речи */
  wordsPerMinute: number;
  /** доля хронометража, которая приходится на перерывы в речи длиннее 30 секунд */
  silentShare: number;
  /** самый длинный кусок без единой реплики, в минутах */
  longestSilenceMinutes: number;
  /** доля слов вне пяти тысяч самых частых в корпусе — насколько редкая лексика */
  rareWordShare: number;
  /** место среди измеренных фильмов, 0–100: 100 — говорят плотнее всех */
  speechPercentile: number;
  /** место по доле тишины, 0–100: 100 — молчит дольше всех */
  silencePercentile: number;
  /** по скольким переводам усреднено и насколько они разошлись по плотности речи:
   *  без этого число выглядит точнее, чем есть */
  sources: number;
  spreadWordsPerMinute?: number;
}

export interface TvTropesMapping {
  source: string;
  target?: string;
  usage?: TropeUsageType;
  status: AnnotationStatus;
  attribution: string;
}

// Сверх §16 (22.09): данные кураторских экранов, у которых в контракте не было формы, —
// таксономия, прогоны, качество, разница черновика и публикации, потолок согласованности.

/** Узел таксономии приёмов: ось → категория → приём; count — в скольких произведениях. */
export interface TropeTreeNode {
  name: string;
  count?: number;
  operations?: CognitiveOperation[];
  children?: TropeTreeNode[];
}

export interface AnnotationRun {
  id: ID;
  title: string;
  status: AnnotationStatus;
  done: number;
  total: number;
  provider: AnnotationProvider;
  tokens?: number;
  seconds?: number;
  costUsd?: number;
  errors?: string[];
  startedAt: ISODate;
}

/** Согласие источника разметки с эталоном по слою против потолка человека. */
export interface QualityMetric {
  layer: string;
  provider: AnnotationProvider;
  alpha: number;
  ceiling: number;
  fit: boolean;
}

export interface AnnotationDiffRow {
  path: string;
  draft: string;
  current?: string | null;
  changed?: boolean;
  confidence?: Confidence;
  evidence?: string;
}

export interface AgreementCeilingData {
  selfAgreement: number;
  ceiling?: number;
  weeks: number;
  marks: { label: string; alpha: number }[];
}
