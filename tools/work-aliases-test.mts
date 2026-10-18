// Проверка канона копий (17.10, волна А проверки дублей; правило главной копии — владелец):
//   1. правило главной копии (tools/work-aliases.mts): общая > личная, среди общих — разметка, разборы, прежняя главная,
//      ключи; таблица — без спорных групп, свёрнута, лишний id исчезнувшей карточки остаётся;
//   2. canon на клиенте (src/lib/canon.ts) — по таблице сборки;
//   3. перенос записей на сервере (worker/workAliases.ts) — тестовая SQLite во временной папке: конфликты (оценка —
//      последняя, просмотренное — последнее действие, послесловие — слияние полей, журнал — без дублей), резервная
//      таблица, повторный запуск ничего не меняет, новая версия таблицы доносит только новое;
//   4. сервер принимает старый id: настоящий обработчик воркера, гость по сессии (ALLOW_DEMO).
//
//   npx tsx tools/work-aliases-test.mts
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { aliasVersion, buildAliases, pickMain, type AliasCard, type AliasSide, type MainFacts } from './work-aliases.mts';
import { canon, canonIn, isAlias, aliasesOf, workAliases, workAliasesVersion } from '../src/lib/canon.ts';
import { migrateWorkAliases } from '../worker/workAliases.ts';
import worker from '../worker/index.ts';
import type { Env } from '../worker/env.ts';

const require = createRequire(import.meta.url);
const { openD1 } = require('../server/d1-sqlite.js');
const dir = mkdtempSync(join(tmpdir(), 'tm-aliases-'));
const schema = readFileSync(new URL('../worker/schema.sql', import.meta.url), 'utf8');

