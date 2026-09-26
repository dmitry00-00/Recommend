// Что даёт присланный списком просмотренное (src/mocks/userWatched.ts) — и работает ли ось
// регистра. Список — не «любимое»: оценок в нём нет, большая часть где-то на 7 из 10. Поэтому
// он проверяет две вещи: насколько выгрузка с оценками вообще покрывает просмотренное, и
// предсказывает ли регистр оценки там, где они есть.
//   TAGS_CACHE=/…/tmdb-tags.json npx tsx tools/watched-report.mts
import { userJournal } from '../src/mocks/userHistory.ts';
import { userAnnotations } from '../src/mocks/userAnnotations.ts';
import { userRatings } from '../src/mocks/userRatings.ts';
import { watchedWorks } from '../src/mocks/userWatched.ts';
import { workRegisters } from '../src/mocks/workRegisters.ts';
import { candidateSeeds, seedToCard } from '../src/mocks/candidates.ts';
import { registerBase } from '../src/mocks/registerBase.ts';
import { deriveRegisterTaste, deriveScale, deriveState, type RatedEntry } from '../src/lib/model/deriveState.ts';
import { recommend, scoreCandidate, type ScoreWeights } from '../src/lib/model/recommend.ts';
import { registers } from '../src/lib/registers.ts';
import type { Register, WorkCard } from '../src/types/tmdf.ts';

const reg = (w: WorkCard): WorkCard => ({ ...w, registers: w.registers ?? workRegisters[w.id] });
const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9]+/g, ' ').trim();
const keysOf = (w: WorkCard): string[] => [
  w.externalIds?.tmdb != null && `tmdb:${w.externalIds.tmdb}`,
  w.externalIds?.imdb && `imdb:${w.externalIds.imdb}`,
  `t:${norm(w.title)}|${w.year}`,
].filter((k): k is string => Boolean(k));
const listKeys = new Set(watchedWorks.flatMap(keysOf));
const inList = (w: WorkCard) => keysOf(w).some((k) => listKeys.has(k));

const entries: RatedEntry[] = userJournal.map((e) => {
  const a = userAnnotations[e.work.id];
  const work = reg(a ? { ...e.work, primaryOperations: a.ops.map(([op, intensity]) => ({ op, intensity })), complexityLevel: a.level, barriers: a.barriers, warnings: a.warnings, isNicheMasterpiece: a.niche } : e.work);
  return { ...e, work, rating: userRatings[e.work.id]?.rating, raw: userRatings[e.work.id]?.raw };
});
const outside = watchedWorks.map(reg).filter((w) => !entries.some((e) => keysOf(e.work).some((k) => keysOf(w).includes(k))));
console.log(`выгрузка с оценками: ${entries.length}; список: ${watchedWorks.length}; из списка нет в выгрузке: ${outside.length}`);
console.log(`то есть выгрузка покрывает ${(100 * (watchedWorks.length - outside.length) / watchedWorks.length).toFixed(0)}% того, что участник назвал просмотренным\n`);

// 1. Профиль регистров: выгрузка против списка.
const profile = (ws: WorkCard[]) => {
  const c: Partial<Record<Register, number>> = {};
  for (const w of ws) for (const r of w.registers ?? []) c[r] = (c[r] ?? 0) + 1;
  return c;
};
const pExport = profile(entries.map((e) => e.work));
const pList = profile(outside);
console.log('регистр:'.padEnd(20), 'выгрузка   список (то, чего в выгрузке нет)');
for (const r of Object.keys(registers) as Register[]) {
  const a = (pExport[r] ?? 0) / entries.length;
  const b = (pList[r] ?? 0) / Math.max(1, outside.length);
  console.log(`  ${registers[r].name.padEnd(18)} ${(a * 100).toFixed(0).padStart(4)}%     ${(b * 100).toFixed(0).padStart(4)}%${Math.abs(b - a) > 0.12 ? '   ←' : ''}`);
}

// 2. Шкала оценок: у каждого своя, поэтому «понравилось» считается от нормы участника.
const raws = entries.map((e) => e.raw).filter((r): r is number => r != null);
const stated = 7; // то, что участник назвал нормой сам
const derived = deriveScale(raws);
const own = deriveScale(raws, stated);
const dist: Record<number, number> = {};
for (const r of raws) dist[r] = (dist[r] ?? 0) + 1;
console.log(`\nоценки: ${Object.entries(dist).map(([k, v]) => `${k}→${v}`).join(' ')}`);
console.log(`норма: заявленная ${stated}, выведенная из распределения ${derived.norm} (${derived.source})`);
console.log(`вес наблюдения: ${Object.keys(dist).map(Number).sort((a, b) => a - b).map((r) => `${r}:${own.weight(r).toFixed(2)}`).join(' ')}`);

