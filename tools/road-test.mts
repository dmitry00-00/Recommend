// Проверка вкладки «Путь» (tools/road-desk.mts, 25.10): ступени дорожной карты, темп и цена — на синтетике через
// computeGrowth → campaignView → roadView, без сервера. `npx tsx tools/road-test.mts`
import assert from 'node:assert/strict';
import { computeGrowth, type GrowthRows } from '../worker/growth.ts';
import { campaignView } from './growth-desk.mts';
import { roadView, marketView } from './road-desk.mts';
import { parseTelegaCard, type TelegaStore } from './ad-prices.mts';
import { parseCatalogPage, pickWide } from './ad-catalog.mts';
import { supportLink, supportOf } from './voice-support.mts';

const at = (d: number, h = 9) => new Date(Date.UTC(2026, 9, 25 + d, h)).toISOString();
const day = (d: number) => at(d).slice(0, 10);

// 40 пришли с канала kino (35 активированы в первые сутки, у всех — визит через 7 и 30 дней), 5 — сами
const users: GrowthRows['users'] = [];
const visits: GrowthRows['visits'] = [];
const firstFeed: GrowthRows['firstFeed'] = [];
for (let i = 0; i < 45; i++) {
  const d = -60 + (i % 20);
  users.push({ id: `u${i}`, created_at: at(d), source: i < 40 ? 'tg_kino' : null, invited_by: null });
  visits.push({ user_id: `u${i}`, day: day(d) }, { user_id: `u${i}`, day: day(d + 7) }, { user_id: `u${i}`, day: day(d + 30) });
  if (i < 35) firstFeed.push({ user_id: `u${i}`, at: at(d, 10) });
}
const rows: GrowthRows = {
  today: day(0), users, visits, firstFeed, ratingsDay1: [], onboard: [], shares: [],
  together: { sessions: 0, participants: 0 }, inline: { polls: 0, voters: 0, outsiders: 0 },
  seeding: [{ id: 'sd-000000000001', label: 'tg_kino', channel: '@kino', posted_at: day(-61), price: 7000, currency: 'RUB', note: 'охват 8000' }],
  internal: { owner: 0, testers: 0 },
  watch30: { cards: 200, cardsWithWatch: 20, byPlatform: [{ platform: 'ivi', n: 12 }, { platform: null, n: 3 }] },
};
const g = computeGrowth(rows);
const body = { ...g, seedingRows: rows.seeding };
const campaign = campaignView(body);
const r = roadView(body, campaign, {});
const st = (id: string) => r.stages.find((s) => s.id === id)!;
const cond = (sid: string, cid: string) => st(sid).conditions.find((c) => c.id === cid)!;

assert.equal(r.exact, true);
assert.equal(r.numbers.joined, 45); assert.equal(r.numbers.activated, 35);
assert.equal(r.numbers.spend, 7000); assert.equal(r.numbers.paidPosts, 1); assert.equal(r.numbers.pricedChannels, 1);
assert.equal(r.numbers.watch!.share, 0.1); assert.deepEqual(r.numbers.topPlatform, { platform: 'ivi', n: 12 });
assert.equal(r.forecast.perActivated, 7000 / 35); assert.equal(r.forecast.toBeta, 265);
assert.equal(r.forecast.budgetToBeta, 265 * 200);

// К0 без условий — открыта; К1 ждёт отметки о правовом плане; дальше — закрыты
assert.equal(st('k0').status, 'open'); assert.equal(st('k1').status, 'next'); assert.equal(st('k2').status, 'locked');
// новых за 30 дней нет — доля активации «не измерить», а не «нет»
assert.equal(cond('k2', 'activation').ok, null);
assert.equal(cond('k2', 'posts').ok, false); assert.equal(cond('k2', 'priced').value, 1);
// С0 — две отметки владельца; С1 — бета не набрана, «Смотреть» 10% от 200 карточек проходит
assert.equal(st('s0').status, 'next'); assert.equal(st('s0').progress, 0);
assert.equal(cond('s1', 'beta').ok, false); assert.equal(cond('s1', 'watch').ok, true);
assert.equal(cond('s2', 'platform').value, 12);

// отметки владельца открывают К1 и С0; следующей становится К2 и С1
const r2 = roadView(body, campaign, { seed_legal: { done: true, at: '' }, legal_entity: { done: true, at: '' }, site_policy: { done: true, at: '' } });
assert.equal(r2.stages.find((s) => s.id === 'k1')!.status, 'open'); assert.equal(r2.stages.find((s) => s.id === 'k2')!.status, 'next');
assert.equal(r2.stages.find((s) => s.id === 's0')!.status, 'open'); assert.equal(r2.stages.find((s) => s.id === 's1')!.status, 'next');

