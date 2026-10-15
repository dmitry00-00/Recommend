// Проверка «Выбрать вместе» с одновременным раскрытием (worker/together.ts, ДФ-13, 15.10): база SQLite во временном файле,
// Telegram — подменённый fetch.
//
//   npx tsx tools/together-test.mts
//
// Аня собирает четыре фильма и голосует одна — итог скрыт («ждём остальных», срока нет). Приходит Лёша — пошли три
// минуты, чужих голосов в ответе нет. Приходит Вика с вето на «Пленниц». Все прошли колоду — итог открыт всем: наверху
// «Интерстеллар» (хотят все), «Пленницы» внизу и без имён, итог ушёл в чат один раз. Опоздавший итог не прячет. Вторая
// сессия открывается по таймеру, третья — кнопкой создателя (не создателю нельзя). База с прежней таблицей голосов
// (без «может быть» и вето) пересобирается миграцией, старые голоса на месте.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createTogether, getTogether, revealTogether, togetherCommand, voteTogether } from '../worker/together.ts';
import { forgetMigrations, migrate } from '../worker/migrate.ts';
import type { Env } from '../worker/env.ts';

const require = createRequire(import.meta.url);
const { openD1 } = require('../server/d1-sqlite.js');
const dir = mkdtempSync(join(tmpdir(), 'tm-together-'));
const schema = readFileSync(new URL('../worker/schema.sql', import.meta.url), 'utf8');
const DB = await openD1({ file: join(dir, 'tm.sqlite'), schema });
await migrate(DB);

const calls: { method: string; body: Record<string, unknown> }[] = [];
globalThis.fetch = (async (url: string, init?: { body?: string }) => {
  calls.push({ method: String(url).split('/').pop()!, body: JSON.parse(init?.body ?? '{}') });
  return new Response(JSON.stringify({ ok: true, result: true }));
}) as typeof fetch;
const env = { DB, BOT_TOKEN: 'test-token' } as unknown as Env;

const now = new Date().toISOString();
for (const [id, tg, name] of [['A', 1, 'Аня'], ['B', 2, 'Лёша'], ['C', 3, 'Вика'], ['D', 4, 'Дима']] as const) {
  await DB.prepare('INSERT INTO user (id, tg_id, username, first_name, created_at, seen_at) VALUES (?, ?, ?, ?, ?, ?)').bind(id, tg, null, name, now, now).run();
}
const deck = [
  { id: 'f1', title: 'Интерстеллар', year: 2014, voice: { author: 'Сыендук', title: 'Разбор', url: 'https://youtube.com/watch?v=x' } },
  { id: 'f2', title: 'Пленницы', year: 2013 },
  { id: 'f3', title: '1+1', year: 2011 },
  { id: 'f4', title: 'Дюна', year: 2021 },
];
const req = (body: unknown) => new Request('https://x/api', { method: 'POST', body: JSON.stringify(body) });
const create = async (user: string, chat?: string) => ((await (await createTogether(req({ deck, ...(chat ? { chat } : {}) }), user, env)).json()) as { id: string }).id;
const vote = async (id: string, user: string, workId: string, v: string) => {
  const r = await voteTogether(req({ workId, vote: v }), id, user, DB);
  assert.equal(r.status, 200, `${user} ${workId} ${v}`);
};
type State = { revealed: boolean; revealAt?: string; votes: Record<string, string>; people: { name: string; n: number }[];
  tally: { workId: string; match: boolean; veto: number; yes: number; maybe: number; yesNames: string[]; maybeNames: string[] }[]; deck: { voice?: unknown }[] };
const get = async (id: string, user: string) => (await (await getTogether(id, user, env)).json()) as State;

// 0. команда /together в чате: под «Собрать подборку» — «Голосовать прямо в чате» (инлайн «вместе»)
await togetherCommand(env, { message_id: 7, text: '/together', chat: { id: -100, type: 'group', title: 'Кино' }, from: { language_code: 'ru' } });
const ask = calls.find((c) => c.method === 'sendMessage')!.body;
const kb = (ask.reply_markup as { inline_keyboard: { text: string; url?: string; switch_inline_query_current_chat?: string }[][] }).inline_keyboard;
assert.equal(kb[1][0].switch_inline_query_current_chat, 'вместе ');
const token = /g-([a-z0-9]+)$/.exec(kb[0][0].url!)![1];

// 1. Аня собирает подборку в этот чат и голосует одна — итог скрыт, срока нет
const s1 = await create('A', token);
assert.ok(calls.some((c) => c.method === 'sendMessage' && c.body.chat_id === -100 && /Голосуем/.test(String(c.body.text))));
for (const [w, v] of [['f1', 'yes'], ['f2', 'maybe'], ['f3', 'no'], ['f4', 'yes']]) await vote(s1, 'A', w, v);
let st = await get(s1, 'A');
assert.equal(st.revealed, false);
assert.equal(st.revealAt, undefined);
assert.deepEqual(st.tally, []);
assert.ok(st.deck[0].voice);

