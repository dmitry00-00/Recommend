// Проверка наклона ленты (19.10, панель ленты v2, src/lib/tilt.ts):
//   1. пустой наклон (и наклон с пустыми осями) — подбор ровно прежний, карточка в карточку, на трёх усилиях;
//   2. «только это» — в ленте только подходящее, и лента полная (добор без ограничений разнообразия);
//   3. «больше такого» — подходящего в ленте больше, чем без наклона, а неподходящее не выкинуто из пула;
//   4. признаки карточки: традиции по странам (без совместного с Голливудом), длина, десятилетия;
//   5. «Словами»: фраза расставляет оси по подписям вариантов, десятилетия и усилие.
// Пул — справочник фильмов (filmBase) с черновой разметкой (draftAnnotations), желания — src/mocks/desireAxis.ts;
// состояние — история владельца, как в tools/model-test.mts.
//   npx tsx tools/tilt-test.mts
import assert from 'node:assert/strict';
import { userJournal } from '../src/mocks/userHistory.ts';
import { userAnnotations } from '../src/mocks/userAnnotations.ts';
import { userRatings } from '../src/mocks/userRatings.ts';
import { watchedWorks } from '../src/mocks/userWatched.ts';
import { workRegisters } from '../src/mocks/workRegisters.ts';
import { registerBase } from '../src/mocks/registerBase.ts';
import { filmBase } from '../src/mocks/filmBase.ts';
import { draftAnnotations } from '../src/mocks/draftAnnotations.ts';
import { desireAxis } from '../src/mocks/desireAxis.ts';
import { deriveState } from '../src/lib/model/deriveState.ts';
import { recommend, type Candidate } from '../src/lib/model/recommend.ts';
import { applyTilt, factsOf, passesOnly, tiltActive, type Tilt, type TiltFacts } from '../src/lib/tilt.ts';
import { parseWords } from '../src/lib/tiltWords.ts';
import type { Energy, WorkCard } from '../src/types/tmdf.ts';

let checks = 0;
const ok = (cond: unknown, what: string) => { assert.ok(cond, what); checks += 1; };

// ─── состояние и пул ──────────────────────────────────────────────────────────────────────────────────────────────
const entries = userJournal.map((e) => {
  const a = userAnnotations[e.work.id];
  const work = a ? { ...e.work, primaryOperations: a.ops.map(([op, intensity]) => ({ op, intensity })), complexityLevel: a.level, isNicheMasterpiece: a.niche } : e.work;
  return { ...e, work, rating: userRatings[e.work.id]?.rating };
});
const reg = <T extends { id: string; registers?: string[] }>(w: T) => ({ ...w, registers: w.registers ?? workRegisters[w.id] });
const state = deriveState('u', entries.map((e) => ({ ...e, work: reg(e.work) })) as never, '2026-10-19',
  { alsoSeen: watchedWorks.map(reg) as never, base: registerBase })!;
ok(state, 'состояние из истории');

const pool: Candidate[] = [];
for (const w of filmBase) {
  const key = w.externalIds?.tmdb != null ? `tmdb:${w.externalIds.tmdb}` : undefined;
  const a = key ? draftAnnotations[key] : undefined;
  if (!a || a.confidence === 'low') continue;
  pool.push({ work: { ...w, primaryOperations: a.ops.map(([op, intensity]) => ({ op, intensity })), complexityLevel: a.level, barriers: a.barriers, warnings: a.warnings, isNicheMasterpiece: a.niche }, what: a.what });
}
ok(pool.length > 300, `пул для проверки: ${pool.length}`);

const kinds = new Map<string, string[]>();
for (const [kind, keys] of Object.entries(desireAxis)) for (const k of keys.split(' ')) (kinds.get(k) ?? kinds.set(k, []).get(k)!).push(kind);
const cache = new WeakMap<WorkCard, TiltFacts>();
const facts = (w: WorkCard): TiltFacts => {
  let f = cache.get(w);
  if (!f) {
    f = factsOf(w, { desires: (x) => (x.externalIds?.tmdb != null ? kinds.get(`tmdb:${x.externalIds.tmdb}`) : undefined) ?? [], genres: () => [] });
    cache.set(w, f);
  }
  return f;
};
const ids = (list: { work: WorkCard }[]) => list.map((r) => r.work.id);
const pickIn = (t: Tilt | undefined, energy: Energy) => {
  const x = applyTilt(pool, t, facts);
  return recommend(state, x.pool, energy, 6, '2026-10-19', x.options);
};

