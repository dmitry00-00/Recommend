import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { DismissReason, Recommendation, SpoilerLevel, WorkCard } from '@/types/tmdf';
import { Button } from './Button';
import { DiscussionLink } from './DiscussionLink';
import { ExplanationBlock } from './ExplanationBlock';
import { ExternalAnalysisLink } from './ExternalAnalysisLink';
import { Meta } from './Meta';
import { OperationChip } from './OperationChip';
import { ReadinessNotice } from './ReadinessNotice';
import { ReasonPicker } from './ReasonPicker';
import { StretchIndicator } from './StretchIndicator';
import { WorkCover } from './WorkCover';
import { workMeta, titleOf } from '@/lib/format';
import { cx } from '@/lib/cx';
import ui from '@/i18n';
import { isScreen } from '@/lib/media';

export interface RecommendationCardProps {
  recommendation: Recommendation;
  /** предыдущий кадр маршрута: над рекомендацией появляется склейка с «зачем сейчас» */
  previous?: { work: WorkCard; purpose?: string };
  variant?: 'compact';
  expanded?: boolean;
  showDetails?: boolean;
  /** допустимый уровень спойлеров — разборы выше него закрыты; чаты закрыты, пока не закончено */
  spoilerLevel?: SpoilerLevel;
  finished?: boolean;
  onStart?: (r: Recommendation) => void;
  onSave?: (r: Recommendation) => void;
  /** причина приходит вторым нажатием — из ReasonPicker; без неё «Не сейчас» только раскрывает его */
  onDismiss?: (r: Recommendation, reason: DismissReason) => void;
}

export function RecommendationCard({
  recommendation: r, previous, variant, expanded, showDetails, spoilerLevel = 0, finished, onStart, onSave, onDismiss,
}: RecommendationCardProps) {
  const [reasonsOpen, setReasonsOpen] = useState(false);
  const work = r.work;
  const slot = ui.slot[r.slot];
  const hero = r.slot === 'next_step' && variant !== 'compact';
  const size = hero ? 'md' : 'sm';
  return (
    <article className={cx('tm-rec', `tm-rec--${r.slot}`, hero && 'tm-rec--hero')}
             aria-label={`${slot.label}: ${titleOf(work)}`}>
      {previous ? (
        <div className="tm-rec__prev">
          <p className="tm-rec__prevlabel">{ui.explanation.previousFrame}</p>
          <h4 className="tm-rec__prevtitle">{titleOf(previous.work)}</h4>
          {previous.purpose ? <p className="tm-rec__prevpurpose">{previous.purpose}</p> : null}
        </div>
      ) : null}
      {previous ? (
        <div className="tm-rec__splice">
          <span className="tm-rec__splicemark" aria-hidden="true">+</span>
          <p className="tm-rec__splicetext">{ui.explanation.splice + r.explanation.whyNow}</p>
        </div>
      ) : null}
      <div className="tm-rec__slot">
        <span className="tm-rec__slotlabel" title={slot.note}>{slot.label}</span>
        <StretchIndicator level={r.stretch} variant="caps" />
      </div>
      <div className="tm-rec__main">
        <WorkCover work={work} size={size} />
        <div className="tm-rec__body">
          <h3 className={cx('tm-rec__title', hero && 'tm-rec__title--hero')}>
            <Link to={`/works/${work.id}`} className="tm-link--plain">{titleOf(work)}</Link>
          </h3>
          {/* антология (Е4): рекомендован сезон — он отдельная история */}
          <Meta items={[...workMeta(work), r.season ? ui.seriesPart(r.season) : undefined]} />
          <div className="tm-row tm-row--wrap tm-row--gap-1 tm-rec__ops">
            {work.primaryOperations.slice(0, hero ? 3 : 2).map((o) => (
              <OperationChip key={o.op} op={o.op} size="sm" short={!hero}
                             intensity={o.intensity} showDetails={showDetails} />
            ))}
          </div>
        </div>
      </div>
      <ExplanationBlock explanation={r.explanation} defaultOpen={expanded} omitWhyNow={Boolean(previous)} />
      {r.readiness.ready ? null : <ReadinessNotice readiness={r.readiness} />}
      {r.analyses?.length || r.discussions?.length ? (
        <div className="tm-rec__voices">
          {r.analyses?.length ? (
            <div className="tm-rec__voice">
              <span className="tm-label tm-rec__voicelabel">{ui.work.analyses}</span>
              {r.analyses.map((a) => <ExternalAnalysisLink key={a.id} analysis={a} spoilerLevel={finished ? 2 : spoilerLevel} />)}
            </div>
          ) : null}
          {r.discussions?.length ? (
            <div className="tm-rec__voice">
              <span className="tm-label tm-rec__voicelabel">{ui.work.discussions}</span>
              {r.discussions.map((d) => <DiscussionLink key={d.id} discussion={d} locked={d.spoilers && !finished} />)}
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="tm-rec__actions">
        <Button variant="primary" size={hero ? 'md' : 'sm'} onClick={() => onStart?.(r)}>
          {isScreen(work) ? ui.actions.startFilm : ui.actions.startBook}
        </Button>
        <Button size={hero ? 'md' : 'sm'} onClick={() => onSave?.(r)}>{ui.actions.save}</Button>
        <Button variant="quiet" size={hero ? 'md' : 'sm'} pressed={reasonsOpen}
                onClick={() => setReasonsOpen(!reasonsOpen)}>
          {ui.actions.dismiss}
        </Button>
      </div>
      {reasonsOpen ? <ReasonPicker variant="dismiss" onPick={(reason) => onDismiss?.(r, reason)} /> : null}
    </article>
  );
}
