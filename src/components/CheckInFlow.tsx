import { useEffect, useRef, useState } from 'react';
import type {
  AfterHook, AfterPace, AfterwordPatch, AbandonReason, CheckInRequest, CognitiveOperation, Debrief, DifficultyPrediction, DiscussionPlace,
  PerceivedDifficulty, ReflectionPromptData, WorkCard, WorthReason,
} from '@/types/tmdf';
import { nextExtraFor, setAfterword } from '@/api';
import type { Extra } from '@/lib/model/afterword';
import { AfterwordAsk } from './AfterwordAsk';
import { Button } from './Button';
import { DifficultyPicker } from './DifficultyPicker';
import { DiscussionLink } from './DiscussionLink';
import { ExternalAnalysisLink } from './ExternalAnalysisLink';
import { PredictionNote } from './PredictionNote';
import { ReasonPicker } from './ReasonPicker';
import { RatingWheel } from './RatingWheel';
import { ReflectionPrompt } from './ReflectionPrompt';
import { Skeleton } from './Skeleton';
import { StateChangeNote } from './StateChangeNote';
import { TropeInsight } from './TropeInsight';
import { useToast } from './Toast';
import { cx } from '@/lib/cx';
import ui from '@/i18n';
import { isScreen } from '@/lib/media';
import { hasMainButton, showMainButton, tap } from '@/lib/telegram';

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
  /** книга (З5): чек-ин о части — если человек отмечает части */
  part?: number;
  /** пришли с «Досмотрел»/«Дочитал» (17.10): у сериала и книги по частям в шаге «сезон/часть или всё» нет «Бросаю» */
  finish?: boolean;
}

const DEBRIEF = 3;
const ABANDON = 9;

/** Короткий поток после просмотра: 1–2 минуты, всё пропускаемо. Компонент только собирает
 *  ответы; что они значат для карты — решает сервер и возвращает в разборе. */
