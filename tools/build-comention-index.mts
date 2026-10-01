// Граф соупоминаний: что называют вместе в одном посте → src/mocks/comentions.ts.
//   npx tsx tools/build-comention-index.mts <канал>=<папка|result.json> [ещё…]
// Вход тот же, что у индекса разборов, — официальный экспорт Telegram Desktop.
//
// Зачем. Разметка есть у 47 произведений из 1178, и похожесть по операциям проверить нечем.
// Соупоминание — независимый от нас сигнал: его создают не мы, а те, кто пишет о кино.
// Если наша близость и близость по разговору расходятся — это повод усомниться в модели,
// а не в данных; до сих пор такого повода взяться было неоткуда.
//
// Как ловим названия. Не тем же способом, что разборы: там важна тема поста (первая строка),
// здесь — все упоминания в теле. Перебирать 1178 названий по 60 тысячам постов дорого и
// шумно, поэтому наоборот: из поста достаём то, что выделено кавычками или капсом (каналы
// названия всегда выделяют), и уже это ищем в таблице названий. Строгое равенство после
// нормализации — точность тут важнее полноты: постов много, редкое упоминание не жалко.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { parseArgs, readExport } from './telegram-export.mts';
import { worksIndex } from './works-index.mts';
import { VENUE } from './title-match.mts';
import { evidenceFor } from './evidence.mts';
import { registerBase } from '../src/mocks/registerBase.ts';
import { workRegisters } from '../src/mocks/workRegisters.ts';
import type { CoMention, WorkCard } from '../src/types/tmdf.ts';

const args = parseArgs(process.argv.slice(2));

/** Название к сравнению: регистр, ё, знаки и год в скобках снимаются. */
const norm = (s: string): string => s.toLowerCase().replace(/ё/g, 'е')
  .replace(/\((?:19|20)\d{2}\)/g, ' ')
  .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

const ours = worksIndex();
/** Таблица «нормализованное название → ключ произведения». Первый в списке побеждает:
 *  порядок worksIndex — каталог, история, просмотренное, пул, справочник. «Солярис» книга и
 *  «Солярис» фильм при этом склеиваются — известная цена этой таблицы. */
const byName = new Map<string, string>();
const cards = new Map<string, WorkCard>();
for (const { key, work, names } of ours) {
  cards.set(key, work);
  for (const n of names) {
    const k = norm(n);
    if (k.length >= 4 && !byName.has(k)) byName.set(k, key);
  }
}

/** Что в посте выделено как название: кавычки любого вида или капс из двух и более букв.
 *  Вид выделения возвращаем вместе с текстом: повседневному названию капса мало. */
function marked(text: string): { text: string; quoted: boolean }[] {
  const out: { text: string; quoted: boolean }[] = [];
  for (const m of text.matchAll(/[«"„']([^«»"„“'\n]{3,60})[»"“']/g)) {
    // после слова-заведения в кавычках стоит место, а не фильм (см. VENUE в title-match)
    if (VENUE.test(text.slice(Math.max(0, m.index - 30), m.index))) continue;
    out.push({ text: m[1], quoted: true });
  }
  for (const m of text.matchAll(/(?:^|[\s(])([\p{Lu}][\p{Lu}\p{N}]{1,}(?:[\s-][\p{Lu}][\p{Lu}\p{N}]*){0,4})(?=[\s.,!?:)]|$)/gu)) out.push({ text: m[1], quoted: false });
  return out;
}

/** Повседневные названия этого корпуса (tools/build-ordinary.mts). Им капса недостаточно:
 *  «Книжные покупки ОКТЯБРЯ» и «в „Октябре“» (это кинотеатр) давали Эйзенштейну 79 упоминаний
 *  с 11 каналов и первое место в «обделённых» (замер 26.09). Кавычки тоже не панацея, но
 *  капс в русском тексте — это чаще крик, чем название. */
const ordFile = new URL('../.cache/ordinary.json', import.meta.url);
const ordinary = new Set<string>(existsSync(ordFile)
  ? (JSON.parse(readFileSync(ordFile, 'utf8')).names as string[]).map(norm) : []);

