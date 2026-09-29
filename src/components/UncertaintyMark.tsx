import type { CSSProperties } from 'react';
import type { CognitiveOperation, Confidence } from '@/types/tmdf';
import { opVar } from '@/lib/operations';
import { cx } from '@/lib/cx';
import ru from '@/i18n/ru';
import { useMechanics } from '@/lib/settingsStore';

export interface UncertaintyMarkProps {
  level: number;
  range: [number, number];
  confidence?: Confidence;
  op?: CognitiveOperation;
  max?: number;
  showDetails?: boolean;
  /** false — без подписи под шкалой (в таблице карты она в соседней колонке) */
  note?: false;
  className?: string;
}

/** Честная форма неопределённости: полоса диапазона со штриховкой, засечка оценки и
 *  подпись, когда данных мало. Числа — только при showDetails. */
export function UncertaintyMark({ level, range, confidence, op, max = 10, showDetails, note, className }: UncertaintyMarkProps) {
  // Механика выключена в настройках — знака нет вовсе, не пустая рамка (21.09).
  const mechanics = useMechanics();
  if (!mechanics) return null;
  const lo = (Math.max(0, range[0]) / max) * 100;
  const hi = (Math.min(max, range[1]) / max) * 100;
  const at = (level / max) * 100;
  const low = confidence === 'low';
  const bandStyle = {
    left: `${lo}%`, width: `${Math.max(1, hi - lo)}%`,
    '--band-ink': op ? opVar(op) : 'var(--tm-color-line-strong)',
  } as CSSProperties;
  const stakeStyle = { left: `${at}%`, '--stake-ink': op ? opVar(op) : 'var(--tm-color-ink)' } as CSSProperties;
  const words = low
    ? ru.state.lowData
    : showDetails
      ? `${level.toFixed(1)}${ru.uncertainty.of}${max}${ru.uncertainty.range}${range[0].toFixed(1)}–${range[1].toFixed(1)}`
      : ru.uncertainty.refining;
  return (
    <div className={cx('tm-unc', low && 'tm-unc--low', className)}>
      <div className="tm-unc__track">
        <div className="tm-unc__band" style={bandStyle} />
        <div className="tm-unc__stake" style={stakeStyle} />
      </div>
      {note === false ? null : <p className="tm-unc__note">{words}</p>}
      <span className="tm-sr">
        {`${ru.uncertainty.srRange}${range[0].toFixed(1)}${ru.uncertainty.srTo}${range[1].toFixed(1)}${ru.uncertainty.of}${max}${low ? ru.uncertainty.srLowData : ''}`}
      </span>
    </div>
  );
}
