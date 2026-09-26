// Отчёт петли прогноза (трек Б, шаг Б2): насколько мы угадываем, как пойдёт фильм, и что люди
// делают с лентой. Чистая функция над строками таблиц — ей всё равно, откуда строки: из D1,
// из SQLite на bothost или из скачанного файла базы (tools/loop-report.mts).
//
// Что считаем:
//   · калибровка — Брайер (многоклассовый, 0 — идеально, 2 — хуже некуда) и доля точных
//     попаданий: у человека, у модели и у двух базовых стратегий («всегда в самый раз» и
//     «частота по всем наблюдениям»). Модель полезна, только если бьёт базовые;
//   · совпадения «человек / модель / факт» — таблица сопряжённости;
//   · отказы и броски по причинам, сколько дней до броска;
//   · принятие слейта: показы → «начать» / «в планы» / «не сейчас».
// Порог честности (Б4): пока завершённых наблюдений меньше 30, веса не трогаем — отчёт
// так и пишет, чтобы не поддаться соблазну подкрутить модель под пять точек.

export type Difficulty = 'too_easy' | 'just_right' | 'too_hard';
export const DIFFICULTIES: Difficulty[] = ['too_easy', 'just_right', 'too_hard'];
export const HONEST_THRESHOLD = 30;

export interface LoopRows {
  predictions: { user_id: string; entry_id: string; work_id: string; expected: string | null; model: string | null; model_p: string | null; at: string }[];
  checkins: { user_id: string; entry_id: string; work_id: string; status: string; perceived: string | null; reason: string | null; at: string }[];
  journal: { user_id: string; entry_id: string; started_at: string | null; work_id?: string; status?: string; eagerness?: number | null }[];
  feedback: { user_id: string; rec_id: string | null; work_id: string | null; action: string; reason: string | null; at: string; eagerness?: number | null }[];
  impressions: { user_id: string; slate_id: string; rec_id: string; work_id: string; slot: string | null; rank: number | null; at: string }[];
}

type Odds = Record<Difficulty, number>;
const isDiff = (x: unknown): x is Difficulty => typeof x === 'string' && (DIFFICULTIES as string[]).includes(x);
const oneHot = (d: Difficulty): Odds => ({ too_easy: d === 'too_easy' ? 1 : 0, just_right: d === 'just_right' ? 1 : 0, too_hard: d === 'too_hard' ? 1 : 0 });
const brier = (p: Odds, fact: Difficulty) => DIFFICULTIES.reduce((s, d) => s + (p[d] - (d === fact ? 1 : 0)) ** 2, 0);
const round = (x: number, n = 3) => Math.round(x * 10 ** n) / 10 ** n;
const median = (xs: number[]) => { if (!xs.length) return undefined; const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };

export interface Score { n: number; brier: number; exact: number }
export interface LoopReport {
  generatedAt: string;
  users: number;
  observations: number;
  honest: boolean;
  note: string;
  calibration: { human?: Score; model?: Score; alwaysJustRight?: Score; baseRate?: Score };
  facts: Record<Difficulty, number>;
  /** строки — прогноз (человек / модель), столбцы — факт */
  confusion: { human: Record<Difficulty, Record<Difficulty, number>>; model: Record<Difficulty, Record<Difficulty, number>> };
  agreement: { humanModel: number | undefined; n: number };
  /** «fit» — бросили из-за самого фильма (не зацепило, слишком сложно): это про подбор;
   *  остальное — обстоятельства (нет времени, отвлекли), подбор тут ни при чём */
  abandon: { n: number; reasons: Record<string, number>; medianDays?: number; fit: number; circumstances: number };
  /** начали (переход в кинотеатр или «Смотрю»), но не посмотрели — «ещё не смотрел» или вопрос
   *  остался без ответа. Не броски: так видно, сколько стартов шумные */
  notWatched: { answered: number; expired: number };
  dismiss: Record<string, number>;
  slate: { impressions: number; slates: number; start: number; save: number; dismiss: number; acceptance?: number };
  /** «в планы» по тому, насколько хотелось (1–5, 0 — без оценки, кнопкой): сколько отложено,
   *  сколько потом начато и досмотрено. Если «хочется 5» доходят до просмотра не чаще «2»,
   *  шкала ничего не говорит и модели на неё опираться нельзя */
  plans: Record<string, { saved: number; started: number; finished: number }>;
}

