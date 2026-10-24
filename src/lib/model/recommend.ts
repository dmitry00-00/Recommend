// Подбор по состоянию: кандидат оценивается по близости уровня к цели (комфорт участника
// плюс шаг по выбранному усилию) и по тому, насколько его операции совпадают с сильными
// сторонами участника — с небольшим уклоном к тем, где есть куда расти. Эвристика этапа 1;
// объяснение собирается из разметки («что делает») и из совпадений операций.
import type {
  CognitiveOperation, CognitiveState, Energy, PerceivedDifficulty, Recommendation, RecommendationSlot, Register,
  StretchLevel, WorkCard,
} from '@/types/tmdf';
import { operations } from '@/lib/operations';
import { registers } from '@/lib/registers';
import { opLoad } from './deriveState';
import { isSeries, isShortSeries, seriesHours } from '@/lib/media';
import { fameExcluded, famePenalty, type DimFamous } from './fame';
import { afterwordBonus, deriveWorthProfile, type AfterwordInput } from './worth';
import { EXPERIMENTS } from './experiments';
import { twoStageSort, type TwoStageInputs } from './candidates';

export interface Candidate {
  work: WorkCard;
  /** что произведение делает с восприятием — из разметки, одной строкой */
  what: string;
  /** антология (Е4): кандидат — этот сезон */
  season?: number;
  /** сколько разборов человек увидит в карточке (ТВ-2): фильм без разборов отвечает только на
   *  «что посмотреть», а с разбором — ещё и на «как понять». В объяснении не упоминается. */
  essays?: number;
}

/** Сериалы в подборе (Е4). Новичок в сериалах — тот, кто у нас их ещё не отмечал: ему только
 *  короткое (мини-сериал, сезон антологии). В слейте сериалов не больше `maxSeries`: лента —
 *  прежде всего вечер, а сериал — обязательство на недели. */
export interface RecommendOptions {
  seriesNovice?: boolean; maxSeries?: number;
  /** сколько первых мест отдать кадрам с разбором (ТВ-2): новому человеку — три, чтобы первое
   *  впечатление было не только «что посмотреть», но и «как понять» (замер 06.10: у 6 из 7 первых
   *  кадров нового человека разборов не было) */
  essayFirst?: number;
  /** якорь вкуса новичка (taste.ts): близость к оценённому от −1 до 1 и её вес в счёте */
  content?: { fit: (work: WorkCard) => number; weight: number };
  /** засветка топами (fame.ts): известность произведения 0…3 и насколько её приглушать */
  fame?: { level: (work: WorkCard) => number | undefined; mode: DimFamous };
  /** послесловия (17.10, worth.ts): «стоило» — отдельная ось от «понравилось», плюс темп и что держало.
   *  Без явных ответов профиля нет, и подбор ровно прежний */
  afterwords?: AfterwordInput;
  /** наклон ленты «больше такого» (19.10, src/lib/tilt.ts): совпадение с выбранным 0…1 и его вес в счёте */
  boost?: { fit: (work: WorkCard) => number; weight: number };
  /** наклон «только это» (19.10): пул уже отобран — если ограничения разнообразия (не больше двух на ведущую операцию и
   *  регистр) оставили ленту короче `limit`, добрать лучшими из отобранного */
  fill?: boolean;
  /** «как фильм оценили другие» (23.10, опыт consensus): мера около −1…1 (src/lib/model/consensus.ts) и её вес; нет меры — 0 */
  consensus?: { of: (work: WorkCard) => number | undefined; weight: number };
  /** «похожие фильмы» (23.10, src/lib/model/itemSim.ts): мера около −1…1 — средняя z-оценка человека по похожим, что он
   *  оценил; undefined — фильма нет в таблице или похожего он не оценил. В счёт пока идёт только при опыте learnedBlend,
   *  и вес тогда — из LEARNED_B */
  itemSim?: { of: (work: WorkCard) => number | undefined; weight: number };
  /** подбор в два шага (23.10, опыт twoStage, candidates.ts): числа источников отбора сверх того, что выше, и квоты */
  twoStage?: TwoStageInputs;
  /** сколько у человека оценок, по которым считается его z для itemSim (23.10, опыт shortHistory): по ним — поправка
   *  r(n) к весам LEARNED_B. Нет поля — поправки нет */
  rated?: number;
  /** EASE (24.10, опыт ease при learnedBlend; src/lib/model/ease.ts, GET /api/ease): счёт фильма «что посмотрит» (bin) и «что
   *  понравится» (like) с сервера; undefined — фильма нет в таблице (мало оценивших или нет в X). Есть поле — счёт ленты
   *  по весам LEARNED_E, нет — прежний LEARNED_B */
  ease?: { bin: (work: WorkCard) => number | undefined; like: (work: WorkCard) => number | undefined };
}
/** Сколько громких (известность 2–3) пускать в шестёрку при засветке пределом (опыт fameCap): мягко — два, сильно — один
 *  (третий уровень при «сильно» не идёт вовсе, как и раньше). */
