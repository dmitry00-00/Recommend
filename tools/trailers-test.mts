// Проверка трейлеров (17.10): слияние источников и отбор не больше четырёх (tools/trailers-lib.mts), разбор ответа
// YouTube (закрыт в России, удалён, не встраивается, возрастное ограничение), ротация проверки, ключи и ответ
// GET /api/trailers (worker/trailers.ts) на подменённом справочнике. Без сети.
//
//   npx tsx tools/trailers-test.mts
import assert from 'node:assert/strict';
import {
  applyMeta, blockedInRu, dueForCheck, fromTmdb, isSeriesKey, lang2, mergeCandidates, pickTrailers, seasonRank, seconds, toCheck, videoMeta,
  wdTrailerQuery, wdTrailerRows,
  type Candidate, type VideoMeta,
} from './trailers-lib.mts';
import { forgetTrailers, getTrailers, pickWorks, trailerKeys, type TrailerItem } from '../worker/trailers.ts';
import type { Env } from '../worker/env.ts';

const id = (n: number) => `vid${String(n).padStart(8, '0')}`;
const c = (n: number, x: Partial<Candidate>): Candidate => ({ k: id(n), l: 'en', t: 'T', s: 'tmdb', ...x });

// ─── TMDb → кандидат ──────────────────────────────────────────────────────────
assert.deepEqual(fromTmdb({ key: 'abcdefghijk', site: 'YouTube', type: 'Trailer', official: true, iso_639_1: 'ru', name: 'Трейлер', published_at: '2020-03-01T10:00:00.000Z' }),
  { k: 'abcdefghijk', l: 'ru', t: 'T', s: 'tmdb', n: 'Трейлер', o: 1, d: '2020-03-01' });
assert.equal(fromTmdb({ key: 'abcdefghijk', site: 'Vimeo', type: 'Trailer' }), undefined, 'не YouTube');
assert.equal(fromTmdb({ key: 'abcdefghijk', site: 'YouTube', type: 'Featurette' }), undefined, 'не трейлер и не тизер');
assert.equal(fromTmdb({ key: 'short', site: 'YouTube', type: 'Trailer' }), undefined, 'ключ не из 11 знаков');
assert.equal(fromTmdb({ key: 'abcdefghijk', site: 'YouTube', type: 'Teaser', iso_639_1: null })?.l, '');
assert.equal(fromTmdb({ key: 'abcdefghijk', site: 'YouTube', type: 'Teaser' })?.t, 'S');
assert.equal(lang2('ru-RU'), 'ru');
assert.equal(lang2('zxx'), '');

// ─── слияние: один ролик из двух источников — старший, недостающее у младшего ─
const merged = mergeCandidates([c(1, { s: 'wd', l: '' }), c(1, { s: 'tmdb', l: 'ru', o: 1, d: '2021-01-01', n: 'TMDb' }), c(1, { s: 'ch', l: '', n: 'Канал' })]);
assert.equal(merged.length, 1);
assert.deepEqual(merged[0], { k: id(1), l: 'ru', t: 'T', s: 'ch', n: 'Канал', o: 1, d: '2021-01-01' });

