import { useEffect, useState, type CSSProperties } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getCharacter, getSettings, type CharacterPage } from '@/api';
import type { SpoilerLevel, WorkCard } from '@/types/tmdf';
import { DiscussionLink, EmptyState, ErrorState, ExternalAnalysisLink, Skeleton } from '@/components';
import { opVar } from '@/lib/operations';
import ru from '@/i18n/ru';

/** Страница героя (/character/:id, трек И2): Шерлок Холмс, Джокер, Дракула — герой, который есть
 *  хотя бы в двух наших произведениях (И1). Его версии по видам — книги, фильмы, сериалы — в порядке
 *  выхода, откуда он пришёл, с чего начать, разборы, которые называют его в заголовке, и где о нём
 *  говорят. Адрес — элемент Wikidata героя. */
export function CharacterScreen() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<CharacterPage | null | undefined>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [spoilers, setSpoilers] = useState<SpoilerLevel>(0);

  useEffect(() => { getSettings().then((s) => setSpoilers(s.spoilerLevel)).catch(() => undefined); }, []);
  useEffect(() => {
    let alive = true;
    setData(null);
    setFailed(false);
    getCharacter(id).then((c) => alive && setData(c)).catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, [id, attempt]);

  const counts = data?.byKind.map((g) => ru.universe.count(g.kind, g.works.length)).join(' · ');

  return (
    <main className="tm-shell__main tm-voicepage tm-person tm-hero">
      <button type="button" className="tm-voicepage__back" onClick={() => navigate(-1)}>{ru.person.back}</button>
      {failed ? <ErrorState title={ru.state.errorSlate} onRetry={() => setAttempt((n) => n + 1)} /> : null}
      {data === null && !failed ? (
        <div aria-busy="true">
          <span className="tm-sr">{ru.today.loading}</span>
          <Skeleton kind="block" style={{ height: 72 }} />
          {[0, 1, 2].map((i) => <Skeleton key={i} kind="block" style={{ height: 88, marginTop: 8 }} />)}
        </div>
      ) : null}
      {data === undefined ? <EmptyState title={ru.hero.unknown} text={ru.hero.unknownText} /> : null}

      {data ? (
        <>
          <header className="tm-person__head">
            <p className="tm-label tm-universe__kind">{ru.hero.kind}</p>
            <h1 className="tm-title-2">{data.name}</h1>
            {data.original ? <p className="tm-workhead__original">{data.original}</p> : null}
            <p className="tm-caption">{[counts, data.aka.length ? ru.hero.aka(data.aka.slice(0, 3)) : undefined].filter(Boolean).join(' · ')}</p>
          </header>

          {data.startWith || data.first ? (
            <section className="tm-person__start">
              {data.first ? (
                <>
                  <h2 className="tm-title-3">{ru.hero.first}</h2>
                  <WorkRow work={data.first} note={ru.hero.firstNote(data.first.type)} onOpen={() => navigate(`/works/${data.first!.id}`)} />
                </>
              ) : null}
              {data.startWith && data.startWith.work.id !== data.first?.id ? (
                <>
                  <h2 className="tm-title-3">{ru.person.start}</h2>
                  <WorkRow work={data.startWith.work} note={ru.hero.startNear(data.startWith.level)}
                           onOpen={() => navigate(`/works/${data.startWith!.work.id}`)} />
                </>
              ) : null}
            </section>
          ) : null}

          {data.byKind.map((g) => (
            <section key={g.kind} className="tm-person__section">
              <h2 className="tm-title-3">{ru.universe.group[g.kind]}</h2>
              <ul className="tm-search__list">
                {g.works.map(({ work, seen, analyses }) => (
                  <li key={work.id} className="tm-search__item">
                    <WorkRow work={work} onOpen={() => navigate(`/works/${work.id}`)}
                             meta={[work.complexityLevel ? ru.person.level(work.complexityLevel) : ru.person.unmarked,
                               seen ? ru.person.seen : undefined, analyses ? ru.hero.analyses(analyses) : undefined]} />
                  </li>
                ))}
              </ul>
            </section>
          ))}

          <section className="tm-person__section">
            <h2 className="tm-title-3">{ru.hero.essaysTitle}</h2>
            {data.analyses.length ? (
              <ul className="tm-person__essays">
                {data.analyses.map(({ work, analysis, seen }) => (
                  <li key={analysis.url}>
                    <p className="tm-caption tm-person__about">{work.title}{work.year ? `, ${work.year}` : ''}</p>
                    {/* как в карточке: видели произведение — открыто всё, нет — по настройке спойлеров */}
                    <ExternalAnalysisLink analysis={analysis} spoilerLevel={seen ? 2 : spoilers} />
                  </li>
                ))}
              </ul>
            ) : <p className="tm-body-sm tm-settings__note">{ru.hero.essaysNone}</p>}
          </section>

          {data.discussions.length ? (
            <section className="tm-person__section">
              <h2 className="tm-title-3">{ru.hero.places}</h2>
              {data.discussions.map((d) => <DiscussionLink key={d.id} discussion={d} />)}
            </section>
          ) : null}
          <p className="tm-caption tm-work__note">{ru.heroes.note}</p>
        </>
      ) : null}
    </main>
  );
}

function WorkRow({ work, onOpen, note, meta = [] }: { work: WorkCard; onOpen: () => void; note?: string; meta?: (string | undefined)[] }) {
  return (
    <button type="button" className="tm-search__open" onClick={onOpen}>
      <span className="tm-search__thumb" style={{ '--thumb-line': opVar(work.primaryOperations?.[0]?.op ?? 'synthesis') } as CSSProperties}>
        {work.stillUrl ?? work.coverUrl ? <img src={work.stillUrl ?? work.coverUrl} alt="" loading="lazy" decoding="async" /> : null}
      </span>
      <span className="tm-search__text">
        <span className="tm-search__name">{work.title}</span>
        <span className="tm-search__meta">{[work.year || undefined, ru.universe.one[work.type], ...meta].filter(Boolean).join(' · ')}</span>
        {note ? <span className="tm-search__orig">{note}</span> : null}
      </span>
    </button>
  );
}
