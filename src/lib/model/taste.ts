// Якорь вкуса новичка (09.10). Подбор ведут уровень, операции и регистр, но при пяти–двадцати
// оценках регистр почти молчит: у шести любимых мультфильмов регистры разные, и любителю анимации
// первая лента приходила из «Бэтмена» и «Шоушенка», а любителю отечественного — из «Робокопа»
// (прогон шести профилей, 09.10). Здесь — близость к тому, что человек оценил, по жанру TMDb,
// стране и авторам: «Отлично» притягивает, «Мимо» отталкивает. Вес большой на первых оценках и
// гаснет к `FADE_AT`: дальше подбор идёт «на шаг сложнее», а не «ещё того же».
import type { WorkCard } from '@/types/tmdf';
import { countryRu } from '@/lib/countries';

export interface TasteEntry { work: WorkCard; rating?: 1 | 2 | 3 | 4 | 5; raw?: number }
/** Сходство с оценённым по признаку: от −1 (не нравится) до 1 (нравится). */
export interface ContentTaste { genres: Record<string, number>; countries: Record<string, number>; creators: Record<string, number> }

/** Вес якоря при `MIN` оценках и сколько оценок до того, как он гаснет совсем. */
export const CONTENT_WEIGHT = 0.25;
export const FADE_AT = 50;
/** Один фильм жанра — ещё не вкус: сумма знаков делится на число фильмов плюс это. */
const PRIOR = 1;
const SIGN: Record<number, number> = { 1: -1, 2: -0.6, 3: 0, 4: 0.6, 5: 1 };

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/** Знак оценки. Десятибалльная — от нормы участника: три балла выше нормы — «очень нравится». */
export function ratingSign(rating?: number, raw?: number, norm = 7): number | undefined {
  if (raw != null) return clamp((raw - norm) / 3, -1, 1);
  return rating == null ? undefined : SIGN[rating];
}

/** Полки вкуса новичка (ЗП-45, шаг 1, 11.10): на экране первых оценок — «что вам ближе», 2–3 полки. Полка —
 *  жанры TMDb или страна; выбор весит как `PICK_FILMS` оценок «Отлично» с этими признаками и гаснет вместе
 *  с якорем. Не подборка и не объяснение — только с чего начать. */
export interface TasteShelf { id: string; genres?: string[]; countries?: string[] }
export const TASTE_SHELVES: readonly TasteShelf[] = [
  { id: 'animation', genres: ['мультфильм'] },
  { id: 'home', countries: ['Россия'] },
  { id: 'scifi', genres: ['фантастика'] },
  { id: 'fantasy', genres: ['фэнтези', 'приключения'] },
  { id: 'horror', genres: ['ужасы'] },
  { id: 'crime', genres: ['криминал', 'детектив'] },
  { id: 'comedy', genres: ['комедия'] },
  { id: 'drama', genres: ['драма'] },
  { id: 'romance', genres: ['мелодрама'] },
  { id: 'war', genres: ['военный', 'история'] },
  { id: 'korea', countries: ['Южная Корея'] },
  { id: 'japan', countries: ['Япония'] },
  { id: 'india', countries: ['Индия'] },
];
const PICK_FILMS = 2;
const shelfById = new Map(TASTE_SHELVES.map((s) => [s.id, s]));

/** Россия и СССР — одна полка «отечественное»: человек, которому нравится «Брат», не делит их. */
const countryKey = (c: string): string => { const ru = countryRu(c); return ru === 'СССР' ? 'Россия' : ru; };

export function deriveContentTaste(entries: TasteEntry[], genresOf: (w: WorkCard) => string[], norm?: number, picks: readonly string[] = []): ContentTaste | undefined {
  const sums = { genres: new Map<string, [number, number]>(), countries: new Map<string, [number, number]>(), creators: new Map<string, [number, number]>() };
  const add = (m: Map<string, [number, number]>, k: string, s: number) => { const v = m.get(k) ?? [0, 0]; m.set(k, [v[0] + s, v[1] + 1]); };
  let n = 0;
  for (const e of entries) {
    const s = ratingSign(e.rating, e.raw, norm);
    if (s == null) continue;
    n += 1;
    for (const g of new Set(genresOf(e.work))) add(sums.genres, g, s);
    for (const c of new Set((e.work.countries ?? []).map(countryKey))) add(sums.countries, c, s);
    for (const p of e.work.creators.slice(0, 2)) add(sums.creators, p, s);
  }
  for (const id of new Set(picks)) {
    const shelf = shelfById.get(id);
    if (!shelf) continue;
    n += 1;
    for (let i = 0; i < PICK_FILMS; i++) {
      for (const g of shelf.genres ?? []) add(sums.genres, g, 1);
      for (const c of shelf.countries ?? []) add(sums.countries, c, 1);
    }
  }
  if (!n) return undefined;
  const fold = (m: Map<string, [number, number]>) => Object.fromEntries([...m].map(([k, [s, c]]) => [k, s / (c + PRIOR)]));
  return { genres: fold(sums.genres), countries: fold(sums.countries), creators: fold(sums.creators) };
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** Близость кандидата к оценённому: жанр — главное, страна — вторым, автор — подсказкой. */
export function contentFit(taste: ContentTaste, work: WorkCard, genresOf: (w: WorkCard) => string[]): number {
  const genre = mean(genresOf(work).map((g) => taste.genres[g] ?? 0));
  const country = mean([...new Set((work.countries ?? []).map(countryKey))].map((c) => taste.countries[c] ?? 0));
  const creator = Math.max(0, ...work.creators.slice(0, 2).map((p) => taste.creators[p] ?? 0));
  return clamp(0.6 * genre + 0.3 * country + 0.1 * creator, -1, 1);
}

/** Вес якоря: полный при первых оценках, к `FADE_AT` — ноль. */
export function contentWeight(rated: number, min = 5): number {
  return CONTENT_WEIGHT * clamp(1 - (rated - min) / (FADE_AT - min), 0, 1);
}

/** Фильм с выбранной полки вкуса — для порядка колоды первых оценок: узнаваемое из своего — вперёд. */
export function onPickedShelf(work: WorkCard, picks: readonly string[], genresOf: (w: WorkCard) => string[]): boolean {
  if (!picks.length) return false;
  const genres = new Set(genresOf(work));
  const countries = new Set((work.countries ?? []).map(countryKey));
  return picks.some((id) => {
    const shelf = shelfById.get(id);
    return Boolean(shelf && ((shelf.genres ?? []).some((g) => genres.has(g)) || (shelf.countries ?? []).some((c) => countries.has(c))));
  });
}
