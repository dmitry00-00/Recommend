import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AfterwordPatch, WorkCard } from '@/types/tmdf';
import { askWorthFor, markWork, nextExtraFor, setAfterword } from '@/api';
import type { Extra } from '@/lib/model/afterword';
import { AfterwordAsk } from './AfterwordAsk';
import { Button } from './Button';
import { RatingWheel } from './RatingWheel';
import { useToast } from './Toast';
import { pick, tap } from '@/lib/telegram';
import ui from '@/i18n';

type Score = 1 | 2 | 3 | 4 | 5;
/** ряд оценки (и послесловия) сворачивается обратно, если его не трогали столько, мс (17.10: вместо кнопки «Назад») */
const RATE_IDLE_MS = 6000;
/** сколько живёт тост «Бросили» с «Вернуть»: запись уходит, только когда отменить уже нельзя */
const UNDO_MS = 5000;

export interface QuickMarkProps {
  work: WorkCard;
  /** главная кнопка — «Посмотрел», иначе обе тихие (в ленте над кадром) */
  primary?: boolean;
  disabled?: boolean;
  /** что ещё поставить в ряд: «В планы», «Вернуть в планы» */
  extra?: ReactNode;
  /** класс ряда кнопок вместо обычного переносящегося ряда — карточка ставит их сеткой в одну линию */
  rowClassName?: string;
  /** «Бросил» в ряду (по умолчанию да). Для фильма из ленты его нет: он ещё не начат — только «Видел» */
  abandon?: boolean;
  /** подпись главной кнопки вместо «Посмотрел» — у фильма из ленты «Видел» */
  label?: string;
  onDone?: (status: 'finished' | 'abandoned') => void;
}

/** Облегчённый учёт (02.10): «Посмотрел» раскрывает барабан оценки — одно касание, и
 *  записано; «Бросил» — без вопросов. Подробный дневник (чек-ин, части, сезоны) — за настройкой
 *  `diary`; эта кнопка — то, что видит новый человек.
 *  17.10: после «Видел» — только барабан и компактное «Без оценки», без «Как вам?» и «Назад»: ряд сворачивается сам
 *  касанием мимо или по бездействию. Если вторых ответов два («Бросил(а)» и ещё что-то — карточка «Сейчас»), в ряду
 *  одна главная кнопка и «⋯», остальное — за ним. «Бросил(а)» отменяется «Вернуть» в тосте: запись уходит после него.
 *  Послесловие (17.10): после оценки по правилам askWorthFor на месте барабана — второй, «Стоило ли?», затем иногда один
 *  вопрос о человеке (темп / что держало). Всё необязательно: оценка уже записана, ряд сворачивается сам. `onDone`
 *  зовётся, когда ряд свернулся, — карточки по нему закрываются, и вопрос ушёл бы вместе с ними. */
