// Очередь заявок участников: «нет такого фильма», «добавьте этого автора».
//   npx tsx tools/suggestions.mts [--json]
// Берёт их с сервера по токену администратора (TM_SERVER и TM_ADMIN_TOKEN из .env.local) —
// в приложении заявки не показываются никому: это внутренняя очередь, а не лента.
// В каталог заявка сама не попадает. Фильм заводится через справочник, автор — строкой
// в src/mocks/sources.ts: и то и другое руками, потому что чужому вводу справочник не верит.
import { loadEnvFile } from './env-file.mts';

loadEnvFile();
const server = process.env.TM_SERVER?.replace(/\/+$/, '');
const token = process.env.TM_ADMIN_TOKEN;
if (!server || !token) { console.error('нужны TM_SERVER и TM_ADMIN_TOKEN в .env.local'); process.exit(1); }

const r = await fetch(`${server}/api/admin/suggestions`, { headers: { Authorization: `Bearer ${token}` } });
if (!r.ok) { console.error(`сервер ответил ${r.status}`); process.exit(1); }
const { items } = await r.json() as {
  items: { id: string; kind: 'work' | 'voice'; title: string; note?: string; context?: string; at: string; username?: string; first_name?: string }[];
};

if (process.argv.includes('--json')) { console.log(JSON.stringify(items, null, 1)); process.exit(0); }

const films = items.filter((i) => i.kind === 'work');
const voices = items.filter((i) => i.kind === 'voice');
console.log(`заявок ${items.length}: фильмов ${films.length}, авторов ${voices.length}\n`);
const who = (i: typeof items[number]) => i.username ? `@${i.username}` : i.first_name ?? '—';
for (const [name, list] of [['Фильмы', films], ['Авторы', voices]] as const) {
  if (!list.length) continue;
  console.log(`## ${name}`);
  for (const i of list) {
    console.log(`  ${i.at.slice(0, 10)}  ${i.title}${i.note ? `  — ${i.note}` : ''}`);
    console.log(`      ${who(i)}${i.context ? `, ${i.context}` : ''}`);
  }
  console.log('');
}
