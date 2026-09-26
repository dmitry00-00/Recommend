import type { StretchLevel } from '@/types/tmdf';
import { cx } from '@/lib/cx';
import ru from '@/i18n/ru';
import { useMechanics } from '@/lib/settingsStore';

export interface StretchIndicatorProps {
  level: StretchLevel;
  size?: 'sm';
  label?: false;
  /** 'caps' — метка усилия в шапке кадра */
  variant?: 'caps';
}

export function StretchIndicator({ level, size, label, variant }: StretchIndicatorProps) {
  // Механика выключена в настройках — знака нет вовсе, не пустая рамка (21.09).
  const mechanics = useMechanics();
  if (!mechanics) return null;
  const meta = ru.stretch[level];
  if (variant === 'caps') {
    return (
      <span className={cx('tm-stretchcaps', `tm-stretchcaps--${level}`)} title={meta.note}>
        {meta.label}
        <span className="tm-sr">{` — ${meta.note}`}</span>
      </span>
    );
  }
  const filled = level === 'easy_entry' ? 1 : level === 'productive' ? 2 : 3;
  return (
    <span className={cx('tm-stretch', size === 'sm' && 'tm-stretch--sm')} title={meta.note}>
      <span className="tm-stretch__bars" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span key={i} className={cx('tm-stretch__b', i < filled && 'tm-stretch__b--on')}
                style={{ height: 5 + i * 4 }} />
        ))}
      </span>
      {label === false ? null : <span className="tm-stretch__label">{meta.label}</span>}
      <span className="tm-sr">{`уровень усилия: ${meta.label}, ${meta.note}`}</span>
    </span>
  );
}
