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

// ─── команда в чате (11.10) ─────────────────────────────────────────────────────
// «/together» в группе (или в личке с ботом): бот отвечает кнопкой «Собрать подборку» — она открывает приложение с
// одноразовым ключом чата (`startapp=g-<ключ>`). Тот, кто нажал, собирает десятку, и сервер по ключу сам публикует
// в этот чат приглашение «Голосовать». Без ключа бот в чат не пишет: иначе через него можно было бы слать что угодно
// в любой чат, где он есть. Ключ живёт сутки и годится на одну подборку. В группе бот видит только команды себе
// (режим приватности Telegram), переписку — нет.
const BOT = 'recomend_media_bot';
const CHAT_HOURS = 24;
const COMMAND = /^\/(?:together|vmeste)(?:@recomend_media_bot)?(?:\s|$)/i;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const TEXT = {
  ru: {
    ask: 'Что смотрим? Один собирает подборку под свой вкус — я пришлю её сюда, остальные голосуют: «хочу», «не хочу», «видел».',
    pick: 'Собрать подборку',
    vote: (name: string, n: number) => `<b>Голосуем: что смотрим</b>\nПодборка от ${esc(name)} — ${n} фильмов. Голосуйте, совпадение покажу в приложении.`,
    go: 'Голосовать',
  },
  en: {
    ask: "What are we watching? One of you picks a set to match their taste — I'll post it here, and everyone votes: want, don't, seen.",
    pick: 'Pick films',
    vote: (name: string, n: number) => `<b>Vote: what are we watching</b>\nA set of ${n} films from ${esc(name)}. Vote — the match shows up in the app.`,
    go: 'Vote',
  },
};
const lang = (code?: string | null) => (code && /^en/i.test(code) ? 'en' : 'ru');

async function send(env: Env, body: Record<string, unknown>): Promise<boolean> {
  if (!env.BOT_TOKEN) return false;
  const r = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  }).catch((err) => { console.error('together send', err); return undefined; });
  return Boolean(r?.ok);
}

export interface ChatMessage { message_id: number; text?: string; chat: { id: number; type: string; title?: string }; from?: { language_code?: string } }

/** Сообщение боту (вебхук, worker/inline.ts). true — команда наша и ответ отправлен. */
export async function togetherCommand(env: Env, m: ChatMessage): Promise<boolean> {
  if (!m.text || !COMMAND.test(m.text.trim())) return false;
  const token = newSessionId();
  const l = lang(m.from?.language_code);
  // ключи старше недели не нужны никому: и не годны, и не нужны для истории
  await env.DB.prepare('DELETE FROM together_chat WHERE created_at < ?').bind(new Date(Date.now() - 7 * 864e5).toISOString()).run();
  await env.DB.prepare('INSERT INTO together_chat (token, chat_id, title, lang, created_at) VALUES (?, ?, ?, ?, ?)')
    .bind(token, m.chat.id, m.chat.title?.slice(0, 120) ?? null, l, new Date().toISOString()).run();
  return send(env, {
    chat_id: m.chat.id, text: TEXT[l].ask, reply_parameters: { message_id: m.message_id, allow_sending_without_reply: true },
    reply_markup: { inline_keyboard: [[{ text: TEXT[l].pick, url: `https://t.me/${BOT}?startapp=g-${token}` }]] },
  });
}

/** Приглашение голосовать — в чат, откуда пришла команда; ключ гасится. Чужой, старый или погашенный ключ — молча нет. */
async function postToChat(env: Env, token: string, sessionId: string, userId: string, n: number): Promise<{ title: string | null } | undefined> {
  const c = await env.DB.prepare('SELECT chat_id, title, lang, created_at, session_id FROM together_chat WHERE token = ?').bind(token)
    .first<{ chat_id: number; title: string | null; lang: string | null; created_at: string; session_id: string | null }>();
  if (!c || c.session_id || Date.now() - Date.parse(c.created_at) > CHAT_HOURS * 3600e3) return undefined;
  const u = await env.DB.prepare('SELECT first_name, username FROM user WHERE id = ?').bind(userId).first<{ first_name: string | null; username: string | null }>();
  const l = lang(c.lang);
  const name = u?.first_name || (u?.username ? `@${u.username}` : l === 'en' ? 'a friend' : 'друга');
  const sent = await send(env, {
    chat_id: c.chat_id, text: TEXT[l].vote(name, n), parse_mode: 'HTML',
    reply_markup: { inline_keyboard: [[{ text: TEXT[l].go, url: `https://t.me/${BOT}?startapp=t-${sessionId}` }]] },
  });
  if (!sent) return undefined;
  await env.DB.prepare('UPDATE together_chat SET session_id = ? WHERE token = ?').bind(sessionId, token).run();
  return { title: c.title };
}

/** POST /api/together `{ deck: DeckCard[], chat?: ключ из команды }` → `{ id, chat? }`; `chat` — название чата
 *  (или null для лички), если приглашение туда ушло */
export async function createTogether(req: Request, userId: string, env: Env): Promise<Response> {
  const db = env.DB;
  const b = (await req.json().catch(() => ({}))) as { deck?: unknown; chat?: unknown };
  const seen = new Set<string>();
  const deck = (Array.isArray(b.deck) ? b.deck : []).map(cleanCard)
    .filter((c): c is DeckCard => Boolean(c && !seen.has(c.id) && seen.add(c.id))).slice(0, DECK_MAX);
  if (deck.length < DECK_MIN) return json({ error: 'small_deck', min: DECK_MIN }, 400);
  const id = newSessionId();
  await db.prepare('INSERT INTO together (id, user_id, deck, created_at) VALUES (?, ?, ?, ?)')
    .bind(id, userId, JSON.stringify(deck), new Date().toISOString()).run();
  const token = typeof b.chat === 'string' && /^[a-z0-9]{6,16}$/.test(b.chat) ? b.chat : undefined;
  const posted = token ? await postToChat(env, token, id, userId, deck.length) : undefined;
  return json({ id, ...(posted ? { chat: posted.title } : {}) });
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
  if (path === '/api/together' && req.method === 'POST') return createTogether(req, userId, env);
  const m = /^\/api\/together\/([a-z0-9]{6,16})(\/vote)?$/.exec(path);
  if (!m) return undefined;
  if (!m[2] && req.method === 'GET') return getTogether(m[1], userId, env.DB);
  if (m[2] && req.method === 'PUT') return voteTogether(req, m[1], userId, env.DB);
  return undefined;
}
