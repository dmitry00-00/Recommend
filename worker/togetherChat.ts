// «Что посмотреть вместе» в чатах (19.10, решение владельца): подбор по вкусу (worker/togetherPick.ts) сразу списком,
// без голосования.
//
// Личный чат (inline_query.chat_type === 'private'; бот собеседника не знает): «@recomend_media_bot» пустым запросом или
// «вместе» → первым результатом «Что посмотреть вдвоём». В чат уходит сообщение с кнопкой «Показать». Нажал собеседник —
// считаем подбор на двоих и правим то же сообщение (по inline_message_id) в список из 3–5 фильмов: название, год, строка о
// фильме и кнопка, открывающая карточку в приложении (`startapp=`, как у «Поделиться»). Нажал сам отправитель — «пусть
// нажмёт собеседник». У собеседника нет истории или он не в боте — сообщение становится приглашением открыть приложение и
// оценить несколько фильмов, а «Показать» остаётся.
//
// Группа: «/together @anya @lyosha» обычным сообщением — там работает штатный список участников Telegram по «@». Ники —
// из entities `mention`, люди без ника — `text_mention` (по id). Ответ — тот же список и кнопка «Голосовать»: она превращает
// сообщение в голосование в чате (worker/inlinePoll.ts). В инлайне в группе пустой запрос показывает подсказку про /together.
//
// Данные кнопок клиент может подделать (Bot API: «the message originated the query can contain no callback buttons with
// this data»), поэтому то, что бот кладёт в кнопку сам, — с подписью от токена бота (tgSign).
import type { Env } from './env';
import { bot } from './env';
import { tg, tgSign } from './tg';
import { inlineIndex, lookupIn } from './inlineIndex';
import { savePoll, type CallbackQuery } from './inlinePoll';
import { companyPick, MIN_RATED, MIN_RATED_PAIR, type PickFilm } from './togetherPick';

export type Lang = 'ru' | 'en';
const RU_READERS = /^(?:ru|uk|be|kk|ky|uz|tg|hy|az|ka)\b/i;
export const langOf = (code?: string | null): Lang => (!code || RU_READERS.test(code) ? 'ru' : 'en');
/** вариантов в сообщении */
export const LIST = 5;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const app = (param?: string) => `https://t.me/${bot.name}?startapp${param ? `=${param}` : ''}`;

