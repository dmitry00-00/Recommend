// Рост и продвижение (16.10): сводка для вкладки «Рост» пульта (tools/growth-desk.html) — по источникам прихода,
// по неделям, первый вход свайпом против колоды, вирусность. Считается здесь из строк базы, которые собирает
// worker/growthRoute.ts; чистая функция — проверяется синтетикой (tools/growth-test.mts) без сервера.
//
// Отличия от воронки (worker/funnel.ts):
//   · внутренних — владельца и тестеров — нет в основании по умолчанию (МА-4): их поведение — не поведение участника;
//   · у каждой доли — доверительный интервал Уилсона (95 %): на десятках людей доля шумит на ±15 п.п., и без интервала
//     сравнение источников обманывает;
//   · к источнику пришит посев (таблица `seeding`, ПР-2): цена → ₽ за пришедшего, за активированного, за удержанного D7.
// Активация — как в воронке: первая лента в первые сутки. Удержание — «вернулся в k-й день или позже» по когортам,
// у которых k-й день уже прошёл.

export interface SeedingRow {
  id: string;
  /** метка `--s<label>` в ссылке посева — по ней находят пришедших */
  label: string;
  channel: string | null;
  posted_at: string | null;
  price: number | null;
  currency: string | null;
  note: string | null;
}

export interface GrowthRows {
  /** день по Москве, «сегодня» */
  today: string;
  /** участники (уже без внутренних, если так просили): все, не только новые — приглашающий может быть старым */
  users: { id: string; created_at: string; source: string | null; invited_by: string | null }[];
  /** заходы по дням за период */
  visits: { user_id: string; day: string }[];
  /** первая лента каждого — по ней активация */
  firstFeed: { user_id: string; at: string }[];
  /** оценок в первые сутки — сравнение первого входа свайпом с колодой */
  ratingsDay1: { user_id: string; n: number }[];
  /** шаги первого входа свайпом (событие `onboard`, ДФ-2): place — шаг, detail — счёт «seen:4,want:2,no:3,rated:3[,favorites:2]» */
  onboard: { user_id: string; place: string | null; detail: string | null; at: string }[];
  /** «поделился» за 30 дней */
  shares: { user_id: string; at: string }[];
  /** выбор компанией за 30 дней: комнат, проголосовавших людей (без хозяина комнаты) */
  together: { sessions: number; participants: number };
  /** голосования в чатах за 30 дней: подборок, голосовавших (по tg_id), из них не участников приложения */
  inline: { polls: number; voters: number; outsiders: number };
  seeding: SeedingRow[];
  /** сколько внутренних исключено (0 — считали со всеми) */
  internal: { owner: number; testers: number };
}

