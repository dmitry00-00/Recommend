import type { ExternalAnalysis } from '@/types/tmdf';

/** Карточка по глубине (15.10, владелец): материалы о фильме — не одной лентой, где грехообзор стоит рядом с эссе, а
 *  тремя зонами со своим форматом. Мнения — «стоит ли смотреть»: короткие обзоры, рубрика «Мнения», посты Telegram;
 *  пробегают глазами, поэтому плотным списком. Грехи — развлекательная критика (грехи, ляпы, треш); обычно после
 *  просмотра, плитками. Разборы — всё, что объясняет: смысл, специалист, как было, книга и фильм, сравнение, факты,
 *  персонаж, франшиза, автор; выбор на полчаса, поэтому крупно и по одному, рубрики — подполками.
 *
 *  Зоны равноправны, как и рубрики (06.10): порядок на переключателе постоянный, а открывается карточка там, где человек
 *  сейчас, — не видел фильм: мнения, видел: разборы. Новой разметки не нужно: ярус `review` (обзорные каналы) и рубрика
 *  ролика (ТВ-3) уже есть; ролик без рубрики — мнение, если он с обзорного канала, иначе разбор. */
export type Zone = 'opinions' | 'sins' | 'deep';
export const ZONES: Zone[] = ['opinions', 'sins', 'deep'];

export function zoneOf(a: ExternalAnalysis): Zone {
  if (a.platform === 'telegram') return 'opinions';
  if (a.lens === 'sins') return 'sins';
  if (a.lens === 'opinion') return 'opinions';
  if (a.lens && a.lens !== 'other') return 'deep';
  return a.tier === 'review' ? 'opinions' : 'deep';
}

export function byZone(list: ExternalAnalysis[]): Record<Zone, ExternalAnalysis[]> {
  const out: Record<Zone, ExternalAnalysis[]> = { opinions: [], sins: [], deep: [] };
  for (const a of list) out[zoneOf(a)].push(a);
  return out;
}
