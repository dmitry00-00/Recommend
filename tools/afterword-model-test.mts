// Послесловия в модели (17.10): правила вопроса «Стоило ли?» (afterword.ts), ось «стоило», темп и «что держало»
// в подборе (worth.ts) — проверки и замер на истории владельца, как в model-test.
//   npx tsx tools/afterword-model-test.mts
import assert from 'node:assert/strict';
import { userJournal } from '../src/mocks/userHistory.ts';
import { userAnnotations } from '../src/mocks/userAnnotations.ts';
import { userRatings } from '../src/mocks/userRatings.ts';
import { candidateSeeds, seedToCard } from '../src/mocks/candidates.ts';
import { watchedWorks } from '../src/mocks/userWatched.ts';
import { workRegisters } from '../src/mocks/workRegisters.ts';
import { registerBase } from '../src/mocks/registerBase.ts';
import { draftAnnotations } from '../src/mocks/draftAnnotations.ts';
import { filmBase } from '../src/mocks/filmBase.ts';
import { filmBasePopular } from '../src/mocks/filmBasePopular.ts';
import { filmBaseCurated } from '../src/mocks/filmBaseCurated.ts';
import { filmBaseMarkup } from '../src/mocks/filmBaseMarkup.ts';
import { filmGenres } from '../src/mocks/filmGenres.ts';
import { workCredits } from '../src/mocks/workCredits.ts';
import { people } from '../src/mocks/people.ts';
import { decodeCredits, workKey } from '../src/lib/credits.ts';
import { deriveState } from '../src/lib/model/deriveState.ts';
import { recommend, scoreCandidate, type Candidate, type RecommendOptions } from '../src/lib/model/recommend.ts';
import { extraHistory, inferWorth, nextExtra, shouldAskWorth, stableUnit, type Score } from '../src/lib/model/afterword.ts';
import {
  afterwordBonus, afterwordSummary, deriveWorthProfile, hookTilt, pacePenalty, worthFit, worthKind, worthSignal,
  type AfterwordInput, type WorthEntry,
} from '../src/lib/model/worth.ts';
import type { Afterword, Energy, WorkCard } from '../src/types/tmdf.ts';

let passed = 0;
const test = (name: string, fn: () => void) => {
  try { fn(); passed += 1; console.log(`  ok  ${name}`); } catch (e) { console.log(`  FAIL ${name}`); throw e; }
};

// ---------- история владельца, как в model-test ----------
const reg = <T extends { id: string; registers?: string[] }>(w: T) => ({ ...w, registers: w.registers ?? workRegisters[w.id] });
/** авторы с элементом Wikidata — как карточкам подкладывает withCredits в src/api */
const credited = (w: WorkCard): WorkCard => { if (w.credits?.length) return w; const c = decodeCredits(workCredits[workKey(w) ?? ''], people); return c.length ? { ...w, credits: c } : w; };
const entries = userJournal.map((e) => {
  const a = userAnnotations[e.work.id];
  const work = a ? { ...e.work, primaryOperations: a.ops.map(([op, intensity]) => ({ op, intensity })), complexityLevel: a.level, isNicheMasterpiece: a.niche } : e.work;
  return { ...e, work: credited(reg(work) as WorkCard), rating: userRatings[e.work.id]?.rating };
});
const state = deriveState('u', entries, '2026-09-22', { alsoSeen: watchedWorks.map(reg), base: registerBase })!;
const seeds: Candidate[] = candidateSeeds.map((s) => ({ work: reg(seedToCard(s)) as WorkCard, what: s.what }));
const genresOf = (w: WorkCard): string[] => (w.externalIds?.tmdb != null ? filmGenres[`tmdb:${w.externalIds.tmdb}`] ?? [] : []);
const ENERGIES: Energy[] = ['low', 'normal', 'high'];
const none: AfterwordInput = { get: () => undefined, entries, genresOf };

