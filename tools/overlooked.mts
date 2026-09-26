// Обделённые фильмы: о них говорят те, кто понимает, но разбора нет ни у кого, а массового
// внимания фильм не получил. → .cache/markup/overlooked.tsv и отчёт в консоль.
//   npx tsx tools/overlooked.mts [--min-mentions 3] [--top 40] [--all] [--both]
//
// `--both` оставляет только фильмы, у которых известны обе меры массы. Это единственный
// список, которому можно верить целиком: там, где мера одна, перекос этой меры ничем не
// уравновешен. Пока Википедия покрывает не всё, отбор стоит дорого — но он честен.
//
// Зачем. Это повод написать блогеру: не «вот дыры в твоём канале» (такой список у всех
// выходит одинаковый — новинки этой недели), а «вот фильм, который в твоём кругу называют
// постоянно, разбора нет ни у кого, и массовый зритель прошёл мимо».
//
// Три оси, все считаются по тому, что у нас есть, без NC-источников:
//   разговор — сколько постов авторских каналов назвали фильм (.cache/mentions.json);
//   масса    — наибольшее из трёх: зрители на Trakt, просмотры статьи в Википедии, обзорщики;
//   разборы  — наш индекс: есть ли у фильма разбор автора-эссеиста (площадки не в счёт).
//
// Почему три, а не одна. У каждой свой перекос, и они друг друга уравновешивают:
//   просмотры статьи — против того, что смотрят, но не читают: мультфильмы («Райя», «Энканто»,
//     «Митчеллы против машин») попадали в обделённые только поэтому (замер 24.09);
//   зрители Trakt — против русского и советского кино: «Простоквашино» 48 зрителей,
//     «Третий день» 21, «Ирония судьбы» 671, потому что аудитория там англоязычная (замер 25.09);
//   обзорщики — единственная мера, снятая с русскоязычной публики: если фильм взял BadComedian
//     или КИНОКРИТИКА, массовое внимание у нас он получил, чего ни Trakt, ни en-статья не видят.
// Поэтому массой считается НАИБОЛЬШЕЕ из трёх мест: фильм не обделён, если он велик хоть по
// одной мере. Обделён — только тот, кто мал по всем. Места сравнимы между собой, сами числа нет,
// поэтому берётся максимум процентилей, а не максимум значений.
//
// Ось обзорщиков работает только вверх. «Обзорщик взял фильм» — свидетельство массового
// внимания; «не взял» — свидетельство ничего: обзорных каналов у нас восемь, и молчание восьми
// человек это не замер аудитории. Поэтому ноль обзоров массу не задаёт, а единственный обзор
// сразу ставит фильм выше тех восьмидесяти с лишним процентов, которых не взял никто.
//
// Остаток = разговор минус масса. Оба числа сильно перекошены, поэтому сравниваются не сами
// значения, а места в ряду (процентили): «назван чаще 90% названных, а прочитан реже 30%
// прочитанных» — утверждение, которое не зависит от единиц измерения.
//
// Чего этот счёт не делает: он не знает структуры фильма. Проверка 24.09 показала, что форма
// (темп речи, тишина, редкая лексика) разбор не предсказывает вовсе — медианы у разобранных и
// неразобранных совпадают. Так что «эссеисту подошло бы» здесь выведено из поведения людей,
// а не из устройства фильма.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { essays } from '../src/mocks/essays.ts';
import { essaysAuto } from '../src/mocks/essaysAuto.ts';
import { postsAuto } from '../src/mocks/postsAuto.ts';
import { voices, voiceKeys } from '../src/mocks/voices.ts';
import { worksIndex } from './works-index.mts';
import type { ExternalAnalysis } from '../src/types/tmdf.ts';

const argv = process.argv.slice(2);
const opt = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const MIN = Number(opt('--min-mentions') ?? 3);
const TOP = Number(opt('--top') ?? 40);
const ALL = argv.includes('--all');
const BOTH = argv.includes('--both');
const OUT = '.cache/markup';

const mentionsFile = new URL('../.cache/mentions.json', import.meta.url);
if (!existsSync(mentionsFile)) { console.error('нужен .cache/mentions.json — соберите tools/build-comention-index.mts'); process.exit(1); }
interface Mention { n: number; author: number; platform: number; channels: number }
const mentions = JSON.parse(readFileSync(mentionsFile, 'utf8')) as Record<string, Mention>;

