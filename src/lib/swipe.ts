import { useRef, type MouseEvent, type PointerEvent } from 'react';

/** Горизонтальный свайп пальцем (24.09): страницы карточки фильма и оценки на /rate.
 *  Устроен так, чтобы не мешать остальному:
 *   — только касание и стилус: мышью на компьютере выделяют текст, там остаются кнопки;
 *   — вертикальную прокрутку ведёт браузер (у области `touch-action: pan-y`), жест
 *     срабатывает, лишь когда палец ушёл вбок заметно сильнее, чем вниз;
 *   — у самых краёв экрана не начинается: там системный жест «назад» на Android;
 *   — не начинается на своих горизонтальных лентах (авторы, кинотеатры) и полях ввода;
 *   — после свайпа клик под пальцем гасится, чтобы не открылась ссылка или кнопка. */
const EDGE = 24;
const LOCK = 10;

export interface SwipeOptions {
  /** смещение пальца по горизонтали, пока жест идёт; 0 — жест отменён */
  onMove?: (dx: number) => void;
  /** палец отпущен после горизонтального жеста */
  onEnd: (dx: number) => void;
  enabled?: boolean;
}

export function useSwipe({ onMove, onEnd, enabled = true }: SwipeOptions) {
  const g = useRef<{ id: number; x: number; y: number; dx: number; axis?: 'x' | 'y' } | null>(null);
  const swiped = useRef(false);

  return {
    onPointerDown(e: PointerEvent) {
      swiped.current = false;
      if (!enabled || e.pointerType === 'mouse') return;
      if (e.clientX < EDGE || e.clientX > window.innerWidth - EDGE) return;
      if ((e.target as Element).closest('[data-noswipe], input, textarea, select, .tm-voice__strip')) return;
      g.current = { id: e.pointerId, x: e.clientX, y: e.clientY, dx: 0 };
    },
    onPointerMove(e: PointerEvent) {
      const t = g.current;
      if (!t || t.id !== e.pointerId) return;
      const dx = e.clientX - t.x;
      const dy = e.clientY - t.y;
      if (!t.axis) {
        if (Math.abs(dx) < LOCK && Math.abs(dy) < LOCK) return;
        t.axis = Math.abs(dx) > Math.abs(dy) * 1.5 ? 'x' : 'y';
        if (t.axis === 'y') { g.current = null; return; }
        try { (e.currentTarget as Element).setPointerCapture(e.pointerId); } catch { /* указатель уже ушёл */ }
      }
      t.dx = dx;
      swiped.current = true;
      onMove?.(dx);
    },
    onPointerUp(e: PointerEvent) {
      const t = g.current;
      if (!t || t.id !== e.pointerId) return;
      g.current = null;
      if (t.axis === 'x') onEnd(t.dx);
    },
    onPointerCancel() {
      if (g.current?.axis === 'x') onMove?.(0);
      g.current = null;
    },
    onClickCapture(e: MouseEvent) {
      if (!swiped.current) return;
      swiped.current = false;
      e.preventDefault();
      e.stopPropagation();
    },
  };
}
