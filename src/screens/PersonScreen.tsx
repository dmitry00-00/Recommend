import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getPerson, getSettings, type PersonPage } from '@/api';
import type { SpoilerLevel } from '@/types/tmdf';
import { EmptyState, ErrorState, ExternalAnalysisLink, Skeleton } from '@/components';
import { registers } from '@/lib/registers';
import { useMechanics, useRole } from '@/lib/settingsStore';
import { WorkThumb } from '@/components/WorkThumb';
import { Face } from '@/components/Face';
import { OpenContext } from '@/lib/openContext';
import ui from '@/i18n';
import { titleOf } from '@/lib/format';

/** Страница автора-создателя (/person/:id, трек Д3): режиссёр, сценарист, шоураннер, писатель.
 *  Отвечает на вопрос «это Вильнёв — а что ещё у него и с чего начать»: его работы с нашей
 *  разметкой (уровень, регистры), разборы эссеистов о них и вход — непросмотренное чуть выше
 *  привычного. Адрес — элемент Wikidata, а пока резолв авторов (Д2) его не дал — имя
 *  (`personRef` в src/lib/credits.ts). Эссеист, который разбирает, — это /voice/:id. */
export function PersonScreen() {
  // уровень и «без разметки» — механика подбора (ТВ-8в): видны, только если включено «Показывать механику»
  const mechanics = useMechanics();
  const admin = useRole() === 'admin';
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
      <button type="button" className="tm-voicepage__back" onClick={() => navigate(-1)}>{ui.person.back}</button>

      {failed ? <ErrorState title={ui.state.errorPerson} onRetry={() => setAttempt((n) => n + 1)} /> : null}
      {data === null && !failed ? (
        <div aria-busy="true">
          <span className="tm-sr">{ui.today.loading}</span>
          <Skeleton kind="block" style={{ height: 72 }} />
          {[0, 1, 2].map((i) => <Skeleton key={i} kind="block" style={{ height: 88, marginTop: 8 }} />)}
        </div>
      ) : null}
      {data === undefined ? <EmptyState title={ui.person.unknown} text={ui.person.unknownText} /> : null}

      {data ? (
        <OpenContext.Provider value={{ place: 'person' }}>
          <header className={data.info?.image ? 'tm-person__head tm-hero__head' : 'tm-person__head'}>
            {data.info?.image ? (
              <figure className="tm-hero__face">
                <Face src={data.info.image} name={data.person.name} alt={data.person.name} />
                <figcaption className="tm-caption">{ui.hero.commons}</figcaption>
              </figure>
            ) : null}
            <h1 className="tm-title-2">{data.person.name}</h1>
            {data.person.originalName ? <p className="tm-workhead__original">{data.person.originalName}</p> : null}
            {data.info?.description || data.info?.born ? (
              <p className="tm-body-sm tm-person__about">
                {[data.info.description ? data.info.description[0].toLocaleUpperCase('ru') + data.info.description.slice(1) : undefined,
                  data.info.born ? ui.person.years(data.info.born, data.info.died) : undefined].filter(Boolean).join(' · ')}
              </p>
            ) : null}
            <p className="tm-caption">
              {[data.roles.map((r) => ui.person.role[r]).join(', '), ui.person.works(data.works.length),
                data.wikidata ? undefined : ui.person.byName].filter(Boolean).join(' · ')}
            </p>
            {admin ? (
              <p className="tm-voice__outlets tm-work__statslink">
                <Link className="tm-voice__chip" to={`/stats/person/${encodeURIComponent(id)}`}>{ui.stats.link}</Link>
              </p>
            ) : null}
          </header>

          {data.startWith ? (
            <section className="tm-person__start">
              <h2 className="tm-title-3">{ui.person.start}</h2>
              <button type="button" className="tm-search__open" onClick={() => navigate(`/works/${data.startWith!.work.id}`)}>
                <Thumb work={data.startWith.work} />
                <span className="tm-search__text">
                  <span className="tm-search__name">{titleOf(data.startWith.work)}</span>
                  <span className="tm-search__meta">{data.startWith.work.year || ''}</span>
                  <span className="tm-search__orig">
                    {data.startWith.why === 'near' ? ui.person.startNear(data.startWith.level) : ui.person.startEntry(data.startWith.level)}
                  </span>
                </span>
              </button>
            </section>
          ) : null}

          <section className="tm-person__section">
            <h2 className="tm-title-3">{ui.person.worksTitle}</h2>
            <ul className="tm-search__list">
              {data.works.map(({ work, roles, analyses, seen }) => (
                <li key={work.id} className="tm-search__item tm-voicepage__item">
                  <button type="button" className="tm-search__open" onClick={() => navigate(`/works/${work.id}`)}>
                    <Thumb work={work} />
                    <span className="tm-search__text">
                      <span className="tm-search__name">{titleOf(work)}</span>
                      <span className="tm-search__meta">
                        {[work.year || undefined, roles.map((r) => ui.person.role[r]).join(', '),
                          mechanics ? (work.complexityLevel ? ui.person.level(work.complexityLevel) : ui.person.unmarked) : undefined,
                          seen ? ui.person.seen : undefined].filter(Boolean).join(' · ')}
                      </span>
                      <span className="tm-search__orig">
                        {[(work.registers ?? []).slice(0, 2).map((r) => registers[r]?.name).filter(Boolean).join(', ') || undefined,
                          analyses ? ui.person.analyses(analyses) : undefined].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          {data.about.length ? (
            <section className="tm-person__section">
              <h2 className="tm-title-3">{ui.person.aboutTitle}</h2>
              <p className="tm-caption">{ui.person.aboutNote}</p>
              <ul className="tm-person__essays">
                {data.about.map((a) => <li key={a.url}><ExternalAnalysisLink analysis={a} spoilerLevel={spoilers} /></li>)}
              </ul>
            </section>
          ) : null}

          <section className="tm-person__section">
            <h2 className="tm-title-3">{ui.person.essaysTitle}</h2>
            {data.analyses.length ? (
              <ul className="tm-person__essays">
                {data.analyses.map(({ work, analysis, seen }) => (
                  <li key={analysis.url}>
                    <p className="tm-caption tm-person__about">{titleOf(work)}</p>
                    {/* как в карточке: видели — открыто всё, нет — по настройке спойлеров */}
                    <OpenContext.Provider value={{ place: 'person', workId: work.id }}>
                      <ExternalAnalysisLink analysis={analysis} spoilerLevel={seen ? 2 : spoilers} />
                    </OpenContext.Provider>
                  </li>
                ))}
              </ul>
            ) : <p className="tm-body-sm tm-settings__note">{ui.person.essaysNone}</p>}
          </section>

          {data.trajectories.length ? (
            <section className="tm-person__section">
              <h2 className="tm-title-3">{ui.person.trajectories}</h2>
              <p className="tm-voice__outlets">
                {data.trajectories.map((t) => (
                  <Link key={t.id} className="tm-voice__chip" to={`/trajectories/${t.id}`}>{t.title}</Link>
                ))}
              </p>
            </section>
          ) : null}
        </OpenContext.Provider>
      ) : null}
    </main>
  );
}

function Thumb({ work }: { work: PersonPage['works'][number]['work'] }) {
  return (
    <WorkThumb work={work} />
  );
}
