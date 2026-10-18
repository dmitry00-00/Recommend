// Канон копий (17.10, волна А проверки дублей; правило главной копии — владелец): одна вещь лежит в справочнике
// несколькими карточками (история владельца u-kp…, присланный список l-tmdb…, кандидаты, filmBase, filmBaseWiki).
// Таблица «лишний id → главный» — src/mocks/workAliases.ts (tools/work-aliases.mts). Всё, что приходит по id — журнал,
// оценки, планы, просмотренное, послесловия, события, ссылки, — сводится к главному; лишние карточки в ленту, поиск,
// страницы и подбор не идут. Импорт — относительный: модуль берёт и сервер (worker/workAliases.ts, сборка без «@/»).
import { workAliases, workAliasesVersion } from '../mocks/workAliases';

export type AliasTable = Readonly<Record<string, string>>;
export { workAliases, workAliasesVersion };

const own = Object.prototype.hasOwnProperty;

/** Главный id вещи: лишняя копия — id главной, остальное — как есть. Таблица уже свёрнута (главная не бывает лишней),
 *  но десять шагов — на случай таблицы, собранной руками в тесте. */
export function canonIn(table: AliasTable, id: string): string {
  let x = id;
  for (let n = 0; n < 10 && own.call(table, x); n++) x = table[x];
  return x;
}

export const canon = (id: string): string => canonIn(workAliases, id);

/** Лишняя копия — в ленту, поиск и на страницы не идёт. */
export const isAlias = (id: string): boolean => own.call(workAliases, id);

let byMain: Map<string, string[]> | undefined;
/** Лишние копии главной — им при загрузке справочника отдаются ключи и разметка, которых у главной нет. */
export function aliasesOf(main: string): readonly string[] {
  if (!byMain) {
    byMain = new Map();
    for (const [a, m] of Object.entries(workAliases)) byMain.set(m, [...(byMain.get(m) ?? []), a]);
  }
  return byMain.get(main) ?? [];
}
