// Проверка вкладки «Рост» (worker/growth.ts) на синтетике с ответом, посчитанным руками (16.10).
//
//   npx tsx tools/growth-test.mts
//
// Сегодня — 16.10 (по Москве); `at(-3)` — три дня назад в полдень по Москве. Кто есть кто:
//   A — 20 дней назад по метке kinoman, лента через час (активирован), был в день входа, на 1-й и 7-й день;
//   B — 20 дней назад по метке kinoman, ленты нет, был только в день входа;
//   C — 5 дней назад по приглашению A, лента через два часа, был на 1-й день; прошёл первый вход свайпом
//       (seen 4, want 2, no 3, rated 3; любимых 2), оценок в первые сутки 3;
//   D — 40 дней назад сам, лента через два дня (не активирован), вернулся на 35-й день;
//   E — 100 дней назад сам (вне 90 дней), заходил позавчера;
//   посевы: kinoman — 3 000 ₽ 25 дней назад; empty — 1 000 ₽ 10 дней назад, по ней никто не пришёл;
//   поделились: A — 10 и 3 дня назад, D — 2 дня назад; оценок в первые сутки: A — 6, C — 3.
// 24.10: метка из /start при входе кнопкой меню (start_mark) — на настоящем SQLite во временном файле.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { D1Database } from '../worker/env.ts';
import { computeGrowth, wilson, type GrowthRows } from '../worker/growth.ts';
import { noteInvite, rememberStart, START_MARK_TTL, startTail, withRef } from '../worker/invite.ts';
import { campaignView, channelOf, matchSeeding, noteMeta, parseSeedingList, seedingBody, type Arrival } from './growth-desk.mts';

const { openD1 } = createRequire(import.meta.url)('../server/d1-sqlite.js');

const at = (d: number, h = 9) => new Date(Date.UTC(2026, 9, 16 + d, h)).toISOString();
const day = (d: number) => at(d).slice(0, 10);

const rows: GrowthRows = {
  today: day(0),
  users: [
    { id: 'A', created_at: at(-20), source: 'kinoman', invited_by: null },
    { id: 'B', created_at: at(-20), source: 'kinoman', invited_by: null },
    { id: 'C', created_at: at(-5), source: null, invited_by: 'A' },
    { id: 'D', created_at: at(-40), source: null, invited_by: null },
    { id: 'E', created_at: at(-100), source: null, invited_by: null },
  ],
  visits: [
    { user_id: 'A', day: day(-20) }, { user_id: 'A', day: day(-19) }, { user_id: 'A', day: day(-13) },
    { user_id: 'B', day: day(-20) },
    { user_id: 'C', day: day(-5) }, { user_id: 'C', day: day(-4) },
    { user_id: 'D', day: day(-40) }, { user_id: 'D', day: day(-5) },
    { user_id: 'E', day: day(-100) }, { user_id: 'E', day: day(-2) },
  ],
  firstFeed: [{ user_id: 'A', at: at(-20, 10) }, { user_id: 'C', at: at(-5, 11) }, { user_id: 'D', at: at(-38) }],
  ratingsDay1: [{ user_id: 'A', n: 6 }, { user_id: 'C', n: 3 }],
  onboard: [
    { user_id: 'C', place: 'swipe_done', detail: 'seen:4,want:2,no:3,rated:3', at: at(-5, 9) },
    { user_id: 'C', place: 'favorites_done', detail: 'seen:4,want:2,no:3,rated:3,favorites:2', at: at(-5, 9) },
  ],
  shares: [{ user_id: 'A', at: at(-10) }, { user_id: 'A', at: at(-3) }, { user_id: 'D', at: at(-2) }],
  together: { sessions: 1, participants: 2 },
  inline: { polls: 2, voters: 5, outsiders: 3 },
  seeding: [
    { id: 'sd-000000000001', label: 'kinoman', channel: 'Киноман', posted_at: day(-25), price: 3000, currency: 'RUB', note: null },
    { id: 'sd-000000000002', label: 'empty', channel: null, posted_at: day(-10), price: 1000, currency: 'RUB', note: null },
  ],
  internal: { owner: 1, testers: 2 },
};

