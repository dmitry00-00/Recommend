import { useState } from 'react';
import type { ContributorAnswer, ContributorTask, TropeUsageType, ValueCharge } from '@/types/tmdf';
import { Button } from './Button';
import { TropeUsagePicker } from './TropeUsagePicker';
import { ChargePicker } from './ChargePicker';
import { cx } from '@/lib/cx';
import ui from '@/i18n';
import { titleOf } from '@/lib/format';

export type TropeCheckTask = ContributorTask & { payload: Extract<ContributorTask['payload'], { kind: 'trope_check' }> };
type Verdict = 'present' | 'absent' | 'unsure';
type Items = Extract<ContributorAnswer, { kind: 'trope_check' }>['items'];

export interface TropeCheckListProps {
  task: TropeCheckTask;
  onChange?: (items: Items, missing: string[]) => void;
}

const VERDICTS: Verdict[] = ['present', 'absent', 'unsure'];

/** Какие приёмы действительно есть: по каждому кандидату — есть / нет / не уверен(а); у
 *  найденного — как использован и (сверх бандла) какой у него заряд. «Добавить недостающий
 *  приём» — строка свободного текста: кандидаты модели не исчерпывают список. */
export function TropeCheckList({ task, onChange }: TropeCheckListProps) {
  const t = task.payload;
  const [verdicts, setVerdicts] = useState<Record<string, Verdict>>({});
  const [usages, setUsages] = useState<Record<string, TropeUsageType>>({});
  const [charges, setCharges] = useState<Record<string, ValueCharge>>({});
  const [missing, setMissing] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');

  const emit = (v = verdicts, u = usages, m = missing) => {
    const items: Items = t.candidates
      .filter((c) => v[c.tropeId])
      .map((c) => ({ tropeId: c.tropeId, verdict: v[c.tropeId], usage: v[c.tropeId] === 'present' ? u[c.tropeId] : undefined }));
    onChange?.(items, m);
  };
  const setVerdict = (id: string, verdict: Verdict) => { const v = { ...verdicts, [id]: verdict }; setVerdicts(v); emit(v); };
  const setUsage = (id: string, usage: TropeUsageType) => { const u = { ...usages, [id]: usage }; setUsages(u); emit(verdicts, u); };
  const addMissing = () => {
    const name = draft.trim();
    if (!name) { setAdding(false); return; }
    const m = [...missing, name];
    setMissing(m); setDraft(''); setAdding(false); emit(verdicts, usages, m);
  };

  return (
    <section className="tm-tropecheck">
      <h3 className="tm-tropecheck__title">{ui.contribute.whichTropes(titleOf(t.work))}</h3>
      <ul className="tm-tropecheck__list">
        {t.candidates.map((c) => (
          <li key={c.tropeId} className="tm-tropecheck__row">
            <p className="tm-tropecheck__name">{c.name}</p>
            <p className="tm-tropecheck__def">{c.definition}</p>
            <div className="tm-row tm-row--gap-1 tm-row--wrap">
              {VERDICTS.map((v) => {
                const on = verdicts[c.tropeId] === v;
                return (
                  <button key={v} type="button" className={cx('tm-tropecheck__v', on && 'tm-tropecheck__v--on')}
                          aria-pressed={on ? 'true' : 'false'} onClick={() => setVerdict(c.tropeId, v)}>
                    {ui.contribute.verdict[v]}
                  </button>
                );
              })}
            </div>
            {verdicts[c.tropeId] === 'present' ? (
              <>
                <TropeUsagePicker value={usages[c.tropeId]} onPick={(u) => setUsage(c.tropeId, u)} />
                <ChargePicker value={charges[c.tropeId]} onPick={(ch) => setCharges({ ...charges, [c.tropeId]: ch })} />
              </>
            ) : null}
          </li>
        ))}
        {missing.map((name) => (
          <li key={`m-${name}`} className="tm-tropecheck__row">
            <p className="tm-tropecheck__name">{name}</p>
            <p className="tm-tropecheck__def">{ui.contribute.addedByYou}</p>
          </li>
        ))}
      </ul>
      {adding ? (
        <div className="tm-row tm-row--gap-2 tm-row--wrap">
          <input className="tm-input" value={draft} placeholder={ui.contribute.missingPlaceholder} autoFocus
                 onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addMissing()} />
          <Button size="sm" onClick={addMissing}>{ui.contribute.add}</Button>
        </div>
      ) : (
        <Button variant="quiet" size="sm" onClick={() => setAdding(true)}>{ui.contribute.addMissing}</Button>
      )}
    </section>
  );
}
