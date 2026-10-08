// Очередь для листа «Корпус» (05.10): куда приносить ссылки, чтобы их увидели. Середина шкалы —
// уровень 4–6 по разметке (умное массовое и авторское с доступным входом): у неё видимое эссе есть
// у 55% фильмов против 25% у массового, и это то, ради чего приложение, — шаг чуть сложнее привычного
// с разбором, который его объясняет. Из середины — фильмы, которые люди правда смотрели (присланные
// профили Кинопоиска и история владельца), а видимого эссе (не обзора) у них нет.
//
//   npx tsx tools/corpus-queue.mts [--top 40]   → .cache/corpus-queue.json и .tsv
//
// Две части, потому что лечатся по-разному:
//   · «нет ни одного ролика» — нужны ссылки (лист «Корпус», пульт ссылок);
//   · «есть только обзоры» — ссылки не помогут: решает ярус каналов (вкладка «Каналы» пульта),
//     рядом названы каналы, чьи ролики там лежат.
// Порядок — спрос: сколько людей из профилей видели (вес 1 за человека) плюс узнаваемость
// (просмотры статьи в Википедии и зрители Trakt, .cache/attention.json, в логарифме).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { draftAnnotations } from '../src/mocks/draftAnnotations.ts';
import { userAnnotations } from '../src/mocks/userAnnotations.ts';
import { draftReview } from '../src/mocks/draftReview.ts';
import { userWorks } from '../src/mocks/userHistory.ts';
import { watchedWorks } from '../src/mocks/userWatched.ts';
import { externalIds } from '../src/mocks/externalIds.ts';
import { essays } from '../src/mocks/essays.ts';
import { worksIndex } from './works-index.mts';
import type { ExternalAnalysis, WorkCard } from '../src/types/tmdf.ts';

const root = new URL('../', import.meta.url);
const read = <T,>(p: string, d: T): T => { try { return JSON.parse(readFileSync(new URL(p, root), 'utf8')) as T; } catch { return d; } };
const argv = process.argv.slice(2);
const TOP = Number(argv[argv.indexOf('--top') + 1]) || 40;
const LEVELS = [4, 6] as const;

// ─── разметка: уровень фильма ─────────────────────────────────────────────────
const tmdbOf = (w: WorkCard) => (w.externalIds ?? externalIds[w.id])?.tmdb;
const level = new Map<string, number>();
for (const [k, a] of Object.entries(draftAnnotations)) {
  if (a.confidence !== 'low' && draftReview[`draft:${k}`]?.status !== 'rejected') level.set(k, a.level);
}
for (const w of userWorks) {
  const a = userAnnotations[w.id];
  const t = tmdbOf(w);
  if (a && t != null && a.confidence !== 'low' && draftReview[`own:${w.id}`]?.status !== 'rejected') level.set(`tmdb:${t}`, a.level);
}

// ─── кто смотрел: история владельца и присланные профили ──────────────────────
const seenBy = new Map<string, Set<string>>();
const mark = (key: string, who: string) => (seenBy.get(key) ?? seenBy.set(key, new Set()).get(key)!).add(who);
for (const w of [...userWorks, ...watchedWorks]) { const t = tmdbOf(w); if (t != null) mark(`tmdb:${t}`, 'владелец'); }
const SEEDS = new URL('seeds/', root);
for (const f of existsSync(SEEDS) ? (await import('node:fs')).readdirSync(SEEDS).filter((x) => x.endsWith('.json')) : []) {
  const s = read<{ username?: string; watched?: { work: WorkCard }[]; ratings?: { work: WorkCard }[] }>(`seeds/${f}`, {});
  const who = s.username ?? f.replace(/\.json$/, '');
  for (const e of [...(s.watched ?? []), ...(s.ratings ?? [])]) { const t = e.work?.externalIds?.tmdb; if (t != null) mark(`tmdb:${t}`, who); }
}

// ─── что о фильме есть: видимые эссе и обзоры с каналами ──────────────────────
const src = readFileSync(new URL('src/mocks/essaysAuto.ts', root), 'utf8');
const auto = JSON.parse(src.slice(src.indexOf('= {') + 2, src.lastIndexOf(';'))) as Record<string, ExternalAnalysis[]>;
const materials = (k: string): ExternalAnalysis[] => [...(auto[k] ?? []), ...((essays as Record<string, ExternalAnalysis[]>)[k] ?? [])];
const attention = read<Record<string, { views?: number; trakt?: { watchers?: number } }>>('.cache/attention.json', {});
const titles = new Map(worksIndex({ all: true }).map((w) => [w.key, w.work]));

