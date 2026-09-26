import { useState } from 'react';
import type { ContributorAnswer, ContributorTask } from '@/types/tmdf';
import { cx } from '@/lib/cx';
import ru from '@/i18n/ru';

export type DesireCheckTask = ContributorTask & { payload: Extract<ContributorTask['payload'], { kind: 'desire_check' }> };
type Verdict = 'agree' | 'disagree' | 'unsure';
type Items = Extract<ContributorAnswer, { kind: 'desire_check' }>['items'];

export interface DesireCheckProps {
  task: DesireCheckTask;
  onChange?: (items: Items) => void;
}

const VERDICTS: Verdict[] = ['agree', 'disagree', 'unsure'];

/** Проверка подавленных желаний: по каждому герою — что хочет вслух и что, по версии модели,
 *  на самом деле; согласен / нет / не уверен(а), при «нет» — своя версия. Сверх бандла:
 *  собрано на классах TropeCheckList (строка кандидата, кнопки-вердикты), своих стилей нет. */
export function DesireCheck({ task, onChange }: DesireCheckProps) {
  const t = task.payload;
  const [verdicts, setVerdicts] = useState<Record<string, Verdict>>({});
  const [alternatives, setAlternatives] = useState<Record<string, string>>({});
  const emit = (v: Record<string, Verdict>, a: Record<string, string>) => {
    const items: Items = t.candidates
      .filter((c) => v[c.character])
      .map((c) => ({ character: c.character, verdict: v[c.character],
                     alternative: v[c.character] === 'disagree' && a[c.character]?.trim() ? a[c.character].trim() : undefined }));
    onChange?.(items);
  };
  return (
    <section className="tm-tropecheck">
      <h3 className="tm-tropecheck__title">{ru.contribute.whichDesires(t.work.title)}</h3>
      <ul className="tm-tropecheck__list">
        {t.candidates.map((c) => (
          <li key={c.character} className="tm-tropecheck__row">
            <p className="tm-tropecheck__name">{c.character}</p>
            <p className="tm-tropecheck__def">
              <span className="tm-label">{ru.desire.explicit}</span>{` ${c.explicit}`}
              {c.suppressed ? <><br /><span className="tm-label">{ru.desire.suppressed}</span>{` ${c.suppressed}`}</> : null}
            </p>
            <div className="tm-row tm-row--gap-1 tm-row--wrap">
              {VERDICTS.map((v) => {
                const on = verdicts[c.character] === v;
                return (
                  <button key={v} type="button" className={cx('tm-tropecheck__v', on && 'tm-tropecheck__v--on')}
                          aria-pressed={on ? 'true' : 'false'}
                          onClick={() => { const nv = { ...verdicts, [c.character]: v }; setVerdicts(nv); emit(nv, alternatives); }}>
                    {ru.contribute.desireVerdict[v]}
                  </button>
                );
              })}
            </div>
            {verdicts[c.character] === 'disagree' ? (
              <input className="tm-input" placeholder={ru.contribute.alternativePlaceholder} value={alternatives[c.character] ?? ''}
                     onChange={(e) => { const na = { ...alternatives, [c.character]: e.target.value }; setAlternatives(na); emit(verdicts, na); }} />
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
