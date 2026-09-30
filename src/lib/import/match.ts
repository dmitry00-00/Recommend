// Сопоставление импортированных записей с каталогом. Точное — по внешним ID, иначе по
// нормализованному названию (оригинальному или переводному) и году ±1. Что не совпало —
// возвращается отдельно: это материал для сетки знакомства, а не потеря.
import type { ISODate, JourneyEntryData, MediaType, WorkCard } from '@/types/tmdf';
import { isSeries } from '@/lib/media';
import type { ImportedRecord } from './types';

/** Регистр, диакритика (Rashômon → rashomon), ё, пунктуация, артикли — всё снимается. */
export const normalizeTitle = (s: string): string =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').replace(/\b(the|a|an)\b/g, '').replace(/\s+/g, ' ').trim();

const KNOWN: readonly MediaType[] = ['film', 'series', 'book'];

/** Вид карточки с учётом старой пометки `format: 'series'`. */
const kindOf = (w: WorkCard): MediaType => (isSeries(w) ? 'series' : w.type);

export function matchWork(record: ImportedRecord, works: WorkCard[]): WorkCard | undefined {
  if (!KNOWN.includes(record.type)) return undefined;
  const ids = record.externalIds;
  // номера TMDb у сериалов и фильмов из разных пространств: tv/1399 — не movie/1399. Сверяем
  // TMDb только внутри одного вида; IMDb и Кинопоиск общие на всё
  const byId = ids && works.find((w) =>
    (ids.imdb && w.externalIds?.imdb === ids.imdb) ||
    (ids.tmdb != null && w.externalIds?.tmdb === ids.tmdb && kindOf(w) === record.type) ||
    (ids.kinopoisk != null && w.externalIds?.kinopoisk === ids.kinopoisk) ||
    (ids.isbn?.some((i) => w.externalIds?.isbn?.includes(i))));
  if (byId) return byId;
  if (!record.title) return undefined;
  const wanted = normalizeTitle(record.title);
  const wantedOriginal = record.originalTitle ? normalizeTitle(record.originalTitle) : undefined;
  return works.find((w) => {
    if (kindOf(w) !== record.type) return false;
    const titles = [normalizeTitle(w.title), w.originalTitle ? normalizeTitle(w.originalTitle) : ''];
    const titleOk = titles.includes(wanted) || (wantedOriginal != null && titles.includes(wantedOriginal));
    const yearOk = record.year == null || Math.abs(w.year - record.year) <= 1;
    return titleOk && yearOk;
  });
}

export interface ImportOutcome {
  entries: JourneyEntryData[];
  /** фильмы, сериалы и книги, которых нет в каталоге — материал для сетки знакомства */
  unmatched: ImportedRecord[];
  /** записи вида, которого в контракте нет. С Е5 сериалы сюда не попадают; поле осталось на
   *  случай нового вида в выгрузках (подкасты, игры) — не теряем, но и не сопоставляем */
  skipped: ImportedRecord[];
}

/** Записи → черновики дневника. Оценка в дневник не переносится: там её нет по контракту. */
export function toJourneyEntries(records: ImportedRecord[], works: WorkCard[], today: ISODate): ImportOutcome {
  const entries: JourneyEntryData[] = [];
  const unmatched: ImportedRecord[] = [];
  const skipped: ImportedRecord[] = [];
  const seen = new Set<string>();
  for (const r of records) {
    if (!KNOWN.includes(r.type)) { skipped.push(r); continue; }
    const work = matchWork(r, works);
    if (!work) { unmatched.push(r); continue; }
    if (seen.has(work.id)) continue; // повторы: одна запись на произведение
    seen.add(work.id);
    entries.push({
      id: `import-${r.source}-${work.id}`,
      work,
      status: r.status,
      startedAt: r.status === 'planned' ? undefined : r.date ?? today,
      finishedAt: r.status === 'finished' ? r.date ?? today : undefined,
      reflections: [],
      stateChanges: [],
    });
  }
  return { entries, unmatched, skipped };
}
