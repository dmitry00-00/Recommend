// Transformative Media — сервер мини-приложения для bothost.ru. Собирается
// `npm run build:bothost` (tools/build-bothost.mjs) в deploy/bothost/, без npm-зависимостей:
//   · раздаёт собранный фронт из ./public;
//   · /api/* — тот же воркер, что и для Cloudflare (worker/index.ts, собран в ./worker.cjs),
//     только D1 здесь — SQLite в файле DATA_DIR/tm.sqlite: ./d1-sqlite.js (node:sqlite, Node 22.13+),
//     без него — ./d1-sqljs.js (база в памяти, выгрузка в тот же файл); ночные копии — ./backup.js;
//   · /kp-api/* — прокси Кинопоиска с ключом из окружения (в сборку он не попадает).
//
//   PORT            — порт из панели bothost (по умолчанию 3000)
//   DATA_DIR        — постоянная папка (/app/data на bothost переживает обновления)
//   BOT_TOKEN       — токен бота: им проверяется подпись Telegram (bothost задаёт сам)
//   KP_API_KEY      — ключ kinopoiskapiunofficial.tech; без него /kp-api отвечает 503
//   OWNER_USERNAME  — ник владельца: его профиль при первом входе получает историю из seed/owner.json
//   ALLOW_DEMO      — «0» закрывает гостевой вход вне Telegram (по умолчанию открыт)
//   ADMIN_TOKEN     — токен сборщика и пультов; им же — копии базы (/api/admin/backups, /api/admin/restore)
//   DB_ENGINE       — «sqljs» — база в памяти, как до 06.10 (по умолчанию node:sqlite, если он есть)
//   BACKUP_KEEP     — сколько копий базы держать в DATA_DIR/backups (по умолчанию 14)
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const { createBackups } = require('./backup');

const PORT = Number(process.env.PORT) || 3000;
const ROOT = path.join(__dirname, 'public');
const KP_BASE = 'https://kinopoiskapiunofficial.tech/api';
const KP_KEY = process.env.KP_API_KEY || '';
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');

// ---------- API: воркер + D1 на SQLite ----------
let api = null;
let backups = null;
const DB_FILE = path.join(DATA_DIR, 'tm.sqlite');

function sqliteBuiltin() {
  if (process.env.DB_ENGINE === 'sqljs') return false;
  try { require('node:sqlite'); return true; } catch { return false; }
}
function openDb() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  return sqliteBuiltin()
    ? require('./d1-sqlite').openD1({ file: DB_FILE, schema })
    : require('./d1-sqljs').openD1({ file: DB_FILE, schema, wasmDir: path.join(__dirname, 'vendor') });
}

