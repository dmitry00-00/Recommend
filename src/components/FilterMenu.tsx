import { useState } from 'react';
import { Sheet } from './Sheet';
import { pick } from '@/lib/telegram';
import { cx } from '@/lib/cx';

export interface FilterOption<K extends string> {
  key: K | null;
  label: string;
  count?: number;
}

/** «Фильтр ▾» (17.10): одна кнопка с текущим выбором вместо ряда чипов; варианты — нижним листом, описание слева, число
 *  справа. Выбор сразу закрывает лист. */
export function FilterMenu<K extends string>({ label, title, options, value, onChange }: {
  label: string;
  title: string;
  options: FilterOption<K>[];
  value: K | null;
  onChange: (k: K | null) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={cx('tm-fmenu__btn', value != null && 'tm-fmenu__btn--on')} aria-haspopup="dialog"
              onClick={() => { pick(); setOpen(true); }}>
        <span className="tm-fmenu__label">{label}</span><span aria-hidden="true">▾</span>
      </button>
      <Sheet open={open} onOpenChange={setOpen} title={title}>
        <ul className="tm-fmenu__list">
          {options.map((o) => (
            <li key={o.key ?? ''}>
              <button type="button" className={cx('tm-fmenu__opt', o.key === value && 'tm-fmenu__opt--on')}
                      aria-pressed={o.key === value ? 'true' : 'false'}
                      onClick={() => { pick(); onChange(o.key); setOpen(false); }}>
                <span>{o.label}</span>
                {o.count != null ? <span className="tm-fmenu__count">{o.count}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      </Sheet>
    </>
  );
}
