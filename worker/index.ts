// API приложения: хранит то, что человек сделал сам, и ничего больше. Подбор по-прежнему
// считается на клиенте — сервер нужен, чтобы отметки, дневник, прогнозы и отклики
// переживали перезагрузку и переезд на другое устройство (трек А, ROADMAP §7).
//
// Чего здесь намеренно нет: каталога, разборов и замеров. Это общие данные, они лежат
// отдельно (R2) и раздаются как файлы — смешивать их с личными записями в одной базе
// незачем.
import { adminWebhook, prepareShare, telegramUpdate } from './inline';
import { memberInfo } from './inlineGroup';
import { publicPage } from './pages';
import { adminDigest, followDigest, forgetReference, getFollows, noteFresh, putFollow } from './follow';
import { getInbox, getRegistry, getRegistryLog, getRegistryVersion, getSources, postInbox, postInboxResult, postRegistry } from './registry';
import { newId, newToken, tokenHash, verifyInitData } from './auth';
import type { D1Database, Env, OwnerSeed, UserSeed } from './env';
import { useBot } from './env';
import { migrate } from './migrate';
import { canonCard, canonWork } from './workAliases';
import { setSlimCards, slimCardText } from './retention';
import { getFunnel, noteVisit, postEvent } from './funnel';
import { getGrowth, seedingRoute } from './growthRoute';
import { deleteAccount } from './account';
import { noteInvite } from './invite';
import { togetherRoute } from './together';
import { putTasteTop } from './togetherPick';
import { probe } from './probe';
import { forgetTrailers, getTrailers } from './trailers';
// сервер bothost сбрасывает проверку колонок после восстановления базы из копии (server/backup.js)
export { forgetMigrations } from './migrate';
// 18.10 (аудит скорости, волна 3): сервер bothost прогоняет миграции и долгую работу с базой в отдельном потоке
// (server/db-thread.js) — там нужны сами функции, а не fetch
export { migrate, assumeMigrated, INDEXES } from './migrate';
export { rollupImpressions, slimCards, ROLLUP_TABLE } from './retention';
import { loopReport, loopRows } from './loop';

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' };

const json = (data: unknown, status = 200, extra: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(data), { status, headers: { ...JSON_HEADERS, ...extra } });

const now = () => new Date().toISOString();

/** Кому отвечаем на кросс-доменные запросы. По умолчанию — только своему домену, то есть
 *  никому: приложение и API лежат под одним адресом. Для разработки список задаётся в
 *  `ALLOWED_ORIGINS`, иначе браузер не пустит vite к воркеру. */
function cors(req: Request, env: Env): Record<string, string> {
  const origin = req.headers.get('Origin');
  const allowed = (env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!origin || !allowed.includes(origin)) return {};
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-headers': 'content-type, authorization',
    'access-control-allow-methods': 'GET, PUT, POST, DELETE, OPTIONS',
    'access-control-max-age': '86400',
    vary: 'Origin',
  };
}

interface User { id: string; settings: string }

/** Кто спрашивает. Токен приходит заголовком `Authorization: Bearer`; протухшие сессии
 *  убираем сразу, чтобы таблица не росла мусором. */
async function whoIs(req: Request, db: D1Database): Promise<User | undefined> {
  const token = /^Bearer\s+(.+)$/i.exec(req.headers.get('Authorization') ?? '')?.[1];
  if (!token) return undefined;
  const hashed = await tokenHash(token);
  // Только по хешу (ХБ, 17.10). Сырые токены сессий до 16.10 переводит migrate() при первом запросе после выкладки,
  // а искать ещё и по сырому значению нельзя: тогда хеш из копии базы подходил бы как Bearer, и смысл хеширования пропадал
  const row = await db.prepare(
    `SELECT user.id AS id, user.settings AS settings, session.expires_at AS expires_at
       FROM session JOIN user ON user.id = session.user_id WHERE session.token = ?`,
  ).bind(hashed).first<{ id: string; settings: string; expires_at: string }>();
  if (!row) return undefined;
  if (Date.parse(row.expires_at) < Date.now()) {
    await db.prepare('DELETE FROM session WHERE token = ?').bind(hashed).run();
    return undefined;
  }
  return { id: row.id, settings: row.settings };
}

const SESSION_DAYS = 90;

async function openSession(db: D1Database, userId: string): Promise<{ token: string; expiresAt: string }> {
  const token = newToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400e3).toISOString();
  // предел (ХБ, 16.10): протухшие уходят, у участника — не больше десяти живых сессий, самые старые снимаются
  await db.batch([
    db.prepare('DELETE FROM session WHERE expires_at < ?').bind(now()),
    db.prepare('DELETE FROM session WHERE user_id = ? AND token NOT IN (SELECT token FROM session WHERE user_id = ? ORDER BY created_at DESC LIMIT 9)').bind(userId, userId),
    db.prepare('INSERT INTO session (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)').bind(await tokenHash(token), userId, now(), expiresAt),
  ]);
  return { token, expiresAt };
}

/** Вход. Либо подпись Telegram, либо (только если явно разрешено) демо-участник: без него
 *  нельзя ни разрабатывать, ни прогонять проверки в обычном браузере. */
async function postSession(req: Request, env: Env): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as { initData?: string; demo?: boolean };
  const db = env.DB;

  if (body.initData) {
    if (!env.BOT_TOKEN) return json({ error: 'server_not_configured' }, 500);
    const check = await verifyInitData(body.initData, env.BOT_TOKEN);
    if (!check.ok || !check.user) return json({ error: 'bad_init_data', reason: check.reason }, 401);
    const tg = check.user;
    const found = await db.prepare('SELECT id FROM user WHERE tg_id = ?').bind(tg.id).first<{ id: string }>();
    const id = found?.id ?? newId('u');
    if (found) {
      await db.prepare('UPDATE user SET seen_at = ?, username = ?, first_name = ? WHERE id = ?')
        .bind(now(), tg.username ?? null, tg.first_name ?? null, id).run();
    } else {
      await db.prepare('INSERT INTO user (id, tg_id, username, first_name, created_at, seen_at) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(id, tg.id, tg.username ?? null, tg.first_name ?? null, now(), now()).run();
      // новый участник пришёл по чьей-то ссылке (ЗП-37) — запомнить, кто привёл
      await noteInvite(db, id, check.startParam);
    }
    const owner = isOwner(env, tg.username, tg.id);
    if (owner && env.OWNER_SEED) await seedOwner(db, id, env.OWNER_SEED);
    const session = await openSession(db, id);
    return json({ ...session, user: { id, username: tg.username, firstName: tg.first_name, telegram: true, owner } });
  }

  // Вне Telegram — анонимный участник, свой на каждый браузер: токен живёт в localStorage,
  // поэтому оценки и отметки переживают перезагрузку, но чужим не видны. Общий демо-профиль
  // здесь не годится: первый же гость испортил бы подбор второму.
  if (body.demo) {
    if (env.ALLOW_DEMO !== '1') return json({ error: 'demo_disabled' }, 403);
    const id = newId('u-anon');
    await db.prepare('INSERT INTO user (id, tg_id, username, first_name, created_at, seen_at) VALUES (?, NULL, NULL, ?, ?, ?)')
      .bind(id, 'Гость', now(), now()).run();
    const session = await openSession(db, id);
    return json({ ...session, user: { id, firstName: 'Гость', telegram: false } });
  }

  return json({ error: 'no_credentials' }, 400);
}

/** Владелец (ХБ, 16.10): по номеру аккаунта Telegram `OWNER_TG_ID` — ник можно сменить, а освобождённый занять, и
 *  вместе с ним получить роль админа. Пока `OWNER_TG_ID` не задан — по нику, как раньше. */
const isOwner = (env: Env, username?: string | null, tgId?: number | null): boolean => {
  const id = env.OWNER_TG_ID?.trim();
  if (id) return tgId != null && String(tgId) === id;
  return Boolean(username && env.OWNER_USERNAME && username.toLowerCase() === env.OWNER_USERNAME.replace(/^@/, '').toLowerCase());
};

/** Категории участников (ТВ-3в, 06.10). Админ — владелец (OWNER_USERNAME): всё, включая статистику и
 *  механику трансформативного обучения. Тестер — из таблицы `tester`: все полки, без статистики и
 *  механики. Остальные — участник: полки по доле выката. */
export type Role = 'admin' | 'tester' | 'user';
const nick = (s: string) => s.trim().replace(/^@/, '').toLowerCase();
async function roleOf(env: Env, username?: string | null, tgId?: number | null): Promise<Role> {
  if (isOwner(env, username, tgId)) return 'admin';
  if (!username) return 'user';
  // тестер — по нику, но при первом входе запоминается номер аккаунта (ХБ, 16.10): тот, кто займёт освободившийся ник,
  // тестером не станет
  const t = await env.DB.prepare('SELECT tg_id FROM tester WHERE username = ?').bind(nick(username)).first<{ tg_id: number | null }>();
  if (!t) return 'user';
  if (t.tg_id == null && tgId != null) {
    await env.DB.prepare('UPDATE tester SET tg_id = ? WHERE username = ? AND tg_id IS NULL').bind(tgId, nick(username)).run();
    return 'tester';
  }
  return t.tg_id === tgId ? 'tester' : 'user';
}

/** История владельца, которая до сервера жила только в моках фронтенда, переезжает в его
 *  профиль один раз — при первом входе, пока профиль пуст. Дальше это обычные записи: их
 *  можно снять, поправить, дополнить, и повторный вход их не вернёт. */
