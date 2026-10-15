import { useEffect, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ID, WorkCard } from '@/types/tmdf';
import { getQuickDeck, getRatingDeck, rateWork, type RatingDeck } from '@/api';
import { Button, ErrorState, Skeleton, useToast } from '@/components';
import { cx } from '@/lib/cx';
import { hasMainButton, outcome, pick, showMainButton, tap } from '@/lib/telegram';
import { useSwipe } from '@/lib/swipe';
import { leadName } from '@/lib/credits';
import { WorkThumb } from '@/components/WorkThumb';
import ui from '@/i18n';
import { titleOf } from '@/lib/format';
import { useFeature } from '@/lib/flags';
import { saveSettings, useSettings } from '@/lib/settingsStore';
import { TASTE_SHELVES } from '@/lib/model/taste';

type Score = 1 | 2 | 3 | 4 | 5;

/** Колода пришла заново, а на экране уже есть (РР-5: полная вместо снимка; или ещё раз — когда включился ряд книг).
 *  Порядок — того, что на экране: новая считается уже после оценок, и оценённое в ней стоит иначе — строки прыгали бы
 *  под пальцем; карточки — новой (с разметкой), чего на экране не было (ряд сериалов, книги) — следом. Оценки — с
 *  экрана (ответ api мог ещё не дойти), счётчик — больший из двух. */
