import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AssessmentMode } from '@/types/tmdf';
import { startAssessment } from '@/api';
import { Button, ErrorState } from '@/components';
import ru from '@/i18n/ru';

const MODES: { mode: AssessmentMode; title: string; text: string }[] = [
  { mode: 'quick', title: ru.onboarding.quickTitle, text: ru.onboarding.quickText },
  { mode: 'full', title: ru.onboarding.fullTitle, text: ru.onboarding.fullText },
];

/** Выбор диагностики (/onboarding): быстрый старт или полная. Сессию создаёт сервер,
 *  экран уходит на её задания. */
export function OnboardingScreen() {
  const navigate = useNavigate();
  const [starting, setStarting] = useState<AssessmentMode | null>(null);
  const [failed, setFailed] = useState<AssessmentMode | null>(null);

  const start = (mode: AssessmentMode) => {
    setStarting(mode);
    setFailed(null);
    startAssessment(mode)
      .then((s) => navigate(`/assessment/${s.id}`))
      .catch(() => { setFailed(mode); setStarting(null); });
  };

  return (
    <main className="tm-shell__main">
      <h1 className="tm-shell__title">{ru.onboarding.title}</h1>
      <p className="tm-body tm-onboarding__lead">{ru.onboarding.lead}</p>
      {failed ? (
        <ErrorState title={ru.onboarding.errorStart} text={ru.assessment.errorText} onRetry={() => start(failed)} />
      ) : null}
      <ul className="tm-onboarding__modes">
        {MODES.map((m) => (
          <li key={m.mode} className="tm-onboarding__mode">
            <h2 className="tm-title-3 tm-onboarding__modeTitle">{m.title}</h2>
            <p className="tm-body-sm tm-onboarding__modeText">{m.text}</p>
            <Button variant={m.mode === 'quick' ? 'primary' : 'secondary'}
                    loading={starting === m.mode} disabled={starting !== null}
                    onClick={() => start(m.mode)}>
              {starting === m.mode ? ru.onboarding.starting : ru.onboarding.choose}
            </Button>
          </li>
        ))}
      </ul>
    </main>
  );
}
