import type { WorkCard } from '@/types/tmdf';

export function formatDuration(minutes?: number): string | undefined {
  if (!minutes) return undefined;
  const tail = minutes % 10;
  const teen = minutes % 100 >= 10 && minutes % 100 <= 20;
  const word = !teen && tail === 1 ? 'минута' : !teen && tail > 1 && tail < 5 ? 'минуты' : 'минут';
  return `${minutes} ${word}`;
}

/** Порядок метаданных кадра: что это · кто · сколько длится. Год живёт на обложке. */
export function workMeta(work: WorkCard): (string | undefined)[] {
  return [
    work.type === 'film' ? 'Фильм' : 'Книга',
    work.creators.join(', '),
    work.type === 'film' ? formatDuration(work.durationMinutes) : work.pages ? `${work.pages} страниц` : undefined,
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
