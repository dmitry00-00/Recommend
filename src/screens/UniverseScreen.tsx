import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getSettings, getUniverse, type UniverseMember, type UniversePage } from '@/api';
import type { SpoilerLevel } from '@/types/tmdf';
import { DiscussionLink, EmptyState, ErrorState, ExternalAnalysisLink, Skeleton } from '@/components';
import { cx } from '@/lib/cx';
import { onExternalClick } from '@/lib/telegram';
import { useMechanics, useRole } from '@/lib/settingsStore';
import { WorkThumb } from '@/components/WorkThumb';
import { OpenContext } from '@/lib/openContext';
import ui from '@/i18n';

/** Страница вселенной (/universe/:id, трек Ж2): франшиза, цикл или цепочка связанных произведений.
 *  Состав по видам в порядке выхода, цепочки продолжений — порядок по сюжету, «с чего начать» и
 *  места разговора. Произведения, которых у нас нет (роман, игра), показаны названием и годом —
 *  без ссылки: вселенная шире нашего каталога, и это честно. Адрес — элемент Wikidata средоточия. */
export function UniverseScreen() {
  const admin = useRole() === 'admin';
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<UniversePage | null | undefined>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [order, setOrder] = useState<'release' | 'story'>('release');
  const [spoilers, setSpoilers] = useState<SpoilerLevel>(0);

  useEffect(() => { getSettings().then((s) => setSpoilers(s.spoilerLevel)).catch(() => undefined); }, []);

  useEffect(() => {
    let alive = true;
    setData(null);
    setFailed(false);
    getUniverse(id).then((u) => alive && setData(u)).catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, [id, attempt]);

  const open = (m: UniverseMember) => (m.work ? () => navigate(`/works/${m.work!.id}`) : undefined);
  const counts = data?.byKind.map((g) => ui.universe.count(g.kind, g.members.length)).join(' · ');

  return (
    <main className="tm-shell__main tm-voicepage tm-universe">
      <button type="button" className="tm-voicepage__back" onClick={() => navigate(-1)}>{ui.person.back}</button>
      {failed ? <ErrorState title={ui.state.errorUniverse} onRetry={() => setAttempt((n) => n + 1)} /> : null}
      {data === null && !failed ? (
        <div aria-busy="true">
          <span className="tm-sr">{ui.today.loading}</span>
          <Skeleton kind="block" style={{ height: 72 }} />
          {[0, 1, 2].map((i) => <Skeleton key={i} kind="block" style={{ height: 72, marginTop: 8 }} />)}
        </div>
      ) : null}
      {data === undefined ? <EmptyState title={ui.universe.unknown} text={ui.universe.unknownText} /> : null}

      {data ? (
        <OpenContext.Provider value={{ place: 'universe' }}>
          <header className="tm-person__head">
            <p className="tm-label tm-universe__kind">{ui.universe.kind[data.kind] ?? ui.universe.kind.other}</p>
            <h1 className="tm-title-2">{data.title}</h1>
            <p className="tm-caption">{counts}</p>
            {admin ? (
              <p className="tm-voice__outlets tm-work__statslink">
                <Link className="tm-voice__chip" to={`/stats/universe/${data.id}`}>{ui.stats.link}</Link>
              </p>
            ) : null}
          </header>

          {data.startWith ? (
            <section className="tm-person__start">
              <h2 className="tm-title-3">{ui.person.start}</h2>
              <Member m={data.startWith.member} onOpen={open(data.startWith.member)}
                      note={data.startWith.why === 'first' ? ui.universe.startFirst : ui.universe.startNear} />
            </section>
          ) : null}

          {data.chains.length ? (
            <div className="tm-row tm-row--gap-2 tm-universe__order" role="group" aria-label={ui.universe.orderLabel}>
              {(['release', 'story'] as const).map((o) => (
                <button key={o} type="button" aria-pressed={order === o}
                        className={cx('tm-voice__chip', order === o && 'tm-voice__chip--on')} onClick={() => setOrder(o)}>
                  {o === 'release' ? ui.universe.byRelease : ui.universe.byStory}
                </button>
              ))}
            </div>
          ) : null}

          {order === 'story' && data.chains.length ? data.chains.map((chain, i) => (
            <section key={chain[0].qid} className="tm-person__section">
              <h2 className="tm-title-3">{data.chains.length > 1 ? ui.universe.chain(i + 1, chain[0].title) : ui.universe.byStory}</h2>
              <ol className="tm-search__list tm-universe__chain">
                {chain.map((m) => <li key={m.qid} className="tm-search__item"><Member m={m} onOpen={open(m)} /></li>)}
              </ol>
            </section>
          )) : data.byKind.map((g) => (
            <section key={g.kind} className="tm-person__section">
              <h2 className="tm-title-3">{ui.universe.group[g.kind] ?? ui.universe.group.other}</h2>
              <ul className="tm-search__list">
                {g.members.map((m) => <li key={m.qid} className="tm-search__item"><Member m={m} onOpen={open(m)} /></li>)}
              </ul>
            </section>
          ))}

          {data.essays.length ? (
            <section className="tm-person__section">
              <h2 className="tm-title-3">{ui.universe.essays}</h2>
              <p className="tm-caption">{ui.universe.essaysNote}</p>
              <ul className="tm-person__essays">
                {data.essays.map((a) => <li key={a.url}><ExternalAnalysisLink analysis={a} spoilerLevel={spoilers} /></li>)}
              </ul>
            </section>
          ) : null}

          {data.discussions.length ? (
            <section className="tm-person__section">
              <h2 className="tm-title-3">{ui.universe.places}</h2>
              {data.discussions.map((d) => <DiscussionLink key={d.id} discussion={d} />)}
            </section>
          ) : null}
          {data.sources ? (
            <section className="tm-person__section">
              <h2 className="tm-title-3">{ui.universe.sources}</h2>
              <p className="tm-voice__outlets tm-work__statslink">
                {data.sources.wiki.map((w) => (
                  <a key={w} className="tm-voice__chip" href={w} target="_blank" rel="noreferrer noopener" onClick={onExternalClick(w)}>{wikiName(w)}</a>
                ))}
              </p>
              {data.sources.api.length ? (
                <p className="tm-caption tm-work__note">{ui.universe.apis(data.sources.api.map((a) => `${new URL(a.url).host} — ${a.what}`).join('; '))}</p>
              ) : null}
            </section>
          ) : null}
          <p className="tm-caption tm-work__note">{ui.relations.note}</p>
        </OpenContext.Provider>
      ) : null}
    </main>
  );
}

/** «starwars.fandom.com/ru» → «starwars · вики (ru)»: адрес короче и понятнее ссылки целиком. */
function wikiName(url: string): string {
  const u = new URL(url);
  const name = u.host.replace(/\.fandom\.com$/, '').replace(/^www\./, '');
  const lang = u.pathname.replace(/^\/|\/$/g, '');
  return `${name}${lang && lang.length <= 3 ? ` (${lang})` : ''}`;
}

function Member({ m, onOpen, note }: { m: UniverseMember; onOpen?: () => void; note?: string }) {
  // уровень и «без разметки» — механика подбора (ТВ-8в): видны, только если включено «Показывать механику»
  const mechanics = useMechanics();
  const body = (
    <>
      {m.work ? <WorkThumb work={m.work} /> : <span className="tm-search__thumb"><span className="tm-search__thumbph" aria-hidden="true">{[...m.title][0]?.toUpperCase()}</span></span>}
      <span className="tm-search__text">
        <span className="tm-search__name">{m.title}</span>
        <span className="tm-search__meta">
          {[m.year, ui.universe.one[m.kind] ?? ui.universe.one.other,
            mechanics && m.work?.complexityLevel ? ui.person.level(m.work.complexityLevel) : undefined,
            m.seen ? ui.person.seen : m.work ? undefined : ui.universe.notOurs].filter(Boolean).join(' · ')}
        </span>
        {note ? <span className="tm-search__orig">{note}</span> : null}
      </span>
    </>
  );
  return onOpen
    ? <button type="button" className="tm-search__open" onClick={onOpen}>{body}</button>
    : <div className="tm-search__open tm-universe__static">{body}</div>;
}
