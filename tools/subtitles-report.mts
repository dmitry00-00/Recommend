// Что дают метрики формы, посчитанные по субтитрам, — замер, а не генератор.
//   npx tsx tools/subtitles-report.mts
// Вход — .cache/subtitle-metrics.json (tools/build-subtitle-metrics.mts).
// Проверяем не «красиво ли выглядит», а четыре вещи: сколько в метрике шума, ложится ли она
// на разметку руками, согласуется ли с графом соупоминаний и отличается ли ею то,
// что участник смотрит, от справочника.
import { readFileSync } from 'node:fs';
import { comentions } from '../src/mocks/comentions.ts';
import { workRegisters } from '../src/mocks/workRegisters.ts';
import { worksIndex } from './works-index.mts';

interface Row {
  key: string; title: string; year?: number; minutes?: number; marked: boolean; files: number;
  wpm: number; speechShare: number; meanCueSec: number; wordsPerCue: number;
  gap30Share: number; meanWordLen: number; ttr: number; rareShare: number; spanMin: number;
  wpmSpread: number | null;
}
const metrics: Record<string, Row> = JSON.parse(readFileSync(new URL('../.cache/subtitle-metrics.json', import.meta.url), 'utf8'));
const rows = Object.values(metrics);
const byKey = new Map(rows.map((r) => [r.key, r]));
const AXES = ['wpm', 'speechShare', 'meanCueSec', 'wordsPerCue', 'gap30Share', 'meanWordLen', 'ttr', 'rareShare'] as const;
type Axis = typeof AXES[number];

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const sd = (xs: number[]) => Math.sqrt(mean(xs.map((x) => (x - mean(xs)) ** 2)));

/** Воспроизводимость важнее скорости: один и тот же прогон должен давать одни и те же числа. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

console.log(`фильмов с метриками: ${rows.length}`);

// ── 1. сколько из метрики — шум ───────────────────────────────────────────────
// Один фильм в корпусе лежит в нескольких переводах. Расхождение между ними — это шум
// измерения: разные рипы, разные переводчики. Расхождение между фильмами — это сигнал.
const spreads = rows.map((r) => r.wpmSpread).filter((x): x is number => x != null);
console.log('\n=== шум измерения ===');
console.log(`фильмов с 2–3 переводами: ${spreads.length}`);
console.log(`расхождение wpm между переводами одного фильма: медиана ${median(spreads).toFixed(1)}, 90-й процентиль ${[...spreads].sort((a, b) => a - b)[Math.floor(0.9 * spreads.length)].toFixed(1)}`);
console.log(`разброс wpm между фильмами (ст. отклонение): ${sd(rows.map((r) => r.wpm)).toFixed(1)}`);

// ── 2. ложится ли на разметку руками ──────────────────────────────────────────
const levels = new Map<string, number>();
for (const { key, work } of worksIndex()) if (work.complexityLevel) levels.set(key, work.complexityLevel);
const marked = rows.filter((r) => levels.has(r.key)).map((r) => ({ r, level: levels.get(r.key)! }));

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
/** p считаем перестановкой, а не таблицей: выборка мелкая и связанных рангов много. */
function permP(a: number[], b: number[], runs = 20000, seed = 7): number {
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
  return (worse + 1) / (runs + 1);
}

console.log('\n=== против разметки руками ===');
console.log(`фильмов с проставленным уровнем сложности: ${marked.length}`);
if (marked.length >= 10) {
  const lv = marked.map((m) => m.level);
  for (const axis of AXES) {
    const xs = marked.map((m) => m.r[axis]);
    const rho = spearman(lv, xs);
    const p = permP(lv, xs);
    const mark = p < 0.05 ? ' ←' : '';
    console.log(`  ${axis.padEnd(12)} ρ = ${rho >= 0 ? ' ' : ''}${rho.toFixed(2)}   p = ${p < 0.001 ? '<0.001' : p.toFixed(3)}${mark}`);
  }
  // Осей восемь, значит и порогов восемь: одиночное p = 0.04 при восьми проверках
  // ничего не доказывает. Честный порог по Холму — 0.05/8.
  console.log(`  порог с поправкой на 8 проверок (Холм): ${(0.05 / AXES.length).toFixed(4)}`);
  const by = new Map<number, Row[]>();
  for (const m of marked) by.set(m.level, [...(by.get(m.level) ?? []), m.r]);
  console.log('  по уровням (медианы):');
  for (const level of [...by.keys()].sort((a, b) => a - b)) {
    const g = by.get(level)!;
    console.log(`    ${level}: ${String(g.length).padStart(2)} фильм(ов)  wpm ${median(g.map((r) => r.wpm)).toFixed(0).padStart(3)}  редких ${(100 * median(g.map((r) => r.rareShare))).toFixed(0)}%  пауз>30с ${(100 * median(g.map((r) => r.gap30Share))).toFixed(0)}%`);
  }
}