const mentions = new Map<string, number>();
/** Кто назвал: площадка (онлайн-кинотеатр) пишет о том, что продвигает, автор — о том, что
 *  ему интересно. Для «обделённых» это разные вещи, поэтому счёт ведём раздельно. */
const who = new Map<string, { author: number; platform: number; channels: Set<string> }>();
const pairs = new Map<string, number>();
const stats = { posts: 0, withOne: 0, withMany: 0 };
for (const { path, role, username } of args) {
  const platform = role === 'platform';
  const { posts } = readExport(path);
  for (const p of posts) {
    stats.posts += 1;
    const found = new Set<string>();
    for (const frag of marked(p.text)) {
      const name = norm(frag.text);
      if (!frag.quoted && ordinary.has(name)) continue;
      const key = byName.get(name);
      // повседневному названию и кавычек мало: «Главный герой» в кавычках — чаще термин, чем фильм
      // 2021-го. Нужна улика в посте — год, оригинальное название или ссылка на страницу фильма
      if (key && ordinary.has(name) && !evidenceFor(cards.get(key)!, p.text)) continue;
      if (key) found.add(key);
    }
    if (!found.size) continue;
    stats.withOne += 1;
    for (const k of found) {
      mentions.set(k, (mentions.get(k) ?? 0) + 1);
      const r = who.get(k) ?? { author: 0, platform: 0, channels: new Set<string>() };
      if (platform) r.platform += 1; else r.author += 1;
      r.channels.add(username);
      who.set(k, r);
    }
    if (found.size < 2) continue;
    stats.withMany += 1;
    const list = [...found].sort();
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) pairs.set(`${list[i]}|${list[j]}`, (pairs.get(`${list[i]}|${list[j]}`) ?? 0) + 1);
    }
  }
}

/** Вес пары — косинус: сырой счёт тянут на себя те, о ком пишут каждый день.
 *  «Паразиты» встречаются рядом со всеми, и без нормировки они окажутся соседом всего. */
const MIN_PAIR = 3;
const PER_WORK = 8;
interface Edge { a: string; b: string; n: number; w: number }
const edges: Edge[] = [];
for (const [pair, n] of pairs) {
  if (n < MIN_PAIR) continue;
  const [a, b] = pair.split('|');
  edges.push({ a, b, n, w: n / Math.sqrt((mentions.get(a) ?? 1) * (mentions.get(b) ?? 1)) });
}
edges.sort((x, y) => y.w - x.w);

/** Соседи каждого произведения — самые тесные первыми. */
const neighbours = new Map<string, CoMention[]>();
const add = (from: string, to: string, e: Edge) => {
  const list = neighbours.get(from) ?? neighbours.set(from, []).get(from)!;
  if (list.length >= PER_WORK) return;
  const work = cards.get(to);
  if (!work) return;
  list.push({
    key: to, workId: work.id, title: work.title, ...(work.year ? { year: work.year } : {}),
    n: e.n, weight: Number(e.w.toFixed(3)),
  });
};
for (const e of edges) { add(e.a, e.b, e); add(e.b, e.a, e); }

// В мок идут соседи только тех произведений, которые участник видит: каталог, история,
// присланное просмотренное и пул. Справочник живёт соседом, но своей строки не получает —
// иначе в бандл уедет весь граф.
const shown = new Set(ours.slice(0, ours.length).filter(({ work }) => !work.id.startsWith('fb-')).map(({ key }) => key));
const out: Record<string, CoMention[]> = {};
for (const [key, list] of neighbours) if (shown.has(key)) out[key] = list;

writeFileSync(new URL('../src/mocks/comentions.ts', import.meta.url),
  `// Сгенерировано tools/build-comention-index.mts (${new Date().toISOString().slice(0, 10)}): что называют
// вместе в одном посте. Это не рекомендация и не похожесть по смыслу — это то, как о кино
// говорят. Вес — косинус: сырой счёт тянут на себя те, о ком пишут каждый день.
// Не править руками — перегенерировать.
import type { CoMention } from '@/types/tmdf';

export const comentions: Record<string, CoMention[]> = ${JSON.stringify(out, null, 2)};
`);