const g = computeGrowth(rows);
const close = (a: number | null, b: number, eps = 0.01) => assert.ok(a != null && Math.abs(a - b) < eps, `${a} ≠ ${b}`);

// интервал Уилсона: 1 из 2 → 0,5, границы ≈ 0,094–0,906; пусто — null
close(wilson(1, 2).share, 0.5); close(wilson(1, 2).lo, 0.0945); close(wilson(1, 2).hi, 0.9055);
assert.equal(wilson(0, 0).share, null);

// источники: по числу пришедших, при равенстве — по имени; посев без пришедших — тоже строка
assert.deepEqual(g.sources.map((s) => s.source), ['kinoman', 'invited', 'organic', 'empty']);
const [kino, inv, org, empty] = g.sources;
assert.equal(kino.joined, 2); assert.equal(kino.activation.n, 1); assert.equal(kino.activation.of, 2);
// удержание — от активации и только у активированных (25.10): B ленты не получил — в основание не идёт
assert.equal(kino.d1.n, 1); assert.equal(kino.d1.of, 1);     // A вернулся на 1-й день
assert.equal(kino.d7.n, 1); assert.equal(kino.d7.of, 1);     // A был на 7-й день
assert.equal(kino.d30.of, 0); assert.equal(kino.d30.share, null); // 30-й день ещё не прошёл
assert.equal(kino.cost, 3000); assert.equal(kino.perJoined, 1500); assert.equal(kino.perActivated, 3000); assert.equal(kino.perD7, 3000);
assert.equal(kino.posts, 1); assert.deepEqual(kino.channels, ['Киноман']); assert.equal(kino.lastPost, day(-25));
assert.equal(inv.joined, 1); assert.equal(inv.activation.n, 1); assert.equal(inv.d1.n, 1); assert.equal(inv.d7.of, 0);
assert.equal(org.joined, 1); assert.equal(org.activation.n, 0);   // лента через два дня — не активация
assert.equal(org.d1.of, 0); assert.equal(org.d7.of, 0); assert.equal(org.d30.of, 0); // D не активирован — в удержание не идёт
assert.equal(empty.joined, 0); assert.equal(empty.cost, 1000); assert.equal(empty.perJoined, null);

// недели: двенадцать, последняя кончается сегодня — новые C, активные C, D, E, вернувшиеся D и E, поделились дважды
assert.equal(g.weeks.length, 12);
const last = g.weeks.at(-1)!;
assert.equal(last.to, day(0)); assert.equal(last.from, day(-6));
assert.equal(last.joined, 1); assert.equal(last.activated, 1); assert.equal(last.invited, 1); assert.equal(last.seeded, 0);
assert.equal(last.active, 3); assert.equal(last.returning, 2); assert.equal(last.shares, 2);
const w3 = g.weeks.at(-3)!; // 14–20 дней назад: вошли A и B, активирован A, активны A и B
assert.equal(w3.joined, 2); assert.equal(w3.activated, 1); assert.equal(w3.seeded, 2); assert.equal(w3.active, 2); assert.equal(w3.returning, 0);

// первый вход: за 30 дней — A, B, C; свайпом прошёл C, остальные колодой
assert.equal(g.onboarding.swipe.joined, 1); assert.equal(g.onboarding.swipe.activation.n, 1);
assert.equal(g.onboarding.swipe.ratingsDay1, 3); assert.equal(g.onboarding.swipe.ratedDay1.n, 0);
assert.equal(g.onboarding.deck.joined, 2); assert.equal(g.onboarding.deck.activation.n, 1);
assert.equal(g.onboarding.deck.ratingsDay1, 3); assert.equal(g.onboarding.deck.ratedDay1.n, 1);
assert.deepEqual(g.onboarding.steps, { swipeDone: 1, swipeSkip: 0, favoritesDone: 1, favoritesSkip: 0 });
assert.deepEqual(g.onboarding.perPerson, { seen: 4, want: 2, no: 3, rated: 3, favorites: 2 });

