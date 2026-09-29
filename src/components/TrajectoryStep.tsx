import { Link } from 'react-router-dom';
import type { TrajectoryStepData } from '@/types/tmdf';
import { OperationChip } from './OperationChip';
import { StretchIndicator } from './StretchIndicator';
import { cx } from '@/lib/cx';
import ru from '@/i18n/ru';
import { useMechanics } from '@/lib/settingsStore';

export interface TrajectoryStepProps {
  step: TrajectoryStepData;
  /** последняя станция пути к вершине */
  peak?: boolean;
}

/** Станция маршрута: рельс со статусом, номер, произведение, зачем оно здесь, усилие,
 *  какие операции вводит и какие закрепляет. */
export function TrajectoryStep({ step: s, peak }: TrajectoryStepProps) {
  const mechanics = useMechanics();
  const status = ru.stepStatus[s.status];
  return (
    <li className={cx('tm-step', `tm-step--${s.status}`, peak && 'tm-step--peak')}>
      <div className="tm-step__rail" aria-hidden="true">
        <span className="tm-step__station" />
        <span className="tm-step__line" />
      </div>
      <div className="tm-step__body">
        <div className="tm-step__head">
          <span className="tm-step__order">{s.order}</span>
          <h4 className="tm-step__title">
            <Link to={`/works/${s.work.id}`} className="tm-link--plain">{s.work.title}</Link>
          </h4>
          {peak ? <span className="tm-step__peak">{ru.trajectory.peak}</span> : null}
          <span className={cx('tm-step__status', `tm-step__status--${s.status}`)} title={status.note || undefined}>
            {status.label}
          </span>
        </div>
        <p className="tm-step__purpose">{s.purpose}</p>
        <div className="tm-step__ops">
          <StretchIndicator level={s.stretch} size="sm" />
          {mechanics ? (
            <>
          {s.operationsIntroduced.length ? (
            <span className="tm-step__op">
              <span className="tm-step__opkind">{ru.trajectory.introduces}</span>
              {s.operationsIntroduced.map((op) => <OperationChip key={`i-${op}`} op={op} size="sm" short />)}
            </span>
          ) : null}
          {s.operationsReinforced.length ? (
            <span className="tm-step__op">
              <span className="tm-step__opkind">{ru.trajectory.reinforces}</span>
              {s.operationsReinforced.map((op) => <OperationChip key={`r-${op}`} op={op} size="sm" short tone="plain" />)}
            </span>
          ) : null}
            </>
          ) : null}
        </div>
      </div>
    </li>
  );
}
