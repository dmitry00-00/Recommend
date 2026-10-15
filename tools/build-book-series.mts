// Стихи и циклы книг (РР-0, 14.10) — по Wikidata, для книжного подбора. Решения владельца 14.10: отдельное стихотворение
// в подбор не идёт (карточка остаётся в каталоге и поиске), рассказ — идёт; из цикла в ленту — первый непрочитанный том,
// карточка самого цикла — только когда томов у нас нет. Связи Ж1 (tools/resolve-relations.mts) книг почти не знают —
// там 6 циклов, поэтому свой запрос.
//   npx tsx tools/build-book-series.mts [--fresh] [--dry]
// Запрос — классы (P31), форма (P7937), жанр (P136), серия с номером тома (P179 + P1545), «часть от» (P361), «состоит
// из» (P527) и год (P577) по всем книгам bookBase; ответы — в .cache/book-series.json (--fresh — спросить заново).
// Пишет src/mocks/bookSeries.ts: стихи и циклы с томами по порядку.
// Цикл в правило не идёт, если это собрание самостоятельных книг (LOOSE: Жюль Верн, Золя, Пуаро — порядок чтения не
// важен) или если начала цикла у нас нет (первый наш том — не №1: «Певцы» №17 не должны вытеснить «Записки охотника»).
// «Часть целого» (рассказ из сборника, «Миф о пещере» из «Государства») не прячем: рассказы владелец оставил в подборе.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { bookBase } from '../src/mocks/bookBase.ts';
import { sparql, sleep } from './wave-lib.mts';

const argv = process.argv.slice(2);
const CACHE = '.cache/book-series.json';
const OUT = 'src/mocks/bookSeries.ts';

/** Стихотворение: форма «стихотворение» (P7937 Q5185279) или жанр «поэзия» (Q482). У Wikidata это один класс и для
 *  «Незнакомки», и для «Энеиды», поэтому эпос, поэма, сказка в стихах и сборник — книга. */
const POEM_FORM = 'Q5185279';
const POETRY = 'Q482';
const NOT_SHORT = new Set(['Q37484' /* эпос */, 'Q474090' /* поэма */, 'Q699' /* сказка */, 'Q1279564' /* сборник рассказов */]);
/** Где правило ошибается: поэма без жанра у Wikidata — книга; «Ворон» помечен поэмой, но это одно стихотворение. */
const BOOK = new Set(['Q28754' /* Потерянный рай */, 'Q2453425' /* Демон */]);
const POEM = new Set(['Q22726' /* Ворон */]);
/** Класс «цикл / серия книг»: серия книг, серия романов, гепталогия, трилогия, тетралогия, серия литературных произведений. */
const SERIES = new Set(['Q277759', 'Q1667921', 'Q614101', 'Q21191270', 'Q7725310', 'Q1259759', 'Q2296082', 'Q47068459']);
/** Собрания самостоятельных книг — каждую можно читать первой (сверено вручную по отчёту 14.10). */
const LOOSE = new Set([
  'Q3048935', 'Q112147292', // «Необыкновенные путешествия» Жюля Верна
  'Q6027', // Ругон-Маккары
  'Q3257270', 'Q54877325', // «Плоский мир», цикл о Смерти
  'Q1281967', // сказки Андерсена
  'Q122441953', 'Q132133414', // Пуаро, мисс Марпл
  'Q2316684', 'Q12857071', // Шерлок Холмс
  'Q27536277', // комиссар Адамберг
  'Q18535364', 'Q133423904', // Космер Сандерсона
  'Q113367219', // «Приключения магистра» Акунина
  'Q578605', // эпический цикл («Одиссея» → «Илиада»)
  'Q621596', // мифы Ктулху
  'Q958484', 'Q16385973', // Хайнлайн: «История будущего», юношеские романы
  'Q4106683', // Ефремов
  'Q86450949', // «Звёздные войны»
  'Q7975429', // романы Уэверли
  'Q1272578', // Шарп
  'Q2328396', // Хайнский цикл
  'Q83561430', // Роберт Лэнгдон
  'Q2610590', // «Киберпространство» Гибсона
  'Q773758', // Дренайская сага
  'Q3635508', // Бас-Лаг
]);

type Raw = { cls: string[]; form: string[]; genre: string[]; series: { q: string; n?: string }[]; partOf: string[]; parts: string[]; year?: number };

const card = new Map<string, (typeof bookBase)[number]>(); // Q → карточка
for (const b of bookBase) if (b.externalIds?.wikidata) card.set(b.externalIds.wikidata, b);