async function seedOwner(db: D1Database, userId: string, seed: OwnerSeed): Promise<void> {
  const has = await db.prepare(
    'SELECT (SELECT COUNT(*) FROM journal WHERE user_id = ?1) + (SELECT COUNT(*) FROM rating WHERE user_id = ?1) + (SELECT COUNT(*) FROM watched WHERE user_id = ?1) AS n',
  ).bind(userId).first<{ n: number }>();
  if (has && has.n > 0) return;
  const at = now();
  const statements = [
    // история собрана из карточек истории (u-kp…, l-tmdb…) — на главные копии (канон копий, 17.10)
    ...seed.journal.map((e) => db.prepare(
      'INSERT OR IGNORE INTO journal (user_id, entry_id, work_id, work, status, started_at, finished_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).bind(userId, e.entryId, canonWork(e.workId), slimCardText(JSON.stringify(canonCard(e.work, canonWork(e.workId)))), e.status, e.startedAt ?? null, e.finishedAt ?? null)),
    ...seed.ratings.map((r) => db.prepare(
      'INSERT OR IGNORE INTO rating (user_id, work_id, rating, raw, at) VALUES (?, ?, ?, ?, ?)',
    ).bind(userId, canonWork(r.workId), r.rating, r.raw ?? null, at)),
    // порядок присланного списка сохраняем временем отметки: первое в списке — самое свежее
    ...seed.watched.map((w, i) => db.prepare(
      'INSERT OR IGNORE INTO watched (user_id, work_id, state, work, tmdb, imdb, at) VALUES (?, ?, \'watched\', ?, ?, ?, ?)',
    ).bind(userId, canonWork(w.workId), slimCardText(JSON.stringify(canonCard(w.work, canonWork(w.workId)))), w.tmdb ?? null, w.imdb ?? null, new Date(Date.parse(at) - i * 1000).toISOString())),
  ];
  if (statements.length) await db.batch(statements);
}

/** Ник → имя файла присланного списка. Ник Telegram: латиница, цифры, подчёркивание. */
const seedKey = (username: string): string | undefined =>
  /^[A-Za-z0-9_]{3,40}$/.test(username) ? `seed--${username.toLowerCase()}.json` : undefined;

/** Присланный список просмотренного (UserSeed) ложится в профиль при входе участника — по
 *  разу на версию списка. Добавляет, не перетирая: что участник уже отметил или снял сам,
 *  остаётся как есть. */
async function applyUserSeed(db: D1Database, env: Env, userId: string): Promise<void> {
  if (!env.REFERENCE) return;
  const row = await db.prepare('SELECT username FROM user WHERE id = ?').bind(userId).first<{ username: string | null }>();
  const key = row?.username ? seedKey(row.username) : undefined;
  if (!key) return;
  const object = await env.REFERENCE.get(key);
  if (!object) return;
  // список привязан к нику; кто займёт освободившийся ник, чужую историю не получит (ХБ, 16.10): первый аккаунт, которому
  // список лёг, запоминается отметкой `nick:<ник>`, другим он больше не кладётся
  const bind = `nick:${row!.username!.toLowerCase()}`;
  const other = await db.prepare('SELECT 1 AS x FROM seed_applied WHERE seed = ? AND user_id <> ?').bind(bind, userId).first();
  if (other) return;
  // привязку ставим сразу, ещё до проверки версии: у тех, кому список лёг до 16.10, её не было
  await db.prepare('INSERT OR IGNORE INTO seed_applied (user_id, seed, at) VALUES (?, ?, ?)').bind(userId, bind, now()).run();
  const seed = JSON.parse(await new Response(object.body).text()) as UserSeed;
  const mark = `user:${seed.version}`;
  const done = await db.prepare('SELECT 1 AS x FROM seed_applied WHERE user_id = ? AND seed = ?').bind(userId, mark).first();
  if (done) return;
  const at = Date.parse(now());
  const stamp = (i: number) => new Date(at - (i + 1) * 1000).toISOString();
  await db.batch([
    ...seed.watched.map((w, i) => db.prepare(
      'INSERT OR IGNORE INTO watched (user_id, work_id, state, work, tmdb, imdb, at) VALUES (?, ?, \'watched\', ?, ?, ?, ?)',
    ).bind(userId, canonWork(w.workId), slimCardText(JSON.stringify(canonCard(w.work, canonWork(w.workId)))), w.tmdb ?? null, w.imdb ?? null, stamp(i))),
    ...(seed.ratings ?? []).map((r) => db.prepare(
      'INSERT OR IGNORE INTO rating (user_id, work_id, rating, raw, work, at) VALUES (?, ?, ?, ?, ?, ?)',
    ).bind(userId, canonWork(r.workId), r.rating, r.raw ?? null, r.work ? slimCardText(JSON.stringify(canonCard(r.work, canonWork(r.workId)))) : null, new Date(at).toISOString())),
    db.prepare('INSERT OR IGNORE INTO seed_applied (user_id, seed, at) VALUES (?, ?, ?)').bind(userId, mark, now()),
  ]);
}

/** Положить присланный список участника (только сборщик владельца, по токену). */
async function putUserSeed(req: Request, env: Env, username: string): Promise<Response> {
  const token = /^Bearer\s+(.+)$/i.exec(req.headers.get('Authorization') ?? '')?.[1];
  if (!env.ADMIN_TOKEN || !token || !sameToken(token, env.ADMIN_TOKEN)) return json({ error: 'unauthorized' }, 401);
  const key = seedKey(username);
  if (!key) return json({ error: 'bad_username' }, 400);
  if (!env.REFERENCE) return json({ error: 'no_reference_bucket' }, 500);
  const text = await req.text();
  let seed: UserSeed;
  try { seed = JSON.parse(text) as UserSeed; } catch { return json({ error: 'bad_json' }, 400); }
  if (!seed.version || !Array.isArray(seed.watched)) return json({ error: 'bad_seed' }, 400);
  await env.REFERENCE.put(key, text);
  // уже заходил — сразу скажем, разложится ли при следующем входе
  const known = await env.DB.prepare('SELECT 1 AS x FROM user WHERE lower(username) = ?').bind(username.toLowerCase()).first();
  return json({ ok: true, username, watched: seed.watched.length, ratings: seed.ratings?.length ?? 0, known: Boolean(known) });
}

/** Оценка уже виденного: 1–5 или null — снять. Карточку кладём рядом, как у отметки. */
async function putRating(req: Request, user: User, db: D1Database, rawId: string): Promise<Response> {
  // старый клиент шлёт id лишней копии (канон копий, 17.10) — запись ложится на главную
  const workId = canonWork(rawId);
  const body = (await req.json().catch(() => ({}))) as { rating?: number | null; raw?: number; work?: unknown };
  if (body.rating == null) {
    await db.prepare('DELETE FROM rating WHERE user_id = ? AND work_id = ?').bind(user.id, workId).run();
    return json({ ok: true });
  }
  const rating = Math.round(Number(body.rating));
  if (!(rating >= 1 && rating <= 5)) return json({ error: 'bad_rating' }, 400);
  await db.prepare(
    `INSERT INTO rating (user_id, work_id, rating, raw, work, at) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (user_id, work_id) DO UPDATE SET rating = excluded.rating, raw = excluded.raw, work = COALESCE(excluded.work, rating.work), at = excluded.at`,
  ).bind(user.id, workId, rating, body.raw ?? null, body.work ? slimCardText(JSON.stringify(canonCard(body.work, workId))) : null, now()).run();
  return json({ ok: true });
}

/** Послесловие к просмотренному (17.10, решение владельца): «стоило ли» 1–5, темп и что зацепило — одна строка на
 *  произведение (src/types/tmdf.ts, Afterword). Тело — заплатка: значение пишется, null снимает, нет поля — не трогаем.
 *  Все три пустые после слияния — строки нет. Слияние — в самом upsert, без чтения перед записью. */
const AFTER_PACE = new Set(['slow', 'ok', 'fast']);
const AFTER_HOOK = new Set(['plot', 'characters', 'world', 'idea']);
/** Ключ произведения в адресе (17.10): тот же предел, что режут чек-ин и импорт, — 120 знаков, без пробелов. */
const AFTER_WORK = /^\S{1,120}$/;
type AfterRow = { worth: number | null; pace: string | null; hook: string | null; at: string };
const afterwordOf = (r: AfterRow) => ({
  ...(r.worth != null ? { worth: r.worth } : {}), ...(r.pace ? { pace: r.pace } : {}), ...(r.hook ? { hook: r.hook } : {}), at: r.at,
});

async function putAfterword(req: Request, user: User, db: D1Database, rawId: string): Promise<Response> {
  let workId: string;
  try { workId = decodeURIComponent(rawId); } catch { return json({ error: 'bad_work' }, 400); }
  if (!AFTER_WORK.test(workId)) return json({ error: 'bad_work' }, 400);
  workId = canonWork(workId);
  const raw = await req.json().catch(() => undefined);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return json({ error: 'bad_afterword' }, 400);
  const b = raw as Record<string, unknown>;
  const has = (k: string) => Object.prototype.hasOwnProperty.call(b, k) && b[k] !== undefined;
  if (!has('worth') && !has('pace') && !has('hook')) return json({ error: 'empty' }, 400);
  if (has('worth') && b.worth !== null && !(Number.isInteger(b.worth) && (b.worth as number) >= 1 && (b.worth as number) <= 5)) {
    return json({ error: 'bad_worth' }, 400);
  }
  if (has('pace') && b.pace !== null && !(typeof b.pace === 'string' && AFTER_PACE.has(b.pace))) return json({ error: 'bad_pace' }, 400);
  if (has('hook') && b.hook !== null && !(typeof b.hook === 'string' && AFTER_HOOK.has(b.hook))) return json({ error: 'bad_hook' }, 400);
  // keep = 1 — поля в заплатке нет, у имеющейся строки оно остаётся
  const val = (k: string) => (has(k) ? b[k] as string | number | null : null);
  const keep = (k: string) => (has(k) ? 0 : 1);
  await db.batch([
    db.prepare(
      `INSERT INTO afterword (user_id, work_id, worth, pace, hook, at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)
       ON CONFLICT (user_id, work_id) DO UPDATE SET
         worth = CASE WHEN ?7 THEN afterword.worth ELSE excluded.worth END,
         pace = CASE WHEN ?8 THEN afterword.pace ELSE excluded.pace END,
         hook = CASE WHEN ?9 THEN afterword.hook ELSE excluded.hook END,
         at = excluded.at`,
    ).bind(user.id, workId, val('worth'), val('pace'), val('hook'), now(), keep('worth'), keep('pace'), keep('hook')),
    db.prepare('DELETE FROM afterword WHERE user_id = ? AND work_id = ? AND worth IS NULL AND pace IS NULL AND hook IS NULL').bind(user.id, workId),
  ]);
  const row = await db.prepare('SELECT worth, pace, hook, at FROM afterword WHERE user_id = ? AND work_id = ?').bind(user.id, workId).first<AfterRow>();
  return json({ ok: true, afterword: row ? afterwordOf(row) : null });
}

/** Показы слейта: что человек увидел и на каком месте. Пишем пачкой — один запрос на ленту. */
/** Уровень сложности произведения (1–10) и его признаки — операции с интенсивностью и регистры (МА-1/МА-2,
 *  worker/metrics.ts). Приходят от клиента: только обрезаем до разумного, чужое — null. */
/** id произведения из тела запроса — на главную копию (канон копий, 17.10); нет — null. */
const canonOrNull = (v: unknown): string | null => (typeof v === 'string' && v ? canonWork(v) : null);
const levelOf = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= 10 ? Math.round(v * 10) / 10 : null);
function traitsOf(v: unknown): string | null {
  if (!v || typeof v !== 'object') return null;
  const t = v as { op?: unknown; rg?: unknown };
  const op: Record<string, number> = {};
  if (t.op && typeof t.op === 'object') {
    for (const [k, x] of Object.entries(t.op as Record<string, unknown>).slice(0, 12)) {
      if (/^[a-z_]{1,32}$/.test(k) && typeof x === 'number' && Number.isFinite(x) && x > 0) op[k] = Math.min(3, Math.round(x * 100) / 100);
    }
  }
  const rg = Array.isArray(t.rg) ? t.rg.filter((r): r is string => typeof r === 'string' && /^[a-z_]{1,32}$/.test(r)).slice(0, 8) : [];
  return Object.keys(op).length || rg.length ? JSON.stringify({ ...(Object.keys(op).length ? { op } : {}), ...(rg.length ? { rg } : {}) }) : null;
}

/** Снимок карты (МА-1): пишем, только если карта изменилась с прошлого снимка — первый и есть старт. */
async function noteLevelState(db: D1Database, userId: string, v: unknown, at: string): Promise<void> {
  if (!v || typeof v !== 'object') return;
  const s = v as Record<string, unknown>;
  const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= 10 ? Math.round(x * 10) / 10 : null);
  const center = num(s.center), lo = num(s.lo), hi = num(s.hi), median = num(s.median);
  const n = typeof s.n === 'number' && Number.isInteger(s.n) && s.n >= 0 ? Math.min(s.n, 100000) : null;
  if (center == null || lo == null || hi == null || n == null || lo > hi) return;
  const last = await db.prepare('SELECT center, lo, hi, median, n FROM level_state WHERE user_id = ? ORDER BY at DESC LIMIT 1')
    .bind(userId).first<{ center: number; lo: number; hi: number; median: number | null; n: number }>();
  if (last && last.center === center && last.lo === lo && last.hi === hi && last.median === median && last.n === n) return;
  await db.prepare('INSERT OR IGNORE INTO level_state (user_id, at, center, lo, hi, median, n) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(userId, at, center, lo, hi, median, n).run();
}

async function postImpressions(req: Request, user: User, db: D1Database): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as {
    slateId?: string; energy?: string; state?: unknown;
    items?: { recId?: string; workId?: string; slot?: string; rank?: number; level?: unknown; traits?: unknown }[];
  };
  // поля — короткие метки из своего словаря, но приходят от клиента (ХБ, 17.10): длину и форму проверяем, иначе один запрос
  // клал 20 копий строки любого размера
  const short = (v: unknown, max: number) => (typeof v === 'string' && v.length > 0 && v.length <= max ? v : undefined);
  const items = (Array.isArray(body.items) ? body.items : []).filter((i) => i && short(i.recId, 120) && short(i.workId, 120)).slice(0, 20);
  const slateId = short(body.slateId, 120);
  if (!slateId || !items.length) return json({ error: 'no_items' }, 400);
  const energy = typeof body.energy === 'string' && /^[\w-]{1,32}$/.test(body.energy) ? body.energy : null;
  const at = now();
  await db.batch(items.map((i) => db.prepare(
    'INSERT INTO impression (id, user_id, slate_id, rec_id, work_id, slot, rank, energy, at, level, traits) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  ).bind(newId('i'), user.id, slateId, i.recId, canonWork(i.workId!), short(i.slot, 64) ?? null, typeof i.rank === 'number' && Number.isFinite(i.rank) ? i.rank : null, energy, at, levelOf(i.level), traitsOf(i.traits))));
  await noteLevelState(db, user.id, body.state, at);
  return json({ ok: true, n: items.length });
}

/** Открытие материала (ТВ-3г): ролик или пост, его рубрика и откуда открыли. Поля — короткие
 *  строки из нашего же словаря, поэтому только обрезаем длину. */
async function postOpen(req: Request, user: User, db: D1Database): Promise<Response> {
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const str = (v: unknown, n = 64) => (typeof v === 'string' && v ? v.slice(0, n) : null);
  const url = str(b.url, 500);
  if (!url) return json({ error: 'no_url' }, 400);
  const minutes = typeof b.minutes === 'number' && b.minutes > 0 ? Math.min(Math.round(b.minutes), 24 * 60) : null;
  const id = newId('o');
  await db.prepare(
    'INSERT INTO material_open (id, user_id, url, work_id, platform, lens, lens_also, tier, place, shelf, shelves, at, voice_id, minutes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  ).bind(id, user.id, url, canonOrNull(str(b.workId, 120)), str(b.platform), str(b.lens), str(b.lensAlso), str(b.tier), str(b.place), str(b.shelf),
    b.shelves ? 1 : 0, now(), str(b.voiceId, 120), minutes).run();
  // id — чтобы клиент дописал, сколько человек был снаружи (МА-3, `POST /api/open/<id>/dwell`)
  return json({ ok: true, id });
}

/** Человек вернулся из открытого материала (МА-3): секунды снаружи. Пишется один раз и только своё; больше четырёх
 *  часов — уже не чтение, а ушёл по делам: обрезаем. */
async function postDwell(req: Request, user: User, db: D1Database, id: string): Promise<Response> {
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const s = typeof b.seconds === 'number' && Number.isFinite(b.seconds) && b.seconds >= 0 ? Math.min(Math.round(b.seconds), 4 * 3600) : null;
  if (s == null) return json({ error: 'bad_seconds' }, 400);
  await db.prepare('UPDATE material_open SET dwell = ? WHERE id = ? AND user_id = ? AND dwell IS NULL').bind(s, id, user.id).run();
  return json({ ok: true });
}

/** Отчёт петли прогноза — статистика, только админу (ТВ-3в, 06.10; раньше остальные видели отчёт по себе). */
async function getLoopReport(url: URL, user: User, env: Env): Promise<Response> {
  if (!(await ownerOnly(user, env))) return json({ error: 'owner_only' }, 403);
  const all = url.searchParams.get('scope') !== 'me';
  return json({ scope: all ? 'all' : 'me', ...loopReport(await loopRows(env.DB, all ? undefined : user.id)) });
}

/** Всё состояние участника одним ответом: клиент раскладывает его по своим структурам при
 *  запуске. Один запрос вместо шести — на телефоне это ощутимо, а данных здесь немного. */
async function getState(user: User, db: D1Database, env: Env): Promise<Response> {
  // присланный список — до чтения профиля, чтобы первый же ответ его уже содержал; не
  // разложился — профиль важнее, попробуем при следующем входе
  await applyUserSeed(db, env, user.id).catch((err) => console.error('seed', user.id, err));
  const [watched, journal, predictions, verdicts, ratings, profile, dismissals, visits, afterwords] = await Promise.all([
    db.prepare('SELECT work_id, state, work FROM watched WHERE user_id = ? ORDER BY at DESC').bind(user.id).all<{ work_id: string; state: string; work: string | null }>(),
    db.prepare('SELECT entry_id, work_id, work, status, progress, started_at, finished_at, eagerness, inferred, series FROM journal WHERE user_id = ?').bind(user.id).all<Record<string, unknown>>(),
    db.prepare('SELECT entry_id, work_id, expected, model, model_p, at FROM prediction WHERE user_id = ?').bind(user.id).all<Record<string, unknown>>(),
    db.prepare('SELECT url, verdict FROM link_verdict WHERE user_id = ?').bind(user.id).all<{ url: string; verdict: string }>(),
    db.prepare('SELECT work_id, rating, raw, work, at FROM rating WHERE user_id = ? ORDER BY at').bind(user.id).all<{ work_id: string; rating: number; raw: number | null; work: string | null; at: string }>(),
    db.prepare('SELECT username, first_name, tg_id FROM user WHERE id = ?').bind(user.id).first<{ username: string | null; first_name: string | null; tg_id: number | null }>(),
    // отказы на фильмы ленты (10.10): последний по каждому фильму за полгода — клиент не берёт их в ленту
    // на срок по причине (src/api/index.ts, `hiddenFromFeed`); «Видел» здесь не нужен — он уже в оценках
    db.prepare(`SELECT work_id, reason, MAX(at) AS at FROM feedback
                WHERE user_id = ? AND action = 'dismiss' AND work_id IS NOT NULL AND coalesce(reason, '') <> 'already_know' AND at >= ?
                GROUP BY work_id`).bind(user.id, new Date(Date.now() - 183 * 864e5).toISOString()).all<{ work_id: string; reason: string | null; at: string }>(),
    // дни захода (ДФ-3): с третьего клиент предлагает ярлык на экран телефона
    db.prepare('SELECT COUNT(*) AS n FROM visit WHERE user_id = ?').bind(user.id).first<{ n: number }>(),
    // послесловие к просмотренному (17.10)
    db.prepare('SELECT work_id, worth, pace, hook, at FROM afterword WHERE user_id = ? ORDER BY at').bind(user.id).all<AfterRow & { work_id: string }>(),
  ]);
  const parse = (raw: unknown) => (typeof raw === 'string' ? JSON.parse(raw) : undefined);
  return json({
    settings: parse(user.settings) ?? {},
    watched: watched.results.map((r) => ({ workId: r.work_id, watched: r.state === 'watched', work: parse(r.work) })),
    journal: journal.results.map((r) => ({ ...r, work: parse(r.work), series: parse(r.series) })),
    predictions: predictions.results,
    verdicts: verdicts.results,
    dismissals: dismissals.results.map((r) => ({ workId: r.work_id, ...(r.reason ? { reason: r.reason } : {}), at: r.at })),
    ratings: ratings.results.map((r) => ({ workId: r.work_id, rating: r.rating, ...(r.raw != null ? { raw: r.raw } : {}), work: parse(r.work), at: r.at })),
    afterwords: afterwords.results.map((r) => ({ workId: r.work_id, ...afterwordOf(r) })),
    profile: {
      username: profile?.username ?? undefined,
      firstName: profile?.first_name ?? undefined,
      telegram: profile?.tg_id != null,
      owner: isOwner(env, profile?.username, profile?.tg_id),
      role: await roleOf(env, profile?.username, profile?.tg_id),
      visitDays: visits?.n ?? 0,
    },
  });
}

async function putSettings(req: Request, user: User, db: D1Database): Promise<Response> {
  // только объект (ХБ, 17.10): строка или массив раскладывались в ключи «0», «1», …; и потолок после слияния
  const raw = await req.json().catch(() => undefined);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return json({ error: 'bad_settings' }, 400);
  const patch = raw as Record<string, unknown>;
  const current = JSON.parse(user.settings || '{}') as Record<string, unknown>;
  const merged = { ...current, ...patch };
  const text = JSON.stringify(merged);
  if (text.length > 32_000) return json({ error: 'too_large' }, 413);
  await db.prepare('UPDATE user SET settings = ?, seen_at = ? WHERE id = ?').bind(text, now(), user.id).run();
  return json(merged);
}

async function putWatched(req: Request, user: User, db: D1Database, rawId: string): Promise<Response> {
  const workId = canonWork(rawId);
  const body = (await req.json().catch(() => ({}))) as { watched?: boolean; work?: unknown; tmdb?: number; imdb?: string };
  await db.prepare(
    `INSERT INTO watched (user_id, work_id, state, work, tmdb, imdb, at) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (user_id, work_id) DO UPDATE SET state = excluded.state, work = COALESCE(excluded.work, watched.work), at = excluded.at`,
  ).bind(user.id, workId, body.watched === false ? 'removed' : 'watched',
    body.work ? slimCardText(JSON.stringify(canonCard(body.work, workId))) : null, body.tmdb ?? null, body.imdb ?? null, now()).run();
  return json({ ok: true });
}

/** Старт просмотра вместе с прогнозом: одним запросом, потому что это одно событие. */
async function postStart(req: Request, user: User, db: D1Database): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as {
    entryId?: string; workId?: string; work?: unknown; expected?: string; model?: string; modelOdds?: unknown; startedAt?: string;
    inferred?: boolean;
  };
  if (!body.workId) return json({ error: 'no_work' }, 400);
  body.workId = canonWork(body.workId);
  if (body.work) body.work = canonCard(body.work, body.workId);
  const entryId = body.entryId ?? newId('j');
  await db.prepare(
    `INSERT INTO journal (user_id, entry_id, work_id, work, status, started_at, inferred) VALUES (?, ?, ?, ?, 'in_progress', ?, ?)
     ON CONFLICT (user_id, entry_id) DO UPDATE SET status = 'in_progress', started_at = excluded.started_at, inferred = excluded.inferred`,
  ).bind(user.id, entryId, body.workId, body.work ? slimCardText(JSON.stringify(body.work)) : null, body.startedAt ?? now(), body.inferred ? 1 : null).run();
  if (body.expected || body.model) {
    await db.prepare(
      `INSERT INTO prediction (user_id, entry_id, work_id, expected, model, model_p, at) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (user_id, entry_id) DO UPDATE SET expected = excluded.expected, model = excluded.model, model_p = excluded.model_p`,
    ).bind(user.id, entryId, body.workId, body.expected ?? null, body.model ?? null,
      body.modelOdds ? JSON.stringify(body.modelOdds) : null, now()).run();
  }
  return json({ entryId });
}

/** «В планы»: запись дневника со статусом planned. Повтор с тем же entryId ничего не меняет;
 *  «Начать» потом переводит ту же запись в in_progress (postStart), и «хочется» остаётся при
 *  ней — так петля видит, доходят ли до того, чего хотелось. */
async function postPlan(req: Request, user: User, db: D1Database): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as { entryId?: string; workId?: string; work?: unknown; eagerness?: number };
  if (!body.workId) return json({ error: 'no_work' }, 400);
  body.workId = canonWork(body.workId);
  if (body.work) body.work = canonCard(body.work, body.workId);
  const entryId = body.entryId ?? newId('j');
  const eager = Number.isInteger(body.eagerness) && body.eagerness! >= 1 && body.eagerness! <= 5 ? body.eagerness! : null;
  await db.prepare(
    `INSERT INTO journal (user_id, entry_id, work_id, work, status, started_at, eagerness) VALUES (?, ?, ?, ?, 'planned', ?, ?)
     ON CONFLICT (user_id, entry_id) DO NOTHING`,
  ).bind(user.id, entryId, body.workId, body.work ? slimCardText(JSON.stringify(body.work)) : null, now(), eager).run();
  return json({ entryId });
}

/** «Ещё не смотрел»: начатое (обычно выведенное из перехода в кинотеатр) возвращается в
 *  планы. Это не бросок и не ошибка подбора — человека отвлекли, — поэтому отдельный статус
 *  чек-ина, `not_watched`; `expired` — вопрос так и остался без ответа; `undo` — отмена сразу
 *  после нажатия, её в наблюдения не пишем вовсе. */
async function postUnstart(req: Request, user: User, db: D1Database, entryId: string): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as { workId?: string; reason?: string };
  const reason = body.reason === 'expired' || body.reason === 'undo' ? body.reason : 'not_watched';
  const row = await db.prepare('SELECT work_id, status FROM journal WHERE user_id = ? AND entry_id = ?').bind(user.id, entryId)
    .first<{ work_id: string; status: string }>();
  if (!row || row.status !== 'in_progress') return json({ ok: true, changed: false });
  await db.prepare("UPDATE journal SET status = 'planned', inferred = NULL WHERE user_id = ? AND entry_id = ?").bind(user.id, entryId).run();
  if (reason !== 'undo') {
    await db.prepare('INSERT INTO checkin (id, user_id, entry_id, work_id, status, perceived, reason, payload, at) VALUES (?, ?, ?, ?, ?, NULL, NULL, NULL, ?)')
      .bind(newId('c'), user.id, entryId, row.work_id, reason, now()).run();
  }
  return json({ ok: true, changed: true });
}

