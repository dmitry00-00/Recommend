// Каналы из списков владельца (tools/curated-channels.json, 25.10) → реестр Telegram-каналов (tools/telegram-channels.json,
// через registry-lib: в режиме server — правка на сервере, файл — снимок). Шлюз подпишется на них при следующем
// заборе (tools/telegram-pull.mts отправляет ему весь список). Заводятся только новые: кого нет в реестре.
//   люди (people): category creator, кроме `gone` (имени нет) и `stale` (канал заброшен — у человека есть главный);
//     с элементом — к странице человека, без — для счёта и динамики каналов людей кино;
//   остальное (channels): category и sub — как в списке.
//   npx tsx tools/register-curated-channels.mts [--dry]
import { readFileSync } from 'node:fs';
import { saveTelegram } from './registry-lib.mts';

const DRY = process.argv.includes('--dry');
const ROLE: Record<string, string> = { director: 'режиссёр', actor: 'актёр' };

interface Person { h: string; n: string; q?: string; role: string; t?: string; subs?: string; gone?: 1; stale?: 1 }
interface Channel { h: string; category: string; sub: string; t?: string; subs?: string }
const curated = JSON.parse(readFileSync('tools/curated-channels.json', 'utf8')) as { people: Person[]; channels: Channel[] };
const reg = JSON.parse(readFileSync('tools/telegram-channels.json', 'utf8')) as { channels: { username: string }[] } & Record<string, unknown>;
const have = new Set(reg.channels.map((c) => c.username.toLowerCase()));

type Row = { username: string; paths: string[]; category: string; sub?: string; note: string };
const add: Row[] = [];
const seen = new Set<string>();
const push = (h: string, row: Omit<Row, 'username' | 'paths'>) => {
  const low = h.toLowerCase();
  if (have.has(low) || seen.has(low)) return;
  seen.add(low);
  add.push({ username: h, paths: [`.cache/telegram/${h}.json`], ...row });
};
for (const p of curated.people) {
  if (p.gone || p.stale) continue;
  push(p.h, {
    category: 'creator', sub: ROLE[p.role] ?? p.role,
    note: `канал человека, список владельца 25.10 — ${p.n}${p.q ? ` (${p.q})` : ', страницы у нас нет — для счёта'}`,
  });
}
for (const c of curated.channels) push(c.h, { category: c.category, sub: c.sub, note: `список владельца 25.10${c.t ? ` — «${c.t}»` : ''}` });

const by = (k: string) => add.filter((r) => r.category === k).length;
console.log(`новых в реестр: ${add.length} (creator ${by('creator')}, critic ${by('critic')}, picks ${by('picks')}, news ${by('news')}, industry ${by('industry')}, media ${by('media')}); уже в реестре — мимо`);
for (const r of add) console.log(`  @${r.username} · ${r.category} · ${r.note}`);
if (!DRY && add.length) {
  const res = await saveTelegram({ ...reg, channels: [...reg.channels, ...add] }, 'register-curated-channels');
  console.log(JSON.stringify(res));
}