// сервер без history/totals/watch30: итоги по неделям, «Смотреть» — нет данных
const { history: _h, totals: _t, watch30: _w, ...old } = body;
const r3 = roadView(old, campaign, {});
assert.equal(r3.exact, false); assert.equal(r3.numbers.watch, null);
assert.equal(r3.stages.find((s) => s.id === 's1')!.conditions.find((c) => c.id === 'watch')!.ok, null);
assert.equal(r3.stages.find((s) => s.id === 's2')!.conditions.find((c) => c.id === 'platform')!.value, null);

// ── карточка telega.in (25.10): фрагменты разметки, как на странице @krylovme
{
  const html = `<meta name="description" content="… Telegram-канал «@krylovme». Подписчиков: 33363. Стоимость от 18 181.80 руб."/>
    <div class="format-control__item"><div class="format-control__name">1/24</div><div class="format-control__price"><span class='amount ru'>18 181<sup class='pennies'>.80</sup></span><span class="b-rub">₽</span></div></div>
    <div class="format-control__item"><div class="format-control__name">Нативный</div><div class="format-control__price"><span class='amount ru'>22 377<sup class='pennies'>.60</sup></span><span class="b-rub">₽</span></div></div>
    <div class="partners__item"><div class="partners__item-label">Средний охват (24ч)</div><div class="partners__item-text">7094.0</div></div>
    <div class="statistic__item"><i>thumb_up</i><div class="statistic__item-label">ER</div><div class="statistic__item-text">6.75</div></div>
    <div class="statistic__item"><i>payments</i><div class="statistic__item-label">CPV:</div><div class="statistic__item-text">lock_outline</div></div>
    <div class="analitic-telega__item"><div class="analitic-telega__text">-1304</div><div class="analitic-telega__caption">за месяц</div></div>
    <div class="analitic-telega__item"><div class="analitic-telega__text">21.26</div><div class="analitic-telega__caption">ERR за 24 часа</div></div>
    <div class="analitic-history__item"><div class="analitic-history__value">26</div><div class="analitic-history__label">Выполненных заказов на Telega.in</div></div>`;
  const c = parseTelegaCard(html, 'x');
  assert.equal(c.subs, 33363); assert.deepEqual(c.prices, { '1/24': 18181.8, 'Нативный': 22377.6 });
  assert.equal(c.reach24, 7094); assert.equal(c.er, 6.75); assert.equal(c.err24, 21.26); assert.equal(c.subsMonth, -1304); assert.equal(c.orders, 26);

  // рынок: CPM против потолка 800 ₽; до 30 пришедших по постам с охватом — допущение 1% и 50%
  const snap = (price: number, reach: number) => ({ ...c, prices: { '1/24': price }, reach24: reach });
  const store: TelegaStore = { updatedAt: 'x', channels: {
    cheap: { status: 'ok', checkedAt: 'x', snapshots: [snap(4000, 10_000)] },      // CPM 400
    dear: { status: 'ok', checkedAt: 'x', snapshots: [snap(18_000, 7000)] },       // CPM ~2571
    gone: { status: 'absent', checkedAt: 'x', snapshots: [] },
  } };
  const mk = marketView(store, campaign, [{ u: 'cheap', theme: 'кино' }, { u: 'dear' }, { u: 'gone' }], 265);
  assert.deepEqual(mk.counts, { ok: 2, absent: 1, error: 0 });
  assert.equal(mk.rows[0].u, 'cheap'); assert.equal(mk.rows[0].cpm, 400); assert.equal(mk.rows[0].withinCeiling, true);
  // посев kino: охват 8000, пришли 40 (≥ 30) — доли свои: 0,5% открывают, 35 из 40 активированы
  assert.equal(mk.rates.measuredOpen, true); assert.equal(mk.rates.open, 0.005); assert.equal(mk.rates.activation, 35 / 40);
  assert.equal(mk.rows[0].expJoined, 50); assert.equal(mk.rows[0].perJoined, 80); assert.ok(Math.abs(mk.rows[0].perActivated! - 80 / 0.875) < 1e-9);
  assert.equal(mk.rows[1].withinCeiling, false);
  // бета: в потолке только cheap — один пост, 4000 ₽, ~43,75 активированного из 265 — не хватит
  assert.deepEqual({ posts: mk.beta.posts, cost: mk.beta.cost, enough: mk.beta.enough }, { posts: 1, cost: 4000, enough: false });
  // без своих посевов — допущение 1% и 50%
  const bare = marketView(store, { ...campaign, channels: [] }, [], 300);
  assert.equal(bare.rates.measuredOpen, false); assert.equal(bare.rows[0].expJoined, 100); assert.equal(bare.rows[0].perActivated, 80);

  // соседние темы (25.10): wide-каналы — своя строка в сводке по темам
  const wideMk = marketView(store, campaign, [{ u: 'cheap', theme: 'кино' }, { u: 'dear', theme: 'История', wide: true }], 265);
  assert.equal(wideMk.wideListed, 1); assert.equal(wideMk.rows.find((x) => x.u === 'dear')!.wide, true);
  assert.deepEqual(wideMk.byTheme.map((t) => [t.theme, t.wide, t.withinCeiling]), [['кино', false, 1], ['История', true, 0]]);
}

