// Слой ручных правок справочника (17.10, волна Б проверки справочника; решение владельца 15.10). Замечания разметчиков
// проверены агентами по TMDb и Wikidata (.cache/markup/catalog-fixes/out-*.json), принятые правки — таблица
// src/mocks/workFixes.ts (tools/work-fixes.mts): ключ произведения (как у разметки: фильм `tmdb:`, сериал `imdb:`, книга
// `wd:`) → поля. Ключ — истина: поля правятся под вещь за ключом. Правка лежит на ГЛАВНОЙ копии (src/lib/canon.ts) —
// лишние копии в справочник не идут. Сборщики справочника карточку не трогают, правка накладывается при загрузке:
// на клиенте — src/api/index.ts (таблица — ленивым куском, вместе с поздними модулями), в индексах и сборщиках —
// `applyWorkFixes` из src/lib/workFixesTable.ts. Здесь — только правила, без таблицы: модуль едет в основном бандле.
import type { Credit, ExternalIds, WorkCard } from '../types/tmdf';
import { primaryKey } from './keys';

/** Правка одной вещи. `year: 0` — года нет (античность, вещи до 1500 года); `dropPeople` — «элемент:роль», как в
 *  src/mocks/workCredits.ts (d — режиссёр, w — сценарист, c — создатель сериала, a — автор книги): человек к вещи в этой
 *  роли не относится — снимается и с карточки, и из записи авторов, и со страницы человека. */
export interface WorkFix {
  title?: string;
  originalTitle?: string;
  year?: number;
  creators?: string[];
  dropPeople?: string[];
}
export type WorkFixes = Readonly<Record<string, WorkFix>>;

const ROLE_CODE: Record<Credit['role'], string> = { director: 'd', writer: 'w', creator: 'c', author: 'a' };

/** Снят ли автор правкой: «элемент:роль». */
export const droppedBy = (fix: WorkFix | undefined, c: Pick<Credit, 'personId' | 'role'>): boolean =>
  Boolean(fix?.dropPeople?.includes(`${c.personId}:${ROLE_CODE[c.role]}`));

/** Запись src/mocks/workCredits.ts («Q1:d,Q2:w») без снятых правкой; пустая строка — никого не осталось. */
export function fixCreditRow(row: string, fix: WorkFix | undefined): string {
  if (!row || !fix?.dropPeople?.length) return row;
  const drop = new Set(fix.dropPeople);
  return row.split(',').filter((p) => !drop.has(p)).join(',');
}

/** Правка ключа на карточке. Та же карточка (тот же объект), если править нечего: правка накладывается повторно без
 *  вреда — названия ставятся, снятые снимаются. */
export function fixWork<T extends WorkCard>(w: T, fix: WorkFix | undefined): T {
  if (!fix) return w;
  let out = w;
  const set = <K extends keyof WorkCard>(k: K, v: WorkCard[K]) => {
    if (out[k] === v) return;
    out = out === w ? { ...w } : out;
    (out as WorkCard)[k] = v;
  };
  if (fix.title) set('title', fix.title);
  if (fix.originalTitle) set('originalTitle', fix.originalTitle);
  if (fix.year != null) set('year', fix.year);
  // пустой список — правка тоже: снятый в главной роли уходит и из строк (tools/work-fixes.mts)
  if (fix.creators && fix.creators.join('\u0001') !== (w.creators ?? []).join('\u0001')) set('creators', [...fix.creators]);
  if (fix.dropPeople?.length && w.credits?.some((c) => droppedBy(fix, c))) set('credits', w.credits.filter((c) => !droppedBy(fix, c)));
  return out;
}

/** Правка по таблице: ключ карточки — главный (src/lib/keys.ts), как у разметки и авторов. */
export function fixWorkIn<T extends WorkCard>(table: WorkFixes, w: T, ids: ExternalIds | undefined = w.externalIds): T {
  const key = primaryKey(w, ids);
  return key ? fixWork(w, table[key]) : w;
}
