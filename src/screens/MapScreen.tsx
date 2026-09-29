import { useEffect, useState } from 'react';
import type { CognitiveMapData, CognitiveOperation, DevelopmentTarget, UserSettings } from '@/types/tmdf';
import { getMap, getSettings } from '@/api';
import {
  Button, CognitiveMap, ErrorState, OperationChip, Skeleton, StateChangeNote, TimeScrubber, UncertaintyMark,
} from '@/components';
import { operations as OPS } from '@/lib/operations';
import { pluralRu } from '@/lib/format';
import ru from '@/i18n/ru';
import { useMechanics } from '@/lib/settingsStore';
import { MechanicsOff } from '@/screens/MechanicsOff';

/** Карта на выбранной точке истории. Последняя точка — это и есть текущее состояние
 *  (состояние меняется только через причину, и каждая причина — точка истории); для более
 *  ранних точек уровень и диапазон берутся из истории, уверенность — текущая: в истории
 *  её нет, а она влияет только на мягкость линии. */
function mapAt(map: CognitiveMapData, index: number): CognitiveMapData {
  const point = map.history[index];
  if (!point || index === map.history.length - 1) return map;
  const byOp = new Map(point.operations.map((o) => [o.op, o]));
  return {
    ...map,
    state: {
      ...map.state,
      asOf: point.asOf,
      operations: map.state.operations.map((o) => {
        const past = byOp.get(o.op);
        return past ? { ...o, level: past.level, range: past.range } : o;
      }),
    },
  };
}

function OpDetail({ map, op, showDetails, isTarget, onFocus }: {
  map: CognitiveMapData; op: CognitiveOperation; showDetails: boolean; isTarget: boolean; onFocus: () => void;
}) {
  const est = map.state.operations.find((o) => o.op === op);
  if (!est) return null;
  const traces = map.traces.filter((t) => t.operations.some((o) => o.op === op)).length;
  return (
    <div className="tm-opdetail" aria-live="polite">
      <div className="tm-row tm-row--wrap tm-row--gap-2">
        <OperationChip op={op} tone="wash" />
        <span className="tm-caption tm-opdetail__facts">{ru.trend[est.trend]}</span>
      </div>
      <p className="tm-body-sm tm-opdetail__line">{OPS[op].line}</p>
      <UncertaintyMark level={est.level} range={est.range} confidence={est.confidence} op={op} showDetails={showDetails} />
      <p className="tm-caption tm-opdetail__facts">
        {traces
          ? `${traces} ${pluralRu(traces, ru.mapScreen.tracesOne, ru.mapScreen.tracesFew, ru.mapScreen.tracesMany)}`
          : ru.mapScreen.noTraces}
      </p>
      {isTarget
        ? <span className="tm-label tm-maplist__focus">{ru.mapScreen.isFocus}</span>
        : <div><Button size="sm" onClick={onFocus}>{ru.actions.makeFocus}</Button></div>}
    </div>
  );
}

/** Экран «Карта» (/map): поле или список, выбранная операция крупно, ось времени и фокус.
 *  Экран выбирает и раскладывает: уровни, диапазоны, причины изменений и предложения
 *  фокуса — из данных. */
