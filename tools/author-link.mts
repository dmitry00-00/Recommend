// Ссылка на страницу автора для партнёрства с каналами (23.10): автор публикует у себя ссылку на свои разборы в
// приложении. Печатает `https://t.me/<бот>?startapp=v-<id>--s<метка>` и сколько его разборов сейчас в данных
// приложения — чтобы не отдать ссылку на пустую страницу. Лёгкий: без vite, только чтение src/mocks и .cache.
//   npx tsx tools/author-link.mts <канал> [--label tg_<канал>_v]
// <канал> — @handle, t.me/handle или id из справочника (src/mocks/voices.ts). Метка — [a-z0-9_]{1,24}, по умолчанию
// tg_<handle>_v (обрезается до 24); её запишет сервер в user.source (worker/invite.ts), воронка считает по ней.
// Счёт — по локальным копиям src/mocks (сервер может отдавать данные свежее); разборы с вердиктом «про другое» и
// фильмы, которых нет в справочнике, приложение ещё отсеет — на странице может быть чуть меньше.
import { existsSync, readFileSync } from 'node:fs';
import { voices, voiceKeys } from '../src/mocks/voices.ts';

const BOT = process.env.VITE_BOT_USERNAME || 'recomend_media_bot';
const args = process.argv.slice(2);
const at = args.indexOf('--label');
const label = at >= 0 ? args[at + 1] : undefined;
const raw = args.find((a, i) => !a.startsWith('--') && (at < 0 || i !== at + 1));
if (!raw) { console.error('нужен канал: npx tsx tools/author-link.mts <@канал | id> [--label tg_<канал>_v]'); process.exit(1); }
const input = raw.replace(/^https?:\/\/t\.me\/(?:s\/)?/i, '').replace(/^@/, '').replace(/\/+$/, '');
if (!/^[A-Za-z0-9_]{2,32}$/.test(input)) { console.error(`не похоже на канал или id: ${raw}`); process.exit(1); }

// автор из справочника: по id или по handle его канала в Telegram (как в VoiceScreen — регистр не важен)
const byHandle = new Map(Object.entries(voiceKeys).filter(([k]) => k.startsWith('tg:')).map(([k, v]) => [k.slice(3).toLowerCase(), v]));
const voice = voices.find((v) => v.id === input) ?? voices.find((v) => v.id === byHandle.get(input.toLowerCase()));
const handles = voice
  ? Object.entries(voiceKeys).filter(([k, v]) => v === voice.id && k.startsWith('tg:')).map(([k]) => k.slice(3))
  : [input];
const id = voice?.id ?? input;

const tag = (label ?? `tg_${(handles[0] ?? id).toLowerCase()}_v`).slice(0, 24);
if (!/^[a-z0-9_]{1,24}$/.test(tag)) { console.error(`метка — только [a-z0-9_], до 24 знаков: ${tag}`); process.exit(1); }
const param = `v-${id}--s${tag}`;
if (param.length > 64) { console.error(`параметр длиннее 64 знаков, Telegram не примет: ${param}`); process.exit(1); }

// разборы: те же три источника, что у страницы автора (getVoiceWorks); ключ автора — как voiceKeyOf в src/lib/voices.ts
type A = { id: string; author: string; url: string };
const load = (file: string): Record<string, A[]> => {
  const text = readFileSync(new URL(`../src/mocks/${file}`, import.meta.url), 'utf8');
  return JSON.parse(text.slice(text.indexOf('= {') + 2, text.lastIndexOf('}') + 1));
};
const keyOf = (a: A) => { const h = /^tg-([^-]+)-/.exec(a.id)?.[1]; return h ? `tg:${h}` : `yt:${a.author}`; };
const lower = new Set(handles.map((h) => h.toLowerCase()));
const mine = (a: A) => {
  const key = keyOf(a);
  if (voice) return voiceKeys[key] === voice.id;
  return key.startsWith('tg:') && lower.has(key.slice(3).toLowerCase());
};
const urls = new Set<string>();
const works = new Set<string>();
for (const file of ['essays.ts', 'essaysAuto.ts', 'postsAuto.ts']) {
  for (const [key, list] of Object.entries(load(file))) for (const a of list) if (mine(a)) { urls.add(a.url); works.add(key); }
}

// выемка канала: собраны ли посты вообще (без неё привязывать нечего)
const fetched = handles.map((h) => {
  const path = `.cache/telegram/${h}.json`;
  if (!existsSync(path)) return `@${h}: выемки нет (${path})`;
  try { return `@${h}: в выемке ${(JSON.parse(readFileSync(path, 'utf8')) as { posts?: unknown[] }).posts?.length ?? 0} постов`; }
  catch { return `@${h}: выемка не читается`; }
});

console.log(`https://t.me/${BOT}?startapp=${param}`);
console.log(`автор: ${voice ? `${voice.title} (id ${voice.id})` : 'нет в справочнике'}`);
console.log(`разборов: ${urls.size}, произведений: ${works.size}`);
for (const line of fetched) console.log(line);
if (!voice) {
  // 23.10: канал вне справочника со своими постами страница показывает сама (getVoiceWorks, `tg:<ник>`) — без аватара,
  // имя из реестра каналов или ник; без постов — «Такого автора нет»
  const posts = ['essaysAuto.ts', 'postsAuto.ts'].some((f) => Object.values(load(f)).some((l) => l.some(mine)));
  console.log(posts ? 'автора нет в справочнике: страница по нику — без аватара, имя из реестра каналов или ник'
    : 'страница покажет «Такого автора нет»: постов канала в данных нет');
  console.log('свой аватар и выходы — добавить автора в tools/voice-dictionary.ts и пересобрать src/mocks/voices.ts');
  console.log('(npx tsx tools/build-voices.mts); ссылка с handle останется той же');
} else if (!works.size) console.log('страница пустая: «Пока ничего» — давать ссылку рано');
