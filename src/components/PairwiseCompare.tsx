import { useState } from 'react';
import type { ContributorAnswer, ContributorTask, WorkCard } from '@/types/tmdf';
import { Button } from './Button';
import { WorkCover } from './WorkCover';
import { operations } from '@/lib/operations';
import { cx } from '@/lib/cx';
import ui from '@/i18n';

type Choice = Extract<ContributorAnswer, { kind: 'pairwise' }>['choice'];
export type PairwiseTask = ContributorTask & { payload: Extract<ContributorTask['payload'], { kind: 'pairwise' }> };

export interface PairwiseCompareProps {
  task: PairwiseTask;
  value?: Choice;
  onAnswer?: (choice: Choice) => void;
  onSkip?: () => void;
}

/** Сравнение пары по одному умению: два кадра, «одинаково», «не могу судить». Определение
 *  операции — под спойлером, чтобы не подсказывать. Чужих ответов здесь нет намеренно. */
export function PairwiseCompare({ task, value, onAnswer, onSkip }: PairwiseCompareProps) {
  const t = task.payload;
  const [val, setVal] = useState<Choice | null>(value ?? null);
  const meta = operations[t.op];
  const pick = (c: Choice) => { setVal(c); onAnswer?.(c); };
  const side = (w: WorkCard, key: 'left' | 'right', hint: string) => {
    const on = val === key;
    return (
      <button type="button" className={cx('tm-pair__side', on && 'tm-pair__side--on')}
              aria-pressed={on ? 'true' : 'false'} onClick={() => pick(key)}>
        <WorkCover work={w} size="md" />
        <span className="tm-pair__title">{w.title}</span>
        <span className="tm-pair__key">{hint}</span>
      </button>
    );
  };
  return (
    <section className="tm-pair">
      <h3 className="tm-pair__q">{t.question}</h3>
      <details className="tm-pair__def">
        <summary>{ui.contribute.whatCounts(meta.name.toLowerCase())}</summary>
        <p>{`${meta.line}.`}</p>
      </details>
      <div className="tm-pair__sides">
        {side(t.left, 'left', '←')}
        {side(t.right, 'right', '→')}
      </div>
      <div className="tm-row tm-row--gap-2 tm-row--wrap tm-pair__rest">
        <Button size="sm" variant={val === 'equal' ? 'primary' : 'secondary'} onClick={() => pick('equal')}>{ui.contribute.equal}</Button>
        <Button size="sm" variant={val === 'cant_judge' ? 'primary' : 'secondary'} onClick={() => pick('cant_judge')}>{ui.contribute.cantJudge}</Button>
        <Button size="sm" variant="quiet" onClick={onSkip}>{ui.actions.skip}</Button>
      </div>
      <p className="tm-pair__note">{ui.contribute.independent}</p>
    </section>
  );
}
