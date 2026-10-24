// Проверка EASE ленты (24.10, опыт ease): src/lib/model/ease.ts на синтетике, worker/ease.ts на SQLite во временном файле
// (как tools/neighbors-test.mts) и обученный счёт ленты (recommend.ts) с флагом и без.
//
//   npx tsx tools/ease-test.mts
//
// Модель: вынуть человека из готовой (easeWithout) — то же, что обучить без него (easeFit со skip), а это то же, что X
// без его строки; фильм, который оценили меньше minRaters других, — без счёта; в ответе нет значения ≠ 0. Сервер: без
// EASE=1 ручки нет, мало оценок — пусто, участника (и его двойника из опорных) в его X нет, оценённое самим не отдаётся,
// кэш живёт, пока не изменились оценки. Лента: без опыта ease (или без таблицы) счёт побитно прежний — LEARNED_B.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  EASE, easeData, easeFit, easeInput, easePack, easeScoreOf, easeScores, easeUnpack, easeWithout, type EaseFilm, type EaseKind,
} from '../src/lib/model/ease.ts';
import { anchorFileOf, personZ, type Rated } from '../src/lib/model/neighbors.ts';
import { forgetNeighbors, neighborPool, type NeighborEnv } from '../worker/neighbors.ts';
import { EASE_SERVER, forgetEase, getEase, type EaseEnv } from '../worker/ease.ts';
import { migrate } from '../worker/migrate.ts';
import { userJournal } from '../src/mocks/userHistory.ts';
import { userAnnotations } from '../src/mocks/userAnnotations.ts';
import { userRatings } from '../src/mocks/userRatings.ts';
import { candidateSeeds, seedToCard } from '../src/mocks/candidates.ts';
import { watchedWorks } from '../src/mocks/userWatched.ts';
import { workRegisters } from '../src/mocks/workRegisters.ts';
import { registerBase } from '../src/mocks/registerBase.ts';
import { deriveState } from '../src/lib/model/deriveState.ts';
import { LEARNED_B, learnedParts, learnedScore, type Candidate, type RecommendOptions } from '../src/lib/model/recommend.ts';
import { setExperiments } from '../src/lib/model/experiments.ts';

/** детерминированный шум */
let h = 11;
const noise = () => { h = (Math.imul(h, 1103515245) + 12345) >>> 0; return (h % 1000) / 1000; };
const film = (i: number) => `tmdb:${i}`;
const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
/** оценки человека группы: смотрит своё (А — 1–40, Б — 21–60) и кое-что чужое; любимое — своё */
function person(group: 'A' | 'B', share = 0.7): Rated[] {
  const own = group === 'A' ? range(1, 40) : range(21, 60);
  return range(1, 60).filter((i) => (own.includes(i) ? noise() < share : noise() < 0.15))
    .map((i) => ({ keys: [film(i)], raw: own.includes(i) ? 7 + Math.round(noise() * 3) : 2 + Math.round(noise() * 3) }));
}
const crowd = [
  ...Array.from({ length: 8 }, (_, i) => ({ id: `A${i}`, films: personZ(person('A')) })),
  ...Array.from({ length: 8 }, (_, i) => ({ id: `B${i}`, films: personZ(person('B')) })),
];
const close = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) <= eps * Math.max(1, Math.abs(a), Math.abs(b));

