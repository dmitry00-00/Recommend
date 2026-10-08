import type { Trajectory, TrajectoryStepData } from '@/types/tmdf';
import { Meta } from './Meta';
import { ReplanNote } from './ReplanNote';
import { TrajectoryStep } from './TrajectoryStep';
import { cx } from '@/lib/cx';
import ui, { plural } from '@/i18n';
import { useMechanics } from '@/lib/settingsStore';
import { titleOf } from '@/lib/format';

export interface TrajectoryPathProps {
  trajectory: Trajectory;
  /** 'compact' — карточка со строкой станций для списка и экрана «Сегодня» */
  variant?: 'compact';
}

/** Текущая станция: где вы сейчас, иначе — первая доступная. Это выбор из статусов, не расчёт. */
export function currentStep(t: Trajectory): TrajectoryStepData | undefined {
  return t.steps.find((s) => s.status === 'in_progress') ?? t.steps.find((s) => s.status === 'available');
}

/** Маршрут как ход съёмки от станции к станции. Путь к вершине заканчивается треугольником. */
export function TrajectoryPath({ trajectory: t, variant }: TrajectoryPathProps) {
  const mechanics = useMechanics();
  const done = t.steps.filter((s) => s.status === 'completed').length;
  const current = currentStep(t);
  const next = t.steps.find((s) => s.status === 'locked' || s.status === 'available');
  const isPeak = t.kind === 'peak_path';
  const progress = `${ui.trajectory.step}${done + 1}${ui.trajectory.of}${t.steps.length}`;

  if (variant === 'compact') {
    return (
      <div className="tm-traj tm-traj--compact">
        <div className="tm-traj__chead">
          <h4 className="tm-traj__ctitle">{t.title}</h4>
          <span className="tm-traj__cprog">{progress}</span>
        </div>
        <ol className="tm-traj__dots">
          {t.steps.map((s) => (
            <li key={s.order}
                className={cx('tm-traj__dot', `tm-traj__dot--${s.status}`,
                              isPeak && s.order === t.steps.length && 'tm-traj__dot--peak')}>
              <span className="tm-sr">{`${s.order}. ${titleOf(s.work)} — ${ui.stepStatus[s.status].label}`}</span>
            </li>
          ))}
        </ol>
        {current ? (
          <p className="tm-traj__cnow">
            <span className="tm-traj__clabel">
              {current.status === 'in_progress' ? ui.trajectory.now : ui.trajectory.next}
            </span>
            {titleOf(current.work)}
          </p>
        ) : null}
      </div>
    );
  }

  const left = t.steps.length - done - 1;
  return (
    <section className={cx('tm-traj', isPeak && 'tm-traj--peak')}>
      <header className="tm-traj__head">
        <h3 className="tm-traj__title">{t.title}</h3>
        <Meta items={[
          isPeak ? ui.trajectory.kindPeak : ui.trajectory.kindDevelopment,
          progress,
          mechanics && t.target ? ui.trajectory.focus + t.target.label : null,
        ]} />
        {isPeak && t.peakWork ? (
          <p className="tm-traj__peaknote">
            {`${ui.trajectory.peakNoteBefore}${t.peakWork.title}${ui.trajectory.peakNoteAfter}${left} ${plural(left, ui.trajectory.stepsOne, ui.trajectory.stepsFew, ui.trajectory.stepsMany)}`}
          </p>
        ) : null}
      </header>
      <ol className="tm-traj__steps">
        {t.steps.map((s) => (
          <TrajectoryStep key={s.order} step={s} peak={isPeak && s.order === t.steps.length} />
        ))}
      </ol>
      {t.replanHistory.map((r, i) => <ReplanNote key={i} at={r.at} reason={r.reason} />)}
      <span className="tm-sr">{next ? ui.trajectory.srNext + titleOf(next.work) : ui.trajectory.srDone}</span>
    </section>
  );
}
