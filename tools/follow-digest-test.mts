// Проверка сводки подписок (worker/follow.ts) после аудита отказов 17.10, п. 8: замок прогона, отметка «шлём» до
// sendMessage, 429 с паузой, 400/403 — адресат помечен. База SQLite во временном файле, Telegram — подменённый fetch.
//
//   npx tsx tools/follow-digest-test.mts
//
// Сценарий: трое подписаны на «Дом Дракона», у каждого свежий разбор. Два прогона разом — по одному сообщению каждому;
// третий прогон в тот же день — ничего и без подсчёта сезонов. Чужой живой замок — прогон не идёт, протухший (31 мин) —
// идёт. Следующий день: 429 на первом — прогон прерван, пауза в замке, отметка снята; 403 и «chat not found» —
// адресаты помечены и больше не выбираются; «шлём» без «отправлено» (рестарт посреди) — повтора нет; Telegram
// недоступен — прогон прерван на первом, без дублей.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { digestMessage, followDigest, matchFollow } from '../worker/follow.ts';
import { shareResult } from '../worker/inline.ts';
import { migrate } from '../worker/migrate.ts';
import type { Env } from '../worker/env.ts';

const require = createRequire(import.meta.url);
const { openD1 } = require('../server/d1-sqlite.js');
const dir = mkdtempSync(join(tmpdir(), 'tm-digest-'));
const DB = await openD1({ file: join(dir, 'tm.sqlite'), schema: readFileSync(new URL('../worker/schema.sql', import.meta.url), 'utf8') });
await migrate(DB);

const refGets: string[] = [];
const env = { DB, BOT_TOKEN: 'test-token', REFERENCE: { get: async (k: string) => { refGets.push(k); return null; } } } as unknown as Env;

// Telegram: по chat_id — ответ; задержка — чтобы два прогона действительно шли внахлёст
type Mode = 'ok' | '429' | '403' | '400' | 'down';
const mode = new Map<number, Mode>();
const sent: number[] = [];
globalThis.fetch = (async (_url: string, init?: { body?: string }) => {
  const b = JSON.parse(init?.body ?? '{}') as { chat_id: number };
  await new Promise((r) => setTimeout(r, 20));
  const m = mode.get(b.chat_id) ?? 'ok';
  if (m === 'down') throw new DOMException('timeout', 'TimeoutError');
  if (m === '429') return new Response(JSON.stringify({ ok: false, error_code: 429, description: 'Too Many Requests: retry after 30', parameters: { retry_after: 30 } }), { status: 429 });
  if (m === '403') return new Response(JSON.stringify({ ok: false, error_code: 403, description: 'Forbidden: bot was blocked by the user' }), { status: 403 });
  if (m === '400') return new Response(JSON.stringify({ ok: false, error_code: 400, description: 'Bad Request: chat not found' }), { status: 400 });
  sent.push(b.chat_id);
  return new Response(JSON.stringify({ ok: true, result: { message_id: sent.length } }));
}) as typeof fetch;

const users = [['A', 1], ['B', 2], ['C', 3], ['D', 4], ['E', 5]] as const;
for (const [id, tg] of users) {
  await DB.prepare("INSERT INTO user (id, tg_id, first_name, settings, created_at, seen_at) VALUES (?, ?, ?, '{}', '2026-01-01', '2026-01-01')").bind(id, tg, id).run();
  await DB.prepare("INSERT INTO follow (user_id, kind, ref, keys, title, at) VALUES (?, 'work', 'tmdb:94997', 'tmdb:94997', 'Дом Дракона', '2026-01-01T00:00:00Z')").bind(id).run();
}
// гость без Telegram — не адресат
await DB.prepare("INSERT INTO user (id, tg_id, first_name, settings, created_at, seen_at) VALUES ('u-anon-1', NULL, 'Гость', '{}', '2026-01-01', '2026-01-01')").run();
const fresh = (url: string, at: string) => DB.prepare(`INSERT INTO follow_fresh (url, key, title, author, platform, spoiler, tier, lens, at)
  VALUES (?, 'tmdb:94997', 'Разбор финала', 'Автор', 'youtube', 0, NULL, NULL, ?)`).bind(url, at).run();
await fresh('https://youtube.com/watch?v=aaaaaaaaaaa', '2026-10-16T12:00:00Z');

const day1 = new Date('2026-10-17T09:00:00Z'); // 12:00 по Москве
const count = (chat: number) => sent.filter((x) => x === chat).length;

// 1. два прогона разом — по одному сообщению каждому, второй — «занято»
const [r1, r2] = await Promise.all([followDigest(env, { now: day1 }), followDigest(env, { now: day1 })]);
assert.equal(sent.length, 5, `ушло ${sent.length}`);
for (const [, tg] of users) assert.equal(count(tg), 1);
assert.ok(r1.busy || r2.busy);
assert.equal((r1.busy ? r2 : r1).sent, 5);
// замок снят
assert.equal((await DB.prepare("SELECT locked_at FROM job_lock WHERE name = 'follow-digest'").first<{ locked_at: string }>())?.locked_at, '');

// 2. в тот же день ещё раз — некому, сезоны и справочники не трогаем
refGets.length = 0;
const r3 = await followDigest(env, { now: new Date(day1.getTime() + 15 * 60e3) });
assert.equal(r3.users, 0);
assert.equal(sent.length, 5);
assert.deepEqual(refGets, []);

