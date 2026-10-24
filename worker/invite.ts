// Откуда пришёл участник (07.10): основа для «пересечения вкусов с друзьями» (ЗП-37) и замера посевов (ЗП-13, ЗП-38).
// Хвосты параметра `startapp` (Telegram кладёт его в подписанный initData — `start_param`):
//   `--r<код>` — кто поделился: внутренний id участника без `u-` (не номер в Telegram). Его ставит сервер в
//                карточку-сообщение «Поделиться» (worker/inline.ts);
//   `--s<метка>` — источник: посев в канале, письмо, пост (`…?startapp=w-tmdb_496243--skinoman`). Ставим руками.
// При первом входе сервер записывает их в `user.invited_by` и `user.source`; воронка (worker/funnel.ts)
// умеет считать по источнику. Друзья для подбора — пары «привёл — пришёл» и участники одной сессии
// «Выбрать вместе» (worker/together.ts).
import type { D1Database } from './env';

const TAIL = /(?:--(?:r[0-9a-f]{16}|s[a-z0-9_]{1,24}))+$/;

/** Параметр ссылки с кодом поделившегося; длиннее 64 знаков Telegram не примет — тогда без кода. */
export function withRef(param: string, userId: string): string {
  const ref = /^u-([0-9a-f]{16})$/.exec(userId)?.[1];
  const p = ref ? `${param}--r${ref}` : param;
  return p.length <= 64 ? p : param;
}

export const stripRef = (param: string): string => param.replace(TAIL, '');

/** Хвост меток из /start в личке (23.10, рекламная кампания): ссылка `t.me/<бот>?start=--s<метка>` приходит боту текстом
 *  `/start --s<метка>`, а участник заводится только при входе в приложение — поэтому хвост надо донести до кнопок ответа
 *  (worker/startPicks.ts), иначе вход запишется меткой кнопки `--sstart`. Нет хвоста — undefined. */
export function startTail(text: string | undefined): string | undefined {
  const payload = /^\/start(?:@[A-Za-z0-9_]+)?\s+([A-Za-z0-9_-]{1,64})\s*$/.exec(text?.trim() ?? '')?.[1];
  return payload ? TAIL.exec(payload)?.[0] : undefined;
}

/** Метка из /start живёт неделю (24.10, рекламная кампания): человек пришёл по `?start=--s<метка>`, а приложение открыл
 *  не кнопкой ответа, а кнопкой меню бота — тогда `start_param` пуст, и метку берём из таблицы `start_mark`. */
export const START_MARK_TTL = 7 * 864e5;

/** /start с хвостом в личке (worker/startPicks.ts): запомнить хвост за номером Telegram, последний /start перезаписывает.
 *  Уже заведённому участнику не пишем — источник записывается только при заведении (noteInvite). */
export async function rememberStart(db: D1Database, tgId: number, tail: string, now = Date.now()): Promise<void> {
  if (TAIL.exec(tail)?.[0] !== tail) return;
  await db.prepare(`INSERT OR REPLACE INTO start_mark (tg_id, tail, at) SELECT ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM user WHERE tg_id = ?)`)
    .bind(tgId, tail, new Date(now).toISOString(), tgId).run();
}

/** Хвост из /start этого номера, если не старше недели; строка снимается в любом случае — участник заводится один раз. */
async function takeStart(db: D1Database, tgId: number, now: number): Promise<string | undefined> {
  const row = await db.prepare('SELECT tail, at FROM start_mark WHERE tg_id = ?').bind(tgId).first<{ tail: string; at: string }>();
  if (!row) return undefined;
  await db.prepare('DELETE FROM start_mark WHERE tg_id = ?').bind(tgId).run();
  return now - Date.parse(row.at) <= START_MARK_TTL ? TAIL.exec(row.tail)?.[0] : undefined;
}

/** Новый участник: записать, кто привёл (себя не считаем, неизвестный код — мимо) и откуда пришёл. Один раз.
 *  24.10: метки источника в `start_param` нет — берём хвост из /start этого номера (start_mark); код из `start_param`
 *  важнее кода из /start (первое совпадение `--r` ниже). */
export async function noteInvite(db: D1Database, userId: string, startParam?: string, tgId?: number, now = Date.now()): Promise<void> {
  let tail = startParam ? TAIL.exec(startParam)?.[0] : undefined;
  const mark = tgId != null ? await takeStart(db, tgId, now) : undefined;
  if (mark && !/--s[a-z0-9_]/.test(tail ?? '')) tail = (tail ?? '') + mark;
  if (!tail) return;
  const ref = /--r([0-9a-f]{16})/.exec(tail)?.[1];
  const source = /--s([a-z0-9_]{1,24})/.exec(tail)?.[1];
  if (source) await db.prepare('UPDATE user SET source = ? WHERE id = ? AND source IS NULL').bind(source, userId).run();
  if (!ref) return;
  const by = `u-${ref}`;
  if (by === userId) return;
  const known = await db.prepare('SELECT id FROM user WHERE id = ?').bind(by).first<{ id: string }>();
  if (!known) return;
  await db.prepare('UPDATE user SET invited_by = ? WHERE id = ? AND invited_by IS NULL').bind(by, userId).run();
}
