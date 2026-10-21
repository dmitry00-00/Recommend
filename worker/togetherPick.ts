// Подбор «вместе» по вкусу (19.10, решение владельца): общее рекомендуемое, а не общие списки.
//
// Модель вкуса живёт на клиенте (src/lib/model), на сервере её нет. Поэтому клиент после расчёта ленты присылает свою
// «верхушку» — ~150 лучших для себя фильмов и сериалов с оценкой подходящести 0..1 (PUT /api/taste-top, src/api/index.ts
// `syncTasteTop`), одна запись на участника в `taste_top`, перезаписывается. Подбор компании (2+ человека):
//   1. то, что хотят все: в верхушке или в планах у каждого, — по «наименее довольному» (min fit), при равенстве — среднее;
//   2. в верхушках у всех, у кого они есть (у кого верхушки нет, вкус неизвестен — он не мешает);
//   3. если мало — то, что есть у большинства (больше половины, от троих);
//   4. добор по очереди от каждого: его верхушка и планы, затем любимое (оценка 5) участников без верхушки.
// Убираем всё, что кто-то из участников видел, оценил, начал или бросил (как и раньше в worker/inlineGroup.ts). Любимое
// участника без верхушки он сам видел — для него это пересмотр, исключение на него не действует; остальные должны не видеть.
// Участник без верхушки (не открывал приложение после выкладки) — прежняя логика: его планы и любимое; в ответе видно, у
// кого подбор по старой истории. Спросивший должен быть в боте и оценить не меньше MIN_RATED фильмов. Только фильмы и
// сериалы; без объяснений «почему вам» (решение владельца) — у фильма одна строка о нём самом.
//
// Одно произведение под разными id (TMDb, IMDb, Кинопоиск, импорт) сводим по внешним ключам, а без них — по названию и году.
import type { Env } from './env';
import { IMAGE_HOSTS } from './hosts';
import { norm, paramOf, type Known } from './inlineIndex';
import type { PollFilm } from './inlinePoll';

export const MIN_RATED = 30;
/** «Что посмотреть вдвоём» в личке (владелец, 19.10): порог ниже, чем у компании, — у тестеров оценок пока мало. */
export const MIN_RATED_PAIR = 10;
const TOP_MAX = 200;
const MAX = 10;
const MAX_MEMBERS = 10;
const KEY = /^(?:tmdb|imdb|kp|wd):[A-Za-z0-9]{1,24}$/;

// ─── верхушка участника ────────────────────────────────────────────────────────

/** k — ключ произведения (`tmdb:`, у сериала `imdb:`), f — подходящесть 0..1, s — сериал, n/y — название и год (на случай,
 *  если справочника сервера нет под рукой), a — строка о фильме, x — другие ключи того же произведения. */
export interface TopItem { k: string; f: number; s?: 1; n?: string; y?: number; a?: string; x?: string[] }

/** Строка от участника пойдёт в чужой чат: без ссылок и упоминаний (Telegram сделал бы их кликабельными). */
const plain = (s: string) => s.replace(/https?:\/\/\S+|www\.\S+|t\.me\/\S+|@[A-Za-z0-9_]{2,}/gi, '').replace(/\s+/g, ' ').trim();

export function cleanTop(raw: unknown): TopItem[] {
  if (!Array.isArray(raw)) return [];
  const out: TopItem[] = [];
  const seen = new Set<string>();
  for (const r of raw.slice(0, TOP_MAX)) {
    if (!r || typeof r !== 'object') continue;
    const o = r as Record<string, unknown>;
    const k = typeof o.k === 'string' ? o.k.trim() : '';
    if (!KEY.test(k) || seen.has(k) || typeof o.f !== 'number' || !Number.isFinite(o.f)) continue;
    seen.add(k);
    const f = Math.round(Math.max(0, Math.min(1, o.f)) * 1000) / 1000;
    const n = typeof o.n === 'string' ? plain(o.n).slice(0, 120) : '';
    const a = typeof o.a === 'string' ? plain(o.a).slice(0, 160) : '';
    const y = typeof o.y === 'number' && Number.isInteger(o.y) && o.y >= 1800 && o.y <= 2100 ? o.y : undefined;
    const x = Array.isArray(o.x) ? [...new Set(o.x.filter((v): v is string => typeof v === 'string' && KEY.test(v) && v !== k))].slice(0, 4) : [];
    out.push({ k, f, ...(o.s ? { s: 1 as const } : {}), ...(n ? { n } : {}), ...(y ? { y } : {}), ...(a ? { a } : {}), ...(x.length ? { x } : {}) });
  }
  return out;
}

