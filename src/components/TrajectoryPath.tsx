import type { Trajectory, TrajectoryStepData } from '@/types/tmdf';
import { Meta } from './Meta';
import { ReplanNote } from './ReplanNote';
import { TrajectoryStep } from './TrajectoryStep';
import { pluralRu } from '@/lib/format';
import { cx } from '@/lib/cx';
import ru from '@/i18n/ru';
import { useMechanics } from '@/lib/settingsStore';

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
  const progress = `${ru.trajectory.step}${done + 1}${ru.trajectory.of}${t.steps.length}`;

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
              <span className="tm-sr">{`${s.order}. ${s.work.title} — ${ru.stepStatus[s.status].label}`}</span>
            </li>
          ))}
        </ol>
        {current ? (
          <p className="tm-traj__cnow">
            <span className="tm-traj__clabel">
              {current.status === 'in_progress' ? ru.trajectory.now : ru.trajectory.next}
            </span>
            {current.work.title}
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
          isPeak ? ru.trajectory.kindPeak : ru.trajectory.kindDevelopment,
          progress,
          mechanics && t.target ? ru.trajectory.focus + t.target.label : null,
        ]} />
        {isPeak && t.peakWork ? (
          <p className="tm-traj__peaknote">
            {`${ru.trajectory.peakNoteBefore}${t.peakWork.title}${ru.trajectory.peakNoteAfter}${left} ${pluralRu(left, ru.trajectory.stepsOne, ru.trajectory.stepsFew, ru.trajectory.stepsMany)}`}
          </p>
        ) : null}
      </header>
      <ol className="tm-traj__steps">
        {t.steps.map((s) => (
          <TrajectoryStep key={s.order} step={s} peak={isPeak && s.order === t.steps.length} />
        ))}
      </ol>
      {t.replanHistory.map((r, i) => <ReplanNote key={i} at={r.at} reason={r.reason} />)}
      <span className="tm-sr">{next ? ru.trajectory.srNext + next.work.title : ru.trajectory.srDone}</span>
    </section>
  );
}
