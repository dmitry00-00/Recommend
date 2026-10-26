// Вкладка «Путь» общего пульта (tools/desk.mts, http://127.0.0.1:8721/road/) — 25.10.
//
// Одна панель: рост участников (накопленная кривая и новые по неделям по источникам), приход и цена подписчика
// по каналам посевов и дорожная карта — ступени из STRATEGY.md §0 («К сервисам — с каких цифр») и §1 (посевы →
// голоса → Telegram Ads) с условиями входа, измеренными по живым данным. Данные — те же, что у вкладки «Рост»
// (GET /api/admin/growth, tools/growth-desk.mts: кэш минуту, токен в браузер не уходит). Условия, которых нет
// в базе (юрлицо, сайт, правовой план посевов), владелец отмечает здесь же — `.cache/road-state.json`.
//
// Сервер до 25.10 не отдаёт `history`, `totals` и `watch30`: тогда кривая и итоги — по неделям (12 недель, только
// участники, вошедшие за них), а «Смотреть» — «нет данных» до выкладки.
//
// Рыночные цены (25.10): карточки telega.in каналов реестра (tools/ad-prices.mts → .cache/ad-prices/telega-in.json) —
// CPM против потолка плана (800 ₽, ad-campaign-2310.md) и прогноз ₽ за пришедшего и активированного: доля открывших
// от охвата и активация — свои, когда по постам с охватом пришло ≥ 30; до того — допущение 1% и 50%.
//
// Хост и заголовок x-desk проверяет общий пульт.
import type { IncomingMessage, ServerResponse } from 'node:http';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { data, campaignView } from './growth-desk.mts';
import { readStore, type TelegaStore } from './ad-prices.mts';
import type { Growth, Share } from '../worker/growth.ts';

const PAGE = new URL('./road-desk.html', import.meta.url);
const STATE = '.cache/road-state.json';
const send = (res: ServerResponse, code: number, body: unknown, type = 'application/json; charset=utf-8') => {
  res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
};
const readBody = (req: IncomingMessage): Promise<string> => new Promise((ok) => {
  let s = '';
  req.on('data', (c) => { s += c; if (s.length > 1e4) req.destroy(); });
  req.on('end', () => ok(s));
});

/** Отметки владельца: то, чего нет в базе. */
export const MANUAL = {
  seed_legal: 'план посевов размечен: страна, дата, маркировка, от чьего имени (ПР-1)',
  legal_entity: 'юрлицо зарегистрировано (ТОО в Казахстане, ЗП-44)',
  site_policy: 'сайт с политикой данных — публичные страницы (ЗП-15)',
} as const;
export type ManualKey = keyof typeof MANUAL;
export type Manual = Partial<Record<ManualKey, { done: boolean; at: string }>>;

/** Доля что-то значит от 30 человек в основании (worker/funnel.ts, MIN_BASE) */
const MIN_BASE = 30;
/** Пороги беты — нижние (FLOORS воронки): ниже них продукт не держит; «Смотреть» — цель воронки */
const FLOOR = { activation: 0.4, d7: 0.15, d30: 0.07, watch: 0.08 };
const BETA = 300;
/** У канала цена активированного известна, когда пришли хотя бы 10 */
const PRICED_FROM = 10;

export interface Condition {
  id: string; label: string; kind: 'count' | 'share' | 'manual';
  value: number | null; target: number; base?: number | null;
  /** true — выполнено; false — нет; null — не измерить (мало людей или нет данных) */
  ok: boolean | null; note?: string;
}
export interface Stage {
  track: 'channels' | 'services'; id: string; step: string; title: string; who: string; with: string;
  conditions: Condition[]; status: 'open' | 'next' | 'locked'; progress: number;
}

type Body = Pick<Growth, 'summary' | 'weeks' | 'sources'> & Partial<Pick<Growth, 'history' | 'totals' | 'watch30'>> & { seedingRows?: { price: number | null }[] };
type Campaign = ReturnType<typeof campaignView>;

