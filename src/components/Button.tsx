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
  /** подпись для чтения с экрана, когда на кнопке значок («+», «−», «×»). Атрибуты с дефисом TS
   *  не проверяет — раньше её передавали, а кнопка молча теряла (нашлось 01.10 в прогоне экранов) */
  'aria-label'?: string;
  title?: string;
}

export function Button({
  variant = 'secondary', size = 'md', loading, disabled, pressed, block, href, onClick,
  className, children, 'aria-label': ariaLabel, title,
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
    return <a className={cls} href={href} aria-busy={loading ? 'true' : undefined} aria-label={ariaLabel} title={title}>{inner}</a>;
  }
  return (
    <button className={cls} type="button" disabled={disabled} aria-pressed={pressed}
            aria-busy={loading ? 'true' : undefined} aria-label={ariaLabel} title={title} onClick={onClick}>
      {inner}
    </button>
  );
}
