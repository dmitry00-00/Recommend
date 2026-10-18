// Проверка копии базы при переезде (deploy/vps/migrate.md, шаг «перенос базы»): integrity_check, строки и хеш
// содержимого по каждой таблице, sha256 файла. Без зависимостей, Node 22.13+ (node:sqlite), только чтение.
//
//   node deploy/vps/db-check.cjs <файл.sqlite | файл.sqlite.gz>   > a.json     — на Mac: скачанная копия
//   deploy/vps/deploy.sh db-check                                  > b.json     — на машине: живая база (через ssh)
//   node deploy/vps/db-check.cjs --compare a.json b.json                        — сравнить; код 1, если расходятся
//
// Хеш таблицы — sha256 от отсортированных хешей строк (порядок строк не важен), строка — JSON значений в порядке
// колонок. Совпали строки и хеши всех таблиц — данные перенесены один в один. sha256 самого файла
// после восстановления не совпадёт (сервер открывает базу, WAL, миграции), поэтому сравнивается содержимое; sha256
// файла .gz — для сверки, что на машину доехал тот же файл, что скачан с bothost.
'use strict';
process.removeAllListeners('warning'); // «SQLite is an experimental feature» — не в вывод JSON и не в глаза
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');

const args = process.argv.slice(2);

if (args[0] === '--compare') {
  const [a, b] = args.slice(1).map((f) => JSON.parse(fs.readFileSync(f, 'utf8')));
  let bad = 0;
  const line = (ok, s) => { console.log(`${ok ? '  ✓' : '  ✖'} ${s}`); if (!ok) bad++; };
  line(a.integrity === 'ok' && b.integrity === 'ok', `integrity_check: ${a.integrity} / ${b.integrity}`);
  for (const t of [...new Set([...Object.keys(a.tables), ...Object.keys(b.tables)])].sort()) {
    const x = a.tables[t], y = b.tables[t];
    if (!x || !y) { line(false, `${t}: есть только в ${x ? 'первой' : 'второй'}`); continue; }
    const cols = x.columns.join(',') === y.columns.join(',');
    const same = x.rows === y.rows && x.sha256 === y.sha256;
    line(same, `${t}: ${x.rows} / ${y.rows} строк${same ? '' : x.rows === y.rows ? ', содержимое разное' : ''}${cols ? '' : ' (колонки разные: миграция?)'}`);
  }
  console.log(bad ? `\nрасхождений: ${bad}` : '\nсовпадает всё');
  process.exit(bad ? 1 : 0);
}

const src = args[0];
if (!src || !fs.existsSync(src)) { console.error('node db-check.cjs <файл.sqlite | файл.sqlite.gz> | --compare a.json b.json'); process.exit(2); }
const { DatabaseSync } = require('node:sqlite');

const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const out = { file: path.resolve(src), at: new Date().toISOString(), size: fs.statSync(src).size };
let dbFile = src, tmp;
if (src.endsWith('.gz')) {
  const gz = fs.readFileSync(src);
  out.sha256_gz = sha(gz);
  const raw = zlib.gunzipSync(gz);
  tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'tm-dbcheck-')), 'db.sqlite');
  fs.writeFileSync(tmp, raw);
  dbFile = tmp;
  out.sha256_raw = sha(raw);
} else {
  // живая база — в режиме WAL: файл без -wal не полон, хеш файла здесь только для справки
  out.sha256_file = sha(fs.readFileSync(src));
}

try {
  const db = new DatabaseSync(dbFile, { readOnly: true });
  out.integrity = db.prepare('PRAGMA integrity_check').all().map((r) => Object.values(r)[0]).join('; ');
  out.tables = {};
  const tables = db.prepare("SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
  const q = (s) => `"${String(s).replace(/"/g, '""')}"`;
  for (const { name, sql } of tables) {
    const info = db.prepare(`PRAGMA table_info(${q(name)})`).all();
    const columns = info.map((c) => c.name);
    // порядок строк не важен (VACUUM INTO при снятии копии может перенумеровать rowid): хеш каждой строки, их — по
    // порядку, и хеш от всех
    const stmt = db.prepare(`SELECT ${columns.map(q).join(', ')} FROM ${q(name)}`);
    const hashes = [];
    const rowsIter = typeof stmt.iterate === 'function' ? stmt.iterate() : stmt.all();
    for (const r of rowsIter) {
      hashes.push(crypto.createHash('sha256').update(JSON.stringify(columns.map((c) => {
        const v = r[c];
        return v instanceof Uint8Array ? `b64:${Buffer.from(v).toString('base64')}` : typeof v === 'bigint' ? `n:${v}` : v;
      }))).digest('base64'));
    }
    hashes.sort();
    const h = crypto.createHash('sha256');
    for (const x of hashes) h.update(x);
    const rows = hashes.length;
    out.tables[name] = { rows, sha256: h.digest('hex'), columns };
  }
  db.close();
} finally {
  if (tmp) fs.rmSync(path.dirname(tmp), { recursive: true, force: true });
}
const total = Object.values(out.tables).reduce((n, t) => n + t.rows, 0);
console.error(`${out.file}: integrity ${out.integrity}, таблиц ${Object.keys(out.tables).length}, строк ${total}`);
console.log(JSON.stringify(out, null, 1));
