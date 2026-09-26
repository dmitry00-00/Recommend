// Справочник авторов в моки: имена, выходы (ютуб-канал, телеграм-канал, чат) и аватары.
//   npx tsx tools/build-voices.mts
// Руками правится не результат, а `tools/voice-dictionary.ts`. Аватары ютуб-каналов берём
// через YouTube Data API: по образцовому ролику узнаём канал, у канала — картинку и адрес
// (2 единицы квоты на весь прогон). Ключ — `YT_API_KEY` из окружения или `.env.local`;
// значение не печатается. Аватары телеграм-каналов сюда не ходят: их качает
// `python tools/telegram-fetch.py --avatars` в `public/voices/tg-<handle>.jpg` (telethon
// живёт в venv соседнего проекта: ~/recruit/apps/openclaw/.venv/bin/python), здесь мы только
// подставляем готовый файл — свой файл лучше чужой ссылки.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { voiceDictionary, type VoiceEntry } from './voice-dictionary.ts';
import type { Voice, VoiceOutlet } from '../src/types/tmdf.ts';

function loadKey(): string | undefined {
  if (process.env.YT_API_KEY) return process.env.YT_API_KEY;
  if (!existsSync('.env.local')) return undefined;
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = /^\s*YT_API_KEY\s*=\s*(.+?)\s*$/.exec(line);
    if (m) return m[1].replace(/^["']|["']$/g, '');
  }
  return undefined;
}

const key = loadKey();
const API = 'https://www.googleapis.com/youtube/v3';

async function get<T>(path: string, params: Record<string, string>): Promise<T | undefined> {
  if (!key) return undefined;
  const r = await fetch(`${API}/${path}?${new URLSearchParams({ ...params, key })}`);
  if (!r.ok) { console.error(`  ${path}: HTTP ${r.status}`); return undefined; }
  return await r.json() as T;
}

interface ListResponse<T> { items?: T[] }
interface VideoItem { id: string; snippet?: { channelId?: string } }
interface ChannelItem { id: string; snippet?: { title?: string; customUrl?: string; thumbnails?: Record<string, { url?: string }> } }

/** ютуб-канал по образцовому ролику: id, адрес и аватар */
async function youtubeChannels(entries: VoiceEntry[]): Promise<Map<string, { url: string; avatarUrl?: string }>> {
  const out = new Map<string, { url: string; avatarUrl?: string }>();
  const withVideo = entries.filter((e) => e.sampleVideo);
  if (!withVideo.length) return out;
  if (!key) { console.error('YT_API_KEY не найден — аватары ютуб-каналов пропускаем'); return out; }
  const videos = await get<ListResponse<VideoItem>>('videos', { part: 'snippet', id: withVideo.map((e) => e.sampleVideo!).join(',') });
  const channelOf = new Map<string, string>();
  for (const v of videos?.items ?? []) if (v.snippet?.channelId) channelOf.set(v.id, v.snippet.channelId);
  const ids = [...new Set(channelOf.values())];
  if (!ids.length) return out;
  const channels = await get<ListResponse<ChannelItem>>('channels', { part: 'snippet', id: ids.join(',') });
  const byId = new Map<string, ChannelItem>();
  for (const c of channels?.items ?? []) byId.set(c.id, c);
  for (const e of withVideo) {
    const channelId = channelOf.get(e.sampleVideo!);
    const channel = channelId ? byId.get(channelId) : undefined;
    if (!channel) { console.error(`  ${e.title}: канал по ролику не нашёлся`); continue; }
    const thumbs = channel.snippet?.thumbnails ?? {};
    out.set(e.id, {
      url: channel.snippet?.customUrl ? `https://www.youtube.com/${channel.snippet.customUrl}` : `https://www.youtube.com/channel/${channel.id}`,
      avatarUrl: thumbs.medium?.url ?? thumbs.default?.url ?? thumbs.high?.url,
    });
  }
  return out;
}

const yt = await youtubeChannels(voiceDictionary);

function outletsOf(e: VoiceEntry, ytUrl?: string): VoiceOutlet[] {
  const outlets: VoiceOutlet[] = [];
  if (e.youtube) outlets.push({ kind: 'youtube', title: e.youtube, url: ytUrl ?? `https://www.youtube.com/results?search_query=${encodeURIComponent(e.youtube)}` });
  if (e.telegram) outlets.push({ kind: 'telegram', title: e.title, url: `https://t.me/${e.telegram}` });
  // чат без публичного имени ссылки не имеет: обсуждение открывается комментариями под постом
  if (e.chat?.username) outlets.push({ kind: 'chat', title: e.chat.title, url: `https://t.me/${e.chat.username}` });
  return outlets;
}

/** Аватар ютуб-канала кладём к себе: в карточке иконка показывается всегда, а ссылка на
 *  yt3.ggpht.com — это запрос к Google на каждый показ и чужая доступность. */
async function saveAvatar(id: string, url: string): Promise<string | undefined> {
  const dest = `public/voices/yt-${id}.jpg`;
  if (existsSync(dest)) return `./voices/yt-${id}.jpg`;
  const r = await fetch(url);
  if (!r.ok) { console.error(`  ${id}: аватар не скачался (HTTP ${r.status})`); return undefined; }
  mkdirSync('public/voices', { recursive: true });
  writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
  return `./voices/yt-${id}.jpg`;
}

const voices: Voice[] = [];
const keys: Record<string, string> = {};
for (const e of voiceDictionary) {
  const channel = yt.get(e.id);
  // свой файл лучше чужой ссылки: аватар телеграм-канала лежит у нас, ютубовский — на
  // yt3.ggpht.com, и каждый показ карточки идёт к Google
  const local = e.telegram ? `voices/tg-${e.telegram}.jpg` : undefined;
  const avatarUrl = local && existsSync(`public/${local}`)
    ? `./${local}`
    : channel?.avatarUrl ? await saveAvatar(e.id, channel.avatarUrl) : undefined;
  voices.push({
    id: e.id,
    title: e.title,
    short: e.short,
    role: e.role,
    avatarUrl,
    outlets: outletsOf(e, channel?.url),
  });
  if (e.youtube) keys[`yt:${e.youtube}`] = e.id;
  if (e.telegram) keys[`tg:${e.telegram}`] = e.id;
  for (const alias of e.aliases ?? []) keys[`yt:${alias}`] = e.id;
}

const head = `// Сгенерировано tools/build-voices.mts (${new Date().toISOString().slice(0, 10)}) из
// tools/voice-dictionary.ts: авторы разборов как лица, а не строки в поле \`author\`.
// Аватары ютуб-каналов — YouTube Data API, телеграмовские — файлы в public/voices.
// Ключи привязки: «yt:<название канала>» и «tg:<handle>».
// Не править руками — перегенерировать.
import type { Voice } from '@/types/tmdf';

`;
writeFileSync('src/mocks/voices.ts',
  head +
  `export const voices: Voice[] = ${JSON.stringify(voices, null, 2)};\n\n` +
  `export const voiceKeys: Record<string, string> = ${JSON.stringify(keys, null, 2)};\n`);

const withAvatar = voices.filter((v) => v.avatarUrl).length;
const chats = voiceDictionary.filter((e) => e.chat).length;
console.log(`→ src/mocks/voices.ts: ${voices.length} авторов, аватаров ${withAvatar}, чатов ${chats}`);
console.log(`авторов: ${voices.filter((v) => v.role === 'author').length} | площадок: ${voices.filter((v) => v.role === 'platform').length} | студий: ${voices.filter((v) => v.role === 'studio').length}`);