const FAME_CAP: Record<'off' | 'soft' | 'strong', number> = { off: Infinity, soft: 2, strong: 1 };
/** Надбавка к счёту за видимый разбор: мала против разницы в уровне и операциях — разбор
 *  выбирает между близкими по силе, а не тянет вверх неподходящее. */
export const ESSAY_BONUS = 0.04;

/** Общее время — первый барьер сериала: чем дольше, тем ниже, а без сил — вдвое. Длина
 *  неизвестна — чуть ниже: честнее считать, что это надолго. */
export function timePenalty(work: WorkCard, energy: Energy): number {
  if (!isSeries(work)) return 0;
  const hours = seriesHours(work);
  const base = hours == null ? (isShortSeries(work) ? 0 : 0.06) : hours <= 10 ? 0 : hours <= 20 ? 0.05 : hours <= 50 ? 0.12 : 0.25;
  return energy === 'low' ? base * 2 : base;
}

const ENERGY_STEP: Record<Energy, number> = { low: -1.2, normal: 0.4, high: 1.4 };

/** Тяжесть по настроению (10.10, замечание владельца): «Полегче» — это не только проще устроено, но и легче
 *  пережить. Уровень этого не видит: «Нечто», «Собачье сердце», «Ганнибал» — уровень 4 и ниже, и при вкусе к
 *  телесному кино лёгкая лента собиралась из них. Тяжесть — из разметки: предупреждения и барьеры (что
 *  тяжело смотреть) и регистры (каким языком говорит фильм). 0 — легко, 1 — тяжело. */
const HEAVY_MARKS: Record<string, number> = {
  'Жестокость': 0.35, 'Хоррор-образы': 0.35, 'Физиологические сцены': 0.3, 'Сексуальное насилие': 0.4, 'Насилие над детьми': 0.4,
  'Самоубийство': 0.3, 'Самоповреждение': 0.3, 'Жестокость к животным': 0.3, 'Нарастающий дискомфорт': 0.2, 'Насилие': 0.15,
};
const HEAVY_REGISTERS: Partial<Record<Register, number>> = { body_visceral: 0.3, folk_gothic: 0.2, cold_clinical: 0.1 };
export function heaviness(work: WorkCard): number {
  const marks = new Set([...work.warnings, ...work.barriers]);
  let h = 0;
  for (const m of marks) h += HEAVY_MARKS[m] ?? 0;
  for (const r of work.registers ?? []) h += HEAVY_REGISTERS[r] ?? 0;
  return Math.min(1, h);
}
/** Сколько стоит тяжесть при этой силе: только «Полегче»; обычная лента и «Готов к сложному» — как были. */
const HEAVY_COST: Record<Energy, number> = { low: 0.35, normal: 0, high: 0 };

/** Чего ждёт модель от произведения для этого участника: разрыв между уровнем произведения
 *  и целью (комфорт плюс шаг по усилию). Пороги — те же, что у `levelFit`: разрыв в один
 *  уровень это ещё «в самый раз», дальше начинается «тяжело» или «легко». Нужна для сверки
 *  с тем, как оказалось: участник отвечает про себя, а эта функция отвечает за нас. */
export function expectedDifficulty(state: CognitiveState, work: WorkCard, energy: Energy = 'normal'): PerceivedDifficulty | undefined {
  if (!work.complexityLevel) return undefined;
  const gap = work.complexityLevel - (state.complexityComfort + ENERGY_STEP[energy]);
  return gap > 1 ? 'too_hard' : gap < -1 ? 'too_easy' : 'just_right';
}

/** Тот же прогноз, но вероятностями: без них калибровку не посчитать (трек Б, Брайер). Модель
 *  — упорядоченная логистика по тому же разрыву, что у `expectedDifficulty`: при разрыве ±1
 *  «тяжело»/«легко» и «в самый раз» равновероятны, дальше край быстро набирает вес. Крутизна
 *  `SPREAD` — первая прикидка, её и будем подгонять, когда наберётся 30+ наблюдений (Б4, Б5). */
export const DIFFICULTY_SPREAD = 0.6;
export function difficultyOdds(state: CognitiveState, work: WorkCard, energy: Energy = 'normal'): Record<PerceivedDifficulty, number> | undefined {
  if (!work.complexityLevel) return undefined;
  const gap = work.complexityLevel - (state.complexityComfort + ENERGY_STEP[energy]);
  const sig = (x: number) => 1 / (1 + Math.exp(-x));
  const tooHard = sig((gap - 1) / DIFFICULTY_SPREAD);
  const tooEasy = sig((-1 - gap) / DIFFICULTY_SPREAD);
  const justRight = Math.max(0, 1 - tooHard - tooEasy);
  const sum = tooHard + tooEasy + justRight;
  const r = (x: number) => Math.round((x / sum) * 1000) / 1000;
  return { too_easy: r(tooEasy), just_right: r(justRight), too_hard: r(tooHard) };
}

