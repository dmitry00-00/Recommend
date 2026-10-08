// Воронка и удержание (ЗП-3, 07.10): по ним решаем, идёт ли бета дальше (пороги — ROADMAP §9).
//
// Пишем то, чего раньше не было:
//   · `visit` — участник был в приложении в этот день (по Москве). Сессия живёт 90 дней в браузере,
//     поэтому по таблице сессий заходы не посчитать — отмечаем первый запрос дня с токеном;
//   · `event` — открыта карточка произведения (`card`) и нажато «Смотреть» (`watch`, платформа в `detail`).
// Остальное уже было: оценки, показы ленты, отклики, дневник, чек-ины, открытия разборов (`material_open`).
//
// GET /api/admin/funnel (по ADMIN_TOKEN; `owner=0` — без владельца, `tg=1` — только вошедшие через Telegram):
//   · day — вчера и 7 полных дней: показатели против порогов беты;
//   · funnel — новые за 30 дней: вошёл → 10 оценок (или импорт) в первые сутки → принял фильм из ленты →
//     посмотрел (чек-ин или «посмотрел») → вернулся в другой день. Ступени считаются каждая сама по себе;
//   · retention — когорты по дню входа: D1/D7/D30 «в этот день» и «в этот день или позже»;
//   · daily — по дням за 14 дней: кто был, новые, карточки, «Смотреть», разборы, ленты.
import type { D1Database, Env } from './env';

