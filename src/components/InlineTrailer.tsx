import { useEffect, useLayoutEffect, useReducer, useRef, useState, type ReactNode, type RefObject } from 'react';
import type { ID, WorkCard } from '@/types/tmdf';
import { getTrailer, noteTrailer, noteTrailerPlayback, peekTrailer, watchTrailer, type Trailer } from '@/api';
import { openExternal, tap } from '@/lib/telegram';
import { imageSrc } from '@/lib/images';
import { titleOf } from '@/lib/format';
import { cx } from '@/lib/cx';
import ui, { language } from '@/i18n';

/** куда шлём команды плееру (18.10, проверка перед выкладкой: не '*') — тот же хост, что в src iframe */
const YT_ORIGIN = 'https://www.youtube-nocookie.com';

/** Трейлер работы, когда он известен: ролик, null — точно нет, undefined — ещё не знаем (кнопки ▶ нет, ничего не мигает).
 *  `near` — элемент, к подъезду которого к экрану (300 px) спросить; без него — спросить сразу. Сами запросы копит и
 *  пачкует api (getTrailer), ответ — на сеанс. */
export function useTrailer(work: WorkCard | null | undefined, near?: RefObject<Element | null>): Trailer | null | undefined {
  const [, bump] = useReducer((n: number) => n + 1, 0);
  useEffect(() => (work ? watchTrailer(work, bump) : undefined), [work]);
  const known = work ? peekTrailer(work) : null;
  const unknown = known === undefined;
  useEffect(() => {
    if (!work || !unknown) return;
    const el = near?.current;
    if (!near || !el || typeof IntersectionObserver === 'undefined') { getTrailer(work).catch(() => undefined); return; }
    const io = new IntersectionObserver((seen) => {
      if (seen.some((x) => x.isIntersecting)) { io.disconnect(); getTrailer(work).catch(() => undefined); }
    }, { root: scrollRoot(el), rootMargin: '300px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [work, unknown]);
  return known;
}

/** Ближайший прокручиваемый предок: лента листается в своём блоке (.tm-stream), а не в документе, и запас rootMargin
 *  у наблюдателя с корнем-окном срезался бы краем ленты — карточка за краем блока считалась бы «далеко» сразу. */
function scrollRoot(el: Element): Element | null {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const y = getComputedStyle(p).overflowY;
    if ((y === 'auto' || y === 'scroll') && p.scrollHeight > p.clientHeight) return p;
  }
  return null;
}

/** Играет один ролик на всё приложение: запуск другого закрывает прежний (17.10). Карточка поверх ленты закрывает ролик
 *  ленты сама (stopInlineTrailer), иначе звук шёл бы из-под шторки. */
let active: { id: number; stop: () => void } | undefined;
let seq = 0;
export function stopInlineTrailer(): void { active?.stop(); }

const reduced = (): boolean => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
/** высота кадра меняется за столько — в такт с проявлением плеера */
const GROW_MS = 280;
/** не заиграл за столько — `trailer_stall` и подсказка «открыть в YouTube» (17.10, владелец) */
const STALL_MS = 8000;

export interface InlineTrailerProps {
  work: WorkCard;
  /** ролик; null/undefined — кнопки ▶ нет */
  trailer: Trailer | null | undefined;
  /** место для замера: 'feed' — лента, 'card' — карточка */
  place: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** у какого края кнопки «YouTube» и «×»: в карточке правый верх занят её «⋯» и «×» — там ролик закрывает «Свернуть»,
   *  чтобы два «×» рядом не путали, какой закрывает карточку */
  controls?: 'start' | 'end';
  /** ▶ на кадре; в ленте его нет (17.10, владелец: «без показа трейлера по свайпу лента станет лентой трейлеров») —
   *  там ролик запускает только смахивание влево */
  button?: boolean;
  /** баннер: он же постер, пока плеер грузится */
  children: ReactNode;
}

/** Трейлер на месте баннера (17.10, владелец: «должно быть максимально круто»): без автозапуска — по ▶ в центре кадра
 *  (карточка) или смахиванием влево (лента, там ▶ нет). Запуск — баннер плавно становится плеером 16:9 (если кадр был другой высоты — высота доезжает, лента не прыгает),
 *  пока YouTube грузится, виден тот же кадр, потом плеер мягко проявляется. Плеер — youtube-nocookie без iframe_api:
 *  состояние слушаем по postMessage («listening» → onReady / infoDelivery / onStateChange). Ушёл с экрана (видно < 30 %)
 *  — пауза, вернулся — играет дальше; ушёл далеко — плеер убираем, возвращается баннер. Автозапуск со звуком запрещён
 *  (iOS) — у плеера своя кнопка, это нормально. */
export function InlineTrailer({ work, trailer, place, open, onOpenChange, controls = 'end', button = true, children }: InlineTrailerProps) {
  const box = useRef<HTMLDivElement>(null);
  const poster = useRef<HTMLDivElement>(null);
  // idle — баннер; open — плеер; closing — плеер ушёл, высота возвращается к баннеру
  const [phase, setPhase] = useState<'idle' | 'open' | 'closing'>('idle');
  const from = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const close = useRef(onOpenChange);
  close.current = onOpenChange;
  const live = open && trailer != null;
  // начальная высота — до смены класса: у открытого 16:9, у баннера своя
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    if (live && phase !== 'open') { from.current = el.offsetHeight; setPhase('open'); }
    else if (!live && phase === 'open') { from.current = el.offsetHeight; setPhase('closing'); }
  }, [live]);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el || phase === 'idle') return;
    clearTimeout(timer.current);
    el.style.transition = '';
    el.style.height = '';
    const to = phase === 'open' ? el.offsetHeight : poster.current?.offsetHeight ?? el.offsetHeight;
    const done = () => { el.style.transition = ''; el.style.height = ''; if (phase === 'closing') setPhase('idle'); };
    if (reduced() || Math.abs(to - from.current) < 2) { if (phase === 'closing') timer.current = setTimeout(done, reduced() ? 0 : 180); return; }
    el.style.height = `${from.current}px`;
    void el.offsetHeight;
    el.style.transition = `height ${GROW_MS}ms cubic-bezier(.2, .8, .2, 1)`;
    el.style.height = `${to}px`;
    timer.current = setTimeout(done, GROW_MS + 20);
  }, [phase]);
  useEffect(() => () => clearTimeout(timer.current), []);
  // один ролик на всё приложение; запуск — в воронку
  useEffect(() => {
    if (phase !== 'open') return;
    const me = { id: ++seq, stop: () => close.current(false) };
    if (active && active.id !== me.id) active.stop();
    active = me;
    noteTrailer(work.id, place);
    return () => { if (active === me) active = undefined; };
  }, [phase === 'open']);

  const start = () => { tap(); onOpenChange(true); };
  const shown = phase !== 'idle' && trailer != null;
  const withPlay = !shown && trailer != null && button;
  // ▶ не налезает на название баннера (17.10, сквозная проверка: на 320 px название в две строки, да ещё с пометкой над
  // ним, доходило до кнопки): центр — на 42 % высоты, но не ниже чем за 8 px до текста баннера и не выше края кадра
  const play = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => {
    const btn = play.current;
    const el = poster.current;
    if (!btn || !el) return;
    const fit = () => {
      const text = el.querySelector('.tm-banner__text');
      const h = el.offsetHeight;
      if (!text || !h) { btn.style.top = ''; return; }
      const r = btn.offsetHeight / 2;
      const textTop = text.getBoundingClientRect().top - el.getBoundingClientRect().top;
      btn.style.top = `${Math.round(Math.max(r + 6, Math.min(h * 0.42, textTop - 8 - r)))}px`;
    };
    // без замера в самой отрисовке (волна 3В): синхронный getBoundingClientRect посреди открытия шторки заставлял браузер
    // раскладывать её всю лишний раз — ~100 мс на слабом телефоне. Первый отклик ResizeObserver приходит в том же кадре
    // до отрисовки, кнопка встаёт на место без скачка
    if (typeof ResizeObserver === 'undefined') { fit(); return; }
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [withPlay]);
  return (
    <div ref={box} className={cx('tm-itrailer', shown && 'tm-itrailer--open', phase === 'closing' && 'tm-itrailer--closing')}>
      <div ref={poster} className="tm-itrailer__poster" inert={shown ? true : undefined}>{children}</div>
      {withPlay ? (
        <button ref={play} type="button" className="tm-itrailer__play" aria-label={ui.trailer.play(titleOf(work))} data-noswipe onClick={start}>
          <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.2-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" fill="currentColor" /></svg>
        </button>
      ) : null}
      {shown ? (
        <Player key={trailer.key} work={work} trailer={trailer} place={place} controls={controls} gone={phase === 'closing'}
                onClose={() => close.current(false)} />
      ) : null}
    </div>
  );
}

