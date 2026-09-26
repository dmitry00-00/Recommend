// Улики привязки (трек В, шаг В3): когда привязка разбора к фильму по названию подтверждается
// без человека. Название совпало — это догадка («Призрак» Полански и «Призрак в доспехах»).
// Догадка становится фактом, если рядом есть то, что у тёзки не совпадёт:
//
//   · link     — пост ссылается на страницу именно этого фильма: Кинопоиск, IMDb или TMDb по
//                тому же идентификатору. Сильнее не бывает;
//   · year     — рядом с названием стоит год выхода этого фильма. У тёзок годы разные, а
//                «Название (2012)» — обычная подпись разбора у каналов;
//   · original — в тексте есть и оригинальное название латиницей («Прочь / Get Out»).
//
// Чего правило не делает: не подтверждает по одному названию, как бы длинно оно ни было, и не
// опровергает — отсутствие улики значит «не знаем», а не «не тот фильм». Что осталось без
// улики, остаётся в очереди «тот ли это фильм».
import type { WorkCard } from '../src/types/tmdf.ts';

export type Evidence = 'link' | 'year' | 'original';
/** Противоречие: рядом с названием стоят годы, и ни один не похож на год этого фильма.
 *  Так выглядит ремейк или тёзка — «Хэллоуин 2007» при «Хэллоуине» 1978-го (замер 24.09:
 *  без этого правила оригинальное название подтверждало ремейки — у них оно общее). */
export type Verdict = Evidence | 'conflict' | undefined;

/** Сколько текста вокруг заголовка смотрим: подпись разбора — в начале поста или ролика. */
const HEAD = 400;

const kinopoiskId = (w: WorkCard): number | undefined =>
  w.externalIds?.kinopoisk ?? (/^u-kp(\d+)$/.exec(w.id) ? Number(/^u-kp(\d+)$/.exec(w.id)![1]) : undefined);

export function evidenceFor(work: WorkCard, text: string, links: string[] = []): Verdict {
  const ids = work.externalIds ?? {};
  const kp = kinopoiskId(work);
  const hay = [text, ...links].join(' ');
  if (kp && new RegExp(`kinopoisk\\.ru/(?:film|series)/${kp}(?!\\d)`).test(hay)) return 'link';
  if (ids.imdb && new RegExp(`imdb\\.com/title/${ids.imdb}(?!\\d)`).test(hay)) return 'link';
  if (ids.tmdb != null && new RegExp(`themoviedb\\.org/(?:movie|tv)/${ids.tmdb}(?!\\d)`).test(hay)) return 'link';

  const head = text.slice(0, HEAD);
  const yearsIn = (s: string) => [...new Set([...s.matchAll(/(?<!\d)(19[0-9]{2}|20[0-4][0-9])(?!\d)/g)].map((m) => Number(m[1])))];
  const years = yearsIn(head);
  // ±1: фестивальный год и год проката у одного фильма часто разные;
  // подборка «лучшее 2010-х» с десятком годов — ни улика, ни противоречие
  if (work.year && years.length && years.length <= 2 && years.some((y) => Math.abs(y - work.year) <= 1)) return 'year';
  // Противоречие — только в заголовке (первая строка): «Хэллоуин 2007», «(Lembayung, 2024)».
  // Год дальше по тексту обычно про другое — «следующей работой режиссёра в 2021-м» (замер 24.09)
  const title = head.split('\n').map((l) => l.trim()).find(Boolean)?.slice(0, 150) ?? '';
  const titleYears = yearsIn(title);
  if (work.year && titleYears.length && titleYears.length <= 2 && !titleYears.some((y) => Math.abs(y - work.year) <= 1)) return 'conflict';
  const orig = work.originalTitle?.trim();
  if (orig && orig.length >= 5 && /[A-Za-z]/.test(orig) && orig.toLowerCase() !== work.title.toLowerCase()) {
    const esc = orig.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    if (new RegExp(`(?<![\\p{L}\\p{N}])${esc}(?![\\p{L}\\p{N}])`, 'iu').test(head)) return 'original';
  }
  return undefined;
}
