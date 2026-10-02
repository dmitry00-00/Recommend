import { useEffect, useState, type CSSProperties } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getVoiceWorks, type VoiceWorks } from '@/api';
import { EmptyState, ErrorState, Skeleton } from '@/components';
import { monogram } from '@/lib/voices';
import { onExternalClick } from '@/lib/telegram';
import { opVar } from '@/lib/operations';
import { leadName } from '@/lib/credits';
import ru from '@/i18n/ru';

const OUTLET = { youtube: ru.voices.outletYoutube, telegram: ru.voices.outletTelegram, chat: ru.voices.outletChat } as const;

/** Страница автора (/voice/:id): всё, что он разбирал из того, что мы знаем. Открывается по
 *  чипу «Все разборы» из карточки — строка иконок наверху карточки отвечает на вопрос «кто
 *  разбирал этот фильм», а страница — на обратный: «а что он ещё разбирал». Материал тот же,
 *  что в карточках, включая непроверенные привязки: они помечены. */
export function VoiceScreen() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<VoiceWorks | null | undefined>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setData(null);
    setFailed(false);
    getVoiceWorks(id)
      .then((found) => alive && setData(found))
      .catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, [id]);

  const voice = data?.voice;
  const { letter, hue } = monogram(voice?.title ?? '?');
  return (
    <main className="tm-shell__main tm-voicepage">
      <button type="button" className="tm-voicepage__back" onClick={() => navigate(-1)}>{ru.voice.back}</button>

      {failed ? <ErrorState title={ru.state.errorSlate} onRetry={() => setData(null)} /> : null}
      {!data && !failed ? (
        <div aria-busy="true">
          <span className="tm-sr">{ru.today.loading}</span>
          <Skeleton kind="block" style={{ height: 96 }} />
          {[0, 1, 2].map((i) => <Skeleton key={i} kind="block" style={{ height: 88, marginTop: 8 }} />)}
        </div>
      ) : null}
      {data === undefined ? <EmptyState title={ru.voice.unknown} text={ru.voice.unknownText} /> : null}

      {voice && data ? (
        <>
          <header className="tm-voicepage__head">
            <span className="tm-voice__avatar tm-voice__avatar--page" aria-hidden="true"
                  style={voice.avatarUrl ? undefined : { background: `hsl(${hue} 35% 30%)` }}>
              {voice.avatarUrl ? <img className="tm-voice__img" src={voice.avatarUrl} alt="" /> : letter}
            </span>
            <div className="tm-voicepage__who">
              <h1 className="tm-title-2">{voice.title}</h1>
              <p className="tm-caption">{ru.voice.works(data.items.length)}</p>
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

          {!data.items.length ? <EmptyState title={ru.voice.empty} text={ru.voice.emptyText} /> : null}
          <ul className="tm-search__list">
            {data.items.map(({ work, analyses }) => (
              <li key={work.id} className="tm-search__item tm-voicepage__item">
                <button type="button" className="tm-search__open" onClick={() => navigate(`/works/${work.id}`)}>
                  <span className="tm-search__thumb"
                        style={{ '--thumb-line': opVar(work.primaryOperations?.[0]?.op ?? 'synthesis') } as CSSProperties}>
                    {work.stillUrl ?? work.coverUrl
                      ? <img src={work.stillUrl ?? work.coverUrl} alt="" loading="lazy" decoding="async" />
                      : null}
                  </span>
                  <span className="tm-search__text">
                    <span className="tm-search__name">{work.title}</span>
                    <span className="tm-search__meta">{[work.year, leadName(work)].filter(Boolean).join(' · ')}</span>
                    <span className="tm-search__orig">
                      {analyses[0].title}
                      {analyses.length > 1 ? ` · ${ru.voices.nextItem(analyses.length - 1)}` : ''}
                      {analyses[0].unverified ? ` · ${ru.voices.unverified}` : ''}
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
