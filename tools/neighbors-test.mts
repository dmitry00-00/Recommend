// Проверка соседей по вкусу (23.10): src/lib/model/neighbors.ts на синтетике и worker/neighbors.ts на SQLite во
// временном файле (как tools/start-picks-test.mts).
//
//   npx tsx tools/neighbors-test.mts
//
// Две группы вкуса: «А» любят фильмы 1–30 и не любят 31–60, «Б» — наоборот. Человек из «А» оценил 1–20 и 31–50 — соседи
// у него только из «А», и 21–30 у него выше нуля, 51–60 — ниже. Меньше общих, чем minCommon, — соседей нет; фильм меньше
// чем у minSupport соседей — в итог не идёт; двойник самого человека и повтор одного соседа — не соседи; один фильм под
// TMDb и IMDb — один. Сервер: без NEIGHBORS=1 ручки нет, мало оценок — пусто, оценённое самим — не отдаётся, кэш живёт,
// пока не изменились оценки, ключи берутся из карточки, битая карточка запрос не роняет.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  NEIGHBOR, anchorFileOf, anchorsFrom, buildPool, keysOfRating, mineIn, neighborScores, personZ, rawOf, toTable, type Rated,
} from '../src/lib/model/neighbors.ts';
import { forgetNeighbors, getNeighbors, type NeighborEnv } from '../worker/neighbors.ts';
import { migrate } from '../worker/migrate.ts';

// ─── чистые части ──────────────────────────────────────────────────────────────
assert.equal(rawOf(5), 9.5);
assert.equal(rawOf(1), 1.5);
assert.equal(rawOf(3, 7), 7);
assert.deepEqual(keysOfRating('tmdb:5'), ['tmdb:5']);
assert.deepEqual(keysOfRating('l-tmdbtv77'), ['tmdbtv:77']);
assert.deepEqual(keysOfRating('kp:1', { type: 'series', externalIds: { tmdb: 9, imdb: 'tt0000009' } }), ['tmdbtv:9', 'imdb:tt0000009']);
assert.deepEqual(keysOfRating('kp:1', { type: 'film', externalIds: { tmdb: 'x', imdb: 'плохо' } }), []);
// повтор фильма по любому ключу — мимо; одна оценка на всех — нули
assert.equal(personZ([{ keys: ['tmdb:1'], raw: 8 }, { keys: ['imdb:tt1', 'tmdb:1'], raw: 2 }, { keys: ['tmdb:2'], raw: 4 }]).length, 2);
assert.deepEqual(personZ([{ keys: ['tmdb:1'], raw: 7 }, { keys: ['tmdb:2'], raw: 7 }]).map((f) => f.z), [0, 0]);

/** детерминированный шум */
let h = 7;
const noise = () => { h = (Math.imul(h, 1103515245) + 12345) >>> 0; return (h % 1000) / 1000; };
const film = (i: number) => `tmdb:${i}`;
/** оценки человека группы: любимое 8–10, нелюбимое 2–4 */
function person(group: 'A' | 'B', films: number[]): Rated[] {
  return films.map((i) => ({ keys: [film(i)], raw: ((i <= 30) === (group === 'A') ? 8 : 2) + Math.round(noise() * 2) }));
}
const all = Array.from({ length: 60 }, (_, i) => i + 1);
const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const crowd = [
  ...Array.from({ length: 8 }, (_, i) => ({ id: `A${i}`, films: personZ(person('A', all)) })),
  ...Array.from({ length: 8 }, (_, i) => ({ id: `B${i}`, films: personZ(person('B', all)) })),
];
const myRatings = person('A', [...range(1, 20), ...range(31, 50)]);
const me = personZ(myRatings);

