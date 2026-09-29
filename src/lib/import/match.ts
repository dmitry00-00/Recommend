// Сопоставление импортированных записей с каталогом. Точное — по внешним ID, иначе по
// нормализованному названию (оригинальному или переводному) и году ±1. Что не совпало —
// возвращается отдельно: это материал для сетки знакомства, а не потеря.
import type { ISODate, JourneyEntryData, WorkCard } from '@/types/tmdf';
import type { ImportedRecord } from './types';

/** Регистр, диакритика (Rashômon → rashomon), ё, пунктуация, артикли — всё снимается. */
export const normalizeTitle = (s: string): string =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').replace(/\b(the|a|an)\b/g, '').replace(/\s+/g, ' ').trim();

export function matchWork(record: ImportedRecord, works: WorkCard[]): WorkCard | undefined {
  if (record.type !== 'film' && record.type !== 'book') return undefined;
  const ids = record.externalIds;
  const byId = ids && works.find((w) =>
    (ids.imdb && w.externalIds?.imdb === ids.imdb) ||
    (ids.tmdb != null && w.externalIds?.tmdb === ids.tmdb) ||
    (ids.kinopoisk != null && w.externalIds?.kinopoisk === ids.kinopoisk) ||
    (ids.isbn?.some((i) => w.externalIds?.isbn?.includes(i))));
  if (byId) return byId;
  if (!record.title) return undefined;
  const wanted = normalizeTitle(record.title);
  const wantedOriginal = record.originalTitle ? normalizeTitle(record.originalTitle) : undefined;
  return works.find((w) => {
    if (w.type !== record.type) return false;
    const titles = [normalizeTitle(w.title), w.originalTitle ? normalizeTitle(w.originalTitle) : ''];
    const titleOk = titles.includes(wanted) || (wantedOriginal != null && titles.includes(wantedOriginal));
    const yearOk = record.year == null || Math.abs(w.year - record.year) <= 1;
    return titleOk && yearOk;
  });
}

export interface ImportOutcome {
  entries: JourneyEntryData[];
  /** фильмы и книги, которых нет в каталоге — материал для сетки знакомства */
  unmatched: ImportedRecord[];
  /** сериалы и прочее, чего в контракте пока нет — не теряем, но и не сопоставляем */
  skipped: ImportedRecord[];
}

/** Записи → черновики дневника. Оценка в дневник не переносится: там её нет по контракту. */
export function toJourneyEntries(records: ImportedRecord[], works: WorkCard[], today: ISODate): ImportOutcome {
  const entries: JourneyEntryData[] = [];
  const unmatched: ImportedRecord[] = [];
  const skipped: ImportedRecord[] = [];
  const seen = new Set<string>();
  for (const r of records) {
    if (r.type !== 'film' && r.type !== 'book') { skipped.push(r); continue; }
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
