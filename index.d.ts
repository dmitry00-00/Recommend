// Transformative Media — типы бандла.
// Контракт данных — §16 общего промпта; после старта разработки источник
// истины — OpenAPI бэкенда, эти типы генерируются из него.
// Компоненты не знают, откуда пришли данные, и не содержат бизнес-логики.

export type ID = string;
export type ISODate = string;
export type MediaType = 'film' | 'book';

export type CognitiveOperation =
  | 'pattern_recognition' | 'causal_reasoning' | 'perspective_taking' | 'analogical_thinking'
  | 'synthesis' | 'abstraction' | 'metacognition' | 'critical_analysis';

export type TropeUsageType = 'straight' | 'deconstruction' | 'subversion' | 'reconstruction' | 'meta';
export type StretchLevel = 'easy_entry' | 'productive' | 'challenge';
export type Confidence = 'low' | 'medium' | 'high';
export type SpoilerLevel = 0 | 1 | 2;
export type Energy = 'low' | 'normal' | 'high';
export type StateChangeType = 'refined_estimate' | 'observed_growth';
export type RecommendationSlot = 'next_step' | 'stretch' | 'side_step' | 'preparation';
export type StepStatus = 'locked' | 'available' | 'in_progress' | 'completed' | 'skipped';
export type JourneyStatus = 'planned' | 'in_progress' | 'finished' | 'abandoned';
export type PerceivedDifficulty = 'too_easy' | 'just_right' | 'too_hard';
export type AbandonReason = 'too_hard' | 'not_engaging' | 'no_time' | 'other';
export type DismissReason = 'too_heavy_now' | 'not_interested' | 'already_know' | 'unavailable' | 'other';
export type ContributorRole = 'expert' | 'community';
export type ContributorTaskKind = 'pairwise' | 'trope_check' | 'barrier_vote' | 'mechanism_note';
export type AnnotationStatus =
  | 'queued' | 'annotating' | 'validation_failed' | 'needs_review' | 'approved' | 'published' | 'rejected';
export type AnnotationProvider = 'local' | 'packet' | 'anthropic_api' | 'human' | 'expert_consensus' | 'tvtropes';

export interface OperationIntensity { op: CognitiveOperation; intensity: number }

export interface WorkCard {
  id: ID; type: MediaType; title: string; originalTitle?: string; year: number;
  creators: string[]; countries?: string[]; coverUrl?: string;
  durationMinutes?: number; pages?: number;
  primaryOperations: OperationIntensity[]; complexityLevel: number;
  warnings: string[]; barriers: string[]; isNicheMasterpiece: boolean;
}

