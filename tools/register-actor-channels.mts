// Каналы актёров → реестр Telegram-каналов (25.10, слово владельца «добавляем»): актёры src/mocks/actorChannels.ts,
// которых нет в tools/telegram-channels.json. P3789 в Wikidata — имя в Telegram, не обязательно канал: сначала
// открытая лента t.me/s/<имя> (разрешено владельцем 24.10; по одному, пауза 2 с, кэш страниц — вне репозитория).
// Есть лента — канал: в реестр (category creator, sub «актёр»), шлюз подпишется при следующем заборе. Нет — личный
// аккаунт или пустое имя: `none` в .cache/actor-channel-kinds.json, tools/resolve-actor-channels.mts его не ставит.
//   npx tsx tools/register-actor-channels.mts <папка со страницами t.me/s> [--dry]
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { saveTelegram } from './registry-lib.mts';
import { actorChannels } from '../src/mocks/actorChannels.ts';

const [dir] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const DRY = process.argv.includes('--dry');
if (!dir) { console.error('npx tsx tools/register-actor-channels.mts <папка> [--dry]'); process.exit(1); }
const KINDS = '.cache/actor-channel-kinds.json';
const kinds = existsSync(KINDS) ? JSON.parse(readFileSync(KINDS, 'utf8')) as Record<string, 'channel' | 'none'> : {};
const reg = JSON.parse(readFileSync('tools/telegram-channels.json', 'utf8')) as { channels: { username: string }[] } & Record<string, unknown>;
const have = new Set(reg.channels.map((c) => c.username.toLowerCase()));

type Row = { username: string; paths: string[]; category: string; sub: string; note: string };
const add: Row[] = [];
let missing = 0;
for (const [q, a] of Object.entries(actorChannels)) {
  const low = a.h.toLowerCase();
  if (have.has(low) || add.some((r) => r.username.toLowerCase() === low)) continue;
  const file = join(dir, `${a.h}.html`);
  if (!existsSync(file)) { missing++; continue; }
  const html = readFileSync(file, 'utf8');
  const channel = html.includes('tgme_channel_info');
  kinds[low] = channel ? 'channel' : 'none';
  if (!channel) continue;
  const subs = /<span class="counter_value">([^<]+)<\/span>\s*<span class="counter_type">subscribers?<\/span>/.exec(html)?.[1];
  const last = [...html.matchAll(/<time datetime="([0-9-]{10})/g)].map((m) => m[1]).sort().pop();
  add.push({ username: a.h, paths: [`.cache/telegram/${a.h}.json`], category: 'creator', sub: 'актёр',
    note: `канал актёра 25.10 — ${a.n} (${q}, Wikidata P3789; ролей у нас ${a.works.length})${subs ? `, ${subs} подписчиков` : ''}${last ? `, последний пост ${last}` : ''}` });
}
const none = Object.values(kinds).filter((k) => k === 'none').length;
console.log(`каналов актёров в реестр: ${add.length}; без ленты (личный аккаунт или пустое имя): ${none}; страниц нет: ${missing}`);
for (const r of add.slice(0, 15)) console.log(`  @${r.username} · ${r.note}`);
if (!DRY) {
  writeFileSync(KINDS, JSON.stringify(kinds, null, 1));
  if (add.length) console.log(JSON.stringify(await saveTelegram({ ...reg, channels: [...reg.channels, ...add] }, 'register-actor-channels')));
}
