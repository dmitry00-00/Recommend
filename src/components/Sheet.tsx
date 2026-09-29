import type { ReactNode } from 'react';
import * as RD from '@radix-ui/react-dialog';
import { Button } from './Button';
import ru from '@/i18n/ru';

export interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children?: ReactNode;
}

/** Шторка снизу для второстепенного потока: заголовок, «Закрыть», тело. На Radix Dialog —
 *  та же ловушка фокуса и Escape; поднимается над домашним индикатором. */
export function Sheet({ open, onOpenChange, title, children }: SheetProps) {
  return (
    <RD.Root open={open} onOpenChange={onOpenChange}>
      <RD.Portal>
        <RD.Overlay className="tm-sheetwrap tm-overlay" />
        <RD.Content className="tm-sheet tm-overlay__sheet" aria-describedby={undefined}>
          <span className="tm-sheet__grip" aria-hidden="true" />
          <header className="tm-sheet__head">
            <RD.Title className="tm-sheet__title">{title}</RD.Title>
            <Button variant="quiet" size="sm" onClick={() => onOpenChange(false)}>{ru.actions.close}</Button>
          </header>
          <div className="tm-sheet__body">{children}</div>
        </RD.Content>
      </RD.Portal>
    </RD.Root>
  );
}
