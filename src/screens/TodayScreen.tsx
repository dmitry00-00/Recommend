import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type {
  DiscussionPlace, DismissReason, Energy, FeedKind, JourneyEntryData, Recommendation, RecommendationSlate,
  SpoilerLevel, WatchOption,
} from '@/types/tmdf';
import { OfflineError, coldStartLeft, startPassed, getJourney, getScaleQuestion, getSettings, getSlate, getTrailer, noteShare, noteSurvey, noteTrailer, notWatched, planWork, sendRecommendationFeedback, startWork, trailerSource, unplanWork, updateSettings, type Trailer } from '@/api';
import { TrailerSheet } from '@/components/TrailerSheet';
import {
  Button, DiscussionLink, EmptyState, EnergySwitch, ErrorState, FeedKindSwitch, FilmTabs, ImportHistorySheet, QuickMark, ReasonPicker, Skeleton,
  FilmEdge, FilmReel, WorkBanner, WorkSheet, reelKnow, reelKnown, reelPlayed, reelWanted, useToast,
} from '@/components';
import { Avatar, VoiceStrip } from '@/components/WorkVoices';
import { groupByVoice } from '@/lib/voices';
import { useSwipe } from '@/lib/swipe';
import { saveSettings, useDiary, useMechanics, useSettings } from '@/lib/settingsStore';
import { cinemaSlug } from '@/lib/cinemas';
import { useFeature } from '@/lib/flags';
import { onExternalClick, openExternal, pick, shareUrl, tap, writeAuthorUrl } from '@/lib/telegram';
import { formatDuration, titleOf } from '@/lib/format';
import { cx } from '@/lib/cx';
import { leadName } from '@/lib/credits';
import { SearchLine, WorkPlaces, placesCount, usePlaces } from './WorkPlaces';
import { MoodLine, useMoodQuery } from './MoodLine';
import ui, { language, plural } from '@/i18n';
import { lastSlate, saveSlate } from '@/lib/slateCache';
import { readingHours } from '@/lib/reading';
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
      <h3 className="tm-label tm-stream__grouplabel">{ui.feed.watch}</h3>
      <div className="tm-row tm-row--gap-2 tm-row--wrap">
        {shown.map((w) => (
          <a key={w.url} className="tm-btn tm-btn--secondary tm-btn--sm" href={w.url} target="_blank" rel="noreferrer noopener"
             onClick={onExternalClick(w.url)}>
            {w.platform}
          </a>
        ))}
        {rest > 0 ? <Button variant="quiet" size="sm" onClick={() => setAll(true)}>{ui.feed.more(rest)}</Button> : null}
      </div>
    </section>
  );
}


/** Тело карточки: описание словами, разборы конкретными роликами и постами, места разговора,
 *  строка поиска по каналам, где посмотреть, действия. Всё — из данных рекомендации; экран
 *  только раскладывает. */
