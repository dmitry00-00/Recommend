import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { WorkCard } from '@/types/tmdf';
import { markWork } from '@/api';
import { Button } from './Button';
import { useToast } from './Toast';
import { pick, tap } from '@/lib/telegram';
import ui from '@/i18n';

type Score = 1 | 2 | 3 | 4 | 5;
const SCORES: Score[] = [1, 2, 3, 4, 5];

export interface QuickMarkProps {
  work: WorkCard;
  /** главная кнопка — «Посмотрел», иначе обе тихие (в ленте над кадром) */
  primary?: boolean;
  disabled?: boolean;
  /** что ещё поставить в ряд: «В планы», «Ещё не смотрел» */
  extra?: ReactNode;
  /** класс ряда кнопок вместо обычного переносящегося ряда — карточка ставит их сеткой в одну линию */
  rowClassName?: string;
  onDone?: (status: 'finished' | 'abandoned') => void;
}

/** Облегчённый учёт (02.10): «Посмотрел» раскрывает шкалу из пяти слов — одно касание, и
 *  записано; «Бросил» — без вопросов. Подробный дневник (чек-ин, части, сезоны) — за настройкой
 *  `diary`; эта кнопка — то, что видит новый человек. */
export function QuickMark({ work, primary, disabled, extra, rowClassName, onDone }: QuickMarkProps) {
  const toast = useToast();
  const navigate = useNavigate();
  const [step, setStep] = useState<'idle' | 'rate'>('idle');
  const [busy, setBusy] = useState(false);
  const book = work.type === 'book';

  const send = (status: 'finished' | 'abandoned', rating?: Score) => {
    setBusy(true);
    markWork(work.id, { status, ...(rating ? { rating } : {}) })
      .then(({ rated, needed, counted }) => {
        const done = status === 'abandoned' ? ui.quick.doneAbandoned : book ? ui.quick.doneRead : ui.quick.doneWatched;
        // пока ленты нет — говорим, сколько осталось до неё: это и есть онбординг. Оценка фильма,
        // которого модель не знает, порог не двигает — честно говорим и ведём в колоду
        const left = needed - rated;
        if (rating && left > 0 && !counted) {
          toast({ text: `${done} · ${ui.quick.notCounted(left)}`, action: ui.quick.toDeck, onAction: () => navigate('/rate') });
        } else {
          const tail = rating && left > 0 ? ` · ${ui.quick.more(left)}` : rating && left === 0 && counted ? ` · ${ui.quick.ready}` : '';
          toast({ text: `${done}${tail}` });
        }
        setStep('idle');
        onDone?.(status);
      })
      .catch(() => toast({ text: ui.settings.errorSave }))
      .finally(() => setBusy(false));
  };

  if (step === 'rate') {
    return (
      <div className="tm-quick" role="group" aria-label={ui.quick.how}>
        <span className="tm-caption tm-quick__how">{ui.quick.how}</span>
        <span className="tm-quick__scale">
          {SCORES.map((s) => (
            <Button key={s} size="sm" variant={s >= 4 ? 'primary' : 'secondary'} disabled={busy}
                    onClick={() => { pick(); send('finished', s); }}>
              {ui.rate.scale[s - 1]}
            </Button>
          ))}
        </span>
        <span className="tm-quick__scale">
          <Button size="sm" variant="quiet" disabled={busy} onClick={() => { tap(); send('finished'); }}>{ui.quick.noRating}</Button>
          <Button size="sm" variant="quiet" disabled={busy} onClick={() => { tap(); setStep('idle'); }}>{ui.quick.back}</Button>
        </span>
      </div>
    );
  }
  return (
    <div className={rowClassName ?? 'tm-row tm-row--gap-2 tm-row--wrap tm-quick'}>
      <Button variant={primary ? 'primary' : 'secondary'} size={primary ? 'md' : 'sm'} disabled={disabled || busy}
              onClick={() => { tap(); setStep('rate'); }}>
        {book ? ui.quick.read : ui.quick.watched}
      </Button>
      <Button variant="quiet" size={primary ? 'md' : 'sm'} disabled={disabled || busy} loading={busy}
              onClick={() => { tap(); send('abandoned'); }}>
        {ui.feed.gaveUp}
      </Button>
      {extra}
    </div>
  );
}
