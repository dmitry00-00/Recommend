import { useEffect, useState, type CSSProperties } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getPerson, getSettings, type PersonPage } from '@/api';
import type { SpoilerLevel } from '@/types/tmdf';
import { EmptyState, ErrorState, ExternalAnalysisLink, Skeleton } from '@/components';
import { registers } from '@/lib/registers';
import { opVar } from '@/lib/operations';
import ru from '@/i18n/ru';

/** Страница автора-создателя (/person/:id, трек Д3): режиссёр, сценарист, шоураннер, писатель.
 *  Отвечает на вопрос «это Вильнёв — а что ещё у него и с чего начать»: его работы с нашей
 *  разметкой (уровень, регистры), разборы эссеистов о них и вход — непросмотренное чуть выше
 *  привычного. Адрес — элемент Wikidata, а пока резолв авторов (Д2) его не дал — имя
 *  (`personRef` в src/lib/credits.ts). Эссеист, который разбирает, — это /voice/:id. */
export function PersonScreen() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<PersonPage | null | undefined>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [spoilers, setSpoilers] = useState<SpoilerLevel>(0);

  useEffect(() => { getSettings().then((s) => setSpoilers(s.spoilerLevel)).catch(() => undefined); }, []);

  useEffect(() => {
    let alive = true;
    setData(null);
    setFailed(false);
    getPerson(id)
      .then((found) => alive && setData(found))
      .catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, [id, attempt]);

  return (
    <main className="tm-shell__main tm-voicepage tm-person">
      <button type="button" className="tm-voicepage__back" onClick={() => navigate(-1)}>{ru.person.back}</button>

      {failed ? <ErrorState title={ru.state.errorSlate} onRetry={() => setAttempt((n) => n + 1)} /> : null}
      {data === null && !failed ? (
        <div aria-busy="true">
          <span className="tm-sr">{ru.today.loading}</span>
          <Skeleton kind="block" style={{ height: 72 }} />
          {[0, 1, 2].map((i) => <Skeleton key={i} kind="block" style={{ height: 88, marginTop: 8 }} />)}
        </div>
      ) : null}
      {data === undefined ? <EmptyState title={ru.person.unknown} text={ru.person.unknownText} /> : null}

      {data ? (
        <>
          <header className="tm-person__head">
            <h1 className="tm-title-2">{data.person.name}</h1>
            {data.person.originalName ? <p className="tm-workhead__original">{data.person.originalName}</p> : null}
            <p className="tm-caption">
              {[data.roles.map((r) => ru.person.role[r]).join(', '), ru.person.works(data.works.length),
                data.wikidata ? undefined : ru.person.byName].filter(Boolean).join(' · ')}
            </p>
            <p className="tm-voice__outlets tm-work__people">
              <Link className="tm-voice__chip" to={`/stats/person/${encodeURIComponent(id)}`}>{ru.stats.link}</Link>
            </p>
          </header>

          {data.startWith ? (
            <section className="tm-person__start">
              <h2 className="tm-title-3">{ru.person.start}</h2>
              <button type="button" className="tm-search__open" onClick={() => navigate(`/works/${data.startWith!.work.id}`)}>
                <Thumb work={data.startWith.work} />
                <span className="tm-search__text">
                  <span className="tm-search__name">{data.startWith.work.title}</span>
                  <span className="tm-search__meta">{data.startWith.work.year || ''}</span>
                  <span className="tm-search__orig">
                    {data.startWith.why === 'near' ? ru.person.startNear(data.startWith.level) : ru.person.startEntry(data.startWith.level)}
                  </span>
                </span>
              </button>
            </section>
          ) : null}

          <section className="tm-person__section">
            <h2 className="tm-title-3">{ru.person.worksTitle}</h2>
            <ul className="tm-search__list">
              {data.works.map(({ work, roles, analyses, seen }) => (
                <li key={work.id} className="tm-search__item tm-voicepage__item">
                  <button type="button" className="tm-search__open" onClick={() => navigate(`/works/${work.id}`)}>
                    <Thumb work={work} />
                    <span className="tm-search__text">
                      <span className="tm-search__name">{work.title}</span>
                      <span className="tm-search__meta">
                        {[work.year || undefined, roles.map((r) => ru.person.role[r]).join(', '),
                          work.complexityLevel ? ru.person.level(work.complexityLevel) : ru.person.unmarked,
                          seen ? ru.person.seen : undefined].filter(Boolean).join(' · ')}
                      </span>
                      <span className="tm-search__orig">
                        {[(work.registers ?? []).slice(0, 2).map((r) => registers[r]?.name).filter(Boolean).join(', ') || undefined,
                          analyses ? ru.person.analyses(analyses) : undefined].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          {data.about.length ? (
            <section className="tm-person__section">
              <h2 className="tm-title-3">{ru.person.aboutTitle}</h2>
              <p className="tm-caption">{ru.person.aboutNote}</p>
              <ul className="tm-person__essays">
                {data.about.map((a) => <li key={a.url}><ExternalAnalysisLink analysis={a} spoilerLevel={spoilers} /></li>)}
              </ul>
            </section>
          ) : null}

          <section className="tm-person__section">
            <h2 className="tm-title-3">{ru.person.essaysTitle}</h2>
            {data.analyses.length ? (
              <ul className="tm-person__essays">
                {data.analyses.map(({ work, analysis, seen }) => (
                  <li key={analysis.url}>
                    <p className="tm-caption tm-person__about">{work.title}</p>
                    {/* как в карточке: видели — открыто всё, нет — по настройке спойлеров */}
                    <ExternalAnalysisLink analysis={analysis} spoilerLevel={seen ? 2 : spoilers} />
                  </li>
                ))}
              </ul>
            ) : <p className="tm-body-sm tm-settings__note">{ru.person.essaysNone}</p>}
          </section>

          {data.trajectories.length ? (
            <section className="tm-person__section">
              <h2 className="tm-title-3">{ru.person.trajectories}</h2>
              <p className="tm-voice__outlets">
                {data.trajectories.map((t) => (
                  <Link key={t.id} className="tm-voice__chip" to={`/trajectories/${t.id}`}>{t.title}</Link>
                ))}
              </p>
            </section>
          ) : null}
        </>
      ) : null}
    </main>
  );
}

function Thumb({ work }: { work: PersonPage['works'][number]['work'] }) {
  return (
    <span className="tm-search__thumb" style={{ '--thumb-line': opVar(work.primaryOperations?.[0]?.op ?? 'synthesis') } as CSSProperties}>
      {work.stillUrl ?? work.coverUrl ? <img src={work.stillUrl ?? work.coverUrl} alt="" loading="lazy" decoding="async" /> : null}
    </span>
  );
}
