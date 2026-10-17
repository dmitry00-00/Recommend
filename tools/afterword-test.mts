// Проверка послесловия к просмотренному (17.10, решение владельца): настоящий обработчик воркера (worker/index.ts),
// база SQLite во временном файле, участники — гости по сессии (ALLOW_DEMO).
//
//   npx tsx tools/afterword-test.mts
//
// Сначала — старая база: чек-ины со «стоило ли» есть, послесловия ещё нет. Миграция переносит последний по времени
// «стоило ли» на произведение, пустые и чужие (без участника) пропускает; снятое после переноса не возвращается при
// повторной миграции (рестарт). Потом — API: заплатка сливается с имеющимся, null снимает поле, все три пустые —
// строки нет; неверные значения и ключ — 400; без сессии — 401; /api/state отдаёт afterwords только с непустыми полями;
// чек-ин со «стоило ли» пишет его в послесловие, не трогая темп и зацепку; удаление аккаунта стирает строки.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import worker from '../worker/index.ts';
import { forgetMigrations, migrate } from '../worker/migrate.ts';
import type { Env } from '../worker/env.ts';

const require = createRequire(import.meta.url);
const { openD1 } = require('../server/d1-sqlite.js');
const dir = mkdtempSync(join(tmpdir(), 'tm-afterword-'));
const schema = readFileSync(new URL('../worker/schema.sql', import.meta.url), 'utf8');

// ─── 1. миграция: перенос checkin.worth ─────────────────────────────────────
{
  const OLD = await openD1({ file: join(dir, 'old.sqlite'), schema });
  // база до 17.10: таблиц послесловия и отметок переноса нет
  await OLD.prepare('DROP TABLE afterword').run();
  await OLD.prepare('DROP TABLE migration_mark').run();
  await migrate(OLD); // колонки чек-ина (worth) — как у базы после 13.10
  forgetMigrations();
  await OLD.prepare('DROP TABLE afterword').run();
  await OLD.prepare('DROP TABLE migration_mark').run();
  const at = '2026-10-01T00:00:00.000Z';
  for (const id of ['A', 'B']) {
    await OLD.prepare("INSERT INTO user (id, tg_id, first_name, settings, created_at, seen_at) VALUES (?, NULL, ?, '{}', ?, ?)").bind(id, id, at, at).run();
  }
  const ci = (id: string, user: string, work: string, worth: number | null, when: string) =>
    OLD.prepare("INSERT INTO checkin (id, user_id, entry_id, work_id, status, at, worth) VALUES (?, ?, 'e', ?, 'finished', ?, ?)")
      .bind(id, user, work, when, worth).run();
  await ci('c1', 'A', 'w-stalker', 2, '2026-10-01T10:00:00Z');
  await ci('c2', 'A', 'w-stalker', 4, '2026-10-03T10:00:00Z'); // последний — 4
  await ci('c3', 'A', 'w-stalker', null, '2026-10-05T10:00:00Z'); // без «стоило ли» — не в счёт
  await ci('c4', 'A', 'w-mirror', 5, '2026-10-02T10:00:00Z');
  await ci('c5', 'B', 'w-stalker', 1, '2026-10-02T10:00:00Z');
  await ci('c6', 'B', 'w-solaris', null, '2026-10-02T10:00:00Z'); // только пустые — строки нет
  await ci('c7', 'B', '', 3, '2026-10-02T10:00:00Z'); // без произведения — пропуск
  await ci('c8', 'A', 'w-tie', 2, '2026-10-04T10:00:00Z');
  await ci('c9', 'A', 'w-tie', 3, '2026-10-04T10:00:00Z'); // то же время — по id, последний — c9

  await migrate(OLD);
  const rows = async () => (await OLD.prepare('SELECT user_id, work_id, worth, pace, hook, at FROM afterword ORDER BY user_id, work_id').all()).results;
  assert.deepEqual(await rows(), [
    { user_id: 'A', work_id: 'w-mirror', worth: 5, pace: null, hook: null, at: '2026-10-02T10:00:00Z' },
    { user_id: 'A', work_id: 'w-stalker', worth: 4, pace: null, hook: null, at: '2026-10-03T10:00:00Z' },
    { user_id: 'A', work_id: 'w-tie', worth: 3, pace: null, hook: null, at: '2026-10-04T10:00:00Z' },
    { user_id: 'B', work_id: 'w-stalker', worth: 1, pace: null, hook: null, at: '2026-10-02T10:00:00Z' },
  ], 'перенос: последний «стоило ли» на пару');
  // снятое после переноса (все поля пустые — строку удалили) рестарт не возвращает
  await OLD.prepare("DELETE FROM afterword WHERE user_id = 'B'").run();
  forgetMigrations();
  await migrate(OLD);
  assert.equal((await rows()).length, 3, 'перенос разовый');
  await OLD.close?.();
  forgetMigrations();
}