const emptyMatrix = () => Object.fromEntries(DIFFICULTIES.map((a) => [a, Object.fromEntries(DIFFICULTIES.map((b) => [b, 0]))])) as Record<Difficulty, Record<Difficulty, number>>;

export function loopReport(rows: LoopRows, now = new Date()): LoopReport {
  // последний чек-ин по записи — «как оказалось»; передумал — считаем последнее слово
  const lastCheck = new Map<string, LoopRows['checkins'][number]>();
  for (const c of [...rows.checkins].sort((a, b) => a.at.localeCompare(b.at))) lastCheck.set(`${c.user_id}|${c.entry_id}`, c);
  const started = new Map(rows.journal.map((j) => [`${j.user_id}|${j.entry_id}`, j.started_at]));

  const obs: { human?: Difficulty; model?: Difficulty; modelOdds?: Odds; fact: Difficulty }[] = [];
  for (const p of rows.predictions) {
    const c = lastCheck.get(`${p.user_id}|${p.entry_id}`);
    if (!c || !isDiff(c.perceived)) continue;
    let modelOdds: Odds | undefined;
    try { const o = p.model_p ? JSON.parse(p.model_p) : undefined; if (o && DIFFICULTIES.every((d) => typeof o[d] === 'number')) modelOdds = o; } catch { /* битая строка — без вероятностей */ }
    obs.push({ human: isDiff(p.expected) ? p.expected : undefined, model: isDiff(p.model) ? p.model : undefined, modelOdds, fact: c.perceived });
  }

  const facts = Object.fromEntries(DIFFICULTIES.map((d) => [d, obs.filter((o) => o.fact === d).length])) as Record<Difficulty, number>;
  const baseOdds: Odds = Object.fromEntries(DIFFICULTIES.map((d) => [d, obs.length ? facts[d] / obs.length : 1 / 3])) as Odds;
  const score = (pick: (o: typeof obs[number]) => { odds: Odds; point: Difficulty } | undefined): Score | undefined => {
    const xs = obs.map((o) => ({ o, p: pick(o) })).filter((x): x is { o: typeof obs[number]; p: { odds: Odds; point: Difficulty } } => Boolean(x.p));
    if (!xs.length) return undefined;
    return {
      n: xs.length,
      brier: round(xs.reduce((s, x) => s + brier(x.p.odds, x.o.fact), 0) / xs.length),
      exact: round(xs.filter((x) => x.p.point === x.o.fact).length / xs.length),
    };
  };
  const top = (o: Odds): Difficulty => DIFFICULTIES.reduce((a, b) => (o[b] > o[a] ? b : a));

  const confusion = { human: emptyMatrix(), model: emptyMatrix() };
  for (const o of obs) {
    if (o.human) confusion.human[o.human][o.fact]++;
    if (o.model) confusion.model[o.model][o.fact]++;
  }
  const both = obs.filter((o) => o.human && o.model);

  // броски: причина и сколько дней от старта
  const abandons = [...lastCheck.values()].filter((c) => c.status === 'abandoned');
  const reasons: Record<string, number> = {};
  const days: number[] = [];
  for (const c of abandons) {
    reasons[c.reason ?? 'no_reason'] = (reasons[c.reason ?? 'no_reason'] ?? 0) + 1;
    const s = started.get(`${c.user_id}|${c.entry_id}`);
    if (s) days.push((Date.parse(c.at) - Date.parse(s)) / 86400e3);
  }

  const dismiss: Record<string, number> = {};
  for (const f of rows.feedback.filter((f) => f.action === 'dismiss')) dismiss[f.reason ?? 'no_reason'] = (dismiss[f.reason ?? 'no_reason'] ?? 0) + 1;
  const shownRecs = new Set(rows.impressions.map((i) => `${i.user_id}|${i.rec_id}`));
  const actOnShown = (a: string) => new Set(rows.feedback.filter((f) => f.action === a && f.rec_id && shownRecs.has(`${f.user_id}|${f.rec_id}`)).map((f) => `${f.user_id}|${f.rec_id}`)).size;
  const start = actOnShown('start');
  const uniqueShown = shownRecs.size;

  // планы: последнее «хочется» по фильму и что с ним стало дальше — по записям и чек-инам
  const plans: LoopReport['plans'] = {};
  const want = new Map<string, number>();
  for (const f of [...rows.feedback].filter((f) => f.action === 'save' && f.work_id).sort((a, b) => a.at.localeCompare(b.at))) {
    want.set(`${f.user_id}|${f.work_id}`, f.eagerness ?? 0);
  }
  for (const j of rows.journal) if (j.work_id && j.status === 'planned' && !want.has(`${j.user_id}|${j.work_id}`)) want.set(`${j.user_id}|${j.work_id}`, j.eagerness ?? 0);
  const begun = new Set(rows.journal.filter((j) => j.work_id && j.status && j.status !== 'planned').map((j) => `${j.user_id}|${j.work_id}`));
  const done = new Set(rows.checkins.filter((c) => c.status === 'finished').map((c) => `${c.user_id}|${c.work_id}`));
  for (const [key, level] of want) {
    const row = (plans[String(level)] ??= { saved: 0, started: 0, finished: 0 });
    row.saved += 1;
    if (begun.has(key) || done.has(key)) row.started += 1;
    if (done.has(key)) row.finished += 1;
  }

  const honest = obs.length >= HONEST_THRESHOLD;
  return {
    generatedAt: now.toISOString(),
    users: new Set([...rows.predictions, ...rows.checkins, ...rows.impressions].map((r) => r.user_id)).size,
    observations: obs.length,
    honest,
    note: honest
      ? `Наблюдений ${obs.length} — можно сравнивать модель с базовыми стратегиями и подгонять веса (Б5).`
      : `Наблюдений ${obs.length} из ${HONEST_THRESHOLD}: веса не трогаем, только копим. Цифры ниже — для проверки, что петля пишется, а не для выводов.`,
    calibration: {
      human: score((o) => (o.human ? { odds: oneHot(o.human), point: o.human } : undefined)),
      model: score((o) => (o.modelOdds ? { odds: o.modelOdds, point: top(o.modelOdds) } : o.model ? { odds: oneHot(o.model), point: o.model } : undefined)),
      alwaysJustRight: score(() => ({ odds: oneHot('just_right'), point: 'just_right' })),
      baseRate: score(() => ({ odds: baseOdds, point: top(baseOdds) })),
    },
    facts,
    confusion,
    agreement: { humanModel: both.length ? round(both.filter((o) => o.human === o.model).length / both.length) : undefined, n: both.length },
    abandon: {
      n: abandons.length, reasons, medianDays: days.length ? round(median(days)!, 1) : undefined,
      fit: abandons.filter((c) => c.reason === 'too_hard' || c.reason === 'not_engaging').length,
      circumstances: abandons.filter((c) => c.reason !== 'too_hard' && c.reason !== 'not_engaging').length,
    },
    notWatched: {
      answered: rows.checkins.filter((c) => c.status === 'not_watched').length,
      expired: rows.checkins.filter((c) => c.status === 'expired').length,
    },
    dismiss,
    slate: {
      impressions: uniqueShown,
      slates: new Set(rows.impressions.map((i) => `${i.user_id}|${i.slate_id}`)).size,
      start,
      save: actOnShown('save'),
      dismiss: actOnShown('dismiss'),
      acceptance: uniqueShown ? round(start / uniqueShown) : undefined,
    },
    plans,
  };
}

/** Строки для отчёта из базы — одинаково для D1 и SQLite. `userId` — только свои. */
export async function loopRows(db: import('./env').D1Database, userId?: string): Promise<LoopRows> {
  const where = userId ? ' WHERE user_id = ?' : '';
  const q = <T>(sql: string) => (userId ? db.prepare(sql + where).bind(userId) : db.prepare(sql + where)).all<T>().then((r) => r.results);
  const [predictions, checkins, journal, feedback, impressions] = await Promise.all([
    q<LoopRows['predictions'][number]>('SELECT user_id, entry_id, work_id, expected, model, model_p, at FROM prediction'),
    q<LoopRows['checkins'][number]>('SELECT user_id, entry_id, work_id, status, perceived, reason, at FROM checkin'),
    q<LoopRows['journal'][number]>('SELECT user_id, entry_id, started_at, work_id, status, eagerness FROM journal'),
    q<LoopRows['feedback'][number]>('SELECT user_id, rec_id, work_id, action, reason, at, eagerness FROM feedback'),
    q<LoopRows['impressions'][number]>('SELECT user_id, slate_id, rec_id, work_id, slot, rank, at FROM impression'),
  ]);
  return { predictions, checkins, journal, feedback, impressions };
}
