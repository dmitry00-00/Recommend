// D1 поверх настоящего файла SQLite (встроенный node:sqlite, Node 22.13+; ЗП-4, 06.10).
// Интерфейс тот же, что у ./d1-sqljs.js: prepare → bind → first / all / run, batch и exec.
//
// Чем лучше базы в памяти: запись — это запись строки в журнал (WAL), а не выгрузка всей базы
// в файл; память не растёт вместе с базой; копия снимается на ходу (`VACUUM INTO`) и не
// останавливает сервер. Файл тот же — tm.sqlite: базу, которую писал sql.js, открываем как есть.
'use strict';
const fs = require('fs');
const path = require('path');

/** node:sqlite не принимает undefined и boolean — приводим к тому, что понимает SQLite. */
const norm = (v) => (v === undefined ? null : typeof v === 'boolean' ? (v ? 1 : 0) : v);
/** Строки node:sqlite — объекты без прототипа; воркер ждёт обычные, как у D1. 18.10: прототип — на месте, без копии
 *  строки: на выборке в сотни тысяч строк (аналитика) копия удваивала пик памяти и время. */
const plain = (row) => (row ? Object.setPrototypeOf(row, Object.prototype) : row);

/** Подготовленные выражения переиспользуем: воркер гоняет одни и те же два десятка запросов. */
const CACHE_LIMIT = 300;

/**
 * Настройки соединения (18.10, аудит скорости, п. 29). По умолчанию SQLite держит 2 МБ кэша страниц на гигабайтную базу и
 * читает каждую страницу системным вызовом. Машина bothost — 1–2 ГБ памяти, поэтому всё — с пределом и меняется
 * окружением без правки кода:
 *   DB_CACHE_MB (64)  — кэш страниц соединения: горячие индексы (сессии, показы человека) помещаются целиком;
 *   DB_MMAP_MB (256)  — чтение через отображение файла в память: страницы — кэш файлов ОС, вытесняются ею же,
 *                       своей кучей процесса не становятся; 0 — выключить;
 *   temp_store=MEMORY — временные таблицы сортировок мелких запросов не пишутся на диск (аналитика, где сортировки
 *                       большие, идёт в своём потоке с temp_store по умолчанию, см. server/db-thread.js);
 *   journal_size_limit (64 МБ) — журнал WAL после контрольной точки урезается, а не остаётся размером с пик.
 */
const mb = (name, def) => {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v >= 0 ? v : def;
};
function tuning(db, { readOnly = false, memoryTemp = !readOnly } = {}) {
  db.exec(`PRAGMA cache_size = -${Math.round(mb('DB_CACHE_MB', 64) * 1024)}`);
  db.exec(`PRAGMA mmap_size = ${Math.round(mb('DB_MMAP_MB', 256) * 1048576)}`);
  if (memoryTemp) db.exec('PRAGMA temp_store = MEMORY');
  if (!readOnly) db.exec(`PRAGMA journal_size_limit = ${64 << 20}`);
}

/** Открыта ли транзакция. `isTransaction` есть с Node 22.16; раньше — пробой: BEGIN внутри транзакции бросает. */
function inTransaction(db) {
  if (typeof db.isTransaction === 'boolean') return db.isTransaction;
  try { db.exec('BEGIN'); db.exec('COMMIT'); return false; } catch { return true; }
}

/**
 * `readOnly` (18.10) — соединение только на чтение: для потока аналитики (server/db-thread.js). Схему не трогает,
 * режим журнала не меняет (он у файла общий — WAL ставит основное соединение), запись запрещена ещё и query_only.
 */
