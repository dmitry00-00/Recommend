import { useState } from 'react';
import type { ValueCharge } from '@/types/tmdf';
import { cx } from '@/lib/cx';
import ru from '@/i18n/ru';

export interface ChargePickerProps {
  value?: ValueCharge;
  onPick?: (charge: ValueCharge) => void;
}

const CHARGES = Object.keys(ru.charge) as ValueCharge[];

/** Ценностный заряд приёма — четыре позиции квадрата — по образцу TropeUsagePicker: те же
 *  кнопки-строки системы, подсказка в title. Вторая ось к способу использования. */
export function ChargePicker({ value, onPick }: ChargePickerProps) {
  const [val, setVal] = useState<ValueCharge | null>(value ?? null);
  return (
    <div className="tm-row tm-row--wrap tm-row--gap-1 tm-usage">
      {CHARGES.map((c) => {
        const on = val === c;
        return (
          <button key={c} type="button" title={ru.chargeNote[c]}
                  className={cx('tm-usage__opt', on && 'tm-usage__opt--on')} aria-pressed={on ? 'true' : 'false'}
                  onClick={() => { setVal(c); onPick?.(c); }}>
            {ru.charge[c]}
          </button>
        );
      })}
    </div>
  );
}