type YtMessage = { event?: string; info?: unknown };

/** Плеер YouTube без iframe_api (18.10: общий у трейлера на кадре и у шторки поиска TrailerSheet — раньше шторка слала
 *  только `trailer`, без замера доступности): youtube-nocookie, состояние — по postMessage («listening» → onReady /
 *  infoDelivery / onStateChange). Заиграл впервые — `trailer_play` (мс до первого кадра); за STALL_MS не заиграл —
 *  `trailer_stall` (последнее состояние) и `stalled`: под ним подсказка «Не грузится? Открыть в YouTube». Без workId
 *  замера нет. Состояние — на один ролик: смена ролика — новый плеер (key={trailer.key}). */
export function useYouTubePlayer(workId: ID | undefined, trailer: Trailer, place: string) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [id] = useState(() => ++seq);
  // ready — плеер ответил (постер можно убирать); playing — идёт; stalled — 8 с без воспроизведения
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [stalled, setStalled] = useState(false);
  const state = useRef<number | undefined>(undefined);
  const played = useRef(false);
  const startedAt = useRef(Date.now());
  const knock = useRef<ReturnType<typeof setTimeout>>(undefined);
  const fallback = useRef<ReturnType<typeof setTimeout>>(undefined);
  const post = (msg: Record<string, unknown>) => {
    try { frame.current?.contentWindow?.postMessage(JSON.stringify({ ...msg, id, channel: 'widget' }), YT_ORIGIN); } catch { /* плеер ещё не встал */ }
  };
  const command = (func: string, args: unknown[] = []) => post({ event: 'command', func, args });

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (!frame.current || e.source !== frame.current.contentWindow) return;
      let d: YtMessage;
      try { d = (typeof e.data === 'string' ? JSON.parse(e.data) : e.data) as YtMessage; } catch { return; }
      if (!d || typeof d !== 'object') return;
      if (d.event === 'onReady' || d.event === 'initialDelivery') setReady(true);
      const s = d.event === 'onStateChange' ? d.info
        : d.event === 'infoDelivery' || d.event === 'initialDelivery' ? (d.info as { playerState?: unknown } | undefined)?.playerState : undefined;
      if (typeof s !== 'number') return;
      setReady(true);
      state.current = s;
      if (s === 1) {
        setPlaying(true);
        setStalled(false);
        if (!played.current) {
          played.current = true;
          if (workId != null) noteTrailerPlayback('trailer_play', workId, place, `${trailer.key}:${Date.now() - startedAt.current}`);
        }
      } else if (s === 0 || s === 2) setPlaying(false);
    };
    window.addEventListener('message', onMessage);
    const stall = setTimeout(() => {
      if (played.current) return;
      const s = state.current;
      if (workId != null) noteTrailerPlayback('trailer_stall', workId, place, `${trailer.key}:${s ?? 'none'}`);
      // -1/5 — плеер встал и ждёт нажатия (автозапуск запрещён), 2 — поставили на паузу: это не «не грузится»
      if (s !== -1 && s !== 5 && s !== 2) setStalled(true);
    }, STALL_MS);
    return () => { window.removeEventListener('message', onMessage); clearTimeout(stall); clearTimeout(knock.current); clearTimeout(fallback.current); };
  }, []);

  const onLoad = () => {
    let n = 0;
    const again = () => {
      if (state.current !== undefined || n++ > 24) return;
      post({ event: 'listening' });
      command('addEventListener', ['onStateChange']);
      knock.current = setTimeout(again, 250);
    };
    again();
    // запасной ход: плеер так и не ответил по postMessage — всё равно снять постер через 3 с после загрузки
    fallback.current = setTimeout(() => setReady(true), 3000);
  };

  const toYouTube = () => { tap(); command('pauseVideo'); openExternal(`https://www.youtube.com/watch?v=${trailer.key}`); };
  const src = `https://www.youtube-nocookie.com/embed/${trailer.key}?autoplay=1&playsinline=1&rel=0&modestbranding=1&enablejsapi=1`
    + `&hl=${language}&origin=${encodeURIComponent(location.origin)}`;
  // плеер за 8 с так и не ответил (YouTube закрыт, 17.10, сквозная проверка): под подсказкой — снова кадр фильма, а не
  // серая страница ошибки браузера, которую открыл запасной ход «снять постер через 3 с»
  const dead = stalled && state.current === undefined;
  return { frame, src, onLoad, ready, playing, stalled, dead, state, command, toYouTube };
}

