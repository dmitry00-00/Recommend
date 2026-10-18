// Рост таблиц (18.10, аудит скорости, волна 3, п. 30). Две операции над живыми данными — обе ВЫКЛЮЧЕНЫ, пока владелец
// не включит флагом в окружении сервера (server/index.js): они меняют то, что уже записано, а откат — только из копии.
//
//   · IMPRESSION_ROLLUP=1 — свёртка показов старше ROLLUP_DAYS (120) дней: строки impression одного человека за один
//     день (по Москве) → одна строка impression_rollup (сколько показов, лент, фильмов, первый и последний показ), сами
//     строки удаляются. Окна аналитики — не дальше 120 дней (воронка, метрики МА-1/МА-2), граница свёртки — на день
//     раньше их. Что теряется: какие именно фильмы человеку показывали больше 120 дней назад — «досмотр по подсказке»
//     и «задержка оценки» (worker/funnel.ts prompted, worker/engagement.ts rated) для показов старше 120 дней берут
//     только более поздние показы; «первая лента» (рост, удержание от активации) и отчёт петли учитывают свёртку.
//     Идемпотентна сама по себе: за один шаг (одна транзакция) — свёртка и удаление строк человека до границы;
//     повтор находит, что сворачивать нечего. Граница — начало дня, поэтому день сворачивается целиком за раз.
//   · SLIM_CARDS=1 — урезанная карточка в watched / rating / journal: без `watch` (2,3 КБ из 3,1 КБ средней карточки;
//     «где смотреть» клиент и так собирает из справочника watchProviders, src/api/index.ts withWatch). Разово на
//     версию (migration_mark `slim-cards:<версия>`), пакетами по rowid; новые записи с флагом пишутся урезанными.
//     Риск: у карточки, которой нет в справочнике клиента (история из Кинопоиска, импорт), пропадут прямые ссылки на
//     кинотеатры — останется ссылка TMDb «где смотреть». Клиенту стоит предпочитать свою карточку серверной
//     (hydrate → cardFor: `knownWork(id)` поверх `raw`) — это зона клиента, см. отчёт.
//
// Резерв для обеих — копия базы файлом (server/backup.js, вид `before-migration`): сервер не начинает, пока свежая
// копия не снята и не проверена. Резервной таблицы, как у канона копий (work_alias_backup), здесь нет нарочно: она
// заняла бы ровно то место, которое операция освобождает. Место в файле базы после удаления строк переиспользуется
// новыми записями; сам файл меньше не станет без VACUUM (долгая запись под замком — только руками, в окно обслуживания).
import type { D1Database } from './env';
import { mskDayStart } from './funnel';

export const ROLLUP_DAYS = 120;
export const ROLLUP_TABLE = `CREATE TABLE IF NOT EXISTS impression_rollup (user_id TEXT NOT NULL REFERENCES user(id), day TEXT NOT NULL,
  shown INTEGER NOT NULL, slates INTEGER NOT NULL, works INTEGER NOT NULL, first_at TEXT NOT NULL, last_at TEXT NOT NULL,
  PRIMARY KEY (user_id, day))`;

const MSK_MS = 3 * 3600e3;
const dayOf = (t: number) => new Date(t + MSK_MS).toISOString().slice(0, 10);
const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);

/** Граница свёртки: начало дня (по Москве) за ROLLUP_DAYS + 1 день до сегодня — на день раньше окон аналитики. */
export const rollupBefore = (now = Date.now(), days = ROLLUP_DAYS): string => mskDayStart(addDays(dayOf(now), -(days + 1)));

export interface RollupReport { before: string; users: number; rows: number; days: number; steps: number; ms: number; stopped?: 'time' }

/** Свернуть показы старше границы. Шаг — показы одного человека за `stepDays` дней (по Москве), одна транзакция
 *  (BEGIN IMMEDIATE … COMMIT): короткая, потому что основной поток сервера пишет в ту же базу и ждёт замка синхронно
 *  (busy_timeout) — длинная транзакция здесь была бы стопом там. Между шагами — `pauseMs`, чтобы ждущий писатель успел
 *  взять замок. `maxMs` — сколько работать за прогон (остальное — в следующий). */
