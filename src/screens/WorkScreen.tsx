import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type {
  CharacterDesire, DiscussionPlace, JourneyEntryData, SpoilerLevel, UserSettings, WorkDetail,
} from '@/types/tmdf';
import { followOfWork, getDiscussions, getJourney, getSettings, getWork, noteCard, planWork, startWork } from '@/api';
import {
  BarrierTag, Button, CoMentionList, DiscussionLink, EmptyState, ErrorState, FilmFormNote, OperationChip,
  ReadinessNotice, Skeleton, SpoilerGuard, TagNeighbourList, TropeInsight, TropeMentionList,
  FollowButton, QuickMark, ShareButton, WorkCover, WorkHeader, WorkIssueSheet, WorkVoices, useToast,
} from '@/components';
import { Meta } from '@/components/Meta';
import { workMeta, titleOf } from '@/lib/format';
import { creditsOf, personRef, readableName, type CreditView } from '@/lib/credits';
import { SearchLine } from './WorkPlaces';
import { useRole } from '@/lib/settingsStore';
import ui from '@/i18n';

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
      <span className="tm-label tm-desires__k">{ui.desire.explicit}</span>
      <p className="tm-body-sm tm-desires__v">{d.explicit}</p>
      {d.suppressed && open ? (
        <>
          <span className="tm-label tm-desires__k">{ui.desire.suppressed}</span>
          <p className="tm-body-sm tm-desires__v tm-desires__v--suppressed">
            {d.suppressed}
            <span className="tm-caption tm-desires__vis">{` · ${ui.desire.visibility[d.visibility]}`}</span>
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
  // статистика — только админу (ТВ-3в)
  const admin = useRole() === 'admin';
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<Loaded | null>(null);
  const [missing, setMissing] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [saved, setSaved] = useState(false);
  const [starting, setStarting] = useState(false);
  // облегчённый учёт (02.10): отметка «посмотрел/бросил» прямо здесь, без перезагрузки экрана
  const [marked, setMarked] = useState<'finished' | 'abandoned' | null>(null);
  const [issue, setIssue] = useState(false);
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
        noteCard(work.id, 'works');
      })
      .catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, [id, attempt]);

  if (failed) {
    return (
      <main className="tm-shell__main">
        <ErrorState title={ui.work.errorWork} text={ui.work.errorWorkText} onRetry={() => setAttempt(attempt + 1)} />
      </main>
    );
  }

  if (missing) {
    return (
      <main className="tm-shell__main">
        <EmptyState title={ui.work.notFound} text={ui.work.notFoundText}
                    action={ui.nav.today} onAction={() => navigate('/today')} />
      </main>
    );
  }

  if (!data) {
    return (
      <main className="tm-shell__main" aria-busy="true">
        <span className="tm-sr">{ui.work.loading}</span>
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
  const finished = marked === 'finished' || journal.some((e) => e.work.id === work.id && e.status === 'finished');
  const abandoned = !finished && (marked === 'abandoned' || journal.some((e) => e.work.id === work.id && e.status === 'abandoned'));
  const mechanics = settings.showDetails;
  const allowed: SpoilerLevel = finished ? 2 : settings.spoilerLevel;
  const openInsights = work.tropeInsights.filter((t) => t.spoilerLevel <= allowed);
  const guardedInsights = work.tropeInsights.filter((t) => t.spoilerLevel > allowed);
  const openMentions = (work.tropeMentions ?? []).filter((t) => t.spoilerLevel <= allowed);
  const guardedMentions = (work.tropeMentions ?? []).filter((t) => t.spoilerLevel > allowed);
  const unmet = work.prerequisites.filter((p) => !p.met);
  // авторы по ролям, в порядке первого появления роли; не больше шести имён на карточку
  const people = [...creditsOf(work).filter((c) => readableName(c.name)).slice(0, 6)
    .reduce((m, c) => { const list = m.get(c.role) ?? []; if (!list.some((x) => personRef(x) === personRef(c))) list.push(c); return m.set(c.role, list); },
      new Map<CreditView['role'], CreditView[]>())];
  const characters = work.characters ?? [];
  // подавленное желание закрыто, если его спойлерность выше допустимой; явное видно всегда
  const guardedDesires = characters.filter((d) => d.suppressed && d.spoilerLevel > allowed);
  const modelNote = work.desireModel ? ui.desire.model[work.desireModel] : '';

  // «Смотрю» вместо «Начать смотреть» (24.09): приложение не кинотеатр, и начало просмотра
  // не требует отдельного решения. Потом над лентой спросим «посмотрели?»
  const start = () => {
    setStarting(true);
    startWork(work.id)
      .then(() => { toast({ text: work.type === 'book' ? ui.toast.readMarked : ui.toast.watchMarked }); navigate('/today'); })
      .catch(() => toast({ text: ui.settings.errorSave }))
      .finally(() => setStarting(false));
  };
  const plan = () => {
    if (saved) return;
    setSaved(true);
    planWork(work.id)
      .then(() => toast({ text: ui.toast.savedPlain }))
      .catch(() => { setSaved(false); toast({ text: ui.settings.errorSave }); });
  };

  return (
    <main className="tm-shell__main">
      <WorkHeader work={work} showDetails={settings.showDetails}>
        {/* кто сделал — ссылками на страницу автора (Д3): «это Вильнёв — а что ещё у него». Строкой на роль
            («Сценарий: Мэтт Ривз, Питер Крэйг»), колонка ролей одной ширины — вид не зависит от имён */}
        {people.length ? (
          <dl className="tm-work__people">
            {people.map(([role, list]) => (
              <div key={role} className="tm-work__peoplerow">
                <dt>{ui.person.roleOf[role]}</dt>
                <dd>
                  {list.map((c, i) => (
                    <span key={personRef(c)}>
                      {i ? ', ' : null}
                      <Link className="tm-work__person" to={`/person/${encodeURIComponent(personRef(c))}`}>{c.name}</Link>
                    </span>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
        {work.barriers.length || work.warnings.length || work.isNicheMasterpiece ? (
          <div className="tm-row tm-row--wrap tm-row--gap-1 tm-work__tags">
            {work.isNicheMasterpiece ? <BarrierTag label={ui.work.nicheMasterpiece} /> : null}
            {work.barriers.map((b) => <BarrierTag key={b} label={b} />)}
            {work.warnings.map((w) => <BarrierTag key={w} label={w} kind="warning" />)}
          </div>
        ) : null}
        {work.prerequisites.length ? (
          <ReadinessNotice readiness={{ ready: unmet.length === 0, missing: unmet }} />
        ) : null}
        {/* действия одной линией (06.10): «Посмотрел», «Бросил», «В планы», «Поделиться» — сеткой равных
            ячеек, ряд не переносится и не меняет вид от слов */}
        {settings.diary ? (
          <div className="tm-work__actions tm-work__bar">
            <Button variant="primary" loading={starting} disabled={finished} onClick={start}>
              {work.type === 'book' ? ui.feed.readingMark : ui.feed.watchingMark}
            </Button>
            <Button pressed={saved} disabled={saved || finished} onClick={plan}>{ui.actions.save}</Button>
            <ShareButton work={work} />
          </div>
        ) : finished ? (
          <div className="tm-work__share"><ShareButton work={work} /></div>
        ) : (
          // облегчённый учёт (02.10): «посмотрел» с оценкой, «бросил», «в планы» — без «смотрю сейчас»
          <div className="tm-work__actions">
            <QuickMark work={work} primary onDone={setMarked} rowClassName="tm-quick tm-work__bar"
                       extra={<>
                         <Button pressed={saved} disabled={saved} onClick={plan}>{ui.actions.save}</Button>
                         <ShareButton work={work} />
                       </>} />
            {abandoned ? <p className="tm-caption tm-work__finished">{ui.quick.abandonedMark}</p> : null}
          </div>
        )}
      </WorkHeader>

      <div className="tm-work__sections">
        {finished ? <p className="tm-label tm-work__finished">{ui.work.finished}</p> : null}

        {work.synopsis ? (
          <section className="tm-work__section">
            <h2 className="tm-title-3">{ui.work.about}</h2>
            <p className="tm-prose">{work.synopsis}</p>
          </section>
        ) : null}

        {/* раздел стоит и у фильма без разборов: пустоту объясняет сам WorkVoices, и там же
            вход «знаете разбор, которого здесь нет» — он нужнее всего как раз там, где пусто */}
        <section className="tm-work__section">
          {/* «Следить» (06.10): новые разборы этого произведения — сводкой от бота раз в день */}
          <div className="tm-work__sechead">
            <h2 className="tm-title-3">{ui.work.analyses}</h2>
            <FollowButton target={followOfWork(work)} />
          </div>
          <WorkVoices analyses={work.externalAnalyses} spoilerLevel={allowed} workTitle={titleOf(work)} kind={work.type} workId={work.id} />
          {admin && work.externalAnalyses?.length ? (
            <p className="tm-voice__outlets tm-work__statslink">
              <Link className="tm-voice__chip" to={`/stats/work/${work.id}`}>{ui.stats.link}</Link>
            </p>
          ) : null}
        </section>

        {/* откуда это и что из этого выросло (Ж1): роман, по которому снято, сиквел, ремейки, франшиза */}
        {work.relations?.length || work.universe ? (
          <section className="tm-work__section">
            <h2 className="tm-title-3">{ui.relations.title}</h2>
            {work.universe ? (
              <p className="tm-voice__outlets tm-work__statslink">
                <Link className="tm-voice__chip" to={`/universe/${work.universe.id}`}>{ui.universe.link(work.universe.title, work.universe.size)}</Link>
              </p>
            ) : null}
            <ul className="tm-relations">
              {(work.relations ?? []).map((r) => (
                <li key={`${r.kind}-${r.direction}-${r.qid}`} className="tm-relations__item">
                  <span className="tm-label tm-relations__kind">{ui.relations.label(r.kind, r.direction, r.nodeKind)}</span>
                  {r.workId
                    ? <Link to={`/works/${r.workId}`} className="tm-relations__title">{r.title}</Link>
                    : <span className="tm-relations__title">{r.title}</span>}
                  {r.year ? <span className="tm-caption tm-relations__year">{r.year}</span> : null}
                </li>
              ))}
            </ul>
            <p className="tm-caption tm-work__note">{ui.relations.note}</p>
          </section>
        ) : null}

        {/* герои, которые есть и в других произведениях (И1): Холмс, Джокер, Дракула */}
        {work.heroes?.length ? (
          <section className="tm-work__section">
            <h2 className="tm-title-3">{ui.heroes.title}</h2>
            <ul className="tm-relations">
              {work.heroes.map((h) => (
                <li key={h.id} className="tm-relations__item tm-heroes__item">
                  <Link to={`/character/${h.id}`} className="tm-heroes__face" aria-hidden="true" tabIndex={-1}>
                    {h.image ? <img src={h.image.url} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer"
                                    title={h.image.actor ? ui.hero.played(h.image.actor) : undefined} /> : <span>{h.name.slice(0, 1)}</span>}
                  </Link>
                  <Link to={`/character/${h.id}`} className="tm-label tm-relations__kind">{h.name}</Link>
                  <span className="tm-caption tm-relations__year">{ui.heroes.also}</span>
                  {h.elsewhere.slice(0, 8).map((w, i) => (
                    <span key={w.workId} className="tm-heroes__work">
                      <Link to={`/works/${w.workId}`} className="tm-relations__title">{w.title}</Link>
                      {w.year ? <span className="tm-caption tm-relations__year">{` ${w.year}`}</span> : null}
                      {i < Math.min(h.elsewhere.length, 8) - 1 ? ',' : null}
                    </span>
                  ))}
                  {h.elsewhere.length > 8 ? <span className="tm-caption">{ui.heroes.more(h.elsewhere.length - 8)}</span> : null}
                </li>
              ))}
            </ul>
            <p className="tm-caption tm-work__note">{ui.heroes.note}</p>
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
            <h2 className="tm-title-3">{ui.work.discussions}</h2>
            {/* конкретные места — блоками, поиск по каналам — одной строкой (22.09) */}
            {discussions.filter((d) => !d.search).map((d) => (
              <DiscussionLink key={d.id} discussion={d} locked={!finished && d.spoilers} />
            ))}
            <SearchLine places={discussions.filter((d) => d.search)} />
            <p className="tm-caption tm-work__note">{ui.work.discussionsNote}</p>
          </section>
        ) : null}

        {work.tropeInsights.length ? (
          <section className="tm-work__section">
            <h2 className="tm-title-3">{ui.work.tropes}</h2>
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
            <h2 className="tm-title-3">{ui.tropeMentions.title}</h2>
            <p className="tm-body-sm tm-work__note">{ui.tropeMentions.why}</p>
            <TropeMentionList items={openMentions} />
            {guardedMentions.length ? (
              <SpoilerGuard>
                <TropeMentionList items={guardedMentions} />
              </SpoilerGuard>
            ) : null}
            <p className="tm-caption tm-work__note">{ui.tropeMentions.credit}</p>
          </section>
        ) : null}

        {mechanics ? (
          <>
        {work.whatItDoes.length ? (
          <section className="tm-work__section">
            <h2 className="tm-title-3">{ui.work.whatItDoes}</h2>
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
            <h2 className="tm-title-3">{ui.work.characters}</h2>
            {modelNote ? <p className="tm-body-sm tm-desires__model">{modelNote}</p> : null}
            {characters.length ? (
              <ul className="tm-desires">
                {characters.map((d) => <Desire key={d.character} d={d} open={!guardedDesires.includes(d)} />)}
              </ul>
            ) : null}
            {guardedDesires.length ? (
              <SpoilerGuard title={ui.desire.guardTitle} note={ui.desire.guardNote}>
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
            <h2 className="tm-title-3">{ui.work.inTrajectories}</h2>
            <ul className="tm-work__list">
              {work.inTrajectories.map((t) => (
                <li key={t.trajectoryId}>
                  <Link to={`/trajectories/${t.trajectoryId}`} className="tm-link--plain tm-work-sm">{t.title}</Link>
                  <Meta items={[ui.work.stepOf + t.stepOrder]} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {work.relatedWorks.length ? (
          <section className="tm-work__section">
            <h2 className="tm-title-3">{ui.work.related}</h2>
            <ul className="tm-work__list">
              {work.relatedWorks.map(({ relation, work: rel }) => (
                <li key={`${relation}-${rel.id}`}>
                  <Link to={`/works/${rel.id}`} className="tm-link--plain tm-work__rel">
                    <WorkCover work={rel} size="sm" />
                    <span className="tm-work__relbody">
                      <span className="tm-label tm-work__rellabel">{ui.relation[relation]}</span>
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
          <p className="tm-caption tm-work__credit">{ui.work.credit + work.contributorsCredit.join(', ')}</p>
        ) : null}

        {/* неточность в карточке (02.10): последней строкой — сначала человек видит карточку целиком */}
        <p className="tm-caption tm-work__note">
          <button type="button" className="tm-search__link" onClick={() => setIssue(true)}>{ui.issue.link}</button>
        </p>
        <WorkIssueSheet open={issue} onOpenChange={setIssue} work={work} context="страница произведения" />
      </div>
    </main>
  );
}
