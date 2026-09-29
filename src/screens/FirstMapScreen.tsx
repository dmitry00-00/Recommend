import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { CognitiveMapData, UserSettings } from '@/types/tmdf';
import { getMap, getSettings } from '@/api';
import { Button, CognitiveMap, ErrorState, OperationChip, Skeleton } from '@/components';
import ru from '@/i18n/ru';
import { useMechanics } from '@/lib/settingsStore';
import { MechanicsOff } from '@/screens/MechanicsOff';

/** Первая карта (/onboarding/map): поле после диагностики, слова о грубости оценки,
 *  предложенный фокус — и выход к сегодняшним кадрам. Выбор фокуса — на экране карты. */
export function FirstMapScreen() {
  const mechanics = useMechanics();
  if (!mechanics) return <MechanicsOff />;
  const navigate = useNavigate();
  const [data, setData] = useState<{ map: CognitiveMapData; settings: UserSettings } | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setData(null);
    setFailed(false);
    Promise.all([getMap(), getSettings()])
      .then(([map, settings]) => alive && setData({ map, settings }))
      .catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, [attempt]);

  return (
    <main className="tm-shell__main">
      <h1 className="tm-shell__title">{ru.firstMap.title}</h1>
      <p className="tm-body tm-firstmap__lead">{ru.firstMap.lead}</p>
      {failed ? (
        <ErrorState title={ru.firstMap.error} text={ru.assessment.errorText} onRetry={() => setAttempt(attempt + 1)} />
      ) : null}
      {!data && !failed ? (
        <div aria-busy="true">
          <span className="tm-sr">{ru.firstMap.loading}</span>
          <Skeleton kind="block" style={{ height: 320, maxWidth: 360 }} />
        </div>
      ) : null}
      {data ? (
        <>
          <div className="tm-firstmap__map">
            <CognitiveMap map={data.map} showDetails={data.settings.showDetails} />
          </div>
          <p className="tm-body-sm tm-firstmap__rough">{ru.firstMap.rough}</p>
          {data.map.suggestedTargets.length ? (
            <section className="tm-firstmap__focus">
              <span className="tm-label">{ru.firstMap.suggested}</span>
              <ul className="tm-targets">
                {data.map.suggestedTargets.map((t) => (
                  <li key={t.id}>
                    <div className="tm-row tm-row--wrap tm-row--gap-1">
                      {t.operations.map((op) => <OperationChip key={op} op={op} />)}
                    </div>
                    <span className="tm-caption tm-targets__label">{t.label}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      ) : null}
      <div className="tm-row tm-row--gap-2 tm-row--wrap tm-firstmap__actions">
        <Button variant="primary" onClick={() => navigate('/today')}>{ru.firstMap.toToday}</Button>
        <Button variant="quiet" onClick={() => navigate('/map')}>{ru.firstMap.toMap}</Button>
      </div>
    </main>
  );
}
