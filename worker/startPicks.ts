// Ответ на /start в личке (22.10, решение владельца): три фильма дня кнопками — до этого бот на /start молчал.
//
// Заходим с того, что можно посмотреть прямо сейчас: каждый из трёх — бесплатно и легально в регионе человека
// (бесплатно или с рекламой по `watchProviders`, правообладатель на YouTube по `freeWatch`), и у каждого есть разборы
// авторов (`essayIndex`). Из таких берём самые обсуждаемые (больше авторов — выше), а из верхушки — три по ключу дня и
// человека: у одного человека в один день те же три, назавтра другие, у соседа свои. Что человек уже видел, оценил,
// начал или бросил — мимо. Кнопка открывает карточку фильма в мини-приложении (`startapp=w-…--sstart`: метка источника
// видна в воронке), последняя — ленту. Справочников нет (сервер только поднялся) — приветствие с одной кнопкой ленты.
// Без объяснений «почему вам» (решение владельца): у кнопки только название, год и где смотреть.
import type { Env } from './env';
import { bot } from './env';
import { tg } from './tg';
import { inlineIndex, lookupIn, paramOf } from './inlineIndex';
import { rememberStart, startTail } from './invite';

/** Сколько самых обсуждаемых держим в верхушке, из которой выбираем три дня. */
const POOL = 150;
const PICKS = 3;
/** Меньше двух авторов — фильм почти не обсуждали: такой не зовём «фильмом дня». */
const MIN_AUTHORS = 2;
const TTL = 10 * 60e3;
const KEY = /^(?:tmdb|imdb|kp|wd):[A-Za-z0-9]{1,24}$/;
const SOURCE = '--sstart';

interface RegionWatch { f?: string[]; a?: string[] }
interface WatchProviders { names: Record<string, string>; works: Record<string, Record<string, RegionWatch>> }
interface FreeWatch { works: Record<string, { n?: string }[]> }
interface EssayIndex { k: Record<string, string[]>; x?: Record<string, unknown[]> }

type Lang = 'ru' | 'en';
const TEXT = {
  ru: {
    hello: (name: string) => `Привет${name ? `, ${name}` : ''}! Три фильма на сегодня — каждый можно посмотреть бесплатно и легально, а в приложении к ним есть разборы авторов.`,
    tail: 'Отметьте, что уже видели, — и лента подстроится под ваш вкус.',
    empty: (name: string) => `Привет${name ? `, ${name}` : ''}! Здесь подбирают фильмы и книги под ваш вкус и к каждому прикладывают разборы авторов.`,
    free: 'бесплатно',
    feed: 'Открыть ленту',
  },
  en: {
    hello: (name: string) => `Hi${name ? `, ${name}` : ''}! Three films for today — each one free and legal to watch, with authors’ deep dives in the app.`,
    tail: 'Mark what you’ve already seen and the feed will tune to your taste.',
    empty: (name: string) => `Hi${name ? `, ${name}` : ''}! Films and books picked for your taste, each with authors’ deep dives.`,
    free: 'free',
    feed: 'Open the feed',
  },
} as const;
const langOf = (code?: string | null): Lang => (code && /^en/i.test(code) ? 'en' : 'ru');
/** Регион «где смотреть»: русскоязычным — российские площадки, остальным — американские (как справочник сервера). */
const regionOf = (lang: Lang) => (lang === 'en' ? 'US' : 'RU');
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ─── справочники ──────────────────────────────────────────────────────────────

const refs = new Map<string, { at: number; value: unknown }>();
async function ref<T>(env: Env, name: string): Promise<T | undefined> {
  const hit = refs.get(name);
  if (hit && Date.now() - hit.at < TTL) return hit.value as T;
  const object = await env.REFERENCE?.get(`${name}.json`);
  if (!object) return hit?.value as T | undefined;
  const value = JSON.parse(await new Response(object.body).text()) as T;
  refs.set(name, { at: Date.now(), value });
  return value;
}

export interface Candidate { key: string; title: string; year?: number; where: string; authors: number }

