// Нагрузочный прогон сервера bothost (ЗП-4, 06.10): тот же server/index.js и воркер, что на хосте,
// во временной папке, с настоящими справочниками и настоящей подписью Telegram (тестовый токен бота).
//
//   node tools/load-test.mjs                    — 1 000 участников, 100 одновременно, node:sqlite
//   node tools/load-test.mjs --engine sqljs     — то же на базе в памяти (как до 06.10) — для сравнения
//   --users N --concurrency C                   — размер прогона
//   --no-reference                              — без публикации и скачивания справочников (быстрее)
//   --keep                                      — не удалять папку прогона (база, копии, журнал сервера)
//
// Сценарий участника — первый вход: вход по подписи → профиль → справочники, как их берёт клиент
// при старте → настройки → 12 оценок → показы ленты → отклики → «в планы», «смотрю», чек-ин →
// открытия разборов → подписка → профиль. Затем второй заход всех: вход, профиль, лента, отклик.
// Посреди первого захода снимается копия базы; в конце — восстановление из неё и сверка.
// Итог — в консоль и в .cache/load-test/<время>-<движок>.json.
import { execSync, spawn } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : def;
};
const flag = (name) => process.argv.includes(`--${name}`);
const USERS = Number(arg('users', 1000));
const CONCURRENCY = Number(arg('concurrency', 100));
const ENGINE = arg('engine', 'sqlite');
const WITH_REFERENCE = !flag('no-reference');
const PORT = Number(arg('port', 4890));
const BOT_TOKEN = '1234567:load-test-token';
const ADMIN_TOKEN = 'load-test-admin';
const BASE = `http://127.0.0.1:${PORT}`;

// ---------- 1. сервер во временной папке ----------
const dir = mkdtempSync(join(tmpdir(), 'tm-load-'));
const run = (cmd, opts = {}) => execSync(cmd, { cwd: root, stdio: 'inherit', ...opts });
console.log(`папка прогона: ${dir}`);
run(`npx esbuild worker/index.ts --bundle --platform=node --target=node20 --format=cjs --outfile=${join(dir, 'worker.cjs')} --log-level=warning`);
for (const f of ['index.js', 'd1-sqlite.js', 'd1-sqljs.js', 'backup.js']) cpSync(join(root, 'server', f), join(dir, f));
cpSync(join(root, 'worker', 'schema.sql'), join(dir, 'schema.sql'));
mkdirSync(join(dir, 'vendor'));
for (const f of ['sql-wasm.js', 'sql-wasm.wasm']) cpSync(join(root, 'node_modules', 'sql.js', 'dist', f), join(dir, 'vendor', f));
mkdirSync(join(dir, 'public'));
writeFileSync(join(dir, 'public', 'index.html'), '<!doctype html><title>load</title>');