// вирусность: 3 «поделился» от двух; активных за 30 дней — A, B, C, D, E (B был в день входа, 20 дней назад); по приглашению пришёл C (позвал A)
assert.equal(g.virality.shares, 3); assert.equal(g.virality.sharers, 2);
assert.equal(g.virality.sharerShare.n, 2); assert.equal(g.virality.sharerShare.of, 5);
assert.equal(g.virality.invitedJoined, 1); assert.equal(g.virality.inviters, 1);
close(g.virality.k, 0.2); close(g.virality.invitedPerSharer, 0.5);
assert.equal(g.virality.invited.activation.n, 1);
assert.deepEqual(g.virality.together, { sessions: 1, participants: 2 });
assert.deepEqual(g.virality.inline, { polls: 2, voters: 5, outsiders: 3 });

// сводка: новых за 30 дней — 3, активных — 5, WAU — 3, потрачено за 90 дней — 4 000
assert.equal(g.summary.joined30, 3); assert.equal(g.summary.active30, 5); assert.equal(g.summary.wau, 3); assert.equal(g.summary.spend90, 4000);
assert.deepEqual(g.internal, { owner: 1, testers: 2 });

// история по дням (25.10): от первого входа (E, 100 дней назад) до сегодня, без пропусков; итоги — все пятеро
assert.equal(g.history.length, 101); assert.equal(g.history[0].day, day(-100)); assert.equal(g.history.at(-1)!.day, day(0));
assert.deepEqual(g.history.find((h) => h.day === day(-20)), { day: day(-20), joined: 2, activated: 1, seeded: 2, invited: 0, organic: 0 });
assert.deepEqual(g.history.find((h) => h.day === day(-5)), { day: day(-5), joined: 1, activated: 1, seeded: 0, invited: 1, organic: 0 });
assert.equal(g.history.reduce((a, h) => a + h.joined, 0), 5);
assert.deepEqual(g.totals, { joined: 5, activated: 2 }); // D — лента через два дня
assert.equal(g.watch30, null); // старые строки без watch30

