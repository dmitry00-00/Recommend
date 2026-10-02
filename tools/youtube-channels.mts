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

/** Что известно о канале: ник из реестра, ярус, предмет, язык. Ключ — id канала. */
export type ChannelMeta = { handle?: string; title: string; tier: 'essay' | 'review'; medium: 'film' | 'book'; via?: 'links'; language?: 'en' };
export const CHANNELS = '.cache/youtube/channels.json';
/** Состояние обхода по каналу (02.10): плейлист загрузок и дошёл ли обход до конца. Дошёл — дальше
 *  читаем плейлист только до первого уже известного ролика: он идёт от новых к старым. */
const UPLOADS = '.cache/youtube/uploads.json';
type UploadsState = Record<string, { uploads?: string; complete?: boolean; at?: string }>;
const readJson = <T,>(file: string, fallback: T): T => {
  try { return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) as T : fallback; } catch { return fallback; }
};
export const channelMeta = (): Record<string, ChannelMeta> => readJson(CHANNELS, {});

/** Каналы, убранные из выборки совсем (tools/channels-excluded.json, 02.10): ни обхода, ни роликов
 *  в выгрузке, ни строки в реестре — пульт ссылок и register-link-channels их заново не заводят. */
export interface Excluded { handle?: string; channelId?: string; title?: string; why?: string }
const EXCLUDED_FILE = new URL('./channels-excluded.json', import.meta.url);
export const excludedChannels = (): Excluded[] => {
  try { return (JSON.parse(readFileSync(EXCLUDED_FILE, 'utf8')).channels ?? []) as Excluded[]; } catch { return []; }
};
/** Убран ли канал: по id, нику или названию (у ролика в индексе есть только название канала). */
export function isExcluded(c: { channelId?: string; handle?: string; title?: string }, list = excludedChannels()): boolean {
  const low = (x?: string) => (x ?? '').trim().toLowerCase().replace(/^@/, '');
  return list.some((e) => (e.channelId && e.channelId === c.channelId) || (e.handle && low(e.handle) === low(c.handle))
    || (e.title && low(e.title) === low(c.title)));
}

/** `links` — обходить и каналы, пришедшие ссылками владельца (`via: 'links'` в sources.ts, 224 на
 *  29.09): их ролики нужны таблице разметки film_reviews (решение владельца 30.09). Индекс
 *  разборов (build-essay-index) обходит только свои каналы — без `links`.
 *
 *  Не спрашиваем уже полученное (02.10): канал по нику и канал известного ролика — из прежних
 *  channels.json и videos.json; плейлист загрузок — из uploads.json; загрузки — до первого
 *  известного ролика; детали (описание, длительность) — только у новых. Первый обход канала —
 *  целиком (до 2 000 роликов), дальше — страница-другая. `full` — пройти всё заново. */
