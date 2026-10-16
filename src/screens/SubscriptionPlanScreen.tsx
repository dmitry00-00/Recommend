import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { WorkCard } from '@/types/tmdf';
import { getSubscriptionPlan, type SubscriptionPlanView } from '@/api';
import { titleOf } from '@/lib/format';
import { Skeleton } from '@/components/Skeleton';
import { ErrorState } from '@/components/ErrorState';
import ui from '@/i18n';

const SHOW = 5;

/** «Какая подписка вам подходит» (/subscriptions, 15.10): по «В планах» и ленте человека — подписки по очереди, пара и
 *  каждая площадка отдельно, с ценой за месяц и за фильм. Расчёт — src/lib/subscriptionPlan.ts, цены —
 *  src/lib/cinemaPrices.ts. Иви, Wink, START и KION в данных JustWatch почти нет — об этом пишем прямо. */
export function SubscriptionPlanScreen() {
  const S = ui.subsPlan;
  const [plan, setPlan] = useState<SubscriptionPlanView | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => { setFailed(false); getSubscriptionPlan().then(setPlan).catch(() => setFailed(true)); }, [attempt]);

  if (failed) {
    return (
      <main className="tm-shell__main tm-subsplan">
        <h1 className="tm-shell__title">{S.title}</h1>
        <ErrorState title={S.error} onRetry={() => setAttempt((n) => n + 1)} />
      </main>
    );
  }
  if (!plan) {
    return (
      <main className="tm-shell__main tm-subsplan">
        <h1 className="tm-shell__title">{S.title}</h1>
        <p className="tm-body-sm tm-subsplan__muted">{S.loading}</p>
        <Skeleton kind="block" style={{ height: 160 }} />
      </main>
    );
  }

  const cur = plan.currency ?? '';
  const name = (slug: string) => plan.names[slug] ?? slug;
  // тариф: Кинопоиск — это Яндекс Плюс, Okko — СберПрайм; что входит в набор
  const tariff = (slug: string) => { const p = plan.prices[slug]; return p ? [p.plan, p.bundle].filter(Boolean).join(' · ') : undefined; };
  const money = (n: number) => S.sum(Math.round(n), cur);
  const plannedCount = plan.plannedCount;
  const checked = Object.values(plan.prices).map((p) => p.checked).sort().pop();
  const rotationPrice = plan.rotation.every((m) => m.price != null) ? plan.rotation.reduce((s, m) => s + m.price!, 0) : undefined;

  const titles = (ws: WorkCard[]) => (
    <p className="tm-body-sm tm-subsplan__works">
      {ws.slice(0, SHOW).map((w, i) => (
        <span key={w.id}>{i ? ', ' : ''}<Link to={`/works/${w.id}`}>{titleOf(w)}</Link></span>
      ))}
      {ws.length > SHOW ? <span className="tm-subsplan__muted"> {S.more(ws.length - SHOW)}</span> : null}
    </p>
  );

  if (!plan.total) {
    return (
      <main className="tm-shell__main tm-subsplan">
        <h1 className="tm-shell__title">{S.title}</h1>
        <p className="tm-body">{S.empty}</p>
      </main>
    );
  }

  return (
    <main className="tm-shell__main tm-subsplan">
      <h1 className="tm-shell__title">{S.title}</h1>
      <p className="tm-body">{S.lead(plannedCount, plan.total - plannedCount)}</p>
      {plan.covered.length ? <p className="tm-body-sm tm-subsplan__muted">{S.covered(plan.covered.length)}</p> : null}

      {plan.rotation.length ? (
        <section className="tm-subsplan__section">
          <h2 className="tm-title-3">{S.rotation}</h2>
          <p className="tm-body-sm tm-subsplan__muted">{S.rotationText}</p>
          <ol className="tm-subsplan__months">
            {plan.rotation.map((m, i) => (
              <li key={m.slug} className="tm-subsplan__month">
                <p className="tm-caption">{S.month(i + 1)}</p>
                <p className="tm-body tm-subsplan__name">
                  {name(m.slug)}
                  <span className="tm-subsplan__price">{m.price != null ? S.price(m.price, cur) : S.noPrice}</span>
                </p>
                {tariff(m.slug) ? <p className="tm-caption tm-subsplan__muted">{tariff(m.slug)}</p> : null}
                {titles(m.works)}
              </li>
            ))}
          </ol>
          {rotationPrice != null ? <p className="tm-body-sm">{S.rotationTotal(plan.rotation.length, money(rotationPrice))}</p> : null}
        </section>
      ) : null}

      {plan.pair ? (
        <section className="tm-subsplan__section">
          <h2 className="tm-title-3">{S.pair}</h2>
          <p className="tm-body-sm">
            {S.pairText(name(plan.pair.slugs[0]), name(plan.pair.slugs[1]), plan.pair.count)}
            {plan.pair.price != null ? <> · {S.price(plan.pair.price, cur)}</> : null}
          </p>
        </section>
      ) : null}

      {plan.providers.length ? (
        <section className="tm-subsplan__section">
          <h2 className="tm-title-3">{S.single}</h2>
          <ul className="tm-subsplan__list">
            {plan.providers.slice(0, 8).map((p) => {
              const n = p.planned.length + p.liked.length;
              return (
                <li key={p.slug} className="tm-subsplan__row">
                  <p className="tm-body tm-subsplan__name">
                    {name(p.slug)}
                    <span className="tm-subsplan__price">{p.price != null ? S.price(p.price, cur) : S.noPrice}</span>
                  </p>
                  {tariff(p.slug) ? <p className="tm-caption tm-subsplan__muted">{tariff(p.slug)}</p> : null}
                  <p className="tm-caption tm-subsplan__muted">
                    {[p.planned.length ? S.planned(p.planned.length) : '', p.liked.length ? S.liked(p.liked.length) : '',
                      p.price != null && n ? S.perFilm(money(p.price / n)) : ''].filter(Boolean).join(' · ')}
                  </p>
                  {titles([...p.planned, ...p.liked])}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {plan.nowhere.length ? <p className="tm-body-sm tm-subsplan__muted">{S.nowhere(plan.nowhere.length)}</p> : null}
      <p className="tm-caption tm-subsplan__muted">
        {plan.region === 'RU' ? S.noteRu : S.note}{checked ? ` ${S.checked(checked)}` : ''}
      </p>
      <p className="tm-body-sm"><Link to="/settings">{S.yours}</Link></p>
    </main>
  );
}
