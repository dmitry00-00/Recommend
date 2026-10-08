// Инлайн-режим бота (06.10): куда Telegram шлёт инлайн-запросы. Сервер сам зовёт Telegram своим токеном
// (/api/admin/telegram-webhook, worker/inline.ts) — здесь только TM_SERVER и TM_ADMIN_TOKEN из .env.local.
//   npx tsx tools/tg-webhook.mts           — что стоит сейчас: адрес, ошибки, включён ли инлайн у бота
//   npx tsx tools/tg-webhook.mts --set     — направить инлайн-запросы на <TM_SERVER>/api/telegram
//   npx tsx tools/tg-webhook.mts --delete  — снять адрес
// Инлайн-режим включается у бота отдельно, в BotFather: /setinline → подсказка в поле ввода.
import { loadEnvFile } from './env-file.mts';

loadEnvFile();
const server = (process.env.TM_SERVER ?? 'https://bot-1791394986-4062-dmitriy-00.bothost.tech').replace(/\/+$/, '');
const token = process.env.TM_ADMIN_TOKEN;
if (!token) { console.error('нет TM_ADMIN_TOKEN в .env.local'); process.exit(1); }
const action = process.argv.includes('--set') ? 'set' : process.argv.includes('--delete') ? 'delete' : 'info';
const res = await fetch(`${server}/api/admin/telegram-webhook`, {
  method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
  body: JSON.stringify({ action, ...(action === 'set' ? { url: `${server}/api/telegram` } : {}) }),
});
if (res.status === 404) { console.error('сервер не знает /api/admin/telegram-webhook — залейте свежий архив bothost'); process.exit(1); }
console.log(JSON.stringify(await res.json(), null, 1));
