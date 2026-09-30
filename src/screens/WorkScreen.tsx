import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type {
  CharacterDesire, DiscussionPlace, JourneyEntryData, SpoilerLevel, UserSettings, WorkDetail,
} from '@/types/tmdf';
import { getDiscussions, getJourney, getSettings, getWork, planWork, startWork } from '@/api';
import {
  BarrierTag, Button, CoMentionList, DiscussionLink, EmptyState, ErrorState, FilmFormNote, OperationChip,
  ReadinessNotice, Skeleton, SpoilerGuard, TagNeighbourList, TropeInsight, TropeMentionList,
  WorkCover, WorkHeader, WorkVoices, useToast,
} from '@/components';
import { Meta } from '@/components/Meta';
import { workMeta } from '@/lib/format';
import { creditsOf, personRef } from '@/lib/credits';
import { SearchLine } from './TodayScreen';
import ru from '@/i18n/ru';

interface Loaded {
  work: WorkDetail;
  discussions: DiscussionPlace[];
  journal: JourneyEntryData[];
  settings: UserSettings;
}

function Desire({ d, open }: { d: CharacterDesire; open: boolean }) {
  return (
    <li>
      <p className="tm-work-sm tm-desires__who">{d.character}</p>
      <span className="tm-label tm-desires__k">{ru.desire.explicit}</span>
      <p className="tm-body-sm tm-desires__v">{d.explicit}</p>
      {d.suppressed && open ? (
        <>
          <span className="tm-label tm-desires__k">{ru.desire.suppressed}</span>
          <p className="tm-body-sm tm-desires__v tm-desires__v--suppressed">
            {d.suppressed}
            <span className="tm-caption tm-desires__vis">{` · ${ru.desire.visibility[d.visibility]}`}</span>
          </p>
        </>
      ) : null}
    </li>
  );
}

/** Экран «Произведение» (/works/:id). Собран из группы «Произведение»: шапка, барьеры,
 *  устройство, приёмы под шторой, разборы и места разговора. Экран только выбирает и
 *  раскладывает: спойлерность каждого приёма и разбора, допустимый уровень из настроек
 *  и факт завершения — всё из данных. */