export async function rollupImpressions(db: D1Database, { now = Date.now(), days = ROLLUP_DAYS, maxMs = 10 * 60e3, stepDays = 7, pauseMs = 0 } = {}): Promise<RollupReport> {
  const t0 = Date.now();
  await db.prepare(ROLLUP_TABLE).run();
  const before = rollupBefore(now, days);
  const out: RollupReport = { before, users: 0, rows: 0, days: 0, steps: 0, ms: 0 };
  // кому есть что сворачивать: самый ранний показ каждого — по индексу impression_user(user_id, at), без прохода по таблице
  const users = (await db.prepare(`SELECT u.id AS id, (SELECT MIN(i.at) FROM impression i WHERE i.user_id = u.id) AS first FROM user u
      WHERE first < ?`).bind(before).all<{ id: string; first: string }>()).results ?? [];
  for (const { id, first } of users) {
    out.users++;
    for (let from = mskDayStart(dayOf(Date.parse(first))); from < before;) {
      if (Date.now() - t0 > maxMs) { out.stopped = 'time'; out.ms = Date.now() - t0; return out; }
      const next = mskDayStart(addDays(dayOf(Date.parse(from) + 12 * 3600e3), stepDays));
      const to = next < before ? next : before;
      const [ins, del] = await db.batch([
        db.prepare(`INSERT INTO impression_rollup (user_id, day, shown, slates, works, first_at, last_at)
            SELECT user_id, date(at, '+3 hours') AS d, COUNT(*), COUNT(DISTINCT slate_id), COUNT(DISTINCT work_id), MIN(at), MAX(at)
              FROM impression WHERE user_id = ? AND at < ? GROUP BY d
            ON CONFLICT (user_id, day) DO UPDATE SET shown = shown + excluded.shown, slates = slates + excluded.slates,
              works = MAX(works, excluded.works), first_at = MIN(first_at, excluded.first_at), last_at = MAX(last_at, excluded.last_at)
            RETURNING day`).bind(id, to),
        db.prepare('DELETE FROM impression WHERE user_id = ? AND at < ? RETURNING 1 AS x').bind(id, to),
      ]);
      out.steps++;
      out.days += ins.results?.length ?? 0;
      out.rows += del.results?.length ?? 0;
      from = to;
      if (pauseMs) await new Promise((r) => setTimeout(r, pauseMs));
    }
  }
  out.ms = Date.now() - t0;
  return out;
}

export const SLIM_VERSION = 'v1';
/** Поля карточки, которые не храним рядом с записью: `watch` — «где смотреть», собирается из справочника. */
const SLIM_SQL = (col: string) => `json_remove(${col}, '$.watch')`;
const SLIM_WHERE = (col: string) => `json_valid(${col}) AND json_type(${col}, '$.watch') IS NOT NULL`;

/** Карточка для записи рядом с отметкой — урезанная, если включено (SLIM_CARDS=1). */
export function slimCardText(text: string | null): string | null {
  if (!slimOn || !text) return text;
  try {
    const card = JSON.parse(text) as Record<string, unknown>;
    if (!card || typeof card !== 'object' || !('watch' in card)) return text;
    delete card.watch;
    return JSON.stringify(card);
  } catch { return text; }
}
let slimOn = false;
/** Флаг из окружения (worker/index.ts, на каждый запрос — дёшево). */
export const setSlimCards = (on: boolean): void => { slimOn = on; };

export interface SlimReport { version: string; done: boolean; byTable: Record<string, number>; ms: number; stopped?: 'time' }

/** Урезать карточки уже записанного — раз на версию; пакетами по rowid (одна транзакция — до `chunk` строк). Оборвалось
 *  на середине — отметки нет, следующий прогон пройдёт снова: уже урезанные строки не подходят под условие. */
export async function slimCards(db: D1Database, { chunk = 500, maxMs = 10 * 60e3, version = SLIM_VERSION, pauseMs = 0 } = {}): Promise<SlimReport> {
  const t0 = Date.now();
  const name = `slim-cards:${version}`;
  const out: SlimReport = { version, done: false, byTable: {}, ms: 0 };
  if (await db.prepare('SELECT 1 AS x FROM migration_mark WHERE name = ?').bind(name).first()) return { ...out, done: true };
  for (const tbl of ['watched', 'rating', 'journal']) {
    const top = (await db.prepare(`SELECT MAX(rowid) AS n FROM ${tbl}`).first<{ n: number | null }>())?.n ?? 0;
    for (let from = 0; from <= top; from += chunk) {
      if (Date.now() - t0 > maxMs) { out.stopped = 'time'; out.ms = Date.now() - t0; return out; }
      const [r] = await db.batch([db.prepare(`UPDATE ${tbl} SET work = ${SLIM_SQL('work')} WHERE rowid > ? AND rowid <= ? AND ${SLIM_WHERE('work')}
        RETURNING 1 AS x`).bind(from, from + chunk)]);
      out.byTable[tbl] = (out.byTable[tbl] ?? 0) + (r.results?.length ?? 0);
      if (pauseMs) await new Promise((res) => setTimeout(res, pauseMs));
    }
  }
  await db.prepare('INSERT OR IGNORE INTO migration_mark (name, at) VALUES (?, ?)').bind(name, new Date().toISOString()).run();
  out.done = true;
  out.ms = Date.now() - t0;
  return out;
}