// ─── 1. правило главной копии ───────────────────────────────────────────────────────────────────────────────────
{
  const f = (id: string, srcs: string[], over: Partial<MainFacts> = {}): MainFacts =>
    ({ id, srcs, mark: '', analyses: 0, nkeys: 1, full: 3, img: false, credits: false, ...over });
  // личная копия с разметкой владельца и всеми ключами — всё равно не главная, если есть общая
  let r = pickMain([f('u-kp1', ['userHistory'], { mark: 'user', nkeys: 3, full: 9, img: true }), f('f-tmdb1', ['filmBase'])]);
  assert.equal(r.main, 'f-tmdb1', 'общая > личная');
  assert.equal(r.why, 'общая (личная копия — не главная)');
  r = pickMain([f('l-tmdb1', ['userWatched'], { mark: 'draft' }), f('u-kp1', ['userHistory'])]);
  assert.equal(r.main, 'u-kp1', 'обе личные: история > присланный список');
  // среди общих — своя разметка, потом черновик, потом разборы
  r = pickMain([f('f-tmdb2', ['filmBase'], { mark: 'draft', nkeys: 3 }), f('c-x', ['candidates'], { mark: 'own' })]);
  assert.equal(r.main, 'c-x');
  r = pickMain([f('f-tmdb3', ['filmBase'], { nkeys: 3 }), f('f-wd3', ['filmBaseWiki'], { analyses: 2 })]);
  assert.equal(r.main, 'f-wd3', 'разборы выше ключей');
  // прежняя главная держится, пока у другой нет лучшей разметки или разборов (ночная пересборка не гоняет записи)
  r = pickMain([f('f-tmdb4', ['filmBase'], { nkeys: 3 }), f('f-wd4', ['filmBaseWiki'], { nkeys: 1 })], 'f-wd4');
  assert.equal(r.main, 'f-wd4');
  r = pickMain([f('f-tmdb4', ['filmBase'], { mark: 'draft' }), f('f-wd4', ['filmBaseWiki'])], 'f-wd4');
  assert.equal(r.main, 'f-tmdb4', 'разметка важнее липкости');

  // таблица из карточек: склейка по ключам, спорные группы — мимо таблицы
  const card = (src: string, id: string, title: string, year: number, ext: AliasCard['ext'], over: Partial<AliasCard> = {}): AliasCard =>
    ({ src, id, title, year, ext, ops: 0, level: 0, img: false, blurb: false, countries: 0, genres: 0, regs: 0, ...over });
  const side: AliasSide = {
    externalIds: {}, bookWorks: {}, workCredits: {}, people: {}, analyses: {}, workDetailAnalyses: {},
    draftFilm: new Set(['tmdb:10']), draftSeries: new Set(), draftBook: new Set(), userAnn: new Set(['u-kp10']),
    baseMedia: {}, bookMedia: {}, catalogMedia: new Set(),
  };
  const cards: AliasCard[] = [
    card('userHistory', 'u-kp10', 'Солярис', 1972, { tmdb: 10, kinopoisk: 43 }),
    card('userWatched', 'l-tmdb10', 'Солярис', 1972, { tmdb: 10 }),
    card('filmBase', 'f-tmdb10', 'Солярис', 1972, { tmdb: 10, imdb: 'tt1' }),
    card('filmBaseWiki', 'f-wd10', 'Solaris', 1972, { wikidata: 'Q10', imdb: 'tt1' }),
    // только личные — главная из истории
    card('userHistory', 'u-kp20', 'Игра', 1997, { tmdb: 20 }),
    card('userWatched', 'l-tmdb20', 'Игра', 1997, { tmdb: 20 }),
    // спор ключей: одна imdb, разные tmdb — в отчёт, не в таблицу
    card('filmBase', 'f-tmdb30', 'Двойник', 2013, { tmdb: 30, imdb: 'tt3' }),
    card('filmBaseWiki', 'f-tmdb31', 'Двойник', 2013, { tmdb: 31, imdb: 'tt3' }),
    // книга и фильм с одним элементом — не склеиваются
    card('bookBase', 'b-wd40', 'Пикник', 1972, { wikidata: 'Q40' }, { type: 'book' }),
    card('filmBaseWiki', 'f-wd40', 'Пикник', 1972, { wikidata: 'Q40' }),
  ];
  const res = buildAliases(cards, side, { 'u-gone': 'u-kp10', 'f-tmdb30': 'f-tmdb31' });
  assert.deepEqual(res.aliases, {
    'f-wd10': 'f-tmdb10', 'l-tmdb10': 'f-tmdb10', 'u-kp10': 'f-tmdb10', 'l-tmdb20': 'u-kp20',
    // карточки u-gone больше нет — остаётся, на главную по новой таблице (u-kp10 стал лишним — цепочка свёрнута)
    'u-gone': 'f-tmdb10',
  });
  assert.equal(res.review.length, 1, 'спорная группа — одна (Двойник)');
  assert.deepEqual(res.kept, ['u-gone']);
  assert.equal(res.version, aliasVersion(res.aliases));
  assert.equal(aliasVersion({ b: 'x', a: 'y' }), aliasVersion({ a: 'y', b: 'x' }), 'версия не зависит от порядка');
  console.log('ok: правило главной копии');
}

// ─── 2. canon на клиенте ────────────────────────────────────────────────────────────────────────────────────────
{
  const n = Object.keys(workAliases).length;
  assert.ok(n > 0, 'таблица сборки не пустая');
  for (const [a, m] of Object.entries(workAliases)) {
    assert.ok(!isAlias(m), `главная ${m} не лишняя`);
    assert.equal(canon(a), m);
    assert.ok(aliasesOf(m).includes(a));
  }
  assert.equal(canon('u-kp345'), 'f-tmdb274', '«Молчание ягнят» из истории — на общую карточку');
  assert.equal(canon('f-tmdb274'), 'f-tmdb274', 'главная — сама собой');
  assert.equal(canon('нет-такого'), 'нет-такого');
  assert.equal(canonIn({ a: 'b', b: 'c' }, 'a'), 'c', 'цепочка');
  assert.equal(canonIn({ a: 'b', b: 'a' }, 'a').length, 1, 'кольцо не вешает');
  assert.equal(canon('toString'), 'toString', 'свойства объекта — не псевдонимы');
  // личная карточка не бывает главной, если в группе есть общая: главные — общие, кроме групп из одних личных
  const personal = (id: string) => /^[ul]-/.test(id); // userHistory u-kp…/u-tmdb…, userWatched l-…
  const personalMains = new Set(Object.values(workAliases).filter(personal));
  for (const m of personalMains) for (const a of aliasesOf(m)) assert.ok(personal(a), `у личной главной ${m} лишняя ${a} — тоже личная`);
  console.log(`ok: canon (${n} псевдонимов, версия ${workAliasesVersion})`);
}

