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
/** Строки node:sqlite — объекты без прототипа; воркер ждёт обычные, как у D1. */
const plain = (row) => (row ? Object.assign({}, row) : row);

/** Подготовленные выражения переиспользуем: воркер гоняет одни и те же два десятка запросов. */
const CACHE_LIMIT = 300;

async function openD1({ file, schema }) {
  const { DatabaseSync } = require('node:sqlite');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  // WAL: читатели не ждут писателя, запись — дописывание в журнал. NORMAL в WAL не теряет
  // целостность при падении процесса, при отключении питания можно потерять последние доли секунды.
  db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000');
  if (schema) db.exec(schema);

  const cache = new Map();
  const stmt = (sql) => {
    let s = cache.get(sql);
    if (s) { cache.delete(sql); cache.set(sql, s); return s; }
    s = db.prepare(sql);
    cache.set(sql, s);
    if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value);
    return s;
  };
  const rows = (sql, params) => stmt(sql).all(...params.map(norm)).map(plain);

  function statement(sql, params = []) {
    return {
      bind: (...values) => statement(sql, values),
      async first(col) {
        const row = rows(sql, params)[0];
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
        db.exec('ROLLBACK');
        throw err;
      }
    },
    async exec(sql) {
      db.exec(sql);
      return { count: 1 };
    },
    /** перед остановкой: журнал — в основной файл, чтобы tm.sqlite был полным сам по себе */
    flush() {
      if (!closed) db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
    },
    /** согласованная копия на ходу; файла `dest` быть не должно */
    backup(dest) {
      stmt('VACUUM INTO ?').run(dest);
    },
    close() {
      if (closed) return;
      try { db.exec('PRAGMA wal_checkpoint(TRUNCATE)'); } catch { /* закрываем всё равно */ }
      cache.clear();
      db.close();
      closed = true;
    },
  };
}

/** Проверка файла копии: открывается, целостен, похож на нашу базу. Без node:sqlite — undefined. */
function inspect(file) {
  let DatabaseSync;
  try { ({ DatabaseSync } = require('node:sqlite')); } catch { return undefined; }
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    const check = db.prepare('PRAGMA integrity_check').all().map((r) => Object.values(r)[0]).join('; ');
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
