// Данные о ролике YouTube для генераторов: название, канал, длительность, дата.
// Два пути: YouTube Data API (`YT_API_KEY`, 50 роликов за запрос, 1 единица квоты) и
// открытый oEmbed без ключа — там нет длительности. К самим каналам не обращаемся.
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

/** Данные роликов пачками по 50 — один запрос на пачку. Сетевой сбой: один повтор через 5 с,
 * потом отдаём то, что успели узнать, и отмечаем `youtubeNet.down` (см. выше). */
export async function videosApi(ids: string[], key: string): Promise<Map<string, VideoMeta>> {
  const out = new Map<string, VideoMeta>();
  for (let i = 0; i < ids.length && !youtubeNet.down; i += 50) {
    const chunk = ids.slice(i, i + 50);
    const qs = new URLSearchParams({ part: 'snippet,contentDetails', id: chunk.join(','), key });
    const url = `https://www.googleapis.com/youtube/v3/videos?${qs}`;
    const r = await fetch(url)
      .catch(() => new Promise((ok) => setTimeout(ok, 5000)).then(() => fetch(url)))
      .catch((e: NetError) => netDown(e, `${ids.length - i} роликов остаются без названия, канала и длительности`));
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
  return out;
}