// ─── 3. перенос записей на сервере ──────────────────────────────────────────────────────────────────────────────
{
  const DB = await openD1({ file: join(dir, 'migrate.sqlite'), schema });
  const at = (d: number) => `2026-10-${String(d).padStart(2, '0')}T10:00:00.000Z`;
  for (const id of ['A', 'B']) await DB.prepare("INSERT INTO user (id, settings, created_at, seen_at) VALUES (?, '{}', ?, ?)").bind(id, at(1), at(1)).run();
  const run = (sql: string, ...v: unknown[]) => DB.prepare(sql).bind(...v).run();
  const card = (id: string, extra: Record<string, unknown> = {}) => JSON.stringify({ id, title: id, ...extra });
  // таблица: две лишние копии одной вещи (x1, x2 → m) и одна — другой (y1 → n)
  const T1 = { x1: 'm', x2: 'm', y1: 'n' };
  // оценки: у A на x1 (старая) и на m (новая) — остаётся m; на x2 и n нет; у B только на x1 — переезжает
  await run('INSERT INTO rating (user_id, work_id, rating, raw, work, at) VALUES (?, ?, ?, ?, ?, ?)', 'A', 'x1', 2, null, card('x1', { kp: 1 }), at(2));
  await run('INSERT INTO rating (user_id, work_id, rating, raw, work, at) VALUES (?, ?, ?, ?, ?, ?)', 'A', 'm', 5, null, null, at(5));
  await run('INSERT INTO rating (user_id, work_id, rating, raw, work, at) VALUES (?, ?, ?, ?, ?, ?)', 'B', 'x1', 4, 8, card('x1'), at(3));
  // а у B на x2 позже, чем на x1, — две лишние, последняя по времени
  await run('INSERT INTO rating (user_id, work_id, rating, raw, work, at) VALUES (?, ?, ?, ?, ?, ?)', 'B', 'x2', 3, 6, card('x2'), at(4));
  // просмотренное: у A снято на m раньше, отмечено на x1 позже — «отмечено»
  await run("INSERT INTO watched (user_id, work_id, state, work, tmdb, imdb, at) VALUES (?, ?, 'removed', NULL, NULL, 'tt9', ?)", 'A', 'm', at(2));
  await run("INSERT INTO watched (user_id, work_id, state, work, tmdb, imdb, at) VALUES (?, ?, 'watched', ?, 7, NULL, ?)", 'A', 'x1', card('x1'), at(6));
  await run("INSERT INTO watched (user_id, work_id, state, work, tmdb, imdb, at) VALUES (?, ?, 'watched', ?, NULL, NULL, ?)", 'A', 'y1', card('y1'), at(3));
  // послесловие: на x1 «стоило» и темп (старое), на m только зацепка (новое) — сливаются
  await run('INSERT INTO afterword (user_id, work_id, worth, pace, hook, at) VALUES (?, ?, ?, ?, ?, ?)', 'A', 'x1', 4, 'slow', null, at(2));
  await run('INSERT INTO afterword (user_id, work_id, worth, pace, hook, at) VALUES (?, ?, ?, ?, ?, ?)', 'A', 'm', null, 'fast', 'world', at(7));
  // журнал: A досмотрел на x1 (с датой), лента завела план на m (не узнала) — план уходит, досмотр переезжает;
  // у B два «досмотрено» на x1 и m — остаётся полнее заполненное; своя пара одной копии (y1: бросил и начал заново) — как есть
  const j = (user: string, entry: string, work: string, status: string, started?: string, finished?: string, eager?: number) =>
    run('INSERT INTO journal (user_id, entry_id, work_id, work, status, started_at, finished_at, eagerness) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      user, entry, work, card(work), status, started ?? null, finished ?? null, eager ?? null);
  await j('A', 'jA1', 'x1', 'finished', at(1), at(2));
  await j('A', 'jA2', 'm', 'planned', at(8), undefined, 4);
  await j('B', 'jB1', 'x1', 'finished', undefined, at(3));
  await j('B', 'jB2', 'm', 'finished', at(2), at(4));
  await j('A', 'jA3', 'y1', 'abandoned', at(1));
  await j('A', 'jA4', 'y1', 'in_progress', at(9));
  // наблюдения: только смена id
  await run("INSERT INTO prediction (user_id, entry_id, work_id, expected, at) VALUES ('A', 'jA1', 'x1', 'ok', ?)", at(1));
  await run("INSERT INTO checkin (id, user_id, entry_id, work_id, status, at) VALUES ('c1', 'A', 'jA1', 'x1', 'finished', ?)", at(2));
  await run("INSERT INTO event (id, user_id, kind, work_id, at) VALUES ('e1', 'A', 'card', 'x2', ?)", at(2));
  await run("INSERT INTO feedback (id, user_id, work_id, action, at) VALUES ('f1', 'B', 'y1', 'dismiss', ?)", at(2));
  await run("INSERT INTO impression (id, user_id, slate_id, rec_id, work_id, at) VALUES ('i1', 'B', 's', 'r', 'x1', ?)", at(2));
  await run("INSERT INTO link_verdict (user_id, url, work_id, verdict, at) VALUES ('A', 'u', 'x1', 'about_this', ?)", at(2));
  // чужое и главное — не трогается
  await run('INSERT INTO rating (user_id, work_id, rating, at) VALUES (?, ?, ?, ?)', 'B', 'z', 3, at(2));

  const dump = async () => ({
    rating: (await DB.prepare('SELECT user_id, work_id, rating, raw, work, at FROM rating ORDER BY user_id, work_id').all()).results,
    watched: (await DB.prepare('SELECT user_id, work_id, state, work, tmdb, imdb, at FROM watched ORDER BY user_id, work_id').all()).results,
    afterword: (await DB.prepare('SELECT user_id, work_id, worth, pace, hook, at FROM afterword ORDER BY user_id, work_id').all()).results,
    journal: (await DB.prepare('SELECT user_id, entry_id, work_id, work, status FROM journal ORDER BY user_id, entry_id').all()).results,
    other: [
      ...(await DB.prepare('SELECT work_id FROM prediction').all()).results, ...(await DB.prepare('SELECT work_id FROM checkin').all()).results,
      ...(await DB.prepare('SELECT work_id FROM event').all()).results, ...(await DB.prepare('SELECT work_id FROM feedback').all()).results,
      ...(await DB.prepare('SELECT work_id FROM impression').all()).results, ...(await DB.prepare('SELECT work_id FROM link_verdict').all()).results,
    ],
  });
  const before = await dump();
  const v1 = 'test-v1';
  const r1 = await migrateWorkAliases(DB, T1, v1);
  assert.ok(r1, 'первый запуск переносит');
  const after = await dump();
  const id = (raw: unknown) => JSON.parse(String(raw)).id;
  // оценки
  assert.deepEqual(after.rating.map((r: any) => [r.user_id, r.work_id, r.rating]), [['A', 'm', 5], ['B', 'm', 3], ['B', 'z', 3]],
    'оценка — последняя по времени: у A своя на главной, у B — x2 (позже x1)');
  assert.equal(id((after.rating as any[]).find((r) => r.user_id === 'A').work ?? card('m')), 'm', 'карточка главной — под главным id');
  assert.equal(id((after.rating as any[]).find((r) => r.user_id === 'B' && r.work_id === 'm').work), 'm', 'карточка в JSON — под главным id');
  // просмотренное: последнее действие, ключи — с любой копии
  const wA = (after.watched as any[]).filter((r) => r.user_id === 'A');
  assert.deepEqual(wA.map((r) => [r.work_id, r.state]), [['m', 'watched'], ['n', 'watched']]);
  assert.equal(wA[0].tmdb, 7);
  assert.equal(wA[0].imdb, 'tt9', 'IMDb — со снятой строки главной');
  assert.equal(id(wA[0].work), 'm');
  // послесловие: поля слиты, время — свежее
  assert.deepEqual(after.afterword.map((r: any) => [r.work_id, r.worth, r.pace, r.hook, r.at]), [['m', 4, 'fast', 'world', at(7)]]);
  // журнал
  assert.deepEqual(after.journal.map((r: any) => [r.user_id, r.entry_id, r.work_id, r.status]), [
    ['A', 'jA1', 'm', 'finished'],
    ['A', 'jA3', 'n', 'abandoned'],
    ['A', 'jA4', 'n', 'in_progress'],
    ['B', 'jB2', 'm', 'finished'],
  ], 'исполненный план ушёл, из двух «досмотрено» — полнее, своя пара одной копии — обе');
  assert.ok(after.journal.every((r: any) => id(r.work) === r.work_id), 'карточки журнала — под главными id');
  assert.deepEqual(after.other.map((r: any) => r.work_id).sort(), ['m', 'm', 'm', 'm', 'm', 'n']);
  // резервная таблица: каждая затронутая строка — как была
  const bk = (await DB.prepare('SELECT tbl, user_id, work_id, main, action, row FROM work_alias_backup ORDER BY seq').all()).results as any[];
  assert.equal(bk.length, r1!.moved + r1!.dropped);
  const dropped = bk.filter((b) => b.action === 'dropped').map((b) => `${b.tbl}:${b.user_id}:${JSON.parse(b.row).entry_id ?? b.work_id}`).sort();
  assert.deepEqual(dropped, ['afterword:A:x1', 'journal:A:jA2', 'journal:B:jB1', 'rating:A:x1', 'rating:B:x1', 'watched:A:m'].sort());
  const old = bk.find((b) => b.tbl === 'rating' && b.user_id === 'B' && b.work_id === 'x1');
  const { import_id: _imp, ...oldRow } = JSON.parse(old.row);
  assert.equal(_imp, null);
  assert.deepEqual(oldRow, (before.rating as any[]).find((r) => r.user_id === 'B' && r.work_id === 'x1'), 'в копии — строка целиком');
  assert.ok(await DB.prepare('SELECT 1 AS x FROM migration_mark WHERE name = ?').bind(`work-aliases:${v1}`).first());
  // повторный запуск — ничего
  assert.equal(await migrateWorkAliases(DB, T1, v1), undefined, 'та же версия — пропуск');
  assert.deepEqual(await dump(), after, 'повтор ничего не меняет');
  // и даже без отметки (её стёрли руками) — строк с лишним id уже нет: ничего не переносится
  await run('DELETE FROM migration_mark WHERE name = ?', `work-aliases:${v1}`);
  const again = await migrateWorkAliases(DB, T1, v1);
  assert.deepEqual([again?.moved, again?.dropped], [0, 0]);
  assert.deepEqual(await dump(), after);
  // новая версия: ещё одна лишняя (z → n) — переносится только она
  const r2 = await migrateWorkAliases(DB, { ...T1, z: 'n' }, 'test-v2');
  assert.deepEqual([r2?.moved, r2?.dropped], [1, 0]);
  assert.ok((await dump()).rating.some((r: any) => r.user_id === 'B' && r.work_id === 'n' && r.rating === 3));
  console.log(`ok: перенос на сервере (перенесено ${r1!.moved}, снято при слиянии ${r1!.dropped}; повтор — без изменений)`);
}

// ─── 4. сервер принимает старый id ──────────────────────────────────────────────────────────────────────────────
{
  const DB = await openD1({ file: join(dir, 'api.sqlite'), schema });
  const env = { DB, ALLOW_DEMO: '1' } as unknown as Env;
  const call = async (method: string, path: string, token?: string, body?: unknown) => {
    const res = await worker.fetch(new Request(`https://x${path}`, {
      method,
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    }), env);
    return { status: res.status, body: await res.json() as Record<string, any> };
  };
  const s = await call('POST', '/api/session', undefined, { demo: true });
  const token = s.body.token as string;
  const me = s.body.user.id as string;
  // таблица сборки перенесена при первом запросе (migrate) — отметка версии есть
  assert.ok(await DB.prepare('SELECT 1 AS x FROM migration_mark WHERE name = ?').bind(`work-aliases:${workAliasesVersion}`).first());
  const [alias, main] = ['u-kp345', canon('u-kp345')];
  assert.notEqual(alias, main);
  assert.equal((await call('PUT', `/api/rating/${alias}`, token, { rating: 5, work: { id: alias, title: 'Молчание ягнят' } })).status, 200);
  assert.equal((await call('PUT', `/api/watched/${alias}`, token, { watched: true, work: { id: alias, title: 'Молчание ягнят' } })).status, 200);
  assert.equal((await call('PUT', `/api/afterword/${alias}`, token, { worth: 4 })).status, 200);
  const st = await call('POST', '/api/journal/start', token, { workId: alias, work: { id: alias, title: 'Молчание ягнят' } });
  assert.equal(st.status, 200);
  assert.equal((await call('POST', '/api/event', token, { kind: 'card', workId: alias })).status, 200);
  const imp = await call('POST', '/api/import', token, { importId: 'imp-test-1', entries: [{ entryId: 'ji1', workId: 'u-kp361', status: 'finished', work: { id: 'u-kp361' } }] });
  assert.equal(imp.status, 200);
  const rows = async (sql: string) => (await DB.prepare(sql).bind(me).all()).results as any[];
  assert.deepEqual((await rows('SELECT work_id FROM rating WHERE user_id = ?')).map((r) => r.work_id), [main]);
  assert.deepEqual((await rows('SELECT work_id FROM watched WHERE user_id = ?')).map((r) => r.work_id), [main]);
  assert.deepEqual((await rows('SELECT work_id FROM afterword WHERE user_id = ?')).map((r) => r.work_id), [main]);
  assert.deepEqual((await rows('SELECT work_id FROM journal WHERE user_id = ? ORDER BY entry_id')).map((r) => r.work_id).sort(), [main, canon('u-kp361')].sort());
  assert.deepEqual((await rows('SELECT work_id FROM event WHERE user_id = ?')).map((r) => r.work_id), [main]);
  const state = await call('GET', '/api/state', token);
  assert.equal(state.body.ratings[0].workId, main);
  assert.equal(state.body.ratings[0].work.id, main, 'карточка рядом — под главным id');
  assert.equal(state.body.watched[0].work.id, main);
  // снять оценку старым id — снимается главная
  await call('PUT', `/api/rating/${alias}`, token, { rating: null });
  assert.equal((await rows('SELECT work_id FROM rating WHERE user_id = ?')).length, 0);
  console.log('ok: сервер сводит старый id к главному');
}

rmSync(dir, { recursive: true, force: true });
console.log('work-aliases-test: всё прошло');
