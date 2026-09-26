// Что даёт TV Tropes нашим произведениям — замер, а не генератор.
//   npx tsx tools/tropes-report.mts <путь к film_imdb_match.csv>
// Вход — таблица из датасета dhruvilgala/tvtropes (статья «Analyzing Gender Bias within
// Narrative Tropes», 2020): троп ↔ фильм с IMDb ID. Наши фильмы сводятся с ней по IMDb;
// недостающие IMDb ID берутся из .cache/imdb-by-tmdb.json (tools/backfill-imdb.mts).
// Контент TV Tropes — CC BY-NC-SA: у себя держим ID, названия и собственные производные,
// но не их тексты.
import { createReadStream, existsSync, readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { worksIndex } from './works-index.mts';
import { comentions } from '../src/mocks/comentions.ts';

const file = process.argv[2];
if (!file) { console.error('нужен путь к film_imdb_match.csv'); process.exit(1); }

const cacheFile = new URL('../.cache/imdb-by-tmdb.json', import.meta.url);
const imdbByTmdb: Record<string, string | null> = existsSync(cacheFile) ? JSON.parse(readFileSync(cacheFile, 'utf8')) : {};
const ours = worksIndex().map(({ key, work }) => ({
  key,
  title: work.title,
  year: work.year,
  marked: Boolean(work.complexityLevel && work.primaryOperations?.length),
  imdb: work.externalIds?.imdb ?? (work.externalIds?.tmdb != null ? imdbByTmdb[String(work.externalIds.tmdb)] : null) ?? null,
}));
const byImdb = new Map(ours.filter((w) => w.imdb).map((w) => [w.imdb!, w]));
console.error(`наших произведений: ${ours.length}, из них с IMDb ID: ${byImdb.size}`);

/** Разбор строки CSV с кавычками: поле «Example» содержит и запятые, и переводы строк,
 *  поэтому читаем посимвольно и склеиваем запись из нескольких строк файла. */
function splitCsv(line: string): string[] {
  const out: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') { field += '"'; i += 1; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { out.push(field); field = ''; }
    else field += c;
  }
  out.push(field);
  return out;
}
const openQuotes = (s: string): boolean => (s.match(/"/g)?.length ?? 0) % 2 === 1;

const tropesOf = new Map<string, Set<string>>();
const films = new Set<string>();
let rows = 0;
let header: string[] | undefined;
let buffer = '';
const rl = createInterface({ input: createReadStream(file, 'utf8'), crlfDelay: Infinity });
for await (const line of rl) {
  buffer = buffer ? `${buffer}\n${line}` : line;
  if (openQuotes(buffer)) continue; // запись ещё не кончилась
  const cells = splitCsv(buffer);
  buffer = '';
  if (!header) { header = cells; continue; }
  rows += 1;
  const tconst = cells[header.indexOf('tconst')];
  const trope = cells[header.indexOf('Trope')];
  if (!tconst) continue;
  films.add(tconst);
  if (!byImdb.has(tconst) || !trope) continue;
  // написание тропа в датасете гуляет регистром: IncurableCoughOfDeath и InCurableCoughOfDeath
  const norm = trope.toLowerCase();
  (tropesOf.get(tconst) ?? tropesOf.set(tconst, new Set()).get(tconst)!).add(norm);
}
console.error(`строк в таблице: ${rows}, разных фильмов в датасете: ${films.size}`);

const covered = [...byImdb.values()].filter((w) => tropesOf.has(w.imdb!));
const sizes = covered.map((w) => tropesOf.get(w.imdb!)!.size).sort((a, b) => a - b);
const median = (xs: number[]) => (xs.length ? xs[Math.floor(xs.length / 2)] : 0);
console.error(`\nнаших фильмов найдено: ${covered.length} из ${byImdb.size} (${Math.round((covered.length / byImdb.size) * 100)}%)`);
console.error(`тропов на фильм: медиана ${median(sizes)}, минимум ${sizes[0]}, максимум ${sizes[sizes.length - 1]}, всего привязок ${sizes.reduce((a, b) => a + b, 0)}`);
console.error(`размеченных вручную покрыто: ${covered.filter((w) => w.marked).length} из ${ours.filter((w) => w.marked).length}`);

const freq = new Map<string, number>();
for (const w of covered) for (const t of tropesOf.get(w.imdb!)!) freq.set(t, (freq.get(t) ?? 0) + 1);
const top = [...freq.entries()].sort((a, b) => b[1] - a[1]);
const total = [...freq.values()].reduce((a, b) => a + b, 0);
console.error(`разных тропов: ${freq.size}, встреченных один раз: ${[...freq.values()].filter((n) => n === 1).length}`);
for (const n of [100, 200, 500, 1000, 3000]) {
  const share = top.slice(0, n).reduce((a, [, c]) => a + c, 0) / total;
  console.error(`  топ-${n} тропов покрывают ${Math.round(share * 100)}% привязок`);
}
console.error(`  самые частые: ${top.slice(0, 12).map(([t, n]) => `${t}·${n}`).join(', ')}`);

// Сходятся ли два независимых сигнала: «названы вместе» (наш граф по русским каналам) и
// «делят приёмы» (английская вики). Мера — Жаккар по множествам тропов.
const imdbByKey = new Map(ours.filter((w) => w.imdb).map((w) => [w.key, w.imdb!]));
const jac = (a: string, b: string): number | undefined => {
  const A = tropesOf.get(a); const B = tropesOf.get(b);
  if (!A || !B) return undefined;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter += 1;
  return inter / (A.size + B.size - inter);
};
const pairs = new Set<string>();
for (const [key, list] of Object.entries(comentions)) for (const c of list) pairs.add([key, c.key].sort().join('|'));
const have: number[] = [];
for (const p of pairs) {
  const [a, b] = p.split('|').map((k) => imdbByKey.get(k) ?? '');
  const j = a && b ? jac(a, b) : undefined;
  if (j != null) have.push(j);
}
const pop = [...tropesOf.keys()];
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
let seed = 7;
const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const sampleMean = (n: number) => {
  const xs: number[] = [];
  while (xs.length < n) {
    const a = pop[Math.floor(rnd() * pop.length)]; const b = pop[Math.floor(rnd() * pop.length)];
    if (a === b) continue;
    const j = jac(a, b);
    if (j != null) xs.push(j);
  }
  return mean(xs);
};
if (have.length) {
  const obs = mean(have);
  const N = 20000;
  let hits = 0;
  for (let i = 0; i < N; i++) if (sampleMean(have.length) >= obs) hits += 1;
  console.error(`\nсогласие с графом соупоминаний: пар, где тропы известны с обеих сторон — ${have.length}`);
  console.error(`  их сходство по тропам (Жаккар): среднее ${obs.toFixed(4)}`);
  console.error(`  случайная пара из тех же фильмов: среднее ${sampleMean(2000).toFixed(4)}`);
  console.error(`  перестановочный тест на ${N} выборках: p = ${(hits / N).toFixed(4)}`);
}
