import { useState } from 'react';
import type { ReflectionPromptData } from '@/types/tmdf';
import { Button } from './Button';
import { OperationGlyph } from './OperationGlyph';
import { cx } from '@/lib/cx';
import ui from '@/i18n';

export interface ReflectionPromptProps {
  prompt: ReflectionPromptData;
  maxLength?: number;
  onAnswer?: (value: string) => void;
  onSkip?: () => void;
}

/** Один вопрос после просмотра, помеченный операцией. Свободный текст или выбор; всё пропускаемо. */
export function ReflectionPrompt({ prompt: pr, maxLength = 600, onAnswer, onSkip }: ReflectionPromptProps) {
  const [value, setValue] = useState('');
  const id = `refl-${pr.id}`;
  return (
    <div className="tm-refl">
      <div className="tm-row tm-row--gap-1 tm-refl__head">
        <OperationGlyph op={pr.op} size={16} />
        <label className="tm-refl__q" htmlFor={id}>{pr.question}</label>
      </div>
      {pr.kind === 'choice' ? (
        <div className="tm-row tm-row--wrap tm-row--gap-1">
          {(pr.options ?? []).map((o) => (
            <button key={o} type="button" className={cx('tm-refl__opt', value === o && 'tm-refl__opt--on')}
                    aria-pressed={value === o ? 'true' : 'false'}
                    onClick={() => { setValue(o); onAnswer?.(o); }}>
              {o}
            </button>
          ))}
        </div>
      ) : (
        <div>
          <textarea id={id} className="tm-refl__area" rows={3} maxLength={maxLength}
                    placeholder={ui.reflection.placeholder} value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onBlur={() => value && onAnswer?.(value)} />
          <p className="tm-refl__count">{`${value.length} / ${maxLength}`}</p>
        </div>
      )}
      <Button variant="quiet" size="sm" onClick={onSkip}>{ui.actions.skip}</Button>
    </div>
  );
}