export function WorkScreen() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<Loaded | null>(null);
  const [missing, setMissing] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [saved, setSaved] = useState(false);
  const [starting, setStarting] = useState(false);
  const toast = useToast();

  useEffect(() => {
    let alive = true;
    setData(null);
    setMissing(false);
    setFailed(false);
    Promise.all([getWork(id), getDiscussions(id), getJourney(), getSettings()])
      .then(([work, discussions, journal, settings]) => {
        if (!alive) return;
        if (!work) { setMissing(true); return; }
        setData({ work, discussions, journal, settings });
      })
      .catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, [id, attempt]);

  if (failed) {
    return (
      <main className="tm-shell__main">
        <ErrorState title={ru.work.errorWork} text={ru.work.errorWorkText} onRetry={() => setAttempt(attempt + 1)} />
      </main>
    );
  }

  if (missing) {
    return (
      <main className="tm-shell__main">
        <EmptyState title={ru.work.notFound} text={ru.work.notFoundText}
                    action={ru.nav.today} onAction={() => navigate('/today')} />
      </main>
    );
  }

  if (!data) {
    return (
      <main className="tm-shell__main" aria-busy="true">
        <span className="tm-sr">{ru.work.loading}</span>
        <div className="tm-workhead">
          <Skeleton kind="cover" style={{ width: 196, height: 255 }} />
          <div style={{ flex: 1 }}>
            <Skeleton kind="title" style={{ width: '80%' }} />
            <Skeleton kind="line" style={{ width: '45%', marginTop: 8 }} />
            <Skeleton kind="line" style={{ width: '60%', marginTop: 16 }} />
            <Skeleton kind="label" style={{ width: 160, marginTop: 16 }} />
          </div>
        </div>
        <div className="tm-work__sections">
          <Skeleton kind="block" style={{ height: 72 }} />
          <Skeleton kind="block" style={{ height: 120 }} />
        </div>
      </main>
    );
  }

  const { work, discussions, journal, settings } = data;
  // Выбор из данных, не расчёт: завершено ли — по дневнику; что можно открывать — по настройке.
  const finished = journal.some((e) => e.work.id === work.id && e.status === 'finished');
  const mechanics = settings.showDetails;
  const allowed: SpoilerLevel = finished ? 2 : settings.spoilerLevel;
  const openInsights = work.tropeInsights.filter((t) => t.spoilerLevel <= allowed);
  const guardedInsights = work.tropeInsights.filter((t) => t.spoilerLevel > allowed);
  const openMentions = (work.tropeMentions ?? []).filter((t) => t.spoilerLevel <= allowed);
  const guardedMentions = (work.tropeMentions ?? []).filter((t) => t.spoilerLevel > allowed);
  const unmet = work.prerequisites.filter((p) => !p.met);
  const characters = work.characters ?? [];
  // подавленное желание закрыто, если его спойлерность выше допустимой; явное видно всегда
  const guardedDesires = characters.filter((d) => d.suppressed && d.spoilerLevel > allowed);
  const modelNote = work.desireModel ? ru.desire.model[work.desireModel] : '';

  // «Смотрю» вместо «Начать смотреть» (24.09): приложение не кинотеатр, и начало просмотра
  // не требует отдельного решения. Потом над лентой спросим «посмотрели?»
  const start = () => {
    setStarting(true);
    startWork(work.id)
      .then(() => { toast({ text: ru.toast.watchMarked }); navigate('/today'); })
      .catch(() => toast({ text: ru.settings.errorSave }))
      .finally(() => setStarting(false));
  };
  const plan = () => {
    if (saved) return;
    setSaved(true);
    planWork(work.id)
      .then(() => toast({ text: ru.toast.savedPlain }))
      .catch(() => { setSaved(false); toast({ text: ru.settings.errorSave }); });
  };

  return (
    <main className="tm-shell__main">
      <WorkHeader work={work} showDetails={settings.showDetails}>
        {/* кто сделал — ссылками на страницу автора (Д3): «это Вильнёв — а что ещё у него» */}
        {creditsOf(work).length ? (
          <p className="tm-voice__outlets tm-work__people">
            {creditsOf(work).slice(0, 6).map((c) => (
              <Link key={`${c.role}-${personRef(c)}`} className="tm-voice__chip" to={`/person/${encodeURIComponent(personRef(c))}`}>
                {ru.person.roleOf[c.role]}: {c.name}
              </Link>
            ))}
          </p>
        ) : null}
        {work.barriers.length || work.warnings.length || work.isNicheMasterpiece ? (
          <div className="tm-row tm-row--wrap tm-row--gap-1 tm-work__tags">
            {work.isNicheMasterpiece ? <BarrierTag label={ru.work.nicheMasterpiece} /> : null}
            {work.barriers.map((b) => <BarrierTag key={b} label={b} />)}
            {work.warnings.map((w) => <BarrierTag key={w} label={w} kind="warning" />)}
          </div>
        ) : null}
        {work.prerequisites.length ? (
          <ReadinessNotice readiness={{ ready: unmet.length === 0, missing: unmet }} />
        ) : null}
        <div className="tm-row tm-row--gap-2 tm-row--wrap tm-work__actions">
          <Button variant="primary" loading={starting} disabled={finished} onClick={start}>
            {work.type === 'book' ? ru.feed.readingMark : ru.feed.watchingMark}
          </Button>
          <Button pressed={saved} disabled={saved || finished} onClick={plan}>{ru.actions.save}</Button>
        </div>
      </WorkHeader>

      <div className="tm-work__sections">
        {finished ? <p className="tm-label tm-work__finished">{ru.work.finished}</p> : null}

        {work.synopsis ? (
          <section className="tm-work__section">
            <h2 className="tm-title-3">{ru.work.about}</h2>
            <p className="tm-prose">{work.synopsis}</p>
          </section>
        ) : null}

        {/* раздел стоит и у фильма без разборов: пустоту объясняет сам WorkVoices, и там же
            вход «знаете разбор, которого здесь нет» — он нужнее всего как раз там, где пусто */}
        <section className="tm-work__section">
          <h2 className="tm-title-3">{ru.work.analyses}</h2>
          <WorkVoices analyses={work.externalAnalyses} spoilerLevel={allowed} workTitle={work.title} />
        </section>

        {/* откуда это и что из этого выросло (Ж1): роман, по которому снято, сиквел, ремейки, франшиза */}
        {work.relations?.length ? (
          <section className="tm-work__section">
            <h2 className="tm-title-3">{ru.relations.title}</h2>
            <ul className="tm-relations">
              {work.relations.map((r) => (
                <li key={`${r.kind}-${r.direction}-${r.qid}`} className="tm-relations__item">
                  <span className="tm-label tm-relations__kind">{ru.relations.label(r.kind, r.direction, r.nodeKind)}</span>
                  {r.workId
                    ? <Link to={`/works/${r.workId}`} className="tm-relations__title">{r.title}</Link>
                    : <span className="tm-relations__title">{r.title}</span>}
                  {r.year ? <span className="tm-caption tm-relations__year">{r.year}</span> : null}
                </li>
              ))}
            </ul>
            <p className="tm-caption tm-work__note">{ru.relations.note}</p>
          </section>
        ) : null}

        {/* темп речи и тишины — раньше разборов: это не чужое мнение, а замер, и он помогает
            решить «сегодня или не сегодня» до того, как читать, что об этом думают */}
        {work.form ? (
          <section className="tm-work__section">
            <FilmFormNote form={work.form} />
          </section>
        ) : null}

        {/* «рядом называют» стоит перед местами разговора: это тоже про разговор, но про то,
            что в нём звучит, а не про то, где он идёт */}
        {work.nearby?.length ? (
          <section className="tm-work__section">
            <CoMentionList items={work.nearby} />
          </section>
        ) : null}

        {/* «описывают похоже» сразу следом: два списка соседей из разных миров, и то, что они
            разные, — само по себе информация, а не ошибка */}
        {work.similarByTags?.length ? (
          <section className="tm-work__section">
            <TagNeighbourList items={work.similarByTags} />
          </section>
        ) : null}

        {discussions.length ? (
          <section className="tm-work__section">
            <h2 className="tm-title-3">{ru.work.discussions}</h2>
            {/* конкретные места — блоками, поиск по каналам — одной строкой (22.09) */}
            {discussions.filter((d) => !d.search).map((d) => (
              <DiscussionLink key={d.id} discussion={d} locked={!finished && d.spoilers} />
            ))}
            <SearchLine places={discussions.filter((d) => d.search)} />
            <p className="tm-caption tm-work__note">{ru.work.discussionsNote}</p>
          </section>
        ) : null}

        {work.tropeInsights.length ? (
          <section className="tm-work__section">
            <h2 className="tm-title-3">{ru.work.tropes}</h2>
            {openInsights.map((t) => <TropeInsight key={t.tropeId} insight={t} />)}
            {guardedInsights.length ? (
              <SpoilerGuard>
                {guardedInsights.map((t) => <TropeInsight key={t.tropeId} insight={t} />)}
              </SpoilerGuard>
            ) : null}
          </section>
        ) : null}

        {/* приёмы с вики — сразу за разобранными руками: то же поле, но другой статус,
            и оговорка обязана стоять рядом, иначе читается как наше утверждение */}
        {work.tropeMentions?.length ? (
          <section className="tm-work__section">
            <h2 className="tm-title-3">{ru.tropeMentions.title}</h2>
            <p className="tm-body-sm tm-work__note">{ru.tropeMentions.why}</p>
            <TropeMentionList items={openMentions} />
            {guardedMentions.length ? (
              <SpoilerGuard>
                <TropeMentionList items={guardedMentions} />
              </SpoilerGuard>
            ) : null}
            <p className="tm-caption tm-work__note">{ru.tropeMentions.credit}</p>
          </section>
        ) : null}

        {mechanics ? (
          <>
        {work.whatItDoes.length ? (
          <section className="tm-work__section">
            <h2 className="tm-title-3">{ru.work.whatItDoes}</h2>
            <ul className="tm-work__does">
              {work.whatItDoes.map((d) => (
                <li key={d.op}>
                  <OperationChip op={d.op} tone="wash" />
                  <p className="tm-body-sm">{d.description}</p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {characters.length || modelNote ? (
          <section className="tm-work__section">
            <h2 className="tm-title-3">{ru.work.characters}</h2>
            {modelNote ? <p className="tm-body-sm tm-desires__model">{modelNote}</p> : null}
            {characters.length ? (
              <ul className="tm-desires">
                {characters.map((d) => <Desire key={d.character} d={d} open={!guardedDesires.includes(d)} />)}
              </ul>
            ) : null}
            {guardedDesires.length ? (
              <SpoilerGuard title={ru.desire.guardTitle} note={ru.desire.guardNote}>
                <ul className="tm-desires">
                  {guardedDesires.map((d) => <Desire key={d.character} d={d} open />)}
                </ul>
              </SpoilerGuard>
            ) : null}
          </section>
        ) : null}
          </>
        ) : null}

        {work.inTrajectories.length ? (
          <section className="tm-work__section">
            <h2 className="tm-title-3">{ru.work.inTrajectories}</h2>
            <ul className="tm-work__list">
              {work.inTrajectories.map((t) => (
                <li key={t.trajectoryId}>
                  <Link to={`/trajectories/${t.trajectoryId}`} className="tm-link--plain tm-work-sm">{t.title}</Link>
                  <Meta items={[ru.work.stepOf + t.stepOrder]} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {work.relatedWorks.length ? (
          <section className="tm-work__section">
            <h2 className="tm-title-3">{ru.work.related}</h2>
            <ul className="tm-work__list">
              {work.relatedWorks.map(({ relation, work: rel }) => (
                <li key={`${relation}-${rel.id}`}>
                  <Link to={`/works/${rel.id}`} className="tm-link--plain tm-work__rel">
                    <WorkCover work={rel} size="sm" />
                    <span className="tm-work__relbody">
                      <span className="tm-label tm-work__rellabel">{ru.relation[relation]}</span>
                      <span className="tm-work-sm">{rel.title}</span>
                      <Meta items={workMeta(rel)} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {work.contributorsCredit.length ? (
          <p className="tm-caption tm-work__credit">{ru.work.credit + work.contributorsCredit.join(', ')}</p>
        ) : null}
      </div>
    </main>
  );
}
