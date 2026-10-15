import type { ExternalAnalysis } from '@/types/tmdf';

/** Тип спойлера у материала (ДФ-8, 15.10): `craft` — о приёме и устройстве, без развязки, `plot` — с сюжетом.
 *  Пока надёжен только сам автор: «без спойлеров», «стоит ли смотреть», «первые впечатления» — он обещает не раскрывать
 *  сюжет, и такой материал открыт до «Видел» (уровень 0). «Со спойлерами» в названии — сильнее любого обещания.
 *  Остальное ждёт разметки моделью (`spoiler` из справочника) и до того остаётся под замком, как было. */
// трейлеры сюда не входят: разбор трейлера шестого сезона раскрывает первые пять, «Plot Leaks» — сюжет
const FREE = /без\s+спойлер|no\s+spoilers?|spoiler[\s-]?free|non[\s-]?spoiler|перед\s+просмотром|стоит\s+ли\s+смотреть|worth\s+watching|first\s+impressions|первые\s+впечатлени/i;
const WITH = /leaks?\b|слив|со\s+спойлер|with\s+spoilers|spoilers?\s*!|\[spoilers?\]|\(spoilers?\)|spoiler\s+review|spoilers?\s+ahead|концовк|ending|explained|пересказ|recap/i;

// «без спойлеров (почти)» — не обещание; обзор второго и дальше сезона «без спойлеров» — о новом сезоне, прежние он раскрывает
const HEDGED = /почти|almost|minor\s+spoilers?|light\s+spoilers?|season\s*(?:[2-9]|\d{2})|(?:[2-9]|\d{2})[\s-]*(?:й\s+)?сезон|сезон\s*(?:[2-9]|\d{2})|s0?[2-9]\s*e?\d*/i;

export function spoilerKind(a: Pick<ExternalAnalysis, 'title'>): ExternalAnalysis['spoiler'] {
  if (WITH.test(a.title)) return 'plot';
  return FREE.test(a.title) && !HEDGED.test(a.title) ? 'craft' : undefined;
}

/** Проставить тип и открыть материалы «без спойлеров». У кого тип уже есть (из справочника), тех не трогаем. */
export function attachSpoilers(list: ExternalAnalysis[]): void {
  for (const a of list) {
    const kind = a.spoiler ?? spoilerKind(a);
    if (!kind) continue;
    a.spoiler = kind;
    if (kind === 'craft') a.spoilerLevel = 0;
  }
}