// 3. Предсказывает ли регистр оценки там, где они есть.
const rated = entries.filter((e) => e.raw != null);
console.log(`\nоценки есть у ${rated.length} работ выгрузки; средняя (0–10) по регистрам, норма участника — 7:`);
for (const r of Object.keys(registers) as Register[]) {
  const xs = rated.filter((e) => e.work.registers?.includes(r)).map((e) => e.raw!);
  if (xs.length >= 4) console.log(`  ${registers[r].name.padEnd(18)} ${(xs.reduce((s, x) => s + x, 0) / xs.length).toFixed(2)}  (n=${xs.length})`);
}

// 4. Проверка эвристики на оценках. Состояние строим вслепую к оценкам, иначе ответ подсмотрен.
const blind = entries.map((e) => ({ ...e, rating: undefined, raw: undefined }));

const variants: { name: string; taste: 'none' | 'export' | 'list' | 'both'; w: ScoreWeights }[] = [
  { name: 'уровень+операции (как было)', taste: 'none', w: { level: 0.55, ops: 0.45, register: 0 } },
  { name: 'плюс регистр из выгрузки', taste: 'export', w: { level: 0.4, ops: 0.3, register: 0.3 } },
  { name: 'плюс регистр из списка', taste: 'list', w: { level: 0.4, ops: 0.3, register: 0.3 } },
  { name: 'плюс регистр из обоих', taste: 'both', w: { level: 0.4, ops: 0.3, register: 0.3 } },
  { name: 'регистр в половину веса', taste: 'both', w: { level: 0.3, ops: 0.2, register: 0.5 } },
];
// Семёрка у участника — норма, а не «понравилось»: она из проверки выкинута, сравниваем края.
const pos = rated.filter((e) => e.raw! > own.norm);
const neg = rated.filter((e) => e.raw! < own.norm);
console.log(`\nразделяет ли оценка ${pos.length} «выше нормы» и ${neg.length} «ниже нормы» (сама норма не в счёт; AUC, 0.5 — монетка):`);
for (const v of variants) {
  const state = deriveState('u', blind, '2026-09-22')!;
  const seenFor = v.taste === 'none' ? [] : v.taste === 'export' ? blind.map((e) => e.work) : v.taste === 'list' ? outside : [...blind.map((e) => e.work), ...outside];
  state.registerTaste = seenFor.length ? deriveRegisterTaste(seenFor, registerBase) : undefined;
  const score = (e: RatedEntry) => scoreCandidate(state, e.work, 'normal', v.w);
  let wins = 0;
  for (const a of pos) for (const b of neg) { const d = score(a) - score(b); wins += d > 0 ? 1 : d === 0 ? 0.5 : 0; }
  console.log(`  ${v.name.padEnd(30)} AUC ${(wins / (pos.length * neg.length)).toFixed(3)}`);
}

// 5. Как выглядит слейт с учётом вкуса и без него.
const full = deriveState('u', entries, '2026-09-22', { alsoSeen: outside, base: registerBase, ratingNorm: stated })!;
console.log('\nвкус по регистру (из выгрузки и списка):');
for (const t of full.registerTaste ?? []) console.log(`  ${registers[t.register].name.padEnd(18)} ${t.affinity >= 0 ? '+' : ''}${t.affinity}  (n=${t.n})`);
const pool = candidateSeeds.map((s) => ({ work: reg(seedToCard(s)), what: s.what })).filter((c) => !inList(c.work));
console.log(`\nпул кандидатов после отсева просмотренного: ${pool.length} из ${candidateSeeds.length}`);
for (const [name, st] of [['без вкуса', { ...full, registerTaste: undefined }], ['с вкусом', full]] as const) {
  const slate = recommend(st, pool, 'normal', 6, '2026-09-22');
  console.log(`  ${name}: ${slate.map((r) => `${r.work.title} [${(r.work.registers ?? []).map((x) => registers[x].name).join('/')}]`).join(', ')}`);
}
