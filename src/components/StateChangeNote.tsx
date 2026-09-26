import type { CognitiveOperation, StateChangeType } from '@/types/tmdf';
import { OperationChip } from './OperationChip';
import { cx } from '@/lib/cx';
import ru from '@/i18n/ru';
import { useMechanics } from '@/lib/settingsStore';

export interface StateChangeNoteProps {
  changeType: StateChangeType;
  /** текст объяснения приходит из данных; без него — общая формулировка */
  text?: string;
  operations?: CognitiveOperation[];
}

/** «Карта уточнилась» и «заметный сдвиг» не должны быть похожи: разные форма, вес и слова. */
export function StateChangeNote({ changeType, text, operations = [] }: StateChangeNoteProps) {
  // Механика выключена в настройках — знака нет вовсе, не пустая рамка (21.09).
  const mechanics = useMechanics();
  if (!mechanics) return null;
  const growth = changeType === 'observed_growth';
  return (
    <div className={cx('tm-change', growth ? 'tm-change--growth' : 'tm-change--refined')}>
      <span className="tm-change__mark" aria-hidden="true" />
      <div>
        <p className="tm-change__title">{growth ? ru.state.growth : ru.state.refined}</p>
        <p className="tm-change__text">{text ?? (growth ? ru.change.growthText : ru.change.refinedText)}</p>
        {operations.length ? (
          <div className="tm-row tm-row--wrap tm-row--gap-1">
            {operations.map((op) => <OperationChip key={op} op={op} size="sm" short />)}
          </div>
        ) : null}
      </div>
    </div>
  );
}
