import type { CSSProperties } from 'react';
import { cx } from '@/lib/cx';

/** Скелетон повторяет форму будущего содержания, а не занимает экран серым. */
export function Skeleton({ kind = 'line', style, className }: {
  kind?: 'line' | 'label' | 'title' | 'block' | 'btn' | 'cover';
  style?: CSSProperties;
  className?: string;
}) {
  return <span className={cx('tm-skel', `tm-skel--${kind}`, className)} style={style} aria-hidden="true" />;
}