// ── 3. согласие с графом соупоминаний ─────────────────────────────────────────
// Независимый источник: русские телеграм-каналы. Если фильмы, которые называют в одном
// посте, ещё и похожи по форме — метрика ловит что-то настоящее, а не артефакт перевода.
const z = new Map<Axis, { m: number; s: number }>();
for (const axis of AXES) z.set(axis, { m: mean(rows.map((r) => r[axis])), s: sd(rows.map((r) => r[axis])) || 1 });
const vec = (r: Row) => AXES.map((a) => (r[a] - z.get(a)!.m) / z.get(a)!.s);
const dist = (a: Row, b: Row) => {
  const [x, y] = [vec(a), vec(b)];
  return Math.sqrt(x.reduce((s, v, i) => s + (v - y[i]) ** 2, 0));
};

const pairs: [Row, Row][] = [];
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
console.log(`пар, у обоих концов которых есть метрики: ${pairs.length}`);
if (pairs.length >= 30) {
  const observed = mean(pairs.map(([a, b]) => dist(a, b)));
  // Нулевая гипотеза строгая: те же самые фильмы, но связи переставлены случайно —
  // так поправка на «в графе вообще другие фильмы» уже учтена.
  const pool = [...new Set(pairs.flat())];
  const rand = rng(11);
  let runs = 20000, worse = 0;
  const nulls: number[] = [];
  for (let i = 0; i < runs; i++) {
    let sum = 0;
    for (let k = 0; k < pairs.length; k++) {
      const a = pool[Math.floor(rand() * pool.length)];
      let b = pool[Math.floor(rand() * pool.length)];
      while (b === a) b = pool[Math.floor(rand() * pool.length)];
      sum += dist(a, b);
    }
    const d = sum / pairs.length;
    nulls.push(d);
    if (d <= observed) worse++;
  }
  console.log(`расстояние по форме у названных вместе: ${observed.toFixed(3)}`);
  console.log(`у случайной пары из тех же ${pool.length} фильмов: ${mean(nulls).toFixed(3)}`);
  console.log(`p = ${worse === 0 ? `<${(1 / runs).toExponential(0)}` : ((worse + 1) / (runs + 1)).toFixed(4)} (${runs} перестановок)`);
}

// ── 4. что смотрит участник ───────────────────────────────────────────────────
// Если у просмотренного участником форма не такая, как у справочника, метрика годится
// для подбора: она описывает вкус, а не только фильм.
const own = new Set<string>();
for (const { key, work } of worksIndex()) if (work.id.startsWith('u-') || work.id.startsWith('l-')) own.add(key);
const mine = rows.filter((r) => own.has(r.key));
const rest = rows.filter((r) => !own.has(r.key));
console.log('\n=== просмотренное участником против справочника ===');
console.log(`своих ${mine.length}, остальных ${rest.length}`);
if (mine.length >= 30) {
  for (const axis of AXES) {
    const a = median(mine.map((r) => r[axis]));
    const b = median(rest.map((r) => r[axis]));
    const pooled = sd(rows.map((r) => r[axis])) || 1;
    const d = (a - b) / pooled;
    console.log(`  ${axis.padEnd(12)} своё ${a.toFixed(3).padStart(8)}  справочник ${b.toFixed(3).padStart(8)}  сдвиг ${d >= 0 ? '+' : ''}${d.toFixed(2)} σ${Math.abs(d) > 0.2 ? ' ←' : ''}`);
  }
}

// ── 5. регистр ────────────────────────────────────────────────────────────────
const keyById = new Map<string, string>();
for (const { key, work } of worksIndex()) keyById.set(work.id, key);
const byRegister = new Map<string, Row[]>();
for (const [id, regs] of Object.entries(workRegisters)) {
  const r = byKey.get(keyById.get(id) ?? '');
  if (!r) continue;
  for (const reg of regs) byRegister.set(reg, [...(byRegister.get(reg) ?? []), r]);
}
console.log('\n=== по тональным регистрам ===');
const big = [...byRegister.entries()].filter(([, g]) => g.length >= 15).sort((a, b) => b[1].length - a[1].length);
for (const [reg, g] of big.slice(0, 8)) {
  console.log(`  ${reg.padEnd(16)} ${String(g.length).padStart(3)} фильм.  wpm ${median(g.map((r) => r.wpm)).toFixed(0).padStart(3)}  редких ${(100 * median(g.map((r) => r.rareShare))).toFixed(0)}%  пауз>30с ${(100 * median(g.map((r) => r.gap30Share))).toFixed(0)}%`);
}