async function openD1({ file, schema, readOnly = false, memoryTemp, shared = false }) {
  const { DatabaseSync } = require('node:sqlite');
  let db;
  if (readOnly) {
    db = new DatabaseSync(file, { readOnly: true });
    db.exec('PRAGMA busy_timeout = 5000; PRAGMA query_only = 1');
    tuning(db, { readOnly: true, memoryTemp });
  } else {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    db = new DatabaseSync(file);
    // WAL: читатели не ждут писателя, запись — дописывание в журнал. NORMAL в WAL не теряет
    // целостность при падении процесса, при отключении питания можно потерять последние доли секунды.
    db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000');
    tuning(db, { memoryTemp });
    // shared (18.10) — второе соединение потока к файлу, который держит основной поток: схему не прогоняем, при
    // закрытии контрольную точку не делаем (её делает владелец файла)
    if (schema && !shared) db.exec(schema);
  }
  const ownsFile = !readOnly && !shared;

  const cache = new Map();
  const stmt = (sql) => {
    let s = cache.get(sql);
    if (s) { cache.delete(sql); cache.set(sql, s); return s; }
    s = db.prepare(sql);
    cache.set(sql, s);
    if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value);
    return s;
  };
  const rows = (sql, params) => {
    const out = stmt(sql).all(...params.map(norm));
    for (const r of out) plain(r);
    return out;
  };

  function statement(sql, params = []) {
    return {
      bind: (...values) => statement(sql, values),
      // первая строка — get(), а не all()[0] (18.10): all() выбирал и копировал все строки ответа ради одной
      async first(col) {
        const row = plain(stmt(sql).get(...params.map(norm)));
        if (!row) return null;
        return col ? row[col] ?? null : row;
      },
      async all() {
        return { results: rows(sql, params), success: true };
      },
      async run() {
        const r = stmt(sql).run(...params.map(norm));
        return { results: [], success: true, meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
      },
      _exec() { return rows(sql, params); },
      _sql: sql,
    };
  }

  let closed = false;
  return {
    engine: 'sqlite',
    file,
    prepare: (sql) => statement(sql),
    async batch(statements) {
      db.exec('BEGIN IMMEDIATE');
      try {
        const out = statements.map((s) => ({ results: s._exec(), success: true }));
        db.exec('COMMIT');
        return out;
      } catch (err) {
        // 17.10 (аудит отказов): ROLLBACK не прошёл и транзакция осталась открытой — каждая следующая запись упадёт на
        // BEGIN («transaction within a transaction»), а чтения будут видеть недописанное. Чинить на ходу нечем: журнал и
        // выход с кодом 1, платформа поднимет процесс заново, SQLite откатит недописанное по журналу сам
        try { db.exec('ROLLBACK'); } catch (rb) { console.error('d1-sqlite: ROLLBACK не прошёл:', rb && rb.message); }
        // 18.10: `db.isTransaction` — только с Node 22.16; на 22.13–22.15 он undefined, и застрявшая транзакция не ловилась
        if (inTransaction(db)) {
          console.error('d1-sqlite: транзакция осталась открытой после ROLLBACK — выходим. Исходная ошибка:', err && (err.stack || err.message));
          process.exit(1);
        }
        throw err;
      }
    },
    async exec(sql) {
      db.exec(sql);
      return { count: 1 };
    },
    /** перед остановкой: журнал — в основной файл, чтобы tm.sqlite был полным сам по себе */
    flush() {
      if (!closed && ownsFile) db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
    },
    /** согласованная копия на ходу; файла `dest` быть не должно. Синхронно, в этом потоке — сервер снимает копию в
     *  отдельном потоке (server/db-thread.js); здесь — запасной путь и проверки */
    backup(dest) {
      stmt('VACUUM INTO ?').run(dest);
    },
    /**
     * PRAGMA optimize (18.10, п. 29): статистика планировщика (sqlite_stat1) для таблиц, где она устарела. analysis_limit
     * — ANALYZE смотрит не больше 1000 строк индекса, а не всю таблицу: на гигабайтной базе — миллисекунды, а не секунды.
     * `all` — при старте: и для таблиц, которых это соединение ещё не касалось (0x10002).
     */
    optimize(all = false) {
      if (closed || readOnly) return;
      db.exec('PRAGMA analysis_limit = 1000');
      db.exec(all ? 'PRAGMA optimize = 0x10002' : 'PRAGMA optimize');
    },
    close() {
      if (closed) return;
      if (ownsFile) try { db.exec('PRAGMA wal_checkpoint(TRUNCATE)'); } catch { /* закрываем всё равно */ }
      cache.clear();
      db.close();
      closed = true;
    },
  };
}

/** Проверка файла копии: открывается, целостен, похож на нашу базу. Без node:sqlite — undefined.
 *  `quick` (18.10) — PRAGMA quick_check: то же, без сверки индексов с таблицами — в разы быстрее; для живой базы при
 *  старте и раз в сутки (server/db-thread.js). Копию после снятия проверяем полностью. */
function inspect(file, { quick = false } = {}) {
  let DatabaseSync;
  try { ({ DatabaseSync } = require('node:sqlite')); } catch { return undefined; }
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    const check = db.prepare(quick ? 'PRAGMA quick_check' : 'PRAGMA integrity_check').all().map((r) => Object.values(r)[0]).join('; ');
    const has = (t) => Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(t));
    const count = (t) => (has(t) ? Number(db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n) : null);
    return {
      ok: check === 'ok' && has('user') && has('session'),
      integrity: check,
      users: count('user'), ratings: count('rating'), journal: count('journal'), registry: count('registry'),
    };
  } finally {
    db.close();
  }
}

module.exports = { openD1, inspect };