function Panel({ r, spoilerLevel, finished, voiceId, onSave, onSeen, onDismiss, onWatch }: {
  r: Recommendation; spoilerLevel: SpoilerLevel; finished: boolean; voiceId?: string;
  onSave: () => void; onSeen: () => void; onDismiss: (reason: DismissReason) => void; onWatch: () => void;
}) {
  const [reasons, setReasons] = useState(false);
  // «В планы» — функция эталона; «Видел» с оценкой — всегда: лента учится, фильм уходит
  const plans = useFeature('plans');
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
        workId={r.work.id}
        analyses={r.analyses ?? []}
        book={r.work.type === 'book' ? r.work : undefined}
        workTitle={titleOf(r.work)}
        spoilerLevel={allowed}
        seen={finished}
        watch={r.work.watch}
        onWatch={onWatch}
        discussionsCount={places.length}
        discussions={(
          <>
            {places.length ? (
              <section className="tm-stream__group">
                <h3 className="tm-label tm-stream__grouplabel">{ui.feed.telegram}</h3>
                {places.map((d) => <DiscussionLink key={d.id} discussion={d} locked={d.spoilers && !finished} />)}
              </section>
            ) : null}
            {searches.length ? <SearchLine places={searches} /> : null}
          </>
        )}
        // «Начать смотреть» убрано из карточки (24.09, решение владельца); «видел», «в планы» и «не
        // сейчас» — в правом углу текста под кадром материала, причины — под материалом. «Видел» с оценкой —
        // в обеих редакциях (11.10: в полной его не было — уже виденный фильм некуда было деть, кроме «не сейчас»)
        corner={finished ? undefined : (
          <QuickMark work={r.work} abandon={false} label={r.work.type === 'book' ? ui.quick.read : ui.quick.seen} onDone={onSeen}
                     extra={(
                       <>
                         {plans ? <Button size="sm" onClick={onSave}>{ui.actions.save}</Button> : null}
                         <Button variant="quiet" size="sm" pressed={reasons} onClick={() => setReasons(!reasons)}>{ui.actions.dismiss}</Button>
                       </>
                     )} />
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
/** Книгу и сериал читают и смотрят неделями (11.10): за семь дней «Солярис» тихо уходил обратно в планы посреди
 *  чтения. У них срок дольше и отсчёт — от последней отмеченной части или сезона, а не от начала. */
const LONG_STALE_MS = 45 * 86400e3;
const age = (e: JourneyEntryData) => (e.startedAt ? Date.now() - Date.parse(e.startedAt) : 0);
const stale = (e: JourneyEntryData): boolean => {
  if (!(e.work.type === 'book' || isSeries(e.work))) return age(e) > STALE_MS;
  const marks = [...(e.bookProgress?.done ?? []), ...(e.seriesProgress?.done ?? [])].map((d) => (d.at ? Date.parse(d.at) : 0));
  const last = Math.max(e.startedAt ? Date.parse(e.startedAt) : 0, ...marks);
  return last > 0 && Date.now() - last > LONG_STALE_MS;
};

function FeedCard({ r, no, meta, tag, onOpen, onVoice, onDismiss }: {
  /** номер кадра на плёнке — в надпечатке по кромке */
  no: number;
  r: Recommendation; meta?: string; tag?: string;
  onOpen: () => void; onVoice: (voiceId: string) => void; onDismiss: (reason: DismissReason) => void;
}) {
  const [dx, setDx] = useState(0);
  const [side, setSide] = useState<'none' | 'ask' | 'voices'>('none');
  // влево — трейлер (15.10, владелец): «Не сейчас» переехало в карточку фильма. Трейлер спрашиваем, как только карточку
  // повели влево, — к отпусканию он обычно уже есть; не нашёлся — смахивание работает по-старому (причины «не сейчас»)
  const canTrailer = trailerSource(r.work);
  const [trailer, setTrailer] = useState<Trailer | null | undefined>(canTrailer ? undefined : null);
  const [playing, setPlaying] = useState<Trailer>();
  const askTrailer = () => getTrailer(r.work).then((t) => { setTrailer(t ?? null); return t; });
  const asking = side === 'ask';
  // те же авторы и в том же порядке, что в карточке: сначала подтверждённые, потом у кого больше
  const voices = useMemo(() => groupByVoice(r.analyses ?? []), [r.analyses]);
  const dropping = dx <= -SWIPE;
  const showing = dx >= SWIPE && voices.length > 0;
  const swipe = useSwipe({
    enabled: side === 'none',
    onMove(next) {
      if ((next <= -SWIPE) !== dropping || (next >= SWIPE && voices.length > 0) !== showing) tap();
      if (next < 0 && trailer === undefined) askTrailer().catch(() => undefined);
      setDx(next);
    },
    onEnd(end) {
      setDx(0);
      if (end <= -SWIPE) {
        tap('medium');
        if (trailer === null) { setSide('ask'); return; }
        askTrailer().then((t) => { if (t) { noteTrailer(r.work.id, 'feed'); setPlaying(t); } else setSide('ask'); }).catch(() => setSide('ask'));
      }
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
          <Button variant="quiet" size="sm" onClick={() => { tap(); setSide('none'); }}>{ui.feed.keep}</Button>
        </div>
      ) : side === 'voices' ? (
        <div className="tm-stream__voices" data-noswipe>
          <p className="tm-label tm-stream__voicestitle">{ui.feed.voicesTitle(titleOf(r.work))}</p>
          <VoiceStrip groups={voices} onPick={(id) => { tap(); setSide('none'); onVoice(id); }} />
          <div className="tm-stream__voicesfoot">
            <span className="tm-caption">{ui.feed.voicesHint}</span>
            <Button variant="quiet" size="sm" onClick={() => { tap(); setSide('none'); }}>{ui.feed.voicesBack}</Button>
          </div>
        </div>
      ) : (
        <span className={cx('tm-stream__hint', right ? 'tm-stream__hint--voices' : 'tm-stream__hint--dismiss',
                            (showing || dropping) && 'tm-stream__hint--on')}
              style={{ '--fill': fill } as CSSProperties} aria-hidden="true">
          {!right ? (trailer === null ? ui.actions.dismiss : ui.trailer.swipe) : voices.length ? (
            <span className="tm-stream__pile">
              {voices.slice(0, PILE).map((g) => <Avatar key={g.voice.id} voice={g.voice} size="sm" />)}
              {rest > 0 ? <span className="tm-stream__pilemore">+{rest}</span> : null}
            </span>
          ) : ui.feed.noVoices}
        </span>
      )}
      <FilmEdge work={r.work} no={no} />
      <div className="tm-stream__drag" style={dx ? ({ '--swipe-x': `${Math.round(dx * DRAG)}px` } as CSSProperties) : undefined}>
        <WorkBanner work={r.work} meta={meta} tag={tag} onClick={onOpen} priority={no === 1} />
      </div>
      <TrailerSheet trailer={playing} title={titleOf(r.work)} onClose={() => setPlaying(undefined)} />
    </article>
  );
}

/** Лента (/today): фильмы баннерами во всю ширину; тап открывает карточку в модальном
 *  окне — баннер сверху, описание и ссылки ниже со своей прокруткой (21.09, по замечанию).
 *  Над лентой спрятан архив просмотренного: он вытягивается прокруткой вверх, как архив
 *  чатов в Telegram. Уровень усилия — из настроек. */
/** Кадр первого баннера загружен — или прошло 2,5 с (ДФ-21) */
const firstImage = () => new Promise<void>((done) => {
  const until = Date.now() + 2500;
  const tick = () => {
    const img = document.querySelector<HTMLImageElement>('.tm-banner__img');
    if ((img?.complete && img.naturalWidth) || Date.now() > until) done(); else setTimeout(tick, 100);
  };
  setTimeout(tick, 100);
});

/** «14 октября, 09:12» — когда сохранили ленту с устройства (ДФ-3) */
const cachedWhen = (at: string) =>
  new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : 'ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(at));

export function TodayScreen() {
  const navigate = useNavigate();
  const toast = useToast();
  const mechanics = useMechanics();
  const diary = useDiary();
  // редакция (10.10): архив, сила, поиск словами, «вместе» — функции эталона
  const plans = useFeature('plans');
  const energyOn = useFeature('energy');
  const searchOn = useFeature('search');
  const together = useFeature('together');
  const collections = useFeature('collections');
  // поиск словами в ленте (ДФ-12): пока запрос есть, его ответ стоит на месте кадров ленты
  const moodQuery = useMoodQuery();
  // словарь запросов (src/lib/mood.ts) понимает только русский: по-английски каждый чип кончался бы отказом
  const moodLine = searchOn && language === 'ru';
  const moodOn = moodLine && Boolean(moodQuery);
  // мои подписки (ЗП-42): лента ставит вперёд доступное без доплаты, в мете — «в подписке Okko»
  const subsOn = useFeature('subscriptions');
  const userSettings = useSettings();
  const subs = subsOn ? userSettings?.subscriptions ?? [] : [];
  const subsOnly = subsOn && Boolean(userSettings?.subscriptionsOnly);
  // полка бесплатной классики (ЗП-43): место «Бесплатная классика» в ленте
  const freeOn = useFeature('freeClassics');
  const booksOn = useFeature('readShelf');
  // первый вход свайпом (ДФ-2): новому человеку — /start, при 0–4 оценках — общая лента вместо холодного старта
  const swipeOn = useFeature('swipeStart');
  // кино или книги (11.10): что подбирает лента — переключателем рядом с силой, выбор помнят настройки
  const [kind, setKind] = useState<FeedKind>('screen');
  const bookFeed = booksOn && kind === 'book';
  // «Почитать» в конце ленты кино — только пока лента кино; в ленте книг он не нужен
  const slateOpts = (k: FeedKind) => ({ general: swipeOn, subscriptions: subsOn, freeClassics: freeOn, books: booksOn && k === 'screen', kind: booksOn ? k : 'screen' as FeedKind });
  // список просмотренного прямо с пустой ленты (02.10): самый короткий путь к первым рекомендациям
  const [importing, setImporting] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  // заставка-плёнка (16.10): раз за сессию, пока грузится лента. Решаем сразу при входе: редакция приходит
  // с настройками позже, поэтому «эталон ли это» помним с прошлого запуска, а доля выката известна сразу
  const reelOn = useFeature('reel');
  const [reel, setReel] = useState(() => reelWanted() && (reelOn || reelKnown()));
  useEffect(() => { if (reel) reelPlayed(); }, [reel]);
  const settingsLoaded = userSettings != null;
  useEffect(() => { if (settingsLoaded) reelKnow(reelOn); }, [settingsLoaded, reelOn]);
  const [slate, setSlate] = useState<RecommendationSlate | null>(null);
  // пролетающие кадры заставки — из ленты человека, как только она есть
  const reelWorks = useMemo(() => slate?.items.map((r) => r.work) ?? [], [slate]);
  const [spoilerLevel, setSpoilerLevel] = useState<SpoilerLevel>(0);
  const [finishedIds, setFinishedIds] = useState<Set<string>>(new Set());
  const [archived, setArchived] = useState(0);
  // настраиваемая лента (ТВ-11): сила — переключателем над лентой, «Ещё фильмы» — в конце
  const [energy, setEnergy] = useState<Energy>('normal');
  const [moreBusy, setMoreBusy] = useState(false);
  const [moreDone, setMoreDone] = useState(false);
  // всё, что уже было в ленте (в том числе убранное и отложенное), — добор их не повторяет
  const shownIds = useRef(new Set<string>());
  const [current, setCurrent] = useState<JourneyEntryData[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  // автор, на чьём материале открыть карточку: приходит из ленты тапом по логотипу канала
  const [openVoice, setOpenVoice] = useState<string | undefined>();
  const [failed, setFailed] = useState<false | 'offline' | 'error'>(false);
  // лента с устройства (ДФ-3): сервер не ответил — показываем последнюю удачную, с её временем
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [hint, setHint] = useState(hintWanted);
  const learned = () => { if (hint) { hintDone(); setHint(false); } };

  // норма шкалы (OPS-6): один вопрос тем, чья история пришла без него
  const [scale, setScale] = useState<{ median: number; count: number; options: number[] } | undefined>(undefined);
  useEffect(() => { getScaleQuestion().then(setScale).catch(() => undefined); }, []);
  const answerScale = (n: number) => {
    setScale(undefined);
    noteSurvey('scale', n);
    updateSettings({ ratingNorm: n }).then(() => setAttempt((a) => a + 1)).catch(() => undefined);
  };

  // лента с устройства на старте (ДФ-21): свежую считает клиент по справочнику в несколько мегабайт — на медленной
  // сети это десятки секунд. Пока он грузится, показываем последнюю удачную ленту, потом тихо подменяем свежей
  const booted = useRef(false);
  useEffect(() => {
    let alive = true;
    let fresh = false;
    setSlate(null);
    setFailed(false);
    setCachedAt(null);
    const first = !booted.current;
    booted.current = true;
    // сохранённая лента показана — свежую начинаем считать, когда нарисовался кадр первого баннера (не позже 2,5 с):
    // справочник иначе отнимает у этого кадра и сеть, и главный поток
    const head: Promise<unknown> = first
      ? lastSlate(kind).then((c) => {
        if (!alive || fresh || !c) return;
        setSlate(c.slate);
        shownIds.current = new Set(c.slate.items.map((r) => r.work.id));
        return firstImage();
      }).catch(() => undefined)
      : Promise.resolve();
    head.then(() => getSettings())
      .then((settings) => Promise.all([getSlate(settings.energy ?? 'normal', undefined, slateOpts(settings.feedKind ?? 'screen')), getJourney(), settings]))
      .then(([nextSlate, journal, settings]) => {
        if (!alive) return;
        fresh = true;
        setSlate(nextSlate);
        saveSlate(settings.feedKind ?? 'screen', nextSlate);
        setEnergy(settings.energy ?? 'normal');
        setKind(settings.feedKind ?? 'screen');
        setMoreDone(false);
        shownIds.current = new Set(nextSlate.items.map((r) => r.work.id));
        setSpoilerLevel(settings.spoilerLevel);
        setFinishedIds(new Set(journal.filter((e) => e.status === 'finished').map((e) => e.work.id)));
        setArchived(journal.length);
        const going = journal.filter((e) => e.status === 'in_progress');
        for (const e of going.filter(stale)) notWatched(e.id, 'expired').catch(() => undefined);
        setCurrent(going.filter((x) => !stale(x)));
      })
      .catch(async (err) => {
        fresh = true;
        const cached = await lastSlate(kind).catch(() => undefined);
        if (!alive) return;
        if (cached) {
          setSlate(cached.slate);
          setCachedAt(cached.at);
          shownIds.current = new Set(cached.slate.items.map((r) => r.work.id));
        }
        setFailed(err instanceof OfflineError ? 'offline' : 'error');
      });
    return () => { alive = false; };
  }, [attempt, subsOn, freeOn, booksOn, swipeOn]);
  // не прошёл первый вход и оценок меньше порога — сначала /start (один раз: пройденный или пропущенный помнят настройки)
  const startDone = userSettings ? Boolean(userSettings.swipeStartDone) : undefined;
  useEffect(() => {
    if (!swipeOn || startDone !== false || startPassed()) return;
    let alive = true;
    coldStartLeft().then((left) => { if (alive && left > 0) navigate('/start', { replace: true }); }).catch(() => undefined);
    return () => { alive = false; };
  }, [swipeOn, startDone, navigate]);

  const changeEnergy = (e: Energy) => {
    if (e === energy) return;
    pick();
    setEnergy(e);
    saveSettings({ energy: e }).then(() => setAttempt((a) => a + 1)).catch(() => toast({ text: ui.settings.errorSave }));
  };
  const changeKind = (k: FeedKind) => {
    if (k === kind) return;
    pick();
    setKind(k);
    saveSettings({ feedKind: k }).then(() => setAttempt((a) => a + 1)).catch(() => toast({ text: ui.settings.errorSave }));
  };
  const loadMore = () => {
    if (!slate || moreBusy) return;
    tap();
    setMoreBusy(true);
    getSlate(energy, [...shownIds.current], slateOpts(kind))
      .then((next) => {
        const fresh = next.items.filter((r) => !shownIds.current.has(r.work.id));
        fresh.forEach((r) => shownIds.current.add(r.work.id));
        if (!fresh.length) setMoreDone(true);
        setSlate((s) => (s ? { ...s, items: [...s.items, ...fresh] } : s));
      })
      .catch(() => toast({ text: ui.feed.moreFailed }))
      .finally(() => setMoreBusy(false));
  };

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
          text: ui.toast.savedPlain,
          action: ui.actions.undo,
          onAction: () => {
            setSlate(before);
            setArchived((n) => Math.max(0, n - 1));
            if (entryId) unplanWork(entryId).catch(() => toast({ text: ui.settings.errorSave }));
          },
        });
      })
      .catch(() => { setSlate(before); toast({ text: ui.settings.errorSave, action: ui.actions.retry, onAction: () => save(r) }); });
  };
  // «Видел» (минимальная редакция): оценка уже записана QuickMark. Карточка остаётся открытой, и
  // замок со спойлерных разборов снимается — видевшему как раз и интересно, что о фильме говорят;
  // из ленты кадр уходит, когда карточку закроют. В отклик слота — «уже знаю»: воронка видит ответ
  const seenIds = useRef(new Set<string>());
  const seen = (r: Recommendation) => {
    setFinishedIds((ids) => new Set(ids).add(r.work.id));
    seenIds.current.add(r.id);
    sendRecommendationFeedback(r.id, { action: 'dismiss', reason: 'already_know' }).catch(() => undefined);
  };
  const dismiss = (r: Recommendation, reason: DismissReason) => {
    if (!slate) return;
    tap();
    const before = slate;
    setSlate({ ...slate, items: slate.items.filter((i) => i.id !== r.id) });
    setOpen(null);
    sendRecommendationFeedback(r.id, { action: 'dismiss', reason })
      .then(() => toast({ text: ui.toast.dismissed, action: ui.actions.undo, onAction: () => setSlate(before) }))
      .catch(() => { setSlate(before); toast({ text: ui.settings.errorSave }); });
  };

  // Переход в онлайн-кинотеатр из «Смотреть» — это и есть «начал смотреть» (24.09): отдельной
  // кнопки нет, отмечаем за человека и потом переспрашиваем. Ленту перечитываем, когда он
  // закроет карточку, — пока она открыта, кадр из-под неё не убираем.
  const [restart, setRestart] = useState(false);
  const watchFrom = (r: Recommendation) => {
    sendRecommendationFeedback(r.id, { action: 'start' }).catch(() => undefined);
    startWork(r.work.id, undefined, { inferred: true })
      .then(() => { setRestart(true); toast({ text: ui.toast.watchInferred }); })
      .catch(() => undefined);
  };
  const closeSheet = () => {
    setOpen(null);
    setOpenVoice(undefined);
    if (seenIds.current.size) {
      const gone = seenIds.current;
      seenIds.current = new Set();
      setSlate((sl) => (sl ? { ...sl, items: sl.items.filter((i) => !gone.has(i.id)) } : sl));
    }
    if (restart) { setRestart(false); setAttempt((a) => a + 1); }
  };
  const notYet = (e: JourneyEntryData) => {
    tap();
    notWatched(e.id)
      .then(() => { setOpen(null); setCurrent((list) => list.filter((x) => x.id !== e.id)); toast({ text: ui.toast.notWatched }); })
      .catch(() => toast({ text: ui.settings.errorSave }));
  };
  // облегчённый учёт (02.10): «посмотрел» с оценкой и «бросил» прямо в ленте, без экрана чек-ина
  const quickDone = (e: JourneyEntryData) => {
    setOpen(null);
    setCurrent((list) => list.filter((x) => x.id !== e.id));
    setAttempt((a) => a + 1);
  };
  const answers = (e: JourneyEntryData, big = false) => (!diary ? (
    <QuickMark work={e.work} primary={big} onDone={() => quickDone(e)}
               extra={<Button variant="quiet" size="sm" onClick={() => notYet(e)}>{e.work.type === 'book' ? ui.feed.notYetRead : ui.feed.notYet}</Button>} />
  ) : (
    <>
      <Button variant={big ? 'primary' : 'secondary'} size="sm" onClick={() => { tap(); navigate(`/journal/${e.id}/check-in`); }}>
        {isSeries(e.work) ? ui.seriesDiary.finishSeason(e.seriesProgress?.season ?? 1)
          : e.work.type === 'book' && e.bookProgress?.part ? ui.bookDiary.finishPart(e.bookProgress.part)
          : isScreen(e.work) ? ui.actions.finishFilm : ui.actions.finishBook}
      </Button>
      <Button variant="quiet" size="sm" onClick={() => { tap(); navigate(`/journal/${e.id}/check-in?abandon=1`); }}>{ui.feed.gaveUp}</Button>
      <Button variant="quiet" size="sm" onClick={() => notYet(e)}>{e.work.type === 'book' ? ui.feed.notYetRead : ui.feed.notYet}</Button>
      {/* сериал и книга — долгие: где человек (сезон, часть, страница) — на странице записи */}
      {isSeries(e.work) || e.work.type === 'book' ? (
        <Button variant="quiet" size="sm" onClick={() => { tap(); navigate(`/journal/${e.id}`); }}>{ui.feed.whereNow}</Button>
      ) : null}
    </>
  ));

  const items = slate?.items ?? [];
  // над лентой книг — только начатые книги; над лентой кино — всё начатое, как до переключателя: книга, начатая из
  // «Почитать» в ленте кино, иначе пропала бы с глаз
  const shownCurrent = bookFeed ? current.filter((e) => e.work.type === 'book') : current;
  const openEntry = current.find((e) => e.id === open) ?? null;
  const entryPlaces = usePlaces(openEntry?.work.id);
  const openRec = items.find((r) => r.id === open) ?? null;
  // где смотреть без доплаты — словом в мете (ЗП-42): своя подписка важнее бесплатного
  const availability = (r: Recommendation): string | undefined => {
    const w = r.work.watch ?? [];
    // бесплатно у правообладателя (ЗП-43) — прямая ссылка на фильм, это важнее всего
    const legal = freeOn ? w.find((o) => o.source === 'wikidata') : undefined;
    if (legal) return ui.feed.freeOn(legal.platform);
    if (!subsOn) return undefined;
    const own = w.find((o) => o.kind === 'subscription' && subs.includes(cinemaSlug(o.platform)));
    if (own) return ui.feed.inYourSub(own.platform);
    const free = w.find((o) => o.kind === 'free' || o.kind === 'ads');
    return free ? ui.feed.freeOn(free.platform) : undefined;
  };
  const recMeta = (r: Recommendation) =>
    [r.work.year, leadName(r.work), r.work.type === 'book' ? readTime(r.work.pages) : formatDuration(r.work.durationMinutes), availability(r)].filter(Boolean).join(' · ');
  // книга (11.10): сколько читать — по страницам, как во вкладке «Читать»
  const readTime = (pages?: number) => { const h = readingHours(pages); return h ? ui.feed.readTime(h) : undefined; };
  const toggleSubsOnly = () => {
    pick();
    saveSettings({ subscriptionsOnly: !subsOnly }).then(() => setAttempt((a) => a + 1)).catch(() => toast({ text: ui.settings.errorSave }));
  };
  // вопрос «посмотрели?» стоит под баннером — в мете его не повторяем
  const entryMeta = (e: JourneyEntryData) =>
    [e.work.year, leadName(e.work), e.progress != null ? `${Math.round(e.progress * 100)}%` : null].filter(Boolean).join(' · ');
  return (
    <main className="tm-shell__main tm-stream" ref={mainRef}>
      {reel ? <FilmReel works={reelWorks} ready={Boolean(slate) || Boolean(failed)} column={mainRef} onDone={() => setReel(false)} /> : null}
      <h1 className="tm-sr">{ui.nav.today}</h1>
      {plans ? <button type="button" className="tm-stream__archive" onClick={() => navigate('/journal')}>
        <span className="tm-stream__archiveicon" aria-hidden="true" />
        <span className="tm-stream__archivetext">
          {ui.feed.archive}
          {archived ? <span className="tm-stream__archivecount">
            {` · ${archived} ${plural(archived, ui.feed.entryOne, ui.feed.entryFew, ui.feed.entryMany)}`}
          </span> : null}
        </span>
        <span className="tm-stream__archivechevron" aria-hidden="true">›</span>
      </button> : null}

      <div className="tm-stream__body">
        {scale ? (
          <section className="tm-stream__pad tm-import__norm">
            <h2 className="tm-label">{ui.today.normTitle}</h2>
            <p className="tm-caption tm-import__normwhy">{ui.today.normWhy(scale.count, scale.median)}</p>
            <div className="tm-row tm-row--gap-2 tm-row--wrap">
              {scale.options.map((n) => (
                <Button key={n} size="sm" variant={n === scale.median ? 'primary' : undefined} onClick={() => answerScale(n)}>{String(n)}</Button>
              ))}
              <Button size="sm" variant="quiet" onClick={() => answerScale(scale.median)}>{ui.today.normKeep(scale.median)}</Button>
            </div>
          </section>
        ) : null}
        {failed ? (
          <ErrorState title={failed === 'offline' ? ui.state.offlineTitle : ui.state.errorSlate}
                      text={cachedAt ? ui.state.cachedSlate(cachedWhen(cachedAt))
                        : failed === 'offline' ? ui.state.offlineText : slate ? ui.state.errorSlateText : ui.state.errorText}
                      className="tm-stream__pad" onRetry={() => setAttempt(attempt + 1)} />
        ) : null}
        {!slate && !failed ? (
          <div aria-busy="true">
            <span className="tm-sr">{ui.today.loading}</span>
            {[0, 1, 2].map((i) => <Skeleton key={i} kind="block" style={{ height: 200, marginTop: i ? 2 : 0 }} />)}
          </div>
        ) : null}
        {/* Новый участник: ленты ещё нет, и дело не в ошибке — модели не от чего считать.
            Объясняем и ведём туда, где это исправляется за минуту. */}
        {/* Новый человек (02.10): в Telegram он попадает сюда сразу, мимо приветствия, — поэтому здесь
            и что это за приложение, и как получить первую ленту, и кому писать */}
        {slate?.coldStart ? (
          <section className="tm-stream__pad tm-coldstart">
            <h1 className="tm-title-2 tm-coldstart__title">{ui.today.introTitle}</h1>
            <p className="tm-body tm-coldstart__text">{ui.today.introText}</p>
            <p className="tm-body-sm tm-coldstart__text">
              {`${ui.today.coldText(slate.coldStart.needed)} ${ui.today.coldProgress(slate.coldStart.rated, slate.coldStart.needed)}`}
            </p>
            <div className="tm-row tm-row--gap-2 tm-row--wrap">
              <Button variant="primary" onClick={() => { tap('medium'); navigate('/rate'); }}>
                {slate.coldStart.rated ? ui.today.coldMore : ui.today.coldAction}
              </Button>
              <Button variant="quiet" onClick={() => { tap(); setImporting(true); }}>{ui.today.coldImport}</Button>
            </div>
            <p className="tm-caption tm-coldstart__hint">{ui.today.coldImportHint}</p>
            {/* уведомление о рекомендательных технологиях и политике данных (ЗП-5) — там, где человек их впервые встречает */}
            <p className="tm-caption tm-coldstart__legal">
              {ui.legal.consentLead} <Link to="/legal/rules">{ui.legal.consentRules}</Link> {ui.legal.consentAnd}{' '}
              <Link to="/legal/privacy">{ui.legal.consentPrivacy}</Link>.
            </p>
            <p className="tm-caption tm-coldstart__early">
              {ui.today.early}{' '}
              <button type="button" className="tm-coldstart__link" onClick={() => openExternal(writeAuthorUrl)}>{ui.social.write}</button>
            </p>
          </section>
        ) : null}
        {/* общая лента (ДФ-2): оценок меньше порога — честно говорим, что лента пока не ваша, и как это исправить */}
        {slate?.general ? (
          <p className="tm-caption tm-stream__pad tm-stream__general">
            {ui.today.general(slate.general.rated, slate.general.needed)}{' '}
            <button type="button" className="tm-coldstart__link" onClick={() => { tap(); navigate('/rate'); }}>{ui.today.generalRate}</button>
            {' · '}
            <button type="button" className="tm-coldstart__link" onClick={() => { tap(); setImporting(true); }}>{ui.today.coldImport}</button>
          </p>
        ) : null}
        {slate && !items.length && !slate.coldStart ? (
          <div className="tm-stream__pad">
            <EmptyState title={bookFeed ? ui.today.emptyBooks : ui.today.empty} text={bookFeed ? ui.today.emptyBooksText : ui.today.emptyText} action={ui.actions.retry} onAction={() => setAttempt(attempt + 1)} />
          </div>
        ) : null}
        {hint && items.length && !moodOn ? (
          <div className="tm-stream__swipehint" role="note">
            <span className="tm-caption">{ui.feed.swipeHint}</span>
            <Button variant="quiet" size="sm" onClick={() => { tap(); learned(); }}>{ui.feed.swipeHintOk}</Button>
          </div>
        ) : null}
        {slate && !slate.coldStart && (items.length || current.length || subsOnly || bookFeed) && (energyOn || subs.length || booksOn) ? (
          <div className="tm-stream__pad tm-stream__energy">
            {booksOn ? <FeedKindSwitch value={kind} onChange={changeKind} /> : null}
            {energyOn ? <EnergySwitch value={energy} onChange={changeEnergy} /> : null}
            {subs.length && !bookFeed ? <Button variant="quiet" size="sm" pressed={subsOnly} onClick={toggleSubsOnly}>{ui.feed.subsOnly}</Button> : null}
          </div>
        ) : null}
        {/* ДФ-12 (14.10): то же, но словами — «тихое про семью, не грустное» — строкой прямо в ленте, а не экраном /mood;
            из ленты книг — по книгам */}
        {moodLine && slate && !slate.coldStart ? <MoodLine kind={bookFeed ? 'book' : 'screen'} energy={energy} /> : null}
        {!moodOn && (shownCurrent.length || items.length) ? <div className="tm-filmstrip">
        {/* Что смотрите сейчас — первым: чек-ин после просмотра кормит подбор, прятать его в архив нельзя */}
        {shownCurrent.map((e, i) => (
          <article key={e.id} className={cx('tm-stream__item', 'tm-stream__item--current')}>
            <FilmEdge work={e.work} no={i + 1} short />
            <WorkBanner work={e.work} size="sm" tag={ui.feed.watching} meta={entryMeta(e)} onClick={() => setOpen(e.id)} />
            {/* сверка в один тап прямо из ленты: «посмотрели?». «Ещё не смотрел» — нормальный
                ответ: переход в кинотеатр ещё не просмотр, человека могли отвлечь */}
            <div className="tm-stream__quick">
              <span className="tm-caption tm-stream__quicklabel">{e.work.type === 'book'
                ? (age(e) < FRESH_MS ? ui.feed.readingNow : ui.feed.didYouRead)
                : (age(e) < FRESH_MS ? ui.feed.watchingNow : ui.feed.didYouWatch)}</span>
              <span className="tm-stream__quickbtns">{answers(e)}</span>
            </div>
          </article>
        ))}
        {items.map((r, i) => (
          <FeedCard key={r.id} r={r} no={shownCurrent.length + i + 1} meta={recMeta(r)} tag={mechanics || r.slot === 'universe' || r.slot === 'free' || r.slot === 'book' ? ui.slot[r.slot].label : undefined}
                    onOpen={() => { setOpenVoice(undefined); setOpen(r.id); }}
                    onVoice={(id) => { learned(); setOpenVoice(id); setOpen(r.id); }}
                    onDismiss={(reason) => { learned(); dismiss(r, reason); }} />
        ))}
        </div> : null}
        {!moodOn && items.length && slate && !slate.coldStart ? (
          <div className="tm-stream__pad tm-stream__more">
            {moreDone
              ? <p className="tm-caption">{bookFeed ? ui.feed.moreNoneBooks : ui.feed.moreNone}</p>
              : <Button variant="secondary" onClick={loadMore} disabled={moreBusy}>{moreBusy ? ui.feed.moreLoading : bookFeed ? ui.feed.moreBooks : ui.feed.moreFilms}</Button>}
          </div>
        ) : null}
        {/* выбор компанией (ЗП-11): тот, кто долистал, — кандидат собрать вечер на двоих и больше */}
        {!moodOn && together && items.length && slate && !slate.coldStart ? (
          <p className="tm-caption tm-stream__pad tm-coldstart__share">
            {ui.together.entry}{' '}
            <button type="button" className="tm-coldstart__link" onClick={() => { tap(); navigate('/together'); }}>{ui.together.entryAction}</button>
          </p>
        ) : null}
        {/* культурные подборки (ЗП-45, шаг 2): кто долистал ленту — кандидат пойти вглубь по стране или школе */}
        {!moodOn && collections && items.length && slate && !slate.coldStart ? (
          <p className="tm-caption tm-stream__pad tm-coldstart__share">
            {ui.collections.entry}{' '}
            <button type="button" className="tm-coldstart__link" onClick={() => { tap(); navigate('/collections'); }}>{ui.collections.entryAction}</button>
          </p>
        ) : null}
        {/* позвать друга — под лентой, тихо: тот, кто долистал, лентой доволен (02.10) */}
        {!moodOn && items.length ? (
          <p className="tm-caption tm-stream__pad tm-coldstart__share">
            {ui.today.shareLead}{' '}
            <button type="button" className="tm-coldstart__link" onClick={() => { tap(); noteShare('friend', 'telegram'); openExternal(shareUrl(ui.social.shareText)); }}>{ui.social.share}</button>
          </p>
        ) : null}
      </div>

      <ImportHistorySheet
        open={importing}
        onOpenChange={setImporting}
        onNorm={(ratingNorm) => updateSettings({ ratingNorm })}
        onChanged={() => setAttempt((a) => a + 1)}
      />

      {/* Карточка того, что смотрите сейчас: описание и чек-ин */}
      <WorkSheet work={openEntry?.work ?? null} open={openEntry != null} onOpenChange={(o) => !o && closeSheet()}
                 tag={ui.feed.watching} meta={openEntry ? entryMeta(openEntry) : undefined} context="лента: смотрю">
        {openEntry ? (
          <div className="tm-stream__panel tm-stream__panel--tabs">
            <FilmTabs key={openEntry.id} workId={openEntry.work.id} analyses={openEntry.analyses ?? []} workTitle={titleOf(openEntry.work)} spoilerLevel={spoilerLevel} watch={openEntry.work.watch}
                      discussionsCount={placesCount(entryPlaces)} discussions={<WorkPlaces places={entryPlaces} finished={false} />}
                      book={openEntry.work.type === 'book' ? openEntry.work : undefined} corner={answers(openEntry, true)} />
          </div>
        ) : null}
      </WorkSheet>
      {/* Карточка рекомендации */}
      <WorkSheet work={openRec?.work ?? null} open={openRec != null} onOpenChange={(o) => { if (!o) closeSheet(); }}
                 tag={openRec && (mechanics || openRec.slot === 'universe' || openRec.slot === 'free' || openRec.slot === 'book') ? ui.slot[openRec.slot].label : undefined} meta={openRec ? recMeta(openRec) : undefined}
                 plot={openRec?.explanation?.what || undefined} context="лента: рекомендация" hurdles={!finishedIds.has(openRec?.work.id ?? '')}>
        {openRec ? (
          <Panel r={openRec} spoilerLevel={spoilerLevel} finished={finishedIds.has(openRec.work.id)} voiceId={openVoice}
                 onSave={() => save(openRec)} onSeen={() => seen(openRec)} onDismiss={(reason) => dismiss(openRec, reason)} onWatch={() => watchFrom(openRec)} />
        ) : null}
      </WorkSheet>
    </main>
  );
}
