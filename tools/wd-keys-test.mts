// Проверка ключа `wd:Q…` у фильма без TMDb (решение владельца 17.10; 18.10 — приложение и сервер):
//   1. ключи (src/lib/keys.ts): фильм без TMDb — `wd:`, с TMDb — как прежде `tmdb:`, сериал без IMDb — `wd:`; книга ли запись —
//      по виду карточки (`isBookEntry`), а не по префиксу;
//   2. убранное (src/mocks/withheldWorks.ts isWithheld): элемент фильма без TMDb сверяется; запись «… не книга» снимает только
//      книжную карточку; фильм с TMDb по элементу книги не снимается;
//   3. трейлеры: ключ `wd:Q…` в GET /api/trailers (worker/trailers.ts) и запрос P1651 по элементам (tools/trailers-lib.mts);
//   4. сервер принимает фильм-карточку `f-wd…` и ключ `wd:`: оценка, просмотренное, послесловие, журнал, событие, подписка —
//      настоящий обработчик воркера, тестовая SQLite во временной папке, гость по сессии (ALLOW_DEMO);
//   5. публичная страница /film/wd-Q… с постером из Commons (upload.wikimedia.org), Special:FilePath — без картинки.
// Без сети.
//
//   npx tsx tools/wd-keys-test.mts
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isBookEntry, isBookKey, primaryKey, workKeys } from '../src/lib/keys.ts';
import { isWithheld, withheldWorks } from '../src/mocks/withheldWorks.ts';
import { trailerKeys } from '../worker/trailers.ts';
import { wdTrailerQuery, wdTrailerRows } from './trailers-lib.mts';
import { publicPage } from '../worker/pages.ts';
import { IMAGE_HOSTS } from '../worker/hosts.ts';
import worker from '../worker/index.ts';
import type { Env } from '../worker/env.ts';

// «Тараканище» (1927), «Случай с художником» (1962), «Про дудочку и птичку» (1977) — советская анимация без P4947
const TARAKAN = 'Q4451494', ARTIST = 'Q55655847', PIPE = 'Q21644085';

// ─── 1. ключи ───────────────────────────────────────────────────────────────────────────────────────────────────
{
  const film = { type: 'film' as const };
  assert.deepEqual(workKeys(film, { wikidata: TARAKAN }), [`wd:${TARAKAN}`], 'фильм без TMDb — по элементу');
  assert.equal(primaryKey(film, { wikidata: TARAKAN, kinopoisk: 1 }), `wd:${TARAKAN}`);
  assert.deepEqual(workKeys(film, { tmdb: 603, wikidata: 'Q83495' }), ['tmdb:603'], 'с TMDb — как прежде, `wd:` не добавляется');
  assert.deepEqual(workKeys(film, {}), [], 'без ключей — без ключа');
  assert.deepEqual(workKeys(film, { isbn: ['9785170000000'] }), ['isbn:9785170000000'], 'старые моки с ISBN — как прежде');
  assert.deepEqual(workKeys({ type: 'series' }, { imdb: 'tt0903747', wikidata: 'Q1079' }), ['imdb:tt0903747']);
  assert.deepEqual(workKeys({ type: 'series' }, { wikidata: 'Q1079' }), ['wd:Q1079'], 'сериал без IMDb — по элементу');
  assert.deepEqual(workKeys({ type: 'film', format: 'series' }, { tmdb: 1399 }), [], 'сериал старой пометкой: номер TMDb — не его ключ');
  assert.deepEqual(workKeys({ type: 'book' }, { wikidata: 'Q1', openLibrary: 'OL1W' }), ['wd:Q1', 'olw:OL1W']);
  // книга ли — по карточке: у фильма тот же префикс
  assert.equal(isBookKey(`wd:${TARAKAN}`), true, 'по одному ключу — по-старому');
  assert.equal(isBookEntry({ key: `wd:${TARAKAN}`, work: { type: 'film' } }), false);
  assert.equal(isBookEntry({ key: 'wd:Q1', work: { type: 'book' } }), true);
  assert.equal(isBookEntry({ key: 'isbn:9785170000000', work: { type: 'film' } }), true, 'ISBN — книга и у карточки без вида');
  assert.equal(isBookEntry({ key: 'olw:OL1W' }), true);
  // свой ключ (27.10): книга без Wikidata и Open Library
  assert.deepEqual(workKeys({ type: 'book' }, { own: 'a1b2c3d4' }), ['own:a1b2c3d4']);
  assert.equal(isBookEntry({ key: 'own:a1b2c3d4' }), true);
  assert.equal(isBookEntry({ key: 'tmdb:603', work: { type: 'film' } }), false);
  console.log('ok: ключи');
}

