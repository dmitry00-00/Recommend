// Выкладка на bothost через GitHub (07.10): собранный deploy/bothost/ — в ветку `bothost` репозитория,
// откуда его забирает бот (в панели: источник GitHub, ветка bothost). В корне ветки — index.js, package.json
// без "type": "module", worker.cjs, public/ — то же, что в tm-bothost.zip.
// Ветка — один коммит, перезаписывается каждый раз: сборка весит ~20 МБ, копить её в истории незачем.
//
//   npm run deploy:github            — собрать (npm run build:bothost) и отправить
//   npm run deploy:github -- --no-build   — отправить уже собранное
//
// Ключей в сборке нет: ключ Кинопоиска и токены — только в переменных бота. Ключ TMDb (VITE_) есть —
// он и так открыт в браузере каждого, кто открыл приложение.
import { execSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = process.cwd();
const out = join(root, 'deploy', 'bothost');
const BRANCH = process.env.TM_DEPLOY_BRANCH ?? 'bothost';
const sh = (cmd, cwd = root) => execSync(cmd, { cwd, stdio: ['ignore', 'pipe', 'inherit'] }).toString().trim();

if (!process.argv.includes('--no-build')) execSync('npm run build:bothost', { cwd: root, stdio: 'inherit' });
if (!existsSync(join(out, 'index.js'))) { console.error('нет deploy/bothost/index.js — сначала npm run build:bothost'); process.exit(1); }

// секретов в сборке быть не должно: токен админа и ключ Кинопоиска из .env.local — проверяем буквально
const env = existsSync(join(root, '.env.local')) ? readFileSync(join(root, '.env.local'), 'utf8') : '';
const secrets = [...env.matchAll(/^(TM_ADMIN_TOKEN|ADMIN_TOKEN|KP_API_KEY|VITE_KP_API_KEY|BOT_TOKEN)=(.+)$/gm)].map((m) => m[2].trim()).filter((s) => s.length >= 16);
const files = (dir) => readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? files(p) : [p]; });
for (const f of files(out)) {
  const text = readFileSync(f, 'latin1');
  if (secrets.some((s) => text.includes(s))) { console.error(`в сборке секрет из .env.local: ${f} — не отправляю`); process.exit(1); }
}

const remote = sh('git remote get-url origin');
const source = sh('git rev-parse --short HEAD');
const dirty = sh('git status --porcelain').length > 0;
const tmp = mkdtempSync(join(tmpdir(), 'tm-deploy-'));
try {
  cpSync(out, tmp, { recursive: true });
  sh('git init -q -b ' + BRANCH, tmp);
  sh('git add -A', tmp);
  const msg = `bothost: сборка ${new Date().toISOString().slice(0, 16).replace('T', ' ')} из ${source}${dirty ? ' + незакоммиченное' : ''}`;
  sh(`git -c user.name="$(git -C '${root}' config user.name)" -c user.email="$(git -C '${root}' config user.email)" commit -q -m ${JSON.stringify(msg)}`, tmp);
  execSync(`git push -f ${JSON.stringify(remote)} HEAD:${BRANCH}`, { cwd: tmp, stdio: 'inherit' });
  console.log(`→ ${remote} ветка ${BRANCH}: ${msg}`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
