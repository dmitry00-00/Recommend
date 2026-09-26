import type { Confidence } from '@/types/tmdf';
import { cx } from '@/lib/cx';
import ru from '@/i18n/ru';

export interface FieldConfidenceProps {
  confidence?: Confidence;
  /** путь поля в аннотации — моноширинно рядом */
  path?: string;
  /** false — без подписи, только столбики */
  label?: false;
}

const BARS: Record<Confidence, number> = { low: 1, medium: 2, high: 3 };

/** Уверенность модели по полю: три столбика, подпись, путь. Это про модель, не про произведение. */
export function FieldConfidence({ confidence = 'medium', path, label }: FieldConfidenceProps) {
  return (
    <span className={cx('tm-fconf', `tm-fconf--${confidence}`)} title={ru.curator.confidenceTitle(ru.curator.confidence[confidence])}>
      <span className="tm-fconf__bars" aria-hidden="true">
        {[0, 1, 2].map((i) => <span key={i} className={cx('tm-fconf__b', i < BARS[confidence] && 'tm-fconf__b--on')} />)}
      </span>
      {label !== false ? <span className="tm-fconf__label">{ru.curator.confidence[confidence]}</span> : null}
      {path ? <code className="tm-fconf__path">{path}</code> : null}
    </span>
  );
}
