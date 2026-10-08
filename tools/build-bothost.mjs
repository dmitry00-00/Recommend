// Сборка для bothost.ru: фронт + сервер (static, /api, /kp-api) одной папкой и zip-архивом
// для «Загрузить из архива» / «Залить новый архив» в панели.
//
//   npm run build:bothost          → deploy/bothost/ и deploy/tm-bothost.zip
//
// Фронт собирается с VITE_API_URL=/ — API на том же адресе, что и страница. Ключ TMDb
// (VITE_) попадает в сборку, как и раньше; ключ Кинопоиска — нет: его знает только сервер.
import { execSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const out = join(root, 'deploy', 'bothost');
const run = (cmd, env = {}) => execSync(cmd, { stdio: 'inherit', env: { ...process.env, ...env } });

rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'seed'), { recursive: true });
mkdirSync(join(out, 'vendor'), { recursive: true });

// 1. фронт
run('npx tsc -b && npx vite build --outDir deploy/bothost/public --emptyOutDir', { VITE_API_URL: '/', VITE_KP_PROXY: '1' });

// 2. воркер → CommonJS для Node
run('npx esbuild worker/index.ts --bundle --platform=node --target=node20 --format=cjs --outfile=deploy/bothost/worker.cjs --log-level=warning');
cpSync(join(root, 'worker', 'schema.sql'), join(out, 'schema.sql'));

// 3. история владельца
const tmp = join(root, 'node_modules', '.cache', 'bothost-seed.mjs');
run(`npx esbuild tools/bothost-seed.ts --bundle --platform=node --format=esm --alias:@=./src --outfile=${tmp} --log-level=warning`);
writeFileSync(join(out, 'seed', 'owner.json'), execSync(`node ${tmp}`, { maxBuffer: 64 << 20 }));

// 4. сервер и SQLite: node:sqlite из Node 22 (файл, ЗП-4), запасной — sql.js (WebAssembly: на хостинге
// нечего компилировать) на случай, если хостинг запустит без нашего Dockerfile на Node 20
for (const f of ['index.js', 'd1-sqlite.js', 'd1-sqljs.js', 'backup.js']) cpSync(join(root, 'server', f), join(out, f));
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

// 5. архив
const zip = join(root, 'deploy', 'tm-bothost.zip');
if (existsSync(zip)) rmSync(zip);
run(`cd deploy/bothost && zip -qr ../tm-bothost.zip .`);
console.log(`готово: ${zip}`);