// ─── 2. API ─────────────────────────────────────────────────────────────────
const DB = await openD1({ file: join(dir, 'tm.sqlite'), schema });
const env = { DB, ALLOW_DEMO: '1' } as unknown as Env;

const call = async (method: string, path: string, token?: string, body?: unknown) => {
  const res = await worker.fetch(new Request(`https://x${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    ...(body !== undefined ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}),
  }), env);
  return { status: res.status, body: await res.json() as Record<string, any> };
};
const guest = async () => {
  const r = await call('POST', '/api/session', undefined, { demo: true });
  assert.equal(r.status, 200);
  return { token: r.body.token as string, id: r.body.user.id as string };
};
const me = await guest();
const other = await guest();
const put = (workId: string, body: unknown, token = me.token) => call('PUT', `/api/afterword/${encodeURIComponent(workId)}`, token, body);
const rowOf = (user: string, work: string) => DB.prepare('SELECT worth, pace, hook FROM afterword WHERE user_id = ? AND work_id = ?').bind(user, work).first();

// без сессии — 401
assert.equal((await put('w-stalker', { worth: 4 }, '')).status, 401);
assert.equal((await call('PUT', '/api/afterword/w-stalker', 'stranger-token', { worth: 4 })).status, 401);

// новая строка — только присланное
let r = await put('w-stalker', { worth: 4 });
assert.equal(r.status, 200);
assert.equal(r.body.ok, true);
assert.deepEqual(Object.keys(r.body.afterword), ['worth', 'at']);
assert.equal(r.body.afterword.worth, 4);
assert.ok(/^\d{4}-\d{2}-\d{2}T/.test(r.body.afterword.at));
const at1 = r.body.afterword.at as string;

// слияние: темп добавился, «стоило ли» остался
await new Promise((ok) => setTimeout(ok, 5));
r = await put('w-stalker', { pace: 'slow' });
assert.deepEqual({ ...r.body.afterword, at: undefined }, { worth: 4, pace: 'slow', at: undefined });
assert.ok(r.body.afterword.at > at1, 'at — время последней правки');
r = await put('w-stalker', { hook: 'world', worth: 5 });
assert.deepEqual(await rowOf(me.id, 'w-stalker'), { worth: 5, pace: 'slow', hook: 'world' });
// undefined в JSON не доходит — поле «нет», не «снять»
r = await put('w-stalker', { pace: undefined, hook: 'idea' });
assert.deepEqual(await rowOf(me.id, 'w-stalker'), { worth: 5, pace: 'slow', hook: 'idea' });

// null снимает
r = await put('w-stalker', { pace: null });
assert.equal(r.status, 200);
assert.deepEqual({ ...r.body.afterword, at: undefined }, { worth: 5, hook: 'idea', at: undefined });
assert.deepEqual(await rowOf(me.id, 'w-stalker'), { worth: 5, pace: null, hook: 'idea' });

// все три пустые — строки нет, в ответе afterword: null
r = await put('w-stalker', { worth: null, hook: null });
assert.equal(r.status, 200);
assert.deepEqual(r.body, { ok: true, afterword: null });
assert.equal(await rowOf(me.id, 'w-stalker'), null);
// снять у несуществующей — тоже пусто, строка не появляется
r = await put('w-none', { worth: null, pace: null, hook: null });
assert.deepEqual(r.body, { ok: true, afterword: null });
assert.equal(await rowOf(me.id, 'w-none'), null);

// неверное — 400, ничего не пишется
await put('w-mirror', { worth: 3, pace: 'ok' });
const bad: [unknown, string][] = [
  [{ worth: 0 }, 'bad_worth'], [{ worth: 6 }, 'bad_worth'], [{ worth: 3.5 }, 'bad_worth'], [{ worth: '3' }, 'bad_worth'],
  [{ pace: 'medium' }, 'bad_pace'], [{ pace: 1 }, 'bad_pace'], [{ hook: 'music' }, 'bad_hook'], [{ hook: ['plot'] }, 'bad_hook'],
  [{ worth: 4, pace: 'warp' }, 'bad_pace'], // одно неверное — не пишется и верное
  [{}, 'empty'], [{ other: 1 }, 'empty'], [[1], 'bad_afterword'], ['"строка"', 'bad_afterword'], ['не json', 'bad_afterword'], [null, 'bad_afterword'],
];
for (const [body, error] of bad) {
  r = await put('w-mirror', body);
  assert.equal(r.status, 400, JSON.stringify(body));
  assert.equal(r.body.error, error, JSON.stringify(body));
}
assert.deepEqual(await rowOf(me.id, 'w-mirror'), { worth: 3, pace: 'ok', hook: null }, 'после 400 — как было');
// ключ произведения: длиннее 120, с пробелом, битая %-последовательность — 400
assert.equal((await put('x'.repeat(121), { worth: 3 })).body.error, 'bad_work');
assert.equal((await put('w mirror', { worth: 3 })).body.error, 'bad_work');
assert.equal((await call('PUT', '/api/afterword/%E0%A4%A', me.token, { worth: 3 })).body.error, 'bad_work');
assert.equal((await put('x'.repeat(120), { worth: 3 })).status, 200, '120 знаков — можно');
await put('x'.repeat(120), { worth: null });
// всякий набор из словаря проходит
for (const pace of ['slow', 'ok', 'fast']) assert.equal((await put('w-p', { pace })).status, 200);
for (const hook of ['plot', 'characters', 'world', 'idea']) assert.equal((await put('w-p', { hook })).status, 200);
await put('w-p', { pace: null, hook: null });

// чужая строка не видна и не трогается
await put('w-mirror', { worth: 1 }, other.token);
assert.deepEqual(await rowOf(me.id, 'w-mirror'), { worth: 3, pace: 'ok', hook: null });

// ─── /api/state ─────────────────────────────────────────────────────────────
await put('w-solaris', { hook: 'characters' });
r = await call('GET', '/api/state', me.token);
assert.equal(r.status, 200);
const aw = r.body.afterwords as Record<string, unknown>[];
assert.deepEqual(aw.map((a) => ({ ...a, at: typeof a.at })), [
  { workId: 'w-mirror', worth: 3, pace: 'ok', at: 'string' },
  { workId: 'w-solaris', hook: 'characters', at: 'string' },
], 'только непустые поля, по времени');
assert.ok(Array.isArray(r.body.ratings), 'остальное состояние на месте');

// ─── чек-ин со «стоило ли» ──────────────────────────────────────────────────
const start = await call('POST', '/api/journal/start', me.token, { workId: 'w-solaris' });
const entry = start.body.entryId as string;
r = await call('POST', `/api/journal/${entry}/checkin`, me.token, { workId: 'w-solaris', status: 'finished', perceived: 'as_expected', worth: 2, worthWhy: 'boring' });
assert.equal(r.status, 200);
assert.deepEqual(await rowOf(me.id, 'w-solaris'), { worth: 2, pace: null, hook: 'characters' }, 'чек-ин дописал «стоило ли», зацепка осталась');
assert.equal((await DB.prepare('SELECT worth FROM checkin WHERE user_id = ? AND work_id = ?').bind(me.id, 'w-solaris').first<{ worth: number }>())?.worth, 2);
// новое произведение — строка появляется
const s2 = await call('POST', '/api/journal/start', me.token, { workId: 'w-dune' });
await call('POST', `/api/journal/${s2.body.entryId}/checkin`, me.token, { workId: 'w-dune', status: 'finished', worth: 5 });
assert.deepEqual(await rowOf(me.id, 'w-dune'), { worth: 5, pace: null, hook: null });
// без «стоило ли» или с неверным — послесловие не трогаем
await call('POST', `/api/journal/${s2.body.entryId}/checkin`, me.token, { workId: 'w-dune', status: 'finished' });
await call('POST', `/api/journal/${s2.body.entryId}/checkin`, me.token, { workId: 'w-dune', status: 'finished', worth: 9 });
assert.deepEqual(await rowOf(me.id, 'w-dune'), { worth: 5, pace: null, hook: null });
// чек-ин без произведения — строки с пустым ключом нет
await call('POST', `/api/journal/${s2.body.entryId}/checkin`, me.token, { status: 'finished', worth: 4 });
assert.equal(await rowOf(me.id, ''), null);
// неверный статус — 400, ни чек-ина, ни послесловия
r = await call('POST', `/api/journal/${s2.body.entryId}/checkin`, me.token, { workId: 'w-x', status: 'weird', worth: 4 });
assert.equal(r.status, 400);
assert.equal(await rowOf(me.id, 'w-x'), null);

// ─── удаление аккаунта ──────────────────────────────────────────────────────
const before = await DB.prepare('SELECT COUNT(*) AS n FROM afterword WHERE user_id = ?').bind(me.id).first<{ n: number }>();
assert.ok(before!.n >= 3);
r = await call('DELETE', '/api/account', me.token);
assert.equal(r.status, 200);
assert.equal(r.body.deleted.afterword, before!.n, 'в отчёте удаления');
assert.equal((await DB.prepare('SELECT COUNT(*) AS n FROM afterword WHERE user_id = ?').bind(me.id).first<{ n: number }>())?.n, 0);
assert.deepEqual(await rowOf(other.id, 'w-mirror'), { worth: 1, pace: null, hook: null }, 'чужое на месте');

rmSync(dir, { recursive: true, force: true });
console.log('afterword: ok');
