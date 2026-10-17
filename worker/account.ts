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
  const me = await db.prepare('SELECT username, tg_id FROM user WHERE id = ?').bind(userId).first<{ username: string | null; tg_id: number | null }>();
  if (!me) return json({ error: 'not_found' }, 404);
  const tables = await userTables(db);
  // присланные списки (seed--<ник>.json) — по привязкам `nick:<ник>` участника (ХБ, 17.10): после смены ника файл лежит
  // под старым ником, а файл под текущим ником с чужой привязкой трогать нельзя — он не этого участника
  const nicks = tables.includes('seed_applied')
    ? ((await db.prepare("SELECT seed FROM seed_applied WHERE user_id = ? AND seed LIKE 'nick:%'").bind(userId).all<{ seed: string }>()).results ?? [])
      .map((r) => r.seed.slice('nick:'.length)).filter((n) => /^[a-z0-9_]{3,40}$/.test(n))
    : [];
  const nick = me.username?.replace(/^@/, '').toLowerCase();
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
    // голосование в чате (15.10) — по tg_id: свои голоса и свои подборки (чужие голоса в них — тоже)
    ...(me.tg_id != null && tables.length ? [
      db.prepare('DELETE FROM inline_vote WHERE tg_id = ? OR poll_id IN (SELECT id FROM inline_poll WHERE owner_tg = ?)').bind(me.tg_id, me.tg_id),
      db.prepare('DELETE FROM inline_poll WHERE owner_tg = ?').bind(me.tg_id),
    ] : []),
    // тестер (ХБ, 17.10): свою строку — по номеру аккаунта, в том числе под старым ником; строку с чужим номером под
    // своим нынешним ником не трогать — это другой человек
    ...(me.tg_id != null
      ? [db.prepare('DELETE FROM tester WHERE tg_id = ? OR (username = ? AND tg_id IS NULL)').bind(me.tg_id, nick ?? '')]
      : nick ? [db.prepare('DELETE FROM tester WHERE username = ? AND tg_id IS NULL').bind(nick)] : []),
    // кого участник привёл (ЗП-37) — у них ссылка на него стирается
    db.prepare('UPDATE user SET invited_by = NULL WHERE invited_by = ?').bind(userId),
    db.prepare('DELETE FROM user WHERE id = ?').bind(userId),
  ]);
  // присланные списки просмотренного — тоже данные участника; без этого их получил бы следующий владелец ника (ХБ, 16.10).
  // Только по его собственным привязкам (17.10): список под нынешним ником без привязки к нему — чужой
  for (const n of nicks) await env.REFERENCE?.delete?.(`seed--${n}.json`);
  console.log(`аккаунт удалён по просьбе участника: ${Object.entries(counts).map(([t, n]) => `${t} ${n}`).join(', ') || 'без записей'}`);
  return json({ ok: true, deleted: counts });
}
