import { useEffect, useRef, useState, type ReactNode } from 'react';
import * as RD from '@radix-ui/react-dialog';
import { useNavigate } from 'react-router-dom';
import type { WorkCard } from '@/types/tmdf';
import { WorkBanner } from './WorkBanner';
import { WorkIssueSheet } from './WorkIssueSheet';
import { useShare } from './ShareButton';
import { Hurdles } from './Hurdles';
import { Passport } from './Passport';
import { InlineTrailer, stopInlineTrailer, useTrailer } from './InlineTrailer';
import { getPlot } from '@/api';
import { useSwipe } from '@/lib/swipe';
import { isTelegram, onExternalClick, showBackButton, tap } from '@/lib/telegram';
import ui from '@/i18n';
import { titleOf } from '@/lib/format';
import { useDepthCard, useFeature } from '@/lib/flags';

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
  /** «Что может мешать» и предыдущая часть (ДФ-7) — карточке того, что ещё предлагают; начатому и виденному не нужно */
  hurdles?: boolean;
  children?: ReactNode;
}

/** Карточка произведения в модальном окне: баннер прижат к самому верху, всё остальное —
 *  описание, каналы, где посмотреть, действия — ниже и листается отдельно от ленты
 *  (21.09, по замечанию). На Radix Dialog: ловушка фокуса, Escape, возврат фокуса на баннер
 *  ленты. Ширина — телефонная рамка оболочки. Компонента в дизайн-системе нет. */