export interface Prerequisite { kind: 'work' | 'concept' | 'context'; label: string; work?: WorkCard; necessity: 'required' | 'helpful'; met: boolean }
export interface TropeInsightData {
  tropeId: ID; tropePath: string[]; name: string; usage: TropeUsageType;
  operations: CognitiveOperation[]; spoilerLevel: SpoilerLevel; plainExplanation: string;
}
export interface ExternalAnalysis {
  id: ID; title: string; author: string;
  platform: 'youtube' | 'vk' | 'telegram' | 'article' | 'podcast' | 'other';
  url: string; language: string; spoilerLevel: SpoilerLevel; operations?: CognitiveOperation[];
}
export interface OperationEstimate { op: CognitiveOperation; level: number; range: [number, number]; confidence: Confidence; trend: 'up' | 'flat' | 'down' | 'unknown' }
export interface CognitiveState {
  userId: ID; asOf: ISODate; operations: OperationEstimate[];
  complexityComfort: number; mediaLiteracy: number; overallConfidence: Confidence;
  source: 'assessment_quick' | 'assessment_full' | 'activity' | 'checkpoint';
}
export interface DevelopmentTarget { id: ID; operations: CognitiveOperation[]; label: string; source: 'user' | 'system_suggested'; createdAt: ISODate; active: boolean }
export interface StateChangeCause { kind: 'assessment' | 'work_finished' | 'work_abandoned' | 'reflection' | 'checkpoint'; label: string; workId?: ID; changeType: StateChangeType }
export interface StateHistoryPoint { asOf: ISODate; operations: Pick<OperationEstimate, 'op' | 'level' | 'range'>[]; cause: StateChangeCause }
export interface CognitiveMapData {
  state: CognitiveState; history: StateHistoryPoint[];
  targets: DevelopmentTarget[]; suggestedTargets: DevelopmentTarget[];
  traces: { work: WorkCard; finishedAt: ISODate; operations: OperationIntensity[] }[];
}
export interface RecommendationExplanation { what: string; why: string; whyNow: string; whatNext: string }
export interface TrajectoryStepData {
  order: number; work: WorkCard; purpose: string; status: StepStatus; stretch: StretchLevel;
  operationsIntroduced: CognitiveOperation[]; operationsReinforced: CognitiveOperation[];
}
export interface Recommendation {
  id: ID; work: WorkCard; slot: RecommendationSlot; stretch: StretchLevel;
  targetOperations: CognitiveOperation[]; explanation: RecommendationExplanation;
  readiness: { ready: boolean; missing: Prerequisite[]; preparationPath?: TrajectoryStepData[] };
  trajectoryId?: ID; createdAt: ISODate;
}
export interface Trajectory {
  id: ID; title: string; kind: 'development' | 'peak_path'; target: DevelopmentTarget;
  peakWork?: WorkCard; steps: TrajectoryStepData[]; progress: number;
  replanHistory: { at: ISODate; reason: string }[]; createdAt: ISODate;
}
export interface ReflectionPromptData { id: ID; op: CognitiveOperation; question: string; kind: 'free_text' | 'choice'; options?: string[] }
export interface JourneyEntryData {
  id: ID; work: WorkCard; status: JourneyStatus; progress?: number;
  startedAt?: ISODate; finishedAt?: ISODate; perceivedDifficulty?: PerceivedDifficulty;
  abandonReason?: AbandonReason; reflections: { promptId: ID; answer: string }[];
  stateChanges: { op: CognitiveOperation; delta: number; changeType: StateChangeType }[];
}
export interface AssessmentItemData {
  id: ID;
  kind: 'media_familiarity' | 'scenario' | 'pattern' | 'perspective' | 'self_report' | 'reading_background';
  prompt: string; body?: string; targetOperations: CognitiveOperation[];
  response:
    | { type: 'single_choice'; options: { id: ID; label: string }[] }
    | { type: 'multi_choice'; options: { id: ID; label: string }[] }
    | { type: 'scale'; min: number; max: number; minLabel: string; maxLabel: string }
    | { type: 'free_text'; maxLength: number }
    | { type: 'ordering'; items: { id: ID; label: string }[] }
    | { type: 'familiarity_grid'; works: WorkCard[]; levels: string[] };
}
export interface ContributorProfile {
  id: ID; displayName: string; role: ContributorRole; bio?: string;
  links: { label: string; url: string }[]; creditConsent: 'public_name' | 'anonymous';
  contribution: { tasksCompleted: number; worksCovered: number; scalesRefined: string[] };
}
export interface ContributorTask { id: ID; kind: ContributorTaskKind; instructions: string; estimatedSeconds: number; payload: any }
export interface AnnotationReviewItem {
  annotationId: ID; work: Pick<WorkCard, 'id' | 'type' | 'title' | 'year' | 'creators'>;
  status: AnnotationStatus; tmdfVersion: string; provider: AnnotationProvider; model: string;
  modelTier: 'light' | 'standard' | 'heavy'; overallConfidence: Confidence;
  lowConfidenceFields: string[]; validationErrors: { path: string; message: string }[];
  knowledgeSufficiency: 'sufficient' | 'partial' | 'insufficient';
  usage: { inputTokens: number; outputTokens: number; durationMs: number; costUsd: number };
  isGold: boolean; createdAt: ISODate;
}
export interface DiscussionPlace {
  id: ID;
  workId: ID;
  kind: 'telegram_chat' | 'telegram_channel' | 'comments' | 'forum' | 'other';
  title: string;              // как называется место
  why: string;                // зачем туда идти — одна фраза
  url: string;                // ссылка в конкретное сообщение, видео или ветку
  lastTalkedAt?: string;      // когда там об этом говорили; настоящее время не обещаем
  language: string;
  spoilers: boolean;          // в живом разговоре почти всегда true
  curatedBy?: string;         // кто принёс ссылку, с согласия на атрибуцию
}

export interface AgreementReport { field: string; raterGroup: 'experts' | 'community' | 'all'; raters: number; alpha: number; status: 'reliable' | 'tentative' | 'unreliable' }

// ---------- компоненты ----------
type FC<P> = (props: P) => any;

