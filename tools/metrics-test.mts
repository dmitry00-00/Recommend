// Проверка МА-1/МА-2 (worker/metrics.ts) на синтетической когорте с ответом, посчитанным руками (13.10).
//
//   npx tsx tools/metrics-test.mts
//
// Сегодня — 13.10 (по Москве); `at(-20)` — 20 дней назад в полдень по Москве. Кто есть кто:
//   A — старт 40 дней назад [4; 6], центр 5; досмотры 7, 8, 5 → два выше 6 — сдвиг; g = (7 − 5) / 5 = 0,4;
//       второй снимок — центр 6: «центр вверх»;
//   B — старт 35 дней назад [5; 7], центр 6; «Видел» 8 через три дня после показа — досмотр; «Видел» 9 в день
//       показа — не досмотр («уже знал»); чек-ин 6 → выше 7 только один — нет сдвига; g = (7 − 6) / 4 = 0,25;
//   C — старт 10 дней назад (не в когорте 4–8 недель) [2; 4], центр 3; досмотры 6 и 7 — сдвиг; g = 0,5;
//   D — старт 50 дней назад, досмотров нет; второй снимок уже на единицу — «уточнение»;
//   E — снимок по двум досмотрам (мало) — старта нет; F — без снимков; оба заходили — «без стартовой карты»;
//   G, H, I — показы и отклики за 28 дней: take-rate, качественное принятие, ECS, покрытие, ревизит;
//   J, K — принятия в неделю 1 и недели 4–8 после активации: GS и разброс сложности.
import assert from 'node:assert/strict';
import { computeMetrics, type MetricRows } from '../worker/metrics.ts';

const NOW = Date.UTC(2026, 9, 13, 9); // 12:00 по Москве
const at = (d: number, h = 9) => new Date(Date.UTC(2026, 9, 13 + d, h)).toISOString();
const day = (d: number) => at(d).slice(0, 10);
const T = (op: Record<string, number>) => JSON.stringify({ op });

