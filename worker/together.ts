// Выбор компанией (ЗП-11, 07.10): «что смотрим вечером» на двоих и больше. Один собирает десятку фильмов
// (подбор его клиента: модель и разборы), зовёт остальных в чат карточкой-сообщением с кнопкой «Голосовать»
// (`startapp=t-<id>`), каждый проходит ту же десятку: «хочу», «не хочу», «видел».
//
// Итог: совпадение — фильм, который хотят все проголосовавшие по нему (от двоих). Дальше — по числу «хочу»,
// потом по числу «не хочу» (меньше — выше), потом по общему вкусу: каждый клиент вместе с голосом присылает,
// насколько фильм подходит ему самому (`fit` — оценка модели по его профилю, 0..1; у нового участника — нет).
// Это и есть пересечение вкусов: при равных голосах выше то, что ближе всем.
//
// Колода хранится на сервере целиком (название, год, кадр, пара строк, где смотреть): у позванного может
// не быть этих фильмов в своём справочнике, а видеть он должен то же, что все.
import type { D1Database, Env } from './env';

const json = (body: unknown, status = 200) => Response.json(body, { status });
const DECK_MIN = 4;
const DECK_MAX = 12;
const VOTE_DAYS = 7;
const VOTES = new Set(['yes', 'no', 'seen']);

export interface DeckCard {
  id: string; title: string; year?: number; image?: string; about?: string; essays?: number; kind?: 'film' | 'series';
  watch?: { platform: string; url: string; source?: 'tmdb' | 'kinopoisk_unofficial' }[];
}

