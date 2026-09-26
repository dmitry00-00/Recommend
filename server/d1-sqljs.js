// D1 поверх SQLite в памяти (sql.js, WebAssembly — без нативной сборки на хостинге).
// Воркер (worker/index.ts) написан под Cloudflare D1; здесь ровно та часть интерфейса,
// которой он пользуется: prepare → bind → first / all / run, batch и exec.
//
// База живёт в памяти и сбрасывается в файл после записей (не чаще раза в SAVE_MS):
// атомарно, через временный файл и rename, — оборванная запись не портит прежнюю копию.
'use strict';
const fs = require('fs');
const path = require('path');

const SAVE_MS = 400;

/** sql.js не принимает undefined и boolean — приводим к тому, что понимает SQLite. */
const norm = (v) => (v === undefined ? null : typeof v === 'boolean' ? (v ? 1 : 0) : v);

async function openD1({ file, schema, wasmDir }) {
  const initSqlJs = require(path.join(wasmDir, 'sql-wasm.js'));
  const SQL = await initSqlJs({ locateFile: (f) => path.join(wasmDir, f) });
  const db = fs.existsSync(file) ? new SQL.Database(fs.readFileSync(file)) : new SQL.Database();
  db.run('PRAGMA foreign_keys = ON');
  if (schema) db.exec(schema);

  let timer = null;
  let dirty = false;
  const flush = () => {
    timer = null;
    if (!dirty) return;
    dirty = false;
    const data = db.export();
    // export() в sql.js сбрасывает pragma соединения — возвращаем
    db.run('PRAGMA foreign_keys = ON');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, Buffer.from(data));
    fs.renameSync(tmp, file);
  };
  const touch = () => {
    dirty = true;
    if (!timer) timer = setTimeout(flush, SAVE_MS);
  };

  const query = (sql, params) => {
    const stmt = db.prepare(sql);
    try {
      stmt.bind(params.map(norm));
      const rows = [];
      while (stmt.step()) rows.push(stmt.getAsObject());
      return rows;
    } finally {
      stmt.free();
    }
  };
  const isWrite = (sql) => !/^\s*(SELECT|PRAGMA|WITH\s+[\s\S]*?\bSELECT\b)/i.test(sql);

  function statement(sql, params = []) {
    return {
      bind: (...values) => statement(sql, values),
      async first(col) {
        const row = query(sql, params)[0];
        if (isWrite(sql)) touch();
        if (!row) return null;
        return col ? row[col] ?? null : row;
      },
      async all() {
        const rows = query(sql, params);
        if (isWrite(sql)) touch();
        return { results: rows, success: true };
      },
      async run() {
        query(sql, params);
        if (isWrite(sql)) touch();
        return { results: [], success: true, meta: { changes: db.getRowsModified() } };
      },
      _exec() { return query(sql, params); },
      _sql: sql,
    };
  }

  return {
    prepare: (sql) => statement(sql),
    async batch(statements) {
      db.run('BEGIN');
      try {
        const out = statements.map((s) => ({ results: s._exec(), success: true }));
        db.run('COMMIT');
        touch();
        return out;
      } catch (err) {
        db.run('ROLLBACK');
        throw err;
      }
    },
    async exec(sql) {
      db.exec(sql);
      touch();
      return { count: 1 };
    },
    /** выгрузить на диск сейчас — перед остановкой процесса */
    flush,
  };
}

module.exports = { openD1 };
