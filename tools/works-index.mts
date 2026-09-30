// Что мы вообще знаем — одним списком для генераторов разборов: каталог, история участника,
// присланное им просмотренное, пул кандидатов и справочник фильмов.
// Ключ разбора — не ID карточки, а внешний идентификатор произведения: одна и та же «Матрица»
// в истории, каталоге и пуле имеет разные ID, а разбор у неё общий. У фильма ключ `tmdb:<id>`,
// у книги — `isbn:<isbn>` (издания разные, разбор один; слой данных ищет по всем ISBN карточки).
import { works as catalogWorks } from '../src/mocks/index.ts';
import { externalIds } from '../src/mocks/externalIds.ts';
import { catalogMedia } from '../src/mocks/catalogMedia.ts';
import { userWorks } from '../src/mocks/userHistory.ts';
import { watchedWorks } from '../src/mocks/userWatched.ts';
import { candidateSeeds, seedToCard } from '../src/mocks/candidates.ts';
import { candidateMedia } from '../src/mocks/candidateMedia.ts';
import { filmBase } from '../src/mocks/filmBase.ts';
import { filmBaseWiki } from '../src/mocks/filmBaseWiki.ts';
import { filmBaseMarkup } from '../src/mocks/filmBaseMarkup.ts';
import { filmBaseCurated } from '../src/mocks/filmBaseCurated.ts';
import { seriesBase } from '../src/mocks/seriesBase.ts';
import type { WorkCard } from '../src/types/tmdf.ts';
import { isSeries } from '../src/lib/media.ts';

export interface IndexedWork {
  key: string;
  work: WorkCard;
  /** названия, по которым ловим произведение в чужом тексте: слишком короткое имя из одного
   *  слова даёт слишком много ложных совпадений («Игра», «Она») */
  names: string[];
}

export function analysisKey(work: WorkCard): string | undefined {
  const ids = work.externalIds ?? catalogMedia[work.id]?.externalIds ?? externalIds[work.id];
  // сериал — по IMDb: номера TMDb у фильмов и сериалов пересекаются (28.09)
  if (isSeries(work)) return ids?.imdb ? `imdb:${ids.imdb}` : undefined;
  if (ids?.tmdb != null) return `tmdb:${ids.tmdb}`;
  if (ids?.isbn?.length) return `isbn:${ids.isbn[0]}`;
  return undefined;
}

/** Все известные произведения без повторов: кто попал в список раньше, тот и остаётся.
 *  Справочник фильмов идёт последним — если фильм уже есть в истории или каталоге,
 *  побеждает он (у него есть разметка, у справочника её нет). */
export function worksIndex({ all: unnamed = false }: {
  /** и те, у кого нет названия, годного для поиска в тексте («Фарго», «Душа»): им нужен ключ
   *  для ручной привязки и место в справочнике таблицы, а в чужом тексте их не ищут (`names` пуст) */
  all?: boolean;
} = {}): IndexedWork[] {
  const all: WorkCard[] = [
    ...Object.values(catalogWorks).map((w) => ({ ...w, externalIds: w.externalIds ?? catalogMedia[w.id]?.externalIds ?? externalIds[w.id] })),
    ...userWorks, ...watchedWorks,
    ...candidateSeeds.map((s) => ({ ...seedToCard(s), ...candidateMedia[s.id] }) as WorkCard),
    ...filmBase,
    // то, о чём говорят каналы: опознано в Wikidata, разметки нет (23.09)
    ...filmBaseWiki,
    // вписано людьми в таблицу разметки и опознано в Wikidata (28.09)
    ...filmBaseMarkup,
    // с полок по просьбам людей, данные TMDb (29.09)
    ...filmBaseCurated,
    // сериалы с черновой разметкой из присланных профилей (Е2, 30.09) — только с ключом: в чужом
    // тексте их пока не ищем («Начало», «Офис», «Счастье» — тёзки фильмов), привязка роликов — Е6
    ...seriesBase,
  ];
  const keyOnly = new Set(seriesBase.map((w) => w.id));
  const out = new Map<string, IndexedWork>();
  for (const work of all) {
    const key = analysisKey(work);
    if (!key || out.has(key)) continue;
    const names = keyOnly.has(work.id) ? [] : [work.title, work.originalTitle].filter((t): t is string => Boolean(t))
      .filter((t) => t.split(/\s+/).length > 1 || t.length >= 6);
    if (names.length || unnamed) out.set(key, { key, work, names });
  }
  return [...out.values()];
}
