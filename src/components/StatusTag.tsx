import type { AnnotationStatus } from '@/types/tmdf';
import { cx } from '@/lib/cx';
import ru from '@/i18n/ru';

const TONE: Record<AnnotationStatus, 'ok' | 'wait' | 'stop'> = {
  queued: 'wait', annotating: 'wait', validation_failed: 'stop', needs_review: 'wait',
  approved: 'ok', published: 'ok', rejected: 'stop',
};

/** Статус аннотации: квадрат — готово, круг — ждёт, треугольник — стоп. Форма дублирует цвет. */
export function StatusTag({ status }: { status: AnnotationStatus }) {
  const tone = TONE[status] ?? 'wait';
  return (
    <span className={cx('tm-status', `tm-status--${tone}`)}>
      <span className="tm-status__mark" aria-hidden="true" />
      {ru.annotationStatus[status] ?? status}
    </span>
  );
}
