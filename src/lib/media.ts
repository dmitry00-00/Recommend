// Вид произведения (трек Е, шаг Е1, 30.09). Сериал — свой вид (`type: 'series'`), а не фильм с
// пометкой. Пометка `format: 'series'` жила с 22.09 — в справочниках, сидах и в карточках,
// которые сервер хранит в записях участников, — поэтому читать её приходится ещё долго:
// все проверки «это сериал?» идут через `isSeries`, а карточки на входе приводятся `normalizeWork`.
import type { WorkCard } from '@/types/tmdf';

type Kinded = Pick<WorkCard, 'type'> & { format?: 'series' };

/** Сериал: по виду или по старой пометке. */
export const isSeries = (w: Kinded): boolean => w.type === 'series' || w.format === 'series';

/** Экранное произведение — фильм или сериал: «смотреть», а не «читать». */
export const isScreen = (w: Kinded): boolean => w.type !== 'book';

/** Фильм в узком смысле: подбор, колода оценок, разборы по фильму. */
export const isFilm = (w: Kinded): boolean => w.type === 'film' && w.format !== 'series';

/** Старую пометку — в вид. Карточка без неё возвращается как есть (та же ссылка). */
export function normalizeWork<T extends WorkCard>(w: T): T {
  if (w.format !== 'series') return w;
  const { format: _format, ...rest } = w;
  return { ...rest, type: 'series' } as T;
}
