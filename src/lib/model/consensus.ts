// «Как фильм оценили другие» (23.10, опыт `consensus`, src/lib/model/experiments.ts). Разбор замера
// (.cache/eval/why-2026-10-22.md) показал: сильнее всего то, понравится ли человеку фильм, предсказывает то, как его оценили
// остальные, — а в счёте подбора этого не было совсем. Здесь — сама мера и её сборка: каждый человек оценивает в своей
// шкале, поэтому берётся z-оценка (сколько его разбросов от его же среднего), по фильму — среднее по людям, сжатое к нулю
// (`SHRINK` воображаемых людей с оценкой «как обычно»): фильм, который оценили двое, не взлетает. Меньше `MIN_PEOPLE` —
// фильма в таблице нет вовсе: и шум, и чужая оценка не должна угадываться по таблице.
// Таблица собирается из историй зрителей (tools/build-consensus.mts → src/mocks/consensus.ts); замер собирает её каждому
// человеку заново без него самого (tools/taste-eval.mts), иначе он подсказывал бы себе спрятанное.
import type { WorkCard } from '@/types/tmdf';

export const SHRINK = 3;
export const MIN_PEOPLE = 3;
/** вес в счёте ленты (счёт около 0…1, мера — около −1…1) */
export const CONSENSUS_WEIGHT = { value: 0.3 };

/** человек → (ключ фильма → его z-оценка) ⇒ ключ фильма → сжатое среднее; `skip` — без этого человека (замер) */
export function consensusFrom(people: Map<string, Map<string, number>>, skip?: string): Map<string, number> {
  const sum = new Map<string, number>(), n = new Map<string, number>();
  for (const [who, zs] of people) {
    if (who === skip) continue;
    for (const [k, z] of zs) { sum.set(k, (sum.get(k) ?? 0) + z); n.set(k, (n.get(k) ?? 0) + 1); }
  }
  const out = new Map<string, number>();
  for (const [k, cnt] of n) if (cnt >= MIN_PEOPLE) out.set(k, Math.round((sum.get(k)! / (cnt + SHRINK)) * 100) / 100);
  return out;
}

/** z-оценки одного человека: сырые оценки → (оценка − среднее) / разброс; разброс ноль — все нули */
export function zScores(raws: Map<string, number>): Map<string, number> {
  const v = [...raws.values()];
  if (!v.length) return new Map();
  const m = v.reduce((a, b) => a + b, 0) / v.length;
  const sd = Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length) || 1;
  return new Map([...raws].map(([k, r]) => [k, (r - m) / sd]));
}

/** Ключи фильма в таблице: у фильма — TMDb и IMDb, у сериала — только IMDb и `tmdbtv:` (номера TMDb у фильмов и
 *  сериалов пересекаются). */
export function consensusKeys(type: string, ids: { tmdb?: number; imdb?: string } | undefined): string[] {
  const series = type === 'series' || type === 'anime';
  return [
    ...(ids?.tmdb != null ? [series ? `tmdbtv:${ids.tmdb}` : `tmdb:${ids.tmdb}`] : []),
    ...(ids?.imdb ? [`imdb:${ids.imdb}`] : []),
  ];
}

/** Мера фильма по таблице: первый найденный ключ; нет — undefined («ничего не знаем», в счёт не идёт). */
export function consensusOf(table: Record<string, number> | Map<string, number>, work: WorkCard, ids = work.externalIds): number | undefined {
  for (const k of consensusKeys(work.type, ids)) {
    const v = table instanceof Map ? table.get(k) : table[k];
    if (v != null) return v;
  }
  return undefined;
}
