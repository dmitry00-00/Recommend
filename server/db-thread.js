// Долгая работа с базой — в отдельном потоке (18.10, аудит скорости, волна 3, пп. 24, 25, 30 и «Прочее»).
//
// node:sqlite синхронный: запрос на секунду — секунда, когда сервер не отвечает никому (замер на синтетике «полгода»,
// 2,3 ГБ: копия базы — 35 с стопа, отчёт петли — 50 с и 3 ГБ памяти, воронка — минуты). Здесь каждая такая работа
// идёт в своём worker_thread со своим соединением к тому же файлу: цикл событий основного потока свободен, а нехватка
// памяти (предел кучи потока — resourceLimits) роняет поток, а не сервер.
//
// Задачи (`runTask(имя, данные)` → Promise):
//   migrate    — миграции воркера (worker/migrate.ts: колонки, индексы, разовые переносы) до открытия базы основным
//                потоком: индексы на таблицах в миллионы строк строятся секунды, сервер в это время отвечает 503
//                «starting» на /api и отдаёт статику; затем PRAGMA optimize;
//   backup     — VACUUM INTO из соединения только на чтение (в WAL писатели основного потока его не ждут) и полная
//                проверка копии (integrity_check);
//   inspect    — проверка файла (копии при восстановлении; живой базы — quick_check при старте и раз в сутки);
//   analytics  — аналитика владельца (worker/index.ts analytics) на соединении только на чтение;
//   retention  — свёртка показов и урезание карточек (worker/retention.ts), только если включены флагом.
//
// Запись из потока (migrate до открытия — без соперников; retention — короткими транзакциями) идёт тем же путём, что у
// основного потока: BEGIN IMMEDIATE и busy_timeout 5 с. Чтение в WAL не мешает никому.
'use strict';
const { Worker, isMainThread, workerData, parentPort } = require('worker_threads');
const fs = require('fs');

// ─── поток ────────────────────────────────────────────────────────────────────────────────────────────────────
async function work(task, d) {
  const { openD1, inspect } = require('./d1-sqlite');
  const t0 = Date.now();
  if (task === 'migrate') {
    const schema = fs.readFileSync(d.schemaFile, 'utf8');
    const db = await openD1({ file: d.file, schema });
    try {
      const w = require(d.workerFile);
      await w.migrate(db);
      const migrateMs = Date.now() - t0;
      const t1 = Date.now();
      db.optimize(true);
      return { migrateMs, optimizeMs: Date.now() - t1 };
    } finally {
      db.close();
    }
  }
  if (task === 'backup') {
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync(d.src, { readOnly: true });
    try {
      db.exec('PRAGMA busy_timeout = 5000');
      db.prepare('VACUUM INTO ?').run(d.dest);
    } finally {
      db.close();
    }
    const snapMs = Date.now() - t0;
    const check = inspect(d.dest);
    return { check, snapMs, checkMs: Date.now() - t0 - snapMs };
  }
  if (task === 'inspect') {
    const check = inspect(d.file, { quick: Boolean(d.quick) });
    return { check, ms: Date.now() - t0 };
  }
  if (task === 'analytics') {
    // memoryTemp: false — сортировки большой выборки (GROUP BY по показам) идут во временный файл, а не в память процесса
    const db = await openD1({ file: d.file, readOnly: true, memoryTemp: false });
    try {
      const w = require(d.workerFile);
      w.assumeMigrated();
      const env = { ...d.env, DB: db };
      const res = await w.analytics(new Request(d.url, { method: 'GET', headers: d.headers }), env, d.userId);
      const headers = {};
      res.headers.forEach((v, k) => { headers[k] = v; });
      return { status: res.status, headers, body: await res.text(), ms: Date.now() - t0 };
    } finally {
      db.close();
    }
  }
  if (task === 'retention') {
    const db = await openD1({ file: d.file, shared: true });
    try {
      const w = require(d.workerFile);
      const out = d.op === 'rollup' ? await w.rollupImpressions(db, d.opts || {}) : await w.slimCards(db, d.opts || {});
      return { ...out, ms: Date.now() - t0 };
    } finally {
      db.close();
    }
  }
  throw new Error(`неизвестная задача ${task}`);
}

if (!isMainThread && workerData && workerData.__dbTask) {
  work(workerData.__dbTask, workerData)
    .then((result) => parentPort.postMessage({ ok: true, result }))
    .catch((err) => parentPort.postMessage({ ok: false, error: String((err && (err.stack || err.message)) || err) }));
}

// ─── основной поток ───────────────────────────────────────────────────────────────────────────────────────────
const live = new Set();

/** Задачу — в новый поток; результат — Promise. `heapMb` — предел кучи потока: превысил — поток падает
 *  (ERR_WORKER_OUT_OF_MEMORY), сервер живёт. */
function runTask(task, data, { heapMb = 256 } = {}) {
  return new Promise((resolve, reject) => {
    const w = new Worker(__filename, {
      workerData: { __dbTask: task, ...data },
      resourceLimits: { maxOldGenerationSizeMb: heapMb },
      // execArgv не задаём: поток наследует ключи процесса (--disable-warning=ExperimentalWarning из Dockerfile)
    });
    live.add(w);
    let settled = false;
    w.once('message', (m) => {
      settled = true;
      if (m.ok) resolve(m.result); else reject(new Error(m.error));
    });
    w.once('error', (err) => { if (!settled) { settled = true; reject(err); } });
    w.once('exit', (code) => {
      live.delete(w);
      if (!settled) { settled = true; reject(new Error(`поток базы (${task}) вышел с кодом ${code}`)); }
    });
  });
}

/** При остановке сервера: потоки — следом (соединение потока SQLite закроет сам, недописанное откатит журнал). */
function stopAll() {
  for (const w of live) w.terminate().catch(() => {});
}

/** Есть ли потоки и node:sqlite (без него — база в памяти sql.js, потоку открывать нечего). */
function available() {
  try { require('node:sqlite'); return isMainThread; } catch { return false; }
}

module.exports = { runTask, stopAll, available, running: () => live.size };