const attnFile = new URL('../.cache/attention.json', import.meta.url);
interface TraktStats { watchers: number; plays: number; votes: number; collectors: number }
interface Attention { article?: string; lang?: string; views?: number; months?: number; missing?: true; trakt?: TraktStats }
const attention: Record<string, Attention> = existsSync(attnFile) ? JSON.parse(readFileSync(attnFile, 'utf8')) : {};
if (!Object.keys(attention).length) {
  console.error('нет .cache/attention.json — оси массы не будет, считаю только по разговору');
  console.error('(собрать: npx tsx tools/build-attention.mts)\n');
}

// кто уже разобрал: площадки не в счёт — пост онлайн-кинотеатра про свою премьеру не разбор
const byId = new Map(voices.map((v) => [v.id, v]));
const vid = (a: ExternalAnalysis) => {
  const h = /^tg-([^-]+)-/.exec(a.id)?.[1];
  const k = h ? `tg:${h}` : `yt:${a.author}`;
  return voiceKeys[k] ?? k;
};
// Ярус канала живёт в .cache/youtube/channels.json, а не в sources.ts: у материала есть только
// название канала, и на YouTube оно другое («TerlKabot channel» против «TerlKabot» в списке).
// Книжные каналы (medium: 'book') из обеих осей выпадают: Денис Чужой ничего не говорит о том,
// посмотрели фильм или нет.
interface ChannelMeta { title: string; tier?: 'essay' | 'review'; medium?: 'film' | 'book' }
const chFile = new URL('../.cache/youtube/channels.json', import.meta.url);
const channels: Record<string, ChannelMeta> = existsSync(chFile) ? JSON.parse(readFileSync(chFile, 'utf8')) : {};
const reviewTitles = new Set(Object.values(channels)
  .filter((c) => c.tier === 'review' && (c.medium ?? 'film') === 'film').map((c) => c.title));
const bookTitles = new Set(Object.values(channels).filter((c) => c.medium === 'book').map((c) => c.title));
if (!reviewTitles.size) console.error('нет .cache/youtube/channels.json — оси обзорщиков не будет\n');

const authors = new Map<string, Set<string>>();    // разборы: кто взял фильм всерьёз
const reviewers = new Map<string, Set<string>>();  // обзоры: кто взял его на массовую публику
for (const src of [essays, essaysAuto, postsAuto]) {
  for (const [k, list] of Object.entries(src)) for (const a of list) {
    if (byId.get(vid(a))?.role === 'platform') continue;
    if (bookTitles.has(a.author)) continue;
    const to = reviewTitles.has(a.author) ? reviewers : authors;
    (to.get(k) ?? to.set(k, new Set()).get(k)!).add(vid(a));
  }
}
const cards = new Map(worksIndex().map((w) => [w.key, w.work]));

/** Место в ряду, 0–100. По местам, а не по значениям: у просмотров и упоминаний разные
 *  единицы и оба распределения с длинным хвостом. */
function ranker(values: number[]): (v: number) => number {
  const sorted = [...values].sort((a, b) => a - b);
  return (v: number) => {
    let lo = 0; let hi = sorted.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (sorted[mid] < v) lo = mid + 1; else hi = mid; }
    return Math.round((lo / Math.max(1, sorted.length - 1)) * 100);
  };
}

const pool = Object.entries(mentions).filter(([, m]) => m.author >= MIN);
const talkRank = ranker(pool.map(([, m]) => m.author));
// только русские статьи: у en-Википедии медиана просмотров в 17 раз выше (замер 24.09), и
// фильм, у которого нашлась лишь английская статья, выглядел бы сверхпопулярным. Таких
// четыре — проще исключить их из оси массы, чем городить пересчёт между языками
const ruViews = (k: string) => (attention[k]?.lang === 'ru' && attention[k].views != null ? attention[k] : undefined);
const watchers = (k: string) => attention[k]?.trakt?.watchers;
// у каждой меры свой ряд: место в ряду сравнимо, сами числа — нет
const viewRank = ranker(pool.filter(([k]) => ruViews(k)).map(([k]) => ruViews(k)!.views!));
const watchRank = ranker(pool.map(([k]) => watchers(k)).filter((v): v is number => v != null));
// ряд обзоров считается по всему пулу вместе с нулями: место в нём и означает «взят чаще, чем
// столько-то процентов названных фильмов». Сам ноль в массу не идёт (см. шапку)
const reviewRank = ranker(pool.map(([k]) => reviewers.get(k)?.size ?? 0));