// ─── 1. пустой наклон = прежняя лента ────────────────────────────────────────────────────────────────────────────
for (const energy of ['low', 'normal', 'high'] as const) {
  const before = recommend(state, pool, energy, 6, '2026-10-19');
  ok(before.length === 6, `лента без наклона полная (${energy})`);
  for (const t of [undefined, {}, { want: { v: [] } }, { era: { v: [], only: true } }] as (Tilt | undefined)[]) {
    ok(!tiltActive(t), 'пустой наклон не активен');
    const x = applyTilt(pool, t, facts);
    ok(x.pool === pool && Object.keys(x.options).length === 0, 'пустой наклон: тот же пул, без настроек');
    assert.deepEqual(ids(pickIn(t, energy)), ids(before), `пустой наклон — та же лента (${energy}, ${JSON.stringify(t)})`);
    checks += 1;
  }
}

// частоты вариантов в пуле — для «только» и «больше» берём то, чего в пуле немного, но хватает
const freq = new Map<string, number>();
for (const c of pool) {
  const f = facts(c.work);
  for (const a of ['want', 'op', 'form'] as const) for (const v of f[a]) freq.set(`${a}:${v}`, (freq.get(`${a}:${v}`) ?? 0) + 1);
}
const share = (key: string) => (freq.get(key) ?? 0) / pool.length;
const middling = [...freq.keys()].filter((k) => share(k) > 0.04 && share(k) < 0.25);
ok(middling.length >= 3, `вариантов средней частоты: ${middling.length}`);

// ─── 2. «только это» ──────────────────────────────────────────────────────────────────────────────────────────────
for (const key of middling.slice(0, 6)) {
  const [axis, v] = key.split(':') as ['want' | 'op' | 'form', string];
  const t: Tilt = { [axis]: { v: [v], only: true } };
  const got = pickIn(t, 'normal');
  ok(got.length >= 5, `«только ${key}»: лента почти полная (${got.length})`);
  ok(got.every((r) => passesOnly(t, facts(r.work))), `«только ${key}»: всё подходит`);
}
const era: Tilt = { era: { v: ['1970', '1980'], only: true } };
const eraGot = pickIn(era, 'normal');
ok(eraGot.length >= 5 && eraGot.every((r) => r.work.year >= 1970 && r.work.year <= 1989), `«только 1970-е — 1980-е»: ${eraGot.map((r) => r.work.year).join(', ')}`);
// два «только» сразу — пересечение
const both: Tilt = { era: { v: ['1990', '2010'], only: true }, form: { v: ['slow'], only: true } };
ok(pickIn(both, 'normal').every((r) => r.work.year >= 1990 && r.work.barriers.some((b) => ['Медленный темп', 'Мало слов', 'Медленный разгон'].includes(b))), 'два «только» — пересечение');

// ─── 3. «больше такого» ───────────────────────────────────────────────────────────────────────────────────────────
let raised = 0;
for (const key of middling) {
  const [axis, v] = key.split(':') as ['want' | 'op' | 'form', string];
  const t: Tilt = { [axis]: { v: [v] } };
  const x = applyTilt(pool, t, facts);
  ok(x.pool === pool, `«больше ${key}»: пул не сужается`);
  const before = recommend(state, pool, 'normal', 6, '2026-10-19').filter((r) => facts(r.work)[axis].includes(v)).length;
  const after = pickIn(t, 'normal').filter((r) => facts(r.work)[axis].includes(v)).length;
  ok(after >= before, `«больше ${key}»: подходящего не меньше (${before} → ${after})`);
  if (after > before) raised += 1;
}
ok(raised >= Math.ceil(middling.length / 2), `«больше» поднимает подходящее: ${raised} из ${middling.length}`);

// ─── 4. признаки карточки ─────────────────────────────────────────────────────────────────────────────────────────
const card = (over: Partial<WorkCard>): WorkCard => ({ id: 'x', type: 'film', title: 'x', year: 1960, creators: [], primaryOperations: [{ op: 'synthesis', intensity: 0.4 }],
  complexityLevel: 5, warnings: [], barriers: [], isNicheMasterpiece: false, ...over });
const none = { desires: () => [], genres: () => [] };
ok(factsOf(card({ countries: ['Japan'] }), none).trad.includes('c-jp'), 'Япония по-английски — японское кино');
ok(factsOf(card({ countries: ['Japan'] }), none).trad.includes('japan-classic') === false, 'японская классика без жанров не угадывается');
ok(!factsOf(card({ countries: ['Япония', 'США'] }), none).trad.includes('c-jp'), 'совместное с Голливудом — не японское');
ok(factsOf(card({ countries: ['Soviet Union'] }), none).trad.includes('c-su'), 'СССР');
ok(factsOf(card({ countries: ['Россия'], year: 1985 }), none).trad.includes('c-ru') === false, 'российское — с 1992');
ok(factsOf(card({ durationMinutes: 88 }), none).len.join() === 'short', 'короткое');
ok(factsOf(card({ durationMinutes: 170 }), none).len.join() === 'long', 'длинное');
ok(factsOf(card({ type: 'series', series: { seasons: 1, episodes: 6, episodeMinutes: 50, status: 'ended' } }), none).len.join() === 'mini,series', 'мини-сериал');
ok(factsOf(card({ type: 'book', pages: 900 }), none).len.join() === 'b-long', 'большая книга');
ok(factsOf(card({}), none).op.join() === 'synthesis', 'ведущая операция — всегда');