function opLevel(state: CognitiveState, op: CognitiveOperation): number | undefined {
  return state.operations.find((o) => o.op === op)?.level;
}

/** Веса оценки. Уровень и операции — про развитие, регистр — про то, станет ли участник это
 *  смотреть вообще. Регистр появился, когда выяснилось, что по уровню и операциям выгрузка
 *  с оценками и настоящий список просмотренного неразличимы (22.09). Развес — не догма:
 *  `weights` можно переопределить в прогоне и сравнить (tools/watched-report.mts). */
export interface ScoreWeights { level: number; ops: number; register: number }
export const SCORE_WEIGHTS: ScoreWeights = { level: 0.4, ops: 0.3, register: 0.3 };

/** Насколько кадр звучит на языке, который участник выбирает сам: 0.5 — нейтрально. */
export function registerFit(state: CognitiveState, work: WorkCard): number {
  const taste = state.registerTaste;
  if (!taste?.length || !work.registers?.length) return 0.5;
  const hits = work.registers.map((r) => taste.find((t) => t.register === r)?.affinity ?? -0.2);
  return Math.min(1, Math.max(0, 0.5 + Math.max(...hits) / 2));
}

/** Уровень кривой (23.10, опыт levelCurve, разбор .cache/eval/why-2026-10-22.md п. 5): прежний levelFit симметричен,
 *  а любимое у 26 из 35 человек сложнее нелюбимого (в среднем на 0,44 уровня) — сложнее цели не хуже, чем ровно в цель.
 *  Поэтому при опыте уровень — монотонная кривая: до `cap` выше цели (комфорт + шаг по силе) растёт с наклоном 1/`slope`,
 *  дальше — потолок 1. opFit насыщен (у 40% спрятанного ровно 1) и ничего не добавляет, его вес отдан уровню и регистру.
 *  «Полегче» (low) остаётся прежним: там «сложнее» как раз мимо. Счёт по-прежнему 0…1 — лента режет по 0.3. */
export const LEVEL_CURVE = { cap: 0, slope: 4 };
export const CURVE_WEIGHTS: ScoreWeights = { level: 0.6, ops: 0, register: 0.4 };
function levelFitOf(level: number, target: number, energy: Energy): number {
  if (!EXPERIMENTS.levelCurve || energy === 'low') return Math.max(0, 1 - Math.abs(level - target) / 3);
  return Math.max(0, Math.min(1, 1 + Math.min(level - target - LEVEL_CURVE.cap, 0) / LEVEL_CURVE.slope));
}

/** Оценка кандидата: 0 — мимо, ~1 — ровно то. */
export function scoreCandidate(state: CognitiveState, work: WorkCard, energy: Energy, weights: ScoreWeights = EXPERIMENTS.levelCurve ? CURVE_WEIGHTS : SCORE_WEIGHTS): number {
  if (!work.complexityLevel || !work.primaryOperations.length) return 0;
  const target = state.complexityComfort + ENERGY_STEP[energy];
  const levelFit = levelFitOf(work.complexityLevel, target, energy);
  // операции: нагрузка чуть выше уровня участника — лучше всего; сильно выше — хуже; ниже — нейтрально
  let opFit = 0;
  let weight = 0;
  for (const oi of work.primaryOperations) {
    const lvl = opLevel(state, oi.op);
    if (lvl == null) continue;
    const gap = opLoad(work.complexityLevel, oi.intensity) - lvl;
    const fit = gap < -1.5 ? 0.4 : gap <= 1.5 ? 1 : gap <= 3 ? 0.6 : 0.2;
    opFit += fit * oi.intensity;
    weight += oi.intensity;
  }
  const ops = weight ? opFit / weight : 0.5;
  const niche = work.isNicheMasterpiece ? (state.mediaLiteracy >= 6 ? 0.1 : -0.15) : 0;
  // при равном — то, где ведущая операция совпадает с сильной стороной участника
  const lead = work.primaryOperations[0]?.op;
  const affinity = lead && strongOps(state).has(lead) ? 0.04 : 0;
  const sum = weights.level + weights.ops + weights.register;
  return (weights.level * levelFit + weights.ops * ops + weights.register * registerFit(state, work)) / sum + niche + affinity
    - timePenalty(work, energy) - HEAVY_COST[energy] * heaviness(work);
}

