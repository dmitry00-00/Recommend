import { useEffect, useRef, useState, type ReactNode } from 'react';
import * as RD from '@radix-ui/react-dialog';
import type { WorkCard } from '@/types/tmdf';
import { WorkBanner } from './WorkBanner';
import { getWork } from '@/api';
import ru from '@/i18n/ru';

export interface WorkSheetProps {
  work: WorkCard | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** строка под названием на баннере */
  meta?: ReactNode;
  tag?: string;
  /** фабула, если она уже есть под рукой (у рекомендации — «что это»); нет — спросим у api
   *  при первом тапе по баннеру */
  plot?: string;
  children?: ReactNode;
}

/** Карточка произведения в модальном окне: баннер прижат к самому верху, всё остальное —
 *  описание, каналы, где посмотреть, действия — ниже и листается отдельно от ленты
 *  (21.09, по замечанию). На Radix Dialog: ловушка фокуса, Escape, возврат фокуса на баннер
 *  ленты. Ширина — телефонная рамка оболочки. Компонента в дизайн-системе нет. */
export function WorkSheet({ work, open, onOpenChange, meta, tag, plot, children }: WorkSheetProps) {
  const shown = open && work != null;
  // Фабула (02.10, предложение владельца): спрятана, чтобы не спорить с разборами. Тап по баннеру —
  // кадр уезжает вверх до шторки с названием, на освободившемся месте — описание со своей
  // прокруткой; тап по шторке — кадр возвращается.
  const [plotOpen, setPlotOpen] = useState(false);
  const [text, setText] = useState<string | undefined>(plot);
  const [asked, setAsked] = useState(false);
  const [loading, setLoading] = useState(false);
  useEffect(() => { setPlotOpen(false); setText(plot); setAsked(false); setLoading(false); }, [work?.id, plot]);
  const togglePlot = () => {
    if (!work) return;
    if (!plotOpen && !asked) {
      setAsked(true);
      setLoading(true);
      getWork(work.id).then((d) => { if (d?.synopsis?.trim()) setText(d.synopsis); }).catch(() => undefined).finally(() => setLoading(false));
    }
    setPlotOpen(!plotOpen);
  };
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
              <div className={`tm-worksheet__top${plotOpen ? ' tm-worksheet__top--plot' : ''}`}>
                <WorkBanner work={work} meta={meta} tag={plotOpen ? undefined : tag} expanded={plotOpen} onClick={togglePlot} />
                {plotOpen ? null : <span className="tm-worksheet__plothint" aria-hidden="true">{ru.plot.hint}</span>}
                <RD.Title className="tm-sr">{work.title}</RD.Title>
                <RD.Close className="tm-worksheet__close" aria-label={ru.actions.close}>
                  <span aria-hidden="true">×</span>
                </RD.Close>
              </div>
              {plotOpen ? (
                <div className="tm-worksheet__plot" role="region" aria-label={ru.plot.title}>
                  <p className="tm-body-sm">{text?.trim() || (loading ? ru.plot.loading : ru.plot.none)}</p>
                </div>
              ) : null}
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
