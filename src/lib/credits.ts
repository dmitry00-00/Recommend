import type { Credit, CreditRole, Person, PersonId, WorkCard } from '@/types/tmdf';
import { isSeries } from '@/lib/media';
import { primaryKey } from '@/lib/keys';

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

const CYRILLIC = /[А-Яа-яЁё]/;
// латиницей — только полное имя («Bryan Fuller»): одна фамилия («Miller») в русской подписи выглядит обрывком
const FULL_LATIN = /^[A-Za-z][A-Za-z.'’-]*(?:\s+[A-Za-z.'’-]+)+$/;

/** Имя для строки под названием (02.10): главный автор по-русски из справочника; нет — что пришло
 *  с карточкой, если оно по-русски или полным именем латиницей. Иероглифы и одну фамилию не
 *  показываем вовсе: лучше пустая строка, чем «陆川» или «Miller». */
/** Имя для подписи (02.10): русская метка Wikidata бывает полной — «Эльдар Александрович Рязанов»,
 *  «Мегердичев, Антон Евгеньевич». В подписи — «Имя Фамилия», без отчества. */
export function shortName(name: string): string {
  let n = name.trim();
  const inverted = /^([^,]+),\s*(.+)$/u.exec(n);
  if (inverted && CYRILLIC.test(n)) n = `${inverted[2]} ${inverted[1]}`;
  const words = n.split(/\s+/);
  if (words.length === 3 && /(?:ович|евич|ьич|овна|евна|ична|инична)$/u.test(words[1])) n = `${words[0]} ${words[2]}`;
  return n;
}

export const readableName = (n: string): boolean => CYRILLIC.test(n) || FULL_LATIN.test(n.trim());

export function leadName(w: Authored): string | undefined {
  const names = leadCredits(w).map((c) => c.name);
  const readable = (n: string) => CYRILLIC.test(n) || FULL_LATIN.test(n.trim());
  return names.find((n) => CYRILLIC.test(n)) ?? names.find(readable) ?? w.creators.find(readable);
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

const ROLE_BY_CODE: Record<string, CreditRole> = { d: 'director', w: 'writer', c: 'creator', a: 'author' };

/** Запись `src/mocks/workCredits.ts` («Q25191:d,Q25191:w») → `credits` карточки. Человека без
 *  имени в справочнике пропускаем: показать его нечем. */
export function decodeCredits(row: string | undefined, people: Readonly<Record<PersonId, Person>>): Credit[] {
  if (!row) return [];
  return row.split(',').flatMap((pair): Credit[] => {
    const [personId, code] = pair.split(':');
    const role = ROLE_BY_CODE[code];
    const name = people[personId]?.name;
    return role && name ? [{ personId, role, name: shortName(name) }] : [];
  });
}

/** Ключ произведения — тот же, что у генераторов (`analysisKey` в tools/works-index.mts): главный
 *  из `workKeys` (src/lib/keys.ts) — фильм по TMDb, сериал по IMDb, книга по произведению. */
export function workKey(w: Pick<WorkCard, 'type' | 'externalIds'> & { format?: 'series' }, ids = w.externalIds): string | undefined {
  return primaryKey(w, ids);
}

/** Имя как ключ: регистр, диакритика, ё и пунктуация снимаются — «Андрей Тарковский» и
 *  «андрей  тарковский» — одно. */
export const nameKey = (name: string): string =>
  // «й» — отдельная буква, а не «и» с диакритикой: иначе адрес «андреи-тарковскии»
  name.toLowerCase().replace(/ё/g, 'е').replace(/й/g, '\u0001').normalize('NFD').replace(/\p{M}+/gu, '')
    .replace(/\u0001/g, 'й').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '');

/** Адрес страницы автора (Д3): элемент Wikidata, а пока его нет (Д2 не прогнан, человек не
 *  найден) — имя: `n-андреи-тарковскии`. Так страница работает и на карточках со строками `creators`. */
export const personRef = (c: Pick<CreditView, 'personId' | 'name'>): string => c.personId ?? `n-${nameKey(c.name)}`;

/** Тот ли это человек: по элементу Wikidata, а у карточки без него — по имени (русскому или
 *  оригинальному из справочника). */
export function sameCredit(c: CreditView, ref: string, person?: Pick<Person, 'name' | 'originalName'>): boolean {
  if (c.personId) return c.personId === ref;
  const k = nameKey(c.name);
  if (ref.startsWith('n-')) return `n-${k}` === ref;
  return Boolean(person && (nameKey(person.name) === k || (person.originalName && nameKey(person.originalName) === k)));
}
