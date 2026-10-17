// Transformative Media — сервер мини-приложения для bothost.ru. Собирается
// `npm run build:bothost` (tools/build-bothost.mjs) в deploy/bothost/, без npm-зависимостей:
//   · раздаёт собранный фронт из ./public;
//   · /api/* — тот же воркер, что и для Cloudflare (worker/index.ts, собран в ./worker.cjs),
//     только D1 здесь — SQLite в файле DATA_DIR/tm.sqlite: ./d1-sqlite.js (node:sqlite, Node 22.13+),
//     без него — ./d1-sqljs.js (база в памяти, выгрузка в тот же файл); ночные копии — ./backup.js;
//   · /kp-api/* — прокси Кинопоиска с ключом из окружения (в сборку он не попадает);
//   · /tmdb-api/* — прокси TMDb так же (13.10: до этого ключ ехал в сборке браузера);
//   · /img/tmdb/<размер>/<файл> — картинки TMDb через свой адрес с кешем на диске (ДФ-4, 14.10).
//
//   PORT            — порт из панели bothost (по умолчанию 3000)
//   DATA_DIR        — постоянная папка (/app/data на bothost переживает обновления)
//   BOT_TOKEN       — токен бота: им проверяется подпись Telegram (bothost задаёт сам)
//   KP_API_KEY      — ключ kinopoiskapiunofficial.tech; без него /kp-api отвечает 503
//   TMDB_API_KEY    — ключ TMDb (v3 или токен чтения v4); без него /tmdb-api отвечает 503
//   OWNER_TG_ID     — номер аккаунта Telegram владельца; задан — роль админа только по нему, а не по нику
//   OWNER_USERNAME  — ник владельца: его профиль при первом входе получает историю из seed/owner.json
//   ALLOW_DEMO      — «0» закрывает гостевой вход вне Telegram (по умолчанию открыт)
//   ADMIN_TOKEN     — токен сборщика и пультов; им же — копии базы (/api/admin/backups, /api/admin/restore)
//   DB_ENGINE       — «sqljs» — база в памяти, как до 06.10 (по умолчанию node:sqlite, если он есть)
//   BACKUP_KEEP     — сколько копий базы держать в DATA_DIR/backups (по умолчанию 14)
//   IMG_CACHE_MB    — предел кеша картинок TMDb в DATA_DIR/img-cache, МБ (по умолчанию 512)
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const { createBackups } = require('./backup');

// ХБ (17.10): один неперехваченный бросок где угодно — и процесс падал целиком, а с ним приложение у всех. Теперь такое
// уходит в журнал, сервер живёт дальше; падать остаётся только при ошибках запуска (см. server.on('error'))
// 17.10, аудит отказов п. 5: но больше 20 бросков за минуту — процесс уже не в себе (цикл ошибок, утечка): выходим с
// кодом 1, bothost поднимет заново
const CRASHES = [];
process.on('uncaughtException', (err) => {
  console.error('uncaughtException:', err && (err.stack || err.message || err));
  const t = Date.now();
  CRASHES.push(t);
  while (CRASHES.length && CRASHES[0] < t - 60e3) CRASHES.shift();
  if (CRASHES.length > 20) { console.error('больше 20 uncaughtException за минуту — выходим'); process.exit(1); }
});
process.on('unhandledRejection', (err) => console.error('unhandledRejection:', err && (err.stack || err.message || err)));
if (process.env.OWNER_TG_ID && !/^\d{1,20}$/.test(process.env.OWNER_TG_ID.trim())) console.warn('OWNER_TG_ID задан не числом — роль админа не получит никто');

