// Сгенерировано tools/apply-book-calibration.mts (З4) — руками не править; источник — лист владельца
// .cache/markup/book_calibration.csv. Ручная разметка книг: ключ — произведение из справочника,
// а если книги у нас нет — `t:<название>` (приложение сверяет и по названию).
import type { FirstPassAnnotation } from './userAnnotations';

export const bookAnnotationMeta = { provider: 'human' as const, by: 'owner', status: 'approved' as const, createdAt: '2026-09-30' };

export const bookAnnotations: Record<string, FirstPassAnnotation> = {};