/** Убрать из планов — отмена «в планы» или передумал. Начатое и досмотренное так не удалить. */
async function deletePlan(user: User, db: D1Database, entryId: string): Promise<Response> {
  await db.prepare("DELETE FROM journal WHERE user_id = ? AND entry_id = ? AND status = 'planned'").bind(user.id, entryId).run();
  return json({ ok: true });
}

/** Чек-ин. Пишем каждый, а не последний: человек может передумать, и это тоже наблюдение —
 *  на нём же потом считается калибровка прогноза (трек Б). */
/** Статусы чек-ина, которые шлёт приложение (src/api/index.ts checkIn): целое досмотрено/брошено, либо сезон или часть. */
const CHECKIN_STATUS = new Set(['finished', 'abandoned', 'season_finished', 'part_finished']);

async function postCheckIn(req: Request, user: User, db: D1Database, entryId: string): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as {
    workId?: string; status?: string; perceived?: string; reason?: string; progress?: number; payload?: unknown;
    /** сериал (Е3): где человек после чек-ина; `season_finished` — досмотрен сезон, а не сериал */
    series?: unknown;
    /** книга (З5): часть и страница; `part_finished` — дочитана часть, а не книга */
    book?: unknown;
    /** МА-1/МА-2: уровень и признаки произведения; ДФ-10: «стоило ли» 1–5 и причина при 1–2 */
    level?: unknown; traits?: unknown; worth?: unknown; worthWhy?: unknown;
  };
  const worth = Number.isInteger(body.worth) && (body.worth as number) >= 1 && (body.worth as number) <= 5 ? body.worth as number : null;
  const worthWhy = worth != null && worth <= 2 && typeof body.worthWhy === 'string' && /^[a-z_]{1,32}$/.test(body.worthWhy) ? body.worthWhy : null;
  const status = body.status ?? 'finished';
  // статус — из своего списка, и проверяем до записи (ХБ, 17.10): раньше чужой статус ложился в checkin, а UPDATE дневника
  // падал на CHECK — 500 и осиротевшая строка
  if (!CHECKIN_STATUS.has(status)) return json({ error: 'bad_status' }, 400);
  // сезон или часть дочитаны, а целое — нет: чек-ин пишем, запись дневника остаётся «смотрю/читаю»
  const journalStatus = status === 'season_finished' || status === 'part_finished' ? 'in_progress' : status;
  const series = body.book ? bookJson(body.book) : seriesJson(body.series);
  const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : null);
  const workId = canonWork(str(body.workId, 120) ?? '');
  const at = now();
  // чек-ин и запись дневника — одним пакетом: либо оба, либо ничего
  await db.batch([
    db.prepare('INSERT INTO checkin (id, user_id, entry_id, work_id, status, perceived, reason, payload, at, level, traits, worth, worth_why) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(newId('c'), user.id, entryId, workId, status, str(body.perceived, 64), str(body.reason, 64),
        body.payload ? JSON.stringify(body.payload).slice(0, 4000) : null, at, levelOf(body.level), traitsOf(body.traits), worth, worthWhy),
    db.prepare(
      `UPDATE journal SET status = ?, progress = COALESCE(?, progress), series = COALESCE(?, series), finished_at = ? WHERE user_id = ? AND entry_id = ?`,
    ).bind(journalStatus, typeof body.progress === 'number' && Number.isFinite(body.progress) ? body.progress : null, series, journalStatus === 'in_progress' ? null : now(), user.id, entryId),
    // 17.10: «стоило ли» — и в послесловие к произведению (темп и зацепку не трогаем)
    ...(worth != null && workId ? [db.prepare(
      `INSERT INTO afterword (user_id, work_id, worth, at) VALUES (?, ?, ?, ?)
       ON CONFLICT (user_id, work_id) DO UPDATE SET worth = excluded.worth, at = excluded.at`,
    ).bind(user.id, workId, worth, at)] : []),
  ]);
  return json({ ok: true });
}

