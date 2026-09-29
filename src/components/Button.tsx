import type { ReactNode } from 'react';
import { cx } from '@/lib/cx';

export interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'quiet' | 'danger';
  size?: 'sm' | 'md';
  loading?: boolean;
  disabled?: boolean;
  pressed?: boolean;
  block?: boolean;
  href?: string;
  onClick?: () => void;
  className?: string;
  children?: ReactNode;
}

export function Button({
  variant = 'secondary', size = 'md', loading, disabled, pressed, block, href, onClick,
  className, children,
}: ButtonProps) {
  const cls = cx('tm-btn', `tm-btn--${variant}`, size === 'sm' && 'tm-btn--sm',
                 block && 'tm-btn--block', className);
  const inner = (
    <>
      {loading ? <span className="tm-btn__wait" aria-hidden="true" /> : null}
      {children}
    </>
  );
  if (href) {
    return <a className={cls} href={href} aria-busy={loading ? 'true' : undefined}>{inner}</a>;
  }
  return (
    <button className={cls} type="button" disabled={disabled} aria-pressed={pressed}
            aria-busy={loading ? 'true' : undefined} onClick={onClick}>
      {inner}
    </button>
  );
}
