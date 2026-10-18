// Миграции поверх schema.sql. `CREATE TABLE IF NOT EXISTS` новые таблицы добавит сам, а новые
// колонки в старые таблицы — нет: SQLite не умеет `ADD COLUMN IF NOT EXISTS`. Поэтому колонки
// добавляются здесь, по проверке `PRAGMA table_info`, один раз на процесс воркера.
import type { D1Database } from './env';
import { tokenHash } from './auth';
import { migrateWorkAliases } from './workAliases';

/** IMDb сериала в карточке записи дневника — то же выражение в индексе journal_imdb и в запросе worker/seasons.ts:
 *  SQLite берёт индекс по выражению, только если текст совпадает. */
export const JOURNAL_IMDB = "(CASE WHEN json_valid(work) THEN json_extract(work, '$.externalIds.imdb') END)";

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
  // 16.10, ХБ: тестер привязывается к номеру аккаунта при первом входе — ник можно сменить и занять
  { table: 'tester', column: 'tg_id', ddl: 'ALTER TABLE tester ADD COLUMN tg_id INTEGER' },
  // 07.10, ЗП-37: кто привёл — по ссылке «Поделиться» с хвостом `--r<код>` (worker/invite.ts)
  { table: 'user', column: 'invited_by', ddl: 'ALTER TABLE user ADD COLUMN invited_by TEXT' },
  // 07.10, ЗП-13/38: источник прихода — метка `--s<метка>` в ссылке посева
  { table: 'user', column: 'source', ddl: 'ALTER TABLE user ADD COLUMN source TEXT' },
  // 13.10, МА-1/МА-2: уровень сложности и признаки произведения (операции, регистры) — как их видел
  // человек в момент события; «стоило ли» 1–5 у чек-ина (ДФ-10) и причина при 1–2 (worker/metrics.ts)
  ...['impression', 'feedback', 'checkin'].flatMap((table) => [
    { table, column: 'level', ddl: `ALTER TABLE ${table} ADD COLUMN level REAL` },
    { table, column: 'traits', ddl: `ALTER TABLE ${table} ADD COLUMN traits TEXT` },
  ]),
  { table: 'checkin', column: 'worth', ddl: 'ALTER TABLE checkin ADD COLUMN worth INTEGER' },
  { table: 'checkin', column: 'worth_why', ddl: 'ALTER TABLE checkin ADD COLUMN worth_why TEXT' },
  // 14.10, ДФ-11: какой импорт положил запись дневника или оценку — по нему импорт отменяется целиком
  { table: 'journal', column: 'import_id', ddl: 'ALTER TABLE journal ADD COLUMN import_id TEXT' },
  { table: 'rating', column: 'import_id', ddl: 'ALTER TABLE rating ADD COLUMN import_id TEXT' },
  // 14.10, МА-3: открытие материала — чей он (голос из реестра), длина ролика и сколько человек был снаружи
  { table: 'material_open', column: 'voice_id', ddl: 'ALTER TABLE material_open ADD COLUMN voice_id TEXT' },
  { table: 'material_open', column: 'minutes', ddl: 'ALTER TABLE material_open ADD COLUMN minutes INTEGER' },
  { table: 'material_open', column: 'dwell', ddl: 'ALTER TABLE material_open ADD COLUMN dwell INTEGER' },
  // 15.10, ДФ-13: раунд выбора компанией — когда пришёл второй и когда итог открылся всем
  { table: 'together', column: 'round_at', ddl: 'ALTER TABLE together ADD COLUMN round_at TEXT' },
  { table: 'together', column: 'revealed_at', ddl: 'ALTER TABLE together ADD COLUMN revealed_at TEXT' },
  // 17.10, аудит отказов п. 8: сводка подписок — «шлём» до sendMessage, NULL — отправлено (worker/follow.ts)
  { table: 'follow_digest', column: 'state', ddl: 'ALTER TABLE follow_digest ADD COLUMN state TEXT' },
];

// голоса выбора компанией (ЗП-11; ДФ-13 добавил «может быть» и вето)
const TOGETHER_VOTE = `session_id TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES user(id), work_id TEXT NOT NULL,
    vote TEXT NOT NULL CHECK (vote IN ('yes', 'maybe', 'no', 'veto', 'seen')), fit REAL, at TEXT NOT NULL, PRIMARY KEY (session_id, user_id, work_id)`;