// ── рекламная кампания (23.10): метка доживает до user.source при всех видах ссылок
{
  const REF = '0123456789abcdef';
  type Call = { sql: string; bind: unknown[] };
  const fakeDb = (known: string[] = []) => {
    const calls: Call[] = [];
    const db = { prepare: (sql: string) => ({ bind: (...bind: unknown[]) => ({
      run: async () => { calls.push({ sql, bind }); return {}; },
      first: async () => { calls.push({ sql, bind }); return known.includes(String(bind[0])) ? { id: bind[0] } : null; },
    }) }) };
    return { db: db as never, calls };
  };
  const invite = async (param: string | undefined) => {
    const { db, calls } = fakeDb([`u-${REF}`]);
    await noteInvite(db, 'u-new', param);
    return {
      source: calls.find((c) => c.sql.includes('SET source'))?.bind[0] ?? null,
      by: calls.find((c) => c.sql.includes('SET invited_by'))?.bind[0] ?? null,
    };
  };
  const cases: [string | undefined, string | null, string | null][] = [
    ['--stg_drunk_cinema', 'tg_drunk_cinema', null],                        // голая ссылка на приложение
    ['w-tmdb_496243--stg_melphere', 'tg_melphere', null],                   // карточка фильма
    ['c-tmdb_496243--stg_melphere', 'tg_melphere', null],                   // герой
    ['v-a1b2c3d4--stg_melphere_v', 'tg_melphere_v', null],                  // страница автора (ссылка другого агента)
    ['v-some_author-name--stg_melphere_v', 'tg_melphere_v', null],
    ['t-abc123def--stg_kinoogon', 'tg_kinoogon', null],                     // выбрать вместе
    [`--r${REF}--stg_x`, 'tg_x', `u-${REF}`], [`--stg_x--r${REF}`, 'tg_x', `u-${REF}`],   // с кодом поделившегося, в любом порядке
    [`w-tmdb_1--r${REF}--stg_x`, 'tg_x', `u-${REF}`], [`w-tmdb_1--stg_x--r${REF}`, 'tg_x', `u-${REF}`],
    ['--stg_cronenberg1664_v', 'tg_cronenberg1664_v', null],
    [`--s${'a'.repeat(24)}`, 'a'.repeat(24), null],                          // ровно 24 — можно
    [`--s${'a'.repeat(25)}`, null, null],                                    // 25 — ссылка без источника: пульт не даст такую метку
    ['--sTG_X', null, null],                                                 // заглавные Telegram не меняет — метка теряется
    ['w-tmdb_1', null, null], [undefined, null, null], ['', null, null],
  ];
  for (const [param, source, by] of cases) assert.deepEqual(await invite(param), { source, by }, `noteInvite(${param})`);
  // источник пишется один раз: условие в запросе — source IS NULL
  { const { db, calls } = fakeDb(); await noteInvite(db, 'u-new', '--stg_x'); assert.match(calls[0].sql, /source IS NULL/); }
  // «Поделиться» дописывает код к параметру с меткой и не вылезает за 64 знака
  assert.equal(withRef('w-tmdb_496243--stg_melphere', `u-${REF}`), `w-tmdb_496243--stg_melphere--r${REF}`);
  assert.equal(await invite(withRef('w-tmdb_496243--stg_melphere', `u-${REF}`)).then((x) => x.source), 'tg_melphere');

  // вход через /start бота: `t.me/<бот>?start=--s<метка>` → текст «/start --s<метка>»; хвост несут кнопки ответа
  assert.equal(startTail('/start --stg_drunk_cinema'), '--stg_drunk_cinema');
  assert.equal(startTail('/start@recomend_media_bot --stg_x'), '--stg_x');
  assert.equal(startTail(`/start w-tmdb_1--stg_x--r${REF}`), `--stg_x--r${REF}`);
  assert.equal(startTail(`/start v-a1b2--r${REF}--stg_x_v`), `--r${REF}--stg_x_v`);
  assert.equal(startTail('/start'), undefined); assert.equal(startTail('/start together'), undefined); assert.equal(startTail('привет --stg_x'), undefined);
  // кнопка ответа с донесённым хвостом записывает ту же метку
  assert.equal((await invite(`w-tmdb_1${startTail('/start --stg_x')}`)).source, 'tg_x');
}

