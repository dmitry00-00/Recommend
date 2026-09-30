import { useState } from 'react';
import type {
  AbandonReason, CheckInRequest, CognitiveOperation, Debrief, DifficultyPrediction, DiscussionPlace,
  PerceivedDifficulty, ReflectionPromptData, WorkCard,
} from '@/types/tmdf';
import { Button } from './Button';
import { DifficultyPicker } from './DifficultyPicker';
import { DiscussionLink } from './DiscussionLink';
import { ExternalAnalysisLink } from './ExternalAnalysisLink';
import { PredictionNote } from './PredictionNote';
import { ReasonPicker } from './ReasonPicker';
import { ReflectionPrompt } from './ReflectionPrompt';
import { Skeleton } from './Skeleton';
import { StateChangeNote } from './StateChangeNote';
import { TropeInsight } from './TropeInsight';
import { cx } from '@/lib/cx';
import ru from '@/i18n/ru';
import { isScreen } from '@/lib/media';

export interface CheckInFlowProps {
  work: WorkCard;
  prompts?: ReflectionPromptData[];
  /** разбор приходит после onSubmit; пока его нет — скелетон */
  debrief?: Debrief;
  discussions?: DiscussionPlace[];
  /** начальный шаг: 0 — «досмотрели или бросили», 9 — сразу причины ухода */
  step?: number;
  changedOperations?: CognitiveOperation[];
  /** что ждали до начала — в разборе сверяем с тем, как оказалось */
  prediction?: DifficultyPrediction;
  /** строку про прогноз модели показываем только с включённой механикой */
  showModel?: boolean;
  /** вызывается один раз при переходе к разбору со всем, что собрано */
  onSubmit?: (request: CheckInRequest) => void;
  /** сериал (Е3): чек-ин о сезоне — «досмотрел сезон», «весь сериал» или «бросаю на нём» */
  season?: number;
}

const DEBRIEF = 3;
const ABANDON = 9;

/** Короткий поток после просмотра: 1–2 минуты, всё пропускаемо. Компонент только собирает
 *  ответы; что они значат для карты — решает сервер и возвращает в разборе. */
export function CheckInFlow({
  work, prompts = [], debrief, discussions = [], step: initial = 0, changedOperations = [],
  prediction, showModel, onSubmit, season,
}: CheckInFlowProps) {
  const [step, setStep] = useState(initial);
  const [last, setLast] = useState(false);
  const [difficulty, setDifficulty] = useState<PerceivedDifficulty | undefined>();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const steps = ru.checkin.steps;
  const shown = step === ABANDON ? 1 : step;

  const submit = (status: CheckInRequest['status'], abandonReason?: AbandonReason) => {
    onSubmit?.({
      status,
      ...(season ? { season, ...(last ? { last: true } : {}) } : {}),
      perceivedDifficulty: difficulty,
      abandonReason,
      reflections: Object.entries(answers).map(([promptId, answer]) => ({ promptId, answer })),
    });
    setStep(DEBRIEF);
  };

  let body;
  if (step === 0 && season) {
    body = (
      <div>
        <p className="tm-checkin__q">{ru.seriesDiary.q(season)}</p>
        <div className="tm-row tm-row--gap-2 tm-row--wrap">
          <Button variant="primary" onClick={() => { setLast(false); setStep(1); }}>{ru.seriesDiary.finishedSeason(season)}</Button>
          <Button onClick={() => { setLast(true); setStep(1); }}>{ru.seriesDiary.finishedAll}</Button>
          <Button onClick={() => setStep(ABANDON)}>{ru.actions.abandon}</Button>
        </div>
      </div>
    );
  } else if (step === 0) {
    body = (
      <div>
        <p className="tm-checkin__q">{isScreen(work) ? ru.checkin.qFilm : ru.checkin.qBook}</p>
        <div className="tm-row tm-row--gap-2">
          <Button variant="primary" onClick={() => setStep(1)}>
            {isScreen(work) ? ru.checkin.finishedFilm : ru.checkin.finishedBook}
          </Button>
          <Button onClick={() => setStep(ABANDON)}>{ru.actions.abandon}</Button>
        </div>
      </div>
    );
  } else if (step === 1) {
    body = (
      <div>
        <DifficultyPicker onPick={(d) => { setDifficulty(d); setStep(2); }} />
        <Button variant="quiet" size="sm" onClick={() => setStep(2)}>{ru.actions.skip}</Button>
      </div>
    );
  } else if (step === 2) {
    body = (
      <div>
        {prompts.slice(0, 2).map((pr) => (
          <ReflectionPrompt key={pr.id} prompt={pr}
                            onAnswer={(v) => setAnswers({ ...answers, [pr.id]: v })}
                            onSkip={() => { const next = { ...answers }; delete next[pr.id]; setAnswers(next); }} />
        ))}
        <Button variant="primary" onClick={() => submit('finished')}>{ru.actions.next}</Button>
      </div>
    );
  } else if (step === ABANDON) {
    body = <ReasonPicker variant="abandon" onPick={(reason) => submit('abandoned', reason)} />;
  } else {
    body = (
      <div className="tm-checkin__debrief" aria-busy={debrief ? undefined : 'true'}>
        <h3 className="tm-checkin__dtitle">{ru.checkin.debrief}</h3>
        {debrief ? (
          <>
            <p className="tm-prose">{debrief.summary}</p>
            {prediction ? <PredictionNote prediction={prediction} actual={difficulty} showModel={showModel} /> : null}
            {debrief.tropeInsights.slice(0, 2).map((t) => <TropeInsight key={t.tropeId} insight={t} />)}
            <StateChangeNote changeType="refined_estimate" operations={changedOperations} />
            {debrief.externalAnalyses.length ? (
              <div className="tm-checkin__ext">
                <h4 className="tm-checkin__exttitle">{ru.work.analyses}</h4>
                {debrief.externalAnalyses.map((a) => <ExternalAnalysisLink key={a.id} analysis={a} />)}
              </div>
            ) : null}
            {discussions.length ? (
              <div className="tm-checkin__ext">
                <h4 className="tm-checkin__exttitle">{ru.work.discussions}</h4>
                {discussions.map((d) => <DiscussionLink key={d.id} discussion={d} />)}
                <p className="tm-checkin__note">{ru.work.discussionsNote}</p>
              </div>
            ) : null}
          </>
        ) : (
          <>
            <span className="tm-sr">{ru.checkin.debriefLoading}</span>
            <Skeleton kind="line" style={{ width: '90%' }} />
            <Skeleton kind="line" style={{ width: '70%', marginTop: 8 }} />
            <Skeleton kind="block" style={{ height: 96, marginTop: 16 }} />
          </>
        )}
      </div>
    );
  }

  return (
    <section className="tm-checkin">
      <div className="tm-checkin__head">
        <ol className="tm-checkin__steps">
          {steps.map((label, i) => (
            <li key={label} className={cx('tm-checkin__stepmark', i === shown && 'tm-checkin__stepmark--on', i < shown && 'tm-checkin__stepmark--done')}>
              <span className="tm-sr">{label}</span>
              <span aria-hidden="true">{label}</span>
            </li>
          ))}
        </ol>
        <p className="tm-checkin__note">{ru.checkin.note}</p>
      </div>
      {body}
    </section>
  );
}
