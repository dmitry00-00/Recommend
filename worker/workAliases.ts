// Канон копий на сервере (17.10, волна А проверки дублей; правило главной копии — владелец). Таблица «лишний id →
// главный» — src/mocks/workAliases.ts (tools/work-aliases.mts), та же, что у клиента (src/lib/canon.ts).
//
// Два дела:
//   · `canonWork` — входящий id (PUT оценки, отметки, послесловия, журнал, импорт, события) старого клиента сводится к
//     главному: старый клиент живёт в кэше Telegram днями и шлёт id лишней копии;
//   · `migrateWorkAliases` — записи людей с лишним id переносятся на главный. Один раз на версию таблицы (хэш,
//     migration_mark `work-aliases:<версия>`), при первом запросе после выкладки (worker/migrate.ts), одним пакетом —
//     вместе с отметкой: оборвалось — не записалось ничего, повтор начнёт заново. Повторный запуск с той же таблицей
//     ничего не меняет: отметка есть, а строк с лишним id уже нет.
//
// Перед переносом каждая затронутая строка (и перенесённая, и снятая при слиянии) ложится в work_alias_backup как
// была — JSON строки целиком, с версией таблицы: откатить можно руками по ней.
//
// Слияние, когда у человека записи на обеих копиях (главная и лишняя, или две лишние одной вещи):
//   · оценка (rating) — последняя по времени (`at`); при равенстве — та, что уже на главной;
//   · просмотренное (watched) — последнее по времени действие (отмечено / снято); карточка и ключи — с любой, где есть;
//   · послесловие (afterword) — поля сливаются: у более свежей строки её поля, пустые — из старой; время — свежее;
//   · журнал (journal) — объединяется без дублей: на вещь одна запись каждого статуса (из двух «досмотрено» остаётся
//     полнее заполненная, при равенстве — свежая по дате, потом та, что на главной); «в планах», если та же вещь уже
//     досмотрена или смотрится, уходит — план исполнен (его и завела лента, не узнав досмотренное на другой копии);
//   · прогнозы, чек-ины, отклики, показы, открытия материалов, события, жалобы, вердикты по ссылкам — только смена id:
//     это наблюдения, дублей там не бывает.
// Не переносим голоса и колоды выбора компанией (together, together_vote, inline_poll): колода — снимок карточек
// сессии, голос сверяется с её id; сессии живут часы.
import { canonIn, workAliases, workAliasesVersion, type AliasTable } from '../src/lib/canon';
import type { D1Database, D1PreparedStatement } from './env';

/** Главный id вещи (лишняя копия → главная). */
export const canonWork = (id: string): string => canonIn(workAliases, id);

/** Карточка, которую клиент положил рядом с записью, — под главным id. */
export function canonCard<T>(work: T, id: string): T {
  return work && typeof work === 'object' && !Array.isArray(work) && (work as { id?: unknown }).id !== id
    ? { ...(work as Record<string, unknown>), id } as T : work;
}

export const ALIAS_TABLES = [
  `CREATE TABLE IF NOT EXISTS work_alias (alias TEXT PRIMARY KEY, main TEXT NOT NULL, version TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS work_alias_backup (seq INTEGER PRIMARY KEY AUTOINCREMENT, version TEXT NOT NULL, tbl TEXT NOT NULL,
    user_id TEXT, work_id TEXT NOT NULL, main TEXT NOT NULL, action TEXT NOT NULL, row TEXT NOT NULL, at TEXT NOT NULL)`,
  'CREATE INDEX IF NOT EXISTS work_alias_backup_user ON work_alias_backup(user_id, tbl)',
];

/** Таблицы, где у записи только меняется id: наблюдения без ключа по произведению. Ключ строки — для отката. */
const PLAIN: { tbl: string; key: string[] }[] = [
  { tbl: 'prediction', key: ['user_id', 'entry_id'] },
  { tbl: 'checkin', key: ['id'] },
  { tbl: 'feedback', key: ['id'] },
  { tbl: 'impression', key: ['id'] },
  { tbl: 'material_open', key: ['id'] },
  { tbl: 'event', key: ['id'] },
  { tbl: 'work_issue', key: ['id'] },
  { tbl: 'link_verdict', key: ['user_id', 'url'] },
];

type Row = Record<string, unknown> & { user_id?: string; work_id: string };
export interface AliasMigration { version: string; moved: number; dropped: number; byTable: Record<string, number> }

const str = (v: unknown) => (typeof v === 'string' ? v : '');
/** Карточка в колонке `work` (JSON) — под главным id; битая или пустая — как есть. */
function cardJson(raw: unknown, main: string): unknown {
  if (typeof raw !== 'string' || !raw) return raw ?? null;
  try { return JSON.stringify(canonCard(JSON.parse(raw), main)); } catch { return raw; }
}

const filled = (r: Row) => ['finished_at', 'started_at', 'progress', 'eagerness', 'series'].filter((k) => r[k] != null && r[k] !== '').length;

/** Перенести записи людей с лишних копий на главные — по таблице `table` версии `version` (по умолчанию — из сборки).
 *  undefined — эта версия уже перенесена. */
