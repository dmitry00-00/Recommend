import type { WorkCard } from '@/types/tmdf';
import { isSeries } from '@/lib/media';
import { leadCredits } from '@/lib/credits';

export function formatDuration(minutes?: number): string | undefined {
  if (!minutes) return undefined;
  const tail = minutes % 10;
  const teen = minutes % 100 >= 10 && minutes % 100 <= 20;
  const word = !teen && tail === 1 ? 'минута' : !teen && tail > 1 && tail < 5 ? 'минуты' : 'минут';
  return `${minutes} ${word}`;
}

/** Сериал: «3 сезона», «8 серий по 50 мин» — что известно (Е1). */
function seriesLength(work: WorkCard): string | undefined {
  const s = work.series;
  // у старых карточек сериала вместо сведений — длина серии в durationMinutes
  if (!s) return work.durationMinutes ? `серия ${formatDuration(work.durationMinutes)}` : undefined;
  const plural = (n: number, one: string, few: string, many: string) =>
    `${n} ${n % 10 === 1 && n % 100 !== 11 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? few : many}`;
  if (s.seasons && s.seasons > 1) return plural(s.seasons, 'сезон', 'сезона', 'сезонов');
  if (s.episodes) return `${plural(s.episodes, 'серия', 'серии', 'серий')}${s.episodeMinutes ? ` по ${s.episodeMinutes} мин` : ''}`;
  return undefined;
}

/** Порядок метаданных кадра: что это · кто · сколько длится. Год живёт на обложке. */
export function workMeta(work: WorkCard): (string | undefined)[] {
  return [
    isSeries(work) ? 'Сериал' : work.type === 'book' ? 'Книга' : 'Фильм',
    leadCredits(work).map((c) => c.name).join(', '),
    isSeries(work) ? seriesLength(work)
      : work.type !== 'book' ? formatDuration(work.durationMinutes) : work.pages ? `${work.pages} страниц` : undefined,
  ];
}

export function seedOf(value: string): number {
  let n = 0;
  for (let i = 0; i < value.length; i++) n = (n * 31 + value.charCodeAt(i)) % 100000;
  return n;
}

/** Русское согласование числа: 1 произведение, 2 произведения, 5 произведений. */
export function pluralRu(n: number, one: string, few: string, many: string): string {
  const tail = n % 10;
  const teen = n % 100 >= 10 && n % 100 <= 20;
  return !teen && tail === 1 ? one : !teen && tail > 1 && tail < 5 ? few : many;
}

const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

/** ISO-дата → «2 ноября 2025»; год опускается, если он текущий. Не дата — как есть. */
export function formatDate(iso?: string, today = new Date()): string | undefined {
  if (!iso) return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const [, y, mo, d] = m;
  const year = Number(y) === today.getFullYear() ? '' : ` ${y}`;
  return `${Number(d)} ${MONTHS[Number(mo) - 1]}${year}`;
}
