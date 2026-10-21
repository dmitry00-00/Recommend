// Проверка подбора компании по никам (worker/inlineGroup.ts, 15.10): настоящий обработчик вебхука, база SQLite во
// временном файле, Telegram — подменённый fetch.
//
//   npx tsx tools/inline-group-test.mts
//
// Я (tg 100): видел «Матрицу», любимое — «Пленницы» (оценка без карточки — название из справочника), в планах
// «Интерстеллар» и «Дюна». Аня: в планах «Интерстеллар», «Аритмия» и книга, видела «Дюну». Лёша: видел «Пленницы»,
// любимое — «1+1». «для @anya @lyosha» → «Интерстеллар» (в планах у двоих), «Аритмия» (планы одной), «1+1» (любимое
// одного) — верхушек вкуса (19.10, worker/togetherPick.ts) ни у кого нет, подбор по старой истории; «Дюны» нет — Аня видела, «Пленниц» нет — Лёша видел, книги нет. «для @anya» → и «Пленницы»: Аня их не видела.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { telegramUpdate, webhookSecret } from '../worker/inline.ts';
import { groupQuery } from '../worker/inlineGroup.ts';
import { migrate } from '../worker/migrate.ts';
import type { Env } from '../worker/env.ts';

assert.deepEqual(groupQuery('для @Anya @lyosha'), ['anya', 'lyosha']);
assert.deepEqual(groupQuery('for @anya and @lyosha'), ['anya', 'lyosha']);
assert.deepEqual(groupQuery('вместе @anya, @lyosha, @anya'), ['anya', 'lyosha']);
assert.deepEqual(groupQuery('@anya'), ['anya']);
assert.equal(groupQuery('вместе Интерстеллар, 1+1'), undefined);
assert.equal(groupQuery('для'), undefined);
assert.equal(groupQuery('интерстеллар @anya'), undefined);

const require = createRequire(import.meta.url);
const { openD1 } = require('../server/d1-sqlite.js');
const dir = mkdtempSync(join(tmpdir(), 'tm-group-'));
const DB = await openD1({ file: join(dir, 'tm.sqlite'), schema: readFileSync(new URL('../worker/schema.sql', import.meta.url), 'utf8') });
await migrate(DB);

const index = [
  { p: 'w-tmdb_1', k: 'film', t: 'Интерстеллар', y: 2014, i: 'https://image.tmdb.org/t/p/w342/a.jpg' },
  { p: 'w-tmdb_2', k: 'film', t: '1+1', y: 2011 },
  { p: 'w-tmdb_3', k: 'film', t: 'Пленницы', y: 2013 },
  { p: 'w-tmdb_4', k: 'film', t: 'Дюна', y: 2021 },
  { p: 'w-tmdb_5', k: 'film', t: 'Аритмия', y: 2017 },
  { p: 'w-tmdb_7', k: 'film', t: 'Матрица', y: 1999 },
];
const env = {
  DB, BOT_TOKEN: 'test-token',
  REFERENCE: { get: async (k: string) => (k === 'inlineIndex.json' ? { body: new Response(JSON.stringify(index)).body } : null) },
} as unknown as Env;

const now = new Date().toISOString();
const user = (id: string, tg: number, nick: string) =>
  DB.prepare('INSERT INTO user (id, tg_id, username, first_name, created_at, seen_at) VALUES (?, ?, ?, ?, ?, ?)').bind(id, tg, nick, nick, now, now).run();
const work = (title: string, year: number, type = 'film') => JSON.stringify({ title, year, type });
const plan = (u: string, id: string, w: string | null, eager = 3) =>
  DB.prepare("INSERT INTO journal (user_id, entry_id, work_id, work, status, started_at, eagerness) VALUES (?, ?, ?, ?, 'planned', ?, ?)")
    .bind(u, `${u}-${id}`, id, w, now, eager).run();
const saw = (u: string, id: string, w: string | null) =>
  DB.prepare("INSERT INTO watched (user_id, work_id, state, work, at) VALUES (?, ?, 'watched', ?, ?)").bind(u, id, w, now).run();
const rate = (u: string, id: string, r: number, w: string | null = null) =>
  DB.prepare('INSERT INTO rating (user_id, work_id, rating, work, at) VALUES (?, ?, ?, ?, ?)').bind(u, id, r, w, now).run();

