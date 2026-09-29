import type { CSSProperties } from 'react';
import type { CognitiveOperation } from '@/types/tmdf';
import { operations, opVar } from '@/lib/operations';
import { OperationGlyph } from './OperationGlyph';
import { cx } from '@/lib/cx';
import { useMechanics } from '@/lib/settingsStore';

export interface OperationChipProps {
  op: CognitiveOperation;
  short?: boolean;
  size?: 'sm';
  intensity?: number;
  /** режим «Показывать подробности» из настроек: без него числа не выводятся */
  showDetails?: boolean;
  tone?: 'plain' | 'wash';
}

export function OperationChip({ op, short, size, intensity, showDetails, tone }: OperationChipProps) {
  // Механика выключена в настройках — знака нет вовсе, не пустая рамка (21.09).
  const mechanics = useMechanics();
  if (!mechanics) return null;
  const meta = operations[op];
  const style = {
    '--chip-ink': opVar(op, 'ink'),
    '--chip-wash': opVar(op, 'wash'),
  } as CSSProperties;
  return (
    <span
      className={cx('tm-chip', size === 'sm' && 'tm-chip--sm', tone === 'plain' && 'tm-chip--plain',
                    tone === 'wash' && 'tm-chip--wash')}
      style={style}
      title={meta.line}
    >
      <OperationGlyph op={op} size={size === 'sm' ? 12 : 14} tone="inherit" title={false} />
      <span className="tm-chip__label">{short ? meta.short : meta.name}</span>
      {intensity != null && showDetails ? (
        <span className="tm-chip__num">{Math.round(intensity * 100)}%</span>
      ) : null}
    </span>
  );
}
