import { useEffect, useState } from 'react';
import { reportWorkIssue, type WorkIssueField } from '@/api';
import type { WorkCard } from '@/types/tmdf';
import { Button } from './Button';
import { Sheet } from './Sheet';
import { useToast } from './Toast';
import { pick, tap } from '@/lib/telegram';
import { cx } from '@/lib/cx';
import ui from '@/i18n';
import { titleOf } from '@/lib/format';

export interface WorkIssueSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  work: Pick<WorkCard, 'id' | 'title' | 'year' | 'type'>;
  /** где заметили: лента, архив, поиск, страница произведения */
  context?: string;
}

/** Порядок — от того, что видно сразу (название, год, кадр), к тому, что глубже в карточке. */
const FIELDS: WorkIssueField[] = ['title', 'year', 'people', 'image', 'synopsis', 'duration', 'type', 'watch', 'analyses', 'relations', 'heroes', 'other'];

/** «Нашли неточность?» (02.10): отметить, что в карточке не так, и по желанию написать, как надо.
 *  Уходит владельцу в очередь (worker: таблица work_issue), в карточке ничего не меняет — справочник
 *  чужому вводу сам не верит. Отметок можно несколько; без отметки, но с текстом — тоже можно. */
export function WorkIssueSheet({ open, onOpenChange, work, context }: WorkIssueSheetProps) {
  const toast = useToast();
  const [fields, setFields] = useState<WorkIssueField[]>([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setFields([]); setNote(''); } }, [open, work.id]);

  const toggle = (f: WorkIssueField) => { pick(); setFields((x) => (x.includes(f) ? x.filter((y) => y !== f) : [...x, f])); };
  const ready = fields.length > 0 || note.trim().length > 0;
  const send = () => {
    if (!ready || busy) return;
    tap();
    setBusy(true);
    reportWorkIssue(work, fields, note, context)
      .then((r) => { onOpenChange(false); toast({ text: r.ok ? ui.issue.sent : ui.suggest.offline }); })
      .catch(() => toast({ text: ui.suggest.failed }))
      .finally(() => setBusy(false));
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={ui.issue.title}>
      <p className="tm-body-sm">{ui.issue.lead(work.year ? `${titleOf(work)} (${work.year})` : titleOf(work))}</p>
      <div className="tm-issue__fields" role="group" aria-label={ui.issue.what}>
        {FIELDS.map((f) => (
          <button key={f} type="button" aria-pressed={fields.includes(f)}
                  className={cx('tm-voice__chip', fields.includes(f) && 'tm-voice__chip--on')} onClick={() => toggle(f)}>
            {ui.issue.field(f, work.type)}
          </button>
        ))}
      </div>
      <label className="tm-suggest__field">
        <span className="tm-label">{ui.issue.note}</span>
        <textarea className="tm-refl__area" rows={3} value={note} maxLength={500}
                  placeholder={ui.issue.notePlaceholder} onChange={(e) => setNote(e.target.value)} />
      </label>
      <p className="tm-caption">{ui.issue.why}</p>
      <div className="tm-suggest__acts">
        <Button onClick={send} disabled={!ready || busy}>{ui.suggest.send}</Button>
      </div>
    </Sheet>
  );
}
