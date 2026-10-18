// Тексты «что делает» черновой разметки фильмов и сериалов — отдельным ленивым куском (18.10, аудит скорости, волна 2:
// бюджет первой загрузки, tools/load-budget.mjs). Здесь, в исходнике, списки пусты: при сборке и в dev их заполняет
// плагин tools/draft-texts-plugin.mjs из src/mocks/draftAnnotations.ts и seriesAnnotations.ts, а сами эти модули
// приходят в браузер без текстов (`what: ''`). Подбору тексты не нужны — первая лента их не ждёт; кладёт их на место
// `fillDrafts` (src/api/index.ts, `draftTexts()`). Руками не заполнять: порядок — обход `walkDrafts` итогового объекта.
import type { FirstPassAnnotation } from './userAnnotations';

export const draftTexts: string[] = [];
export const seriesTexts: string[] = [];

type Drafts = Readonly<Record<string, FirstPassAnnotation & { seasons?: Readonly<Record<number, FirstPassAnnotation>> }>>;

/** Обход записей: запись, затем её сезоны по порядку ключей — тот же, что у плагина. */
export function walkDrafts(map: Drafts, visit: (d: FirstPassAnnotation) => void): void {
  for (const d of Object.values(map)) {
    visit(d);
    if (d.seasons) for (const s of Object.values(d.seasons)) visit(s);
  }
}

/** Положить тексты на место. Только в облегчённый модуль (все `what` пусты) и только если число записей сошлось:
 *  без плагина (инструменты в node) модуль приходит с текстами, а списки пусты — тогда ничего не трогаем. */
export function fillDrafts(map: Drafts, texts: readonly string[]): boolean {
  let n = 0;
  let empty = true;
  walkDrafts(map, (d) => { n += 1; if (d.what) empty = false; });
  if (!empty || n !== texts.length) return false;
  let i = 0;
  walkDrafts(map, (d) => { (d as { what: string }).what = texts[i++]; });
  return true;
}
