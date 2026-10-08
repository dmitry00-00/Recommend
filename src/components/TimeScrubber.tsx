import { useState } from 'react';
import type { StateHistoryPoint } from '@/types/tmdf';
import { cx } from '@/lib/cx';
import ui from '@/i18n';

export interface TimeScrubberProps {
  history: StateHistoryPoint[];
  /** управляемый индекс; без него компонент помнит выбор сам */
  value?: number;
  onChange?: (index: number) => void;
}

/** Ось времени карты: каждая точка — причина изменения. Уточнение — тонкая засечка,
 *  заметный сдвиг — точка акцента; их нельзя перепутать даже без подписи. */
export function TimeScrubber({ history, value, onChange }: TimeScrubberProps) {
  const [inner, setInner] = useState(history.length - 1);
  const current = value ?? inner;
  const point = history[current];
  const set = (i: number) => { setInner(i); onChange?.(i); };
  const isGrowth = (p: StateHistoryPoint) => p.cause.changeType === 'observed_growth';
  return (
    <div className="tm-scrub">
      <div className="tm-scrub__track">
        <span className="tm-scrub__axis" aria-hidden="true" />
        {history.map((p, i) => {
          const growth = isGrowth(p);
          const on = i === current;
          return (
            <button
              key={p.asOf + i} type="button"
              className={cx('tm-scrub__tick', growth && 'tm-scrub__tick--growth', on && 'tm-scrub__tick--on')}
              style={{ left: `${history.length === 1 ? 50 : (i / (history.length - 1)) * 100}%` }}
              aria-label={`${p.asOf}: ${p.cause.label} — ${growth ? ui.change.growthShort : ui.change.refinedShort}`}
              aria-current={on ? 'true' : undefined}
              onClick={() => set(i)}
            >
              <span className="tm-scrub__mark" aria-hidden="true" />
            </button>
          );
        })}
      </div>
      <div className="tm-scrub__read">
        <span className="tm-scrub__date">{point?.asOf ?? ''}</span>
        <span className="tm-scrub__cause">{point?.cause.label ?? ''}</span>
        <span className={cx('tm-scrub__kind', point && isGrowth(point) && 'tm-scrub__kind--growth')}>
          {point && isGrowth(point) ? ui.change.growthShort : ui.change.refinedShort}
        </span>
      </div>
    </div>
  );
}
