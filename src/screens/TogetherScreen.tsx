import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { WorkCard } from '@/types/tmdf';
import {
  createTogether, getTogether, noteWatch, planWork, prepareShare, togetherMine, voteTogether,
  type TogetherCard, type TogetherState, type TogetherVote,
} from '@/api';
import { Button, ErrorState, Skeleton, useToast } from '@/components';
import { WorkBanner } from '@/components/WorkBanner';
import { appLink, openExternal, shareLink, tap, webApp } from '@/lib/telegram';
import ui from '@/i18n';

const T = ui.together;
const POLL_MS = 5000;

/** Карточка колоды баннером ленты: у позванного этого фильма может не быть в справочнике, поэтому
 *  баннер собирается из того, что лежит в сессии, — название, год, кадр. */
const asWork = (c: TogetherCard): WorkCard => ({ id: c.id, title: c.title, year: c.year, stillUrl: c.image, primaryOperations: [] } as unknown as WorkCard);

/** Выбор компанией (ЗП-11). `/together` — собрать десятку под свой вкус; `/together/:id` — голосовать по одной
 *  карточке («хочу», «не хочу», «видел») и итог: совпадение — то, что хотят все, дальше по голосам и общему
 *  вкусу (сервер, worker/together.ts). Итог перечитывается раз в пять секунд, пока экран открыт. */
export function TogetherScreen() {
  const { id } = useParams();
  return id ? <Session id={id} /> : <Create />;
}

function Create() {
  const navigate = useNavigate();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const create = () => {
    tap('medium');
    setBusy(true);
    createTogether()
      .then((sid) => navigate(`/together/${sid}`, { replace: true }))
      .catch((e: Error) => { setBusy(false); toast({ text: e.message === 'no_server' ? T.noServer : T.createFailed }); });
  };
  return (
    <main className="tm-shell__main tm-together">
      <h1 className="tm-shell__title">{T.title}</h1>
      <p className="tm-body tm-together__lead">{T.lead}</p>
      <Button variant="primary" onClick={create} loading={busy} disabled={busy}>{busy ? T.creating : T.create}</Button>
    </main>
  );
}