// ── тематическая страница каталога telega.in (25.10): видимое берём, data-* с ценами — нет
{
  const item = (u: string, subs: number, err: number, badge = 'telegram') => `<div class="channels-item mb-8px p-8px channel_1" data-id="1"><span class="badge middle ${badge} mb-8px">TG</span><a href="/channels/${u}/card">
    <img alt="Логотип Телеграм канала @${u}"><div class="font-18px bold" title="Канал ${u}">Канал</div><div class="info-description">Про &quot;${u}&quot;</div>
    <span class="channel-users-count" data-count="${subs}">${subs}</span> ERR: ${err}% <li data-avg-post-reach="999" data-placements-prices="[{&quot;price&quot;:1}]">1/24</li></div>`;
  const page = item('lang_a', 40_000, 6) + item('lang_b', 3000, 20) + item('lang_c', 90_000, 2) + item('lang_d', 20_000, 9)
    + item('club7491', 50_000, 9, 'max') + `<div class="channels-item mb-8px"><span class="badge middle telegram mb-8px">TG</span><a href="/channels/+AbC/card">без ника</a></div>`;
  const found = parseCatalogPage(page, 'Иностранные языки');
  assert.deepEqual(found.map((c) => c.u), ['lang_a', 'lang_b', 'lang_c', 'lang_d']);
  assert.equal(found[0].subs, 40_000); assert.equal(found[0].err, 6); assert.equal(found[0].desc, 'Про "lang_a"'); assert.equal(found[0].title, 'Канал lang_a');
  assert.ok(!JSON.stringify(found).includes('999'));
  // от 5 тыс. и ERR от 5%, по охвату (40 000 × 6 > 20 000 × 9); уже известные — мимо
  assert.deepEqual(pickWide(found, 30, new Set()).map((c) => c.u), ['lang_a', 'lang_d']);
  assert.deepEqual(pickWide(found, 1, new Set(['lang_a'])).map((c) => c.u), ['lang_d']);
}

// ── как поддержать автора (25.10, tools/voice-support.mts)
{
  assert.deepEqual(supportLink('https://boosty.to/rvwr/posts/b4bc'), { s: 'boosty', u: 'https://boosty.to/rvwr' });
  assert.deepEqual(supportLink('https://t.me/tribute/app?startapp=p8rh'), { s: 'tribute', u: 'https://t.me/tribute/app?startapp=p8rh' });
  assert.equal(supportLink('https://web.tribute.tg/away?t=ad&u=x'), undefined);           // рекламный переход Tribute
  assert.equal(supportLink('https://www.patreon.com/posts/zadacha-trekh-32943734'), undefined); // пост, не профиль
  assert.deepEqual(supportLink('https://www.patreon.com/kinoman'), { s: 'patreon', u: 'https://www.patreon.com/kinoman' });
  assert.equal(supportLink('https://t.me/somechannel'), undefined);
  const p = (id: number, text: string, extra: object = {}) => ({ id, text, tags: [], links: [], ...extra });
  const got = supportOf({
    channel: { about: 'Поддержать канал: https://www.tbank.ru/cf/abc', at: 'x' },
    posts: [
      p(1, 'новый разбор https://boosty.to/kino'), p(2, 'и снова https://boosty.to/kino/posts/1'),
      p(3, 'Реклама. erid 2Vtzq — подпишитесь https://boosty.to/chuzhoy'),          // реклама — мимо
      p(4, 'переслано https://www.patreon.com/drugoy', { forwardedFrom: 'Другой канал' }), // пересылка — мимо
      p(5, 'кнопка', { buttons: [{ url: 'https://t.me/tribute/app?startapp=d1' }] }),
    ],
  });
  // описание канала весит больше постов; чужое из рекламы и пересылок — не попало
  assert.deepEqual(got.map((x) => [x.s, x.from]), [['tbank', 'about'], ['boosty', 'posts'], ['tribute', 'posts']]);
  assert.equal(got[1].u, 'https://boosty.to/kino');
}

console.log('road-test: все проверки прошли');