const rows: MetricRows = {
  users: 'ABCDEFGHIJK'.split('').map((id) => ({ id, created_at: at(-60) })),
  visits: [
    ['A', -21], ['A', -15], ['B', -32], ['B', -2], ['G', -9], ['J', -49], ['J', -43], ['J', -20], ['E', -3], ['F', -3],
  ].map(([user_id, d]) => ({ user_id: user_id as string, day: day(d as number) })),
  states: [
    { user_id: 'A', at: at(-40), center: 5, lo: 4, hi: 6, median: 5, n: 10 },
    { user_id: 'A', at: at(-10, 5), center: 6, lo: 4, hi: 7, median: 6, n: 13 },
    { user_id: 'B', at: at(-35), center: 6, lo: 5, hi: 7, median: 6, n: 5 },
    { user_id: 'C', at: at(-10, 5), center: 3, lo: 2, hi: 4, median: 3, n: 4 },
    { user_id: 'D', at: at(-50), center: 5.5, lo: 4, hi: 7, median: 5, n: 6 },
    { user_id: 'D', at: at(-20), center: 5.5, lo: 4.5, hi: 6.5, median: 5, n: 7 },
    { user_id: 'E', at: at(-20), center: 4, lo: 3, hi: 5, median: 4, n: 2 },
  ],
  impressions: [
    { user_id: 'B', rec_id: 'b1', work_id: 'wB1', level: 8, traits: null, at: at(-33) },
    { user_id: 'B', rec_id: 'b2', work_id: 'wB2', level: 9, traits: null, at: at(-20, 6) },
    { user_id: 'A', rec_id: 'a1', work_id: 'wA8', level: 8, traits: null, at: at(-22) },
    { user_id: 'G', rec_id: 'g1', work_id: 'wG1', level: 5, traits: null, at: at(-10) },
    { user_id: 'G', rec_id: 'g2', work_id: 'wG2', level: 5, traits: null, at: at(-10) },
    { user_id: 'G', rec_id: 'g3', work_id: 'wG3', level: 5, traits: null, at: at(-10) },
    { user_id: 'H', rec_id: 'h1', work_id: 'wH1', level: 6, traits: null, at: at(-12) },
    { user_id: 'I', rec_id: 'i1', work_id: 'wG1', level: 5, traits: null, at: at(-10) },
    { user_id: 'J', rec_id: 'j0', work_id: 'wJ0', level: 5, traits: null, at: at(-50) },
    { user_id: 'K', rec_id: 'k0', work_id: 'wK0', level: 5, traits: null, at: at(-40) },
  ],
  feedback: [
    { user_id: 'B', rec_id: 'b1', work_id: 'wB1', action: 'dismiss', reason: 'already_know', level: 8, traits: null, at: at(-30) },
    { user_id: 'B', rec_id: 'b2', work_id: 'wB2', action: 'dismiss', reason: 'already_know', level: 9, traits: null, at: at(-20) },
    { user_id: 'A', rec_id: 'a1', work_id: 'wA8', action: 'start', reason: null, level: 8, traits: null, at: at(-21) },
    { user_id: 'G', rec_id: 'g1', work_id: 'wG1', action: 'save', reason: null, level: 5, traits: null, at: at(-9) },
    { user_id: 'G', rec_id: 'g2', work_id: 'wG2', action: 'save', reason: null, level: 5, traits: null, at: at(-9) },
    { user_id: 'H', rec_id: 'h1', work_id: 'wH1', action: 'dismiss', reason: 'already_know', level: 6, traits: null, at: at(-6) },
    { user_id: 'I', rec_id: 'i1', work_id: 'wG1', action: 'save', reason: null, level: 5, traits: null, at: at(-9) },
    // J: неделя 1 — две «a» уровня 5; недели 4–8 — «b» уровня 3 и «a+b» уровня 8 → разнообразнее, разброс вырос
    { user_id: 'J', rec_id: 'j1', work_id: 'wJ1', action: 'save', reason: null, level: 5, traits: T({ a: 1 }), at: at(-49) },
    { user_id: 'J', rec_id: 'j2', work_id: 'wJ2', action: 'save', reason: null, level: 5, traits: T({ a: 1 }), at: at(-48) },
    { user_id: 'J', rec_id: 'j3', work_id: 'wJ3', action: 'save', reason: null, level: 3, traits: T({ b: 1 }), at: at(-25) },
    { user_id: 'J', rec_id: 'j4', work_id: 'wJ4', action: 'save', reason: null, level: 8, traits: T({ a: 1, b: 1 }), at: at(-20) },
    // K: неделя 1 — «a» 4 и «b» 8; недели 4–8 — две «a» уровня 5 → уже, разброс упал
    { user_id: 'K', rec_id: 'k1', work_id: 'wK1', action: 'save', reason: null, level: 4, traits: T({ a: 1 }), at: at(-39) },
    { user_id: 'K', rec_id: 'k2', work_id: 'wK2', action: 'save', reason: null, level: 8, traits: T({ b: 1 }), at: at(-38) },
    { user_id: 'K', rec_id: 'k3', work_id: 'wK3', action: 'save', reason: null, level: 5, traits: T({ a: 1 }), at: at(-15) },
    { user_id: 'K', rec_id: 'k4', work_id: 'wK4', action: 'save', reason: null, level: 5, traits: T({ a: 1 }), at: at(-12) },
  ],
  checkins: [
    { user_id: 'A', work_id: 'wA7', status: 'finished', level: 7, worth: null, at: at(-30) },
    { user_id: 'A', work_id: 'wA8', status: 'finished', level: 8, worth: 5, at: at(-20) },
    { user_id: 'A', work_id: 'wA5', status: 'finished', level: 5, worth: 2, at: at(-10) },
    { user_id: 'B', work_id: 'wB3', status: 'finished', level: 6, worth: null, at: at(-5) },
    { user_id: 'B', work_id: 'wB4', status: 'abandoned', level: 9, worth: null, at: at(-4) },
    { user_id: 'C', work_id: 'wC1', status: 'finished', level: 6, worth: null, at: at(-8) },
    { user_id: 'C', work_id: 'wC2', status: 'finished', level: 7, worth: null, at: at(-2) },
  ],
  ratings: [
    { user_id: 'A', work_id: 'wA8', rating: 5, at: at(-15) },
    { user_id: 'C', work_id: 'wC1', rating: 4, at: at(-8) },
    { user_id: 'C', work_id: 'wC2', rating: 5, at: at(-1) },
    { user_id: 'H', work_id: 'wH1', rating: 4, at: at(-6) },
  ],
  events: [
    { user_id: 'G', kind: 'watch', work_id: 'wG1', at: at(-8) },
    { user_id: 'A', kind: 'card', work_id: 'wA8', at: at(-5) },
    { user_id: 'A', kind: 'card', work_id: 'wNew', at: at(-5) },
    { user_id: 'G', kind: 'card', work_id: 'wG3', at: at(-9) },
  ],
};

