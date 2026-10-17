import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { cx } from '@/lib/cx';
import { pick } from '@/lib/telegram';
import ui from '@/i18n';

export type Score = 1 | 2 | 3 | 4 | 5;
/** высота строки барабана, px — та же, что у кнопки sm */
const ROW = 40;
/** барабан сворачивается обратно, если его не трогали столько, мс */
const IDLE_MS = 1600;
/** после оценки все барабаны глухи столько, мс (17.10, аудит, п. 4): оценённая карточка уходит из списка, под палец
 *  въезжает следующая — второе нажатие двойного тапа оценивало уже её. Замок общий, а не у барабана: под пальцем
 *  оказывается другой экземпляр */
const LOCK_MS = 350;
let lockedUntil = 0;

/** Строки барабана — 1…labels.length (у оценки — Score). Обобщено 17.10: тот же барабан у «Стоило ли?» в чек-ине
 *  и у нормы шкалы 4…9 в импорте и ленте — вызывающий переводит номер строки в своё значение. */
export interface RatingWheelProps<T extends number = Score> {
  /** уже поставленная оценка (список оценок) — с неё барабан и начинается; нет — со `start` («Нормально») */
  value?: T | null;
  onPick: (score: T) => void;
  disabled?: boolean;
  /** подпись для чтения с экрана: «Оценка: Дюна» */
  label: string;
  /** подписи строк сверху вниз (17.10); по умолчанию — шкала оценки ui.rate.scale */
  labels?: readonly string[];
  /** строка, с которой начинать без value (1…); по умолчанию — средняя */
  start?: number;
  /** с какой строки подпись «хорошая» (акцент); по умолчанию 4 у шкалы оценки, у своих подписей — нет */
  good?: number;
  /** подпись в покое, пока value нет (17.10, список оценок: «Оценить»). Тогда первое касание только раскрывает
   *  барабан на `start`, а не ставит его; без placeholder одно нажатие — сразу «Нормально» (шторка «Видел», колода) */
  placeholder?: string;
}

/** Оценка барабаном (17.10, владелец): линейка из пяти кнопок громоздкая. Свёрнутый барабан — место одной кнопки,
 *  в нём «Нормально»; тронули — раскрывается на три строки поверх соседних. Прокрутка вперёд (пальцем вверх) — «Хорошо»,
 *  «Отлично», назад — «Слабо», «Мимо». Нажатие на строку в середине — оценка; одно нажатие без прокрутки — «Нормально».
 *  Прокрутка — родная, с привязкой к строкам (scroll-snap): инерция и колесо мыши работают сами. */
export function RatingWheel<T extends number = Score>({ value, onPick, disabled, label, labels, start, good, placeholder }: RatingWheelProps<T>) {
  const rows = labels ?? ui.rate.scale;
  const n = rows.length;
  const goodFrom = good ?? (labels ? n + 1 : 4);
  const first = Math.max(1, Math.min(n, value ?? start ?? Math.ceil(n / 2)));
  const track = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState<number>(first - 1);
  // с placeholder: барабан был свёрнут, когда палец коснулся, — это касание только раскрывает его
  const shut = useRef(true);
  const [open, setOpen] = useState(false);
  const idle = useRef<number | undefined>(undefined);
  const settle = useRef<number | undefined>(undefined);
  // начальная установка положения тоже шлёт «прокрутку» — она не должна раскрывать барабан
  const quiet = useRef(false);

  useLayoutEffect(() => {
    const el = track.current;
    if (el) {
      quiet.current = true;
      el.scrollTop = (first - 1) * ROW;
      requestAnimationFrame(() => requestAnimationFrame(() => { quiet.current = false; }));
    }
    setAt(first - 1);
  }, [first]);
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
    const i = Math.max(0, Math.min(n - 1, Math.round(el.scrollTop / ROW)));
    if (i !== at) { setAt(i); pick(); }
  };
  const scrollTo = (i: number) => {
    track.current?.scrollTo({ top: i * ROW, behavior: 'smooth' });
    setAt(i);
    wake();
  };
  const choose = (i: number, key = false) => {
    if (disabled || Date.now() < lockedUntil) return;
    // строка не в середине — сначала подкатить её; в середине — это и есть ответ
    if (i !== at) { scrollTo(i); return; }
    // «Оценить» в покое (17.10): первое касание свёрнутого барабана — раскрыть, а не поставить «Нормально»
    if (placeholder && value == null && shut.current && !key) { shut.current = false; wake(); return; }
    window.clearTimeout(settle.current);
    setOpen(false);
    lockedUntil = Date.now() + LOCK_MS;
    onPick((i + 1) as T);
  };
  const resting = Boolean(placeholder) && value == null && !open;

  return (
    <div className={cx('tm-wheel', open && 'tm-wheel--open', value && 'tm-wheel--set', resting && 'tm-wheel--rest', disabled && 'tm-wheel--off')}
         role="spinbutton" aria-label={label} aria-valuemin={1} aria-valuemax={n} aria-valuenow={at + 1}
         aria-valuetext={resting ? placeholder : rows[at]} tabIndex={disabled ? -1 : 0}
         onKeyDown={(e) => {
           // строки сверху вниз — от «Мимо» к «Отлично», как числа в барабане времени: вниз — лучше
           if (e.key === 'ArrowDown') { e.preventDefault(); scrollTo(Math.min(n - 1, at + 1)); }
           else if (e.key === 'ArrowUp') { e.preventDefault(); scrollTo(Math.max(0, at - 1)); }
           else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(at, true); }
         }}>
      <span className="tm-wheel__hint tm-wheel__hint--up" aria-hidden="true" />
      <div ref={track} className="tm-wheel__track" onScroll={onScroll} onPointerDown={() => { shut.current = !open; wake(); }}>
        {rows.map((text, i) => (
          <button key={i} type="button" tabIndex={-1} disabled={disabled}
                  className={cx('tm-wheel__row', i === at && 'tm-wheel__row--on', i + 1 >= goodFrom && 'tm-wheel__row--good')}
                  onClick={() => choose(i)}>
            {text}
          </button>
        ))}
      </div>
      {resting ? <span className="tm-wheel__rest" aria-hidden="true">{placeholder}</span> : null}
      <span className="tm-wheel__hint tm-wheel__hint--down" aria-hidden="true" />
    </div>
  );
}
