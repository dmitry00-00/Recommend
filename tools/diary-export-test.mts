// Проверка ДФ-14: выгрузка дневника читается нашим импортом обратно без потерь (14.10).
//
//   npx tsx tools/diary-export-test.mts
//
// Дневник: фильм с оценкой из импорта (7 из 10) и датами; сериал с номером TMDb (уходит в TmdbTvID, не в tmdbID —
// Letterboxd искал бы по нему фильм); книга с ISBN и Wikidata; своя запись без ID, в названии запятая и кавычки;
// брошенный фильм с оценкой приложения 2 (→ 4 из 10); фильм в планах.
import assert from 'node:assert/strict';
import { buildMatchIndex, diaryCsv, diaryJson, matchScored, parseCsv, parseExport, type DiaryRow } from '../src/lib/import/index.ts';
import type { WorkCard } from '../src/types/tmdf.ts';

const rows: DiaryRow[] = [
  { workId: 'w-stalker', type: 'film', title: 'Сталкер', year: 1979, status: 'finished', rating: 4, raw: 7,
    startedAt: '2026-09-01', finishedAt: '2026-09-02', ids: { tmdb: 1398, imdb: 'tt0079944', wikidata: 'Q319137', kinopoisk: 43911 } },
  { workId: 'u-tmdbtv1396', type: 'series', title: 'Во все тяжкие', originalTitle: 'Breaking Bad', year: 2008, status: 'in_progress',
    startedAt: '2026-10-01', ids: { tmdb: 1396, imdb: 'tt0903747' } },
  { workId: 'b-master', type: 'book', title: 'Мастер и Маргарита', year: 1967, status: 'finished', rating: 5,
    finishedAt: '2026-08-15', ids: { isbn: ['9785170905968', '9780141180144'], wikidata: 'Q188801', openLibrary: 'OL1234W' } },
  { workId: 'own-x1', type: 'film', title: 'Дом, который "построил" Джек', year: 2018, status: 'finished', ids: {} },
  { workId: 'w-mirror', type: 'film', title: 'Зеркало', year: 1975, status: 'abandoned', rating: 2, startedAt: '2026-07-10',
    abandonReason: 'not_engaging', ids: { tmdb: 1396 + 100000, imdb: 'tt0072443' } },
  { workId: 'w-solaris', type: 'film', title: 'Солярис', year: 1972, status: 'planned', ids: { imdb: 'tt0069293' } },
];

const csv = diaryCsv(rows);
assert.ok(csv.startsWith('﻿'), 'BOM для Excel');
const table = parseCsv(csv);
assert.deepEqual(table.header.slice(0, 7), ['Title', 'Year', 'Rating10', 'WatchedDate', 'Rewatch', 'tmdbID', 'imdbID'], 'колонки Letterboxd — первыми');
assert.equal(table.rows[1]['tmdbID'], '', 'у сериала tmdbID пуст');
assert.equal(table.rows[1]['TmdbTvID'], '1396', 'номер сериала — в своей колонке');
assert.equal(table.rows[3]['Title'], 'Дом, который "построил" Джек', 'запятая и кавычки в названии');

const parsed = parseExport(csv, 'recomend-diary-2026-10-14.csv');
assert.ok(parsed, 'формат узнан');
assert.equal(parsed.source, 'letterboxd_import');
const rec = parsed.records;
assert.equal(rec.length, rows.length, 'ни одна строка не потерялась');

assert.deepEqual(rec.map((r) => r.type), ['film', 'series', 'book', 'film', 'film', 'film'], 'вид');
assert.deepEqual(rec.map((r) => r.status), ['finished', 'in_progress', 'finished', 'finished', 'abandoned', 'planned'], 'статус');
assert.deepEqual(rec.map((r) => r.rating), [7, undefined, 10, undefined, 4, undefined], 'оценка 0–10');
assert.deepEqual(rec.map((r) => r.date), ['2026-09-02', undefined, '2026-08-15', undefined, undefined, undefined], 'дата досмотра');
assert.deepEqual(rec.map((r) => r.started), ['2026-09-01', '2026-10-01', undefined, undefined, '2026-07-10', undefined], 'дата начала');
assert.equal(rec[1].originalTitle, 'Breaking Bad');
assert.deepEqual(rec[0].externalIds, { imdb: 'tt0079944', tmdb: 1398, kinopoisk: 43911, wikidata: 'Q319137', isbn: undefined, openLibrary: undefined });
assert.equal(rec[1].externalIds?.tmdb, 1396, 'номер сериала вернулся');
assert.deepEqual(rec[2].externalIds?.isbn, ['9785170905968', '9780141180144']);
assert.equal(rec[2].externalIds?.wikidata, 'Q188801');
assert.equal(rec[2].externalIds?.openLibrary, 'OL1234W');
assert.equal(rec[3].externalIds, undefined, 'своя запись — без ID');
// округление обратно в 1–5, как в commitImport: round(raw / 2)
assert.deepEqual(rec.map((r) => (r.rating != null ? Math.round(r.rating / 2) : undefined)), [4, undefined, 5, undefined, 2, undefined], 'оценка 1–5 та же');

// сопоставление: каталог с теми же карточками — всё по ID, своя запись — по названию и году
const card = (id: string, type: WorkCard['type'], title: string, year: number, externalIds: WorkCard['externalIds']) =>
  ({ id, type, title, year, externalIds, complexityLevel: 0 }) as unknown as WorkCard;
const series = { ...card('u-tmdbtv1396', 'series', 'Во все тяжкие', 2008, { tmdb: 1396, imdb: 'tt0903747' }) };
const index = buildMatchIndex([
  card('w-stalker', 'film', 'Сталкер', 1979, { tmdb: 1398, imdb: 'tt0079944' }),
  series,
  card('b-master', 'book', 'Мастер и Маргарита', 1967, { wikidata: 'Q188801' }),
  card('own-x1', 'film', 'Дом, который "построил" Джек', 2018, {}),
  card('w-mirror', 'film', 'Зеркало', 1975, { imdb: 'tt0072443' }),
  card('w-solaris', 'film', 'Солярис', 1972, { imdb: 'tt0069293' }),
]);
const matched = rec.map((r) => matchScored(r, index));
assert.deepEqual(matched.map((m) => m?.work.id), rows.map((r) => r.workId), 'каждая строка — на свою карточку');
assert.deepEqual(matched.map((m) => m?.how), ['id', 'id', 'id', 'exact', 'id', 'id'], 'книга — по Wikidata, своя запись — точным названием');

const json = JSON.parse(diaryJson(rows, '2026-10-14T09:00:00.000Z')) as { format: string; entries: (DiaryRow & { rating10?: number })[] };
assert.equal(json.format, 'recomend-diary');
assert.equal(json.entries.length, rows.length);
assert.equal(json.entries[0].rating10, 7);
assert.equal(json.entries[4].abandonReason, 'not_engaging');

console.log(`ДФ-14: ${rows.length} строк туда и обратно — без потерь`);
