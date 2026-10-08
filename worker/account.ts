// Удаление аккаунта (ЗП-5, 07.10): участник стирает себя сам, из настроек. Уходит всё, что он сделал:
// оценки, отметки, дневник, прогнозы и чек-ины, отклики и показы ленты, открытия разборов, заходы и события,
// подписки, сообщения о неточностях и предложения, сессии — и сама запись участника.
//
// Таблицы не перечисляем руками: берём все, где есть колонка `user_id`, — новая таблица с данными участника
// попадёт под удаление сама. Ник участника ещё живёт в списке тестеров (`tester`) — его тоже убираем.
// Копии базы (server/backup.js — 14 дней на сервере, 30 на Mac владельца) стираются по своему сроку:
// так и написано в политике.
import type { D1Database, Env } from './env';

const json = (body: unknown, status = 200) => Response.json(body, { status });

async function userTables(db: D1Database): Promise<string[]> {
  const tables = (await db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'")
    .all<{ name: string }>()).results ?? [];
  const out: string[] = [];
  for (const { name } of tables) {
    if (name === 'user' || !/^[a-z_]+$/.test(name)) continue;
    const cols = (await db.prepare(`PRAGMA table_info(${name})`).all<{ name: string }>()).results ?? [];
    if (cols.some((c) => c.name === 'user_id')) out.push(name);
  }
  return out;
}

/** DELETE /api/account — участник стирает себя. Ответ — сколько строк ушло по таблицам. */
export async function deleteAccount(userId: string, env: Env): Promise<Response> {
  const db = env.DB;
  const me = await db.prepare('SELECT username FROM user WHERE id = ?').bind(userId).first<{ username: string | null }>();
  if (!me) return json({ error: 'not_found' }, 404);
  const tables = await userTables(db);
  const counts: Record<string, number> = {};
  for (const t of tables) {
    const row = await db.prepare(`SELECT COUNT(*) AS n FROM ${t} WHERE user_id = ?`).bind(userId).first<{ n: number }>();
    if (row?.n) counts[t] = Number(row.n);
  }
  // одним пакетом: либо уходит всё, либо ничего; запись участника — последней (на неё ссылаются остальные)
  await db.batch([
    // выбор компанией (ЗП-11): сессии участника уходят вместе с чужими голосами в них
    ...(tables.includes('together') ? [db.prepare('DELETE FROM together_vote WHERE session_id IN (SELECT id FROM together WHERE user_id = ?)').bind(userId)] : []),
    ...tables.map((t) => db.prepare(`DELETE FROM ${t} WHERE user_id = ?`).bind(userId)),
    ...(me.username ? [db.prepare('DELETE FROM tester WHERE username = ?').bind(me.username.replace(/^@/, '').toLowerCase())] : []),
    // кого участник привёл (ЗП-37) — у них ссылка на него стирается
    db.prepare('UPDATE user SET invited_by = NULL WHERE invited_by = ?').bind(userId),
    db.prepare('DELETE FROM user WHERE id = ?').bind(userId),
  ]);
  console.log(`аккаунт удалён по просьбе участника: ${Object.entries(counts).map(([t, n]) => `${t} ${n}`).join(', ') || 'без записей'}`);
  return json({ ok: true, deleted: counts });
}
