// Данные кураторских экранов сверх выгрузки бандла (§15 их не содержит): таксономия,
// прогоны, качество против эталона, разница черновика и публикации, потолок
// согласованности, надёжность участников, сигналы с провенансом. Правки — здесь.
import type {
  AgreementCeilingData, AnnotationDiffRow, AnnotationRun, ExternalSignal, ID, QualityMetric, TropeTreeNode,
} from '@/types/tmdf';

export const taxonomy: TropeTreeNode[] = [
  {
    name: 'Повествование', count: 41,
    children: [
      { name: 'Ненадёжный рассказчик', count: 14, operations: ['perspective_taking', 'critical_analysis'] },
      { name: 'Несовместимые показания', count: 3, operations: ['perspective_taking', 'synthesis'] },
      { name: 'Рассказ в рассказе', count: 7, operations: ['abstraction', 'metacognition'] },
      { name: 'Кольцевая композиция', count: 9, operations: ['pattern_recognition'] },
      { name: 'Обратная хронология', count: 5, operations: ['causal_reasoning', 'pattern_recognition'] },
    ],
  },
  {
    name: 'Время и память', count: 23,
    children: [
      { name: 'Память как улика', count: 4, operations: ['causal_reasoning', 'critical_analysis'] },
      { name: 'Нелинейное время', count: 11, operations: ['pattern_recognition', 'synthesis'] },
      { name: 'Петля времени', count: 6, operations: ['causal_reasoning'] },
      { name: 'Ложное воспоминание', count: 2, operations: ['critical_analysis', 'perspective_taking'] },
    ],
  },
  {
    name: 'Персонаж и желание', count: 27,
    children: [
      { name: 'Подавленное желание', count: 12, operations: ['perspective_taking', 'causal_reasoning'] },
      { name: 'Двойник', count: 8, operations: ['analogical_thinking', 'perspective_taking'] },
      { name: 'Ложная цель', count: 5, operations: ['critical_analysis'] },
      { name: 'Герой без цели', count: 2, operations: ['metacognition'] },
    ],
  },
  {
    name: 'Форма и приём', count: 15,
    children: [
      { name: 'Комментарий вместо сюжета', count: 2, operations: ['metacognition', 'critical_analysis'] },
      { name: 'Осмысление приёма', count: 6, operations: ['metacognition', 'abstraction'] },
      { name: 'Условная актёрская манера', count: 4, operations: ['abstraction'] },
      { name: 'Слом четвёртой стены', count: 3, operations: ['metacognition'] },
    ],
  },
];

export const runs: AnnotationRun[] = [
  {
    id: 'run-03', title: 'Локальная модель: 24 без разметки', status: 'annotating', done: 9, total: 24,
    provider: 'local', tokens: 168_400, seconds: 371, costUsd: 0, startedAt: '2026-09-22',
  },
  {
    id: 'run-02', title: 'API: эталонный набор, слои тропы + операции', status: 'validation_failed', done: 12, total: 12,
    provider: 'anthropic_api', tokens: 412_900, seconds: 640, costUsd: 3.84, startedAt: '2026-09-19',
    errors: ['w15 Бледный огонь: barriers[1].kind не из словаря', 'w14 Шум и ярость: tropes[0].usage пустой'],
  },
  {
    id: 'run-01', title: 'Пакет pk-2026-09-14', status: 'published', done: 5, total: 5,
    provider: 'packet', startedAt: '2026-09-14',
  },
];

export const qualityMetrics: QualityMetric[] = [
  { layer: 'тропы', provider: 'local', alpha: 0.62, ceiling: 0.79, fit: false },
  { layer: 'тропы', provider: 'anthropic_api', alpha: 0.74, ceiling: 0.79, fit: true },
  { layer: 'операции', provider: 'local', alpha: 0.58, ceiling: 0.71, fit: false },
  { layer: 'операции', provider: 'anthropic_api', alpha: 0.69, ceiling: 0.71, fit: true },
  { layer: 'барьеры', provider: 'expert_consensus', alpha: 0.66, ceiling: 0.7, fit: true },
  { layer: 'сложность', provider: 'local', alpha: 0.71, ceiling: 0.74, fit: true },
];