console.log('\n== правила вопроса (afterword.ts)');
const idWith = (pred: (u: number) => boolean) => { for (let i = 0; ; i++) if (pred(stableUnit(`worth:w${i}`))) return `w${i}`; };
const rare = idWith((u) => u < 0.1);   // попадает в контрольную выборку
const plain = idWith((u) => u >= 0.1); // не попадает

test('stableUnit устойчив и в 0..1', () => {
  assert.equal(stableUnit('x'), stableUnit('x'));
  for (const k of ['a', 'b', 'worth:w1', 'длинный ключ']) { const u = stableUnit(k); assert.ok(u >= 0 && u < 1); }
});
test('«Нормально» — всегда', () => {
  assert.equal(shouldAskWorth({ rating: 3, workId: plain }), true);
  assert.equal(shouldAskWorth({ rating: 3, workLevel: 9, comfort: 2, workId: plain }), true);
});
test('«Хорошо/Отлично» — если вещь легче привычного на 1,5 и больше', () => {
  assert.equal(shouldAskWorth({ rating: 4, workLevel: 3, comfort: 5, workId: plain }), true);
  assert.equal(shouldAskWorth({ rating: 5, workLevel: 3.5, comfort: 5, workId: plain }), true, 'граница −1,5');
  assert.equal(shouldAskWorth({ rating: 5, workLevel: 4, comfort: 5, workId: plain }), false, 'разрыв −1 — не спрашиваем');
  assert.equal(shouldAskWorth({ rating: 4, workLevel: 8, comfort: 5, workId: plain }), false, 'сложная вещь с «Хорошо» — угадывается');
  assert.equal(shouldAskWorth({ rating: 4, fame: 3, workId: plain }), false, 'известность «Хорошо» не касается');
});
test('«Слабо/Мимо» — если вещь сложнее на 1,5 и больше или громкая', () => {
  assert.equal(shouldAskWorth({ rating: 2, workLevel: 7, comfort: 5, workId: plain }), true);
  assert.equal(shouldAskWorth({ rating: 1, workLevel: 6.5, comfort: 5, workId: plain }), true, 'граница +1,5');
  assert.equal(shouldAskWorth({ rating: 1, fame: 2, workId: plain }), true);
  assert.equal(shouldAskWorth({ rating: 2, fame: 3, workLevel: 2, comfort: 5, workId: plain }), true, 'громкое — даже лёгкое');
  assert.equal(shouldAskWorth({ rating: 2, fame: 1, workLevel: 5, comfort: 5, workId: plain }), false);
  assert.equal(shouldAskWorth({ rating: 2, workLevel: 3, comfort: 5, workId: plain }), false, 'лёгкое и «Мимо» — угадывается');
});
test('без уровня или комфорта разрыв — 0', () => {
  assert.equal(shouldAskWorth({ rating: 5, workLevel: 2, workId: plain }), false);
  assert.equal(shouldAskWorth({ rating: 1, comfort: 9, workId: plain }), false);
});
test('остальным — контрольная выборка ≈1 из 10, устойчиво по работе', () => {
  assert.equal(shouldAskWorth({ rating: 5, workId: rare }), true);
  assert.equal(shouldAskWorth({ rating: 1, workId: rare }), true);
  assert.equal(shouldAskWorth({ rating: 5, workId: plain }), false);
  let n = 0;
  for (let i = 0; i < 2000; i++) if (shouldAskWorth({ rating: 4, workId: `id-${i}` })) n += 1;
  assert.ok(n > 140 && n < 260, `доля ${n / 2000}`);
});
test('inferWorth: совпадает с оценкой, «Нормально» — неизвестно', () => {
  assert.equal(inferWorth(5), 4); assert.equal(inferWorth(4), 4);
  assert.equal(inferWorth(3), undefined);
  assert.equal(inferWorth(2), 2); assert.equal(inferWorth(1), 2);
});
test('nextExtra: темп и «держало» по очереди, не два раза подряд', () => {
  assert.equal(nextExtra(0, false), 'pace');
  assert.equal(nextExtra(1, false), 'hook');
  assert.equal(nextExtra(2, false), 'pace');
  assert.equal(nextExtra(0, true), null);
  assert.equal(nextExtra(5, true), null);
});
test('extraHistory: считает доп. вопросы, порядок по `at`, без `at` — мимо', () => {
  assert.deepEqual(extraHistory([]), { asked: 0, lastWasExtra: false });
  const list: Afterword[] = [
    { worth: 4, at: '2026-10-17T10:00:00Z' },
    { worth: 3, pace: 'slow', at: '2026-10-15T10:00:00Z' },
    { hook: 'plot' },
    { worth: 5, hook: 'idea', at: '2026-10-16T10:00:00Z' },
  ];
  assert.deepEqual(extraHistory(list), { asked: 2, lastWasExtra: false });
  assert.deepEqual(extraHistory([...list, { pace: 'ok', at: '2026-10-18T09:00:00Z' }]), { asked: 3, lastWasExtra: true });
  assert.deepEqual(extraHistory(new Map([['a', { pace: 'fast', at: '2026-10-01' } as Afterword]]).values()), { asked: 1, lastWasExtra: true });
});

