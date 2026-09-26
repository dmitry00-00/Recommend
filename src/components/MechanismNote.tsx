import { useState } from 'react';
import type { ContributorTask } from '@/types/tmdf';
import { Button } from './Button';
import { OperationGlyph } from './OperationGlyph';
import { operations } from '@/lib/operations';
import ru from '@/i18n/ru';

export type MechanismNoteTask = ContributorTask & { payload: Extract<ContributorTask['payload'], { kind: 'mechanism_note' }> };

export interface MechanismNoteProps {
  task: MechanismNoteTask;
  busy?: boolean;
  onSubmit?: (text: string, referenceUrl?: string) => void;
  onSkip?: () => void;
}

/** Заметка о механизме: два-три предложения своими словами и, если есть, ссылка на свой
 *  разбор. Терминология не обязательна — это сказано прямо в поле. */
export function MechanismNote({ task, busy, onSubmit, onSkip }: MechanismNoteProps) {
  const t = task.payload;
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const id = `mnote-${task.id}`;
  return (
    <section className="tm-mnote">
      <div className="tm-row tm-row--gap-1 tm-mnote__head">
        <OperationGlyph op={t.op} size={16} />
        <h3 className="tm-mnote__title">{`«${t.work.title}» · ${operations[t.op].name}`}</h3>
      </div>
      <label className="tm-mnote__prompt" htmlFor={id}>{t.prompt}</label>
      <textarea id={id} className="tm-refl__area" rows={4} maxLength={800} value={text}
                placeholder={ru.contribute.notePlaceholder} onChange={(e) => setText(e.target.value)} />
      <label className="tm-mnote__link">
        <span>{ru.contribute.referenceUrl}</span>
        <input type="url" className="tm-input" placeholder="https://" value={url} onChange={(e) => setUrl(e.target.value)} />
      </label>
      <div className="tm-row tm-row--gap-2">
        <Button variant="primary" size="sm" loading={busy} disabled={busy || !text.trim()}
                onClick={() => onSubmit?.(text.trim(), url.trim() || undefined)}>
          {ru.contribute.submit}
        </Button>
        <Button variant="quiet" size="sm" disabled={busy} onClick={onSkip}>{ru.actions.skip}</Button>
      </div>
    </section>
  );
}