const PORT = Number(process.env.PORT) || 3000;
const ROOT = path.join(__dirname, 'public');
const KP_BASE = 'https://kinopoiskapiunofficial.tech/api';
const KP_KEY = process.env.KP_API_KEY || '';
const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_KEY = process.env.TMDB_API_KEY || '';
// только то, что спрашивает клиент (src/lib/resolve/tmdb.ts): чужим прокси с нашим ключом сервер не станет
// /videos (15.10) — трейлер по смахиванию карточки ленты влево (src/api/index.ts, getTrailer)
const TMDB_PATHS = /^\/(?:find\/tt\d+|search\/(?:movie|tv)|(?:movie|tv)\/\d+(?:\/external_ids|\/watch\/providers|\/videos)?)$/;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
// предел ожидания TMDb и Кинопоиска (17.10, аудит отказов п. 6)
const PROXY_TIMEOUT = 10e3;

// ---------- API: воркер + D1 на SQLite ----------
let api = null;
let backups = null;
const DB_FILE = path.join(DATA_DIR, 'tm.sqlite');
/** закрыть базу при остановке — ставит startApi, когда база открыта */
let closeDb = () => {};
let stopping = false;

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
      // обложки книг (11.10) — сотни картинок, их читают редко: с диска, не в память
      if (path.basename(key).startsWith('cover-')) { const buf = fs.readFileSync(file); return { body: new Blob([buf]).stream(), httpEtag, size: buf.length }; }
      let hit = refFiles.get(file);
      if (!hit || hit.etag !== httpEtag) refFiles.set(file, (hit = { etag: httpEtag, buf: fs.readFileSync(file) }));
      return { body: new Blob([hit.buf]).stream(), httpEtag, size: hit.buf.length };
    },
    async delete(key) {
      const file = path.join(refDir, path.basename(key));
      refFiles.delete(file);
      fs.rmSync(file, { force: true });
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
    // номер аккаунта Telegram владельца: задан — админ только по нему (ник можно сменить и занять)
    OWNER_TG_ID: process.env.OWNER_TG_ID || '',
    OWNER_SEED: seed,
  };
  // сигналы остановки (17.10) вешаются при старте процесса, ниже по файлу (shutdown); отсюда — только закрытие базы
  closeDb = () => current.close();
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
// Предел тела — по маршруту (ХБ, 16.10): раньше любой POST в /api/* читал до 32 МБ в память ещё до проверки токена.
// Большое шлют только сборщики владельца (справочники, списки, копии — по ADMIN_TOKEN, его проверяем ДО чтения) и
// импорт истории участника; остальное — сотни байт.
const ADMIN_BODY = /^\/api\/(?:reference\/|admin\/)/;
const bodyLimit = (p) => (ADMIN_BODY.test(p) ? MAX_BODY : p === '/api/import' ? 8 << 20 : 1 << 20);
function readBody(req, limit = MAX_BODY) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      // переполнение: не рвём сокет здесь — иначе 413 до клиента не доходил (ХБ, 17.10); дочитывать не будем, ответ закроет соединение
      if (size > limit) { req.pause(); reject(new Error('too_large')); return; }
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
    // большое тело админских маршрутов — только с верным токеном, иначе не читаем вовсе
    if (req.method !== 'GET' && req.method !== 'HEAD' && ADMIN_BODY.test(p) && !adminOk(req)) { sendJson(res, 401, { error: 'unauthorized' }); req.resume(); return; }
    let body;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      // 413 — ответом с закрытием соединения, а не обрывом сокета: по Content-Length сразу, иначе по счётчику при чтении
      const tooLarge = () => { res.on('finish', () => req.destroy()); res.writeHead(413, { 'content-type': 'application/json; charset=utf-8', connection: 'close' }).end(JSON.stringify({ error: 'too_large' })); };
      if (Number(req.headers['content-length']) > bodyLimit(p)) { tooLarge(); return; }
      try { body = await readBody(req, bodyLimit(p)); } catch { if (!res.headersSent) tooLarge(); else req.destroy(); return; }
    }
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
    // уже сжатое воркером (замер /api/probe — gzip с балластом в заголовке) не трогаем
    const enc = response.status === 200 && out.length > 1024 && !head['content-encoding'] && /json|text/.test(head['content-type'] || '') ? acceptEncoding(req) : null;
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
  // промахи не запоминаем (ХБ, 16.10): каждый выдуманный адрес оставался в памяти навсегда — рост без предела без входа
  if (entry) cache.set(file, entry);
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
      // 17.10: без предела зависший Кинопоиск держал запрос до 300 с (сигнал обрывает и чтение тела)
      signal: AbortSignal.timeout(PROXY_TIMEOUT),
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
    if (res.headersSent) { res.destroy(); return; }
    const timeout = err && err.name === 'TimeoutError';
    res.writeHead(timeout ? 504 : 502, { 'content-type': 'application/json', 'cache-control': 'no-store' }).end(timeout ? '{"error":"kp_timeout"}' : '{"error":"kp_upstream"}');
  }
}

