// «Что может мешать» (ДФ-7, 14.10): барьеры формы из разметки — не «может оттолкнуть», а предметно: «Идёт 3 ч 1 мин»,
// «Чёрно-белый, 1957 год», «Сюжет прерывают песни и танцы». Словарь подписей — в i18n (`ui.hurdles.form`): барьеры в
// разметке — закрытый список из двух десятков названий (draftAnnotations, seriesAnnotations). Предупреждения о
// содержании («Насилие», «Наркотики») — одной строкой. Только факты карточки: чего в данных нет (субтитры, дубляж), не
// придумываем.
import type { WorkCard } from '@/types/tmdf';
import ui from '@/i18n';
import { isSeries } from './media';

export interface Hurdle { short: string; text: string }

/** Фильм длиннее этого — «долгий» и без барьера в разметке: 2 ч 45 мин — уже вечер целиком. */
const LONG_MIN = 165;

const hm = (minutes: number) => ui.hurdles.hm(Math.floor(minutes / 60), minutes % 60);

/** Барьеры формы словами (короткое — в свёрнутую строку, полное — по тапу) и предупреждения о содержании словами. */
export function hurdlesOf(work: WorkCard): { form: Hurdle[]; warnings: string[] } {
  const film = !isSeries(work) && work.type !== 'book';
  const minutes = film ? work.durationMinutes : undefined;
  const labels = [...new Set(work.barriers)];
  if (minutes && minutes >= LONG_MIN && !labels.includes('Долгий хронометраж')) labels.unshift('Долгий хронометраж');
  const form = labels.map((b): Hurdle => {
    const [short, text] = ui.hurdles.form[b] ?? [b.toLowerCase(), b];
    if (b === 'Долгий хронометраж' && minutes) return { short: hm(minutes), text: ui.hurdles.long(hm(minutes)) };
    if (b === 'Чёрно-белое изображение') return { short, text: ui.hurdles.bw(work.year || undefined) };
    return { short, text };
  });
  // «Хоррор-образы» бывают и барьером, и предупреждением — дважды не называем
  const warnings = work.warnings.filter((w) => !labels.includes(w)).map((w) => ui.hurdles.warnings[w] ?? w.toLowerCase());
  return { form, warnings: [...new Set(warnings)] };
}
