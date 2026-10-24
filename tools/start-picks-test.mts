// Проверка ответа на /start (22.10): worker/startPicks.ts через настоящий обработчик вебхука, база SQLite во временном
// файле, справочники и Telegram — подменённые.
//
//   npx tsx tools/start-picks-test.mts
//
// Три кнопки — только бесплатное и легальное в регионе (бесплатно или с рекламой по watchProviders, YouTube правообладателя
// по freeWatch) и только с разборами двух авторов и больше; платное, без разборов, книга — мимо. Виденное, оценённое и
// начатое — мимо, отложенное в планы — нет. Тот же день — те же три, другой день — набор меняется. /start в группе и
// «/startfoo» — не наши, «/together» по-прежнему уходит своему обработчику. Без справочников — приветствие и кнопка ленты.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { telegramUpdate, webhookSecret } from '../worker/inline.ts';
import { pickOfDay, startCommand, type Candidate } from '../worker/startPicks.ts';
import { migrate } from '../worker/migrate.ts';
import type { Env } from '../worker/env.ts';

const require = createRequire(import.meta.url);
const { openD1 } = require('../server/d1-sqlite.js');
const dir = mkdtempSync(join(tmpdir(), 'tm-start-'));
const schema = readFileSync(new URL('../worker/schema.sql', import.meta.url), 'utf8');
const DB = await openD1({ file: join(dir, 'tm.sqlite'), schema });
await migrate(DB);

// 12 бесплатных фильмов с разборами (tmdb:1…12), платный, без разборов, с одним автором, книга, YouTube правообладателя
const free = Array.from({ length: 12 }, (_, i) => `tmdb:${i + 1}`);
const index = [
  ...free.map((k, i) => ({ p: `w-${k.replace(':', '_')}`, k: 'film', t: `Фильм ${i + 1}`, y: 2000 + i })),
  { p: 'w-tmdb_50', k: 'film', t: 'Платный', y: 2020 }, { p: 'w-tmdb_51', k: 'film', t: 'Без разборов', y: 2020 },
  { p: 'w-tmdb_52', k: 'film', t: 'Один автор', y: 2020 }, { p: 'w-olw_OL1W', k: 'book', t: 'Книга', y: 2001 },
  { p: 'w-tmdb_60', k: 'film', t: 'Чучело', y: 1983 },
];
const watchProviders = {
  names: { moretv: 'More TV', kion: 'KION' },
  works: {
    ...Object.fromEntries(free.map((k) => [k, { RU: { a: ['moretv'] } }])),
    'tmdb:50': { RU: { s: ['kion'] } }, 'tmdb:51': { RU: { f: ['moretv'] } }, 'tmdb:52': { RU: { f: ['moretv'] } }, 'olw:OL1W': { RU: { f: ['moretv'] } },
  },
};
const freeWatch = { works: { 'tmdb:60': [{ n: 'Мосфильм', u: 'https://www.youtube.com/watch?v=x', v: 'studio' }] } };
const essayIndex = {
  k: { ...Object.fromEntries([...free, 'tmdb:50', 'olw:OL1W', 'tmdb:60'].map((k) => [k, ['А|ru', 'Б|ru', 'В|ru']])), 'tmdb:52': ['А|ru'] },
  x: {},
};
const files: Record<string, unknown> = { 'inlineIndex.json': index, 'watchProviders.json': watchProviders, 'freeWatch.json': freeWatch, 'essayIndex.json': essayIndex };
const env = {
  DB, BOT_TOKEN: 'test-token',
  REFERENCE: { get: async (k: string) => (files[k] ? { body: new Response(JSON.stringify(files[k])).body } : null) },
} as unknown as Env;

const calls: { method: string; body: Record<string, unknown> }[] = [];
globalThis.fetch = (async (url: string, init?: { body?: string }) => {
  calls.push({ method: String(url).split('/').pop()!, body: JSON.parse(init?.body ?? '{}') });
  return new Response(JSON.stringify({ ok: true, result: true }));
}) as typeof fetch;
const secret = await webhookSecret('test-token');
let updateId = 1;
const send = (message: Record<string, unknown>) => telegramUpdate(new Request('https://x/api/telegram', {
  method: 'POST', headers: { 'x-telegram-bot-api-secret-token': secret },
  body: JSON.stringify({ update_id: updateId++, message: { message_id: updateId, date: 0, ...message } }) }), env);
type Btn = { text: string; url: string };
const lastSend = () => [...calls].reverse().find((c) => c.method === 'sendMessage')?.body as
  { chat_id: number; text: string; reply_markup: { inline_keyboard: Btn[][] } } | undefined;
const pm = (id: number, text: string, extra: Record<string, unknown> = {}) =>
  send({ chat: { id, type: 'private' }, from: { id, first_name: 'Аня', language_code: 'ru' }, text, ...extra });