const m = computeMetrics(rows, NOW);
const near = (a: number | null, b: number, what: string) => assert.ok(a != null && Math.abs(a - b) < 0.002, `${what}: ${a} ≠ ${b}`);
let checks = 0;
const eq = <T,>(a: T, b: T, what: string) => { assert.deepEqual(a, b, what); checks += 1; };
const nr = (a: number | null, b: number, what: string) => { near(a, b, what); checks += 1; };

// МА-1: когорта 4–8 недель — A, B, D
eq(m.shift.cohort.from, '2026-08-18', 'начало когорты');
eq(m.shift.cohort.users, 3, 'когорта: людей');
eq(m.shift.cohort.shifted, 1, 'когорта: сдвиг (A)');
nr(m.shift.cohort.share, 1 / 3, 'когорта: доля сдвига');
eq(m.shift.cohort.g.n, 2, 'когорта: g у A и B');
nr(m.shift.cohort.g.median, 0.325, 'когорта: медиана g');
eq([m.shift.cohort.g.low, m.shift.cohort.g.mid, m.shift.cohort.g.high], [1, 1, 0], 'когорта: g по Хейку');
eq(m.shift.cohort.map, { movedUp: 1, movedDown: 0, refined: 1, same: 0, noUpdate: 1 }, 'когорта: карта');
// за всё время — ещё C
eq([m.shift.all.users, m.shift.all.shifted], [4, 2], 'всё время: людей и сдвигов');
nr(m.shift.all.g.median, 0.4, 'всё время: медиана g (0,25 · 0,4 · 0,5)');
eq(m.shift.all.map, { movedUp: 1, movedDown: 0, refined: 1, same: 0, noUpdate: 2 }, 'всё время: карта');
eq(m.shift.noStart, 4, 'активные без стартовой карты: E, F, G, J');

// МА-2 за 28 дней: досмотры A8, A5, B6, C6, C7, H «Видел»
eq(m.quality.since, '2026-09-15', 'начало окна');
eq(m.quality.proxyReward.finishes, 6, 'досмотров за 28 дней');
eq([m.quality.proxyReward.n, m.quality.proxyReward.base], [1, 5], 'proxy reward: A8 из пяти (у H нет карты)');
eq([m.quality.valued.n, m.quality.valued.answered], [4, 5], 'valued: A8 (5), C6 (4), C7 (5), H (4) из пяти ответов');
nr(m.quality.valued.answerRate, 5 / 6, 'valued: доля ответивших');
eq([m.quality.take.shown, m.quality.take.accepted, m.quality.take.quality], [7, 4, 3], 'take-rate: показано, принято, качественно');
eq([m.quality.ecs.takes, m.quality.ecs.unique, m.quality.ecs.shownWorks], [5, 4, 6], 'ECS: принятий, разных, показанных');
nr(m.quality.ecs.ecs, 0.8, 'ECS');
nr(m.quality.ecs.coverage, 4 / 6, 'покрытие показанного');
eq([m.quality.gs.users, m.quality.gs.spreadUsers], [2, 2], 'GS: J и K');
nr(m.quality.gs.diversified, 0.5, 'GS: разнообразнее стал J');
nr(m.quality.gs.spreadHeld, 0.5, 'ограничитель: разброс удержал J');
nr(m.quality.gs.week1, (0.8321 + 0.6325) / 2, 'GS неделя 1');
nr(m.quality.gs.later, (0.7676 + 0.9487) / 2, 'GS недели 4–8');
eq([m.quality.revisit.cards, m.quality.revisit.revisits, m.quality.revisit.users, m.quality.revisit.usersWithRevisit], [3, 1, 2, 1], 'ревизит');

// удержание от активации (первая лента): A −22, B −33, G −10, H −12, I −10, J −50, K −40
const r = (k: number) => m.retention.find((x) => x.k === k)!;
eq([r(1).users, r(1).exact, r(1).later], [7, 4, 4], 'D1 от активации');
eq([r(7).users, r(7).exact, r(7).later], [7, 2, 3], 'D7 от активации');
eq([r(30).users, r(30).exact, r(30).later], [3, 1, 2], 'D30 от активации');
eq(m.wau.length, 8, 'WAU: восемь недель');
eq(m.wau.at(-1), { to: '2026-10-12', users: 3 }, 'WAU последней недели: B, E, F');

console.log(`metrics-test: ${checks} проверок — всё сошлось`);
