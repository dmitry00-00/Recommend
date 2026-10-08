import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { cx } from '@/lib/cx';
import ui from '@/i18n';

export interface LeadTextProps {
  children: ReactNode;
}

/** Преамбула карточки: три строки и «Ещё». До этого под баннером шли объяснение, причина и
 *  аннотация подряд, и материал уезжал за экран (замечание владельца 23.09). Кнопка
 *  появляется только если текст правда не поместился — меряем по высоте, а не по длине
 *  строки: строка на телефоне и на планшете разной ширины. */
export function LeadText({ children }: LeadTextProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [long, setLong] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el) setLong(el.scrollHeight > el.clientHeight + 2);
  }, [children]);
  return (
    <div className="tm-lead">
      <div ref={ref} className={cx('tm-lead__body', open && 'tm-lead__body--open')}>{children}</div>
      {long ? (
        <button type="button" className="tm-lead__more" onClick={() => setOpen(!open)}>
          {open ? ui.feed.leadLess : ui.feed.lead}
        </button>
      ) : null}
    </div>
  );
}
