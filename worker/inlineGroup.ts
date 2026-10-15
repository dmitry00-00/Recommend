// Подбор для компании по никам (15.10): «@recomend_media_bot для @anya @lyosha» в любом чате — до десяти фильмов, которые
// подходят всем названным и спросившему, тем же голосованием в чате (worker/inlinePoll.ts). Без «чья это идея».
//
// Откуда фильмы (история на сервере: journal, rating, watched):
//   1. в планах у нескольких участников — больше совпадений выше;
//   2. в планах у одного — по очереди от каждого, чтобы длинный список одного не занял всё;
//   3. любимое (оценка 5) одного — по очереди от каждого.
// Убираем всё, что кто-то из участников уже видел: отмечено просмотренным, начато, закончено, брошено, оценено. Любимое
// видел сам его поклонник — для него это пересмотр, исключение не действует; остальные должны его не видеть.
// Только фильмы и сериалы. Спросивший должен быть в боте и оценить не меньше MIN_RATED фильмов (владелец, 15.10): подбор —
// по вкусу каждого, а с длинной своей историей вычленить из общего списка чужие планы и виденное практически нельзя.
import type { Env } from './env';
import type { PollFilm } from './inlinePoll';

type Lang = 'ru' | 'en';
const MAX = 10;
const MAX_NICKS = 9;
const MIN_RATED = 30;

/** «для @anya @lyosha», «вместе @anya, @lyosha», «for @anya and @lyosha», «@anya @lyosha» → ники (без @, строчными);
 *  undefined — запрос не наш. */
export function groupQuery(q: string): string[] | undefined {
  const m = /^(?:(?:для|вместе|с|for|together|with)\s+)?(@[A-Za-z0-9_]{1,32}(?:(?:\s*,\s*|\s+(?:и|and)\s+|\s+)@[A-Za-z0-9_]{1,32})*)[\s,]*$/i.exec(q.trim());
  if (!m) return undefined;
  return [...new Set(m[1].match(/@[A-Za-z0-9_]+/g)!.map((s) => s.slice(1).toLowerCase()))].slice(0, MAX_NICKS);
}

interface Work { type?: string; format?: string; title?: string; year?: number; coverUrl?: string }
export interface Known { t: string; y?: number; i?: string; k?: string }
interface Cand { key: string; film: PollFilm; planned: Set<string>; fans: Set<string>; eager: number; at: string }

const norm = (s: string) => s.normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const parse = (s: string | null): Work | undefined => { try { return s ? (JSON.parse(s) as Work) : undefined; } catch { return undefined; } };

export type GroupAnswer =
  | { films: PollFilm[]; names: string[]; missing: string[] }
  | { error: 'not_in_bot' | 'no_history' | 'nobody' | 'empty'; missing: string[] };

/** Подбор: `from` — Telegram id спросившего, `nicks` — названные, `lookup` — справочник по id произведения (название,
 *  год, картинка, вид), когда в записи истории карточки нет. */
