// Подбор для компании по никам (15.10): «@recomend_media_bot для @anya @lyosha» в любом чате — до десяти фильмов, которые
// подходят всем названным и спросившему, тем же голосованием в чате (worker/inlinePoll.ts). Без «чья это идея».
//
// 19.10: подбор — общее рекомендуемое по верхушкам вкуса участников (worker/togetherPick.ts), а у кого верхушки нет —
// прежняя логика: его планы и любимое. Убираем всё, что кто-то из участников видел, оценил, начал или бросил. Только фильмы
// и сериалы. Спросивший должен быть в боте и оценить не меньше MIN_RATED фильмов (владелец, 15.10).
import type { Env } from './env';
import type { Known } from './inlineIndex';
import type { PollFilm } from './inlinePoll';
import { companyPick, MIN_RATED } from './togetherPick';

type Lang = 'ru' | 'en';
const MAX_NICKS = 9;

/** «для @anya @lyosha», «вместе @anya, @lyosha», «for @anya and @lyosha», «@anya @lyosha» → ники (без @, строчными);
 *  undefined — запрос не наш. */
export function groupQuery(q: string): string[] | undefined {
  const m = /^(?:(?:для|вместе|с|for|together|with)\s+)?(@[A-Za-z0-9_]{1,32}(?:(?:\s*,\s*|\s+(?:и|and)\s+|\s+)@[A-Za-z0-9_]{1,32})*)[\s,]*$/i.exec(q.trim());
  if (!m) return undefined;
  return [...new Set(m[1].match(/@[A-Za-z0-9_]+/g)!.map((s) => s.slice(1).toLowerCase()))].slice(0, MAX_NICKS);
}

export type { Known };

/** `names`, `missing`, `old` — подписи `@ник` (или имя); `old` — у кого подбор по старой истории, `meOld` — и у спросившего. */
export type GroupAnswer =
  | { films: PollFilm[]; names: string[]; missing: string[]; old: string[]; meOld: boolean }
  | { error: 'not_in_bot' | 'no_history' | 'nobody' | 'empty'; missing: string[] };

/** Подбор: `from` — Telegram id спросившего, `nicks` — названные, `lookup` — справочник по ключу произведения. */
export async function groupPick(env: Env, from: number, nicks: string[], lookup: (key: string) => Known | undefined): Promise<GroupAnswer> {
  const r = await companyPick(env, from, { nicks }, lookup);
  if ('error' in r) return { error: r.error, missing: r.missing };
  // голосованию нужно хотя бы два варианта
  if (r.films.length < 2) return { error: 'empty', missing: r.missing };
  return { films: r.films.map((f) => ({ t: f.t, ...(f.y ? { y: f.y } : {}), ...(f.i ? { i: f.i } : {}) })), names: r.names, missing: r.missing, old: r.old, meOld: r.meOld };
}

/** Владельцу (GET /api/admin/member?nick=…): есть ли участник с этим ником и сколько у него истории — чтобы разбирать
 *  «нет в боте». Ник в базу попадает только при входе в мини-приложение; переписка с ботом и кнопки в чате его не пишут. */
export async function memberInfo(env: Env, nick: string): Promise<Response> {
  const n = nick.trim().replace(/^@/, '').toLowerCase();
  const u = await env.DB.prepare('SELECT id, tg_id, created_at, seen_at FROM user WHERE lower(username) = ?').bind(n)
    .first<{ id: string; tg_id: number | null; created_at: string; seen_at: string }>();
  const tester = Boolean(await env.DB.prepare('SELECT 1 AS x FROM tester WHERE username = ?').bind(n).first());
  if (!u) return Response.json({ nick: n, found: false, tester });
  const c = await env.DB.prepare(`SELECT (SELECT COUNT(*) FROM rating WHERE user_id = ?1) AS ratings,
    (SELECT COUNT(*) FROM journal WHERE user_id = ?1 AND status = 'planned') AS planned,
    (SELECT COUNT(*) FROM watched WHERE user_id = ?1 AND state = 'watched') AS watched`).bind(u.id).first<Record<string, number>>();
  return Response.json({ nick: n, found: true, tester, telegram: u.tg_id != null, created: u.created_at, seen: u.seen_at, ...c });
}

/** Подписи в выборе инлайна. */
export const GROUP_T = {
  ru: {
    title: (names: string[]) => `Для вас и ${names.join(', ')}`,
    missing: (m: string[]) => `${m.join(', ')} не открывали приложение`,
    old: (m: string[]) => `${m.join(', ')} — по старой истории`,
    not_in_bot: 'Откройте бота — подбор идёт и по вашему вкусу',
    no_history: `Сначала оцените ${MIN_RATED} фильмов — подбор идёт и по вашему вкусу`,
    nobody: (m: string[]) => (m.length ? `${m.join(', ')} не открывали приложение — позовите` : 'Назовите друзей: для @ник @ник'),
    empty: 'Общего пока нет — добавьте фильмы в планы',
  },
  en: {
    title: (names: string[]) => `For you and ${names.join(', ')}`,
    missing: (m: string[]) => `${m.join(', ')} haven't opened the app`,
    old: (m: string[]) => `${m.join(', ')} — from older history`,
    not_in_bot: 'Open the bot — your taste counts too',
    no_history: `Rate ${MIN_RATED} films first — your taste counts too`,
    nobody: (m: string[]) => (m.length ? `${m.join(', ')} haven't opened the app — invite them` : 'Name your friends: for @nick @nick'),
    empty: 'Nothing in common yet — add films to your plans',
  },
} satisfies Record<Lang, unknown>;
