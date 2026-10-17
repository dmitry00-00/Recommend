// Проверка голосования в чате (worker/inlinePoll.ts, 15.10): настоящий обработчик вебхука, база SQLite во временном
// файле, Telegram — подменённый fetch, который запоминает вызовы.
//
//   npx tsx tools/inline-poll-test.mts
//
// Сценарий: «вместе» без подборки — кнопка в личку, без результатов; «вместе Интерстеллар, 1+1, Пленницы» — статья с
// тремя фильмами и кнопками 1…3; Аня жмёт 1 и 3, Лёша — 1; Аня снимает 3. Итог в последнем editMessageText: у
// «Интерстеллара» 2 (Аня, Лёша), у «Пленниц» 0; голоса двух сообщений одной подборки не смешиваются; «вместе» у
// того, у кого есть подборка «Выбрать вместе», — её фильмы, до десяти; удаление аккаунта стирает его голоса.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { telegramUpdate, webhookSecret } from '../worker/inline.ts';
import { migrate } from '../worker/migrate.ts';
import { deleteAccount } from '../worker/account.ts';
import type { Env } from '../worker/env.ts';

const require = createRequire(import.meta.url);
const { openD1 } = require('../server/d1-sqlite.js');
const dir = mkdtempSync(join(tmpdir(), 'tm-poll-'));
const DB = await openD1({ file: join(dir, 'tm.sqlite'), schema: readFileSync(new URL('../worker/schema.sql', import.meta.url), 'utf8') });
await migrate(DB);

const index = [
  { p: 'w-tmdb_157336', k: 'film', t: 'Интерстеллар', o: 'Interstellar', y: 2014, i: 'https://image.tmdb.org/t/p/w342/a.jpg' },
  { p: 'w-tmdb_77338', k: 'film', t: '1+1', o: 'Intouchables', y: 2011 },
  { p: 'w-tmdb_146233', k: 'film', t: 'Пленницы', o: 'Prisoners', y: 2013 },
  { p: 'c-q1', k: 'character', t: 'Интерстеллар-герой' },
];
const env = {
  DB, BOT_TOKEN: 'test-token',
  REFERENCE: { get: async (k: string) => (k === 'inlineIndex.json' ? { body: new Response(JSON.stringify(index)).body } : null) },
} as unknown as Env;

const calls: { method: string; body: Record<string, unknown> }[] = [];
globalThis.fetch = (async (url: string, init?: { body?: string }) => {
  const method = String(url).split('/').pop()!;
  calls.push({ method, body: JSON.parse(init?.body ?? '{}') });
  return new Response(JSON.stringify({ ok: true, result: true }));
}) as typeof fetch;
const secret = await webhookSecret('test-token');
const send = (update: unknown) => telegramUpdate(new Request('https://x/api/telegram', {
  method: 'POST', headers: { 'x-telegram-bot-api-secret-token': secret }, body: JSON.stringify(update) }), env);
const last = (method: string) => [...calls].reverse().find((c) => c.method === method)!.body;

// 1. «вместе» без подборки — результатов нет, кнопка в личку
await send({ inline_query: { id: 'q1', query: 'вместе', from: { id: 100, language_code: 'ru' } } });
let a = last('answerInlineQuery');
assert.deepEqual(a.results, []);
assert.equal((a.button as { start_parameter: string }).start_parameter, 'together');

// 2. названные фильмы — статья, три фильма, кнопки 1…3 и ссылка
await send({ inline_query: { id: 'q2', query: 'вместе Интерстеллар, 1+1, Пленницы', from: { id: 100, language_code: 'ru' } } });
a = last('answerInlineQuery');
const r = (a.results as Record<string, unknown>[])[0];
assert.equal((a.results as unknown[]).length, 1);
assert.match(String((r.input_message_content as { message_text: string }).message_text), /1\. Интерстеллар \(2014\)\n2\. 1\+1 \(2011\)\n3\. Пленницы \(2013\)/);
const kb = (r.reply_markup as { inline_keyboard: { text: string; callback_data?: string; url?: string }[][] }).inline_keyboard;
assert.deepEqual(kb[0].map((b) => b.text), ['1', '2', '3']);
const data = (i: number) => kb[0][i].callback_data!;
assert.ok(kb[1][0].url);

// 3. голоса в одном сообщении: Аня 1 и 3, Лёша 1, Аня снимает 3
const tap = (who: { id: number; first_name: string }, i: number, msg = 'M1') =>
  send({ callback_query: { id: `cb${calls.length}`, data: data(i), inline_message_id: msg, from: who } });
const anya = { id: 201, first_name: 'Аня' }, lyosha = { id: 202, first_name: 'Лёша' };
await tap(anya, 0); await tap(anya, 2); await tap(lyosha, 0); await tap(anya, 2);
let text = String(last('editMessageText').text);
assert.match(text, /1\. <b>Интерстеллар \(2014\)<\/b> — 2: Аня, Лёша/);
assert.match(text, /3\. Пленницы \(2013\)$/m);
assert.equal(last('answerCallbackQuery').text, 'Голос снят: Пленницы');
assert.equal(last('editMessageText').inline_message_id, 'M1');