const json = (body: unknown, status = 200) => Response.json(body, { status });
const MSK_MS = 3 * 3600e3;
/** День по Москве — так же считает сводка подписок; аудитория беты — от Калининграда до Алматы. */
export const mskDay = (t = Date.now()): string => new Date(t + MSK_MS).toISOString().slice(0, 10);
const addDays = (day: string, n: number): string => new Date(Date.parse(`${day}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
/** То же в SQL: ISO-время UTC → день по Москве. */
const SQL_DAY = (col: string) => `date(${col}, '+3 hours')`;

// ─── заходы ─────────────────────────────────────────────────────────────────

const noted = new Set<string>();
let notedDay = '';
/** Первый запрос дня с токеном. Повторы в том же процессе в базу не ходят. */
export async function noteVisit(db: D1Database, userId: string): Promise<void> {
  const day = mskDay();
  if (day !== notedDay) { noted.clear(); notedDay = day; }
  if (noted.has(userId)) return;
  noted.add(userId);
  await db.prepare('INSERT OR IGNORE INTO visit (user_id, day) VALUES (?, ?)').bind(userId, day).run();
}

// ─── события ────────────────────────────────────────────────────────────────

const KINDS = new Set(['card', 'watch']);
let eventSeq = 0;

export async function postEvent(req: Request, userId: string, db: D1Database): Promise<Response> {
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const str = (v: unknown, n = 64) => (typeof v === 'string' && v ? v.slice(0, n) : null);
  const kind = str(b.kind);
  if (!kind || !KINDS.has(kind)) return json({ error: 'bad_kind' }, 400);
  const id = `e-${Date.now().toString(36)}-${(eventSeq++ % 1e6).toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  await db.prepare('INSERT INTO event (id, user_id, kind, work_id, place, detail, at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(id, userId, kind, str(b.workId, 120), str(b.place), str(b.detail, 120), new Date().toISOString()).run();
  return json({ ok: true });
}

// ─── сводка ─────────────────────────────────────────────────────────────────

/** Пороги «идём дальше» для закрытых бет (ROADMAP §9; через две недели беты — откалибровать). */
export const THRESHOLDS = {
  activation: 0.6, d7: 0.25, d30: 0.12, acceptedFeeds: 0.3, checkins: 0.2, watchClicks: 0.08, analysisOpens: 0.15,
} as const;

const ACCEPT = "('save', 'start')";
const ratio = (a: number, b: number): number | null => (b > 0 ? a / b : null);

export async function getFunnel(req: Request, env: Env, admin: boolean): Promise<Response> {
  if (!admin) return json({ error: 'unauthorized' }, 401);
  const url = new URL(req.url);
  const db = env.DB;

  // кого считаем: без владельца — по просьбе (его история — не поведение участника), только Telegram — по просьбе
  const owner = env.OWNER_USERNAME?.replace(/^@/, '').toLowerCase();
  const conds: string[] = [];
  const binds: unknown[] = [];
  if (owner && url.searchParams.get('owner') === '0') { conds.push('lower(coalesce(username, \'\')) <> ?'); binds.push(owner); }
  if (url.searchParams.get('tg') === '1') conds.push('tg_id IS NOT NULL');
  // один источник (посев `--s<метка>`, 07.10): `?source=kinoman`; `?source=-` — пришедшие без метки
  const source = url.searchParams.get('source');
  if (source === '-') conds.push('source IS NULL');
  else if (source) { conds.push('source = ?'); binds.push(source); }
  const userWhere = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  // подзапрос «наши участники» для таблиц с user_id
  const inUsers = `user_id IN (SELECT id FROM user ${userWhere})`;
  const q = async <T,>(sql: string, ...bind: unknown[]): Promise<T[]> =>
    ((await db.prepare(sql).bind(...bind).all<T>()).results ?? []);

  const today = mskDay();
  const yesterday = addDays(today, -1);
  const from14 = addDays(today, -14);
  const from30 = addDays(today, -30);
  const from60 = addDays(today, -60);

  // ── по дням: кто был, новые, карточки, «Смотреть», разборы, оценки, ленты, принятые ленты, чек-ины
  type DayN = { day: string; n: number; users?: number };
  const byDay = (sql: string, ...bind: unknown[]) => q<DayN>(sql, ...binds, ...bind);
  const [visits, joined, cards, watches, opens, ratings, feeds, accepted, checkins] = await Promise.all([
    byDay(`SELECT day, COUNT(*) AS n FROM visit WHERE ${inUsers} AND day >= ? GROUP BY day`, from14),
    q<DayN>(`SELECT ${SQL_DAY('created_at')} AS day, COUNT(*) AS n FROM user ${userWhere ? `${userWhere} AND` : 'WHERE'} ${SQL_DAY('created_at')} >= ? GROUP BY day`, ...binds, from14),
    byDay(`SELECT ${SQL_DAY('at')} AS day, COUNT(DISTINCT user_id || '|' || coalesce(work_id, '')) AS n, COUNT(DISTINCT user_id) AS users FROM event WHERE kind = 'card' AND ${inUsers} AND ${SQL_DAY('at')} >= ? GROUP BY day`, from14),
    byDay(`SELECT ${SQL_DAY('at')} AS day, COUNT(DISTINCT user_id || '|' || coalesce(work_id, '')) AS n, COUNT(DISTINCT user_id) AS users FROM event WHERE kind = 'watch' AND ${inUsers} AND ${SQL_DAY('at')} >= ? GROUP BY day`, from14),
    byDay(`SELECT ${SQL_DAY('at')} AS day, COUNT(DISTINCT user_id || '|' || coalesce(work_id, '')) AS n, COUNT(DISTINCT user_id) AS users FROM material_open WHERE ${inUsers} AND ${SQL_DAY('at')} >= ? GROUP BY day`, from14),
    byDay(`SELECT ${SQL_DAY('at')} AS day, COUNT(*) AS n, COUNT(DISTINCT user_id) AS users FROM rating WHERE ${inUsers} AND ${SQL_DAY('at')} >= ? GROUP BY day`, from14),
    byDay(`SELECT ${SQL_DAY('at')} AS day, COUNT(DISTINCT slate_id) AS n, COUNT(DISTINCT user_id) AS users FROM impression WHERE ${inUsers} AND ${SQL_DAY('at')} >= ? GROUP BY day`, from14),
    // лента принята, если хоть один её фильм отложен или начат
    byDay(`SELECT ${SQL_DAY('i.at')} AS day, COUNT(DISTINCT i.slate_id) AS n, COUNT(DISTINCT i.user_id) AS users FROM impression i
             WHERE i.${inUsers} AND ${SQL_DAY('i.at')} >= ?
               AND EXISTS (SELECT 1 FROM feedback f WHERE f.user_id = i.user_id AND f.rec_id = i.rec_id AND f.action IN ${ACCEPT})
             GROUP BY day`, from14),
    byDay(`SELECT ${SQL_DAY('at')} AS day, COUNT(*) AS n, COUNT(DISTINCT user_id) AS users FROM checkin WHERE ${inUsers} AND ${SQL_DAY('at')} >= ? GROUP BY day`, from14),
  ]);
  const accepts = await byDay(`SELECT ${SQL_DAY('at')} AS day, COUNT(*) AS n, COUNT(DISTINCT user_id) AS users FROM feedback WHERE action IN ${ACCEPT} AND ${inUsers} AND ${SQL_DAY('at')} >= ? GROUP BY day`, from14);
  // карточки, из которых открыли разбор или нажали «Смотреть»: пара «человек — фильм — день»
  const pairsWith = (table: string, extra = '') => byDay(
    `SELECT ${SQL_DAY('c.at')} AS day, COUNT(DISTINCT c.user_id || '|' || c.work_id) AS n FROM event c
       WHERE c.kind = 'card' AND c.work_id IS NOT NULL AND c.${inUsers} AND ${SQL_DAY('c.at')} >= ?
         AND EXISTS (SELECT 1 FROM ${table} x WHERE x.user_id = c.user_id AND x.work_id = c.work_id ${extra} AND ${SQL_DAY('x.at')} = ${SQL_DAY('c.at')})
       GROUP BY day`, from14);
  const [cardsWithOpen, cardsWithWatch] = await Promise.all([pairsWith('material_open'), pairsWith('event', "AND x.kind = 'watch'")]);

  const days: string[] = [];
  for (let d = from14; d <= today; d = addDays(d, 1)) days.push(d);
  const pick = (rows: DayN[], day: string) => rows.find((r) => r.day === day);
  const daily = days.map((day) => ({
    day,
    visitors: pick(visits, day)?.n ?? 0,
    joined: pick(joined, day)?.n ?? 0,
    cards: pick(cards, day)?.n ?? 0,
    watch: pick(watches, day)?.n ?? 0,
    opens: pick(opens, day)?.n ?? 0,
    ratings: pick(ratings, day)?.n ?? 0,
    feeds: pick(feeds, day)?.n ?? 0,
    acceptedFeeds: pick(accepted, day)?.n ?? 0,
    accepts: pick(accepts, day)?.n ?? 0,
    checkins: pick(checkins, day)?.n ?? 0,
    cardsWithOpen: pick(cardsWithOpen, day)?.n ?? 0,
    cardsWithWatch: pick(cardsWithWatch, day)?.n ?? 0,
  }));

  // ── воронка: новые за 30 дней
  const [funnelRow] = await q<{ joined: number; activated: number; accepted: number; watched: number; returned: number }>(
    `WITH u AS (SELECT id, created_at, ${SQL_DAY('created_at')} AS d FROM user ${userWhere ? `${userWhere} AND` : 'WHERE'} ${SQL_DAY('created_at')} >= ?)
     SELECT COUNT(*) AS joined,
       SUM(CASE WHEN (SELECT COUNT(*) FROM rating r WHERE r.user_id = u.id AND r.at <= strftime('%Y-%m-%dT%H:%M:%fZ', u.created_at, '+1 day'))
                   + (SELECT COUNT(*) FROM watched w WHERE w.user_id = u.id AND w.state = 'watched' AND w.at <= strftime('%Y-%m-%dT%H:%M:%fZ', u.created_at, '+1 day')) >= 10
                THEN 1 ELSE 0 END) AS activated,
       SUM(CASE WHEN EXISTS (SELECT 1 FROM feedback f WHERE f.user_id = u.id AND f.action IN ${ACCEPT})
                  OR EXISTS (SELECT 1 FROM journal j WHERE j.user_id = u.id) THEN 1 ELSE 0 END) AS accepted,
       SUM(CASE WHEN EXISTS (SELECT 1 FROM journal j WHERE j.user_id = u.id AND j.status = 'finished')
                  OR EXISTS (SELECT 1 FROM checkin c WHERE c.user_id = u.id AND c.status = 'finished') THEN 1 ELSE 0 END) AS watched,
       SUM(CASE WHEN EXISTS (SELECT 1 FROM visit v WHERE v.user_id = u.id AND v.day > u.d) THEN 1 ELSE 0 END) AS returned
     FROM u`, ...binds, from30);
  const funnel = {
    since: from30,
    joined: funnelRow?.joined ?? 0, activated: funnelRow?.activated ?? 0, accepted: funnelRow?.accepted ?? 0,
    watched: funnelRow?.watched ?? 0, returned: funnelRow?.returned ?? 0,
  };

  // ── удержание: когорты по дню входа за 60 дней; учитываем только когорты, у которых нужный день уже прошёл
  const cohortRows = await q<{ d: string; joined: number; d1: number; d7: number; d30: number; d1p: number; d7p: number; d30p: number }>(
    `WITH u AS (SELECT id, ${SQL_DAY('created_at')} AS d FROM user ${userWhere ? `${userWhere} AND` : 'WHERE'} ${SQL_DAY('created_at')} >= ?)
     SELECT d, COUNT(*) AS joined,
       SUM(EXISTS (SELECT 1 FROM visit v WHERE v.user_id = u.id AND v.day = date(u.d, '+1 day'))) AS d1,
       SUM(EXISTS (SELECT 1 FROM visit v WHERE v.user_id = u.id AND v.day = date(u.d, '+7 day'))) AS d7,
       SUM(EXISTS (SELECT 1 FROM visit v WHERE v.user_id = u.id AND v.day = date(u.d, '+30 day'))) AS d30,
       SUM(EXISTS (SELECT 1 FROM visit v WHERE v.user_id = u.id AND v.day >= date(u.d, '+1 day'))) AS d1p,
       SUM(EXISTS (SELECT 1 FROM visit v WHERE v.user_id = u.id AND v.day >= date(u.d, '+7 day'))) AS d7p,
       SUM(EXISTS (SELECT 1 FROM visit v WHERE v.user_id = u.id AND v.day >= date(u.d, '+30 day'))) AS d30p
     FROM u GROUP BY d ORDER BY d`, ...binds, from60);
  const retention = ([1, 7, 30] as const).map((k) => {
    const done = cohortRows.filter((c) => addDays(c.d, k) <= yesterday);
    const base = done.reduce((a, c) => a + c.joined, 0);
    const exact = done.reduce((a, c) => a + Number(c[`d${k}`]), 0);
    const later = done.reduce((a, c) => a + Number(c[`d${k}p`]), 0);
    return { k, cohorts: done.length, users: base, exact, later, exactShare: ratio(exact, base), laterShare: ratio(later, base) };
  });

  // ── показатели против порогов: вчера и 7 полных дней
  const sum = (from: string, to: string) => {
    const rows = daily.filter((d) => d.day >= from && d.day <= to);
    const s = (k: keyof (typeof daily)[number]) => rows.reduce((a, r) => a + Number(r[k]), 0);
    return {
      from, to,
      visitors: s('visitors'), joined: s('joined'), cards: s('cards'), feeds: s('feeds'), accepts: s('accepts'),
      acceptedFeeds: ratio(s('acceptedFeeds'), s('feeds')),
      checkins: ratio(s('checkins'), s('accepts')),
      watchClicks: ratio(s('cardsWithWatch'), s('cards')),
      analysisOpens: ratio(s('cardsWithOpen'), s('cards')),
    };
  };
  const activationIn = async (from: string, to: string) => {
    const [r] = await q<{ joined: number; activated: number }>(
      `WITH u AS (SELECT id, created_at FROM user ${userWhere ? `${userWhere} AND` : 'WHERE'} ${SQL_DAY('created_at')} BETWEEN ? AND ?)
       SELECT COUNT(*) AS joined, SUM(CASE WHEN
         (SELECT COUNT(*) FROM rating r WHERE r.user_id = u.id AND r.at <= strftime('%Y-%m-%dT%H:%M:%fZ', u.created_at, '+1 day'))
         + (SELECT COUNT(*) FROM watched w WHERE w.user_id = u.id AND w.state = 'watched' AND w.at <= strftime('%Y-%m-%dT%H:%M:%fZ', u.created_at, '+1 day')) >= 10
         THEN 1 ELSE 0 END) AS activated FROM u`, ...binds, from, to);
    return ratio(r?.activated ?? 0, r?.joined ?? 0);
  };
  const week = { ...sum(addDays(today, -7), yesterday), activation: await activationIn(addDays(today, -7), yesterday) };
  const day = { ...sum(yesterday, yesterday), activation: await activationIn(yesterday, yesterday) };

  // источники за 30 дней (посевы, 07.10): сколько пришло и сколько из них дошло до 10 оценок за сутки;
  // подробная воронка одного источника — тем же запросом с `?source=<метка>`
  const sources = await q<{ source: string | null; joined: number; activated: number; invited: number }>(
    `WITH u AS (SELECT id, created_at, source, invited_by FROM user ${userWhere ? `${userWhere} AND` : 'WHERE'} ${SQL_DAY('created_at')} >= ?)
     SELECT source, COUNT(*) AS joined, SUM(CASE WHEN invited_by IS NOT NULL THEN 1 ELSE 0 END) AS invited, SUM(CASE WHEN
       (SELECT COUNT(*) FROM rating r WHERE r.user_id = u.id AND r.at <= strftime('%Y-%m-%dT%H:%M:%fZ', u.created_at, '+1 day'))
       + (SELECT COUNT(*) FROM watched w WHERE w.user_id = u.id AND w.state = 'watched' AND w.at <= strftime('%Y-%m-%dT%H:%M:%fZ', u.created_at, '+1 day')) >= 10
       THEN 1 ELSE 0 END) AS activated FROM u GROUP BY source ORDER BY joined DESC`, ...binds, from30);

  return json({
    at: new Date().toISOString(), today, filters: { withoutOwner: url.searchParams.get('owner') === '0', telegramOnly: url.searchParams.get('tg') === '1', ...(source ? { source } : {}) },
    thresholds: THRESHOLDS,
    yesterday: day, week,
    retention, funnel, daily,
    sources: sources.map((r) => ({ source: r.source ?? '—', joined: r.joined, invitedByFriend: r.invited, activation: ratio(r.activated ?? 0, r.joined) })),
  });
}