const logFile = join(dir, 'server.log');
const server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', join(dir, 'index.js')], {
  env: {
    ...process.env, PORT: String(PORT), DATA_DIR: join(dir, 'data'), BOT_TOKEN, ADMIN_TOKEN, ALLOW_DEMO: '1',
    DB_ENGINE: ENGINE === 'sqljs' ? 'sqljs' : '', OWNER_USERNAME: 'nobody_owner', KP_API_KEY: '',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
const logChunks = [];
server.stdout.on('data', (c) => logChunks.push(c));
server.stderr.on('data', (c) => logChunks.push(c));
const stopServer = () => { try { server.kill('SIGTERM'); } catch { /* уже нет */ } };
process.on('exit', stopServer);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (let i = 0; ; i++) {
  const ok = await fetch(`${BASE}/api/health`).then((r) => r.ok).catch(() => false);
  if (ok) break;
  if (i > 100) { console.error('сервер не поднялся:\n' + Buffer.concat(logChunks).toString()); process.exit(1); }
  await sleep(100);
}

// ---------- 2. справочники ----------
let workIds = [];
if (WITH_REFERENCE) {
  console.log('публикую справочники…');
  run('npx tsx tools/publish-reference.mts', { env: { ...process.env, TM_SERVER: BASE, TM_ADMIN_TOKEN: ADMIN_TOKEN }, stdio: ['ignore', 'ignore', 'inherit'] });
  // реестр каналов — как после переноса OPS-12 на боевой: /api/sources отдаёт его каждому при старте
  console.log('переношу реестр…');
  run('npx tsx tools/registry-migrate.mts', { env: { ...process.env, TM_SERVER: BASE, TM_REGISTRY_SERVER: BASE, TM_ADMIN_TOKEN: ADMIN_TOKEN }, stdio: ['ignore', 'ignore', 'inherit'] });
  const essays = await fetch(`${BASE}/api/reference/essaysAuto`).then((r) => r.json());
  workIds = Object.keys(essays);
}
if (!workIds.length) workIds = Array.from({ length: 2000 }, (_, i) => `tmdb_${1000 + i}`);

// ---------- 3. замеры ----------
const stats = new Map(); // группа → { ms: [], errors: {status: n}, bytes }
const note = (group, ms, status, bytes = 0) => {
  let s = stats.get(group);
  if (!s) stats.set(group, (s = { ms: [], errors: {}, bytes: 0 }));
  s.ms.push(ms);
  s.bytes += bytes;
  if (status < 200 || status >= 300) s.errors[status] = (s.errors[status] ?? 0) + 1;
};
async function call(group, path, { method = 'GET', body, token, raw = false } = {}) {
  const t0 = performance.now();
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        ...(body ? { 'content-type': 'application/json' } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        // как телефон: сжатие принимаем
        'accept-encoding': 'gzip, br',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const buf = Buffer.from(await res.arrayBuffer());
    // сколько ушло по сети: при сжатии fetch распаковывает сам — берём заголовок
    const wire = Number(res.headers.get('content-length')) || buf.length;
    note(group, performance.now() - t0, res.status, wire);
    if (raw) return { status: res.status, buf };
    return res.ok && buf.length ? JSON.parse(buf.toString('utf8')) : { _status: res.status };
  } catch (err) {
    note(group, performance.now() - t0, 0);
    return { _error: String(err) };
  }
}

const initData = (i) => {
  const user = JSON.stringify({ id: 900_000_000 + i, first_name: `Нагрузка ${i}`, username: `load_user_${i}` });
  const params = { auth_date: String(Math.floor(Date.now() / 1000)), query_id: `AAH${i}`, user };
  const check = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  const hash = createHmac('sha256', secret).update(check).digest('hex');
  return new URLSearchParams({ ...params, hash }).toString();
};
const pick = (n, seed) => Array.from({ length: n }, (_, k) => workIds[(seed * 7919 + k * 104729) % workIds.length]);
const REFS = ['essaysAuto', 'postsAuto', 'essayLenses', 'filmBaseWiki', 'comentions'];

async function firstVisit(i) {
  const s = await call('session', '/api/session', { method: 'POST', body: { initData: initData(i) } });
  if (!s.token) return;
  const token = s.token;
  await call('state', '/api/state', { token });
  if (WITH_REFERENCE) {
    await Promise.all([...REFS.map((r) => call(`ref ${r}`, `/api/reference/${r}`, { raw: true })), call('sources', '/api/sources', { raw: true })]);
  }
  await call('settings', '/api/settings', { method: 'PUT', token, body: { energy: 'medium', materialLanguages: ['ru'] } });
  const works = pick(24, i);
  for (const [k, w] of works.slice(0, 12).entries()) {
    await call('rating', `/api/rating/${encodeURIComponent(w)}`, { method: 'PUT', token, body: { rating: 1 + ((i + k) % 5), work: { id: w, title: `Фильм ${w}` } } });
  }
  const slate = `s-${i}-1`;
  await call('impressions', '/api/impressions', {
    method: 'POST', token,
    body: { slateId: slate, energy: 'medium', items: works.slice(12, 18).map((w, k) => ({ recId: `r-${i}-${k}`, workId: w, slot: 'main', rank: k })) },
  });
  for (let k = 0; k < 3; k++) {
    await call('feedback', '/api/feedback', { method: 'POST', token, body: { recId: `r-${i}-${k}`, workId: works[12 + k], action: k === 0 ? 'start' : k === 1 ? 'save' : 'dismiss', eagerness: 3 } });
  }
  const planEntry = `j-${i}-p`;
  await call('journal', '/api/journal/plan', { method: 'POST', token, body: { entryId: planEntry, workId: works[13], work: { id: works[13] }, eagerness: 4 } });
  const entry = `j-${i}-s`;
  await call('journal', '/api/journal/start', { method: 'POST', token, body: { entryId: entry, workId: works[12], work: { id: works[12] }, expected: 'meaning' } });
  // карточка открыта, у каждого пятого — «Смотреть» (ЗП-3)
  await call('event', '/api/event', { method: 'POST', token, body: { kind: 'card', workId: works[12], place: 'today' } });
  if (i % 5 === 0) await call('event', '/api/event', { method: 'POST', token, body: { kind: 'watch', workId: works[12], place: 'today', detail: 'Кинопоиск' } });
  for (let k = 0; k < 3; k++) {
    await call('open', '/api/open', { method: 'POST', token, body: { url: `https://youtu.be/load${i}_${k}`, workId: works[12], platform: 'youtube', lens: 'meaning', place: 'sheet' } });
  }
  await call('checkin', `/api/journal/${entry}/checkin`, { method: 'POST', token, body: { workId: works[12], status: 'finished', perceived: 'moved' } });
  const key = works[12].replace('_', ':');
  await call('follow', '/api/follow', { method: 'PUT', token, body: { kind: 'work', ref: /^[a-z]{2,10}:/.test(key) ? key : `tmdb:${i}`, title: `Фильм ${i}` } });
  await call('state', '/api/state', { token });
}

async function returnVisit(i) {
  const s = await call('session', '/api/session', { method: 'POST', body: { initData: initData(i) } });
  if (!s.token) return;
  const token = s.token;
  await call('state', '/api/state', { token });
  const works = pick(6, i + 31);
  await call('impressions', '/api/impressions', {
    method: 'POST', token, body: { slateId: `s-${i}-2`, energy: 'light', items: works.map((w, k) => ({ recId: `r2-${i}-${k}`, workId: w, rank: k })) },
  });
  await call('feedback', '/api/feedback', { method: 'POST', token, body: { recId: `r2-${i}-0`, workId: works[0], action: 'dismiss' } });
}

// память сервера — раз в полсекунды
let rssMax = 0;
const rssTimer = setInterval(() => {
  try { rssMax = Math.max(rssMax, Number(execSync(`ps -o rss= -p ${server.pid}`).toString().trim()) * 1024); } catch { /* вышел */ }
}, 500);

async function pool(n, fn) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, n) }, async () => {
    while (next < n) await fn(next++);
  }));
}

