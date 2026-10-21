// Проверка подбора «вместе» по вкусу (19.10): worker/togetherPick.ts (пересечение верхушек, наименее довольный, запасной путь
// по старой истории, исключение виденного, двое и четверо), worker/togetherChat.ts (личный чат: «Что посмотреть вдвоём» и
// правка того же инлайн-сообщения; группа: «/together @ник» с разбором entities и «Голосовать»), src/lib/tasteTop.ts
// (отбор верхушки и когда отправлять). Настоящий обработчик вебхука, база SQLite во временном файле, Telegram — подменённый fetch.
//
//   npx tsx tools/together-pick-test.mts
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { telegramUpdate, webhookSecret } from '../worker/inline.ts';
import { cleanTop, companyPick, putTasteTop, rankCompany, type Member, type Want } from '../worker/togetherPick.ts';
import { commandMentions } from '../worker/togetherChat.ts';
import { lookupIn } from '../worker/inlineIndex.ts';
import { migrate } from '../worker/migrate.ts';
import { markOf, pickTop, shortLine, topDue, TOP_HOURS } from '../src/lib/tasteTop.ts';
import type { Env } from '../worker/env.ts';

// ─── 1. ранжирование: чистая функция ──────────────────────────────────────────
const member = (id: string, wants: Record<string, number | [number, Want['from']]>, top = true): Member => ({
  id, top, wants: new Map(Object.entries(wants).map(([k, v]) => [k, typeof v === 'number' ? { fit: v, from: 'top' as const } : { fit: v[0], from: v[1] }])),
});
const none = new Map<string, Set<string>>();

// двое: пересечение — по наименее довольному (min fit), при равном min — по среднему. y: 0.70/0.70, z: 0.80/0.65 (среднее 0.725),
// w: 0.66/0.65 (0.655), x: 0.95/0.40 — любимое одного, но второму не очень
{
  const A = member('A', { y: 0.7, z: 0.8, w: 0.66, x: 0.95 });
  const B = member('B', { y: 0.7, z: 0.65, w: 0.65, x: 0.4 });
  assert.deepEqual(rankCompany([A, B], none), ['y', 'z', 'w', 'x']);
}
// пересечения мало — добор по очереди: сначала спросивший, потом второй (каждый — своим лучшим)
{
  const A = member('A', { both: 0.6, a1: 0.9, a2: 0.8 });
  const B = member('B', { both: 0.7, b1: 0.95, b2: 0.5 });
  assert.deepEqual(rankCompany([A, B], none), ['both', 'a1', 'b1', 'a2', 'b2']);
}
// виденное кем-то из участников — вон, даже если высоко у всех
{
  const A = member('A', { hit: 0.99, ok: 0.6 });
  const B = member('B', { hit: 0.99, ok: 0.6 });
  assert.deepEqual(rankCompany([A, B], new Map([['hit', new Set(['B'])]])), ['ok']);
}
// четверо: у всех — первым; дальше у большинства (больше половины: трое из четырёх), а «у двоих из четырёх» — только добором
{
  const A = member('A', { all: 0.5, three: 0.9, two: 0.99 });
  const B = member('B', { all: 0.6, three: 0.8, two: 0.99 });
  const C = member('C', { all: 0.7, three: 0.85 });
  const D = member('D', { all: 0.8 });
  assert.deepEqual(rankCompany([A, B, C, D], none), ['all', 'three', 'two']);
  assert.deepEqual(rankCompany([A, B, C, D], none, 2), ['all', 'three']);
}
// участник без верхушки не мешает пересечению тех, у кого она есть; его планы — в доборе, любимое — последним
{
  const A = member('A', { t1: 0.9, t2: 0.8, a1: 0.85 });
  const B = member('B', { t1: 0.7, t2: 0.75, b1: 0.9 });
  const C = member('C', { p1: [0.78, 'plan'], fav: [0.65, 'loved'] }, false);
  const r = rankCompany([A, B, C], new Map([['fav', new Set(['C'])]]));
  // t2 (min 0.75) выше t1 (min 0.70): в верхушках у обоих, у кого они есть
  assert.deepEqual(r.slice(0, 2), ['t2', 't1']);
  assert.ok(r.includes('p1') && r.includes('fav'), 'планы и любимое участника без верхушки — добором');
  assert.ok(r.indexOf('fav') === r.length - 1, 'любимое — последним');
  // любимое C видел сам C — пересмотр; видел кто-то ещё — вон
  assert.ok(!rankCompany([A, B, C], new Map([['fav', new Set(['C', 'A'])]])).includes('fav'));
}

