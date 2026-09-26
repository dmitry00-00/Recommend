import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import type {
  DiscussionPlace, DismissReason, Eagerness, JourneyEntryData, Recommendation, RecommendationSlate,
  SpoilerLevel, WatchOption,
} from '@/types/tmdf';
import { OfflineError, getJourney, getSettings, getSlate, notWatched, planWork, sendRecommendationFeedback, startWork, unplanWork } from '@/api';
import {
  Button, DiscussionLink, EmptyState, ErrorState, FilmTabs, ReasonPicker, Skeleton, StarScale,
  WorkBanner, WorkSheet, useToast,
} from '@/components';
import { useSwipe } from '@/lib/swipe';
import { useMechanics } from '@/lib/settingsStore';
import { onExternalClick, tap } from '@/lib/telegram';
import { formatDuration, pluralRu } from '@/lib/format';
import { cx } from '@/lib/cx';
import ru from '@/i18n/ru';

const ARCHIVE_ROW = 56;

const WATCH_SHOWN = 6;

/** «Где посмотреть»: кнопки площадок, первые шесть — остальные по «ещё N». Логотипы не
 *  рисуем: чужие марки в нашей типографике только шумят. */
export function WatchOptions({ options }: { options?: WatchOption[] }) {
  const [all, setAll] = useState(false);
  if (!options?.length) return null;
  const shown = all ? options : options.slice(0, WATCH_SHOWN);
  const rest = options.length - shown.length;
  return (
    <section className="tm-stream__group">
      <h3 className="tm-label tm-stream__grouplabel">{ru.feed.watch}</h3>
      <div className="tm-row tm-row--gap-2 tm-row--wrap">
        {shown.map((w) => (
          <a key={w.url} className="tm-btn tm-btn--secondary tm-btn--sm" href={w.url} target="_blank" rel="noreferrer noopener"
             onClick={onExternalClick(w.url)}>
            {w.platform}
          </a>
        ))}
        {rest > 0 ? <Button variant="quiet" size="sm" onClick={() => setAll(true)}>{ru.feed.more(rest)}</Button> : null}
      </div>
    </section>
  );
}

/** Две строки внизу карточки: поиск по каналам авторов (способ найти разбор) и места, где
 *  о кино говорят вообще (список владельца, 22.09). Ни то, ни другое не разбор, поэтому
 *  строками, а не блоками. Экран «Произведение» показывает их же под местами разговора. */
export function SearchLine({ places }: { places: DiscussionPlace[] }) {
  const groups: { label: string; items: DiscussionPlace[] }[] = [
    { label: ru.discussion.searchLine, items: places.filter((d) => d.kind !== 'telegram_chat') },
    { label: ru.discussion.chatsLine, items: places.filter((d) => d.kind === 'telegram_chat') },
  ];
  return (
    <>
      {groups.filter((g) => g.items.length).map((g) => (
        <p key={g.label} className="tm-caption tm-stream__search">
          {g.label}
          {g.items.map((d, i) => (
            <span key={d.id}>
              {i ? ' · ' : ' '}
              <a href={d.url} target="_blank" rel="noreferrer noopener" onClick={onExternalClick(d.url)}>{d.title}</a>
            </span>
          ))}
        </p>
      ))}
    </>
  );
}

/** Тело карточки: описание словами, разборы конкретными роликами и постами, места разговора,
 *  строка поиска по каналам, где посмотреть, действия. Всё — из данных рекомендации; экран
 *  только раскладывает. */
