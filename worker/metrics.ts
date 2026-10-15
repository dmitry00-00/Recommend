// «Сдвиг» и качество подбора (МА-1, МА-2, 13.10) — по отчёту «Дизайн, функционал и метрики» (reports/, §7).
// Чистая функция над строками таблиц, как loop.ts: проверяется синтетической когортой с известным ответом
// (tools/metrics-test.mts), строки сюда кладёт getFunnel (worker/funnel.ts).
//
// Шкала — сложность произведения 1–10 (`complexityLevel` разметки); уровень и признаки произведения клиент
// присылает вместе с показом, откликом и чек-ином (`level`, `traits`), а свой диапазон — снимком карты
// при каждой ленте (`level_state`): у сервера разметки нет, и у события остаётся тот уровень, по которому
// человек выбирал.
//
// Досмотр — чек-ин `finished` или «Видел» на фильме, который лента показала в один из прошлых дней
// (минимальная редакция: чек-инов там нет, «Видел» — отметка о просмотре с оценкой). «Видел» в тот же день,
// что и показ, — «уже знал», не досмотр по подсказке (так же считает воронка, `prompted`).
//
// МА-1 «Сдвиг» (главная метрика):
//   · старт — первый снимок карты (≥ 3 размеченных досмотра в истории): центр, границы [lo; hi];
//   · сдвиг — ≥ 2 досмотра после старта с уровнем выше `hi`;
//   · g по Хейку — (медиана досмотренного после старта − центр) / (10 − центр), от −1 до 1; < 0,3 низко, ≥ 0,7 высоко;
//   · карта — последний снимок против первого: центр сместился (≥ 0,5) или диапазон сузился (≥ 0,5) — «уточнение»;
//   · когорта 4–8 недель — старт 28–56 дней назад: ей уже было когда сдвинуться.
// МА-2, за 28 дней:
//   · proxy reward — досмотр, у которого оценка ≥ 4 поставлена через ≥ 3 дня после досмотра, а уровень выше
//     медианы истории человека (на снимке до досмотра);
//   · valued — досмотр со «стоило ли» ≥ 4 (чек-ин, ДФ-10), без него — с оценкой «Как вам?», поставленной при досмотре;
//   · take-rate — показанное (человек × место в ленте) → принято («в планы», «смотрю»); «качественное» —
//     принято и потом «Смотреть» или досмотр, либо досмотр по подсказке («Видел» после показа);
//   · ECS — разных принятых / всех принятий; покрытие — доля показанного, что хоть раз приняли;
//   · GS — косинус принятого к центру масс вкуса человека (операции и регистры), неделя 1 против недель 4–8
//     после активации; ниже — разнообразнее. Ограничитель: разброс сложности принятого не падает;
//   · ревизит — открыта карточка того, что человек уже оценил или досмотрел.

export const LEVEL_MAX = 10;
const DAY = 864e5;

export interface Traits { op?: Record<string, number>; rg?: string[] }
export interface MetricRows {
  users: { id: string; created_at: string }[];
  visits: { user_id: string; day: string }[];
  states: { user_id: string; at: string; center: number; lo: number; hi: number; median: number | null; n: number }[];
  impressions: { user_id: string; rec_id: string; work_id: string; level: number | null; traits: string | null; at: string }[];
  feedback: { user_id: string; rec_id: string | null; work_id: string | null; action: string; reason: string | null; level: number | null; traits: string | null; at: string }[];
  checkins: { user_id: string; work_id: string; status: string; level: number | null; worth: number | null; at: string }[];
  ratings: { user_id: string; work_id: string; rating: number; at: string }[];
  events: { user_id: string; kind: string; work_id: string | null; at: string }[];
}

/** Минимум / цель. Начальные — откалибровать через две недели беты, как THRESHOLDS воронки: по одной
 *  неделе не двигать, вывод — от когорты в 100–150 человек. g — по Хейку (< 0,3 низко, ≥ 0,7 высоко). */
