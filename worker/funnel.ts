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
//   · funnel — новые за 30 дней: вошёл → первая лента в первые сутки → откликнулся на ленту («Видел»,
//     разбор, принятие) → открыл разбор → принял фильм (эталон) → посмотрел → вернулся в другой день.
//     Ступени считаются каждая сама по себе;
//   · retention — когорты по дню входа: D1/D7/D30 «в этот день» и «в этот день или позже»;
//   · daily — по дням за 14 дней: кто был, новые, карточки, «Смотреть», разборы, ленты;
//   · metrics (МА-1, МА-2, 13.10) — «сдвиг», proxy reward, valued, take-rate, ECS, GS, ревизит, удержание
//     от активации и WAU (worker/metrics.ts);
//   · engagement (МА-3, 14.10) — голоса (открытия и дочитывание по автору), «поделился» на 100 активных, источники
//     новых и доля пришедших без нас, «подобрать словами», ответы на вопросы, задержка оценки (worker/engagement.ts).
import type { D1Database, Env } from './env';
import { computeMetrics, type MetricRows } from './metrics';
import { computeEngagement, type EngagementRows } from './engagement';
import { canonWork } from './workAliases';

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

// `card`, `watch` — с 07.10 (ЗП-3); `trailer` — с 15.10 (трейлер смахиванием в ленте); `share_sent`, `mood_query`, `survey_answered` — с 14.10 (МА-3, worker/engagement.ts);
// `onboard` — с 16.10 (ДФ-2): шаги первого входа свайпом, place — шаг, detail — счёт («seen:4,want:2,no:3,rated:3»)
// `trailer_play` — плеер трейлера реально начал играть, `trailer_stall` — не начал за 8 с (17.10: трейлеры с сервера,
// tools/trailers.mts; доля зависших — проверка, что ролики справочника живые и открываются)
const KINDS = new Set(['card', 'watch', 'trailer', 'share_sent', 'mood_query', 'survey_answered', 'onboard', 'trailer_play', 'trailer_stall']);
let eventSeq = 0;