const MSK_MS = 3 * 3600e3;
const dayOf = (iso: string): string => new Date(Date.parse(iso) + MSK_MS).toISOString().slice(0, 10);
const addDays = (day: string, n: number): string => new Date(Date.parse(`${day}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const DAY_MS = 864e5;

export interface Share { n: number; of: number; share: number | null; lo: number | null; hi: number | null }
/** Доля с интервалом Уилсона (95 %): при малом основании честнее точки. Нет основания — все null. */
export function wilson(n: number, of: number, z = 1.96): Share {
  if (!of) return { n, of, share: null, lo: null, hi: null };
  const p = n / of, z2 = z * z;
  const centre = (p + z2 / (2 * of)) / (1 + z2 / of);
  const half = (z * Math.sqrt((p * (1 - p)) / of + z2 / (4 * of * of))) / (1 + z2 / of);
  return { n, of, share: p, lo: Math.max(0, centre - half), hi: Math.min(1, centre + half) };
}

const median = (xs: number[]): number | null => {
  if (!xs.length) return null;
  const a = [...xs].sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
};

/** Источник прихода: метка посева; без метки — «позвал друг» или «сами» */
export const ORGANIC = 'organic';
export const INVITED = 'invited';
const sourceOf = (u: { source: string | null; invited_by: string | null }): string => u.source ?? (u.invited_by ? INVITED : ORGANIC);

export function computeGrowth(r: GrowthRows) {
  const today = r.today;
  const yesterday = addDays(today, -1);
  const from90 = addDays(today, -90);
  const from30 = addDays(today, -30);
  const visitsBy = new Map<string, string[]>();
  for (const v of r.visits) visitsBy.set(v.user_id, [...(visitsBy.get(v.user_id) ?? []), v.day]);
  const feedAt = new Map(r.firstFeed.map((f) => [f.user_id, Date.parse(f.at)]));
  const users = r.users.map((u) => {
    const created = Date.parse(u.created_at);
    const day = dayOf(u.created_at);
    const feed = feedAt.get(u.id);
    const days = visitsBy.get(u.id) ?? [];
    return {
      ...u, day, created,
      activated: feed != null && feed <= created + DAY_MS,
      /** вернулся в k-й день или позже */
      back: (k: number) => days.some((d) => d >= addDays(day, k)),
      /** k-й день уже прошёл — когорта годится в основание */
      due: (k: number) => addDays(day, k) <= yesterday,
    };
  });
  type U = (typeof users)[number];
  const byId = new Map(users.map((u) => [u.id, u]));

  // ── группа людей → доли с интервалами
  const retention = (xs: U[], k: number) => { const due = xs.filter((u) => u.due(k)); return wilson(due.filter((u) => u.back(k)).length, due.length); };
  const group = (xs: U[]) => ({
    joined: xs.length,
    activation: wilson(xs.filter((u) => u.activated).length, xs.length),
    d1: retention(xs, 1), d7: retention(xs, 7), d30: retention(xs, 30),
  });

  // ── источники за 90 дней: метки посевов, «позвал друг», «сами»; к метке — посевы и их цена
  const fresh90 = users.filter((u) => u.day >= from90);
  const bySource = new Map<string, U[]>();
  for (const u of fresh90) { const k = sourceOf(u); bySource.set(k, [...(bySource.get(k) ?? []), u]); }
  for (const s of r.seeding) if (!bySource.has(s.label)) bySource.set(s.label, []);
  const costOf = (label: string) => {
    const rows = r.seeding.filter((s) => s.label === label && s.price != null);
    return rows.length ? rows.reduce((a, s) => a + (s.price ?? 0), 0) : null;
  };
  const per = (cost: number | null, n: number) => (cost != null && n ? cost / n : null);
  const sources = [...bySource].map(([source, xs]) => {
    const g = group(xs);
    const cost = costOf(source);
    const posts = r.seeding.filter((s) => s.label === source);
    return {
      source, ...g, cost, posts: posts.length,
      lastPost: posts.map((s) => s.posted_at ?? '').filter(Boolean).sort().at(-1) ?? null,
      channels: [...new Set(posts.map((s) => s.channel).filter((c): c is string => Boolean(c)))],
      perJoined: per(cost, g.joined), perActivated: per(cost, g.activation.n), perD7: per(cost, g.d7.n),
    };
  }).sort((a, b) => b.joined - a.joined || a.source.localeCompare(b.source));

  // ── по неделям, 12 недель до сегодня: новые, активированные, активные (WAU), из них вернувшиеся (вошли раньше недели),
  //    «поделился», пришли по приглашению
  const weeks = Array.from({ length: 12 }, (_, i) => {
    const to = addDays(today, -7 * i), from = addDays(to, -6);
    const joined = users.filter((u) => u.day >= from && u.day <= to);
    const active = new Set(r.visits.filter((v) => v.day >= from && v.day <= to).map((v) => v.user_id));
    const returning = [...active].filter((id) => { const u = byId.get(id); return u && u.day < from; }).length;
    return {
      from, to, joined: joined.length, activated: joined.filter((u) => u.activated).length,
      invited: joined.filter((u) => u.invited_by).length, seeded: joined.filter((u) => u.source).length,
      active: active.size, returning,
      shares: r.shares.filter((s) => { const d = dayOf(s.at); return d >= from && d <= to; }).length,
    };
  }).reverse();

  // ── первый вход (ДФ-2): новые за 30 дней — прошёл свайп (есть событие onboard) или колода /rate
  const fresh30 = users.filter((u) => u.day >= from30);
  const onboarded = new Set(r.onboard.map((e) => e.user_id));
  const ratings1 = new Map(r.ratingsDay1.map((x) => [x.user_id, x.n]));
  const arm = (xs: U[]) => ({ ...group(xs), ratingsDay1: median(xs.map((u) => ratings1.get(u.id) ?? 0)),
    ratedDay1: wilson(xs.filter((u) => (ratings1.get(u.id) ?? 0) >= 5).length, xs.length) });
  const stepCount = (place: string) => new Set(r.onboard.filter((e) => e.place === place).map((e) => e.user_id)).size;
  const parse = (detail: string | null) => Object.fromEntries((detail ?? '').split(',').map((kv) => kv.split(':')).filter(([k, v]) => k && v).map(([k, v]) => [k, Number(v)]));
  const finals = r.onboard.filter((e) => e.place === 'swipe_done' || e.place === 'swipe_skip').map((e) => parse(e.detail));
  const favs = r.onboard.filter((e) => e.place === 'favorites_done').map((e) => parse(e.detail).favorites ?? 0);
  const avg = (k: string) => (finals.length ? finals.reduce((a, d) => a + (d[k] ?? 0), 0) / finals.length : null);
  const onboarding = {
    swipe: arm(fresh30.filter((u) => onboarded.has(u.id))), deck: arm(fresh30.filter((u) => !onboarded.has(u.id))),
    steps: { swipeDone: stepCount('swipe_done'), swipeSkip: stepCount('swipe_skip'), favoritesDone: stepCount('favorites_done'), favoritesSkip: stepCount('favorites_skip') },
    perPerson: { seen: avg('seen'), want: avg('want'), no: avg('no'), rated: avg('rated'), favorites: favs.length ? favs.reduce((a, b) => a + b, 0) / favs.length : null },
  };

  // ── вирусность за 30 дней: кто делился, сколько пришло по приглашениям, k = приглашённых на активного
  const active30 = new Set(r.visits.filter((v) => v.day >= from30).map((v) => v.user_id));
  const sharers = new Set(r.shares.map((s) => s.user_id));
  const invited30 = fresh30.filter((u) => u.invited_by);
  const inviters = new Set(invited30.map((u) => u.invited_by!));
  const virality = {
    shares: r.shares.length, sharers: sharers.size,
    sharerShare: wilson(sharers.size, active30.size),
    invitedJoined: invited30.length, inviters: inviters.size,
    invited: group(invited30),
    /** приглашённых на одного активного: выше 1 — рост сам по себе, в бете ждём 0,1–0,3 */
    k: active30.size ? invited30.length / active30.size : null,
    invitedPerSharer: sharers.size ? invited30.length / sharers.size : null,
    together: r.together, inline: r.inline,
  };

  const all30 = group(fresh30);
  return {
    period: { from90, from30, today },
    internal: r.internal,
    summary: { joined30: all30.joined, activation30: all30.activation, d7: all30.d7, d30: all30.d30,
      wau: weeks.at(-1)?.active ?? 0, active30: active30.size,
      spend90: r.seeding.filter((s) => s.price != null && (s.posted_at ?? today) >= from90).reduce((a, s) => a + (s.price ?? 0), 0) },
    sources, weeks, onboarding, virality,
    /** входы по меткам за 90 дней (23.10, рекламная кампания: посты, приход по часам за 48 ч, «≥ 10 оценок и лента» —
     *  считает пульт, tools/growth-desk.mts): без id; d1/d7 — null, пока день не прошёл; rated — оценок в первые сутки */
    arrivals: fresh90.filter((u) => u.source).map((u) => ({ source: u.source!, at: u.created_at, activated: u.activated,
      rated: ratings1.get(u.id) ?? 0, d1: u.due(1) ? u.back(1) : null, d7: u.due(7) ? u.back(7) : null })),
  };
}
export type Growth = ReturnType<typeof computeGrowth>;
