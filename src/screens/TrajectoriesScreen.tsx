import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Trajectory } from '@/types/tmdf';
import { createTrajectory, getTrajectories } from '@/api';
import { Button, EmptyState, ErrorState, Skeleton, TrajectoryPath } from '@/components';
import ui from '@/i18n';

/** Экран «Маршруты» (/trajectories): компактные карточки, каждая ведёт на свой маршрут. */
export function TrajectoriesScreen() {
  const navigate = useNavigate();
  const [list, setList] = useState<Trajectory[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [building, setBuilding] = useState(false);

  useEffect(() => {
    let alive = true;
    setList(null);
    setFailed(false);
    getTrajectories()
      .then((t) => alive && setList(t))
      .catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, [attempt]);

  // «Собрать маршрут» без явной цели — из активного фокуса; операции подберёт сервер
  const build = () => {
    setBuilding(true);
    createTrajectory({}).then((t) => navigate(`/trajectories/${t.id}`)).finally(() => setBuilding(false));
  };

  return (
    <main className="tm-shell__main">
      <h1 className="tm-shell__title">{ui.nav.trajectories}</h1>
      {failed ? <ErrorState title={ui.trajectories.errorList} text={ui.trajectories.errorText} onRetry={() => setAttempt(attempt + 1)} /> : null}

      {!list && !failed ? (
        <div className="tm-trajlist" aria-busy="true">
          <span className="tm-sr">{ui.trajectories.loading}</span>
          {[0, 1].map((i) => <Skeleton key={i} kind="block" style={{ height: 104 }} />)}
        </div>
      ) : null}

      {list && !list.length ? (
        <EmptyState title={ui.trajectories.empty} text={ui.trajectories.emptyText}
                    action={ui.trajectories.build} onAction={build} />
      ) : null}

      {list?.length ? (
        <>
          <div className="tm-trajlist">
            {list.map((t) => (
              <Link key={t.id} to={`/trajectories/${t.id}`} className="tm-link--plain tm-trajlist__item">
                <TrajectoryPath trajectory={t} variant="compact" />
              </Link>
            ))}
          </div>
          <div className="tm-trajscreen__build">
            <Button size="sm" variant="quiet" loading={building} onClick={build}>{ui.trajectories.build}</Button>
          </div>
        </>
      ) : null}
    </main>
  );
}