// ─── 2. верхушка от клиента: чистка ───────────────────────────────────────────
{
  const t = cleanTop([
    { k: 'tmdb:1', f: 1.7, n: 'Фильм https://spam.example @spammer', a: 'Строка t.me/x и www.y.ru', y: 2014, x: ['imdb:tt1', 'bad key', 'tmdb:1'] },
    { k: 'tmdb:1', f: 0.2 }, { k: 'javascript:alert(1)', f: 0.5 }, { k: 'imdb:tt2', f: Number.NaN }, { k: 'imdb:tt3', f: 0.5, s: 1, y: 3000 },
  ]);
  assert.deepEqual(t, [{ k: 'tmdb:1', f: 1, n: 'Фильм', a: 'Строка и', y: 2014, x: ['imdb:tt1'] }, { k: 'imdb:tt3', f: 0.5, s: 1 }]);
}

// ─── 3. клиент: отбор и когда отправлять ──────────────────────────────────────
{
  const top = pickTop([{ k: 'tmdb:1', f: 0.5 }, { k: 'tmdb:1', f: 0.9 }, { k: 'tmdb:2', f: 0.7 }, { k: 'c-x', f: 1 }, { k: 'tmdb:3', f: 2 }], 2);
  assert.deepEqual(top.map((t) => [t.k, t.f]), [['tmdb:3', 1], ['tmdb:1', 0.9]]);
  const now = Date.parse('2026-10-19T12:00:00Z');
  const mark = markOf(now, 40, top, 'me');
  assert.equal(topDue(undefined, now, 40, top, 'me'), true, 'первый раз');
  assert.equal(topDue(mark, now + 60e3, 50, top, 'me'), false, 'минуту назад — рано, даже если оценок больше');
  assert.equal(topDue(mark, now + 10 * 60e3, 41, top, 'me'), false, 'ничего заметного');
  assert.equal(topDue(mark, now + 10 * 60e3, 43, top, 'me'), true, 'оценок заметно больше');
  assert.equal(topDue(mark, now + 10 * 60e3, 40, [{ k: 'tmdb:9', f: 1 }, { k: 'tmdb:8', f: 1 }], 'me'), true, 'верхушка сменилась');
  assert.equal(topDue(mark, now + TOP_HOURS * 3600e3, 40, top, 'me'), true, 'прошло TOP_HOURS');
  assert.equal(topDue(mark, now + 60e3, 40, top, 'other'), true, 'другой профиль');
  assert.equal(topDue(undefined, now, 40, [], 'me'), false, 'пусто — не шлём');
  assert.equal(shortLine('Два инженера в гараже. Машина времени без объяснений.'), 'Два инженера в гараже.');
  assert.equal(shortLine('а'.repeat(200), 20)!.length, 20);
}

// ─── 4. разбор упоминаний в команде ───────────────────────────────────────────
{
  // эмодзи — две единицы UTF-16, смещения Telegram — в них же
  const text = '/together@recomend_media_bot 🎬 @Anya и Лёша, @recomend_media_bot @anya';
  const at = (s: string, from = 0) => text.indexOf(s, from);
  const entities = [
    { type: 'bot_command', offset: 0, length: '/together@recomend_media_bot'.length },
    { type: 'mention', offset: at('@Anya'), length: 5 },
    { type: 'text_mention', offset: at('Лёша'), length: 4, user: { id: 202, first_name: 'Лёша' } },
    { type: 'mention', offset: at('@recomend_media_bot', 5), length: '@recomend_media_bot'.length },
    { type: 'mention', offset: at('@anya'), length: 5 },
    { type: 'text_mention', offset: 0, length: 1, user: { id: 7, is_bot: true } },
  ];
  assert.deepEqual(commandMentions(text, entities), { nicks: ['anya'], ids: [202] });
  assert.deepEqual(commandMentions('/together', undefined), { nicks: [], ids: [] });
}

