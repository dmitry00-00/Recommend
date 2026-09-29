import { useState } from 'react';
import type { TropeUsageType } from '@/types/tmdf';
import { cx } from '@/lib/cx';
import ru from '@/i18n/ru';

export interface TropeUsagePickerProps {
  value?: TropeUsageType;
  onPick?: (usage: TropeUsageType) => void;
}

const USAGES = Object.keys(ru.tropeUsage) as TropeUsageType[];

/** Как использован приём: напрямую, деконструкция, обман ожидания, реконструкция, осмысление.
 *  Подсказка к каждому — в title, чтобы не загромождать строку. */
export function TropeUsagePicker({ value, onPick }: TropeUsagePickerProps) {
  const [val, setVal] = useState<TropeUsageType | null>(value ?? null);
  return (
    <div className="tm-row tm-row--wrap tm-row--gap-1 tm-usage">
      {USAGES.map((u) => {
        const on = val === u;
        return (
          <button key={u} type="button" title={ru.tropeUsageNote[u]}
                  className={cx('tm-usage__opt', on && 'tm-usage__opt--on')} aria-pressed={on ? 'true' : 'false'}
                  onClick={() => { setVal(u); onPick?.(u); }}>
            {ru.tropeUsage[u]}
          </button>
        );
      })}
    </div>
  );
}