console.log('\n== ось «стоило» (worth.ts)');
test('сигнал: явный — вес 1, угаданный — 0,4 и ноль, «Нормально» без ответа — нет', () => {
  assert.deepEqual(worthSignal(5, undefined), { d: 0, v: 0.4 });
  assert.deepEqual(worthSignal(1, undefined), { d: 0, v: 0.4 });
  assert.equal(worthSignal(3, undefined), undefined);
  assert.equal(worthSignal(undefined, undefined), undefined);
  assert.equal(worthSignal(4, 4)!.d, 0);
  assert.ok(Math.abs(worthSignal(5, 5)!.d - 0.4) < 1e-9);
  assert.equal(worthSignal(3, 5)!.d, 1);
  assert.equal(worthKind(5, 1), 'empty'); assert.equal(worthKind(1, 5), 'worthy_miss'); assert.equal(worthKind(3, 1), 'plain');
  assert.ok(worthSignal(5, 2)!.d < worthSignal(3, 2)!.d, '«пусто» сильнее обычного «не стоило»');
  assert.ok(worthSignal(2, 4)!.d > worthSignal(3, 4)!.d, '«мимо, но стоило» сильнее обычного «стоило»');
});
test('без послесловий профиля нет', () => {
  assert.equal(deriveWorthProfile(none), undefined);
});
test('без послесловий слейт байт-в-байт тот же (история владельца, три усилия, с опцией и без)', () => {
  for (const energy of ENERGIES) {
    const before = JSON.stringify(recommend(state, seeds, energy, 6, '2026-10-17'));
    const after = JSON.stringify(recommend(state, seeds, energy, 6, '2026-10-17', { afterwords: none }));
    assert.equal(after, before, energy);
  }
});

// две одинаковые по силе карточки: «похожая» — того же автора, страны и регистра, что и отмеченная
const best = [...seeds].sort((a, b) => scoreCandidate(state, b.work, 'normal') - scoreCandidate(state, a.work, 'normal'))[0];
const twin = (id: string, creator: string, country: string): Candidate => ({ ...best, work: { ...best.work, id, creators: [creator], countries: [country], registers: ['puzzle_noir'] } });
const sim = twin('t-sim', 'Режиссёр Икс', 'Франция');
const other = twin('t-other', 'Режиссёр Игрек', 'Япония');
const fixtureGenres: Record<string, string[]> = { 't-sim': ['детектив'], 't-other': ['мелодрама'], 'h-x': ['детектив'] };
const fxGenres = (w: WorkCard) => fixtureGenres[w.id] ?? ['драма'];
const marked: WorkCard = { ...best.work, id: 'h-x', creators: ['Режиссёр Икс'], countries: ['Франция'], registers: ['puzzle_noir'] };
const context: WorthEntry[] = Array.from({ length: 12 }, (_, i) => ({ work: { ...best.work, id: `h-${i}`, creators: [`Автор ${i}`], countries: ['США'], registers: ['quiet_realism'] }, rating: (i % 2 ? 4 : 2) as Score }));
const withMark = (rating: Score, a: Afterword): RecommendOptions => ({
  afterwords: { entries: [...context, { work: marked, rating }], get: (id) => (id === 'h-x' ? a : undefined), genresOf: fxGenres },
});
const order = (opts: RecommendOptions, first: Candidate, second: Candidate) => recommend(state, [first, second], 'normal', 2, '', opts).map((r) => r.work.id);
const bonus = (rating: Score, a: Afterword, w: WorkCard) => { const p = deriveWorthProfile(withMark(rating, a).afterwords!); return p ? afterwordBonus(p, w) : 0; };

