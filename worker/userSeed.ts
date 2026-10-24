// Присланная история участника (seed--<ник>.json: импорт Кинопоиска, Letterboxd, присланный список) — кому её выдавать
// (24.10, аудит безопасности, записка .cache/security-options-2410.md, п. 2; слово владельца «делай»).
//
// До 24.10 список доставался первому аккаунту, вошедшему под ником (отметка `nick:<ник>` в seed_applied, по user_id).
// Дыры: список, опубликованный до первого входа, получал любой, кто первым займёт ник; удаление аккаунта стирало и
// привязку, и повторная публикация того же ника возвращала историю, хотя обещан «чистый лист».
//
// Теперь привязка — по номеру Telegram в своей таблице seed_owner (ник → tg_id). В ней нет колонки user_id, поэтому
// удаление аккаунта (worker/account.ts) её не стирает, а помечает deleted_at:
//   · первая выдача по нику запоминает tg_id; дальше список идёт только ему;
//   · сменил ник тот же номер — история идёт за человеком: файлы под всеми его никами из seed_owner;
//   · чужой номер под тем же ником — не выдаём, попытка пишется в seed_refusal (для пульта: GET /api/admin/seed-owners);
//   · удалён — не выдаём, и публикация под этим ником отклоняется (409), пока владелец явно не снимет запрет
//     (`?release=1` у PUT, tools/publish-seed.mts --release);
//   · при публикации, где tg_id известен (`?tg=<номер>` или `tgId` в теле), он сразу кладётся в привязку — тогда и
//     первый вход под ником чужому списка не даст.
// Хранится только номер Telegram удалившего и ник (минимум; упомянуть в политике).
import type { D1Database, D1PreparedStatement, Env, UserSeed } from './env';
import { canonCard, canonWork } from './workAliases';
import { slimCardText } from './retention';

const json = (data: unknown, status = 200): Response => Response.json(data, { status });
const now = () => new Date().toISOString();

/** Ник → имя файла присланного списка. Ник Telegram: латиница, цифры, подчёркивание. */
export const seedKey = (username: string): string | undefined =>
  /^[A-Za-z0-9_]{3,40}$/.test(username) ? `seed--${username.toLowerCase()}.json` : undefined;

interface OwnerRow { nick: string; tg_id: number | null; at: string; deleted_at: string | null }

/** Отказ в выдаче — для пульта. Одна строка на ник и номер: getState зовёт выдачу на каждом запуске приложения. */
async function refuse(db: D1Database, nick: string, tgId: number, reason: 'foreign' | 'deleted'): Promise<void> {
  const at = now();
  await db.prepare(`INSERT INTO seed_refusal (nick, tg_id, reason, n, first_at, at) VALUES (?, ?, ?, 1, ?, ?)
    ON CONFLICT(nick, tg_id) DO UPDATE SET reason = excluded.reason, n = n + 1, at = excluded.at`).bind(nick, tgId, reason, at, at).run();
}

/** Чей список под ником: строка seed_owner; нет её — привязка старого образца (`nick:` в seed_applied, до 24.10)
 *  переносится сюда же по номеру того аккаунта. */
async function ownerOf(db: D1Database, nick: string): Promise<OwnerRow | null> {
  const row = await db.prepare('SELECT nick, tg_id, at, deleted_at FROM seed_owner WHERE nick = ?').bind(nick).first<OwnerRow>();
  if (row) return row;
  const legacy = await db.prepare(`SELECT u.tg_id AS tg_id, MIN(s.at) AS at FROM seed_applied s JOIN user u ON u.id = s.user_id
    WHERE s.seed = ? AND u.tg_id IS NOT NULL`).bind(`nick:${nick}`).first<{ tg_id: number | null; at: string | null }>();
  if (legacy?.tg_id == null) return null;
  await db.prepare('INSERT OR IGNORE INTO seed_owner (nick, tg_id, at) VALUES (?, ?, ?)').bind(nick, legacy.tg_id, legacy.at ?? now()).run();
  return db.prepare('SELECT nick, tg_id, at, deleted_at FROM seed_owner WHERE nick = ?').bind(nick).first<OwnerRow>();
}

/** Присланный список просмотренного (UserSeed) ложится в профиль при входе участника — по разу на версию списка.
 *  Добавляет, не перетирая: что участник уже отметил или снял сам, остаётся как есть. Чей список — по seed_owner. */