export function WorkSheet({ work, open, onOpenChange, meta, tag, plot, context, hurdles, children }: WorkSheetProps) {
  const [issue, setIssue] = useState(false);
  const navigate = useNavigate();
  const shown = open && work != null;
  // полная страница со всеми разделами — функция эталона (10.10)
  const pages = useFeature('pages');
  // карточка по глубине (15.10): паспорт иконками у любой карточки вместо строки «Что может мешать»
  const depth = useDepthCard();
  // шапка (17.10): ⚑ и «Поделиться» — одним меню «⋯»; × — только вне Telegram: там есть «Назад» и смахивание вбок
  const share = useShare({ work: work ?? undefined });
  const inTelegram = isTelegram();
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => { setMenu(false); }, [work?.id, shown]);
  useEffect(() => {
    if (!menu) return;
    const away = (e: PointerEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenu(false); };
    document.addEventListener('pointerdown', away, true);
    return () => document.removeEventListener('pointerdown', away, true);
  }, [menu]);
  // Фабула (02.10, предложение владельца): спрятана, чтобы не спорить с разборами. Тап по баннеру —
  // кадр уезжает вверх до шторки с названием, на освободившемся месте — описание со своей
  // прокруткой; тап по шторке — кадр возвращается.
  const [plotOpen, setPlotOpen] = useState(false);
  const [text, setText] = useState<string | undefined>(plot);
  const [asked, setAsked] = useState(false);
  const [loading, setLoading] = useState(false);
  // источник описания под текстом — когда лицензия требует (Википедия у книг, CC BY-SA)
  const [source, setSource] = useState<{ name: string; url: string }>();
  useEffect(() => { setPlotOpen(false); setText(plot); setSource(undefined); setAsked(false); setLoading(false); }, [work?.id, plot]);
  // трейлер на кадре карточки (17.10, владелец): ▶ — только когда ролик точно есть; играет на месте баннера, как в ленте.
  // Карточка открылась — ролик ленты под ней замолкает; пока играет свой — смахивание карточки выключено
  const trailer = useTrailer(shown ? work : null);
  const [playing, setPlaying] = useState(false);
  useEffect(() => { setPlaying(false); if (shown) stopInlineTrailer(); }, [work?.id, shown]);
  const togglePlot = () => {
    if (!work) return;
    if (!plotOpen && !asked) {
      setAsked(true);
      setLoading(true);
      getPlot(work.id).then((p) => { if (p) { setText(p.text); setSource(p.source); } }).catch(() => undefined).finally(() => setLoading(false));
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
    enabled: shown && !playing,
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
                    onCloseAutoFocus={(e) => { e.preventDefault(); returnTo.current?.focus(); }}
                    // фокус — в саму карточку и кадром позже (волна 3В): Radix ставил его на первую кнопку прямо в отрисовке
                    // открытия, и браузер раскладывал всю карточку лишний раз (~110 мс на слабом телефоне). Ловушка фокуса та же
                    onOpenAutoFocus={(e) => { e.preventDefault(); requestAnimationFrame(() => card.current?.focus({ preventScroll: true })); }}
                    onEscapeKeyDown={(e) => { if (menu) { e.preventDefault(); setMenu(false); } }} {...swipe}>
          {work ? (
            <>
              <div className={`tm-worksheet__top${plotOpen ? ' tm-worksheet__top--plot' : ''}${playing ? ' tm-worksheet__top--trailer' : ''}`}>
                {/* с открытым сюжетом кадр низкий — ▶ на нём нет; «YouTube» и «×» ролика — слева: справа «⋯» и «×» карточки */}
                <InlineTrailer work={work} trailer={plotOpen ? null : trailer} place="card" open={playing} onOpenChange={setPlaying} controls="start">
                  <WorkBanner work={work} meta={meta} tag={plotOpen ? undefined : tag} tagAbove expanded={plotOpen} onClick={togglePlot} />
                </InlineTrailer>
                {plotOpen || playing ? null : <span className="tm-worksheet__plothint" aria-hidden="true">{ui.plot.hint}</span>}
                <RD.Title className="tm-sr">{titleOf(work)}</RD.Title>
                {/* полная страница (ТВ-4, 06.10): жест вбок занят возвратом в ленту, поэтому — кнопка в углу кадра;
                    шторка закрывается, «Назад» со страницы ведёт в ленту. 17.10: «Вся страница» — слева, где был ⚑ */}
                {pages && !playing ? (
                  <button type="button" className="tm-worksheet__page" aria-label={ui.plot.pageLabel}
                          onClick={() => { const id = work.id; onOpenChange(false); navigate(`/works/${id}`); }}>
                    {ui.plot.page}
                  </button>
                ) : null}
                {/* «⋯» (17.10): «Поделиться» (05.10) и неточность в карточке (02.10) — редкие действия, в шапке им по кнопке не нужно */}
                <div ref={menuRef} className={`tm-worksheet__menuwrap${inTelegram ? ' tm-worksheet__menuwrap--edge' : ''}`}>
                  <button type="button" className="tm-worksheet__more" aria-label={ui.plot.menu} title={ui.plot.menu}
                          aria-haspopup="menu" aria-expanded={menu} onClick={() => { tap(); setMenu(!menu); }}>
                    <span aria-hidden="true">⋯</span>
                  </button>
                  {menu ? (
                    <div className="tm-worksheet__menu" role="menu">
                      {share ? (
                        <button type="button" role="menuitem" className="tm-worksheet__menuitem" onClick={() => { setMenu(false); void share(); }}>
                          <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 3v12" /><path d="M7 8l5-5 5 5" /><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
                          </svg>
                          {ui.share.button}
                        </button>
                      ) : null}
                      <button type="button" role="menuitem" className="tm-worksheet__menuitem" onClick={() => { tap(); setMenu(false); setIssue(true); }}>
                        <span aria-hidden="true">⚑</span> {ui.plot.menuIssue}
                      </button>
                    </div>
                  ) : null}
                </div>
                {inTelegram ? null : (
                  <RD.Close className="tm-worksheet__close" aria-label={ui.actions.close}>
                    <span aria-hidden="true">×</span>
                  </RD.Close>
                )}
              </div>
              {plotOpen ? (
                <div className="tm-worksheet__plot" role="region" aria-label={ui.plot.title}>
                  <p className="tm-body-sm">{text?.trim() || (loading ? ui.plot.loading : ui.plot.none)}</p>
                  {source && text ? (
                    <a className="tm-caption tm-worksheet__plotsrc" href={source.url} target="_blank" rel="noreferrer noopener" onClick={onExternalClick(source.url)}>
                      {ui.plot.source(source.name)}
                    </a>
                  ) : null}
                </div>
              ) : null}
              <div className="tm-worksheet__body">
                {/* подпись «Кадр: …» убрана из карточки 24.09: она сдвигала страницу и давала
                    прокрутку. Атрибуция источников (TMDb требует её) — в настройках, «Откуда данные» */}
                {depth ? <Passport work={work} hurdles={hurdles} /> : hurdles ? <Hurdles work={work} /> : null}
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
