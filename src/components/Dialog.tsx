import type { ReactNode } from 'react';
import * as RD from '@radix-ui/react-dialog';
import { Button } from './Button';
import ui from '@/i18n';

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children?: ReactNode;
  confirm?: string;
  cancel?: string;
  /** необратимое действие — красная кнопка */
  destructive?: boolean;
  busy?: boolean;
  onConfirm?: () => void;
}

/** Вопрос с двумя ответами. Radix даёт фокус-ловушку, Escape и возврат фокуса; разметка
 *  и классы — системные. Тело — короткое: что произойдёт и чего не вернуть. */
export function Dialog({ open, onOpenChange, title, children, confirm, cancel, destructive, busy, onConfirm }: DialogProps) {
  return (
    <RD.Root open={open} onOpenChange={onOpenChange}>
      <RD.Portal>
        <RD.Overlay className="tm-dialogwrap tm-overlay" />
        <RD.Content className="tm-dialog tm-overlay__dialog" aria-describedby={undefined}>
          <RD.Title className="tm-dialog__title">{title}</RD.Title>
          <div className="tm-dialog__body">{children}</div>
          <div className="tm-row tm-row--gap-2 tm-dialog__actions">
            <Button variant={destructive ? 'danger' : 'primary'} loading={busy} disabled={busy} onClick={onConfirm}>
              {confirm ?? ui.dialog.confirm}
            </Button>
            <Button variant="quiet" disabled={busy} onClick={() => onOpenChange(false)}>
              {cancel ?? ui.dialog.cancel}
            </Button>
          </div>
        </RD.Content>
      </RD.Portal>
    </RD.Root>
  );
}