const count = (id: string, label: string, value: number | null, target: number, note?: string): Condition =>
  ({ id, label, kind: 'count', value, target, ok: value == null ? null : value >= target, ...(note ? { note } : {}) });
const share = (id: string, label: string, s: Pick<Share, 'share' | 'of'> | null | undefined, target: number, minBase = MIN_BASE): Condition => {
  const value = s?.share ?? null, base = s?.of ?? null;
  return { id, label, kind: 'share', value, target, base,
    ok: value == null || (base ?? 0) < minBase ? null : value >= target,
    ...((base ?? 0) < minBase ? { note: base ? `в основании ${base} — меньше ${minBase}, доля пока шум` : 'нет данных' } : {}) };
};
const manual = (m: Manual, id: ManualKey): Condition => ({ id, label: MANUAL[id], kind: 'manual', value: m[id]?.done ? 1 : 0, target: 1, ok: Boolean(m[id]?.done) });

/** Сводка для дорожной карты: цифры, ступени, темп. Чистая функция — проверка в tools/road-test.mts. */
export function roadView(g: Body, campaign: Campaign, m: Manual) {
  const exact = Boolean(g.totals);
  const joined = g.totals?.joined ?? g.weeks.reduce((a, w) => a + w.joined, 0);
  const activated = g.totals?.activated ?? g.weeks.reduce((a, w) => a + w.activated, 0);
  const wau = g.summary.wau, mau = g.summary.active30;
  const w30 = g.watch30 ?? null;
  const watch = w30 ? { share: w30.cards ? w30.cardsWithWatch / w30.cards : null, of: w30.cards } : null;
  const topPlatform = w30?.byPlatform.find((p) => p.platform) ?? null;
  const paidPosts = (g.seedingRows ?? []).filter((s) => s.price != null).length;
  const priced = campaign.channels.filter((c) => c.cost != null && c.joined >= PRICED_FROM);
  const paid = campaign.channels.filter((c) => c.cost != null);
  const spend = paid.reduce((a, c) => a + (c.cost ?? 0), 0);
  const paidActivated = paid.reduce((a, c) => a + c.activation.n, 0);
  const paidJoined = paid.reduce((a, c) => a + c.joined, 0);

  // темп: активированных за 4 последние недели — в неделю; прогноз до беты и деньги до неё по средней цене
  const last4 = g.history ? g.history.slice(-28).reduce((a, h) => a + h.activated, 0) : g.weeks.slice(-4).reduce((a, w) => a + w.activated, 0);
  const pace = last4 / 4;
  const perActivated = paidActivated ? spend / paidActivated : null;
  const toBeta = Math.max(0, BETA - activated);
  const forecast = { pace, weeksToBeta: toBeta === 0 ? 0 : pace > 0 ? toBeta / pace : null, perActivated,
    perJoined: paidJoined ? spend / paidJoined : null, budgetToBeta: perActivated != null ? toBeta * perActivated : null, toBeta };

  const s = g.summary;
  const floors = [
    share('activation', 'активация ≥ 40% (лента в первые сутки, новые за 30 дней)', s.activation30, FLOOR.activation),
    share('d7', 'вернулись на 7-й день ≥ 15%', s.d7, FLOOR.d7),
    share('d30', 'вернулись на 30-й день ≥ 7%', s.d30, FLOOR.d30),
  ];
  const beta = count('beta', `активированных ≥ ${BETA} — бета (ЗП-13)`, activated, BETA);
  const pricedC = count('priced', `каналов с ценой активированного (от ${PRICED_FROM} пришедших) ≥ 3`, priced.length, 3);
  const raw: Omit<Stage, 'status' | 'progress'>[] = [
    { track: 'channels', id: 'k0', step: 'К0', title: 'Обмен видимостью', who: 'авторы из реестра, 15 партнёров (partners-2310), каналы сервисов',
      with: 'страница автора v-<id> и статистика переходов — обмен, не покупка; erid и для бартера', conditions: [] },
    { track: 'channels', id: 'k1', step: 'К1', title: 'Посевы-проба: 5–10 постов', who: 'кино-каналы 10–100 тыс.: Казахстан и зарубежье; российские — до 31.12.2026 и с erid',
      with: 'пост с пользой и ссылка startapp на карточку фильма с меткой --s<канал>', conditions: [manual(m, 'seed_legal')] },
    { track: 'channels', id: 'k2', step: 'К2', title: 'Посевы шире — в лучшие каналы', who: 'каналы с самой дешёвой ценой активированного и их соседи по тематике',
      with: 'повтор формата, который дал активацию', conditions: [count('posts', 'платных постов ≥ 5', paidPosts, 5), pricedC, floors[0]] },
    { track: 'channels', id: 'k3', step: 'К3', title: 'Голоса: письма 20 эссеистам', who: 'эссеисты, чьи разборы чаще всего открывают в приложении (ЗП-14)',
      with: '«к вашим роликам пришло N» — цифры посевов и переходов', conditions: [beta, pricedC] },
    { track: 'channels', id: 'k4', step: 'К4', title: 'Telegram Ads из Казахстана', who: 'Telegram Ads, тест €100–200 (ПР-6)',
      with: 'реклама — только когда удержание держит', conditions: [beta, ...floors] },
    { track: 'services', id: 's0', step: 'С0', title: 'Партнёрские сети', who: 'Литрес, Apple Performance Partners, Admitad (Иви, PREMIER), Kobo',
      with: 'заявка в сеть; ссылки только в «где смотреть / купить»', conditions: [manual(m, 'legal_entity'), manual(m, 'site_policy')] },
    { track: 'services', id: 's1', step: 'С1', title: 'Нишевые площадки', who: 'издательства, школы кино, фестивали, нишевые кинотеатры',
      with: 'тестовая полка с меткой и отчёт по переходам к ним',
      conditions: [beta, ...floors, share('watch', '«Смотреть» ≥ 8% открытых карточек (30 дней)', watch, FLOOR.watch, 100)] },
    { track: 'services', id: 's2', step: 'С2', title: 'Средние кинотеатры', who: 'личная ставка CPA, промокоды, совместные подборки',
      with: 'переходы и старты подписки по их площадке за месяц',
      conditions: [count('wau', 'активных за неделю ≥ 1 000', wau, 1000),
        count('platform', 'переходов к одному сервису за 30 дней ≥ 100', topPlatform?.n ?? (w30 ? 0 : null), 100, topPlatform ? `лидер — ${topPlatform.platform}` : w30 ? undefined : 'нет данных до выкладки')] },
    { track: 'services', id: 's3', step: 'С3', title: 'Крупные кинотеатры — сомаркетинг', who: 'крупные кинотеатры вне России; российские — через веб (ЗП-15)',
      with: 'переходы, старты подписки и удержание пришедших', conditions: [count('mau', 'активных за 30 дней ≥ 10 000', mau, 10_000), floors[2]] },
    { track: 'services', id: 's4', step: 'С4', title: 'B2B: данные восприятия и движок', who: 'кинотеатры и издательства — пилот одной механики (ЗП-34)',
      with: 'своя разметка восприятия и движок для чужого каталога', conditions: [count('mau', 'активных за 30 дней ≥ 50 000', mau, 50_000)] },
  ];
  // ступень открыта, когда выполнены все условия; первая неоткрытая в дорожке — «следующая», дальше — закрыты
  // доля на малом основании (ok = null) в прогресс не идёт: 100% от четырёх человек — не шаг к порогу
  const prog = (c: Condition) => (c.value == null || c.ok === null ? 0 : Math.min(1, c.value / c.target));
  const stages: Stage[] = [];
  for (const track of ['channels', 'services'] as const) {
    let next = false;
    for (const st of raw.filter((x) => x.track === track)) {
      const open = st.conditions.every((c) => c.ok === true);
      const status = open ? 'open' : next ? 'locked' : 'next';
      if (!open) next = true;
      stages.push({ ...st, status, progress: st.conditions.length ? st.conditions.reduce((a, c) => a + prog(c), 0) / st.conditions.length : 1 });
    }
  }
  return {
    exact, numbers: { joined, activated, wau, mau, spend, paidPosts, pricedChannels: priced.length, watch, topPlatform },
    forecast, stages, manual: Object.entries(MANUAL).map(([id, label]) => ({ id, label, done: Boolean(m[id as ManualKey]?.done), at: m[id as ManualKey]?.at ?? null })),
  };
}

