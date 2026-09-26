// Что даёт корпус пересказов — замер, а не генератор.
//   npx tsx tools/cmu-report.mts [путь к папке MovieSummaries]
// Вход — .cache/cmu-summaries.json (tools/cmu-summaries.mts) и, если есть, замеры формы
// по субтитрам и Tag Genome. Вопрос простой: пересказ сюжета — это про то, ЧТО происходит;
// наша дыра — про то, СКОЛЬКО произведение требует. Пересекаются ли они вообще.
import { createReadStream, existsSync, readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { worksIndex } from './works-index.mts';

const dir = process.argv[2] ?? new URL('../.cache/cmu/MovieSummaries', import.meta.url).pathname;
interface Row { wikiId: string; title: string; year: number; chars: number; text: string }
const cmu: Record<string, Row> = JSON.parse(readFileSync(new URL('../.cache/cmu-summaries.json', import.meta.url), 'utf8'));
const keys = Object.keys(cmu);
console.log(`фильмов с пересказом: ${keys.length}`);

// сколько в фильме названных действующих лиц — этого субтитры не дают вовсе
const cast = new Map<string, number>();
if (existsSync(`${dir}/character.metadata.tsv`)) {
  const rl = createInterface({ input: createReadStream(`${dir}/character.metadata.tsv`, 'utf8'), crlfDelay: Infinity });
  for await (const line of rl) {
    const c = line.split('\t');
    if (c.length < 4 || !c[3]) continue;
    cast.set(c[0], (cast.get(c[0]) ?? 0) + 1);
  }
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
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
function rng(seed: number) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); }
function permP(a: number[], b: number[], runs = 20000, seed = 5): string {
  const observed = Math.abs(spearman(a, b));
  const rand = rng(seed);
  const sh = [...b];
  let worse = 0;
  for (let i = 0; i < runs; i++) {
    for (let j = sh.length - 1; j > 0; j--) { const k = Math.floor(rand() * (j + 1)); [sh[j], sh[k]] = [sh[k], sh[j]]; }
    if (Math.abs(spearman(a, sh)) >= observed) worse++;
  }
  return worse === 0 ? `<${(1 / runs).toExponential(0)}` : ((worse + 1) / (runs + 1)).toFixed(4);
}

/** Признаки пересказа: сам текст остаётся в .cache, наружу идут только числа. */
const features = new Map<string, { chars: number; sentences: number; names: number; cast: number }>();
for (const key of keys) {
  const r = cmu[key];
  const sentences = (r.text.match(/[.!?]+\s/g) ?? []).length + 1;
  // имя собственное — слово с большой буквы не в начале предложения
  const names = new Set((r.text.match(/(?<![.!?]\s)(?<!^)\b[A-Z][a-z]{2,}\b/g) ?? [])).size;
  features.set(key, { chars: r.chars, sentences, names, cast: cast.get(r.wikiId) ?? 0 });
}
const f = (k: string) => features.get(k)!;
console.log(`длина: медиана ${median(keys.map((k) => f(k).chars))} знаков | предложений ${median(keys.map((k) => f(k).sentences))}`);
console.log(`имён в пересказе: медиана ${median(keys.map((k) => f(k).names))} | ролей в базе: медиана ${median(keys.map((k) => f(k).cast))}`);

// ── против разметки руками ────────────────────────────────────────────────────
const levels = new Map<string, number>();
for (const { key, work } of worksIndex()) if (work.complexityLevel) levels.set(key, work.complexityLevel);
const marked = keys.filter((k) => levels.has(k));
console.log(`\n=== против разметки руками ===`);
console.log(`фильмов с проставленным уровнем и пересказом: ${marked.length}`);
if (marked.length >= 10) {
  const lv = marked.map((k) => levels.get(k)!);
  for (const axis of ['chars', 'sentences', 'names', 'cast'] as const) {
    const xs = marked.map((k) => f(k)[axis]);
    console.log(`  ${axis.padEnd(10)} ρ = ${spearman(lv, xs).toFixed(2)}  p = ${permP(lv, xs)}`);
  }
}

// ── несёт ли пересказ что-то о форме ──────────────────────────────────────────
let form: Record<string, { key: string; wpm: number; gap30Share: number; spanMin: number }> = {};
try { form = JSON.parse(readFileSync(new URL('../.cache/subtitle-metrics.json', import.meta.url), 'utf8')); } catch { /* нет замера */ }
const byForm = new Map(Object.values(form).map((r) => [r.key, r]));
const both = keys.filter((k) => byForm.has(k));
console.log(`\n=== пересказ против формы по субтитрам ===`);
console.log(`фильмов, где есть и то и другое: ${both.length}`);
if (both.length >= 50) {
  for (const axis of ['chars', 'names', 'cast'] as const) {
    for (const [label, pick] of [['слов в минуту', (k: string) => byForm.get(k)!.wpm],
      ['доля долгих пауз', (k: string) => byForm.get(k)!.gap30Share]] as [string, (k: string) => number][]) {
      const a = both.map((k) => f(k)[axis]);
      const b = both.map(pick);
      console.log(`  ${axis.padEnd(8)} ↔ ${label.padEnd(17)} ρ = ${spearman(a, b).toFixed(2)}  p = ${permP(a, b)}`);
    }
  }
}

// ── и против «нагрузки» по тегам ──────────────────────────────────────────────
try {
  const tg: { tags: string[]; films: Record<string, { key: string; scores: number[] }> } =
    JSON.parse(readFileSync(new URL('../.cache/taggenome.json', import.meta.url), 'utf8'));
  const LOAD = ['thought-provoking', 'cerebral', 'confusing', 'complicated', 'complex',
    'philosophical', 'intellectual', 'nonlinear', 'non-linear', 'multiple storylines',
    'allegory', 'mindfuck', 'surreal'];
  const at = new Map(tg.tags.map((t, i) => [t, i]));
  const films = Object.values(tg.films);
  const col = tg.tags.map((_, i) => films.map((x) => x.scores[i]));
  const mu = col.map(mean);
  const sg = col.map((c) => Math.sqrt(mean(c.map((x) => (x - mean(c)) ** 2))) || 1);
  const load = new Map(films.map((x) => [x.key, mean(LOAD.filter((t) => at.has(t)).map((t) => (x.scores[at.get(t)!] - mu[at.get(t)!]) / sg[at.get(t)!]))]));
  const common = keys.filter((k) => load.has(k));
  console.log(`\n=== пересказ против «нагрузки» по тегам ===`);
  console.log(`фильмов: ${common.length}`);
  if (common.length >= 50) {
    for (const axis of ['chars', 'names', 'cast'] as const) {
      const a = common.map((k) => f(k)[axis]);
      const b = common.map((k) => load.get(k)!);
      console.log(`  ${axis.padEnd(8)} ↔ «нагрузка»  ρ = ${spearman(a, b).toFixed(2)}  p = ${permP(a, b)}`);
    }
  }
} catch { console.log('\n(Tag Genome не собран — пропускаем)'); }
