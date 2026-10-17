// Инлайн-режим бота (06.10): «@recomend_media_bot тирион» в любом чате → карточки героев, фильмов,
// сериалов и книг; выбранная уходит в чат сообщением с кнопкой, которая открывает мини-приложение
// на этой карточке (`?startapp=`, как у «Поделиться»). Переписку бот не видит — только текст запроса.
//
// Telegram шлёт события на POST /api/telegram (адрес ставит tools/tg-webhook.mts по слову владельца).
// Свой ли это запрос, проверяем заголовком `X-Telegram-Bot-Api-Secret-Token`: секрет выводится из
// токена бота (`webhookSecret`), отдельной переменной на bothost заводить не нужно.
// Ищем по справочнику `inlineIndex` (tools/inline-index.mts → publish-reference), он держится в памяти.
import type { Env } from './env';
import { bot } from './env';
import { withRef } from './invite';
import { togetherCommand, type ChatMessage } from './together';
import { lastDeck, pollQuery, pollResult, pollTitles, pollVote, type CallbackQuery, type PollFilm } from './inlinePoll';
import { GROUP_T, groupPick, groupQuery, type Known } from './inlineGroup';
import { tg } from './tg';

interface Entry { p: string; k: 'film' | 'series' | 'book' | 'character'; t: string; o?: string; y?: number; s?: string; a?: string[]; i?: string; r?: number }
interface InlineQuery { id: string; query: string; from?: { id: number; language_code?: string } }

const LIMIT = 20;
// язык ответа (11.10, один бот для всех языков): инлайн — по языку Telegram спросившего, карточка — по языку приложения
type Lang = 'ru' | 'en';
const RU_READERS = /^(?:ru|uk|be|kk|ky|uz|tg|hy|az|ka)\b/i;
const langOf = (code?: string): Lang => (!code || RU_READERS.test(code) ? 'ru' : 'en');
const KINDS: Record<Lang, Record<Entry['k'], string>> = {
  ru: { film: 'Фильм', series: 'Сериал', book: 'Книга', character: 'Герой' },
  en: { film: 'Film', series: 'Series', book: 'Book', character: 'Character' },
};
const BUTTON: Record<Lang, { work: string; character: string; together: string }> = {
  ru: { work: 'Открыть карточку', character: 'Открыть героя', together: 'Голосовать' },
  en: { work: 'Open card', character: 'Open character', together: 'Vote' },
};

export async function webhookSecret(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`tm-webhook:${token}`));
  return [...new Uint8Array(digest)].slice(0, 24).map((b) => b.toString(16).padStart(2, '0')).join('');
}

let cache: { at: number; list: Entry[]; keys: string[][]; byId?: Map<string, Entry> } | undefined;
const norm = (s: string) => s.normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

async function index(env: Env): Promise<typeof cache> {
  if (cache && Date.now() - cache.at < 10 * 60e3) return cache;
  const object = await env.REFERENCE?.get('inlineIndex.json');
  if (!object) return cache;
  const list = JSON.parse(await new Response(object.body).text()) as Entry[];
  cache = { at: Date.now(), list, keys: list.map((e) => [e.t, e.o, ...(e.a ?? [])].filter((x): x is string => Boolean(x)).map(norm)) };
  return cache;
}

/** Поиск: точный параметр (кнопка «В чат» в приложении шлёт его как запрос), затем совпадение
 *  названия целиком, с начала, с начала слова. Герои и то, о чём больше говорят, — выше. */
