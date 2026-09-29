// Замер индекса разборов (трек В): сколько фильмов с материалом авторов и какая доля привязок
// не подтверждена. Цели трека: фильмов с материалом — вдвое больше, неподтверждённых — меньше
// половины. Читает то, что лежит в src/mocks (присланное вручную, ролики, посты), или
// переданные JSON-файлы индексов (как их публикует tools/publish-reference.mts).
//   npx tsx tools/voices-report.mts
import { essays } from '../src/mocks/essays.ts';
import { essaysAuto } from '../src/mocks/essaysAuto.ts';
import { postsAuto } from '../src/mocks/postsAuto.ts';
import type { ExternalAnalysis } from '../src/types/tmdf.ts';

const all: Record<string, ExternalAnalysis[]> = {};
for (const src of [essays, essaysAuto, postsAuto]) for (const [k, v] of Object.entries(src)) all[k] = [...(all[k] ?? []), ...v];
const items = Object.values(all).flat();
const works = Object.keys(all);
const confirmed = (a: ExternalAnalysis) => !a.unverified;
const byEvidence: Record<string, number> = {};
for (const a of items) {
  const k = a.unverified ? 'не подтверждено' : a.evidence ? `улика: ${a.evidence}` : 'вручную';
  byEvidence[k] = (byEvidence[k] ?? 0) + 1;
}
const byAuthor = new Map<string, { n: number; ok: number }>();
for (const a of items) {
  const r = byAuthor.get(a.author) ?? { n: 0, ok: 0 };
  r.n += 1; if (confirmed(a)) r.ok += 1;
  byAuthor.set(a.author, r);
}
const pct = (x: number, n: number) => (n ? `${Math.round((x / n) * 100)}%` : '—');
console.log(`# Индекс разборов — ${new Date().toISOString().slice(0, 10)}\n`);
console.log(`Фильмов с материалом: **${works.length}**, из них с подтверждённым: ${works.filter((k) => all[k].some(confirmed)).length}.`);
console.log(`Материалов: ${items.length}; не подтверждено: **${items.filter((a) => a.unverified).length} (${pct(items.filter((a) => a.unverified).length, items.length)})** — цель трека: меньше 50%.\n`);
console.log('| чем подтверждено | материалов |\n|---|---|');
for (const [k, v] of Object.entries(byEvidence).sort((a, b) => b[1] - a[1])) console.log(`| ${k} | ${v} |`);
console.log('\n| автор | материалов | подтверждено |\n|---|---|---|');
for (const [a, r] of [...byAuthor].sort((x, y) => y[1].n - x[1].n).slice(0, 30)) console.log(`| ${a} | ${r.n} | ${pct(r.ok, r.n)} |`);
