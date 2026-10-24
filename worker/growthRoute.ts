// Вкладка «Рост» (16.10): GET /api/admin/growth — строки из базы → worker/growth.ts; таблица посевов `seeding` (ПР-2):
// GET /api/admin/seeding, PUT /api/admin/seeding (добавить или поправить), DELETE /api/admin/seeding/<id>.
// Всё — по ADMIN_TOKEN, проверка в worker/index.ts.
//
// Фильтры GET /api/admin/growth: `internal=1` — считать и владельца с тестерами (по умолчанию их нет, МА-4);
// `tg=1` — только вошедшие через Telegram (гости веба — свои на каждый браузер, в рост их не считаем).
import type { D1Database, Env } from './env';
import { computeGrowth, type GrowthRows, type SeedingRow } from './growth';
import { mskDay } from './funnel';

const json = (body: unknown, status = 200) => Response.json(body, { status });
const addDays = (day: string, n: number): string => new Date(Date.parse(`${day}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
/** метка посева — как в ссылке `--s<метка>` (worker/invite.ts) */
const LABEL = /^[a-z0-9_]{1,24}$/;
const ID = /^sd-[0-9a-f]{12}$/;

export async function getGrowth(req: Request, env: Env, admin: boolean): Promise<Response> {
  if (!admin) return json({ error: 'unauthorized' }, 401);
  const url = new URL(req.url);
  const db = env.DB;
  const owner = env.OWNER_USERNAME?.replace(/^@/, '').toLowerCase() ?? '';
  const withInternal = url.searchParams.get('internal') === '1';
  const conds: string[] = [];
  const binds: unknown[] = [];
  if (!withInternal) {
    if (owner) { conds.push("lower(coalesce(username, '')) <> ?"); binds.push(owner); }
    conds.push("lower(coalesce(username, '')) NOT IN (SELECT username FROM tester)");
  }
  if (url.searchParams.get('tg') === '1') conds.push('tg_id IS NOT NULL');
  const userWhere = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const inUsers = `user_id IN (SELECT id FROM user ${userWhere})`;
  const q = async <T,>(sql: string, ...bind: unknown[]): Promise<T[]> =>
    ((await db.prepare(sql).bind(...binds, ...bind).all<T>()).results ?? []);
  const one = async <T,>(sql: string, ...bind: unknown[]): Promise<T | undefined> => (await q<T>(sql, ...bind))[0];
  // без фильтра участников — голосования в чатах считаются по tg_id, в них есть и те, кого в приложении нет
  const raw = async <T,>(sql: string, ...bind: unknown[]): Promise<T | undefined> => (await db.prepare(sql).bind(...bind).first<T>()) ?? undefined;

  const today = mskDay();
  const from120 = addDays(today, -120);
  const since30 = `${addDays(today, -30)}T00:00:00.000Z`;
  const since90 = `${addDays(today, -90)}T00:00:00.000Z`;
  const since120 = `${from120}T00:00:00.000Z`;

  const [users, visits, firstFeed, ratingsDay1, onboard, shares, together, participants, polls, voters, seeding, internal] = await Promise.all([
    q<GrowthRows['users'][number]>(`SELECT id, created_at, source, invited_by FROM user ${userWhere}`),
    q<GrowthRows['visits'][number]>(`SELECT user_id, day FROM visit WHERE ${inUsers} AND day >= ?`, from120),
    // первая лента (18.10): по человеку — поиском по индексу impression_user, а не группировкой всей таблицы показов;
    // свёрнутые показы старше 120 дней (worker/retention.ts, если включено) — тоже в счёт
    firstFeedRows(db, userWhere, binds),
    q<GrowthRows['ratingsDay1'][number]>(`SELECT r.user_id, COUNT(*) AS n FROM rating r JOIN user u ON u.id = r.user_id
      WHERE r.${inUsers} AND u.created_at >= ? AND r.at <= strftime('%Y-%m-%dT%H:%M:%fZ', u.created_at, '+1 day') GROUP BY r.user_id`, since90), // 90 дней (23.10): «≥ 10 оценок» у входов по меткам; первый вход берёт свои 30 сам
    q<GrowthRows['onboard'][number]>(`SELECT user_id, place, detail, at FROM event WHERE kind = 'onboard' AND ${inUsers} AND at >= ?`, since30),
    q<GrowthRows['shares'][number]>(`SELECT user_id, at FROM event WHERE kind = 'share_sent' AND ${inUsers} AND at >= ?`, since120),
    one<{ n: number }>(`SELECT COUNT(*) AS n FROM together WHERE ${inUsers} AND created_at >= ?`, since30),
    one<{ n: number }>(`SELECT COUNT(DISTINCT v.user_id) AS n FROM together_vote v JOIN together t ON t.id = v.session_id
      WHERE t.created_at >= ? AND v.user_id <> t.user_id AND v.${inUsers}`, since30),
    raw<{ n: number }>('SELECT COUNT(*) AS n FROM inline_poll WHERE created_at >= ?', since30),
    raw<{ n: number; outsiders: number | null }>(`SELECT COUNT(*) AS n, SUM(CASE WHEN u.tg_id IS NULL THEN 1 ELSE 0 END) AS outsiders
      FROM (SELECT DISTINCT tg_id FROM inline_vote WHERE at >= ?) x LEFT JOIN user u ON u.tg_id = x.tg_id`, since30),
    db.prepare('SELECT id, label, channel, posted_at, price, currency, note FROM seeding ORDER BY posted_at DESC, created_at DESC').all<SeedingRow>().then((r) => r.results ?? []),
    db.prepare(`SELECT SUM(CASE WHEN lower(coalesce(username, '')) = ? THEN 1 ELSE 0 END) AS owner,
      SUM(CASE WHEN lower(coalesce(username, '')) <> ? AND lower(coalesce(username, '')) IN (SELECT username FROM tester) THEN 1 ELSE 0 END) AS testers FROM user`)
      .bind(owner, owner).first<{ owner: number | null; testers: number | null }>(),
  ]);
  // «шары» и голосования считаются без привязки к фильтру — они про людей снаружи приложения тоже
  const rows: GrowthRows = {
    today, users, visits, firstFeed, ratingsDay1, onboard, shares,
    together: { sessions: together?.n ?? 0, participants: participants?.n ?? 0 },
    inline: { polls: polls?.n ?? 0, voters: voters?.n ?? 0, outsiders: voters?.outsiders ?? 0 },
    seeding,
    internal: withInternal ? { owner: 0, testers: 0 } : { owner: internal?.owner ?? 0, testers: internal?.testers ?? 0 },
  };
  // посевы — и списком для таблицы в пульте
  return json({ at: new Date().toISOString(), filters: { internal: withInternal, telegramOnly: url.searchParams.get('tg') === '1' }, seedingRows: seeding, ...computeGrowth(rows) });
}

async function firstFeedRows(db: D1Database, userWhere: string, binds: unknown[]): Promise<GrowthRows['firstFeed']> {
  const rolled = Boolean(await db.prepare("SELECT 1 AS x FROM sqlite_master WHERE type = 'table' AND name = 'impression_rollup'").first());
  const first = rolled
    ? `MIN(coalesce((SELECT MIN(i.at) FROM impression i WHERE i.user_id = u.id), '9'), coalesce((SELECT MIN(r.first_at) FROM impression_rollup r WHERE r.user_id = u.id), '9'))`
    : '(SELECT MIN(i.at) FROM impression i WHERE i.user_id = u.id)';
  const rows = (await db.prepare(`SELECT u.id AS user_id, ${first} AS at FROM user u ${userWhere}`).bind(...binds).all<{ user_id: string; at: string | null }>()).results ?? [];
  return rows.filter((r): r is GrowthRows['firstFeed'][number] => Boolean(r.at) && r.at !== '9');
}

const clip = (v: unknown, n: number): string | null => (typeof v === 'string' && v.trim() ? v.trim().slice(0, n) : null);

/** Посевы: запись по одному посту — метка, канал, дата, цена. Метка та же, что в ссылке `--s<метка>`. */
export async function seedingRoute(req: Request, path: string, db: D1Database): Promise<Response> {
  if (path === '/api/admin/seeding' && req.method === 'GET') {
    const r = await db.prepare('SELECT id, label, channel, posted_at, price, currency, note FROM seeding ORDER BY posted_at DESC, created_at DESC').all<SeedingRow>();
    return json({ seeding: r.results ?? [] });
  }
  if (path === '/api/admin/seeding' && req.method === 'PUT') {
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const label = clip(b.label, 24)?.toLowerCase();
    if (!label || !LABEL.test(label)) return json({ error: 'bad_label', hint: 'латиница, цифры и _, до 24 знаков — как в ссылке --s' }, 400);
    const postedAt = clip(b.posted_at, 10);
    if (postedAt && !/^\d{4}-\d{2}-\d{2}$/.test(postedAt)) return json({ error: 'bad_date' }, 400);
    const price = b.price == null || b.price === '' ? null : Number(b.price);
    if (price != null && !(Number.isFinite(price) && price >= 0)) return json({ error: 'bad_price' }, 400);
    const id = typeof b.id === 'string' && ID.test(b.id) ? b.id : `sd-${Array.from(crypto.getRandomValues(new Uint8Array(6)), (x) => x.toString(16).padStart(2, '0')).join('')}`;
    await db.prepare(`INSERT INTO seeding (id, label, channel, posted_at, price, currency, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET label = excluded.label, channel = excluded.channel, posted_at = excluded.posted_at, price = excluded.price,
        currency = excluded.currency, note = excluded.note`)
      .bind(id, label, clip(b.channel, 120), postedAt, price, clip(b.currency, 8) ?? 'RUB', clip(b.note, 500), new Date().toISOString()).run();
    return json({ ok: true, id });
  }
  const del = /^\/api\/admin\/seeding\/(sd-[0-9a-f]{12})$/.exec(path);
  if (del && req.method === 'DELETE') {
    const r = await db.prepare('DELETE FROM seeding WHERE id = ?').bind(del[1]).run();
    return json({ ok: true, removed: r.meta?.changes ?? 0 });
  }
  return json({ error: 'not_found' }, 404);
}
