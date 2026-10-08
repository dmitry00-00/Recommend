// Инлайн-режим бота (06.10): «@recomend_media_bot тирион» в любом чате → карточки героев, фильмов,
// сериалов и книг; выбранная уходит в чат сообщением с кнопкой, которая открывает мини-приложение
// на этой карточке (`?startapp=`, как у «Поделиться»). Переписку бот не видит — только текст запроса.
//
// Telegram шлёт события на POST /api/telegram (адрес ставит tools/tg-webhook.mts по слову владельца).
// Свой ли это запрос, проверяем заголовком `X-Telegram-Bot-Api-Secret-Token`: секрет выводится из
// токена бота (`webhookSecret`), отдельной переменной на bothost заводить не нужно.
// Ищем по справочнику `inlineIndex` (tools/inline-index.mts → publish-reference), он держится в памяти.
import type { Env } from './env';
import { withRef } from './invite';

interface Entry { p: string; k: 'film' | 'series' | 'book' | 'character'; t: string; o?: string; y?: number; s?: string; a?: string[]; i?: string; r?: number }
interface InlineQuery { id: string; query: string; from?: { id: number } }

const BOT = 'recomend_media_bot';
const LIMIT = 20;
const KIND: Record<Entry['k'], string> = { film: 'Фильм', series: 'Сериал', book: 'Книга', character: 'Герой' };

export async function webhookSecret(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`tm-webhook:${token}`));
  return [...new Uint8Array(digest)].slice(0, 24).map((b) => b.toString(16).padStart(2, '0')).join('');
}

let cache: { at: number; list: Entry[]; keys: string[][] } | undefined;
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

function result(e: Entry) {
  const head = `${e.t}${e.y ? ` (${e.y})` : ''}`;
  const line = [KIND[e.k], e.o, e.s].filter(Boolean).join(' · ');
  return {
    type: 'article', id: e.p, title: head, description: line,
    ...(e.i ? { thumbnail_url: e.i } : {}),
    input_message_content: { message_text: `<b>${esc(head)}</b>\n${esc(line)}`, parse_mode: 'HTML', link_preview_options: { is_disabled: true } },
    reply_markup: { inline_keyboard: [[{ text: e.k === 'character' ? 'Открыть героя' : 'Открыть карточку', url: `https://t.me/${BOT}?startapp=${e.p}` }]] },
  };
}

async function answer(env: Env, q: InlineQuery): Promise<void> {
  const idx = await index(env);
  const found = idx ? search(idx, q.query) : [];
  await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/answerInlineQuery`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ inline_query_id: q.id, results: found.map(result), cache_time: 300 }),
  }).catch((err) => console.error('answerInlineQuery', err));
}

/** Событие от Telegram. Отвечаем 200 всегда, кроме чужого секрета: иначе Telegram будет повторять. */
export async function telegramUpdate(req: Request, env: Env): Promise<Response> {
  if (!env.BOT_TOKEN) return new Response('no bot', { status: 503 });
  if (req.headers.get('x-telegram-bot-api-secret-token') !== await webhookSecret(env.BOT_TOKEN)) return new Response('forbidden', { status: 403 });
  const update = (await req.json().catch(() => ({}))) as { inline_query?: InlineQuery };
  if (update.inline_query) await answer(env, update.inline_query);
  return new Response('ok');
}

/** Подключение адреса событий (tools/tg-webhook.mts, по ADMIN_TOKEN): сервер сам зовёт Telegram своим
 *  токеном — на Mac токен бота не нужен. `info` — что стоит сейчас, `set` — поставить `url` (адрес
 *  /api/telegram этого сервера) только для инлайн-запросов, `delete` — снять. */
export async function adminWebhook(req: Request, env: Env): Promise<Response> {
  if (!env.BOT_TOKEN) return Response.json({ error: 'no_bot_token' }, { status: 503 });
  const b = (await req.json().catch(() => ({}))) as { action?: string; url?: string };
  const api = (method: string, body?: unknown) => fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body ?? {}),
  }).then((r) => r.json());
  if (b.action === 'set') {
    if (!b.url || !/^https:\/\/[^/]+\/api\/telegram$/.test(b.url)) return Response.json({ error: 'url' }, { status: 400 });
    return Response.json(await api('setWebhook', { url: b.url, secret_token: await webhookSecret(env.BOT_TOKEN), allowed_updates: ['inline_query'], drop_pending_updates: true }));
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
const IMAGE_HOSTS = /^https:\/\/(?:image\.tmdb\.org|covers\.openlibrary\.org|kinopoiskapiunofficial\.tech|avatars\.mds\.yandex\.net|commons\.wikimedia\.org|upload\.wikimedia\.org|i\.ytimg\.com)\//;
const clip = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '');

export interface ShareCard { param: string; title: string; year?: number; kind?: Entry['k'] | 'together'; by?: string; about?: string; image?: string }

export function shareResult(c: ShareCard) {
  const head = `${c.title}${c.year ? ` (${c.year})` : ''}`;
  const line = [c.kind && c.kind !== 'together' ? KIND[c.kind] : undefined, c.by].filter(Boolean).join(' · ');
  const text = [`<b>${esc(head)}</b>`, line ? esc(line) : '', c.about ? `\n${esc(c.about)}` : ''].filter(Boolean).join('\n');
  // выбор компанией (ЗП-11): приглашение голосовать, а не карточка
  const button = c.kind === 'together' ? 'Голосовать' : c.kind === 'character' ? 'Открыть героя' : 'Открыть карточку';
  const reply_markup = { inline_keyboard: [[{ text: button, url: `https://t.me/${BOT}?startapp=${c.param}` }]] };
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
    ...(IMAGE_HOSTS.test(image) ? { image } : {}) };
  const save = (result: unknown) => fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/savePreparedInlineMessage`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ user_id: tgId, result, allow_user_chats: true, allow_group_chats: true, allow_channel_chats: true, allow_bot_chats: false }),
  }).then((r) => r.json() as Promise<{ ok: boolean; result?: { id: string }; description?: string }>);
  let r = await save(shareResult(card));
  // картинку Telegram может не принять (формат, размер) — тогда без неё, текстом с кнопкой
  if (!r.ok && card.image) r = await save(shareResult({ ...card, image: undefined }));
  return r.ok && r.result ? Response.json({ id: r.result.id }) : Response.json({ error: 'telegram', reason: r.description }, { status: 502 });
}
