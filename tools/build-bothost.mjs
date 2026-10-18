// Сборка для bothost.ru: фронт + сервер (static, /api, /kp-api) одной папкой и zip-архивом
// для «Загрузить из архива» / «Залить новый архив» в панели.
//
//   npm run build:bothost          → deploy/bothost/ и deploy/tm-bothost.zip
//
// Фронт собирается с VITE_API_URL=/ — API на том же адресе, что и страница. Ключи TMDb
// и Кинопоиска в сборку не попадают (TMDb — с 13.10): их знает только сервер (TMDB_API_KEY, KP_API_KEY).
//
// С 17.10 (аудит, волна 1, пп. 2 и 11):
//   - version.json рядом с index.js — {commit, dirty, builtAt}: сервер отдаёт его по GET /api/version, выкладка
//     (tools/deploy-github.mjs) по нему ждёт, что поднялась именно эта сборка; dirty — есть ли незакоммиченное
//     в отслеживаемых файлах;
//   - в public/assets кладутся и файлы прошлой сборки (только одного поколения: её собственные, без перенесённых
//     ею самой): у открытого до выкладки приложения ленивые экраны просят старые чанки, и без них — 404.
//     Список — assets.json рядом с index.js ({own, carried}); бюджет первой загрузки их не считает (он по манифесту).
import { execSync } from 'node:child_process';
import { cpSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { brotliCompressSync, constants as zlibConstants, gzipSync } from 'node:zlib';

const root = process.cwd();
const out = join(root, 'deploy', 'bothost');
const run = (cmd, env = {}) => execSync(cmd, { stdio: 'inherit', env: { ...process.env, ...env } });
const git = (cmd) => execSync(`git ${cmd}`, { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();

// 0. ассеты прошлой сборки — в сторону до очистки: только её собственные (own), перенесённые ею — уже третье поколение.
// Папка в стороне живёт до удачной сборки: упадёт vite — следующая попытка возьмёт прошлые ассеты оттуда
const prevAssets = join(out, 'public', 'assets');
const keepDir = join(root, 'node_modules', '.cache', 'bothost-prev-assets');
if (existsSync(prevAssets)) {
  let manifest;
  try { manifest = JSON.parse(readFileSync(join(out, 'assets.json'), 'utf8')); } catch { /* сборка до 17.10 — все её файлы свои */ }
  const carried = new Set(manifest?.carried ?? []);
  const mine = (manifest?.own ?? readdirSync(prevAssets)).filter((f) => !carried.has(f) && existsSync(join(prevAssets, f)));
  rmSync(keepDir, { recursive: true, force: true });
  mkdirSync(keepDir, { recursive: true });
  for (const f of mine) renameSync(join(prevAssets, f), join(keepDir, f));
}
const prevOwn = existsSync(keepDir) ? readdirSync(keepDir) : [];

rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'seed'), { recursive: true });
mkdirSync(join(out, 'vendor'), { recursive: true });

// 1. фронт
// язык — по Telegram и браузеру (11.10: один сервер в Нидерландах для всех языков, решение владельца): русский для
// ru/uk/be/kk и соседних, английский — остальным; регион «где смотреть» у нерусскоязычных — из языка браузера
run('npx tsc -b && npx vite build --outDir deploy/bothost/public --emptyOutDir', { VITE_API_URL: '/', VITE_KP_PROXY: '1', VITE_DEFAULT_LANG: 'auto' });
// бюджет первой загрузки (РР-0): превышен — сборка падает; манифест нужен только проверке, на сервер не едет
run('node tools/load-budget.mjs deploy/bothost/public');
rmSync(join(out, 'public', '.vite'), { recursive: true, force: true });

// 1б. прошлые ассеты рядом с новыми (имена с хешем: совпавшие — тот же файл, их не трогаем)
const assets = join(out, 'public', 'assets');
const own = readdirSync(assets).sort();
const ownSet = new Set(own);
const carried = prevOwn.filter((f) => !ownSet.has(f) && statSync(join(keepDir, f)).isFile()).sort();
for (const f of carried) cpSync(join(keepDir, f), join(assets, f));
rmSync(keepDir, { recursive: true, force: true });
const mb = (files) => (files.reduce((n, f) => n + statSync(join(assets, f)).size, 0) / 1048576).toFixed(1);
writeFileSync(join(out, 'assets.json'), JSON.stringify({ own, carried }, null, 1) + '\n');
console.log(`ассеты: своих ${own.length} (${mb(own)} МБ), от прошлой сборки ${carried.length} (${mb(carried)} МБ)`);

// 1в. сжатое заранее (18.10, аудит скорости, п. 31): рядом с каждым текстовым файлом больше килобайта — .br (качество 11)
// и .gz (9). Сервер отдаёт готовое (server/index.js load) и не сжимает сам на первом запросе — раньше это 3,4 с стопов
// после каждой выкладки. Те же расширения и порог, что у сервера (COMPRESSIBLE). В assets.json (own) сжатые не входят:
// следующая сборка переносит только исходные файлы и сжимает их заново
{
  const COMPRESSIBLE = new Set(['.html', '.js', '.mjs', '.css', '.json', '.svg', '.txt']);
  const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(join(dir, d.name)) : [join(dir, d.name)]));
  let n = 0, raw = 0, br = 0;
  const t0 = Date.now();
  for (const file of walk(join(out, 'public'))) {
    const ext = file.slice(file.lastIndexOf('.')).toLowerCase();
    if (!COMPRESSIBLE.has(ext)) continue;
    const body = readFileSync(file);
    if (body.length <= 1024) continue;
    const z = brotliCompressSync(body, { params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 11, [zlibConstants.BROTLI_PARAM_SIZE_HINT]: body.length } });
    writeFileSync(`${file}.br`, z);
    writeFileSync(`${file}.gz`, gzipSync(body, { level: 9 }));
    n++; raw += body.length; br += z.length;
  }
  console.log(`сжато заранее: ${n} файлов, ${(raw / 1048576).toFixed(1)} → ${(br / 1048576).toFixed(1)} МБ (br), ${((Date.now() - t0) / 1000).toFixed(1)} с`);
}