interface Row {
  key: string; title: string; year?: number; talk: number; channels: number; platform: number;
  mass?: number; source: string; talkP: number; massP?: number; gap: number; covered: number; reviewed: number;
}
const rows: Row[] = [];
for (const [key, m] of pool) {
  const c = cards.get(key);
  const talkP = talkRank(m.author);
  const w = watchers(key);
  const a = ruViews(key);
  const rev = reviewers.get(key)?.size ?? 0;
  // велик хоть по одной мере — значит не обделён. Каждая мера — это пара «место, само число»;
  // ноль обзоров меры не даёт, поэтому в список не попадает
  const known: { name: string; p: number; raw: number }[] = [];
  if (w != null) known.push({ name: 'Trakt', p: watchRank(w), raw: w });
  if (a) known.push({ name: 'вики', p: viewRank(a.views!), raw: a.views! });
  if (rev > 0) known.push({ name: 'обзоры', p: reviewRank(rev), raw: rev });
  const top = known.reduce<typeof known[0] | undefined>((best, x) => (!best || x.p > best.p ? x : best), undefined);
  const massP = top?.p;
  const source = known.map((x) => x.name).join('+');
  const mass = top?.raw;
  rows.push({
    key, title: c?.title ?? key, year: c?.year, talk: m.author, channels: m.channels, platform: m.platform,
    mass, source, talkP, massP, reviewed: rev,
    // остаток определён только когда известны обе оси. Подставить сюда один разговор — значит
    // поставить фильм без статьи впереди всех: у него не окажется массы, которая его опустит
    gap: massP == null ? Number.NaN : talkP - massP,
    covered: authors.get(key)?.size ?? 0,
  });
}

const all = rows.filter((r) => ALL || r.covered === 0);
const measures = (r: Row) => (r.source ? r.source.split('+').length : 0);
const picked = all.filter((r) => Number.isFinite(r.gap) && (!BOTH || measures(r) >= 2)).sort((a, b) => b.gap - a.gap);
// у этих не с чем сравнивать разговор: статью для них не искали. Из отчёта не выкидываем —
// это очередь на догрузку, а не мусор
const noAxis = all.filter((r) => !Number.isFinite(r.gap)).sort((a, b) => b.talk - a.talk);

mkdirSync(OUT, { recursive: true });
const cell = (v: unknown) => (v == null ? '' : String(v).replace(/[\t\r\n]+/g, ' '));
const head = ['фильм', 'год', 'назвали_авторы', 'каналов', 'площадки', 'масса', 'чем_мерена',
  'место_разговор', 'место_масса', 'остаток', 'разборов', 'обзоров', 'ключ'];
const tsv = [head, ...[...picked, ...noAxis].map((r) => [
  r.title, r.year, r.talk, r.channels, r.platform, r.mass, r.source, r.talkP, r.massP,
  Number.isFinite(r.gap) ? r.gap : 'нет оси массы', r.covered, r.reviewed, r.key,
])].map((r) => r.map(cell).join('\t')).join('\n') + '\n';
writeFileSync(join(OUT, 'overlooked.tsv'), tsv);

console.log(`# Обделённые — ${new Date().toISOString().slice(0, 10)}\n`);
console.log(`Названо авторами не меньше ${MIN} раз: ${pool.length} фильмов.`);
const two = all.filter((r) => measures(r) >= 2).length;
const rev = all.filter((r) => r.reviewed > 0).length;
console.log(`Из них без разбора: ${all.length}; масса известна у ${picked.length}, не меньше чем двумя мерами — у ${two}.`);
console.log(`Обзорщики брали ${rev} из них — для этих фильмов масса измерена на русскоязычной публике.\n`);
console.log('| фильм | год | назвали | каналов | масса | чем | разговор | масса | остаток |');
console.log('|---|---|---|---|---|---|---|---|---|');
for (const r of picked.slice(0, TOP)) {
  console.log(`| ${r.title} | ${r.year ?? ''} | ${r.talk} | ${r.channels} | ${r.mass} | ${r.source} | ${r.talkP} | ${r.massP} | ${r.gap} |`);
}
if (noAxis.length) {
  console.log(`\nБез оси массы — ${noAxis.length} фильмов, остаток для них не определён.`);
  console.log(`Самые обсуждаемые из них: ${noAxis.slice(0, 6).map((r) => `${r.title} (${r.talk})`).join(', ')}.`);
  console.log('Их добирает tools/build-attention.mts — после него они встанут в общий ряд.');
}
console.log(`\n→ ${OUT}/overlooked.tsv (${picked.length + noAxis.length} строк)`);