// ─── модель ────────────────────────────────────────────────────────────────────
for (const kind of ['bin', 'like'] as EaseKind[]) {
  const people = new Map<string, EaseFilm[]>(crowd.map((p) => [p.id, p.films]));
  const data = easeData(people, kind);
  const me = crowd[0].films.slice(0, 15);
  const x = easeInput(data, me);
  // вынуть из готовой = обучить без него (один и двое)
  for (const skip of [['A1'], ['A1', 'B3']]) {
    const a = easeWithout(easeFit(data), skip.map((w) => data.who.indexOf(w)));
    const b = easeFit(data, EASE.lambda, skip);
    for (let i = 0; i < a.Ki.length; i++) assert.ok(close(a.Ki[i], b.Ki[i]), `${kind}: K⁻¹ без ${skip}`);
    assert.deepEqual([...a.raters], [...b.raters]);
    for (let j = 0; j < a.d.length; j++) assert.ok(close(a.d[j], b.d[j]), `${kind}: d без ${skip}`);
    const sa = easeScores(a, x), sb = easeScores(b, x);
    for (let j = 0; j < sa.length; j++) assert.ok(Number.isNaN(sa[j]) ? Number.isNaN(sb[j]) : close(sa[j], sb[j]), `${kind}: счёт без ${skip}`);
  }
  // обучить без него = X без его строки (счёт по ключам: номера фильмов у двух X разные)
  const without = easeData(new Map([...people].filter(([w]) => w !== 'A1')), kind);
  const s1 = easeScores(easeFit(data, EASE.lambda, 'A1'), x), s2 = easeScores(easeFit(without), easeInput(without, me));
  for (const i of range(1, 60)) {
    const v1 = easeScoreOf(data, s1, [film(i)]), v2 = easeScoreOf(without, s2, [film(i)]);
    assert.ok(v1 == null ? v2 == null : v2 != null && close(v1, v2), `${kind}: фильм ${i} без A1`);
  }
}
{
  // фильм, который оценили двое других, — без счёта; трое — со счётом; сам он в число не входит
  const people = new Map<string, EaseFilm[]>(crowd.map((p) => [p.id, p.films.filter((f) => f.keys[0] !== film(99))]));
  for (const id of ['A0', 'A1', 'A2']) people.get(id)!.push({ keys: [film(99)], z: 1 });
  const data = easeData(people, 'bin');
  const x = easeInput(data, crowd[3].films);
  assert.equal(easeScoreOf(data, easeScores(easeFit(data), x), [film(99)]) != null, true, 'трое оценили');
  assert.equal(easeScoreOf(data, easeScores(easeFit(data, EASE.lambda, 'A0'), x), [film(99)]), null, 'без A0 — двое');
}
{
  // упаковка: NaN — нет в списке, 0 — есть; ключ — TMDb; оценённое — мимо; обратно — те же числа; кривое — undefined
  const data = easeData(new Map([['x', [{ keys: ['imdb:tt0000001', 'tmdb:1'], z: 1 }, { keys: ['imdb:tt0000002'], z: 0 }, { keys: ['tmdb:3'], z: -1 }, { keys: ['tmdb:4'], z: 0 }]]]), 'bin');
  const packed = easePack(data, Float64Array.from([0.12345, 0, NaN, 0.5]), Float64Array.from([-0.1, 0, NaN, 0.25]), new Set([3]));
  assert.deepEqual(packed, { scale: EASE.scale, keys: ['tmdb:1', 'imdb:tt0000002'], bin: [1235, 0], like: [-1000, 0] });
  const back = easeUnpack(JSON.parse(JSON.stringify(packed)))!;
  assert.equal(back.bin[back.index.get('imdb:tt0000002')!], 0);
  assert.ok(close(back.bin[back.index.get('tmdb:1')!], 0.1235));
  assert.equal(easeUnpack({ scale: EASE.scale, keys: [], bin: [], like: [] }), undefined, 'пусто — источника нет');
  assert.equal(easeUnpack({ scale: EASE.scale, keys: ['tmdb:1'], bin: ['x'], like: [0] }), undefined);
  assert.equal(easeUnpack({ error: 'not_found' }), undefined);
}

