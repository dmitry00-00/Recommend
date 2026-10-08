import { useState } from 'react';
import type { ContributorAnswer, ContributorTask } from '@/types/tmdf';
import { cx } from '@/lib/cx';
import ui from '@/i18n';
import { titleOf } from '@/lib/format';

export type BarrierVoteTask = ContributorTask & { payload: Extract<ContributorTask['payload'], { kind: 'barrier_vote' }> };
type Severity = 0 | 1 | 2 | 3 | null;
type Items = Extract<ContributorAnswer, { kind: 'barrier_vote' }>['items'];

export interface BarrierVoteProps {
  task: BarrierVoteTask;
  onChange?: (items: Items) => void;
}

const SEVERITIES: { v: Severity; label: string }[] = [
  { v: 0, label: ui.contribute.severity.none },
  { v: 1, label: ui.contribute.severity.weak },
  { v: 2, label: ui.contribute.severity.notable },
  { v: 3, label: ui.contribute.severity.strong },
  { v: null, label: ui.contribute.cantJudge },
];

/** Насколько заметны барьеры: по каждому — от «нет» до «сильный», «не могу судить» —
 *  пунктиром, это честный ответ, а не пропуск. */
export function BarrierVote({ task, onChange }: BarrierVoteProps) {
  const t = task.payload;
  const [val, setVal] = useState<Record<string, Severity>>({});
  const set = (kind: string, severity: Severity) => {
    const next = { ...val, [kind]: severity };
    setVal(next);
    onChange?.(t.barriers.filter((b) => b.kind in next).map((b) => ({ kind: b.kind, severity: next[b.kind] })));
  };
  return (
    <section className="tm-bvote">
      <h3 className="tm-bvote__title">{ui.contribute.howNoticeable(titleOf(t.work))}</h3>
      {t.barriers.map((b) => (
        <div key={b.kind} className="tm-bvote__row">
          <p className="tm-bvote__label">{b.label}</p>
          <div className="tm-row tm-row--gap-1 tm-row--wrap">
            {SEVERITIES.map((s) => {
              const on = b.kind in val && val[b.kind] === s.v;
              return (
                <button key={String(s.v)} type="button"
                        className={cx('tm-bvote__opt', on && 'tm-bvote__opt--on', s.v === null && 'tm-bvote__opt--none')}
                        aria-pressed={on ? 'true' : 'false'} onClick={() => set(b.kind, s.v)}>
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
}