/** Барьеры формы: не «сложнее», а «иначе» — такой кадр честно помечается шагом в сторону. */
const FORM_BARRIERS = new Set(['Без сюжета в привычном смысле', 'Условная актёрская манера', 'Медленный темп', 'Театральная манера',
  'Разговорная форма', 'Архаичная речь', 'Открытый финал', 'Смена жанра',
  // у старой классики из топов Википедии (05.10): не сложнее, а непривычнее
  'Чёрно-белое изображение', 'Немое кино',
  // индийское кино (ЗП-22, 07.10): песни и танцы посреди сюжета — привычно в Индии, непривычно остальным
  'Музыкальные номера']);

function slotFor(state: CognitiveState, work: WorkCard, energy: Energy): { slot: RecommendationSlot; stretch: StretchLevel } {
  const gap = work.complexityLevel - state.complexityComfort;
  if (gap >= 1.5) return { slot: 'stretch', stretch: 'challenge' };
  if (gap <= -1.5) return { slot: energy === 'low' ? 'next_step' : 'side_step', stretch: 'easy_entry' };
  if (work.barriers.some((b) => FORM_BARRIERS.has(b))) return { slot: 'side_step', stretch: 'productive' };
  return { slot: 'next_step', stretch: 'productive' };
}

/** Три самые развитые операции участника — то, что в объяснении зовётся сильной стороной. */
function strongOps(state: CognitiveState): Set<CognitiveOperation> {
  return new Set([...state.operations].sort((a, b) => b.level - a.level).slice(0, 3).map((o) => o.op));
}

/** Операции, ради которых кандидат выбран: где его нагрузка ближе всего к уровню участника сверху. */
function targetOps(state: CognitiveState, work: WorkCard): CognitiveOperation[] {
  return work.primaryOperations
    .map((oi) => ({ op: oi.op, gap: opLoad(work.complexityLevel, oi.intensity) - (opLevel(state, oi.op) ?? 5) }))
    .filter((x) => x.gap > -1.5)
    .sort((a, b) => Math.abs(a.gap - 0.8) - Math.abs(b.gap - 0.8))
    .slice(0, 2)
    .map((x) => x.op);
}

function why(state: CognitiveState, work: WorkCard, ops: CognitiveOperation[]): string {
  const [first, second] = ops;
  if (!first) return 'По уровню — рядом с тем, что вы обычно смотрите.';
  const lvl = opLevel(state, first) ?? 5;
  const gap = opLoad(work.complexityLevel, work.primaryOperations.find((o) => o.op === first)?.intensity ?? 0.5) - lvl;
  const strong = strongOps(state).has(first);
  let head: string;
  if (strong && gap > 0.8) head = `Ваша сильная сторона — ${operations[first].line}: здесь она понадобится больше обычного.`;
  else if (strong) head = `Ваша сильная сторона — ${operations[first].line}: здесь она нужна в полную силу.`;
  else if (gap > 0.8) head = `Здесь придётся ${operations[first].line} — чуть больше, чем в том, что вы обычно смотрите.`;
  else head = `Здесь надо ${operations[first].line} — ровно в вашем темпе.`;
  return second ? `${head} Рядом — ${operations[second].short.toLowerCase()}.` : head;
}

/** Регистр, о котором стоит сказать в объяснении: либо тот, к которому участник тянется,
 *  либо, наоборот, непривычный — тогда это честно называется другим языком. */
function leadRegister(state: CognitiveState, work: WorkCard): { register: Register; familiar: boolean } | undefined {
  const taste = state.registerTaste;
  if (!taste?.length || !work.registers?.length) return undefined;
  const ranked = work.registers
    .map((r) => taste.find((t) => t.register === r) ?? { register: r, affinity: 0, n: 0 })
    .sort((a, b) => b.affinity - a.affinity);
  const best = ranked[0];
  if (best.affinity >= 0.25) return { register: best.register, familiar: true };
  // «другой язык» говорим только про заметно непривычное: около нуля — это просто нейтрально
  const worst = ranked[ranked.length - 1];
  return worst.affinity <= -0.3 ? { register: worst.register, familiar: false } : undefined;
}

const WHY_NOW: Record<Energy, string> = {
  low: 'Сегодня без усилия: держит внимание, не требуя работы.',
  normal: 'В самый раз для обычного вечера: нагрузка, которую вы уже тянете.',
  high: 'Есть силы — можно взять сложнее обычного; это честно помечено.',
};

/** Регистр, к которому участник тянется сам (вкус виден по выбору, а не по оценке). */
const likesRegister = (state: CognitiveState, work: WorkCard): boolean =>
  (work.registers ?? []).some((r) => (state.registerTaste?.find((t) => t.register === r)?.affinity ?? 0) >= 0.25);

/** Полный счёт кандидата в ленте — один на ленту и замер (tools/taste-eval.mts, 23.10): уровень и операции, разбор,
 *  якорь вкуса, засветка топами, послесловия, наклон. Правка счёта здесь сразу видна и в замере. */