export const ceiling: AgreementCeilingData = {
  selfAgreement: 0.79,
  weeks: 3,
  marks: [
    { label: 'локальная', alpha: 0.62 },
    { label: 'сообщество', alpha: 0.66 },
    { label: 'API', alpha: 0.74 },
  ],
};

/** Надёжность участника — против эталона; куратору, не участнику. */
export const reliability: Record<ID, string> = { c1: 'высокая', c2: 'средняя', c3: 'мало данных' };

/** Черновик модели против опубликованной версии — по аннотациям, у которых есть что сравнивать. */
export const diffs: Record<ID, AnnotationDiffRow[]> = {
  'an-01': [
    { path: 'cognitive_operations.synthesis.demand', draft: '0.82', current: '0.70', changed: true, confidence: 'low',
      evidence: 'фрагменты трёх времён без монтажной подсказки; хроника вклеена как равноправная' },
    { path: 'cognitive_operations.perspective_taking.demand', draft: '0.74', current: '0.74', confidence: 'medium' },
    { path: 'tropes[3].usage', draft: 'deconstruction', current: 'straight', changed: true, confidence: 'low',
      evidence: 'мать и жена — одна актриса; приём двойника не назван, но и не опрокинут' },
    { path: 'complexity.level', draft: '7', current: '7', confidence: 'high' },
    { path: 'barriers[0]', draft: 'Фрагментарная структура', current: 'Фрагментарная структура', confidence: 'high' },
  ],
  'an-02': [
    { path: 'barriers[1].kind', draft: 'commentary_as_plot', current: null, changed: true, confidence: 'low',
      evidence: 'значение не из словаря барьеров; ближайшее — «Комментарий вместо сюжета»' },
    { path: 'cognitive_operations.metacognition.demand', draft: '0.91', current: null, confidence: 'high',
      evidence: 'комментарий Кинбота спорит с поэмой Шейда; читатель следит за собственным чтением' },
    { path: 'tropes[0]', draft: 'Ненадёжный рассказчик · straight', current: null, confidence: 'high' },
  ],
  'an-04': [
    { path: 'cognitive_operations.abstraction.activation', draft: '0.66', current: '0.60', changed: true, confidence: 'medium',
      evidence: 'пятьдесят пять городов — вариации одной схемы; активация зависит от читателя' },
    { path: 'tropes[1].usage', draft: 'meta', current: 'meta', confidence: 'high' },
  ],
  'an-09': [
    { path: 'cognitive_operations.metacognition.demand', draft: '0.88', current: '0.80', changed: true, confidence: 'medium',
      evidence: 'спектакль о жизни, вложенный в жизнь; границы уровней стираются намеренно' },
    { path: 'complexity.level', draft: '9', current: '8', changed: true, confidence: 'medium' },
  ],
};

/** Сигналы с провенансом, на которые опиралась разметка барьеров и isNicheMasterpiece. */
export const signals: Record<ID, ExternalSignal[]> = {
  'an-01': [
    { kind: 'polarization', source: 'tmdb', value: 0.31, fetchedAt: '2026-09-15', license: 'TMDb API terms' },
    { kind: 'vote_count', source: 'tmdb', value: 1240, fetchedAt: '2026-09-15', license: 'TMDb API terms' },
  ],
  'an-03': [
    { kind: 'critic_audience_gap', source: 'movielens', value: 0.12, fetchedAt: '2026-09-10', license: 'MovieLens, research use' },
    { kind: 'availability', source: 'tmdb', value: 1, fetchedAt: '2026-09-21', license: 'JustWatch via TMDb' },
  ],
  'an-05': [
    { kind: 'polarization', source: 'tmdb', value: 0.18, fetchedAt: '2026-09-15', license: 'TMDb API terms' },
  ],
  'an-08': [
    { kind: 'vote_count', source: 'open_library', value: 312, fetchedAt: '2026-09-12', license: 'Open Library, CC0' },
  ],
};
