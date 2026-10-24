import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getVoiceWorks, noteShare, prepareShare, type VoiceWorks } from '@/api';
import { BackLink, Button, EmptyState, ErrorState, Skeleton, useToast } from '@/components';
import { appLink, onExternalClick, shareLink, tap, webApp } from '@/lib/telegram';
import { knownVoice } from '@/lib/voices';
import { voiceKeys } from '@/mocks/voices';
import type { Voice } from '@/types/tmdf';
import { cx } from '@/lib/cx';
import { useFeature } from '@/lib/flags';
import { leadName } from '@/lib/credits';
import { WorkThumb } from '@/components/WorkThumb';
import { Avatar } from '@/components/WorkVoices';
import ui from '@/i18n';
import { titleOf } from '@/lib/format';

const OUTLET = { youtube: ui.voices.outletYoutube, telegram: ui.voices.outletTelegram, chat: ui.voices.outletChat } as const;

/** Ссылка на автора (23.10, партнёрство с каналами): в адресе — id из справочника (`episodes`) или handle его
 *  канала в Telegram (`episodesfilm`, как автор сам себя знает); регистр handle не важен. Незнакомый handle — канал вне
 *  справочника (`tg:<ник>`): getVoiceWorks соберёт его посты или скажет «нет такого автора». */
const HANDLES = new Map(Object.entries(voiceKeys).filter(([k]) => k.startsWith('tg:')).map(([k, v]) => [k.slice(3).toLowerCase(), v]));
const voiceIdOf = (p: string): string =>
  (knownVoice(p) ? p : HANDLES.get(p.toLowerCase()) ?? (/^[A-Za-z0-9_]{2,32}$/.test(p) ? `tg:${p}` : p));

/** «Поделиться» страницей автора (23.10) — как карточкой фильма (ShareButton): в Telegram 8.0+ — карточкой-сообщением
 *  (автор может выбрать свой канал), иначе — ссылкой `startapp=v-<id>`. Метку посева `--s` ставим руками
 *  (tools/author-link.mts), код поделившегося `--r` — сервер. */
function useVoiceShare(voice: Voice | undefined, works: number): (() => Promise<void>) | undefined {
  const toast = useToast();
  // канал вне справочника (`tg:<ник>`, 23.10) — ссылкой по нику: App.tsx примет `v-<ник>` так же
  const handle = voice?.id.startsWith('tg:') ? voice.id.slice(3) : undefined;
  if (!voice || !(knownVoice(voice.id) || (handle && /^[A-Za-z0-9_]{2,32}$/.test(handle)))) return undefined;
  const param = `v-${handle ?? voice.id}`;
  const byLink = () => shareLink(appLink(param), ui.voice.shareText(voice.title)).then((r) => {
    if (r === 'copied') toast({ text: ui.share.copied });
    if (r === 'failed') toast({ text: ui.share.failed });
    else noteShare('voice', r);
  }).catch(() => toast({ text: ui.share.failed }));
  return async () => {
    tap();
    const wa = webApp();
    if (wa?.shareMessage && wa.isVersionAtLeast('8.0')) {
      // аватар — только с известных хостов (сервер проверит сам); свои файлы из public/voices — относительные, мимо
      const image = voice.avatarUrl?.startsWith('https://') ? voice.avatarUrl : undefined;
      const id = await prepareShare({ param, title: voice.title, kind: 'voice', about: ui.voice.works(works), ...(image ? { image } : {}) });
      if (id) { wa.shareMessage(id, (sent) => { if (sent) { toast({ text: ui.share.sent }); noteShare('voice', 'message'); } }); return; }
    }
    await byLink();
  };
}

/** Страница автора (/voice/:id): всё, что он разбирал из того, что мы знаем. Открывается по
 *  чипу «Все разборы» из карточки — строка иконок наверху карточки отвечает на вопрос «кто
 *  разбирал этот фильм», а страница — на обратный: «а что он ещё разбирал». Материал тот же,
 *  что в карточках, включая непроверенные привязки: они помечены. */
export function VoiceScreen() {
  const { id: param = '' } = useParams();
  const id = voiceIdOf(param);
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
  const share = useVoiceShare(voice, data?.items.length ?? 0);
  // страницы людей и вселенных — функция `pages` (23.10): по ссылке автора (`voicePage`) они закрыты, и Gate увёл бы
  // в ленту молча — тогда «О чём говорит» без ссылок, просто чипами
  const pages = useFeature('pages');
  return (
    <main className="tm-shell__main tm-voicepage">
      <BackLink label={ui.voice.back} />

      {failed ? <ErrorState title={ui.state.errorVoice} onRetry={() => setAttempt((n) => n + 1)} /> : null}
      {!data && !failed ? (
        <div aria-busy="true">
          <span className="tm-sr">{ui.actions.loading}</span>
          <Skeleton kind="block" style={{ height: 96 }} />
          {[0, 1, 2].map((i) => <Skeleton key={i} kind="block" style={{ height: 88, marginTop: 8 }} />)}
        </div>
      ) : null}
      {data === undefined ? <EmptyState title={ui.voice.unknown} text={ui.voice.unknownText} /> : null}

      {voice && data ? (
        <>
          <header className="tm-voicepage__head">
            <Avatar voice={voice} size="page" />
            <div className="tm-voicepage__who">
              <h1 className="tm-title-2">{voice.title}</h1>
              <p className="tm-caption">{ui.voice.works(data.items.length)}</p>
            </div>
            {share ? (
              <span style={{ marginLeft: 'auto', flexShrink: 0 }}>
                <Button size="sm" variant="quiet" onClick={() => void share()}>{ui.share.button}</Button>
              </span>
            ) : null}
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
                {data.profile.top.map((t) => (pages ? (
                  <Link key={t.id} className={cx('tm-voice__chip', t.focus && 'tm-voice__chip--on')}
                        to={t.kind === 'universe' ? `/universe/${t.id}` : `/person/${t.id}`}
                        title={t.focus ? ui.voice.focus : undefined}>
                    {t.title} · {ui.voice.share(t.share)}
                  </Link>
                ) : (
                  <span key={t.id} className={cx('tm-voice__chip', t.focus && 'tm-voice__chip--on')} title={t.focus ? ui.voice.focus : undefined}>
                    {t.title} · {ui.voice.share(t.share)}
                  </span>
                )))}
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