export function fullScore(state: CognitiveState, c: Candidate, energy: Energy, options: RecommendOptions = {}, worth = options.afterwords ? deriveWorthProfile(options.afterwords) : undefined): number {
  // обученный счёт (23.10, опыт learnedBlend) — своя сумма своих частей; без опыта ниже всё прежнее
  if (EXPERIMENTS.learnedBlend) return learnedScore(state, c, energy, options, worth);
  const p = scoreParts(state, c, energy, options, worth);
  // порядок сложения — прежний: счёт тот же до последнего знака
  return p.content + p.essay + p.anchor - p.famePenalty + p.consensus + p.worth + p.boost;
}

/** Слагаемые полного счёта (23.10, выгрузка замера tools/taste-dump.mts → перебор весов tools/taste-tune.mts): fullScore —
 *  ровно их сумма, поэтому разложение не разойдётся с лентой. Каждое — уже с весом, как идёт в сумму; famePenalty
 *  вычитается. Нет опции — 0. При опыте learnedBlend fullScore — learnedScore (его части — learnedParts), а здесь прежнее
 *  разложение: выгрузка берёт из него сырые части для обучения. */
export interface ScoreParts { content: number; essay: number; anchor: number; famePenalty: number; consensus: number; worth: number; boost: number }
export function scoreParts(state: CognitiveState, c: Candidate, energy: Energy, options: RecommendOptions = {}, worth = options.afterwords ? deriveWorthProfile(options.afterwords) : undefined): ScoreParts {
  return {
    content: scoreCandidate(state, c.work, energy),
    essay: c.essays ? ESSAY_BONUS : 0,
    anchor: options.content?.weight ? options.content.weight * options.content.fit(c.work) : 0,
    // засветка топами пределом в шестёрке (опыт fameCap) — тогда в счёте её нет: штраф ставил любимое ниже нелюбимого
    famePenalty: options.fame && !EXPERIMENTS.fameCap ? famePenalty(options.fame.level(c.work), options.fame.mode, state.mediaLiteracy) : 0,
    consensus: options.consensus?.weight ? options.consensus.weight * (options.consensus.of(c.work) ?? 0) : 0,
    worth: worth ? afterwordBonus(worth, c.work) : 0,
    boost: options.boost ? options.boost.weight * options.boost.fit(c.work) : 0,
  };
}

/** Доли scoreCandidate до весов (23.10, та же выгрузка): близость уровня, операций и регистра 0…1 и остаток (ниша, сильная
 *  сторона, минус время сериала и тяжесть). Считает сам scoreCandidate с единичными весами — второй копии формулы нет:
 *  scoreCandidate = (Σ вес·доля) / Σ весов + остаток. Нет разметки (счёт 0) — undefined. */
export function contentParts(state: CognitiveState, work: WorkCard, energy: Energy): { level: number; ops: number; register: number; rest: number } | undefined {
  if (!work.complexityLevel || !work.primaryOperations.length) return undefined;
  const register = registerFit(state, work);
  const rest = scoreCandidate(state, work, energy, { level: 0, ops: 0, register: 1 }) - register;
  return {
    level: scoreCandidate(state, work, energy, { level: 1, ops: 0, register: 0 }) - rest,
    ops: scoreCandidate(state, work, energy, { level: 0, ops: 1, register: 0 }) - rest,
    register, rest,
  };
}

/** Обученный счёт ленты (23.10, опыт learnedBlend, решение владельца): веса — tools/taste-tune.mts --train b по выгрузке
 *  frozen (104 истории, флаги по умолчанию; .cache/eval/tune-2026-10-23-final-frozen.md, «Обучение b»). Цель b — спрятанное
 *  любимое против всего пула («найти любимое во всём пуле», ближе к hit@K): на чужих частях hit@150 18% против 3% у прежних
 *  весов. Шкала — content = 1 (столбец «в ленте»). Части — ровно те, что пишет выгрузка (learnedParts ↔ tools/taste-dump.mts):
 *  нет значения — 0 и свой вес из `missing`, как в тюнере. Год в обучении шёл как есть, а вклад у него заметный
 *  (стандартизованный 0,13 — как у разбора), поэтому здесь он центрирован средним годом пула выгрузки (1996,4; нет года —
 *  как средний), и сдвиг к порогу 0.3 пересчитан: −2,615 + 0,0018566 · 1996,4 = 1,0912 — для фильмов с годом счёт тот же.
 *  worth и boost в выгрузке не менялись (послесловий и наклона у историй замера нет) — им прежний вес 1.
 *  Поменялись части счёта, пул или флаги — перегенерировать: taste-dump → dump-add-itemsim → taste-tune --train b. */
