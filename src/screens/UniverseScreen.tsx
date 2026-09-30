import { useEffect, useState, type CSSProperties } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getUniverse, type UniverseMember, type UniversePage } from '@/api';
import { DiscussionLink, EmptyState, ErrorState, Skeleton } from '@/components';
import { opVar } from '@/lib/operations';
import { cx } from '@/lib/cx';
import { onExternalClick } from '@/lib/telegram';
import ru from '@/i18n/ru';

/** Страница вселенной (/universe/:id, трек Ж2): франшиза, цикл или цепочка связанных произведений.
 *  Состав по видам в порядке выхода, цепочки продолжений — порядок по сюжету, «с чего начать» и
 *  места разговора. Произведения, которых у нас нет (роман, игра), показаны названием и годом —
 *  без ссылки: вселенная шире нашего каталога, и это честно. Адрес — элемент Wikidata средоточия. */
export function UniverseScreen() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<UniversePage | null | undefined>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [order, setOrder] = useState<'release' | 'story'>('release');

  useEffect(() => {
    let alive = true;
    setData(null);
    setFailed(false);
    getUniverse(id).then((u) => alive && setData(u)).catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, [id, attempt]);

  const open = (m: UniverseMember) => (m.work ? () => navigate(`/works/${m.work!.id}`) : undefined);
  const counts = data?.byKind.map((g) => ru.universe.count(g.kind, g.members.length)).join(' · ');

  return (
    <main className="tm-shell__main tm-voicepage tm-universe">
      <button type="button" className="tm-voicepage__back" onClick={() => navigate(-1)}>{ru.person.back}</button>
      {failed ? <ErrorState title={ru.state.errorSlate} onRetry={() => setAttempt((n) => n + 1)} /> : null}
      {data === null && !failed ? (
        <div aria-busy="true">
          <span className="tm-sr">{ru.today.loading}</span>
          <Skeleton kind="block" style={{ height: 72 }} />
          {[0, 1, 2].map((i) => <Skeleton key={i} kind="block" style={{ height: 72, marginTop: 8 }} />)}
        </div>
      ) : null}
      {data === undefined ? <EmptyState title={ru.universe.unknown} text={ru.universe.unknownText} /> : null}

      {data ? (
        <>
          <header className="tm-person__head">
            <p className="tm-label tm-universe__kind">{ru.universe.kind[data.kind] ?? ru.universe.kind.other}</p>
            <h1 className="tm-title-2">{data.title}</h1>
            <p className="tm-caption">{counts}</p>
          </header>

          {data.startWith ? (
            <section className="tm-person__start">
              <h2 className="tm-title-3">{ru.person.start}</h2>
              <Member m={data.startWith.member} onOpen={open(data.startWith.member)}
                      note={data.startWith.why === 'first' ? ru.universe.startFirst : ru.universe.startNear} />
            </section>
          ) : null}

          {data.chains.length ? (
            <div className="tm-row tm-row--gap-2 tm-universe__order" role="group" aria-label={ru.universe.orderLabel}>
              {(['release', 'story'] as const).map((o) => (
                <button key={o} type="button" aria-pressed={order === o}
                        className={cx('tm-voice__chip', order === o && 'tm-voice__chip--on')} onClick={() => setOrder(o)}>
                  {o === 'release' ? ru.universe.byRelease : ru.universe.byStory}
                </button>
              ))}
            </div>
          ) : null}

          {order === 'story' && data.chains.length ? data.chains.map((chain, i) => (
            <section key={chain[0].qid} className="tm-person__section">
              <h2 className="tm-title-3">{data.chains.length > 1 ? ru.universe.chain(i + 1, chain[0].title) : ru.universe.byStory}</h2>
              <ol className="tm-search__list tm-universe__chain">
                {chain.map((m) => <li key={m.qid} className="tm-search__item"><Member m={m} onOpen={open(m)} /></li>)}
              </ol>
            </section>
          )) : data.byKind.map((g) => (
            <section key={g.kind} className="tm-person__section">
              <h2 className="tm-title-3">{ru.universe.group[g.kind] ?? ru.universe.group.other}</h2>
              <ul className="tm-search__list">
                {g.members.map((m) => <li key={m.qid} className="tm-search__item"><Member m={m} onOpen={open(m)} /></li>)}
              </ul>
            </section>
          ))}

          {data.discussions.length ? (
            <section className="tm-person__section">
              <h2 className="tm-title-3">{ru.universe.places}</h2>
              {data.discussions.map((d) => <DiscussionLink key={d.id} discussion={d} />)}
            </section>
          ) : null}
          {data.sources ? (
            <section className="tm-person__section">
              <h2 className="tm-title-3">{ru.universe.sources}</h2>
              <p className="tm-voice__outlets tm-work__people">
                {data.sources.wiki.map((w) => (
                  <a key={w} className="tm-voice__chip" href={w} target="_blank" rel="noreferrer noopener" onClick={onExternalClick(w)}>{wikiName(w)}</a>
                ))}
              </p>
              {data.sources.api.length ? (
                <p className="tm-caption tm-work__note">{ru.universe.apis(data.sources.api.map((a) => `${new URL(a.url).host} — ${a.what}`).join('; '))}</p>
              ) : null}
            </section>
          ) : null}
          <p className="tm-caption tm-work__note">{ru.relations.note}</p>
        </>
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
  const body = (
    <>
      <span className="tm-search__thumb" style={{ '--thumb-line': opVar(m.work?.primaryOperations?.[0]?.op ?? 'synthesis') } as CSSProperties}>
        {m.work?.stillUrl ?? m.work?.coverUrl ? <img src={m.work.stillUrl ?? m.work.coverUrl} alt="" loading="lazy" decoding="async" /> : null}
      </span>
      <span className="tm-search__text">
        <span className="tm-search__name">{m.title}</span>
        <span className="tm-search__meta">
          {[m.year, ru.universe.one[m.kind] ?? ru.universe.one.other,
            m.work?.complexityLevel ? ru.person.level(m.work.complexityLevel) : undefined,
            m.seen ? ru.person.seen : m.work ? undefined : ru.universe.notOurs].filter(Boolean).join(' · ')}
        </span>
        {note ? <span className="tm-search__orig">{note}</span> : null}
      </span>
    </>
  );
  return onOpen
    ? <button type="button" className="tm-search__open" onClick={onOpen}>{body}</button>
    : <div className="tm-search__open tm-universe__static">{body}</div>;
}
