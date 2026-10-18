// Проверка индекса разборов первой ленты (18.10, аудит скорости, волна 3А; src/lib/essayIndex.ts):
//   1. на всех карточках справочника (кино, сериалы, книги, каталог с разборами деталей) и трёх наборах языков ответ
//      «есть ли разбор» по одному индексу — тот же, что по полным индексам (`essayCount` против полного расчёта); так
//      же при половине пришедших долей;
//   2. доли вместе — ровно полные индексы; рубрики долей и индекса — из полного справочника рубрик;
//   3. придуманные дубли: видимый ролик снят более ранним обзором с тем же названием под другим ключом книги, пост с тем
//      же адресом, ручной разбор того же ролика — ответ по индексу совпадает с полным.
// Без сети.
//
//   npx tsx tools/essay-index-test.mts
import assert from 'node:assert/strict';
import type { ExternalAnalysis, WorkCard } from '../src/types/tmdf.ts';
import { essaysAuto } from '../src/mocks/essaysAuto.ts';
import { postsAuto } from '../src/mocks/postsAuto.ts';
import { essayLenses } from '../src/mocks/essayLenses.ts';
import { essays } from '../src/mocks/essays.ts';
import { externalAnalyses, works as catalogWorks } from '../src/mocks/index.ts';
import { workDetail } from '../src/mocks/workDetails.ts';
import { externalIds } from '../src/mocks/externalIds.ts';
import { candidateSeeds, seedToCard } from '../src/mocks/candidates.ts';
import { filmBase } from '../src/mocks/filmBase.ts';
import { filmBaseWiki } from '../src/mocks/filmBaseWiki.ts';
import { filmBaseMarkup } from '../src/mocks/filmBaseMarkup.ts';
import { filmBasePopular } from '../src/mocks/filmBasePopular.ts';
import { filmBaseWorld } from '../src/mocks/filmBaseWorld.ts';
import { filmBaseChannels } from '../src/mocks/filmBaseChannels.ts';
import { filmBaseCurated } from '../src/mocks/filmBaseCurated.ts';
import { seriesBase } from '../src/mocks/seriesBase.ts';
import { seriesBaseWiki } from '../src/mocks/seriesBaseWiki.ts';
import { bookBase } from '../src/mocks/bookBase.ts';
import { userWorks } from '../src/mocks/userHistory.ts';
import { watchedWorks } from '../src/mocks/userWatched.ts';
import { workKeys } from '../src/lib/keys.ts';
import { normalizeWork } from '../src/lib/media.ts';
import { ANALYSIS_SHARDS, analysisShard, buildEssayIndex, essayCount, type AnalysisShard } from '../src/lib/essayIndex.ts';

const verdictOf = () => undefined;
const LANGS: string[][] = [['ru'], ['en'], ['ru', 'en']];
const full = { e: essaysAuto, p: postsAuto };

// ─── 1. все карточки справочника ─────────────────────────────────────────────────────────────────────────────────
const { index, shards } = buildEssayIndex(essaysAuto, postsAuto, essayLenses, essays, externalAnalyses);
const cards: { work: WorkCard; detail?: ExternalAnalysis[] }[] = [
  ...Object.values(catalogWorks).map((w) => ({ work: { ...w, externalIds: w.externalIds ?? externalIds[w.id] }, detail: workDetail(w.id)?.externalAnalyses })),
  ...candidateSeeds.map((s) => ({ work: seedToCard(s) })),
  ...[filmBase, filmBaseWiki, filmBaseMarkup, filmBasePopular, filmBaseWorld, filmBaseChannels, filmBaseCurated, seriesBase, seriesBaseWiki,
    bookBase, userWorks, watchedWorks].flat().map((w) => ({ work: normalizeWork(w) })),
];
// и каждый ключ индексов — карточкой из одного ключа: так проверены и ключи, которых в справочнике сборки нет
const keyed = new Set(cards.flatMap((c) => workKeys(c.work, c.work.externalIds ?? externalIds[c.work.id])));
const lone = [...new Set([...Object.keys(essaysAuto), ...Object.keys(postsAuto)])].filter((k) => !keyed.has(k));

const half = new Set(Array.from({ length: ANALYSIS_SHARDS }, (_, i) => String(i).padStart(2, '0')).filter((_, i) => i % 2 === 0));
const halfLoaded = { e: {} as Record<string, ExternalAnalysis[]>, p: {} as Record<string, ExternalAnalysis[]> };
for (const s of half) { Object.assign(halfLoaded.e, shards[s].e); Object.assign(halfLoaded.p, shards[s].p); }

let checked = 0;
let withEssays = 0;
const check = (keys: string[], detail: ExternalAnalysis[] | undefined, what: string) => {
  for (const langs of LANGS) {
    const truth = essayCount(keys, detail, essays, full, undefined, () => true, verdictOf, langs);
    const lite = essayCount(keys, detail, essays, { e: {}, p: {} }, index, () => false, verdictOf, langs);
    const part = essayCount(keys, detail, essays, halfLoaded, index, (k) => half.has(analysisShard(k)), verdictOf, langs);
    assert.equal(lite > 0, truth > 0, `${what} [${langs}]: по индексу ${lite}, полностью ${truth}`);
    assert.equal(part > 0, truth > 0, `${what} [${langs}]: с половиной долей ${part}, полностью ${truth}`);
    if (part > 0 && keys.every((k) => half.has(analysisShard(k)))) assert.equal(part, truth, `${what}: все доли на месте — число то же`);
    checked += 1;
    if (truth > 0) withEssays += 1;
  }
};
for (const c of cards) check(workKeys(c.work, c.work.externalIds ?? externalIds[c.work.id]), c.detail, `${c.work.id} «${c.work.title}»`);
for (const k of lone) check([k], undefined, k);
assert.ok(withEssays > 1000, `с разборами — ${withEssays}: проверка не вхолостую`);

