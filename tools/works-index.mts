// Что мы вообще знаем — одним списком для генераторов разборов: каталог, история участника,
// присланное им просмотренное, пул кандидатов и справочник фильмов.
// Ключ разбора — не ID карточки, а внешний идентификатор произведения: одна и та же «Матрица»
// в истории, каталоге и пуле имеет разные ID, а разбор у неё общий. У фильма ключ `tmdb:<id>`,
// у книги — произведение: `wd:`/`olw:`, а без моста — `isbn:<isbn>` (src/lib/keys.ts, З1).
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
import { primaryKey, withBookWork, workKeys } from '../src/lib/keys.ts';
import { bookWorks } from '../src/mocks/bookWorks.ts';

export interface IndexedWork {
  key: string;
  work: WorkCard;
  /** названия, по которым ловим произведение в чужом тексте: слишком короткое имя из одного
   *  слова даёт слишком много ложных совпадений («Игра», «Она») */
  names: string[];
  /** сериал из присланных профилей с названием в одно слово («Офис», «Счастье», «Топи»): такое
   *  слово слишком часто значит что-то другое, поэтому совпадение засчитывается, только если
   *  материал говорит о сериале (`talksSeries`, Е6) */
  needsSeriesTalk?: boolean;
}

/** Внешние ключи карточки: свои, из медиа каталога или справочника; у книги — с мостом
 *  «ISBN → произведение» (src/mocks/bookWorks.ts, З1). */
export function idsOf(work: WorkCard): WorkCard['externalIds'] {
  return withBookWork(work.externalIds ?? catalogMedia[work.id]?.externalIds ?? externalIds[work.id], bookWorks);
}

/** Главный ключ произведения (src/lib/keys.ts): фильм — TMDb, сериал — IMDb (номера TMDb у фильмов
 *  и сериалов пересекаются, 28.09), книга — произведение (`wd:`, `olw:`), а без моста — ISBN. */
export function analysisKey(work: WorkCard): string | undefined {
  return primaryKey(work, idsOf(work));
}

/** Все ключи произведения — главный и запасные (старые `isbn:` у книги). */
export function analysisKeys(work: WorkCard): string[] {
  return workKeys(work, idsOf(work));
}

/** Все известные произведения без повторов: кто попал в список раньше, тот и остаётся.
 *  Справочник фильмов идёт последним — если фильм уже есть в истории или каталоге,
 *  побеждает он (у него есть разметка, у справочника её нет). */
export function worksIndex({ all: unnamed = false, isbnKeys = false }: {
  /** и те, у кого нет названия, годного для поиска в тексте («Фарго», «Душа»): им нужен ключ
   *  для ручной привязки и место в справочнике таблицы, а в чужом тексте их не ищут (`names` пуст) */
  all?: boolean;
  /** книги — по ISBN, без моста к произведению: так видит справочник сам мост
   *  (tools/resolve-book-works.mts), иначе ошибочный мост, склеивший две книги, прятал бы одну из них */
  isbnKeys?: boolean;
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
    // сериалы с черновой разметкой из присланных профилей (Е2, 30.09); с одним словом в названии
    // ищутся только в разговоре о сериале (Е6): «Офис», «Счастье», «Начало» — обычные слова и тёзки фильмов
    ...seriesBase,
  ];
  const fromProfiles = new Set(seriesBase.map((w) => w.id));
  // названия, которые чаще значат другое: группа, роман, другая экранизация того же романа
  // (замер 30.09 по дампу роликов: песни «Короля и Шута», разборы романа Достоевского и сериала
  // 2024-го, фильм «Граф Монте-Кристо» 2024-го уходили к сериалам из профилей)
  const ALSO_ELSEWHERE = new Set(['король и шут', 'преступление и наказание', 'граф монте-кристо']);
  const out = new Map<string, IndexedWork>();
  for (const work of all) {
    const key = isbnKeys ? primaryKey(work, work.externalIds ?? catalogMedia[work.id]?.externalIds ?? externalIds[work.id]) : analysisKey(work);
    if (!key || out.has(key)) continue;
    const names = [work.title, work.originalTitle].filter((t): t is string => Boolean(t))
      .filter((t) => t.split(/\s+/).length > 1 || t.length >= 6);
    const needsSeriesTalk = fromProfiles.has(work.id)
      && (work.title.trim().split(/\s+/).length === 1 || ALSO_ELSEWHERE.has(work.title.trim().toLowerCase()));
    if (names.length || unnamed) out.set(key, { key, work, names, ...(needsSeriesTalk ? { needsSeriesTalk } : {}) });
  }
  return [...out.values()];
}