function Panel({ r, spoilerLevel, finished, onSave, onDismiss, onWatch }: {
  r: Recommendation; spoilerLevel: SpoilerLevel; finished: boolean;
  onSave: () => void; onDismiss: (reason: DismissReason) => void; onWatch: () => void;
}) {
  const [reasons, setReasons] = useState(false);
  // Конкретные разборы — материал, поиск по каналам — запасной ход: он уходит в одну строку
  // внизу, иначе четыре одинаковых блока съедают карточку (замечание владельца 22.09).
  const places = (r.discussions ?? []).filter((d) => !d.search);
  const searches = (r.discussions ?? []).filter((d) => d.search);
  const allowed: SpoilerLevel = finished ? 2 : spoilerLevel;
  // Преамбулы (что делает, почему вам, аннотация) в карточке пока нет — решение владельца
  // 23.09. Тексты по-прежнему приходят в рекомендации, вернуть их — одна строка здесь.
  return (
    <div className="tm-stream__panel tm-stream__panel--tabs">
      <FilmTabs
        key={r.id}
        analyses={r.analyses ?? []}
        spoilerLevel={allowed}
        watch={r.work.watch}
        onWatch={onWatch}
        discussionsCount={places.length}
        discussions={(
          <>
            {places.length ? (
              <section className="tm-stream__group">
                <h3 className="tm-label tm-stream__grouplabel">{ru.feed.telegram}</h3>
                {places.map((d) => <DiscussionLink key={d.id} discussion={d} locked={d.spoilers && !finished} />)}
              </section>
            ) : null}
            {searches.length ? <SearchLine places={searches} /> : null}
          </>
        )}
        // «Начать смотреть» убрано из карточки (24.09, решение владельца); «в планы» и «не
        // сейчас» — в правом углу текста под кадром материала, причины — под материалом
        corner={(
          <>
            <Button size="sm" onClick={onSave}>{ru.actions.save}</Button>
            <Button variant="quiet" size="sm" pressed={reasons} onClick={() => setReasons(!reasons)}>{ru.actions.dismiss}</Button>
          </>
        )}
        actions={reasons ? <ReasonPicker variant="dismiss" onPick={onDismiss} /> : undefined}
      />
    </div>
  );
}

/** Кадр ленты со свайпом (24.09). Под пальцем нарастает заливка — она же и остаётся на месте
 *  кадра, когда тот уезжает.
 *
 *  Влево — «не сейчас»: кадр уходит, а на заливке встают причины отказа крупными кнопками.
 *  Причина необязательна: через ASK_MS уезжает `other`, то есть ровно то, что было раньше.
 *  Спрашиваем, но не держим — иначе люди просто перестанут отказываться.
 *
 *  Вправо — «в планы», и длина свайпа говорит, насколько хочется: звезда за каждые WANT_STEP
 *  после WANT_BASE. Вся шкала в одну сторону (вторая занята отказом), поэтому ступеней пять,
 *  а не две, и считать их не нужно — рядом цифра. Ряд растёт вместе с открывающейся полосой
 *  и всегда в неё умещается.
 *
 *  Пороги намеренно большие: лента прокручивается вертикально, случайный сдвиг вбок ничего
 *  делать не должен. */
const SWIPE = 96;
// пороги подобраны под ширину открывающейся полосы: кадр уходит на DRAG от длины свайпа, и ряд
// звёзд должен умещаться в освободившееся место целиком — иначе подпись обрезается кадром
const DRAG = 0.8;
const WANT_BASE = 72;
const WANT_STEP = 30;
const ASK_MS = 8000;

/** Подсказка про свайп — один раз, пока человек не свайпнул сам или не сказал «понятно».
 *  Только на сенсорных экранах: мышью лента не свайпается. Хранилище может быть недоступно
 *  (приватный режим, превью) — тогда подсказка просто показывается снова. */
const HINT_KEY = 'tm.hint.feedSwipe';
const hintWanted = (): boolean => {
  try {
    return window.matchMedia?.('(pointer: coarse)').matches === true && localStorage.getItem(HINT_KEY) !== '1';
  } catch { return false; }
};
const hintDone = () => { try { localStorage.setItem(HINT_KEY, '1'); } catch { /* не страшно */ } };

/** Начатое спрашиваем «посмотрели?» не сразу: первые FRESH_MS после перехода в кинотеатр
 *  человек, скорее всего, смотрит. Без ответа STALE_MS — вопрос тихо снимается, фильм
 *  возвращается в планы; в петле это `expired`, не бросок. */
const FRESH_MS = 2 * 3600e3;
const STALE_MS = 7 * 86400e3;
const age = (e: JourneyEntryData) => (e.startedAt ? Date.now() - Date.parse(e.startedAt) : 0);

const wantAt = (dx: number): Eagerness | null =>
  dx < WANT_BASE ? null : (Math.min(5, Math.floor((dx - WANT_BASE) / WANT_STEP) + 1) as Eagerness);

