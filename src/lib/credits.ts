import type { Credit, CreditRole, Person, PersonId, WorkCard } from '@/types/tmdf';
import { isSeries } from '@/lib/media';

/** Авторы произведения (трек Д, Д1). Карточки бывают двух поколений: с `credits` (резолвер знает
 *  элемент Wikidata и роль) и только со строками `creators`. Экраны и подбор читают авторов
 *  через `creditsOf` и не думают, какое поколение перед ними. */

type Authored = Pick<WorkCard, 'type' | 'creators' | 'credits'> & { format?: 'series' };

/** Чьё имя стоит в `creators`, если роли не сказано: у фильма — режиссёр, у сериала — создатель,
 *  у книги — автор. Так эти строки и собирались (P57 Wikidata, `created_by` TMDb, автор книги). */
export function defaultRole(w: Pick<WorkCard, 'type'> & { format?: 'series' }): CreditRole {
  return w.type === 'book' ? 'author' : isSeries(w) ? 'creator' : 'director';
}

/** Автор, каким его видит экран: элемент Wikidata — когда известен. */
export interface CreditView {
  personId?: PersonId;
  role: CreditRole;
  name: string;
}

/** Все авторы карточки. Справочник людей, когда передан, главнее имени-снимка в карточке. */
export function creditsOf(w: Authored, people?: Readonly<Record<PersonId, Person>>): CreditView[] {
  if (w.credits?.length) {
    return w.credits.map((c) => ({ personId: c.personId, role: c.role, name: people?.[c.personId]?.name ?? c.name }));
  }
  const role = defaultRole(w);
  return w.creators.filter(Boolean).map((name) => ({ role, name }));
}

/** Главные авторы — те, чьё имя идёт в строку под названием: режиссёр фильма, создатель
 *  сериала, автор книги. Сценаристы — в `creditsOf`, но не здесь. */
export function leadCredits(w: Authored, people?: Readonly<Record<PersonId, Person>>): CreditView[] {
  const all = creditsOf(w, people);
  const lead = all.filter((c) => c.role === defaultRole(w));
  return lead.length ? lead : all;
}

/** Строки `creators` из `credits` — чтобы старые экраны и поиск видели то же, что новые. */
export function creatorsFrom(credits: readonly Credit[], role: CreditRole): string[] {
  return [...new Set(credits.filter((c) => c.role === role).map((c) => c.name))];
}

/** Работал ли человек над произведением (в любой роли, или в заданной). */
export function hasPerson(w: Authored, personId: PersonId, role?: CreditRole): boolean {
  return Boolean(w.credits?.some((c) => c.personId === personId && (!role || c.role === role)));
}

/** Справочник людей из карточек: кто встречается хоть в одной — с именем из неё. Нужен, пока
 *  отдельный справочник (Д2) не собран, и для карточек, пришедших с сервера. */
export function peopleIn(works: Iterable<Pick<WorkCard, 'credits'>>, known: Readonly<Record<PersonId, Person>> = {}): Map<PersonId, Person> {
  const out = new Map<PersonId, Person>(Object.entries(known));
  for (const w of works) for (const c of w.credits ?? []) if (!out.has(c.personId)) out.set(c.personId, { id: c.personId, name: c.name });
  return out;
}

/** Элемент Wikidata ли это: «Q» и цифры. */
export const isPersonId = (id: string): id is PersonId => /^Q\d+$/.test(id);
