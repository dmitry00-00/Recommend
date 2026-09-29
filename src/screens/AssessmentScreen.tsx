import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { AssessmentAnswer, AssessmentSession, CognitiveMapData, UserSettings } from '@/types/tmdf';
import { answerAssessment, completeAssessment, getAssessment, getSettings, pauseAssessment, updateSettings } from '@/api';
import {
  AssessmentItem, Button, CognitiveMap, ConsentCard, EmptyState, ErrorState, Skeleton, StateChangeNote,
} from '@/components';
import ru from '@/i18n/ru';
import { useMechanics } from '@/lib/settingsStore';

interface AssessmentScreenProps {
  /** контрольная точка: те же задания, но сначала согласие, а в конце — что изменилось */
  checkpoint?: boolean;
}

/** Задания диагностики (/assessment/:id) и контрольная точка (/checkpoint/:id). Экран
 *  показывает текущее задание сессии, отправляет ответ или пропуск, по завершении
 *  собирает карту: диагностика уходит на первую карту, контрольная точка показывает
 *  последнюю точку истории — что изменилось. */
export function AssessmentScreen({ checkpoint }: AssessmentScreenProps) {
  const mechanics = useMechanics();
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState<AssessmentSession | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [answer, setAnswer] = useState<AssessmentAnswer | null>(null);
  const [missing, setMissing] = useState(false);
  const [failed, setFailed] = useState<'load' | 'answer' | 'complete' | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [result, setResult] = useState<CognitiveMapData | null>(null);

  // Завершённая сессия сразу собирает карту: диагностика — на первую карту, контрольная
  // точка — остаётся показать, что изменилось.
  const finish = () => {
    setFinishing(true);
    setFailed(null);
    completeAssessment(id)
      .then((map) => (checkpoint ? setResult(map) : navigate(mechanics ? '/onboarding/map' : '/today', { replace: true })))
      .catch(() => setFailed('complete'))
      .finally(() => setFinishing(false));
  };

  useEffect(() => {
    let alive = true;
    setSession(null);
    setMissing(false);
    setFailed(null);
    Promise.all([getAssessment(id), checkpoint ? getSettings() : Promise.resolve(null)])
      .then(([s, st]) => {
        if (!alive) return;
        if (!s) { setMissing(true); return; }
        setSession(s);
        setSettings(st);
        if (s.status === 'completed') finish();
      })
      .catch(() => alive && setFailed('load'));
    return () => { alive = false; };
  }, [id, checkpoint, attempt]);

  const send = (value: AssessmentAnswer | null) => {
    if (!session?.currentItem) return;
    setBusy(true);
    setFailed(null);
    answerAssessment(id, session.currentItem.id, value)
      .then((s) => {
        setSession(s);
        setAnswer(null);
        if (s.status === 'completed') finish();
      })
      .catch(() => setFailed('answer'))
      .finally(() => setBusy(false));
  };

  const pause = () => {
    pauseAssessment(id).finally(() => navigate(checkpoint ? '/today' : '/onboarding'));
  };

  const consent = () => {
    setBusy(true);
    updateSettings({ researchConsent: true })
      .then(setSettings)
      .catch(() => setFailed('answer'))
      .finally(() => setBusy(false));
  };

  const title = checkpoint ? ru.checkpoint.title
    : session?.mode === 'full' ? ru.onboarding.fullTitle : ru.onboarding.quickTitle;

  if (failed === 'load') {
    return <main className="tm-shell__main"><ErrorState title={ru.assessment.errorLoad} text={ru.assessment.errorText} onRetry={() => setAttempt(attempt + 1)} /></main>;
  }
  if (missing) {
    return (
      <main className="tm-shell__main">
        <EmptyState title={ru.assessment.notFound} text={ru.assessment.notFoundText}
                    action={checkpoint ? ru.checkpoint.toToday : ru.assessment.startOver}
                    onAction={() => navigate(checkpoint ? '/today' : '/onboarding')} />
      </main>
    );
  }
  if (!session) {
    return (
      <main className="tm-shell__main" aria-busy="true">
        <span className="tm-sr">{ru.assessment.loading}</span>
        <Skeleton kind="title" style={{ width: '50%' }} />
        <Skeleton kind="block" style={{ height: 160, marginTop: 24 }} />
      </main>
    );
  }

  // Контрольная точка без согласия — сначала согласие; «не сейчас» возвращает на «Сегодня».
  if (checkpoint && settings && !settings.researchConsent && !result) {
    return (
      <main className="tm-shell__main">
        <h1 className="tm-shell__title">{title}</h1>
        <p className="tm-body tm-assessment__lead">{ru.checkpoint.consentLead}</p>
        <ConsentCard busy={busy} onAccept={consent} onLater={() => navigate('/today')} />
      </main>
    );
  }

  if (result) {
    // Последняя точка истории — это и есть итог контрольной точки; операции, у которых
    // уровень или диапазон отличаются от предыдущей точки, — те, что она затронула.
    const last = result.history[result.history.length - 1];
    const prev = result.history[result.history.length - 2];
    const before = new Map(prev?.operations.map((o) => [o.op, o]) ?? []);
    const ops = last?.operations
      .filter((o) => {
        const b = before.get(o.op);
        return !b || b.level !== o.level || b.range[0] !== o.range[0] || b.range[1] !== o.range[1];
      })
      .map((o) => o.op) ?? [];
    return (
      <main className="tm-shell__main">
        <h1 className="tm-shell__title">{mechanics ? ru.checkpoint.done : ru.checkpoint.thanks}</h1>
        {!mechanics
          ? <p className="tm-body tm-assessment__lead">{ru.checkpoint.thanksText}</p>
          : last && ops.length
            ? <StateChangeNote changeType={last.cause.changeType} operations={ops} />
            : <p className="tm-body tm-assessment__lead">{ru.checkpoint.noChange}</p>}
        <div className="tm-assessment__map">
          <CognitiveMap map={result} showDetails={settings?.showDetails} />
        </div>
        <div className="tm-row tm-row--gap-2 tm-row--wrap tm-assessment__actions">
          {mechanics ? <Button variant="primary" onClick={() => navigate('/map')}>{ru.checkpoint.toMap}</Button> : null}
          <Button variant={mechanics ? 'quiet' : 'primary'} onClick={() => navigate('/today')}>{ru.checkpoint.toToday}</Button>
        </div>
      </main>
    );
  }

  if (session.status === 'completed' || !session.currentItem) {
    return (
      <main className="tm-shell__main" aria-busy={finishing ? 'true' : undefined}>
        <h1 className="tm-shell__title">{title}</h1>
        {failed === 'complete'
          ? <ErrorState title={ru.firstMap.error} text={ru.assessment.errorText} onRetry={finish} />
          : <p className="tm-body tm-assessment__lead">{ru.assessment.finishing}</p>}
      </main>
    );
  }

  const item = session.currentItem;
  return (
    <main className="tm-shell__main">
      <h1 className="tm-shell__title">{title}</h1>
      {checkpoint && session.progress.answered === 0
        ? <p className="tm-body tm-assessment__lead">{ru.checkpoint.lead}</p>
        : null}
      {failed === 'answer' ? <ErrorState title={ru.assessment.errorAnswer} text={ru.assessment.errorText} onRetry={() => send(answer)} /> : null}
      <AssessmentItem key={item.id} item={item}
                      progress={{ progress: session.progress, onPause: pause, onSkip: () => send(null) }}
                      onChange={setAnswer} />
      <div className="tm-row tm-row--gap-2 tm-assessment__actions">
        <Button variant="primary" disabled={!answer || busy} loading={busy} onClick={() => send(answer)}>
          {ru.actions.next}
        </Button>
      </div>
    </main>
  );
}
