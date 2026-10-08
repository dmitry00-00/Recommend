// Подписка на разборы (06.10): «Следить» на странице героя или произведения — и раз в день бот присылает
// одно сообщение: что нового о Тирионе, о «Доме Дракона». Не по ролику на сообщение — сводкой.
//
// Свежее узнаём, когда сборщик кладёт справочник разборов (essaysAuto, postsAuto: tools/publish-reference.mts):
// чего не было в прежнем файле и что вышло за последние две недели — в `follow_fresh`. Старые ролики,
// которые опознаватель привязал только сейчас, — не новость. Первый файл после запуска — точка отсчёта,
// из него ничего не шлём.
//
// Героя в заголовке узнаём по справочнику `heroes` (tools/heroes-index.mts): произведения героя и два
// выражения имени — своё (для разборов его произведений) и «широкое» (для чужих), те же, что у страницы героя.
// Обзоры не шлём, кроме размеченных «О персонаже» (как на странице героя). Ролик со спойлерами — без заголовка:
// заголовок сам бывает спойлером.
//
// Рассылка — `followDigest`: раз в сутки после 10:00 по Москве (сервер bothost зовёт её по таймеру,
// Cloudflare — `scheduled`), владелец может прогнать её руками: POST /api/admin/follow-digest.
import type { Env } from './env';
import { noteSeasons, seasonNews, type SeasonInfo, type SeasonNews } from './seasons';

const BOT = 'recomend_media_bot';
const FRESH_DAYS = 14;
const KEEP_DAYS = 30;
const MAX_FOLLOWS = 100;
const PER_FOLLOW = 3;
const MAX_SECTIONS = 6;
const HOUR_MSK = 10;

interface Analysis { id: string; title: string; author: string; platform: string; url: string; spoilerLevel?: number; publishedAt?: string; unverified?: boolean; tier?: string }
interface Hero { n: string; works: string[]; own?: string; other?: string }
interface Fresh { url: string; key: string; title: string; author: string; platform: string; spoiler: number; tier: string | null; lens: string | null; at: string }
interface FollowRow { user_id: string; kind: 'work' | 'character'; ref: string; keys: string; title: string; at: string }

const json = (body: unknown, status = 200) => Response.json(body, { status });
const iso = (d = new Date()) => d.toISOString();
/** Дата по Москве (UTC+3, без перехода на летнее время) и час — для «раз в день после десяти». */
const msk = (d: Date) => { const m = new Date(d.getTime() + 3 * 3600e3); return { day: m.toISOString().slice(0, 10), hour: m.getUTCHours() }; };
const WORK_KEY = /^[a-z]{2,10}:[A-Za-z0-9_.-]{1,40}$/;
const youtubeId = (a: Pick<Analysis, 'url' | 'id'>) => /[?&]v=([\w-]{11})/.exec(a.url)?.[1] ?? /^yta-([\w-]{11})$/.exec(a.id)?.[1];

// ─── свежее из справочника ────────────────────────────────────────────────────

/** Сборщик положил новый индекс разборов: что в нём появилось — в `follow_fresh`. Ошибки здесь не
 *  мешают самому справочнику — его PUT уже прошёл. */
