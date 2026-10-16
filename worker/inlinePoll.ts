// Голосование прямо в чате (15.10): «@recomend_media_bot вместе» в любом чате — до десяти фильмов из своей последней
// подборки «Выбрать вместе» (ЗП-11), «@recomend_media_bot вместе Интерстеллар, 1+1, Пленницы» — из названных. В чат
// уходит список с номерами и кнопками 1…N; тап — «хочу» этому фильму (можно несколько), повторный — снять. Бот сам
// перерисовывает сообщение: счёт и имена. Ни приложение открывать, ни бота в группу добавлять не нужно.
//
// Подборка (фильмы) хранится по своему ключу, голоса — по сообщению: у отправленного из инлайна сообщения свой
// `inline_message_id`, поэтому одна и та же подборка, отправленная в два чата, голоса не смешивает. Имена
// голосовавших видны только в этом чате — их там и так видно; живут голоса 30 дней.
import type { Env } from './env';
import { bot } from './env';

export interface PollFilm { t: string; y?: number; i?: string }
type Lang = 'ru' | 'en';
const MAX = 10;
const KEEP_DAYS = 30;
const TRIGGER = /^(?:вместе|голосуем|голосование|выбираем|together|vote)(?=$|[\s,:;—-])[\s,:;—-]*/i;

/** Запрос голосования: остаток после слова-триггера (может быть пустым) или undefined — запрос не наш. */
export const pollQuery = (q: string): string | undefined => {
  const m = TRIGGER.exec(q.trim());
  return m ? q.trim().slice(m[0].length) : undefined;
};

/** Названия через запятую, точку с запятой или с новой строки: «+» не делим — «1+1» тоже название. */
export const pollTitles = (rest: string): string[] => rest.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean).slice(0, MAX);

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const T = {
  ru: {
    head: 'Что смотрим? Жмите номера — можно несколько, повторный тап снимает голос.',
    title: (n: number) => `Голосуем в чате: ${n} ${n < 5 ? 'фильма' : 'фильмов'}`,
    app: 'Открыть в приложении',
    voted: (t: string) => `Голос: ${t}`, unvoted: (t: string) => `Голос снят: ${t}`, stale: 'Голосование устарело',
    nobody: 'Пока никто не голосовал', lead: 'впереди',
  },
  en: {
    head: 'What are we watching? Tap the numbers — several are fine, tap again to take a vote back.',
    title: (n: number) => `Vote in the chat: ${n} films`,
    app: 'Open in the app',
    voted: (t: string) => `Voted: ${t}`, unvoted: (t: string) => `Vote removed: ${t}`, stale: 'This vote has expired',
    nobody: 'No votes yet', lead: 'leading',
  },
};

