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

type Timed = Kinded & Pick<WorkCard, 'series' | 'durationMinutes'>;

/** Сколько часов смотреть (Е4): у антологии — один сезон (он и есть единица), у остального —
 *  весь сериал. Нет числа серий или их длины — неизвестно. */
export function seriesHours(w: Timed): number | undefined {
  if (!isSeries(w)) return undefined;
  const s = w.series;
  const minutes = s?.episodeMinutes ?? w.durationMinutes;
  if (!s?.episodes || !minutes) return undefined;
  const episodes = s.anthology && s.seasons ? s.episodes / s.seasons : s.episodes;
  return Math.round((episodes * minutes) / 60);
}

/** Короткий вход в сериалы: мини-сериал (один сезон и закончен) или сезон антологии, или
 *  известно, что смотреть не больше десяти часов. С этого начинают те, кто сериалов у нас ещё не
 *  отмечал (Е4). */
export function isShortSeries(w: Timed): boolean {
  if (!isSeries(w)) return false;
  const s = w.series;
  const hours = seriesHours(w);
  if (hours != null) return hours <= 10;
  return Boolean(s?.anthology || (s?.seasons === 1 && s.status === 'ended'));
}