export async function noteFresh(env: Env, oldText: string | undefined, newText: string, now = new Date()): Promise<number> {
  if (!oldText) return 0;
  const before = new Set<string>();
  for (const list of Object.values(JSON.parse(oldText) as Record<string, Analysis[]>)) for (const a of list) before.add(a.url);
  const lenses = await reference<Record<string, string>>(env, 'essayLenses') ?? {};
  const since = now.getTime() - FRESH_DAYS * 86400e3;
  const at = iso(now);
  const rows = [];
  for (const [key, list] of Object.entries(JSON.parse(newText) as Record<string, Analysis[]>)) {
    for (const a of list) {
      if (before.has(a.url) || a.unverified || !a.publishedAt || Date.parse(a.publishedAt) < since) continue;
      const yt = youtubeId(a);
      const lens = yt ? lenses[yt] ?? null : null;
      rows.push(env.DB.prepare(`INSERT OR IGNORE INTO follow_fresh (url, key, title, author, platform, spoiler, tier, lens, at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(a.url, key, a.title.slice(0, 300), a.author.slice(0, 120), a.platform, a.spoilerLevel ?? 0, a.tier ?? null, lens, at));
    }
  }
  rows.push(env.DB.prepare('DELETE FROM follow_fresh WHERE at < ?').bind(iso(new Date(now.getTime() - KEEP_DAYS * 86400e3))));
  await env.DB.batch(rows);
  return rows.length - 1;
}

const refCache = new Map<string, { at: number; data: unknown }>();
export async function reference<T>(env: Env, name: string): Promise<T | undefined> {
  const hit = refCache.get(name);
  if (hit && Date.now() - hit.at < 10 * 60e3) return hit.data as T;
  const object = await env.REFERENCE?.get(`${name}.json`);
  if (!object) return undefined;
  const data = JSON.parse(await new Response(object.body).text()) as T;
  refCache.set(name, { at: Date.now(), data });
  return data;
}
/** Справочник обновили — забыть его копию в памяти. */
export const forgetReference = (name: string) => refCache.delete(name);

// ─── подписки участника ──────────────────────────────────────────────────────

/** GET /api/follows → `{ follows, telegram }`. */
export async function getFollows(userId: string, env: Env): Promise<Response> {
  const [rows, me] = await Promise.all([
    env.DB.prepare('SELECT kind, ref, title, at FROM follow WHERE user_id = ? ORDER BY at DESC').bind(userId).all<{ kind: string; ref: string; title: string; at: string }>(),
    env.DB.prepare('SELECT tg_id FROM user WHERE id = ?').bind(userId).first<{ tg_id: number | null }>(),
  ]);
  return json({ follows: rows.results, telegram: me?.tg_id != null });
}

/** PUT /api/follow `{ kind, ref, keys?, title, on }`: герой — элемент Wikidata (или `aoiaf-<n>`), произведение — его ключ
 *  разборов (`tmdb:155`) и другие ключи той же карточки, по которым к ней приходят разборы. */
export async function putFollow(req: Request, userId: string, env: Env): Promise<Response> {
  const b = (await req.json().catch(() => ({}))) as { kind?: string; ref?: string; keys?: unknown; title?: string; on?: boolean };
  const kind = b.kind === 'work' || b.kind === 'character' ? b.kind : undefined;
  const ref = typeof b.ref === 'string' ? b.ref.trim() : '';
  if (!kind || !(kind === 'character' ? /^(Q\d{1,12}|aoiaf-\d{1,6})$/.test(ref) : WORK_KEY.test(ref))) return json({ error: 'bad_follow' }, 400);
  if (b.on === false) {
    await env.DB.prepare('DELETE FROM follow WHERE user_id = ? AND kind = ? AND ref = ?').bind(userId, kind, ref).run();
    return getFollows(userId, env);
  }
  const title = typeof b.title === 'string' ? b.title.trim().slice(0, 120) : '';
  if (!title) return json({ error: 'bad_follow' }, 400);
  const keys = kind === 'work'
    ? [...new Set([ref, ...(Array.isArray(b.keys) ? b.keys : []).filter((k): k is string => typeof k === 'string' && WORK_KEY.test(k))])].slice(0, 8)
    : [];
  const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM follow WHERE user_id = ?').bind(userId).first<{ n: number }>();
  if ((count?.n ?? 0) >= MAX_FOLLOWS) return json({ error: 'too_many' }, 400);
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO follow (user_id, kind, ref, keys, title, at) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, kind, ref) DO UPDATE SET keys = excluded.keys, title = excluded.title`).bind(userId, kind, ref, keys.join(','), title, iso()),
    // снова подписался — значит, писать ему снова можно (бота могли разблокировать)
    env.DB.prepare('UPDATE follow_digest SET blocked = 0 WHERE user_id = ?').bind(userId),
  ]);
  return getFollows(userId, env);
}

// ─── рассылка ────────────────────────────────────────────────────────────────

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const SPOILER_TITLE = 'разбор со спойлерами';
const paramOf = (f: Pick<FollowRow, 'kind' | 'ref'>) => (f.kind === 'character' ? `h-${f.ref}` : `w-${f.ref.replace(':', '_')}`);

/** Совпадения одной подписки среди свежего. */
export function matchFollow(f: Pick<FollowRow, 'kind' | 'ref' | 'keys'>, fresh: Fresh[], heroes: Record<string, Hero>): Fresh[] {
  if (f.kind === 'work') {
    const keys = new Set(f.keys.split(',').filter(Boolean));
    return fresh.filter((x) => keys.has(x.key) && x.tier !== 'review');
  }
  const h = heroes[f.ref];
  if (!h) return [];
  const own = h.own ? new RegExp(h.own, 'u') : undefined;
  const other = h.other ? new RegExp(h.other, 'u') : undefined;
  const works = new Set(h.works);
  return fresh.filter((x) => {
    const about = x.lens?.split('/').includes('character');
    if (x.tier === 'review' && !about) return false;
    return (works.has(x.key) ? own : other)?.test(x.title) ?? false;
  });
}

/** Текст сводки и кнопки: сначала новые сезоны (ЗП-17), потом раздел на подписку, до трёх строк в разделе,
 *  до шести разделов. */
export function digestMessage(sections: { follow: Pick<FollowRow, 'kind' | 'ref' | 'title'>; items: Fresh[] }[], seasons: SeasonNews[] = []) {
  const shown = sections.slice(0, MAX_SECTIONS);
  const lines: string[] = [];
  const shownSeasons = seasons.slice(0, MAX_SECTIONS);
  if (shownSeasons.length) {
    lines.push('<b>Вышел новый сезон</b>');
    for (const x of shownSeasons) lines.push(`— «${esc(x.title)}»: ${x.season} сезон${x.why === 'watched' ? ' — вы досмотрели прежние' : ''}`);
  }
  if (shown.length) lines.push(...(lines.length ? [''] : []), '<b>Новые разборы по вашим подпискам</b>');
  for (const { follow, items } of shown) {
    lines.push('', `<b>${esc(follow.title)}</b> · ${items.length}`);
    for (const x of items.slice(0, PER_FOLLOW)) lines.push(`— ${esc(x.author)}: ${x.spoiler >= 2 ? SPOILER_TITLE : `«${esc(x.title)}»`}`);
    if (items.length > PER_FOLLOW) lines.push(`— и ещё ${items.length - PER_FOLLOW}`);
  }
  if (sections.length > shown.length) lines.push('', `И ещё подписок с новинками: ${sections.length - shown.length}.`);
  lines.push('', '<i>Подписки — кнопка «Следить» на странице героя или произведения.</i>');
  const buttons = [
    ...shownSeasons.map((x) => [{ text: `${x.title.slice(0, 32)} · ${x.season} сезон`, url: `https://t.me/${BOT}?startapp=${paramOf({ kind: 'work', ref: x.key })}` }]),
    ...shown.map(({ follow }) => [{ text: follow.title.slice(0, 40), url: `https://t.me/${BOT}?startapp=${paramOf(follow)}` }]),
  ];
  return { text: lines.join('\n'), reply_markup: { inline_keyboard: buttons } };
}

export interface DigestReport { due: boolean; users: number; sent: number; empty: number; blocked: number; failed: number; preview?: { user: string; text: string }[] }

/** Сводка всем, кому сегодня ещё не слали. `force` — не ждать десяти утра и прогнать и тех, кому уже
 *  слали сегодня; `dry` — ничего не отправлять и не помечать, вернуть тексты. */
export async function followDigest(env: Env, { now = new Date(), force = false, dry = false } = {}): Promise<DigestReport> {
  const { day, hour } = msk(now);
  const report: DigestReport = { due: force || hour >= HOUR_MSK, users: 0, sent: 0, empty: 0, blocked: 0, failed: 0, ...(dry ? { preview: [] } : {}) };
  if (!report.due || !env.BOT_TOKEN) return report;
  // новые сезоны (ЗП-17): тем, кто их ждал по дневнику или подписке, — даже без подписок на разборы
  const seasons = await reference<Record<string, SeasonInfo>>(env, 'seriesSeasons') ?? {};
  const news = await seasonNews(env, seasons, now).catch((err) => { console.error('seasonNews', err); return new Map<string, SeasonNews[]>(); });
  const users = await env.DB.prepare(`SELECT u.id AS id, u.tg_id AS tg, d.at AS last
    FROM user u LEFT JOIN follow_digest d ON d.user_id = u.id
    WHERE u.tg_id IS NOT NULL AND COALESCE(d.blocked, 0) = 0 ${force ? '' : 'AND (d.day IS NULL OR d.day < ?)'}
      AND (EXISTS (SELECT 1 FROM follow f WHERE f.user_id = u.id) OR u.id IN (SELECT value FROM json_each(?)))`)
    .bind(...(force ? [] : [day]), JSON.stringify([...news.keys()])).all<{ id: string; tg: number; last: string | null }>();
  report.users = users.results.length;
  if (!users.results.length) return report;
  const oldest = users.results.reduce((m, u) => (u.last && u.last < m ? u.last : m), iso(now));
  const fresh = (await env.DB.prepare('SELECT * FROM follow_fresh WHERE at > ? ORDER BY at').bind(users.results.some((u) => !u.last) ? '' : oldest).all<Fresh>()).results;
  const heroes = await reference<Record<string, Hero>>(env, 'heroes') ?? {};
  const mark = (userId: string, blocked = 0) => env.DB.prepare(`INSERT INTO follow_digest (user_id, at, day, blocked) VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET at = excluded.at, day = excluded.day, blocked = excluded.blocked`).bind(userId, iso(now), day, blocked).run();
  for (const u of users.results) {
    const follows = (await env.DB.prepare('SELECT * FROM follow WHERE user_id = ? ORDER BY at').bind(u.id).all<FollowRow>()).results;
    // каждой подписке — только вышедшее после неё и после прошлой сводки
    const sections = follows.map((follow) => {
      const since = u.last && u.last > follow.at ? u.last : follow.at;
      return { follow, items: matchFollow(follow, fresh.filter((x) => x.at > since), heroes) };
    });
    // один ролик — один раз за сводку: разбор «Тёмного рыцаря» о Бэтмене — у подписки на фильм (она уже),
    // герою — остальное о нём
    const listed = new Set<string>();
    for (const sec of [...sections].sort((a, b) => Number(a.follow.kind === 'character') - Number(b.follow.kind === 'character'))) {
      sec.items = sec.items.filter((x) => !listed.has(x.url) && listed.add(x.url));
    }
    for (let i = sections.length - 1; i >= 0; i--) if (!sections[i].items.length) sections.splice(i, 1);
    const seasonsNew = news.get(u.id) ?? [];
    if (!sections.length && !seasonsNew.length) { report.empty++; if (!dry) await mark(u.id); continue; }
    const msg = digestMessage(sections, seasonsNew);
    if (dry) { report.preview!.push({ user: u.id, text: msg.text }); continue; }
    const r = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: u.tg, text: msg.text, parse_mode: 'HTML', reply_markup: msg.reply_markup, link_preview_options: { is_disabled: true } }),
    }).then((x) => x.json() as Promise<{ ok: boolean; error_code?: number }>).catch(() => ({ ok: false, error_code: 0 }));
    // 403 — бот заблокирован или участник не разрешал писать: не стучимся, пока не подпишется снова
    if (r.ok) { report.sent++; await mark(u.id); if (seasonsNew.length) await env.DB.batch(noteSeasons(env, u.id, seasonsNew, now)); } else if (r.error_code === 403) { report.blocked++; await mark(u.id, 1); } else report.failed++;
  }
  return report;
}

/** POST /api/admin/follow-digest `{ dry?, force? }` — прогнать сводку руками (по ADMIN_TOKEN). */
export async function adminDigest(req: Request, env: Env): Promise<Response> {
  const b = (await req.json().catch(() => ({}))) as { dry?: boolean; force?: boolean };
  return json(await followDigest(env, { dry: b.dry !== false, force: b.force === true }));
}