{
  const pool = buildPool(crowd);
  const { scores, neighbors } = neighborScores(pool, mineIn(pool, me));
  assert.equal(neighbors, 8, 'соседи — только из своей группы');
  for (const i of range(21, 30)) assert.ok(scores.get(pool.keyFilm.get(film(i))!)! > 0.2, `любимое ${i}`);
  for (const i of range(51, 60)) assert.ok(scores.get(pool.keyFilm.get(film(i))!)! < -0.2, `нелюбимое ${i}`);
  // мало общих — соседей нет
  assert.equal(neighborScores(pool, mineIn(pool, personZ(myRatings.slice(0, NEIGHBOR.minCommon - 1)))).neighbors, 0);
  // skip
  assert.equal(neighborScores(pool, mineIn(pool, me), { skip: (p) => p.id === 'A0' }).neighbors, 7);
  // k
  assert.equal(neighborScores(pool, mineIn(pool, me), { k: 3 }).neighbors, 3);
}
{
  // фильм 61 оценили двое из «А» — в итоге его нет, при minSupport 1 — есть
  const few = crowd.map((p, i) => (i < 2 ? { id: p.id, films: [...p.films, { keys: [film(61)], z: 1.5 }] } : p));
  const pool = buildPool(few);
  const f61 = pool.keyFilm.get(film(61))!;
  assert.equal(neighborScores(pool, mineIn(pool, me)).scores.has(f61), false);
  assert.ok(neighborScores(pool, mineIn(pool, me), { minSupport: 1 }).scores.get(f61)! > 0);
}
{
  // двойник самого человека (его же оценки и ещё фильм 99) — не сосед: фильма 99 нет даже при minSupport 1
  const twin = { id: 'u:twin', films: personZ([...myRatings, { keys: [film(99)], raw: 10 }]) };
  const pool = buildPool([...crowd, twin]);
  const r = neighborScores(pool, mineIn(pool, me), { minSupport: 1 });
  assert.equal(r.neighbors, 8);
  assert.equal(r.scores.has(pool.keyFilm.get(film(99))!), false);
  // повтор соседа (опорная история и он же в приложении) — один сосед
  const pool2 = buildPool([...crowd, { id: 'u:A0-copy', films: crowd[0].films }]);
  assert.equal(pool2.people.find((p) => p.id === 'u:A0-copy')!.group, pool2.people.find((p) => p.id === 'A0')!.group);
  assert.equal(neighborScores(pool2, mineIn(pool2, me)).neighbors, 8);
}
{
  // один фильм под TMDb у одного и под IMDb у другого — один номер
  const pool = buildPool([
    { id: 'x', films: [{ keys: ['tmdb:500', 'imdb:tt0000500'], z: 1 }] },
    { id: 'y', films: [{ keys: ['imdb:tt0000500'], z: -1 }] },
  ]);
  assert.equal(pool.keyFilm.get('tmdb:500'), pool.keyFilm.get('imdb:tt0000500'));
  assert.equal(pool.filmKeys.length, 1);
}
{
  // итог: без оценённого самим, ключ — TMDb, иначе IMDb; два знака; предел по модулю
  const pool = buildPool([{ id: 'x', films: [{ keys: ['imdb:tt0000001', 'tmdb:1'], z: 1 }, { keys: ['imdb:tt0000002'], z: 1 }, { keys: ['tmdb:3'], z: 1 }] }]);
  const scores = new Map([[pool.keyFilm.get('tmdb:1')!, 0.456], [pool.keyFilm.get('imdb:tt0000002')!, -0.9], [pool.keyFilm.get('tmdb:3')!, 0.001]]);
  assert.deepEqual(toTable(pool, scores), { 'tmdb:1': 0.46, 'imdb:tt0000002': -0.9 });
  assert.deepEqual(toTable(pool, scores, { exclude: new Set([pool.keyFilm.get('tmdb:1')!]) }), { 'imdb:tt0000002': -0.9 });
  assert.deepEqual(toTable(pool, scores, { limit: 1 }), { 'imdb:tt0000002': -0.9 });
}
{
  // файл опорных: без имён (случайные id), туда и обратно — те же z с точностью до сотых; кривое — пусто
  let n = 0;
  const file = anchorFileOf(crowd, () => `r${n++}`);
  const text = JSON.stringify(file);
  assert.ok(!/"A\d"|"B\d"/.test(text), 'имён в файле нет');
  const back = anchorsFrom(text);
  assert.equal(back.length, crowd.length);
  assert.equal(back[0].id, 'a:r0');
  assert.ok(Math.abs(back[0].films[0].z - crowd[0].films[0].z) < 0.006);
  assert.deepEqual(anchorsFrom('{'), []);
  assert.deepEqual(anchorsFrom(JSON.stringify({ v: 2, films: [], people: [] })), []);
  assert.deepEqual(anchorsFrom(JSON.stringify({ v: 1, films: [['bad key']], people: [{ id: 'x', r: [0, 100] }] })), []);
}