// ─── отбор: не больше четырёх, по месту (язык × вид), порядок own > ch > tmdb официальный > tmdb > wd ─
const many: Candidate[] = [
  c(10, { l: 'ru', s: 'tmdb', d: '2022-01-01' }),
  c(11, { l: 'ru', s: 'tmdb', o: 1, d: '2019-01-01' }),       // официальный TMDb старше по рангу, хоть и старее
  c(12, { l: 'ru', s: 'ch', d: '2018-01-01' }),               // канал прокатчика — ещё старше
  c(13, { l: 'ru', s: 'own' }),                               // свой — главный
  c(20, { l: 'ru', t: 'S', s: 'wd' }),
  c(21, { l: 'ru', t: 'S', s: 'tmdb' }),
  c(30, { l: 'en', s: 'tmdb', o: 1, d: '2020-01-01' }),
  c(31, { l: 'en', s: 'tmdb', o: 1, d: '2021-06-01' }),       // при равном ранге — новее
  c(40, { l: 'en', t: 'S', s: 'tmdb' }),
  c(50, { l: 'fr', s: 'tmdb', o: 1 }),                        // иной язык при английском — не берём
];
const picked = pickTrailers(many);
assert.equal(picked.length, 4);
assert.deepEqual(picked.map((x) => [x.k, x.l, x.t]), [[id(13), 'ru', 'T'], [id(21), 'ru', 'S'], [id(31), 'en', 'T'], [id(40), 'en', 'S']]);
// без своего — канал; без канала — официальный TMDb раньше неофициального и раньше Wikidata
assert.equal(pickTrailers(many.filter((x) => x.s !== 'own'))[0].k, id(12));
assert.equal(pickTrailers(many.filter((x) => x.s !== 'own' && x.s !== 'ch'))[0].k, id(11));
assert.equal(pickTrailers([c(60, { s: 'wd' }), c(61, { s: 'tmdb' })])[0].k, id(61));
// нет английского — иной язык и неизвестный идут третьим местом
const noEn = pickTrailers([c(70, { l: 'ja', s: 'tmdb' }), c(71, { l: '', t: 'S', s: 'wd' }), c(72, { l: 'ru', t: 'S' })]);
assert.deepEqual(noEn.map((x) => x.k), [id(72), id(70), id(71)]);
assert.deepEqual(pickTrailers([]), [], 'проверено, роликов нет — пустой список');
// запасные на проверку — до трёх на место
assert.equal(toCheck([1, 2, 3, 4, 5].map((n) => c(n, {}))).length, 3);

// ─── YouTube: живой, встраивается, открыт ли в России ─────────────────────────
assert.equal(blockedInRu(undefined), false);
assert.equal(blockedInRu({ blocked: ['RU', 'BY'] }), true);
assert.equal(blockedInRu({ blocked: ['DE'] }), false);
assert.equal(blockedInRu({ allowed: ['US', 'GB'] }), true, 'разрешён только в других странах');
assert.equal(blockedInRu({ allowed: ['US', 'RU'] }), false);
assert.equal(blockedInRu({ allowed: [] }), true, 'пустой список разрешённых — закрыт везде');
const at = '2026-10-17T00:00:00.000Z';
const live = { privacyStatus: 'public', uploadStatus: 'processed', embeddable: true };
assert.deepEqual(videoMeta({ id: id(1), status: live, snippet: { title: 'Trailer', publishedAt: '2010-05-11T00:00:00Z', defaultAudioLanguage: 'en-US' } }, at),
  { at, ok: 1, d: '2010-05-11', l: 'en', n: 'Trailer' });
assert.equal(videoMeta({ id: id(1), status: live, contentDetails: { regionRestriction: { blocked: ['RU'] } } }, at).ru, 0);
assert.equal(videoMeta({ id: id(1), status: { ...live, privacyStatus: 'private' } }, at).ok, 0);
assert.equal(videoMeta({ id: id(1), status: { ...live, embeddable: false } }, at).ok, 0);
assert.equal(videoMeta({ id: id(1), status: live, contentDetails: { contentRating: { ytRating: 'ytAgeRestricted' } } }, at).ok, 0);
assert.equal(videoMeta({ id: id(1), status: { ...live, privacyStatus: 'unlisted' } }, at).ok, 1, 'по ссылке — встраивается');

// применение: мёртвый — прочь (кроме своего), закрытый в России — ru:0 и после открытых; язык — из YouTube
const meta: Record<string, VideoMeta> = {
  [id(1)]: { at, ok: 0 }, [id(2)]: { at, ok: 1, ru: 0 }, [id(3)]: { at, ok: 1, l: 'ru', d: '2015-01-01' }, [id(4)]: { at, ok: 0 },
};
const applied = applyMeta([c(1, {}), c(2, {}), c(3, { l: '', s: 'wd' }), c(4, { s: 'own', l: 'ru' }), c(5, {})], meta);
assert.deepEqual(applied.map((x) => x.k), [id(2), id(3), id(4), id(5)], 'удалённый TMDb выкинут, свой оставлен, непроверенный — как есть');
assert.equal(applied[0].ru, 0);
assert.equal(applied[1].l, 'ru');
// закрытый в России трейлер уступает открытому того же места, даже младшего источника
const ruPick = pickTrailers([{ ...c(80, { s: 'tmdb', o: 1 }), ru: 0 }, c(81, { s: 'wd' })]);
assert.deepEqual(ruPick.map((x) => x.k), [id(81)]);
// единственный — закрытый: остаётся с пометкой (годится зрителям вне России)
assert.equal(pickTrailers([{ ...c(82, {}), ru: 0 }])[0].ru, 0);