export const CHAT_T = {
  ru: {
    kind: { film: 'Фильм', series: 'Сериал' },
    pairTitle: 'Что посмотреть вдвоём',
    pairDesc: 'Подбор по вкусу обоих — без того, что кто-то уже видел',
    pairAsk: '<b>Что посмотреть вдвоём?</b>\nБот подберёт фильмы по вкусу обоих и уберёт то, что кто-то уже видел. Нажмите «Показать».',
    show: 'Показать',
    self: 'Пусть нажмёт собеседник',
    stale: 'Кнопка устарела',
    ownerOff: (n: number) => `У отправителя пока меньше ${n} оценок — подбор недоступен`,
    pairHead: 'Что посмотреть вдвоём',
    groupHead: 'Что посмотреть вместе',
    invite: '<b>Что посмотреть вдвоём?</b>\nЧтобы подобрать на двоих, откройте приложение и оцените несколько фильмов — потом снова нажмите «Показать».',
    inviteToast: 'Сначала оцените несколько фильмов в приложении',
    openApp: 'Открыть приложение',
    empty: '<b>Что посмотреть вдвоём?</b>\nОбщего пока не нашлось — оцените ещё несколько фильмов или добавьте в планы и нажмите «Показать» снова.',
    old: (names: string[]) => `${names.join(', ')}: подбор пока по старой истории — откройте приложение, станет точнее.`,
    missing: (names: string[]) => `${names.join(', ')} не открывали приложение.`,
    blank: (names: string[]) => `${names.join(', ')} ещё ничего не оценили.`,
    vote: 'Голосовать',
    hintTitle: 'Подборка для компании',
    hintDesc: 'Напишите /together и отметьте людей через @',
    hintText: `<b>Что смотрим компанией?</b>\nНапишите /together и отметьте друзей через @ — например, <code>/together @anya @lyosha</code>. Подберу то, что понравится всем, без виденного.`,
    not_in_bot: 'Сначала откройте приложение — подбор идёт и по вашему вкусу.',
    no_history: `Сначала оцените ${MIN_RATED} фильмов в приложении — подбор идёт и по вашему вкусу.`,
    nobody: (m: string[]) => (m.length ? `${m.join(', ')} не открывали приложение — позовите их и повторите /together.` : 'Отметьте друзей через @: /together @ник @ник'),
    emptyGroup: 'Общего пока нет — оцените ещё фильмы или добавьте их в планы.',
  },
  en: {
    kind: { film: 'Film', series: 'Series' },
    pairTitle: 'What to watch together',
    pairDesc: "Picked for both of your tastes — nothing either has seen",
    pairAsk: "<b>What should we watch?</b>\nThe bot will pick films for both of your tastes and drop anything either of you has seen. Tap “Show”.",
    show: 'Show',
    self: 'Let the other person tap it',
    stale: 'This button has expired',
    ownerOff: (n: number) => `The sender has fewer than ${n} ratings — picks aren't available yet`,
    pairHead: 'What to watch together',
    groupHead: 'What to watch together',
    invite: '<b>What should we watch?</b>\nTo pick for both of you, open the app and rate a few films — then tap “Show” again.',
    inviteToast: 'Rate a few films in the app first',
    openApp: 'Open the app',
    empty: '<b>What should we watch?</b>\nNothing in common yet — rate a few more films or add some to your plans, then tap “Show” again.',
    old: (names: string[]) => `${names.join(', ')}: picks are from older history for now — open the app to sharpen them.`,
    missing: (names: string[]) => `${names.join(', ')} haven't opened the app.`,
    blank: (names: string[]) => `${names.join(', ')} haven't rated anything yet.`,
    vote: 'Vote',
    hintTitle: 'Picks for a group',
    hintDesc: 'Send /together and tag people with @',
    hintText: `<b>What are we watching?</b>\nSend /together and tag your friends with @ — e.g. <code>/together @anya @lyosha</code>. I'll pick what everyone will like, minus what anyone has seen.`,
    not_in_bot: 'Open the app first — your taste counts too.',
    no_history: `Rate ${MIN_RATED} films in the app first — your taste counts too.`,
    nobody: (m: string[]) => (m.length ? `${m.join(', ')} haven't opened the app — invite them and send /together again.` : 'Tag your friends with @: /together @nick @nick'),
    emptyGroup: 'Nothing in common yet — rate more films or add some to your plans.',
  },
};

// ─── вид списка ───────────────────────────────────────────────────────────────

/** Строка о фильме: присланная клиентом (о чём он, не «почему вам»), иначе вид и режиссёр из справочника. */
const lineOf = (f: PickFilm, lang: Lang) => f.a || [CHAT_T[lang].kind[f.k ?? 'film'], f.s].filter(Boolean).join(' · ');

export function pickText(films: PickFilm[], lang: Lang, head: string, notes: string[] = []): string {
  const items = films.slice(0, LIST).map((f, i) => `${i + 1}. <b>${esc(f.t)}</b>${f.y ? ` (${f.y})` : ''}\n${esc(lineOf(f, lang))}`);
  return [`<b>${esc(head)}</b>`, ...items, ...(notes.length ? [notes.map((n) => `<i>${esc(n)}</i>`).join('\n')] : [])].join('\n\n');
}

/** У каждого фильма — кнопка-ссылка на его карточку в приложении; `vote` — данные кнопки «Голосовать». */
export function pickKeyboard(films: PickFilm[], lang: Lang, vote?: string) {
  const rows: Record<string, string>[][] = films.slice(0, LIST).map((f, i) => [{ text: `${i + 1}. ${f.t}${f.y ? ` (${f.y})` : ''}`.slice(0, 60), url: app(f.p) }]);
  if (vote) rows.push([{ text: CHAT_T[lang].vote, callback_data: vote }]);
  return { inline_keyboard: rows };
}