const auth = { token: ADMIN_TOKEN };
console.log(`первый вход: ${USERS} участников, одновременно ${CONCURRENCY}, база ${ENGINE}…`);
let t0 = performance.now();
let backupDuring;
const mid = setTimeout(async () => { backupDuring = await call('backup (под нагрузкой)', '/api/admin/backups', { method: 'POST', ...auth }); }, 1500);
await pool(USERS, firstVisit);
clearTimeout(mid);
const firstMs = performance.now() - t0;
const firstCount = [...stats.values()].reduce((a, s) => a + s.ms.length, 0);

console.log('второй заход…');
t0 = performance.now();
await pool(USERS, returnVisit);
const secondMs = performance.now() - t0;
const secondCount = [...stats.values()].reduce((a, s) => a + s.ms.length, 0) - firstCount;
clearInterval(rssTimer);

// ---------- 4. копия и восстановление ----------
const dataDir = join(dir, 'data');
const dbSize = () => ['tm.sqlite', 'tm.sqlite-wal'].reduce((a, f) => a + (existsSync(join(dataDir, f)) ? statSync(join(dataDir, f)).size : 0), 0);
const sizeAfter = dbSize();
const made = await call('backup', '/api/admin/backups', { method: 'POST', ...auth });
const list = await call('backup', '/api/admin/backups', auth);
const download = await call('backup', '/api/admin/backups/latest', { ...auth, raw: true });
// после копии — изменение, которое восстановление обязано откатить
const probe = await call('session', '/api/session', { method: 'POST', body: { initData: initData(USERS + 1) } });
const funnel = await call('funnel', '/api/admin/funnel', auth);
const restored = await call('restore', '/api/admin/restore', { method: 'POST', ...auth, body: { backup: made.name } });
const again = await call('session', '/api/session', { method: 'POST', body: { initData: initData(7) } });
const stateAfter = again.token ? await call('state', '/api/state', { token: again.token }) : {};
const probeGone = probe.token ? (await call('проверка отката', '/api/state', { token: probe.token }))._status === 401 : false;