const str = (v: unknown, n: number): string | undefined => (typeof v === 'string' && v.trim() ? v.trim().slice(0, n) : undefined);
const https = (v: unknown, n = 500): string | undefined => { const s = str(v, n); return s && /^https:\/\/[^\s"'<>]+$/.test(s) ? s : undefined; };

function cleanCard(c: unknown): DeckCard | undefined {
  if (!c || typeof c !== 'object') return undefined;
  const o = c as Record<string, unknown>;
  const id = str(o.id, 120);
  const title = str(o.title, 120);
  if (!id || !title) return undefined;
  const watch = Array.isArray(o.watch)
    ? o.watch.slice(0, 3).flatMap((w) => {
      const x = w as Record<string, unknown>;
      const platform = str(x?.platform, 40);
      const url = https(x?.url);
      // источник нужен для подписи «по данным JustWatch» (данные TMDb о кинотеатрах, ЗП-24)
      const source = x?.source === 'tmdb' ? 'tmdb' as const : x?.source === 'kinopoisk_unofficial' ? 'kinopoisk_unofficial' as const : undefined;
      return platform && url ? [{ platform, url, ...(source ? { source } : {}) }] : [];
    }) : [];
  return {
    id, title,
    ...(typeof o.year === 'number' && o.year > 1800 && o.year < 2100 ? { year: Math.round(o.year) } : {}),
    ...(https(o.image) ? { image: https(o.image) } : {}),
    ...(str(o.about, 300) ? { about: str(o.about, 300) } : {}),
    ...(typeof o.essays === 'number' && o.essays >= 0 ? { essays: Math.min(99, Math.round(o.essays)) } : {}),
    ...(o.kind === 'series' ? { kind: 'series' as const } : {}),
    ...(watch.length ? { watch } : {}),
  };
}

const newSessionId = (): string => {
  const b = crypto.getRandomValues(new Uint8Array(8));
  return [...b].map((x) => x.toString(36).padStart(2, '0')).join('').slice(0, 12);
};

/** POST /api/together `{ deck: DeckCard[] }` → `{ id }` */
export async function createTogether(req: Request, userId: string, db: D1Database): Promise<Response> {
  const b = (await req.json().catch(() => ({}))) as { deck?: unknown };
  const seen = new Set<string>();
  const deck = (Array.isArray(b.deck) ? b.deck : []).map(cleanCard)
    .filter((c): c is DeckCard => Boolean(c && !seen.has(c.id) && seen.add(c.id))).slice(0, DECK_MAX);
  if (deck.length < DECK_MIN) return json({ error: 'small_deck', min: DECK_MIN }, 400);
  const id = newSessionId();
  await db.prepare('INSERT INTO together (id, user_id, deck, created_at) VALUES (?, ?, ?, ?)')
    .bind(id, userId, JSON.stringify(deck), new Date().toISOString()).run();
  return json({ id });
}

interface Row { id: string; user_id: string; deck: string; created_at: string }
interface VoteRow { user_id: string; work_id: string; vote: string; fit: number | null; name: string | null; username: string | null }

async function load(db: D1Database, id: string): Promise<{ s: Row; deck: DeckCard[]; votes: VoteRow[] } | undefined> {
  const s = await db.prepare('SELECT id, user_id, deck, created_at FROM together WHERE id = ?').bind(id).first<Row>();
  if (!s) return undefined;
  const votes = (await db.prepare(
    `SELECT v.user_id, v.work_id, v.vote, v.fit, u.first_name AS name, u.username FROM together_vote v
       LEFT JOIN user u ON u.id = v.user_id WHERE v.session_id = ?`,
  ).bind(id).all<VoteRow>()).results ?? [];
  return { s, deck: JSON.parse(s.deck) as DeckCard[], votes };
}

const open = (s: Row) => Date.now() - Date.parse(s.created_at) < VOTE_DAYS * 864e5;

/** Итог: совпадения, порядок, кто чего хочет. Считается на каждый запрос — голосов десятки. */
export function tally(deck: DeckCard[], votes: VoteRow[], me: string) {
  const people = new Map<string, { name: string; n: number; me: boolean }>();
  for (const v of votes) {
    const p = people.get(v.user_id) ?? { name: v.name || (v.username ? `@${v.username}` : 'Гость'), n: 0, me: v.user_id === me };
    p.n += 1;
    people.set(v.user_id, p);
  }
  // одинаковые имена («Гость», два Димы) — с номером, иначе итог не прочесть
  const taken = new Map<string, number>();
  for (const p of people.values()) {
    const n = (taken.get(p.name) ?? 0) + 1;
    taken.set(p.name, n);
    if (n > 1) p.name = `${p.name} ${n}`;
  }
  const rows = deck.map((c) => {
    const vs = votes.filter((v) => v.work_id === c.id);
    // себя в списках видно как «вы» — так же, как в строке участников на клиенте
    const names = (vote: string) => vs.filter((v) => v.vote === vote).map((v) => (v.user_id === me ? 'вы' : people.get(v.user_id)!.name));
    const fits = vs.map((v) => v.fit).filter((f): f is number => typeof f === 'number');
    const yes = names('yes');
    const no = names('no');
    return {
      workId: c.id, yes: yes.length, no: no.length, seen: names('seen').length, yesNames: yes, seenNames: names('seen'),
      fit: fits.length ? fits.reduce((a, b) => a + b, 0) / fits.length : null,
      // совпадение: все, кто голосовал по фильму, хотят, и их хотя бы двое
      match: yes.length >= 2 && yes.length === vs.length,
    };
  });
  const order = [...rows].sort((a, b) => Number(b.match) - Number(a.match) || b.yes - a.yes || a.no - b.no || (b.fit ?? 0) - (a.fit ?? 0));
  return { people: [...people.values()], rows: order };
}

/** GET /api/together/:id */
export async function getTogether(id: string, userId: string, db: D1Database): Promise<Response> {
  const got = await load(db, id);
  if (!got) return json({ error: 'not_found' }, 404);
  const { s, deck, votes } = got;
  const owner = await db.prepare('SELECT first_name, username FROM user WHERE id = ?').bind(s.user_id).first<{ first_name: string | null; username: string | null }>();
  const mine = Object.fromEntries(votes.filter((v) => v.user_id === userId).map((v) => [v.work_id, v.vote]));
  const t = tally(deck, votes, userId);
  // создатель — в списке и до своего первого голоса
  if (!t.people.some((p) => p.me) && s.user_id === userId) t.people.unshift({ name: owner?.first_name || 'Вы', n: 0, me: true });
  return json({
    id: s.id, createdAt: s.created_at, open: open(s), mineSession: s.user_id === userId,
    owner: owner?.first_name || (owner?.username ? `@${owner.username}` : null),
    deck, votes: mine, people: t.people, tally: t.rows,
  });
}

/** PUT /api/together/:id/vote `{ workId, vote: 'yes'|'no'|'seen', fit?: 0..1 }` */
export async function voteTogether(req: Request, id: string, userId: string, db: D1Database): Promise<Response> {
  const s = await db.prepare('SELECT id, user_id, deck, created_at FROM together WHERE id = ?').bind(id).first<Row>();
  if (!s) return json({ error: 'not_found' }, 404);
  if (!open(s)) return json({ error: 'closed' }, 409);
  const b = (await req.json().catch(() => ({}))) as { workId?: unknown; vote?: unknown; fit?: unknown };
  const workId = str(b.workId, 120);
  const vote = str(b.vote, 8);
  if (!workId || !vote || !VOTES.has(vote)) return json({ error: 'bad_vote' }, 400);
  if (!(JSON.parse(s.deck) as DeckCard[]).some((c) => c.id === workId)) return json({ error: 'not_in_deck' }, 400);
  const fit = typeof b.fit === 'number' && Number.isFinite(b.fit) ? Math.max(0, Math.min(1, b.fit)) : null;
  await db.prepare(
    `INSERT INTO together_vote (session_id, user_id, work_id, vote, fit, at) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (session_id, user_id, work_id) DO UPDATE SET vote = excluded.vote, fit = excluded.fit, at = excluded.at`,
  ).bind(id, userId, workId, vote, fit, new Date().toISOString()).run();
  return json({ ok: true });
}

export async function togetherRoute(req: Request, path: string, userId: string, env: Env): Promise<Response | undefined> {
  if (path === '/api/together' && req.method === 'POST') return createTogether(req, userId, env.DB);
  const m = /^\/api\/together\/([a-z0-9]{6,16})(\/vote)?$/.exec(path);
  if (!m) return undefined;
  if (!m[2] && req.method === 'GET') return getTogether(m[1], userId, env.DB);
  if (m[2] && req.method === 'PUT') return voteTogether(req, m[1], userId, env.DB);
  return undefined;
}