/** Таблицы, у которых поменялась проверка (CHECK): SQLite её не меняет на месте — новая таблица, перенос, замена.
 *  `stale` — признак старой версии по тексту CREATE в sqlite_master. */
const REBUILDS: { table: string; stale: (sql: string) => boolean; ddl: string }[] = [
  // 15.10, ДФ-13: голоса «может быть» и «вето»
  { table: 'together_vote', stale: (sql) => !sql.includes("'veto'"), ddl: TOGETHER_VOTE },
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
  `CREATE TABLE IF NOT EXISTS together_vote (${TOGETHER_VOTE})`,
  // 11.10, ЗП-11: команда /together в чате — одноразовый ключ чата для приглашения голосовать (worker/together.ts)
  `CREATE TABLE IF NOT EXISTS together_chat (token TEXT PRIMARY KEY, chat_id INTEGER NOT NULL, title TEXT, lang TEXT,
    created_at TEXT NOT NULL, session_id TEXT)`,
  // 15.10: голосование прямо в чате — подборка и голоса по сообщению (worker/inlinePoll.ts)
  `CREATE TABLE IF NOT EXISTS inline_poll (id TEXT PRIMARY KEY, owner_tg INTEGER NOT NULL, films TEXT NOT NULL, lang TEXT, session_id TEXT,
    created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS inline_vote (msg TEXT NOT NULL, poll_id TEXT NOT NULL, tg_id INTEGER NOT NULL, name TEXT, idx INTEGER NOT NULL,
    at TEXT NOT NULL, PRIMARY KEY (msg, tg_id, idx))`,
  // 13.10, МА-1: снимки карты участника — диапазон сложности, от которого считается «сдвиг» (worker/metrics.ts)
  `CREATE TABLE IF NOT EXISTS level_state (user_id TEXT NOT NULL REFERENCES user(id), at TEXT NOT NULL, center REAL NOT NULL,
    lo REAL NOT NULL, hi REAL NOT NULL, median REAL, n INTEGER NOT NULL, PRIMARY KEY (user_id, at))`,
  // 14.10: выгрузка дневника на час — для downloadFile Telegram (ДФ-14)
  `CREATE TABLE IF NOT EXISTS export_file (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES user(id), name TEXT NOT NULL,
    body TEXT NOT NULL, at TEXT NOT NULL)`,
  // 17.10, аудит отказов п. 7: принятые апдейты Telegram — повтор того же update_id не обрабатываем (worker/inline.ts);
  // старше двух суток чистит тик (worker/index.ts, scheduled)
  'CREATE TABLE IF NOT EXISTS tg_update (update_id INTEGER PRIMARY KEY, at TEXT NOT NULL)',
  'CREATE INDEX IF NOT EXISTS tg_update_at ON tg_update(at)',
  // 17.10, аудит отказов п. 8: замки периодических работ — сводка подписок (worker/follow.ts). locked_at '' — свободно,
  // until — не начинать раньше (пауза по 429 от Telegram)
  "CREATE TABLE IF NOT EXISTS job_lock (name TEXT PRIMARY KEY, locked_at TEXT NOT NULL DEFAULT '', until TEXT NOT NULL DEFAULT '')",
  // 17.10, решение владельца: послесловие к просмотренному (PUT /api/afterword/<workId>, worker/index.ts)
  `CREATE TABLE IF NOT EXISTS afterword (user_id TEXT NOT NULL REFERENCES user(id), work_id TEXT NOT NULL,
    worth INTEGER CHECK (worth BETWEEN 1 AND 5), pace TEXT, hook TEXT, at TEXT NOT NULL, PRIMARY KEY (user_id, work_id))`,
  // 17.10: разовые переносы данных (ONCE ниже) — сделанный не повторяется
  'CREATE TABLE IF NOT EXISTS migration_mark (name TEXT PRIMARY KEY, at TEXT NOT NULL)',
];

/** Индексы (18.10, аудит скорости, волна 3, пп. 24, 26, 28). Отдельно от TABLES и не в schema.sql: строятся после
 *  COLUMNS (user.invited_by — колонка миграции), а на сервере bothost — в отдельном потоке до открытия базы
 *  (server/db-thread.js, задача `migrate`): индекс на таблице в миллионы строк строится секунды, и цикл событий в это
 *  время не стоит. Все — IF NOT EXISTS: повторный запуск ничего не делает. Замер построения на синтетике «полгода»
 *  (2,3 ГБ, 3,3 млн показов) — reports/perf-resilience-1710.md, волна 3Б. */
