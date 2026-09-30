import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { PerceivedDifficulty, Trajectory } from '@/types/tmdf';
import { getTrajectory, startWork } from '@/api';
import { Button, EmptyState, ErrorState, PredictionSheet, Skeleton, TrajectoryPath } from '@/components';
import { currentStep } from '@/components/TrajectoryPath';
import ru from '@/i18n/ru';
import { isScreen } from '@/lib/media';

/** Экран «Маршрут» (/trajectories/:id): полный путь и действие для текущей станции. */
export function TrajectoryScreen() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [trajectory, setTrajectory] = useState<Trajectory | null>(null);
  const [missing, setMissing] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [starting, setStarting] = useState(false);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    let alive = true;
    setTrajectory(null);
    setMissing(false);
    setFailed(false);
    getTrajectory(id)
      .then((t) => {
        if (!alive) return;
        if (!t) { setMissing(true); return; }
        setTrajectory(t);
      })
      .catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, [id, attempt]);

  if (failed) {
    return (
      <main className="tm-shell__main">
        <ErrorState title={ru.trajectories.errorOne} text={ru.trajectories.errorText} onRetry={() => setAttempt(attempt + 1)} />
      </main>
    );
  }

  if (missing) {
    return (
      <main className="tm-shell__main">
        <EmptyState title={ru.trajectories.notFound} text={ru.trajectories.notFoundText}
                    action={ru.nav.trajectories} onAction={() => navigate('/trajectories')} />
      </main>
    );
  }

  if (!trajectory) {
    return (
      <main className="tm-shell__main" aria-busy="true">
        <span className="tm-sr">{ru.trajectories.loading}</span>
        <Skeleton kind="title" style={{ width: '70%' }} />
        <Skeleton kind="line" style={{ width: '50%', marginTop: 8 }} />
        <div className="tm-trajscreen__actions">
          {[0, 1, 2].map((i) => <Skeleton key={i} kind="block" style={{ height: 88 }} />)}
        </div>
      </main>
    );
  }

  const current = currentStep(trajectory);
  // как и в карточке: сначала прогноз, потом старт
  const start = (expected?: PerceivedDifficulty) => {
    if (!current) return;
    setStarting(true);
    setAsking(false);
    startWork(current.work.id, expected).then(() => navigate('/journal')).finally(() => setStarting(false));
  };

  return (
    <main className="tm-shell__main">
      <TrajectoryPath trajectory={trajectory} />
      {current ? (
        <div className="tm-trajscreen__actions">
          <p className="tm-meta tm-trajscreen__cur">
            <span className="tm-trajscreen__curlabel">{ru.trajectories.currentStep}</span>
            <span>{`${current.order}. ${current.work.title}`}</span>
          </p>
          <div className="tm-row tm-row--gap-2 tm-row--wrap">
            <Button variant="primary" loading={starting} onClick={() => setAsking(true)}>
              {isScreen(current.work) ? ru.actions.startFilm : ru.actions.startBook}
            </Button>
            <Link to={`/works/${current.work.id}`} className="tm-btn tm-btn--secondary">{ru.trajectories.toWork}</Link>
          </div>
        </div>
      ) : null}
      <PredictionSheet work={current?.work} open={asking} onOpenChange={setAsking} onStart={start} busy={starting} />
    </main>
  );
}