/** Пометки под списком: кого нет в боте, кто ничего не оценил, у кого подбор по старой истории. */
function notesOf(r: { me: string; missing: string[]; blank: string[]; old: string[]; meOld: boolean }, lang: Lang): string[] {
  const T = CHAT_T[lang];
  // сообщение видят все в чате — и про спросившего пишем по нику, а не «у вас»
  const old = [...(r.meOld ? [r.me] : []), ...r.old];
  return [...(r.missing.length ? [T.missing(r.missing)] : []), ...(r.blank.length ? [T.blank(r.blank)] : []), ...(old.length ? [T.old(old)] : [])];
}

const voteData = async (env: Env, id: string) => `tv:${id}:${await tgSign(env.BOT_TOKEN!, `tv:${id}`)}`;

// ─── личный чат: «Что посмотреть вдвоём» ──────────────────────────────────────

async function pairData(env: Env, owner: number, lang: Lang): Promise<string> {
  const base = `pr:${owner}:${lang === 'en' ? 'e' : 'r'}`;
  return `${base}:${await tgSign(env.BOT_TOKEN!, base)}`;
}

/** Может ли этот человек позвать собеседника: он в боте и оценил не меньше MIN_RATED_PAIR (19.10: ниже, чем в группе). */
export async function pairReady(env: Env, tgId: number): Promise<'ok' | 'not_in_bot' | 'no_history'> {
  const me = await env.DB.prepare('SELECT id FROM user WHERE tg_id = ?').bind(tgId).first<{ id: string }>();
  if (!me) return 'not_in_bot';
  const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM rating WHERE user_id = ?').bind(me.id).first<{ n: number }>();
  return Number(n?.n ?? 0) >= MIN_RATED_PAIR ? 'ok' : 'no_history';
}

const showRow = async (env: Env, owner: number, lang: Lang) => [{ text: CHAT_T[lang].show, callback_data: await pairData(env, owner, lang) }];

export async function pairArticle(env: Env, owner: number, lang: Lang) {
  const T = CHAT_T[lang];
  return {
    type: 'article', id: `pair-${owner}`.slice(0, 64), title: T.pairTitle, description: T.pairDesc,
    input_message_content: { message_text: T.pairAsk, parse_mode: 'HTML', link_preview_options: { is_disabled: true } },
    reply_markup: { inline_keyboard: [await showRow(env, owner, lang)] },
  };
}

/** Подсказка в инлайне группы: подбор по никам — командой, где работает список участников по «@». */
export function groupHintArticle(lang: Lang) {
  const T = CHAT_T[lang];
  return {
    type: 'article', id: `company-hint-${lang}`, title: T.hintTitle, description: T.hintDesc,
    input_message_content: { message_text: T.hintText, parse_mode: 'HTML', link_preview_options: { is_disabled: true } },
  };
}

