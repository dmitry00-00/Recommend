// Проверка слоя правок справочника (17.10, волна Б; решение владельца 15.10):
//   1. правила (src/lib/workFixes.ts): название, год (0 — года нет), авторы строкой, снятые люди — в карточке и в записи
//      авторов; повторная правка ничего не портит, карточка без правки — тот же объект;
//   2. генератор (tools/work-fixes.mts): уверенность, ключ → главная копия (канон), нет ключа, конфликт, «уже так»,
//      «снимать некого», снятый в главной роли уходит из `creators`;
//   3. ручной список «точно одна вещь» канона копий (tools/work-aliases.mts, MANUAL_SAME): склейка при разных ключах,
//      главная — копия с верным ключом;
//   4. таблица сборки: ключи и значения в порядке, правки — на главных копиях, `applyWorkFixes` для сборщиков.
//
//   npx tsx tools/work-fixes-test.mts
import assert from 'node:assert/strict';
import { fixCreditRow, fixWork, fixWorkIn, droppedBy, type WorkFix } from '../src/lib/workFixes.ts';
import { applyWorkFixes, applyCreditFixes, fixCreditRows, workFixes } from '../src/lib/workFixesTable.ts';
import { buildFixes, cardsOf, MANUAL_FIXES, type RawFix } from './work-fixes.mts';
import { buildAliases, MANUAL_SAME, type AliasCard, type AliasSide } from './work-aliases.mts';
import { workAliases } from '../src/mocks/workAliases.ts';
import type { WorkCard } from '../src/types/tmdf.ts';
import { leadCredits } from '../src/lib/credits.ts';

// ─── 1. правила ─────────────────────────────────────────────────────────────────────────────────────────────────
{
  const w = {
    id: 'f-tmdb1', type: 'film', title: 'Old', year: 2015, creators: ['MiloÅ¡ Forman'], externalIds: { tmdb: 1 },
    credits: [{ personId: 'Q1', role: 'director', name: 'А' }, { personId: 'Q2', role: 'writer', name: 'Б' }],
  } as unknown as WorkCard;
  assert.equal(fixWork(w, undefined), w, 'без правки — тот же объект');
  assert.equal(fixWork(w, {}), w);
  const fix: WorkFix = { title: 'Новое', originalTitle: 'New', year: 2016, creators: ['Милош Форман'], dropPeople: ['Q2:w'] };
  const f = fixWork(w, fix);
  assert.notEqual(f, w);
  assert.equal(w.title, 'Old', 'исходная карточка не меняется');
  assert.deepEqual([f.title, f.originalTitle, f.year, f.creators], ['Новое', 'New', 2016, ['Милош Форман']]);
  assert.deepEqual(f.credits!.map((c) => c.personId), ['Q1'], 'снятый сценарист ушёл из credits');
  assert.equal(fixWork(f, fix), f, 'повторная правка — без изменений');
  assert.equal(fixWork(w, { year: 0 }).year, 0, 'год 0 — года нет');
  assert.deepEqual(fixWork(w, { creators: [] }).creators, [], 'пустые строки авторов — тоже правка');
  assert.equal(fixWork(w, { dropPeople: ['Q1:w'] }), w, 'роль не та — никого не снимаем');
  assert.ok(droppedBy({ dropPeople: ['Q1:d'] }, { personId: 'Q1', role: 'director' }));
  assert.equal(fixCreditRow('Q1:d,Q2:w,Q1:w', { dropPeople: ['Q1:w'] }), 'Q1:d,Q2:w');
  assert.equal(fixCreditRow('Q1:d', { dropPeople: ['Q1:d'] }), '');
  assert.equal(fixCreditRow('Q1:d', undefined), 'Q1:d');
  // по таблице — ключ главный (src/lib/keys.ts): у сериала IMDb, TMDb не в счёт
  const table = { 'tmdb:1': { year: 1999 }, 'imdb:tt9': { title: 'Сериал' } };
  assert.equal(fixWorkIn(table, w).year, 1999);
  const s = { ...w, type: 'series', externalIds: { tmdb: 1, imdb: 'tt9' } } as unknown as WorkCard;
  assert.deepEqual([fixWorkIn(table, s).title, fixWorkIn(table, s).year], ['Сериал', 2015]);
  // строка под названием: главной роли среди элементов нет (ложного создателя сняли) — строки `creators`, а не режиссёры серий
  const series = { ...w, type: 'series', creators: ['Рон Коуэн'], credits: [{ personId: 'Q7', role: 'director', name: 'Режиссёр серий' }] } as unknown as WorkCard;
  assert.deepEqual(leadCredits(series).map((c) => c.name), ['Рон Коуэн']);
  assert.deepEqual(leadCredits({ ...series, creators: [] }).map((c) => c.name), ['Режиссёр серий'], 'строк нет — как раньше, все элементы');
  console.log('ok: правила');
}

