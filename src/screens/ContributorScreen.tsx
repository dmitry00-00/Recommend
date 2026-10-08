import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { ContributorProfile, ContributorTask } from '@/types/tmdf';
import { getContributorProfile, getContributorTasks } from '@/api';
import { Button, ContributionSummary, EmptyState, ErrorState, Skeleton, TaskFeed } from '@/components';
import ui from '@/i18n';

/** Кабинет участника (/contribute): лента заданий и ваш вклад. Вход — из настроек. Фильтр
 *  «только то, что я разбирал(а)» — по истории участника (сверка по внешним ID). */
export function ContributorScreen() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<ContributorTask[] | null>(null);
  const [profile, setProfile] = useState<ContributorProfile | null>(null);
  const [onlyMine, setOnlyMine] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setFailed(false);
    Promise.all([getContributorTasks({ onlyMine }), getContributorProfile()])
      .then(([t, p]) => { if (!alive) return; setTasks(t); setProfile(p); })
      .catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, [onlyMine, attempt]);

  return (
    <main className="tm-shell__main tm-contribute">
      <Link to="/settings" className="tm-contribute__back">{ui.contribute.toSettings}</Link>
      <h1 className="tm-shell__title">{ui.contribute.title}</h1>
      <p className="tm-body-sm tm-contribute__lead">{ui.contribute.lead}</p>

      {failed ? <ErrorState title={ui.contribute.errorTasks} text={ui.assessment.errorText} onRetry={() => setAttempt(attempt + 1)} /> : null}
      {!tasks && !failed ? (
        <div aria-busy="true">
          <Skeleton kind="block" style={{ height: 160 }} />
          <Skeleton kind="block" style={{ height: 120, marginTop: 24 }} />
        </div>
      ) : null}
      {tasks ? (
        tasks.length || onlyMine ? (
          <TaskFeed tasks={tasks} onlyMine={onlyMine} onOnlyMine={setOnlyMine}
                    onOpen={(t) => navigate(`/contribute/tasks/${t.id}`)} />
        ) : (
          <EmptyState title={ui.contribute.empty} text={ui.contribute.emptyText} />
        )
      ) : null}
      {tasks && !tasks.length && onlyMine ? <p className="tm-caption tm-contribute__none">{ui.contribute.emptyText}</p> : null}

      {profile ? (
        <div className="tm-contribute__summary">
          <ContributionSummary contributor={profile} />
          <Button size="sm" variant="quiet" onClick={() => navigate('/contribute/profile')}>{ui.contribute.profile}</Button>
        </div>
      ) : null}
    </main>
  );
}