export const LEARNED_B = {
  content: 1, essay: 8.3197, anchor: -2.9387, register: 0.07456, level: 0.15286, ops: -0.53277,
  fame: 0.18827, famePenalty: 0.58603, consensus: 0.32626, itemSim: 0.683, year: 0.0018566, loud: -0.040604,
  worth: 1, boost: 1,
  missing: { register: -0.10146, level: -0.10146, ops: -0.10146, consensus: -0.47693, itemSim: -0.50081 } as Partial<Record<string, number>>,
  yearMean: 1996.4,
  shift: 1.0912,
};
/** Обученный счёт с EASE (24.10, опыт ease при learnedBlend, решение владельца): тот же taste-tune --train b, но на выгрузке
 *  frozen-lr-feed со столбцами easeBin и easeLike (tools/dump-add-ease.mts: bin и like, λ 200, minRaters 3; .cache/eval/
 *  tune-2026-10-24-learned-ease.md, «Обучение b»): на чужих частях hit@150 30% против 18% у LEARNED_B; почти весь вклад —
 *  easeBin (стандартизованный 0,42 — как у fame), у easeLike 0,01. Веса — заново все, не только EASE: обучались вместе.
 *  Шкала — content = 1. Год центрирован, как у LEARNED_B: пул выгрузки тот же (frozen, средний год 1996,4), сдвиг к порогу
 *  0.3 пересчитан: 0,12045 + 0,00050848 · 1996,4 = 1,1356. У easeBin и easeLike «нет значения» обучилось поровну (они
 *  пустые в одних местах) — вместе −1,368. Работает, только когда таблица EASE пришла (options.ease); нет её — LEARNED_B. */
export const LEARNED_E = {
  content: 1, essay: 7.3227, anchor: -8.5866, register: 1.0273, level: 1.0132, ops: -0.48896,
  fame: 0.83126, famePenalty: -18.329, consensus: 0.97007, itemSim: 1.034, year: 0.00050848, loud: -0.34593,
  easeBin: 10.861, easeLike: 0.6036,
  worth: 1, boost: 1,
  missing: { register: -0.081154, level: -0.081154, ops: -0.081154, consensus: 0.09068, itemSim: -0.4379, easeBin: -0.68402, easeLike: -0.68402 } as Partial<Record<string, number>>,
  yearMean: 1996.4,
  shift: 1.1356,
};
export type LearnedPart = Exclude<keyof typeof LEARNED_E, 'missing' | 'yearMean' | 'shift'>;
type LearnedWeights = Record<LearnedPart, number> & { missing: Partial<Record<string, number>>; yearMean: number; shift: number };
/** LEARNED_B с нулями у EASE: частей easeBin/easeLike без таблицы нет (undefined), веса им не нужны — счёт побитно прежний */
const LEARNED_B_W: LearnedWeights = { ...LEARNED_B, easeBin: 0, easeLike: 0 };
/** веса обученного счёта: с таблицей EASE (опыт ease) — LEARNED_E, иначе LEARNED_B */
const learnedWeights = (options: RecommendOptions): LearnedWeights => (EXPERIMENTS.ease && options.ease ? LEARNED_E : LEARNED_B_W);
/** Части обученного счёта: число — значение, null — нет значения (0 + вес «нет значения»), undefined — источника нет вовсе
 *  (таблица не пришла, у человека нет оценок): тогда части нет ни у одного фильма — порядок тот же, а порог 0.3 не съеден.
 *  famePenalty — сам штраф засветки при любом опыте (fameCap его из счёта не убирает: вес обученный). */
export function learnedParts(state: CognitiveState, c: Candidate, energy: Energy, options: RecommendOptions = {}, worth = options.afterwords ? deriveWorthProfile(options.afterwords) : undefined): Record<LearnedPart, number | null | undefined> {
  const w = c.work, cp = contentParts(state, w, energy);
  const fame = options.fame?.level(w);
  const W = learnedWeights(options), ease = EXPERIMENTS.ease ? options.ease : undefined;
  return {
    content: scoreCandidate(state, w, energy),
    essay: c.essays ? ESSAY_BONUS : 0,
    anchor: options.content?.weight ? options.content.weight * options.content.fit(w) : 0,
    register: cp?.register ?? null, level: cp?.level ?? null, ops: cp?.ops ?? null,
    fame: fame ?? 0,
    famePenalty: options.fame ? famePenalty(fame, options.fame.mode, state.mediaLiteracy) : 0,
    consensus: options.consensus ? options.consensus.of(w) ?? null : undefined,
    itemSim: options.itemSim ? options.itemSim.of(w) ?? null : undefined,
    year: w.year != null ? w.year - W.yearMean : null,
    loud: (fame ?? 0) >= 2 ? 1 : 0,
    worth: worth ? afterwordBonus(worth, w) : 0,
    boost: options.boost ? options.boost.weight * options.boost.fit(w) : 0,
    // EASE (опыт ease) — последними: без таблицы их нет, и порядок сложения прежних частей тот же
    easeBin: ease ? ease.bin(w) ?? null : undefined,
    easeLike: ease ? ease.like(w) ?? null : undefined,
  };
}
/** Короткая история (23.10, опыт shortHistory; .cache/eval/cold-start-2310.md, «3. Обученный счёт ленты»): LEARNED_B обучен,
 *  когда у человека видно медиану n̄ = 186 оценок. На 5–40 оценках itemSim шумный, а вес у него вдвое больше, чем у consensus:
 *  эта часть счёта проигрывала одному consensus 0,02–0,08 AUC. Поправка — множитель r(n) = min(1, [n/(n+k)] / [n̄/(n̄+k)])
 *  к весу itemSim и к его «нет значения» (иначе «нет похожих» штрафует у новичка почти всё): n = 5 → 0,07, 20 → 0,26,
 *  40 → 0,44, 100 → 0,77, от 186 — 1 (прежний счёт). boostConsensus — второй вариант (мерить отдельно: с ним растёт
 *  малоизвестное): вес consensus × (2 − r(n)), его «нет значения» прежнее. */