async function startApi() {
  const workerModule = require('./worker.cjs');
  const worker = workerModule.default;
  // База за прослойкой: после восстановления из копии подменяется сама база, а env.DB у воркера
  // остаётся тем же объектом
  let current = await openDb();
  const DB = {
    prepare: (sql) => current.prepare(sql),
    batch: (statements) => current.batch(statements),
    exec: (sql) => current.exec(sql),
  };
  let seed;
  try { seed = JSON.parse(fs.readFileSync(path.join(__dirname, 'seed', 'owner.json'), 'utf8')); } catch { seed = undefined; }
  // справочники (индексы разборов и т. п.) — файлами в папке данных: тот же интерфейс, что у R2
  const refDir = path.join(DATA_DIR, 'reference');
  const refFiles = new Map();
  const REFERENCE = {
    async get(key) {
      const file = path.join(refDir, path.basename(key));
      if (!fs.existsSync(file)) return null;
      // файл меняется раз в сутки, а читают его все при каждом старте — держим в памяти до смены
      const st = fs.statSync(file);
      const httpEtag = `"${st.size.toString(36)}-${st.mtimeMs.toString(36)}"`;
      let hit = refFiles.get(file);
      if (!hit || hit.etag !== httpEtag) refFiles.set(file, (hit = { etag: httpEtag, buf: fs.readFileSync(file) }));
      return { body: new Blob([hit.buf]).stream(), httpEtag, size: hit.buf.length };
    },
    async put(key, value) {
      fs.mkdirSync(refDir, { recursive: true });
      const file = path.join(refDir, path.basename(key));
      fs.writeFileSync(`${file}.tmp`, typeof value === 'string' ? value : Buffer.from(value));
      fs.renameSync(`${file}.tmp`, file);
    },
  };
  const env = {
    DB,
    REFERENCE,
    ADMIN_TOKEN: process.env.ADMIN_TOKEN || '',
    BOT_TOKEN: process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || '',
    ALLOW_DEMO: process.env.ALLOW_DEMO === '0' ? '' : '1',
    // публичные страницы для поисковиков (ЗП-15): выключены, пока не PUBLIC_PAGES=1
    PUBLIC_PAGES: process.env.PUBLIC_PAGES || '',
    PUBLIC_ORIGIN: process.env.PUBLIC_ORIGIN || '',
    ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || '',
    OWNER_USERNAME: process.env.OWNER_USERNAME || 'Tacticheskiy_Enot',
    OWNER_SEED: seed,
  };
  const stop = () => { try { current.close(); } finally { process.exit(0); } };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
  backups = createBackups({
    getDb: () => current,
    dir: path.join(DATA_DIR, 'backups'),
    keep: Number(process.env.BACKUP_KEEP) || 14,
    inspect: require('./d1-sqlite').inspect,
  });
  backups.schedule();
  /** подмена базы при восстановлении: закрыть, заменить файл, открыть заново */
  const reopen = async (swap) => {
    current.close();
    try { swap(); } finally { current = await openDb(); }
    workerModule.forgetMigrations?.();
  };
  api = { worker, env, reopen, engine: () => current.engine };
  // сводка подписок (06.10): раз в день после 10:00 по Москве — воркер сам смотрит, кому сегодня уже слали
  const tick = () => Promise.resolve(worker.scheduled?.({}, env)).catch((err) => console.error('подписки:', err));
  setTimeout(tick, 60e3);
  setInterval(tick, 15 * 60e3).unref();
  console.log(`api: база ${DB_FILE} (${current.engine === 'sqlite' ? 'node:sqlite, файл' : 'sql.js, в памяти'}), бот ${env.BOT_TOKEN ? 'есть' : 'НЕТ — вход через Telegram не заработает'}, `
    + `владелец @${env.OWNER_USERNAME}${seed ? ` (история: ${seed.journal.length} в дневнике, ${seed.ratings.length} оценок, ${seed.watched.length} в списке)` : ''}`);
}