// ─── 5. база: подбор и сообщения в чатах ──────────────────────────────────────
const require = createRequire(import.meta.url);
const { openD1 } = require('../server/d1-sqlite.js');
const dir = mkdtempSync(join(tmpdir(), 'tm-pick-'));
const DB = await openD1({ file: join(dir, 'tm.sqlite'), schema: readFileSync(new URL('../worker/schema.sql', import.meta.url), 'utf8') });
await migrate(DB);
// миграция повторно — ничего не ломает
const { forgetMigrations } = await import('../worker/migrate.ts');
forgetMigrations();
await migrate(DB);
assert.ok(await DB.prepare("SELECT 1 AS x FROM sqlite_master WHERE type = 'table' AND name = 'taste_top'").first());

const index = [
  { p: 'w-tmdb_1', k: 'film', t: 'Интерстеллар', y: 2014, s: 'Кристофер Нолан', i: 'https://image.tmdb.org/t/p/w342/a.jpg' },
  { p: 'w-tmdb_2', k: 'film', t: '1+1', y: 2011 },
  { p: 'w-tmdb_3', k: 'film', t: 'Пленницы', y: 2013, s: 'Дени Вильнёв' },
  { p: 'w-tmdb_4', k: 'film', t: 'Дюна', y: 2021 },
  { p: 'w-tmdb_5', k: 'film', t: 'Аритмия', y: 2017 },
  { p: 'w-tmdb_6', k: 'film', t: 'Прибытие', y: 2016 },
  { p: 'w-imdb_tt0903747', k: 'series', t: 'Во все тяжкие', y: 2008 },
  { p: 'w-tmdb_8', k: 'film', t: 'Сталкер', y: 1979 },
  { p: 'w-olw_OL1W', k: 'book', t: 'Книга', y: 2001 },
];
const env = {
  DB, BOT_TOKEN: 'test-token',
  REFERENCE: { get: async (k: string) => (k === 'inlineIndex.json' ? { body: new Response(JSON.stringify(index)).body } : null) },
} as unknown as Env;
const lookup = lookupIn({ at: Date.now(), list: index as never, keys: [] });

const now = new Date().toISOString();
const user = (id: string, tg: number | null, nick: string | null, name = nick ?? 'Гость') =>
  DB.prepare('INSERT INTO user (id, tg_id, username, first_name, created_at, seen_at) VALUES (?, ?, ?, ?, ?, ?)').bind(id, tg, nick, name, now, now).run();
const work = (title: string, year: number, type = 'film', ext?: Record<string, unknown>) => JSON.stringify({ title, year, type, ...(ext ? { externalIds: ext } : {}) });
const rate = (u: string, id: string, r: number, w: string | null = null) =>
  DB.prepare('INSERT INTO rating (user_id, work_id, rating, work, at) VALUES (?, ?, ?, ?, ?)').bind(u, id, r, w, now).run();
const plan = (u: string, id: string, w: string | null, eager = 3) =>
  DB.prepare("INSERT INTO journal (user_id, entry_id, work_id, work, status, started_at, eagerness) VALUES (?, ?, ?, ?, 'planned', ?, ?)")
    .bind(u, `${u}-${id}`, id, w, now, eager).run();
const started = (u: string, id: string, w: string | null) =>
  DB.prepare("INSERT INTO journal (user_id, entry_id, work_id, work, status, started_at) VALUES (?, ?, ?, ?, 'in_progress', ?)").bind(u, `${u}-${id}`, id, w, now).run();
