import type { AssessmentSession } from '@/types/tmdf';
import { Button } from './Button';
import { cx } from '@/lib/cx';
import ui, { plural } from '@/i18n';

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
        {`${ui.assessment.about} ${m} ${plural(m, ui.assessment.minuteOne, ui.assessment.minuteFew, ui.assessment.minuteMany)}`}
      </span>
      <div className="tm-row tm-row--gap-2">
        <Button variant="quiet" size="sm" onClick={onPause}>{ui.actions.pause}</Button>
        <Button variant="quiet" size="sm" onClick={onSkip}>{ui.actions.skip}</Button>
      </div>
    </div>
  );
}