// справочники приходят целиком: индекс постов — несколько мегабайт
const MAX_BODY = 32 << 20;
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) { reject(new Error('too_large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// ---------- копии базы (ЗП-4): ручки сервера, а не воркера — воркер о файлах не знает ----------
function adminOk(req) {
  const token = /^Bearer\s+(.+)$/i.exec(req.headers.authorization || '')?.[1] || '';
  const want = process.env.ADMIN_TOKEN || '';
  if (!want || !token) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(want);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
const sendJson = (res, status, body) => res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  .end(JSON.stringify(body));
// копия для восстановления может быть больше справочника
const MAX_RESTORE = 512 << 20;

async function handleBackups(req, res, p) {
  if (!adminOk(req)) return sendJson(res, 401, { error: 'unauthorized' });
  if (!backups) return sendJson(res, 503, { error: 'starting' });
  if (p === '/api/admin/backups' && req.method === 'GET') return sendJson(res, 200, { engine: api.engine(), backups: backups.list() });
  if (p === '/api/admin/backups' && req.method === 'POST') return sendJson(res, 200, await backups.make('manual'));
  const one = /^\/api\/admin\/backups\/([^/]+)$/.exec(p);
  if (one && req.method === 'GET') {
    const file = backups.pathOf(decodeURIComponent(one[1]));
    if (!file) return sendJson(res, 404, { error: 'not_found' });
    res.writeHead(200, {
      'content-type': 'application/gzip', 'content-length': fs.statSync(file).size,
      'content-disposition': `attachment; filename="${path.basename(file)}"`, 'cache-control': 'no-store',
    });
    fs.createReadStream(file).pipe(res);
    return;
  }
  if (p === '/api/admin/restore' && req.method === 'POST') {
    let source;
    if ((req.headers['content-type'] || '').startsWith('application/json')) {
      const { backup } = JSON.parse((await readBody(req)).toString('utf8') || '{}');
      source = backup && backups.pathOf(backup);
      if (!source) return sendJson(res, 404, { error: 'no_backup', backup });
    } else {
      if (Number(req.headers['content-length'] || 0) > MAX_RESTORE) return sendJson(res, 413, { error: 'too_large' });
      source = req;
    }
    return sendJson(res, 200, await backups.restore(source, { file: DB_FILE, reopen: api.reopen }));
  }
  return sendJson(res, 404, { error: 'not_found' });
}

// ---------- сжатие ответов API (ЗП-4): справочники — 6 МБ JSON на первый вход, сжатые — около мегабайта ----------
const acceptEncoding = (req) => {
  const ae = String(req.headers['accept-encoding'] || '');
  return /\bbr\b/.test(ae) ? 'br' : /\bgzip\b/.test(ae) ? 'gzip' : null;
};
// сжатое по версии справочника: жмём один раз и сильно; остальное — на лету и быстро
const compressed = new Map();
function compressApi(buf, enc, key) {
  const k = key && `${key}|${enc}`;
  if (k && compressed.has(k)) return compressed.get(k);
  const strong = Boolean(k);
  const z = enc === 'br'
    ? zlib.brotliCompressSync(buf, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: strong ? 9 : 4, [zlib.constants.BROTLI_PARAM_SIZE_HINT]: buf.length } })
    : zlib.gzipSync(buf, { level: strong ? 9 : 6 });
  if (k) {
    // прежние версии того же справочника больше не нужны
    const prefix = `${key.split('|')[0]}|`;
    for (const old of compressed.keys()) if (old.startsWith(prefix) && !old.startsWith(`${key}|`)) compressed.delete(old);
    compressed.set(k, z);
  }
  return z;
}

async function handleApi(req, res) {
  if (!api) { res.writeHead(503, { 'content-type': 'application/json' }).end('{"error":"starting"}'); return; }
  try {
    const p = (req.url || '/').split('?')[0].replace(/\/+$/, '');
    if (p.startsWith('/api/admin/backups') || p === '/api/admin/restore') {
      await handleBackups(req, res, p).catch((err) => {
        console.error('копии базы:', err && (err.stack || err.message));
        if (!res.headersSent) sendJson(res, 500, { error: String(err && err.message || err) });
        else res.destroy();
      });
      return;
    }
    const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await readBody(req);
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
    const request = new Request(`http://${req.headers.host || 'localhost'}${req.url}`, { method: req.method, headers, body });
    const response = await api.worker.fetch(request, api.env);
    let out = Buffer.from(await response.arrayBuffer());
    const head = { 'cache-control': 'no-store' };
    response.headers.forEach((v, k) => { head[k] = v; });
    // справочник не менялся — телефон берёт свою копию (etag тот же, что у файла)
    const etag = response.headers.get('etag');
    if (etag && response.status === 200 && req.headers['if-none-match'] === etag) {
      res.writeHead(304, { etag, 'cache-control': head['cache-control'] });
      res.end();
      return;
    }
    const enc = response.status === 200 && out.length > 1024 && /json|text/.test(head['content-type'] || '') ? acceptEncoding(req) : null;
    if (enc) {
      out = compressApi(out, enc, etag && req.method === 'GET' ? `${p}|${etag}` : null);
      head['content-encoding'] = enc;
      head.vary = 'Accept-Encoding';
    }
    head['content-length'] = out.length;
    res.writeHead(response.status, head);
    res.end(out);
  } catch (err) {
    console.error('api:', err && (err.stack || err.message));
    if (!res.headersSent) res.writeHead(500, { 'content-type': 'application/json' });
    res.end('{"error":"internal"}');
  }
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.txt': 'text/plain; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
};
const COMPRESSIBLE = new Set(['.html', '.js', '.mjs', '.css', '.json', '.svg', '.txt']);

// Файлов немного и они неизменны до следующего деплоя — держим в памяти вместе со сжатыми
// версиями: 2,5 МБ бандла уходят на телефон как ~0,5 МБ.
const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file);
  let entry = null;
  try {
    const stat = fs.statSync(file);
    if (stat.isFile()) {
      const ext = path.extname(file).toLowerCase();
      const body = fs.readFileSync(file);
      entry = { body, ext, type: MIME[ext] || 'application/octet-stream' };
      if (COMPRESSIBLE.has(ext) && body.length > 1024) {
        entry.br = zlib.brotliCompressSync(body, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 9 } });
        entry.gz = zlib.gzipSync(body, { level: 9 });
      }
    }
  } catch { /* нет файла */ }
  cache.set(file, entry);
  return entry;
}

