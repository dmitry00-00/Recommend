// Контур Global (ЗП-26, 11.10): то же приложение на Cloudflare Workers + D1 — английская сборка для Индии, США и
// Британии. Данные пользователей — в своей базе D1 (с российским контуром на bothost не пересекаются), справочники — в
// R2, статика — Workers Assets (wrangler.toml, [env.global]).
//
//   node tools/deploy-global.mjs --local    — собрать и поднять у себя (wrangler dev: локальные D1 и R2, демо-вход)
//   node tools/deploy-global.mjs --setup    — один раз: создать в аккаунте D1 и R2, напечатать database_id
//   … --setup --r2-only                     — только R2 (база уже есть)
//   node tools/deploy-global.mjs            — собрать и выложить (`wrangler deploy --env global`)
//   … --no-build                            — без пересборки фронта
//
// Сборка: VITE_API_URL=/ (API на том же адресе), язык — auto (Telegram и браузер, по умолчанию английский),
// регион «где смотреть» — TM_GLOBAL_WATCH_REGION (по умолчанию IN), бот — TM_GLOBAL_BOT_USERNAME. Кинопоиска нет.
// После выкладки: секреты BOT_TOKEN и ADMIN_TOKEN (`npx wrangler secret put … --env global`), справочники —
// `npx tsx tools/publish-reference.mts --global`, бот — `npx tsx tools/tg-webhook.mts --global --set`.
import { execSync, spawn } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const out = join(root, 'deploy', 'global', 'public');
const argv = process.argv.slice(2);
const has = (k) => argv.includes(k);
const run = (cmd, env = {}) => execSync(cmd, { cwd: root, stdio: 'inherit', env: { ...process.env, ...env } });

// .env.local — те же переменные, что у остальных инструментов (TMDb-ключ сборки, имя бота Global)
const envFile = join(root, '.env.local');
const local = existsSync(envFile) ? readFileSync(envFile, 'utf8') : '';
for (const m of local.matchAll(/^([A-Z_][A-Z0-9_]*)=(.*)$/gm)) process.env[m[1]] ??= m[2].trim().replace(/^["']|["']$/g, '');

if (has('--setup')) {
  // облачные ресурсы — только по явной команде владельца
  // по отдельности: R2 включается в панели Cloudflare (ошибка 10042), а база к тому времени уже может быть
  if (!has('--r2-only')) run('npx wrangler d1 create recomend-global');
  run('npx wrangler r2 bucket create recomend-global-reference');
  console.log('\nВпишите database_id из ответа выше в wrangler.toml, [[env.global.d1_databases]].');
  process.exit(0);
}

if (!has('--no-build')) {
  run(`npx tsc -b && npx vite build --outDir ${out} --emptyOutDir`, {
    VITE_API_URL: '/', VITE_DEFAULT_LANG: 'auto', VITE_KP_PROXY: '',
    VITE_WATCH_REGION: process.env.TM_GLOBAL_WATCH_REGION || 'IN',
    VITE_BOT_USERNAME: process.env.TM_GLOBAL_BOT_USERNAME || '',
  });
}
if (!existsSync(join(out, 'index.html'))) { console.error(`нет ${out}/index.html — соберите без --no-build`); process.exit(1); }

// секретов в сборке быть не должно — как у bothost: токены из .env.local проверяем буквально
const secrets = [...local.matchAll(/^(TM_ADMIN_TOKEN|TM_GLOBAL_ADMIN_TOKEN|ADMIN_TOKEN|KP_API_KEY|VITE_KP_API_KEY|BOT_TOKEN|TM_GLOBAL_BOT_TOKEN)=(.+)$/gm)]
  .map((m) => m[2].trim()).filter((s) => s.length >= 16);
const files = (dir) => readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? files(p) : [p]; });
for (const f of files(out)) {
  const text = readFileSync(f, 'latin1');
  if (secrets.some((s) => text.includes(s))) { console.error(`в сборке секрет из .env.local: ${f} — не выкладываю`); process.exit(1); }
}

// схема базы: все команды schema.sql — `IF NOT EXISTS`, прогон безопасен каждый раз; новые колонки добавит migrate.ts
const schema = (where) => run(`npx wrangler d1 execute recomend-global --env global ${where} --file worker/schema.sql --yes`);

if (has('--local')) {
  // своя база и R2 в .wrangler/, вход демо-участником; токен сборщика — для publish-reference --global на localhost
  schema('--local');
  const port = process.env.TM_GLOBAL_LOCAL_PORT || '8788';
  console.log(`Global у себя: http://localhost:${port}`);
  spawn('npx', ['wrangler', 'dev', '--env', 'global', '--local', '--port', port,
    '--var', 'ALLOW_DEMO:1', '--var', `ADMIN_TOKEN:${process.env.TM_GLOBAL_LOCAL_TOKEN || 'local-global-token'}`], { cwd: root, stdio: 'inherit' });
} else {
  const toml = readFileSync(join(root, 'wrangler.toml'), 'utf8');
  if (/database_name = "recomend-global"\s*\n(?:#.*\n)*database_id = "pending"/.test(toml)) {
    console.error('в wrangler.toml нет database_id базы Global — сначала node tools/deploy-global.mjs --setup');
    process.exit(1);
  }
  schema('--remote');
  run('npx wrangler deploy --env global');
}
