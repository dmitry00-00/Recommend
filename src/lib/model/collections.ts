// Культурные подборки (ЗП-45, шаг 2, 11.10): витрина поверх того, что уже размечено, — не каталог на сотни полок.
// Подборка — правило (страна производства, жанры TMDb, годы), а не список: фильмы приходят из пула ленты, у каждого
// есть уровень и разборы, и новая разметка сама пополняет полку. Своё отличие — порядок: от уровня комфорта человека
// вглубь, так полка становится маршрутом «на шаг сложнее». Без «почему вам»: у полки одна строка о том, что в ней.
import type { WorkCard } from '@/types/tmdf';
import { countryRu } from '@/lib/countries';

export interface Collection {
  id: string;
  /** страны производства по-русски; фильм подходит, если среди его стран есть хоть одна */
  countries?: string[];
  /** и ни одной из этих: совместное производство с Голливудом — уже не кино страны («Облачный атлас» —
   *  не гонконгское, «Эддингтон» — не скандинавское; как срезы ЗП-35) */
  notCountries?: string[];
  /** жанры TMDb по-русски (src/mocks/filmGenres.ts): хоть один из них */
  genres?: string[];
  /** и ни одного из этих */
  notGenres?: string[];
  /** годы выхода, включительно */
  from?: number;
  to?: number;
}

const HOLLYWOOD = ['США', 'Великобритания'];
export const COLLECTIONS: readonly Collection[] = [
  { id: 'soviet-sf', countries: ['СССР'], genres: ['фантастика'] },
  { id: 'korea-genre', countries: ['Южная Корея'], notCountries: HOLLYWOOD, genres: ['триллер', 'криминал', 'ужасы', 'боевик', 'детектив'] },
  { id: 'japan-classic', countries: ['Япония'], notCountries: HOLLYWOOD, to: 1980, notGenres: ['мультфильм'] },
  { id: 'iran', countries: ['Иран'], notCountries: HOLLYWOOD },
  // без семейного и сказочного: «Ходячий замок» и «Дитя погоды» TMDb семейными не помечает
  { id: 'adult-animation', genres: ['мультфильм'], notGenres: ['семейный', 'приключения', 'фэнтези'] },
  // «Интердевочка» — советско-шведская
  { id: 'nordic', countries: ['Швеция', 'Дания', 'Норвегия', 'Финляндия', 'Исландия'], notCountries: [...HOLLYWOOD, 'СССР'] },
  // «Подсолнухи» — итало-советские
  { id: 'new-hollywood', countries: ['США'], notCountries: ['СССР', 'Италия'], from: 1967, to: 1980 },
  // гонконгское — без материкового Китая: «Герой» и «Дорога домой» Чжан Имоу — не школа Гонконга; «Монгол» — российский
  { id: 'hong-kong', countries: ['Гонконг'], notCountries: [...HOLLYWOOD, 'Китай', 'Россия', 'Германия'] },
];

export const collectionById = (id: string): Collection | undefined => COLLECTIONS.find((c) => c.id === id);

export function inCollection(c: Collection, work: WorkCard, genres: readonly string[]): boolean {
  if (c.from && (!work.year || work.year < c.from)) return false;
  if (c.to && (!work.year || work.year > c.to)) return false;
  if (c.genres && !c.genres.some((g) => genres.includes(g))) return false;
  if (c.notGenres?.some((g) => genres.includes(g))) return false;
  if (c.countries) {
    const own = (work.countries ?? []).map(countryRu);
    if (!c.countries.some((x) => own.includes(x))) return false;
    if (c.notCountries?.some((x) => own.includes(x))) return false;
  }
  return true;
}

/** Порядок полки от уровня человека вглубь: сначала то, что на его уровне или чуть ниже (до шага вниз), по
 *  возрастанию сложности; то, что заметно проще, — в конце, ближнее к его уровню первым. */
export function levelPath<T>(items: readonly T[], level: (x: T) => number, comfort: number): T[] {
  const ahead = items.filter((x) => level(x) >= comfort - 1).sort((a, b) => level(a) - level(b));
  const below = items.filter((x) => level(x) < comfort - 1).sort((a, b) => level(b) - level(a));
  return [...ahead, ...below];
}

/** Подборки голосов (ЗП-45, шаг 3): плейлисты эссеистов, tools/voice-playlists.mts. `items` — по порядку плейлиста:
 *  [ролик YouTube, ключ фильма `tmdb:`]; ролик может стоять у двух фильмов (сравнение), фильм — один раз. */
export interface VoicePlaylist { id: string; channelId: string; channel: string; title: string; items: [string, string][] }
export interface VoicePlaylists { at: string; lists: VoicePlaylist[] }
