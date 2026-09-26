import { Button } from './Button';
import { cx } from '@/lib/cx';
import ru from '@/i18n/ru';

export interface BlindAnnotationToggleProps {
  blind: boolean;
  onChange?: (blind: boolean) => void;
}

/** Слепая разметка: черновик модели скрыт, пока куратор не сохранит свою версию — так
 *  эталон остаётся независимым. Управляется экраном. */
export function BlindAnnotationToggle({ blind, onChange }: BlindAnnotationToggleProps) {
  return (
    <div className={cx('tm-blind', blind && 'tm-blind--on')}>
      <div>
        <p className="tm-blind__title">{blind ? ru.curator.blindOn : ru.curator.blindOff}</p>
        <p className="tm-blind__note">{blind ? ru.curator.blindOnNote : ru.curator.blindOffNote}</p>
      </div>
      <Button size="sm" pressed={blind} onClick={() => onChange?.(!blind)}>
        {blind ? ru.curator.blindShowAfter : ru.curator.blindEnable}
      </Button>
    </div>
  );
}
