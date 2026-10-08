import { useState } from 'react';
import type { PerceivedDifficulty, WorkCard } from '@/types/tmdf';
import { Button } from './Button';
import { DifficultyPicker } from './DifficultyPicker';
import { Sheet } from './Sheet';
import ui from '@/i18n';
import { titleOf } from '@/lib/format';

export interface PredictionStepProps {
  /** начать просмотр; `expected` пустой, если прогноз пропустили */
  onStart: (expected?: PerceivedDifficulty) => void;
  busy?: boolean;
}

/** Один вопрос перед началом: чего человек ждёт. Шкала та же, что после просмотра, — иначе
 *  сверять нечего. Пропустить можно в один тап: прогноз нужен нам, а не участнику, и
 *  задерживать его между «начать» и просмотром мы права не имеем. */
export function PredictionStep({ onStart, busy }: PredictionStepProps) {
  const [expected, setExpected] = useState<PerceivedDifficulty | undefined>();
  return (
    <div className="tm-pred">
      <DifficultyPicker label={ui.prediction.label} value={expected} onPick={setExpected} />
      <p className="tm-body-sm tm-pred__why">{ui.prediction.why}</p>
      <div className="tm-row tm-row--gap-2">
        <Button variant="primary" size="sm" loading={busy} disabled={!expected} onClick={() => onStart(expected)}>
          {ui.prediction.start}
        </Button>
        <Button variant="quiet" size="sm" onClick={() => onStart(undefined)}>{ui.prediction.skip}</Button>
      </div>
    </div>
  );
}

export interface PredictionSheetProps extends PredictionStepProps {
  work?: WorkCard;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Тот же шаг шторкой — там, где карточка не открыта (экран произведения, маршрут). */
export function PredictionSheet({ work, open, onOpenChange, onStart, busy }: PredictionSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={work ? titleOf(work) : ui.prediction.title}>
      <PredictionStep onStart={onStart} busy={busy} />
    </Sheet>
  );
}
