// Сопоставление импорта без года (17.10): «Сталкер», «Солярис», «Начало» списком без года подставлялись новыми
// одноимёнными (2023, 2002, 2020) вместо классики; копии одной вещи под разными id шли в альтернативы дважды
// («Сталкер, 1979» ×2) и мешали точному совпадению с годом («Маяк» 2019 — три карточки, «проверьте»).
//
//   npx tsx tools/import-match-test.mts
//
// Карточки — как в живом каталоге (id и известность из src/mocks/fame.ts на 17.10): у классики копии из справочника,
// каталога и истории, известность есть только у одной из них.
import assert from 'node:assert/strict';
import { buildMatchIndex, matchScored, parseExports, PASTED_LIST } from '../src/lib/import/index.ts';
import type { WorkCard } from '../src/types/tmdf.ts';

const card = (id: string, title: string, year: number, level = 0, externalIds: WorkCard['externalIds'] = {}) =>
  ({ id, type: 'film', title, year, externalIds, complexityLevel: level }) as unknown as WorkCard;
const works = [
  card('f-wd122871525', 'Сталкер', 2023, 5),
  card('l-tmdb1398', 'Сталкер', 1979, 8, { tmdb: 1398 }),
  card('f-tmdb1398', 'Сталкер', 1979, 8, { tmdb: 1398 }),
  card('f-wd673195', 'Солярис', 2002, 6),
  card('w06', 'Солярис', 1972, 7),
  card('f-wd125672', 'Солярис', 1968, 5),
  card('f-tmdb593', 'Солярис', 1972, 0, { tmdb: 593 }),
  card('f-wd96942519', 'Начало', 2020, 8),
  card('w08', 'Начало', 2010, 5),
  card('f-wd3222490', 'Начало', 1970, 5),
  card('l-tmdb27205', 'Начало', 2010, 0, { tmdb: 27205 }),
  card('f-tmdb27205', 'Начало', 2010, 0, { tmdb: 27205 }),
  card('c-lighthouse', 'Маяк', 2019),
  card('l-tmdb503919', 'Маяк', 2019, 8, { tmdb: 503919 }),
  card('f-tmdb503919', 'Маяк', 2019, 8, { tmdb: 503919 }),
  card('f-wd136565785', 'Обитель зла', 2026, 3),
  card('f-wd153484', 'Обитель зла', 2002, 2),
  card('f-wd25136484', 'Оно', 2017, 0),
  card('f-wd575697', 'Оно', 1989, 6),
  // два разных фильма одного года с одним названием (разные TMDb) — не склеиваем
  card('x-twin-a', 'Двойник', 2013, 0, { tmdb: 1 }),
  card('x-twin-b', 'Двойник', 2013, 0, { tmdb: 2 }),
];
const fame: Record<string, number> = { 'f-tmdb1398': 2, 'f-wd673195': 1, 'f-tmdb593': 2, 'f-tmdb27205': 3, 'f-tmdb503919': 1, 'f-wd153484': 2, 'f-wd25136484': 2 };
const index = buildMatchIndex(works, { fame: (w) => fame[w.id] });

const list = ['Сталкер', 'Солярис', 'Начало', 'Маяк 2019', 'Обитель зла', 'Оно', 'Сталкер 2023', 'Солярис 2002', 'Начало 1970', 'Солярис 1972', 'Двойник 2013'];
const { records } = parseExports([{ name: PASTED_LIST, text: list.join('\n') }]);
assert.equal(records.length, list.length, 'все строки списка разобраны');
const got = records.map((r) => matchScored(r, index));
const year = (i: number) => got[i]?.work.year;
const how = (i: number) => got[i]?.how;
const alts = (i: number) => got[i]?.alternatives.map((w) => w.year) ?? [];

// без года — громкое
assert.equal(year(0), 1979, 'Сталкер без года — Тарковский');
assert.equal(year(1), 1972, 'Солярис без года — Тарковский');
assert.equal(year(2), 2010, 'Начало без года — Нолан');
assert.equal(year(4), 2002, 'Обитель зла без года — 2002');
assert.equal(year(5), 2017, 'Оно без года — 2017 (известнее)');
// без года — всё равно «проверьте»: человек видит, что подставили
assert.deepEqual([how(0), how(1), how(2)], ['loose', 'loose', 'loose']);
// альтернативы — без копий
assert.deepEqual(alts(0), [2023], 'у Сталкера одна альтернатива — 2023, а не 1979 дважды');
assert.deepEqual(alts(1).sort(), [1968, 2002], 'у Соляриса 1972 — без своей копии');
assert.deepEqual(alts(2).sort(), [1970, 2020], 'у Начала 2010 — без двух копий');
// с годом — как было, а копии больше не мешают точному совпадению
assert.equal(year(3), 2019); assert.equal(how(3), 'exact', 'Маяк 2019 — точно, три копии стали одной');
assert.equal(got[3]?.work.complexityLevel, 8, 'представитель копий — размеченная карточка');
assert.equal(year(6), 2023); assert.equal(how(6), 'exact', 'Сталкер 2023 — названный год сильнее известности');
assert.equal(year(7), 2002); assert.equal(how(7), 'exact');
assert.equal(year(8), 1970); assert.equal(how(8), 'exact');
assert.equal(year(9), 1972); assert.equal(how(9), 'exact', 'Солярис 1972: две копии — одна');
assert.equal(how(10), 'loose', 'разные фильмы одного года не склеены — человек выберет');
assert.equal(got[10]?.alternatives.length, 1);

// без таблицы известности — прежний порядок (размеченное, потом новее): импорт не ломается, если она не пришла
const plain = buildMatchIndex(works);
assert.equal(matchScored(records[0], plain)?.work.year, 2023, 'без известности — прежнее поведение');

console.log(`импорт без года: ${list.length} строк — громкое первым, копии склеены, год сильнее известности`);