// ── метка из /start при входе кнопкой меню (24.10): start_mark на настоящем SQLite (node:sqlite, схема worker/schema.sql)
{
  const REF = '0123456789abcdef', OTHER = 'fedcba9876543210';
  const dir = mkdtempSync(join(tmpdir(), 'tm-start-mark-'));
  const db: D1Database & { close?: () => void } = await openD1({ file: join(dir, 'tm.sqlite'), schema: readFileSync(new URL('../worker/schema.sql', import.meta.url), 'utf8') });
  // колонки миграции (worker/migrate.ts, COLUMNS) — без самой миграции: она тянет таблицу псевдонимов
  await db.prepare('ALTER TABLE user ADD COLUMN invited_by TEXT').run(); await db.prepare('ALTER TABLE user ADD COLUMN source TEXT').run();
  const NOW = Date.UTC(2026, 9, 24, 12);
  const iso = (ms: number) => new Date(ms).toISOString();
  const addUser = (id: string, tg: number | null) => db.prepare('INSERT INTO user (id, tg_id, created_at, seen_at) VALUES (?, ?, ?, ?)').bind(id, tg, iso(NOW), iso(NOW)).run();
  const mark = (tg: number) => db.prepare('SELECT tail, at FROM start_mark WHERE tg_id = ?').bind(tg).first<{ tail: string; at: string }>();
  const who = (id: string) => db.prepare('SELECT source, invited_by FROM user WHERE id = ?').bind(id).first<{ source: string | null; invited_by: string | null }>();
  /** /start в личке → заведение участника при входе в приложение (как postSession в worker/index.ts). */
  const arrive = async (tg: number, text: string, startParam?: string, after = 3600e3) => {
    const tail = startTail(text);
    if (tail) await rememberStart(db, tg, tail, NOW);
    await addUser(`u-${tg}`, tg);
    await noteInvite(db, `u-${tg}`, startParam, tg, NOW + after);
    return { ...(await who(`u-${tg}`)), left: await mark(tg) };
  };
  await addUser(`u-${REF}`, 1); await addUser(`u-${OTHER}`, 2);

  // кнопка меню (start_param пуст) — метка из /start; строка снята
  assert.deepEqual(await arrive(101, '/start --stg_ads'), { source: 'tg_ads', invited_by: null, left: null });
  // кнопка ответа — метка из start_param, та же; строка всё равно снята
  assert.deepEqual(await arrive(102, '/start --stg_ads', 'w-tmdb_1--stg_ads'), { source: 'tg_ads', invited_by: null, left: null });
  // своя метка в start_param важнее метки из /start
  assert.deepEqual(await arrive(103, '/start --stg_ads', 'w-tmdb_1--skinoman'), { source: 'kinoman', invited_by: null, left: null });
  // в start_param только код поделившегося — метка из /start, код — из start_param (не из /start)
  assert.deepEqual(await arrive(104, `/start --stg_ads--r${OTHER}`, `w-tmdb_1--r${REF}`), { source: 'tg_ads', invited_by: `u-${REF}`, left: null });
  // код и метка только в /start — оба доживают
  assert.deepEqual(await arrive(105, `/start --stg_ads--r${REF}`), { source: 'tg_ads', invited_by: `u-${REF}`, left: null });
  // неделя — ещё годится, неделя с секундой — нет (но строка снята)
  assert.deepEqual(await arrive(106, '/start --stg_ads', undefined, START_MARK_TTL), { source: 'tg_ads', invited_by: null, left: null });
  assert.deepEqual(await arrive(107, '/start --stg_ads', undefined, START_MARK_TTL + 1000), { source: null, invited_by: null, left: null });
  // /start без хвоста ничего не пишет; вход без метки — источника нет
  assert.deepEqual(await arrive(108, '/start'), { source: null, invited_by: null, left: null });
  // повторный /start перезаписывает: в ходу последняя метка
  await rememberStart(db, 109, '--sfirst', NOW - 3600e3); await rememberStart(db, 109, '--ssecond', NOW);
  assert.equal((await mark(109))?.tail, '--ssecond');
  assert.deepEqual(await arrive(109, '/start'), { source: 'second', invited_by: null, left: null });
  // уже заведённому участнику не пишем: источник у него записан при заведении и не меняется
  await rememberStart(db, 1, '--stg_ads', NOW);
  assert.equal(await mark(1), null);
  // не хвост — мимо
  await rememberStart(db, 110, 'w-tmdb_1--stg_ads', NOW); await rememberStart(db, 110, '--s', NOW);
  assert.equal(await mark(110), null);
  // вызов без номера (браузер, старый вызов) — start_mark не трогает
  await rememberStart(db, 111, '--stg_ads', NOW); await addUser('u-111', null);
  await noteInvite(db, 'u-111', undefined, undefined, NOW);
  assert.equal((await who('u-111'))?.source, null); assert.equal((await mark(111))?.tail, '--stg_ads');
  // чистка тика (worker/index.ts, scheduled): старше недели — прочь, свежее остаётся
  await rememberStart(db, 112, '--sold', NOW - START_MARK_TTL - 1000);
  await db.prepare('DELETE FROM start_mark WHERE at < ?').bind(iso(NOW - START_MARK_TTL)).run();
  assert.equal(await mark(112), null); assert.equal((await mark(111))?.tail, '--stg_ads');
  db.close?.();
  rmSync(dir, { recursive: true, force: true });
}

