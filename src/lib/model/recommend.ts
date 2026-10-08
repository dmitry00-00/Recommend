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
}
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

/** Оценка кандидата: 0 — мимо, ~1 — ровно то. */
export function scoreCandidate(state: CognitiveState, work: WorkCard, energy: Energy, weights: ScoreWeights = SCORE_WEIGHTS): number {
  if (!work.complexityLevel || !work.primaryOperations.length) return 0;
  const target = state.complexityComfort + ENERGY_STEP[energy];
  const levelFit = Math.max(0, 1 - Math.abs(work.complexityLevel - target) / 3);
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
    - timePenalty(work, energy);
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

/** Слейт: лучшие по оценке, разные первые операции — и разные регистры. Второе появилось,
 *  когда вкус пошёл в оценку: без ограничения слейт схлопывался в один регистр (четыре
 *  детектива подряд), а это уже не подбор, а эхо. Поэтому не больше двух на регистр и хотя бы
 *  один кадр на другом языке, чем привычный, — шаг в сторону по вкусу, не по сложности. */
export function recommend(state: CognitiveState, candidates: Candidate[], energy: Energy, limit = 6, createdAt = '', options: RecommendOptions = {}): Recommendation[] {
  const maxSeries = options.maxSeries ?? 1;
  const scored = candidates
    // новичку в сериалах — только короткий вход
    .filter((c) => !options.seriesNovice || !isSeries(c.work) || isShortSeries(c.work))
    .map((c) => ({ c, score: scoreCandidate(state, c.work, energy) + (c.essays ? ESSAY_BONUS : 0) }))
    .filter((x) => x.score > 0.3)
    .sort((a, b) => b.score - a.score);
  const picked: typeof scored = [];
  const seenLead = new Map<CognitiveOperation, number>();
  const seenRegister = new Map<Register, number>();
  let series = 0;
  for (const x of scored) {
    if (isSeries(x.c.work) && series >= maxSeries) continue;
    const lead = x.c.work.primaryOperations[0]?.op;
    if (lead && (seenLead.get(lead) ?? 0) >= 2) continue;
    const regs = x.c.work.registers ?? [];
    if (regs.length && regs.every((r) => (seenRegister.get(r) ?? 0) >= 2)) continue;
    picked.push(x);
    if (isSeries(x.c.work)) series += 1;
    if (lead) seenLead.set(lead, (seenLead.get(lead) ?? 0) + 1);
    regs.forEach((r) => seenRegister.set(r, (seenRegister.get(r) ?? 0) + 1));
    if (picked.length >= limit) break;
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
