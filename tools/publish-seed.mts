// Присланные списки просмотренного (seeds/<ник>.json, см. tools/resolve-seed.mts) → сервер.
// Участник получит их в профиль при следующем входе в приложение. Куда и чем — как у
// tools/publish-reference.mts: TM_SERVER и TM_ADMIN_TOKEN из .env.local.
//   npx tsx tools/publish-seed.mts [ник]
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { loadEnvFile } from './env-file.mts';

loadEnvFile();
const server = (process.env.TM_SERVER ?? 'https://recomend.bothost.tech').replace(/\/+$/, '');
const token = process.env.TM_ADMIN_TOKEN;
if (!token) { console.error('нет TM_ADMIN_TOKEN в .env.local — публиковать нечем'); process.exit(1); }

const DIR = 'seeds';
const only = process.argv[2]?.replace(/^@/, '').toLowerCase();
const files = existsSync(DIR) ? readdirSync(DIR).filter((f) => f.endsWith('.json') && (!only || f.slice(0, -5).toLowerCase() === only)) : [];
if (!files.length) { console.error('публиковать нечего: сначала tools/resolve-seed.mts'); process.exit(1); }

let failed = 0;
for (const file of files) {
  const name = file.slice(0, -5);
  const body = readFileSync(`${DIR}/${file}`, 'utf8');
  const res = await fetch(`${server}/api/admin/seed/${name}`, {
    method: 'PUT', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body,
  }).catch((err: Error) => ({ ok: false, status: 0, statusText: err.message }) as Response);
  if (!res.ok) { failed += 1; console.log(`@${name}: ошибка ${res.status} ${res.statusText}`); continue; }
  const r = await res.json() as { watched: number; known: boolean };
  console.log(`@${name}: ${r.watched} в списке → на сервере; ${r.known ? 'уже заходил — появится при следующем открытии приложения' : 'ещё не заходил — появится при первом входе'}`);
}
process.exit(failed ? 1 : 0);