// ─── 2. генератор ───────────────────────────────────────────────────────────────────────────────────────────────
{
  const card = (src: string, id: string, title: string, year: number, ext: AliasCard['ext'], over: Partial<AliasCard> = {}): AliasCard =>
    ({ src, id, title, year, ext, creators: [], ops: 0, level: 0, img: false, blurb: false, countries: 0, genres: 0, regs: 0, ...over });
  const raw: AliasCard[] = [
    card('filmBase', 'f-tmdb10', 'Солярис', 1971, { tmdb: 10 }, { creators: ['Андрей Тарковский'] }),
    card('userHistory', 'u-kp10', 'Солярис', 1972, { tmdb: 11, kinopoisk: 43 }),
    card('filmBaseWiki', 'f-wd20', 'Сериал', 2003, { imdb: 'tt20' }, { type: 'series', creators: ['Глен А. Ларсон', 'Рональд Д. Мур'], credits: [['Q5', 'creator', 'Глен Ларсон']] }),
    card('bookBase', 'b-wd30', 'Книга', 1979, { isbn: ['978'] }, { type: 'book' }),
  ];
  const side = {
    externalIds: {}, bookWorks: { 978: { wd: 'Q30' } },
    workCredits: { 'tmdb:10': 'Q1:d,Q2:w', 'imdb:tt20': 'Q5:c,Q6:c' },
    people: { Q1: ['Андрей Тарковский'], Q2: ['Фридрих Горенштейн'], Q5: ['Глен Ларсон', 'Glen A. Larson'], Q6: ['Рональд Д. Мур'] } as AliasSide['people'],
  };
  const aliases = { 'u-kp10': 'f-tmdb10' };
  const x = (key: string, field: RawFix['field'], value: unknown, confidence = 'high'): RawFix => ({ key, field, value, confidence });
  const r = buildFixes([
    x('tmdb:10', 'year', 1972),
    x('tmdb:11', 'originalTitle', 'Солярис'), // ключ лишней копии → главная, под её ключом
    x('tmdb:10', 'title', 'Солярис'), // уже так
    x('tmdb:10', 'dropPeople', ['Q9:d']), // снимать некого
    x('tmdb:10', 'dropPeople', ['Q2:w']),
    x('tmdb:99', 'year', 2000), // ключа нет
    x('imdb:tt20', 'year', 2004), x('imdb:tt20', 'year', 2005), // конфликт
    x('imdb:tt20', 'dropPeople', ['Q5:c'], 'medium'),
    x('wd:Q30', 'year', 0), // книга по мосту ISBN
    x('wd:Q30', 'title', 'Другое', 'low'),
  ], cardsOf(raw, side), side, aliases);
  assert.deepEqual(r.fixes['tmdb:10'], { originalTitle: 'Солярис', year: 1972, dropPeople: ['Q2:w'] });
  assert.ok(!r.fixes['tmdb:11'], 'правка лишней копии — на главной');
  assert.ok(r.taken.some((t) => t.key === 'tmdb:11' && t.moved && t.target === 'tmdb:10'));
  assert.deepEqual(r.fixes['imdb:tt20'], { dropPeople: ['Q5:c'], creators: ['Рональд Д. Мур'] }, 'снятый создатель ушёл из строк, конфликт года — мимо');
  assert.deepEqual(r.fixes['wd:Q30'], { year: 0 });
  const why = (key: string, field: string) => r.refused.filter((z) => z.key === key && z.field === field).map((z) => z.why.replace(/:.*$/, ''));
  assert.deepEqual(why('tmdb:10', 'title'), ['уже так']);
  assert.deepEqual(why('tmdb:10', 'dropPeople'), ['снимать некого']);
  assert.deepEqual(why('tmdb:99', 'year'), ['ключа нет в справочнике']);
  assert.deepEqual(why('imdb:tt20', 'year'), ['конфликт', 'конфликт']);
  assert.deepEqual(why('wd:Q30', 'title'), ['уверенность low']);
  // medium по видам: без dropPeople — снятие создателя не берётся
  const r2 = buildFixes([x('imdb:tt20', 'dropPeople', ['Q5:c'], 'medium')], cardsOf(raw, side), side, aliases, { medium: ['year'] });
  assert.ok(!r2.fixes['imdb:tt20']);
  // снятие medium в роли d (режиссёр серий сериала) — не берём; в других ролях — берём
  const r3 = buildFixes([x('imdb:tt20', 'dropPeople', ['Q5:c', 'Q6:d'], 'medium'), x('tmdb:10', 'dropPeople', ['Q1:d'], 'medium')], cardsOf(raw, side), side, aliases);
  assert.deepEqual(r3.fixes['imdb:tt20']?.dropPeople, ['Q5:c']);
  assert.ok(!r3.fixes['tmdb:10']);
  assert.ok(r3.refused.some((z) => z.key === 'tmdb:10' && z.why.includes('роли d')));
  // снятое руками
  const r4 = buildFixes([x('tmdb:10', 'year', 1972)], cardsOf(raw, side), side, aliases, { refuse: [{ key: 'tmdb:10', field: 'year', why: 'спорно' }] });
  assert.ok(!r4.fixes['tmdb:10'] && r4.refused[0].why.startsWith('снято руками'));
  console.log('ok: генератор');
}