async function proxyTmdb(req, res, urlPath, search) {
  if (req.method !== 'GET') { res.writeHead(405).end(); return; }
  const rest = urlPath.replace(/^\/tmdb-api/, '');
  if (!TMDB_PATHS.test(rest)) { res.writeHead(404, { 'content-type': 'application/json' }).end('{"error":"tmdb_path"}'); return; }
  if (!TMDB_KEY) { res.writeHead(503, { 'content-type': 'application/json' }).end('{"error":"tmdb_key_missing"}'); return; }
  const bearer = TMDB_KEY.includes('.');
  const qs = new URLSearchParams(search);
  qs.delete('api_key');
  if (!bearer) qs.set('api_key', TMDB_KEY);
  try {
    const upstream = await fetch(`${TMDB_BASE}${rest}?${qs}`, {
      headers: { accept: 'application/json', ...(bearer ? { authorization: `Bearer ${TMDB_KEY}` } : {}) },
      signal: AbortSignal.timeout(PROXY_TIMEOUT),
    });
    const body = Buffer.from(await upstream.arrayBuffer());
    res.writeHead(upstream.status, {
      'content-type': upstream.headers.get('content-type') || 'application/json',
      'cache-control': upstream.ok ? 'public, max-age=86400' : 'no-store',
      'content-length': body.length,
    });
    res.end(body);
  } catch (err) {
    console.error('tmdb-api:', err && err.message);
    if (res.headersSent) { res.destroy(); return; }
    const timeout = err && err.name === 'TimeoutError';
    res.writeHead(timeout ? 504 : 502, { 'content-type': 'application/json', 'cache-control': 'no-store' }).end(timeout ? '{"error":"tmdb_timeout"}' : '{"error":"tmdb_upstream"}');
  }
}