test('«стоило» сверх оценки поднимает похожее', () => {
  assert.deepEqual(order({}, other, sim), ['t-other', 't-sim']);
  assert.deepEqual(order(withMark(3, { worth: 5 }), other, sim), ['t-sim', 't-other']);
  assert.ok(bonus(3, { worth: 5 }, sim.work) > 0);
  assert.ok(bonus(3, { worth: 5 }, other.work) < bonus(3, { worth: 5 }, sim.work) / 2, 'у непохожего общий только регистр — сдвиг меньше');
  assert.ok(bonus(4, { worth: 5 }, sim.work) > 0, '«Хорошо» + «стоило 5» — слабее, но вверх');
  assert.equal(bonus(4, { worth: 4 }, sim.work), 0, '«стоило» ровно как угадали — нового не сказано');
});
test('«пусто» (понравилось, но не стоило) опускает похожее', () => {
  assert.deepEqual(order({}, sim, other), ['t-sim', 't-other']);
  assert.deepEqual(order(withMark(5, { worth: 1 }), sim, other), ['t-other', 't-sim']);
  assert.ok(bonus(5, { worth: 1 }, sim.work) < bonus(3, { worth: 1 }, sim.work), '«пусто» сильнее «Нормально, не стоило»');
});
test('«мимо, но стоило» поднимает похожее, несмотря на оценку', () => {
  assert.deepEqual(order(withMark(1, { worth: 5 }), other, sim), ['t-sim', 't-other']);
  assert.ok(bonus(1, { worth: 5 }, sim.work) > bonus(4, { worth: 5 }, sim.work));
  assert.ok(bonus(1, { worth: 5 }, sim.work) > bonus(3, { worth: 5 }, sim.work), 'сильнее, чем «стоило» у «Нормально»');
  assert.equal(bonus(1, {}, sim.work), 0, '«Мимо» без ответа — ничего');
});
test('масштаб: поправка в пределах ±0,15 + темп + держало', () => {
  for (const r of [1, 2, 3, 4, 5] as Score[]) for (const w of [1, 2, 3, 4, 5] as Score[]) {
    const p = deriveWorthProfile(withMark(r, { worth: w }).afterwords!)!;
    assert.ok(Math.abs(worthFit(p, sim.work)) <= 1);
    assert.ok(Math.abs(afterwordBonus(p, sim.work)) <= 0.15 + 1e-9);
  }
});

