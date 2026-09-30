// API приложения: хранит то, что человек сделал сам, и ничего больше. Подбор по-прежнему
// считается на клиенте — сервер нужен, чтобы отметки, дневник, прогнозы и отклики
// переживали перезагрузку и переезд на другое устройство (трек А, ROADMAP §7).
//
// Чего здесь намеренно нет: каталога, разборов и замеров. Это общие данные, они лежат
// отдельно (R2) и раздаются как файлы — смешивать их с личными записями в одной базе
// незачем.
import { newId, newToken, verifyInitData } from './auth';
import type { D1Database, Env, OwnerSeed, UserSeed } from './env';
import { migrate } from './migrate';
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
    'access-control-allow-methods': 'GET, PUT, POST, OPTIONS',
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
  const row = await db.prepare(
    `SELECT user.id AS id, user.settings AS settings, session.expires_at AS expires_at
       FROM session JOIN user ON user.id = session.user_id WHERE session.token = ?`,
  ).bind(token).first<{ id: string; settings: string; expires_at: string }>();
  if (!row) return undefined;
  if (Date.parse(row.expires_at) < Date.now()) {
    await db.prepare('DELETE FROM session WHERE token = ?').bind(token).run();
    return undefined;
  }
  return { id: row.id, settings: row.settings };
}

const SESSION_DAYS = 90;

async function openSession(db: D1Database, userId: string): Promise<{ token: string; expiresAt: string }> {
  const token = newToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400e3).toISOString();
  await db.prepare('INSERT INTO session (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .bind(token, userId, now(), expiresAt).run();
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
    }
    const owner = isOwner(env, tg.username);
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