/** Сериал: сезон, серия, досмотренные сезоны — проверяем форму и длину, чужого не храним. */
function seriesJson(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as { season?: unknown; episode?: unknown; done?: unknown };
  const n = (x: unknown, max: number) => (Number.isInteger(x) && (x as number) >= 1 && (x as number) <= max ? x as number : undefined);
  const season = n(r.season, 99);
  if (!season) return null;
  const episode = n(r.episode, 999);
  const done = Array.isArray(r.done) ? r.done.slice(0, 99).flatMap((d) => {
    const x = d as { season?: unknown; perceived?: unknown; at?: unknown };
    const s = n(x.season, 99);
    return s ? [{ season: s, ...(typeof x.perceived === 'string' ? { perceived: x.perceived.slice(0, 20) } : {}),
      ...(typeof x.at === 'string' ? { at: x.at.slice(0, 30) } : {}) }] : [];
  }) : [];
  return JSON.stringify({ season, ...(episode ? { episode } : {}), ...(done.length ? { done } : {}) });
}

/** Книга (З5): часть, страница, дочитанные части — в той же колонке, с пометкой `kind: 'book'`. */
function bookJson(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as { part?: unknown; page?: unknown; done?: unknown };
  const n = (x: unknown, max: number) => (Number.isInteger(x) && (x as number) >= 1 && (x as number) <= max ? x as number : undefined);
  const part = n(r.part, 99);
  const page = n(r.page, 20000);
  const done = Array.isArray(r.done) ? r.done.slice(0, 99).flatMap((d) => {
    const x = d as { part?: unknown; perceived?: unknown; at?: unknown };
    const p = n(x.part, 99);
    return p ? [{ part: p, ...(typeof x.perceived === 'string' ? { perceived: x.perceived.slice(0, 20) } : {}),
      ...(typeof x.at === 'string' ? { at: x.at.slice(0, 30) } : {}) }] : [];
  }) : [];
  if (!part && !page && !done.length) return null;
  return JSON.stringify({ kind: 'book', ...(part ? { part } : {}), ...(page ? { page } : {}), ...(done.length ? { done } : {}) });
}