// 2. воркер → CommonJS для Node
run('npx esbuild worker/index.ts --bundle --platform=node --target=node20 --format=cjs --outfile=deploy/bothost/worker.cjs --log-level=warning');
cpSync(join(root, 'worker', 'schema.sql'), join(out, 'schema.sql'));

// 3. история владельца
const tmp = join(root, 'node_modules', '.cache', 'bothost-seed.mjs');
run(`npx esbuild tools/bothost-seed.ts --bundle --platform=node --format=esm --alias:@=./src --outfile=${tmp} --log-level=warning`);
writeFileSync(join(out, 'seed', 'owner.json'), execSync(`node ${tmp}`, { maxBuffer: 64 << 20 }));

// 4. сервер и SQLite: node:sqlite из Node 22 (файл, ЗП-4), запасной — sql.js (WebAssembly: на хостинге
// нечего компилировать) на случай, если хостинг запустит без нашего Dockerfile на Node 20
for (const f of ['index.js', 'd1-sqlite.js', 'd1-sqljs.js', 'backup.js', 'db-thread.js']) cpSync(join(root, 'server', f), join(out, f));
for (const f of ['sql-wasm.js', 'sql-wasm.wasm']) cpSync(join(root, 'node_modules', 'sql.js', 'dist', f), join(out, 'vendor', f));
writeFileSync(join(out, 'package.json'), JSON.stringify({
  name: 'transformative-media-miniapp', version: '0.2.0', private: true, main: 'index.js',
  scripts: { start: 'node index.js' }, engines: { node: '>=20' }, dependencies: {},
}, null, 2) + '\n');
writeFileSync(join(out, 'bothost.json'), JSON.stringify({ main: 'index.js', language: 'nodejs' }) + '\n');
// Свой Dockerfile (в панели: «Запуск → Использовать собственный Dockerfile»). Без него bothost
// запускает рядом заглушку http-wrapper.js на том же PORT («Bot is running»), и она отнимает
// порт у сервера: EADDRINUSE при каждом старте.
writeFileSync(join(out, 'Dockerfile'), [
  'FROM node:22-alpine',
  'WORKDIR /app',
  'COPY . .',
  'ENV NODE_ENV=production',
  'EXPOSE 3000',
  // node:sqlite в Node 22 ещё «экспериментальный» — предупреждение при каждом старте не нужно
  'CMD ["node", "--disable-warning=ExperimentalWarning", "index.js"]',
  '',
].join('\n'));

// 4б. какая это сборка — для /api/version и проверки после выкладки
let commit = 'unknown', dirty = true;
try {
  commit = git('rev-parse HEAD');
  dirty = git('status --porcelain --untracked-files=no').length > 0;
} catch { /* не репозиторий — сборка всё равно годится, но выкладка её не примет */ }
writeFileSync(join(out, 'version.json'), JSON.stringify({ commit, dirty, builtAt: new Date().toISOString() }) + '\n');
console.log(`version.json: ${commit.slice(0, 7)}${dirty ? ' + незакоммиченное' : ''}`);

// 5. архив
const zip = join(root, 'deploy', 'tm-bothost.zip');
if (existsSync(zip)) rmSync(zip);
run(`cd deploy/bothost && zip -qr ../tm-bothost.zip .`);
console.log(`готово: ${zip}, ${(statSync(zip).size / 1048576).toFixed(1)} МБ`);