await user('u-me', 100, 'me_user'); await user('u-anya', 201, 'Anya'); await user('u-lyosha', 202, 'lyosha'); await user('u-new', 300, 'newbie');
await saw('u-me', 'tmdb:7', work('Матрица', 1999));
// порог — 30 оценок у спрашивающего: 29 своих + «Пленницы»
for (let i = 0; i < 29; i++) await rate('u-me', `tmdb:9${i}`, 4, work(`Фильм ${i}`, 2000 + i));
await rate('u-me', 'tmdb:3', 5);
await plan('u-me', 'tmdb:1', work('Интерстеллар', 2014), 4);
await plan('u-me', 'tmdb:4', work('Дюна', 2021));
await plan('u-anya', 'tmdb:1', work('Интерстеллар', 2014));
await plan('u-anya', 'tmdb:5', work('Аритмия', 2017));
await plan('u-anya', 'ol:1', work('Книга', 2001, 'book'));
await saw('u-anya', 'tmdb:4', work('Дюна', 2021));
await saw('u-lyosha', 'tmdb:3', work('Пленницы', 2013));
await rate('u-lyosha', 'tmdb:2', 5, work('1+1', 2011));

const calls: { method: string; body: Record<string, unknown> }[] = [];
globalThis.fetch = (async (url: string, init?: { body?: string }) => {
  calls.push({ method: String(url).split('/').pop()!, body: JSON.parse(init?.body ?? '{}') });
  return new Response(JSON.stringify({ ok: true, result: true }));
}) as typeof fetch;
const secret = await webhookSecret('test-token');
const send = (update: unknown) => telegramUpdate(new Request('https://x/api/telegram', {
  method: 'POST', headers: { 'x-telegram-bot-api-secret-token': secret }, body: JSON.stringify(update) }), env);
const ask = async (query: string, from = 100) => {
  await send({ inline_query: { id: `q${calls.length}`, query, from: { id: from, language_code: 'ru' } } });
  return [...calls].reverse().find((c) => c.method === 'answerInlineQuery')!.body;
};
type Article = { title: string; description: string; input_message_content: { message_text: string }; reply_markup: { inline_keyboard: { text: string; callback_data?: string }[][] } };
const lines = (a: Article) => a.input_message_content.message_text.split('\n').filter((l) => /^\d+\. /.test(l));

// 1. двое названных: общее в планах, планы одной, любимое одного; виденное кем-то — нет
let a = await ask('для @anya @lyosha');
let r = (a.results as Article[])[0];
assert.equal(r.title, 'Для вас и @anya, @lyosha');
assert.deepEqual(lines(r), ['1. Интерстеллар (2014)', '2. Аритмия (2017)', '3. 1+1 (2011)']);
assert.doesNotMatch(r.input_message_content.message_text + r.description, /Дюна|Пленницы|Матрица|Книга/i);
// 19.10: верхушек вкуса ни у кого нет — подбор по старой истории, и это видно в подписи; в само сообщение ники не идут
assert.doesNotMatch(r.input_message_content.message_text, /anya|lyosha/i);
assert.match(r.description, /^@anya, @lyosha — по старой истории/);

// 2. одна Аня: моё любимое она не видела — оно в списке
a = await ask('вместе @Anya');
r = (a.results as Article[])[0];
assert.deepEqual(lines(r), ['1. Интерстеллар (2014)', '2. Аритмия (2017)', '3. Пленницы (2013)']);

// 3. голосование работает как обычно
await send({ callback_query: { id: 'cb1', data: r.reply_markup.inline_keyboard[0][2].callback_data, inline_message_id: 'G1', from: { id: 201, first_name: 'Аня' } } });
assert.match(String([...calls].reverse().find((c) => c.method === 'editMessageText')!.body.text), /3\. <b>Пленницы \(2013\)<\/b> — 1: Аня/);

// 4. кого нет в боте — в подписи; никого нет — подсказка вместо результатов
r = ((await ask('для @anya @ghost_user')).results as Article[])[0];
assert.match(r.description, /^@ghost_user не открывали приложение; @anya — по старой истории — /);
a = await ask('для @ghost_user');
assert.deepEqual(a.results, []);
assert.match((a.button as { text: string }).text, /@ghost_user не открывали приложение/);

// 5. меньше 30 оценок и не из бота — подсказки, а не чужие списки
for (let i = 0; i < 29; i++) await rate('u-new', `tmdb:9${i}`, 3, work(`Фильм ${i}`, 2000 + i));
a = await ask('для @anya', 300);
assert.deepEqual(a.results, []);
assert.match((a.button as { text: string }).text, /оцените 30 фильмов/);
a = await ask('для @anya', 999);
assert.deepEqual(a.results, []);
assert.match((a.button as { text: string }).text, /Откройте бота/);

// 6. себя назвать можно — это не второй участник
a = await ask('для @me_user');
assert.deepEqual(a.results, []);

rmSync(dir, { recursive: true, force: true });
console.log('подбор компании по никам: все проверки прошли');
