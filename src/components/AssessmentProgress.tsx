import type { AssessmentSession } from '@/types/tmdf';
import { Button } from './Button';
import { pluralRu } from '@/lib/format';
import { cx } from '@/lib/cx';
import ru from '@/i18n/ru';

export interface AssessmentProgressProps {
  progress: AssessmentSession['progress'];
  onPause?: () => void;
  onSkip?: () => void;
}

const TICKS = 8;

/** Восемь засечек вместо процентов, оставшееся время словами, пауза и пропуск. */
export function AssessmentProgress({ progress, onPause, onSkip }: AssessmentProgressProps) {
  const m = progress.estimatedMinutesLeft;
  const on = Math.round((progress.answered / Math.max(1, progress.estimatedTotal)) * TICKS);
  return (
    <div className="tm-aprog">
      <span className="tm-aprog__ticks" aria-hidden="true">
        {Array.from({ length: TICKS }, (_, i) => (
          <span key={i} className={cx('tm-aprog__t', i < on && 'tm-aprog__t--on')} />
        ))}
      </span>
      <span className="tm-aprog__text">
        {`${ru.assessment.about} ${m} ${pluralRu(m, ru.assessment.minuteOne, ru.assessment.minuteFew, ru.assessment.minuteMany)}`}
      </span>
      <div className="tm-row tm-row--gap-2">
        <Button variant="quiet" size="sm" onClick={onPause}>{ru.actions.pause}</Button>
        <Button variant="quiet" size="sm" onClick={onSkip}>{ru.actions.skip}</Button>
      </div>
    </div>
  );
}
