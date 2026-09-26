import type { ReactNode } from 'react';
import type { WorkCard } from '@/types/tmdf';
import { Meta } from './Meta';
import { OperationChip } from './OperationChip';
import { WorkCover } from './WorkCover';
import { workMeta } from '@/lib/format';
import { cx } from '@/lib/cx';

export interface WorkHeaderProps {
  work: WorkCard;
  compact?: boolean;
  /** false — без обложки (когда она уже стоит рядом) */
  cover?: false;
  showDetails?: boolean;
  /** барьеры, действия — всё, что стоит под операциями */
  children?: ReactNode;
}

/** Шапка произведения: обложка-кадр, название, оригинал, мета, три главные операции. */
export function WorkHeader({ work, compact, cover, showDetails, children }: WorkHeaderProps) {
  return (
    <header className={cx('tm-workhead', compact && 'tm-workhead--compact')}>
      {cover === false ? null : <WorkCover work={work} size={compact ? 'md' : 'lg'} />}
      <div className="tm-workhead__body">
        <h1 className="tm-workhead__title">{work.title}</h1>
        {work.originalTitle ? <p className="tm-workhead__original">{work.originalTitle}</p> : null}
        <Meta items={[...workMeta(work), (work.countries ?? []).join(', ')]} />
        <div className="tm-row tm-row--wrap tm-row--gap-1 tm-workhead__ops">
          {work.primaryOperations.slice(0, 3).map((o) => (
            <OperationChip key={o.op} op={o.op} intensity={o.intensity} showDetails={showDetails} short />
          ))}
        </div>
        {children}
      </div>
    </header>
  );
}
