// Проверка волны 3Б аудита скорости (18.10, сервер и база):
//   1. миграции ставят индексы (worker/migrate.ts INDEXES) и повтор ничего не меняет; планы ключевых запросов идут по
//      индексам (сводка подписок, аналитика, очистки, поиск по нику);
//   2. отчёт петли из счёта в базе (loopRows → impressionStats) совпадает с прежним — по всем строкам показов;
//   3. воронка (границы дня временем UTC, показы для метрик — выборкой по парам) даёт те же цифры, что прежние запросы;
//   4. свёртка показов (worker/retention.ts) — идемпотентна, считает в отчёте петли и «первой ленте» роста; урезание
//      карточек — раз на версию, флаг на запись;
//   5. переходник d1-sqlite: first() — одна строка, соединение только на чтение не пишет, PRAGMA соединения.
//
//   npx tsx tools/db-perf-test.mts
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { migrate, forgetMigrations, INDEXES, JOURNAL_IMDB } from '../worker/migrate.ts';
import { loopReport, loopRows, type LoopRows } from '../worker/loop.ts';
import { computeMetrics, type MetricRows } from '../worker/metrics.ts';
import { getFunnel, mskDay, mskDayStart } from '../worker/funnel.ts';
import { getGrowth } from '../worker/growthRoute.ts';
import { rollupImpressions, rollupBefore, slimCards, slimCardText, setSlimCards } from '../worker/retention.ts';
import type { D1Database, Env } from '../worker/env.ts';

const require = createRequire(import.meta.url);
const { openD1 } = require('../server/d1-sqlite.js');
const dir = mkdtempSync(join(tmpdir(), 'tm-dbperf-'));
const schema = readFileSync(new URL('../worker/schema.sql', import.meta.url), 'utf8');
let checks = 0;
const ok = (cond: unknown, msg: string) => { assert.ok(cond, msg); checks++; };
const eq = (a: unknown, b: unknown, msg: string) => { assert.deepEqual(a, b, msg); checks++; };

