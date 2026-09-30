import { Link } from 'react-router-dom';
import type { JourneyEntryData } from '@/types/tmdf';
import { Button } from './Button';
import { Meta } from './Meta';
import { OperationChip } from './OperationChip';
import { PredictionNote } from './PredictionNote';
import { WorkCover } from './WorkCover';
import { cx } from '@/lib/cx';
import ru from '@/i18n/ru';
import { useMechanics } from '@/lib/settingsStore';
import { isScreen, isSeries } from '@/lib/media';

export interface JourneyEntryProps {
  entry: JourneyEntryData;
  /** ссылка с заголовка: на запись дневника (список) или на произведение (страница записи) */
  linkTo?: 'entry' | 'work';
  onFinish?: (entry: JourneyEntryData) => void;
  onAbandon?: (entry: JourneyEntryData) => void;
}

/** Запись дневника: кадр, статус, дата, как было по сложности, сверка с прогнозом, первый
 *  ответ, что изменилось на карте; у текущего — полоска кадров и два действия. */
export function JourneyEntry({ entry: e, linkTo = 'entry', onFinish, onAbandon }: JourneyEntryProps) {
  const inProgress = e.status === 'in_progress';
  const mechanics = useMechanics();
  const change = mechanics ? e.stateChanges[0] : undefined;
  const href = linkTo === 'work' ? `/works/${e.work.id}` : `/journal/${e.id}`;
  // сериал (Е3): где человек, какие сезоны досмотрены, на каком бросил
  const sp = isSeries(e.work) ? e.seriesProgress : undefined;
  const doneSeasons = sp?.done?.map((d) => d.season) ?? [];
  return (
    <article className={cx('tm-entry', `tm-entry--${e.status}`)}>
      <WorkCover work={e.work} size="sm" />
      <div className="tm-entry__body">
        <div className="tm-row tm-row--gap-2 tm-entry__head">
          <h4 className="tm-entry__title"><Link to={href} className="tm-link--plain">{e.work.title}</Link></h4>
          <span className={cx('tm-entry__status', `tm-entry__status--${e.status}`)}>{ru.journeyStatus[e.status]}</span>
        </div>
        <Meta items={[
          e.finishedAt ?? e.startedAt,
          e.perceivedDifficulty ? ru.difficulty[e.perceivedDifficulty].toLowerCase() : null,
          inProgress && e.progress != null ? `${Math.round(e.progress * 100)}%` : null,
          inProgress && sp ? ru.seriesDiary.now(sp.season, sp.episode) : null,
          doneSeasons.length ? ru.seriesDiary.done(doneSeasons) : null,
        ]} />
        {e.status === 'abandoned' && e.abandonReason ? (
          <p className="tm-entry__reason">
            {(sp ? ru.seriesDiary.stoppedAt(sp.season) : ru.entry.abandoned) + (ru.abandonReason[e.abandonReason] ?? ru.entry.otherReason).toLowerCase()}
          </p>
        ) : e.status === 'abandoned' && sp ? <p className="tm-entry__reason">{ru.seriesDiary.stoppedAtBare(sp.season)}</p> : null}
        {e.prediction ? (
          <PredictionNote prediction={e.prediction} actual={e.perceivedDifficulty} showModel={mechanics} />
        ) : null}
        {e.reflections.length ? <blockquote className="tm-entry__quote">{e.reflections[0].answer}</blockquote> : null}
        {change ? (
          <p className="tm-entry__change">
            <span className={cx('tm-entry__changemark', change.changeType === 'observed_growth' && 'tm-entry__changemark--growth')}
                  aria-hidden="true" />
            {change.changeType === 'observed_growth' ? ru.state.growth : ru.state.refined}
            <span className="tm-entry__changeops">
              {e.stateChanges.map((ch) => <OperationChip key={ch.op} op={ch.op} size="sm" short />)}
            </span>
          </p>
        ) : null}
        {inProgress && e.progress != null ? (
          <div className="tm-frames" aria-hidden="true">
            {Array.from({ length: 10 }, (_, i) => (
              <span key={i} className={cx('tm-frames__f', i < Math.round(e.progress! * 10) && 'tm-frames__f--on')} />
            ))}
          </div>
        ) : null}
        {inProgress ? (
          <div className="tm-row tm-row--gap-2 tm-entry__actions">
            <Button size="sm" variant="primary" onClick={() => onFinish?.(e)}>
              {isSeries(e.work) ? ru.seriesDiary.finishSeason(sp?.season ?? 1)
                : isScreen(e.work) ? ru.actions.finishFilm : ru.actions.finishBook}
            </Button>
            <Button size="sm" variant="quiet" onClick={() => onAbandon?.(e)}>{ru.actions.abandon}</Button>
          </div>
        ) : null}
      </div>
    </article>
  );
}