/** PUT /api/taste-top `{ items: TopItem[] }` → `{ ok, n }`. Только для вошедших через Telegram: подбор «вместе» идёт в
 *  боте. Пустой список — записи нет (подбор по старой истории), а не «ничего не нравится». */
export async function putTasteTop(req: Request, userId: string, env: Env): Promise<Response> {
  const me = await env.DB.prepare('SELECT tg_id FROM user WHERE id = ?').bind(userId).first<{ tg_id: number | null }>();
  if (me?.tg_id == null) return Response.json({ error: 'telegram_only' }, { status: 400 });
  const b = (await req.json().catch(() => ({}))) as { items?: unknown };
  const items = cleanTop(b.items);
  if (!items.length) {
    await env.DB.prepare('DELETE FROM taste_top WHERE user_id = ?').bind(userId).run();
    return Response.json({ ok: true, n: 0 });
  }
  await env.DB.prepare(`INSERT INTO taste_top (user_id, items, n, at) VALUES (?, ?, ?, ?)
    ON CONFLICT (user_id) DO UPDATE SET items = excluded.items, n = excluded.n, at = excluded.at`)
    .bind(userId, JSON.stringify(items), items.length, new Date().toISOString()).run();
  return Response.json({ ok: true, n: items.length });
}

// ─── ранжирование (чистая функция — tools/together-pick-test.mts) ──────────────

export interface Want { fit: number; from: 'top' | 'plan' | 'loved'; at?: string }
export interface Member { id: string; top: boolean; wants: Map<string, Want> }

/** Порядок подбора: ключи произведений, до `max`. `seen` — кто из участников видел (оценил, начал, бросил). */
export function rankCompany(members: Member[], seen: Map<string, Set<string>>, max = MAX): string[] {
  const n = members.length;
  const byId = new Map(members.map((m) => [m.id, m]));
  // видел кто-то, кроме поклонника этого фильма (его любимое — пересмотр)
  const fresh = (k: string) => [...(seen.get(k) ?? [])].every((u) => byId.get(u)?.wants.get(k)?.from === 'loved');
  interface C { k: string; support: number; min: number; mean: number; at: string }
  const cands: C[] = [];
  for (const k of new Set(members.flatMap((m) => [...m.wants.keys()]))) {
    if (!fresh(k)) continue;
    const who = members.map((m) => m.wants.get(k)).filter((w): w is Want => Boolean(w));
    const fits = who.map((w) => w.fit);
    cands.push({ k, support: who.length, min: Math.min(...fits), mean: fits.reduce((a, b) => a + b, 0) / fits.length,
      at: who.reduce((a, w) => ((w.at ?? '') > a ? w.at ?? '' : a), '') });
  }
  const order = (a: C, b: C) => b.support - a.support || b.min - a.min || b.mean - a.mean || b.at.localeCompare(a.at) || a.k.localeCompare(b.k);
  const out: string[] = [];
  const taken = new Set<string>();
  const add = (c: C | undefined) => { if (c && out.length < max && !taken.has(c.k)) { taken.add(c.k); out.push(c.k); } };
  const tops = members.filter((m) => m.top);
  // 1. хотят все
  cands.filter((c) => c.support === n).sort(order).forEach(add);
  // 2. в верхушках у всех, у кого они есть
  if (tops.length >= 2) cands.filter((c) => tops.every((m) => m.wants.has(c.k))).sort(order).forEach(add);
  // 3. у большинства
  if (n >= 3) cands.filter((c) => c.support * 2 > n).sort(order).forEach(add);
  // 4. по очереди от каждого: спросивший первым; сначала верхушки и планы, потом любимое
  for (const pass of [['top', 'plan'], ['loved']]) {
    const queues = members.map((m) => cands.filter((c) => pass.includes(m.wants.get(c.k)?.from ?? ''))
      .sort((a, b) => m.wants.get(b.k)!.fit - m.wants.get(a.k)!.fit || order(a, b)));
    // за круг — по одному новому от каждого: уже взятое очередь не тратит
    const at = queues.map(() => 0);
    while (out.length < max && queues.some((q, j) => at[j] < q.length)) {
      queues.forEach((q, j) => {
        while (at[j] < q.length && taken.has(q[at[j]].k)) at[j] += 1;
        add(q[at[j]]);
        at[j] += 1;
      });
    }
  }
  return out;
}

