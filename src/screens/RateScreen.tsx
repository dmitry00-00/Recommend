import { useEffect, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ID, WorkCard } from '@/types/tmdf';
import { getRatingDeck, rateWork, type RatingDeck } from '@/api';
import { Button, ErrorState, Skeleton, useToast } from '@/components';
import { cx } from '@/lib/cx';
import { opVar } from '@/lib/operations';
import { outcome, pick, tap } from '@/lib/telegram';
import { useSwipe } from '@/lib/swipe';
import ru from '@/i18n/ru';

type Score = 1 | 2 | 3 | 4 | 5;
const SCORES: Score[] = [1, 2, 3, 4, 5];

/** Оценка по длине свайпа: чуть вправо — «Хорошо», дальше — «Отлично»; влево так же — «Слабо»
 *  и «Мимо». «Нормально» и «Не смотрел» — только кнопками: середину шкалы жестом не поймать,
 *  а вертикальный свайп занят прокруткой списка. */
const NEAR = 70;
const FAR = 150;
const scoreAt = (dx: number): Score | null =>
  dx >= FAR ? 5 : dx >= NEAR ? 4 : dx <= -FAR ? 1 : dx <= -NEAR ? 2 : null;

/** Первые оценки (/rate): с них начинается новый участник. Лента пуста, пока оценок меньше
 *  порога, — здесь он набирает их из списка известных размеченных фильмов (src/mocks/ratingDeck.ts).
 *  Оценка сохраняется сразу; «Не смотрел» только прячет строку в этой вкладке. Сколько нужно
 *  и сколько уже есть — приходит из api, экран только раскладывает. */
export function RateScreen() {
  const navigate = useNavigate();
  const toast = useToast();
  const [deck, setDeck] = useState<RatingDeck | null>(null);
  const [failed, setFailed] = useState(false);
  const [skipped, setSkipped] = useState<Set<ID>>(new Set());
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setFailed(false);
    getRatingDeck().then((d) => alive && setDeck(d)).catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, [attempt]);

  const rate = (id: ID, value: Score | null) => {
    if (!deck) return;
    pick();
    const before = deck;
    const was = [...deck.items, ...deck.series].find((i) => i.work.id === id)?.rating;
    // оценка применяется сразу; счётчик — по ответу api (он же считает и то, что оценено раньше)
    const set = (list: RatingDeck['items']) => list.map((i) => (i.work.id === id ? { ...i, rating: value ?? undefined } : i));
    setDeck({ ...deck, items: set(deck.items), series: set(deck.series) });
    rateWork(id, value)
      .then(({ rated, needed }) => {
        setDeck((d) => (d ? { ...d, rated, needed } : d));
        if (!was && value && rated === needed) outcome('success');
      })
      .catch(() => { setDeck(before); toast({ text: ru.rate.saveError }); });
  };

  const skip = (id: ID, on: boolean) => {
    tap();
    setSkipped((s) => { const n = new Set(s); if (on) n.add(id); else n.delete(id); return n; });
  };

  const ready = deck ? deck.rated >= deck.needed : false;
  const left = deck ? Math.max(0, deck.needed - deck.rated) : 0;

  return (
    <main className="tm-shell__main tm-search tm-rate">
      <div className="tm-rate__head">
        <h1 className="tm-title-3 tm-rate__title">{ru.rate.title}</h1>
        <p className="tm-body-sm tm-rate__lead">{ru.rate.lead}</p>
        {deck ? (
          <div className="tm-rate__bar">
            <span className="tm-rate__meter" aria-hidden="true">
              <span className="tm-rate__fill" style={{ width: `${Math.min(100, (deck.rated / deck.needed) * 100)}%` }} />
            </span>
            <span className="tm-caption tm-rate__count" aria-live="polite">{ru.rate.progress(deck.rated, deck.needed)}</span>
            <Button size="sm" variant={ready ? 'primary' : 'secondary'} disabled={!ready}
                    onClick={() => { tap('medium'); navigate('/today'); }}>
              {ready ? ru.rate.done : ru.rate.notYet(left)}
            </Button>
          </div>
        ) : null}
        {deck ? <p className="tm-caption tm-rate__gesture">{ru.rate.gesture}</p> : null}
      </div>

      {failed ? <ErrorState title={ru.rate.error} onRetry={() => setAttempt(attempt + 1)} /> : null}
      {!deck && !failed ? (
        <div aria-busy="true">
          <span className="tm-sr">{ru.today.loading}</span>
          {[0, 1, 2].map((i) => <Skeleton key={i} kind="block" style={{ height: 120, marginTop: i ? 8 : 0 }} />)}
        </div>
      ) : null}

      <ul className="tm-search__list">
        {deck?.items.map(({ work, rating }) => (
          <RateRow key={work.id} work={work} rating={rating as Score | undefined}
                   off={skipped.has(work.id) && !rating}
                   onRate={(v) => rate(work.id, v)} onSkip={(on) => skip(work.id, on)} />
        ))}
      </ul>
      {/* сериалы — отдельным рядом (Е4): оценка сериала — про весь сериал, и путать его с фильмом незачем */}
      {deck?.series.length ? (
        <section className="tm-rate__series">
          <h2 className="tm-title-3 tm-rate__title">{ru.rate.seriesTitle}</h2>
          <p className="tm-body-sm tm-rate__lead">{ru.rate.seriesLead}</p>
          <ul className="tm-search__list">
            {deck.series.map(({ work, rating }) => (
              <RateRow key={work.id} work={work} rating={rating as Score | undefined}
                       off={skipped.has(work.id) && !rating}
                       onRate={(v) => rate(work.id, v)} onSkip={(on) => skip(work.id, on)} />
            ))}
          </ul>
        </section>
      ) : null}
      {deck ? <p className="tm-caption tm-search__hint">{ru.rate.hint}</p> : null}
    </main>
  );
}