// 2. Лёша пришёл — пошли три минуты; ни Аня, ни Лёша чужих голосов не видят
await vote(s1, 'B', 'f1', 'yes');
st = await get(s1, 'A');
assert.equal(st.revealed, false);
assert.ok(st.revealAt && Date.parse(st.revealAt) - Date.now() > 170e3);
const asB = await get(s1, 'B');
assert.deepEqual(asB.votes, { f1: 'yes' });
assert.deepEqual(asB.tally, []);
assert.doesNotMatch(JSON.stringify(asB), /"maybe"|"no"/);

// 3. Вика — вето «Пленницам»; Лёша и Вика доходят до конца — итог открыт всем
await vote(s1, 'C', 'f1', 'yes');
await vote(s1, 'C', 'f2', 'veto');
for (const [w, v] of [['f2', 'maybe'], ['f3', 'no'], ['f4', 'yes']]) await vote(s1, 'B', w, v);
assert.equal((await get(s1, 'A')).revealed, false, 'Вика ещё не прошла колоду');
calls.length = 0;
await vote(s1, 'C', 'f3', 'no');
await vote(s1, 'C', 'f4', 'maybe');
st = await get(s1, 'B');
assert.equal(st.revealed, true);
assert.deepEqual(st.tally.map((r) => r.workId), ['f1', 'f4', 'f3', 'f2']);
assert.equal(st.tally[0].match, true);
assert.deepEqual(st.tally[0].yesNames.sort(), ['Аня', 'Вика', 'вы'].sort());
assert.equal(st.tally[1].match, false);
assert.equal(st.tally[1].maybe, 1);
assert.equal(st.tally[3].veto, 1);
assert.doesNotMatch(JSON.stringify(st.tally[3]), /Вика/);
// в чат — итог, один раз
await get(s1, 'A');
const told = calls.filter((c) => c.method === 'sendMessage');
assert.equal(told.length, 1);
assert.equal(told[0].body.chat_id, -100);
assert.match(String(told[0].body.text), /Совпадение: Интерстеллар \(2014\)/);

// 4. опоздавший не прячет итог
await vote(s1, 'D', 'f1', 'no');
assert.equal((await get(s1, 'A')).revealed, true);

// 5. вторая сессия: двое не дошли до конца, но три минуты вышли — открыто
const s2 = await create('A');
await vote(s2, 'A', 'f1', 'yes');
await vote(s2, 'B', 'f1', 'yes');
assert.equal((await get(s2, 'A')).revealed, false);
await DB.prepare('UPDATE together SET round_at = ? WHERE id = ?').bind(new Date(Date.now() - 4 * 60e3).toISOString(), s2).run();
assert.equal((await get(s2, 'B')).revealed, true);

// 6. третья: открыть сразу может только создатель и только когда пришёл кто-то ещё
const s3 = await create('A');
await vote(s3, 'A', 'f1', 'yes');
assert.equal((await revealTogether(s3, 'A', env)).status, 409);
await vote(s3, 'B', 'f2', 'yes');
assert.equal((await revealTogether(s3, 'B', env)).status, 403);
assert.equal((await revealTogether(s3, 'A', env)).status, 200);
assert.equal((await get(s3, 'B')).revealed, true);

// 7. неизвестный голос — нет
assert.equal((await voteTogether(req({ workId: 'f1', vote: 'love' }), s3, 'A', DB)).status, 400);

// 8. база с прежней таблицей голосов: миграция пересобирает её, голоса на месте, вето принимается
const oldSchema = schema
  .replace("CHECK (vote IN ('yes', 'maybe', 'no', 'veto', 'seen'))", "CHECK (vote IN ('yes', 'no', 'seen'))")
  .replace(/,\n\s*round_at TEXT, revealed_at TEXT\)/, ')');
assert.notEqual(oldSchema, schema);
const OLD = await openD1({ file: join(dir, 'old.sqlite'), schema: oldSchema });
await OLD.prepare('INSERT INTO user (id, created_at, seen_at) VALUES (?, ?, ?)').bind('A', now, now).run();
await OLD.prepare('INSERT INTO together (id, user_id, deck, created_at) VALUES (?, ?, ?, ?)').bind('old1', 'A', JSON.stringify(deck), now).run();
await OLD.prepare('INSERT INTO together_vote (session_id, user_id, work_id, vote, at) VALUES (?, ?, ?, ?, ?)').bind('old1', 'A', 'f1', 'yes', now).run();
await assert.rejects(OLD.prepare('INSERT INTO together_vote (session_id, user_id, work_id, vote, at) VALUES (?, ?, ?, ?, ?)').bind('old1', 'A', 'f2', 'veto', now).run());
forgetMigrations();
await migrate(OLD);
await OLD.prepare('INSERT INTO together_vote (session_id, user_id, work_id, vote, at) VALUES (?, ?, ?, ?, ?)').bind('old1', 'A', 'f2', 'veto', now).run();
const kept = await OLD.prepare('SELECT vote FROM together_vote WHERE session_id = ? ORDER BY work_id').bind('old1').all<{ vote: string }>();
assert.deepEqual(kept.results.map((r) => r.vote), ['yes', 'veto']);
const cols = await OLD.prepare('PRAGMA table_info(together)').all<{ name: string }>();
assert.ok(cols.results.some((c) => c.name === 'revealed_at'));

rmSync(dir, { recursive: true, force: true });
console.log('выбрать вместе (одновременное раскрытие): все проверки прошли');
