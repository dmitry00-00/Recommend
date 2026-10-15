// Проверка расчёта «какая подписка подходит» (src/lib/subscriptionPlan.ts): npx tsx tools/subscription-plan-test.mts
import assert from 'node:assert/strict';
import { planSubscriptions, type PlanOption } from '../src/lib/subscriptionPlan.ts';

const avail: Record<string, PlanOption[]> = {
  a: [{ slug: 'okko', kind: 'subscription' }],
  b: [{ slug: 'okko', kind: 'subscription' }, { slug: 'kinopoisk', kind: 'subscription' }],
  c: [{ slug: 'kinopoisk', kind: 'subscription' }],
  d: [{ slug: 'kinopoisk', kind: 'subscription' }],
  e: [{ slug: 'premier', kind: 'subscription' }],
  f: [{ slug: 'start', kind: 'subscription' }, { slug: 'okko', kind: 'rent' }],
  g: [{ slug: 'youtube', kind: 'free' }],
  h: [{ slug: 'ivi', kind: 'subscription' }],
  i: [{ slug: 'okko', kind: 'buy' }],
};
const items = [
  { work: 'a', planned: true }, { work: 'b', planned: true }, { work: 'e', planned: true },
  { work: 'c', planned: false }, { work: 'd', planned: false }, { work: 'f', planned: false },
  { work: 'g', planned: false }, { work: 'h', planned: false }, { work: 'i', planned: true },
];
const prices = { okko: 399, kinopoisk: 449, premier: 299, start: 299 };
const plan = planSubscriptions(items, (w) => avail[w] ?? [], ['ivi'], prices);

// бесплатное и своя подписка (ivi) — без доплаты; только покупка — нигде по подписке
assert.deepEqual(plan.covered.sort(), ['g', 'h']);
assert.deepEqual(plan.nowhere, ['i']);
// okko: a, b (планы) = 4; kinopoisk: b (план) + c, d = 4; при равенстве — дешевле выше
assert.equal(plan.providers[0].slug, 'okko');
assert.equal(plan.providers[0].score, 4);
assert.equal(plan.providers[1].slug, 'kinopoisk');
// пары okko + kinopoisk (a, b, c, d) и okko + premier (a, b, e) весят одинаково, 6 — берётся дешёвая
assert.deepEqual(plan.pair?.slugs, ['okko', 'premier']);
assert.equal(plan.pair?.count, 3);
assert.equal(plan.pair?.price, 698);
// по очереди: okko (a, b) → premier (e, план: вес 2, дешевле kinopoisk с тем же приростом) → kinopoisk (c, d);
// start (f: лента, вес 1) — мало для месяца
assert.deepEqual(plan.rotation.map((m) => m.slug), ['okko', 'premier', 'kinopoisk']);
assert.deepEqual(plan.rotation[2].works, ['c', 'd']);
assert.equal(plan.total, 9);

// пусто — без пары и очереди
const none = planSubscriptions([], () => [], []);
assert.equal(none.providers.length, 0);
assert.equal(none.pair, undefined);
assert.equal(none.rotation.length, 0);
console.log('subscription-plan: ок');