const saw = (u: string, id: string, w: string | null) =>
  DB.prepare("INSERT INTO watched (user_id, work_id, state, work, at) VALUES (?, ?, 'watched', ?, ?)").bind(u, id, w, now).run();
const putTop = async (u: string, items: unknown[]) => {
  const r = await putTasteTop(new Request('https://x/api/taste-top', { method: 'PUT', body: JSON.stringify({ items }) }), u, env);
  return { status: r.status, body: (await r.json()) as { ok?: boolean; n?: number; error?: string } };
};

await user('u-me', 100, 'me_user', 'Дима'); await user('u-anya', 201, 'anya', 'Аня'); await user('u-lyosha', 202, null, 'Лёша');
await user('u-vika', 203, 'vika', 'Вика'); await user('u-new', 300, 'newbie'); await user('u-web', null, null, 'Гость');
for (let i = 0; i < 30; i++) await rate('u-me', `tmdb:9${i}`, 4, work(`Фильм ${i}`, 1990 + i));

// не через Telegram — верхушку не берём
assert.equal((await putTop('u-web', [{ k: 'tmdb:1', f: 0.9 }])).body.error, 'telegram_only');

// верхушки: у меня и Ани; у Лёши — нет (подбор по старой истории: его планы и любимое)
assert.deepEqual((await putTop('u-me', [
  { k: 'tmdb:1', f: 0.9, n: 'Интерстеллар', a: 'Экспедиция через червоточину ради будущего Земли.' },
  { k: 'tmdb:6', f: 0.8 }, { k: 'imdb:tt0903747', f: 0.75, s: 1 }, { k: 'tmdb:3', f: 0.7 }, { k: 'tmdb:8', f: 0.95 }, { k: 'olw:OL1W', f: 0.99 },
])).body, { ok: true, n: 5 });
await putTop('u-anya', [{ k: 'tmdb:1', f: 0.6 }, { k: 'tmdb:6', f: 0.85 }, { k: 'imdb:tt0903747', f: 0.7 }, { k: 'tmdb:3', f: 0.9 }, { k: 'tmdb:5', f: 0.8 }]);
// «Сталкер» Аня видела — запись импорта под своим id, узнаём по названию и году; «Пленниц» начала — тоже вон
await saw('u-anya', 'u-kp123', work('Сталкер', 1979));
await started('u-anya', 'tmdb:3', work('Пленницы', 2013));
// повторная отправка перезаписывает: одна строка на участника
await putTop('u-anya', [{ k: 'tmdb:1', f: 0.6 }, { k: 'tmdb:6', f: 0.85 }, { k: 'imdb:tt0903747', f: 0.7 }, { k: 'tmdb:3', f: 0.9 }, { k: 'tmdb:5', f: 0.8 }]);
assert.equal((await DB.prepare("SELECT COUNT(*) AS n FROM taste_top WHERE user_id = 'u-anya'").first())!.n, 1);

// двое с верхушками: «Прибытие» (min 0.80) → «Во все тяжкие» (0.70) → «Интерстеллар» (0.60); добор — «Аритмия» Ани
let r = await companyPick(env, 100, { nicks: ['anya'] }, lookup);
assert.ok('films' in r);
assert.deepEqual(r.films.map((f) => f.t), ['Прибытие', 'Во все тяжкие', 'Интерстеллар', 'Аритмия']);
assert.deepEqual([r.names, r.old, r.meOld], [['@anya'], [], false]);
assert.equal(r.films[2].a, 'Экспедиция через червоточину ради будущего Земли.');
assert.equal(r.films[1].k, 'series');
assert.equal(r.films[0].p, 'w-tmdb_6');