// ротация: новый — всегда; свежепроверенный — нет; давний — в свой день недели, а дольше 10 дней — всегда
const now = Date.parse('2026-10-17T03:00:00Z');
assert.equal(dueForCheck(id(1), undefined, now), true);
assert.equal(dueForCheck(id(1), { at: new Date(now - day(1)).toISOString(), ok: 1 }, now), false);
assert.equal(dueForCheck(id(1), { at: new Date(now - day(11)).toISOString(), ok: 1 }, now), true);
const share = Array.from({ length: 700 }, (_, i) => `v${String(i).padStart(10, '0')}`)
  .filter((v) => dueForCheck(v, { at: new Date(now - day(5)).toISOString(), ok: 1 }, now)).length;
assert.ok(share > 60 && share < 150, `за ночь — около седьмой части (${share} из 700)`);
function day(n: number) { return n * 86400e3; }

// ─── эндпоинт: ключи и ответ ──────────────────────────────────────────────────
assert.deepEqual(trailerKeys('tmdb:27205,tv:1399'), ['tmdb:27205', 'tv:1399']);
assert.deepEqual(trailerKeys(' tmdb:1 , tmdb:1,imdb:tt0111161,tmdb:abc,tv:123456789,tmdb:,TMDB:5,tmdb:2;drop'), ['tmdb:1', 'imdb:tt0111161']);
assert.deepEqual(trailerKeys(null), []);
// фильм без TMDb — `wd:Q…` (18.10); книжные и прочие ключи — нет
assert.deepEqual(trailerKeys('wd:Q4356581,wd:Q,wd:q5,wd:Q1234567890123,olw:OL1W,wd:Q4356581'), ['wd:Q4356581']);
assert.equal(trailerKeys(Array.from({ length: 60 }, (_, i) => `tmdb:${i + 1}`).join(',')).length, 40, 'не больше 40');
const file: Record<string, TrailerItem[]> = { 'tmdb:27205': [{ k: id(1), l: 'ru', t: 'T', s: 'own' }], 'tv:1399': [], 'tmdb:9': [{ k: id(2), l: 'en', t: 'S', s: 'tmdb', ru: 0 }] };
assert.deepEqual(pickWorks(file, ['tmdb:27205', 'tv:1399', 'tmdb:1']), { 'tmdb:27205': file['tmdb:27205'], 'tv:1399': [] }, 'непроверенные не возвращаются');
assert.deepEqual(pickWorks(file, ['tmdb:constructor'.replace('constructor', '0')]), {});

let gets = 0;
const env = (body: string | null, etag = '"1"') => ({
  REFERENCE: { get: async (k: string) => { gets += 1; return k === 'trailers.json' && body !== null ? { body: new Response(body).body!, httpEtag: etag } : null; } },
}) as unknown as Env;
const ask = async (e: Env, q: string) => {
  const r = await getTrailers(e, new URL(`http://x/api/trailers?${q}`));
  assert.equal(r.status, 200);
  assert.match(r.headers.get('cache-control') ?? '', /public, max-age=3600/);
  return r.json();
};
forgetTrailers();
assert.deepEqual(await ask(env(null), 'keys=tmdb:27205'), {}, 'без справочника — пустой ответ, не 500');
forgetTrailers();
assert.deepEqual(await ask(env('не json'), 'keys=tmdb:27205'), {}, 'битый справочник — пустой ответ');
forgetTrailers();
const e1 = env(JSON.stringify({ at, works: file }));
assert.deepEqual(await ask(e1, 'keys=tmdb:27205,tv:1399,tmdb:404'), { 'tmdb:27205': file['tmdb:27205'], 'tv:1399': [] });
gets = 0;
await ask(e1, 'keys=tmdb:9');
assert.equal(gets, 0, 'в пределах минуты — из памяти, без чтения справочника');
assert.deepEqual(await ask(e1, 'keys=bad'), {});
forgetTrailers();

