import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { WorkCard } from '@/types/tmdf';
import { imageSrc } from '@/lib/images';
import { isSeries } from '@/lib/media';
import ui from '@/i18n';

/** Заставка-плёнка «Сегодня» (16.10, флаг `reel`): пока лента загружается, по экрану бежит плёнка с кадрами
 *  фильмов — сначала из запаса, потом из самой ленты человека. Когда лента нарисована, плёнка тормозит и встаёт
 *  ровно на её первых карточках: последний отрезок плёнки — копии карточек, снятые с экрана под заставкой, а шаг и
 *  фаза перфорации — те же, что у дорожки `.tm-filmstrip` (26 px, вырезы 8×6 через 14). Поэтому, когда заставка
 *  гаснет, под ней оказывается то же самое — кадры становятся лентой без скачка. Касание пропускает. */
export interface FilmReelProps {
  /** фильмы для пролетающих кадров — лента человека, как только она есть */
  works: WorkCard[];
  /** лента нарисована — можно тормозить */
  ready: boolean;
  /** сохранённой ленты нет — заставку снять сразу: свежая считается на устройстве и заняла бы поток, плёнка бы застыла */
  cancel?: boolean;
  /** колонка, в которой лежит лента: по ней ширина заставки, в ней ищем карточки */
  column: React.RefObject<HTMLElement | null>;
  onDone: () => void;
}

const P = 14;              // шаг перфорации, как у .tm-filmstrip
const TRACK = 26;          // ширина дорожки
const FPS = 24;            // положение меняется ступенями, как кадры в проекторе
const ACCEL = 0.25;        // разгон, с
const MIN_RUN = 0.6;       // меньше — плёнка мелькнёт, а не пробежит
const MAX_WAIT = 6;        // лента так и не нарисовалась — встаём на том, что есть
const HOLD = 300;          // стоит, прежде чем погаснуть, мс
const FADE = 400;
// запас на первые доли секунды, пока сохранённой ленты ещё нет: кадры стартовой колоды (TMDb)
const SPARE = [
  ['/w5IDXtifKntw0ajv2co7jFlTQDM.jpg', 1968], ['/9UAcMhSCDJ2OCo5QdPpSERjhMA1.jpg', 1975], ['/6oaL4DP75yABrd5EbC4H2zq5ghc.jpg', 2001],
  ['/zi2oYYNSSv7t44iSt5YrxHX9PYs.jpg', 2015], ['/75nSb1fbWooipwcSU5bUttiOriI.jpg', 2023], ['/AmR3JG1VQVxU8TfAvljUhfSFUOx.jpg', 1979],
] as const;

type Frame = { src?: string; edge: string };
const spare = (i: number): Frame => {
  const [path, year] = SPARE[i % SPARE.length];
  // через imageSrc: где TMDb закрыт, картинки идут своим сервером (/img/tmdb), как у ленты
  return { src: imageSrc(`https://image.tmdb.org/t/p/w342${path}`, 'w342'), edge: `${ui.edge.film} · ${year}` };
};
const fromWork = (w: WorkCard): Frame => ({
  src: imageSrc(w.stillUrl, 'w342'),
  edge: [isSeries(w) ? ui.edge.series : ui.edge.film, w.year].filter(Boolean).join(' · '),
});
const mod = (a: number, n: number) => ((a % n) + n) % n;