function FeedCard({ r, meta, tag, onOpen, onSave, onDismiss }: {
  r: Recommendation; meta?: string; tag?: string;
  onOpen: () => void; onSave: (eagerness: Eagerness) => void; onDismiss: (reason: DismissReason) => void;
}) {
  const [dx, setDx] = useState(0);
  const [asking, setAsking] = useState(false);
  const want = wantAt(dx);
  const dropping = dx <= -SWIPE;
  const swipe = useSwipe({
    enabled: !asking,
    onMove(next) {
      if (wantAt(next) !== want || (next <= -SWIPE) !== dropping) tap();
      setDx(next);
    },
    onEnd(end) {
      setDx(0);
      const n = wantAt(end);
      if (end <= -SWIPE) { tap('medium'); setAsking(true); }
      else if (n) onSave(n);
    },
  });

  // ссылкой, а не зависимостью: onDismiss приходит новой стрелкой на каждый рендер ленты, и
  // в зависимостях таймер перезапускался бы бесконечно
  const later = useRef(onDismiss);
  later.current = onDismiss;
  useEffect(() => {
    if (!asking) return;
    const t = setTimeout(() => later.current('other'), ASK_MS);
    return () => clearTimeout(t);
  }, [asking]);

  const right = dx > 0;
  const fill = Math.min(1, Math.abs(dx) / (right ? WANT_BASE : SWIPE));
  return (
    <article className={cx('tm-stream__item', dx !== 0 && 'tm-stream__item--drag', asking && 'tm-stream__item--asking')}
             {...swipe}>
      {asking ? (
        <div className="tm-stream__ask" data-noswipe>
          <ReasonPicker variant="dismiss" onPick={onDismiss} />
          <Button variant="quiet" size="sm" onClick={() => { tap(); setAsking(false); }}>{ru.feed.keep}</Button>
        </div>
      ) : (
        <span className={cx('tm-stream__hint', right ? 'tm-stream__hint--save' : 'tm-stream__hint--dismiss',
                            (want != null || dropping) && 'tm-stream__hint--on')}
              style={{ '--fill': fill } as CSSProperties} aria-hidden="true">
          {right
            ? (want != null ? <StarScale value={want} caption={ru.feed.want} /> : ru.actions.save)
            : ru.actions.dismiss}
        </span>
      )}
      <div className="tm-stream__drag" style={dx ? ({ '--swipe-x': `${Math.round(dx * DRAG)}px` } as CSSProperties) : undefined}>
        <WorkBanner work={r.work} meta={meta} tag={tag} onClick={onOpen} />
      </div>
    </article>
  );
}

/** Лента (/today): фильмы баннерами во всю ширину; тап открывает карточку в модальном
 *  окне — баннер сверху, описание и ссылки ниже со своей прокруткой (21.09, по замечанию).
 *  Над лентой спрятан архив просмотренного: он вытягивается прокруткой вверх, как архив
 *  чатов в Telegram. Уровень усилия — из настроек. */