/** Верхушка кандидатов региона: бесплатно и легально, с разборами, есть в справочнике поиска. Пересчёт — раз в TTL. */
const pools = new Map<string, { at: number; list: Candidate[] }>();
export async function freePool(env: Env, region: string, lang: Lang): Promise<Candidate[]> {
  const cached = pools.get(`${region}|${lang}`);
  if (cached && Date.now() - cached.at < TTL) return cached.list;
  const [wp, fw, ei, idx] = await Promise.all([
    ref<WatchProviders>(env, 'watchProviders'), ref<FreeWatch>(env, 'freeWatch'), ref<EssayIndex>(env, 'essayIndex'), inlineIndex(env),
  ]);
  if (!ei || !idx) return cached?.list ?? [];
  const lookup = lookupIn(idx);
  // английскому собеседнику — оригинальное название (у справочника поиска основное — русское)
  const original = lang === 'en' ? new Map(idx.list.filter((e) => e.o).map((e) => [e.p, e.o!])) : undefined;
  const where = new Map<string, string>();
  for (const [key, regions] of Object.entries(wp?.works ?? {})) {
    const r = regions[region];
    const slug = r?.f?.[0] ?? r?.a?.[0];
    if (slug) where.set(key, `${TEXT[lang].free} · ${wp!.names[slug] ?? slug}`);
  }
  // правообладатель на YouTube — для русскоязычного справочника (tools/free-watch.mts собирает русские каналы студий)
  if (region === 'RU') for (const [key, list] of Object.entries(fw?.works ?? {})) if (list.length && !where.has(key)) where.set(key, `${TEXT[lang].free} · YouTube`);
  const list: Candidate[] = [];
  for (const [key, w] of where) {
    if (!KEY.test(key)) continue;
    const authors = (ei.k[key]?.length ?? 0) + (ei.x?.[key]?.length ?? 0);
    if (authors < MIN_AUTHORS) continue;
    const known = lookup(key);
    if (!known || (known.k !== 'film' && known.k !== 'series')) continue;
    const title = original?.get(paramOf(key) ?? '') ?? known.t;
    list.push({ key, title, ...(known.y ? { year: known.y } : {}), where: w, authors });
  }
  list.sort((a, b) => b.authors - a.authors || a.key.localeCompare(b.key));
  const top = list.slice(0, POOL);
  pools.set(`${region}|${lang}`, { at: Date.now(), list: top });
  return top;
}

// ─── что человек уже видел ─────────────────────────────────────────────────────

interface Row { work_id: string; work: string | null }
/** Ключи произведений из истории человека: id записи и внешние ключи карточки (TMDb, IMDb, Кинопоиск). */
export async function seenKeys(env: Env, tgId: number): Promise<Set<string>> {
  const out = new Set<string>();
  const user = await env.DB.prepare('SELECT id FROM user WHERE tg_id = ?').bind(tgId).first<{ id: string }>();
  if (!user) return out;
  const res = await env.DB.prepare(`SELECT work_id, NULL AS work FROM watched WHERE user_id = ? AND state = 'watched'
      UNION ALL SELECT work_id, work FROM rating WHERE user_id = ?
      UNION ALL SELECT work_id, work FROM journal WHERE user_id = ? AND status <> 'planned'`).bind(user.id, user.id, user.id).all<Row>();
  for (const r of res.results ?? []) {
    if (KEY.test(r.work_id)) out.add(r.work_id);
    let ext: { tmdb?: unknown; imdb?: unknown; kinopoisk?: unknown } | undefined;
    try { ext = r.work ? (JSON.parse(r.work) as { externalIds?: typeof ext }).externalIds : undefined; } catch { ext = undefined; }
    if (ext?.tmdb != null && /^\d{1,12}$/.test(String(ext.tmdb))) out.add(`tmdb:${ext.tmdb}`);
    if (typeof ext?.imdb === 'string' && /^tt\d{3,12}$/.test(ext.imdb)) out.add(`imdb:${ext.imdb}`);
    if (ext?.kinopoisk != null && /^\d{1,12}$/.test(String(ext.kinopoisk))) out.add(`kp:${ext.kinopoisk}`);
  }
  // в watched у записи есть и свои столбцы ключей
  const cols = await env.DB.prepare(`SELECT tmdb, imdb FROM watched WHERE user_id = ? AND state = 'watched'`).bind(user.id).all<{ tmdb: number | null; imdb: string | null }>();
  for (const r of cols.results ?? []) {
    if (r.tmdb != null) out.add(`tmdb:${r.tmdb}`);
    if (r.imdb && /^tt\d{3,12}$/.test(r.imdb)) out.add(`imdb:${r.imdb}`);
  }
  return out;
}