export async function applyUserSeed(db: D1Database, env: Env, userId: string): Promise<void> {
  if (!env.REFERENCE) return;
  const me = await db.prepare('SELECT username, tg_id FROM user WHERE id = ?').bind(userId).first<{ username: string | null; tg_id: number | null }>();
  // без номера Telegram привязать не к чему (браузерный гость ника и не имеет)
  if (me?.tg_id == null) return;
  const tgId = Number(me.tg_id);
  const current = me.username && seedKey(me.username) ? me.username.toLowerCase() : undefined;
  // ники этого номера (в том числе прежние — смена ника) и нынешний
  const mine = ((await db.prepare('SELECT nick FROM seed_owner WHERE tg_id = ? AND deleted_at IS NULL').bind(tgId).all<{ nick: string }>()).results ?? [])
    .map((r) => r.nick).filter((n) => seedKey(n));
  for (const nick of [...new Set([...(current ? [current] : []), ...mine])]) {
    const object = await env.REFERENCE.get(`seed--${nick}.json`);
    if (!object) continue;
    const text = await new Response(object.body).text();
    let seed: UserSeed;
    try { seed = JSON.parse(text) as UserSeed; } catch { console.error('seed: не JSON', nick); continue; }
    let owner = await ownerOf(db, nick);
    if (owner?.deleted_at) { await refuse(db, nick, tgId, 'deleted'); continue; }
    // номер в самом файле (публикация до 24.10 его не несла) — сильнее привязки
    const bound = typeof seed.tgId === 'number' ? seed.tgId : owner?.tg_id;
    if (bound != null && Number(bound) !== tgId) { await refuse(db, nick, tgId, 'foreign'); continue; }
    if (owner?.tg_id == null) {
      // первая выдача: запоминаем номер. Гонка двух входов под одним ником — побеждает записавший первым
      await db.prepare(`INSERT INTO seed_owner (nick, tg_id, at) VALUES (?, ?, ?)
        ON CONFLICT(nick) DO UPDATE SET tg_id = excluded.tg_id, at = excluded.at WHERE seed_owner.tg_id IS NULL AND seed_owner.deleted_at IS NULL`)
        .bind(nick, tgId, now()).run();
      owner = await db.prepare('SELECT nick, tg_id, at, deleted_at FROM seed_owner WHERE nick = ?').bind(nick).first<OwnerRow>();
      if (owner?.tg_id == null || Number(owner.tg_id) !== tgId || owner.deleted_at) { await refuse(db, nick, tgId, 'foreign'); continue; }
    }
    // старая отметка `nick:` — по ней удаление аккаунта находило файлы до 24.10; держим и её
    await db.prepare('INSERT OR IGNORE INTO seed_applied (user_id, seed, at) VALUES (?, ?, ?)').bind(userId, `nick:${nick}`, now()).run();
    if (!seed.version || !Array.isArray(seed.watched)) continue;
    const mark = `user:${seed.version}`;
    const done = await db.prepare('SELECT 1 AS x FROM seed_applied WHERE user_id = ? AND seed = ?').bind(userId, mark).first();
    if (done) continue;
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
}

/** PUT /api/admin/seed/<ник> — положить присланный список (токен проверяет вызывающий, worker/index.ts).
 *  `?tg=<номер>` (или `tgId` в теле) — чей он; `?release=1` — снять запрет после удаления или перепривязать ник. */
export async function putUserSeed(req: Request, env: Env, username: string): Promise<Response> {
  const key = seedKey(username);
  if (!key) return json({ error: 'bad_username' }, 400);
  if (!env.REFERENCE) return json({ error: 'no_reference_bucket' }, 500);
  const url = new URL(req.url);
  const text = await req.text();
  let seed: UserSeed;
  try { seed = JSON.parse(text) as UserSeed; } catch { return json({ error: 'bad_json' }, 400); }
  if (!seed.version || !Array.isArray(seed.watched)) return json({ error: 'bad_seed' }, 400);
  const tgParam = url.searchParams.get('tg');
  if (tgParam != null && !/^[1-9]\d{0,15}$/.test(tgParam)) return json({ error: 'bad_tg' }, 400);
  if (seed.tgId != null && (typeof seed.tgId !== 'number' || !Number.isSafeInteger(seed.tgId) || seed.tgId <= 0)) return json({ error: 'bad_tg' }, 400);
  if (tgParam != null && seed.tgId != null && Number(tgParam) !== seed.tgId) return json({ error: 'tg_mismatch' }, 400);
  const tgId = tgParam != null ? Number(tgParam) : seed.tgId;
  const release = url.searchParams.get('release') === '1';
  const db = env.DB;
  const nick = username.toLowerCase();
  const owner = await ownerOf(db, nick);
  // удалившийся участник получил «чистый лист»: та же история под его ником — только по явному решению владельца
  if (owner?.deleted_at && !release) return json({ error: 'deleted', nick, deletedAt: owner.deleted_at, hint: 'release=1' }, 409);
  // ник уже за другим номером — новый номер только явно (ник мог перейти к другому человеку, а мог ошибиться сборщик)
  if (owner?.tg_id != null && tgId != null && Number(owner.tg_id) !== tgId && !release) return json({ error: 'nick_bound', nick, hint: 'release=1' }, 409);
  const statements: D1PreparedStatement[] = [];
  if (release && owner) {
    // снятие запрета: номер остаётся прежним (выдадим тому же человеку), если новый не назван
    statements.push(db.prepare('UPDATE seed_owner SET deleted_at = NULL, tg_id = ?, at = ? WHERE nick = ?').bind(tgId ?? owner.tg_id, now(), nick));
  } else if (tgId != null && owner?.tg_id == null) {
    statements.push(db.prepare(`INSERT INTO seed_owner (nick, tg_id, at) VALUES (?, ?, ?)
      ON CONFLICT(nick) DO UPDATE SET tg_id = excluded.tg_id, at = excluded.at WHERE seed_owner.tg_id IS NULL`).bind(nick, tgId, now()));
  }
  if (statements.length) await db.batch(statements);
  await env.REFERENCE.put(key, text);
  // уже заходил — сразу скажем, разложится ли при следующем входе
  const known = await db.prepare('SELECT 1 AS x FROM user WHERE lower(username) = ?').bind(nick).first();
  const after = await db.prepare('SELECT tg_id, deleted_at FROM seed_owner WHERE nick = ?').bind(nick).first<{ tg_id: number | null; deleted_at: string | null }>();
  return json({
    ok: true, username, watched: seed.watched.length, ratings: seed.ratings?.length ?? 0, known: Boolean(known),
    // bound — за номером (выдадим только ему), free — первому вошедшему под ником
    owner: after?.tg_id != null ? 'bound' : 'free', released: release && Boolean(owner),
  });
}

/** GET /api/admin/seed-owners — привязки и отказы для пульта (токен проверяет вызывающий). */
export async function getSeedOwners(db: D1Database): Promise<Response> {
  const [owners, refusals] = await Promise.all([
    db.prepare('SELECT nick, tg_id, at, deleted_at FROM seed_owner ORDER BY at DESC').all<OwnerRow>(),
    db.prepare('SELECT nick, tg_id, reason, n, first_at, at FROM seed_refusal ORDER BY at DESC LIMIT 500').all<Record<string, unknown>>(),
  ]);
  return json({ owners: owners.results ?? [], refusals: refusals.results ?? [] });
}

/** Для удаления аккаунта (worker/account.ts): ники участника — по номеру в seed_owner и по старым отметкам `nick:`
 *  (кроме ников, которые seed_owner числит за другим номером: тот файл — чужой). */
export async function seedNicksOf(db: D1Database, userId: string, tgId: number | null): Promise<string[]> {
  const legacy = ((await db.prepare(`SELECT substr(s.seed, 6) AS nick FROM seed_applied s LEFT JOIN seed_owner o ON o.nick = substr(s.seed, 6)
    WHERE s.user_id = ? AND s.seed LIKE 'nick:%' AND (o.tg_id IS NULL OR o.tg_id = ?)`).bind(userId, tgId ?? -1).all<{ nick: string }>()).results ?? [])
    .map((r) => r.nick);
  const bound = tgId == null ? [] : ((await db.prepare('SELECT nick FROM seed_owner WHERE tg_id = ?').bind(tgId).all<{ nick: string }>()).results ?? [])
    .map((r) => r.nick);
  return [...new Set([...legacy, ...bound])].filter((n) => /^[a-z0-9_]{3,40}$/.test(n));
}

/** Тем же пакетом, что удаление аккаунта: привязки участника помечаются «удалён» (сама строка остаётся — иначе
 *  следующий владелец ника или повторная публикация вернули бы историю), его отказы под чужими никами уходят. */
export function forgetSeedOwner(db: D1Database, tgId: number | null, nicks: string[]): D1PreparedStatement[] {
  if (tgId == null) return [];
  const at = now();
  return [
    // строку с чужим номером не трогаем: ник уже за другим человеком
    ...nicks.map((n) => db.prepare(`INSERT INTO seed_owner (nick, tg_id, at, deleted_at) VALUES (?, ?, ?, ?)
      ON CONFLICT(nick) DO UPDATE SET tg_id = excluded.tg_id, deleted_at = excluded.deleted_at
      WHERE seed_owner.tg_id IS NULL OR seed_owner.tg_id = excluded.tg_id`).bind(n, tgId, at, at)),
    db.prepare('UPDATE seed_owner SET deleted_at = ? WHERE tg_id = ? AND deleted_at IS NULL').bind(at, tgId),
    db.prepare('DELETE FROM seed_refusal WHERE tg_id = ?').bind(tgId),
  ];
}
