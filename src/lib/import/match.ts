// Сопоставление импортированных записей с каталогом. Точное — по внешним ID, иначе по
// нормализованному названию (оригинальному или переводному) и году ±1. Что не совпало —
// возвращается отдельно: это материал для сетки знакомства, а не потеря.
import type { ID, ISODate, JourneyEntryData, MediaType, WorkCard } from '@/types/tmdf';
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
    (ids.isbn?.some((i) => w.externalIds?.isbn?.includes(i))) ||
    // фильм без TMDb заведён по элементу Wikidata (`wd:`, 18.10) — его узнаём по нему же
    (ids.wikidata && w.externalIds?.wikidata === ids.wikidata && kindOf(w) === record.type));
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

/** Насколько мы уверены в сопоставлении (ДФ-11, 14.10): `id` — по внешнему ID; `exact` — название и год
 *  совпали, и такая карточка одна; `loose` — название совпало, а год ±1, не указан или карточек несколько —
 *  это человек проверяет сам в предпросмотре. */
export type MatchHow = 'id' | 'exact' | 'loose';
export interface ScoredMatch { work: WorkCard; how: MatchHow; alternatives: WorkCard[] }

/** Индекс каталога для сопоставления многих записей: перебор всего каталога на каждую строку выгрузки —
 *  десятки тысяч нормализаций на запись. Ключи — внешние ID и нормализованные названия. */
export interface MatchIndex {
  byId: Map<string, WorkCard>;
  byTitle: Map<string, WorkCard[]>;
  /** известность 1–3 (src/mocks/fame.ts, 17.10): у записи без года — кого подставлять первым */
  fame?: (w: WorkCard) => number | undefined;
}
export function buildMatchIndex(works: WorkCard[], opts: { fame?: (w: WorkCard) => number | undefined } = {}): MatchIndex {
  const byId = new Map<string, WorkCard>();
  const byTitle = new Map<string, WorkCard[]>();
  const putId = (k: string, w: WorkCard) => { if (!byId.has(k)) byId.set(k, w); };
  for (const w of works) {
    const ids = w.externalIds;
    if (ids?.imdb) putId(`imdb:${ids.imdb}`, w);
    if (ids?.tmdb != null) putId(`tmdb:${kindOf(w)}:${ids.tmdb}`, w);
    if (ids?.kinopoisk != null) putId(`kp:${ids.kinopoisk}`, w);
    for (const i of ids?.isbn ?? []) putId(`isbn:${i}`, w);
    if (ids?.wikidata) putId(`wd:${ids.wikidata}`, w);
    for (const t of new Set([normalizeTitle(w.title), w.originalTitle ? normalizeTitle(w.originalTitle) : ''])) {
      if (!t) continue;
      const list = byTitle.get(t) ?? byTitle.set(t, []).get(t)!;
      // одна карточка может лежать в каталоге дважды (справочник и история) — второй раз не кладём
      if (!list.some((x) => x.id === w.id)) list.push(w);
    }
  }
  return { byId, byTitle, ...(opts.fame ? { fame: opts.fame } : {}) };
}

/** Одна и та же вещь под разными id (17.10): справочник, каталог и история заводят свои карточки — «Сталкер, 1979»
 *  приходил дважды, а «Маяк» 2019 из-за трёх копий не считался точным. Тот же год и не спорящие внешние ID — одна. */
const sameThing = (a: WorkCard, b: WorkCard): boolean => {
  if (a.year !== b.year) return false;
  const x = a.externalIds, y = b.externalIds;
  if (x?.tmdb != null && y?.tmdb != null && x.tmdb !== y.tmdb) return false;
  if (x?.imdb && y?.imdb && x.imdb !== y.imdb) return false;
  return true;
};

export function matchScored(record: ImportedRecord, index: MatchIndex): ScoredMatch | undefined {
  if (!KNOWN.includes(record.type)) return undefined;
  const ids = record.externalIds;
  const byId = ids && ((ids.imdb && index.byId.get(`imdb:${ids.imdb}`))
    || (ids.tmdb != null && index.byId.get(`tmdb:${record.type}:${ids.tmdb}`))
    || (ids.kinopoisk != null && index.byId.get(`kp:${ids.kinopoisk}`))
    || ids.isbn?.map((i) => index.byId.get(`isbn:${i}`)).find(Boolean)
    || (ids.wikidata && index.byId.get(`wd:${ids.wikidata}`)));
  if (byId) return { work: byId, how: 'id', alternatives: [] };
  const titles = [record.title, record.originalTitle].filter((t): t is string => Boolean(t)).map(normalizeTitle).filter(Boolean);
  const found = new Map<ID, WorkCard>();
  for (const t of titles) for (const w of index.byTitle.get(t) ?? []) if (kindOf(w) === record.type) found.set(w.id, w);
  const candidates = [...found.values()].filter((w) => record.year == null || Math.abs(w.year - record.year) <= 1);
  if (!candidates.length) return undefined;
  // копии одной вещи — в одну: представитель — размеченный, потом с известностью; известность группы — наибольшая
  const groups: WorkCard[][] = [];
  for (const w of candidates) {
    const g = groups.find((x) => sameThing(x[0], w));
    if (g) g.push(w); else groups.push([w]);
  }
  const fameOf = (w: WorkCard) => index.fame?.(w) ?? 0;
  const groupFame = new Map<WorkCard, number>();
  const near = groups.map((g) => {
    const best = [...g].sort((a, b) => (b.complexityLevel > 0 ? 1 : 0) - (a.complexityLevel > 0 ? 1 : 0) || fameOf(b) - fameOf(a))[0];
    groupFame.set(best, Math.max(...g.map(fameOf)));
    return best;
  });
  // ближе по году — первым; без года у записи — более известное (17.10: «Сталкер» без года — Тарковский, а не 2023,
  // «Начало» — Нолан 2010, «Солярис» — 1972), потом размеченное, потом новее
  near.sort((a, b) => (record.year != null ? Math.abs(a.year - record.year) - Math.abs(b.year - record.year) : 0)
    || (record.year == null ? (groupFame.get(b) ?? 0) - (groupFame.get(a) ?? 0) : 0)
    || (b.complexityLevel > 0 ? 1 : 0) - (a.complexityLevel > 0 ? 1 : 0) || b.year - a.year);
  const exact = record.year != null && near.filter((w) => w.year === record.year);
  if (exact && exact.length === 1) return { work: exact[0], how: 'exact', alternatives: near.filter((w) => w !== exact[0]) };
  return { work: near[0], how: 'loose', alternatives: near.slice(1) };
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
