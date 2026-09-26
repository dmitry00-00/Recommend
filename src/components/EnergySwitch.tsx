import type { Energy } from '@/types/tmdf';
import { cx } from '@/lib/cx';
import ru from '@/i18n/ru';

const ORDER: Energy[] = ['low', 'normal', 'high'];

export function EnergySwitch({ value, onChange }: { value: Energy; onChange?: (e: Energy) => void }) {
  return (
    <div className="tm-energy" role="radiogroup" aria-label="Сколько сегодня сил">
      {ORDER.map((id) => {
        const on = id === value;
        return (
          <button key={id} type="button" role="radio" aria-checked={on ? 'true' : 'false'}
                  className={cx('tm-energy__opt', on && 'tm-energy__opt--on')}
                  title={ru.energy[id].note} onClick={() => onChange?.(id)}>
            <span className="tm-energy__tick" aria-hidden="true" />
            {ru.energy[id].label}
          </button>
        );
      })}
    </div>
  );
}