/** потолок плана: покупаем пост, если CPM ≤ 800 ₽ (CPV ≤ 0,8 ₽) */
export const CPM_CEILING = 800;
const ASSUMED = { open: 0.01, activation: 0.5 };

/** Рынок: цены каналов реестра на бирже, прогноз цены подписчика и «во что обойдётся бета самыми дешёвыми». */
export function marketView(store: TelegaStore, campaign: Campaign, list: { u: string; title?: string; theme?: string; wide?: boolean }[], toBeta: number) {
  const meta = new Map(list.map((c) => [c.u.toLowerCase(), c]));
  // свои цифры — по каналам, у которых записан охват поста
  const withReach = campaign.channels.filter((c) => c.reach);
  const reach = withReach.reduce((a, c) => a + (c.reach ?? 0), 0), joined = withReach.reduce((a, c) => a + c.joined, 0);
  const act = campaign.channels.reduce((a, c) => ({ n: a.n + c.activation.n, of: a.of + c.activation.of }), { n: 0, of: 0 });
  const measuredOpen = joined >= MIN_BASE && reach ? joined / reach : null;
  const measuredAct = act.of >= MIN_BASE ? act.n / act.of : null;
  const open = measuredOpen ?? ASSUMED.open, activation = measuredAct ?? ASSUMED.activation;
  const posted = new Set(campaign.channels.map((c) => c.channel));
  const rows = Object.entries(store.channels).filter(([u, c]) => c.status === 'ok' && c.snapshots.length && (!list.length || meta.has(u.toLowerCase()))).map(([u, c]) => {
    const s = c.snapshots.at(-1)!;
    const prices = Object.values(s.prices);
    const price = s.prices['1/24'] ?? (prices.length ? Math.min(...prices) : null);
    const cpm = price != null && s.reach24 ? (price / s.reach24) * 1000 : null;
    const expJoined = s.reach24 ? s.reach24 * open : null;
    const perJoined = price != null && expJoined ? price / expJoined : null;
    const prevPrice = c.snapshots.length > 1 ? (c.snapshots.at(-2)!.prices['1/24'] ?? null) : null;
    return { u, title: meta.get(u.toLowerCase())?.title ?? null, theme: meta.get(u.toLowerCase())?.theme ?? null, at: s.at,
      subs: s.subs, subsMonth: s.subsMonth, reach24: s.reach24, err24: s.err24, orders: s.orders, price, priceChange: prevPrice != null && price != null ? price - prevPrice : null,
      cpm, withinCeiling: cpm != null ? cpm <= CPM_CEILING : null, expJoined, expActivated: expJoined != null ? expJoined * activation : null,
      perJoined, perActivated: perJoined != null ? perJoined / activation : null,
      posted: posted.has(`tg_${u.toLowerCase()}`.slice(0, 24)), wide: Boolean(meta.get(u.toLowerCase())?.wide) };
  }).sort((a, b) => (a.perActivated ?? Infinity) - (b.perActivated ?? Infinity) || a.u.localeCompare(b.u));
  // бета самыми дешёвыми: по одному посту в канал в потолке плана, пока ожидаемых активированных не хватит
  let cost = 0, got = 0, posts = 0;
  for (const r of rows) {
    if (got >= toBeta) break;
    if (!r.withinCeiling || r.price == null || r.expActivated == null) continue;
    cost += r.price; got += r.expActivated; posts++;
  }
  const cpms = rows.map((r) => r.cpm).filter((x): x is number => x != null).sort((a, b) => a - b);
  // по темам (25.10): соседние темы (wide, tools/ad-catalog.mts) против кино и книг — где дешевле охват
  const themes = new Map<string, { theme: string; wide: boolean; n: number; cpms: number[]; within: number; perActivated: number[] }>();
  for (const r of rows) {
    const k = r.theme ?? '—';
    const t = themes.get(k) ?? themes.set(k, { theme: k, wide: r.wide, n: 0, cpms: [], within: 0, perActivated: [] }).get(k)!;
    t.n++; if (r.cpm != null) t.cpms.push(r.cpm); if (r.withinCeiling) t.within++; if (r.perActivated != null) t.perActivated.push(r.perActivated);
  }
  const med = (xs: number[]) => { const v = [...xs].sort((a, b) => a - b); return v.length ? v[Math.floor(v.length / 2)] : null; };
  const byTheme = [...themes.values()].map((t) => ({ theme: t.theme, wide: t.wide, n: t.n, medianCpm: med(t.cpms), withinCeiling: t.within, minPerActivated: t.perActivated.length ? Math.min(...t.perActivated) : null }))
    .sort((a, b) => (a.medianCpm ?? Infinity) - (b.medianCpm ?? Infinity));
  // только каналы нынешнего списка (25.10): выпавшие из выбора соседних тем не считаются «нет на бирже»
  const counts = { ok: 0, absent: 0, error: 0 };
  const listed = list.length ? new Set(list.map((c) => c.u.toLowerCase())) : undefined;
  for (const [u, c] of Object.entries(store.channels)) if (!listed || listed.has(u.toLowerCase())) counts[c.status]++;
  return {
    updatedAt: store.updatedAt, listed: list.length, wideListed: list.filter((c) => c.wide).length, counts, rows, byTheme,
    medianCpm: cpms.length ? cpms[Math.floor(cpms.length / 2)] : null, withinCeiling: rows.filter((r) => r.withinCeiling).length, ceiling: CPM_CEILING,
    rates: { open, activation, measuredOpen: measuredOpen != null, measuredActivation: measuredAct != null, basis: { reach, joined, activated: act.n, of: act.of } },
    beta: { toBeta, posts, cost, expectedActivated: got, enough: got >= toBeta },
  };
}

