import { useEffect, useRef, useState, type ReactNode } from 'react';
import * as RD from '@radix-ui/react-dialog';
import { useNavigate } from 'react-router-dom';
import type { WorkCard } from '@/types/tmdf';
import { WorkBanner } from './WorkBanner';
import { WorkIssueSheet } from './WorkIssueSheet';
import { ShareButton } from './ShareButton';
import { getPlot } from '@/api';
import { useSwipe } from '@/lib/swipe';
import { showBackButton, tap } from '@/lib/telegram';
import ui from '@/i18n';
import { titleOf } from '@/lib/format';

/** на сколько пикселей смахнуть карточку вбок, чтобы вернуться в ленту */
const DISMISS = 96;

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
  /** где открыта карточка — для сообщения о неточности: лента, архив, поиск */
  context?: string;
  children?: ReactNode;
}

/** Карточка произведения в модальном окне: баннер прижат к самому верху, всё остальное —
 *  описание, каналы, где посмотреть, действия — ниже и листается отдельно от ленты
 *  (21.09, по замечанию). На Radix Dialog: ловушка фокуса, Escape, возврат фокуса на баннер
 *  ленты. Ширина — телефонная рамка оболочки. Компонента в дизайн-системе нет. */
export function WorkSheet({ work, open, onOpenChange, meta, tag, plot, context, children }: WorkSheetProps) {
  const [issue, setIssue] = useState(false);
  const navigate = useNavigate();
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
      getPlot(work.id).then((t) => { if (t) setText(t); }).catch(() => undefined).finally(() => setLoading(false));
    }
    setPlotOpen(!plotOpen);
  };
  // Возврат в ленту (06.10, решение владельца): карточку целиком смахивают вбок — в любую
  // сторону, она уходит за пальцем; не дотянул — встаёт на место. Ленты авторов и кинотеатров
  // жест не трогает (useSwipe), вертикальную прокрутку ведёт браузер. «Назад» Telegram делает
  // то же: его обработчик встаёт поверх экранного, пока карточка открыта.
  const card = useRef<HTMLDivElement>(null);
  const settle = (el: HTMLElement | null) => { if (el) { el.style.transition = ''; el.style.transform = ''; el.style.opacity = ''; } };
  useEffect(() => { if (shown) settle(card.current); }, [shown]);
  const swipe = useSwipe({
    enabled: shown,
    onMove(dx) {
      const el = card.current;
      if (!el) return;
      el.style.transition = dx ? 'none' : '';
      el.style.transform = dx ? `translateX(${Math.round(dx)}px)` : '';
      el.style.opacity = dx ? String(Math.max(0.5, 1 - Math.abs(dx) / 700)) : '';
    },
    onEnd(dx) {
      const el = card.current;
      if (Math.abs(dx) < DISMISS) { settle(el); return; }
      tap();
      if (el) {
        el.style.transition = 'transform 0.16s ease-out, opacity 0.16s ease-out';
        el.style.transform = `translateX(${dx > 0 ? '' : '-'}110%)`;
        el.style.opacity = '0';
      }
      setTimeout(() => onOpenChange(false), 150);
    },
  });
  const closeRef = useRef(onOpenChange);
  closeRef.current = onOpenChange;
  useEffect(() => (shown ? showBackButton(() => closeRef.current(false)) : undefined), [shown]);
  // Открывается не через Trigger, поэтому фокус на баннер ленты возвращаем сами.
  const returnTo = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (shown && document.activeElement instanceof HTMLElement) returnTo.current = document.activeElement;
  }, [shown]);
  return (
    <RD.Root open={shown} onOpenChange={onOpenChange}>
      <RD.Portal>
        <RD.Overlay className="tm-overlay" />
        <RD.Content ref={card} className="tm-worksheet" aria-describedby={undefined}
                    onCloseAutoFocus={(e) => { e.preventDefault(); returnTo.current?.focus(); }} {...swipe}>
          {work ? (
            <>
              <div className={`tm-worksheet__top${plotOpen ? ' tm-worksheet__top--plot' : ''}`}>
                <WorkBanner work={work} meta={meta} tag={plotOpen ? undefined : tag} expanded={plotOpen} onClick={togglePlot} />
                {plotOpen ? null : <span className="tm-worksheet__plothint" aria-hidden="true">{ui.plot.hint}</span>}
                <RD.Title className="tm-sr">{titleOf(work)}</RD.Title>
                {/* неточность в карточке (02.10): флажок в левом верхнем углу кадра, напротив «закрыть» */}
                <button type="button" className="tm-worksheet__report" aria-label={ui.issue.buttonLabel} title={ui.issue.buttonLabel}
                        onClick={() => setIssue(true)}>
                  <span aria-hidden="true">⚑</span>
                </button>
                {/* полная страница (ТВ-4, 06.10): жест вбок занят возвратом в ленту, поэтому — кнопка
                    рядом с флажком; шторка закрывается, «Назад» со страницы ведёт в ленту */}
                <button type="button" className="tm-worksheet__page" aria-label={ui.plot.pageLabel}
                        onClick={() => { const id = work.id; onOpenChange(false); navigate(`/works/${id}`); }}>
                  {ui.plot.page}
                </button>
                {/* «Поделиться» (05.10): рядом с «закрыть», ссылка открывает у друга эту же карточку */}
                <ShareButton work={work} round />
                <RD.Close className="tm-worksheet__close" aria-label={ui.actions.close}>
                  <span aria-hidden="true">×</span>
                </RD.Close>
              </div>
              {plotOpen ? (
                <div className="tm-worksheet__plot" role="region" aria-label={ui.plot.title}>
                  <p className="tm-body-sm">{text?.trim() || (loading ? ui.plot.loading : ui.plot.none)}</p>
                </div>
              ) : null}
              <div className="tm-worksheet__body">
                {/* подпись «Кадр: …» убрана из карточки 24.09: она сдвигала страницу и давала
                    прокрутку. Атрибуция источников (TMDb требует её) — в настройках, «Откуда данные» */}
                {children}
              </div>
              <WorkIssueSheet open={issue} onOpenChange={setIssue} work={work} context={context} />
            </>
          ) : null}
        </RD.Content>
      </RD.Portal>
    </RD.Root>
  );
}