// ─── три дня ───────────────────────────────────────────────────────────────────

/** FNV-1a: ключ дня и человека → порядок верхушки, у одного человека в один день — тот же. */
const hash = (s: string) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0; };
const mskDay = (now: number) => new Date(now + 3 * 3600e3).toISOString().slice(0, 10);

export function pickOfDay(pool: Candidate[], seen: Set<string>, seed: string, n = PICKS): Candidate[] {
  return pool.filter((c) => !seen.has(c.key))
    .map((c) => ({ c, h: hash(`${seed}|${c.key}`) }))
    .sort((a, b) => a.h - b.h)
    .slice(0, n)
    .map((x) => x.c);
}

const button = (c: Candidate) => {
  const name = c.title.length > 40 ? `${c.title.slice(0, 39)}…` : c.title;
  return `🎬 ${name}${c.year ? ` (${c.year})` : ''} · ${c.where}`.slice(0, 120);
};

export interface StartMessage {
  message_id: number; text?: string; chat: { id: number; type: string };
  from?: { id?: number; first_name?: string; language_code?: string; is_bot?: boolean };
}

/** Сообщение боту (вебхук, worker/inline.ts). true — это /start в личке и ответ отправлен. */
export async function startCommand(env: Env, m: StartMessage, now = Date.now()): Promise<boolean> {
  if (m.chat.type !== 'private' || !m.from?.id || m.from.is_bot) return false;
  if (!m.text || !/^\/start(?:@[A-Za-z0-9_]+)?(?:\s|$)/.test(m.text.trim())) return false;
  if (!env.BOT_TOKEN) return false;
  const lang = langOf(m.from.language_code);
  const T = TEXT[lang];
  const name = esc((m.from.first_name ?? '').replace(/\s+/g, ' ').trim().slice(0, 40));
  // пришёл по `?start=--s<метка>` (23.10, рекламная кампания) — кнопки несут его метку, а не --sstart: участник
  // заводится только при входе в приложение, и источник запишется по кнопке
  const came = startTail(m.text);
  const tail = came ?? SOURCE;
  // 24.10: тот же хвост — в start_mark за номером: приложение могут открыть кнопкой меню бота, без start_param
  if (came) await rememberStart(env.DB, m.from.id, came, now).catch((err) => console.error('start mark', err));
  const feed = [{ text: T.feed, url: `https://t.me/${bot.name}?startapp=${tail}` }];
  let picks: Candidate[] = [];
  try {
    const [pool, seen] = await Promise.all([freePool(env, regionOf(lang), lang), seenKeys(env, m.from.id)]);
    picks = pickOfDay(pool, seen, `${mskDay(now)}|${m.from.id}`);
  } catch (err) {
    console.error('start picks', err);
  }
  const rows = picks.flatMap((c) => { const p = paramOf(c.key); return p ? [[{ text: button(c), url: `https://t.me/${bot.name}?startapp=${(p + tail).length <= 64 ? p + tail : p + SOURCE}` }]] : []; });
  const text = rows.length ? `${T.hello(name)}\n\n${T.tail}` : T.empty(name);
  return (await tg(env, 'sendMessage', {
    chat_id: m.chat.id, text, parse_mode: 'HTML', link_preview_options: { is_disabled: true },
    reply_markup: { inline_keyboard: [...rows, feed] },
  })).ok;
}