const readState = (): Manual => { try { return existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf8')) as Manual : {}; } catch { return {}; } };

export async function roadRoute(req: IncomingMessage, res: ServerResponse, path: string): Promise<void> {
  const params = new URL(req.url ?? '/', 'http://x').searchParams;
  if ((path === '/' || path === '/index.html') && req.method === 'GET') return send(res, 200, readFileSync(PAGE, 'utf8'), 'text/html; charset=utf-8');
  if (path === '/api/data' && req.method === 'GET') {
    const r = await data(params, params.has('fresh'));
    if (r.code !== 200) return send(res, r.code, r.body);
    const body = r.body as Body & Parameters<typeof campaignView>[0];
    const campaign = campaignView(body);
    const road = roadView(body, campaign, readState());
    let list: { u: string; title?: string; theme?: string; wide?: boolean }[] = [];
    try { list = (JSON.parse(readFileSync('.cache/ad-prices/telega-in-channels.json', 'utf8')) as { channels: typeof list }).channels; } catch { /* списка ещё нет */ }
    return send(res, 200, { ...body, campaign, road, market: marketView(readStore(), campaign, list, road.forecast.toBeta) });
  }
  if (path === '/api/manual' && req.method === 'PUT') {
    const b = JSON.parse((await readBody(req)) || '{}') as { id?: string; done?: boolean };
    if (!b.id || !(b.id in MANUAL)) return send(res, 400, { error: 'bad_id' });
    const st = readState();
    st[b.id as ManualKey] = { done: Boolean(b.done), at: new Date().toISOString() };
    mkdirSync('.cache', { recursive: true });
    writeFileSync(STATE, JSON.stringify(st, null, 1));
    return send(res, 200, { ok: true });
  }
  return send(res, 404, { error: 'not_found' });
}
