import type { WorkCard } from '@/types/tmdf';

/** Части одной серии в колоде — по году (ТВ-9, 06.10): «Две крепости» стояли раньше «Братства
 *  Кольца». Серия — общее начало названия до двоеточия или номера части («Властелин колец: …»,
 *  «Брат 2», «Джокер: Безумие на двоих»). Части встают по году на места, которые серия уже
 *  занимала, — остальной порядок колоды (самые смотримые сверху) не трогаем. Общее у колоды в
 *  приложении и снимка колоды (tools/build-deck-cards.mts, РР-5). */
export function partsInOrder<T extends Pick<WorkCard, 'title' | 'year'>>(list: T[]): T[] {
  const stem = (t: string) => t.toLowerCase().replace(/ё/g, 'е').split(/[:.—–]/)[0].replace(/\s+\d+\s*$/, '').trim();
  const groups = new Map<string, number[]>();
  list.forEach((w, i) => groups.set(stem(w.title), [...(groups.get(stem(w.title)) ?? []), i]));
  const out = [...list];
  for (const at of groups.values()) {
    if (at.length < 2) continue;
    const parts = at.map((i) => list[i]).sort((a, b) => (a.year || 9999) - (b.year || 9999));
    at.forEach((i, n) => { out[i] = parts[n]; });
  }
  return out;
}
