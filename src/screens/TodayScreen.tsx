import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import type {
  DiscussionPlace, DismissReason, JourneyEntryData, Recommendation, RecommendationSlate,
  SpoilerLevel, WatchOption,
} from '@/types/tmdf';
import { OfflineError, getJourney, getScaleQuestion, getSettings, getSlate, notWatched, planWork, sendRecommendationFeedback, startWork, unplanWork, updateSettings } from '@/api';
import {
  Button, DiscussionLink, EmptyState, ErrorState, FilmTabs, ReasonPicker, Skeleton,
  FilmEdge, WorkBanner, WorkSheet, useToast,
} from '@/components';
import { Avatar, VoiceStrip } from '@/components/WorkVoices';
import { groupByVoice } from '@/lib/voices';
import { useSwipe } from '@/lib/swipe';
import { useMechanics } from '@/lib/settingsStore';
import { onExternalClick, tap } from '@/lib/telegram';
import { formatDuration, pluralRu } from '@/lib/format';
import { cx } from '@/lib/cx';
import ru from '@/i18n/ru';
import { isScreen, isSeries } from '@/lib/media';

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
/** сколько каналов в строке видно сразу: тридцать названий через точку не читают (28.09) */
const SEARCH_SHOWN = 6;

export function SearchLine({ places }: { places: DiscussionPlace[] }) {
  const [all, setAll] = useState(false);
  const groups: { label: string; items: DiscussionPlace[] }[] = [
    { label: ru.discussion.searchLine, items: places.filter((d) => d.kind !== 'telegram_chat') },
    { label: ru.discussion.chatsLine, items: places.filter((d) => d.kind === 'telegram_chat') },
  ];
  return (
    <>
      {groups.filter((g) => g.items.length).map((g) => {
        const shown = all ? g.items : g.items.slice(0, SEARCH_SHOWN);
        const hidden = g.items.length - shown.length;
        return (
          <p key={g.label} className="tm-caption tm-stream__search">
            {g.label}
            {shown.map((d, i) => (
              <span key={d.id}>
                {i ? ' · ' : ' '}
                <a href={d.url} target="_blank" rel="noreferrer noopener" onClick={onExternalClick(d.url)}>{d.title}</a>
              </span>
            ))}
            {hidden > 0 ? <>{' · '}<button type="button" className="tm-search__link" onClick={() => { tap(); setAll(true); }}>{ru.feed.more(hidden)}</button></> : null}
          </p>
        );
      })}
    </>
  );
}

/** Тело карточки: описание словами, разборы конкретными роликами и постами, места разговора,
 *  строка поиска по каналам, где посмотреть, действия. Всё — из данных рекомендации; экран
 *  только раскладывает. */