async function fetchAll(): Promise<Record<string, Raw>> {
  if (existsSync(CACHE) && !argv.includes('--fresh')) return JSON.parse(readFileSync(CACHE, 'utf8'));
  const out: Record<string, Raw> = {};
  const all = [...card.keys()];
  for (let i = 0; i < all.length; i += 150) {
    const vals = all.slice(i, i + 150).map((q) => `wd:${q}`).join(' ');
    const rows = await sparql(`SELECT ?b ?p ?v ?n WHERE { VALUES ?b { ${vals} }
      { ?b wdt:P31 ?v. BIND("cls" AS ?p) } UNION
      { ?b p:P179 ?s. ?s ps:P179 ?v. OPTIONAL { ?s pq:P1545 ?n } BIND("series" AS ?p) } UNION
      { ?b wdt:P361 ?v. BIND("partOf" AS ?p) } UNION
      { ?b wdt:P527 ?v. BIND("parts" AS ?p) } UNION
      { ?b wdt:P7937 ?v. BIND("form" AS ?p) } UNION
      { ?b wdt:P136 ?v. BIND("genre" AS ?p) } UNION
      { ?b wdt:P577 ?d. BIND(STR(YEAR(?d)) AS ?v) BIND("year" AS ?p) } }`);
    for (const r of rows) {
      // «неизвестное значение» у даты — YEAR() пуст
      if (!r.v) continue;
      const b = r.b.value.split('/').pop()!;
      const v = r.v.value.split('/').pop()!;
      const x = (out[b] ??= { cls: [], form: [], genre: [], series: [], partOf: [], parts: [] });
      const p = r.p.value;
      if (p === 'series') { if (!x.series.some((s) => s.q === v && s.n === r.n?.value)) x.series.push({ q: v, ...(r.n ? { n: r.n.value } : {}) }); }
      else if (p === 'year') { const y = Number(v); if (y && (!x.year || y < x.year)) x.year = y; }
      else { const list = x[p as 'cls' | 'form' | 'genre' | 'partOf' | 'parts']; if (!list.includes(v)) list.push(v); }
    }
    process.stderr.write(`  ${Math.min(i + 150, all.length)} из ${all.length}\n`);
    await sleep(500);
  }
  writeFileSync(CACHE, JSON.stringify(out));
  return out;
}

const raw = await fetchAll();
const empty: Raw = { cls: [], form: [], genre: [], series: [], partOf: [], parts: [] };
const of = (q: string): Raw => raw[q] ?? empty;
const isSeries = (q: string) => of(q).cls.some((c) => SERIES.has(c));
const title = (q: string) => card.get(q)?.title ?? q;

// ---------- стихи ----------
const poems = [...card.keys()].filter((q) => {
  if (POEM.has(q)) return true;
  if (BOOK.has(q)) return false;
  const x = of(q);
  if (!x.form.includes(POEM_FORM) && !x.genre.includes(POETRY)) return false;
  return ![...x.genre, ...x.form].some((g) => NOT_SHORT.has(g));
});

// ---------- циклы и части ----------
// том → цикл: серия (P179) с номером; «часть от» (P361) и «состоит из» (P527) — тоже, если целое — цикл по классу
const cycles = new Map<string, Map<string, number | undefined>>(); // цикл → том → номер
const addVol = (c: string, v: string, n?: number) => {
  if (c === v) return;
  const m = cycles.get(c) ?? cycles.set(c, new Map()).get(c)!;
  if (!m.has(v) || (m.get(v) == null && n != null)) m.set(v, n);
};
for (const q of card.keys()) {
  const x = of(q);
  for (const s of x.series) { const n = Number(s.n); addVol(s.q, q, Number.isFinite(n) && s.n ? n : undefined); }
  for (const w of x.partOf) if (isSeries(w)) addVol(w, q);
  if (isSeries(q)) for (const v of x.parts) if (card.has(v)) addVol(q, v);
}
// порядок: номер тома (приквел №0 — после основных: первым предлагаем «Око мира», а не «Новую весну»), затем год
const ordered: Record<string, string[]> = {};
const skipped: string[] = [];
for (const [c, vols] of cycles) {
  const list = [...vols.keys()].filter((v) => card.has(v));
  if (!list.length || (list.length < 2 && !card.has(c)) || LOOSE.has(c)) continue;
  const num = (v: string) => { const n = vols.get(v); return n == null ? Infinity : n < 1 ? 1e6 + n : n; };
  const year = (v: string) => of(v).year ?? card.get(v)?.year ?? Infinity;
  list.sort((a, b) => num(a) - num(b) || year(a) - year(b));
  // начало цикла у нас: первый том — №1 или томов без номеров не меньше двух
  const first = vols.get(list[0]);
  if (first != null ? first !== 1 : list.length < 2) { skipped.push(c); continue; }
  ordered[c] = list;
}

// ---------- отчёт ----------
const sortedCycles = Object.entries(ordered).sort((a, b) => b[1].length - a[1].length);
console.log(`стихов: ${poems.length}\n  ${poems.map(title).join(', ')}`);
console.log(`циклов: ${sortedCycles.length} (с карточкой цикла ${sortedCycles.filter(([c]) => card.has(c)).length}), томов в них: ${new Set(sortedCycles.flatMap(([, v]) => v)).size}`);
for (const [c, vols] of sortedCycles.slice(0, argv.includes('--all') ? Infinity : 25)) {
  console.log(`  ${card.has(c) ? '■' : '□'} ${title(c)} (${c}): ${vols.map((v) => `${title(v)}${cycles.get(c)!.get(v) != null ? ` #${cycles.get(c)!.get(v)}` : ''}`).join(' → ')}`);
}
console.log(`без начала цикла (не в правиле): ${skipped.map((c) => `${title(c)} (${[...cycles.get(c)!.keys()].filter((v) => card.has(v)).map(title).join(', ')})`).join('; ')}`);
if (argv.includes('--dry')) process.exit(0);

const json = (x: unknown) => JSON.stringify(x);
writeFileSync(OUT, `// Сгенерировано tools/build-book-series.mts (РР-0) — руками не править. Ключ — элемент Wikidata книги.
// Стихи в книжный подбор не идут (остаются в каталоге и поиске); из цикла в подбор — первый непрочитанный том, карточка
// цикла — только когда томов у нас нет. Собрания самостоятельных книг и циклы без первого тома сюда не попадают.

/** Отдельные стихотворения. */
export const bookPoems: string[] = ${json(poems.sort())};

/** Цикл → его тома у нас по порядку (номер тома в серии, затем год). */
export const bookCycles: Record<string, string[]> = {
${sortedCycles.map(([c, v]) => `  ${c}: ${json(v)}, // ${title(c)}`).join('\n')}
};
`);
console.log(`записано: ${OUT}`);