function sendFile(req, res, entry, cacheControl) {
  const accept = String(req.headers['accept-encoding'] || '');
  const headers = { 'content-type': entry.type, 'cache-control': cacheControl, vary: 'Accept-Encoding' };
  let body = entry.body;
  if (entry.br && /\bbr\b/.test(accept)) { body = entry.br; headers['content-encoding'] = 'br'; }
  else if (entry.gz && /\bgzip\b/.test(accept)) { body = entry.gz; headers['content-encoding'] = 'gzip'; }
  headers['content-length'] = body.length;
  res.writeHead(200, headers);
  res.end(req.method === 'HEAD' ? undefined : body);
}

async function proxyKinopoisk(req, res, urlPath, search) {
  if (req.method !== 'GET') { res.writeHead(405).end(); return; }
  if (!KP_KEY) {
    res.writeHead(503, { 'content-type': 'application/json' }).end('{"error":"kp_key_missing"}');
    return;
  }
  try {
    const upstream = await fetch(KP_BASE + urlPath.replace(/^\/kp-api/, '') + search, {
      headers: { 'X-API-KEY': KP_KEY, accept: 'application/json' },
    });
    const body = Buffer.from(await upstream.arrayBuffer());
    res.writeHead(upstream.status, {
      'content-type': upstream.headers.get('content-type') || 'application/json',
      'cache-control': upstream.ok ? 'public, max-age=86400' : 'no-store',
      'content-length': body.length,
    });
    res.end(body);
  } catch (err) {
    console.error('kp-api:', err && err.message);
    res.writeHead(502, { 'content-type': 'application/json' }).end('{"error":"kp_upstream"}');
  }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', 'http://localhost');
  let p;
  try { p = decodeURIComponent(url.pathname); } catch { res.writeHead(400).end(); return; }

  if (p === '/healthz') { res.writeHead(200, { 'content-type': 'text/plain' }).end('ok'); return; }
  if (p.startsWith('/kp-api/')) { proxyKinopoisk(req, res, p, url.search); return; }
  if (p.startsWith('/api/')) { handleApi(req, res); return; }
  // публичные страницы для поисковиков (ЗП-15, worker/pages.ts) — их рисует тот же воркер; выключены, пока не PUBLIC_PAGES=1
  if (process.env.PUBLIC_PAGES === '1' && (p === '/robots.txt' || p === '/sitemap.xml' || p.startsWith('/film/') || p.startsWith('/author/'))) { handleApi(req, res); return; }
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405).end(); return; }

  const file = path.normalize(path.join(ROOT, p));
  if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }

  const entry = load(p.endsWith('/') ? path.join(file, 'index.html') : file);
  if (entry) {
    // файлы из assets/ с хешем в имени — навсегда; остальное — всегда перепроверять
    const immutable = p.startsWith('/assets/');
    sendFile(req, res, entry, immutable ? 'public, max-age=31536000, immutable' : 'no-cache');
    return;
  }
  // Роутер — HashRouter, но на всякий случай любой «путь без файла» отдаёт приложение
  if (!path.extname(p)) {
    const index = load(path.join(ROOT, 'index.html'));
    if (index) { sendFile(req, res, index, 'no-cache'); return; }
  }
  res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Not found');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Transformative Media: http://0.0.0.0:${PORT} (kp-api ${KP_KEY ? 'on' : 'off'})`);
});
// Порт уже занят. На bothost это почти всегда их заглушка: сборка без своего Dockerfile
// запускает рядом `node /opt/bothost/http-wrapper.js` («Bot is running») на том же PORT, и
// она стартует раньше нас. Гасим её (тот же контейнер, тот же пользователь) и пробуем ещё
// раз; если держит кто-то другой — просто ждём.
function killBothostWrapper() {
  let killed = 0;
  try {
    for (const pid of fs.readdirSync('/proc').filter((d) => /^\d+$/.test(d))) {
      if (Number(pid) === process.pid) continue;
      let cmd = '';
      try { cmd = fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8'); } catch { continue; }
      if (cmd.includes('/opt/bothost/http-wrapper.js')) {
        try { process.kill(Number(pid), 'SIGTERM'); killed++; } catch { /* нет прав — ждём */ }
      }
    }
  } catch { /* не Linux — нечего гасить */ }
  return killed;
}
server.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    const killed = killBothostWrapper();
    console.warn(`порт ${PORT} занят${killed ? ', погасили заглушку bothost' : ''}, повтор через ${killed ? 1 : 2} с`);
    setTimeout(() => server.listen(PORT, '0.0.0.0'), killed ? 1000 : 2000);
    return;
  }
  throw err;
});
startApi().catch((err) => console.error('api не поднялся:', err && (err.stack || err.message)));
