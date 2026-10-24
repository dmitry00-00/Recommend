// Присланная история за номером Telegram (24.10, worker/userSeed.ts; записка .cache/security-options-2410.md, п. 2) —
// на настоящем SQLite во временном файле (server/d1-sqlite.js, схема worker/schema.sql + worker/migrate.ts), без vite.
//
//   npx tsx tools/seed-owner-test.mts
//
// Кто есть кто: Аня — номер 100 (ник anya, потом anya_new); Чужой — номер 200, занял освободившийся ник anya;
// Борис — 300, список опубликован с номером до первого входа; Самозванец — 400 под ником boris; Вика — 600, номер
// в теле списка; старые привязки `nick:` (до 24.10): Гена — 700, Дима — 800, под ником dima входит 900.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { D1Database, Env, R2Bucket } from '../worker/env.ts';
import { forgetMigrations, migrate } from '../worker/migrate.ts';
import { applyUserSeed, putUserSeed } from '../worker/userSeed.ts';
import { deleteAccount } from '../worker/account.ts';

const { openD1 } = createRequire(import.meta.url)('../server/d1-sqlite.js');
const SCHEMA = readFileSync(new URL('../worker/schema.sql', import.meta.url), 'utf8');
const dir = mkdtempSync(join(tmpdir(), 'tm-seed-owner-'));

/** Хранилище справочников в памяти — как R2 у воркера. */
function bucket(): R2Bucket & { files: Map<string, string> } {
  const files = new Map<string, string>();
  return {
    files,
    async get(key) { const t = files.get(key); return t == null ? null : { body: new Response(t).body!, httpEtag: '', size: t.length }; },
    async put(key, value) { files.set(key, String(value)); },
    async delete(key) { files.delete(key); },
  };
}

const film = (n: number) => ({ workId: `w-${n}`, work: { id: `w-${n}`, title: `Фильм ${n}` } });
const seedBody = (version: string, films: number[], extra: Record<string, unknown> = {}) =>
  JSON.stringify({ version, watched: films.map(film), ratings: [{ workId: `w-${films[0]}`, rating: 4 }], ...extra });

async function setup(file: string) {
  const db: D1Database & { close?: () => void } = await openD1({ file: join(dir, file), schema: SCHEMA });
  const REFERENCE = bucket();
  const env = { DB: db, REFERENCE, ADMIN_TOKEN: 't' } as unknown as Env;
  forgetMigrations();
  await migrate(db);
  const T = '2026-10-24T12:00:00.000Z';
  const addUser = (id: string, tg: number, nick: string) =>
    db.prepare('INSERT INTO user (id, tg_id, username, created_at, seen_at) VALUES (?, ?, ?, ?, ?)').bind(id, tg, nick, T, T).run();
  const rename = (id: string, nick: string) => db.prepare('UPDATE user SET username = ? WHERE id = ?').bind(nick, id).run();
  const put = async (nick: string, body: string, q = '') => {
    const res = await putUserSeed(new Request(`http://localhost/api/admin/seed/${nick}${q}`, { method: 'PUT', body }), env, nick);
    return { status: res.status, body: await res.json() as Record<string, unknown> };
  };
  const watched = async (id: string) => ((await db.prepare('SELECT work_id FROM watched WHERE user_id = ? ORDER BY work_id').bind(id).all<{ work_id: string }>()).results ?? []).map((r) => r.work_id);
  const owner = (nick: string) => db.prepare('SELECT tg_id, deleted_at FROM seed_owner WHERE nick = ?').bind(nick).first<{ tg_id: number | null; deleted_at: string | null }>();
  const refusal = (nick: string, tg: number) => db.prepare('SELECT reason, n FROM seed_refusal WHERE nick = ? AND tg_id = ?').bind(nick, tg).first<{ reason: string; n: number }>();
  const apply = (id: string) => applyUserSeed(db, env, id);
  return { db, env, REFERENCE, addUser, rename, put, watched, owner, refusal, apply };
}