// ─── сервер ────────────────────────────────────────────────────────────────────
const require = createRequire(import.meta.url);
const { openD1 } = require('../server/d1-sqlite.js');
const dir = mkdtempSync(join(tmpdir(), 'tm-ease-'));
try {
  const schema = readFileSync(new URL('../worker/schema.sql', import.meta.url), 'utf8');
  const DB = await openD1({ file: join(dir, 'tm.sqlite'), schema });
  await migrate(DB);
  const at = '2026-10-24T10:00:00.000Z';
  const addUser = (id: string) => DB.prepare('INSERT INTO user (id, created_at, seen_at) VALUES (?, ?, ?)').bind(id, at, at).run();
  const rate = (user: string, workId: string, rating: number, raw: number | null, when = at) =>
    DB.prepare('INSERT OR REPLACE INTO rating (user_id, work_id, rating, raw, work, at) VALUES (?, ?, ?, ?, NULL, ?)').bind(user, workId, rating, raw, when).run();
  // участники с длинной историей (≥ NEIGHBOR.minRated) — в X; половина толпы — опорные из файла
  const big = (g: 'A' | 'B') => person(g, 0.95);
  const users = [...Array.from({ length: 4 }, (_, i) => ({ id: `ua${i}`, list: big('A') })), ...Array.from({ length: 4 }, (_, i) => ({ id: `ub${i}`, list: big('B') }))];
  for (const u of users) { await addUser(u.id); for (const r of u.list) await rate(u.id, r.keys[0], 3, r.raw); }
  const mine = big('A').filter((r) => Number(r.keys[0].slice(5)) <= 50);
  await addUser('me');
  for (const r of mine) await rate('me', r.keys[0], 3, r.raw);
  // фильм 70 оценили двое других участников — счёта нет, 71 — трое, счёт есть; 72 — двое и двойник участника (ниже)
  for (const u of ['ua0', 'ua1']) { await rate(u, film(70), 3, 8); await rate(u, film(72), 3, 8); }
  for (const u of ['ua0', 'ua1', 'ub0']) await rate(u, film(71), 3, 8);
  await addUser('few');
  for (const i of range(1, EASE.minRated - 1)) await rate('few', film(i), 5, null);

  const anchorsOf = (list: { films: EaseFilm[] }[]) => JSON.stringify(anchorFileOf(list, (() => { let n = 0; return () => `z${n++}`; })()));
  const anchorText = anchorsOf(crowd);
  const env = { DB, EASE: '1', NEIGHBOR_ANCHORS: async () => anchorText } as unknown as EaseEnv;
  type Body = { rated: number; scale: number; keys: string[]; bin: number[]; like: number[] };
  const get = async (u: string, e = env) => { const r = await getEase(u, e); return { status: r.status, body: await r.json() as Body }; };

  assert.equal((await get('me', { ...env, EASE: '' } as EaseEnv)).status, 404, 'без EASE=1 ручки нет');
  assert.deepEqual((await get('few')).body, { rated: EASE.minRated - 1, scale: EASE.scale, keys: [], bin: [], like: [] });
  // X из 24 человек — меньше minPeople: пусто (без опорных историй EASE не включается); дальше — порог ниже
  assert.deepEqual((await get('me')).body.keys, [], 'малый X — источника нет');
  EASE_SERVER.minPeople = 10;

  const a = await get('me');
  assert.equal(a.status, 200);
  assert.equal(a.body.rated, mine.length);
  const table = new Map(a.body.keys.map((k, i) => [k, a.body.bin[i]]));
  assert.equal(table.has(film(70)), false, 'двое других — без счёта');
  assert.equal(table.has(film(71)), true, 'трое других — со счётом');
  for (const r of mine) assert.equal(table.has(r.keys[0]), false, `оценённое ${r.keys[0]} не отдаётся`);
  // сверка: X — набор без участника (его строки нет), обучен с нуля; ответ — тот же с точностью округления
  const pool = (await neighborPool(env as NeighborEnv)).value;
  assert.ok(pool.people.some((p) => p.id === 'u:me'), 'участник в наборе соседей есть');
  // двойников в толпе нет — тогда X сервера — весь набор без участника (двойники — отдельная проверка ниже)
  assert.equal(new Set(pool.people.map((p) => p.group)).size, pool.people.length);
  const others = new Map<string, EaseFilm[]>(pool.people.filter((p) => p.id !== 'u:me').map((p) => [p.id, [...p.z].map(([f, z]) => ({ keys: pool.filmKeys[f], z }))]));
  const myZ = personZ(mine);
  for (const [kind, col] of [['bin', a.body.bin], ['like', a.body.like]] as const) {
    const d = easeData(others, kind), s = easeScores(easeFit(d), easeInput(d, myZ));
    a.body.keys.forEach((k, i) => {
      const want = easeScoreOf(d, s, [k]);
      assert.ok(want != null && Math.abs(Math.round(want * EASE.scale) - col[i]) <= 1, `${kind}: ${k} — как без участника`);
    });
  }

  // кэш: тот же ответ; новая оценка — пересчёт, и новое оценённое пропадает
  assert.deepEqual((await get('me')).body, a.body);
  await rate('me', film(55), 5, 10, '2026-10-24T11:00:00.000Z');
  const b = await get('me');
  assert.equal(b.body.rated, a.body.rated + 1);
  assert.equal(b.body.keys.includes(film(55)), false);

  // двойник: его история ещё и среди опорных (и в ней фильм 72) — из X вынут и он: ответ тот же, 72 без счёта (иначе
  // его «оценили трое»)
  const before = await get('me');
  forgetNeighbors(); forgetEase();
  const meAsAnchor = personZ([...mine, { keys: [film(55)], raw: 10 }, { keys: [film(72)], raw: 9 }]);
  const twinText = anchorsOf([...crowd, { films: meAsAnchor }]);
  const c = await get('me', { ...env, NEIGHBOR_ANCHORS: async () => twinText } as EaseEnv);
  assert.deepEqual(c.body.keys, before.body.keys);
  assert.equal(c.body.keys.includes(film(72)), false, 'двойник не в X: 72 оценили двое других');
  c.body.bin.forEach((v, i) => assert.ok(Math.abs(v - before.body.bin[i]) <= 1, `двойник не в X: ${c.body.keys[i]}`));
  DB.close?.();
} finally {
  rmSync(dir, { recursive: true, force: true });
}