export async function fetchChannelVideos(key: string, log: (s: string) => void = console.error,
  { links = true, full = false }: { links?: boolean; full?: boolean } = {}): Promise<ChannelVideo[]> {
  let calls = 0;
  const get = async <T,>(path: string, params: Record<string, string>): Promise<T | undefined> => {
    calls += 1;
    const r = await fetch(`${API}/${path}?${new URLSearchParams({ ...params, key })}`).catch(() => undefined);
    if (!r?.ok) { log(`  ${path} ${r?.status ?? 'нет сети'}`); return undefined; }
    return await r.json() as T;
  };
  const excluded = excludedChannels();
  const before = (cachedVideos() ?? []).filter((v) => !isExcluded({ channelId: v.channelId, title: v.channel }, excluded));
  const oldMeta = Object.fromEntries(Object.entries(channelMeta()).filter(([id, m]) => !isExcluded({ channelId: id, handle: m.handle, title: m.title }, excluded)));
  const state: UploadsState = full ? {} : readJson(UPLOADS, {});

  // 1. Каналы — из уже известных роликов (src/mocks/essays.ts) и из списка владельца.
  // Ярус канала (эссеист / обзорщик) задаётся в sources.ts по handle, а у ролика есть только
  // channelId — связь между ними знает лишь этот перебор, поэтому её и сохраняем. Название
  // канала для этого не годится: на YouTube он «TerlKabot channel», в списке «TerlKabot»
  const channels = new Map<string, string>();
  const meta = new Map<string, ChannelMeta>();
  const chanOf = new Map(before.filter((v) => v.channelId).map((v) => [v.id, v.channelId!]));
  const known = Object.values(essays).flat();
  const ids = known.map((a) => /v=([A-Za-z0-9_-]{11})/.exec(a.url)?.[1]).filter((x): x is string => Boolean(x));
  const unknownIds: string[] = [];
  for (const id of ids) {
    const c = chanOf.get(id);
    // канал, найденный по уже известному разбору, — из первого круга владельца: там одни
    // эссеисты. Явный ярус из sources.ts ниже это перекроет, если канал есть и там
    if (c && oldMeta[c]) { channels.set(c, oldMeta[c].title); meta.set(c, { title: oldMeta[c].title, tier: 'essay', medium: 'film' }); }
    else unknownIds.push(id);
  }
  for (let i = 0; i < unknownIds.length; i += 50) {
    const j = await get<{ items?: { snippet?: { channelId?: string; channelTitle?: string } }[] }>('videos',
      { part: 'snippet', id: unknownIds.slice(i, i + 50).join(',') });
    for (const it of j?.items ?? []) if (it.snippet?.channelId && !meta.has(it.snippet.channelId) && !isExcluded({ channelId: it.snippet.channelId, title: it.snippet.channelTitle }, excluded)) {
      const title = it.snippet.channelTitle ?? '';
      channels.set(it.snippet.channelId, title);
      meta.set(it.snippet.channelId, { title, tier: 'essay', medium: 'film' });
    }
  }
  // каналы реестра: id по нику — из прежнего channels.json, спрашиваем только новых
  const byHandle = new Map(Object.entries(oldMeta).filter(([, m]) => m.handle).map(([id, m]) => [m.handle!.toLowerCase(), { id, title: m.title }]));
  let askedHandles = 0;
  for (const src of sources.filter((x) => x.platform === 'youtube' && x.role === 'voice' && (!x.via || (links && x.via === 'links')) && !isExcluded({ handle: x.handle, title: x.title }, excluded))) {
    let found = full ? undefined : byHandle.get(src.handle.toLowerCase());
    if (!found) {
      askedHandles += 1;
      const j = await get<{ items?: { id?: string; snippet?: { title?: string } }[] }>('channels', { part: 'snippet', forHandle: `@${src.handle}` });
      const it = j?.items?.[0];
      if (it?.id) found = { id: it.id, title: it.snippet?.title ?? src.title };
    }
    if (found && isExcluded({ channelId: found.id }, excluded)) continue;
    if (found) {
      channels.set(found.id, found.title);
      meta.set(found.id, { handle: src.handle, title: found.title, tier: src.tier ?? (src.via ? 'review' : 'essay'), medium: src.medium ?? 'film', ...(src.via ? { via: src.via } : {}), ...(src.language ? { language: src.language } : {}) });
    } else log(`  ? канал @${src.handle} не нашёлся`);
  }
  if (!meta.size) {
    log('ни один канал не ответил — выгрузку не трогаю, остаётся прежняя');
    return before;
  }
  // каналы из ссылок, когда их не обходим, остаются в списке как были: им нужен ярус в таблице разметки
  const kept = links ? {} : Object.fromEntries(Object.entries(oldMeta).filter(([id, m]) => m.via === 'links' && !meta.has(id)));
  writeFileSync(CHANNELS, JSON.stringify({ ...kept, ...Object.fromEntries(meta) }, null, 1));
  log(`каналов: ${channels.size} (новых ников спрошено ${askedHandles}); обзорщиков ${[...meta.values()].filter((m) => m.tier === 'review').length}, эссеистов ${[...meta.values()].filter((m) => m.tier === 'essay').length}, про книги ${[...meta.values()].filter((m) => m.medium === 'book').length}`);

  // 2. Загрузки: у пройденного до конца канала — до первого уже известного ролика
  const have = new Map<string, Set<string>>();
  for (const v of before) if (v.channelId) (have.get(v.channelId) ?? have.set(v.channelId, new Set()).get(v.channelId)!).add(v.id);
  const fresh: ChannelVideo[] = [];
  let walkedFull = 0;
  for (const [channelId, title] of channels) {
    const st = state[channelId] ?? {};
    if (!st.uploads) {
      const c = await get<{ items?: { contentDetails?: { relatedPlaylists?: { uploads?: string } } }[] }>('channels', { part: 'contentDetails', id: channelId });
      st.uploads = c?.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    }
    if (!st.uploads) continue;
    const seen = have.get(channelId) ?? new Set<string>();
    // канал из прежней выгрузки уже пройден целиком (тем же потолком в 40 страниц) — сразу
    // по-новому; `complete: false` — прошлый полный обход оборвался, повторить
    const incremental = !full && seen.size > 0 && st.complete !== false;
    if (!incremental) walkedFull += 1;
    let page: string | undefined;
    let n = 0, added = 0, failed = false, hit = false;
    do {
      const j = await get<{ items?: { snippet?: { title?: string; publishedAt?: string; resourceId?: { videoId?: string } } }[]; nextPageToken?: string }>(
        'playlistItems', { part: 'snippet', playlistId: st.uploads, maxResults: '50', ...(page ? { pageToken: page } : {}) });
      if (!j) { failed = true; break; }
      for (const it of j.items ?? []) {
        const id = it.snippet?.resourceId?.videoId;
        if (!id || !it.snippet?.title) continue;
        if (seen.has(id)) { hit = true; continue; }
        fresh.push({ id, title: it.snippet.title, publishedAt: it.snippet.publishedAt?.slice(0, 10), channel: title, channelId });
        added += 1;
      }
      page = j.nextPageToken;
      n += 1;
    // 40 страниц = 2 000 роликов; плейлист идёт от новых к старым
    } while (page && n < 40 && !(incremental && hit));
    // до конца (или до потолка, или до известного) и без сбоя — следующий раз только новое
    if (!failed) { st.complete = true; st.at = new Date().toISOString().slice(0, 10); }
    else if (!incremental) st.complete = false;
    state[channelId] = st;
    if (added || !incremental) log(`  ${title}: +${added}${incremental ? '' : ' (весь канал)'}`);
  }

  // 3. Детали — только у новых роликов: полное описание, теги, длительность — пачками по 50
  const byId = new Map<string, ChannelVideo>();
  // прежняя выгрузка остаётся: её каналы — в обходе или в списке (из ссылок без `links`)
  const listed = new Set([...channels.keys(), ...Object.keys(kept)]);
  for (const v of before) if (v.channelId && listed.has(v.channelId)) byId.set(v.id, v);
  const newIds = fresh.map((v) => v.id).filter((id) => !byId.has(id));
  for (const v of fresh) byId.set(v.id, { ...byId.get(v.id), ...v });
  for (let i = 0; i < newIds.length; i += 50) {
    const j = await get<{ items?: { id: string; snippet?: { description?: string; tags?: string[] }; contentDetails?: { duration?: string } }[] }>(
      'videos', { part: 'snippet,contentDetails', id: newIds.slice(i, i + 50).join(',') });
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
  writeFileSync(UPLOADS, JSON.stringify(state));
  log(`роликов ${out.length} (новых ${newIds.length}; каналов целиком ${walkedFull}) → ${CACHE}; запросов к YouTube: ${calls}`);
  return out;
}