{
  const t = await setup('main.sqlite');

  // ── первый вход: список опубликован без номера — ложится первому вошедшему, номер запоминается
  let r = await t.put('anya', seedBody('v1', [1, 2]));
  assert.equal(r.status, 200); assert.equal(r.body.owner, 'free'); assert.equal(r.body.known, false);
  await t.addUser('u-anya', 100, 'Anya');
  await t.apply('u-anya');
  assert.deepEqual(await t.watched('u-anya'), ['w-1', 'w-2']);
  assert.deepEqual(await t.owner('anya'), { tg_id: 100, deleted_at: null });
  // повторный вход той же версии ничего не меняет; оценка легла
  await t.apply('u-anya');
  assert.equal((await t.db.prepare('SELECT COUNT(*) AS n FROM rating WHERE user_id = ?').bind('u-anya').first<{ n: number }>())!.n, 1);

  // ── смена ника тем же номером: обновление списка под старым ником идёт за человеком, список под новым — тоже ему
  await t.rename('u-anya', 'anya_new');
  r = await t.put('anya', seedBody('v2', [1, 2, 3]));
  assert.equal(r.status, 200); assert.equal(r.body.owner, 'bound'); assert.equal(r.body.known, false); // под ником anya сейчас никого
  r = await t.put('anya_new', seedBody('v3', [4]));
  assert.equal(r.body.owner, 'free'); assert.equal(r.body.known, true);
  await t.apply('u-anya');
  assert.deepEqual(await t.watched('u-anya'), ['w-1', 'w-2', 'w-3', 'w-4']);
  assert.deepEqual(await t.owner('anya_new'), { tg_id: 100, deleted_at: null });

  // ── чужой номер под тем же ником: не выдаём, попытка — в seed_refusal (одна строка, счётчик)
  await t.addUser('u-other', 200, 'anya');
  await t.apply('u-other');
  await t.apply('u-other');
  assert.deepEqual(await t.watched('u-other'), []);
  assert.deepEqual(await t.refusal('anya', 200), { reason: 'foreign', n: 2 });
  assert.equal(await t.refusal('anya_new', 200), null); // ники Ани по номеру — только ей

  // ── опубликовано до первого входа с номером: самозванец под ником не получает, хозяин номера — да
  r = await t.put('boris', seedBody('b1', [10]), '?tg=300');
  assert.equal(r.status, 200); assert.equal(r.body.owner, 'bound');
  await t.addUser('u-fake', 400, 'boris');
  await t.apply('u-fake');
  assert.deepEqual(await t.watched('u-fake'), []);
  assert.equal((await t.refusal('boris', 400))?.reason, 'foreign');
  assert.deepEqual(await t.owner('boris'), { tg_id: 300, deleted_at: null }); // первый вход привязку не перехватил
  await t.db.prepare('UPDATE user SET username = ? WHERE id = ?').bind('fake_gone', 'u-fake').run();
  await t.addUser('u-boris', 300, 'boris');
  await t.apply('u-boris');
  assert.deepEqual(await t.watched('u-boris'), ['w-10']);
  // другой номер для закреплённого ника — только явно
  r = await t.put('boris', seedBody('b2', [10, 11]), '?tg=500');
  assert.equal(r.status, 409); assert.equal(r.body.error, 'nick_bound');
  assert.equal(t.REFERENCE.files.get('seed--boris.json')?.includes('"b2"'), false); // файл не перезаписан
  assert.equal((await t.put('boris', seedBody('b2', [10]), '?tg=abc')).status, 400);
  // номер в теле списка — то же, что ?tg=
  r = await t.put('vika', seedBody('vk1', [20], { tgId: 600 }));
  assert.equal(r.body.owner, 'bound'); assert.deepEqual(await t.owner('vika'), { tg_id: 600, deleted_at: null });
  assert.equal((await t.put('vika', seedBody('vk1', [20], { tgId: 600 }), '?tg=601')).status, 400);

  // ── удаление аккаунта: файлы под всеми никами Ани уходят, привязки остаются с пометкой «удалён»
  const del = await deleteAccount('u-anya', t.env);
  assert.equal(del.status, 200);
  assert.equal(t.REFERENCE.files.has('seed--anya.json'), false);
  assert.equal(t.REFERENCE.files.has('seed--anya_new.json'), false);
  assert.equal(t.REFERENCE.files.has('seed--boris.json'), true); // чужое не тронуто
  assert.equal((await t.owner('anya'))?.tg_id, 100); assert.ok((await t.owner('anya'))?.deleted_at);
  assert.ok((await t.owner('anya_new'))?.deleted_at);
  assert.equal((await t.refusal('anya', 200))?.reason, 'foreign'); // отказ чужому — не данные Ани
  // повторная публикация того же ника отклоняется: «чистый лист»
  r = await t.put('anya', seedBody('v4', [1, 2, 3]));
  assert.equal(r.status, 409); assert.equal(r.body.error, 'deleted');
  assert.equal(t.REFERENCE.files.has('seed--anya.json'), false);
  r = await t.put('anya_new', seedBody('v5', [4]));
  assert.equal(r.status, 409);
  // Аня вернулась тем же номером — истории нет; чужой под ником anya — тоже нет
  await t.addUser('u-anya2', 100, 'anya_new');
  await t.apply('u-anya2'); await t.apply('u-other');
  assert.deepEqual(await t.watched('u-anya2'), []); assert.deepEqual(await t.watched('u-other'), []);
  // явное решение владельца (release): запрет снят, номер прежний — история только Ане
  r = await t.put('anya_new', seedBody('v5', [4]), '?release=1');
  assert.equal(r.status, 200); assert.equal(r.body.released, true); assert.equal(r.body.owner, 'bound');
  assert.deepEqual(await t.owner('anya_new'), { tg_id: 100, deleted_at: null });
  await t.rename('u-other', 'anya_new');
  await t.apply('u-other');
  assert.deepEqual(await t.watched('u-other'), []);
  await t.apply('u-anya2');
  assert.deepEqual(await t.watched('u-anya2'), ['w-4']);
  // anya — по-прежнему под запретом (снят только anya_new)
  assert.ok((await t.owner('anya'))?.deleted_at);
  // release с новым номером — ник переходит другому человеку
  r = await t.put('anya', seedBody('v6', [7]), '?release=1&tg=200');
  assert.equal(r.status, 200);
  await t.rename('u-other', 'anya');
  await t.apply('u-other');
  assert.deepEqual(await t.watched('u-other'), ['w-7']);
  t.db.close?.();
}