function keepMarks(full: RatingDeck, shown: RatingDeck): RatingDeck {
  const merge = (next: RatingDeck['items'], was: RatingDeck['items']) => {
    const fresh = new Map(next.map((i) => [i.work.id, i]));
    const had = new Set(was.map((i) => i.work.id));
    return [...was.map((w) => ({ ...(fresh.get(w.work.id) ?? w), rating: w.rating })), ...next.filter((i) => !had.has(i.work.id))];
  };
  return {
    ...full, items: merge(full.items, shown.items), series: merge(full.series, shown.series),
    ...(full.books ? { books: merge(full.books, shown.books ?? []) } : {}), rated: Math.max(full.rated, shown.rated),
  };
}
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
  // ряд книг (11.10): за тем же флагом, что лента книг
  const booksOn = useFeature('readShelf');

  useEffect(() => {
    let alive = true;
    setFailed(false);
    // новому человеку — снимок колоды сразу (РР-5), полная — следом; поставленное на снимке не теряется
    getQuickDeck().then((q) => { if (alive && q) setDeck((d) => d ?? q); }).catch(() => undefined);
    getRatingDeck({ books: booksOn }).then((d) => alive && setDeck((prev) => (prev ? keepMarks(d, prev) : d))).catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, [attempt, booksOn]);

  const rate = (id: ID, value: Score | null) => {
    if (!deck) return;
    pick();
    const before = deck;
    const was = [...deck.items, ...deck.series, ...(deck.books ?? [])].find((i) => i.work.id === id)?.rating;
    // оценка применяется сразу; счётчик — по ответу api (он же считает и то, что оценено раньше)
    const set = (list: RatingDeck['items']) => list.map((i) => (i.work.id === id ? { ...i, rating: value ?? undefined } : i));
    setDeck({ ...deck, items: set(deck.items), series: set(deck.series), ...(deck.books ? { books: set(deck.books) } : {}) });
    rateWork(id, value)
      .then(({ rated, needed }) => {
        setDeck((d) => (d ? { ...d, rated, needed } : d));
        if (!was && value && rated === needed) outcome('success');
      })
      .catch(() => { setDeck(before); toast({ text: ui.rate.saveError }); });
  };

  const skip = (id: ID, on: boolean) => {
    tap();
    setSkipped((s) => { const n = new Set(s); if (on) n.add(id); else n.delete(id); return n; });
  };

  // полки вкуса (ЗП-45, шаг 1): выбор сохраняется сразу, колода перестраивается — своё вперёд
  const picksOn = useFeature('tastePicks');
  const settings = useSettings();
  const picks = settings?.tasteShelves ?? [];
  const [savingPicks, setSavingPicks] = useState(false);
  const togglePick = (id: string) => {
    tap();
    setSavingPicks(true);
    saveSettings({ tasteShelves: picks.includes(id) ? picks.filter((x) => x !== id) : [...picks, id] })
      .then(() => getRatingDeck({ books: booksOn }))
      .then((d) => setDeck(d))
      .catch(() => toast({ text: ui.rate.saveError }))
      .finally(() => setSavingPicks(false));
  };

  const ready = deck ? deck.rated >= deck.needed : false;
  const left = deck ? Math.max(0, deck.needed - deck.rated) : 0;
  // «Показать подборку» — главной кнопкой Telegram, как только оценок хватает (ТВ-11)
  useEffect(() => (ready ? showMainButton(ui.rate.done, () => { tap('medium'); navigate('/today'); }) : undefined), [ready, navigate]);
  const mainInTelegram = ready && hasMainButton();

  return (
    <main className="tm-shell__main tm-search tm-rate">
      <div className="tm-rate__head">
        <h1 className="tm-title-3 tm-rate__title">{ui.rate.title}</h1>
        <p className="tm-body-sm tm-rate__lead">{ui.rate.lead}</p>
        {deck ? (
          <div className="tm-rate__bar">
            <span className="tm-rate__meter" aria-hidden="true">
              <span className="tm-rate__fill" style={{ width: `${Math.min(100, (deck.rated / deck.needed) * 100)}%` }} />
            </span>
            <span className="tm-caption tm-rate__count" aria-live="polite">{ui.rate.progress(deck.rated, deck.needed)}</span>
            {mainInTelegram ? null : (
              <Button size="sm" variant={ready ? 'primary' : 'secondary'} disabled={!ready}
                      onClick={() => { tap('medium'); navigate('/today'); }}>
                {ready ? ui.rate.done : ui.rate.notYet(left)}
              </Button>
            )}
          </div>
        ) : null}
        {deck ? <p className="tm-caption tm-rate__gesture">{ui.rate.gesture}</p> : null}
        {/* ряд книг внизу, под сотней фильмов: читателю — короткий путь к нему */}
        {deck?.books?.length ? (
          <p className="tm-caption tm-rate__jump">
            {ui.rate.booksJumpLead}{' '}
            <button type="button" className="tm-coldstart__link"
                    onClick={() => {
                      tap();
                      // под липкую шапку со счётчиком, а не за неё: её высота зависит от ширины и строк
                      const el = document.getElementById('tm-rate-books');
                      if (el) el.style.scrollMarginTop = `${(document.querySelector('.tm-rate__head') as HTMLElement | null)?.offsetHeight ?? 0}px`;
                      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}>
              {ui.rate.booksJump}
            </button>
          </p>
        ) : null}
      </div>

      {picksOn && deck ? (
        <section className="tm-rate__picks" aria-labelledby="tm-rate-picks">
          <h2 id="tm-rate-picks" className="tm-body tm-rate__picks-title">{ui.rate.picksTitle}</h2>
          <p className="tm-caption tm-rate__lead">{ui.rate.picksLead}</p>
          <div className="tm-rate__pick-list" role="group" aria-labelledby="tm-rate-picks">
            {TASTE_SHELVES.map((s) => {
              const on = picks.includes(s.id);
              return (
                <button key={s.id} type="button" aria-pressed={on ? 'true' : 'false'} disabled={savingPicks}
                        className={cx('tm-rate__pick', on && 'tm-rate__pick--on')} onClick={() => togglePick(s.id)}>
                  {ui.rate.shelf[s.id as keyof typeof ui.rate.shelf] ?? s.id}
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {failed ? <ErrorState title={ui.rate.error} onRetry={() => setAttempt(attempt + 1)} /> : null}
      {!deck && !failed ? (
        <div aria-busy="true">
          <span className="tm-sr">{ui.actions.loading}</span>
          {[0, 1, 2].map((i) => <Skeleton key={i} kind="block" style={{ height: 120, marginTop: i ? 8 : 0 }} />)}
        </div>
      ) : null}

      <ul className="tm-search__list">
        {/* оценённое уходит вниз (ТВ-9): иначе следующее касание попадает в ту же строку; оценку
            можно поменять и там */}
        {deck ? settledLast(deck.items).map(({ work, rating }) => (
          <RateRow key={work.id} work={work} rating={rating as Score | undefined}
                   off={skipped.has(work.id) && !rating}
                   onRate={(v) => rate(work.id, v)} onSkip={(on) => skip(work.id, on)} />
        )) : null}
      </ul>
      {/* сериалы — отдельным рядом (Е4): оценка сериала — про весь сериал, и путать его с фильмом незачем */}
      {deck?.series.length ? (
        <section className="tm-rate__series">
          <h2 className="tm-title-3 tm-rate__title">{ui.rate.seriesTitle}</h2>
          <p className="tm-body-sm tm-rate__lead">{ui.rate.seriesLead}</p>
          <ul className="tm-search__list">
            {settledLast(deck.series).map(({ work, rating }) => (
              <RateRow key={work.id} work={work} rating={rating as Score | undefined}
                       off={skipped.has(work.id) && !rating}
                       onRate={(v) => rate(work.id, v)} onSkip={(on) => skip(work.id, on)} />
            ))}
          </ul>
        </section>
      ) : null}
      {/* книги — своим рядом (11.10): кто больше читает, чем смотрит, соберёт первую ленту и по ним */}
      {deck?.books?.length ? (
        <section className="tm-rate__series" id="tm-rate-books">
          <h2 className="tm-title-3 tm-rate__title">{ui.rate.booksTitle}</h2>
          <p className="tm-body-sm tm-rate__lead">{ui.rate.booksLead}</p>
          <ul className="tm-search__list">
            {settledLast(deck.books).map(({ work, rating }) => (
              <RateRow key={work.id} work={work} rating={rating as Score | undefined}
                       off={skipped.has(work.id) && !rating}
                       onRate={(v) => rate(work.id, v)} onSkip={(on) => skip(work.id, on)} />
            ))}
          </ul>
        </section>
      ) : null}
      {deck ? <p className="tm-caption tm-search__hint">{ui.rate.hint}</p> : null}
    </main>
  );
}

const settledLast = <T extends { rating?: number }>(list: T[]): T[] => [...list.filter((i) => !i.rating), ...list.filter((i) => i.rating)];
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
          {ui.rate.scale[target - 1]}
        </span>
      ) : null}
      <div className="tm-search__open">
        <WorkThumb work={work} />
        <span className="tm-search__text">
          <span className="tm-search__name">{titleOf(work)}</span>
          <span className="tm-search__meta">{meta(work.year, leadName(work))}</span>
          {off ? <span className="tm-search__orig">{ui.rate.skipped}</span> : null}
        </span>
      </div>
      {off ? (
        <div className="tm-rate__scale">
          <Button size="sm" variant="quiet" onClick={() => onSkip(false)}>{ui.rate.unskip}</Button>
        </div>
      ) : (
        <div className="tm-rate__scale" role="group" aria-label={ui.rate.scaleLabel(titleOf(work))}>
          {SCORES.map((v) => (
            <button key={v} type="button" aria-pressed={rating === v}
                    className={cx('tm-rate__score', rating === v && 'tm-rate__score--on')}
                    onClick={() => onRate(rating === v ? null : v)}>
              {ui.rate.scale[v - 1]}
            </button>
          ))}
          {!rating ? (
            <button type="button" className="tm-rate__skip" onClick={() => onSkip(true)}>{work.type === 'book' ? ui.rate.skipBook : ui.rate.skip}</button>
          ) : null}
        </div>
      )}
    </li>
  );
}
