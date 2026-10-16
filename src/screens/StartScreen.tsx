import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import type { WorkCard } from '@/types/tmdf';
import { dismissWork, getStartDeck, noteOnboard, planWork, rateWork, searchWorks, setWatched, type SearchHit } from '@/api';
import { Button, ErrorState, Skeleton, useToast } from '@/components';
import { WorkThumb } from '@/components/WorkThumb';
import { cx } from '@/lib/cx';
import { imageSrc, useImageRetry } from '@/lib/images';
import { leadName } from '@/lib/credits';
import { titleOf } from '@/lib/format';
import { pick, tap } from '@/lib/telegram';
import { useSwipe } from '@/lib/swipe';
import { saveSettings } from '@/lib/settingsStore';
import ui from '@/i18n';

type Score = 1 | 2 | 3 | 4 | 5;
const SCORES: Score[] = [1, 2, 3, 4, 5];
/** сколько любимых спрашиваем: четыре — как у Letterboxd, больше на втором экране не набирают */
const FAVORITES = 4;
/** свайп засчитывается, когда карточка ушла на столько вбок */
const FAR = 100;

/** Первый вход свайпом (/start, ДФ-2, 16.10; за флагом `swipeStart`). Два шага, оба можно пропустить:
 *  1) двенадцать узнаваемых фильмов по одному — «Видел» (вправо, потом оценка или «не помню»), «Хочу» (в планы),
 *     «Не моё» (влево, насовсем из ленты);
 *  2) «четыре любимых» поиском — каждое идёт оценкой «Отлично».
 *  Дальше — лента: при 0–4 оценках общая, с подписью «пока общая» (getSlate `general`). Шаги и счёт уходят событием
 *  `onboard` — сравнить с колодой /rate, кто дошёл до первой ленты. */