/** «Где я сейчас»: сезон и серия у сериала (Е3), часть и страница у книги (З5). */
async function postProgress(req: Request, user: User, db: D1Database, entryId: string): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as { series?: unknown; book?: unknown };
  const series = body.book ? bookJson(body.book) : seriesJson(body.series);
  if (!series) return json({ error: 'bad_progress' }, 400);
  await db.prepare("UPDATE journal SET series = ? WHERE user_id = ? AND entry_id = ? AND status = 'in_progress'")
    .bind(series, user.id, entryId).run();
  return json({ ok: true });
}

async function postFeedback(req: Request, user: User, db: D1Database): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as
    { recId?: string; workId?: string; action?: string; reason?: string; eagerness?: number; level?: unknown; traits?: unknown };
  if (!body.action) return json({ error: 'no_action' }, 400);
  // «хочется» приходит только со свайпа по ленте и только 1–5; чужое значение отбрасываем молча
  const eager = Number.isInteger(body.eagerness) && body.eagerness! >= 1 && body.eagerness! <= 5 ? body.eagerness! : null;
  await db.prepare('INSERT INTO feedback (id, user_id, rec_id, work_id, action, reason, eagerness, at, level, traits) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(newId('f'), user.id, body.recId ?? null, canonOrNull(body.workId), body.action, body.reason ?? null, eager, now(), levelOf(body.level), traitsOf(body.traits)).run();
  return json({ ok: true });
}

/** Импорт истории (ДФ-11, 14.10): записи дневника и оценки одной пачкой с меткой импорта. Уже отмеченное
 *  человеком не затирается (`INSERT OR IGNORE`): отмена импорта удаляет только то, что положил он сам.
 *  Сопоставление с каталогом и предпросмотр — на клиенте: файл выгрузки наружу не уходит, сюда приходят
 *  уже записи. Карточка едет целиком, как у «в планы», — у своей записи без ключа другой карточки нет. */
const IMPORT_ID = /^imp-[a-z0-9-]{4,40}$/;
const JOURNAL_STATUSES = new Set(['planned', 'in_progress', 'finished', 'abandoned']);
const isoOrNull = (v: unknown): string | null => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 30) : null);
async function postImport(req: Request, user: User, db: D1Database): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as {
    importId?: string;
    entries?: { entryId?: string; workId?: string; work?: unknown; status?: string; startedAt?: string; finishedAt?: string }[];
    ratings?: { workId?: string; rating?: number; raw?: number; work?: unknown }[];
  };
  const importId = body.importId;
  if (!importId || !IMPORT_ID.test(importId)) return json({ error: 'bad_import_id' }, 400);
  const entries = (body.entries ?? []).filter((e) => e.entryId && e.workId && e.status && JOURNAL_STATUSES.has(e.status)).slice(0, 10000);
  const ratings = (body.ratings ?? []).filter((r) => r.workId && Number.isInteger(r.rating) && r.rating! >= 1 && r.rating! <= 5).slice(0, 10000);
  if (!entries.length && !ratings.length) return json({ error: 'nothing' }, 400);
  const at = now();
  const work = (w: unknown) => (w && typeof w === 'object' ? slimCardText(JSON.stringify(w))!.slice(0, 20000) : null);
  const statements = [
    ...entries.map((e) => db.prepare(
      'INSERT OR IGNORE INTO journal (user_id, entry_id, work_id, work, status, started_at, finished_at, import_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ).bind(user.id, e.entryId!.slice(0, 120), canonWork(e.workId!.slice(0, 120)), work(canonCard(e.work, canonWork(e.workId!.slice(0, 120)))), e.status!, isoOrNull(e.startedAt), isoOrNull(e.finishedAt), importId)),
    ...ratings.map((r) => db.prepare(
      'INSERT OR IGNORE INTO rating (user_id, work_id, rating, raw, work, at, import_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).bind(user.id, canonWork(r.workId!.slice(0, 120)), r.rating!, typeof r.raw === 'number' && r.raw >= 0 && r.raw <= 10 ? r.raw : null, work(canonCard(r.work, canonWork(r.workId!.slice(0, 120)))), at, importId)),
  ];
  // пачками: у D1 предел на размер одного batch
  for (let i = 0; i < statements.length; i += 500) await db.batch(statements.slice(i, i + 500));
  const counts = await db.prepare(
    'SELECT (SELECT COUNT(*) FROM journal WHERE user_id = ?1 AND import_id = ?2) AS entries, (SELECT COUNT(*) FROM rating WHERE user_id = ?1 AND import_id = ?2) AS ratings',
  ).bind(user.id, importId).first<{ entries: number; ratings: number }>();
  return json({ ok: true, importId, added: counts?.entries ?? 0, rated: counts?.ratings ?? 0,
    kept: entries.length - (counts?.entries ?? 0), keptRatings: ratings.length - (counts?.ratings ?? 0) });
}

/** Отменить импорт: удалить записи и оценки с его меткой. Поправленное после импорта тоже уйдёт —
 *  отмена предлагается сразу на экране успеха. */
async function deleteImport(user: User, db: D1Database, importId: string): Promise<Response> {
  if (!IMPORT_ID.test(importId)) return json({ error: 'bad_import_id' }, 400);
  const counts = await db.prepare(
    'SELECT (SELECT COUNT(*) FROM journal WHERE user_id = ?1 AND import_id = ?2) AS entries, (SELECT COUNT(*) FROM rating WHERE user_id = ?1 AND import_id = ?2) AS ratings',
  ).bind(user.id, importId).first<{ entries: number; ratings: number }>();
  await db.batch([
    db.prepare('DELETE FROM journal WHERE user_id = ? AND import_id = ?').bind(user.id, importId),
    db.prepare('DELETE FROM rating WHERE user_id = ? AND import_id = ?').bind(user.id, importId),
  ]);
  return json({ ok: true, removed: counts?.entries ?? 0, unrated: counts?.ratings ?? 0 });
}

/** Выгрузка дневника (ДФ-14). Файл собирает приложение; сервер держит его час, потому что `downloadFile`
 *  Telegram скачивает только по ссылке. Ссылка — случайная метка без сессии, как у обложек: заголовок
 *  с токеном Telegram туда не передаст. */
const EXPORT_NAME = /^[\w.-]{1,80}\.(csv|json)$/;
const EXPORT_TTL_MS = 3600_000;
async function postExport(req: Request, user: User, db: D1Database): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as { name?: string; text?: string };
  if (!body.name || !EXPORT_NAME.test(body.name) || typeof body.text !== 'string') return json({ error: 'bad_export' }, 400);
  if (body.text.length > 8_000_000) return json({ error: 'too_large' }, 413);
  const id = `ex-${[...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
  await db.batch([
    db.prepare('DELETE FROM export_file WHERE at < ?').bind(new Date(Date.now() - EXPORT_TTL_MS).toISOString()),
    db.prepare('INSERT INTO export_file (id, user_id, name, body, at) VALUES (?, ?, ?, ?, ?)').bind(id, user.id, body.name, body.text, now()),
  ]);
  return json({ ok: true, path: `/api/export/${id}/${body.name}` });
}

async function getExport(db: D1Database, id: string): Promise<Response> {
  const row = await db.prepare('SELECT name, body FROM export_file WHERE id = ? AND at >= ?')
    .bind(id, new Date(Date.now() - EXPORT_TTL_MS).toISOString()).first<{ name: string; body: string }>();
  if (!row) return json({ error: 'not_found' }, 404);
  return new Response(row.body, {
    headers: {
      'content-type': row.name.endsWith('.csv') ? 'text/csv; charset=utf-8' : 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="${row.name}"`,
      'cache-control': 'no-store',
    },
  });
}

