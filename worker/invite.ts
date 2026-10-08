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

/** Новый участник: записать, кто привёл (себя не считаем, неизвестный код — мимо) и откуда пришёл. Один раз. */
export async function noteInvite(db: D1Database, userId: string, startParam?: string): Promise<void> {
  const tail = startParam ? TAIL.exec(startParam)?.[0] : undefined;
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
