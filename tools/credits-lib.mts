// Чистая часть Д2 (резолв авторов): разбор ответа Wikidata в credits, сборка справочника людей
// и текста моков. Сеть — в tools/resolve-credits.mts; здесь то, что проверяется без неё.
import type { CreditRole, Person, PersonId } from '../src/types/tmdf.ts';

/** Свойство Wikidata → роль. P170 «создатель» у фильма бывает студией или продюсером, поэтому
 *  берётся только у сериала; P50 «автор» — только у книги. */
export const PROP_ROLE: Record<string, CreditRole> = { P57: 'director', P58: 'writer', P170: 'creator', P50: 'author' };
export const ROLE_CODE: Record<CreditRole, string> = { director: 'd', writer: 'w', creator: 'c', author: 'a' };
const ORDER: CreditRole[] = ['creator', 'author', 'director', 'writer'];

export type Kind = 'film' | 'series' | 'book';
export const propsFor = (kind: Kind): string[] =>
  kind === 'book' ? ['P50'] : kind === 'series' ? ['P170', 'P57', 'P58'] : ['P57', 'P58'];

export interface Binding { item: string; prop: string; person: string; ru?: string; en?: string }
/** Кэш по ключу произведения: элемент Wikidata и авторы; пустой список — «искали, авторов нет». */
export interface CreditsEntry { q: string; credits: [PersonId, CreditRole][]; tmdb?: boolean }

const qid = (s: string) => s.split('/').pop()!;

/** Строки SPARQL (`?item ?prop ?person ?ru ?en`) → авторы по элементу и имена людей. Роль берётся
 *  только из свойств, разрешённых виду произведения (`propsFor`). Человек в двух ролях — две
 *  записи; повторов одной роли нет. Порядок — главная роль вида, потом прочие. */
export function parseBindings(rows: Binding[], kindOf: (q: string) => Kind | undefined): {
  byItem: Map<string, [PersonId, CreditRole][]>; names: Map<PersonId, { ru?: string; en?: string }>;
} {
  const byItem = new Map<string, [PersonId, CreditRole][]>();
  const names = new Map<PersonId, { ru?: string; en?: string }>();
  for (const r of rows) {
    const item = qid(r.item), prop = qid(r.prop), person = qid(r.person);
    const kind = kindOf(item);
    if (!kind || !propsFor(kind).includes(prop) || !/^Q\d+$/.test(person)) continue;
    const role = PROP_ROLE[prop];
    const list = byItem.get(item) ?? [];
    if (!list.some(([p, rl]) => p === person && rl === role)) list.push([person, role]);
    byItem.set(item, list);
    const n = names.get(person) ?? {};
    names.set(person, { ru: n.ru ?? r.ru, en: n.en ?? r.en });
  }
  for (const list of byItem.values()) list.sort((a, b) => ORDER.indexOf(a[1]) - ORDER.indexOf(b[1]));
  return { byItem, names };
}

/** Имя человека у нас: русское, если есть; оригинальное — английская метка, если отличается. */
export function toPerson(id: PersonId, n: { ru?: string; en?: string }): Person | undefined {
  const name = n.ru ?? n.en;
  if (!name) return undefined;
  return { id, name, ...(n.en && n.en !== name ? { originalName: n.en } : {}) };
}

/** Текст `src/mocks/workCredits.ts`: ключ произведения → пары «человек, код роли». Компактно —
 *  тысячи карточек, имя живёт в справочнике людей, а не в каждой записи. */
export function workCreditsSource(entries: Record<string, CreditsEntry>, people: Record<PersonId, Person>): string {
  const rows = Object.entries(entries)
    .map(([key, e]) => [key, e.credits.filter(([p]) => people[p])] as const)
    .filter(([, c]) => c.length)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, c]) => `  ${JSON.stringify(key)}: ${JSON.stringify(c.map(([p, r]) => `${p}:${ROLE_CODE[r]}`).join(','))},`);
  return `// Сгенерировано tools/resolve-credits.mts (Д2) — руками не править.
// Ключ произведения (как у разборов: tmdb:, imdb: у сериала, у книги wd:/olw:/isbn:) → «элемент:роль» через запятую;
// роли: d — режиссёр, w — сценарист, c — создатель сериала, a — автор книги. Имена — в people.ts.
export const workCredits: Record<string, string> = {
${rows.join('\n')}
};
`;
}

export function peopleSource(people: Record<PersonId, Person>): string {
  const rows = Object.values(people).sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)))
    .map((p) => `  ${p.id}: ${JSON.stringify(p)},`);
  return `import type { Person, PersonId } from '@/types/tmdf';

/** Справочник авторов (трек Д): элемент Wikidata → имя по-русски и в оригинале.
 *  Сгенерировано tools/resolve-credits.mts (Д2) — руками не править. Кто и где автор — в
 *  workCredits.ts; у карточки без записи там имена берутся из её \`credits\` (\`peopleIn\`). */
export const people: Record<PersonId, Person> = {
${rows.join('\n')}
};
`;
}