const isOwner = (env: Env, username?: string): boolean =>
  Boolean(username && env.OWNER_USERNAME && username.toLowerCase() === env.OWNER_USERNAME.replace(/^@/, '').toLowerCase());

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
    ...seed.journal.map((e) => db.prepare(
      'INSERT OR IGNORE INTO journal (user_id, entry_id, work_id, work, status, started_at, finished_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).bind(userId, e.entryId, e.workId, JSON.stringify(e.work), e.status, e.startedAt ?? null, e.finishedAt ?? null)),
    ...seed.ratings.map((r) => db.prepare(
      'INSERT OR IGNORE INTO rating (user_id, work_id, rating, raw, at) VALUES (?, ?, ?, ?, ?)',
    ).bind(userId, r.workId, r.rating, r.raw ?? null, at)),
    // порядок присланного списка сохраняем временем отметки: первое в списке — самое свежее
    ...seed.watched.map((w, i) => db.prepare(
      'INSERT OR IGNORE INTO watched (user_id, work_id, state, work, tmdb, imdb, at) VALUES (?, ?, \'watched\', ?, ?, ?, ?)',
    ).bind(userId, w.workId, JSON.stringify(w.work), w.tmdb ?? null, w.imdb ?? null, new Date(Date.parse(at) - i * 1000).toISOString())),
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
  const seed = JSON.parse(await new Response(object.body).text()) as UserSeed;
  const mark = `user:${seed.version}`;
  const done = await db.prepare('SELECT 1 AS x FROM seed_applied WHERE user_id = ? AND seed = ?').bind(userId, mark).first();
  if (done) return;
  const at = Date.parse(now());
  const stamp = (i: number) => new Date(at - (i + 1) * 1000).toISOString();
  await db.batch([
    ...seed.watched.map((w, i) => db.prepare(
      'INSERT OR IGNORE INTO watched (user_id, work_id, state, work, tmdb, imdb, at) VALUES (?, ?, \'watched\', ?, ?, ?, ?)',
    ).bind(userId, w.workId, JSON.stringify(w.work), w.tmdb ?? null, w.imdb ?? null, stamp(i))),
    ...(seed.ratings ?? []).map((r) => db.prepare(
      'INSERT OR IGNORE INTO rating (user_id, work_id, rating, raw, work, at) VALUES (?, ?, ?, ?, ?, ?)',
    ).bind(userId, r.workId, r.rating, r.raw ?? null, r.work ? JSON.stringify(r.work) : null, new Date(at).toISOString())),
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
async function putRating(req: Request, user: User, db: D1Database, workId: string): Promise<Response> {
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
  ).bind(user.id, workId, rating, body.raw ?? null, body.work ? JSON.stringify(body.work) : null, now()).run();
  return json({ ok: true });
}

/** Показы слейта: что человек увидел и на каком месте. Пишем пачкой — один запрос на ленту. */
async function postImpressions(req: Request, user: User, db: D1Database): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as {
    slateId?: string; energy?: string; items?: { recId?: string; workId?: string; slot?: string; rank?: number }[];
  };
  const items = (body.items ?? []).filter((i) => i.recId && i.workId).slice(0, 20);
  if (!body.slateId || !items.length) return json({ error: 'no_items' }, 400);
  const at = now();
  await db.batch(items.map((i) => db.prepare(
    'INSERT INTO impression (id, user_id, slate_id, rec_id, work_id, slot, rank, energy, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
  ).bind(newId('i'), user.id, body.slateId, i.recId, i.workId, i.slot ?? null, i.rank ?? null, body.energy ?? null, at)));
  return json({ ok: true, n: items.length });
}

/** Отчёт петли прогноза. По всем участникам — только владельцу; остальным — по себе. */
async function getLoopReport(url: URL, user: User, env: Env): Promise<Response> {
  const me = await env.DB.prepare('SELECT username FROM user WHERE id = ?').bind(user.id).first<{ username: string | null }>();
  const owner = isOwner(env, me?.username ?? undefined);
  const all = owner && url.searchParams.get('scope') !== 'me';
  return json({ scope: all ? 'all' : 'me', ...loopReport(await loopRows(env.DB, all ? undefined : user.id)) });
}

/** Всё состояние участника одним ответом: клиент раскладывает его по своим структурам при
 *  запуске. Один запрос вместо шести — на телефоне это ощутимо, а данных здесь немного. */
async function getState(user: User, db: D1Database, env: Env): Promise<Response> {
  // присланный список — до чтения профиля, чтобы первый же ответ его уже содержал; не
  // разложился — профиль важнее, попробуем при следующем входе
  await applyUserSeed(db, env, user.id).catch((err) => console.error('seed', user.id, err));
  const [watched, journal, predictions, verdicts, ratings, profile] = await Promise.all([
    db.prepare('SELECT work_id, state, work FROM watched WHERE user_id = ? ORDER BY at DESC').bind(user.id).all<{ work_id: string; state: string; work: string | null }>(),
    db.prepare('SELECT entry_id, work_id, work, status, progress, started_at, finished_at, eagerness, inferred, series FROM journal WHERE user_id = ?').bind(user.id).all<Record<string, unknown>>(),
    db.prepare('SELECT entry_id, work_id, expected, model, model_p, at FROM prediction WHERE user_id = ?').bind(user.id).all<Record<string, unknown>>(),
    db.prepare('SELECT url, verdict FROM link_verdict WHERE user_id = ?').bind(user.id).all<{ url: string; verdict: string }>(),
    db.prepare('SELECT work_id, rating, raw, work, at FROM rating WHERE user_id = ? ORDER BY at').bind(user.id).all<{ work_id: string; rating: number; raw: number | null; work: string | null; at: string }>(),
    db.prepare('SELECT username, first_name, tg_id FROM user WHERE id = ?').bind(user.id).first<{ username: string | null; first_name: string | null; tg_id: number | null }>(),
  ]);
  const parse = (raw: unknown) => (typeof raw === 'string' ? JSON.parse(raw) : undefined);
  return json({
    settings: parse(user.settings) ?? {},
    watched: watched.results.map((r) => ({ workId: r.work_id, watched: r.state === 'watched', work: parse(r.work) })),
    journal: journal.results.map((r) => ({ ...r, work: parse(r.work), series: parse(r.series) })),
    predictions: predictions.results,
    verdicts: verdicts.results,
    ratings: ratings.results.map((r) => ({ workId: r.work_id, rating: r.rating, ...(r.raw != null ? { raw: r.raw } : {}), work: parse(r.work), at: r.at })),
    profile: {
      username: profile?.username ?? undefined,
      firstName: profile?.first_name ?? undefined,
      telegram: profile?.tg_id != null,
      owner: isOwner(env, profile?.username ?? undefined),
    },
  });
}

async function putSettings(req: Request, user: User, db: D1Database): Promise<Response> {
  const patch = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const current = JSON.parse(user.settings || '{}') as Record<string, unknown>;
  const merged = { ...current, ...patch };
  await db.prepare('UPDATE user SET settings = ?, seen_at = ? WHERE id = ?').bind(JSON.stringify(merged), now(), user.id).run();
  return json(merged);
}

async function putWatched(req: Request, user: User, db: D1Database, workId: string): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as { watched?: boolean; work?: unknown; tmdb?: number; imdb?: string };
  await db.prepare(
    `INSERT INTO watched (user_id, work_id, state, work, tmdb, imdb, at) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (user_id, work_id) DO UPDATE SET state = excluded.state, work = COALESCE(excluded.work, watched.work), at = excluded.at`,
  ).bind(user.id, workId, body.watched === false ? 'removed' : 'watched',
    body.work ? JSON.stringify(body.work) : null, body.tmdb ?? null, body.imdb ?? null, now()).run();
  return json({ ok: true });
}

/** Старт просмотра вместе с прогнозом: одним запросом, потому что это одно событие. */
async function postStart(req: Request, user: User, db: D1Database): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as {
    entryId?: string; workId?: string; work?: unknown; expected?: string; model?: string; modelOdds?: unknown; startedAt?: string;
    inferred?: boolean;
  };
  if (!body.workId) return json({ error: 'no_work' }, 400);
  const entryId = body.entryId ?? newId('j');
  await db.prepare(
    `INSERT INTO journal (user_id, entry_id, work_id, work, status, started_at, inferred) VALUES (?, ?, ?, ?, 'in_progress', ?, ?)
     ON CONFLICT (user_id, entry_id) DO UPDATE SET status = 'in_progress', started_at = excluded.started_at, inferred = excluded.inferred`,
  ).bind(user.id, entryId, body.workId, body.work ? JSON.stringify(body.work) : null, body.startedAt ?? now(), body.inferred ? 1 : null).run();
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
  const entryId = body.entryId ?? newId('j');
  const eager = Number.isInteger(body.eagerness) && body.eagerness! >= 1 && body.eagerness! <= 5 ? body.eagerness! : null;
  await db.prepare(
    `INSERT INTO journal (user_id, entry_id, work_id, work, status, started_at, eagerness) VALUES (?, ?, ?, ?, 'planned', ?, ?)
     ON CONFLICT (user_id, entry_id) DO NOTHING`,
  ).bind(user.id, entryId, body.workId, body.work ? JSON.stringify(body.work) : null, now(), eager).run();
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
async function postCheckIn(req: Request, user: User, db: D1Database, entryId: string): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as {
    workId?: string; status?: string; perceived?: string; reason?: string; progress?: number; payload?: unknown;
    /** сериал (Е3): где человек после чек-ина; `season_finished` — досмотрен сезон, а не сериал */
    series?: unknown;
    /** книга (З5): часть и страница; `part_finished` — дочитана часть, а не книга */
    book?: unknown;
  };
  const status = body.status ?? 'finished';
  // сезон или часть дочитаны, а целое — нет: чек-ин пишем, запись дневника остаётся «смотрю/читаю»
  const journalStatus = status === 'season_finished' || status === 'part_finished' ? 'in_progress' : status;
  const series = body.book ? bookJson(body.book) : seriesJson(body.series);
  await db.prepare('INSERT INTO checkin (id, user_id, entry_id, work_id, status, perceived, reason, payload, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(newId('c'), user.id, entryId, body.workId ?? '', status, body.perceived ?? null, body.reason ?? null,
      body.payload ? JSON.stringify(body.payload) : null, now()).run();
  await db.prepare(
    `UPDATE journal SET status = ?, progress = COALESCE(?, progress), series = COALESCE(?, series), finished_at = ? WHERE user_id = ? AND entry_id = ?`,
  ).bind(journalStatus, body.progress ?? null, series, journalStatus === 'in_progress' ? null : now(), user.id, entryId).run();
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
    { recId?: string; workId?: string; action?: string; reason?: string; eagerness?: number };
  if (!body.action) return json({ error: 'no_action' }, 400);
  // «хочется» приходит только со свайпа по ленте и только 1–5; чужое значение отбрасываем молча
  const eager = Number.isInteger(body.eagerness) && body.eagerness! >= 1 && body.eagerness! <= 5 ? body.eagerness! : null;
  await db.prepare('INSERT INTO feedback (id, user_id, rec_id, work_id, action, reason, eagerness, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(newId('f'), user.id, body.recId ?? null, body.workId ?? null, body.action, body.reason ?? null, eager, now()).run();
  return json({ ok: true });
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
  ).bind(user.id, body.url, body.workId ?? null, body.verdict, now()).run();
  return json({ ok: true });
}