// Лёша без верхушки и без ника (по id): его планы и любимое; «1+1» он любит, «Дюна» в планах, «Интерстеллар» видел
await rate('u-lyosha', 'tmdb:2', 5, work('1+1', 2011));
await plan('u-lyosha', 'tmdb:4', work('Дюна', 2021), 5);
await saw('u-lyosha', 'tmdb:1', null);
r = await companyPick(env, 100, { nicks: ['anya'], tgIds: [202] }, lookup);
assert.ok('films' in r);
assert.deepEqual(r.films.map((f) => f.t), ['Прибытие', 'Во все тяжкие', 'Аритмия', 'Дюна', '1+1']);
assert.deepEqual([r.names, r.old], [['@anya', 'Лёша'], ['Лёша']]);

// четверо: Вика с верхушкой — «Прибытие» у всех трёх верхушек, а «Во все тяжкие» Вика видела
await putTop('u-vika', [{ k: 'tmdb:6', f: 0.5 }, { k: 'tmdb:5', f: 0.9 }]);
await rate('u-vika', 'imdb:tt0903747', 3, work('Во все тяжкие', 2008, 'series'));
r = await companyPick(env, 100, { nicks: ['anya', 'vika', 'ghost'], tgIds: [202] }, lookup);
assert.ok('films' in r);
assert.equal(r.films[0].t, 'Прибытие');
assert.ok(!r.films.some((f) => f.t === 'Во все тяжкие' || f.t === 'Интерстеллар' || f.t === 'Сталкер' || f.t === 'Пленницы' || f.t === 'Книга'));
assert.equal(r.films[1].t, 'Аритмия', 'у большинства (Аня и Вика из четверых — нет; у двух верхушек из трёх) — добором первым');
assert.deepEqual(r.missing, ['@ghost']);

// порог спросившего и «никого нет»
assert.deepEqual(await companyPick(env, 300, { nicks: ['anya'] }, lookup), { error: 'no_history', missing: [] });
assert.deepEqual(await companyPick(env, 999, { nicks: ['anya'] }, lookup), { error: 'not_in_bot', missing: [] });
assert.deepEqual(await companyPick(env, 100, { nicks: ['ghost'] }, lookup), { error: 'nobody', missing: ['@ghost'] });
assert.deepEqual(await companyPick(env, 100, { nicks: ['me_user'] }, lookup), { error: 'nobody', missing: [] });

// ─── 6. вебхук: личный чат, группа ────────────────────────────────────────────
const calls: { method: string; body: Record<string, unknown> }[] = [];
globalThis.fetch = (async (url: string, init?: { body?: string }) => {
  calls.push({ method: String(url).split('/').pop()!, body: JSON.parse(init?.body ?? '{}') });
  return new Response(JSON.stringify({ ok: true, result: true }));
}) as typeof fetch;
const secret = await webhookSecret('test-token');
let updateId = 1;
const send = (update: Record<string, unknown>) => telegramUpdate(new Request('https://x/api/telegram', {
  method: 'POST', headers: { 'x-telegram-bot-api-secret-token': secret }, body: JSON.stringify({ update_id: updateId++, ...update }) }), env);
const last = (method: string) => [...calls].reverse().find((c) => c.method === method)!.body;
const ask = async (query: string, chat_type: string, from = 100) => {
  await send({ inline_query: { id: `q${updateId}`, query, chat_type, from: { id: from, language_code: 'ru' } } });
  return last('answerInlineQuery');
};
type Btn = { text: string; url?: string; callback_data?: string };
type Article = { id: string; title: string; description?: string; input_message_content: { message_text: string }; reply_markup?: { inline_keyboard: Btn[][] } };

// личный чат, пустой запрос — первым «Что посмотреть вдвоём» с «Показать»
let a = await ask('', 'private');
let res = a.results as Article[];
assert.equal(res.length, 1);
assert.equal(res[0].title, 'Что посмотреть вдвоём');
const show = res[0].reply_markup!.inline_keyboard[0][0];
assert.equal(show.text, 'Показать');
assert.match(show.callback_data!, /^pr:100:r:[0-9a-f]{12}$/);
// «вместе» в личке — тоже первым; обычный поиск в личке — как прежде
a = await ask('вместе', 'private');
assert.equal((a.results as Article[])[0].title, 'Что посмотреть вдвоём');
a = await ask('дюна', 'private');
assert.deepEqual((a.results as Article[]).map((x) => x.title), ['Дюна (2021)']);
// в личке с самим ботом и в группе — без «вдвоём»
a = await ask('', 'sender');
assert.deepEqual(a.results, []);
// короткая история — подсказка вместо результата
a = await ask('', 'private', 300);
assert.deepEqual(a.results, []);
assert.match((a.button as { text: string }).text, /оцените 30 фильмов/);

