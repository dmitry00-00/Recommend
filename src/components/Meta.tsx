import { cx } from '@/lib/cx';

export function Meta({ items, className }: { items: (string | undefined | null)[]; className?: string }) {
  const parts = items.filter((x): x is string => Boolean(x));
  return (
    <p className={cx('tm-meta', className)}>
      {parts.map((value, i) => (
        <span key={i}>
          {i ? <span className="tm-meta__sep" aria-hidden="true">·</span> : null}
          <span>{value}</span>
        </span>
      ))}
    </p>
  );
}