export const INDEXES: string[] = [
  // п. 24, аналитика владельца: отклик на показ (funnel engagedWith, loop), показ того же фильма раньше (prompted,
  // метрики, rated), разбор того же фильма после показа (engagedWith, pairsWith)
  'CREATE INDEX IF NOT EXISTS feedback_rec ON feedback(user_id, rec_id)',
  'CREATE INDEX IF NOT EXISTS impression_work ON impression(user_id, work_id, at)',
  'CREATE INDEX IF NOT EXISTS material_open_work ON material_open(user_id, work_id, at)',
  // п. 26, сводка подписок: дневник по ключу сериала (worker/seasons.ts) — id записи или IMDb в карточке. json_valid:
  // карточка импорта режется по длине (`.slice(0, 20000)`) и бывает не JSON — json_extract на ней бросил бы, и запись
  // в дневник упала бы вместе с индексом
  'CREATE INDEX IF NOT EXISTS journal_work ON journal(work_id)',
  `CREATE INDEX IF NOT EXISTS journal_imdb ON journal(${JOURNAL_IMDB})`,
  // п. 28, очистки по сроку и удаление аккаунта (worker/inlinePoll.ts, together.ts, account.ts, index.ts). Удаление
  // строки user с foreign_keys = ON ищет ссылки в каждой дочерней таблице — без индекса по user_id это полный проход
  'CREATE INDEX IF NOT EXISTS inline_vote_at ON inline_vote(at)',
  'CREATE INDEX IF NOT EXISTS inline_vote_tg ON inline_vote(tg_id)',
  'CREATE INDEX IF NOT EXISTS inline_vote_poll ON inline_vote(poll_id)',
  'CREATE INDEX IF NOT EXISTS inline_poll_at ON inline_poll(created_at)',
  'CREATE INDEX IF NOT EXISTS inline_poll_owner ON inline_poll(owner_tg)',
  'CREATE INDEX IF NOT EXISTS together_user ON together(user_id, created_at)',
  'CREATE INDEX IF NOT EXISTS together_vote_user ON together_vote(user_id)',
  'CREATE INDEX IF NOT EXISTS together_chat_at ON together_chat(created_at)',
  'CREATE INDEX IF NOT EXISTS together_chat_session ON together_chat(session_id)',
  'CREATE INDEX IF NOT EXISTS export_file_at ON export_file(at)',
  'CREATE INDEX IF NOT EXISTS export_file_user ON export_file(user_id)',
  'CREATE INDEX IF NOT EXISTS work_issue_user ON work_issue(user_id)',
  'CREATE INDEX IF NOT EXISTS seed_applied_seed ON seed_applied(seed)',
  // поиск по нику: подбор в чате (inlineGroup.ts), участник по нику (memberInfo), без владельца (behavior)
  'CREATE INDEX IF NOT EXISTS user_nick ON user(lower(username))',
  'CREATE INDEX IF NOT EXISTS user_invited ON user(invited_by)',
];

/** Разовые переносы данных (17.10). Не по каждому запуску, как колонки: перенос, повторённый после рестарта, вернул бы
 *  то, что человек с тех пор снял сам. Сделанный отмечается в migration_mark тем же пакетом, что и перенос. */
const ONCE: { name: string; sql: string }[] = [
  // 17.10: «стоило ли» из чек-инов (ДФ-10) — в послесловие: последний по времени чек-ин со «стоило ли» на произведение
  { name: 'afterword-from-checkin', sql: `INSERT OR IGNORE INTO afterword (user_id, work_id, worth, at)
      SELECT c.user_id, c.work_id, c.worth, c.at FROM checkin c
       WHERE c.worth BETWEEN 1 AND 5 AND c.work_id <> '' AND c.user_id IN (SELECT id FROM user)
         AND NOT EXISTS (SELECT 1 FROM checkin d WHERE d.user_id = c.user_id AND d.work_id = c.work_id AND d.worth BETWEEN 1 AND 5
                          AND (d.at > c.at OR (d.at = c.at AND d.id > c.id)))` },
];

let done: Promise<void> | undefined;

