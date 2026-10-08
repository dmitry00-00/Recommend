// Решения владельца с телефона (экран «Разметка» в приложении, 06.10) — с сервера в файлы решений:
// привязки — в tools/markup-verdicts.json (`from: 'phone'`, тем же кодом, что вкладка «Проверка»),
// рубрики — в tools/lens-verdicts.json (тем же кодом, что вкладка «Рубрики», с выгрузкой в приложение).
//   npx tsx tools/owner-pull.mts [--dry]
// Сервер и токен — TM_SERVER и TM_ADMIN_TOKEN из .env.local. Что уже применено — .cache/owner-pull.json
// (решение по ролику с тем же временем второй раз не применяется; новое — заменяет прежнее).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { loadEnvFile } from './env-file.mts';

loadEnvFile();
const DRY = process.argv.includes('--dry');
const STATE = new URL('../.cache/owner-pull.json', import.meta.url);
const server = (process.env.TM_SERVER ?? 'https://bot-1791394986-4062-dmitriy-00.bothost.tech').replace(/\/+$/, '');
const token = process.env.TM_ADMIN_TOKEN;
if (!token) { console.error('нет TM_ADMIN_TOKEN в .env.local — забрать нечем'); process.exit(1); }

type Item = { kind: 'check' | 'lens'; id: string; at: string; clear?: boolean; action?: string; film?: string; also?: string | string[]; lens?: string };
const r = await fetch(`${server}/api/admin/owner-decisions`, { headers: { authorization: `Bearer ${token}` } });
if (!r.ok) { console.error(`сервер ответил ${r.status}: ${(await r.text()).slice(0, 200)}`); process.exit(1); }
const { items } = await r.json() as { items: Item[] };

const applied: Record<string, string> = existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf8')) : {};
const fresh = items.filter((x) => applied[`${x.kind}:${x.id}`] !== x.at);
console.log(`решений на сервере ${items.length}, новых ${fresh.length}`);
if (DRY || !fresh.length) { for (const x of fresh.slice(0, 20)) console.log(' ', x.kind, x.id, x.clear ? 'снять' : x.action ?? x.lens, x.film ?? x.also ?? ''); process.exit(0); }

// пульт поднимает справочник и очередь (несколько секунд) — только когда есть что применять
const { decide } = await import('./check-desk.mts');
const { verdict } = await import('./lens-desk.mts');
const tally: Record<string, number> = {};
const errors: string[] = [];
for (const x of fresh) {
  let ok: boolean, error = '';
  if (x.kind === 'check') {
    const res = await decide({ id: x.id, action: (x.clear ? 'clear' : x.action) as never, ...(x.film ? { film: x.film } : {}), ...(Array.isArray(x.also) ? { also: x.also } : {}) }, 'phone');
    ok = res.ok; if (!res.ok) error = res.error;
  } else {
    const res = await verdict({ id: x.id, ...(x.clear ? { clear: true } : { lens: x.lens, also: typeof x.also === 'string' ? x.also : null }) });
    ok = 'ok' in res; if (!ok) error = (res as { error: string }).error;
  }
  const k = `${x.kind}:${x.clear ? 'снять' : x.kind === 'check' ? x.action : 'рубрика'}`;
  if (ok) { tally[k] = (tally[k] ?? 0) + 1; applied[`${x.kind}:${x.id}`] = x.at; } else errors.push(`${x.kind} ${x.id}: ${error}`);
}
mkdirSync(new URL('../.cache/', import.meta.url), { recursive: true });
writeFileSync(STATE, JSON.stringify(applied, null, 1));
console.log(Object.entries(tally).map(([k, n]) => `${k} ${n}`).join(', ') || 'ничего не применено');
if (errors.length) console.log(`не применилось (${errors.length}): ${errors.slice(0, 10).join('; ')}`);
