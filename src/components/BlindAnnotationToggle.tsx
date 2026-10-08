import { Button } from './Button';
import { cx } from '@/lib/cx';
import ui from '@/i18n';

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
        <p className="tm-blind__title">{blind ? ui.curator.blindOn : ui.curator.blindOff}</p>
        <p className="tm-blind__note">{blind ? ui.curator.blindOnNote : ui.curator.blindOffNote}</p>
      </div>
      <Button size="sm" pressed={blind} onClick={() => onChange?.(!blind)}>
        {blind ? ui.curator.blindShowAfter : ui.curator.blindEnable}
      </Button>
    </div>
  );
}