const meta = (year?: number, creator?: string) => [year, creator].filter(Boolean).join(' · ');

/** Строка списка: кнопки шкалы и свайп. Пока палец тянет строку, из-под неё видно, какая
 *  оценка встанет; на пороге — лёгкий отклик вибрацией. */
function RateRow({ work, rating, off, onRate, onSkip }: {
  work: WorkCard; rating?: Score; off: boolean;
  onRate: (value: Score | null) => void; onSkip: (on: boolean) => void;
}) {
  const [dx, setDx] = useState(0);
  const target = scoreAt(dx);
  const swipe = useSwipe({
    enabled: !off,
    onMove(next) {
      if (scoreAt(next) !== scoreAt(dx)) pick();
      setDx(next);
    },
    onEnd(end) {
      setDx(0);
      const v = scoreAt(end);
      if (v && v !== rating) onRate(v);
    },
  });

  return (
    <li className={cx('tm-rate__item', off && 'tm-rate__item--off', dx !== 0 && 'tm-rate__item--drag')}
        style={dx ? ({ '--swipe-x': `${Math.round(dx * 0.8)}px` } as CSSProperties) : undefined} {...swipe}>
      {target ? (
        <span className={cx('tm-rate__swipe', dx > 0 ? 'tm-rate__swipe--left' : 'tm-rate__swipe--right', 'tm-rate__swipe--on')}
              aria-hidden="true">
          {ru.rate.scale[target - 1]}
        </span>
      ) : null}
      <div className="tm-search__open">
        <span className="tm-search__thumb"
              style={{ '--thumb-line': opVar(work.primaryOperations?.[0]?.op ?? 'synthesis') } as CSSProperties}>
          {work.stillUrl ?? work.coverUrl
            ? <img src={work.stillUrl ?? work.coverUrl} alt="" loading="lazy" decoding="async" draggable={false} />
            : null}
        </span>
        <span className="tm-search__text">
          <span className="tm-search__name">{work.title}</span>
          <span className="tm-search__meta">{meta(work.year, work.creators[0])}</span>
          {off ? <span className="tm-search__orig">{ru.rate.skipped}</span> : null}
        </span>
      </div>
      {off ? (
        <div className="tm-rate__scale">
          <Button size="sm" variant="quiet" onClick={() => onSkip(false)}>{ru.rate.unskip}</Button>
        </div>
      ) : (
        <div className="tm-rate__scale" role="group" aria-label={ru.rate.scaleLabel(work.title)}>
          {SCORES.map((v) => (
            <button key={v} type="button" aria-pressed={rating === v}
                    className={cx('tm-rate__score', rating === v && 'tm-rate__score--on')}
                    onClick={() => onRate(rating === v ? null : v)}>
              {ru.rate.scale[v - 1]}
            </button>
          ))}
          {!rating ? (
            <button type="button" className="tm-rate__skip" onClick={() => onSkip(true)}>{ru.rate.skip}</button>
          ) : null}
        </div>
      )}
    </li>
  );
}
