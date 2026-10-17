import type { Energy } from '@/types/tmdf';
import { cx } from '@/lib/cx';
import ui from '@/i18n';

const ORDER: Energy[] = ['low', 'normal', 'high'];

/** `compact` — короткие подписи для нижней полосы ленты (17.10): три варианта и «Кино / Книги» помещаются в один ряд. */
export function EnergySwitch({ value, onChange, compact }: { value: Energy; onChange?: (e: Energy) => void; compact?: boolean }) {
  return (
    <div className="tm-energy" role="radiogroup" aria-label={ui.a11y.energy}>
      {ORDER.map((id) => {
        const on = id === value;
        return (
          <button key={id} type="button" role="radio" aria-checked={on ? 'true' : 'false'}
                  className={cx('tm-energy__opt', on && 'tm-energy__opt--on')}
                  title={ui.energy[id].note} onClick={() => onChange?.(id)}>
            <span className="tm-energy__tick" aria-hidden="true" />
            {compact ? ui.energy[id].short : ui.energy[id].label}
          </button>
        );
      })}
    </div>
  );
}
