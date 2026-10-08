// Справочник героев для подписок (06.10): сервер узнаёт героя в заголовке свежего разбора сам
// (worker/follow.ts) — по тем же правилам, что страница героя (`getCharacter`): у разборов его
// произведений — любым именем, у чужих — только «широким» (`w`). Публикуется вместе с остальными
// (tools/publish-reference.mts, имя `heroes`). Запись: n — имя, works — ключи его произведений,
// own/other — исходник выражения (флаг `u`).
import { characters } from '../src/mocks/characters.ts';
import { nameForms, nameRegex, sharedWords } from '../src/lib/characters.ts';

export interface HeroFollow { n: string; works: string[]; own?: string; other?: string }

export function buildHeroesIndex(): Record<string, HeroFollow> {
  const shared = sharedWords(Object.values(characters).map((c) => c.n));
  const out: Record<string, HeroFollow> = {};
  for (const [q, c] of Object.entries(characters)) {
    // элемент Wikidata или номер An API of Ice and Fire (герои Вестероса без элемента)
    if (!/^(Q\d+|aoiaf-\d+)$/.test(q)) continue;
    const own = nameRegex(nameForms({ ru: c.n, en: c.en, aka: c.aka }, { shared }));
    const other = c.w ? nameRegex(c.w) : undefined;
    out[q] = { n: c.n, works: c.works, ...(own ? { own: own.source } : {}), ...(other ? { other: other.source } : {}) };
  }
  return out;
}