// ─── лента: без опыта — прежний счёт ───────────────────────────────────────────
{
  const entries = userJournal.map((e) => {
    const an = userAnnotations[e.work.id];
    const work = an ? { ...e.work, primaryOperations: an.ops.map(([op, intensity]) => ({ op, intensity })), complexityLevel: an.level, isNicheMasterpiece: an.niche } : e.work;
    return { ...e, work, rating: userRatings[e.work.id]?.rating };
  });
  const reg = <T extends { id: string; registers?: string[] }>(w: T) => ({ ...w, registers: w.registers ?? workRegisters[w.id] });
  const state = deriveState('u', entries.map((e) => ({ ...e, work: reg(e.work) })) as never, '2026-10-24', { alsoSeen: watchedWorks.map(reg) as never, base: registerBase })!;
  const cands: Candidate[] = candidateSeeds.map((s) => ({ work: reg(seedToCard(s)) as never, what: s.what }));
  const base: RecommendOptions = { fame: { level: (w) => (w.year ?? 0) % 4, mode: 'soft' }, consensus: { of: (w) => ((w.year ?? 0) % 7) / 7 - 0.4, weight: 0 } };
  const ease: RecommendOptions['ease'] = { bin: (w) => ((w.year ?? 0) % 3 ? ((w.year ?? 0) % 10) / 20 : undefined), like: (w) => ((w.year ?? 0) % 3 ? 0.01 : undefined) };
  /** прежний learnedScore (до 24.10): LEARNED_B по прежним частям */
  const old = (c: Candidate, o: RecommendOptions) => {
    const p = learnedParts(state, c, 'normal', o);
    let s = LEARNED_B.shift;
    for (const k of Object.keys(LEARNED_B) as (keyof typeof LEARNED_B)[]) {
      if (k === 'missing' || k === 'yearMean' || k === 'shift') continue;
      const x = p[k];
      if (x === undefined) continue;
      s += x === null ? LEARNED_B.missing[k] ?? 0 : LEARNED_B[k] * x;
    }
    return s;
  };
  setExperiments(['learnedBlend']);
  for (const c of cands) {
    const s0 = learnedScore(state, c, 'normal', base);
    assert.equal(s0, old(c, base), `без ease — прежний счёт: ${c.work.id}`);
    assert.equal(learnedScore(state, c, 'normal', { ...base, ease }), s0, `таблица есть, опыта нет — счёт прежний: ${c.work.id}`);
    const p = learnedParts(state, c, 'normal', { ...base, ease });
    assert.equal(p.easeBin, undefined); assert.equal(p.easeLike, undefined);
  }
  setExperiments(['learnedBlend', 'ease']);
  let changed = 0;
  for (const c of cands) {
    assert.equal(learnedScore(state, c, 'normal', base), old(c, base), `опыт есть, таблицы нет — LEARNED_B: ${c.work.id}`);
    const p = learnedParts(state, c, 'normal', { ...base, ease });
    assert.equal(p.easeBin, ease.bin(c.work) ?? null);
    if (learnedScore(state, c, 'normal', { ...base, ease }) !== old(c, base)) changed++;
  }
  assert.ok(changed === cands.length, 'с таблицей — LEARNED_E');
  setExperiments([]);
}
console.log('ease: ок');
