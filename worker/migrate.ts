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
  // 30.09, Е3: сериал — сезон и серия, досмотренные сезоны
  { table: 'journal', column: 'series', ddl: 'ALTER TABLE journal ADD COLUMN series TEXT' },
  // 07.10, ЗП-37: кто привёл — по ссылке «Поделиться» с хвостом `--r<код>` (worker/invite.ts)
  { table: 'user', column: 'invited_by', ddl: 'ALTER TABLE user ADD COLUMN invited_by TEXT' },
  // 07.10, ЗП-13/38: источник прихода — метка `--s<метка>` в ссылке посева
  { table: 'user', column: 'source', ddl: 'ALTER TABLE user ADD COLUMN source TEXT' },
];

/** Новые таблицы — для базы, созданной до них: schema.sql при деплое не прогоняется заново. */
const TABLES: string[] = [
  // 02.10: неточность в карточке произведения
  `CREATE TABLE IF NOT EXISTS work_issue (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES user(id), work_id TEXT NOT NULL,
    title TEXT NOT NULL, fields TEXT NOT NULL, note TEXT, context TEXT, at TEXT NOT NULL)`,
  'CREATE INDEX IF NOT EXISTS work_issue_work ON work_issue(work_id, at)',
  // 06.10, ТВ-3г: открытия материалов — замер рубрик
  `CREATE TABLE IF NOT EXISTS material_open (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES user(id), url TEXT NOT NULL,
    work_id TEXT, platform TEXT, lens TEXT, lens_also TEXT, tier TEXT, place TEXT, shelf TEXT, shelves INTEGER, at TEXT NOT NULL)`,
  'CREATE INDEX IF NOT EXISTS material_open_user ON material_open(user_id, at)',
  // 06.10: разметка владельца с телефона — решения по привязкам и рубрикам
  `CREATE TABLE IF NOT EXISTS owner_decision (kind TEXT NOT NULL, item_id TEXT NOT NULL, body TEXT NOT NULL, at TEXT NOT NULL,
    PRIMARY KEY (kind, item_id))`,
  // 06.10 (ТВ-3в): тестеры — видят все полки, но не статистику и не механику; список ведёт админ
  'CREATE TABLE IF NOT EXISTS tester (username TEXT PRIMARY KEY, at TEXT NOT NULL)',
  // 06.10: подписки на разборы — герой или произведение, сводка раз в день (worker/follow.ts)
  `CREATE TABLE IF NOT EXISTS follow (user_id TEXT NOT NULL REFERENCES user(id), kind TEXT NOT NULL, ref TEXT NOT NULL,
    keys TEXT NOT NULL DEFAULT '', title TEXT NOT NULL, at TEXT NOT NULL, PRIMARY KEY (user_id, kind, ref))`,
  // 07.10, ЗП-17: весть «вышел новый сезон» — одна на сезон (worker/seasons.ts)
  `CREATE TABLE IF NOT EXISTS season_notice (user_id TEXT NOT NULL REFERENCES user(id), key TEXT NOT NULL, season INTEGER NOT NULL,
    at TEXT NOT NULL, PRIMARY KEY (user_id, key, season))`,
  `CREATE TABLE IF NOT EXISTS follow_fresh (url TEXT PRIMARY KEY, key TEXT NOT NULL, title TEXT NOT NULL, author TEXT NOT NULL,
    platform TEXT NOT NULL, spoiler INTEGER NOT NULL DEFAULT 0, tier TEXT, lens TEXT, at TEXT NOT NULL)`,
  'CREATE INDEX IF NOT EXISTS follow_fresh_at ON follow_fresh(at)',
  'CREATE TABLE IF NOT EXISTS follow_digest (user_id TEXT PRIMARY KEY, at TEXT NOT NULL, day TEXT NOT NULL, blocked INTEGER NOT NULL DEFAULT 0)',
  // 06.10: реестр каналов и разметки — в базе, файлы стали снимками (worker/registry.ts)
  `CREATE TABLE IF NOT EXISTS registry (kind TEXT NOT NULL, id TEXT NOT NULL, body TEXT NOT NULL, ord REAL, at TEXT NOT NULL,
    by TEXT, PRIMARY KEY (kind, id))`,
  `CREATE TABLE IF NOT EXISTS registry_log (seq INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, id TEXT NOT NULL,
    before TEXT, after TEXT, at TEXT NOT NULL, by TEXT)`,
  `CREATE INDEX IF NOT EXISTS registry_log_item ON registry_log(kind, id, seq)`,
  `CREATE INDEX IF NOT EXISTS registry_log_at ON registry_log(at)`,
  `CREATE TABLE IF NOT EXISTS registry_meta (k TEXT PRIMARY KEY, v INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS registry_inbox (url TEXT PRIMARY KEY, film TEXT, note TEXT, sheet_at TEXT, taken_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new', result TEXT, done_at TEXT)`,
  `CREATE INDEX IF NOT EXISTS registry_inbox_status ON registry_inbox(status, taken_at)`,
  // 07.10, ЗП-3: заходы по дням и события карточки — воронка и удержание (worker/funnel.ts)
  'CREATE TABLE IF NOT EXISTS visit (user_id TEXT NOT NULL REFERENCES user(id), day TEXT NOT NULL, PRIMARY KEY (user_id, day))',
  'CREATE INDEX IF NOT EXISTS visit_day ON visit(day)',
  `CREATE TABLE IF NOT EXISTS event (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES user(id), kind TEXT NOT NULL,
    work_id TEXT, place TEXT, detail TEXT, at TEXT NOT NULL)`,
  'CREATE INDEX IF NOT EXISTS event_kind_at ON event(kind, at)',
  'CREATE INDEX IF NOT EXISTS event_user ON event(user_id, work_id)',
  // 07.10, ЗП-11: выбор компанией — колода сессии и голоса (worker/together.ts); session_id без внешнего ключа:
  // удаление аккаунта создателя стирает сессию вместе с чужими голосами (worker/account.ts)
  'CREATE TABLE IF NOT EXISTS together (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES user(id), deck TEXT NOT NULL, created_at TEXT NOT NULL)',
  `CREATE TABLE IF NOT EXISTS together_vote (session_id TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES user(id), work_id TEXT NOT NULL,
    vote TEXT NOT NULL CHECK (vote IN ('yes', 'no', 'seen')), fit REAL, at TEXT NOT NULL, PRIMARY KEY (session_id, user_id, work_id))`,
];

let done: Promise<void> | undefined;

/** База подменена (восстановление из копии, server/backup.js) — проверить колонки заново. */
export function forgetMigrations(): void {
  done = undefined;
}

export function migrate(db: D1Database): Promise<void> {
  done ??= (async () => {
    for (const ddl of TABLES) await db.prepare(ddl).run();
    for (const c of COLUMNS) {
      const info = await db.prepare(`PRAGMA table_info(${c.table})`).all<{ name: string }>();
      if (!info.results.some((r) => r.name === c.column)) await db.prepare(c.ddl).run();
    }
  })().catch((err) => { done = undefined; throw err; });
  return done;
}
