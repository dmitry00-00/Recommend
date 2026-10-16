// Проверка вкладки «Рост» (worker/growth.ts) на синтетике с ответом, посчитанным руками (16.10).
//
//   npx tsx tools/growth-test.mts
//
// Сегодня — 16.10 (по Москве); `at(-3)` — три дня назад в полдень по Москве. Кто есть кто:
//   A — 20 дней назад по метке kinoman, лента через час (активирован), был в день входа, на 1-й и 7-й день;
//   B — 20 дней назад по метке kinoman, ленты нет, был только в день входа;
//   C — 5 дней назад по приглашению A, лента через два часа, был на 1-й день; прошёл первый вход свайпом
//       (seen 4, want 2, no 3, rated 3; любимых 2), оценок в первые сутки 3;
//   D — 40 дней назад сам, лента через два дня (не активирован), вернулся на 35-й день;
//   E — 100 дней назад сам (вне 90 дней), заходил позавчера;
//   посевы: kinoman — 3 000 ₽ 25 дней назад; empty — 1 000 ₽ 10 дней назад, по ней никто не пришёл;
//   поделились: A — 10 и 3 дня назад, D — 2 дня назад; оценок в первые сутки: A — 6, C — 3.
import assert from 'node:assert/strict';
import { computeGrowth, wilson, type GrowthRows } from '../worker/growth.ts';

const at = (d: number, h = 9) => new Date(Date.UTC(2026, 9, 16 + d, h)).toISOString();
const day = (d: number) => at(d).slice(0, 10);

const rows: GrowthRows = {
  today: day(0),
  users: [
    { id: 'A', created_at: at(-20), source: 'kinoman', invited_by: null },
    { id: 'B', created_at: at(-20), source: 'kinoman', invited_by: null },
    { id: 'C', created_at: at(-5), source: null, invited_by: 'A' },
    { id: 'D', created_at: at(-40), source: null, invited_by: null },
    { id: 'E', created_at: at(-100), source: null, invited_by: null },
  ],
  visits: [
    { user_id: 'A', day: day(-20) }, { user_id: 'A', day: day(-19) }, { user_id: 'A', day: day(-13) },
    { user_id: 'B', day: day(-20) },
    { user_id: 'C', day: day(-5) }, { user_id: 'C', day: day(-4) },
    { user_id: 'D', day: day(-40) }, { user_id: 'D', day: day(-5) },
    { user_id: 'E', day: day(-100) }, { user_id: 'E', day: day(-2) },
  ],
  firstFeed: [{ user_id: 'A', at: at(-20, 10) }, { user_id: 'C', at: at(-5, 11) }, { user_id: 'D', at: at(-38) }],
  ratingsDay1: [{ user_id: 'A', n: 6 }, { user_id: 'C', n: 3 }],
  onboard: [
    { user_id: 'C', place: 'swipe_done', detail: 'seen:4,want:2,no:3,rated:3', at: at(-5, 9) },
    { user_id: 'C', place: 'favorites_done', detail: 'seen:4,want:2,no:3,rated:3,favorites:2', at: at(-5, 9) },
  ],
  shares: [{ user_id: 'A', at: at(-10) }, { user_id: 'A', at: at(-3) }, { user_id: 'D', at: at(-2) }],
  together: { sessions: 1, participants: 2 },
  inline: { polls: 2, voters: 5, outsiders: 3 },
  seeding: [
    { id: 'sd-000000000001', label: 'kinoman', channel: 'Киноман', posted_at: day(-25), price: 3000, currency: 'RUB', note: null },
    { id: 'sd-000000000002', label: 'empty', channel: null, posted_at: day(-10), price: 1000, currency: 'RUB', note: null },
  ],
  internal: { owner: 1, testers: 2 },
};

const g = computeGrowth(rows);
const close = (a: number | null, b: number, eps = 0.01) => assert.ok(a != null && Math.abs(a - b) < eps, `${a} ≠ ${b}`);

// интервал Уилсона: 1 из 2 → 0,5, границы ≈ 0,094–0,906; пусто — null
close(wilson(1, 2).share, 0.5); close(wilson(1, 2).lo, 0.0945); close(wilson(1, 2).hi, 0.9055);
assert.equal(wilson(0, 0).share, null);