// ─── 2. убранное ────────────────────────────────────────────────────────────────────────────────────────────────
{
  const [banned] = Object.entries(withheldWorks).find(([k, why]) => k.startsWith('wd:') && !/не книга/.test(why))!;
  const [notBook] = Object.entries(withheldWorks).find(([k, why]) => k.startsWith('wd:') && /не книга/.test(why))!;
  const q = (k: string) => k.slice(3);
  assert.equal(isWithheld({ type: 'book', externalIds: { wikidata: q(banned) } }), true);
  assert.equal(isWithheld({ type: 'film', externalIds: { wikidata: q(banned) } }), true, 'фильм без TMDb — по элементу');
  assert.equal(isWithheld({ type: 'film', externalIds: { tmdb: 1, wikidata: q(banned) } }), false, 'с TMDb элемент не сверяем');
  assert.equal(isWithheld({ type: 'book', externalIds: { wikidata: q(notBook) } }), true);
  assert.equal(isWithheld({ type: 'film', externalIds: { wikidata: q(notBook) } }), false, '«не книга» снимает только книжную карточку');
  assert.equal(isWithheld({ type: 'film', externalIds: { wikidata: TARAKAN } }), false);
  assert.equal(isWithheld({ type: 'film', externalIds: { tmdb: 5853 } }), true, 'по TMDb — как прежде');
  console.log('ok: убранное');
}

// ─── 3. трейлеры ────────────────────────────────────────────────────────────────────────────────────────────────
{
  assert.deepEqual(trailerKeys(`wd:${TARAKAN},tmdb:603,wd:Q,olw:OL1W`), [`wd:${TARAKAN}`, 'tmdb:603']);
  assert.match(wdTrailerQuery([TARAKAN, ARTIST]), new RegExp(`VALUES \\?f \\{ wd:${TARAKAN} wd:${ARTIST} \\}`));
  const rows = wdTrailerRows([TARAKAN, ARTIST], [{ f: { value: `http://www.wikidata.org/entity/${TARAKAN}` }, x: { value: 'abcdefghijk' } }]);
  assert.deepEqual(rows, { [TARAKAN]: [{ k: 'abcdefghijk', l: '' }], [ARTIST]: [] });
  console.log('ok: трейлеры');
}