/** Заявка: «нет такого фильма» или «добавьте этого автора». Длину режем на сервере —
 *  это свободный ввод, и хранить чужую простыню незачем. */
async function postSuggestion(req: Request, user: User, db: D1Database): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as { kind?: string; title?: string; note?: string; context?: string };
  const title = (body.title ?? '').trim().slice(0, 200);
  if (!title) return json({ error: 'no_title' }, 400);
  if (body.kind !== 'work' && body.kind !== 'voice') return json({ error: 'bad_kind' }, 400);
  await db.prepare('INSERT INTO suggestion (id, user_id, kind, title, note, context, at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(newId('sg'), user.id, body.kind, title, (body.note ?? '').trim().slice(0, 500) || null,
      (body.context ?? '').trim().slice(0, 200) || null, now()).run();
  return json({ ok: true });
}

/** Что можно отметить неточным в карточке — иначе в очередь попадёт что угодно. */
const ISSUE_FIELDS = new Set(['title', 'year', 'people', 'synopsis', 'image', 'duration', 'type', 'watch', 'analyses', 'relations', 'heroes', 'other']);

/** Неточность в карточке произведения (02.10): что не так и, по желанию, как должно быть. */
async function postWorkIssue(req: Request, user: User, db: D1Database): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as { workId?: string; title?: string; fields?: unknown; note?: string; context?: string };
  const workId = canonWork((body.workId ?? '').trim().slice(0, 100));
  const title = (body.title ?? '').trim().slice(0, 200);
  const fields = Array.isArray(body.fields) ? [...new Set(body.fields.filter((f): f is string => typeof f === 'string' && ISSUE_FIELDS.has(f)))] : [];
  const note = (body.note ?? '').trim().slice(0, 500);
  if (!workId || !title) return json({ error: 'no_work' }, 400);
  if (!fields.length && !note) return json({ error: 'empty' }, 400);
  await db.prepare('INSERT INTO work_issue (id, user_id, work_id, title, fields, note, context, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(newId('wi'), user.id, workId, title, (fields.length ? fields : ['other']).join(','), note || null,
      (body.context ?? '').trim().slice(0, 200) || null, now()).run();
  return json({ ok: true });
}

/** Неточности владельцу — по токену администратора, как заявки. */
async function getWorkIssues(req: Request, env: Env): Promise<Response> {
  const token = /^Bearer\s+(.+)$/i.exec(req.headers.get('Authorization') ?? '')?.[1];
  if (!env.ADMIN_TOKEN || !token || !sameToken(token, env.ADMIN_TOKEN)) return json({ error: 'unauthorized' }, 401);
  const r = await env.DB.prepare(
    `SELECT i.id, i.work_id, i.title, i.fields, i.note, i.context, i.at, u.username, u.first_name
       FROM work_issue i LEFT JOIN user u ON u.id = i.user_id ORDER BY i.at DESC LIMIT 500`,
  ).all();
  return json({ items: r.results ?? [] });
}

/** Список заявок владельцу: по токену администратора, как справочники. В приложении их не
 *  показываем никому — это внутренняя очередь, а не лента. */
async function getSuggestions(req: Request, env: Env): Promise<Response> {
  const token = /^Bearer\s+(.+)$/i.exec(req.headers.get('Authorization') ?? '')?.[1];
  if (!env.ADMIN_TOKEN || !token || !sameToken(token, env.ADMIN_TOKEN)) return json({ error: 'unauthorized' }, 401);
  const r = await env.DB.prepare(
    `SELECT s.id, s.kind, s.title, s.note, s.context, s.at, u.username, u.first_name
       FROM suggestion s LEFT JOIN user u ON u.id = s.user_id ORDER BY s.at DESC LIMIT 500`,
  ).all();
  return json({ items: r.results ?? [] });
}

async function putVerdict(req: Request, user: User, db: D1Database): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as { url?: string; workId?: string; verdict?: string };
  if (!body.url || !body.verdict) return json({ error: 'no_verdict' }, 400);
  await db.prepare(
    `INSERT INTO link_verdict (user_id, url, work_id, verdict, at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (user_id, url) DO UPDATE SET verdict = excluded.verdict, at = excluded.at`,
  ).bind(user.id, body.url, canonOrNull(body.workId), body.verdict, now()).run();
  return json({ ok: true });
}

// ─── разметка владельца с телефона (06.10) ─────────────────────────────────────
// Очередь «Проверки» и «Рубрик» пульта (tools/owner-queue.mts) лежит рядом со справочниками, но
// раздаётся только владельцу; его решения — в owner_decision, откуда их забирает tools/owner-pull.mts
// (по ADMIN_TOKEN) и раскладывает в tools/markup-verdicts.json и tools/lens-verdicts.json.
const OWNER_QUEUE = 'owner-queue.json';
const OWNER_KINDS = new Set(['check', 'lens']);

/** Тестеры (ТВ-3в): список и правка — только админу, из настроек приложения. */
async function getTesters(db: D1Database): Promise<Response> {
  const rows = await db.prepare('SELECT username, at FROM tester ORDER BY at').all<{ username: string; at: string }>();
  return json({ testers: rows.results });
}
async function putTester(req: Request, db: D1Database): Promise<Response> {
  const b = (await req.json().catch(() => ({}))) as { username?: unknown; on?: unknown };
  const u = typeof b.username === 'string' ? nick(b.username) : '';
  if (!/^[a-z0-9_]{3,32}$/.test(u)) return json({ error: 'username' }, 400);
  if (b.on === false) await db.prepare('DELETE FROM tester WHERE username = ?').bind(u).run();
  else await db.prepare('INSERT INTO tester (username, at) VALUES (?, ?) ON CONFLICT(username) DO NOTHING').bind(u, now()).run();
  return getTesters(db);
}

async function ownerOnly(user: User, env: Env): Promise<boolean> {
  const row = await env.DB.prepare('SELECT username, tg_id FROM user WHERE id = ?').bind(user.id).first<{ username: string | null; tg_id: number | null }>();
  return isOwner(env, row?.username, row?.tg_id);
}

async function getOwnerQueue(env: Env): Promise<Response> {
  const object = env.REFERENCE ? await env.REFERENCE.get(OWNER_QUEUE) : null;
  if (!object) return json({ error: 'no_queue' }, 404);
  return new Response(object.body, { headers: { ...JSON_HEADERS, 'cache-control': 'no-store' } });
}

async function getOwnerDecisions(db: D1Database): Promise<Response> {
  const r = await db.prepare('SELECT kind, item_id, body, at FROM owner_decision ORDER BY at').all<{ kind: string; item_id: string; body: string; at: string }>();
  return json({ items: (r.results ?? []).map((x) => ({ kind: x.kind, id: x.item_id, at: x.at, ...JSON.parse(x.body) })) });
}

async function putOwnerDecision(req: Request, db: D1Database): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as { kind?: string; id?: string; clear?: boolean } & Record<string, unknown>;
  if (!body.kind || !OWNER_KINDS.has(body.kind) || !body.id || !/^[A-Za-z0-9_:-]{11,16}$/.test(body.id)) return json({ error: 'bad_decision' }, 400);
  const { kind, id, ...rest } = body;
  const text = JSON.stringify(rest);
  if (text.length > 2000) return json({ error: 'too_long' }, 400);
  // снятое решение — тоже решение: его забирает owner-pull и снимает у себя
  await db.prepare(
    `INSERT INTO owner_decision (kind, item_id, body, at) VALUES (?, ?, ?, ?)
     ON CONFLICT (kind, item_id) DO UPDATE SET body = excluded.body, at = excluded.at`,
  ).bind(kind, id, text, now()).run();
  return json({ ok: true });
}

function adminOk(req: Request, env: Env): boolean {
  const token = /^Bearer\s+(.+)$/i.exec(req.headers.get('Authorization') ?? '')?.[1];
  return Boolean(env.ADMIN_TOKEN && token && sameToken(token, env.ADMIN_TOKEN));
}

async function putOwnerQueue(req: Request, env: Env): Promise<Response> {
  if (!adminOk(req, env)) return json({ error: 'unauthorized' }, 401);
  if (!env.REFERENCE) return json({ error: 'no_reference_bucket' }, 500);
  const text = await req.text();
  try { JSON.parse(text); } catch { return json({ error: 'bad_json' }, 400); }
  await env.REFERENCE.put(OWNER_QUEUE, text);
  return json({ ok: true, bytes: text.length });
}

