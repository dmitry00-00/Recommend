import type { Person, PersonId } from '@/types/tmdf';

/** Справочник авторов (трек Д): элемент Wikidata → имя по-русски и в оригинале.
 *  Пуст до Д2 — его соберёт резолв авторов (Wikidata P57, P58, P170, P50; TMDb `created_by`).
 *  Пока его нет, имена берутся из `credits` самих карточек (`peopleIn` в `src/lib/credits.ts`). */
export const people: Record<PersonId, Person> = {};