export function MapScreen() {
  const mechanics = useMechanics();
  if (!mechanics) return <MechanicsOff />;
  const [map, setMap] = useState<CognitiveMapData | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [mode, setMode] = useState<'field' | 'list'>('field');
  const [showDetails, setShowDetails] = useState(false);
  const [selected, setSelected] = useState<CognitiveOperation | null>(null);
  const [point, setPoint] = useState<number | null>(null);
  // эндпоинта для целей развития в §17 пока нет — выбранный фокус живёт на экране
  const [chosen, setChosen] = useState<DevelopmentTarget[]>([]);

  useEffect(() => {
    let alive = true;
    setMap(null);
    setFailed(false);
    Promise.all([getMap(), getSettings()])
      .then(([m, s]) => {
        if (!alive) return;
        setMap(m);
        setSettings(s);
        setShowDetails(s.showDetails);
        setPoint(m.history.length - 1);
      })
      .catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, [attempt]);

  if (failed) {
    return (
      <main className="tm-shell__main">
        <h1 className="tm-shell__title">{ru.nav.map}</h1>
        <ErrorState title={ru.mapScreen.errorMap} text={ru.mapScreen.errorMapText} onRetry={() => setAttempt(attempt + 1)} />
      </main>
    );
  }

  if (!map || !settings || point === null) {
    return (
      <main className="tm-shell__main" aria-busy="true">
        <h1 className="tm-shell__title">{ru.nav.map}</h1>
        <span className="tm-sr">{ru.mapScreen.loading}</span>
        <div className="tm-mapscreen__field">
          <Skeleton kind="block" style={{ width: 300, height: 300, borderRadius: 'var(--tm-radius-full)' }} />
        </div>
        <div className="tm-mapscreen__sections">
          <Skeleton kind="block" style={{ height: 64 }} />
          <Skeleton kind="block" style={{ height: 96 }} />
        </div>
      </main>
    );
  }

  const shown = { ...mapAt(map, point), targets: [...map.targets, ...chosen] };
  const targetOps = new Set(shown.targets.flatMap((t) => t.operations));
  const suggested = map.suggestedTargets.filter((t) => !chosen.some((c) => c.id === t.id));
  const historyPoint = map.history[point];
  const focus = (t: DevelopmentTarget) => setChosen([...chosen, { ...t, active: true, source: 'user' }]);
  const focusOp = (op: CognitiveOperation) => {
    const fromSuggested = suggested.find((t) => t.operations.includes(op));
    focus(fromSuggested ?? { id: `local-${op}`, operations: [op], label: OPS[op].name, source: 'user', createdAt: shown.state.asOf, active: true });
  };

  return (
    <main className="tm-shell__main">
      <h1 className="tm-shell__title">{ru.nav.map}</h1>
      {map.state.overallConfidence === 'low' ? (
        <p className="tm-body-sm tm-mapscreen__rough">{ru.state.roughMap}</p>
      ) : null}
      <div className="tm-mapscreen__head">
        <span className="tm-meta">{ru.mapScreen.asOf + shown.state.asOf}</span>
        <div className="tm-row tm-row--gap-2 tm-row--wrap">
          <Button size="sm" variant="quiet" pressed={mode === 'list'}
                  onClick={() => setMode(mode === 'list' ? 'field' : 'list')}>{ru.mapScreen.asList}</Button>
          <Button size="sm" variant="quiet" pressed={showDetails}
                  onClick={() => setShowDetails(!showDetails)}>{ru.actions.showDetails}</Button>
        </div>
      </div>

      <div className="tm-mapscreen__field">
        <CognitiveMap map={shown} mode={mode} showDetails={showDetails} size={360}
                      onSelect={(op) => setSelected(op === selected ? null : op)} />
      </div>

      <div className="tm-mapscreen__sections">
        {selected
          ? <OpDetail map={shown} op={selected} showDetails={showDetails} isTarget={targetOps.has(selected)}
                      onFocus={() => focusOp(selected)} />
          : mode === 'field' ? <p className="tm-caption tm-mapscreen__hint">{ru.mapScreen.pickOp}</p> : null}

        {map.history.length ? (
          <section className="tm-mapscreen__section tm-mapscreen__history">
            <h2 className="tm-title-3">{ru.mapScreen.history}</h2>
            <TimeScrubber history={map.history} value={point} onChange={setPoint} />
            {historyPoint ? <StateChangeNote changeType={historyPoint.cause.changeType} /> : null}
          </section>
        ) : null}

        <section className="tm-mapscreen__section">
          <h2 className="tm-title-3">{ru.mapScreen.focusTitle}</h2>
          <ul className="tm-targets">
            {shown.targets.map((t) => (
              <li key={t.id}>
                <div className="tm-row tm-row--wrap tm-row--gap-1">
                  {t.operations.map((op) => <OperationChip key={op} op={op} tone="wash" />)}
                </div>
                <span className="tm-label tm-targets__label">{ru.mapScreen.yourFocus}</span>
              </li>
            ))}
            {suggested.map((t) => (
              <li key={t.id}>
                <div className="tm-row tm-row--wrap tm-row--gap-1">
                  {t.operations.map((op) => <OperationChip key={op} op={op} />)}
                  <span className="tm-label tm-targets__label">{ru.mapScreen.suggested}</span>
                </div>
                <Button size="sm" onClick={() => focus(t)}>{ru.actions.makeFocus}</Button>
              </li>
            ))}
          </ul>
          <p className="tm-caption tm-mapscreen__hint">{ru.mapScreen.focusNote}</p>
        </section>
      </div>
    </main>
  );
}