// ---------- 5. итог ----------
const pct = (arr, p) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
};
const rows = [...stats.entries()].map(([group, s]) => ({
  group, n: s.ms.length,
  p50: +pct(s.ms, 50).toFixed(1), p95: +pct(s.ms, 95).toFixed(1), p99: +pct(s.ms, 99).toFixed(1), max: +s.ms.reduce((a, b) => (b > a ? b : a), 0).toFixed(1),
  errors: Object.values(s.errors).reduce((a, b) => a + b, 0), errorsBy: s.errors, kbPerCall: +(s.bytes / s.ms.length / 1024).toFixed(1),
}));
// 401 у входа, снятого восстановлением, — ожидаемый
const errors = rows.filter((r) => r.group !== 'проверка отката').reduce((a, r) => a + r.errors, 0);
const report = {
  at: new Date().toISOString(), engine: ENGINE, users: USERS, concurrency: CONCURRENCY, withReference: WITH_REFERENCE,
  node: process.version,
  first: { ms: Math.round(firstMs), requests: firstCount, rps: Math.round(firstCount / (firstMs / 1000)) },
  second: { ms: Math.round(secondMs), requests: secondCount, rps: Math.round(secondCount / (secondMs / 1000)) },
  errors, rssMaxMb: Math.round(rssMax / 1048576), dbBytes: sizeAfter,
  backup: { duringLoad: backupDuring, after: made, listed: list.backups?.length, downloadedBytes: download.buf?.length },
  funnel: { yesterday: funnel.yesterday, today: funnel.daily?.at(-1), funnel: funnel.funnel },
  restore: { result: restored, ratingsOfUser7: stateAfter.ratings?.length, probeSessionGone: probeGone },
  routes: rows,
};
console.table(rows.map(({ errorsBy, ...r }) => r));
console.log(`первый вход: ${report.first.requests} запросов за ${(firstMs / 1000).toFixed(1)} с (${report.first.rps}/с); `
  + `второй заход: ${report.second.requests} за ${(secondMs / 1000).toFixed(1)} с (${report.second.rps}/с)`);
console.log(`ошибок ${errors}; память сервера до ${report.rssMaxMb} МБ; база ${(sizeAfter / 1048576).toFixed(1)} МБ`);
console.log(`копия под нагрузкой: ${backupDuring?.name ?? JSON.stringify(backupDuring)} за ${backupDuring?.ms} мс; `
  + `после: ${made.name}, ${(made.size / 1024).toFixed(0)} КБ сжатой, участников ${made.check?.users ?? '?'}`);
console.log(`воронка за сегодня: ${JSON.stringify(funnel.daily?.at(-1))}; новые за 30 дней: ${JSON.stringify(funnel.funnel)}`);
console.log(`восстановление: ${restored.ok ? 'ок' : JSON.stringify(restored)}; у участника 7 оценок ${stateAfter.ratings?.length} (ждём 12); `
  + `вход после копии откатился: ${probeGone ? 'да' : 'НЕТ'}`);

const outDir = join(root, '.cache', 'load-test');
mkdirSync(outDir, { recursive: true });
const out = join(outDir, `${report.at.replace(/[:.]/g, '-')}-${ENGINE}.json`);
writeFileSync(out, JSON.stringify(report, null, 2));
writeFileSync(logFile, Buffer.concat(logChunks));
console.log(`отчёт: ${out}`);
stopServer();
await sleep(300);
if (!flag('keep')) rmSync(dir, { recursive: true, force: true });
else console.log(`оставлено: ${dir} (${readdirSync(join(dir, 'data', 'backups')).length} копий)`);
process.exit(errors ? 1 : 0);