// короткое — рекламный ролик, не трейлер (17.10)
assert.equal(seconds('PT2M13S'), 133);
assert.equal(seconds('PT17S'), 17);
assert.equal(seconds('PT1H2M'), 3720);
assert.equal(seconds('бред'), undefined);
const pub = { privacyStatus: 'public', embeddable: true };
assert.equal(videoMeta({ id: 'sh3B9UVwb6o', status: pub, contentDetails: { duration: 'PT17S' } }, 'x').ok, 0, 'реклама на 17 с');
assert.equal(videoMeta({ id: 'Q6nepw3fskg', status: pub, contentDetails: { duration: 'PT3M28S' } }, 'x').ok, 1);
assert.equal(videoMeta({ id: 'Q6nepw3fskg', status: pub, contentDetails: {} }, 'x').ok, 1, 'нет длительности — не выкидываем');

// ─── фильмы без TMDb: трейлер по элементу Wikidata (18.10) ─────────────────────
const wq = wdTrailerQuery(['Q4356581', 'Q2075834', 'плохо', 'Q1 } DELETE']);
assert.match(wq, /VALUES \?f \{ wd:Q4356581 wd:Q2075834 \}/, 'только настоящие QID — без чужих вставок в запрос');
assert.match(wq, /pq:P3831 wd:Q622550/, 'роль «трейлер», не полное видео');
const wr = wdTrailerRows(['Q4356581', 'Q2075834'], [
  { f: { value: 'http://www.wikidata.org/entity/Q4356581' }, x: { value: id(90) }, code: { value: 'ru' } },
  { f: { value: 'http://www.wikidata.org/entity/Q4356581' }, x: { value: id(90) } },          // повтор ролика
  { f: { value: 'http://www.wikidata.org/entity/Q4356581' }, x: { value: 'короткий' } },       // не id YouTube
  { f: { value: 'http://www.wikidata.org/entity/Q999' }, x: { value: id(91) } },               // не спрашивали
]);
assert.deepEqual(wr, { Q4356581: [{ k: id(90), l: 'ru' }], Q2075834: [] }, 'спрошенный без ролика — пустая запись (проверено)');
forgetTrailers();
const e2 = env(JSON.stringify({ at, works: { 'wd:Q4356581': [{ k: id(90), l: 'ru', t: 'T', s: 'wd' }], 'wd:Q2075834': [] } }));
assert.deepEqual(await ask(e2, 'keys=wd:Q4356581,wd:Q2075834,wd:Q1'), { 'wd:Q4356581': [{ k: id(90), l: 'ru', t: 'T', s: 'wd' }], 'wd:Q2075834': [] });
forgetTrailers();

// ─── сериалы: первый сезон или общий раньше поздних (18.10, сквозная проверка 17.10) ─────────────────────
// сезон по названию: 0 — первый или без номера, 1 — весь сериал, N — сезон N, 999 — «финальный/новый», 1000 — серия
const sr: [string, number][] = [
  ['Official Trailer', 0], ['Русский трейлер', 0], ['Игра престолов. Тизер', 0], ['Tin Star Season 1 - Official Trailer [HD]', 0],
  ['Фоллаут (1 сезон) — Русский трейлер (Дубляж, 2024)', 0], ['Ходячие мертвецы трейлер 1 сезона', 0], ['Lost Trailer (First Season)', 0],
  ['Рипли (1-й сезон) 💎 Русский трейлер 💎 Сериал 2024 (Netflix)', 0], ['The Vampire Diaries S1 Trailer', 0], ['Heroes Trailer - Season One', 0],
  ['Мистер Робот (2015) — русский трейлер 1 сезона сериала', 0], ['Трейлер №1. Сезон 1', 0],
  ['Game of Thrones | Official Series Trailer', 1], ['Breaking Bad - Full Series Trailer', 1], ['Gilmore Girls Seasons 1-4 DVD Trailer', 1],
  ['Трейлер "Остаться в живых" (1-6 сезон)', 1],
  ['Игра престолов 5 сезон. Трейлер 2', 5], ['Игра Престолов 7 сезон | Game of Thrones | Трейлер 2', 7], ['Трейлер №1. Сезон 3', 3],
  ['Король Талсы (2 сезон) — Русский трейлер (2024)', 2], ['БРИДЖЕРТОНЫ 2-сезон   Русский трейлер', 2], ['Season 2 Trailer', 2],
  ['3rd Season Trailer (Russian)', 3], ['Полярный | Трейлер пятого сезона | PREMIER', 5], ['Top Gear - Series 6 Trailer (2005)', 6],
  ['Arcane S2 Official Trailer', 2], ['Love, Death + Robots: Volume 3 | Final Trailer | Netflix', 3], ['Трейлер №1 (Сезон 4)', 4],
  ['Мистер Робот (2016) — русский трейлер 2 сезона сериала', 2], ['Очень странные дела (5 сезон, Том 3) Новый трейлер (Дубляж, 4К, 2025)', 5],
  ['Сериал «Чикатило» Финальный сезон | Тизер', 999], ['Битва экстрасенсов [трейлер нового сезона]', 999], ['The Final Season | Official Trailer', 999],
  ['Игра престолов 1 сезон 1 серия короткая версия', 1000], ['Suits Season 1, Episode 9', 1000], ['The Prisoner - Trailer EP1 Arrival', 1000],
  ['Wynonna Earp (2016) | Syfy New Series 2016 | Official Trailer HD', 0], ['Vestron Collector’s Series 4K (#37) Trailer', 0],
  ['Мистер Робот (2016) — трейлер', 0], ['Дом Дракона | Трейлер | Амедиатека (2022)', 0],
];
for (const [n, want] of sr) assert.equal(seasonRank(n), want, n);
assert.equal(seasonRank(undefined), 0);
assert.ok(isSeriesKey('tv:1399') && isSeriesKey('imdb:tt0944947') && !isSeriesKey('tmdb:1399') && !isSeriesKey('wd:Q1'));

