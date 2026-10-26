import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AudioChannel, AudioReading } from '@/api';
import { openExternal, tap } from '@/lib/telegram';
import { cx } from '@/lib/cx';
import ui from '@/i18n';

/** Карточка аудиоканала (25.10, «Читальня»): записи по авторам и циклам, свежее сверху. Нажатие — пост канала в
 *  Telegram: там родной плеер играет в фоне и сам идёт к следующей записи; своего плеера нет. Фильтры — жанр и вид,
 *  только те, что есть в записях. Запись не карточка произведения: «книга» — только при точном совпадении с каталогом. */
export function AudioShelf({ handle, channel }: { handle: string; channel: AudioChannel }) {
  const navigate = useNavigate();
  const [genre, setGenre] = useState<string>();
  const [kind, setKind] = useState<'short' | 'novel'>();
  const all = channel.readings;
  const genres = useMemo(() => {
    const n = new Map<string, number>();
    for (const r of all) if (r.genre) n.set(r.genre, (n.get(r.genre) ?? 0) + 1);
    return [...n].filter(([, c]) => c >= 3).sort((a, b) => b[1] - a[1]).map(([g]) => g);
  }, [all]);
  const novel = (r: AudioReading) => r.kind === 'роман' || Boolean(r.parts);
  const shown = all.filter((r) => (!genre || r.genre === genre) && (!kind || (kind === 'novel') === novel(r)));
  const fresh = [...shown].sort((a, b) => b.post - a.post).slice(0, 5);
  const byAuthor = useMemo(() => {
    const m = new Map<string, AudioReading[]>();
    for (const r of shown) m.set(r.author, [...(m.get(r.author) ?? []), r]);
    // внутри автора — по циклу, потом по году, потом по выходу
    return [...m].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], 'ru'))
      .map(([a, rs]) => [a, rs.sort((x, y) => (x.cycle ?? '￿').localeCompare(y.cycle ?? '￿', 'ru') || (x.year ?? 9999) - (y.year ?? 9999) || x.post - y.post)] as const);
  }, [shown]);

  const chip = (on: boolean, label: string, onClick: () => void) => (
    <button key={label} type="button" aria-pressed={on} className={cx('tm-voice__chip', on && 'tm-voice__chip--on')} onClick={onClick}>{label}</button>
  );
  const row = (r: AudioReading, withAuthor = false) => (
    <li key={`${withAuthor ? 'f' : ''}${r.post}`} className="tm-search__item tm-voicepage__item tm-audio__item">
      <button type="button" className="tm-search__open" onClick={() => { tap(); openExternal(`https://t.me/${handle}/${r.post}`); }}>
        <span className="tm-search__thumb tm-audio__icon" aria-hidden="true">🎧</span>
        <span className="tm-search__text">
          <span className="tm-search__name">{r.title}</span>
          <span className="tm-search__meta">
            {[withAuthor ? r.author : undefined, r.original, r.year, r.parts ? ui.voice.audioParts(r.parts.length) : r.kind === 'роман' ? ui.voice.audioWhole : r.kind,
              r.cycle ? ui.voice.audioCycle(r.cycle) : undefined, r.minutes ? ui.voice.audioMinutes(r.minutes) : undefined].filter(Boolean).join(' · ')}
          </span>
          {r.about ? <span className="tm-search__orig tm-audio__about">{r.about}</span> : null}
        </span>
      </button>
      {r.workId ? (
        <button type="button" className="tm-voice__chip tm-voicepage__post" onClick={() => navigate(`/works/${r.workId}`)}>{ui.voice.audioBook}</button>
      ) : null}
    </li>
  );

  return (
    <>
      <p className="tm-voice__outlets tm-audio__filters" role="group">
        {chip(!genre && !kind, ui.voice.audioAll, () => { setGenre(undefined); setKind(undefined); })}
        {genres.map((g) => chip(genre === g, g, () => setGenre(genre === g ? undefined : g)))}
        {all.some(novel) ? chip(kind === 'novel', ui.voice.audioWhole, () => setKind(kind === 'novel' ? undefined : 'novel')) : null}
      </p>
      <p className="tm-caption">{ui.voice.audioNote}</p>
      <section className="tm-person__section">
        <h2 className="tm-title-3">{ui.voice.audioFresh}</h2>
        <ul className="tm-search__list">{fresh.map((r) => row(r, true))}</ul>
      </section>
      <section className="tm-person__section">
        <h2 className="tm-title-3">{ui.voice.audioByAuthor}</h2>
        {byAuthor.map(([author, rs], i) => (
          <details key={author} className="tm-audio__author" open={i < 2}>
            <summary className="tm-audio__summary"><span>{author}</span><span className="tm-caption">{rs.length}</span></summary>
            <ul className="tm-search__list">{rs.map((r) => row(r))}</ul>
          </details>
        ))}
      </section>
    </>
  );
}
