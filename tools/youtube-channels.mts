// Загрузки YouTube-каналов, чьи разборы мы показываем: все ролики с полным описанием, тегами
// и длительностью. Нужны и индексу разборов (tools/build-essay-index.mts), и разметке
// (data/labels/essays.json): размечают ролик по названию и описанию, поэтому описание берём
// целиком, а не первые 600 знаков, как раньше. Результат кэшируется в .cache/youtube/videos.json —
// без ключа и сети индекс собирается из кэша.
// Квота: ~1 единица на 50 роликов (плейлист) + 1 на 50 (детали) — на 2 тысячи роликов около 80.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { essays } from '../src/mocks/essays.ts';
import { sources } from '../src/mocks/sources.ts';
import { minutesOf } from './youtube.mts';

export interface ChannelVideo {
  id: string;
  title: string;
  description?: string;
  tags?: string[];
  publishedAt?: string;
  channel: string;
  channelId?: string;
  minutes?: number;
}

export const CACHE = '.cache/youtube/videos.json';
const API = 'https://www.googleapis.com/youtube/v3';

export function cachedVideos(): ChannelVideo[] | undefined {
  if (!existsSync(CACHE)) return undefined;
  try { return JSON.parse(readFileSync(CACHE, 'utf8')) as ChannelVideo[]; } catch { return undefined; }
}

export async function fetchChannelVideos(key: string, log: (s: string) => void = console.error): Promise<ChannelVideo[]> {
  const get = async <T,>(path: string, params: Record<string, string>): Promise<T | undefined> => {
    const r = await fetch(`${API}/${path}?${new URLSearchParams({ ...params, key })}`).catch(() => undefined);
    if (!r?.ok) { log(`  ${path} ${r?.status ?? 'нет сети'}`); return undefined; }
    return await r.json() as T;
  };

  // 1. Каналы — из уже известных роликов (src/mocks/essays.ts) и из списка владельца
  const known = Object.values(essays).flat();
  const ids = known.map((a) => /v=([A-Za-z0-9_-]{11})/.exec(a.url)?.[1]).filter((x): x is string => Boolean(x));
  const channels = new Map<string, string>();
  // ярус канала (эссеист / обзорщик) задаётся в sources.ts по handle, а у ролика есть только
  // channelId — связь между ними знает лишь этот перебор, поэтому её и сохраняем. Название
  // канала для этого не годится: на YouTube он «TerlKabot channel», в списке «TerlKabot»
  const meta = new Map<string, { handle?: string; title: string; tier: 'essay' | 'review'; medium: 'film' | 'book' }>();
  for (let i = 0; i < ids.length; i += 50) {
    const j = await get<{ items?: { snippet?: { channelId?: string; channelTitle?: string } }[] }>('videos',
      { part: 'snippet', id: ids.slice(i, i + 50).join(',') });
    for (const it of j?.items ?? []) if (it.snippet?.channelId) {
      const title = it.snippet.channelTitle ?? '';
      channels.set(it.snippet.channelId, title);
      // канал, найденный по уже известному разбору, — из первого круга владельца: там одни
      // эссеисты. Явный ярус из sources.ts ниже это перекроет, если канал есть и там
      meta.set(it.snippet.channelId, { title, tier: 'essay', medium: 'film' });
    }
  }
  for (const src of sources.filter((x) => x.platform === 'youtube' && x.role === 'voice')) {
    const j = await get<{ items?: { id?: string; snippet?: { title?: string } }[] }>('channels', { part: 'snippet', forHandle: `@${src.handle}` });
    const it = j?.items?.[0];
    if (it?.id) {
      channels.set(it.id, it.snippet?.title ?? src.title);
      meta.set(it.id, { handle: src.handle, title: it.snippet?.title ?? src.title, tier: src.tier ?? 'essay', medium: src.medium ?? 'film' });
    } else log(`  ? канал @${src.handle} не нашёлся`);
  }
  writeFileSync(new URL('../.cache/youtube/channels.json', import.meta.url), JSON.stringify(Object.fromEntries(meta), null, 1));
  log(`каналы: ${[...channels.values()].join(', ')}`);
  log(`  из них обзорщиков ${[...meta.values()].filter((m) => m.tier === 'review').length}, эссеистов ${[...meta.values()].filter((m) => m.tier === 'essay').length}, про книги ${[...meta.values()].filter((m) => m.medium === 'book').length}`);

  // 2. Все загрузки каждого канала
  const videos: ChannelVideo[] = [];
  for (const [channelId, title] of channels) {
    const c = await get<{ items?: { contentDetails?: { relatedPlaylists?: { uploads?: string } } }[] }>('channels', { part: 'contentDetails', id: channelId });
    const uploads = c?.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (!uploads) continue;
    let page: string | undefined;
    let n = 0;
    do {
      const j = await get<{ items?: { snippet?: { title?: string; publishedAt?: string; resourceId?: { videoId?: string } } }[]; nextPageToken?: string }>(
        'playlistItems', { part: 'snippet', playlistId: uploads, maxResults: '50', ...(page ? { pageToken: page } : {}) });
      for (const it of j?.items ?? []) {
        const id = it.snippet?.resourceId?.videoId;
        if (id && it.snippet?.title) videos.push({ id, title: it.snippet.title, publishedAt: it.snippet.publishedAt?.slice(0, 10), channel: title, channelId });
      }
      page = j?.nextPageToken;
      n += 1;
    } while (page && n < 40);
    log(`  ${title}: ${videos.filter((v) => v.channelId === channelId).length}`);
  }

  // 3. Детали: полное описание, теги, длительность — пачками по 50
  const byId = new Map(videos.map((v) => [v.id, v]));
  const all = [...byId.keys()];
  for (let i = 0; i < all.length; i += 50) {
    const j = await get<{ items?: { id: string; snippet?: { description?: string; tags?: string[] }; contentDetails?: { duration?: string } }[] }>(
      'videos', { part: 'snippet,contentDetails', id: all.slice(i, i + 50).join(',') });
    for (const it of j?.items ?? []) {
      const v = byId.get(it.id);
      if (!v) continue;
      if (it.snippet?.description) v.description = it.snippet.description.slice(0, 2500);
      if (it.snippet?.tags?.length) v.tags = it.snippet.tags.slice(0, 20);
      const m = it.contentDetails?.duration ? minutesOf(it.contentDetails.duration) : undefined;
      if (m) v.minutes = m;
    }
  }
  const out = [...byId.values()];
  mkdirSync('.cache/youtube', { recursive: true });
  writeFileSync(CACHE, JSON.stringify(out));
  log(`роликов ${out.length} → ${CACHE}`);
  return out;
}