// ── кампания: каналы, охват и время из заметки, посты и приход по часам (сегодня 23.10)
{
  assert.equal(channelOf('tg_melphere_v'), 'tg_melphere'); assert.equal(channelOf('tg_melphere'), 'tg_melphere'); assert.equal(channelOf('_v'), '_v');
  assert.deepEqual(noteMeta('охват ~7 000; выход 19:00; erid 2Vtz'), { reach: 7000, time: '19:00' });
  assert.deepEqual(noteMeta('выход 9:05'), { reach: null, time: '09:05' });
  assert.deepEqual(noteMeta('нативом, 25.10'), { reach: null, time: null });

  const T = (s: string) => `${s}:00.000Z`;
  const r2: GrowthRows = {
    today: '2026-10-23',
    users: [
      { id: 'a1', created_at: T('2026-10-20T16:30'), source: 'tg_a', invited_by: null },   // час 0 после выхода, активирован
      { id: 'a2', created_at: T('2026-10-20T18:10'), source: 'tg_a_v', invited_by: null }, // час 2, по ссылке на автора
      { id: 'a3', created_at: T('2026-10-22T17:00'), source: 'tg_a', invited_by: null },   // 49-й час — посту, но вне 48 ч
      { id: 'a4', created_at: T('2026-10-20T15:00'), source: 'tg_a', invited_by: null },   // до выхода (проверял автор)
      { id: 'b1', created_at: T('2026-10-21T05:00'), source: 'tg_b', invited_by: null },   // 08:00 по Москве, пост без времени
      { id: 'o1', created_at: T('2026-10-21T05:00'), source: null, invited_by: null },
    ],
    visits: [{ user_id: 'a1', day: '2026-10-20' }, { user_id: 'a1', day: '2026-10-21' }],
    firstFeed: [{ user_id: 'a1', at: T('2026-10-20T17:00') }, { user_id: 'a3', at: T('2026-10-22T17:30') }, { user_id: 'b1', at: T('2026-10-21T06:00') }],
    ratingsDay1: [], onboard: [], shares: [], together: { sessions: 0, participants: 0 }, inline: { polls: 0, voters: 0, outsiders: 0 },
    seeding: [
      { id: 'sd-00000000000a', label: 'tg_a', channel: '@a', posted_at: '2026-10-20', price: 2000, currency: 'RUB', note: 'охват 1000; выход 19:00' },
      { id: 'sd-00000000000b', label: 'tg_b', channel: '@b', posted_at: '2026-10-21', price: 1000, currency: 'RUB', note: 'охват 500' },
    ],
    internal: { owner: 0, testers: 0 },
  };
  const g2 = computeGrowth(r2);
  // так сервер отдал бы `arrivals` (правка worker/growth.ts — в отчёте 23.10): без id, rated — оценок в первые сутки
  const arrivals: Arrival[] = [
    { source: 'tg_a', at: T('2026-10-20T16:30'), activated: true, rated: 12, d1: true, d7: null },
    { source: 'tg_a_v', at: T('2026-10-20T18:10'), activated: false, rated: 3, d1: false, d7: null },
    { source: 'tg_a', at: T('2026-10-22T17:00'), activated: true, rated: 4, d1: null, d7: null },
    { source: 'tg_a', at: T('2026-10-20T15:00'), activated: false, rated: 0, d1: false, d7: null },
    { source: 'tg_b', at: T('2026-10-21T05:00'), activated: true, rated: 10, d1: false, d7: null },
  ];
  const c0 = campaignView({ sources: g2.sources, seedingRows: r2.seeding });
  assert.equal(c0.arrivalsKnown, false); assert.equal(c0.posts[0].hours, null); assert.equal(c0.channels[0].activationStrict, null);
  const c = campaignView({ sources: g2.sources, seedingRows: r2.seeding, arrivals });
  assert.deepEqual(c.labels.map((l) => l.label).sort(), ['tg_a', 'tg_a_v', 'tg_b']);   // «сами» и «позвал друг» — не кампания
  assert.deepEqual(c.channels.map((x) => x.channel), ['tg_a', 'tg_b']);
  const [ca, cb] = c.channels;
  assert.deepEqual(ca.labels, ['tg_a', 'tg_a_v']); assert.equal(ca.joined, 4); assert.equal(ca.activation.n, 2); assert.equal(ca.activation.of, 4);
  assert.equal(ca.d1.n, 1); assert.equal(ca.d1.of, 1);           // в основании — активированные: a1; у a3 1-й день ещё не прошёл
  assert.equal(ca.d7.of, 0); assert.equal(ca.perD7, null);
  assert.equal(ca.cost, 2000); assert.equal(ca.reach, 1000); close(ca.openRate, 0.004, 1e-9); assert.equal(ca.perReach, 2);
  assert.equal(ca.perJoined, 500); assert.equal(ca.perActivated, 1000);
  assert.equal(ca.activationStrict!.n, 1); assert.equal(ca.activationStrict!.of, 4);   // лента и ≥ 10 оценок — только a1
  const la = c.labels.find((l) => l.label === 'tg_a')!, lv = c.labels.find((l) => l.label === 'tg_a_v')!;
  assert.equal(la.joined, 3); assert.equal(la.perJoined, 2000 / 3); assert.equal(lv.joined, 1); assert.equal(lv.cost, null); assert.equal(lv.channel, 'tg_a');
  assert.equal(cb.joined, 1); assert.equal(cb.perActivated, 1000); assert.equal(cb.activationStrict!.n, 1);
  // посты: новые сверху; вход до выхода — не посту; 49-й час — посту, но не в кривой
  assert.deepEqual(c.posts.map((p) => p.label), ['tg_b', 'tg_a']);
  const [pb, pa] = c.posts;
  assert.equal(pa.at, T('2026-10-20T16:00')); assert.equal(pa.timeKnown, true); assert.equal(pa.reach, 1000);
  assert.equal(pa.joined, 3); assert.equal(pa.joined48, 2); assert.equal(pa.activated48, 1);
  assert.equal(pa.hours!.length, 48); assert.equal(pa.hours![0], 1); assert.equal(pa.hours![2], 1); assert.equal(pa.activatedHours![0], 1);
  assert.deepEqual(pa.byLabel, { tg_a: 2, tg_a_v: 1 }); close(pa.perJoined, 2000 / 3);
  assert.equal(pb.timeKnown, false); assert.equal(pb.at, T('2026-10-20T21:00')); assert.equal(pb.hours![8], 1);   // без времени — от полуночи по Москве
  // повтор поста в канале: вход — к последнему вышедшему до него
  const rep = campaignView({ sources: g2.sources, arrivals, seedingRows: [...r2.seeding,
    { id: 'sd-00000000000c', label: 'tg_a_v', channel: '@a', posted_at: '2026-10-22', price: 500, currency: 'RUB', note: 'выход 19:30' }] });
  const [p2] = rep.posts.filter((p) => p.channel === 'tg_a');
  assert.equal(p2.id, 'sd-00000000000c'); assert.equal(p2.joined, 1); assert.equal(p2.hours![0], 1);  // a3 — через полчаса после повтора
  assert.equal(rep.posts.find((p) => p.id === 'sd-00000000000a')!.joined, 2);
}