export async function groupPick(env: Env, from: number, nicks: string[], lookup: (workId: string) => Known | undefined): Promise<GroupAnswer> {
  const me = await env.DB.prepare('SELECT id, username FROM user WHERE tg_id = ?').bind(from).first<{ id: string; username: string | null }>();
  if (!me) return { error: 'not_in_bot', missing: [] };
  const others = nicks.filter((n) => n !== (me.username ?? '').toLowerCase());
  const found = others.length
    ? ((await env.DB.prepare(`SELECT id, lower(username) AS nick FROM user WHERE lower(username) IN (${others.map(() => '?').join(',')})`)
      .bind(...others).all<{ id: string; nick: string }>()).results ?? [])
    : [];
  const missing = others.filter((n) => !found.some((f) => f.nick === n));
  if (!found.length) return { error: 'nobody', missing };
  const members = [me.id, ...found.map((f) => f.id)];
  const marks = members.map(() => '?').join(',');

  const own = await env.DB.prepare('SELECT COUNT(*) AS n FROM rating WHERE user_id = ?').bind(me.id).first<{ n: number }>();
  if (Number(own?.n ?? 0) < MIN_RATED) return { error: 'no_history', missing };

  const [journal, rating, watched] = await env.DB.batch([
    env.DB.prepare(`SELECT user_id, work_id, work, status, eagerness, started_at AS at FROM journal WHERE user_id IN (${marks})`).bind(...members),
    env.DB.prepare(`SELECT user_id, work_id, work, rating, at FROM rating WHERE user_id IN (${marks})`).bind(...members),
    env.DB.prepare(`SELECT user_id, work_id, work, at FROM watched WHERE state = 'watched' AND user_id IN (${marks})`).bind(...members),
  ]);
  type Row = { user_id: string; work_id: string; work: string | null; status?: string; eagerness?: number | null; rating?: number; at: string | null };
  const rows = (r: unknown) => ((r as { results?: Row[] }).results ?? []);

  // одно произведение под разными id (импорт, TMDb) — сводим по названию и году
  const film = (r: Row): { key: string; film: PollFilm } | undefined => {
    const w = parse(r.work);
    const k = lookup(r.work_id);
    const kind = w?.format === 'series' ? 'series' : (w?.type ?? k?.k);
    if (kind !== 'film' && kind !== 'series') return undefined;
    const t = w?.title || k?.t;
    if (!t) return undefined;
    const y = w?.year || k?.y;
    const i = k?.i || w?.coverUrl;
    return { key: `${norm(t)}|${y ?? ''}`, film: { t, ...(y ? { y } : {}), ...(i ? { i } : {}) } };
  };
  const seen = new Map<string, Set<string>>();
  const saw = (key: string, user: string) => { if (!seen.has(key)) seen.set(key, new Set()); seen.get(key)!.add(user); };
  const cands = new Map<string, Cand>();
  const cand = (r: Row) => {
    const f = film(r);
    if (!f) return undefined;
    if (!cands.has(f.key)) cands.set(f.key, { ...f, planned: new Set(), fans: new Set(), eager: 0, at: '' });
    return cands.get(f.key)!;
  };
  const keyOf = (r: Row) => film(r)?.key;

  for (const r of rows(watched)) { const k = keyOf(r); if (k) saw(k, r.user_id); }
  for (const r of rows(rating)) {
    const k = keyOf(r);
    if (k) saw(k, r.user_id);
    if (r.rating === 5) cand(r)?.fans.add(r.user_id);
  }
  for (const r of rows(journal)) {
    if (r.status !== 'planned') { const k = keyOf(r); if (k) saw(k, r.user_id); continue; }
    const c = cand(r);
    if (!c) continue;
    c.planned.add(r.user_id);
    c.eager = Math.max(c.eager, r.eagerness ?? 0);
    if ((r.at ?? '') > c.at) c.at = r.at ?? '';
  }

  // кто видел, кроме поклонников: такой фильм компании не подходит
  const fresh = [...cands.values()].filter((c) => [...(seen.get(c.key) ?? [])].every((u) => c.fans.has(u)));
  const several = fresh.filter((c) => c.planned.size > 1)
    .sort((a, b) => b.planned.size - a.planned.size || b.eager - a.eager || b.at.localeCompare(a.at));
  // по очереди от каждого участника: спросивший первым, дальше в порядке ников
  const roundRobin = (list: Cand[], owner: (c: Cand) => string[], order: (a: Cand, b: Cand) => number): Cand[] => {
    const queues = members.map((u) => list.filter((c) => owner(c).includes(u)).sort(order));
    const out: Cand[] = [];
    const taken = new Set<string>();
    for (let i = 0; queues.some((q) => q.length > i); i++) {
      for (const q of queues) { const c = q[i]; if (c && !taken.has(c.key)) { taken.add(c.key); out.push(c); } }
    }
    return out;
  };
  const single = roundRobin(fresh.filter((c) => c.planned.size === 1), (c) => [...c.planned],
    (a, b) => b.eager - a.eager || b.at.localeCompare(a.at));
  const loved = roundRobin(fresh.filter((c) => !c.planned.size && c.fans.size), (c) => [...c.fans],
    (a, b) => b.fans.size - a.fans.size);
  const picked: PollFilm[] = [];
  const used = new Set<string>();
  for (const c of [...several, ...single, ...loved]) {
    if (used.has(c.key)) continue;
    used.add(c.key);
    picked.push(c.film);
    if (picked.length === MAX) break;
  }
  if (picked.length < 2) return { error: 'empty', missing };
  return { films: picked, names: found.map((f) => f.nick), missing };
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
    title: (names: string[]) => `Для вас и ${names.map((n) => `@${n}`).join(', ')}`,
    missing: (m: string[]) => `${m.map((n) => `@${n}`).join(', ')} не открывали приложение`,
    not_in_bot: 'Откройте бота — подбор идёт и по вашему вкусу',
    no_history: `Сначала оцените ${MIN_RATED} фильмов — подбор идёт и по вашему вкусу`,
    nobody: (m: string[]) => (m.length ? `${m.map((n) => `@${n}`).join(', ')} не открывали приложение — позовите` : 'Назовите друзей: для @ник @ник'),
    empty: 'Общего пока нет — добавьте фильмы в планы',
  },
  en: {
    title: (names: string[]) => `For you and ${names.map((n) => `@${n}`).join(', ')}`,
    missing: (m: string[]) => `${m.map((n) => `@${n}`).join(', ')} haven't opened the app`,
    not_in_bot: 'Open the bot — your taste counts too',
    no_history: `Rate ${MIN_RATED} films first — your taste counts too`,
    nobody: (m: string[]) => (m.length ? `${m.map((n) => `@${n}`).join(', ')} haven't opened the app — invite them` : 'Name your friends: for @nick @nick'),
    empty: 'Nothing in common yet — add films to your plans',
  },
} satisfies Record<Lang, unknown>;
