// Чистая часть заложенных героев Вестероса (tools/seed-westeros.mts): что берём из An API of Ice and
// Fire (anapioficeandfire.com) и как это ложится на наши произведения. Сеть — в seed-westeros.mts.

/** Книга API → элемент Wikidata произведения (поиском по названию и автору). */
export interface SeedBook { url: string; name: string; released?: string; q?: string; ru?: string }
/** Персонаж API: где он есть, и его элемент Wikidata с русским именем, если нашёлся. */
export interface SeedCharacter {
  id: string;            // aoiaf-<номер API>
  name: string;          // английское имя из API
  aliases?: string[];
  books: string[];       // url книг API, где он есть (books и povBooks вместе)
  tv: number;            // сезонов «Игры престолов»
  /** элемент Wikidata; null — искали и не нашли (второй прогон не спрашивает) */
  q?: string | null;
  ru?: string;
  ruAka?: string[];
}
export interface WesterosSeed { at: string; books: SeedBook[]; characters: SeedCharacter[] }

/** Сериал «Игра престолов» у нас (ключ — IMDb, как у всех сериалов): по нему считаются сезоны из API. */
export const GOT_KEY = 'imdb:tt0944947';

/** Книги, которых в API нет, а у нас они нужны: по «Пламени и крови» снят «Дом Дракона». */
export const EXTRA_BOOKS = ['Fire & Blood'];
/** Не повествование, а справочник: героев «присутствующими» в нём не считаем. */
export const NOT_STORY = new Set(['The World of Ice and Fire']);

/** Описание элемента Wikidata — про Вестерос: так из тёзок по имени («Jon Snow» — есть и другие)
 *  выбирается наш. */
export const westerosDescription = (d?: string): boolean =>
  Boolean(d && /ice and fire|game of thrones|westeros|house of the dragon|asoiaf|knight of the seven kingdoms|fire & blood|льда и огня|игр[аы] престолов|вестерос/i.test(d));

/** Сколько у персонажа «произведений» до сопоставления с нашим каталогом: книги API, у которых
 *  нашёлся элемент, плюс сериал. Имя в Wikidata ищем только тем, у кого их два и больше, — иначе
 *  героем И1 ему не стать. */
export function appearances(c: Pick<SeedCharacter, 'books' | 'tv'>, bookQ: ReadonlyMap<string, string>): number {
  return new Set(c.books.map((b) => bookQ.get(b)).filter(Boolean)).size + (c.tv > 0 ? 1 : 0);
}

/** Герои API, которых поиск Wikidata не нашёл (06.10): русское имя по переводу АСТ и озвучке HBO, а у кого
 *  элемент всё же есть под другим именем — он (Ходор в API — «Walder», мейстер Эйемон — «Aemon
 *  Targaryen», тёзок много). Без русского имени герой назывался бы «Areo Hotah» и в русских заголовках
 *  разборов не узнавался. 7kingdoms.ru автоматически не читается (06.10), Wikidata у второстепенных
 *  героев Мартина пуста — 17 имён проще вписать. */
export const MANUAL: Record<string, { q?: string; en?: string; ru: string; aka?: string[] }> = {
  'aoiaf-1166': { ru: 'Арео Хотах' },
  'aoiaf-142': { ru: 'Артур Дейн', aka: ['Меч Зари'] },
  'aoiaf-1708': { ru: 'Мирри Маз Дуур' },
  'aoiaf-1179': { ru: 'Азор Ахай' },
  'aoiaf-1444': { ru: 'Серый Король' },
  'aoiaf-2': { q: 'Q55237547', en: 'Hodor', ru: 'Ходор', aka: ['Уолдер'] },
  'aoiaf-1293': { ru: 'Крастер' },
  'aoiaf-54': { q: 'Q24814689', en: 'Aemon Targaryen', ru: 'Эйемон Таргариен', aka: ['Мейстер Эйемон', 'Мейстер Эймон', 'Эймон Таргариен'] },
  'aoiaf-1979': { ru: 'Сирио Форель' },
  'aoiaf-1825': { ru: 'Пиат Прей' },
  'aoiaf-1839': { ru: 'Куэйта' },
  'aoiaf-844': { ru: 'Квентин Мартелл' },
  'aoiaf-151': { ru: 'Эшара Дейн' },
  'aoiaf-1177': { ru: 'Ауран Уотерс' },
  'aoiaf-1411': { ru: 'Гарт Зеленорукий' },
  'aoiaf-1528': { ru: 'Джейехерис I Таргариен', aka: ['Джейехерис Таргариен', 'Старый Король', 'Джейехерис Миротворец'] },
  'aoiaf-1862': { ru: 'Крысиный Повар', aka: ['Повар-Крыса'] },
};

/** Заложенные герои → ключи наших произведений: книги — по элементу (`keysOfWork`), сериал — по ключу,
 *  если он у нас есть. Идентификатор — элемент Wikidata, иначе `aoiaf-<n>`. */
export function seededHeroes(seed: WesterosSeed, keysOfWork: ReadonlyMap<string, string[]>, ourKeys: ReadonlySet<string>):
  { id: string; q?: string; en: string; ru?: string; aka?: string[]; works: string[] }[] {
  const bookQ = new Map(seed.books.filter((b) => b.q && !NOT_STORY.has(b.name)).map((b) => [b.url, b.q!]));
  return seed.characters.map((c) => {
    const m = MANUAL[c.id];
    const q = c.q ?? m?.q;
    const ru = c.ru ?? m?.ru;
    const aka = c.ruAka?.length ? c.ruAka : m?.aka;
    const works = new Set<string>();
    for (const url of c.books) { const q = bookQ.get(url); const k = q ? keysOfWork.get(q)?.[0] : undefined; if (k) works.add(k); }
    if (c.tv > 0 && ourKeys.has(GOT_KEY)) works.add(GOT_KEY);
    return { id: q ?? c.id, ...(q ? { q } : {}), en: m?.en ?? c.name, ...(ru ? { ru } : {}),
      ...(aka?.length ? { aka } : {}), works: [...works] };
  }).filter((h) => h.works.length);
}
