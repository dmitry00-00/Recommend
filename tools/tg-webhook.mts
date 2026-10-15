// Инлайн-режим бота (06.10): куда Telegram шлёт инлайн-запросы. Сервер сам зовёт Telegram своим токеном
// (/api/admin/telegram-webhook, worker/inline.ts) — здесь только TM_SERVER и TM_ADMIN_TOKEN из .env.local.
//   npx tsx tools/tg-webhook.mts           — что стоит сейчас: адрес, ошибки, включён ли инлайн у бота
//   npx tsx tools/tg-webhook.mts --set     — направить инлайн-запросы и сообщения боту (команда /together, 11.10) на
//                                            <TM_SERVER>/api/telegram; заодно бот получает команду в подсказках
//   npx tsx tools/tg-webhook.mts --delete  — снять адрес
// Инлайн-режим включается у бота отдельно, в BotFather: /setinline → подсказка в поле ввода.
//   … --global — то же для бота контура Global (ЗП-26): TM_GLOBAL_SERVER и TM_GLOBAL_ADMIN_TOKEN
import { loadEnvFile } from './env-file.mts';

loadEnvFile();
const global = process.argv.includes('--global');
const server = (global ? process.env.TM_GLOBAL_SERVER ?? '' : process.env.TM_SERVER ?? 'https://bot-1791394986-4062-dmitriy-00.bothost.tech').replace(/\/+$/, '');
const token = global ? process.env.TM_GLOBAL_ADMIN_TOKEN : process.env.TM_ADMIN_TOKEN;
if (!server || !token) { console.error(`нет ${global ? 'TM_GLOBAL_SERVER / TM_GLOBAL_ADMIN_TOKEN' : 'TM_ADMIN_TOKEN'} в .env.local`); process.exit(1); }
const action = process.argv.includes('--set') ? 'set' : process.argv.includes('--delete') ? 'delete' : 'info';
const res = await fetch(`${server}/api/admin/telegram-webhook`, {
  method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
  body: JSON.stringify({ action, ...(action === 'set' ? { url: `${server}/api/telegram` } : {}) }),
});
if (res.status === 404) { console.error('сервер не знает /api/admin/telegram-webhook — залейте свежий архив bothost'); process.exit(1); }
console.log(JSON.stringify(await res.json(), null, 1));
