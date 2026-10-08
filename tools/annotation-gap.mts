// Произведения без разметки для подбора (04.10). Подбор (src/lib/model/recommend.ts) ставит
// кандидату 0, если у него нет уровня и операций, — такой фильм не попадёт в ленту, сколько бы о нём
// ни говорили. Здесь — кто из известных нам произведений остался без разметки и какой у него вес
// записей (src/lib/weights.ts: ролики и посты о нём с поправкой на доверие и насыщение по каналу):
// размечать стоит сначала тех, о ком говорят.
//
//   npx tsx tools/annotation-gap.mts             сводка и первые 40 → .cache/annotation-gap.json
//   npx tsx tools/annotation-gap.mts --top 200   показать больше
//
// Разметкой считается то же, что в приложении: каталог и пул с операциями, первичная разметка
// истории владельца, черновики фильмов, сериалов и книг (кроме отклонённых куратором), калибровка книг.
// Черновик с уверенностью low есть, но в подбор не идёт — он посчитан отдельно.
import { writeFileSync } from 'node:fs';
import { worksIndex } from './works-index.mts';
import { draftAnnotations } from '../src/mocks/draftAnnotations.ts';
import { userAnnotations } from '../src/mocks/userAnnotations.ts';
import { seriesAnnotations } from '../src/mocks/seriesAnnotations.ts';
import { bookAnnotations } from '../src/mocks/bookAnnotations.ts';
import { bookDrafts } from '../src/mocks/bookDrafts.ts';
import { draftReview } from '../src/mocks/draftReview.ts';
import { userWorks } from '../src/mocks/userHistory.ts';
import { externalIds } from '../src/mocks/externalIds.ts';
import { essays } from '../src/mocks/essays.ts';
import { essaysAuto } from '../src/mocks/essaysAuto.ts';
import { postsAuto } from '../src/mocks/postsAuto.ts';
import { recordTrust } from '../src/mocks/recordTrust.ts';
import { weightOf } from '../src/lib/weights.ts';
import { isSeries } from '../src/lib/media.ts';
import type { ExternalAnalysis } from '../src/types/tmdf.ts';

export const GAP_FILE = '.cache/annotation-gap.json';
export interface GapRow { key: string; title: string; year?: number; original?: string; creators?: string[]; kind: 'film' | 'series' | 'book'; records: number; channels: number; weight: number }
export interface Gap {
  at: string;
  /** по видам: всего, размечено (идёт в подбор), черновик low (не идёт), без разметки, из них с материалами */
  totals: Record<'film' | 'series' | 'book', { all: number; annotated: number; low: number; missing: number; missingWithRecords: number }>;
  /** без разметки, но с материалами — по убыванию веса */
  rows: GapRow[];
}

const rejected = (id: string) => draftReview[id]?.status === 'rejected';
const own = new Map<string, string>();
for (const w of userWorks) {
  const tmdb = (w.externalIds ?? externalIds[w.id])?.tmdb;
  if (tmdb != null && userAnnotations[w.id] && !rejected(`own:${w.id}`)) own.set(`tmdb:${tmdb}`, userAnnotations[w.id].confidence);
}
const records = new Map<string, ExternalAnalysis[]>();
for (const src of [essays, essaysAuto, postsAuto] as Record<string, ExternalAnalysis[]>[]) {
  for (const [k, list] of Object.entries(src)) {
    const have = records.get(k) ?? records.set(k, []).get(k)!;
    for (const a of list) if (!have.some((x) => x.url === a.url)) have.push(a);
  }
}
const voice = (a: ExternalAnalysis) => /^tg-([^-]+)-/.exec(a.id)?.[1] ?? a.author;

export function annotationGap(): Gap {
  const totals = Object.fromEntries((['film', 'series', 'book'] as const).map((k) => [k, { all: 0, annotated: 0, low: 0, missing: 0, missingWithRecords: 0 }])) as Gap['totals'];
  const rows: GapRow[] = [];
  const seen = new Set<string>();
  for (const x of worksIndex({ all: true })) {
    if (seen.has(x.key)) continue;
    seen.add(x.key);
    const kind = x.work.type === 'book' ? 'book' : isSeries(x.work) ? 'series' : 'film';
    // уверенность разметки: undefined — разметки нет
    const conf = x.work.primaryOperations.length && x.work.complexityLevel ? 'high'
      : kind === 'book' ? (bookAnnotations[x.key] ?? (rejected(`draft:${x.key}`) ? undefined : bookDrafts[x.key]))?.confidence
      : kind === 'series' ? (rejected(`draft:${x.key}`) ? undefined : seriesAnnotations[x.key]?.confidence)
      : own.get(x.key) ?? (rejected(`draft:${x.key}`) ? undefined : draftAnnotations[x.key]?.confidence);
    const t = totals[kind];
    t.all++;
    if (conf === 'low') { t.low++; continue; }
    if (conf) { t.annotated++; continue; }
    t.missing++;
    const list = records.get(x.key) ?? [];
    if (!list.length) continue;
    t.missingWithRecords++;
    rows.push({
      key: x.key, title: x.work.title, ...(x.work.year ? { year: x.work.year } : {}),
      ...(x.work.originalTitle && x.work.originalTitle !== x.work.title ? { original: x.work.originalTitle } : {}),
      ...(x.work.creators?.length ? { creators: x.work.creators.slice(0, 3) } : {}),
      kind, records: list.length, channels: new Set(list.map(voice)).size,
      weight: Math.round(weightOf(list, voice, { trust: recordTrust }) * 100) / 100,
    });
  }
  rows.sort((a, b) => b.weight - a.weight);
  return { at: new Date().toISOString(), totals, rows };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const argv = process.argv.slice(2);
  const top = Number(argv[argv.indexOf('--top') + 1]) || 40;
  const g = annotationGap();
  writeFileSync(GAP_FILE, JSON.stringify(g));
  for (const [k, t] of Object.entries(g.totals)) {
    console.log(`${k.padEnd(7)} всего ${t.all}, размечено ${t.annotated}, черновик low ${t.low}, без разметки ${t.missing} (с материалами ${t.missingWithRecords})`);
  }
  for (const th of [5, 2, 1, 0.5]) console.log(`  без разметки с весом от ${th}: ${g.rows.filter((r) => r.weight >= th).length}`);
  for (const r of g.rows.slice(0, top)) console.log(`${r.weight.toFixed(1).padStart(6)} ${String(r.records).padStart(4)} ${r.kind.padEnd(6)} ${r.key.padEnd(14)} ${r.title}${r.year ? ` (${r.year})` : ''}${r.original ? ` / ${r.original}` : ''}`);
  console.log(`без разметки с материалами: ${g.rows.length} → ${GAP_FILE}`);
}
