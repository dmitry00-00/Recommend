import { useState, type ReactNode } from 'react';
import type { WorkCard } from '@/types/tmdf';
import { markWork } from '@/api';
import { Button } from './Button';
import { useToast } from './Toast';
import { pick, tap } from '@/lib/telegram';
import ru from '@/i18n/ru';

type Score = 1 | 2 | 3 | 4 | 5;
const SCORES: Score[] = [1, 2, 3, 4, 5];

export interface QuickMarkProps {
  work: WorkCard;
  /** главная кнопка — «Посмотрел», иначе обе тихие (в ленте над кадром) */
  primary?: boolean;
  disabled?: boolean;
  /** что ещё поставить в ряд: «В планы», «Ещё не смотрел» */
  extra?: ReactNode;
  onDone?: (status: 'finished' | 'abandoned') => void;
}

/** Облегчённый учёт (02.10): «Посмотрел» раскрывает шкалу из пяти слов — одно касание, и
 *  записано; «Бросил» — без вопросов. Подробный дневник (чек-ин, части, сезоны) — за настройкой
 *  `diary`; эта кнопка — то, что видит новый человек. */
export function QuickMark({ work, primary, disabled, extra, onDone }: QuickMarkProps) {
  const toast = useToast();
  const [step, setStep] = useState<'idle' | 'rate'>('idle');
  const [busy, setBusy] = useState(false);
  const book = work.type === 'book';

  const send = (status: 'finished' | 'abandoned', rating?: Score) => {
    setBusy(true);
    markWork(work.id, { status, ...(rating ? { rating } : {}) })
      .then(({ rated, needed }) => {
        const done = status === 'abandoned' ? ru.quick.doneAbandoned : book ? ru.quick.doneRead : ru.quick.doneWatched;
        // пока ленты нет — говорим, сколько осталось до неё: это и есть онбординг
        const left = needed - rated;
        const tail = rating && left > 0 ? ` · ${ru.quick.more(left)}` : rating && left === 0 ? ` · ${ru.quick.ready}` : '';
        toast({ text: `${done}${tail}` });
        setStep('idle');
        onDone?.(status);
      })
      .catch(() => toast({ text: ru.settings.errorSave }))
      .finally(() => setBusy(false));
  };

  if (step === 'rate') {
    return (
      <div className="tm-quick" role="group" aria-label={ru.quick.how}>
        <span className="tm-caption tm-quick__how">{ru.quick.how}</span>
        <span className="tm-quick__scale">
          {SCORES.map((s) => (
            <Button key={s} size="sm" variant={s >= 4 ? 'primary' : 'secondary'} disabled={busy}
                    onClick={() => { pick(); send('finished', s); }}>
              {ru.rate.scale[s - 1]}
            </Button>
          ))}
        </span>
        <span className="tm-quick__scale">
          <Button size="sm" variant="quiet" disabled={busy} onClick={() => { tap(); send('finished'); }}>{ru.quick.noRating}</Button>
          <Button size="sm" variant="quiet" disabled={busy} onClick={() => { tap(); setStep('idle'); }}>{ru.quick.back}</Button>
        </span>
      </div>
    );
  }
  return (
    <div className="tm-row tm-row--gap-2 tm-row--wrap tm-quick">
      <Button variant={primary ? 'primary' : 'secondary'} size={primary ? 'md' : 'sm'} disabled={disabled || busy}
              onClick={() => { tap(); setStep('rate'); }}>
        {book ? ru.quick.read : ru.quick.watched}
      </Button>
      <Button variant="quiet" size={primary ? 'md' : 'sm'} disabled={disabled || busy} loading={busy}
              onClick={() => { tap(); send('abandoned'); }}>
        {ru.feed.gaveUp}
      </Button>
      {extra}
    </div>
  );
}