// 4. та же подборка, другое сообщение — голоса свои
await tap(lyosha, 1, 'M2');
text = String(last('editMessageText').text);
assert.match(text, /2\. <b>1\+1 \(2011\)<\/b> — 1: Лёша/);
assert.doesNotMatch(text, /Аня/);

// 5. «вместе» у того, у кого есть подборка «Выбрать вместе» — её фильмы, до десяти, ссылка на сессию
const now = new Date().toISOString();
await DB.prepare('INSERT INTO user (id, tg_id, first_name, created_at, seen_at) VALUES (?, ?, ?, ?, ?)').bind('u-anya', 201, 'Аня', now, now).run();
const deck = Array.from({ length: 12 }, (_, i) => ({ id: `f-${i}`, title: `Фильм ${i + 1}`, year: 2000 + i }));
await DB.prepare('INSERT INTO together (id, user_id, deck, created_at) VALUES (?, ?, ?, ?)').bind('sess1', 'u-anya', JSON.stringify(deck), now).run();
await send({ inline_query: { id: 'q3', query: 'Вместе', from: { id: 201, language_code: 'ru' } } });
const r3 = (last('answerInlineQuery').results as Record<string, unknown>[])[0];
const kb3 = (r3.reply_markup as { inline_keyboard: { text: string; url?: string }[][] }).inline_keyboard;
assert.deepEqual(kb3.slice(0, 2).flat().map((b) => b.text), ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']);
assert.match(String(kb3[2][0].url), /startapp=t-sess1$/);

// 6. обычный поиск не задет: «интерстеллар» — карточки, а не голосование
await send({ inline_query: { id: 'q4', query: 'интерстеллар', from: { id: 100 } } });
assert.ok((last('answerInlineQuery').results as { id: string }[]).every((x) => !x.id.startsWith('poll-')));

// 7. чужая кнопка и устаревшая подборка
calls.length = 0;
await send({ callback_query: { id: 'cbx', data: 'tp:000000000000:0', inline_message_id: 'M1', from: anya } });
assert.equal(last('answerCallbackQuery').text, 'Голосование устарело');
assert.ok(!calls.some((c) => c.method === 'editMessageText'));

// 8. удаление аккаунта Ани стирает её голоса и её подборки
const before = await DB.prepare('SELECT COUNT(*) AS n FROM inline_vote WHERE tg_id = 201').first<{ n: number }>();
assert.ok(Number(before?.n) > 0);
await deleteAccount('u-anya', env);
const after = await DB.prepare('SELECT COUNT(*) AS n FROM inline_vote WHERE tg_id = 201').first<{ n: number }>();
const polls = await DB.prepare('SELECT COUNT(*) AS n FROM inline_poll WHERE owner_tg = 201').first<{ n: number }>();
assert.equal(Number(after?.n), 0);
assert.equal(Number(polls?.n), 0);

// 9. (17.10) повтор апдейта с тем же update_id — второй раз не обрабатывается: голос не снимается, ответ один
calls.length = 0;
const upd = { update_id: 9001, callback_query: { id: 'cb-r', data: data(1), inline_message_id: 'M3', from: lyosha } };
assert.equal((await send(upd)).status, 200);
assert.equal((await send(upd)).status, 200);
const m3 = await DB.prepare("SELECT COUNT(*) AS n FROM inline_vote WHERE msg = 'M3'").first<{ n: number }>();
assert.equal(Number(m3?.n), 1);
assert.equal(calls.filter((c) => c.method === 'answerCallbackQuery').length, 1);
// новый update_id с тем же тапом — снимает, как и положено
await send({ ...upd, update_id: 9002 });
assert.equal(Number((await DB.prepare("SELECT COUNT(*) AS n FROM inline_vote WHERE msg = 'M3'").first<{ n: number }>())?.n), 0);

// 10. (17.10) ошибка внутри обработчика (база) — всё равно 200, иначе Telegram повторял бы вечно
const broken = { ...env, DB: { prepare() { throw new Error('boom'); } } } as unknown as Env;
const quiet = console.error; console.error = () => {};
const res = await telegramUpdate(new Request('https://x/api/telegram', {
  method: 'POST', headers: { 'x-telegram-bot-api-secret-token': secret }, body: JSON.stringify({ update_id: 9003, message: { message_id: 1, text: '/together', chat: { id: 1, type: 'group' } } }) }), broken);
console.error = quiet;
assert.equal(res.status, 200);

// 11. (17.10) Telegram ответил не JSON (502 от прокси) — не падаем
globalThis.fetch = (async () => new Response('<html>bad gateway</html>', { status: 502 })) as typeof fetch;
console.error = () => {};
assert.equal((await send({ update_id: 9004, inline_query: { id: 'q9', query: 'интерстеллар', from: { id: 100 } } })).status, 200);
console.error = quiet;

rmSync(dir, { recursive: true, force: true });
console.log('голосование в чате: все проверки прошли');
