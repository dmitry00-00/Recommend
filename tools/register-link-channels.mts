// Каналы роликов, которые владелец принёс ссылками (лист «Без разбора» таблицы разметки →
// tools/markup-verdicts.json), → реестр блогеров src/mocks/sources.ts. Заводятся только новые
// для системы: кого нет ни в реестре, ни среди каналов, которые мы и так обходим. Ярус —
// «обзор» (решение владельца 29.09), пометка `via: 'links'`: загрузки не обходим, в поиск
// карточки не ставим. Ярус владелец меняет прямо в sources.ts по мере разбора; повторный
// прогон уже заведённых не трогает.
//   npx tsx tools/register-link-channels.mts [--dry]      — нужен YT_API_KEY в .env.local
// Квота: единица на 50 роликов и единица на 50 каналов.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { loadEnvFile } from './env-file.mts';
import { sources } from '../src/mocks/sources.ts';
import { excludedChannels } from './youtube-channels.mts';
import { cachedVideos } from './youtube-channels.mts';

loadEnvFile();
const key = process.env.YT_API_KEY;
if (!key) { console.error('нужен YT_API_KEY в .env.local'); process.exit(1); }
const dry = process.argv.includes('--dry');
const API = 'https://www.googleapis.com/youtube/v3';
const get = async <T,>(path: string, params: Record<string, string>): Promise<T> => {
  const r = await fetch(`${API}/${path}?${new URLSearchParams({ ...params, key })}`);
  if (!r.ok) throw new Error(`youtube ${path} ${r.status}`);
  return await r.json() as T;
};

const REGISTRY = new URL('../src/mocks/sources.ts', import.meta.url);
const MARK = '  // ── каналы из ссылок владельца: tools/register-link-channels.mts дописывает сюда ──';

// 1. Ролики из ручной разметки, которых нет в загрузках обходимых каналов
const human = JSON.parse(readFileSync(new URL('./markup-verdicts.json', import.meta.url), 'utf8')).videos as Record<string, { key: string | null; film?: string }>;
const dump = cachedVideos() ?? [];
const crawled = new Set(dump.map((v) => v.channelId).filter(Boolean));
const inDump = new Set(dump.map((v) => v.id));
const ids = Object.entries(human).filter(([id, v]) => v.key && !inDump.has(id)).map(([id]) => id);

// 2. Их каналы: id → сколько роликов и к каким фильмам
const byChannel = new Map<string, { films: Set<string>; videos: number }>();
for (let i = 0; i < ids.length; i += 50) {
  const j = await get<{ items?: { id: string; snippet?: { channelId?: string } }[] }>('videos', { part: 'snippet', id: ids.slice(i, i + 50).join(',') });
  for (const it of j.items ?? []) {
    const ch = it.snippet?.channelId;
    if (!ch || crawled.has(ch)) continue;
    const e = byChannel.get(ch) ?? { films: new Set(), videos: 0 };
    e.videos += 1;
    if (human[it.id]?.film) e.films.add(human[it.id].film!);
    byChannel.set(ch, e);
  }
}

// 3. Название и @handle канала; кто уже в реестре (по handle или названию) — пропускаем
// и убранные владельцем (tools/channels-excluded.json): их не заводим заново
const known = new Set([...sources.flatMap((s) => [s.handle.toLowerCase(), s.title.toLowerCase()]),
  ...excludedChannels().flatMap((e) => [e.handle, e.title, e.channelId].filter(Boolean).map((x) => x!.toLowerCase()))]);
const fresh: { line: string; title: string }[] = [];
const chIds = [...byChannel.keys()];
for (let i = 0; i < chIds.length; i += 50) {
  const j = await get<{ items?: { id: string; snippet?: { title?: string; customUrl?: string } }[] }>('channels', { part: 'snippet', id: chIds.slice(i, i + 50).join(',') });
  for (const it of j.items ?? []) {
    const title = it.snippet?.title?.trim() || it.id;
    const handle = it.snippet?.customUrl?.replace(/^@/, '') || it.id;
    if (known.has(handle.toLowerCase()) || known.has(title.toLowerCase()) || known.has(it.id.toLowerCase())) continue;
    known.add(handle.toLowerCase());
    const e = byChannel.get(it.id)!;
    const url = it.snippet?.customUrl ? `https://www.youtube.com/@${handle}` : `https://www.youtube.com/channel/${it.id}`;
    const films = [...e.films].slice(0, 2).join(', ') + (e.films.size > 2 ? ` и ещё ${e.films.size - 2}` : '');
    const entry = { id: `src-yt-${handle.toLowerCase().replace(/[^a-z0-9а-яё_-]+/gi, '')}`, title, handle, platform: 'youtube', url, role: 'voice', kind: 'channel', tier: 'review', via: 'links' };
    // одинарные кавычки, как во всём файле; с апострофом внутри — двойные (JSON), чтобы не сломать TS
    const q = (v: string) => (/['\\\n]/.test(v) ? JSON.stringify(v) : `'${v}'`);
    const body = Object.entries(entry).map(([k, v]) => `${k}: ${q(v)}`).join(', ');
    fresh.push({ title, line: `  { ${body} }, // ${e.videos} ${e.videos === 1 ? 'ролик' : e.videos < 5 ? 'ролика' : 'роликов'}: ${films}` });
  }
}

console.error(`роликов вне обходимых каналов: ${ids.length}, их каналов: ${byChannel.size}, новых для реестра: ${fresh.length}`);
if (!fresh.length) process.exit(0);
fresh.sort((a, b) => a.title.localeCompare(b.title, 'ru'));
if (dry) { console.log(fresh.map((f) => f.line).join('\n')); process.exit(0); }

let text = readFileSync(REGISTRY, 'utf8');
if (!text.includes(MARK)) {
  // блок в конце массива `sources`: ищем его закрывающую скобку
  const at = text.indexOf('\n];', text.indexOf('export const sources'));
  if (at < 0) { console.error('не нашёл конец массива sources в sources.ts'); process.exit(1); }
  text = `${text.slice(0, at)}\n${MARK}\n  // ярус по умолчанию — обзор; поменять — tier: 'essay'; сделать полноценным голосом — убрать via${text.slice(at)}`;
}
const end = text.indexOf('\n];', text.indexOf(MARK));
text = `${text.slice(0, end)}\n${fresh.map((f) => f.line).join('\n')}${text.slice(end)}`;
if (existsSync(REGISTRY)) writeFileSync(REGISTRY, text);
console.error(`→ src/mocks/sources.ts: +${fresh.length} каналов (ярус «обзор», via: 'links')`);