/** Справочники: общие данные (индексы разборов, справочник фильмов), раздаются файлом — из R2
 *  на Cloudflare или из папки данных на bothost. Пишет их сборщик (tools/collect.mts) по
 *  расписанию, приложение читает готовое (трек В1). Нет файла — честный 404, и фронт берёт
 *  запечённое в сборку. */
export const REFERENCE_NAMES = new Set(['postsAuto', 'essaysAuto', 'sourcesAuto', 'filmBaseWiki', 'comentions', 'meta']);

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
  await env.REFERENCE.put(`${name}.json`, text);
  return json({ ok: true, name, bytes: text.length });
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

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    const head = cors(req, env);

    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: head });
    await migrate(env.DB);
    if (path === '/api/health') return json({ ok: true, at: now() }, 200, head);

    if (path === '/api/session' && req.method === 'POST') {
      const res = await postSession(req, env);
      return new Response(res.body, { status: res.status, headers: { ...JSON_HEADERS, ...head } });
    }

    if (!path.startsWith('/api/')) return json({ error: 'not_found' }, 404, head);

    // справочники — общие данные: читать может кто угодно, писать — только сборщик по токену
    const refPath = /^\/api\/reference\/([A-Za-z0-9-]+)$/.exec(path);
    if (refPath && req.method === 'GET') return withHead(await getReference(env, refPath[1]), head);
    if (refPath && req.method === 'PUT') return withHead(await putReference(req, env, refPath[1]), head);
    // присланный участником список просмотренного: только запись, наружу не раздаётся
    const seedPath = /^\/api\/admin\/seed\/([A-Za-z0-9_]+)$/.exec(path);
    if (seedPath && req.method === 'PUT') return withHead(await putUserSeed(req, env, seedPath[1]), head);
    // очередь заявок — владельцу по тому же токену, что и справочники
    if (path === '/api/admin/suggestions' && req.method === 'GET') return withHead(await getSuggestions(req, env), head);

    const user = await whoIs(req, env.DB);
    if (!user) return json({ error: 'unauthorized' }, 401, head);

    const reply = async (): Promise<Response> => {
      if (path === '/api/state' && req.method === 'GET') return getState(user, env.DB, env);
      if (path === '/api/settings' && req.method === 'PUT') return putSettings(req, user, env.DB);
      if (path === '/api/feedback' && req.method === 'POST') return postFeedback(req, user, env.DB);
      if (path === '/api/verdict' && req.method === 'PUT') return putVerdict(req, user, env.DB);
      if (path === '/api/suggestion' && req.method === 'POST') return postSuggestion(req, user, env.DB);
      if (path === '/api/journal/start' && req.method === 'POST') return postStart(req, user, env.DB);
      if (path === '/api/journal/plan' && req.method === 'POST') return postPlan(req, user, env.DB);
      const unstart = /^\/api\/journal\/([^/]+)\/unstart$/.exec(path);
      if (unstart && req.method === 'POST') return postUnstart(req, user, env.DB, decodeURIComponent(unstart[1]));
      const plan = /^\/api\/journal\/([^/]+)\/plan$/.exec(path);
      if (plan && req.method === 'DELETE') return deletePlan(user, env.DB, decodeURIComponent(plan[1]));
      if (path === '/api/impressions' && req.method === 'POST') return postImpressions(req, user, env.DB);
      if (path === '/api/report/loop' && req.method === 'GET') return getLoopReport(url, user, env);

      const rating = /^\/api\/rating\/(.+)$/.exec(path);
      if (rating && req.method === 'PUT') return putRating(req, user, env.DB, decodeURIComponent(rating[1]));

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
};
