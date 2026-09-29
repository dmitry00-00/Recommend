// Что даёт Tag Genome нашим фильмам — замер, а не генератор.
//   npx tsx tools/taggenome-report.mts
// Вход — .cache/taggenome.json (tools/build-taggenome.mts).
// Наборы тегов под каждую проверку выбраны ДО того, как посчитана хоть одна корреляция:
// при 1084 тегах перебор нашёл бы «значимое» в любом случае, и это ничего бы не значило.
import { readFileSync } from 'node:fs';
import { comentions } from '../src/mocks/comentions.ts';
import { workRegisters } from '../src/mocks/workRegisters.ts';
import { worksIndex } from './works-index.mts';

interface Film { key: string; title: string; year: number; scores: number[] }
const data: { tags: string[]; films: Record<string, Film> } = JSON.parse(readFileSync(new URL('../.cache/taggenome.json', import.meta.url), 'utf8'));
const { tags } = data;
const films = Object.values(data.films);
const at = new Map(tags.map((t, i) => [t, i]));
const byKey = new Map(films.map((f) => [f.key, f]));

/** Заявлено заранее: «нагрузка» — теги про то, сколько фильм требует от зрителя.
 *  Сюда намеренно не входят «slow», «atmospheric», «art house», «pretentious»: это темп,
 *  оценка и тон, а не спрос, и их мы держим отдельно, чтобы проверить ими другое. */
const LOAD = ['thought-provoking', 'cerebral', 'confusing', 'complicated', 'complex',
  'philosophical', 'intellectual', 'nonlinear', 'non-linear', 'multiple storylines',
  'allegory', 'mindfuck', 'surreal'];
/** Заявлено заранее: «медленно» — то, что по смыслу должно совпасть с нашим замером речи
 *  по субтитрам. Это перекрёстная проверка субтитров чужими руками. */
const SLOW = ['slow', 'atmospheric', 'meditative', 'dreamlike'];

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const sd = (xs: number[]) => Math.sqrt(mean(xs.map((x) => (x - mean(xs)) ** 2)));
function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}
function ranks(xs: number[]): number[] {
  const order = xs.map((x, i) => [x, i] as const).sort((a, b) => a[0] - b[0]);
  const out = new Array(xs.length).fill(0);
  for (let i = 0; i < order.length;) {
    let j = i;
    while (j + 1 < order.length && order[j + 1][0] === order[i][0]) j++;
    const r = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) out[order[k][1]] = r;
    i = j + 1;
  }
  return out;
}
function spearman(a: number[], b: number[]): number {
  const [ra, rb] = [ranks(a), ranks(b)];
  const [ma, mb] = [mean(ra), mean(rb)];
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < ra.length; i++) { num += (ra[i] - ma) * (rb[i] - mb); da += (ra[i] - ma) ** 2; db += (rb[i] - mb) ** 2; }
  return num / Math.sqrt(da * db);
}
function permP(a: number[], b: number[], runs = 20000, seed = 3): string {
  const observed = Math.abs(spearman(a, b));
  const rand = rng(seed);
  const shuffled = [...b];
  let worse = 0;
  for (let i = 0; i < runs; i++) {
    for (let j = shuffled.length - 1; j > 0; j--) {
      const k = Math.floor(rand() * (j + 1));
      [shuffled[j], shuffled[k]] = [shuffled[k], shuffled[j]];
    }
    if (Math.abs(spearman(a, shuffled)) >= observed) worse++;
  }
  return worse === 0 ? `<${(1 / runs).toExponential(0)}` : ((worse + 1) / (runs + 1)).toFixed(4);
}

// значения тегов приводим к общему масштабу по нашим же фильмам: «относится ли этот тег
// к фильму сильнее обычного» осмысленнее, чем сырое число
const col = tags.map((_, i) => films.map((f) => f.scores[i]));
const mu = col.map(mean);
const sg = col.map((c) => sd(c) || 1);
const zOf = (f: Film, i: number) => (f.scores[i] - mu[i]) / sg[i];
const composite = (f: Film, names: string[]) => mean(names.filter((n) => at.has(n)).map((n) => zOf(f, at.get(n)!)));