// ── посевы списком: строки таблиц плана как есть, свободный порядок, ошибки — на строке
{
  const text = [
    '| канал | подписчики | охват поста | тип | потолок цены | метка |',
    '|---|---|---|---|---|---|',
    '| @drunk_cinema | 18,6 тыс. | ~7 000 | синефилия, авторский | 5 600 ₽ | `tg_drunk_cinema` |',
    '@cinsolite tg_cinsolite 2100 25.10 19:00',
    '@kinoogon_official; tg_kinoogon; 6 800 ₽; 2026-11-02; охват 8560; erid abc',
    'https://t.me/recomend_media_bot?startapp=w-tmdb_496243--stg_melphere_v 7200 03.11',
    '@need2watch 1300',
    'tg_way_too_long_label_for_server 100 25.10',
    '25.10 100₽ @dldpone',
    '31.02 tg_x 100',
    '| @x_channel | 3 000 ₽ | 25.10 |',            // таблица без «потолка» — ₽ это цена
    '',
  ].join('\n');
  const P = parseSeedingList(text, { year: 2026 });
  assert.deepEqual(P.map((r) => r.line), [3, 4, 5, 6, 7, 8, 9, 10, 11]);   // заголовок и разделитель — мимо
  const [d, cs, ko, mv, nw, long, dl, bad, xc] = P;
  // строка плана: под заголовком «потолок цены» ₽ — потолок, а не цена (иначе «потрачено» выросло бы до покупки)
  assert.deepEqual([d.channel, d.label, d.price, d.reach, d.posted_at, d.currency], ['@drunk_cinema', 'tg_drunk_cinema', null, 7000, null, 'RUB']);
  assert.equal(d.note, 'потолок 5600 ₽; 18,6 тыс. подписчиков; синефилия, авторский');
  assert.ok(d.warnings.includes('дата выхода не указана')); assert.ok(!d.warnings.includes('без цены')); assert.equal(d.error, undefined);
  assert.deepEqual([xc.label, xc.price, xc.posted_at], ['tg_x_channel', 3000, '2026-10-25']);
  assert.deepEqual([cs.channel, cs.label, cs.price, cs.posted_at, cs.time], ['@cinsolite', 'tg_cinsolite', 2100, '2026-10-25', '19:00']);
  assert.deepEqual([ko.label, ko.price, ko.posted_at, ko.reach, ko.note], ['tg_kinoogon', 6800, '2026-11-02', 8560, 'erid abc']);
  assert.deepEqual([mv.label, mv.price, mv.posted_at, mv.channel], ['tg_melphere_v', 7200, '2026-11-03', null]);
  assert.equal(nw.label, 'tg_need2watch'); assert.equal(nw.price, 1300); assert.ok(nw.warnings.some((w) => w.startsWith('метка не указана')));
  assert.match(long.error!, /24/);
  assert.deepEqual([dl.posted_at, dl.price, dl.channel, dl.label], ['2026-10-25', 100, '@dldpone', 'tg_dldpone']);
  assert.match(bad.error!, /нет такой даты/);

  // в заметку — охват и время выхода; поверх записанного без даты — тот же посев, пустое не стирает
  assert.deepEqual(seedingBody(cs), { label: 'tg_cinsolite', channel: '@cinsolite', posted_at: '2026-10-25', price: 2100, currency: 'RUB', note: 'выход 19:00' });
  assert.equal(seedingBody(d).note, `охват 7000; ${d.note}`);
  const old = { id: 'sd-0000000000c1', label: 'tg_cinsolite', channel: '@cinsolite', posted_at: null, price: 2100, currency: 'RUB', note: 'охват 2640; синефилия' };
  const [upd] = parseSeedingList('tg_cinsolite 25.10 19:00 1900', { year: 2026 });
  assert.equal(matchSeeding(upd, [old])?.id, old.id);
  assert.deepEqual(seedingBody(upd, old), { id: old.id, label: 'tg_cinsolite', channel: '@cinsolite', posted_at: '2026-10-25', price: 1900, currency: 'RUB', note: 'охват 2640; выход 19:00; синефилия' });
  // повтор поста в другой день — новый посев, а не правка вышедшего
  const done = { ...old, posted_at: '2026-10-25' };
  const [again] = parseSeedingList('tg_cinsolite 05.11 1500', { year: 2026 });
  assert.equal(matchSeeding(again, [done]), undefined);
  assert.equal(matchSeeding(parseSeedingList('tg_cinsolite 25.10 20:00', { year: 2026 })[0], [done])?.id, old.id);
}

console.log('growth-test: все проверки прошли');