// Сырой счёт упоминаний — не для приложения, а для замеров (tools/overlooked.mts): в бандл
// он не нужен, поэтому лежит в .cache, а не в моках.
writeFileSync(new URL('../.cache/mentions.json', import.meta.url), JSON.stringify(
  Object.fromEntries([...who].map(([k, r]) => [k, { n: mentions.get(k) ?? 0, author: r.author, platform: r.platform, channels: r.channels.size }])),
));

console.error(`постов ${stats.posts}: с названием ${stats.withOne}, с двумя и больше ${stats.withMany}`);
console.error(`→ .cache/mentions.json: ${who.size} произведений`);
console.error(`произведений названо ${mentions.size}, пар с тремя и больше упоминаниями ${edges.length}`);
console.error(`→ src/mocks/comentions.ts: ${Object.keys(out).length} произведений с соседями`);
console.error('\nсамые тесные пары:');
for (const e of edges.slice(0, 20)) {
  console.error(`  ${e.w.toFixed(2)} (${e.n}) ${cards.get(e.a)?.title} ↔ ${cards.get(e.b)?.title}`);
}

// ---- проверка модели: сходится ли наша близость с тем, как о кино говорят ----
// Регистр — единственная наша ось с приличным покрытием (207 произведений), поэтому проверяем
// её: если пары, у которых регистры общие, соупоминаются теснее, — ось держится на чужих
// данных, а не только на наших.
const regOf = (key: string): string[] | undefined => {
  const work = cards.get(key);
  const byId = work ? workRegisters[work.id] : undefined;
  return byId?.length ? byId : undefined;
};
const shared = (a: string[], b: string[]) => a.filter((r) => b.includes(r)).length;
let both = 0; let withShared = 0; let sumShared = 0; let sumOther = 0; let nShared = 0; let nOther = 0;
for (const e of edges) {
  const ra = regOf(e.a); const rb = regOf(e.b);
  if (!ra || !rb) continue;
  both += 1;
  if (shared(ra, rb)) { withShared += 1; sumShared += e.w; nShared += 1; } else { sumOther += e.w; nOther += 1; }
}
console.error(`\nпроверка регистра: пар, где регистр известен с обеих сторон — ${both}`);
if (both) {
  const share = withShared / both;
  const base = baseline();
  // z для доли: сколько сигм между «как есть» и «как было бы, если бы соупоминание было ни при чём»
  const z = (share - base) / Math.sqrt((base * (1 - base)) / both);
  console.error(`  с общим регистром ${withShared} (${Math.round(share * 100)}%), средний вес ${nShared ? (sumShared / nShared).toFixed(3) : '—'}`);
  console.error(`  без общего регистра ${both - withShared}, средний вес ${nOther ? (sumOther / nOther).toFixed(3) : '—'}`);
  console.error(`  случайная пара из тех же фильмов делит регистр в ${Math.round(base * 100)}% случаев`);
  console.error(`  разница: ${(share / base).toFixed(2)}×, z = ${z.toFixed(1)}`);
}

/** Нулевая гипотеза: пары из тех же фильмов, но составленные случайно. Сравнивать со всей
 *  базой нельзя — о фильмах говорят неравномерно, и в графе оседают не случайные фильмы,
 *  а те, о которых пишут; у них и набор регистров свой. */
function baseline(): number {
  const pop = [...new Set(edges.flatMap((e) => [e.a, e.b]))].filter((k) => regOf(k));
  let hit = 0; let all = 0;
  for (let i = 0; i < pop.length; i++) {
    for (let j = i + 1; j < pop.length; j++) {
      all += 1;
      if (shared(regOf(pop[i])!, regOf(pop[j])!)) hit += 1;
    }
  }
  return all ? hit / all : 0;
}
void registerBase;