const slowCard = (id: string): WorkCard => ({ ...best.work, id, barriers: ['Медленный темп'] });
const paceInput = (pace: Afterword['pace'], n: number): AfterwordInput => ({
  entries: Array.from({ length: n }, (_, i) => ({ work: slowCard(`s-${i}`), rating: 3 as Score })),
  get: (id) => (id.startsWith('s-') ? { pace } : undefined),
});
test('темп: «затянуто» на медленном — лёгкий штраф медленному, остальное не трогаем', () => {
  const p = deriveWorthProfile(paceInput('slow', 4))!;
  assert.ok(pacePenalty(p, slowCard('c')) < 0 && pacePenalty(p, slowCard('c')) >= -0.06);
  assert.equal(pacePenalty(p, best.work.barriers.includes('Медленный темп') ? { ...best.work, barriers: [] } : best.work), 0);
  assert.equal(pacePenalty(deriveWorthProfile(paceInput('ok', 4))!, slowCard('c')), 0, '«в самый раз» — без штрафа');
  assert.equal(pacePenalty(deriveWorthProfile(paceInput('fast', 4))!, slowCard('c')), 0);
  assert.equal(worthFit(p, slowCard('c')), 0, 'без «стоило» ось молчит');
});
test('«что держало»: наклон к соответствующей операции, с трёх ответов', () => {
  const hookInput = (n: number): AfterwordInput => ({
    entries: Array.from({ length: n }, (_, i) => ({ work: { ...best.work, id: `k-${i}` }, rating: 4 as Score })),
    get: (id) => (id.startsWith('k-') ? { hook: 'characters' } : undefined),
  });
  assert.equal(deriveWorthProfile(hookInput(2)), undefined, 'два ответа — ещё не привычка');
  const p = deriveWorthProfile(hookInput(4))!;
  const people: WorkCard = { ...best.work, primaryOperations: [{ op: 'perspective_taking', intensity: 0.9 }] };
  const plot: WorkCard = { ...best.work, primaryOperations: [{ op: 'causal_reasoning', intensity: 0.9 }] };
  assert.ok(hookTilt(p, people) > 0 && hookTilt(p, people) <= 0.05);
  assert.equal(hookTilt(p, plot), 0, 'чего не называл — не опускаем');
});
test('сводка: виды ответов, темп по признакам, держало', () => {
  const s = afterwordSummary({
    entries: [{ work: slowCard('a'), rating: 5 }, { work: best.work, rating: 1 }, { work: { ...best.work, id: 'c', barriers: [] }, rating: 3 }],
    get: (id) => ({ a: { worth: 2, pace: 'slow' }, [best.work.id]: { worth: 5, hook: 'idea' }, c: { pace: 'ok' } } as Record<string, Afterword>)[id],
  });
  assert.equal(s.explicit, 2);
  assert.deepEqual(s.kinds, { empty: 1, worthy_miss: 1, plain: 0 });
  assert.equal(s.pace.onMark.slow?.slow, 1);
  assert.equal(s.pace.unmarked.ok, 1);
  assert.equal(s.hook.idea, 1);
});
console.log(`\n${passed} проверок прошло`);

