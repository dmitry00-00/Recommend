import { useEffect, useRef, type ReactNode } from 'react';
import * as RD from '@radix-ui/react-dialog';
import type { WorkCard } from '@/types/tmdf';
import { WorkBanner } from './WorkBanner';
import ru from '@/i18n/ru';

export interface WorkSheetProps {
  work: WorkCard | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** строка под названием на баннере */
  meta?: ReactNode;
  tag?: string;
  children?: ReactNode;
}

/** Карточка произведения в модальном окне: баннер прижат к самому верху, всё остальное —
 *  описание, каналы, где посмотреть, действия — ниже и листается отдельно от ленты
 *  (21.09, по замечанию). На Radix Dialog: ловушка фокуса, Escape, возврат фокуса на баннер
 *  ленты. Ширина — телефонная рамка оболочки. Компонента в дизайн-системе нет. */
export function WorkSheet({ work, open, onOpenChange, meta, tag, children }: WorkSheetProps) {
  const shown = open && work != null;
  // Открывается не через Trigger, поэтому фокус на баннер ленты возвращаем сами.
  const returnTo = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (shown && document.activeElement instanceof HTMLElement) returnTo.current = document.activeElement;
  }, [shown]);
  return (
    <RD.Root open={shown} onOpenChange={onOpenChange}>
      <RD.Portal>
        <RD.Overlay className="tm-overlay" />
        <RD.Content className="tm-worksheet" aria-describedby={undefined}
                    onCloseAutoFocus={(e) => { e.preventDefault(); returnTo.current?.focus(); }}>
          {work ? (
            <>
              <div className="tm-worksheet__top">
                <WorkBanner work={work} meta={meta} tag={tag} />
                <RD.Title className="tm-sr">{work.title}</RD.Title>
                <RD.Close className="tm-worksheet__close" aria-label={ru.actions.close}>
                  <span aria-hidden="true">×</span>
                </RD.Close>
              </div>
              <div className="tm-worksheet__body">
                {/* подпись «Кадр: …» убрана из карточки 24.09: она сдвигала страницу и давала
                    прокрутку. Атрибуция источников (TMDb требует её) — в настройках, «Откуда данные» */}
                {children}
              </div>
            </>
          ) : null}
        </RD.Content>
      </RD.Portal>
    </RD.Root>
  );
}