function Panel({ r, spoilerLevel, finished, voiceId, onSave, onDismiss, onWatch }: {
  r: Recommendation; spoilerLevel: SpoilerLevel; finished: boolean; voiceId?: string;
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
        key={`${r.id}:${voiceId ?? ''}`}
        voiceId={voiceId}
        analyses={r.analyses ?? []}
        book={r.work.type === 'book' ? r.work : undefined}
        workTitle={r.work.title}
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
 *  Вправо — кто разбирал (28.09, решение владельца: шкала «хочется» звёздами в формат
 *  приложения не легла). Под пальцем выступают логотипы каналов, у которых есть материал об
 *  этом фильме; дотянул до порога — кадр встаёт открытым, и логотипы становятся кнопками.
 *  Тап ведёт не в сам ролик, а в карточку на материале этого автора: в карточке работает
 *  штриховка спойлеров, а фильм человек ещё не видел. «В планы» осталось кнопкой в карточке.
 *
 *  Пороги намеренно большие: лента прокручивается вертикально, случайный сдвиг вбок ничего
 *  делать не должен. */
const SWIPE = 96;
// кадр уходит на DRAG от длины свайпа: в освободившуюся полосу должны влезать логотипы внахлёст
const DRAG = 0.8;
const ASK_MS = 8000;
/** сколько логотипов показывать под пальцем; остальные — числом «+N» */
const PILE = 4;

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

function FeedCard({ r, no, meta, tag, onOpen, onVoice, onDismiss }: {
  /** номер кадра на плёнке — в надпечатке по кромке */
  no: number;
  r: Recommendation; meta?: string; tag?: string;
  onOpen: () => void; onVoice: (voiceId: string) => void; onDismiss: (reason: DismissReason) => void;
}) {
  const [dx, setDx] = useState(0);
  const [side, setSide] = useState<'none' | 'ask' | 'voices'>('none');
  const asking = side === 'ask';
  // те же авторы и в том же порядке, что в карточке: сначала подтверждённые, потом у кого больше
  const voices = useMemo(() => groupByVoice(r.analyses ?? []), [r.analyses]);
  const dropping = dx <= -SWIPE;
  const showing = dx >= SWIPE && voices.length > 0;
  const swipe = useSwipe({
    enabled: side === 'none',
    onMove(next) {
      if ((next <= -SWIPE) !== dropping || (next >= SWIPE && voices.length > 0) !== showing) tap();
      setDx(next);
    },
    onEnd(end) {
      setDx(0);
      if (end <= -SWIPE) { tap('medium'); setSide('ask'); }
      // без авторов открывать нечего: заливка сказала «разборов пока нет», кадр вернулся
      else if (end >= SWIPE && voices.length) { tap('medium'); setSide('voices'); }
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
  const fill = Math.min(1, Math.abs(dx) / SWIPE);
  const rest = voices.length - PILE;
  return (
    <article className={cx('tm-stream__item', dx !== 0 && 'tm-stream__item--drag', asking && 'tm-stream__item--asking',
                           side === 'voices' && 'tm-stream__item--voices')}
             {...swipe}>
      {asking ? (
        <div className="tm-stream__ask" data-noswipe>
          <ReasonPicker variant="dismiss" onPick={onDismiss} />
          <Button variant="quiet" size="sm" onClick={() => { tap(); setSide('none'); }}>{ru.feed.keep}</Button>
        </div>
      ) : side === 'voices' ? (
        <div className="tm-stream__voices" data-noswipe>
          <p className="tm-label tm-stream__voicestitle">{ru.feed.voicesTitle(r.work.title)}</p>
          <VoiceStrip groups={voices} onPick={(id) => { tap(); setSide('none'); onVoice(id); }} />
          <div className="tm-stream__voicesfoot">
            <span className="tm-caption">{ru.feed.voicesHint}</span>
            <Button variant="quiet" size="sm" onClick={() => { tap(); setSide('none'); }}>{ru.feed.voicesBack}</Button>
          </div>
        </div>
      ) : (
        <span className={cx('tm-stream__hint', right ? 'tm-stream__hint--voices' : 'tm-stream__hint--dismiss',
                            (showing || dropping) && 'tm-stream__hint--on')}
              style={{ '--fill': fill } as CSSProperties} aria-hidden="true">
          {!right ? ru.actions.dismiss : voices.length ? (
            <span className="tm-stream__pile">
              {voices.slice(0, PILE).map((g) => <Avatar key={g.voice.id} voice={g.voice} size="sm" />)}
              {rest > 0 ? <span className="tm-stream__pilemore">+{rest}</span> : null}
            </span>
          ) : ru.feed.noVoices}
        </span>
      )}
      <FilmEdge work={r.work} no={no} />
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
  // автор, на чьём материале открыть карточку: приходит из ленты тапом по логотипу канала
  const [openVoice, setOpenVoice] = useState<string | undefined>();
  const [failed, setFailed] = useState<false | 'offline' | 'error'>(false);
  const [attempt, setAttempt] = useState(0);
  const [hint, setHint] = useState(hintWanted);
  const learned = () => { if (hint) { hintDone(); setHint(false); } };

  // норма шкалы (OPS-6): один вопрос тем, чья история пришла без него
  const [scale, setScale] = useState<{ median: number; count: number; options: number[] } | undefined>(undefined);
  useEffect(() => { getScaleQuestion().then(setScale).catch(() => undefined); }, []);
  const answerScale = (n: number) => {
    setScale(undefined);
    updateSettings({ ratingNorm: n }).then(() => setAttempt((a) => a + 1)).catch(() => undefined);
  };

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
  const save = (r: Recommendation) => {
    if (!slate) return;
    tap();
    const before = slate;
    setSlate({ ...slate, items: slate.items.filter((i) => i.id !== r.id) });
    setOpen(null);
    sendRecommendationFeedback(r.id, { action: 'save' }).catch(() => undefined);
    planWork(r.work.id)
      .then((entryId) => {
        setArchived((n) => n + 1);
        toast({
          text: ru.toast.savedPlain,
          action: ru.actions.undo,
          onAction: () => {
            setSlate(before);
            setArchived((n) => Math.max(0, n - 1));
            if (entryId) unplanWork(entryId).catch(() => toast({ text: ru.settings.errorSave }));
          },
        });
      })
      .catch(() => { setSlate(before); toast({ text: ru.settings.errorSave, action: ru.actions.retry, onAction: () => save(r) }); });
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
  const closeSheet = () => { setOpen(null); setOpenVoice(undefined); if (restart) { setRestart(false); setAttempt((a) => a + 1); } };
  const notYet = (e: JourneyEntryData) => {
    tap();
    notWatched(e.id)
      .then(() => { setOpen(null); setCurrent((list) => list.filter((x) => x.id !== e.id)); toast({ text: ru.toast.notWatched }); })
      .catch(() => toast({ text: ru.settings.errorSave }));
  };
  const answers = (e: JourneyEntryData, big = false) => (
    <>
      <Button variant={big ? 'primary' : 'secondary'} size="sm" onClick={() => { tap(); navigate(`/journal/${e.id}/check-in`); }}>
        {isSeries(e.work) ? ru.seriesDiary.finishSeason(e.seriesProgress?.season ?? 1)
          : e.work.type === 'book' && e.bookProgress?.part ? ru.bookDiary.finishPart(e.bookProgress.part)
          : isScreen(e.work) ? ru.actions.finishFilm : ru.actions.finishBook}
      </Button>
      <Button variant="quiet" size="sm" onClick={() => { tap(); navigate(`/journal/${e.id}/check-in?abandon=1`); }}>{ru.feed.gaveUp}</Button>
      <Button variant="quiet" size="sm" onClick={() => notYet(e)}>{e.work.type === 'book' ? ru.feed.notYetRead : ru.feed.notYet}</Button>
      {/* сериал и книга — долгие: где человек (сезон, часть, страница) — на странице записи */}
      {isSeries(e.work) || e.work.type === 'book' ? (
        <Button variant="quiet" size="sm" onClick={() => { tap(); navigate(`/journal/${e.id}`); }}>{ru.feed.whereNow}</Button>
      ) : null}
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
        {scale ? (
          <section className="tm-stream__pad tm-import__norm">
            <h2 className="tm-label">{ru.today.normTitle}</h2>
            <p className="tm-caption tm-import__normwhy">{ru.today.normWhy(scale.count, scale.median)}</p>
            <div className="tm-row tm-row--gap-2 tm-row--wrap">
              {scale.options.map((n) => (
                <Button key={n} size="sm" variant={n === scale.median ? 'primary' : undefined} onClick={() => answerScale(n)}>{String(n)}</Button>
              ))}
              <Button size="sm" variant="quiet" onClick={() => answerScale(scale.median)}>{ru.today.normKeep(scale.median)}</Button>
            </div>
          </section>
        ) : null}
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
        {hint && items.length ? (
          <div className="tm-stream__swipehint" role="note">
            <span className="tm-caption">{ru.feed.swipeHint}</span>
            <Button variant="quiet" size="sm" onClick={() => { tap(); learned(); }}>{ru.feed.swipeHintOk}</Button>
          </div>
        ) : null}
        {current.length || items.length ? <div className="tm-filmstrip">
        {/* Что смотрите сейчас — первым: чек-ин после просмотра кормит подбор, прятать его в архив нельзя */}
        {current.map((e, i) => (
          <article key={e.id} className={cx('tm-stream__item', 'tm-stream__item--current')}>
            <FilmEdge work={e.work} no={i + 1} short />
            <WorkBanner work={e.work} size="sm" tag={ru.feed.watching} meta={entryMeta(e)} onClick={() => setOpen(e.id)} />
            {/* сверка в один тап прямо из ленты: «посмотрели?». «Ещё не смотрел» — нормальный
                ответ: переход в кинотеатр ещё не просмотр, человека могли отвлечь */}
            <div className="tm-stream__quick">
              <span className="tm-caption tm-stream__quicklabel">{e.work.type === 'book'
                ? (age(e) < FRESH_MS ? ru.feed.readingNow : ru.feed.didYouRead)
                : (age(e) < FRESH_MS ? ru.feed.watchingNow : ru.feed.didYouWatch)}</span>
              <span className="tm-stream__quickbtns">{answers(e)}</span>
            </div>
          </article>
        ))}
        {items.map((r, i) => (
          <FeedCard key={r.id} r={r} no={current.length + i + 1} meta={recMeta(r)} tag={mechanics || r.slot === 'universe' ? ru.slot[r.slot].label : undefined}
                    onOpen={() => { setOpenVoice(undefined); setOpen(r.id); }}
                    onVoice={(id) => { learned(); setOpenVoice(id); setOpen(r.id); }}
                    onDismiss={(reason) => { learned(); dismiss(r, reason); }} />
        ))}
        </div> : null}
      </div>

      {/* Карточка того, что смотрите сейчас: описание и чек-ин */}
      <WorkSheet work={openEntry?.work ?? null} open={openEntry != null} onOpenChange={(o) => !o && closeSheet()}
                 tag={ru.feed.watching} meta={openEntry ? entryMeta(openEntry) : undefined}>
        {openEntry ? (
          <div className="tm-stream__panel tm-stream__panel--tabs">
            <FilmTabs key={openEntry.id} analyses={openEntry.analyses ?? []} workTitle={openEntry.work.title} spoilerLevel={spoilerLevel} watch={openEntry.work.watch}
                      book={openEntry.work.type === 'book' ? openEntry.work : undefined} corner={answers(openEntry, true)} />
          </div>
        ) : null}
      </WorkSheet>
      {/* Карточка рекомендации */}
      <WorkSheet work={openRec?.work ?? null} open={openRec != null} onOpenChange={(o) => { if (!o) closeSheet(); }}
                 tag={openRec && (mechanics || openRec.slot === 'universe') ? ru.slot[openRec.slot].label : undefined} meta={openRec ? recMeta(openRec) : undefined}>
        {openRec ? (
          <Panel r={openRec} spoilerLevel={spoilerLevel} finished={finishedIds.has(openRec.work.id)} voiceId={openVoice}
                 onSave={() => save(openRec)} onDismiss={(reason) => dismiss(openRec, reason)} onWatch={() => watchFrom(openRec)} />
        ) : null}
      </WorkSheet>
    </main>
  );
}