function Player({ work, trailer, place, controls, gone, onClose }: {
  work: WorkCard; trailer: Trailer; place: string; controls: 'start' | 'end'; gone: boolean; onClose: () => void;
}) {
  const layer = useRef<HTMLDivElement>(null);
  const { frame, src, onLoad, ready, playing, stalled, dead, state, command, toYouTube } = useYouTubePlayer(work.id, trailer, place);
  const autoPaused = useRef(false);

  // ушёл с экрана — пауза, вернулся — дальше (если ставили мы); ушёл дальше полуэкрана за край — баннер обратно
  useEffect(() => {
    const el = layer.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const near = new IntersectionObserver((seen) => {
      const ratio = seen[seen.length - 1]?.intersectionRatio ?? 0;
      if (ratio < 0.3 && state.current === 1) { autoPaused.current = true; command('pauseVideo'); }
      else if (ratio >= 0.3 && autoPaused.current) { autoPaused.current = false; command('playVideo'); }
    }, { threshold: [0, 0.3, 0.6] });
    const far = new IntersectionObserver((seen) => { if (seen.every((x) => !x.isIntersecting)) onClose(); },
      { root: scrollRoot(el), rootMargin: '50% 0px' });
    near.observe(el);
    far.observe(el);
    const hidden = () => { if (document.hidden && state.current === 1) { autoPaused.current = true; command('pauseVideo'); } };
    document.addEventListener('visibilitychange', hidden);
    return () => { near.disconnect(); far.disconnect(); document.removeEventListener('visibilitychange', hidden); };
  }, []);

  const still = imageSrc(work.stillUrl ?? work.coverUrl, 'w780');
  const tags = [ui.trailer.lang[trailer.lang], trailer.teaser ? ui.trailer.teaser : undefined].filter(Boolean).join(' · ');
  return (
    <div ref={layer} className={cx('tm-itrailer__layer', ready && !dead && 'tm-itrailer__layer--ready', playing && 'tm-itrailer__layer--playing', gone && 'tm-itrailer__layer--gone')}
         role="region" aria-label={ui.trailer.player(titleOf(work))} data-noswipe>
      {still ? <img className="tm-itrailer__still" src={still} alt="" decoding="async" /> : null}
      {gone ? null : (
        <iframe ref={frame} className="tm-itrailer__frame" src={src} title={trailer.name || ui.trailer.player(titleOf(work))} onLoad={onLoad}
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
      )}
      {ready || gone || stalled ? null : <span className="tm-itrailer__spin" role="status" aria-label={ui.trailer.loading} />}
      {(trailer.name || tags) && !playing && !gone ? (
        <span className="tm-itrailer__caption" aria-hidden={ready ? 'true' : undefined}>
          {trailer.name ? <span className="tm-itrailer__name">{trailer.name}</span> : null}
          {tags ? <span className="tm-itrailer__tags">{tags}</span> : null}
        </span>
      ) : null}
      {stalled && !playing && !gone ? (
        <button type="button" className="tm-itrailer__stall" onClick={toYouTube}>{ui.trailer.stall}</button>
      ) : null}
      {gone ? null : (
        <span className={cx('tm-itrailer__bar', controls === 'start' && 'tm-itrailer__bar--start')}>
          <button type="button" className="tm-itrailer__btn tm-itrailer__btn--yt" aria-label={ui.trailer.youtubeLabel} onClick={toYouTube}>
            {ui.trailer.youtubeShort}
            <svg aria-hidden="true" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17 17 7" /><path d="M8 7h9v9" /></svg>
          </button>
          {controls === 'start' ? (
            <button type="button" className="tm-itrailer__btn" aria-label={ui.trailer.close} onClick={() => { tap(); onClose(); }}>{ui.trailer.hide}</button>
          ) : (
            <button type="button" className="tm-itrailer__btn tm-itrailer__btn--x" aria-label={ui.trailer.close} onClick={() => { tap(); onClose(); }}>
              <span aria-hidden="true">×</span>
            </button>
          )}
        </span>
      )}
    </div>
  );
}

/** Маленький ▶ у строки поиска (17.10): поверх миниатюры, только когда трейлер точно есть; ролик — в шторке TrailerSheet.
 *  Слот над миниатюрой есть всегда: по нему видно, что строка подъезжает к экрану, — тогда и спрашиваем. */
export function TrailerChip({ work, onPlay }: { work: WorkCard; onPlay: (t: Trailer) => void }) {
  const slot = useRef<HTMLSpanElement>(null);
  const trailer = useTrailer(work, slot);
  return (
    <span ref={slot} className="tm-search__trailerslot">
      {trailer ? (
        <button type="button" className="tm-search__trailer" aria-label={ui.trailer.play(titleOf(work))}
                onClick={() => { tap(); onPlay(trailer); }}>
          <span className="tm-search__trailerdot" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="12" height="12"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.2-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" fill="currentColor" /></svg>
          </span>
        </button>
      ) : null}
    </span>
  );
}
