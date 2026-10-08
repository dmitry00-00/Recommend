import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getVoiceWorks, type VoiceWorks } from '@/api';
import { EmptyState, ErrorState, Skeleton } from '@/components';
import { monogram } from '@/lib/voices';
import { onExternalClick } from '@/lib/telegram';
import { cx } from '@/lib/cx';
import { leadName } from '@/lib/credits';
import { WorkThumb } from '@/components/WorkThumb';
import ui from '@/i18n';
import { titleOf } from '@/lib/format';

const OUTLET = { youtube: ui.voices.outletYoutube, telegram: ui.voices.outletTelegram, chat: ui.voices.outletChat } as const;

/** Страница автора (/voice/:id): всё, что он разбирал из того, что мы знаем. Открывается по
 *  чипу «Все разборы» из карточки — строка иконок наверху карточки отвечает на вопрос «кто
 *  разбирал этот фильм», а страница — на обратный: «а что он ещё разбирал». Материал тот же,
 *  что в карточках, включая непроверенные привязки: они помечены. */
export function VoiceScreen() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<VoiceWorks | null | undefined>(null);
  const [failed, setFailed] = useState(false);
  // «Повторить» (ТВ-9): раньше сбрасывал только данные, и загрузка не перезапускалась
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setData(null);
    setFailed(false);
    getVoiceWorks(id)
      .then((found) => alive && setData(found))
      .catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, [id, attempt]);

  const voice = data?.voice;
  const { letter, hue } = monogram(voice?.title ?? '?');
  return (
    <main className="tm-shell__main tm-voicepage">
      <button type="button" className="tm-voicepage__back" onClick={() => navigate(-1)}>{ui.voice.back}</button>

      {failed ? <ErrorState title={ui.state.errorVoice} onRetry={() => setAttempt((n) => n + 1)} /> : null}
      {!data && !failed ? (
        <div aria-busy="true">
          <span className="tm-sr">{ui.today.loading}</span>
          <Skeleton kind="block" style={{ height: 96 }} />
          {[0, 1, 2].map((i) => <Skeleton key={i} kind="block" style={{ height: 88, marginTop: 8 }} />)}
        </div>
      ) : null}
      {data === undefined ? <EmptyState title={ui.voice.unknown} text={ui.voice.unknownText} /> : null}

      {voice && data ? (
        <>
          <header className="tm-voicepage__head">
            <span className="tm-voice__avatar tm-voice__avatar--page" aria-hidden="true"
                  style={voice.avatarUrl ? undefined : { background: `hsl(${hue} 35% 30%)` }}>
              {voice.avatarUrl ? <img className="tm-voice__img" src={voice.avatarUrl} alt="" /> : letter}
            </span>
            <div className="tm-voicepage__who">
              <h1 className="tm-title-2">{voice.title}</h1>
              <p className="tm-caption">{ui.voice.works(data.items.length)}</p>
            </div>
          </header>
          <p className="tm-voice__outlets tm-voicepage__outlets">
            {voice.outlets.map((o) => (
              <a key={o.kind + o.url} className="tm-voice__chip" href={o.url} target="_blank" rel="noreferrer noopener"
                 onClick={onExternalClick(o.url)}>
                {OUTLET[o.kind]}
              </a>
            ))}
          </p>

          {data.profile ? (
            <section className="tm-person__section">
              <h2 className="tm-title-3">{ui.voice.about}</h2>
              <p className="tm-voice__outlets">
                {data.profile.top.map((t) => (
                  <Link key={t.id} className={cx('tm-voice__chip', t.focus && 'tm-voice__chip--on')}
                        to={t.kind === 'universe' ? `/universe/${t.id}` : `/person/${t.id}`}
                        title={t.focus ? ui.voice.focus : undefined}>
                    {t.title} · {ui.voice.share(t.share)}
                  </Link>
                ))}
              </p>
              <p className="tm-caption">{ui.voice.aboutNote(data.profile.n)}</p>
            </section>
          ) : null}

          {!data.items.length ? <EmptyState title={ui.voice.empty} text={ui.voice.emptyText} /> : null}
          <ul className="tm-search__list">
            {data.items.map(({ work, analyses }) => (
              <li key={work.id} className="tm-search__item tm-voicepage__item">
                <button type="button" className="tm-search__open" onClick={() => navigate(`/works/${work.id}`)}>
                  <WorkThumb work={work} />
                  <span className="tm-search__text">
                    <span className="tm-search__name">{titleOf(work)}</span>
                    <span className="tm-search__meta">{[work.year, leadName(work)].filter(Boolean).join(' · ')}</span>
                    <span className="tm-search__orig">
                      {analyses[0].title}
                      {analyses.length > 1 ? ` · ${ui.voices.nextItem(analyses.length - 1)}` : ''}
                      {analyses[0].unverified ? ` · ${ui.voices.unverified}` : analyses[0].evidence === 'model' ? ` · ${ui.voices.byModel}` : ''}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </main>
  );
}
