// Миграции поверх schema.sql. `CREATE TABLE IF NOT EXISTS` новые таблицы добавит сам, а новые
// колонки в старые таблицы — нет: SQLite не умеет `ADD COLUMN IF NOT EXISTS`. Поэтому колонки
// добавляются здесь, по проверке `PRAGMA table_info`, один раз на процесс воркера.
import type { D1Database } from './env';

const COLUMNS: { table: string; column: string; ddl: string }[] = [
  // 24.09, трек Б: прогноз модели вероятностями — для Брайера
  { table: 'prediction', column: 'model_p', ddl: 'ALTER TABLE prediction ADD COLUMN model_p TEXT' },
  // 24.09: «насколько хочется» со свайпа по ленте
  { table: 'feedback', column: 'eagerness', ddl: 'ALTER TABLE feedback ADD COLUMN eagerness INTEGER' },
  // 24.09: «в планы» — теперь запись дневника со статусом planned; сколько хотелось — при ней
  { table: 'journal', column: 'eagerness', ddl: 'ALTER TABLE journal ADD COLUMN eagerness INTEGER' },
  // 24.09: старт по переходу в кинотеатр, а не кнопкой «Начать смотреть»
  { table: 'journal', column: 'inferred', ddl: 'ALTER TABLE journal ADD COLUMN inferred INTEGER' },
];

let done: Promise<void> | undefined;

export function migrate(db: D1Database): Promise<void> {
  done ??= (async () => {
    for (const c of COLUMNS) {
      const info = await db.prepare(`PRAGMA table_info(${c.table})`).all<{ name: string }>();
      if (!info.results.some((r) => r.name === c.column)) await db.prepare(c.ddl).run();
    }
  })().catch((err) => { done = undefined; throw err; });
  return done;
}