// ─── поведение для пульта (06.10) ──────────────────────────────────────────────
// Вкладка «Поведение» пульта (tools/behavior-desk.mts) забирает отсюда по ADMIN_TOKEN: открытия
// материалов (material_open — замер рубрик, ТВ-3г) по рубрике, месту, полке и дням, сколько людей,
// и петлю прогноза по всем. `owner=0` — без владельца: его проверки не путаются с поведением людей.
async function getBehavior(req: Request, env: Env): Promise<Response> {
  if (!adminOk(req, env)) return json({ error: 'unauthorized' }, 401);
  const url = new URL(req.url);
  const db = env.DB;
  const owner = env.OWNER_USERNAME?.replace(/^@/, '').toLowerCase();
  const ownerIds = owner && url.searchParams.get('owner') === '0'
    ? ((await db.prepare('SELECT id FROM user WHERE lower(username) = ?').bind(owner).all<{ id: string }>()).results ?? []).map((r) => r.id) : [];
  const not = ownerIds.length ? `AND user_id NOT IN (${ownerIds.map(() => '?').join(',')})` : '';
  const q = async <T,>(sql: string, ...bind: unknown[]) => ((await db.prepare(sql).bind(...bind, ...ownerIds).all<T>()).results ?? []);
  type G = { k: string | null; n: number; users: number };
  const by = (col: string, extra = '') => q<G>(`SELECT ${col} AS k, COUNT(*) AS n, COUNT(DISTINCT user_id) AS users FROM material_open WHERE 1=1 ${extra} ${not} GROUP BY ${col} ORDER BY n DESC`);
  const since = new Date(Date.now() - 30 * 864e5).toISOString();
  const [total, lens, place, shelf, shelves, tier, days] = await Promise.all([
    q<{ n: number; users: number }>(`SELECT COUNT(*) AS n, COUNT(DISTINCT user_id) AS users FROM material_open WHERE 1=1 ${not}`),
    by('lens'), by('place'), by('shelf', 'AND shelf IS NOT NULL'), by('shelves'), by('tier'),
    q<{ k: string; n: number; users: number }>(`SELECT substr(at, 1, 10) AS k, COUNT(*) AS n, COUNT(DISTINCT user_id) AS users FROM material_open WHERE at >= ? ${not} GROUP BY k ORDER BY k`, since),
  ]);
  const users = await db.prepare(`SELECT COUNT(*) AS all_users, SUM(CASE WHEN seen_at >= ? THEN 1 ELSE 0 END) AS week FROM user WHERE tg_id IS NOT NULL`)
    .bind(new Date(Date.now() - 7 * 864e5).toISOString()).first<{ all_users: number; week: number }>();
  return json({
    at: now(), withoutOwner: ownerIds.length > 0,
    opens: { ...(total[0] ?? { n: 0, users: 0 }), lens, place, shelf, shelves, tier, days },
    users: { all: users?.all_users ?? 0, week: users?.week ?? 0 },
    loop: loopReport(await loopRows(db)),
  });
}

/** Справочники: общие данные (индексы разборов, справочник фильмов), раздаются файлом — из R2
 *  на Cloudflare или из папки данных на bothost. Пишет их сборщик (tools/collect.mts) по
 *  расписанию, приложение читает готовое (трек В1). Нет файла — честный 404, и фронт берёт
 *  запечённое в сборку. */
export const REFERENCE_NAMES = new Set(['postsAuto', 'essaysAuto', 'essayLenses', 'sourcesAuto', 'filmBaseWiki', 'comentions', 'meta', 'inlineIndex', 'heroes', 'seriesSeasons', 'publicPages', 'watchProviders', 'freeWatch', 'voicePlaylists', 'freeRead', 'trailers',
  // индекс разборов первой ленты и его доли analyses-00…63 (18.10, аудит скорости, волна 3А, src/lib/essayIndex.ts)
  'essayIndex', ...Array.from({ length: 64 }, (_, i) => `analyses-${String(i).padStart(2, '0')}`)]);

async function getReference(env: Env, name: string): Promise<Response> {
  if (!REFERENCE_NAMES.has(name)) return json({ error: 'unknown_reference', name }, 404);
  if (!env.REFERENCE) return json({ error: 'no_reference_bucket' }, 404);
  const object = await env.REFERENCE.get(`${name}.json`);
  if (!object) return json({ error: 'not_found', name }, 404);
  // короткий кэш: сборщик обновляет раз в сутки, а новый индекс должен дойти в тот же день
  return new Response(object.body, { headers: { ...JSON_HEADERS, etag: object.httpEtag, 'cache-control': 'public, max-age=600' } });
}

async function putReference(req: Request, env: Env, name: string): Promise<Response> {
  const token = /^Bearer\s+(.+)$/i.exec(req.headers.get('Authorization') ?? '')?.[1];
  if (!env.ADMIN_TOKEN || !token || !sameToken(token, env.ADMIN_TOKEN)) return json({ error: 'unauthorized' }, 401);
  if (!REFERENCE_NAMES.has(name)) return json({ error: 'unknown_reference', name }, 404);
  if (!env.REFERENCE) return json({ error: 'no_reference_bucket' }, 500);
  const text = await req.text();
  try { JSON.parse(text); } catch { return json({ error: 'bad_json' }, 400); }
  // подписки (06.10): что нового в индексе разборов — сравниваем с прежним файлом до записи
  const watched = name === 'essaysAuto' || name === 'postsAuto';
  const before = watched ? await env.REFERENCE.get(`${name}.json`).then((o) => (o ? new Response(o.body).text() : undefined)).catch(() => undefined) : undefined;
  await env.REFERENCE.put(`${name}.json`, text);
  forgetReference(name);
  if (name === 'trailers') forgetTrailers();
  const fresh = watched ? await noteFresh(env, before, text).catch((err) => { console.error('noteFresh', err); return -1; }) : undefined;
  return json({ ok: true, name, bytes: text.length, ...(fresh !== undefined ? { fresh } : {}) });
}

/** Обложка книги Open Library (11.10): covers.openlibrary.org отдаёт старые обложки перенаправлением в хранилище
 *  Internet Archive — оно отвечает десятки секунд или не отвечает (а в России archive.org бывает закрыт). Сервер берёт
 *  обложку один раз (крупную, `-L`) и хранит рядом со справочниками, дальше отдаёт сам с долгим кэшем. Нет обложки
 *  или источник не ответил — 404 на час: приложение покажет заглушку. */
async function getCover(env: Env, id: string): Promise<Response> {
  const key = `cover-${id}-L.jpg`;
  const missing = () => new Response(null, { status: 404, headers: { 'cache-control': 'public, max-age=3600' } });
  if (!env.REFERENCE) return missing();
  const hit = await env.REFERENCE.get(key);
  const headers = { 'content-type': 'image/jpeg', 'cache-control': 'public, max-age=2592000, immutable' };
  if (hit) return new Response(hit.body, { headers });
  // `default=false` — без обложки Open Library отвечает 404, а не прозрачной точкой
  const r = await fetch(`https://covers.openlibrary.org/b/id/${id}-L.jpg?default=false`, { signal: AbortSignal.timeout(30000) }).catch(() => undefined);
  const type = r?.headers.get('content-type') ?? '';
  if (!r?.ok || !/^image\//.test(type)) return missing();
  const buf = await r.arrayBuffer();
  // меньше килобайта — заглушка, больше 3 МБ — не обложка
  if (buf.byteLength < 1024 || buf.byteLength > 3e6) return missing();
  await env.REFERENCE.put(key, buf);
  return new Response(buf, { headers: { ...headers, 'content-type': type } });
}

/** Сравнение токенов за постоянное время — как у подписи Telegram. */
function sameToken(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const withHead = (res: Response, head: Record<string, string>): Response => {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(head)) headers.set(k, v);
  return new Response(res.body, { status: res.status, headers });
};

/** Аналитика владельца (18.10, аудит, п. 24): воронка, поведение, рост, отчёт петли — тяжёлые выборки по всей базе.
 *  На bothost их зовёт поток аналитики сервера (server/db-thread.js) с базой только на чтение, чтобы цикл событий
 *  основного потока не стоял, а нехватка памяти роняла поток, а не сервер. `userId` — для отчёта петли «только мой»
 *  (владелец проверен основным потоком, ownerSession). Маршруты и проверки — те же, что в fetch. */
export async function analytics(req: Request, env: Env, userId?: string): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  if (path === '/api/admin/funnel') return getFunnel(req, env, adminOk(req, env));
  if (path === '/api/admin/growth') return getGrowth(req, env, adminOk(req, env));
  if (path === '/api/admin/behavior') return getBehavior(req, env);
  if (path === '/api/report/loop' && userId) {
    const all = url.searchParams.get('scope') !== 'me';
    return json({ scope: all ? 'all' : 'me', ...loopReport(await loopRows(env.DB, all ? undefined : userId)) });
  }
  return json({ error: 'not_found' }, 404);
}