// ─── 5. «Словами» ─────────────────────────────────────────────────────────────────────────────────────────────────
const axes = [
  { axis: 'want' as const, options: ['home', 'redeem', 'escape', 'fame', 'protect', 'truth', 'revenge', 'love', 'survive', 'power'] },
  { axis: 'trad' as const, options: ['soviet-sf', 'korea-genre', 'japan-classic', 'iran', 'nordic', 'c-fr', 'c-jp', 'c-kr', 'c-su', 'c-ru'] },
  { axis: 'op' as const, options: ['perspective_taking', 'synthesis', 'critical_analysis'] },
  { axis: 'era' as const, options: ['1950', '1960', '1970', '1980', '1990', '2000', '2010', '2020'] },
  { axis: 'form' as const, options: ['slow', 'nonlinear', 'talk'] },
  { axis: 'len' as const, options: ['short', 'evening', 'long'] },
];
const p1 = parseWords('медленное о доме', axes);
assert.deepEqual(p1.tilt, { want: { v: ['home'] }, form: { v: ['slow'] } }); checks += 1;
const p2 = parseWords('советское 1970-х', axes);
assert.deepEqual(p2.tilt, { trad: { v: ['c-su'] }, era: { v: ['1970', '1970'] } }); checks += 1;
const p3 = parseWords('советская фантастика 60-х–80-х', axes);
assert.deepEqual(p3.tilt, { trad: { v: ['soviet-sf'] }, era: { v: ['1960', '1980'] } }); checks += 1;
const p4 = parseWords('что-то короткое и полегче', axes);
assert.deepEqual([p4.tilt, p4.energy], [{ len: { v: ['short'] } }, 'low']); checks += 1;
const p5 = parseWords('корейское про месть', axes);
ok(p5.tilt.want?.v.join() === 'revenge' && p5.tilt.trad?.v.length === 1 && ['c-kr', 'korea-genre'].includes(p5.tilt.trad.v[0]), `корейское про месть: ${JSON.stringify(p5.tilt)}`);
const p6 = parseWords('загадка 2000-х на вечер, сложнее', axes);
assert.deepEqual([p6.tilt, p6.energy], [{ op: { v: ['synthesis'] }, era: { v: ['2000', '2000'] }, len: { v: ['evening'] } }, 'high']); checks += 1;
ok(parseWords('90 минут', axes).tilt.era === undefined, '«90 минут» — не 1990-е');
ok([...parseWords('японское и французское', axes).tilt.trad?.v ?? []].sort().join() === 'c-fr,c-jp', 'две традиции');
ok(parseWords('просто посмотреть', axes).hits.length === 1, 'лишнего не угадывает');

// «до 1900» одним пунктом (19.10): старые века — одно значение барабана, остальное — десятилетия
{
  const { ERA_OLD, eraBucket, axisMatches } = await import('../src/lib/tilt.ts');
  const facts = (year: number) => ({ year, want: [], trad: [], op: [], form: [], len: [] }) as any;
  ok(eraBucket(1350) === ERA_OLD && eraBucket(1899) === ERA_OLD && eraBucket(1900) === 1900 && eraBucket(1987) === 1980, 'века до 1900 — один пункт');
  ok(axisMatches('era', { v: [String(ERA_OLD), String(ERA_OLD)] }, facts(1605)), '«до 1900» берёт XVII век');
  ok(!axisMatches('era', { v: [String(ERA_OLD), String(ERA_OLD)] }, facts(1901)), '«до 1900» не берёт 1901');
  ok(axisMatches('era', { v: [String(ERA_OLD), '1920'] }, facts(1925)) && axisMatches('era', { v: [String(ERA_OLD), '1920'] }, facts(1812)), '«до 1900 — 1920-е»');
  ok(axisMatches('era', { v: ['1970', '1980'] }, facts(1989)) && !axisMatches('era', { v: ['1970', '1980'] }, facts(1990)), 'десятилетия как прежде');
}

console.log(`наклон: ${checks} проверок прошли`);