export async function migrateWorkAliases(db: D1Database, table: AliasTable = workAliases, version = workAliasesVersion): Promise<AliasMigration | undefined> {
  for (const ddl of ALIAS_TABLES) await db.prepare(ddl).run();
  const name = `work-aliases:${version}`;
  if (await db.prepare('SELECT 1 AS x FROM migration_mark WHERE name = ?').bind(name).first()) return undefined;
  const at = new Date().toISOString();
  const pairs = Object.keys(table).map((a) => [a, canonIn(table, a)] as const).filter(([a, m]) => a !== m);
  // карта в базе — для выборок по JOIN; заменяется целиком, пакетами (у SQLite предел переменных в запросе)
  const mapSteps: D1PreparedStatement[] = [db.prepare('DELETE FROM work_alias')];
  for (const [a, m] of pairs) mapSteps.push(db.prepare('INSERT INTO work_alias (alias, main, version) VALUES (?, ?, ?)').bind(a, m, version));
  await db.batch(mapSteps);

  const steps: D1PreparedStatement[] = [];
  const out: AliasMigration = { version, moved: 0, dropped: 0, byTable: {} };
  const backup = (tbl: string, r: Row, main: string, action: 'moved' | 'dropped' | 'merged') => {
    steps.push(db.prepare('INSERT INTO work_alias_backup (version, tbl, user_id, work_id, main, action, row, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(version, tbl, r.user_id ?? null, r.work_id, main, action, JSON.stringify(r), at));
    if (action === 'dropped') out.dropped++; else out.moved++;
    out.byTable[tbl] = (out.byTable[tbl] ?? 0) + 1;
  };
  /** Строки с лишним id (с главным рядом) и строки тех же людей на главных — для слияния. */
  const load = async (tbl: string): Promise<{ moved: (Row & { __main: string })[]; onMain: Row[] }> => {
    const moved = (await db.prepare(`SELECT t.*, a.main AS __main FROM ${tbl} t JOIN work_alias a ON a.alias = t.work_id`).all<Row & { __main: string }>()).results;
    const onMain = moved.length
      ? (await db.prepare(`SELECT t.* FROM ${tbl} t WHERE EXISTS (SELECT 1 FROM ${tbl} x JOIN work_alias a ON a.alias = x.work_id
          WHERE x.user_id = t.user_id AND a.main = t.work_id)`).all<Row>()).results : [];
    return { moved, onMain };
  };
  const strip = <T extends Row>(r: T): Row => { const { __main: _m, ...rest } = r as T & { __main?: string }; return rest as Row; };

  // ─── оценки и просмотренное: одна строка на (человек, вещь), побеждает последняя по времени ──────────────────
  for (const tbl of ['rating', 'watched'] as const) {
    const { moved, onMain } = await load(tbl);
    const groups = new Map<string, { main: string; rows: { r: Row; fromAlias: boolean }[] }>();
    for (const r of onMain) groups.set(`${r.user_id}\t${r.work_id}`, { main: r.work_id, rows: [{ r, fromAlias: false }] });
    for (const m of moved) {
      const k = `${m.user_id}\t${m.__main}`;
      const g = groups.get(k) ?? { main: m.__main, rows: [] };
      g.rows.push({ r: strip(m), fromAlias: true });
      groups.set(k, g);
    }
    for (const { main, rows } of groups.values()) {
      if (!rows.some((x) => x.fromAlias)) continue;
      const best = [...rows].sort((a, b) => str(b.r.at).localeCompare(str(a.r.at)) || Number(a.fromAlias) - Number(b.fromAlias))[0];
      // карточка и ключи — с любой строки, где они есть: у лишней копии истории бывает Кинопоиск, у главной — нет
      const work = rows.map((x) => x.r.work).find((w) => typeof w === 'string' && w) ?? null;
      for (const x of rows) {
        if (x === best) continue;
        backup(tbl, x.r, main, 'dropped');
        steps.push(db.prepare(`DELETE FROM ${tbl} WHERE user_id = ? AND work_id = ?`).bind(x.r.user_id, x.r.work_id));
      }
      const r = best.r;
      if (!best.fromAlias) {
        // главная осталась своей; карточку ей — с копии, если своей не было
        if (!r.work && work) steps.push(db.prepare(`UPDATE ${tbl} SET work = ? WHERE user_id = ? AND work_id = ? AND work IS NULL`).bind(cardJson(work, main), r.user_id, r.work_id));
        continue;
      }
      backup(tbl, r, main, 'moved');
      if (tbl === 'rating') {
        steps.push(db.prepare('UPDATE rating SET work_id = ?, work = ? WHERE user_id = ? AND work_id = ?')
          .bind(main, cardJson(r.work ?? work, main), r.user_id, r.work_id));
      } else {
        const pick = (k: string) => r[k] ?? rows.map((x) => x.r[k]).find((v) => v != null) ?? null;
        steps.push(db.prepare('UPDATE watched SET work_id = ?, work = ?, tmdb = ?, imdb = ? WHERE user_id = ? AND work_id = ?')
          .bind(main, cardJson(r.work ?? work, main), pick('tmdb'), pick('imdb'), r.user_id, r.work_id));
      }
    }
  }

  // ─── послесловие: поля сливаются, у свежей строки — её поля ─────────────────────────────────────────────────
  {
    const { moved, onMain } = await load('afterword');
    const groups = new Map<string, { main: string; rows: { r: Row; fromAlias: boolean }[] }>();
    for (const r of onMain) groups.set(`${r.user_id}\t${r.work_id}`, { main: r.work_id, rows: [{ r, fromAlias: false }] });
    for (const m of moved) {
      const k = `${m.user_id}\t${m.__main}`;
      const g = groups.get(k) ?? { main: m.__main, rows: [] };
      g.rows.push({ r: strip(m), fromAlias: true });
      groups.set(k, g);
    }
    for (const { main, rows } of groups.values()) {
      if (!rows.some((x) => x.fromAlias)) continue;
      const order = [...rows].sort((a, b) => str(b.r.at).localeCompare(str(a.r.at)) || Number(a.fromAlias) - Number(b.fromAlias));
      const field = (k: string) => order.map((x) => x.r[k]).find((v) => v != null) ?? null;
      for (const x of rows) {
        backup('afterword', x.r, main, x === order[0] ? (rows.length > 1 ? 'merged' : 'moved') : 'dropped');
        steps.push(db.prepare('DELETE FROM afterword WHERE user_id = ? AND work_id = ?').bind(x.r.user_id, x.r.work_id));
      }
      steps.push(db.prepare('INSERT INTO afterword (user_id, work_id, worth, pace, hook, at) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(order[0].r.user_id, main, field('worth'), field('pace'), field('hook'), order[0].r.at));
    }
  }

  // ─── журнал: без дублей — одна запись статуса на вещь, исполненный план уходит ────────────────────────────────
  {
    const { moved, onMain } = await load('journal');
    const groups = new Map<string, { main: string; rows: { r: Row; fromAlias: boolean }[] }>();
    for (const r of onMain) {
      const k = `${r.user_id}\t${r.work_id}`;
      const g = groups.get(k) ?? { main: r.work_id, rows: [] };
      g.rows.push({ r, fromAlias: false });
      groups.set(k, g);
    }
    for (const m of moved) {
      const k = `${m.user_id}\t${m.__main}`;
      const g = groups.get(k) ?? { main: m.__main, rows: [] };
      g.rows.push({ r: strip(m), fromAlias: true });
      groups.set(k, g);
    }
    for (const { main, rows } of groups.values()) {
      if (!rows.some((x) => x.fromAlias)) continue;
      // слияние — только если записи с разных копий: свои повторы одной копии (бросил и начал заново) не наше дело
      const copies = new Set(rows.map((x) => x.r.work_id));
      const keep = new Set<{ r: Row; fromAlias: boolean }>();
      if (copies.size > 1) {
        const byStatus = new Map<string, { r: Row; fromAlias: boolean }[]>();
        for (const x of rows) byStatus.set(str(x.r.status), [...(byStatus.get(str(x.r.status)) ?? []), x]);
        for (const [status, xs] of byStatus) {
          if (status === 'planned' && (byStatus.has('finished') || byStatus.has('in_progress'))) continue;
          keep.add([...xs].sort((a, b) => filled(b.r) - filled(a.r)
            || str(b.r.finished_at ?? b.r.started_at).localeCompare(str(a.r.finished_at ?? a.r.started_at))
            || Number(a.fromAlias) - Number(b.fromAlias))[0]);
        }
      } else rows.forEach((x) => keep.add(x));
      for (const x of rows) {
        if (!keep.has(x)) {
          backup('journal', x.r, main, 'dropped');
          steps.push(db.prepare('DELETE FROM journal WHERE user_id = ? AND entry_id = ?').bind(x.r.user_id, x.r.entry_id));
        } else if (x.fromAlias) {
          backup('journal', x.r, main, 'moved');
          steps.push(db.prepare('UPDATE journal SET work_id = ?, work = ? WHERE user_id = ? AND entry_id = ?')
            .bind(main, cardJson(x.r.work, main), x.r.user_id, x.r.entry_id));
        }
      }
    }
  }

  // ─── наблюдения: только смена id ───────────────────────────────────────────────────────────────────────────
  for (const { tbl, key } of PLAIN) {
    const moved = (await db.prepare(`SELECT t.*, a.main AS __main FROM ${tbl} t JOIN work_alias a ON a.alias = t.work_id`).all<Row & { __main: string }>()).results;
    for (const m of moved) {
      backup(tbl, strip(m), m.__main, 'moved');
      steps.push(db.prepare(`UPDATE ${tbl} SET work_id = ? WHERE ${key.map((k) => `${k} = ?`).join(' AND ')}`).bind(m.__main, ...key.map((k) => m[k])));
    }
  }

  steps.push(db.prepare('INSERT OR IGNORE INTO migration_mark (name, at) VALUES (?, ?)').bind(name, at));
  await db.batch(steps);
  if (out.moved || out.dropped) console.log('канон копий', version, JSON.stringify(out.byTable), `перенесено ${out.moved}, снято при слиянии ${out.dropped}`);
  return out;
}
