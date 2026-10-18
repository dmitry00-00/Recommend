import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type {
  DiscussionPlace, DismissReason, Energy, FeedKind, JourneyEntryData, Recommendation, RecommendationSlate,
  SpoilerLevel, WatchOption,
} from '@/types/tmdf';
import { OfflineError, coldStartLeft, startPassed, getJourney, getScaleQuestion, getSettings, getSlate, getTrailer, pictureSlate, recWhat, noteNovelties, noteShare, noteSurvey, notWatched, planWork, sendRecommendationFeedback, startWork, unplanWork, updateSettings, type Trailer } from '@/api';
import { InlineTrailer, useTrailer } from '@/components/InlineTrailer';
import { RatingWheel } from '@/components/RatingWheel';
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
import { useMoodQuery } from './MoodLine';
import ui, { language, plural } from '@/i18n';
import { lastSlate, saveSlate } from '@/lib/slateCache';
import { readingHours } from '@/lib/reading';
import { isScreen, isSeries } from '@/lib/media';

const ARCHIVE_ROW = 56;

const WATCH_SHOWN = 6;
/** причины «не сейчас», которых в шторке нет (17.10): «Уже знаю» пишет «Видел», «Другое» — то же, что не отвечать */
const SHEET_OMIT: DismissReason[] = ['already_know', 'other'];

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
        // сейчас» — в правом углу текста под кадром материала. «Видел» с оценкой — в обеих редакциях (11.10: в полной
        // его не было — уже виденный фильм некуда было деть, кроме «не сейчас»). Причины «не сейчас» (17.10) — сразу под
        // рядом кнопок, а не внизу вкладки за краем экрана; «Уже знаю» (= «Видел») и «Другое» (= не отвечать) убраны:
        // не выбрал причину — ничего не уходит, как и раньше
        corner={finished ? undefined : (
          <div className="tm-mark">
            <QuickMark work={r.work} abandon={false} label={r.work.type === 'book' ? ui.quick.read : ui.quick.seen} onDone={onSeen}
                       extra={(
                         <>
                           {plans ? <Button size="sm" onClick={onSave}>{ui.actions.save}</Button> : null}
                           <Button variant="quiet" size="sm" pressed={reasons} onClick={() => setReasons(!reasons)}>{ui.actions.dismiss}</Button>
                         </>
                       )} />
            {reasons ? <ReasonPicker variant="dismiss" inline omit={SHEET_OMIT} onPick={onDismiss} /> : null}
          </div>
        )}
      />
    </div>
  );
}

/** Кадр ленты со свайпом (24.09). Под пальцем нарастает заливка — она же и остаётся на месте
 *  кадра, когда тот уезжает.
 *
 *  Влево — трейлер (15.10; с 17.10 всегда, владелец): трейлера нет — кадр пружинит назад и короткий тост «трейлера
 *  нет». Причин «не сейчас» под пальцем больше нет: одно направление — одно действие, «не сейчас» — в карточке.
 *
 *  Вправо — кто разбирал (28.09, решение владельца: шкала «хочется» звёздами в формат
 *  приложения не легла). Под пальцем выступают логотипы каналов, у которых есть материал об
 *  этом фильме; дотянул до порога — кадр встаёт открытым, и логотипы становятся кнопками.
 *  Тап ведёт не в сам ролик, а в карточку на материале этого автора: в карточке работает
 *  штриховка спойлеров, а фильм человек ещё не видел. «В планы» осталось кнопкой в карточке.
 *  Открытая панель авторов (17.10) закрывается свайпом в любую сторону и сама — когда кадр ушёл с экрана.
 *
 *  Пороги намеренно большие: лента прокручивается вертикально, случайный сдвиг вбок ничего
 *  делать не должен. */
const SWIPE = 96;
/** ▶ на кадре ленты (17.10, владелец): выключен — «без показа трейлера по свайпу лента станет лентой трейлеров»; «может,
 *  потом вернём» — тогда true, остальное (InlineTrailer, вид кнопки) на месте */
const FEED_PLAY_BUTTON = false;
// кадр уходит на DRAG от длины свайпа: в освободившуюся полосу должны влезать логотипы внахлёст
const DRAG = 0.8;
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