/** Сессия владельца по запросу (Bearer) — id участника или undefined. Для отчёта петли в потоке аналитики. */
export async function ownerSession(req: Request, env: Env): Promise<string | undefined> {
  await migrate(env.DB);
  const user = await whoIs(req, env.DB);
  return user && (await ownerOnly(user, env)) ? user.id : undefined;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    const head = cors(req, env);

    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: head });
    // замер доступности (ХЮ-1): без базы и сессии — до всего остального
    if (path === '/api/probe') return probe(url, head);
    useBot(env);
    setSlimCards(env.SLIM_CARDS === '1');
    await migrate(env.DB);
    if (path === '/api/health') return json({ ok: true, at: now() }, 200, head);
    // события Telegram (инлайн-режим, 06.10): без сессии участника, проверка — секретом из токена бота
    if (path === '/api/telegram' && req.method === 'POST') return telegramUpdate(req, env);

    if (path === '/api/session' && req.method === 'POST') {
      const res = await postSession(req, env);
      return new Response(res.body, { status: res.status, headers: { ...JSON_HEADERS, ...head } });
    }

    // публичные страницы для поисковиков (ЗП-15): /film/…, /author/…, карта сайта, robots.txt
    if (!path.startsWith('/api/')) return (await publicPage(req, env, path)) ?? json({ error: 'not_found' }, 404, head);

    // справочники — общие данные: читать может кто угодно, писать — только сборщик по токену
    const refPath = /^\/api\/reference\/([A-Za-z0-9-]+)$/.exec(path);
    if (refPath && req.method === 'GET') return withHead(await getReference(env, refPath[1]), head);
    if (refPath && req.method === 'PUT') return withHead(await putReference(req, env, refPath[1]), head);
    // обложки книг Open Library — через свой сервер (11.10): общие данные, без сессии
    const coverPath = /^\/api\/cover\/(\d{1,10})$/.exec(path);
    if (coverPath && req.method === 'GET') return withHead(await getCover(env, coverPath[1]), head);
    // трейлеры, собранные ночью (17.10, worker/trailers.ts): общие данные, без сессии; ключи — `tmdb:<n>`, `tv:<n>`, до 40
    if (path === '/api/trailers' && req.method === 'GET') return withHead(await getTrailers(env, url), head);
    // каналы реестра для строки поиска в карточке — общие данные, как справочники
    if (path === '/api/sources' && req.method === 'GET') return withHead(await getSources(env), head);
    // выгрузка дневника по ссылке (ДФ-14): метка в адресе и есть доступ, срок — час
    const exportPath = /^\/api\/export\/(ex-[0-9a-f]{32})\/[^/]+$/.exec(path);
    if (exportPath && req.method === 'GET') return withHead(await getExport(env.DB, exportPath[1]), head);
    // присланный участником список просмотренного: только запись, наружу не раздаётся
    const seedPath = /^\/api\/admin\/seed\/([A-Za-z0-9_]+)$/.exec(path);
    if (seedPath && req.method === 'PUT') return withHead(await putUserSeed(req, env, seedPath[1]), head);
    // очередь заявок — владельцу по тому же токену, что и справочники
    if (path === '/api/admin/suggestions' && req.method === 'GET') return withHead(await getSuggestions(req, env), head);
    if (path === '/api/admin/work-issues' && req.method === 'GET') return withHead(await getWorkIssues(req, env), head);
    // разметка владельца с телефона: очередь кладёт и решения забирает сборщик по тому же токену
    if (path === '/api/admin/owner-queue' && req.method === 'PUT') return withHead(await putOwnerQueue(req, env), head);
    if (path === '/api/admin/behavior' && req.method === 'GET') return withHead(await getBehavior(req, env), head);
    // воронка и удержание (ЗП-3, 07.10) — вкладка «Поведение» пульта
    if (path === '/api/admin/funnel' && req.method === 'GET') return withHead(await getFunnel(req, env, adminOk(req, env)), head);
    // рост: источники с ценой посева, недели, первый вход, вирусность (16.10) — вкладка «Рост» пульта; посевы — оттуда же
    if (path === '/api/admin/growth' && req.method === 'GET') return withHead(await getGrowth(req, env, adminOk(req, env)), head);
    if (path === '/api/admin/seeding' || path.startsWith('/api/admin/seeding/')) {
      return withHead(adminOk(req, env) ? await seedingRoute(req, path, env.DB) : json({ error: 'unauthorized' }, 401), head);
    }
    if (path === '/api/admin/telegram-webhook' && req.method === 'POST') {
      return withHead(adminOk(req, env) ? await adminWebhook(req, env) : json({ error: 'unauthorized' }, 401), head);
    }
    if (path === '/api/admin/follow-digest' && req.method === 'POST') {
      return withHead(adminOk(req, env) ? await adminDigest(req, env) : json({ error: 'unauthorized' }, 401), head);
    }
    // есть ли участник с ником и сколько у него истории — разбор «не открывали приложение» в подборе по никам (15.10)
    if (path === '/api/admin/member' && req.method === 'GET') {
      return withHead(adminOk(req, env) ? await memberInfo(env, url.searchParams.get('nick') ?? '') : json({ error: 'unauthorized' }, 401), head);
    }
    if (path === '/api/admin/owner-decisions' && req.method === 'GET') {
      return withHead(adminOk(req, env) ? await getOwnerDecisions(env.DB) : json({ error: 'unauthorized' }, 401), head);
    }
    // реестр каналов и разметки (06.10, worker/registry.ts): снимок и правки — сборщику и пультам по токену
    if (path.startsWith('/api/admin/registry') || path.startsWith('/api/admin/inbox')) {
      if (!adminOk(req, env)) return json({ error: 'unauthorized' }, 401, head);
      if (path === '/api/admin/registry' && req.method === 'GET') return withHead(await getRegistry(url, env), head);
      if (path === '/api/admin/registry' && req.method === 'POST') return withHead(await postRegistry(req, env), head);
      if (path === '/api/admin/registry/version' && req.method === 'GET') return withHead(await getRegistryVersion(env), head);
      if (path === '/api/admin/registry/log' && req.method === 'GET') return withHead(await getRegistryLog(url, env), head);
      if (path === '/api/admin/inbox' && req.method === 'GET') return withHead(await getInbox(url, env), head);
      if (path === '/api/admin/inbox' && req.method === 'POST') return withHead(await postInbox(req, env), head);
      if (path === '/api/admin/inbox/result' && req.method === 'POST') return withHead(await postInboxResult(req, env), head);
      return json({ error: 'not_found' }, 404, head);
    }

    const user = await whoIs(req, env.DB);
    if (!user) return json({ error: 'unauthorized' }, 401, head);
    // заход дня (ЗП-3): не записался — не беда, ответ участнику важнее замера
    await noteVisit(env.DB, user.id).catch((err) => console.error('visit', err));

    const reply = async (): Promise<Response> => {
      if (path === '/api/state' && req.method === 'GET') return getState(user, env.DB, env);
      if (path === '/api/settings' && req.method === 'PUT') return putSettings(req, user, env.DB);
      if (path === '/api/feedback' && req.method === 'POST') return postFeedback(req, user, env.DB);
      if (path === '/api/import' && req.method === 'POST') return postImport(req, user, env.DB);
      if (path === '/api/export' && req.method === 'POST') return postExport(req, user, env.DB);
      const importPath = /^\/api\/import\/([^/]+)$/.exec(path);
      if (importPath && req.method === 'DELETE') return deleteImport(user, env.DB, decodeURIComponent(importPath[1]));
      if (path === '/api/verdict' && req.method === 'PUT') return putVerdict(req, user, env.DB);
      if (path === '/api/suggestion' && req.method === 'POST') return postSuggestion(req, user, env.DB);
      if (path === '/api/work-issue' && req.method === 'POST') return postWorkIssue(req, user, env.DB);
      if (path === '/api/journal/start' && req.method === 'POST') return postStart(req, user, env.DB);
      if (path === '/api/journal/plan' && req.method === 'POST') return postPlan(req, user, env.DB);
      const unstart = /^\/api\/journal\/([^/]+)\/unstart$/.exec(path);
      if (unstart && req.method === 'POST') return postUnstart(req, user, env.DB, decodeURIComponent(unstart[1]));
      const plan = /^\/api\/journal\/([^/]+)\/plan$/.exec(path);
      if (plan && req.method === 'DELETE') return deletePlan(user, env.DB, decodeURIComponent(plan[1]));
      if (path === '/api/impressions' && req.method === 'POST') return postImpressions(req, user, env.DB);
      if (path === '/api/open' && req.method === 'POST') return postOpen(req, user, env.DB);
      const dwellPath = /^\/api\/open\/([A-Za-z0-9_-]{1,64})\/dwell$/.exec(path);
      if (dwellPath && req.method === 'POST') return postDwell(req, user, env.DB, dwellPath[1]);
      if (path === '/api/event' && req.method === 'POST') return postEvent(req, user.id, env.DB);
      // удаление аккаунта и всех данных участника (ЗП-5, 07.10)
      if (path === '/api/account' && req.method === 'DELETE') return deleteAccount(user.id, env);
      if (path === '/api/share' && req.method === 'POST') {
        const me = await env.DB.prepare('SELECT tg_id FROM user WHERE id = ?').bind(user.id).first<{ tg_id: number | null }>();
        return prepareShare(req, me?.tg_id, env, user.id);
      }
      if (path === '/api/report/loop' && req.method === 'GET') return getLoopReport(url, user, env);
      if (path === '/api/follows' && req.method === 'GET') return getFollows(user.id, env);
      if (path === '/api/follow' && req.method === 'PUT') return putFollow(req, user.id, env);
      if (path.startsWith('/api/owner/')) {
        if (!(await ownerOnly(user, env))) return json({ error: 'owner_only' }, 403);
        if (path === '/api/owner/queue' && req.method === 'GET') return getOwnerQueue(env);
        if (path === '/api/owner/decisions' && req.method === 'GET') return getOwnerDecisions(env.DB);
        if (path === '/api/owner/decision' && req.method === 'PUT') return putOwnerDecision(req, env.DB);
        if (path === '/api/owner/testers' && req.method === 'GET') return getTesters(env.DB);
        if (path === '/api/owner/testers' && req.method === 'PUT') return putTester(req, env.DB);
      }

      // верхушка вкуса для подбора «вместе» в боте (19.10, worker/togetherPick.ts)
      if (path === '/api/taste-top' && req.method === 'PUT') return putTasteTop(req, user.id, env);
      // выбор компанией (ЗП-11, 07.10)
      if (path.startsWith('/api/together')) {
        const r = await togetherRoute(req, path, user.id, env);
        if (r) return r;
      }

      const rating = /^\/api\/rating\/(.+)$/.exec(path);
      if (rating && req.method === 'PUT') return putRating(req, user, env.DB, decodeURIComponent(rating[1]));

      // послесловие к просмотренному (17.10)
      const afterword = /^\/api\/afterword\/(.+)$/.exec(path);
      if (afterword && req.method === 'PUT') return putAfterword(req, user, env.DB, afterword[1]);

      const watched = /^\/api\/watched\/(.+)$/.exec(path);
      if (watched && req.method === 'PUT') return putWatched(req, user, env.DB, decodeURIComponent(watched[1]));

      const progress = /^\/api\/journal\/([^/]+)\/progress$/.exec(path);
      if (progress && req.method === 'POST') return postProgress(req, user, env.DB, decodeURIComponent(progress[1]));

      const checkin = /^\/api\/journal\/([^/]+)\/checkin$/.exec(path);
      if (checkin && req.method === 'POST') return postCheckIn(req, user, env.DB, decodeURIComponent(checkin[1]));


      return json({ error: 'not_found' }, 404);
    };

    const res = await reply();
    const headers = new Headers(res.headers);
    for (const [k, v] of Object.entries(head)) headers.set(k, v);
    return new Response(res.body, { status: res.status, headers });
  },
  /** По расписанию (Cloudflare cron; на bothost — таймер server/index.js): сводка подписок раз в день. */
  async scheduled(_event: unknown, env: Env): Promise<void> {
    useBot(env);
    await migrate(env.DB);
    // принятые апдейты Telegram (17.10): повтор приходит за минуты, двух суток с запасом
    await env.DB.prepare('DELETE FROM tg_update WHERE at < ?').bind(new Date(Date.now() - 2 * 864e5).toISOString()).run()
      .catch((err) => console.error('tg_update:', err));
    const r = await followDigest(env);
    if (r.users || r.stopped || r.pausedUntil) console.log(`подписки: ${JSON.stringify(r)}`);
  },
};