export function FilmReel({ works, ready, cancel, column, onDone }: FilmReelProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const live = useRef({ works, ready, cancel, onDone });
  live.current = { works, ready, cancel, onDone };

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const box = column.current?.getBoundingClientRect();
    const left = box?.left ?? 0;
    const width = box?.width ?? window.innerWidth;
    const vh = window.innerHeight;
    root.style.left = `${left}px`;
    root.style.width = `${width}px`;
    const tracks = [...root.querySelectorAll<HTMLElement>('.tm-reel__track')];
    const film = root.querySelector<HTMLElement>('.tm-reel__film')!;
    const land = root.querySelector<HTMLElement>('.tm-reel__land')!;

    // кадр 16:9 по ширине между дорожками + межкадровая полоска, высота — кратна шагу
    const cell = Math.max(8, Math.round(((width - 2 * TRACK) * 9 / 16 + 2) / P)) * P;
    const V = 2.5 * vh; // ровный ход — два с половиной экрана в секунду: торможение на экран с кадром — меньше секунды
    // пул кадров: видны не больше чем ceil(vh / cell) + 1 одновременно
    const pool = Array.from({ length: Math.ceil(vh / cell) + 2 }, () => {
      const el = document.createElement('div');
      el.className = 'tm-reel__frame';
      el.style.height = `${cell - 2}px`;
      const img = document.createElement('img');
      img.alt = '';
      img.decoding = 'async';
      img.onerror = () => { img.removeAttribute('src'); };
      const edge = document.createElement('span');
      edge.className = 'tm-edge';
      const text = document.createElement('span');
      edge.appendChild(text);
      el.append(img, edge);
      film.appendChild(el);
      return { el, img, text, i: -1 };
    });
    const frames: Frame[] = [];
    const frameAt = (i: number): Frame => {
      // кадр, однажды показанный, не меняется; новые — из ленты человека, пока её нет — из запаса
      while (frames.length <= i) {
        const pool = live.current.works.filter((w) => w.stillUrl);
        frames.push(pool.length ? fromWork(pool[frames.length % pool.length]) : spare(frames.length));
      }
      return frames[i];
    };

    let t0 = 0, raf = 0, ended = false;
    let brake: { t: number; x: number; end: number; dur: number } | null = null;
    const timers: number[] = [];

    // встать на ленте: снять с экрана видимые карточки, положить их копии в конец плёнки и рассчитать торможение
    const decide = (t: number, x: number) => {
      const strip = column.current?.querySelector<HTMLElement>('.tm-filmstrip');
      const top = strip ? strip.getBoundingClientRect().top : 0;
      // конец пути — не ближе экрана и кадра (что уже видно, не подменяется) и в фазе с дорожкой ленты
      let end = Math.ceil(x + vh + cell);
      end += mod(-top - end, P);
      if (strip) {
        for (const item of strip.querySelectorAll<HTMLElement>(':scope > *')) {
          const r = item.getBoundingClientRect();
          if (r.bottom <= 0 || r.top >= vh) continue;
          const copy = item.cloneNode(true) as HTMLElement;
          copy.querySelectorAll('img').forEach((img) => { img.loading = 'eager'; });
          copy.style.cssText = `position:absolute;left:${r.left - left}px;top:${end + r.top}px;width:${r.width}px;margin:0`;
          land.appendChild(copy);
        }
      }
      return { t, x, end, dur: (2 * (end - x)) / V };
    };
    const finish = (fast = false) => {
      if (ended) return;
      ended = true;
      cancelAnimationFrame(raf);
      timers.push(window.setTimeout(() => {
        root.classList.add('is-done');
        timers.push(window.setTimeout(() => live.current.onDone(), FADE));
      }, fast ? 0 : HOLD));
    };
    const paint = (x: number) => {
      for (const tr of tracks) tr.style.backgroundPositionY = `${4 - mod(x, P)}px`;
      land.style.transform = `translate3d(0, ${-x}px, 0)`;
      const first = Math.floor(x / cell);
      for (let i = first; i <= Math.floor((x + vh) / cell); i++) {
        const slot = pool[mod(i, pool.length)];
        // пролетающие кадры кончаются там, где начинается лента
        const hidden = brake ? (i + 1) * cell > brake.end : false;
        if (slot.i !== i) {
          slot.i = i;
          const f = frameAt(i);
          if (f.src) slot.img.src = f.src; else slot.img.removeAttribute('src');
          slot.text.textContent = f.edge;
        }
        slot.el.style.visibility = hidden ? 'hidden' : '';
        slot.el.style.transform = `translate3d(0, ${i * cell - x}px, 0)`;
      }
    };
    const tick = (now: number) => {
      try { step(now); } catch { finish(true); } // ошибка в кадре не должна оставить плёнку поверх ленты
    };
    const step = (now: number) => {
      if (live.current.cancel) { finish(true); return; }
      if (!t0) t0 = now;
      const t = Math.floor(((now - t0) / 1000) * FPS) / FPS;
      // разгон — по параболе, дальше ровно
      const run = (s: number) => (s < ACCEL ? (V * s * s) / (2 * ACCEL) : V * (s - ACCEL / 2));
      let x: number;
      if (!brake) {
        x = run(t);
        // кадры карточек не ждём: копии грузят те же картинки, что и лента, и проявятся в обеих разом
        if (t >= MIN_RUN && (live.current.ready || t >= MAX_WAIT)) brake = decide(t, x);
      }
      if (brake) {
        const u = Math.min(t - brake.t, brake.dur);
        x = brake.x + V * u - (V * u * u) / (2 * brake.dur);
        if (u >= brake.dur) { paint(brake.end); finish(); return; }
      }
      paint(Math.round(x!));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    // страховка: что бы ни случилось с кадрами, через 8 с заставки нет
    timers.push(window.setTimeout(() => { finish(true); live.current.onDone(); }, 8000));
    const skip = () => finish(true);
    root.addEventListener('click', skip);
    return () => {
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
      root.removeEventListener('click', skip);
      pool.forEach((s) => s.el.remove());
      land.replaceChildren();
    };
    // заставка живёт один раз: всё изменчивое — через live
  }, [column]);

  return createPortal(
    <div ref={rootRef} className="tm-reel" aria-hidden="true">
      <div className="tm-reel__film" />
      <div className="tm-reel__land" inert />
      <div className="tm-reel__track" />
      <div className="tm-reel__track tm-reel__track--right" />
    </div>,
    document.body,
  );
}

const PLAYED = 'tm-reel-played';
const KNOWN = 'tm-reel-on';
/** Включена ли заставка у этого человека — по прошлому запуску: редакция приходит с настройками позже входа. */
export function reelKnown(): boolean {
  try { return localStorage.getItem(KNOWN) === '1'; } catch { return false; }
}
export function reelKnow(on: boolean) {
  try { if (on) localStorage.setItem(KNOWN, '1'); else localStorage.removeItem(KNOWN); } catch { /* нет хранилища — решит доля выката */ }
}
/** Показывать ли заставку: раз за сессию и не при «уменьшить движение». */
export function reelWanted(): boolean {
  try {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false;
    return !sessionStorage.getItem(PLAYED);
  } catch { return false; }
}
export function reelPlayed() {
  try { sessionStorage.setItem(PLAYED, '1'); } catch { /* приватное окно — покажется ещё раз, не беда */ }
}