/** Хвост ленты (17.10): из приглашений («выбрать вместе», подборки, позвать друга) — одно за раз, по очереди между
 *  запусками. Очередь — счётчиком на устройстве; хранилища нет — всегда первое, это не страшно. Номер берётся один
 *  раз за запуск: переход между экранами приглашение не меняет. */
const TAIL_KEY = 'tm.feed.tailTurn';
let tailTurn: number | undefined;
const tailTurnNow = (): number => {
  if (tailTurn !== undefined) return tailTurn;
  try {
    const n = Number(localStorage.getItem(TAIL_KEY)) || 0;
    localStorage.setItem(TAIL_KEY, String(n + 1));
    tailTurn = n;
  } catch { tailTurn = 0; }
  return tailTurn;
};

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

/** ответа о трейлере нет столько после смахивания — тост «не загрузился», а не тишина (18.10, волна 3В: прокси TMDb без
 *  ответа держал смахивание без отклика сколько угодно) */
const TRAILER_WAIT = 4000;

/** Кадр ленты — memo (волна 3В): лента перерисовывается на каждое открытие карточки, тост, досланные картинки — кадры,
 *  которых это не касается, не трогаем. Обработчики — одни на весь экран, кадр передаёт в них свою рекомендацию. */
const FeedCard = memo(function FeedCard({ r, no, meta, tag, onOpen: openRec, onVoice: voiceRec, onSwiped }: {
  /** номер кадра на плёнке — в надпечатке по кромке */
  no: number;
  r: Recommendation; meta?: string; tag?: string;
  onOpen: (r: Recommendation) => void; onVoice: (r: Recommendation, voiceId: string) => void;
  /** человек свайпнул сам — подсказка про свайп больше не нужна */
  onSwiped: () => void;
}) {
  const onOpen = useCallback(() => openRec(r), [openRec, r]);
  const onVoice = (voiceId: string) => voiceRec(r, voiceId);
  const toast = useToast();
  const [dx, setDx] = useState(0);
  const [side, setSide] = useState<'none' | 'voices'>('none');
  // влево — трейлер (15.10, владелец): «Не сейчас» переехало в карточку фильма. Не нашёлся — кадр пружинит назад и тост
  // «трейлера нет» (17.10). Трейлер — заранее (16.10, владелец: «сразу при свайпе»): спрашиваем, как только карточка
  // подъезжает к экрану, — к свайпу он уже есть, а подсказка под кадром сразу честная (трейлер или «трейлера нет»)
  const cardRef = useRef<HTMLElement>(null);
  const trailer = useTrailer(r.work, cardRef);
  // ролик играет прямо в ленте (17.10, владелец) — только смахиванием влево, ▶ на кадре ленты нет («без показа трейлера
  // по свайпу лента станет лентой трейлеров»); пока играет, свайпы карточки выключены — жесты не дерутся с плеером
  const [inline, setInline] = useState(false);
  // панель авторов (17.10): кадр ушёл с экрана — закрываем сама, чтобы, вернувшись, человек видел ленту, а не панель
  const voicesOpen = side === 'voices';
  useEffect(() => {
    const el = cardRef.current;
    if (!el || !voicesOpen || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((seen) => { if (seen.every((x) => !x.isIntersecting)) setSide('none'); });
    io.observe(el);
    return () => io.disconnect();
  }, [voicesOpen]);
  // те же авторы и в том же порядке, что в карточке: сначала подтверждённые, потом у кого больше
  const voices = useMemo(() => groupByVoice(r.analyses ?? []), [r.analyses]);
  const noTrailer = () => toast({ text: ui.trailer.none, duration: 2000 });
  const dropping = dx <= -SWIPE;
  const showing = dx >= SWIPE && voices.length > 0;
  const swipe = useSwipe({
    enabled: !inline,
    onMove(next) {
      // открыта панель авторов — кадр не тянем: свайп в любую сторону её закрывает
      if (voicesOpen) return;
      if ((next <= -SWIPE) !== dropping || (next >= SWIPE && voices.length > 0) !== showing) tap();
      if (next < 0 && trailer === undefined) getTrailer(r.work).catch(() => undefined);
      setDx(next);
    },
    onEnd(end) {
      setDx(0);
      if (voicesOpen) { if (Math.abs(end) >= SWIPE / 2) { tap(); setSide('none'); } return; }
      if (end <= -SWIPE) {
        onSwiped();
        if (trailer === null) { tap(); noTrailer(); return; }
        tap('medium');
        if (trailer) { setInline(true); return; }
        // ещё не знаем: ждём ответа, но не дольше TRAILER_WAIT — потом тост; опоздавший ответ ролик уже не открывает
        let settled = false;
        const late = setTimeout(() => { if (!settled) { settled = true; toast({ text: ui.trailer.slow, duration: 2500 }); } }, TRAILER_WAIT);
        const done = (t?: Trailer) => { if (settled) return; settled = true; clearTimeout(late); if (t) setInline(true); else noTrailer(); };
        getTrailer(r.work).then(done, () => done());
      }
      // без авторов открывать нечего: заливка сказала «разборов пока нет», кадр вернулся
      else if (end >= SWIPE && voices.length) { onSwiped(); tap('medium'); setSide('voices'); }
    },
  });

  const right = dx > 0;
  const fill = Math.min(1, Math.abs(dx) / SWIPE);
  // баннер не зависит от пальца: пока кадр тянут, перерисовывается только сдвиг и подпись под ним
  const banner = useMemo(() => <WorkBanner work={r.work} meta={meta} tag={tag} onClick={onOpen} priority={no === 1} />, [r.work, meta, tag, onOpen, no]);
  const rest = voices.length - PILE;
  return (
    <article ref={cardRef} className={cx('tm-stream__item', dx !== 0 && 'tm-stream__item--drag', voicesOpen && 'tm-stream__item--voices')}
             {...swipe}>
      {voicesOpen ? (
        // свайп по панели закрывает её (17.10); ленту авторов useSwipe не трогает — она листается сама
        <div className="tm-stream__voices">
          <div className="tm-stream__voiceshead">
            <p className="tm-label tm-stream__voicestitle">{ui.feed.voicesTitle(titleOf(r.work))}</p>
            <Button variant="quiet" size="sm" onClick={() => { tap(); setSide('none'); }}>{ui.feed.voicesBack}</Button>
          </div>
          <VoiceStrip groups={voices} onPick={(id) => { tap(); setSide('none'); onVoice(id); }} />
        </div>
      ) : (
        <span className={cx('tm-stream__hint', right ? 'tm-stream__hint--voices' : 'tm-stream__hint--dismiss',
                            (showing || dropping) && 'tm-stream__hint--on')}
              style={{ '--fill': fill } as CSSProperties} aria-hidden="true">
          {!right ? (trailer === null ? ui.trailer.none : ui.trailer.swipe) : voices.length ? (
            <span className="tm-stream__pile">
              {voices.slice(0, PILE).map((g) => <Avatar key={g.voice.id} voice={g.voice} size="sm" />)}
              {rest > 0 ? <span className="tm-stream__pilemore">+{rest}</span> : null}
            </span>
          ) : ui.feed.noVoices}
        </span>
      )}
      <FilmEdge work={r.work} no={no} />
      <div className="tm-stream__drag" style={dx ? ({ '--swipe-x': `${Math.round(dx * DRAG)}px` } as CSSProperties) : undefined}>
        <InlineTrailer work={r.work} trailer={trailer} place="feed" open={inline} onOpenChange={setInline} button={FEED_PLAY_BUTTON}>
          {banner}
        </InlineTrailer>
      </div>
    </article>
  );
});

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
const reelGoneIdle = Promise.resolve();

/** щелчок кадра (18.10, владелец): палец отпущен — прокрутка (прилипание, инерция) ещё FILM_HAND мс считается его; щелчки
 *  не чаще FILM_GAP; кадры сменяются чаще FILM_FAST — это быстрое листание, щёлкаем раз в FILM_EVERY кадров */
const FILM_HAND = 1200;
const FILM_GAP = 120;
const FILM_FAST = 300;
const FILM_EVERY = 4;

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
  // поиск словами (ДФ-12) с 17.10 — в общем поиске (владелец: для человека «чего хочется» и поиск — одно); старые
  // ссылки на ленту с запросом (`?m=`) ведут туда
  const moodQuery = useMoodQuery();
  const moodOn = false;
  useEffect(() => { if (moodQuery) navigate(`/search?q=${encodeURIComponent(moodQuery)}`, { replace: true }); }, [moodQuery, navigate]);
  // мои подписки (ЗП-42): лента ставит вперёд доступное без доплаты, в мете — «в подписке Okko»
  const subsOn = useFeature('subscriptions');
  const userSettings = useSettings();
  const subs = subsOn ? userSettings?.subscriptions ?? [] : [];
  // «только подписки» — сразу на кнопке (17.10): ответа сервера не ждём, панель выбора открыта и отклик должен быть виден
  const [subsOnlyNow, setSubsOnlyNow] = useState<boolean | undefined>();
  const subsOnly = subsOn && (subsOnlyNow ?? Boolean(userSettings?.subscriptionsOnly));
  // полка бесплатной классики (ЗП-43): место «Бесплатная классика» в ленте
  const freeOn = useFeature('freeClassics');
  const booksOn = useFeature('readShelf');
  // первый вход свайпом (ДФ-2): новому человеку — /start, при 0–4 оценках — общая лента вместо холодного старта
  const swipeOn = useFeature('swipeStart');
  // кино или книги (11.10): что подбирает лента — переключателем рядом с силой, выбор помнят настройки
  const [kind, setKind] = useState<FeedKind>('screen');
  const bookFeed = booksOn && kind === 'book';
  // «Почитать» в конце ленты кино — только пока лента кино; в ленте книг он не нужен
  // картинки и «где смотреть» с сети лента не ждёт (18.10, аудит, волна 2, п. 15): они досылаются (`withPictures`)
  const slateOpts = (k: FeedKind) => ({ general: swipeOn, subscriptions: subsOn, freeClassics: freeOn, books: booksOn && k === 'screen', kind: booksOn ? k : 'screen' as FeedKind, lazyPictures: true });
  /** Досланные картинки — на место тех же рекомендаций: убранное за это время из ленты не возвращается. */
  const withPictures = (items: Recommendation[], alive: () => boolean, done?: (items: Recommendation[]) => void) => {
    if (!items.length) return;
    pictureSlate(items).then((pictured) => {
      if (!alive()) return;
      const byId = new Map(pictured.map((r) => [r.id, r]));
      setSlate((s) => (s ? { ...s, items: s.items.map((r) => byId.get(r.id) ?? r) } : s));
      done?.(pictured);
    }).catch(() => undefined);
  };
  // список просмотренного прямо с пустой ленты (02.10): самый короткий путь к первым рекомендациям
  const [importing, setImporting] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  // заставка-плёнка (16.10): раз за сессию, пока грузится лента. Решаем сразу при входе: редакция приходит
  // с настройками позже, поэтому «эталон ли это» помним с прошлого запуска, а доля выката известна сразу
  const reelOn = useFeature('reel');
  const [reel, setReel] = useState(() => reelWanted() && (reelOn || reelKnown()));
  useEffect(() => { if (reel) reelPlayed(); }, [reel]);
  // свежая лента считается на устройстве и занимает поток — начинаем её, когда заставка погасла (не позже 8 с),
  // иначе плёнка застывает поверх ленты; сохранённой ленты нет — заставку снимаем сразу
  const [reelCancel, setReelCancel] = useState(false);
  const reelEnd = useRef<() => void>(() => undefined);
  const reelGone = useRef<Promise<void>>(reelGoneIdle);
  if (reel && !reelCancel && reelGone.current === reelGoneIdle) {
    reelGone.current = new Promise<void>((done) => { reelEnd.current = done; setTimeout(done, 8000); });
  }
  const reelFinished = () => { reelEnd.current(); setReel(false); };
  const settingsLoaded = userSettings != null;
  useEffect(() => { if (settingsLoaded) reelKnow(reelOn); }, [settingsLoaded, reelOn]);
  const [slate, setSlate] = useState<RecommendationSlate | null>(null);
  // пролетающие кадры заставки — из ленты человека, как только она есть
  const reelWorks = useMemo(() => slate?.items.map((r) => r.work) ?? [], [slate]);
  const [spoilerLevel, setSpoilerLevel] = useState<SpoilerLevel>(0);
  const [finishedIds, setFinishedIds] = useState<Set<string>>(new Set());
  const [archived, setArchived] = useState(0);
  // панель выбора ленты (17.10): открывается повторным нажатием «Сегодня» в нижнем меню (AppShell шлёт tm:tune)
  const [tuning, setTuning] = useState(false);
  useEffect(() => {
    const toggle = () => setTuning((t) => !t);
    window.addEventListener('tm:tune', toggle);
    return () => window.removeEventListener('tm:tune', toggle);
  }, []);
  // настраиваемая лента (ТВ-11): сила — переключателем над лентой, «Ещё фильмы» — в конце
  const [energy, setEnergy] = useState<Energy>('normal');
  // какая кнопка хвоста подбирает: «Ещё фильмы» или «Новинки» — «Подбираем…» на нажатой
  const [moreBusy, setMoreBusy] = useState<false | 'more' | 'fresh'>(false);
  const [moreDone, setMoreDone] = useState(false);
  // «Новинки» (18.10, владелец): сколько новинок под вкус даст следующая порция — приходит с лентой и с каждой порцией,
  // так что кнопка не мигает: нет новинок — её нет сразу. Лента с устройства не в счёт — число могло устареть
  const [freshLeft, setFreshLeft] = useState(0);
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
  // обработчики кадров ленты — одни на весь экран (memo кадра); свежий `learned` — из ссылки
  const learnedNow = useRef(learned);
  learnedNow.current = learned;
  const openFeed = useCallback((r: Recommendation) => { setOpenVoice(undefined); setOpen(r.id); }, []);
  const voiceFeed = useCallback((r: Recommendation, id: string) => { learnedNow.current(); setOpenVoice(id); setOpen(r.id); }, []);
  const swipedFeed = useCallback(() => learnedNow.current(), []);

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
    setFreshLeft(0);
    const first = !booted.current;
    booted.current = true;
    // сохранённая лента показана — свежую начинаем считать, когда нарисовался кадр первого баннера (не позже 2,5 с):
    // справочник иначе отнимает у этого кадра и сеть, и главный поток
    const head: Promise<unknown> = first
      ? lastSlate(kind).then((c) => {
        if (!c) { setReelCancel(true); reelEnd.current(); }
        if (!alive || fresh || !c) return;
        setSlate(c.slate);
        shownIds.current = new Set(c.slate.items.map((r) => r.work.id));
        return Promise.all([firstImage(), reelGone.current]);
      }).catch(() => undefined)
      : Promise.resolve();
    head.then(() => getSettings())
      .then((settings) => Promise.all([getSlate(settings.energy ?? 'normal', undefined, slateOpts(settings.feedKind ?? 'screen')), getJourney(undefined, { active: true }), settings]))
      .then(([nextSlate, journal, settings]) => {
        if (!alive) return;
        fresh = true;
        setSlate(nextSlate);
        saveSlate(settings.feedKind ?? 'screen', nextSlate);
        // с картинками — и в сохранённую ленту следующего запуска
        withPictures(nextSlate.items, () => alive, (items) => saveSlate(settings.feedKind ?? 'screen', { ...nextSlate, items }));
        setEnergy(settings.energy ?? 'normal');
        setKind(settings.feedKind ?? 'screen');
        setMoreDone(false);
        setFreshLeft(nextSlate.fresh ?? 0);
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
  // «Новинки» (18.10, владелец) — та же порция, что «Ещё фильмы», только из вышедшего за последний год: тот же подбор,
  // те же выбор ленты и засветка топами; новинки кончились — кнопка уходит, «Ещё фильмы» остаётся
  const loadMore = (novel = false) => {
    if (!slate || moreBusy) return;
    tap();
    if (novel) noteNovelties(kind, freshLeft);
    setMoreBusy(novel ? 'fresh' : 'more');
    getSlate(energy, [...shownIds.current], { ...slateOpts(kind), fresh: novel })
      .then((next) => {
        const fresh = next.items.filter((r) => !shownIds.current.has(r.work.id));
        fresh.forEach((r) => shownIds.current.add(r.work.id));
        if (!fresh.length && !novel) setMoreDone(true);
        setFreshLeft(next.fresh ?? 0);
        setSlate((s) => (s ? { ...s, items: [...s.items, ...fresh] } : s));
        withPictures(fresh, () => true);
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
      <Button variant={big ? 'primary' : 'secondary'} size="sm" onClick={() => { tap(); navigate(`/journal/${e.id}/check-in?finish=1`); }}>
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
  // Щелчок кадра (18.10, владелец): лента — плёнка; следующий кадр встаёт в окно — телефон чуть щёлкает (selection, без
  // звука). Линия кадрового окна — полоска на 15% высоты ленты сверху: кадр прилипает верхом к верху ленты, и щелчок
  // приходит чуть раньше, чем он встал, — как перескок плёнки в фильмовом канале. Только от пальца или колеса: прокрутка
  // к архиву и первый показ молчат. Не чаще FILM_GAP; кадры сменяются чаще FILM_FAST (быстрое листание) — щелчок раз
  // в FILM_EVERY кадров, а не на каждый. Пока кадр тянут вбок или в ленте играет трейлер — молчим: там свои отклики.
  // Конец плёнки — хвост с «Ещё фильмы» — один толчок заметнее (impact medium), следующий — после новой порции.
  // Вне Telegram pick/tap ничего не делают
  const film = useRef({ touch: false, input: 0, last: 0, cross: 0, run: 0, tail: null as Set<string> | null, tailN: 0 });
  useEffect(() => {
    const main = mainRef.current;
    if (!main || !slate?.items.length || typeof IntersectionObserver === 'undefined') return;
    const f = film.current;
    const now = () => performance.now();
    const quiet = () => !(f.touch || now() - f.input < FILM_HAND) || main.querySelector('.tm-stream__item--drag, .tm-itrailer--open') != null;
    // первую запись наблюдателя о каждом кадре (как он лежит при показе) пропускаем
    const known = new WeakSet<Element>();
    const again = (e: IntersectionObserverEntry) => known.has(e.target) || !known.add(e.target);
    const frames = new IntersectionObserver((list) => {
      for (const e of list) {
        if (!again(e) || !e.isIntersecting || quiet()) continue;
        const t = now();
        f.run = t - f.cross < FILM_FAST ? f.run + 1 : 0;
        f.cross = t;
        if (t - f.last < FILM_GAP || f.run % FILM_EVERY) continue;
        f.last = t;
        pick();
      }
    }, { root: main, rootMargin: '-15% 0px -84% 0px' });
    const end = new IntersectionObserver((list) => {
      const portion = shownIds.current;
      if (!list.some((e) => again(e) && e.isIntersecting) || quiet() || (f.tail === portion && f.tailN === portion.size)) return;
      f.tail = portion;
      f.tailN = portion.size;
      f.last = now();
      tap('medium');
    }, { root: main, threshold: 0.5 });
    main.querySelectorAll('.tm-filmstrip > .tm-stream__item').forEach((el) => frames.observe(el));
    const tail = main.querySelector('.tm-filmstrip__tail');
    if (tail) end.observe(tail);
    // палец на ленте или только что был (колесо — то же)
    const down = () => { f.touch = true; f.input = now(); };
    const up = () => { f.touch = false; f.input = now(); };
    const wheel = () => { f.input = now(); };
    const opts = { passive: true };
    main.addEventListener('touchstart', down, opts);
    main.addEventListener('touchend', up, opts);
    main.addEventListener('touchcancel', up, opts);
    main.addEventListener('wheel', wheel, opts);
    return () => {
      frames.disconnect();
      end.disconnect();
      main.removeEventListener('touchstart', down);
      main.removeEventListener('touchend', up);
      main.removeEventListener('touchcancel', up);
      main.removeEventListener('wheel', wheel);
    };
  }, [slate, shownCurrent.length]);
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
    const next = !subsOnly;
    setSubsOnlyNow(next);
    saveSettings({ subscriptionsOnly: next }).then(() => setAttempt((a) => a + 1))
      .catch(() => toast({ text: ui.settings.errorSave }))
      .finally(() => setSubsOnlyNow(undefined));
  };
  // пока лента пересчитывается после выбора, панель не прячем (17.10): выбор применён, а она открыта до касания вне её
  const choiceWas = useRef(false);
  const showChoice = slate
    // пустая лента после выбора сложности не прячет панель (17.10): иначе вернуть сложность негде
    ? Boolean(!slate.coldStart && (items.length || current.length || subsOnly || bookFeed || energy !== 'normal' || choiceWas.current) && (energyOn || subs.length || booksOn))
    : choiceWas.current && !failed;
  choiceWas.current = showChoice;
  // панель встаёт ровно над нижним меню, какой бы высоты оно ни было (безопасная зона Telegram, крупный шрифт)
  const navTop = () => { const nav = document.querySelector('.tm-nav--mobile'); return nav ? Math.max(0, window.innerHeight - nav.getBoundingClientRect().top) : 0; };
  // стрелка на «Сегодня» в нижнем меню — только когда выбирать есть что
  useEffect(() => {
    document.documentElement.toggleAttribute('data-tune', showChoice);
    return () => document.documentElement.removeAttribute('data-tune');
  }, [showChoice]);
  useEffect(() => { if (!showChoice) setTuning(false); }, [showChoice]);
  // хвост ленты (17.10): одно приглашение за запуск, по очереди
  const invites = [
    together ? { id: 'together', lead: ui.together.entry, action: ui.together.entryAction, go: () => navigate('/together') } : null,
    collections ? { id: 'collections', lead: ui.collections.entry, action: ui.collections.entryAction, go: () => navigate('/collections') } : null,
    { id: 'share', lead: ui.today.shareLead, action: ui.social.share, go: () => { noteShare('friend', 'telegram'); openExternal(shareUrl(ui.social.shareText)); } },
  ].filter((x) => x != null);
  const invite = invites[tailTurnNow() % invites.length];
  // вопрос «посмотрели?» стоит под баннером — в мете его не повторяем
  const entryMeta = (e: JourneyEntryData) =>
    [e.work.year, leadName(e.work), e.progress != null ? `${Math.round(e.progress * 100)}%` : null].filter(Boolean).join(' · ');
  return (
    <main className="tm-shell__main tm-stream" ref={mainRef}>
      {reel ? <FilmReel works={reelWorks} ready={Boolean(slate) || Boolean(failed)} cancel={reelCancel} column={mainRef} onDone={reelFinished} /> : null}
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
            {/* норма барабаном (17.10) вместо ряда из шести кнопок: начинается с медианы истории, одно нажатие — она */}
            <div className="tm-row tm-row--gap-2 tm-import__normrow">
              <RatingWheel<number> label={ui.today.normTitle} labels={scale.options.map(String)}
                           start={Math.max(0, scale.options.indexOf(scale.median)) + 1}
                           onPick={(i) => answerScale(scale.options[i - 1])} />
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
          // одна строка (17.10) и своя точка привязки прокрутки: иначе обязательная привязка откатывала ленту к архиву
          <div className="tm-stream__swipehint" role="note">
            <span className="tm-caption">{ui.feed.swipeHint}</span>
            <Button variant="quiet" size="sm" onClick={() => { tap(); learned(); }}>{ui.feed.swipeHintOk}</Button>
          </div>
        ) : null}
        {!moodOn && (shownCurrent.length || items.length) ? <div className="tm-filmstrip">
        {/* Что смотрите сейчас — первым: чек-ин после просмотра кормит подбор, прятать его в архив нельзя */}
        {shownCurrent.map((e, i) => (
          <article key={e.id} className={cx('tm-stream__item', 'tm-stream__item--current')}>
            <FilmEdge work={e.work} no={i + 1} short />
            <WorkBanner work={e.work} size="sm" tag={ui.feed.watching} meta={entryMeta(e)} onClick={() => setOpen(e.id)} />
            {/* «посмотрели?» — внутри карточки (угол шторки, 16.10, владелец): в ленте блок «Сейчас» — один баннер */}
          </article>
        ))}
        {items.map((r, i) => (
          <FeedCard key={r.id} r={r} no={shownCurrent.length + i + 1} meta={recMeta(r)} tag={mechanics || r.slot === 'universe' || r.slot === 'free' || r.slot === 'book' ? ui.slot[r.slot].label : undefined}
                    onOpen={openFeed} onVoice={voiceFeed} onSwiped={swipedFeed} />
        ))}
        {/* хвост под подборкой — «Ещё фильмы» и приглашения — на той же плёнке (17.10, владелец): дорожка не обрывается */}
        <div className="tm-filmstrip__tail">
        {!moodOn && items.length && slate && !slate.coldStart ? (
          <div className="tm-stream__pad tm-stream__more">
            {moreDone
              ? <p className="tm-caption">{bookFeed ? ui.feed.moreNoneBooks : ui.feed.moreNone}</p>
              : <Button variant="secondary" onClick={() => loadMore()} disabled={Boolean(moreBusy)}>{moreBusy === 'more' ? ui.feed.moreLoading : bookFeed ? ui.feed.moreBooks : ui.feed.moreFilms}</Button>}
            {/* «Новинки» рядом (18.10, владелец): одной строкой с «Ещё фильмы»; пометки «новинка» на карточках нет — год и так
                первым в мете, а порция идёт сразу за нажатием */}
            {freshLeft > 0 ? (
              <Button variant="secondary" onClick={() => loadMore(true)} disabled={Boolean(moreBusy)}>{moreBusy === 'fresh' ? ui.feed.moreLoading : ui.feed.novelties[bookFeed ? 'book' : 'screen']}</Button>
            ) : null}
          </div>
        ) : null}
        {/* приглашения под лентой (17.10): одно за раз, по очереди между запусками — три подряд загромождали хвост.
            «Вместе» (ЗП-11): тот, кто долистал, — кандидат собрать вечер на двоих и больше; подборки (ЗП-45, шаг 2) —
            пойти вглубь по стране или школе; позвать друга — тихо: тот, кто долистал, лентой доволен (02.10) */}
        {!moodOn && invite && items.length && slate && !slate.coldStart ? (
          <p className="tm-caption tm-stream__pad tm-coldstart__share">
            {invite.lead}{' '}
            <button type="button" className="tm-coldstart__link" onClick={() => { tap(); invite.go(); }}>{invite.action}</button>
          </p>
        ) : null}
        </div>
        </div> : null}
      </div>

      {/* выбор ленты — кино или книги, сложность, «только подписки» (17.10, владелец): по кнопке нижнего меню — повторное
          нажатие «Сегодня» открывает панель над меню; ленту она не занимает. Архив — наверху, как в главной Telegram */}
      {tuning && showChoice ? (
        <>
          <button type="button" className="tm-tune__scrim" aria-label={ui.actions.close} onClick={() => setTuning(false)} />
          {/* не закрывается после выбора (17.10): выбор применяется сразу, лента пересчитывается под панелью — полоска
              сверху панели идёт, пока новой ленты нет; закрыть — касанием вне её или ещё раз «Сегодня» */}
          <div className="tm-tune" role="dialog" aria-label={ui.feed.tune} aria-busy={slate ? undefined : 'true'} style={{ bottom: navTop() }}>
            <div className="tm-stream__energy">
              {booksOn ? <FeedKindSwitch value={kind} onChange={changeKind} /> : null}
              {energyOn ? <EnergySwitch value={energy} onChange={changeEnergy} compact /> : null}
            </div>
            {subs.length && !bookFeed ? <Button variant="quiet" size="sm" pressed={subsOnly} onClick={toggleSubsOnly}>{ui.feed.subsOnly}</Button> : null}
          </div>
        </>
      ) : null}

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
                 plot={openRec ? recWhat(openRec) : undefined} context="лента: рекомендация" hurdles={!finishedIds.has(openRec?.work.id ?? '')}>
        {openRec ? (
          <Panel r={openRec} spoilerLevel={spoilerLevel} finished={finishedIds.has(openRec.work.id)} voiceId={openVoice}
                 onSave={() => save(openRec)} onSeen={() => seen(openRec)} onDismiss={(reason) => dismiss(openRec, reason)} onWatch={() => watchFrom(openRec)} />
        ) : null}
      </WorkSheet>
    </main>
  );
}