async function pollId(films: PollFilm[], owner: number): Promise<string> {
  const key = `${owner}|${films.map((f) => `${f.t}|${f.y ?? ''}`).join('||')}`;
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
  return [...new Uint8Array(d)].slice(0, 6).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Текст сообщения: номер, название, год, сколько «хочу» и чьих; лидер (лидеры) — жирным. */
export function pollText(films: PollFilm[], votes: { idx: number; name: string }[], lang: Lang): string {
  const by = films.map((_, i) => votes.filter((v) => v.idx === i).map((v) => v.name));
  const top = Math.max(0, ...by.map((n) => n.length));
  const lines = films.map((f, i) => {
    const name = `${esc(f.t)}${f.y ? ` (${esc(String(f.y))})` : ''}`; // год тоже из карточки — экранируем (ХБ, 16.10)
    const who = by[i].length ? ` — ${by[i].length}: ${esc(by[i].slice(0, 5).join(', '))}${by[i].length > 5 ? ` +${by[i].length - 5}` : ''}` : '';
    return `${i + 1}. ${top && by[i].length === top ? `<b>${name}</b>` : name}${who}`;
  });
  return [T[lang].head, '', ...lines, ...(votes.length ? [] : ['', T[lang].nobody])].join('\n');
}

export function pollKeyboard(id: string, n: number, lang: Lang, session?: string) {
  const nums = Array.from({ length: n }, (_, i) => ({ text: String(i + 1), callback_data: `tp:${id}:${i}` }));
  const rows = [];
  for (let i = 0; i < nums.length; i += 5) rows.push(nums.slice(i, i + 5));
  rows.push([{ text: T[lang].app, url: `https://t.me/${bot.name}?startapp${session ? `=t-${session}` : ''}` }]);
  return { inline_keyboard: rows };
}

/** Результат инлайна: одна статья-голосование. Подборка пишется сразу (ключ — от состава и автора: повторный запрос
 *  тем же составом даёт тот же ключ); голосов у неё нет, пока сообщение не отправлено. */
export async function pollResult(env: Env, films: PollFilm[], owner: number, lang: Lang, session?: string,
  label?: { title?: string; note?: string }) {
  const list = films.slice(0, MAX);
  const id = await pollId(list, owner);
  const old = new Date(Date.now() - KEEP_DAYS * 864e5).toISOString();
  await env.DB.batch([
    env.DB.prepare('DELETE FROM inline_vote WHERE at < ?').bind(old),
    env.DB.prepare('DELETE FROM inline_poll WHERE created_at < ?').bind(old),
    env.DB.prepare('INSERT OR IGNORE INTO inline_poll (id, owner_tg, films, lang, session_id, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(id, owner, JSON.stringify(list), lang, session ?? null, new Date().toISOString()),
  ]);
  const thumb = list.find((f) => f.i)?.i;
  return {
    type: 'article', id: `poll-${id}`, title: label?.title ?? T[lang].title(list.length),
    description: [label?.note, list.map((f) => f.t).join(' · ')].filter(Boolean).join(' — ').slice(0, 200),
    ...(thumb ? { thumbnail_url: thumb } : {}),
    input_message_content: { message_text: pollText(list, [], lang), parse_mode: 'HTML', link_preview_options: { is_disabled: true } },
    reply_markup: pollKeyboard(id, list.length, lang, session),
  };
}

/** Последняя подборка «Выбрать вместе» этого человека за неделю — до десяти фильмов. */
export async function lastDeck(env: Env, tgId: number): Promise<{ films: PollFilm[]; session: string } | undefined> {
  const row = await env.DB.prepare(`SELECT t.id, t.deck FROM together t JOIN user u ON u.id = t.user_id
    WHERE u.tg_id = ? AND t.created_at > ? ORDER BY t.created_at DESC LIMIT 1`)
    .bind(tgId, new Date(Date.now() - 7 * 864e5).toISOString()).first<{ id: string; deck: string }>();
  if (!row) return undefined;
  const deck = JSON.parse(row.deck) as { title: string; year?: number; image?: string }[];
  return { films: deck.slice(0, MAX).map((c) => ({ t: c.title, ...(c.year ? { y: c.year } : {}), ...(c.image ? { i: c.image } : {}) })), session: row.id };
}

export interface CallbackQuery {
  id: string; data?: string; inline_message_id?: string;
  from: { id: number; first_name?: string; username?: string; language_code?: string };
  message?: { message_id: number; chat: { id: number } };
}

const api = (env: Env, method: string, body: unknown) => fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
}).catch((err) => { console.error(method, err); return undefined; });

/** Тап по номеру: «хочу» или снять, перерисовать сообщение. true — нажатие наше. */
export async function pollVote(env: Env, cb: CallbackQuery): Promise<boolean> {
  const m = /^tp:([0-9a-f]{12}):(\d{1,2})$/.exec(cb.data ?? '');
  if (!m) return false;
  const [, id, raw] = m;
  const idx = Number(raw);
  const poll = await env.DB.prepare('SELECT films, lang, session_id FROM inline_poll WHERE id = ?').bind(id)
    .first<{ films: string; lang: string | null; session_id: string | null }>();
  const lang: Lang = poll?.lang === 'en' ? 'en' : 'ru';
  const films = poll ? (JSON.parse(poll.films) as PollFilm[]) : [];
  if (!poll || idx >= films.length) { await api(env, 'answerCallbackQuery', { callback_query_id: cb.id, text: T[lang].stale }); return true; }
  const msg = cb.inline_message_id ?? (cb.message ? `${cb.message.chat.id}:${cb.message.message_id}` : undefined);
  if (!msg) return true;
  const name = (cb.from.first_name || (cb.from.username ? `@${cb.from.username}` : '…')).slice(0, 40);
  const had = await env.DB.prepare('SELECT 1 AS x FROM inline_vote WHERE msg = ? AND tg_id = ? AND idx = ?').bind(msg, cb.from.id, idx).first();
  if (had) await env.DB.prepare('DELETE FROM inline_vote WHERE msg = ? AND tg_id = ? AND idx = ?').bind(msg, cb.from.id, idx).run();
  else await env.DB.prepare('INSERT INTO inline_vote (msg, poll_id, tg_id, name, idx, at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(msg, id, cb.from.id, name, idx, new Date().toISOString()).run();
  const votes = (await env.DB.prepare('SELECT idx, name FROM inline_vote WHERE msg = ? ORDER BY at').bind(msg).all<{ idx: number; name: string }>()).results ?? [];
  await api(env, 'answerCallbackQuery', { callback_query_id: cb.id, text: (had ? T[lang].unvoted : T[lang].voted)(films[idx].t) });
  const where = cb.inline_message_id ? { inline_message_id: cb.inline_message_id } : { chat_id: cb.message!.chat.id, message_id: cb.message!.message_id };
  await api(env, 'editMessageText', { ...where, text: pollText(films, votes, lang), parse_mode: 'HTML', link_preview_options: { is_disabled: true },
    reply_markup: pollKeyboard(id, films.length, lang, poll.session_id ?? undefined) });
  return true;
}