export function QuickMark({ work, primary, disabled, extra, rowClassName, abandon = true, label, onDone }: QuickMarkProps) {
  const toast = useToast();
  const navigate = useNavigate();
  const [step, setStep] = useState<'idle' | 'rate' | 'worth' | 'extra'>('idle');
  // послесловие: оценка, после которой спрашиваем, и какой доп. вопрос
  const [rated, setRated] = useState<Score>(3);
  const [extraQ, setExtraQ] = useState<Extra>('pace');
  // отметка записана, а onDone ждёт, пока свернётся послесловие
  const pending = useRef<'finished' | 'abandoned' | undefined>(undefined);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const [busy, setBusy] = useState(false);
  const [more, setMore] = useState(false);
  const [dropping, setDropping] = useState(false);
  const book = work.type === 'book';
  const group = useRef<HTMLDivElement>(null);
  const idle = useRef<number | undefined>(undefined);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      window.clearTimeout(idle.current);
      // карточку закрыли, пока висело послесловие: отметка записана — сообщаем о ней
      const st = pending.current;
      pending.current = undefined;
      if (st) doneRef.current?.(st);
    };
  }, []);
  // свернуть ряд; если отметка ждала послесловия — теперь сообщить о ней
  const finish = () => {
    window.clearTimeout(idle.current);
    const st = pending.current;
    pending.current = undefined;
    setStep('idle');
    if (st) doneRef.current?.(st);
  };

  const send = (status: 'finished' | 'abandoned', rating?: Score, quiet = false) => {
    if (alive.current) setBusy(true);
    markWork(work.id, { status, ...(rating ? { rating } : {}) })
      .then(({ rated, needed, counted }) => {
        if (!quiet) {
          const done = book ? ui.quick.doneRead : ui.quick.doneWatched;
          // пока ленты нет — говорим, сколько осталось до неё: это и есть онбординг. Оценка фильма,
          // которого модель не знает, порог не двигает — честно говорим и ведём в колоду
          const left = needed - rated;
          if (rating && left > 0 && !counted) {
            toast({ text: `${done} · ${ui.quick.notCounted(left)}`, action: ui.quick.toDeck, onAction: () => navigate('/rate') });
          } else {
            const tail = rating && left > 0 ? ` · ${ui.quick.more(left)}` : rating && left === 0 && counted ? ` · ${ui.quick.ready}` : '';
            toast({ text: `${done}${tail}` });
          }
        }
        if (alive.current && status === 'finished' && rating && askWorthFor(work.id, rating)) {
          pending.current = status;
          setRated(rating);
          setStep('worth');
          return;
        }
        if (alive.current) setStep('idle');
        onDone?.(status);
      })
      .catch(() => toast({ text: ui.settings.errorSave }))
      .finally(() => { if (alive.current) { setBusy(false); setDropping(false); } });
  };

  // «Бросил(а)» с отменой (17.10): тост сразу, запись — когда «Вернуть» уже не нажать. Таймер не привязан к
  // шторке: закрыли её — бросок всё равно запишется
  const drop = () => {
    tap();
    setDropping(true);
    let undone = false;
    const timer = window.setTimeout(() => { if (!undone) send('abandoned', undefined, true); }, UNDO_MS);
    toast({
      text: ui.quick.doneAbandoned, action: ui.quick.undo, duration: UNDO_MS,
      onAction: () => { undone = true; window.clearTimeout(timer); if (alive.current) { setDropping(false); setMore(false); } },
    });
  };

  // ряд оценки и послесловия сворачивается сам: по бездействию и касанием мимо него
  const finishRef = useRef(finish);
  finishRef.current = finish;
  useEffect(() => {
    if (step === 'idle') return;
    const rest = () => { window.clearTimeout(idle.current); idle.current = window.setTimeout(() => finishRef.current(), RATE_IDLE_MS); };
    const outside = (e: PointerEvent) => {
      if (group.current?.contains(e.target as Node)) rest();
      else finishRef.current();
    };
    rest();
    document.addEventListener('pointerdown', outside, true);
    return () => { document.removeEventListener('pointerdown', outside, true); window.clearTimeout(idle.current); };
  }, [step]);

  // «Стоило ли?» — на месте барабана оценки; ответ записывается сразу, ошибка — тостом (оценка уже записана)
  const worthPicked = (w: Score) => {
    pick();
    setAfterword(work.id, { worth: w }).catch(() => toast({ text: ui.settings.errorSave }));
    const next = nextExtraFor(work.id, Math.max(rated, w));
    if (next) { setExtraQ(next); setStep('extra'); } else finish();
  };
  if (step === 'worth') {
    return (
      <div className="tm-quick" role="group" aria-label={ui.checkin.worthQ} ref={group}>
        <span className="tm-quick__scale tm-quick__scale--worth">
          <RatingWheel key="worth" label={ui.checkin.worthQ} labels={ui.checkin.worthScale} good={4}
                       placeholder={ui.checkin.worthPick} onPick={worthPicked} />
          <span className="tm-quick__q">{ui.checkin.worthQ}</span>
        </span>
      </div>
    );
  }
  if (step === 'extra') {
    return (
      <div className="tm-quick" ref={group}>
        <AfterwordAsk kind={extraQ} onPick={(v) => {
          setAfterword(work.id, { [extraQ]: v } as AfterwordPatch).catch(() => toast({ text: ui.settings.errorSave }));
          finish();
        }} />
      </div>
    );
  }
  if (step === 'rate') {
    return (
      <div className="tm-quick" role="group" aria-label={ui.quick.how} ref={group}>
        {/* оценка барабаном (17.10): «Нормально» — одним нажатием, остальное — прокруткой */}
        <span className="tm-quick__scale">
          <RatingWheel label={ui.rate.scaleLabel(work.title)} disabled={busy} onPick={(s) => { pick(); send('finished', s); }} />
          <Button size="sm" variant="quiet" className="tm-quick__norate" disabled={busy}
                  onClick={() => { tap(); send('finished'); }}>{ui.quick.noRating}</Button>
        </span>
      </div>
    );
  }
  const size = primary ? 'md' : 'sm';
  const gaveUp = abandon ? (
    <Button variant="quiet" size={size} disabled={disabled || busy} onClick={drop}>
      {ui.feed.gaveUp}
    </Button>
  ) : null;
  // два вторых ответа — за «⋯» (карточка «Сейчас»); один — рядом с главной кнопкой, как было
  const fold = Boolean(abandon && extra);
  // пока тост с «Вернуть» на экране — в ряду одна пометка «Брошено», остальные ответы не нужны
  if (dropping) {
    return (
      <div className={rowClassName ?? 'tm-row tm-row--gap-2 tm-row--wrap tm-quick'}>
        <Button variant="quiet" size={size} disabled loading={busy}>{ui.quick.abandonedMark}</Button>
      </div>
    );
  }
  return (
    <div className={rowClassName ?? 'tm-row tm-row--gap-2 tm-row--wrap tm-quick'}>
      <Button variant={primary ? 'primary' : 'secondary'} size={size} disabled={disabled || busy}
              onClick={() => { tap(); setStep('rate'); }}>
        {label ?? (book ? ui.quick.read : ui.quick.watched)}
      </Button>
      {fold && !more ? (
        <Button variant="quiet" size={size} className="tm-quick__more" aria-label={ui.quick.moreActions}
                disabled={disabled || busy} onClick={() => { tap(); setMore(true); }}>
          ⋯
        </Button>
      ) : (
        <>
          {gaveUp}
          {extra}
        </>
      )}
    </div>
  );
}