console.log(`фильмов с Tag Genome: ${films.length} | тегов: ${tags.length}`);
console.log(`состав «нагрузки»: ${LOAD.filter((t) => at.has(t)).length} тегов, «медленно»: ${SLOW.filter((t) => at.has(t)).length}`);

// ── 1. перекрёстная проверка субтитров ────────────────────────────────────────
let form: Record<string, { key: string; wpm: number; gap30Share: number }> = {};
try { form = JSON.parse(readFileSync(new URL('../.cache/subtitle-metrics.json', import.meta.url), 'utf8')); } catch { /* замера ещё нет */ }
const formByKey = new Map(Object.values(form).map((r) => [r.key, r]));
const both = films.filter((f) => formByKey.has(f.key));
console.log('\n=== чужие теги против нашего замера по субтитрам ===');
console.log(`фильмов, где есть и то и другое: ${both.length}`);
if (both.length >= 50) {
  const slow = both.map((f) => composite(f, SLOW));
  for (const [label, xs] of [['слов в минуту', both.map((f) => formByKey.get(f.key)!.wpm)],
    ['доля долгих пауз', both.map((f) => formByKey.get(f.key)!.gap30Share)]] as [string, number[]][]) {
    console.log(`  «медленно» ↔ ${label.padEnd(17)} ρ = ${spearman(slow, xs).toFixed(2)}   p = ${permP(slow, xs)}`);
  }
}

// ── 2. против разметки руками ─────────────────────────────────────────────────
const levels = new Map<string, number>();
for (const { key, work } of worksIndex()) if (work.complexityLevel) levels.set(key, work.complexityLevel);
const marked = films.filter((f) => levels.has(f.key));
console.log('\n=== «нагрузка» против разметки руками ===');
console.log(`фильмов с проставленным уровнем: ${marked.length}`);
if (marked.length >= 10) {
  const lv = marked.map((f) => levels.get(f.key)!);
  const load = marked.map((f) => composite(f, LOAD));
  console.log(`  ρ = ${spearman(lv, load).toFixed(2)}   p = ${permP(lv, load)}   (одна проверка, набор тегов заявлен заранее)`);
  const by = new Map<number, number[]>();
  marked.forEach((f, i) => by.set(lv[i], [...(by.get(lv[i]) ?? []), load[i]]));
  for (const level of [...by.keys()].sort((a, b) => a - b)) {
    const g = by.get(level)!;
    console.log(`    уровень ${level}: ${String(g.length).padStart(2)} фильм.  «нагрузка» ${mean(g) >= 0 ? '+' : ''}${mean(g).toFixed(2)} σ`);
  }
}

// ── 3. против графа соупоминаний ──────────────────────────────────────────────
const vec = (f: Film) => f.scores.map((_, i) => zOf(f, i));
const cache = new Map<string, number[]>();
const v = (f: Film) => { let x = cache.get(f.key); if (!x) { x = vec(f); cache.set(f.key, x); } return x; };
function cos(a: Film, b: Film): number {
  const [x, y] = [v(a), v(b)];
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < x.length; i++) { dot += x[i] * y[i]; na += x[i] * x[i]; nb += y[i] * y[i]; }
  return dot / Math.sqrt(na * nb);
}
const pairs: [Film, Film][] = [];
const seen = new Set<string>();
for (const [key, list] of Object.entries(comentions)) {
  const a = byKey.get(key);
  if (!a) continue;
  for (const co of list) {
    const b = byKey.get(co.key);
    if (!b) continue;
    const id = [key, co.key].sort().join('|');
    if (seen.has(id)) continue;
    seen.add(id);
    pairs.push([a, b]);
  }
}
console.log('\n=== против графа соупоминаний ===');
console.log(`пар, где теги известны с обеих сторон: ${pairs.length}`);
if (pairs.length >= 30) {
  const observed = mean(pairs.map(([a, b]) => cos(a, b)));
  const pool = [...new Set(pairs.flat())];
  const rand = rng(23);
  const runs = 20000;
  let worse = 0;
  const nulls: number[] = [];
  for (let i = 0; i < runs; i++) {
    let sum = 0;
    for (let k = 0; k < pairs.length; k++) {
      const a = pool[Math.floor(rand() * pool.length)];
      let b = pool[Math.floor(rand() * pool.length)];
      while (b === a) b = pool[Math.floor(rand() * pool.length)];
      sum += cos(a, b);
    }
    nulls.push(sum / pairs.length);
    if (sum / pairs.length >= observed) worse++;
  }
  console.log(`  сходство по тегам у названных вместе: ${observed.toFixed(3)}`);
  console.log(`  у случайной пары из тех же ${pool.length} фильмов: ${mean(nulls).toFixed(3)}`);
  console.log(`  p = ${worse === 0 ? `<${(1 / runs).toExponential(0)}` : ((worse + 1) / (runs + 1)).toFixed(4)}`);
}