// ---------- картинки TMDb через свой адрес (ДФ-4, 14.10) ----------
// /img/tmdb/<размер>/<файл> → image.tmdb.org/t/p/<размер>/<файл>: телефон не ходит к TMDb сам (из России он бывает
// медленным или закрыт), а мы берём картинку один раз и дальше отдаём с диска. Не перекодируем: сервер без
// npm-зависимостей, а AVIF/WebP встроенным Node не сделать. Но CDN TMDb сам отдаёт WebP тому, кто его принимает
// (Accept: image/webp — на 15–25 % легче JPEG; AVIF не отдаёт): передаём ему Accept телефона и держим в кеше обе
// версии отдельно, ответ с Vary: Accept. Старый браузер без WebP получает JPEG/PNG оригинала.
// Файл TMDb по пути не меняется никогда (новая картинка — новое имя), поэтому immutable на год.
// Размеры — только те, что спрашивает клиент (src/lib/images.ts, src/lib/resolve/tmdb.ts, моки): w92 — логотипы
// площадок, w185 — лица и мелкие миниатюры, w342 — постеры и миниатюры кадров, w500 — запас, w780 — баннер.
// original не пускаем: не нужен и весит мегабайты — чужим «бесплатным CDN» сервер не станет.
const IMG_PATH = /^\/img\/tmdb\/(w92|w185|w342|w500|w780)\/([A-Za-z0-9]{1,64}\.(?:jpg|png|webp))$/;
const IMG_BASE = 'https://image.tmdb.org/t/p';
const IMG_DIR = path.join(DATA_DIR, 'img-cache');
// 512 МБ: горячий набор — баннеры и миниатюры ленты. w780 в среднем ~120 КБ, w342 ~25 КБ, w185 ~12 КБ — около
// 160 КБ на произведение, то есть ~3000 самых показываемых произведений целиком. Весь каталог (~8000 с картинками
// TMDb) — около 1,3 ГБ: держать его ради редких хвостов на диске хостинга, где ещё база и 14 её копий, незачем.
// Больше предела — вытесняем давно не показанные до 90 %. IMG_CACHE_MB — поменять без правки кода.
const IMG_CACHE_MAX = (Number(process.env.IMG_CACHE_MB) || 512) * (1 << 20);
const IMG_MAX_FILE = 8 << 20;
const IMG_TIMEOUT = 15e3;
const IMG_IMMUTABLE = 'public, max-age=31536000, immutable';
const imgIndex = new Map(); // имя файла в кеше (<размер>_<файл>[.webp]) → { size, type, etag, used }
let imgTotal = 0;
let imgReady = null;
const imgInflight = new Map(); // одна и та же картинка у TMDb качается один раз, остальные ждут её
// тип — по первым байтам: в версии «.webp» CDN мог отдать и JPEG (у PNG с прозрачностью, например)
const imgSniff = (b) => (b[0] === 0xff && b[1] === 0xd8 ? 'image/jpeg' : b[0] === 0x89 && b[1] === 0x50 ? 'image/png'
  : b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP' ? 'image/webp' : null);
const imgEtag = (key, size) => `"${size.toString(36)}-${crypto.createHash('sha1').update(key).digest('hex').slice(0, 16)}"`;

function imgScan() {
  imgReady ??= (async () => {
    await fs.promises.mkdir(IMG_DIR, { recursive: true });
    for (const name of await fs.promises.readdir(IMG_DIR)) {
      const file = path.join(IMG_DIR, name);
      // недописанное при прошлой остановке
      if (name.includes('.tmp-')) { fs.promises.unlink(file).catch(() => {}); continue; }
      const m = /^(w\d+)_(.+)$/.exec(name);
      if (!m) continue;
      try {
        const st = await fs.promises.stat(file);
        const fh = await fs.promises.open(file);
        const head = Buffer.alloc(12);
        try { await fh.read(head, 0, 12, 0); } finally { await fh.close(); }
        imgIndex.set(name, { size: st.size, type: imgSniff(head) || MIME[path.extname(name)] || 'image/jpeg', etag: imgEtag(name, st.size), used: st.mtimeMs });
        imgTotal += st.size;
      } catch { /* удалили между readdir и stat */ }
    }
    imgEvict();
  })().catch((err) => { console.error('img-cache:', err && err.message); });
  return imgReady;
}

function imgEvict() {
  if (imgTotal <= IMG_CACHE_MAX) return;
  const target = IMG_CACHE_MAX * 0.9;
  const old = [...imgIndex.entries()].sort((a, b) => a[1].used - b[1].used);
  for (const [name, e] of old) {
    if (imgTotal <= target) break;
    imgIndex.delete(name);
    imgTotal -= e.size;
    fs.promises.unlink(path.join(IMG_DIR, name)).catch(() => {});
  }
}

/** Картинка у TMDb → в кеш. null — у TMDb её нет (404); бросает — TMDb недоступен или ответил не картинкой. */
async function imgFetch(size, name, key, webp) {
  const upstream = await fetch(`${IMG_BASE}/${size}/${name}`, {
    headers: { accept: webp ? 'image/webp,image/*;q=0.8' : 'image/jpeg,image/png,image/*;q=0.8' },
    signal: AbortSignal.timeout(IMG_TIMEOUT),
  });
  if (upstream.status === 404) { await upstream.body?.cancel(); return null; }
  const type = (upstream.headers.get('content-type') || '').split(';')[0].trim();
  if (!upstream.ok || !type.startsWith('image/')) { await upstream.body?.cancel(); throw new Error(`tmdb ${upstream.status} ${type}`); }
  if (Number(upstream.headers.get('content-length') || 0) > IMG_MAX_FILE) { await upstream.body?.cancel(); throw new Error('too_large'); }
  const body = Buffer.from(await upstream.arrayBuffer());
  if (!body.length || body.length > IMG_MAX_FILE) throw new Error(`size ${body.length}`);
  const entry = { size: body.length, type: imgSniff(body) || type, etag: imgEtag(key, body.length), used: Date.now() };
  // на диск — атомарно; не вышло (диск полон, только чтение) — отдаём из памяти, кеш просто не растёт
  const file = path.join(IMG_DIR, key);
  const tmp = `${file}.tmp-${process.pid}-${crypto.randomBytes(4).toString('hex')}`;
  try {
    await fs.promises.writeFile(tmp, body);
    await fs.promises.rename(tmp, file);
    const prev = imgIndex.get(key);
    if (prev) imgTotal -= prev.size;
    imgIndex.set(key, entry);
    imgTotal += entry.size;
    imgEvict();
  } catch (err) {
    fs.promises.unlink(tmp).catch(() => {});
    console.error('img-cache: не записали', key, err && err.message);
  }
  return { entry, body };
}

async function proxyImage(req, res, p) {
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, { allow: 'GET, HEAD' }).end(); return; }
  const m = IMG_PATH.exec(p);
  if (!m) { res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' }).end('Not found'); return; }
  const [, size, name] = m;
  const webp = /\bimage\/webp\b/.test(String(req.headers.accept || ''));
  const key = `${size}_${name}${webp && !name.endsWith('.webp') ? '.webp' : ''}`;
  await imgScan();
  const send = (entry, body, hit) => {
    const head = { 'content-type': entry.type, 'cache-control': IMG_IMMUTABLE, etag: entry.etag, vary: 'Accept', 'x-img-cache': hit ? 'hit' : 'miss' };
    if (req.headers['if-none-match'] === entry.etag) { res.writeHead(304, head).end(); return; }
    head['content-length'] = entry.size;
    res.writeHead(200, head);
    if (req.method === 'HEAD') { res.end(); return; }
    if (body) { res.end(body); return; }
    fs.createReadStream(path.join(IMG_DIR, key))
      // файл пропал с диска — забываем, следующий запрос возьмёт у TMDb заново
      .on('error', () => { res.destroy(); if (imgIndex.get(key) === entry) { imgIndex.delete(key); imgTotal -= entry.size; } })
      .pipe(res);
  };
  const cached = imgIndex.get(key);
  if (cached) {
    // «давно не показанные» — по последнему показу; на диск отметку пишем не чаще раза в час, переживёт перезапуск
    const now = Date.now();
    if (now - cached.used > 3600e3) fs.promises.utimes(path.join(IMG_DIR, key), now / 1000, now / 1000).catch(() => {});
    cached.used = now;
    send(cached, null, true);
    return;
  }
  let job = imgInflight.get(key);
  if (!job) {
    job = imgFetch(size, name, key, webp).finally(() => imgInflight.delete(key));
    imgInflight.set(key, job);
  }
  try {
    const got = await job;
    if (!got) { res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' }).end('Not found'); return; }
    send(got.entry, got.body, false);
  } catch (err) {
    console.error('img:', key, err && err.message);
    if (!res.headersSent) res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' }).end('Bad gateway');
    else res.destroy();
  }
}

// ---------- живость, версия, остановка (17.10, аудит отказов п. 5, 11) ----------
/** /healthz: 200 — только когда API поднят и база отвечает на SELECT 1; до готовности и при остановке — 503 */
async function healthz(res) {
  const head = { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' };
  if (stopping) { res.writeHead(503, head).end('stopping'); return; }
  if (!api) { res.writeHead(503, head).end('starting'); return; }
  try {
    await api.env.DB.prepare('SELECT 1 AS ok').first();
    res.writeHead(200, head).end('ok');
  } catch (err) {
    console.error('healthz:', err && err.message);
    res.writeHead(503, head).end('db');
  }
}

/** /api/version: version.json рядом с сервером (пишет сборка: commit, dirty, builtAt) как есть; нет файла — commit «dev».
 *  Читаем на каждый запрос — файл крошечный, а после выкладки должен быть виден сразу */
function version(res) {
  let body;
  try { body = JSON.parse(fs.readFileSync(path.join(__dirname, 'version.json'), 'utf8')); } catch { body = { commit: 'dev' }; }
  sendJson(res, 200, body);
}

/** Плавная остановка: новых соединений не берём, запросы на лету дожидаемся до 8 с, потом рвём оставшиеся, закрываем
 *  базу (журнал — в основной файл) и выходим. Раньше SIGTERM сразу закрывал базу и обрывал запросы на лету. */
const STOP_WAIT = 8e3;
function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  console.log(`${signal}: останавливаемся, ждём запросы на лету до ${STOP_WAIT / 1000} с`);
  const done = (code) => {
    try { closeDb(); } catch (err) { console.error('база не закрылась:', err && err.message); }
    process.exit(code);
  };
  const timer = setTimeout(() => {
    console.warn('не дождались запросов на лету — обрываем');
    server.closeAllConnections?.();
    done(0);
  }, STOP_WAIT);
  server.close(() => { clearTimeout(timer); done(0); });
  // простаивающие keep-alive соединения server.close сам не закрывает до Node 19 — закрыть их сразу
  server.closeIdleConnections?.();
}
// сразу при старте (17.10): раньше вешались внутри startApi, и пока база открывалась, SIGTERM убивал процесс как придётся
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

const server = http.createServer((req, res) => {
  // ХБ (17.10): разбор адреса — внутри try. `GET http://[ HTTP/1.1` бросал ERR_INVALID_URL до любого try и ронял процесс целиком,
  // bothost отдавал «404 page not found» всем, пока контейнер поднимался. Цель запроса принимаем только origin-form (с «/»)
  let url, p;
  try {
    if (!(req.url || '/').startsWith('/')) throw new Error('target');
    url = new URL(req.url || '/', 'http://localhost');
    p = decodeURIComponent(url.pathname);
  } catch { res.writeHead(400).end(); return; }

  if (p === '/healthz') { healthz(res); return; }
  if (p === '/api/version') { version(res); return; }
  if (p.startsWith('/kp-api/')) { proxyKinopoisk(req, res, p, url.search); return; }
  if (p.startsWith('/tmdb-api/')) { proxyTmdb(req, res, p, url.search); return; }
  if (p.startsWith('/img/')) { proxyImage(req, res, p); return; }
  if (p.startsWith('/api/')) { handleApi(req, res); return; }
  // публичные страницы для поисковиков (ЗП-15, worker/pages.ts) — их рисует тот же воркер; выключены, пока не PUBLIC_PAGES=1
  if (process.env.PUBLIC_PAGES === '1' && (p === '/robots.txt' || p === '/sitemap.xml' || p.startsWith('/film/') || p.startsWith('/author/'))) { handleApi(req, res); return; }
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405).end(); return; }

  const file = path.normalize(path.join(ROOT, p));
  if (file !== ROOT && !file.startsWith(ROOT + path.sep)) { res.writeHead(403).end(); return; }

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
  console.log(`Transformative Media: http://0.0.0.0:${PORT} (kp-api ${KP_KEY ? 'on' : 'off'}, tmdb-api ${TMDB_KEY ? 'on' : 'off'})`);
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
  // не слушаем — жить незачем (глобальный uncaughtException выше такой бросок иначе проглотил бы)
  console.error('сервер не слушает:', err && (err.stack || err.message || err));
  process.exit(1);
});
// 17.10, аудит отказов п. 5: API не поднялся (нет DATA_DIR, битая база, нет worker.cjs) — раньше процесс жил дальше с
// /api/* 503 навсегда, а /healthz отвечал «ok», и bothost не перезапускал. Теперь — выход с кодом 1: платформа поднимет заново
startApi().catch((err) => {
  console.error('api не поднялся:', err && (err.stack || err.message));
  process.exit(1);
});
