import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getCharacter, getSettings, type CharacterPage } from '@/api';
import type { SpoilerLevel, WorkCard } from '@/types/tmdf';
import { DiscussionLink, EmptyState, ErrorState, ExternalAnalysisLink, FollowButton, ShareButton, Skeleton } from '@/components';
import { useMechanics } from '@/lib/settingsStore';
import { WorkThumb } from '@/components/WorkThumb';
import { HERO_ID } from '@/components/ShareButton';
import { Face } from '@/components/Face';
import { OpenContext } from '@/lib/openContext';
import ui from '@/i18n';
import { titleOf } from '@/lib/format';

/** Страница героя (/character/:id, трек И2): Шерлок Холмс, Джокер, Дракула — герой, который есть
 *  хотя бы в двух наших произведениях (И1). Его версии по видам — книги, фильмы, сериалы — в порядке
 *  выхода, откуда он пришёл, с чего начать, разборы, которые называют его в заголовке, и где о нём
 *  говорят. Адрес — элемент Wikidata героя. */
export function CharacterScreen() {
  // уровень и «без разметки» — механика подбора (ТВ-8в): видны, только если включено «Показывать механику»
  const mechanics = useMechanics();
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

  const counts = data?.byKind.map((g) => ui.universe.count(g.kind, g.works.length)).join(' · ');

  return (
    <main className="tm-shell__main tm-voicepage tm-person tm-hero">
      <button type="button" className="tm-voicepage__back" onClick={() => navigate(-1)}>{ui.person.back}</button>
      {failed ? <ErrorState title={ui.state.errorCharacter} onRetry={() => setAttempt((n) => n + 1)} /> : null}
      {data === null && !failed ? (
        <div aria-busy="true">
          <span className="tm-sr">{ui.today.loading}</span>
          <Skeleton kind="block" style={{ height: 72 }} />
          {[0, 1, 2].map((i) => <Skeleton key={i} kind="block" style={{ height: 88, marginTop: 8 }} />)}
        </div>
      ) : null}
      {data === undefined ? <EmptyState title={ui.hero.unknown} text={ui.hero.unknownText} /> : null}

      {data ? (
        <OpenContext.Provider value={{ place: 'character' }}>
          <header className="tm-person__head tm-hero__head">
            {data.image ? (
              <figure className="tm-hero__face">
                <Face src={data.image.url} name={data.name} alt={data.name} />
                <figcaption className="tm-caption">{data.image.actor ? ui.hero.played(data.image.actor) : ui.hero.commons}</figcaption>
              </figure>
            ) : null}
            <p className="tm-label tm-universe__kind">{ui.hero.kind}</p>
            <h1 className="tm-title-2">{data.name}</h1>
            {data.original ? <p className="tm-workhead__original">{data.original}</p> : null}
            <p className="tm-caption">{[counts, data.aka.length ? ui.hero.aka(data.aka.slice(0, 3)) : undefined].filter(Boolean).join(' · ')}</p>
            {/* ссылка на героя (06.10): та же, что в инлайн-режиме бота — `?startapp=h-<id>` */}
            {/* «Следить» (06.10): новые разборы о герое — сводкой от бота раз в день */}
            <div className="tm-hero__actions">
              <FollowButton target={HERO_ID.test(data.id) ? { kind: 'character', ref: data.id, title: data.name } : undefined} />
              <ShareButton hero={{ id: data.id, name: data.name, ...(data.image?.url ? { image: data.image.url } : {}),
                ...(data.byKind.length ? { where: data.byKind.flatMap((k) => k.works).slice(0, 3).map((w) => titleOf(w.work)).join(', ') } : {}) }} />
            </div>
          </header>

          {/* кто играл (06.10): актёр в роли по произведениям, по году — нажатие ведёт на произведение */}
          {data.cast.length > 1 ? (
            <section className="tm-hero__cast" aria-label={ui.hero.cast}>
              <h2 className="tm-title-3">{ui.hero.cast}</h2>
              <ul className="tm-hero__castrow">
                {data.cast.map((c) => (
                  <li key={c.actor}>
                    <button type="button" className="tm-hero__castitem" onClick={() => navigate(`/works/${c.work.id}`)}>
                      <Face src={c.image} name={c.actor} />
                      <span className="tm-hero__castname">{c.actor}</span>
                      <span className="tm-caption">{ui.hero.castWork(titleOf(c.work), c.work.year || undefined)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {data.startWith || data.first ? (
            <section className="tm-person__start">
              {data.first ? (
                <>
                  <h2 className="tm-title-3">{ui.hero.first}</h2>
                  <WorkRow work={data.first} note={ui.hero.firstNote(data.first.type)} onOpen={() => navigate(`/works/${data.first!.id}`)} />
                </>
              ) : null}
              {data.startWith && data.startWith.work.id !== data.first?.id ? (
                <>
                  <h2 className="tm-title-3">{ui.person.start}</h2>
                  <WorkRow work={data.startWith.work} note={ui.hero.startNear(data.startWith.level)}
                           onOpen={() => navigate(`/works/${data.startWith!.work.id}`)} />
                </>
              ) : null}
            </section>
          ) : null}

          {data.byKind.map((g) => (
            <section key={g.kind} className="tm-person__section">
              <h2 className="tm-title-3">{ui.universe.group[g.kind]}</h2>
              <ul className="tm-search__list">
                {g.works.map(({ work, seen, analyses }) => (
                  <li key={work.id} className="tm-search__item">
                    <WorkRow work={work} onOpen={() => navigate(`/works/${work.id}`)}
                             meta={[mechanics ? (work.complexityLevel ? ui.person.level(work.complexityLevel) : ui.person.unmarked) : undefined,
                               seen ? ui.person.seen : undefined, analyses ? ui.hero.analyses(analyses) : undefined]} />
                  </li>
                ))}
              </ul>
            </section>
          ))}

          <section className="tm-person__section">
            <h2 className="tm-title-3">{ui.hero.essaysTitle}</h2>
            {data.analyses.length ? (
              <ul className="tm-person__essays">
                {data.analyses.map(({ work, analysis, seen }) => (
                  <li key={analysis.url}>
                    <p className="tm-caption tm-person__about">{titleOf(work)}{work.year ? `, ${work.year}` : ''}</p>
                    {/* как в карточке: видели произведение — открыто всё, нет — по настройке спойлеров */}
                    <OpenContext.Provider value={{ place: 'character', workId: work.id }}>
                      <ExternalAnalysisLink analysis={analysis} spoilerLevel={seen ? 2 : spoilers} />
                    </OpenContext.Provider>
                  </li>
                ))}
              </ul>
            ) : <p className="tm-body-sm tm-settings__note">{ui.hero.essaysNone}</p>}
          </section>

          {data.discussions.length ? (
            <section className="tm-person__section">
              <h2 className="tm-title-3">{ui.hero.places}</h2>
              {data.discussions.map((d) => <DiscussionLink key={d.id} discussion={d} />)}
            </section>
          ) : null}
          <p className="tm-caption tm-work__note">{ui.heroes.note}</p>
        </OpenContext.Provider>
      ) : null}
    </main>
  );
}

function WorkRow({ work, onOpen, note, meta = [] }: { work: WorkCard; onOpen: () => void; note?: string; meta?: (string | undefined)[] }) {
  return (
    <button type="button" className="tm-search__open" onClick={onOpen}>
      <WorkThumb work={work} />
      <span className="tm-search__text">
        <span className="tm-search__name">{titleOf(work)}</span>
        <span className="tm-search__meta">{[work.year || undefined, ui.universe.one[work.type], ...meta].filter(Boolean).join(' · ')}</span>
        {note ? <span className="tm-search__orig">{note}</span> : null}
      </span>
    </button>
  );
}
