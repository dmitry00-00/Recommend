// Данные о ролике YouTube для генераторов: название, канал, длительность, дата.
// Два пути: YouTube Data API (`YT_API_KEY`, 50 роликов за запрос, 1 единица квоты) и
// открытый oEmbed без ключа — там нет длительности. К самим каналам не обращаемся.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

export interface VideoMeta { title: string; author: string; durationMinutes?: number; publishedAt?: string }

export const videoId = (url: string): string | undefined =>
  /(?:youtu\.be\/|v=)([A-Za-z0-9_-]{11})/.exec(url)?.[1];

/** ISO 8601 PT#H#M#S → минуты, округлённые вверх: «1 ч 42 мин» честнее, чем «102.3». */
export const minutesOf = (iso: string): number | undefined => {
  const m = /^P(?:\d+D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso);
  if (!m) return undefined;
  const total = Number(m[1] ?? 0) * 60 + Number(m[2] ?? 0) + (Number(m[3] ?? 0) >= 30 ? 1 : 0);
  return total || undefined;
};

/** YouTube не отвечает по сети — не HTTP-ошибка, а обрыв или таймаут соединения (так 29.09 в
 * 06:30 упал весь ночной прогон: `videosApi` бросил исключение из `build-telegram-index`).
 * Отмечается один раз, дальше ни API, ни oEmbed не спрашиваем — иначе каждый ролик ждал бы
 * свои 10 с таймаута. Генератор доделывает работу без данных YouTube, а не падает. */
export const youtubeNet = { down: false };

type NetError = Error & { cause?: { code?: string } };
const netDown = (e: NetError, what: string) => {
  youtubeNet.down = true;
  console.error(`  ВНИМАНИЕ: YouTube не отвечает (${e.cause?.code ?? e.message}) — ${what}`);
  return undefined;
};

export async function oembed(id: string): Promise<VideoMeta | undefined> {
  // без сети (прогон в песочнице, YouTube недоступен) — просто не знаем, а не падаем
  if (youtubeNet.down) return undefined;
  const r = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`)
    .catch((e: NetError) => netDown(e, 'oEmbed больше не спрашиваем'));
  if (!r?.ok) return undefined;
  const j = await r.json().catch(() => ({})) as { title?: string; author_name?: string };
  return j.title ? { title: j.title, author: j.author_name ?? '' } : undefined;
}

/** Что YouTube уже отвечал про ролики — `.cache/youtube/meta.json`, дописывается после каждого
 *  удачного запроса. Нужен в день, когда YouTube не отвечает: длительность ролика не меняется, а
 *  без неё шортсы проходят в индекс, и название осталось бы подписью поста. Второй запасной
 *  источник — дамп каналов разборщиков (`.cache/youtube/videos.json`, tools/youtube-dump.mts),
 *  но роликов по ссылкам из постов в нём мало (30.09: 4 из 88), поэтому главный — кэш. */
const CACHE = new URL('../.cache/youtube/meta.json', import.meta.url);
const DUMP = new URL('../.cache/youtube/videos.json', import.meta.url);
const readJson = <T,>(u: URL, fallback: T): T => {
  try { return existsSync(u) ? JSON.parse(readFileSync(u, 'utf8')) as T : fallback; } catch { return fallback; }
};

function remember(found: Map<string, VideoMeta>): void {
  if (!found.size) return;
  const cache = readJson<Record<string, VideoMeta>>(CACHE, {});
  for (const [id, m] of found) cache[id] = m;
  // кэш — удобство, а не условие: не записался — сегодняшний прогон от этого не страдает
  try { mkdirSync(new URL('.', CACHE), { recursive: true }); writeFileSync(CACHE, JSON.stringify(cache)); } catch { /* пусто */ }
}

/** Что знали про ролики раньше: кэш ответов API, потом дамп каналов. */
export function recalled(ids: string[]): Map<string, VideoMeta> {
  const out = new Map<string, VideoMeta>();
  const cache = readJson<Record<string, VideoMeta>>(CACHE, {});
  let dump: Map<string, { title: string; channel: string; minutes?: number; publishedAt?: string }> | undefined;
  for (const id of ids) {
    if (cache[id]) { out.set(id, cache[id]); continue; }
    dump ??= new Map(readJson<{ id: string; title: string; channel: string; minutes?: number; publishedAt?: string }[]>(DUMP, [])
      .map((v) => [v.id, v]));
    const v = dump.get(id);
    if (v) out.set(id, { title: v.title, author: v.channel, durationMinutes: v.minutes, publishedAt: v.publishedAt });
  }
  return out;
}

/** Данные роликов пачками по 50 — один запрос на пачку. Сетевой сбой: один повтор через 5 с,
 * потом отмечаем `youtubeNet.down` (см. выше) и добираем остальное из кэша и дампа (`recalled`). */
export async function videosApi(ids: string[], key: string): Promise<Map<string, VideoMeta>> {
  const out = new Map<string, VideoMeta>();
  for (let i = 0; i < ids.length && !youtubeNet.down; i += 50) {
    const chunk = ids.slice(i, i + 50);
    const qs = new URLSearchParams({ part: 'snippet,contentDetails', id: chunk.join(','), key });
    const url = `https://www.googleapis.com/youtube/v3/videos?${qs}`;
    const r = await fetch(url)
      .catch(() => new Promise((ok) => setTimeout(ok, 5000)).then(() => fetch(url)))
      .catch((e: NetError) => netDown(e, `API не ответил про ${ids.length - i} роликов, добираем из кэша и дампа`));
    if (!r) break;
    if (!r.ok) { console.error(`  youtube ${r.status}`); continue; }
    const j = await r.json().catch(() => ({})) as { items?: { id: string; snippet?: { title?: string; channelTitle?: string; publishedAt?: string };
      contentDetails?: { duration?: string } }[] };
    for (const it of j.items ?? []) {
      if (!it.snippet?.title) continue;
      out.set(it.id, {
        title: it.snippet.title,
        author: it.snippet.channelTitle ?? '',
        durationMinutes: it.contentDetails?.duration ? minutesOf(it.contentDetails.duration) : undefined,
        publishedAt: it.snippet.publishedAt?.slice(0, 10),
      });
    }
  }
  remember(out);
  if (youtubeNet.down) {
    const missing = ids.filter((id) => !out.has(id));
    const back = recalled(missing);
    for (const [id, m] of back) out.set(id, m);
    console.error(`  из кэша и дампа: ${back.size} из ${missing.length}`);
  }
  return out;
}