// ─── данные участников из базы ─────────────────────────────────────────────────

/** Фильм в ответе: название, год, картинка; p — параметр `startapp` карточки, a — строка о фильме, s — подпись справочника. */
export interface PickFilm extends PollFilm { p?: string; a?: string; k?: 'film' | 'series'; s?: string }

interface Work { type?: string; format?: string; title?: string; year?: number; coverUrl?: string; externalIds?: { tmdb?: unknown; imdb?: unknown; kinopoisk?: unknown } }
const parse = (s: string | null): Work | undefined => { try { const w = s ? JSON.parse(s) : undefined; return w && typeof w === 'object' ? (w as Work) : undefined; } catch { return undefined; } };
const yearOf = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) && v >= 1800 && v <= 2100 ? v : undefined);
const imageOf = (v: unknown) => (typeof v === 'string' && v.length <= 500 && IMAGE_HOSTS.test(v) ? v : undefined);
const titleKey = (t: string, y?: number) => `t:${norm(t)}|${y ?? ''}`;

type Row = { user_id: string; work_id: string; work: string | null; status?: string; eagerness?: number | null; rating?: number; at: string | null; tmdb?: number | null; imdb?: string | null };

/** Сбор и подбор для участников `ids` (первый — спросивший). `noTop` — у кого подбор по старой истории, `blank` — у кого
 *  истории нет вовсе (ни верхушки, ни оценок, ни планов). */
