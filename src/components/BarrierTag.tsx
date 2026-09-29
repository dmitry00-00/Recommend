import { cx } from '@/lib/cx';

export interface BarrierTagProps {
  label: string;
  /** 'warning' — предупреждение о содержании (пунктир), иначе — барьер восприятия */
  kind?: 'warning';
}

/** Барьер назван словами и помечен штриховкой: это не оценка, а предупреждение о форме. */
export function BarrierTag({ label, kind }: BarrierTagProps) {
  return (
    <span className={cx('tm-barrier', kind === 'warning' && 'tm-barrier--warning')}>
      <span className="tm-barrier__mark" aria-hidden="true" />
      {label}
    </span>
  );
}