const press = async (data: string, from: number, inline = 'IM1') => {
  await send({ callback_query: { id: `cb${updateId}`, data, inline_message_id: inline, from: { id: from, first_name: 'X', language_code: 'ru' } } });
};
// нажал сам отправитель — «пусть нажмёт собеседник», сообщение не трогаем
let before = calls.length;
await press(show.callback_data!, 100);
assert.equal(last('answerCallbackQuery').text, 'Пусть нажмёт собеседник');
assert.ok(!calls.slice(before).some((c) => c.method === 'editMessageText'));
// подделанная подпись — «кнопка устарела»
before = calls.length;
await press('pr:100:r:000000000000', 201);
assert.equal(last('answerCallbackQuery').text, 'Кнопка устарела');
assert.ok(!calls.slice(before).some((c) => c.method === 'editMessageText'));
// собеседника нет в боте — приглашение в том же сообщении, «Показать» остаётся
await press(show.callback_data!, 555);
let edit = last('editMessageText');
assert.equal(edit.inline_message_id, 'IM1');
assert.match(String(edit.text), /откройте приложение и оцените несколько фильмов/);
let kb = (edit.reply_markup as { inline_keyboard: Btn[][] }).inline_keyboard;
assert.equal(kb[0][0].url, 'https://t.me/recomend_media_bot?startapp');
assert.equal(kb[1][0].callback_data, show.callback_data);
// в боте, но ни оценок, ни планов — тоже приглашение
await press(show.callback_data!, 300 + 1);
await user('u-blank', 400, 'blank_user');
await press(show.callback_data!, 400);
assert.match(String(last('editMessageText').text), /оцените несколько фильмов/);
// нажала Аня — тот же инлайн-message правится в список: название, год, строка, кнопка на карточку
await press(show.callback_data!, 201);
edit = last('editMessageText');
assert.equal(edit.inline_message_id, 'IM1');
const text = String(edit.text);
assert.match(text, /^<b>Что посмотреть вдвоём<\/b>\n\n1\. <b>Прибытие<\/b> \(2016\)\nФильм\n\n2\. <b>Во все тяжкие<\/b> \(2008\)\nСериал\n\n3\. <b>Интерстеллар<\/b> \(2014\)\nЭкспедиция через червоточину ради будущего Земли\.\n\n4\. <b>Аритмия<\/b>/);
assert.doesNotMatch(text, /Сталкер|Пленницы|почему/i);
kb = (edit.reply_markup as { inline_keyboard: Btn[][] }).inline_keyboard;
assert.deepEqual(kb.map((row) => row[0].url), ['w-tmdb_6', 'w-imdb_tt0903747', 'w-tmdb_1', 'w-tmdb_5'].map((p) => `https://t.me/recomend_media_bot?startapp=${p}`));
assert.equal(kb[0][0].text, '1. Прибытие (2016)');
// собеседник без верхушки — в сообщении видно, что подбор по старой истории
await press(show.callback_data!, 202);
assert.match(String(last('editMessageText').text), /<i>Лёша: подбор пока по старой истории/);

// группа: пустой инлайн — подсказка про /together
a = await ask('', 'supergroup');
res = a.results as Article[];
assert.equal(res[0].title, 'Подборка для компании');
assert.equal(res[0].description, 'Напишите /together и отметьте людей через @');
// инлайн «для @anya» — новый подбор тем же голосованием
a = await ask('для @anya', 'group');
res = a.results as Article[];
assert.equal(res[0].title, 'Для вас и @anya');
assert.match(res[0].input_message_content.message_text, /1\. Прибытие \(2016\)\n2\. Во все тяжкие \(2008\)\n3\. Интерстеллар \(2014\)/);