export function TodayScreen() {
  const navigate = useNavigate();
  const toast = useToast();
  const mechanics = useMechanics();
  const mainRef = useRef<HTMLElement>(null);
  const [slate, setSlate] = useState<RecommendationSlate | null>(null);
  const [spoilerLevel, setSpoilerLevel] = useState<SpoilerLevel>(0);
  const [finishedIds, setFinishedIds] = useState<Set<string>>(new Set());
  const [archived, setArchived] = useState(0);
  const [current, setCurrent] = useState<JourneyEntryData[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [failed, setFailed] = useState<false | 'offline' | 'error'>(false);
  const [attempt, setAttempt] = useState(0);
  const [hint, setHint] = useState(hintWanted);
  const learned = () => { if (hint) { hintDone(); setHint(false); } };

  useEffect(() => {
    let alive = true;
    setSlate(null);
    setFailed(false);
    getSettings()
      .then((settings) => Promise.all([getSlate(settings.energy ?? 'normal'), getJourney(), settings]))
      .then(([nextSlate, journal, settings]) => {
        if (!alive) return;
        setSlate(nextSlate);
        setSpoilerLevel(settings.spoilerLevel);
        setFinishedIds(new Set(journal.filter((e) => e.status === 'finished').map((e) => e.work.id)));
        setArchived(journal.length);
        const going = journal.filter((e) => e.status === 'in_progress');
        for (const e of going.filter((x) => age(x) > STALE_MS)) notWatched(e.id, 'expired').catch(() => undefined);
        setCurrent(going.filter((x) => age(x) <= STALE_MS));
      })
      .catch((err) => alive && setFailed(err instanceof OfflineError ? 'offline' : 'error'));
    return () => { alive = false; };
  }, [attempt]);

  // Архив спрятан над лентой: как только лента отрисована, прокручиваем на его высоту.
  useLayoutEffect(() => {
    const main = mainRef.current;
    if (main && slate && main.scrollTop < ARCHIVE_ROW) main.scrollTop = ARCHIVE_ROW;
  }, [slate]);

  // «В планы» — как «не сейчас»: кадр уходит из ленты (иначе после свайпа он возвращается на
  // место, и непонятно, сработало ли), а сам фильм ложится в архив записью «в планах».
  // Отмена в тосте возвращает кадр и убирает запись.
  const save = (r: Recommendation, eagerness?: Eagerness) => {
    if (!slate) return;
    tap();
    const before = slate;
    setSlate({ ...slate, items: slate.items.filter((i) => i.id !== r.id) });
    setOpen(null);
    sendRecommendationFeedback(r.id, { action: 'save', eagerness }).catch(() => undefined);
    planWork(r.work.id, eagerness)
      .then((entryId) => {
        setArchived((n) => n + 1);
        toast({
          text: eagerness ? ru.toast.savedEager(eagerness) : ru.toast.savedPlain,
          action: ru.actions.undo,
          onAction: () => {
            setSlate(before);
            setArchived((n) => Math.max(0, n - 1));
            if (entryId) unplanWork(entryId).catch(() => toast({ text: ru.settings.errorSave }));
          },
        });
      })
      .catch(() => { setSlate(before); toast({ text: ru.settings.errorSave, action: ru.actions.retry, onAction: () => save(r, eagerness) }); });
  };
  const dismiss = (r: Recommendation, reason: DismissReason) => {
    if (!slate) return;
    tap();
    const before = slate;
    setSlate({ ...slate, items: slate.items.filter((i) => i.id !== r.id) });
    setOpen(null);
    sendRecommendationFeedback(r.id, { action: 'dismiss', reason })
      .then(() => toast({ text: ru.toast.dismissed, action: ru.actions.undo, onAction: () => setSlate(before) }))
      .catch(() => { setSlate(before); toast({ text: ru.settings.errorSave }); });
  };

  // Переход в онлайн-кинотеатр из «Смотреть» — это и есть «начал смотреть» (24.09): отдельной
  // кнопки нет, отмечаем за человека и потом переспрашиваем. Ленту перечитываем, когда он
  // закроет карточку, — пока она открыта, кадр из-под неё не убираем.
  const [restart, setRestart] = useState(false);
  const watchFrom = (r: Recommendation) => {
    sendRecommendationFeedback(r.id, { action: 'start' }).catch(() => undefined);
    startWork(r.work.id, undefined, { inferred: true })
      .then(() => { setRestart(true); toast({ text: ru.toast.watchInferred }); })
      .catch(() => undefined);
  };
  const closeSheet = () => { setOpen(null); if (restart) { setRestart(false); setAttempt((a) => a + 1); } };
  const notYet = (e: JourneyEntryData) => {
    tap();
    notWatched(e.id)
      .then(() => { setOpen(null); setCurrent((list) => list.filter((x) => x.id !== e.id)); toast({ text: ru.toast.notWatched }); })
      .catch(() => toast({ text: ru.settings.errorSave }));
  };
  const answers = (e: JourneyEntryData, big = false) => (
    <>
      <Button variant={big ? 'primary' : 'secondary'} size="sm" onClick={() => { tap(); navigate(`/journal/${e.id}/check-in`); }}>
        {e.work.type === 'film' ? ru.actions.finishFilm : ru.actions.finishBook}
      </Button>
      <Button variant="quiet" size="sm" onClick={() => { tap(); navigate(`/journal/${e.id}/check-in?abandon=1`); }}>{ru.feed.gaveUp}</Button>
      <Button variant="quiet" size="sm" onClick={() => notYet(e)}>{ru.feed.notYet}</Button>
    </>
  );

  const items = slate?.items ?? [];
  const openEntry = current.find((e) => e.id === open) ?? null;
  const openRec = items.find((r) => r.id === open) ?? null;
  const recMeta = (r: Recommendation) =>
    [r.work.year, r.work.creators[0], formatDuration(r.work.durationMinutes)].filter(Boolean).join(' · ');
  // вопрос «посмотрели?» стоит под баннером — в мете его не повторяем
  const entryMeta = (e: JourneyEntryData) =>
    [e.work.year, e.work.creators[0], e.progress != null ? `${Math.round(e.progress * 100)}%` : null].filter(Boolean).join(' · ');
  return (
    <main className="tm-shell__main tm-stream" ref={mainRef}>
      <h1 className="tm-sr">{ru.nav.today}</h1>
      <button type="button" className="tm-stream__archive" onClick={() => navigate('/journal')}>
        <span className="tm-stream__archiveicon" aria-hidden="true" />
        <span className="tm-stream__archivetext">
          {ru.feed.archive}
          {archived ? <span className="tm-stream__archivecount">
            {` · ${archived} ${pluralRu(archived, ru.feed.entryOne, ru.feed.entryFew, ru.feed.entryMany)}`}
          </span> : null}
        </span>
        <span className="tm-stream__archivechevron" aria-hidden="true">›</span>
      </button>

      <div className="tm-stream__body">
        {failed ? (
          <ErrorState title={failed === 'offline' ? ru.state.offlineTitle : ru.state.errorSlate}
                      text={failed === 'offline' ? ru.state.offlineText : ru.state.errorSlateText}
                      className="tm-stream__pad" onRetry={() => setAttempt(attempt + 1)} />
        ) : null}
        {!slate && !failed ? (
          <div aria-busy="true">
            <span className="tm-sr">{ru.today.loading}</span>
            {[0, 1, 2].map((i) => <Skeleton key={i} kind="block" style={{ height: 200, marginTop: i ? 2 : 0 }} />)}
          </div>
        ) : null}
        {/* Новый участник: ленты ещё нет, и дело не в ошибке — модели не от чего считать.
            Объясняем и ведём туда, где это исправляется за минуту. */}
        {slate?.coldStart ? (
          <div className="tm-stream__pad">
            <EmptyState title={ru.today.coldTitle}
                        text={`${ru.today.coldText(slate.coldStart.needed)} ${ru.today.coldProgress(slate.coldStart.rated, slate.coldStart.needed)}`}
                        action={slate.coldStart.rated ? ru.today.coldMore : ru.today.coldAction}
                        onAction={() => { tap('medium'); navigate('/rate'); }} />
          </div>
        ) : null}
        {slate && !items.length && !slate.coldStart ? (
          <div className="tm-stream__pad">
            <EmptyState title={ru.today.empty} text={ru.today.emptyText} action={ru.actions.retry} onAction={() => setAttempt(attempt + 1)} />
          </div>
        ) : null}
        {/* Что смотрите сейчас — первым: чек-ин после просмотра кормит подбор, прятать его в архив нельзя */}
        {current.map((e) => (
          <article key={e.id} className={cx('tm-stream__item', 'tm-stream__item--current')}>
            <WorkBanner work={e.work} size="sm" tag={ru.feed.watching} meta={entryMeta(e)} onClick={() => setOpen(e.id)} />
            {/* сверка в один тап прямо из ленты: «посмотрели?». «Ещё не смотрел» — нормальный
                ответ: переход в кинотеатр ещё не просмотр, человека могли отвлечь */}
            <div className="tm-stream__quick">
              <span className="tm-caption tm-stream__quicklabel">{age(e) < FRESH_MS ? ru.feed.watchingNow : ru.feed.didYouWatch}</span>
              <span className="tm-stream__quickbtns">{answers(e)}</span>
            </div>
          </article>
        ))}
        {hint && items.length ? (
          <div className="tm-stream__swipehint" role="note">
            <span className="tm-caption">{ru.feed.swipeHint}</span>
            <Button variant="quiet" size="sm" onClick={() => { tap(); learned(); }}>{ru.feed.swipeHintOk}</Button>
          </div>
        ) : null}
        {items.map((r) => (
          <FeedCard key={r.id} r={r} meta={recMeta(r)} tag={mechanics ? ru.slot[r.slot].label : undefined}
                    onOpen={() => setOpen(r.id)} onSave={(n) => { learned(); save(r, n); }}
                    onDismiss={(reason) => { learned(); dismiss(r, reason); }} />
        ))}
      </div>

      {/* Карточка того, что смотрите сейчас: описание и чек-ин */}
      <WorkSheet work={openEntry?.work ?? null} open={openEntry != null} onOpenChange={(o) => !o && closeSheet()}
                 tag={ru.feed.watching} meta={openEntry ? entryMeta(openEntry) : undefined}>
        {openEntry ? (
          <div className="tm-stream__panel tm-stream__panel--tabs">
            <FilmTabs key={openEntry.id} analyses={openEntry.analyses ?? []} spoilerLevel={spoilerLevel} watch={openEntry.work.watch}
                      corner={answers(openEntry, true)} />
          </div>
        ) : null}
      </WorkSheet>
      {/* Карточка рекомендации */}
      <WorkSheet work={openRec?.work ?? null} open={openRec != null} onOpenChange={(o) => { if (!o) closeSheet(); }}
                 tag={mechanics && openRec ? ru.slot[openRec.slot].label : undefined} meta={openRec ? recMeta(openRec) : undefined}>
        {openRec ? (
          <Panel r={openRec} spoilerLevel={spoilerLevel} finished={finishedIds.has(openRec.work.id)}
                 onSave={() => save(openRec)} onDismiss={(reason) => dismiss(openRec, reason)} onWatch={() => watchFrom(openRec)} />
        ) : null}
      </WorkSheet>
    </main>
  );
}