export function StartScreen() {
  const S = ui.start;
  const navigate = useNavigate();
  const toast = useToast();
  const [deck, setDeck] = useState<WorkCard[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [at, setAt] = useState(0);
  // после «Видел» — та же карточка спрашивает «как вам»
  const [asking, setAsking] = useState(false);
  const [step, setStep] = useState<'swipe' | 'favorites'>('swipe');
  const counts = useRef({ seen: 0, want: 0, no: 0, rated: 0 });

  useEffect(() => {
    let alive = true;
    setFailed(false);
    getStartDeck().then((d) => alive && setDeck(d)).catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, [attempt]);

  const detail = () => Object.entries(counts.current).map(([k, v]) => `${k}:${v}`).join(',');
  const toFavorites = (how: 'swipe_done' | 'swipe_skip') => {
    noteOnboard(how, detail());
    setStep('favorites');
    window.scrollTo(0, 0);
  };
  const finish = (how: 'favorites_done' | 'favorites_skip', picked: number) => {
    tap('medium');
    noteOnboard(how, `${detail()},favorites:${picked}`);
    saveSettings({ swipeStartDone: true }).catch(() => undefined).finally(() => navigate('/today', { replace: true }));
  };

  const work = deck?.[at];
  const next = () => {
    setAsking(false);
    if (!deck || at + 1 >= deck.length) toFavorites('swipe_done');
    else setAt(at + 1);
  };
  const failedSave = () => toast({ text: ui.rate.saveError });
  const mark = (m: 'seen' | 'want' | 'no') => {
    if (!work) return;
    pick();
    if (m === 'seen') { counts.current.seen += 1; setAsking(true); return; }
    if (m === 'want') { counts.current.want += 1; planWork(work.id).catch(failedSave); }
    else { counts.current.no += 1; dismissWork(work.id).catch(failedSave); }
    next();
  };
  const rate = (v: Score | null) => {
    if (!work) return;
    pick();
    if (v) { counts.current.rated += 1; rateWork(work.id, v).catch(failedSave); }
    else setWatched(work.id, true).catch(failedSave);
    next();
  };

  if (step === 'favorites') return <Favorites onDone={finish} />;

  return (
    <main className="tm-shell__main tm-start">
      <div className="tm-start__head">
        <h1 className="tm-title-3 tm-start__title">{S.title}</h1>
        <p className="tm-body-sm tm-start__lead">{S.lead}</p>
        {deck?.length ? (
          <div className="tm-rate__bar">
            <span className="tm-rate__meter" aria-hidden="true">
              <span className="tm-rate__fill" style={{ width: `${(at / deck.length) * 100}%` }} />
            </span>
            <span className="tm-caption tm-rate__count" aria-live="polite">{S.progress(Math.min(at + 1, deck.length), deck.length)}</span>
            <Button size="sm" variant="quiet" onClick={() => { tap(); toFavorites('swipe_skip'); }}>{S.skip}</Button>
          </div>
        ) : null}
      </div>

      {failed ? <ErrorState title={S.error} onRetry={() => setAttempt((n) => n + 1)} /> : null}
      {!deck && !failed ? <Skeleton kind="block" style={{ height: 420 }} /> : null}
      {deck && !deck.length ? (
        <div className="tm-start__empty">
          <p className="tm-body">{S.empty}</p>
          <Button variant="primary" onClick={() => toFavorites('swipe_skip')}>{S.next}</Button>
        </div>
      ) : null}
      {work ? (
        <SwipeCard key={work.id} work={work} asking={asking} onMark={mark} onRate={rate} />
      ) : null}
    </main>
  );
}

/** Карточка: постер, название, год и режиссёр; вправо — «Видел», влево — «Не моё». После «Видел» вместо кнопок — шкала. */
function SwipeCard({ work, asking, onMark, onRate }: {
  work: WorkCard; asking: boolean;
  onMark: (m: 'seen' | 'want' | 'no') => void; onRate: (v: Score | null) => void;
}) {
  const S = ui.start;
  const [dx, setDx] = useState(0);
  const target = dx >= FAR ? 'seen' : dx <= -FAR ? 'no' : null;
  const swipe = useSwipe({
    enabled: !asking,
    onMove(next) {
      if ((next >= FAR || next <= -FAR) !== (dx >= FAR || dx <= -FAR)) pick();
      setDx(next);
    },
    onEnd(end) {
      setDx(0);
      if (end >= FAR) onMark('seen');
      else if (end <= -FAR) onMark('no');
    },
  });
  const { src, failed, onError, ref } = useImageRetry(imageSrc(work.coverUrl, 'w342') ?? imageSrc(work.stillUrl, 'w780'));
  const meta = [work.year, leadName(work)].filter(Boolean).join(' · ');

  return (
    <article className={cx('tm-start__card', dx !== 0 && 'tm-start__card--drag')} {...swipe}
             style={dx ? ({ '--swipe-x': `${Math.round(dx)}px`, '--swipe-r': `${(dx / 24).toFixed(1)}deg` } as CSSProperties) : undefined}>
      <div className="tm-start__poster">
        {src && !failed
          ? <img ref={ref} src={src} alt="" decoding="async" draggable={false} onError={onError} />
          : <WorkThumb work={work} />}
        {target ? <span className={cx('tm-start__stamp', `tm-start__stamp--${target}`)} aria-hidden="true">{target === 'seen' ? S.seen : S.no}</span> : null}
      </div>
      <h2 className="tm-title-3 tm-start__name">{titleOf(work)}</h2>
      {meta ? <p className="tm-caption tm-start__meta">{meta}</p> : null}
      {asking ? (
        <div className="tm-start__ask">
          <p className="tm-body-sm tm-start__question">{S.how}</p>
          <div className="tm-rate__scale" role="group" aria-label={ui.rate.scaleLabel(titleOf(work))}>
            {SCORES.map((v) => (
              <button key={v} type="button" className="tm-rate__score" onClick={() => onRate(v)}>{ui.rate.scale[v - 1]}</button>
            ))}
          </div>
          <button type="button" className="tm-rate__skip" onClick={() => onRate(null)}>{S.noMemory}</button>
        </div>
      ) : (
        <div className="tm-start__actions">
          <Button variant="secondary" onClick={() => onMark('no')}>{S.no}</Button>
          <Button variant="secondary" onClick={() => onMark('want')}>{S.want}</Button>
          <Button variant="primary" onClick={() => onMark('seen')}>{S.seen}</Button>
        </div>
      )}
      {asking ? null : <p className="tm-caption tm-start__gesture">{S.gesture}</p>}
    </article>
  );
}

/** Шаг 2: «четыре любимых» поиском. Выбранное — оценка «Отлично»; снять — убрать оценку. */
function Favorites({ onDone }: { onDone: (how: 'favorites_done' | 'favorites_skip', picked: number) => void }) {
  const S = ui.start;
  const toast = useToast();
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [fav, setFav] = useState<WorkCard[]>([]);

  useEffect(() => {
    if (q.trim().length < 2) { setHits(null); return; }
    let alive = true;
    const t = setTimeout(() => {
      searchWorks(q, 8).then((h) => alive && setHits(h.filter((x) => x.work.type !== 'book'))).catch(() => alive && setHits([]));
    }, 250);
    return () => { alive = false; clearTimeout(t); };
  }, [q]);

  const add = (w: WorkCard) => {
    if (fav.length >= FAVORITES || fav.some((f) => f.id === w.id)) return;
    pick();
    setFav((f) => [...f, w]);
    setQ('');
    rateWork(w.id, 5).catch(() => { setFav((f) => f.filter((x) => x.id !== w.id)); toast({ text: ui.rate.saveError }); });
  };
  const remove = (w: WorkCard) => {
    tap();
    setFav((f) => f.filter((x) => x.id !== w.id));
    rateWork(w.id, null).catch(() => undefined);
  };

  return (
    <main className="tm-shell__main tm-start">
      <div className="tm-start__head">
        <h1 className="tm-title-3 tm-start__title">{S.favTitle}</h1>
        <p className="tm-body-sm tm-start__lead">{S.favLead}</p>
      </div>
      <ol className="tm-start__favs">
        {Array.from({ length: FAVORITES }, (_, i) => fav[i]).map((w, i) => (
          <li key={w?.id ?? `slot-${i}`} className={cx('tm-start__fav', !w && 'tm-start__fav--empty')}>
            {w ? (
              <button type="button" className="tm-start__favbtn" onClick={() => remove(w)} aria-label={S.favRemove(titleOf(w))}>
                <WorkThumb work={w} />
                <span className="tm-caption tm-start__favname">{titleOf(w)}</span>
              </button>
            ) : <span className="tm-caption tm-start__favname">{i + 1}</span>}
          </li>
        ))}
      </ol>
      {fav.length < FAVORITES ? (
        <input className="tm-search__input tm-start__search" type="search" value={q} onChange={(e) => setQ(e.target.value)}
               placeholder={S.favSearch} aria-label={S.favSearch} enterKeyHint="search" />
      ) : null}
      {hits?.length ? (
        <ul className="tm-search__list">
          {hits.filter((h) => !fav.some((f) => f.id === h.work.id)).map(({ work }) => (
            <li key={work.id}>
              <button type="button" className="tm-search__open tm-start__hit" onClick={() => add(work)}>
                <WorkThumb work={work} />
                <span className="tm-search__text">
                  <span className="tm-search__name">{titleOf(work)}</span>
                  <span className="tm-search__meta">{[work.year, leadName(work)].filter(Boolean).join(' · ')}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : hits && q.trim().length >= 2 ? <p className="tm-caption tm-start__lead">{S.favNone}</p> : null}
      <div className="tm-start__finish">
        {fav.length
          ? <Button variant="primary" onClick={() => onDone('favorites_done', fav.length)}>{S.done}</Button>
          : <Button variant="quiet" onClick={() => onDone('favorites_skip', 0)}>{S.favSkip}</Button>}
      </div>
    </main>
  );
}
