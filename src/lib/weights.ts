// Веса записей (02.10, набросок). Запись — ролик или пост, привязанный к произведению. Сырой счёт
// врёт двояко: догадка по названию весит как подтверждённая, а канал, снявший о «Песни льда и огня»
// 266 роликов, перекрикивает сорок каналов по одному. Вес записи — три множителя, вес произведения —
// сумма с насыщением по каналу.
//
//   вес записи = доверие к привязке × содержательность × доля внимания
//   вес произведения = Σ по каналам Σ_k w_k / √k   (k — место записи в канале по весу)
//
// Доверие — точность привязки с такой уликой, измеренная на решениях людей
// (tools/record-weights.mts → src/mocks/recordTrust.ts); без замера — априорные числа ниже.
import type { ExternalAnalysis } from '@/types/tmdf';

/** Вид подтверждения записи: улика, человек, прислано вручную, без подтверждения. */
export type TrustKind = NonNullable<ExternalAnalysis['evidence']> | 'manual' | 'none';

/** Априорное доверие: доля верных привязок с такой уликой. Замер его заменяет. */
export const TRUST_PRIOR: Record<TrustKind, number> = {
  human: 1, manual: 1, link: 0.97, year: 0.93, original: 0.93, channel: 0.92, tag: 0.85, lore: 0.9, playlist: 0.85, model: 0.86, none: 0.6,
};

export const trustKind = (a: ExternalAnalysis): TrustKind => a.evidence ?? (a.unverified ? 'none' : 'manual');

/** Содержательность: эссе на 40 минут говорит о фильме больше, чем пятиминутка, а пост — меньше ролика.
 *  Обзорщик (`tier: review`) — ×0.7: широкий охват, мелкая глубина. */
export function substance(a: ExternalAnalysis): number {
  if (a.platform === 'telegram') return 0.35;
  const m = a.durationMinutes;
  const depth = m ? Math.min(1, 0.35 + 0.65 * Math.log(1 + m / 4) / Math.log(1 + 45 / 4)) : 0.6;
  return depth * (a.tier === 'review' ? 0.7 : 1);
}

/** Разбор сезона или серии — о сериале частично. */
const share = (a: ExternalAnalysis): number => (a.episode ? 0.5 : a.season ? 0.8 : 1);

export function recordWeight(a: ExternalAnalysis, trust: Partial<Record<TrustKind, number>> = {}): number {
  const k = trustKind(a);
  return (trust[k] ?? TRUST_PRIOR[k]) * substance(a) * share(a);
}

/** Затухание для «говорят сейчас»: полвеса за полгода. */
export const HALF_LIFE_DAYS = 180;
export const freshness = (a: ExternalAnalysis, now = Date.now()): number =>
  a.publishedAt ? 0.5 ** (Math.max(0, now - Date.parse(a.publishedAt)) / 864e5 / HALF_LIFE_DAYS) : 0.25;

/** Вес набора записей: внутри канала k-я по весу запись идёт с множителем 1/√k — голосов больше,
 *  чем роликов одного голоса. `channelOf` — кто говорит (автор, а не площадка). */
export function weightOf(list: readonly ExternalAnalysis[], channelOf: (a: ExternalAnalysis) => string,
  opts: { trust?: Partial<Record<TrustKind, number>>; fresh?: boolean; now?: number } = {}): number {
  const by = new Map<string, number[]>();
  for (const a of list) {
    const w = recordWeight(a, opts.trust) * (opts.fresh ? freshness(a, opts.now) : 1);
    (by.get(channelOf(a)) ?? by.set(channelOf(a), []).get(channelOf(a))!).push(w);
  }
  let sum = 0;
  for (const ws of by.values()) ws.sort((x, y) => y - x).forEach((w, i) => { sum += w / Math.sqrt(i + 1); });
  return sum;
}