// «/together @anya Лёша» в группе: ник и упоминание без ника → список, «Голосовать»
const cmd = '/together@recomend_media_bot @anya Лёша';
await send({ message: { message_id: 50, text: cmd, chat: { id: -100, type: 'supergroup', title: 'Кино' }, from: { id: 100, language_code: 'ru' },
  entities: [{ type: 'bot_command', offset: 0, length: 28 }, { type: 'mention', offset: 29, length: 5 }, { type: 'text_mention', offset: 35, length: 4, user: { id: 202, first_name: 'Лёша' } }] } });
const msg = last('sendMessage');
assert.equal(msg.chat_id, -100);
assert.match(String(msg.text), /^<b>Что посмотреть вместе<\/b>\n\n1\. <b>Прибытие<\/b>/);
assert.match(String(msg.text), /<i>Лёша: подбор пока по старой истории/);
kb = (msg.reply_markup as { inline_keyboard: Btn[][] }).inline_keyboard;
assert.equal(kb.length, 6, 'пять фильмов и «Голосовать»');
const vote = kb[5][0];
assert.equal(vote.text, 'Голосовать');
assert.match(vote.callback_data!, /^tv:[0-9a-f]{12}:[0-9a-f]{12}$/);
// «Голосовать» — то же сообщение становится голосованием, номера работают
await send({ callback_query: { id: 'cbv', data: vote.callback_data, message: { message_id: 77, chat: { id: -100 } }, from: { id: 201, first_name: 'Аня' } } });
edit = last('editMessageText');
assert.deepEqual([edit.chat_id, edit.message_id], [-100, 77]);
assert.match(String(edit.text), /^Что смотрим\? Жмите номера/);
const num = (edit.reply_markup as { inline_keyboard: Btn[][] }).inline_keyboard[0][0].callback_data!;
await send({ callback_query: { id: 'cbn', data: num, message: { message_id: 77, chat: { id: -100 } }, from: { id: 201, first_name: 'Аня' } } });
assert.match(String(last('editMessageText').text), /1\. <b>Прибытие \(2016\)<\/b> — 1: Аня/);
// подделанная «Голосовать» — нет
await send({ callback_query: { id: 'cbf', data: vote.callback_data!.replace(/:[0-9a-f]{12}$/, ':000000000000'), message: { message_id: 78, chat: { id: -100 } }, from: { id: 201 } } });
assert.equal(last('answerCallbackQuery').text, 'Голосование устарело');
// «/together» без упоминаний — как раньше, «Собрать подборку»
await send({ message: { message_id: 51, text: '/together', chat: { id: -100, type: 'supergroup' }, from: { id: 100, language_code: 'ru' }, entities: [{ type: 'bot_command', offset: 0, length: 9 }] } });
assert.equal((last('sendMessage').reply_markup as { inline_keyboard: Btn[][] }).inline_keyboard[0][0].text, 'Собрать подборку');
// никого из названных нет в боте — подсказка
await send({ message: { message_id: 52, text: '/together @ghost', chat: { id: -100, type: 'supergroup' }, from: { id: 100, language_code: 'en' },
  entities: [{ type: 'bot_command', offset: 0, length: 9 }, { type: 'mention', offset: 10, length: 6 }] } });
assert.equal(last('sendMessage').text, "@ghost haven't opened the app — invite them and send /together again.");

// удаление аккаунта уносит и верхушку (таблица с user_id)
const { deleteAccount } = await import('../worker/account.ts');
await deleteAccount('u-anya', env);
assert.equal(await DB.prepare("SELECT 1 AS x FROM taste_top WHERE user_id = 'u-anya'").first(), null);

rmSync(dir, { recursive: true, force: true });
console.log('подбор «вместе» по вкусу: все проверки прошли');