export interface QueueRow {
  key: string; title: string; year?: number; level: number; seenBy: string[];
  views: number; watchers: number; score: number;
  /** роликов-обзоров и чьи они (по убыванию) — у части «только обзоры» */
  reviews: number; reviewChannels: [string, number][];
}
const rows: QueueRow[] = [];
for (const [key, lv] of level) {
  if (lv < LEVELS[0] || lv > LEVELS[1]) continue;
  const people = seenBy.get(key);
  if (!people?.size) continue;
  const list = materials(key);
  if (list.some((a) => a.tier !== 'review')) continue;
  const w = titles.get(key);
  const at = attention[key];
  const views = at?.views ?? 0, watchers = at?.trakt?.watchers ?? 0;
  const ch = new Map<string, number>();
  for (const a of list) ch.set(a.author, (ch.get(a.author) ?? 0) + 1);
  rows.push({
    key, title: w?.title ?? key, ...(w?.year ? { year: w.year } : {}), level: lv, seenBy: [...people],
    views, watchers, score: Math.round((people.size + Math.log10(views + 1) / 6 + Math.log10(watchers + 1) / 6) * 100) / 100,
    reviews: list.length, reviewChannels: [...ch].sort((a, b) => b[1] - a[1]),
  });
}
rows.sort((a, b) => b.score - a.score);
const empty = rows.filter((r) => !r.reviews);
const reviewsOnly = rows.filter((r) => r.reviews);

writeFileSync(new URL('.cache/corpus-queue.json', root), JSON.stringify({ at: new Date().toISOString(), levels: LEVELS, empty, reviewsOnly }, null, 1));
const tsv = ['часть\tфильм\tгод\tуровень\tвидели\tпросмотров Википедии\tзрителей Trakt\tобзоров\tканалы обзоров',
  ...[...empty.map((r) => ['нет роликов', r] as const), ...reviewsOnly.map((r) => ['только обзоры', r] as const)].map(([part, r]) =>
    [part, r.title, r.year ?? '', r.level, r.seenBy.join(', '), r.views, r.watchers, r.reviews, r.reviewChannels.map(([c, n]) => `${c} ×${n}`).join('; ')].join('\t'))];
writeFileSync(new URL('.cache/corpus-queue.tsv', root), tsv.join('\n') + '\n');

const line = (r: QueueRow) => `  ${`${r.title}${r.year ? ` (${r.year})` : ''}`.padEnd(46)} ур. ${r.level} · видели: ${r.seenBy.join(', ')}${r.reviews ? ` · обзоры: ${r.reviewChannels.slice(0, 3).map(([c, n]) => `${c}${n > 1 ? ` ×${n}` : ''}`).join(', ')}` : ''}`;
console.log(`середина (уровень ${LEVELS[0]}–${LEVELS[1]}), видели люди из профилей, видимого эссе нет: ${rows.length}`);
console.log(`\nнет ни одного ролика — нужны ссылки (${empty.length}), первые ${Math.min(TOP, empty.length)}:`);
for (const r of empty.slice(0, TOP)) console.log(line(r));
console.log(`\nесть только обзоры — решает ярус каналов (${reviewsOnly.length}), первые ${Math.min(TOP, reviewsOnly.length)}:`);
for (const r of reviewsOnly.slice(0, TOP)) console.log(line(r));
const chAll = new Map<string, number>();
for (const r of reviewsOnly) for (const [c, n] of r.reviewChannels) chAll.set(c, (chAll.get(c) ?? 0) + n);
console.log(`\nканалы, чьи обзоры лежат у этих фильмов (кого посмотреть во вкладке «Каналы» первым):`);
console.log(`  ${[...chAll].sort((a, b) => b[1] - a[1]).slice(0, 20).map(([c, n]) => `${c} ${n}`).join(' · ')}`);
console.log('\n→ .cache/corpus-queue.json, .cache/corpus-queue.tsv');