export const METRIC_BOUNDS = {
  shifted: { floor: 0.1, target: 0.2 },
  hakeG: { floor: 0.3, target: 0.7 },
  proxyReward: { floor: 0.1, target: 0.25 },
  valued: { floor: 0.5, target: 0.7 },
  qualityTake: { floor: 0.03, target: 0.08 },
  ecs: { floor: 0.5, target: 0.7 },
  coverage: { floor: 0.2, target: 0.4 },
  diversified: { floor: 0.3, target: 0.5 },
  spreadHeld: { floor: 0.5, target: 0.7 },
  revisit: { floor: 0.1, target: 0.25 },
} as const;

const MSK = 3 * 3600e3;
const mskDay = (iso: string | number) => new Date((typeof iso === 'number' ? iso : Date.parse(iso)) + MSK).toISOString().slice(0, 10);
const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
const ratio = (a: number, b: number): number | null => (b > 0 ? a / b : null);
const round = (x: number | null | undefined, n = 3) => (x == null ? null : Math.round(x * 10 ** n) / 10 ** n);
const median = (xs: number[]): number | null => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const std = (xs: number[]): number | null => {
  if (xs.length < 2) return null;
  const mean = xs.reduce((a, x) => a + x, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, x) => a + (x - mean) ** 2, 0) / xs.length);
};
const lv = (x: number | null | undefined): number | null => (x != null && x > 0 ? x : null);
const parseTraits = (s: string | null): Traits | null => {
  if (!s) return null;
  try { return JSON.parse(s) as Traits; } catch { return null; }
};
/** Вектор вкуса: операции — с их интенсивностью, регистры — единицей. */
const vectorOf = (t: Traits | null): Map<string, number> | null => {
  if (!t) return null;
  const v = new Map<string, number>();
  for (const [k, x] of Object.entries(t.op ?? {})) if (x > 0) v.set(`op:${k}`, x);
  for (const r of t.rg ?? []) v.set(`rg:${r}`, 1);
  return v.size ? v : null;
};
const cosine = (a: Map<string, number>, b: Map<string, number>): number => {
  let dot = 0, na = 0, nb = 0;
  for (const [k, x] of a) { na += x * x; dot += x * (b.get(k) ?? 0); }
  for (const x of b.values()) nb += x * x;
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
};

interface Finish { user: string; work: string; level: number | null; at: string; via: 'checkin' | 'seen'; worth: number | null }
interface Take { user: string; work: string; level: number | null; traits: Traits | null; at: string; via: 'accept' | 'seen' }

export interface Metrics {
  asOf: string;
  bounds: typeof METRIC_BOUNDS;
  shift: {
    cohort: ShiftSummary & { from: string; to: string };
    all: ShiftSummary;
    /** активные за 28 дней без стартовой карты: меньше трёх размеченных досмотров в истории */
    noStart: number;
  };
  quality: {
    since: string;
    proxyReward: { share: number | null; n: number; base: number; finishes: number };
    valued: { share: number | null; n: number; answered: number; finishes: number; answerRate: number | null };
    take: { shown: number; accepted: number; quality: number; takeRate: number | null; qualityTake: number | null };
    ecs: { takes: number; unique: number; ecs: number | null; shownWorks: number; coverage: number | null };
    gs: { users: number; week1: number | null; later: number | null; diversified: number | null; spreadHeld: number | null; spreadUsers: number };
    revisit: { cards: number; revisits: number; share: number | null; users: number; usersWithRevisit: number; userShare: number | null };
  };
  /** удержание от активации (первая лента), а не от входа: D1/D7/D30 «в этот день» и «в этот день и позже» */
  retention: { k: 1 | 7 | 30; cohorts: number; users: number; exact: number; later: number; exactShare: number | null; laterShare: number | null }[];
  /** WAU — были хоть раз за 7 дней; последние 8 недель, неделя кончается вчера (по Москве) */
  wau: { to: string; users: number }[];
}
export interface ShiftSummary {
  users: number; shifted: number; share: number | null;
  g: { n: number; median: number | null; low: number; mid: number; high: number };
  map: { movedUp: number; movedDown: number; refined: number; same: number; noUpdate: number };
}