export const SHORT_HISTORY = { nTrain: 186, k: 100, boostConsensus: false };
export const shortHistoryR = (n: number): number =>
  Math.min(1, (n / (n + SHORT_HISTORY.k)) / (SHORT_HISTORY.nTrain / (SHORT_HISTORY.nTrain + SHORT_HISTORY.k)));
export function learnedScore(state: CognitiveState, c: Candidate, energy: Energy, options: RecommendOptions = {}, worth = options.afterwords ? deriveWorthProfile(options.afterwords) : undefined): number {
  const p = learnedParts(state, c, energy, options, worth);
  // без опыта (или без числа оценок) множители — ровно 1, и счёт побитно прежний: ветки ниже их не трогают
  const r = EXPERIMENTS.shortHistory && options.rated != null ? shortHistoryR(options.rated) : 1;
  const W = learnedWeights(options);
  let s = W.shift;
  for (const k of Object.keys(p) as LearnedPart[]) {
    const x = p[k];
    if (x === undefined) continue;
    if (r !== 1 && k === 'itemSim') { s += x === null ? (W.missing.itemSim ?? 0) * r : W.itemSim * r * x; continue; }
    if (r !== 1 && k === 'consensus' && SHORT_HISTORY.boostConsensus && x !== null) { s += W.consensus * (2 - r) * x; continue; }
    s += x === null ? W.missing[k] ?? 0 : W[k] * x;
  }
  return s;
}

/** Слейт: лучшие по оценке, разные первые операции — и разные регистры. Второе появилось,
 *  когда вкус пошёл в оценку: без ограничения слейт схлопывался в один регистр (четыре
 *  детектива подряд), а это уже не подбор, а эхо. Поэтому не больше двух на регистр и хотя бы
 *  один кадр на другом языке, чем привычный, — шаг в сторону по вкусу, не по сложности. */
