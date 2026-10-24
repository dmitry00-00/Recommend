// Присланные списки просмотренного (seeds/<ник>.json, см. tools/resolve-seed.mts) → сервер.
// Участник получит их в профиль при следующем входе в приложение. Куда и чем — как у
// tools/publish-reference.mts: TM_SERVER и TM_ADMIN_TOKEN из .env.local.
//   npx tsx tools/publish-seed.mts [ник] [--tg <номер Telegram>] [--release]
// 24.10 (worker/userSeed.ts): список выдаётся только номеру Telegram, за которым ник закреплён. --tg — чей список, если
// номер известен (тогда и первый вход под ником чужому его не даст); --release — явно снять запрет после удаления
// аккаунта или перепривязать ник к другому номеру. Без них сервер отвечает 409 на ник удалившегося или чужой номер.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { loadEnvFile } from './env-file.mts';

loadEnvFile();
const server = (process.env.TM_SERVER ?? 'https://bot-1791394986-4062-dmitriy-00.bothost.tech').replace(/\/+$/, '');
const token = process.env.TM_ADMIN_TOKEN;
if (!token) { console.error('нет TM_ADMIN_TOKEN в .env.local — публиковать нечем'); process.exit(1); }

const DIR = 'seeds';
const args = process.argv.slice(2);
const flag = (name: string) => { const i = args.indexOf(name); return i < 0 ? undefined : args.splice(i, name === '--tg' ? 2 : 1)[1] ?? ''; };
const tg = flag('--tg');
const release = flag('--release') != null;
if (tg != null && !/^[1-9]\d{0,15}$/.test(tg)) { console.error('--tg: номер Telegram цифрами'); process.exit(1); }
const only = args[0]?.replace(/^@/, '').toLowerCase();
if ((tg != null || release) && !only) { console.error('--tg и --release — только для одного ника'); process.exit(1); }
const query = new URLSearchParams({ ...(tg != null ? { tg } : {}), ...(release ? { release: '1' } : {}) }).toString();
const files = existsSync(DIR) ? readdirSync(DIR).filter((f) => f.endsWith('.json') && (!only || f.slice(0, -5).toLowerCase() === only)) : [];
if (!files.length) { console.error('публиковать нечего: сначала tools/resolve-seed.mts'); process.exit(1); }

let failed = 0;
for (const file of files) {
  const name = file.slice(0, -5);
  const body = readFileSync(`${DIR}/${file}`, 'utf8');
  const res = await fetch(`${server}/api/admin/seed/${name}${query ? `?${query}` : ''}`, {
    method: 'PUT', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body,
  }).catch((err: Error) => ({ ok: false, status: 0, statusText: err.message }) as Response);
  if (res.status === 409) {
    failed += 1;
    const e = await res.json().catch(() => ({})) as { error?: string };
    console.log(`@${name}: не принято — ${e.error === 'deleted' ? 'участник удалил аккаунт («чистый лист»)' : 'ник закреплён за другим номером Telegram'}; снять запрет — --release`);
    continue;
  }
  if (!res.ok) { failed += 1; console.log(`@${name}: ошибка ${res.status} ${res.statusText}`); continue; }
  const r = await res.json() as { watched: number; known: boolean; owner?: 'bound' | 'free' };
  console.log(`@${name}: ${r.watched} в списке → на сервере; ${r.known ? 'уже заходил — появится при следующем открытии приложения' : 'ещё не заходил — появится при первом входе'}`
    + `${r.owner === 'bound' ? ' (только своему номеру Telegram)' : r.owner === 'free' ? ' (номер не известен — получит первый вошедший под ником)' : ''}`);
}
process.exit(failed ? 1 : 0);
