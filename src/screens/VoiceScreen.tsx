import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getAudioChannel, getVoiceSupport, getVoiceWorks, noteShare, prepareShare, type AudioChannel, type SupportLink, type VoiceWorks } from '@/api';
import { AudioShelf } from '@/components/AudioShelf';
import { BackLink, Button, EmptyState, ErrorState, Skeleton, useToast } from '@/components';
import { appLink, onExternalClick, openExternal, shareLink, tap, webApp } from '@/lib/telegram';
import { knownVoice } from '@/lib/voices';
import { voiceKeys } from '@/mocks/voices';
import type { Voice, WorkCard } from '@/types/tmdf';
import { cx } from '@/lib/cx';
import { useFeature } from '@/lib/flags';
import { leadName } from '@/lib/credits';
import { WorkThumb } from '@/components/WorkThumb';
import { Avatar } from '@/components/WorkVoices';
import { swapWorks } from '@/lib/swapWorks';
import ui from '@/i18n';
import { titleOf } from '@/lib/format';

const OUTLET = { youtube: ui.voices.outletYoutube, telegram: ui.voices.outletTelegram, chat: ui.voices.outletChat } as const;
/** названия сервисов донатов (25.10): марки — как пишут сами сервисы */
const SUPPORT: Record<SupportLink['s'], string> = {
  boosty: 'Boosty', tribute: 'Tribute', patreon: 'Patreon', tbank: 'Т-Банк', donationalerts: 'DonationAlerts', donatty: 'Donatty', cloudtips: 'CloudTips',
};
/** канал (`t.me/<ник>`) и пост канала (`t.me/<ник>/<id>`): чат и приглашения сюда не идут */
const TELEGRAM_CHANNEL = /^https:\/\/t\.me\/[A-Za-z0-9_]{4,32}\/?$/;
const TELEGRAM_POST = /^https:\/\/t\.me\/[A-Za-z0-9_]{4,32}\/\d+\/?(\?.*)?$/;

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
    // обложки TMDb — следом (25.10): страница не ждёт их до 6 с; пришли раньше страницы — подставятся в неё
    let page: VoiceWorks | undefined | null = null;
    let got: Map<string, WorkCard> | undefined;
    const show = () => { if (alive && page !== null) setData(page && got ? swapWorks(page, got) : page); };
    getVoiceWorks(id, (g) => { got = g; show(); })
      .then((found) => { page = found; show(); })
      .catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, [id, attempt]);

  const voice = data?.voice;
  const share = useVoiceShare(voice, data?.items.length ?? 0);
  // страницы людей и вселенных — функция `pages` (23.10): по ссылке автора (`voicePage`) они закрыты, и Gate увёл бы
  // в ленту молча — тогда «О чём говорит» без ссылок, просто чипами
  const pages = useFeature('pages');
  const channel = voice?.outlets.find((o) => o.kind === 'telegram' && TELEGRAM_CHANNEL.test(o.url));
  // «Поддержать автора» (25.10, флаг `support`): только найденное у самого автора; не нашли — панели нет
  const supportOn = useFeature('support');
  const [support, setSupport] = useState<SupportLink[]>([]);
  const handle = channel?.url.replace(/^https:\/\/t\.me\//, '').replace(/\/$/, '');
  useEffect(() => {
    setSupport([]);
    if (!supportOn || !handle) return;
    let alive = true;
    getVoiceSupport(handle).then((s) => alive && setSupport(s)).catch(() => undefined);
    return () => { alive = false; };
  }, [supportOn, handle]);
  // аудиоканал (25.10): записи по авторам и циклам вместо списка фильмов
  const [audio, setAudio] = useState<AudioChannel>();
  useEffect(() => {
    setAudio(undefined);
    if (!handle) return;
    let alive = true;
    getAudioChannel(handle).then((a) => alive && setAudio(a)).catch(() => undefined);
    return () => { alive = false; };
  }, [handle]);
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
              {audio || data.items.length ? <p className="tm-caption">{audio ? ui.voice.audioCount(audio.readings.length, audio.reader) : ui.voice.works(data.items.length)}</p> : null}
            </div>
            {share ? (
              <span style={{ marginLeft: 'auto', flexShrink: 0 }}>
                <Button size="sm" variant="quiet" onClick={() => void share()}>{ui.share.button}</Button>
              </span>
            ) : null}
          </header>
          {/* Telegram first (25.10): канал автора — главной кнопкой; посты открываются родным плеером Telegram */}
          {channel ? (
            <p className="tm-voicepage__subscribe">
              <Button size="sm" onClick={() => { tap(); openExternal(channel.url); }}>{ui.voice.subscribe}</Button>
            </p>
          ) : null}
          <p className="tm-voice__outlets tm-voicepage__outlets">
            {voice.outlets.filter((o) => o !== channel).map((o) => (
              <a key={o.kind + o.url} className="tm-voice__chip" href={o.url} target="_blank" rel="noreferrer noopener"
                 onClick={onExternalClick(o.url)}>
                {OUTLET[o.kind]}
              </a>
            ))}
          </p>

          {support.length ? (
            <section className="tm-person__section tm-voicepage__support">
              <h2 className="tm-title-3">{ui.voice.support}</h2>
              <p className="tm-voice__outlets">
                {support.map((l) => (
                  <a key={l.u} className="tm-voice__chip" href={l.u} target="_blank" rel="noreferrer noopener" onClick={onExternalClick(l.u)}>
                    {SUPPORT[l.s]}
                  </a>
                ))}
              </p>
              <p className="tm-caption">{ui.voice.supportNote}</p>
            </section>
          ) : null}

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

          {audio && handle ? <AudioShelf handle={handle} channel={audio} /> : null}
          {!data.items.length && !audio ? <EmptyState title={ui.voice.empty} text={ui.voice.emptyText} /> : null}
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
                {/* пост разбора в Telegram — сразу туда (25.10): строка ведёт в карточку фильма, ради неё к нам пришли */}
                {TELEGRAM_POST.test(analyses[0].url) ? (
                  <a className="tm-voice__chip tm-voicepage__post" href={analyses[0].url} target="_blank" rel="noreferrer noopener"
                     onClick={onExternalClick(analyses[0].url)}>{ui.voice.openPost}</a>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </main>
  );
}