// ---------- замер на истории владельца ----------
// Пул — справочник с черновой разметкой (как в ленте), без виденного. Отметки — синтетические: разные виды ответов.
const seenTmdb = new Set([...entries.map((e) => e.work), ...watchedWorks].map((w) => w.externalIds?.tmdb).filter((x) => x != null));
const poolSeen = new Set<number>();
const pool: Candidate[] = [];
for (const w of [...filmBase, ...filmBasePopular, ...filmBaseCurated, ...filmBaseMarkup]) {
  const tmdb = w.externalIds?.tmdb;
  const a = tmdb != null ? draftAnnotations[`tmdb:${tmdb}`] : undefined;
  if (!a || tmdb == null || seenTmdb.has(tmdb) || poolSeen.has(tmdb) || w.type !== 'film') continue;
  poolSeen.add(tmdb);
  pool.push({ work: credited(reg({ ...w, primaryOperations: a.ops.map(([op, intensity]) => ({ op, intensity })), complexityLevel: a.level, barriers: a.barriers, warnings: a.warnings, isNicheMasterpiece: a.niche }) as WorkCard), what: a.what });
}
// послесловиям — карточки с барьерами разметки, как их отдаёт annotated() в src/api (состояние — как в model-test)
const awEntries = entries.map((e) => { const a = userAnnotations[e.work.id]; return a ? { ...e, work: { ...e.work, barriers: a.barriers, warnings: a.warnings } } : e; });
const marks: [string, Afterword][] = [
  ['Джентльмены', { worth: 2, hook: 'plot' }],            // 5 → пусто
  ['Типа крутые легавые', { worth: 2 }],                  // 5 → пусто
  ['О чём ещё говорят мужчины', { worth: 1 }],            // 4 → пусто
  ['Иллюзия обмана', { worth: 1, pace: 'ok' }],           // 3 → не стоило
  ['Нация убийц', { worth: 5, hook: 'idea' }],            // 2 → мимо, но стоило
  ['След киллера', { worth: 4 }],                         // 2 → мимо, но стоило
  ['Помнить', { worth: 5 }],                              // 3 → стоило
  ['Лобстер', { worth: 5, hook: 'idea' }],                // 5 → стоило сверх угаданного
  ['Остров проклятых', { worth: 5, hook: 'characters' }], // 5 → стоило сверх угаданного
  ['Убийство священного оленя', { worth: 4 }],
];
// «затянуто» — на трёх фильмах истории с барьером «Медленный темп»
for (const e of awEntries.filter((x) => x.work.barriers.includes('Медленный темп')).slice(0, 3)) {
  const m = marks.find(([t]) => t === e.work.title);
  if (m) m[1] = { ...m[1], pace: 'slow' }; else marks.push([e.work.title, { pace: 'slow' }]);
}
const byTitle = new Map(awEntries.map((e) => [e.work.title, e]));
const aw = new Map<string, Afterword>();
console.log('\n== замер: отметки');
for (const [title, a] of marks) {
  const e = byTitle.get(title);
  if (!e) { console.log(`  нет в истории: ${title}`); continue; }
  aw.set(e.work.id, a);
  console.log(`  ${title} — оценка ${e.rating}${a.worth ? `, стоило ${a.worth}` : ''}${a.pace ? `, темп ${a.pace}` : ''}${a.hook ? `, держало ${a.hook}` : ''}${a.worth ? ` → ${worthKind(e.rating, a.worth)}` : ''}`);
}
const input: AfterwordInput = { entries: awEntries, get: (id) => aw.get(id), genresOf };
const profile = deriveWorthProfile(input)!;
console.log(`  терпимость к темпу: ${JSON.stringify(profile.pace)}; держало (доля − 0,25): ${JSON.stringify(Object.fromEntries(Object.entries(profile.hook).map(([k, v]) => [k, +v.toFixed(2)])))}`);
console.log(`  пул ${pool.length}; поправка по пулу: ${(() => { const xs = pool.map((c) => afterwordBonus(profile, c.work)); return `мин ${Math.min(...xs).toFixed(3)}, макс ${Math.max(...xs).toFixed(3)}, ненулевых ${xs.filter((x) => x !== 0).length}`; })()}`);
for (const energy of ENERGIES) {
  const before = recommend(state, pool, energy, 6, '');
  const after = recommend(state, pool, energy, 6, '', { afterwords: input });
  assert.equal(JSON.stringify(recommend(state, pool, energy, 6, '', { afterwords: none })), JSON.stringify(before));
  const line = (r: (typeof before)[number]) => `${r.work.title} (${r.work.creators[0] ?? '—'})`;
  console.log(`\n-- ${energy}`);
  for (let i = 0; i < 6; i++) {
    const b = before[i]; const a = after[i];
    const d = a ? afterwordBonus(profile, a.work) : 0;
    console.log(`  ${i + 1}. ${(b ? line(b) : '—').padEnd(52)} → ${a ? line(a) : '—'}${d ? ` [${d > 0 ? '+' : ''}${d.toFixed(3)}]` : ''}`);
  }
  const ranked = (opts: RecommendOptions) => recommend(state, pool, energy, 40, '', opts).map((r) => r.work.id);
  const b40 = ranked({}); const a40 = ranked({ afterwords: input });
  console.log(`  в первых 40: ушло ${b40.filter((id) => !a40.includes(id)).length}, пришло ${a40.filter((id) => !b40.includes(id)).length}`);
}
// самые сильные поправки в пуле — что именно ось двигает
const moved = pool.map((c) => ({ c, d: afterwordBonus(profile, c.work) })).filter((x) => x.d).sort((a, b) => a.d - b.d);
console.log('\n== сильнее всего вниз / вверх');
for (const x of [...moved.slice(0, 5), ...moved.slice(-5)]) console.log(`  ${x.d.toFixed(3)} ${x.c.work.title} (${x.c.work.creators[0] ?? '—'}; ${genresOf(x.c.work).join(',')})`);
