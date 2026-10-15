import type { WatchKind } from './cinemas';

/** Какая подписка подходит (15.10, владелец: «в дополнение к Смотреть — помощь в выборе подписки со сравнением
 *  стоимости и того, что есть»). Не «у кого больше фильмов» вообще — это есть везде, — а по списку человека: его
 *  «В планах» (вес 2: он сам сказал, что хочет) и верх его ленты (вес 1). Три ответа:
 *  - площадки по тому, сколько из списка в них есть, и цена за месяц;
 *  - пара, которая вместе закрывает больше всего;
 *  - подписки по очереди: месяц там, где больше всего из оставшегося, потом следующая — люди и так подключают и
 *    отключают подписки, а такого расчёта никто не делает.
 *  Бесплатное и то, что уже есть в подписках человека, в расчёт не идёт: за это платить не надо. Чистая функция —
 *  данные наличия и цены приходят снаружи (tools/subscription-plan-test.mts). */

export interface PlanItem<W> { work: W; planned: boolean }
export interface PlanOption { slug: string; kind?: WatchKind }

export interface ProviderCover<W> {
  slug: string;
  planned: W[];
  liked: W[];
  /** вес покрытия: «В планах» — 2, лента — 1 */
  score: number;
  /** ₽ (или валюта региона) за месяц; нет цены — undefined */
  price?: number;
}

export interface RotationMonth<W> { slug: string; works: W[]; price?: number }

export interface SubscriptionPlan<W> {
  /** площадки по весу покрытия, сначала лучшие; без площадок, где из списка ничего нет */
  providers: ProviderCover<W>[];
  /** две площадки, вместе закрывающие больше всего (если вторая что-то добавляет) */
  pair?: { slugs: [string, string]; score: number; count: number; price?: number };
  /** подписки по очереди: месяц на площадку, пока очередная добавляет хотя бы MIN_GAIN */
  rotation: RotationMonth<W>[];
  /** уже можно смотреть без доплаты: бесплатно или в подписке человека */
  covered: W[];
  /** ни на одной площадке по подписке */
  nowhere: W[];
  total: number;
}

const WEIGHT = (i: { planned: boolean }) => (i.planned ? 2 : 1);
/** очередной месяц подписки — если добавляет хотя бы столько веса (один фильм из планов или два из ленты) */
const MIN_GAIN = 2;
const MAX_MONTHS = 4;

export function planSubscriptions<W>(
  items: PlanItem<W>[],
  optionsOf: (w: W) => PlanOption[],
  owned: readonly string[],
  prices: Readonly<Record<string, number>> = {},
): SubscriptionPlan<W> {
  const covered: W[] = [], nowhere: W[] = [];
  // кому что нужно: только то, за что пришлось бы платить
  const need: { item: PlanItem<W>; slugs: Set<string> }[] = [];
  for (const item of items) {
    const opts = optionsOf(item.work);
    if (opts.some((o) => o.kind === 'free' || o.kind === 'ads' || (o.kind === 'subscription' && owned.includes(o.slug)))) { covered.push(item.work); continue; }
    const slugs = new Set(opts.filter((o) => o.kind === 'subscription').map((o) => o.slug));
    if (!slugs.size) { nowhere.push(item.work); continue; }
    need.push({ item, slugs });
  }

  const by = new Map<string, ProviderCover<W>>();
  for (const { item, slugs } of need) for (const slug of slugs) {
    const p = by.get(slug) ?? { slug, planned: [], liked: [], score: 0, ...(prices[slug] != null ? { price: prices[slug] } : {}) };
    (item.planned ? p.planned : p.liked).push(item.work);
    p.score += WEIGHT(item);
    by.set(slug, p);
  }
  // при равном покрытии — дешевле выше
  const providers = [...by.values()].sort((a, b) => b.score - a.score || (a.price ?? Infinity) - (b.price ?? Infinity) || a.slug.localeCompare(b.slug));

  const gain = (slug: string, taken: Set<number>) => need.reduce((s, n, i) => s + (!taken.has(i) && n.slugs.has(slug) ? WEIGHT(n.item) : 0), 0);

  // пара: перебор первых десяти — площадок в регионе немного
  let pair: SubscriptionPlan<W>['pair'];
  const top = providers.slice(0, 10).map((p) => p.slug);
  for (let i = 0; i < top.length; i++) for (let j = i + 1; j < top.length; j++) {
    const hit = need.filter((n) => n.slugs.has(top[i]) || n.slugs.has(top[j]));
    const score = hit.reduce((s, n) => s + WEIGHT(n.item), 0);
    const price = prices[top[i]] != null && prices[top[j]] != null ? prices[top[i]] + prices[top[j]] : undefined;
    if (!pair || score > pair.score || (score === pair.score && (price ?? Infinity) < (pair.price ?? Infinity))) {
      pair = { slugs: [top[i], top[j]], score, count: hit.length, ...(price != null ? { price } : {}) };
    }
  }
  // вторая площадка ничего не добавляет к первой — пары нет
  if (pair && providers[0] && pair.score <= providers[0].score) pair = undefined;

  // по очереди: жадно — каждый месяц площадка с наибольшим приростом из оставшегося
  const rotation: RotationMonth<W>[] = [];
  const taken = new Set<number>();
  while (rotation.length < MAX_MONTHS) {
    let best: string | undefined, bestGain = 0;
    for (const p of providers) {
      const g = gain(p.slug, taken);
      if (g > bestGain || (g === bestGain && best && (prices[p.slug] ?? Infinity) < (prices[best] ?? Infinity))) { best = p.slug; bestGain = g; }
    }
    if (!best || bestGain < MIN_GAIN) break;
    const works: W[] = [];
    need.forEach((n, i) => { if (!taken.has(i) && n.slugs.has(best!)) { taken.add(i); works.push(n.item.work); } });
    rotation.push({ slug: best, works, ...(prices[best] != null ? { price: prices[best] } : {}) });
  }

  return { providers, pair, rotation, covered, nowhere, total: items.length };
}