// источники: по числу пришедших, при равенстве — по имени; посев без пришедших — тоже строка
assert.deepEqual(g.sources.map((s) => s.source), ['kinoman', 'invited', 'organic', 'empty']);
const [kino, inv, org, empty] = g.sources;
assert.equal(kino.joined, 2); assert.equal(kino.activation.n, 1); assert.equal(kino.activation.of, 2);
assert.equal(kino.d1.n, 1); assert.equal(kino.d1.of, 2);     // A вернулся на 1-й день, B — нет
assert.equal(kino.d7.n, 1); assert.equal(kino.d7.of, 2);     // A был на 7-й день
assert.equal(kino.d30.of, 0); assert.equal(kino.d30.share, null); // 30-й день ещё не прошёл
assert.equal(kino.cost, 3000); assert.equal(kino.perJoined, 1500); assert.equal(kino.perActivated, 3000); assert.equal(kino.perD7, 3000);
assert.equal(kino.posts, 1); assert.deepEqual(kino.channels, ['Киноман']); assert.equal(kino.lastPost, day(-25));
assert.equal(inv.joined, 1); assert.equal(inv.activation.n, 1); assert.equal(inv.d1.n, 1); assert.equal(inv.d7.of, 0);
assert.equal(org.joined, 1); assert.equal(org.activation.n, 0);   // лента через два дня — не активация
assert.equal(org.d1.n, 1); assert.equal(org.d7.n, 1); assert.equal(org.d30.n, 1); assert.equal(org.d30.of, 1);
assert.equal(empty.joined, 0); assert.equal(empty.cost, 1000); assert.equal(empty.perJoined, null);

// недели: двенадцать, последняя кончается сегодня — новые C, активные C, D, E, вернувшиеся D и E, поделились дважды
assert.equal(g.weeks.length, 12);
const last = g.weeks.at(-1)!;
assert.equal(last.to, day(0)); assert.equal(last.from, day(-6));
assert.equal(last.joined, 1); assert.equal(last.activated, 1); assert.equal(last.invited, 1); assert.equal(last.seeded, 0);
assert.equal(last.active, 3); assert.equal(last.returning, 2); assert.equal(last.shares, 2);
const w3 = g.weeks.at(-3)!; // 14–20 дней назад: вошли A и B, активирован A, активны A и B
assert.equal(w3.joined, 2); assert.equal(w3.activated, 1); assert.equal(w3.seeded, 2); assert.equal(w3.active, 2); assert.equal(w3.returning, 0);

// первый вход: за 30 дней — A, B, C; свайпом прошёл C, остальные колодой
assert.equal(g.onboarding.swipe.joined, 1); assert.equal(g.onboarding.swipe.activation.n, 1);
assert.equal(g.onboarding.swipe.ratingsDay1, 3); assert.equal(g.onboarding.swipe.ratedDay1.n, 0);
assert.equal(g.onboarding.deck.joined, 2); assert.equal(g.onboarding.deck.activation.n, 1);
assert.equal(g.onboarding.deck.ratingsDay1, 3); assert.equal(g.onboarding.deck.ratedDay1.n, 1);
assert.deepEqual(g.onboarding.steps, { swipeDone: 1, swipeSkip: 0, favoritesDone: 1, favoritesSkip: 0 });
assert.deepEqual(g.onboarding.perPerson, { seen: 4, want: 2, no: 3, rated: 3, favorites: 2 });

// вирусность: 3 «поделился» от двух; активных за 30 дней — A, B, C, D, E (B был в день входа, 20 дней назад); по приглашению пришёл C (позвал A)
assert.equal(g.virality.shares, 3); assert.equal(g.virality.sharers, 2);
assert.equal(g.virality.sharerShare.n, 2); assert.equal(g.virality.sharerShare.of, 5);
assert.equal(g.virality.invitedJoined, 1); assert.equal(g.virality.inviters, 1);
close(g.virality.k, 0.2); close(g.virality.invitedPerSharer, 0.5);
assert.equal(g.virality.invited.activation.n, 1);
assert.deepEqual(g.virality.together, { sessions: 1, participants: 2 });
assert.deepEqual(g.virality.inline, { polls: 2, voters: 5, outsiders: 3 });

// сводка: новых за 30 дней — 3, активных — 5, WAU — 3, потрачено за 90 дней — 4 000
assert.equal(g.summary.joined30, 3); assert.equal(g.summary.active30, 5); assert.equal(g.summary.wau, 3); assert.equal(g.summary.spend90, 4000);
assert.deepEqual(g.internal, { owner: 1, testers: 2 });

console.log('growth-test: все проверки прошли');
