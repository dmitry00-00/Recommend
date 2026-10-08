import { useState, type ReactNode } from 'react';
import { Button } from './Button';
import ui from '@/i18n';

export interface SpoilerGuardProps {
  title?: string;
  note?: string;
  defaultOpen?: boolean;
  children?: ReactNode;
}

/** Штора над устройством сюжета: закрыта штриховкой, открывается только по явному
 *  действию. Открытое состояние помечено и сворачивается обратно. */
export function SpoilerGuard({ title, note, defaultOpen, children }: SpoilerGuardProps) {
  const [open, setOpen] = useState(Boolean(defaultOpen));
  if (open) {
    return (
      <div className="tm-spoiler tm-spoiler--open">
        <div className="tm-spoiler__bar">
          <span className="tm-spoiler__state">{ui.spoiler.open}</span>
          <Button size="sm" variant="quiet" onClick={() => setOpen(false)}>{ui.actions.hide}</Button>
        </div>
        {children}
      </div>
    );
  }
  return (
    <div className="tm-spoiler">
      <span className="tm-spoiler__hatch" aria-hidden="true" />
      <p className="tm-spoiler__title">{title ?? ui.spoiler.title}</p>
      <p className="tm-spoiler__note">{note ?? ui.spoiler.note}</p>
      <Button size="sm" onClick={() => setOpen(true)}>{ui.actions.openNow}</Button>
    </div>
  );
}
