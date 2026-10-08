import { useState } from 'react';
import type { AbandonReason, DismissReason } from '@/types/tmdf';
import { cx } from '@/lib/cx';
import ui from '@/i18n';

interface ReasonPickerBase { title?: string }

export type ReasonPickerProps =
  | (ReasonPickerBase & { variant?: 'dismiss'; value?: DismissReason; onPick?: (id: DismissReason) => void })
  | (ReasonPickerBase & { variant: 'abandon'; value?: AbandonReason; onPick?: (id: AbandonReason) => void });

/** Причина отказа или ухода — одним нажатием, без обязательности. «Бросаю» — это
 *  данные, а не провал, и заголовок об этом говорит. */
export function ReasonPicker(props: ReasonPickerProps) {
  const [value, setValue] = useState<string | null>(props.value ?? null);
  const abandon = props.variant === 'abandon';
  const list: [string, string][] = Object.entries(abandon ? ui.abandonReason : ui.dismissReason);
  const pick = (id: string) => {
    setValue(id);
    if (props.variant === 'abandon') props.onPick?.(id as AbandonReason);
    else props.onPick?.(id as DismissReason);
  };
  return (
    <div className="tm-reasons">
      <p className="tm-reasons__title">
        {props.title ?? (abandon ? ui.reasons.abandonTitle : ui.reasons.dismissTitle)}
      </p>
      <div className="tm-row tm-row--wrap tm-row--gap-1">
        {list.map(([id, label]) => {
          const on = value === id;
          return (
            <button key={id} type="button" className={cx('tm-reasons__opt', on && 'tm-reasons__opt--on')}
                    aria-pressed={on ? 'true' : 'false'} onClick={() => pick(id)}>
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
