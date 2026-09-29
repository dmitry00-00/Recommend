import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { ContributorAnswer, ContributorTask } from '@/types/tmdf';
import { getContributorTasks, submitContributorAnswer } from '@/api';
import {
  BarrierVote, Button, DesireCheck, EmptyState, ErrorState, LinkCheck, MechanismNote, PairwiseCompare, Skeleton, TropeCheckList, useToast,
} from '@/components';
import ru from '@/i18n/ru';

/** Задание участника (/contribute/tasks/:id): компонент по виду задания, ответ — одним
 *  запросом, дальше — следующее задание из очереди или обратно в кабинет. Сравнение, заметка
 *  и проверка ссылки отправляют себя сами; списки (приёмы, барьеры, желания) — кнопкой внизу. */
export function ContributorTaskScreen() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [tasks, setTasks] = useState<ContributorTask[] | null>(null);
  const [answer, setAnswer] = useState<ContributorAnswer | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setFailed(false);
    setAnswer(null);
    getContributorTasks().then((t) => alive && setTasks(t)).catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, [id, attempt]);

  const index = tasks?.findIndex((t) => t.id === id) ?? -1;
  const task = index >= 0 ? tasks![index] : null;
  const next = tasks && index >= 0 ? tasks.find((t, i) => i > index) ?? tasks.find((t, i) => i < index) : undefined;

  const goOn = () => (next ? navigate(`/contribute/tasks/${next.id}`, { replace: true }) : navigate('/contribute'));
  const submit = (a: ContributorAnswer) => {
    if (!task || busy) return;
    setBusy(true);
    submitContributorAnswer(task.id, a)
      .then(() => { toast({ text: next ? ru.contribute.sent : ru.contribute.allDone }); goOn(); })
      .catch(() => toast({ text: ru.settings.errorSave, action: ru.actions.retry, onAction: () => submit(a) }))
      .finally(() => setBusy(false));
  };
  const skip = () => { toast({ text: ru.contribute.skipped }); goOn(); };

  if (failed) {
    return (
      <main className="tm-shell__main">
        <ErrorState title={ru.contribute.errorTasks} text={ru.assessment.errorText} onRetry={() => setAttempt(attempt + 1)} />
      </main>
    );
  }
  if (!tasks) {
    return (
      <main className="tm-shell__main" aria-busy="true">
        <Skeleton kind="block" style={{ height: 240 }} />
      </main>
    );
  }
  if (!task) {
    return (
      <main className="tm-shell__main">
        <EmptyState title={ru.contribute.errorTask} text={ru.contribute.errorTaskText}
                    action={ru.contribute.title} onAction={() => navigate('/contribute')} />
      </main>
    );
  }

  const p = task.payload;
  const needsFooter = p.kind === 'trope_check' || p.kind === 'barrier_vote' || p.kind === 'desire_check';
  return (
    <main className="tm-shell__main tm-contribute">
      <Link to="/contribute" className="tm-contribute__back">{ru.contribute.toCabinet}</Link>
      <p className="tm-meta tm-contribute__count">{`${ru.contribute.taskOf(index + 1, tasks.length)} · ${ru.contributorTaskKind[task.kind]}`}</p>
      <p className="tm-body-sm tm-contribute__lead">{task.instructions}</p>

      {p.kind === 'pairwise' ? (
        <PairwiseCompare task={{ ...task, payload: p }} onAnswer={(choice) => submit({ kind: 'pairwise', choice })} onSkip={skip} />
      ) : null}
      {p.kind === 'trope_check' ? (
        <TropeCheckList task={{ ...task, payload: p }}
                        onChange={(items, missing) => setAnswer({ kind: 'trope_check', items, missing: missing.length ? missing : undefined })} />
      ) : null}
      {p.kind === 'barrier_vote' ? (
        <BarrierVote task={{ ...task, payload: p }} onChange={(items) => setAnswer({ kind: 'barrier_vote', items })} />
      ) : null}
      {p.kind === 'mechanism_note' ? (
        <MechanismNote task={{ ...task, payload: p }} busy={busy}
                       onSubmit={(text, referenceUrl) => submit({ kind: 'mechanism_note', text, referenceUrl })} onSkip={skip} />
      ) : null}
      {p.kind === 'desire_check' ? (
        <DesireCheck task={{ ...task, payload: p }} onChange={(items) => setAnswer({ kind: 'desire_check', items })} />
      ) : null}
      {p.kind === 'link_check' ? (
        <LinkCheck task={{ ...task, payload: p }} onAnswer={(verdict) => submit({ kind: 'link_check', verdict })} onSkip={skip} />
      ) : null}

      {needsFooter ? (
        <div className="tm-row tm-row--gap-2 tm-contribute__actions">
          <Button variant="primary" size="sm" loading={busy} disabled={busy || !answer} onClick={() => answer && submit(answer)}>
            {ru.contribute.submit}
          </Button>
          <Button variant="quiet" size="sm" disabled={busy} onClick={skip}>{ru.actions.skip}</Button>
        </div>
      ) : null}
    </main>
  );
}