/** База подменена (восстановление из копии, server/backup.js) — проверить колонки заново. */
export function forgetMigrations(): void {
  done = undefined;
}

/** Миграции уже прогнал кто-то другой (18.10): поток аналитики сервера bothost открывает базу только на чтение и
 *  вызывает обработчики воркера напрямую — миграция там не нужна и не прошла бы (запись). */
export function assumeMigrated(): void {
  done = Promise.resolve();
}

export function migrate(db: D1Database): Promise<void> {
  done ??= (async () => {
    for (const ddl of TABLES) await db.prepare(ddl).run();
    for (const r of REBUILDS) {
      const row = await db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?").bind(r.table).first<{ sql: string }>();
      if (!row || !r.stale(row.sql)) continue;
      await db.batch([
        db.prepare(`DROP TABLE IF EXISTS ${r.table}_new`),
        db.prepare(`CREATE TABLE ${r.table}_new (${r.ddl})`),
        db.prepare(`INSERT INTO ${r.table}_new SELECT * FROM ${r.table}`),
        db.prepare(`DROP TABLE ${r.table}`),
        db.prepare(`ALTER TABLE ${r.table}_new RENAME TO ${r.table}`),
      ]);
    }
    for (const c of COLUMNS) {
      const info = await db.prepare(`PRAGMA table_info(${c.table})`).all<{ name: string }>();
      if (!info.results.some((r) => r.name === c.column)) await db.prepare(c.ddl).run();
    }
    // 18.10: индексы — после колонок; долгое построение видно в журнале (на bothost — в потоке, см. INDEXES)
    for (const ddl of INDEXES) {
      const t0 = Date.now();
      await db.prepare(ddl).run();
      const ms = Date.now() - t0;
      if (ms > 200) console.log(`миграция: ${/INDEX IF NOT EXISTS (\w+)/.exec(ddl)?.[1] ?? ddl} — ${ms} мс`);
    }
    for (const o of ONCE) {
      if (await db.prepare('SELECT 1 AS x FROM migration_mark WHERE name = ?').bind(o.name).first()) continue;
      await db.batch([
        db.prepare(o.sql),
        db.prepare('INSERT OR IGNORE INTO migration_mark (name, at) VALUES (?, ?)').bind(o.name, new Date().toISOString()),
      ]);
    }
    // 17.10, канон копий (worker/workAliases.ts): записи людей с лишних копий одной вещи — на главную; раз на версию
    // таблицы псевдонимов (src/mocks/workAliases.ts), со старыми строками в work_alias_backup. 18.10, проверка перед
    // выкладкой: сбой переноса не кладёт API — иначе каждый запрос повторял бы миграцию и падал; новые записи и так
    // ложатся на главную (canonWork), перенос атомарный и повторится при следующем старте
    try { await migrateWorkAliases(db); } catch (e) { console.error('канон копий: перенос не удался —', e); }
    // 16.10, ХБ: сессии до хеширования лежали токеном как есть. 17.10: не переводим в хеш, а снимаем — сырые токены уже
    // уехали в снятые копии базы, и хеш на месте оставил бы их действующими ключами на 90 дней. Telegram-клиент войдёт
    // заново по initData сам.
    // 17.10, аудит отказов п. 9 — кроме браузерных гостей (u-anon-…, без tg_id): у гостя другого ключа к профилю нет,
    // снятая сессия — потерянные оценки навсегда. Их токен переводим в хеш тем же tokenHash, что у whoIs. КОМПРОМИСС
    // (решение владельца 17.10, чтобы гости не потеряли профили): сырые токены гостей из старых копий базы остаются
    // действительными до конца срока сессии (90 дней)
    const guests = await db.prepare(`SELECT s.token AS token FROM session s JOIN user u ON u.id = s.user_id
      WHERE s.token NOT LIKE 'h:%' AND u.id LIKE 'u-anon-%' AND u.tg_id IS NULL`).all<{ token: string }>();
    if (guests.results.length) {
      await db.batch(await Promise.all(guests.results.map(async (g) =>
        db.prepare('UPDATE OR IGNORE session SET token = ? WHERE token = ?').bind(await tokenHash(g.token), g.token))));
    }
    await db.prepare("DELETE FROM session WHERE token NOT LIKE 'h:%'").run();
  })().catch((err) => { done = undefined; throw err; });
  return done;
}