// ── 4. одно ли это с формой по субтитрам ──────────────────────────────────────
// Если сходство по тегам и близость по форме говорят одно и то же, второй источник лишний.
console.log('\n=== теги и форма: одно и то же или разное ===');
if (both.length >= 50) {
  const rand = rng(31);
  const sample: [Film, Film][] = [];
  for (let i = 0; i < 4000; i++) {
    const a = both[Math.floor(rand() * both.length)];
    const b = both[Math.floor(rand() * both.length)];
    if (a !== b) sample.push([a, b]);
  }
  const tagSim = sample.map(([a, b]) => cos(a, b));
  const formGap = sample.map(([a, b]) => {
    const [x, y] = [formByKey.get(a.key)!, formByKey.get(b.key)!];
    return Math.abs(x.wpm - y.wpm) + 100 * Math.abs(x.gap30Share - y.gap30Share);
  });
  console.log(`  на ${sample.length} случайных парах: ρ(сходство по тегам, разница по форме) = ${spearman(tagSim, formGap).toFixed(2)}`);
  console.log('  около нуля — источники независимы и дополняют друг друга; сильный минус — измеряют одно');
}

// ── 5. чем отличается просмотренное участником ────────────────────────────────
const own = new Set<string>();
for (const { key, work } of worksIndex()) if (work.id.startsWith('u-') || work.id.startsWith('l-')) own.add(key);
const mine = films.filter((f) => own.has(f.key));
const rest = films.filter((f) => !own.has(f.key));
console.log('\n=== чем просмотренное участником отличается от справочника ===');
console.log(`своих ${mine.length}, остальных ${rest.length}`);
if (mine.length >= 25) {
  const diff = tags.map((t, i) => ({ t, d: mean(mine.map((f) => zOf(f, i))) - mean(rest.map((f) => zOf(f, i))) }))
    .sort((a, b) => b.d - a.d);
  console.log('  сильнее обычного:', diff.slice(0, 12).map((x) => `${x.t} +${x.d.toFixed(2)}`).join(', '));
  console.log('  слабее обычного: ', diff.slice(-12).reverse().map((x) => `${x.t} ${x.d.toFixed(2)}`).join(', '));
  console.log('  (описание, не проверка: теги здесь отобраны по величине разницы)');
}

// ── 6. регистры ───────────────────────────────────────────────────────────────
const keyById = new Map<string, string>();
for (const { key, work } of worksIndex()) keyById.set(work.id, key);
const regOf = new Map<string, string[]>();
for (const [id, regs] of Object.entries(workRegisters)) {
  const key = keyById.get(id);
  if (key && byKey.has(key)) regOf.set(key, regs);
}
console.log('\n=== регистры в пространстве тегов ===');
const withReg = films.filter((f) => regOf.get(f.key)?.length);
console.log(`фильмов с регистром: ${withReg.length}`);
if (withReg.length >= 50) {
  const rand = rng(41);
  const same: number[] = [];
  const other: number[] = [];
  for (let i = 0; i < 20000; i++) {
    const a = withReg[Math.floor(rand() * withReg.length)];
    const b = withReg[Math.floor(rand() * withReg.length)];
    if (a === b) continue;
    const shared = regOf.get(a.key)!.some((r) => regOf.get(b.key)!.includes(r));
    (shared ? same : other).push(cos(a, b));
  }
  console.log(`  пары с общим регистром: ${same.length}, сходство ${mean(same).toFixed(3)}`);
  console.log(`  пары с разными:         ${other.length}, сходство ${mean(other).toFixed(3)}`);
}
