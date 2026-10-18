// Правки справочника с таблицей (17.10, волна Б) — для сборщиков и индексов (tools/*: works-index, credits, страницы
// людей). Клиенту этот модуль не импортировать: таблица у него едет ленивым куском (src/api/index.ts, `loadFixes`),
// а статический импорт втащил бы её в первую загрузку. Правила — src/lib/workFixes.ts.
import type { ExternalIds, WorkCard } from '../types/tmdf';
import { workFixes } from '../mocks/workFixes';
import { fixCreditRow, fixWorkIn } from './workFixes';

export { workFixes };

/** Карточка с правкой по её главному ключу (название, год, авторы строкой, снятые люди в `credits`). `ids` — внешние
 *  ключи, если у карточки своих нет (каталог берёт их из externalIds.ts / catalogMedia.ts, книга — с мостом ISBN). */
export const applyWorkFixes = <T extends WorkCard>(work: T, ids: ExternalIds | undefined = work.externalIds): T => fixWorkIn(workFixes, work, ids);

/** Запись авторов src/mocks/workCredits.ts без снятых правкой ключа. */
export const applyCreditFixes = (key: string, row: string): string => fixCreditRow(row, workFixes[key]);

/** Все записи авторов без снятых — копия; ключ, у которого никого не осталось, уходит. */
export function fixCreditRows(rows: Readonly<Record<string, string>>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, row] of Object.entries(rows)) {
    const r = workFixes[k] ? fixCreditRow(row, workFixes[k]) : row;
    if (r) out[k] = r;
  }
  return out;
}
