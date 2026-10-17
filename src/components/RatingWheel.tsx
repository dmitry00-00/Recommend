import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { cx } from '@/lib/cx';
import { pick } from '@/lib/telegram';
import ui from '@/i18n';

export type Score = 1 | 2 | 3 | 4 | 5;
const SCORES: Score[] = [1, 2, 3, 4, 5];
/** высота строки барабана, px — та же, что у кнопки sm */
const ROW = 40;
/** барабан сворачивается обратно, если его не трогали столько, мс */
const IDLE_MS = 1600;

export interface RatingWheelProps {
  /** уже поставленная оценка (список оценок) — с неё барабан и начинается; нет — с «Нормально» */
  value?: Score | null;
  onPick: (score: Score) => void;
  disabled?: boolean;
  /** подпись для чтения с экрана: «Оценка: Дюна» */
  label: string;
}

/** Оценка барабаном (17.10, владелец): линейка из пяти кнопок громоздкая. Свёрнутый барабан — место одной кнопки,
 *  в нём «Нормально»; тронули — раскрывается на три строки поверх соседних. Прокрутка вперёд (пальцем вверх) — «Хорошо»,
 *  «Отлично», назад — «Слабо», «Мимо». Нажатие на строку в середине — оценка; одно нажатие без прокрутки — «Нормально».
 *  Прокрутка — родная, с привязкой к строкам (scroll-snap): инерция и колесо мыши работают сами. */
export function RatingWheel({ value, onPick, disabled, label }: RatingWheelProps) {
  const track = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState<number>((value ?? 3) - 1);
  const [open, setOpen] = useState(false);
  const idle = useRef<number | undefined>(undefined);
  const settle = useRef<number | undefined>(undefined);
  // начальная установка положения тоже шлёт «прокрутку» — она не должна раскрывать барабан
  const quiet = useRef(false);

  useLayoutEffect(() => {
    const el = track.current;
    if (el) {
      quiet.current = true;
      el.scrollTop = ((value ?? 3) - 1) * ROW;
      requestAnimationFrame(() => requestAnimationFrame(() => { quiet.current = false; }));
    }
    setAt((value ?? 3) - 1);
  }, [value]);
  useEffect(() => () => { window.clearTimeout(idle.current); window.clearTimeout(settle.current); }, []);

  const wake = () => {
    setOpen(true);
    window.clearTimeout(idle.current);
    idle.current = window.setTimeout(() => setOpen(false), IDLE_MS);
  };
  const onScroll = () => {
    const el = track.current;
    if (!el || quiet.current) return;
    wake();
    const i = Math.max(0, Math.min(SCORES.length - 1, Math.round(el.scrollTop / ROW)));
    if (i !== at) { setAt(i); pick(); }
  };
  const scrollTo = (i: number) => {
    track.current?.scrollTo({ top: i * ROW, behavior: 'smooth' });
    setAt(i);
    wake();
  };
  const choose = (i: number) => {
    if (disabled) return;
    // строка не в середине — сначала подкатить её; в середине — это и есть ответ
    if (i !== at) { scrollTo(i); return; }
    window.clearTimeout(settle.current);
    setOpen(false);
    onPick(SCORES[i]);
  };

  return (
    <div className={cx('tm-wheel', open && 'tm-wheel--open', value && 'tm-wheel--set', disabled && 'tm-wheel--off')}
         role="spinbutton" aria-label={label} aria-valuemin={1} aria-valuemax={5} aria-valuenow={SCORES[at]}
         aria-valuetext={ui.rate.scale[at]} tabIndex={disabled ? -1 : 0}
         onKeyDown={(e) => {
           // строки сверху вниз — от «Мимо» к «Отлично», как числа в барабане времени: вниз — лучше
           if (e.key === 'ArrowDown') { e.preventDefault(); scrollTo(Math.min(4, at + 1)); }
           else if (e.key === 'ArrowUp') { e.preventDefault(); scrollTo(Math.max(0, at - 1)); }
           else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(at); }
         }}>
      <span className="tm-wheel__hint tm-wheel__hint--up" aria-hidden="true" />
      <div ref={track} className="tm-wheel__track" onScroll={onScroll} onPointerDown={wake}>
        {SCORES.map((s, i) => (
          <button key={s} type="button" tabIndex={-1} disabled={disabled}
                  className={cx('tm-wheel__row', i === at && 'tm-wheel__row--on', s >= 4 && 'tm-wheel__row--good')}
                  onClick={() => choose(i)}>
            {ui.rate.scale[s - 1]}
          </button>
        ))}
      </div>
      <span className="tm-wheel__hint tm-wheel__hint--down" aria-hidden="true" />
    </div>
  );
}
