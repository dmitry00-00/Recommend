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
import type { WorkCard } from '../src/types/tmdf.ts';

export interface IndexedWork {
  key: string;
  work: WorkCard;
  /** названия, по которым ловим произведение в чужом тексте: слишком короткое имя из одного
   *  слова даёт слишком много ложных совпадений («Игра», «Она») */
  names: string[];
}

export function analysisKey(work: WorkCard): string | undefined {
  const ids = work.externalIds ?? catalogMedia[work.id]?.externalIds ?? externalIds[work.id];
  if (ids?.tmdb != null) return `tmdb:${ids.tmdb}`;
  if (ids?.isbn?.length) return `isbn:${ids.isbn[0]}`;
  return undefined;
}

/** Все известные произведения без повторов: кто попал в список раньше, тот и остаётся.
 *  Справочник фильмов идёт последним — если фильм уже есть в истории или каталоге,
 *  побеждает он (у него есть разметка, у справочника её нет). */
export function worksIndex(): IndexedWork[] {
  const all: WorkCard[] = [
    ...Object.values(catalogWorks).map((w) => ({ ...w, externalIds: w.externalIds ?? catalogMedia[w.id]?.externalIds ?? externalIds[w.id] })),
    ...userWorks, ...watchedWorks,
    ...candidateSeeds.map((s) => ({ ...seedToCard(s), ...candidateMedia[s.id] }) as WorkCard),
    ...filmBase,
    // то, о чём говорят каналы: опознано в Wikidata, разметки нет (23.09)
    ...filmBaseWiki,
  ];
  const out = new Map<string, IndexedWork>();
  for (const work of all) {
    const key = analysisKey(work);
    if (!key || out.has(key)) continue;
    const names = [work.title, work.originalTitle].filter((t): t is string => Boolean(t))
      .filter((t) => t.split(/\s+/).length > 1 || t.length >= 6);
    if (names.length) out.set(key, { key, work, names });
  }
  return [...out.values()];
}