export function computeMetrics(rows: MetricRows, now = Date.now()): Metrics {
  const today = mskDay(now);
  const yesterday = addDays(today, -1);
  const since28 = addDays(today, -28);

  // ── досмотры: чек-ин `finished` или «Видел» после показа в прошлый день
  const shownDays = new Map<string, string>(); // user|work → самый ранний день показа
  const shownLevel = new Map<string, number>();
  const shownTraits = new Map<string, Traits>();
  for (const i of rows.impressions) {
    const key = `${i.user_id}|${i.work_id}`;
    const d = mskDay(i.at);
    if (!shownDays.has(key) || d < shownDays.get(key)!) shownDays.set(key, d);
    const l = lv(i.level);
    if (l != null) shownLevel.set(key, l);
    const t = parseTraits(i.traits);
    if (t) shownTraits.set(key, t);
  }
  const finishes = new Map<string, Finish>(); // user|work → первый досмотр
  const addFinish = (f: Finish) => {
    const key = `${f.user}|${f.work}`;
    const was = finishes.get(key);
    if (!was || f.at < was.at) finishes.set(key, { ...f, worth: f.worth ?? was?.worth ?? null });
    else if (was.worth == null && f.worth != null) was.worth = f.worth;
  };
  for (const c of rows.checkins) {
    if (c.status !== 'finished' || !c.work_id) continue;
    addFinish({ user: c.user_id, work: c.work_id, level: lv(c.level) ?? shownLevel.get(`${c.user_id}|${c.work_id}`) ?? null, at: c.at, via: 'checkin', worth: c.worth });
  }
  const seenPrompted = rows.feedback.filter((f) => f.action === 'dismiss' && f.reason === 'already_know' && f.work_id
    && shownDays.has(`${f.user_id}|${f.work_id}`) && shownDays.get(`${f.user_id}|${f.work_id}`)! < mskDay(f.at));
  for (const f of seenPrompted) {
    addFinish({ user: f.user_id, work: f.work_id!, level: lv(f.level) ?? shownLevel.get(`${f.user_id}|${f.work_id}`) ?? null, at: f.at, via: 'seen', worth: null });
  }
  const finishesOf = new Map<string, Finish[]>();
  for (const f of finishes.values()) (finishesOf.get(f.user) ?? finishesOf.set(f.user, []).get(f.user)!).push(f);

  // ── снимки карты по людям, по времени
  const statesOf = new Map<string, MetricRows['states']>();
  for (const s of [...rows.states].sort((a, b) => a.at.localeCompare(b.at))) {
    if (s.n < 3) continue;
    (statesOf.get(s.user_id) ?? statesOf.set(s.user_id, []).get(s.user_id)!).push(s);
  }
  const stateBefore = (user: string, at: string) => {
    let out: MetricRows['states'][number] | undefined;
    for (const s of statesOf.get(user) ?? []) if (s.at <= at) out = s; else break;
    return out;
  };

  // ── МА-1: сдвиг по людям
  const perUser = new Map<string, { startDay: string; shifted: boolean; g: number | null; map: keyof ShiftSummary['map'] }>();
  for (const [user, states] of statesOf) {
    const start = states[0];
    const after = (finishesOf.get(user) ?? []).filter((f) => f.at > start.at && f.level != null);
    const above = after.filter((f) => f.level! > start.hi).length;
    const post = after.length >= 2 ? median(after.map((f) => f.level!)) : null;
    const g = post != null && start.center < LEVEL_MAX ? Math.max(-1, Math.min(1, (post - start.center) / (LEVEL_MAX - start.center))) : null;
    const last = states[states.length - 1];
    const moved = last.center - start.center;
    const narrowed = (start.hi - start.lo) - (last.hi - last.lo);
    const map: keyof ShiftSummary['map'] = states.length < 2 ? 'noUpdate'
      : moved >= 0.5 ? 'movedUp' : moved <= -0.5 ? 'movedDown' : narrowed >= 0.5 ? 'refined' : 'same';
    perUser.set(user, { startDay: mskDay(start.at), shifted: above >= 2, g, map });
  }
  const summarize = (users: string[]): ShiftSummary => {
    const xs = users.map((u) => perUser.get(u)!);
    const gs = xs.map((x) => x.g).filter((g): g is number => g != null);
    const map = { movedUp: 0, movedDown: 0, refined: 0, same: 0, noUpdate: 0 };
    for (const x of xs) map[x.map] += 1;
    const shifted = xs.filter((x) => x.shifted).length;
    return {
      users: xs.length, shifted, share: round(ratio(shifted, xs.length)),
      g: { n: gs.length, median: round(median(gs)), low: gs.filter((g) => g < 0.3).length, mid: gs.filter((g) => g >= 0.3 && g < 0.7).length, high: gs.filter((g) => g >= 0.7).length },
      map,
    };
  };
  const cohortFrom = addDays(today, -56), cohortTo = addDays(today, -28);
  const cohortUsers = [...perUser].filter(([, x]) => x.startDay >= cohortFrom && x.startDay <= cohortTo).map(([u]) => u);
  const active28 = new Set(rows.visits.filter((v) => v.day >= since28).map((v) => v.user_id));
  const noStart = [...active28].filter((u) => !statesOf.has(u)).length;

  // ── МА-2 за 28 дней
  const ratingOf = new Map(rows.ratings.map((r) => [`${r.user_id}|${r.work_id}`, r]));
  const recent = [...finishes.values()].filter((f) => mskDay(f.at) >= since28);
  // proxy reward
  let proxyBase = 0, proxyN = 0;
  for (const f of recent) {
    const s = stateBefore(f.user, f.at);
    if (f.level == null || s?.median == null) continue;
    proxyBase += 1;
    const r = ratingOf.get(`${f.user}|${f.work}`);
    if (r && r.rating >= 4 && Date.parse(r.at) - Date.parse(f.at) >= 3 * DAY && f.level > s.median) proxyN += 1;
  }
  // valued: «стоило ли» из чек-ина, без него — оценка при досмотре (в пределах суток)
  let answered = 0, valuedN = 0;
  for (const f of recent) {
    const r = ratingOf.get(`${f.user}|${f.work}`);
    const atFinish = r && Math.abs(Date.parse(r.at) - Date.parse(f.at)) <= DAY ? r.rating : null;
    const answer = f.worth ?? atFinish;
    if (answer == null) continue;
    answered += 1;
    if (answer >= 4) valuedN += 1;
  }
  // take-rate
  const recentShown = rows.impressions.filter((i) => mskDay(i.at) >= since28);
  const shownRecs = new Map<string, { user: string; work: string; at: string }>();
  for (const i of recentShown) {
    const key = `${i.user_id}|${i.rec_id}`;
    if (!shownRecs.has(key)) shownRecs.set(key, { user: i.user_id, work: i.work_id, at: i.at });
  }
  const accepts = rows.feedback.filter((f) => (f.action === 'save' || f.action === 'start') && f.rec_id && shownRecs.has(`${f.user_id}|${f.rec_id}`));
  const acceptedRecs = new Set(accepts.map((f) => `${f.user_id}|${f.rec_id}`));
  const lastWatch = new Map<string, string>(); // user|work → последнее «Смотреть»
  for (const e of rows.events) {
    if (e.kind !== 'watch' || !e.work_id) continue;
    const key = `${e.user_id}|${e.work_id}`;
    if (!lastWatch.has(key) || e.at > lastWatch.get(key)!) lastWatch.set(key, e.at);
  }
  const watchAfter = (user: string, work: string, at: string) => (lastWatch.get(`${user}|${work}`) ?? '') >= at;
  const finishedAfter = (user: string, work: string, at: string) => { const f = finishes.get(`${user}|${work}`); return Boolean(f && f.at >= at); };
  let qualityN = 0;
  for (const [key, s] of shownRecs) {
    const accepted = acceptedRecs.has(key);
    const prompted = finishes.get(`${s.user}|${s.work}`)?.via === 'seen' && finishedAfter(s.user, s.work, s.at);
    if ((accepted && (watchAfter(s.user, s.work, s.at) || finishedAfter(s.user, s.work, s.at))) || prompted) qualityN += 1;
  }
  // принятия — «в планы» / «смотрю» на показанном и досмотр по подсказке
  const takes: Take[] = [
    ...accepts.map((f) => ({ user: f.user_id, work: f.work_id ?? shownRecs.get(`${f.user_id}|${f.rec_id}`)!.work, level: lv(f.level), traits: parseTraits(f.traits), at: f.at, via: 'accept' as const })),
    ...seenPrompted.filter((f) => mskDay(f.at) >= since28).map((f) => ({ user: f.user_id, work: f.work_id!, level: lv(f.level), traits: parseTraits(f.traits), at: f.at, via: 'seen' as const })),
  ].map((t) => ({ ...t, level: t.level ?? shownLevel.get(`${t.user}|${t.work}`) ?? null, traits: t.traits ?? shownTraits.get(`${t.user}|${t.work}`) ?? null }));
  const takenWorks = new Set(takes.map((t) => t.work));
  const shownWorks = new Set(recentShown.map((i) => i.work_id));

  // GS: неделя 1 после активации против недель 4–8 — по всем принятиям человека, не только за 28 дней
  const activation = new Map<string, string>();
  for (const i of rows.impressions) if (!activation.has(i.user_id) || i.at < activation.get(i.user_id)!) activation.set(i.user_id, i.at);
  const allTakes: Take[] = [
    ...rows.feedback.filter((f) => (f.action === 'save' || f.action === 'start') && f.work_id)
      .map((f) => ({ user: f.user_id, work: f.work_id!, level: lv(f.level), traits: parseTraits(f.traits), at: f.at, via: 'accept' as const })),
    ...seenPrompted.map((f) => ({ user: f.user_id, work: f.work_id!, level: lv(f.level), traits: parseTraits(f.traits), at: f.at, via: 'seen' as const })),
  ].map((t) => ({ ...t, level: t.level ?? shownLevel.get(`${t.user}|${t.work}`) ?? null, traits: t.traits ?? shownTraits.get(`${t.user}|${t.work}`) ?? null }));
  const takesOf = new Map<string, Take[]>();
  for (const t of allTakes) (takesOf.get(t.user) ?? takesOf.set(t.user, []).get(t.user)!).push(t);
  const gsWeek1: number[] = [], gsLater: number[] = [];
  let diversified = 0, gsUsers = 0, spreadUsers = 0, spreadHeld = 0;
  for (const [user, list] of takesOf) {
    const act = activation.get(user);
    if (!act) continue;
    const dayOf = (t: Take) => (Date.parse(t.at) - Date.parse(act)) / DAY;
    const w1 = list.filter((t) => dayOf(t) >= 0 && dayOf(t) < 7);
    const late = list.filter((t) => dayOf(t) >= 21 && dayOf(t) < 56);
    if (!w1.length || !late.length) continue;
    const vecs = list.map((t) => vectorOf(t.traits)).filter((v): v is Map<string, number> => v != null);
    if (vecs.length) {
      const center = new Map<string, number>();
      for (const v of vecs) for (const [k, x] of v) center.set(k, (center.get(k) ?? 0) + x / vecs.length);
      const gs = (ts: Take[]) => { const cs = ts.map((t) => vectorOf(t.traits)).filter((v): v is Map<string, number> => v != null).map((v) => cosine(v, center)); return cs.length ? cs.reduce((a, x) => a + x, 0) / cs.length : null; };
      const a = gs(w1), b = gs(late);
      if (a != null && b != null) { gsUsers += 1; gsWeek1.push(a); gsLater.push(b); if (b < a) diversified += 1; }
    }
    const s1 = std(w1.map((t) => t.level).filter((l): l is number => l != null));
    const s2 = std(late.map((t) => t.level).filter((l): l is number => l != null));
    if (s1 != null && s2 != null) { spreadUsers += 1; if (s2 >= s1 - 1e-9) spreadHeld += 1; }
  }

  // ревизит: карточка того, что уже оценено или досмотрено
  const recentCards = rows.events.filter((e) => e.kind === 'card' && e.work_id && mskDay(e.at) >= since28);
  let revisits = 0;
  const cardUsers = new Set<string>(), revisitUsers = new Set<string>();
  for (const e of recentCards) {
    cardUsers.add(e.user_id);
    const r = ratingOf.get(`${e.user_id}|${e.work_id}`);
    const f = finishes.get(`${e.user_id}|${e.work_id}`);
    if ((r && r.at < e.at) || (f && f.at < e.at)) { revisits += 1; revisitUsers.add(e.user_id); }
  }

  // ── удержание от активации и WAU
  const visitsOf = new Map<string, Set<string>>();
  for (const v of rows.visits) (visitsOf.get(v.user_id) ?? visitsOf.set(v.user_id, new Set()).get(v.user_id)!).add(v.day);
  const actDays = [...activation].map(([u, at]) => ({ u, d: mskDay(at) })).filter((x) => x.d >= addDays(today, -60));
  const retention = ([1, 7, 30] as const).map((k) => {
    const done = actDays.filter((x) => addDays(x.d, k) <= yesterday);
    const days = (x: { u: string }) => [...(visitsOf.get(x.u) ?? [])];
    const exact = done.filter((x) => days(x).includes(addDays(x.d, k))).length;
    const later = done.filter((x) => days(x).some((d) => d >= addDays(x.d, k))).length;
    return { k, cohorts: new Set(done.map((x) => x.d)).size, users: done.length, exact, later,
      exactShare: round(ratio(exact, done.length)), laterShare: round(ratio(later, done.length)) };
  });
  const wau = Array.from({ length: 8 }, (_, i) => {
    const to = addDays(yesterday, -7 * (7 - i));
    const from = addDays(to, -6);
    return { to, users: new Set(rows.visits.filter((v) => v.day >= from && v.day <= to).map((v) => v.user_id)).size };
  });

  return {
    asOf: new Date(now).toISOString(),
    bounds: METRIC_BOUNDS,
    shift: { cohort: { from: cohortFrom, to: cohortTo, ...summarize(cohortUsers) }, all: summarize([...perUser.keys()]), noStart },
    quality: {
      since: since28,
      proxyReward: { share: round(ratio(proxyN, proxyBase)), n: proxyN, base: proxyBase, finishes: recent.length },
      valued: { share: round(ratio(valuedN, answered)), n: valuedN, answered, finishes: recent.length, answerRate: round(ratio(answered, recent.length)) },
      take: { shown: shownRecs.size, accepted: acceptedRecs.size, quality: qualityN, takeRate: round(ratio(acceptedRecs.size, shownRecs.size)), qualityTake: round(ratio(qualityN, shownRecs.size)) },
      ecs: { takes: takes.length, unique: takenWorks.size, ecs: round(ratio(takenWorks.size, takes.length)), shownWorks: shownWorks.size, coverage: round(ratio([...takenWorks].filter((w) => shownWorks.has(w)).length, shownWorks.size)) },
      gs: { users: gsUsers, week1: round(median(gsWeek1)), later: round(median(gsLater)), diversified: round(ratio(diversified, gsUsers)), spreadHeld: round(ratio(spreadHeld, spreadUsers)), spreadUsers },
      revisit: { cards: recentCards.length, revisits, share: round(ratio(revisits, recentCards.length)), users: cardUsers.size, usersWithRevisit: revisitUsers.size, userShare: round(ratio(revisitUsers.size, cardUsers.size)) },
    },
    retention,
    wau,
  };
}