// ─── 2. доли = полные индексы ────────────────────────────────────────────────────────────────────────────────────
const back = { e: {} as Record<string, ExternalAnalysis[]>, p: {} as Record<string, ExternalAnalysis[]> };
for (const sh of Object.values(shards) as AnalysisShard[]) {
  assert.equal(sh.v, index.v, 'версия доли — версия индекса');
  for (const [k, l] of Object.entries(sh.e)) { assert.ok(!(k in back.e), `ключ ${k} в двух долях`); back.e[k] = l; assert.equal(analysisShard(k), Object.keys(shards).find((s) => shards[s] === sh)); }
  for (const [k, l] of Object.entries(sh.p)) back.p[k] = l;
  for (const [id, lens] of Object.entries(sh.l)) assert.equal(essayLenses[id], lens);
}
assert.equal(Object.keys(shards).length, ANALYSIS_SHARDS);
assert.deepEqual(back.e, essaysAuto, 'доли разборов вместе — essaysAuto');
assert.deepEqual(back.p, postsAuto, 'доли постов вместе — postsAuto');
for (const [id, lens] of Object.entries(index.l)) assert.equal(essayLenses[id], lens);

// ─── 3. придуманные дубли ────────────────────────────────────────────────────────────────────────────────────────
{
  const yt = (id: string, title: string, author: string, extra: Partial<ExternalAnalysis> = {}): ExternalAnalysis =>
    ({ id: `yta-${id}`, title, author, platform: 'youtube', url: `https://www.youtube.com/watch?v=${id}`, language: 'ru', spoilerLevel: 2, ...extra }) as ExternalAnalysis;
  const tg = (h: string, n: number, title: string, url?: string): ExternalAnalysis =>
    ({ id: `tg-${h}-${n}`, title, author: h, platform: 'telegram', url: url ?? `https://t.me/${h}/${n}`, language: 'ru', spoilerLevel: 2 }) as ExternalAnalysis;
  const e: Record<string, ExternalAnalysis[]> = {
    // книга с двумя ключами: под первым — обзор (не виден) с тем же названием, что эссе под вторым
    'wd:Q1': [yt('aaaaaaaaaaa', 'Почему «Война и мир» о нас', 'Обзорщик', { tier: 'review' })],
    'isbn:1': [yt('bbbbbbbbbbb', 'Почему «Война и мир» о нас', 'Эссеист')],
    // тот же ролик под двумя ключами — копия, а не дубль
    'tmdb:1': [yt('ccccccccccc', 'Сталкер', 'Эссеист')],
    'tmdb:2': [yt('ccccccccccc', 'Сталкер', 'Эссеист'), yt('ddddddddddd', 'Солярис: разбор', 'Другой', { language: 'en' })],
    // ручной разбор того же ролика (из сборки) — раньше найденного
    'tmdb:3': [yt('eeeeeeeeeee', 'Зеркало', 'Эссеист')],
  };
  const p: Record<string, ExternalAnalysis[]> = {
    // анонс ролика в канале: пост с тем же названием идёт после ролика
    'tmdb:1': [tg('chan', 1, 'Сталкер')],
    // пост со ссылкой-статьёй — сам по себе виден
    'tmdb:4': [{ ...tg('chan', 2, 'Статья о «Ностальгии»'), platform: 'article', url: 'https://example.org/n' } as ExternalAnalysis],
  };
  const curated: Record<string, ExternalAnalysis[]> = { 'tmdb:3': [yt('eeeeeeeeeee', 'Зеркало', 'Эссеист', { tier: 'review' })] };
  const { index: ix } = buildEssayIndex(e, p, {}, curated, []);
  const cases: string[][] = [['wd:Q1', 'isbn:1'], ['isbn:1', 'wd:Q1'], ['wd:Q1'], ['isbn:1'], ['tmdb:1'], ['tmdb:2'], ['tmdb:1', 'tmdb:2'], ['tmdb:3'], ['tmdb:4'], ['tmdb:5']];
  for (const keys of cases) for (const langs of LANGS) {
    const truth = essayCount(keys, undefined, curated, { e, p }, undefined, () => true, verdictOf, langs);
    const lite = essayCount(keys, undefined, curated, { e: {}, p: {} }, ix, () => false, verdictOf, langs);
    assert.equal(lite > 0, truth > 0, `[${keys}] [${langs}]: по индексу ${lite}, полностью ${truth}`);
  }
  // и сама ловушка сработала: обзор под первым ключом снимает эссе, под вторым — нет
  assert.equal(essayCount(['wd:Q1', 'isbn:1'], undefined, {}, { e, p }, undefined, () => true, verdictOf, ['ru']), 0);
  assert.equal(essayCount(['isbn:1', 'wd:Q1'], undefined, {}, { e, p }, undefined, () => true, verdictOf, ['ru']), 1);
  assert.equal(essayCount(['tmdb:3'], undefined, curated, { e, p }, undefined, () => true, verdictOf, ['ru']), 0, 'ручной обзор снимает найденное эссе');
}

console.log(`индекс разборов: ${checked} проверок (${withEssays} с разбором), ключей в индексе ${Object.keys(index.k).length}, с дублями ${Object.keys(index.x).length} — ок`);