export function recommend(state: CognitiveState, candidates: Candidate[], energy: Energy, limit = 6, createdAt = '', options: RecommendOptions = {}): Recommendation[] {
  const maxSeries = options.maxSeries ?? 1;
  const worth = options.afterwords ? deriveWorthProfile(options.afterwords) : undefined;
  const all = candidates
    // новичку в сериалах — только короткий вход
    .filter((c) => !options.seriesNovice || !isSeries(c.work) || isShortSeries(c.work))
    .filter((c) => !options.fame || !fameExcluded(options.fame.level(c.work), options.fame.mode))
    .map((c) => ({ c, score: fullScore(state, c, energy, options, worth) }));
  // подбор в два шага (23.10, опыт twoStage, candidates.ts; квоты TWO_STAGE_FEED): порядок пула — twoStageOrder, как в замере
  // (tools/taste-eval.mts): отобранные по счёту, за ними остальные по счёту; пул не урезан. Отбор — по всему пулу, порог 0.3 —
  // после: он только вынимает слабое, не меняя порядка (отобранное ниже порога не показывается и квоту не освобождает). Дальше
  // всё прежнее: разнообразие, предел громких, «другой язык» и разборы вперёд идут по этому порядку
  const scored = EXPERIMENTS.twoStage
    ? twoStageSort(all, options).filter((x) => x.score > 0.3)
    : all.filter((x) => x.score > 0.3).sort((a, b) => b.score - a.score);
  const picked: typeof scored = [];
  const seenLead = new Map<CognitiveOperation, number>();
  const seenRegister = new Map<Register, number>();
  let series = 0;
  // громких в шестёрке — не больше предела (опыт fameCap): засветка топами пределом, а не штрафом; и при обученном счёте
  // (learnedBlend, 23.10): он громкое поднимает, предел держит шестёрку от «что смотрят все» (при «мягко» — два)
  const cap = (EXPERIMENTS.fameCap || EXPERIMENTS.learnedBlend) && options.fame ? FAME_CAP[options.fame.mode] : Infinity;
  const loud = (w: WorkCard) => (options.fame?.level(w) ?? 0) >= 2;
  let louds = 0;
  for (const x of scored) {
    if (isSeries(x.c.work) && series >= maxSeries) continue;
    if (louds >= cap && loud(x.c.work)) continue;
    const lead = x.c.work.primaryOperations[0]?.op;
    if (lead && (seenLead.get(lead) ?? 0) >= 2) continue;
    const regs = x.c.work.registers ?? [];
    if (regs.length && regs.every((r) => (seenRegister.get(r) ?? 0) >= 2)) continue;
    picked.push(x);
    if (isSeries(x.c.work)) series += 1;
    if (loud(x.c.work)) louds += 1;
    if (lead) seenLead.set(lead, (seenLead.get(lead) ?? 0) + 1);
    regs.forEach((r) => seenRegister.set(r, (seenRegister.get(r) ?? 0) + 1));
    if (picked.length >= limit) break;
  }
  if (options.fill && picked.length < limit) {
    for (const x of scored) {
      if (picked.length >= limit) break;
      if (picked.includes(x) || (isSeries(x.c.work) && series >= maxSeries)) continue;
      picked.push(x);
      if (isSeries(x.c.work)) series += 1;
    }
  }
  // один кадр на непривычном языке: если вкус известен и весь слейт в любимых регистрах
  if (state.registerTaste?.length && picked.length >= 4 && picked.every((x) => likesRegister(state, x.c.work))) {
    const other = scored.find((x) => !picked.includes(x) && !likesRegister(state, x.c.work) && !isSeries(x.c.work));
    if (other) picked.splice(picked.length - 1, 1, other);
  }
  if (options.essayFirst) essaysFirst(picked, scored, options.essayFirst, maxSeries);
  return picked.map(({ c }, i) => {
    const { slot, stretch } = slotFor(state, c.work, energy);
    const ops = targetOps(state, c.work);
    const reg = leadRegister(state, c.work);
    const base = reg
      ? `${why(state, c.work, ops)} ${reg.familiar ? `И это ${registers[reg.register].line}.` : `Язык другой, чем обычно: ${registers[reg.register].line}.`}`
      : why(state, c.work, ops);
    const time = seriesLine(c);
    return {
      id: `rec-${energy}-${c.work.id}`,
      work: c.work,
      slot: i === 0 && slot === 'next_step' ? 'next_step' : slot,
      stretch,
      targetOperations: ops,
      ...(c.season ? { season: c.season } : {}),
      explanation: {
        what: c.what,
        why: time ? `${base} ${time}` : base,
        whyNow: WHY_NOW[energy],
        whatNext: '',
      },
      readiness: { ready: true, missing: [] },
      createdAt,
    };
  });
}

/** Первые `need` мест — кадры с разбором (ТВ-2). Своих с разбором в слейте мало — добираем
 *  лучших с разбором из оставшихся, вытесняя последних без разбора; потом ставим их вперёд,
 *  не меняя порядка внутри. Кандидатов с разбором нет вовсе — слейт остаётся как был. */
export function essaysFirst<T extends { c: Candidate }>(picked: T[], scored: T[], need: number, maxSeries: number): void {
  const n = Math.min(need, picked.length);
  const has = (x: T) => (x.c.essays ?? 0) > 0;
  for (const x of scored) {
    if (picked.filter(has).length >= n) break;
    if (picked.includes(x) || !has(x)) continue;
    const drop = [...picked].reverse().find((p) => !has(p));
    if (!drop) break;
    const seriesAfter = picked.filter((p) => p !== drop && isSeries(p.c.work)).length + (isSeries(x.c.work) ? 1 : 0);
    if (seriesAfter > maxSeries) continue;
    picked.splice(picked.indexOf(drop), 1, x);
  }
  const head = picked.filter(has).slice(0, n);
  picked.splice(0, picked.length, ...head, ...picked.filter((x) => !head.includes(x)));
}

/** Строка о времени сериала в объяснении (Е4): сколько это часов и почему именно так. */
function seriesLine(c: Candidate): string | undefined {
  if (!isSeries(c.work)) return undefined;
  const hours = seriesHours(c.work);
  const about = hours ? `около ${hours} ч` : undefined;
  if (c.season) return `Антология: ${c.season} сезон — отдельная история${about ? `, ${about}` : ''}; остальные можно не смотреть.`;
  if (c.work.series?.seasons === 1 && c.work.series.status === 'ended') return `Мини-сериал${about ? `: ${about}` : ''} — один сезон и конец.`;
  return about ? `Сериал: ${about} всего — это не на вечер.` : 'Сериал — это не на вечер: решайте, есть ли на него недели.';
}