// ─── 3. ручной список «точно одна вещь» ─────────────────────────────────────────────────────────────────────────
{
  const card = (src: string, id: string, title: string, year: number, ext: AliasCard['ext'], over: Partial<AliasCard> = {}): AliasCard =>
    ({ src, id, title, year, ext, ops: 0, level: 0, img: false, blurb: false, countries: 0, genres: 0, regs: 0, ...over });
  const side: AliasSide = {
    externalIds: {}, bookWorks: {}, workCredits: {}, people: {}, analyses: {}, workDetailAnalyses: {},
    draftFilm: new Set(['tmdb:1']), draftSeries: new Set(), draftBook: new Set(), userAnn: new Set(), baseMedia: {}, bookMedia: {}, catalogMedia: new Set(),
  };
  const cards = [
    card('filmBase', 'f-tmdb1', 'Cold War', 2017, { tmdb: 1 }, { creators: ['Pawlikowski'] }),
    card('filmBaseWorld', 'f-wd2', 'Холодная война', 2018, { tmdb: 2, imdb: 'tt2' }, { creators: ['Павел Павликовский'] }),
  ];
  assert.deepEqual(buildAliases(cards, side, {}, []).aliases, {}, 'без ручного списка — разные ключи, не склеиваем');
  const r = buildAliases(cards, side, {}, [['f-tmdb1', 'f-wd2', 'ключ TMDb — тёзка']]);
  assert.deepEqual(r.aliases, { 'f-tmdb1': 'f-wd2' }, 'главная — копия с верным ключом, хотя черновик у лишней');
  assert.equal(r.review.length, 0, 'расхождение ключей в ручной группе — не спор');
  for (const [a, m] of MANUAL_SAME) assert.equal(workAliases[a], m, `таблица сборки знает ручную пару ${a} → ${m}`);
  console.log(`ok: ручной список канона (${MANUAL_SAME.length} пар)`);
}

// ─── 4. таблица сборки ──────────────────────────────────────────────────────────────────────────────────────────
{
  const keys = Object.keys(workFixes);
  assert.ok(keys.length > 300, `правок ${keys.length}`);
  for (const [k, f] of Object.entries(workFixes)) {
    assert.match(k, /^(?:tmdb:\d+|imdb:tt\d+|wd:Q\d+|olw:OL\d+W|own:[a-z0-9]{8}|isbn:\d+X?)$/, k);
    assert.ok(Object.keys(f).length, `${k}: пустая правка`);
    if (f.year !== undefined) assert.ok(Number.isInteger(f.year) && f.year >= 0 && f.year <= 2100, `${k}: год ${f.year}`);
    for (const p of f.dropPeople ?? []) assert.match(p, /^Q\d+:[dwca]$/, `${k}: ${p}`);
    for (const t of [f.title, f.originalTitle]) if (t !== undefined) assert.ok(t.trim() && t === t.trim(), `${k}: «${t}»`);
  }
  // правки — на главных: ключ карточки-лишней копии в таблице не встречается (её ключ — ключ главной или чужой)
  const aliasIds = new Set(Object.keys(workAliases));
  assert.ok(!keys.some((k) => aliasIds.has(k)));
  for (const m of MANUAL_FIXES) assert.ok(workFixes[m.key], `ручная правка ${m.key} в таблице`);
  // для сборщиков: по главному ключу; запись авторов — без снятых
  const dory = applyWorkFixes({ id: 'x', type: 'film', title: 'В поисках Дори', year: 2015, creators: [], externalIds: { tmdb: 127380 } } as unknown as WorkCard);
  assert.equal(dory.year, 2016);
  const [k, f] = Object.entries(workFixes).find(([, v]) => v.dropPeople?.length)!;
  const row = [...f.dropPeople!, 'Q1:d'].join(',');
  assert.equal(applyCreditFixes(k, row), 'Q1:d');
  assert.deepEqual(fixCreditRows({ [k]: f.dropPeople!.join(','), 'tmdb:0': 'Q1:d' }), { 'tmdb:0': 'Q1:d' }, 'никого не осталось — ключ уходит');
  console.log(`ok: таблица (${keys.length} вещей)`);
}
console.log('work-fixes-test: всё прошло');