export async function companyFilms(env: Env, ids: string[], lookup: (key: string) => Known | undefined, max = MAX):
  Promise<{ films: PickFilm[]; noTop: string[]; blank: string[] }> {
  const members = [...new Set(ids)].slice(0, MAX_MEMBERS);
  const marks = members.map(() => '?').join(',');
  const [tops, journal, rating, watched] = await env.DB.batch([
    env.DB.prepare(`SELECT user_id, items FROM taste_top WHERE user_id IN (${marks})`).bind(...members),
    env.DB.prepare(`SELECT user_id, work_id, work, status, eagerness, started_at AS at FROM journal WHERE user_id IN (${marks})`).bind(...members),
    env.DB.prepare(`SELECT user_id, work_id, work, rating, at FROM rating WHERE user_id IN (${marks})`).bind(...members),
    env.DB.prepare(`SELECT user_id, work_id, work, at, tmdb, imdb FROM watched WHERE state = 'watched' AND user_id IN (${marks})`).bind(...members),
  ]);
  const rows = <T>(r: unknown) => ((r as { results?: T[] }).results ?? []);

  // одно произведение — один ключ: первый встреченный признак (внешний ключ или «название|год») назначает его
  const canon = new Map<string, string>();
  const resolve = (tokens: string[]): string => {
    const hit = tokens.find((t) => canon.has(t));
    const c = hit ? canon.get(hit)! : tokens[0];
    for (const t of tokens) if (!canon.has(t)) canon.set(t, c);
    return c;
  };
  const info = new Map<string, PickFilm>();
  const wants = new Map(members.map((u) => [u, new Map<string, Want>()]));
  const want = (u: string, k: string, w: Want) => {
    const m = wants.get(u)!;
    const had = m.get(k);
    if (!had || w.fit > had.fit) m.set(k, had?.from === 'top' && w.from === 'plan' ? { ...w, from: 'top' } : w);
  };

  // верхушки — первыми: у них справочные названия и ключи
  const withTop = new Set<string>();
  for (const r of rows<{ user_id: string; items: string }>(tops)) {
    let items: TopItem[] = [];
    try { items = cleanTop(JSON.parse(r.items)); } catch { /* битая запись — как без верхушки */ }
    if (!items.length) continue;
    withTop.add(r.user_id);
    for (const it of items) {
      const known = lookup(it.k) ?? it.x?.map(lookup).find(Boolean);
      if (known && known.k !== 'film' && known.k !== 'series') continue;
      const t = (known?.t ?? it.n ?? '').trim().slice(0, 120);
      if (!t) continue;
      const y = yearOf(known?.y) ?? it.y;
      const k = resolve([it.k, ...(it.x ?? []), titleKey(t, y), ...(it.n && it.n !== t ? [titleKey(it.n, y)] : [])]);
      if (!info.has(k)) {
        const i = imageOf(known?.i);
        const p = paramOf(it.k);
        info.set(k, { t, ...(y ? { y } : {}), ...(i ? { i } : {}), ...(p ? { p } : {}), k: known?.k === 'series' || it.s ? 'series' : 'film',
          ...(known?.s ? { s: known.s } : {}) });
      }
      const f = info.get(k)!;
      if (!f.a && it.a) f.a = it.a;
      want(r.user_id, k, { fit: it.f, from: 'top' });
    }
  }

  /** Строка истории → ключ и (для фильма или сериала с названием) карточка. Видел — по любому признаку. */
  const film = (r: Row): { key: string; film?: PickFilm } | undefined => {
    const w = parse(r.work);
    const ext = w?.externalIds;
    const keys = [
      KEY.test(r.work_id) ? r.work_id : undefined,
      ext?.tmdb != null && /^\d{1,12}$/.test(String(ext.tmdb)) ? `tmdb:${ext.tmdb}` : undefined,
      typeof ext?.imdb === 'string' && /^tt\d{3,12}$/.test(ext.imdb) ? `imdb:${ext.imdb}` : undefined,
      ext?.kinopoisk != null && /^\d{1,12}$/.test(String(ext.kinopoisk)) ? `kp:${ext.kinopoisk}` : undefined,
      r.tmdb != null ? `tmdb:${r.tmdb}` : undefined,
      typeof r.imdb === 'string' && /^tt\d{3,12}$/.test(r.imdb) ? `imdb:${r.imdb}` : undefined,
    ].filter((k): k is string => Boolean(k));
    const known = keys.map(lookup).find(Boolean);
    const kind = w?.format === 'series' ? 'series' : (w?.type ?? known?.k);
    const screen = kind === 'film' || kind === 'series';
    // карточка — из импорта участника, то есть чужой ввод (ХБ, 17.10): название режем, год — только целое, картинка — свои хосты
    const rawT = known?.t || w?.title;
    const t = screen && typeof rawT === 'string' ? plain(rawT).slice(0, 120) : '';
    const y = yearOf(known?.y ?? w?.year);
    const tokens = [...keys, ...(t ? [titleKey(t, y)] : []), ...(t && w?.title && w.title !== t ? [titleKey(plain(w.title), yearOf(w.year))] : [])];
    if (!tokens.length) return undefined;
    const key = resolve(tokens);
    if (!t) return { key };
    const i = imageOf(known?.i) ?? imageOf(w?.coverUrl);
    const p = keys.map(paramOf).find(Boolean) ?? (/^[A-Za-z0-9_-]{1,62}$/.test(r.work_id) ? `c-${r.work_id}` : undefined);
    return { key, film: { t, ...(y ? { y } : {}), ...(i ? { i } : {}), ...(p ? { p } : {}), k: kind === 'series' ? 'series' : 'film', ...(known?.s ? { s: known.s } : {}) } };
  };
  const seen = new Map<string, Set<string>>();
  const saw = (key: string, user: string) => { if (!seen.has(key)) seen.set(key, new Set()); seen.get(key)!.add(user); };
  const history = new Set<string>();
  const note = (k: string, f?: PickFilm) => { if (f && !info.has(k)) info.set(k, f); };

  for (const r of rows<Row>(watched)) { history.add(r.user_id); const x = film(r); if (x) saw(x.key, r.user_id); }
  for (const r of rows<Row>(rating)) {
    history.add(r.user_id);
    const x = film(r);
    if (!x) continue;
    saw(x.key, r.user_id);
    // любимое — источник только у тех, у кого нет верхушки (прежняя логика)
    if (r.rating === 5 && x.film && !withTop.has(r.user_id)) { note(x.key, x.film); want(r.user_id, x.key, { fit: 0.65, from: 'loved', at: r.at ?? '' }); }
  }
  for (const r of rows<Row>(journal)) {
    history.add(r.user_id);
    const x = film(r);
    if (!x) continue;
    if (r.status !== 'planned') { saw(x.key, r.user_id); continue; }
    if (!x.film) continue;
    note(x.key, x.film);
    // в планах — то, что хотелось: чем сильнее хотелось, тем выше (1..5)
    want(r.user_id, x.key, { fit: 0.6 + 0.06 * Math.max(0, Math.min(5, r.eagerness ?? 0)), from: 'plan', at: r.at ?? '' });
  }

  const order = rankCompany(members.map((id) => ({ id, top: withTop.has(id), wants: wants.get(id)! })), seen, max);
  return {
    films: order.map((k) => info.get(k)).filter((f): f is PickFilm => Boolean(f)),
    noTop: members.filter((u) => !withTop.has(u)),
    blank: members.filter((u) => !withTop.has(u) && !history.has(u)),
  };
}