export async function postEvent(req: Request, userId: string, db: D1Database): Promise<Response> {
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const str = (v: unknown, n = 64) => (typeof v === 'string' && v ? v.slice(0, n) : null);
  const kind = str(b.kind);
  if (!kind || !KINDS.has(kind)) return json({ error: 'bad_kind' }, 400);
  const id = `e-${Date.now().toString(36)}-${(eventSeq++ % 1e6).toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  // id лишней копии от старого клиента — на главную (канон копий, 17.10, worker/workAliases.ts)
  const workId = str(b.workId, 120);
  await db.prepare('INSERT INTO event (id, user_id, kind, work_id, place, detail, at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(id, userId, kind, workId ? canonWork(workId) : null, str(b.place), str(b.detail, 120), new Date().toISOString()).run();
  return json({ ok: true });
}

// ─── сводка ─────────────────────────────────────────────────────────────────

/** Пороги «идём дальше» для закрытых бет (ROADMAP §9; через две недели беты — откалибровать).
 *  Минимальная редакция (10.10): участник видит ленту, разборы, обсуждения и «Видел» — главные показатели
 *  интереса теперь «отклик на ленту» и открытие разбора; чек-ин и «Смотреть» — функции эталона, их пороги
 *  считаются, только когда функция включена хоть кому-то.
 *  Два уровня (исследование 10.10, reports/Дизайн, функционал и метрики.md): цель — уровень лучших 25%
 *  медиа-приложений, минимум — медиана категории; ниже минимума продукт не держит. На 300 участниках доля
 *  видна с точностью ±5 п.п.: по одной неделе пороги не двигаем, вывод — от когорты в 100–150 человек. */
export const THRESHOLDS = {
  activation: 0.6, d7: 0.25, d30: 0.12, engagedFeeds: 0.3, analysisOpens: 0.15,
  acceptedFeeds: 0.3, checkins: 0.2, watchClicks: 0.08,
} as const;
export const FLOORS: Partial<Record<keyof typeof THRESHOLDS, number>> = {
  activation: 0.4, d7: 0.15, d30: 0.07, engagedFeeds: 0.2, analysisOpens: 0.1,
};
/** Сколько новых нужно, чтобы доля за период что-то значила: меньше — показатель серый. */
export const MIN_BASE = 30;

const ACCEPT = "('save', 'start')";
/** Отклик на фильм ленты в минимальной редакции: принял (эталон), «Видел» (отклик «уже знаю») или открыл
 *  разбор этого фильма — всё, кроме «не сейчас» и молчания. */
const engagedWith = (i: string) => `(EXISTS (SELECT 1 FROM feedback f WHERE f.user_id = ${i}.user_id AND f.rec_id = ${i}.rec_id
    AND (f.action IN ${ACCEPT} OR (f.action = 'dismiss' AND f.reason = 'already_know')))
  OR EXISTS (SELECT 1 FROM material_open m WHERE m.user_id = ${i}.user_id AND m.work_id = ${i}.work_id AND m.at >= ${i}.at))`;
/** Активация (10.10): первая лента в первые сутки — то есть человек дошёл до подбора (пять оценок в
 *  справочнике или импорт). Раньше — 10 оценок; лента собирается с пяти, и исследование холодного старта
 *  говорит, что 2–4 оценок уже хватает обойти среднее. */
const activatedSql = `EXISTS (SELECT 1 FROM impression i WHERE i.user_id = u.id AND i.at <= strftime('%Y-%m-%dT%H:%M:%fZ', u.created_at, '+1 day'))`;
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
  const [visits, joined, cards, watches, opens, ratings, feeds, accepted, engaged, seen, prompted, checkins] = await Promise.all([
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
    // лента с откликом (минимальная редакция): хоть на один её фильм — «Видел», разбор или принятие
    byDay(`SELECT ${SQL_DAY('i.at')} AS day, COUNT(DISTINCT i.slate_id) AS n, COUNT(DISTINCT i.user_id) AS users FROM impression i
             WHERE i.${inUsers} AND ${SQL_DAY('i.at')} >= ? AND ${engagedWith('i')}
             GROUP BY day`, from14),
    // «Видел» на фильме из ленты: подбор попал в знакомое — сигнал вкуса, но не новое
    byDay(`SELECT ${SQL_DAY('at')} AS day, COUNT(*) AS n, COUNT(DISTINCT user_id) AS users FROM feedback WHERE action = 'dismiss' AND reason = 'already_know' AND ${inUsers} AND ${SQL_DAY('at')} >= ? GROUP BY day`, from14),
    // посмотрел по подсказке (10.10): «Видел» на фильме, который лента показала ему в один из прошлых дней.
    // В минимуме нет «в планы» и «смотрю»: лента держит те же фильмы, пока нет новых оценок, — человек
    // возвращается после просмотра и отмечает. Это и есть «посмотрел то, что мы предложили»
    byDay(`SELECT ${SQL_DAY('f.at')} AS day, COUNT(*) AS n, COUNT(DISTINCT f.user_id) AS users FROM feedback f
             WHERE f.action = 'dismiss' AND f.reason = 'already_know' AND f.${inUsers} AND ${SQL_DAY('f.at')} >= ?
               AND EXISTS (SELECT 1 FROM impression i WHERE i.user_id = f.user_id AND i.work_id = f.work_id AND ${SQL_DAY('i.at')} < ${SQL_DAY('f.at')})
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
    engagedFeeds: pick(engaged, day)?.n ?? 0,
    seen: pick(seen, day)?.n ?? 0,
    prompted: pick(prompted, day)?.n ?? 0,
    accepts: pick(accepts, day)?.n ?? 0,
    checkins: pick(checkins, day)?.n ?? 0,
    cardsWithOpen: pick(cardsWithOpen, day)?.n ?? 0,
    cardsWithWatch: pick(cardsWithWatch, day)?.n ?? 0,
  }));

  // ── воронка: новые за 30 дней
  const [funnelRow] = await q<{ joined: number; activated: number; engaged: number; opened: number; accepted: number; watched: number; returned: number }>(
    `WITH u AS (SELECT id, created_at, ${SQL_DAY('created_at')} AS d FROM user ${userWhere ? `${userWhere} AND` : 'WHERE'} ${SQL_DAY('created_at')} >= ?)
     SELECT COUNT(*) AS joined,
       SUM(CASE WHEN ${activatedSql} THEN 1 ELSE 0 END) AS activated,
       SUM(CASE WHEN EXISTS (SELECT 1 FROM impression i WHERE i.user_id = u.id AND ${engagedWith('i')}) THEN 1 ELSE 0 END) AS engaged,
       SUM(CASE WHEN EXISTS (SELECT 1 FROM material_open m WHERE m.user_id = u.id) THEN 1 ELSE 0 END) AS opened,
       SUM(CASE WHEN EXISTS (SELECT 1 FROM feedback f WHERE f.user_id = u.id AND f.action IN ${ACCEPT})
                  OR EXISTS (SELECT 1 FROM journal j WHERE j.user_id = u.id) THEN 1 ELSE 0 END) AS accepted,
       SUM(CASE WHEN EXISTS (SELECT 1 FROM journal j WHERE j.user_id = u.id AND j.status = 'finished')
                  OR EXISTS (SELECT 1 FROM checkin c WHERE c.user_id = u.id AND c.status = 'finished') THEN 1 ELSE 0 END) AS watched,
       SUM(CASE WHEN EXISTS (SELECT 1 FROM visit v WHERE v.user_id = u.id AND v.day > u.d) THEN 1 ELSE 0 END) AS returned
     FROM u`, ...binds, from30);
  const funnel = {
    since: from30,
    joined: funnelRow?.joined ?? 0, activated: funnelRow?.activated ?? 0, engaged: funnelRow?.engaged ?? 0, opened: funnelRow?.opened ?? 0,
    accepted: funnelRow?.accepted ?? 0,
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
      engagedFeeds: ratio(s('engagedFeeds'), s('feeds')),
      seen: s('seen'), prompted: s('prompted'),
      checkins: ratio(s('checkins'), s('accepts')),
      watchClicks: ratio(s('cardsWithWatch'), s('cards')),
      analysisOpens: ratio(s('cardsWithOpen'), s('cards')),
    };
  };
  const activationIn = async (from: string, to: string) => {
    const [r] = await q<{ joined: number; activated: number }>(
      `WITH u AS (SELECT id, created_at FROM user ${userWhere ? `${userWhere} AND` : 'WHERE'} ${SQL_DAY('created_at')} BETWEEN ? AND ?)
       SELECT COUNT(*) AS joined, SUM(CASE WHEN ${activatedSql} THEN 1 ELSE 0 END) AS activated FROM u`, ...binds, from, to);
    return { share: ratio(r?.activated ?? 0, r?.joined ?? 0), joined: r?.joined ?? 0 };
  };
  const weekAct = await activationIn(addDays(today, -7), yesterday);
  const dayAct = await activationIn(yesterday, yesterday);
  const week = { ...sum(addDays(today, -7), yesterday), activation: weekAct.share };
  const day = { ...sum(yesterday, yesterday), activation: dayAct.share };

  // источники за 30 дней (посевы, 07.10): сколько пришло и сколько из них дошло до 10 оценок за сутки;
  // подробная воронка одного источника — тем же запросом с `?source=<метка>`
  const sources = await q<{ source: string | null; joined: number; activated: number; invited: number }>(
    `WITH u AS (SELECT id, created_at, source, invited_by FROM user ${userWhere ? `${userWhere} AND` : 'WHERE'} ${SQL_DAY('created_at')} >= ?)
     SELECT source, COUNT(*) AS joined, SUM(CASE WHEN invited_by IS NOT NULL THEN 1 ELSE 0 END) AS invited,
       SUM(CASE WHEN ${activatedSql} THEN 1 ELSE 0 END) AS activated FROM u GROUP BY source ORDER BY joined DESC`, ...binds, from30);

  // ── МА-1, МА-2: строки за 120 дней (когорта 4–8 недель и её досмотры), снимки карты — все
  const from120 = addDays(today, -120);
  const since = `${from120}T00:00:00.000Z`;
  const [mUsers, mVisits, mStates, mImpr, mFeedback, mCheckins, mRatings, mEvents] = await Promise.all([
    q<MetricRows['users'][number]>(`SELECT id, created_at FROM user ${userWhere}`, ...binds),
    q<MetricRows['visits'][number]>(`SELECT user_id, day FROM visit WHERE ${inUsers} AND day >= ?`, ...binds, from120),
    q<MetricRows['states'][number]>(`SELECT user_id, at, center, lo, hi, median, n FROM level_state WHERE ${inUsers}`, ...binds),
    q<MetricRows['impressions'][number]>(`SELECT user_id, rec_id, work_id, level, traits, at FROM impression WHERE ${inUsers} AND at >= ?`, ...binds, since),
    q<MetricRows['feedback'][number]>(`SELECT user_id, rec_id, work_id, action, reason, level, traits, at FROM feedback WHERE ${inUsers} AND at >= ?`, ...binds, since),
    q<MetricRows['checkins'][number]>(`SELECT user_id, work_id, status, level, worth, at FROM checkin WHERE ${inUsers} AND at >= ?`, ...binds, since),
    q<MetricRows['ratings'][number]>(`SELECT user_id, work_id, rating, at FROM rating WHERE ${inUsers}`, ...binds),
    q<MetricRows['events'][number]>(`SELECT user_id, kind, work_id, at FROM event WHERE kind IN ('card', 'watch') AND ${inUsers} AND at >= ?`, ...binds, since),
  ]);
  const metrics = computeMetrics({ users: mUsers, visits: mVisits, states: mStates, impressions: mImpr, feedback: mFeedback,
    checkins: mCheckins, ratings: mRatings, events: mEvents });

  // ── МА-3: строки за 30 дней
  const since30 = `${from30}T00:00:00.000Z`;
  const [eOpens, eEvents, eVisits, eJoined, eRated] = await Promise.all([
    q<EngagementRows['opens'][number]>(`SELECT user_id, voice_id, minutes, dwell, at FROM material_open WHERE ${inUsers} AND at >= ?`, ...binds, since30),
    q<EngagementRows['events'][number]>(`SELECT user_id, kind, work_id, place, detail, at FROM event
      WHERE (kind IN ('share_sent', 'mood_query', 'survey_answered') OR (kind = 'card' AND place = 'mood')) AND ${inUsers} AND at >= ?`, ...binds, since30),
    q<EngagementRows['visits'][number]>(`SELECT user_id, day FROM visit WHERE ${inUsers} AND day >= ?`, ...binds, from30),
    q<EngagementRows['joined'][number]>(`SELECT source, invited_by FROM user ${userWhere ? `${userWhere} AND` : 'WHERE'} ${SQL_DAY('created_at')} >= ?`, ...binds, from30),
    q<EngagementRows['rated'][number]>(`SELECT r.at AS rated, MIN(i.at) AS shown FROM rating r
      JOIN impression i ON i.user_id = r.user_id AND i.work_id = r.work_id AND i.at <= r.at
      WHERE r.${inUsers} AND r.at >= ? GROUP BY r.user_id, r.work_id`, ...binds, since30),
  ]);
  const engagement = computeEngagement({ opens: eOpens, events: eEvents, visits: eVisits, joined: eJoined, rated: eRated, today });

  return json({
    at: new Date().toISOString(), today, filters: { withoutOwner: url.searchParams.get('owner') === '0', telegramOnly: url.searchParams.get('tg') === '1', ...(source ? { source } : {}) },
    thresholds: THRESHOLDS, floors: FLOORS, minBase: MIN_BASE,
    yesterday: day, week,
    retention, funnel, daily, metrics, engagement,
    sources: sources.map((r) => ({ source: r.source ?? '—', joined: r.joined, invitedByFriend: r.invited, activation: ratio(r.activated ?? 0, r.joined) })),
  });
}