// ─── сервер ────────────────────────────────────────────────────────────────────
const require = createRequire(import.meta.url);
const { openD1 } = require('../server/d1-sqlite.js');
const dir = mkdtempSync(join(tmpdir(), 'tm-neighbors-'));
try {
  const schema = readFileSync(new URL('../worker/schema.sql', import.meta.url), 'utf8');
  const DB = await openD1({ file: join(dir, 'tm.sqlite'), schema });
  await migrate(DB);
  const at = '2026-10-23T10:00:00.000Z';
  const addUser = (id: string) => DB.prepare('INSERT INTO user (id, created_at, seen_at) VALUES (?, ?, ?)').bind(id, at, at).run();
  const rate = (user: string, workId: string, rating: number, raw: number | null, work: string | null = null, when = at) =>
    DB.prepare('INSERT OR REPLACE INTO rating (user_id, work_id, rating, raw, work, at) VALUES (?, ?, ?, ?, ?, ?)').bind(user, workId, rating, raw, work, when).run();
  // половина группы — участники приложения, половина — опорные истории из файла
  const half = (g: string) => crowd.filter((p) => p.id.startsWith(g));
  const users = [...half('A').slice(0, 4), ...half('B').slice(0, 4)];
  const anchors = [...half('A').slice(4), ...half('B').slice(4)];
  for (const p of users) {
    await addUser(p.id);
    for (const f of p.films) await rate(p.id, f.keys[0], 3, Math.round((f.z + 3) * 100) / 100);
  }
  await addUser('me');
  // часть оценок — без raw (1–5) и под id Кинопоиска с ключами в карточке; одна карточка битая
  for (const [i, r] of myRatings.entries()) {
    if (i % 3 === 0) await rate('me', `kp:${1000 + i}`, Math.max(1, Math.min(5, Math.round(r.raw / 2))), null, JSON.stringify({ type: 'film', externalIds: { tmdb: Number(r.keys[0].slice(5)) } }));
    else await rate('me', r.keys[0], 3, r.raw);
  }
  await rate('me', 'kp:9999', 3, 5, '{битая');
  await addUser('few');
  for (const i of range(1, 5)) await rate('few', film(i), 5, null);

  const anchorText = JSON.stringify(anchorFileOf(anchors, (() => { let n = 0; return () => `z${n++}`; })()));
  let reads = 0;
  const env = { DB, NEIGHBORS: '1', NEIGHBOR_ANCHORS: async () => { reads++; return anchorText; } } as unknown as NeighborEnv;
  const get = async (u: string, e = env) => { const r = await getNeighbors(u, e); return { status: r.status, body: await r.json() as { rated: number; neighbors: number; table: Record<string, number> } }; };

  assert.equal((await get('me', { ...env, NEIGHBORS: '' } as NeighborEnv)).status, 404, 'без NEIGHBORS=1 ручки нет');
  const few = await get('few');
  assert.deepEqual(few.body, { rated: 5, neighbors: 0, table: {} });

  const a = await get('me');
  assert.equal(a.status, 200);
  assert.equal(a.body.rated, 41);
  assert.equal(a.body.neighbors, 8, 'соседи — 4 участника и 4 опорные из своей группы');
  for (const i of range(21, 30)) assert.ok(a.body.table[film(i)] > 0.2, `любимое ${i}`);
  for (const i of range(51, 60)) assert.ok(a.body.table[film(i)] < -0.2, `нелюбимое ${i}`);
  for (const i of [...range(1, 20), ...range(31, 50)]) assert.equal(film(i) in a.body.table, false, `оценённое ${i} не отдаётся`);
  assert.equal(reads, 1);

  // тот же ответ из кэша; новая оценка — пересчёт, и новое оценённое пропадает из итога
  assert.deepEqual((await get('me')).body, a.body);
  await rate('me', film(25), 5, 10, null, '2026-10-23T11:00:00.000Z');
  const b = await get('me');
  assert.equal(b.body.rated, 42);
  assert.equal(film(25) in b.body.table, false);
  assert.equal(reads, 1, 'набор собирается раз в полчаса, не на каждый ответ');

  // без файла опорных — только участники приложения; кривой файл — то же
  forgetNeighbors();
  assert.equal((await get('me', { ...env, NEIGHBOR_ANCHORS: undefined } as NeighborEnv)).body.neighbors, 4);
  forgetNeighbors();
  assert.equal((await get('me', { ...env, NEIGHBOR_ANCHORS: async () => 'не json' } as NeighborEnv)).body.neighbors, 4);
  DB.close?.();
} finally {
  rmSync(dir, { recursive: true, force: true });
}
console.log('neighbors: ок');
