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

// ─── «сначала известное, о чём мнения расходятся» (23.10, опыт `deckOrder`, src/lib/model/experiments.ts) ──────────
// Порядок колоды первых оценок по HELF (Rashid et al. 2002/2008, research_notes/…/product_feedback.md): оценка фильма,
// который видели все и оценили одинаково, о вкусе новичка почти ничего не говорит; фильм, которого никто не видел, — «не
// смотрел». HELF — гармоническое среднее нормированной энтропии оценок и нормированного log числа оценивших: высок, только
// когда высоко и то и другое. Оценки — в шкале каждого человека: z-оценка (как в consensus.ts) по пяти корзинам с границами
// квинтилей нормального распределения. Не сырая шкала 1–5: у людей разные шкалы (Кинопоиск 1–10, Letterboxd 0,5–5), и
// строгий против щедрого — это не разногласие о фильме, а разная привычка ставить оценки. Таблица по колодам —
// tools/build-deck-order.mts → src/mocks/deckOrder.ts (лениво, ≈2 КБ); замер — tools/deck-order-eval.mts.
export const DECK_ORDER = {
  /** фильм, который оценили меньше людей, балла не получает (правило таблиц — не меньше 3) */
  minPeople: 5,
  /** границы корзин z: квинтили N(0, 1) */
  zEdges: [-0.8416, -0.2533, 0.2533, 0.8416],
};

/** корзина z-оценки: 0 (сильно ниже своего среднего) … 4 (сильно выше) */
export function zBin(z: number): number {
  let b = 0;
  while (b < DECK_ORDER.zEdges.length && z > DECK_ORDER.zEdges[b]) b++;
  return b;
}

/** HELF фильма по числу оценок в корзинах; `people` — сколько людей в таблице (для нормировки log числа оценивших) */
export function helf(bins: ArrayLike<number>, people: number): number {
  let n = 0;
  for (let i = 0; i < bins.length; i++) n += bins[i];
  if (n < 2 || people < 2) return 0;
  let h = 0;
  for (let i = 0; i < bins.length; i++) if (bins[i]) { const p = bins[i] / n; h -= p * Math.log(p); }
  const hn = h / Math.log(bins.length), lf = Math.min(1, Math.log(n) / Math.log(people));
  return hn + lf > 0 ? (2 * hn * lf) / (hn + lf) : 0;
}

/** Колода по баллу: с баллом — по убыванию (равные — в прежнем порядке), без балла — следом в прежнем порядке (их почти
 *  никто из наших зрителей не оценил, «не смотрел» вероятнее); части серии — по году на своих местах (partsInOrder). */
export function byDeckScore<T extends Pick<WorkCard, 'title' | 'year'>>(list: T[], score: (w: T) => number | undefined): T[] {
  const s = list.map((w, i) => ({ w, i, v: score(w) }));
  const has = s.filter((x) => x.v != null).sort((a, b) => b.v! - a.v! || a.i - b.i);
  return partsInOrder([...has, ...s.filter((x) => x.v == null)].map((x) => x.w));
}