// «Игра престолов» (tv:1399) — ролики TMDb и канала как в .cache/trailers/tmdb.json 17.10: раньше в итоге были «5 сезон.
// Трейлер 2» (ru T) и «8 сезон — тизер» (ru S), и при спойлерах > 0 русскому зрителю шёл трейлер пятого сезона
const got: Candidate[] = [
  { k: 'KPLWWIOCOOQ', l: 'en', t: 'T', s: 'tmdb', n: 'Game of Thrones | Official Series Trailer', o: 1, d: '2021-04-05' },
  { k: 'KXbRLd5HR84', l: 'ru', t: 'T', s: 'tmdb', n: 'Игра престолов 1 сезон 1 серия короткая версия', d: '2019-03-19' },
  { k: 'Cj7YSehHr7o', l: 'ru', t: 'T', s: 'tmdb', n: 'Игра Престолов 7 сезон | Game of Thrones | Трейлер 2', o: 1, d: '2017-06-21' },
  { k: 'CS8zOyRebYo', l: 'ru', t: 'T', s: 'tmdb', n: 'Игра Престолов 7 сезон | Game of Thrones | Трейлер', o: 1, d: '2017-05-24' },
  { k: '4gYQ_DsHbzM', l: 'ru', t: 'T', s: 'tmdb', n: 'Игра престолов 5 сезон. Трейлер 2', o: 1, d: '2015-03-19' },
  { k: '-aEKGjbJ-w8', l: 'ru', t: 'T', s: 'tmdb', n: 'Игра престолов 5 сезон. Трейлер', o: 1, d: '2015-02-06' },
  { k: 'BpJYNVhGf1s', l: 'en', t: 'T', s: 'tmdb', n: 'Official Trailer', o: 1, d: '2011-03-04' },
  { k: 'hhqRmcsWqac', l: 'en', t: 'S', s: 'tmdb', n: 'Iron Throne Preview', o: 1, d: '2011-01-15' },
  { k: 'i9OWW_pnZ-M', l: 'ru', t: 'S', s: 'ch', n: 'Игра престолов (8 сезон) — Тизер-трейлер «Последствия» (2019)' },
];
// как фильм (без признака сериала) — по-старому: поздние сезоны на месте
assert.equal(pickTrailers(got)[0].k, 'Cj7YSehHr7o', 'новее и официальный — «7 сезон. Трейлер 2»');
// сериал: ранние есть (английские) — поздних сезонов и серий нет вовсе, клиенту переставлять нечего
const gotSer = pickTrailers(toCheck(got, true), true);
assert.deepEqual(gotSer.map((x) => x.k), ['BpJYNVhGf1s', 'hhqRmcsWqac'], 'первый сезон раньше «всего сериала», тизер — первого сезона');
// и выбор клиента (как pickTrailer в src/api/index.ts: язык, потом вид) — первый сезон при любом уровне спойлеров
const client = (items: TrailerItem[], shy: boolean, order = ['ru', 'en', '']) => {
  const r = (v: TrailerItem) => { const i = order.indexOf(v.l); return i < 0 ? order.length : i; };
  return [...items].filter((v) => v.ru !== 0).sort((a, b) => r(a) - r(b) || (shy ? Number(b.t === 'S') - Number(a.t === 'S') : Number(b.t === 'T') - Number(a.t === 'T')))[0]?.k;
};
assert.equal(client(gotSer, false), 'BpJYNVhGf1s', 'спойлеры > 0 — трейлер первого сезона, не «5 сезон. Трейлер 2»');
assert.equal(client(gotSer, true), 'hhqRmcsWqac', 'без спойлеров — тизер первого сезона');
// русский общий есть — он, а поздние русские уходят; английский ранний — свой
const withRu = pickTrailers([...got, { k: 'ruGeneral01', l: 'ru', t: 'T', s: 'tmdb', n: 'Игра престолов — Русский трейлер', o: 1, d: '2011-04-01' }], true);
assert.deepEqual(withRu.map((x) => x.k), ['ruGeneral01', 'BpJYNVhGf1s', 'hhqRmcsWqac']);
assert.equal(client(withRu, false), 'ruGeneral01');
assert.equal(client(withRu, true), 'ruGeneral01', 'язык прежде вида (решение владельца 17.10): русского тизера нет — русский общий трейлер');
// раннего нет вовсе — поздние остаются, младший сезон раньше, серия — последней
const late = pickTrailers([
  c(80, { l: 'ru', n: 'Сериал (8 сезон) — трейлер', s: 'ch' }), c(81, { l: 'ru', n: 'Сериал (3 сезон) — трейлер' }),
  c(82, { l: 'ru', n: 'Сериал 1 сезон 1 серия' }), c(83, { l: 'en', t: 'S', n: 'Season 4 Teaser' }),
], true);
assert.deepEqual(late.map((x) => x.k), [id(81), id(83)]);
// ранний только закрыт в России — не в счёт: русскому зрителю нужен хоть поздний
const blockedEarly = pickTrailers([c(84, { l: 'en', n: 'Season 1 Trailer', ru: 0 }), c(85, { l: 'ru', n: 'Сериал (2 сезон) — трейлер' })], true);
assert.deepEqual(blockedEarly.map((x) => x.k), [id(85), id(84)]);
// иной язык считается ранним, только когда английского нет (иначе его в итоге нет)
assert.deepEqual(pickTrailers([c(86, { l: 'ja', n: 'Official Trailer' }), c(87, { l: 'en', n: 'Season 2 Trailer' })], true).map((x) => x.k), [id(87)]);
assert.deepEqual(pickTrailers([c(88, { l: 'ja', n: 'Official Trailer' }), c(89, { l: 'ru', n: 'Сериал (2 сезон) — трейлер' })], true).map((x) => x.k), [id(88)]);
// свой (own) — как первый сезон, что бы ни было в названии
assert.equal(pickTrailers([c(90, { l: 'ru', s: 'own', n: 'Сериал 3 сезон' }), c(91, { l: 'ru', n: 'Сериал. Трейлер' })], true)[0].k, id(90));
// запасные на проверку у сериала — ранние вперёд: иначе три свежих поздних вытеснили бы первый сезон до YouTube
const spare = toCheck([1, 2, 3].map((n) => c(n, { n: `Season ${n + 1} Trailer`, d: `202${n}-01-01` })).concat(c(9, { n: 'Season 1 Trailer', d: '2010-01-01' })), true);
assert.ok(spare.some((x) => x.k === id(9)));
assert.ok(!toCheck([1, 2, 3].map((n) => c(n, { n: `Season ${n + 1} Trailer`, d: `202${n}-01-01` })).concat(c(9, { n: 'Season 1 Trailer', d: '2010-01-01' }))).some((x) => x.k === id(9)), 'фильм — как был');
// фильм: «Эпизод 4» и «Open Season 2» — не сезоны и не серии, ничего не выкидываем
const sw = pickTrailers([c(92, { l: 'ru', n: 'Звездные войны: Эпизод 4 – Новая надежда (1977) — русский трейлер HD' }), c(93, { l: 'en', n: 'Official Trailer', o: 1 })]);
assert.deepEqual(sw.map((x) => x.k), [id(92), id(93)]);

console.log('трейлеры: ok');
