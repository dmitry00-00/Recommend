// Проверка МА-3 (worker/engagement.ts) на синтетике с ответом, посчитанным руками (14.10).
//
//   npx tsx tools/engagement-test.mts
//
// Сегодня — 14.10 (по Москве); `at(-3)` — три дня назад в полдень по Москве. Кто есть кто:
//   голоса: «Сыендук» (yt:Сыендук) — 3 открытия от A, A, B: 20-минутный ролик, вернулись через 15 мин (дочитал:
//     ≥ 10 мин), через 3 мин (нет), третий без замера; пост «tg:kinoman» — 2 открытия, 70 с (дочитал: без длины — минута)
//     и 30 с (нет); открытие без автора — в общем счёте, не в голосах;
//   поделились: A — фильм карточкой (2 дня назад), B — «вместе» ссылкой (5 дней), A — позвал друга (20 дней назад, вне
//     недели); активных за 7 дней — A, B, C (3), за 30 — A, B, C, D (4);
//   новые: 5 — kinoman ×2 (один позван), позван без метки ×1, сами ×2 → сами 2 из 5;
//   настроение: 3 запроса (два одинаковых с разным регистром), 2 открытия из ответа; вопрос о шкале — 1;
//   оценки после показа: через 0,5 дня, 2 дня, 4 дня → медиана 2, в первые сутки 1/3, через 3 и позже 1/3.
import assert from 'node:assert/strict';
import { computeEngagement, readThrough, type EngagementRows } from '../worker/engagement.ts';

const at = (d: number, h = 9) => new Date(Date.UTC(2026, 9, 14 + d, h)).toISOString();
const day = (d: number) => at(d).slice(0, 10);
const ev = (user_id: string, kind: string, d: number, detail: string | null = null, place: string | null = null, work_id: string | null = null) =>
  ({ user_id, kind, work_id, place, detail, at: at(d) });

const rows: EngagementRows = {
  today: day(0),
  opens: [
    { user_id: 'A', voice_id: 'yt:Сыендук', minutes: 20, dwell: 15 * 60, at: at(-3) },
    { user_id: 'A', voice_id: 'yt:Сыендук', minutes: 20, dwell: 3 * 60, at: at(-2) },
    { user_id: 'B', voice_id: 'yt:Сыендук', minutes: 20, dwell: null, at: at(-1) },
    { user_id: 'C', voice_id: 'tg:kinoman', minutes: null, dwell: 70, at: at(-1) },
    { user_id: 'C', voice_id: 'tg:kinoman', minutes: null, dwell: 30, at: at(-1) },
    { user_id: 'D', voice_id: null, minutes: null, dwell: 100, at: at(-10) },
  ],
  events: [
    ev('A', 'share_sent', -2, 'film:message', 'today', 'f-1'),
    ev('B', 'share_sent', -5, 'together:copied', 'together'),
    ev('A', 'share_sent', -20, 'friend:telegram', 'settings'),
    ev('A', 'mood_query', -1, 'Тихое про семью', 'screen'),
    ev('B', 'mood_query', -1, 'тихое  про семью', 'screen'),
    ev('C', 'mood_query', -3, 'страшное', 'screen'),
    ev('A', 'card', -1, null, 'mood', 'f-2'),
    ev('B', 'card', -1, null, 'mood', 'f-3'),
    ev('C', 'survey_answered', -2, 'scale:7', 'today'),
  ],
  visits: [['A', -1], ['B', -2], ['C', -6], ['D', -15]].map(([u, d]) => ({ user_id: u as string, day: day(d as number) })),
  joined: [
    { source: 'kinoman', invited_by: null }, { source: 'kinoman', invited_by: 'A' },
    { source: null, invited_by: 'B' }, { source: null, invited_by: null }, { source: null, invited_by: null },
  ],
  rated: [{ shown: at(-5), rated: at(-5, 21) }, { shown: at(-6), rated: at(-4) }, { shown: at(-9), rated: at(-5) }],
};

const E = computeEngagement(rows);

assert.equal(readThrough({ minutes: 20, dwell: 600 }), true);
assert.equal(readThrough({ minutes: 20, dwell: 599 }), false);
assert.equal(readThrough({ minutes: null, dwell: 60 }), true);
assert.equal(readThrough({ minutes: 1, dwell: 45 }), false, 'короткий ролик — всё равно не меньше минуты');

assert.deepEqual(E.opens, { n: 6, withVoice: 5, timed: 5, through: 3, throughShare: 3 / 5, medianDwell: 100 });
assert.deepEqual(E.voices[0], { voiceId: 'yt:Сыендук', opens: 3, users: 2, timed: 2, through: 1, throughShare: 0.5, medianDwell: (900 + 180) / 2 });
assert.deepEqual(E.voices[1], { voiceId: 'tg:kinoman', opens: 2, users: 1, timed: 2, through: 1, throughShare: 0.5, medianDwell: 50 });
assert.equal(E.voices.length, 2);

assert.deepEqual(E.sharing.week, { n: 2, users: 2, active: 3, per100: (2 / 3) * 100 });
assert.deepEqual(E.sharing.month, { n: 3, users: 2, active: 4, per100: 75 });
assert.deepEqual(E.sharing.what.map((x) => x.k).sort(), ['film', 'friend', 'together']);
assert.deepEqual(E.sharing.how.find((x) => x.k === 'message'), { k: 'message', n: 1 });

assert.equal(E.newcomers.joined, 5);
assert.equal(E.newcomers.invited, 2);
assert.equal(E.newcomers.seeded, 2);
assert.equal(E.newcomers.organic, 2);
assert.equal(E.newcomers.organicShare, 0.4);
assert.deepEqual(E.newcomers.sources[0], { source: '—', joined: 3, invited: 1 });

assert.equal(E.mood.queries, 3);
assert.equal(E.mood.users, 3);
assert.equal(E.mood.opens, 2);
assert.deepEqual(E.mood.top[0], { text: 'тихое про семью', n: 2 });

assert.deepEqual(E.surveys, [{ survey: 'scale', n: 1, users: 1 }]);

assert.equal(E.ratingDelay.n, 3);
assert.equal(E.ratingDelay.medianDays, 2);
assert.equal(E.ratingDelay.within1, 1 / 3);
assert.equal(E.ratingDelay.after3, 1 / 3);

console.log('МА-3: все проверки прошли');