export function search(idx: NonNullable<typeof cache>, raw: string): Entry[] {
  const q = norm(raw);
  if (!q) return [];
  const exact = idx.list.find((e) => e.p === raw.trim());
  if (exact) return [exact];
  const scored: [number, Entry][] = [];
  idx.list.forEach((e, i) => {
    let best = 0;
    for (const k of idx.keys[i]) {
      if (k === q) best = Math.max(best, 3);
      else if (k.startsWith(q)) best = Math.max(best, 2);
      else if (k.includes(` ${q}`)) best = Math.max(best, 1);
    }
    if (best) scored.push([best * 1000 + (e.k === 'character' ? 200 : 0) + Math.min(e.r ?? 0, 199) - Math.min(e.t.length, 99) / 100, e]);
  });
  return scored.sort((a, b) => b[0] - a[0]).slice(0, LIMIT).map(([, e]) => e);
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Картинка крупно (15.10): постер или фото героя — превью над текстом сообщения, без него карточка в чате читалась
 *  сухо. Результат остаётся статьёй, а не фото: фото Telegram показывает в выборе плиткой без названий, и два
 *  «Интерстеллара» не различить. У TMDb — постер крупнее, чем миниатюра в списке. */
const bigImage = (url?: string) => (url && IMAGE_HOSTS.test(url) ? url.replace(/(image\.tmdb\.org\/t\/p\/)w\d+\//, '$1w500/') : undefined);

function result(e: Entry, lang: Lang = 'ru') {
  const head = `${e.t}${e.y ? ` (${e.y})` : ''}`;
  const line = [KINDS[lang][e.k], e.o, e.s].filter(Boolean).join(' · ');
  const big = bigImage(e.i);
  return {
    type: 'article', id: e.p, title: head, description: line,
    ...(e.i ? { thumbnail_url: e.i } : {}),
    input_message_content: { message_text: `<b>${esc(head)}</b>\n${esc(line)}`, parse_mode: 'HTML',
      link_preview_options: big ? { url: big, prefer_large_media: true, show_above_text: true } : { is_disabled: true } },
    reply_markup: { inline_keyboard: [[{ text: e.k === 'character' ? BUTTON[lang].character : BUTTON[lang].work, url: `https://t.me/${bot.name}?startapp=${e.p}` }]] },
  };
}

const POLL_HINT: Record<Lang, string> = { ru: 'Собрать подборку — или перечислите фильмы через запятую', en: 'Pick films — or list them separated by commas' };

/** «вместе …» — голосование в чате (worker/inlinePoll.ts): названные фильмы или последняя своя подборка. Меньше двух —
 *  результатов нет, вместо них кнопка в личку с ботом: там та же команда, что /together. */
async function answerPoll(env: Env, q: InlineQuery, rest: string, idx: typeof cache, lang: Lang): Promise<void> {
  let films: PollFilm[] = [];
  let session: string | undefined;
  const titles = pollTitles(rest);
  if (titles.length && idx) {
    const seen = new Set<string>();
    for (const t of titles) {
      const e = search(idx, t).find((x) => (x.k === 'film' || x.k === 'series') && !seen.has(x.p));
      if (e) { seen.add(e.p); films.push({ t: e.t, ...(e.y ? { y: e.y } : {}), ...(e.i ? { i: e.i } : {}) }); }
    }
  } else if (q.from) {
    const deck = await lastDeck(env, q.from.id);
    if (deck) ({ films, session } = deck);
  }
  const results = films.length >= 2 && q.from ? [await pollResult(env, films, q.from.id, lang, session)] : [];
  await tg(env, 'answerInlineQuery', { inline_query_id: q.id, results, cache_time: 0, is_personal: true,
    ...(results.length ? {} : { button: { text: POLL_HINT[lang], start_parameter: 'together' } }) });
}

/** «для @anya @lyosha» — подбор компании (worker/inlineGroup.ts) тем же голосованием. Не вышло — без результатов, с
 *  подсказкой на кнопке (она ведёт в личку с ботом). */
async function answerGroup(env: Env, q: InlineQuery, nicks: string[], idx: typeof cache, lang: Lang): Promise<void> {
  const T = GROUP_T[lang];
  let results: unknown[] = [];
  let hint: string = T.nobody([]);
  if (q.from) {
    if (idx && !idx.byId) idx.byId = new Map(idx.list.map((e) => [e.p, e]));
    const lookup = (workId: string): Known | undefined => {
      const e = idx?.byId?.get(`w-${workId.replace(':', '_')}`);
      return e && { t: e.t, k: e.k, ...(e.y ? { y: e.y } : {}), ...(e.i ? { i: e.i } : {}) };
    };
    const r = await groupPick(env, q.from.id, nicks, lookup);
    if ('films' in r) {
      results = [await pollResult(env, r.films, q.from.id, lang, undefined,
        { title: T.title(r.names), ...(r.missing.length ? { note: T.missing(r.missing) } : {}) })];
    } else hint = r.error === 'nobody' ? T.nobody(r.missing) : T[r.error];
  }
  await tg(env, 'answerInlineQuery', { inline_query_id: q.id, results, cache_time: 0, is_personal: true,
    ...(results.length ? {} : { button: { text: hint, start_parameter: 'together' } }) });
}

async function answer(env: Env, q: InlineQuery): Promise<void> {
  const idx = await index(env);
  const lang = langOf(q.from?.language_code);
  const nicks = groupQuery(q.query);
  if (nicks) return answerGroup(env, q, nicks, idx, lang);
  const rest = pollQuery(q.query);
  if (rest !== undefined) return answerPoll(env, q, rest, idx, lang);
  const found = idx ? search(idx, q.query) : [];
  // is_personal (ХБ, 17.10): подписи — на языке спрашивающего, общий кеш Telegram отдавал бы их другим
  await tg(env, 'answerInlineQuery', { inline_query_id: q.id, results: found.map((e) => result(e, lang)), cache_time: 300, is_personal: true });
}

/** Событие от Telegram. Отвечаем 200 всегда, кроме чужого секрета: иначе Telegram будет повторять.
 *  17.10 (аудит отказов, п. 7): повтор того же update_id (Telegram шлёт снова, если не дождался ответа) — сразу 200, без
 *  обработки: иначе голос в чате ставился и тут же снимался, сообщения уходили дважды. Любая ошибка внутри (битый
 *  inlineIndex.json, база) — в журнал и всё равно 200: на 500 Telegram повторял бы апдейт вечно и копил очередь. */
export async function telegramUpdate(req: Request, env: Env): Promise<Response> {
  if (!env.BOT_TOKEN) return new Response('no bot', { status: 503 });
  if (req.headers.get('x-telegram-bot-api-secret-token') !== await webhookSecret(env.BOT_TOKEN)) return new Response('forbidden', { status: 403 });
  try {
    const update = (await req.json().catch(() => ({}))) as { update_id?: number; inline_query?: InlineQuery; message?: ChatMessage; callback_query?: CallbackQuery };
    if (typeof update.update_id === 'number') {
      // строки старше двух суток чистит периодический тик (worker/index.ts, scheduled)
      const seen = await env.DB.prepare('INSERT OR IGNORE INTO tg_update (update_id, at) VALUES (?, ?)').bind(update.update_id, new Date().toISOString()).run();
      if (seen.meta?.changes === 0) return new Response('ok');
    }
    if (update.inline_query) await answer(env, update.inline_query);
    // тап по номеру в голосовании в чате (15.10)
    if (update.callback_query) await pollVote(env, update.callback_query).catch((err) => console.error('poll vote', err));
    // «/together» в чате — выбор компанией (ЗП-11, 11.10)
    if (update.message) await togetherCommand(env, update.message).catch((err) => console.error('together command', err));
  } catch (err) {
    console.error('telegram update:', (err as Error)?.stack ?? err);
  }
  return new Response('ok');
}

/** Подключение адреса событий (tools/tg-webhook.mts, по ADMIN_TOKEN): сервер сам зовёт Telegram своим
 *  токеном — на Mac токен бота не нужен. `info` — что стоит сейчас, `set` — поставить `url` (адрес
 *  /api/telegram этого сервера) для инлайн-запросов и сообщений (команда /together, 11.10), `delete` — снять. */
export async function adminWebhook(req: Request, env: Env): Promise<Response> {
  if (!env.BOT_TOKEN) return Response.json({ error: 'no_bot_token' }, { status: 503 });
  const b = (await req.json().catch(() => ({}))) as { action?: string; url?: string };
  const api = (method: string, body?: unknown) => tg(env, method, body);
  if (b.action === 'set') {
    if (!b.url || !/^https:\/\/[^/]+\/api\/telegram$/.test(b.url)) return Response.json({ error: 'url' }, { status: 400 });
    // только на этот же сервер (ХБ, 16.10): вебхук на чужой хост отдал бы ему все апдейты бота и секрет вебхука.
    // 17.10: свой адрес — только из PUBLIC_ORIGIN; Host запроса ставит тот же, кто шлёт запрос, сверять с ним нельзя
    const origin = env.PUBLIC_ORIGIN?.trim();
    if (!origin) return Response.json({ error: 'no_public_origin', hint: 'задайте PUBLIC_ORIGIN=https://<адрес сервера> в панели bothost' }, { status: 503 });
    let ownHost = '';
    try { ownHost = new URL(origin).host; } catch { return Response.json({ error: 'bad_public_origin' }, { status: 503 }); }
    if (!ownHost || new URL(b.url).host !== ownHost) return Response.json({ error: 'url_host' }, { status: 400 });
    const hook = await api('setWebhook', { url: b.url, secret_token: await webhookSecret(env.BOT_TOKEN), allowed_updates: ['inline_query', 'message', 'callback_query'], drop_pending_updates: true });
    // команда /together — в подсказках Telegram, в группах и в личке (ЗП-11, 11.10)
    const commands = [{ command: 'together', description: 'Выбрать фильм вместе' }];
    const en = [{ command: 'together', description: 'Pick a film together' }];
    await api('setMyCommands', { commands });
    await api('setMyCommands', { commands: en, language_code: 'en' });
    await api('setMyCommands', { commands, scope: { type: 'all_group_chats' } });
    await api('setMyCommands', { commands: en, scope: { type: 'all_group_chats' }, language_code: 'en' });
    return Response.json(hook);
  }
  if (b.action === 'delete') return Response.json(await api('deleteWebhook', { drop_pending_updates: true }));
  const info = (await api('getWebhookInfo')) as { result?: Record<string, unknown> };
  const me = (await api('getMe')) as { result?: { username?: string; supports_inline_queries?: boolean } };
  return Response.json({ webhook: info.result, bot: me.result?.username, inline: me.result?.supports_inline_queries ?? false });
}

// ─── «Поделиться» карточкой-сообщением (06.10) ────────────────────────────────
// Мини-приложение просит сервер подготовить сообщение (savePreparedInlineMessage, Bot API 8.0), а
// потом открывает штатный выбор чата Telegram (`WebApp.shareMessage(id)`). В чат уходит постер или
// фото героя, название, одна строка о произведении и кнопка, открывающая карточку у получателя.
// Картинка — только с известных адресов: иначе через бота можно было бы разослать что угодно.
import { IMAGE_HOSTS } from './hosts';
const clip = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '');

export interface ShareCard { param: string; title: string; year?: number; kind?: Entry['k'] | 'together'; by?: string; about?: string; image?: string; lang?: Lang }

export function shareResult(c: ShareCard) {
  const head = `${c.title}${c.year ? ` (${c.year})` : ''}`;
  const line = [c.kind && c.kind !== 'together' ? KINDS[c.lang ?? 'ru'][c.kind] : undefined, c.by].filter(Boolean).join(' · ');
  const text = [`<b>${esc(head)}</b>`, line ? esc(line) : '', c.about ? `\n${esc(c.about)}` : ''].filter(Boolean).join('\n');
  // выбор компанией (ЗП-11): приглашение голосовать, а не карточка
  const B = BUTTON[c.lang ?? 'ru'];
  const button = c.kind === 'together' ? B.together : c.kind === 'character' ? B.character : B.work;
  const reply_markup = { inline_keyboard: [[{ text: button, url: `https://t.me/${bot.name}?startapp=${c.param}` }]] };
  const id = `s-${c.param}`.slice(0, 64);
  return c.image
    ? { type: 'photo', id, photo_url: c.image, thumbnail_url: c.image, caption: text, parse_mode: 'HTML', reply_markup }
    : { type: 'article', id, title: head, input_message_content: { message_text: text, parse_mode: 'HTML', link_preview_options: { is_disabled: true } }, reply_markup };
}

/** POST /api/share (сессия участника): `{ param, title, year?, kind?, by?, about?, image? }` → `{ id }`. */
export async function prepareShare(req: Request, tgId: number | null | undefined, env: Env, userId?: string): Promise<Response> {
  if (!env.BOT_TOKEN) return Response.json({ error: 'no_bot_token' }, { status: 503 });
  if (tgId == null) return Response.json({ error: 'telegram_only' }, { status: 400 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const param = clip(b.param, 64);
  const title = clip(b.title, 120);
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(param) || !title) return Response.json({ error: 'bad_card' }, { status: 400 });
  const kind = (['film', 'series', 'book', 'character', 'together'] as const).find((k) => k === b.kind);
  const image = clip(b.image, 500);
  // в кнопку — код поделившегося (ЗП-37): новый участник по этой ссылке запомнит, кто его привёл
  const card: ShareCard = { param: userId ? withRef(param, userId) : param, title, ...(typeof b.year === 'number' && b.year > 1800 && b.year < 2100 ? { year: b.year } : {}),
    ...(kind ? { kind } : {}), ...(clip(b.by, 80) ? { by: clip(b.by, 80) } : {}), ...(clip(b.about, 300) ? { about: clip(b.about, 300) } : {}),
    ...(IMAGE_HOSTS.test(image) ? { image } : {}), ...(b.lang === 'en' ? { lang: 'en' as const } : {}) };
  const save = (result: unknown) => tg<{ id: string }>(env, 'savePreparedInlineMessage',
    { user_id: tgId, result, allow_user_chats: true, allow_group_chats: true, allow_channel_chats: true, allow_bot_chats: false });
  let r = await save(shareResult(card));
  // картинку Telegram может не принять (формат, размер) — тогда без неё, текстом с кнопкой. 17.10: не достучались
  // (error_code 0, предел 8 с) — второй раз не ждём
  if (!r.ok && card.image && r.error_code !== 0) r = await save(shareResult({ ...card, image: undefined }));
  return r.ok && r.result ? Response.json({ id: r.result.id }) : Response.json({ error: 'telegram', reason: r.description }, { status: 502 });
}
