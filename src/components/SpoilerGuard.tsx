import { useState, type ReactNode } from 'react';
import { Button } from './Button';
import ru from '@/i18n/ru';

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
          <span className="tm-spoiler__state">{ru.spoiler.open}</span>
          <Button size="sm" variant="quiet" onClick={() => setOpen(false)}>{ru.actions.hide}</Button>
        </div>
        {children}
      </div>
    );
  }
  return (
    <div className="tm-spoiler">
      <span className="tm-spoiler__hatch" aria-hidden="true" />
      <p className="tm-spoiler__title">{title ?? ru.spoiler.title}</p>
      <p className="tm-spoiler__note">{note ?? ru.spoiler.note}</p>
      <Button size="sm" onClick={() => setOpen(true)}>{ru.actions.openNow}</Button>
    </div>
  );
}
