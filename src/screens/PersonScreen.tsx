import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { followOfWorks, getPerson, getPersonChannel, getSettings, type PersonChannelView, type PersonPage } from '@/api';
import type { SpoilerLevel } from '@/types/tmdf';
import { BackLink, EmptyState, ErrorState, ExternalAnalysisLink, FollowButton, ShareButton, Skeleton } from '@/components';
import { registers } from '@/lib/registers';
import { useMechanics, useRole } from '@/lib/settingsStore';
import { WorkThumb } from '@/components/WorkThumb';
import { Face } from '@/components/Face';
import { OpenContext } from '@/lib/openContext';
import ui from '@/i18n';
import { titleOf } from '@/lib/format';
import { useFeature } from '@/lib/flags';
import { onExternalClick } from '@/lib/telegram';
import { voiceOf } from '@/lib/voices';
import { FeedPost } from '@/components/WorkVoices';

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
  const [openWork, setOpenWork] = useState<string>();
  // канал автора (24.10, флаг personChannel): отдельным запросом, чтобы страница не ждала постов канала
  const channelOn = useFeature('personChannel');
  const [channel, setChannel] = useState<PersonChannelView | undefined>();

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

  useEffect(() => {
    let alive = true;
    setChannel(undefined);
    if (channelOn) getPersonChannel(id).then((c) => alive && setChannel(c)).catch(() => undefined);
    return () => { alive = false; };
  }, [id, channelOn]);

  // разборы вещей, у которых нет строки в «Работах» (это «С чего начать»), — отдельным списком; остальные — в строках
  const listed = data ? data.works.filter(({ work }) => work.id !== data.startWith?.work.id).map((x) => x.work) : [];
  const loose = data ? data.analyses.filter((x) => !listed.some((w) => sameWork(w, x.work))) : [];
  return (
    <main className="tm-shell__main tm-voicepage tm-person">
      <BackLink label={ui.person.back} />

      {failed ? <ErrorState title={ui.state.errorPerson} onRetry={() => setAttempt((n) => n + 1)} /> : null}
      {data === null && !failed ? (
        <div aria-busy="true">
          <span className="tm-sr">{ui.actions.loading}</span>
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
            {/* почерк (14.10): что его вещи делают со зрителем, обычный уровень и барьеры */}
            {data.style ? (
              <>
                <p className="tm-body tm-person__style">{data.style.what}</p>
                <p className="tm-caption tm-person__stylemeta">
                  {[ui.person.styleLevel(data.style.lo, data.style.hi), data.style.barriers.length ? ui.person.styleBarriers(data.style.barriers) : undefined].filter(Boolean).join(' · ')}
                </p>
              </>
            ) : null}
            <p className="tm-caption">
              {[data.roles.map((r) => ui.person.role[r]).join(', '), data.works.length ? ui.person.works(data.works.length) : undefined,
                data.acting.length ? ui.person.acting(data.acting.length) : undefined,
                data.wikidata ? undefined : ui.person.byName].filter(Boolean).join(' · ')}
            </p>
            {/* «Поделиться» и «Следить» (25.10): следить — новые разборы его работ и ролей в сводке от бота */}
            <p className="tm-row tm-row--gap-2 tm-person__actions">
              <FollowButton target={followOfWorks('person', id, data.person.name, [...data.works.map((x) => x.work), ...data.acting.map((x) => x.work)])} />
              <ShareButton page={{ kind: 'person', id, title: data.person.name, ...(data.info?.description ? { about: data.info.description } : {}),
                ...(data.info?.image ? { image: data.info.image } : {}) }} />
            </p>
            {admin ? (
              <p className="tm-voice__outlets tm-work__statslink">
                <Link className="tm-voice__chip" to={`/stats/person/${encodeURIComponent(id)}`}>{ui.stats.link}</Link>
              </p>
            ) : null}
          </header>

          {channel ? <PersonChannel channel={channel} spoilers={spoilers} /> : null}

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

          {data.works.length ? (
            <section className="tm-person__section">
              <h2 className="tm-title-3">{ui.person.worksTitle}</h2>
              <ul className="tm-search__list">
                {/* «С чего начать» в списке работ не повторяем (17.10) */}
                {data.works.filter(({ work }) => work.id !== data.startWith?.work.id).map(({ work, roles, analyses, seen }) => {
                  // разборы — в строке своей работы (25.10, аудит карточек): «3 разбора ▾» раскрывает их здесь же
                  const own = data.analyses.filter((x) => sameWork(x.work, work));
                  const open = openWork === work.id;
                  return (
                  <li key={work.id} className="tm-search__item tm-voicepage__item tm-person__workrow">
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
                            analyses && !own.length ? ui.person.analyses(analyses) : undefined].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                    </button>
                    {own.length ? (
                      <button type="button" className="tm-voice__chip tm-voicepage__post" aria-expanded={open}
                              onClick={() => setOpenWork(open ? undefined : work.id)}>
                        {ui.person.analyses(Math.max(analyses, own.length))} {open ? '▴' : '▾'}
                      </button>
                    ) : null}
                    {open ? (
                      <ul className="tm-person__essays tm-person__workessays">
                        {own.map(({ analysis }) => (
                          <li key={analysis.url}>
                            <OpenContext.Provider value={{ place: 'person', workId: work.id }}>
                              <ExternalAnalysisLink analysis={analysis} spoilerLevel={seen ? 2 : spoilers} />
                            </OpenContext.Provider>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          {/* роли актёра с каналом в Telegram (25.10): после работ, без уровня и «с чего начать» — не акцент */}
          {data.acting.length ? (
            <section className="tm-person__section">
              <h2 className="tm-title-3">{ui.person.actingTitle}</h2>
              <ul className="tm-search__list">
                {data.acting.map(({ work, seen }) => (
                  <li key={work.id} className="tm-search__item tm-voicepage__item">
                    <button type="button" className="tm-search__open" onClick={() => navigate(`/works/${work.id}`)}>
                      <Thumb work={work} />
                      <span className="tm-search__text">
                        <span className="tm-search__name">{titleOf(work)}</span>
                        <span className="tm-search__meta">{[work.year || undefined, seen ? ui.person.seen : undefined].filter(Boolean).join(' · ')}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {data.about.length ? (
            <section className="tm-person__section">
              <h2 className="tm-title-3">{ui.person.aboutTitle}</h2>
              <p className="tm-caption">{ui.person.aboutNote}</p>
              <ul className="tm-person__essays">
                {data.about.map((a) => <li key={a.url}><ExternalAnalysisLink analysis={a} spoilerLevel={spoilers} /></li>)}
              </ul>
            </section>
          ) : null}

          {/* отдельным списком — только разборы вещей, которых нет в строках работ («С чего начать»); остальные — в строках */}
          {loose.length || !data.analyses.length ? (
          <section className="tm-person__section">
            <h2 className="tm-title-3">{ui.person.essaysTitle}</h2>
            {loose.length ? (
              <ul className="tm-person__essays">
                {/* по вещам (17.10): название — один раз над её разборами, а не над каждым («Солярис» ×5 вперемешку) */}
                {byWorkFirst(loose).map(({ work, analysis, seen }, i, list) => (
                  <li key={analysis.url}>
                    {i && sameWork(list[i - 1].work, work) ? null : <p className="tm-caption tm-person__about">{titleOf(work)}</p>}
                    {/* как в карточке: видели — открыто всё, нет — по настройке спойлеров */}
                    <OpenContext.Provider value={{ place: 'person', workId: work.id }}>
                      <ExternalAnalysisLink analysis={analysis} spoilerLevel={seen ? 2 : spoilers} />
                    </OpenContext.Provider>
                  </li>
                ))}
              </ul>
            ) : <p className="tm-body-sm tm-settings__note">{ui.person.essaysNone}</p>}
          </section>
          ) : null}

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

/** Канал автора (24.10): имя канала, «Открыть канал» и его посты о своих работах — карточками ленты постов, как в
 *  карточке фильма (FeedPost), по вещам: название — над её постами. Постов нет — только ссылка. */
function PersonChannel({ channel, spoilers }: { channel: PersonChannelView; spoilers: SpoilerLevel }) {
  const groups: { work: PersonChannelView['posts'][number]['work']; items: PersonChannelView['posts'] }[] = [];
  for (const x of channel.posts) {
    const g = groups.find((y) => y.work.id === x.work.id);
    if (g) g.items.push(x); else groups.push({ work: x.work, items: [x] });
  }
  return (
    <section className="tm-person__section tm-person__channel">
      <h2 className="tm-title-3">{ui.person.channelTitle}</h2>
      <p className="tm-body">{channel.title}</p>
      <p className="tm-voice__outlets">
        <a className="tm-btn tm-btn--secondary tm-btn--sm" href={channel.url} target="_blank" rel="noreferrer noopener"
           onClick={onExternalClick(channel.url)}>{ui.person.channelOpen}</a>
      </p>
      {groups.length ? <p className="tm-caption tm-person__about">{ui.person.channelPosts}</p> : null}
      {groups.map(({ work, items }) => (
        <div key={work.id}>
          <p className="tm-caption tm-person__about">{titleOf(work)}</p>
          {/* как в карточке: видели — открыто всё, нет — по настройке спойлеров */}
          <OpenContext.Provider value={{ place: 'person', workId: work.id }}>
            <div className="tm-voicefeed__list tm-voicefeed__list--telegram">
              {items.map(({ analysis, seen }) => (
                <FeedPost key={analysis.id} item={{ a: analysis, voice: voiceOf(analysis) }} spoilerLevel={seen ? 2 : spoilers} shelves={false} />
              ))}
            </div>
          </OpenContext.Provider>
        </div>
      ))}
    </section>
  );
}

type Essay = PersonPage['analyses'][number];
const sameWork = (a: Essay['work'], b: Essay['work']) => a.id === b.id || (a.title === b.title && a.year === b.year && a.type === b.type);
/** Разборы вместе по вещам, вещи — в порядке первого (самого свежего) разбора, внутри — как пришли (17.10). */
function byWorkFirst(list: Essay[]): Essay[] {
  const groups: Essay[][] = [];
  for (const x of list) {
    const g = groups.find((y) => sameWork(y[0].work, x.work));
    if (g) g.push(x); else groups.push([x]);
  }
  return groups.flat();
}