/** Нажатие «Показать» под «Что посмотреть вдвоём». true — нажатие наше. */
export async function pairPress(env: Env, cb: CallbackQuery): Promise<boolean> {
  const m = /^pr:(\d{1,16}):([re]):([0-9a-f]{12})$/.exec(cb.data ?? '');
  if (!m) return false;
  const toast = CHAT_T[langOf(cb.from.language_code)];
  const answer = (text?: string) => tg(env, 'answerCallbackQuery', { callback_query_id: cb.id, ...(text ? { text } : {}) });
  if (!env.BOT_TOKEN || m[3] !== await tgSign(env.BOT_TOKEN, `pr:${m[1]}:${m[2]}`) || !cb.inline_message_id) { await answer(toast.stale); return true; }
  const owner = Number(m[1]);
  if (cb.from.id === owner) { await answer(toast.self); return true; }
  const lang: Lang = m[2] === 'e' ? 'en' : 'ru';
  const T = CHAT_T[lang];
  const r = await companyPick(env, owner, { tgIds: [cb.from.id] }, lookupIn(await inlineIndex(env)), LIST, MIN_RATED_PAIR);
  const edit = (text: string, rows: Record<string, string>[][]) => tg(env, 'editMessageText', {
    inline_message_id: cb.inline_message_id, text, parse_mode: 'HTML', link_preview_options: { is_disabled: true }, reply_markup: { inline_keyboard: rows } });
  if ('error' in r && (r.error === 'not_in_bot' || r.error === 'no_history')) { await answer(toast.ownerOff(MIN_RATED_PAIR)); return true; }
  // собеседника нет в боте или у него нет никакой истории — приглашение; «Показать» остаётся
  if (('error' in r && r.error === 'nobody') || r.blank?.length) {
    await Promise.all([answer(toast.inviteToast), edit(T.invite, [[{ text: T.openApp, url: app() }], await showRow(env, owner, lang)])]);
    return true;
  }
  if ('error' in r) {
    await Promise.all([answer(), edit(T.empty, [await showRow(env, owner, lang), [{ text: T.openApp, url: app() }]])]);
    return true;
  }
  await Promise.all([answer(), edit(pickText(r.films, lang, T.pairHead, notesOf(r, lang)), pickKeyboard(r.films, lang).inline_keyboard)]);
  return true;
}

// ─── группа: «/together @anya @lyosha» ────────────────────────────────────────

export interface Entity { type: string; offset: number; length: number; user?: { id: number; first_name?: string; is_bot?: boolean } }

/** Участники из упоминаний в команде: `mention` — ник (без @, строчными), `text_mention` — человек без ника, по id.
 *  Ботов (и самого себя) не берём. Смещения Telegram — в UTF-16, как и индексы строк JS. */
export function commandMentions(text: string, entities: Entity[] = []): { nicks: string[]; ids: number[] } {
  const nicks = new Set<string>();
  const ids = new Set<number>();
  for (const e of entities) {
    if (e.type === 'mention') {
      const nick = text.slice(e.offset, e.offset + e.length).replace(/^@/, '').toLowerCase();
      if (/^[a-z0-9_]{3,32}$/.test(nick) && nick !== bot.name.toLowerCase()) nicks.add(nick);
    } else if (e.type === 'text_mention' && e.user && !e.user.is_bot && Number.isSafeInteger(e.user.id)) ids.add(e.user.id);
  }
  return { nicks: [...nicks].slice(0, 9), ids: [...ids].slice(0, 9) };
}

export interface MentionMessage { message_id: number; chat: { id: number }; from?: { id: number; language_code?: string } }

/** Ответ на «/together @…»: список подбора (с «Голосовать») или подсказка, чего не хватает. */
export async function togetherMentions(env: Env, m: MentionMessage, who: { nicks: string[]; ids: number[] }): Promise<boolean> {
  if (!m.from) return false;
  const lang = langOf(m.from.language_code);
  const T = CHAT_T[lang];
  const r = await companyPick(env, m.from.id, { nicks: who.nicks, tgIds: who.ids }, lookupIn(await inlineIndex(env)), LIST);
  const base = { chat_id: m.chat.id, reply_parameters: { message_id: m.message_id, allow_sending_without_reply: true }, link_preview_options: { is_disabled: true } };
  if ('error' in r) {
    const text = r.error === 'nobody' ? T.nobody(r.missing) : r.error === 'empty' ? T.emptyGroup : T[r.error];
    return (await tg(env, 'sendMessage', { ...base, text, reply_markup: { inline_keyboard: [[{ text: T.openApp, url: app() }]] } })).ok;
  }
  const films = r.films.slice(0, LIST);
  const vote = films.length >= 2 ? await voteData(env, await savePoll(env, films, m.from.id, lang)) : undefined;
  return (await tg(env, 'sendMessage', { ...base, text: pickText(films, lang, T.groupHead, notesOf(r, lang)), parse_mode: 'HTML',
    reply_markup: pickKeyboard(films, lang, vote) })).ok;
}