// ── привязки старого образца (`nick:` в seed_applied, до 24.10): переносятся к номеру разовой миграцией и при выдаче
{
  const t = await setup('legacy.sqlite');
  await t.addUser('u-gena', 700, 'gena');
  await t.db.prepare("INSERT INTO seed_applied (user_id, seed, at) VALUES ('u-gena', 'nick:gena', '2026-10-01')").run();
  await t.db.prepare('DROP TABLE seed_owner').run();
  await t.db.prepare("DELETE FROM migration_mark WHERE name = 'seed-owner-from-nick'").run();
  forgetMigrations();
  await migrate(t.db);
  assert.deepEqual(await t.owner('gena'), { tg_id: 700, deleted_at: null });
  // строка старого образца без записи seed_owner (появилась после миграции) — переносится при публикации или выдаче
  await t.addUser('u-dima', 800, 'dima_old');
  await t.db.prepare("INSERT INTO seed_applied (user_id, seed, at) VALUES ('u-dima', 'nick:dima', '2026-10-02')").run();
  await t.put('dima', seedBody('d1', [30]));
  await t.addUser('u-new', 900, 'dima');
  await t.apply('u-new');
  assert.deepEqual(await t.watched('u-new'), []);
  assert.deepEqual(await t.owner('dima'), { tg_id: 800, deleted_at: null });
  // удаление Димы: ник по старой отметке — тоже под запрет
  await deleteAccount('u-dima', t.env);
  assert.ok((await t.owner('dima'))?.deleted_at);
  assert.equal(t.REFERENCE.files.has('seed--dima.json'), false);
  t.db.close?.();
}

rmSync(dir, { recursive: true, force: true });
console.log('seed-owner-test: ок');