// ─── кто в компании ───────────────────────────────────────────────────────────

interface UserRow { id: string; tg_id: number | null; nick: string | null; first_name: string | null }
const label = (u: UserRow) => (u.nick ? `@${u.nick}` : (u.first_name ?? '').slice(0, 40) || '…');

export type CompanyAnswer =
  | { films: PickFilm[]; me: string; names: string[]; missing: string[]; old: string[]; meOld: boolean; blank: string[] }
  | { error: 'not_in_bot' | 'no_history' | 'nobody' | 'empty'; missing: string[]; blank?: string[] };

/** Подбор компании: `from` — Telegram id спросившего, остальные — по никам (без @, любым регистром) и по Telegram id
 *  (упоминание человека без ника в группе, собеседник в личке). `names`, `old`, `blank` — подписи (`@ник` или имя). */
export async function companyPick(env: Env, from: number, who: { nicks?: string[]; tgIds?: number[] },
  lookup: (key: string) => Known | undefined, max = MAX, minRated = MIN_RATED): Promise<CompanyAnswer> {
  const db = env.DB;
  const me = await db.prepare('SELECT id, tg_id, lower(username) AS nick, first_name FROM user WHERE tg_id = ?').bind(from).first<UserRow>();
  if (!me) return { error: 'not_in_bot', missing: [] };
  const nicks = [...new Set((who.nicks ?? []).map((n) => n.replace(/^@/, '').toLowerCase()))].filter((n) => n && n !== me.nick).slice(0, MAX_MEMBERS);
  const tgIds = [...new Set(who.tgIds ?? [])].filter((id) => Number.isSafeInteger(id) && id !== from).slice(0, MAX_MEMBERS);
  const byNick = nicks.length
    ? rowsOf<UserRow>(await db.prepare(`SELECT id, tg_id, lower(username) AS nick, first_name FROM user WHERE lower(username) IN (${nicks.map(() => '?').join(',')})`).bind(...nicks).all())
    : [];
  const byTg = tgIds.length
    ? rowsOf<UserRow>(await db.prepare(`SELECT id, tg_id, lower(username) AS nick, first_name FROM user WHERE tg_id IN (${tgIds.map(() => '?').join(',')})`).bind(...tgIds).all())
    : [];
  const found = [...new Map([...byNick, ...byTg].filter((u) => u.id !== me.id).map((u) => [u.id, u])).values()].slice(0, MAX_MEMBERS - 1);
  const missing = nicks.filter((n) => !byNick.some((u) => u.nick === n)).map((n) => `@${n}`);
  if (!found.length) return { error: 'nobody', missing };
  const own = await db.prepare('SELECT COUNT(*) AS n FROM rating WHERE user_id = ?').bind(me.id).first<{ n: number }>();
  if (Number(own?.n ?? 0) < minRated) return { error: 'no_history', missing };
  const r = await companyFilms(env, [me.id, ...found.map((u) => u.id)], lookup, max);
  const blank = found.filter((u) => r.blank.includes(u.id)).map(label);
  if (!r.films.length) return { error: 'empty', missing, blank };
  return {
    films: r.films, me: label(me), names: found.map(label), missing, blank,
    old: found.filter((u) => r.noTop.includes(u.id) && !r.blank.includes(u.id)).map(label), meOld: r.noTop.includes(me.id),
  };
}
const rowsOf = <T>(r: unknown): T[] => ((r as { results?: T[] }).results ?? []);