export function CheckInFlow({
  work, prompts = [], debrief, discussions = [], step: initial = 0, changedOperations = [],
  prediction, showModel, onSubmit, season, part, finish,
}: CheckInFlowProps) {
  const [step, setStep] = useState(initial);
  const [last, setLast] = useState(false);
  const [difficulty, setDifficulty] = useState<PerceivedDifficulty | undefined>();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  // «Стоило ли?» (ДФ-10): одно касание, при 1–2 — что не так; можно не отвечать
  const [worth, setWorth] = useState<CheckInRequest['worth']>();
  const [worthWhy, setWorthWhy] = useState<WorthReason | undefined>();
  // послесловие (17.10): после «Стоило ли?» — иногда один вопрос о человеке; решается при первом ответе и не меняется.
  // Ответ пишется сразу (setAfterword), «стоило» уходит с чек-ином — сервер сводит их в одну запись
  const [extraQ, setExtraQ] = useState<Extra | null | undefined>();
  const [extraVal, setExtraVal] = useState<AfterPace | AfterHook | undefined>();
  const toast = useToast();
  const pickExtra = (k: Extra, v: AfterPace | AfterHook) => {
    const before = extraVal;
    const next = before === v ? undefined : v;
    setExtraVal(next);
    setAfterword(work.id, { [k]: next ?? null } as AfterwordPatch).catch(() => { setExtraVal(before); toast({ text: ui.settings.errorSave }); });
  };
  const steps = ui.checkin.steps;
  const shown = step === ABANDON ? 1 : step;

  const submit = (status: CheckInRequest['status'], abandonReason?: AbandonReason) => {
    onSubmit?.({
      status,
      ...(season ? { season, ...(last ? { last: true } : {}) } : {}),
      ...(part ? { part, ...(last ? { last: true } : {}) } : {}),
      perceivedDifficulty: difficulty,
      abandonReason,
      ...(status === 'finished' && worth ? { worth, ...(worth <= 2 && worthWhy ? { worthWhy } : {}) } : {}),
      reflections: Object.entries(answers).map(([promptId, answer]) => ({ promptId, answer })),
    });
    setStep(DEBRIEF);
  };
  // «Дальше» (17.10): в Telegram — главной кнопкой мессенджера, она не уходит под нижнее меню; иначе — липкой
  // полосой над ним. Ответы собраны в нижней трети экрана, вопрос — над ними
  const submitRef = useRef(submit);
  submitRef.current = submit;
  useEffect(() => (step === 2 ? showMainButton(ui.actions.next, () => { tap('medium'); submitRef.current('finished'); }) : undefined), [step]);
  const mainInTelegram = step === 2 && hasMainButton();

  let body;
  if (step === 0 && season) {
    body = (
      <div>
        <p className="tm-checkin__q">{ui.seriesDiary.q(season)}</p>
        <div className="tm-row tm-row--gap-2 tm-row--wrap">
          <Button variant="primary" onClick={() => { setLast(false); setStep(1); }}>{ui.seriesDiary.finishedSeason(season)}</Button>
          <Button onClick={() => { setLast(true); setStep(1); }}>{ui.seriesDiary.finishedAll}</Button>
          {finish ? null : <Button onClick={() => setStep(ABANDON)}>{ui.actions.abandon}</Button>}
        </div>
      </div>
    );
  } else if (step === 0 && part) {
    body = (
      <div>
        <p className="tm-checkin__q">{ui.bookDiary.q(part)}</p>
        <div className="tm-row tm-row--gap-2 tm-row--wrap">
          <Button variant="primary" onClick={() => { setLast(false); setStep(1); }}>{ui.bookDiary.finishedPart(part)}</Button>
          <Button onClick={() => { setLast(true); setStep(1); }}>{ui.bookDiary.finishedAll}</Button>
          {finish ? null : <Button onClick={() => setStep(ABANDON)}>{ui.actions.abandon}</Button>}
        </div>
      </div>
    );
  } else if (step === 0) {
    body = (
      <div>
        <p className="tm-checkin__q">{isScreen(work) ? ui.checkin.qFilm : ui.checkin.qBook}</p>
        <div className="tm-row tm-row--gap-2">
          <Button variant="primary" onClick={() => setStep(1)}>
            {isScreen(work) ? ui.checkin.finishedFilm : ui.checkin.finishedBook}
          </Button>
          <Button onClick={() => setStep(ABANDON)}>{ui.actions.abandon}</Button>
        </div>
      </div>
    );
  } else if (step === 1) {
    body = (
      <div>
        <DifficultyPicker onPick={(d) => { setDifficulty(d); setStep(2); }} />
        <Button variant="quiet" size="sm" onClick={() => setStep(2)}>{ui.actions.skip}</Button>
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
        <div className="tm-checkin__worth" role="group" aria-label={ui.checkin.worthQ}>
          {/* «Стоило ли?» барабаном (17.10) вместо пяти кнопок в две строки: вопрос слева, ответ справа; не тронули —
              не ответили (отдельный «Пропустить» не нужен), тот же ответ ещё раз — снять */}
          <div className="tm-checkin__worthrow">
            <p className="tm-checkin__q">{ui.checkin.worthQ}</p>
            <RatingWheel label={ui.checkin.worthQ} labels={ui.checkin.worthScale} good={4} placeholder={ui.checkin.worthPick}
                         value={worth ?? null}
                         onPick={(w) => {
                           setWorth(worth === w ? undefined : w);
                           if (w > 2) setWorthWhy(undefined);
                           if (extraQ === undefined) setExtraQ(nextExtraFor(work.id, w));
                         }} />
          </div>
          {worth && worth <= 2 ? (
            <>
              <p className="tm-checkin__q">{ui.checkin.worthWhyQ}</p>
              <div className="tm-row tm-row--gap-2 tm-row--wrap">
                {(Object.keys(ui.checkin.worthWhy) as WorthReason[]).map((r) => (
                  <Button key={r} size="sm" variant="quiet" pressed={worthWhy === r}
                          onClick={() => setWorthWhy(worthWhy === r ? undefined : r)}>
                    {ui.checkin.worthWhy[r]}
                  </Button>
                ))}
              </div>
            </>
          ) : null}
          {extraQ ? <AfterwordAsk kind={extraQ} value={extraVal} onPick={(v) => pickExtra(extraQ, v)} /> : null}
        </div>
        {mainInTelegram ? null : (
          <div className="tm-checkin__dock">
            <Button variant="primary" onClick={() => submit('finished')}>{ui.actions.next}</Button>
          </div>
        )}
      </div>
    );
  } else if (step === ABANDON) {
    body = <ReasonPicker variant="abandon" onPick={(reason) => submit('abandoned', reason)} />;
  } else {
    body = (
      <div className="tm-checkin__debrief" aria-busy={debrief ? undefined : 'true'}>
        <h3 className="tm-checkin__dtitle">{ui.checkin.debrief}</h3>
        {debrief ? (
          <>
            <p className="tm-prose">{debrief.summary}</p>
            {prediction ? <PredictionNote prediction={prediction} actual={difficulty} showModel={showModel} /> : null}
            {debrief.tropeInsights.slice(0, 2).map((t) => <TropeInsight key={t.tropeId} insight={t} />)}
            <StateChangeNote changeType="refined_estimate" operations={changedOperations} />
            {debrief.externalAnalyses.length ? (
              <div className="tm-checkin__ext">
                <h4 className="tm-checkin__exttitle">{ui.work.analyses}</h4>
                {debrief.externalAnalyses.map((a) => <ExternalAnalysisLink key={a.id} analysis={a} />)}
              </div>
            ) : null}
            {discussions.length ? (
              <div className="tm-checkin__ext">
                <h4 className="tm-checkin__exttitle">{ui.work.discussions}</h4>
                {discussions.map((d) => <DiscussionLink key={d.id} discussion={d} />)}
                <p className="tm-checkin__note">{ui.work.discussionsNote}</p>
              </div>
            ) : null}
          </>
        ) : (
          <>
            <span className="tm-sr">{ui.checkin.debriefLoading}</span>
            <Skeleton kind="line" style={{ width: '90%' }} />
            <Skeleton kind="line" style={{ width: '70%', marginTop: 8 }} />
            <Skeleton kind="block" style={{ height: 96, marginTop: 16 }} />
          </>
        )}
      </div>
    );
  }

  return (
    <section className={cx('tm-checkin', step !== DEBRIEF && 'tm-checkin--ask')}>
      <div className="tm-checkin__head">
        <ol className="tm-checkin__steps">
          {steps.map((label, i) => (
            <li key={label} className={cx('tm-checkin__stepmark', i === shown && 'tm-checkin__stepmark--on', i < shown && 'tm-checkin__stepmark--done')}>
              <span className="tm-sr">{label}</span>
              <span aria-hidden="true">{label}</span>
            </li>
          ))}
        </ol>
        <p className="tm-checkin__note">{ui.checkin.note}</p>
      </div>
      <div className="tm-checkin__body">{body}</div>
    </section>
  );
}