export declare const OperationGlyph: FC<{ op: CognitiveOperation; size?: 12 | 14 | 16 | 24 | 48; tone?: 'inherit'; title?: false; className?: string }>;
export declare const OperationChip: FC<{ op: CognitiveOperation; short?: boolean; size?: 'sm'; intensity?: number; showDetails?: boolean; tone?: 'plain' | 'wash'; title?: string }>;
export declare const Button: FC<{ variant?: 'primary' | 'secondary' | 'quiet' | 'danger'; size?: 'sm' | 'md'; loading?: boolean; disabled?: boolean; pressed?: boolean; block?: boolean; href?: string; onClick?: () => void; children?: any }>;
export declare const WorkCover: FC<{ work: WorkCard; size?: 'sm' | 'md' | 'lg'; className?: string }>;
export declare const WorkHeader: FC<{ work: WorkCard; compact?: boolean; cover?: false; showDetails?: boolean; children?: any }>;
export declare const BarrierTag: FC<{ label: string; kind?: 'warning' }>;
export declare const SpoilerGuard: FC<{ title?: string; note?: string; defaultOpen?: boolean; children?: any }>;
export declare const TropeInsight: FC<{ insight: TropeInsightData; showPath?: boolean }>;
export declare const ExternalAnalysisLink: FC<{ analysis: ExternalAnalysis; spoilerLevel?: SpoilerLevel }>;
export declare const DiscussionLink: FC<{ discussion: DiscussionPlace; locked?: boolean }>;
export declare const EnergySwitch: FC<{ value: Energy; onChange?: (e: Energy) => void }>;
export declare const RecommendationCard: FC<{ recommendation: Recommendation; previous?: { work: WorkCard; purpose?: string }; variant?: 'compact'; expanded?: boolean; showDetails?: boolean }>;
export declare const ExplanationBlock: FC<{ explanation: RecommendationExplanation; defaultOpen?: boolean; always?: boolean; omitWhyNow?: boolean }>;
export declare const StretchIndicator: FC<{ level: StretchLevel; size?: 'sm'; label?: false; variant?: 'caps' }>;
export declare const ReadinessNotice: FC<{ readiness: Recommendation['readiness'] }>;
export declare const ReasonPicker: FC<{ variant?: 'dismiss' | 'abandon'; title?: string; value?: string; onPick?: (id: DismissReason | AbandonReason) => void }>;
export declare const CognitiveMap: FC<{ map: CognitiveMapData; mode?: 'field' | 'list'; compact?: boolean; size?: number; showDetails?: boolean; onSelect?: (op: CognitiveOperation) => void }>;
export declare const UncertaintyMark: FC<{ level: number; range: [number, number]; confidence?: Confidence; op?: CognitiveOperation; max?: number; showDetails?: boolean; note?: false; className?: string }>;
export declare const StateChangeNote: FC<{ changeType: StateChangeType; text?: string; operations?: CognitiveOperation[] }>;
export declare const TimeScrubber: FC<{ history: StateHistoryPoint[]; value?: number; onChange?: (i: number) => void }>;
export declare const TrajectoryPath: FC<{ trajectory: Trajectory; variant?: 'compact' }>;
export declare const TrajectoryStep: FC<{ step: TrajectoryStepData; peak?: boolean }>;
export declare const ReplanNote: FC<{ at?: ISODate; reason: string }>;
export declare const JourneyEntry: FC<{ entry: JourneyEntryData }>;
export declare const CheckInFlow: FC<{ work: WorkCard; prompts?: ReflectionPromptData[]; debrief?: { summary: string; tropeInsights: TropeInsightData[]; externalAnalyses: ExternalAnalysis[] }; discussions?: DiscussionPlace[]; step?: number; changedOperations?: CognitiveOperation[] }>;
export declare const DifficultyPicker: FC<{ value?: PerceivedDifficulty; label?: string; onPick?: (id: PerceivedDifficulty) => void }>;
export declare const ReflectionPrompt: FC<{ prompt: ReflectionPromptData; maxLength?: number; onAnswer?: (v: string) => void }>;
export declare const AssessmentItem: FC<{ item: AssessmentItemData; progress?: { answered: number; estimatedTotal: number; minutesLeft: number } | false }>;
export declare const AssessmentProgress: FC<{ answered?: number; estimatedTotal?: number; minutesLeft?: number }>;
export declare const ConsentCard: FC<{ title?: string; points?: string[]; checkLabel?: string }>;
export declare const AppShell: FC<{ variant?: 'mobile' | 'desktop' | 'telegram'; active?: string; items?: { id: string; label: string }[]; title?: string; children?: any }>;
export declare const EmptyState: FC<{ title: string; text?: string; action?: string }>;
export declare const ErrorState: FC<{ title?: string; text?: string; action?: string; secondary?: string }>;
export declare const Toast: FC<{ text: string; action?: string; tone?: string }>;
export declare const Dialog: FC<{ title: string; confirm?: string; cancel?: string; destructive?: boolean; children?: any }>;
export declare const Sheet: FC<{ title: string; children?: any }>;
export declare const TaskFeed: FC<{ tasks: ContributorTask[]; title?: string; onlyMine?: boolean }>;
export declare const PairwiseCompare: FC<{ task: ContributorTask; onAnswer?: (choice: 'left' | 'right' | 'equal' | 'cant_judge') => void }>;
export declare const TropeCheckList: FC<{ task: ContributorTask }>;
export declare const TropeUsagePicker: FC<{ value?: TropeUsageType; onPick?: (u: TropeUsageType) => void }>;
export declare const BarrierVote: FC<{ task: ContributorTask }>;
export declare const MechanismNote: FC<{ task: ContributorTask }>;
export declare const ContributionSummary: FC<{ contributor: ContributorProfile }>;
export declare const CreditSettings: FC<{ contributor: ContributorProfile }>;
export declare const ReviewTable: FC<{ items: AnnotationReviewItem[]; caption?: string }>;
export declare const DiffView: FC<{ rows: { path: string; draft: string; current?: string | null; changed?: boolean; confidence?: Confidence; evidence?: string }[] }>;
export declare const FieldConfidence: FC<{ confidence: Confidence; path?: string; label?: false }>;
export declare const ValidationList: FC<{ errors: { path: string; message: string }[] }>;
export declare const TropeTree: FC<{ tree: { name: string; count?: number; operations?: CognitiveOperation[]; children?: any[] }[] }>;
export declare const RunProgress: FC<{ run: { title: string; status: AnnotationStatus; done: number; total: number; provider: AnnotationProvider; tokens?: number; seconds?: number; costUsd?: number; errors?: string[] } }>;
export declare const MetricsTable: FC<{ rows: { layer: string; provider: AnnotationProvider; alpha: number; ceiling: number; fit: boolean }[]; caption?: string }>;
export declare const PacketExport: FC<{}>;
export declare const PacketImportReport: FC<{ report: { packetId: string; files: number; passed: number; failed: number; rows: { file: string; status: 'ok' | 'fail'; note: string }[] } }>;
export declare const BlindAnnotationToggle: FC<{ blind?: boolean }>;
export declare const AgreementCeiling: FC<{ selfAgreement: number; ceiling?: number; weeks?: number; marks?: { label: string; alpha: number }[] }>;
export declare const AgreementMatrix: FC<{ rows: AgreementReport[]; caption?: string; example?: string }>;
export declare const MappingTable: FC<{ rows: { source: string; target?: string | null; usage?: TropeUsageType | null; status: AnnotationStatus; attribution: string }[] }>;
export declare const ContributorTable: FC<{ contributors: ContributorProfile[]; reliability?: Record<ID, string> }>;
export declare const StatusTag: FC<{ status: AnnotationStatus }>;

// Служебное: раскладка превью и справочники строк интерфейса.
export declare const Preview: FC<{ title?: string; dense?: boolean; plain?: boolean; width?: number; children?: any }>;
export declare const Row: FC<{ gap?: '1' | '2'; wrap?: boolean; className?: string; children?: any }>;
export declare const Stack: FC<{ gap?: '2' | '4' | '6'; className?: string; children?: any }>;
export declare const OPS: Record<CognitiveOperation, { name: string; short: string; line: string }>;
export declare const OP_KEYS: CognitiveOperation[];
export declare const SLOT: Record<RecommendationSlot, { label: string; note: string }>;
export declare const STRETCH: Record<StretchLevel, { label: string; n: number; note: string }>;
export declare const STEP_STATUS: Record<StepStatus, { label: string; note: string }>;
export declare const ANN_STATUS: Record<AnnotationStatus, { label: string; tone: 'ok' | 'wait' | 'stop' }>;
export declare const mocks: any;