// 3. чужой живой замок (другой процесс) — прогон не идёт; протухший (31 мин) — идёт
const day2 = new Date('2026-10-18T09:00:00Z');
await fresh('https://youtube.com/watch?v=bbbbbbbbbbb', '2026-10-17T12:00:00Z');
await DB.prepare("UPDATE job_lock SET locked_at = ? WHERE name = 'follow-digest'").bind(new Date(day2.getTime() - 5 * 60e3).toISOString()).run();
const busy = await followDigest(env, { now: day2 });
assert.equal(busy.busy, true);
assert.equal(sent.length, 5);
await DB.prepare("UPDATE job_lock SET locked_at = ? WHERE name = 'follow-digest'").bind(new Date(day2.getTime() - 31 * 60e3).toISOString()).run();

// 4. на следующий день: B — 429 (прогон прерван, пауза), остальным в этом прогоне — нет
mode.set(2, '429');
const quiet = console.warn; console.warn = () => {};
const r4 = await followDigest(env, { now: day2 });
console.warn = quiet;
assert.equal(r4.stopped, 'rate_limit');
assert.ok(r4.pausedUntil && Date.parse(r4.pausedUntil) >= day2.getTime() + 30e3 && Date.parse(r4.pausedUntil) < day2.getTime() + 35e3);
assert.equal(count(1), 2); // A — до B
assert.equal(count(3) + count(4) + count(5), 3); // после B — никому
const b = await DB.prepare("SELECT day, state FROM follow_digest WHERE user_id = 'B'").first<{ day: string; state: string | null }>();
assert.equal(b?.day, '2026-10-17'); // отметка «шлём» снята — Telegram не отправил
assert.equal(b?.state, null);
// пока пауза — прогон не начинается
const paused = await followDigest(env, { now: new Date(day2.getTime() + 10e3) });
assert.ok(paused.pausedUntil && !paused.sent);

// 5. пауза прошла: B — 403, C — «chat not found», D — «шлём» уже стоит (рестарт посреди отправки), E — ok
mode.set(2, '403'); mode.set(3, '400');
await DB.prepare("UPDATE follow_digest SET day = '2026-10-18', state = 'sending' WHERE user_id = 'D'").run();
const r5 = await followDigest(env, { now: new Date(day2.getTime() + 31e3) });
assert.equal(r5.blocked, 2);
assert.equal(count(4), 1); // D второй раз не получил
assert.equal(count(5), 2);
const blocked = (await DB.prepare('SELECT user_id FROM follow_digest WHERE blocked = 1 ORDER BY user_id').all<{ user_id: string }>()).results.map((r) => r.user_id);
assert.deepEqual(blocked, ['B', 'C']);

// 6. на третий день: B и C не выбираются; Telegram недоступен — прогон прерван на первом, отметка остаётся (без дубля)
const day3 = new Date('2026-10-19T09:00:00Z');
await fresh('https://youtube.com/watch?v=ccccccccccc', '2026-10-18T12:00:00Z');
mode.set(1, 'down');
const err = console.error; console.error = () => {};
const r6 = await followDigest(env, { now: day3 });
console.error = err;
assert.equal(r6.users, 3); // A, D, E
assert.equal(r6.stopped, 'telegram_down');
assert.equal(r6.sent, 0);
assert.equal((await DB.prepare("SELECT state FROM follow_digest WHERE user_id = 'A'").first<{ state: string }>())?.state, 'sending');
mode.set(1, 'ok');
const r7 = await followDigest(env, { now: new Date(day3.getTime() + 15 * 60e3) });
assert.equal(r7.sent, 2); // D и E; A сегодня больше не трогаем
assert.equal(count(1), 2);

// человек и вселенная (25.10): подписка — ключами их произведений, сверка как у произведения; кнопка — на страницу
{
  const fresh = [
    { url: 'u1', key: 'tmdb:1', title: 'разбор', author: 'А', platform: 'telegram', spoiler: 0, tier: null, lens: null, at: 'x' },
    { url: 'u2', key: 'tmdb:2', title: 'обзор', author: 'Б', platform: 'telegram', spoiler: 0, tier: 'review', lens: null, at: 'x' },
    { url: 'u3', key: 'tmdb:9', title: 'чужое', author: 'В', platform: 'telegram', spoiler: 0, tier: null, lens: null, at: 'x' },
  ] as Parameters<typeof matchFollow>[1];
  const got = matchFollow({ kind: 'person', ref: 'Q51559', keys: 'tmdb:1,tmdb:2' }, fresh, {});
  assert.deepEqual(got.map((x) => x.url), ['u1']);   // обзор — мимо, чужое — мимо
  const msg = digestMessage([{ follow: { kind: 'universe', ref: 'Q462', title: 'Звёздные войны' }, items: got }]);
  assert.ok(JSON.stringify(msg).includes('startapp=u-Q462'));
  const card = shareResult({ param: 'u-Q462', title: 'Звёздные войны', kind: 'universe' }) as { reply_markup: { inline_keyboard: { text: string }[][] } };
  assert.equal(card.reply_markup.inline_keyboard[0][0].text, 'Вся вселенная');
}

rmSync(dir, { recursive: true, force: true });
console.log('сводка подписок (замок, отметки, 429/403): все проверки прошли');