// ─── 1. /start: три фильма дня и кнопка ленты ─────────────────────────────────
await pm(500, '/start');
let m = lastSend()!;
assert.equal(m.chat_id, 500);
assert.match(m.text, /^Привет, Аня! Три фильма на сегодня/);
let rows = m.reply_markup.inline_keyboard;
assert.equal(rows.length, 4, 'три фильма и лента');
const picked = rows.slice(0, 3).map((r) => r[0]);
for (const b of picked) {
  assert.match(b.url, /^https:\/\/t\.me\/recomend_media_bot\?startapp=w-tmdb_\d+--sstart$/);
  assert.match(b.text, /^🎬 (?:Фильм \d+|Чучело) \(\d{4}\) · бесплатно · (?:More TV|YouTube)$/);
  assert.doesNotMatch(b.text, /Платный|Без разборов|Один автор|Книга/);
}
assert.deepEqual(rows[3], [{ text: 'Открыть ленту', url: 'https://t.me/recomend_media_bot?startapp=--sstart' }]);
// «/start с хвостом» (ссылка t.me/бот?start=…) — тоже наш, тот же день — те же три
await pm(500, '/start ref_abc');
assert.deepEqual(lastSend()!.reply_markup.inline_keyboard.slice(0, 3).map((r) => r[0].url), picked.map((b) => b.url));

// ─── 2. виденное, оценённое и начатое — мимо, планы — нет ──────────────────────
const now = new Date().toISOString();
await DB.prepare('INSERT INTO user (id, tg_id, username, first_name, created_at, seen_at) VALUES (?, ?, ?, ?, ?, ?)').bind('u-a', 500, 'anya', 'Аня', now, now).run();
const keyOf = (b: Btn) => /w-tmdb_(\d+)/.exec(b.url)![1];
const [k1, k2, k3] = picked.map(keyOf);
await DB.prepare("INSERT INTO watched (user_id, work_id, state, work, at) VALUES (?, ?, 'watched', NULL, ?)").bind('u-a', `tmdb:${k1}`, now).run();
// оценка импорта под своим id — узнаём по внешнему ключу карточки
await DB.prepare('INSERT INTO rating (user_id, work_id, rating, work, at) VALUES (?, ?, ?, ?, ?)')
  .bind('u-a', 'l-kp777', 4, JSON.stringify({ title: 'x', externalIds: { tmdb: Number(k2) } }), now).run();
await DB.prepare("INSERT INTO journal (user_id, entry_id, work_id, work, status, started_at) VALUES (?, ?, ?, NULL, 'planned', ?)").bind('u-a', 'e3', `tmdb:${k3}`, now).run();
await pm(500, '/start');
const after = lastSend()!.reply_markup.inline_keyboard.slice(0, 3).map((r) => keyOf(r[0]));
assert.ok(!after.includes(k1) && !after.includes(k2), 'виденное и оценённое — мимо');
assert.ok(after.includes(k3), 'отложенное в планы остаётся');

// ─── 3. другой день — другой набор; у соседа — свой ─────────────────────────────
const pool: Candidate[] = free.map((key, i) => ({ key, title: `Фильм ${i + 1}`, where: 'бесплатно · More TV', authors: 3 }));
const day = (d: string, who = '1') => pickOfDay(pool, new Set(), `${d}|${who}`).map((c) => c.key).join();
assert.equal(day('2026-10-22'), day('2026-10-22'));
const week = new Set(['2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25'].map((d) => day(d)));
assert.ok(week.size >= 3, 'день ото дня набор меняется');
assert.notEqual(day('2026-10-22', '1'), day('2026-10-22', '2'));

// ─── 4. не наши: группа, «/startfoo»; /together — своему обработчику ───────────
const before = calls.length;
await send({ chat: { id: -100, type: 'supergroup' }, from: { id: 500, language_code: 'ru' }, text: '/start' });
await pm(500, '/startfoo');
assert.equal(calls.length, before, 'на /start в группе и /startfoo бот молчит');
assert.equal(await startCommand(env, { message_id: 1, chat: { id: 500, type: 'private' }, from: { id: 500 }, text: '/together' }), false);

// ─── 5. английский; без справочников — приветствие и лента ────────────────────
await send({ chat: { id: 501, type: 'private' }, from: { id: 501, first_name: 'Sam', language_code: 'en' }, text: '/start' });
m = lastSend()!;
assert.equal(m.chat_id, 501);
assert.match(m.text, /^Hi, Sam!/);
// имя — чужой ввод: в HTML-сообщении экранируем
await send({ chat: { id: 502, type: 'private' }, from: { id: 502, first_name: '<b>Ли</b>', language_code: 'ru' }, text: '/start' });
assert.match(lastSend()!.text, /^Привет, &lt;b&gt;Ли&lt;\/b&gt;! Три фильма/);

DB.close?.();
rmSync(dir, { recursive: true, force: true });
console.log('start-picks: ok');