// ─── 4. сервер ──────────────────────────────────────────────────────────────────────────────────────────────────
const require = createRequire(import.meta.url);
const { openD1 } = require('../server/d1-sqlite.js');
const dir = mkdtempSync(join(tmpdir(), 'tm-wd-keys-'));
try {
  const schema = readFileSync(new URL('../worker/schema.sql', import.meta.url), 'utf8');
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
  const id = `f-wd${TARAKAN.slice(1)}`;
  const work = { id, type: 'film', title: 'Тараканище', year: 1927, creators: ['Александр Иванов'], externalIds: { wikidata: TARAKAN } };
  assert.equal((await call('PUT', `/api/rating/${id}`, token, { rating: 4, work })).status, 200);
  assert.equal((await call('PUT', `/api/watched/${id}`, token, { watched: true, work })).status, 200);
  assert.equal((await call('PUT', `/api/afterword/${id}`, token, { worth: 4 })).status, 200);
  assert.equal((await call('POST', '/api/journal/start', token, { workId: id, work })).status, 200);
  assert.equal((await call('POST', '/api/event', token, { kind: 'card', workId: id })).status, 200);
  const f = await call('PUT', '/api/follow', token, { kind: 'work', ref: `wd:${TARAKAN}`, keys: [`wd:${TARAKAN}`, 'плохо!'], title: 'Тараканище' });
  assert.equal(f.status, 200);
  assert.deepEqual(f.body.follows.map((x: { ref: string }) => x.ref), [`wd:${TARAKAN}`]);
  const rows = async (sql: string) => (await DB.prepare(sql).bind(me).all()).results as any[];
  assert.deepEqual((await rows('SELECT work_id FROM rating WHERE user_id = ?')).map((r) => r.work_id), [id]);
  assert.deepEqual((await rows('SELECT work_id FROM watched WHERE user_id = ?')).map((r) => r.work_id), [id]);
  assert.deepEqual((await rows('SELECT keys FROM follow WHERE user_id = ?')).map((r) => r.keys), [`wd:${TARAKAN}`], 'чужой ключ отброшен');
  const state = await call('GET', '/api/state', token);
  assert.equal(state.body.ratings[0].workId, id);
  assert.equal(state.body.ratings[0].work.externalIds.wikidata, TARAKAN, 'карточка возвращается с элементом — ключ `wd:` клиент построит');
  assert.equal(state.body.watched[0].work.externalIds.wikidata, TARAKAN);
  // трейлеры: справочник с ключом `wd:` отвечает им
  const ref = (files: Record<string, unknown>) => ({ get: async (k: string) => (k in files ? { body: new Response(JSON.stringify(files[k])).body!, httpEtag: '"1"' } : null) });
  const tenv = { ...env, REFERENCE: ref({ 'trailers.json': { at: '2026-10-18', works: { [`wd:${PIPE}`]: [{ k: 'abcdefghijk', l: 'ru', t: 'T', s: 'wd' }], [`wd:${ARTIST}`]: [] } } }) } as unknown as Env;
  const tr = await worker.fetch(new Request(`https://x/api/trailers?keys=wd:${PIPE},wd:${ARTIST},wd:${TARAKAN}`), tenv);
  assert.deepEqual(await tr.json(), { [`wd:${PIPE}`]: [{ k: 'abcdefghijk', l: 'ru', t: 'T', s: 'wd' }], [`wd:${ARTIST}`]: [] });
  console.log('ok: сервер принимает f-wd… и wd:');

  // ─── 5. публичная страница ──────────────────────────────────────────────────────────────────────────────────────
  const commons = 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Tarakan.png/500px-Tarakan.png';
  const thumb = 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/cd/Pipe.jpg/500px-Pipe.jpg';
  const penv = { ...env, PUBLIC_PAGES: '1', REFERENCE: ref({
    'publicPages.json': { at: '2026-10-18', authors: {}, works: {
      [`wd:${TARAKAN}`]: { t: 'Тараканище', y: 1927, c: ['Александр Иванов'], p: commons },
      [`wd:${ARTIST}`]: { t: 'Случай с художником', y: 1962, p: 'https://commons.wikimedia.org/wiki/Special:FilePath/X.png' },
      // 18.10: уменьшенная копия Commons с thumb.wikimedia.org (так записаны обложки части книг) — тоже картинка
      [`wd:${PIPE}`]: { t: 'Про дудочку и птичку', y: 1977, p: thumb },
    } },
    'essaysAuto.json': { [`wd:${TARAKAN}`]: [{ title: 'Разбор', author: 'Канал', url: 'https://example.org/1' }], [`wd:${ARTIST}`]: [{ title: 'Разбор', author: 'Канал', url: 'https://example.org/2' }],
      [`wd:${PIPE}`]: [{ title: 'Разбор', author: 'Канал', url: 'https://example.org/3' }] },
  }) } as unknown as Env;
  const page = async (p: string) => { const r = await publicPage(new Request(`https://x${p}`), penv, p); return r ? { status: r.status, text: await r.text() } : undefined; };
  const p1 = await page(`/film/wd-${TARAKAN}`);
  assert.equal(p1?.status, 200);
  assert.ok(p1!.text.includes(`<img src="${commons}"`), 'постер Commons — на странице');
  assert.ok(p1!.text.includes(`startapp=w-wd_${TARAKAN}--sseo`), 'кнопка — на карточку по ключу `wd:`');
  const p2 = await page(`/film/wd-${ARTIST}`);
  assert.equal(p2?.status, 200);
  assert.ok(!p2!.text.includes('<img'), 'Special:FilePath (редирект) — без картинки');
  const p3 = await page(`/film/wd-${PIPE}`);
  assert.equal(p3?.status, 200);
  assert.ok(p3!.text.includes(`<img src="${thumb}"`), 'thumb.wikimedia.org — картинка на странице');
  assert.ok(IMAGE_HOSTS.test(thumb), 'thumb.wikimedia.org — и в хостах бота');
  console.log('ok: публичная страница');
} finally {
  rmSync(dir, { recursive: true, force: true });
}
console.log('wd-keys-test: всё прошло');