function Session({ id }: { id: string }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [state, setState] = useState<TogetherState | 'missing' | null>(null);
  const [failed, setFailed] = useState(false);
  const [mine, setMine] = useState<Awaited<ReturnType<typeof togetherMine>>>({});
  // голосование (первая карточка без моего голоса), итог или переголосование по кругу
  const [mode, setMode] = useState<'vote' | 'results' | 'revote'>('vote');
  const [busy, setBusy] = useState(false);
  const alive = useRef(true);

  const load = () => getTogether(id).then((s) => { if (alive.current) { setState(s); setFailed(false); } return s; });
  useEffect(() => {
    alive.current = true;
    load()
      .then((s) => (s === 'missing' ? undefined : togetherMine(s.deck).then((m) => { if (alive.current) setMine(m); })))
      .catch(() => { if (alive.current) setFailed(true); });
    // итог живой: голоса друзей приходят, пока экран открыт и виден
    const t = setInterval(() => { if (document.visibilityState === 'visible') load().catch(() => undefined); }, POLL_MS);
    return () => { alive.current = false; clearInterval(t); };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const s = state && state !== 'missing' ? state : undefined;
  const [cursor, setCursor] = useState(0);
  const next = useMemo(() => {
    if (!s || mode === 'results') return undefined;
    if (mode === 'revote') return cursor < s.deck.length ? cursor : undefined;
    const i = s.deck.findIndex((c) => !s.votes[c.id]);
    return i >= 0 ? i : undefined;
  }, [s, mode, cursor]);

  if (failed) return <main className="tm-shell__main"><ErrorState title={T.loadFailed} onRetry={() => { setFailed(false); load().catch(() => setFailed(true)); }} /></main>;
  if (state === 'missing') return <main className="tm-shell__main tm-together"><h1 className="tm-shell__title">{T.title}</h1><p className="tm-body">{T.missing}</p></main>;
  if (!s) {
    return (
      <main className="tm-shell__main tm-together">
        <h1 className="tm-shell__title">{T.title}</h1>
        <Skeleton kind="block" style={{ height: 220 }} />
      </main>
    );
  }

  const invite = async () => {
    tap();
    const param = `t-${s.id}`;
    const wa = webApp();
    if (wa?.shareMessage && wa.isVersionAtLeast('8.0')) {
      const msg = await prepareShare({ param, title: T.shareTitle, kind: 'together', about: T.shareAbout(s.owner, s.deck.length) });
      if (msg) { wa.shareMessage(msg, (sent) => { if (sent) toast({ text: ui.share.sent }); }); return; }
    }
    const r = await shareLink(appLink(param), T.shareText).catch(() => 'failed' as const);
    if (r === 'copied') toast({ text: ui.share.copied });
    if (r === 'failed') toast({ text: ui.share.failed });
  };

  const vote = (card: TogetherCard, v: TogetherVote) => {
    if (busy) return;
    tap(v === 'yes' ? 'medium' : undefined);
    setBusy(true);
    const before = s.votes;
    setState({ ...s, votes: { ...s.votes, [card.id]: v } });
    if (mode === 'revote') setCursor((c) => c + 1);
    voteTogether(s.id, card.id, v, mine[card.id]?.fit)
      .then(() => load())
      .catch(() => { setState({ ...s, votes: before }); if (mode === 'revote') setCursor((c) => c - 1); toast({ text: T.voteFailed }); })
      .finally(() => setBusy(false));
  };

  const people = (
    <p className="tm-body-sm tm-together__people">
      {`${T.people}: `}{s.people.map((p) => `${p.me ? T.you : p.name} ${p.n}/${s.deck.length}`).join(' · ')}
    </p>
  );
  const alone = s.people.filter((p) => !p.me).length === 0;
  const inviteBlock = (
    <section className="tm-together__invite">
      {alone ? <p className="tm-body-sm">{T.inviteLead}</p> : null}
      <Button variant={alone ? 'primary' : 'secondary'} size="sm" onClick={() => void invite()}>{T.invite}</Button>
    </section>
  );

  if (s.open && next !== undefined) {
    const card = s.deck[next];
    const meta = [card.year, card.essays ? T.essays(card.essays) : null].filter(Boolean).join(' · ');
    return (
      <main className="tm-shell__main tm-together">
        <h1 className="tm-shell__title">{T.title}</h1>
        {people}
        {alone ? inviteBlock : null}
        <p className="tm-caption tm-together__progress">{T.progress(next + 1, s.deck.length)}</p>
        <WorkBanner work={asWork(card)} meta={meta} />
        {mine[card.id]?.seen ? <p className="tm-caption tm-together__seen">{T.seenHint}</p> : null}
        {card.about ? <p className="tm-body tm-together__about">{card.about}</p> : null}
        <div className="tm-row tm-row--gap-2 tm-row--wrap tm-together__votes">
          <Button variant="primary" disabled={busy} onClick={() => vote(card, 'yes')}>{T.yes}</Button>
          <Button variant="secondary" disabled={busy} onClick={() => vote(card, 'no')}>{T.no}</Button>
          <Button variant="quiet" disabled={busy} onClick={() => vote(card, 'seen')}>{T.seen}</Button>
        </div>
        {Object.keys(s.votes).length ? (
          <p className="tm-caption"><button type="button" className="tm-coldstart__link" onClick={() => setMode('results')}>{T.toResults}</button></p>
        ) : null}
        {!alone ? inviteBlock : null}
      </main>
    );
  }

  // итог
  const byId = new Map(s.deck.map((c) => [c.id, c]));
  const rows = s.tally.filter((r) => byId.has(r.workId));
  const voted = rows.some((r) => r.yes + r.no + r.seen > 0);
  const top = voted ? rows[0] : undefined;
  const topCard = top ? byId.get(top.workId) : undefined;
  const plan = (workId: string) => {
    tap();
    planWork(workId).then((e) => toast({ text: e ? T.planned : T.planFailed })).catch(() => toast({ text: T.planFailed }));
  };
  return (
    <main className="tm-shell__main tm-together">
      <h1 className="tm-shell__title">{T.results}</h1>
      {people}
      {!s.open ? <p className="tm-body-sm">{T.closed}</p> : null}
      {top && topCard ? (
        <section className="tm-together__top">
          <p className="tm-title-3">{top.match ? T.match : T.leader}</p>
          <WorkBanner work={asWork(topCard)} meta={[topCard.year, T.counts(top.yes, top.no)].filter(Boolean).join(' · ')} />
          {top.yesNames.length ? <p className="tm-body-sm">{T.want(top.yesNames)}</p> : null}
          {top.seenNames.length ? <p className="tm-caption">{T.seenBy(top.seenNames)}</p> : null}
          <div className="tm-row tm-row--gap-2 tm-row--wrap">
            {topCard.watch?.length
              ? topCard.watch.map((w) => (
                <Button key={w.url} variant="primary" size="sm" onClick={() => { noteWatch(topCard.id, w.platform); openExternal(w.url); }}>{T.watchOn(w.platform)}</Button>
              ))
              : <span className="tm-caption">{T.noWatch}</span>}
            <Button variant="quiet" size="sm" onClick={() => plan(topCard.id)}>{T.plan}</Button>
          </div>
          {topCard.watch?.some((w) => w.source === 'tmdb') ? <p className="tm-caption">{ui.film.watchByJustWatch}</p> : null}
        </section>
      ) : <p className="tm-body">{T.nobody}</p>}
      <ol className="tm-together__list">
        {rows.slice(top ? 1 : 0).map((r) => {
          const c = byId.get(r.workId)!;
          return (
            <li key={r.workId} className="tm-together__row">
              <span className="tm-body">{c.title}{c.year ? ` (${c.year})` : ''}</span>
              <span className="tm-caption">
                {[T.counts(r.yes, r.no), r.yesNames.length ? T.want(r.yesNames) : null, r.seenNames.length ? T.seenBy(r.seenNames) : null].filter(Boolean).join(' · ')}
              </span>
            </li>
          );
        })}
      </ol>
      <div className="tm-row tm-row--gap-2 tm-row--wrap">
        {inviteBlock}
        {s.open ? <Button variant="quiet" size="sm" onClick={() => { setCursor(0); setMode('revote'); }}>{T.revote}</Button> : null}
        <Button variant="quiet" size="sm" onClick={() => navigate('/today')}>{ui.nav.today}</Button>
      </div>
    </main>
  );
}
