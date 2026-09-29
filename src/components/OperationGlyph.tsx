import type { CSSProperties } from 'react';
import type { CognitiveOperation } from '@/types/tmdf';
import { operations, opVar } from '@/lib/operations';
import { cx } from '@/lib/cx';
import { useMechanics } from '@/lib/settingsStore';

export interface OperationGlyphProps {
  op: CognitiveOperation;
  /** лестница системы: 12 — метка, 14 — чип, 16 — строка, 24 — панель, 48 — карта */
  size?: 12 | 14 | 16 | 24 | 48;
  /** 'inherit' — взять цвет у родителя вместо tm-op-<операция> */
  tone?: 'inherit';
  /** false — убрать подпись для скринридера, когда рядом есть текст */
  title?: false;
  className?: string;
  style?: CSSProperties;
}

export function OperationGlyph({ op, size = 16, tone, title, className, style }: OperationGlyphProps) {
  // Механика выключена в настройках — знака нет вовсе, не пустая рамка (21.09).
  const mechanics = useMechanics();
  if (!mechanics) return null;
  const meta = operations[op];
  const sw = size <= 12 ? 1.9 : size <= 16 ? 1.7 : size <= 24 ? 1.5 : 1.15;
  return (
    <svg
      className={cx('tm-glyph', className)}
      width={size}
      height={size}
      viewBox="0 0 16 16"
      role={title === false ? 'presentation' : 'img'}
      aria-hidden={title === false ? 'true' : undefined}
      aria-label={title === false ? undefined : meta.name}
      style={{ color: tone === 'inherit' ? 'inherit' : opVar(op), ...style }}
    >
      {meta.paths.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="currentColor" strokeWidth={sw}
              strokeLinecap="round" strokeLinejoin="round" />
      ))}
      {(meta.dots ?? []).map(([cx0, cy0], i) => (
        <circle key={`d${i}`} cx={cx0} cy={cy0} r={sw * 0.78} fill="currentColor" />
      ))}
      {(meta.rings ?? []).map(([cx0, cy0], i) => (
        <circle key={`r${i}`} cx={cx0} cy={cy0} r={sw * 0.95} fill="none"
                stroke="currentColor" strokeWidth={sw * 0.8} />
      ))}
    </svg>
  );
}