try {
  const file = join(dir, 'tm.sqlite');
  const db: D1Database & { optimize(all?: boolean): void; close(): void } = await openD1({ file, schema });

  // ─── 1. индексы ─────────────────────────────────────────────────────────────────────────────────────────────
  await migrate(db);
  const names = async () => ((await db.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%'").all<{ name: string }>()).results).map((r) => r.name);
  const have = new Set(await names());
  for (const ddl of INDEXES) ok(have.has(/INDEX IF NOT EXISTS (\w+)/.exec(ddl)![1]), `индекс ${ddl}`);
  forgetMigrations();
  await migrate(db);
  eq((await names()).length, have.size, 'повтор миграций — тот же набор индексов');
  const plan = async (sql: string, ...bind: unknown[]) => ((await db.prepare(`EXPLAIN QUERY PLAN ${sql}`).bind(...bind).all<{ detail: string }>()).results).map((r) => r.detail).join(' | ');
  const uses = async (index: string, sql: string, ...bind: unknown[]) => { const p = await plan(sql, ...bind); ok(p.includes(index), `${index}: ${p}`); };
  await uses('journal_imdb', `SELECT user_id FROM journal WHERE (work_id IN (SELECT value FROM json_each(?)) OR ${JOURNAL_IMDB} IN (SELECT value FROM json_each(?)))
    AND status IN ('in_progress', 'finished') AND work IS NOT NULL`, '["imdb:tt1"]', '["tt1"]');
  await uses('journal_work', `SELECT user_id FROM journal WHERE (work_id IN (SELECT value FROM json_each(?)) OR ${JOURNAL_IMDB} IN (SELECT value FROM json_each(?)))`, '[]', '[]');
  await uses('feedback_rec', 'SELECT 1 FROM impression i WHERE EXISTS (SELECT 1 FROM feedback f WHERE f.user_id = i.user_id AND f.rec_id = i.rec_id)');
  await uses('impression_work', 'SELECT 1 FROM feedback f WHERE EXISTS (SELECT 1 FROM impression i WHERE i.user_id = f.user_id AND i.work_id = f.work_id AND i.at < f.at)');
  await uses('material_open_work', 'SELECT 1 FROM impression i WHERE EXISTS (SELECT 1 FROM material_open m WHERE m.user_id = i.user_id AND m.work_id = i.work_id AND m.at >= i.at)');
  await uses('inline_vote_at', 'DELETE FROM inline_vote WHERE at < ?', 'x');
  await uses('inline_poll_at', 'DELETE FROM inline_poll WHERE created_at < ?', 'x');
  await uses('together_user', 'SELECT t.id FROM together t JOIN user u ON u.id = t.user_id WHERE u.tg_id = ? AND t.created_at > ? ORDER BY t.created_at DESC LIMIT 1', 1, 'x');
  await uses('user_nick', 'SELECT id FROM user WHERE lower(username) IN (?, ?)', 'a', 'b');
  await uses('together_vote_user', 'DELETE FROM together_vote WHERE user_id = ?', 'u');
  await uses('inline_poll_owner', 'DELETE FROM inline_poll WHERE owner_tg = ?', 1);
  await uses('seed_applied_seed', 'SELECT 1 FROM seed_applied WHERE seed = ? AND user_id <> ?', 'nick:x', 'u');
  // битая карточка (импорт режет по длине) не роняет запись в дневник из-за индекса по выражению
  await db.prepare("INSERT INTO user (id, created_at, seen_at) VALUES ('u-bad', '2020-01-01T00:00:00.000Z', '2020-01-01T00:00:00.000Z')").run();
  await db.prepare("INSERT INTO journal (user_id, entry_id, work_id, work, status) VALUES ('u-bad', 'j', 'w', '{\"title\":\"обрез', 'finished')").run();
  ok(true, 'обрезанный JSON в journal.work записывается');

  // ─── данные: 12 человек, 150 дней, показы, отклики, открытия, события, чек-ины ─────────────────────────────────
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
  const NOW = Date.now();
  const iso = (msAgo: number) => new Date(NOW - msAgo).toISOString();
  const users = Array.from({ length: 12 }, (_, i) => `u-${i}`);
  const works = Array.from({ length: 40 }, (_, i) => `w${i}`);
  const levelOf = (w: string) => 1 + (Number(w.slice(1)) % 9);
  const traits = (w: string) => JSON.stringify({ op: { [`op${Number(w.slice(1)) % 4}`]: 0.5 }, rg: [`r${Number(w.slice(1)) % 3}`] });
  const st: ReturnType<D1Database['prepare']>[] = [];
  users.forEach((u, i) => st.push(db.prepare("INSERT INTO user (id, tg_id, username, created_at, seen_at) VALUES (?, ?, ?, ?, ?)")
    .bind(u, 100 + i, `nick${i}`, iso((10 + i * 12) * 864e5), iso(0))));
  let n = 0;
  for (let d = 150; d >= 0; d--) {
    for (const u of users) {
      if (rnd() < 0.5) continue;
      const t = () => iso(d * 864e5 + rnd() * 864e5 * 0.95);
      st.push(db.prepare('INSERT OR IGNORE INTO visit (user_id, day) VALUES (?, ?)').bind(u, mskDay(NOW - d * 864e5)));
      const slate = `s${n++}`; const at = t();
      for (let r = 0; r < 4; r++) {
        const w = pick(works);
        st.push(db.prepare('INSERT INTO impression (id, user_id, slate_id, rec_id, work_id, slot, rank, at, level, traits) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
          .bind(`i${n++}`, u, slate, `${slate}:${r}`, w, 'main', r, at, levelOf(w), traits(w)));
        if (rnd() < 0.4) {
          const act = pick(['save', 'start', 'dismiss', 'dismiss']);
          st.push(db.prepare('INSERT INTO feedback (id, user_id, rec_id, work_id, action, reason, at, level, traits) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
            .bind(`f${n++}`, u, `${slate}:${r}`, w, act, act === 'dismiss' ? pick(['already_know', 'not_now']) : null, t(), levelOf(w), traits(w)));
        }
        if (rnd() < 0.15) st.push(db.prepare('INSERT INTO material_open (id, user_id, url, work_id, at) VALUES (?, ?, ?, ?, ?)').bind(`o${n++}`, u, `https://x/${n}`, w, t()));
        if (rnd() < 0.2) st.push(db.prepare('INSERT INTO event (id, user_id, kind, work_id, at) VALUES (?, ?, ?, ?, ?)').bind(`e${n++}`, u, pick(['card', 'watch']), w, t()));
        if (rnd() < 0.05) st.push(db.prepare("INSERT INTO checkin (id, user_id, entry_id, work_id, status, perceived, at, level) VALUES (?, ?, 'j', ?, 'finished', 'just_right', ?, ?)").bind(`c${n++}`, u, w, t(), levelOf(w)));
        if (rnd() < 0.05) st.push(db.prepare('INSERT OR REPLACE INTO rating (user_id, work_id, rating, at) VALUES (?, ?, ?, ?)').bind(u, w, 1 + Math.floor(rnd() * 5), t()));
      }
      if (rnd() < 0.1) st.push(db.prepare('INSERT OR IGNORE INTO level_state (user_id, at, center, lo, hi, median, n) VALUES (?, ?, 5, 4, 6, 5, 6)').bind(u, t()));
    }
  }
  await db.batch(st);
  const env: Env = { DB: db, ADMIN_TOKEN: 'admin-token-for-test', OWNER_USERNAME: 'nobody' };
  const adminReq = (path: string) => new Request(`http://x${path}`, { headers: { authorization: 'Bearer admin-token-for-test' } });

  // ─── 2. отчёт петли: счёт в базе = прежний счёт по строкам ───────────────────────────────────────────────────
  const all = <T,>(sql: string) => db.prepare(sql).all<T>().then((r) => r.results);
  const oldLoopRows = async (): Promise<LoopRows> => ({
    predictions: await all('SELECT user_id, entry_id, work_id, expected, model, model_p, at FROM prediction'),
    checkins: await all('SELECT user_id, entry_id, work_id, status, perceived, reason, at FROM checkin'),
    journal: await all('SELECT user_id, entry_id, started_at, work_id, status, eagerness FROM journal'),
    feedback: await all('SELECT user_id, rec_id, work_id, action, reason, at, eagerness FROM feedback'),
    impressions: await all('SELECT user_id, slate_id, rec_id, work_id, slot, rank, at FROM impression'),
  });
  const strip = (r: ReturnType<typeof loopReport>) => ({ ...r, generatedAt: '' });
  const before = strip(loopReport(await oldLoopRows()));
  eq(strip(loopReport(await loopRows(db))), before, 'отчёт петли из счёта в базе = по строкам');
  const meOld = await oldLoopRows();
  const only = (u: string) => (r: { user_id: string }) => r.user_id === u;
  eq(strip(loopReport(await loopRows(db, 'u-3'))).slate, strip(loopReport({
    predictions: meOld.predictions.filter(only('u-3')), checkins: meOld.checkins.filter(only('u-3')), journal: meOld.journal.filter(only('u-3')),
    feedback: meOld.feedback.filter(only('u-3')), impressions: meOld.impressions.filter(only('u-3')),
  })).slate, 'отчёт петли «только мой»');
  ok(before.slate.impressions > 1000 && before.slate.start > 10, `данные не пустые: ${JSON.stringify(before.slate)}`);

  // ─── 3. воронка: те же цифры ─────────────────────────────────────────────────────────────────────────────────
  const funnel = await (await getFunnel(adminReq('/api/admin/funnel'), env, true)).json() as Record<string, any>;
  const today = mskDay();
  const addDays = (day: string, k: number) => new Date(Date.parse(`${day}T00:00:00Z`) + k * 864e5).toISOString().slice(0, 10);
  const from14 = addDays(today, -14);
  // прежние запросы — с date(at, '+3 hours')
  const oldFeeds = await all<{ day: string; n: number }>(`SELECT date(at, '+3 hours') AS day, COUNT(DISTINCT slate_id) AS n FROM impression
    WHERE date(at, '+3 hours') >= '${from14}' GROUP BY day`);
  const oldPrompted = await all<{ day: string; n: number }>(`SELECT date(f.at, '+3 hours') AS day, COUNT(*) AS n FROM feedback f
    WHERE f.action = 'dismiss' AND f.reason = 'already_know' AND date(f.at, '+3 hours') >= '${from14}'
      AND EXISTS (SELECT 1 FROM impression i WHERE i.user_id = f.user_id AND i.work_id = f.work_id AND date(i.at, '+3 hours') < date(f.at, '+3 hours')) GROUP BY day`);
  const oldOpenCards = await all<{ day: string; n: number }>(`SELECT date(c.at, '+3 hours') AS day, COUNT(DISTINCT c.user_id || '|' || c.work_id) AS n FROM event c
    WHERE c.kind = 'card' AND c.work_id IS NOT NULL AND date(c.at, '+3 hours') >= '${from14}'
      AND EXISTS (SELECT 1 FROM material_open x WHERE x.user_id = c.user_id AND x.work_id = c.work_id AND date(x.at, '+3 hours') = date(c.at, '+3 hours')) GROUP BY day`);
  const byDay = (rows: { day: string; n: number }[]) => Object.fromEntries(rows.map((r) => [r.day, r.n]));
  const daily = funnel.daily as { day: string; feeds: number; prompted: number; cardsWithOpen: number }[];
  eq(Object.fromEntries(daily.filter((d) => d.feeds).map((d) => [d.day, d.feeds])), byDay(oldFeeds), 'ленты по дням');
  eq(Object.fromEntries(daily.filter((d) => d.prompted).map((d) => [d.day, d.prompted])), byDay(oldPrompted), '«по подсказке» по дням');
  eq(Object.fromEntries(daily.filter((d) => d.cardsWithOpen).map((d) => [d.day, d.cardsWithOpen])), byDay(oldOpenCards), 'карточки с разбором по дням');
  ok(oldFeeds.length >= 10 && oldPrompted.length > 0, 'данные воронки не пустые');
  // метрики: прежние строки (все показы, все отклики за 120 дней) → те же метрики
  const since = `${addDays(today, -120)}T00:00:00.000Z`;
  const oldRows: MetricRows = {
    users: await all('SELECT id, created_at FROM user'),
    visits: await all(`SELECT user_id, day FROM visit WHERE day >= '${addDays(today, -120)}'`),
    states: await all('SELECT user_id, at, center, lo, hi, median, n FROM level_state'),
    impressions: await all(`SELECT user_id, rec_id, work_id, level, traits, at FROM impression WHERE at >= '${since}'`),
    feedback: await all(`SELECT user_id, rec_id, work_id, action, reason, level, traits, at FROM feedback WHERE at >= '${since}'`),
    checkins: await all(`SELECT user_id, work_id, status, level, worth, at FROM checkin WHERE at >= '${since}'`),
    ratings: await all('SELECT user_id, work_id, rating, at FROM rating'),
    events: await all(`SELECT user_id, kind, work_id, at FROM event WHERE kind IN ('card', 'watch') AND at >= '${since}'`),
  };
  const m = (x: Record<string, unknown>) => ({ ...x, asOf: '' });
  eq(m(funnel.metrics), m(computeMetrics(oldRows) as unknown as Record<string, unknown>), 'метрики МА-1/МА-2 — те же');
  ok(mskDayStart('2026-10-18') === '2026-10-17T21:00:00.000Z', 'начало дня по Москве — в UTC');

  // ─── 4. свёртка показов ──────────────────────────────────────────────────────────────────────────────────────
  const growth0 = await (await getGrowth(adminReq('/api/admin/growth?internal=1'), env, true)).json();
  const cut = rollupBefore(NOW);
  const old = (await db.prepare('SELECT COUNT(*) AS n FROM impression WHERE at < ?').bind(cut).first<{ n: number }>())!.n;
  ok(old > 0, `есть показы старше границы (${old})`);
  const r1 = await rollupImpressions(db, { now: NOW });
  eq(r1.rows, old, 'свёрнуто всё старше границы');
  eq((await db.prepare('SELECT COUNT(*) AS n FROM impression WHERE at < ?').bind(cut).first<{ n: number }>())!.n, 0, 'строк старше границы нет');
  eq((await db.prepare('SELECT SUM(shown) AS n FROM impression_rollup').first<{ n: number }>())!.n, old, 'в свёртке столько же показов');
  const r2 = await rollupImpressions(db, { now: NOW });
  eq([r2.rows, r2.users], [0, 0], 'повтор свёртки ничего не делает');
  const after = strip(loopReport(await loopRows(db)));
  eq([after.slate.impressions, after.slate.slates, after.users], [before.slate.impressions, before.slate.slates, before.users], 'отчёт петли: показы и ленты с учётом свёртки');
  const growth1 = await (await getGrowth(adminReq('/api/admin/growth?internal=1'), env, true)).json();
  eq({ ...growth1, at: '' }, { ...growth0, at: '' }, 'рост: первая лента — с учётом свёртки');
  // 120-дневные окна воронки свёртка не задевает
  const funnel2 = await (await getFunnel(adminReq('/api/admin/funnel'), env, true)).json() as Record<string, any>;
  eq(m(funnel2.metrics), m(funnel.metrics), 'метрики после свёртки — те же');

  // ─── 4б. урезанная карточка ──────────────────────────────────────────────────────────────────────────────────
  const card = JSON.stringify({ id: 'w1', title: 'Т', year: 2000, watch: [{ platform: 'x', url: 'https://x' }] });
  await db.batch(users.slice(0, 3).map((u) => db.prepare("INSERT INTO watched (user_id, work_id, state, work, at) VALUES (?, 'w1', 'watched', ?, ?)").bind(u, card, iso(0))));
  setSlimCards(false);
  eq(slimCardText(card), card, 'флаг выключен — карточка как есть');
  setSlimCards(true);
  eq(JSON.parse(slimCardText(card)!), { id: 'w1', title: 'Т', year: 2000 }, 'флаг включён — без watch');
  eq(slimCardText('{"обрез'), '{"обрез', 'битый JSON — как есть');
  setSlimCards(false);
  const s1 = await slimCards(db, { chunk: 2 });
  ok(s1.done && s1.byTable.watched === 3, `урезано: ${JSON.stringify(s1.byTable)}`);
  ok(!(await db.prepare("SELECT 1 AS x FROM watched WHERE json_type(work, '$.watch') IS NOT NULL").first()), 'watch не осталось');
  eq((await slimCards(db)).done, true, 'повтор — отметка есть');

  // ─── 5. переходник ───────────────────────────────────────────────────────────────────────────────────────────
  eq(await db.prepare('SELECT id FROM user ORDER BY id').first('id'), 'u-0', 'first() — первая строка');
  const pragma = async (p: string) => Object.values((await db.prepare(`PRAGMA ${p}`).first<Record<string, number>>())!)[0];
  eq(await pragma('cache_size'), -65536, 'cache_size 64 МБ');
  eq(await pragma('temp_store'), 2, 'temp_store = MEMORY');
  eq(await pragma('journal_size_limit'), 64 << 20, 'journal_size_limit');
  db.optimize(true);
  ok(true, 'optimize');
  const ro: D1Database & { close(): void } = await openD1({ file, readOnly: true });
  eq(await ro.prepare('SELECT COUNT(*) AS n FROM user').first('n'), 13, 'чтение только на чтение');
  await assert.rejects(() => ro.prepare("INSERT INTO user (id, created_at, seen_at) VALUES ('z', 'x', 'x')").run(), /readonly|read-only|query_only/i);
  checks++;
  ro.close();
  db.close();
  console.log(`db-perf-test: ${checks} проверок — всё сошлось`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
