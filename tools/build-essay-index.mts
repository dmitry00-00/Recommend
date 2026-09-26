// Индекс разборов по каналам: что эти авторы вообще разбирали и к каким нашим фильмам это
// привязывается.  YT_API_KEY=… TMDB_API_KEY=… npx tsx tools/build-essay-index.mts
// Каналы берём из уже известных роликов (src/mocks/essays.ts) и из списка владельца
// (src/mocks/sources.ts, `platform: 'youtube'`) — это ровно те, кого он читает. У канала спрашиваем плейлист загрузок и проходим его постранично (1 единица квоты
// на 50 роликов), названия сопоставляем с названиями наших произведений. Сопоставление по
// названию — догадка, поэтому результат лежит отдельно от присланного вручную и помечен как
// непроверенный: подтверждать его должна кураторская.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { essays } from '../src/mocks/essays.ts';
import { sources } from '../src/mocks/sources.ts';
import { ADAPTATION, nameMatch } from './title-match.mts';
import { worksIndex } from './works-index.mts';
import { evidenceFor } from './evidence.mts';
import type { ExternalAnalysis } from '../src/types/tmdf.ts';

const key = process.env.YT_API_KEY;
if (!key) { console.error('нужен YT_API_KEY'); process.exit(1); }
const API = 'https://www.googleapis.com/youtube/v3';
const get = async <T>(path: string, params: Record<string, string>): Promise<T | undefined> => {
  const r = await fetch(`${API}/${path}?${new URLSearchParams({ ...params, key })}`);
  if (!r.ok) { console.error(`  ${path} ${r.status}`); return undefined; }
  return await r.json() as T;
};

// 1. Каналы — из роликов, которые уже есть.
const known = Object.values(essays).flat();
const ids = known.map((a) => /v=([A-Za-z0-9_-]{11})/.exec(a.url)?.[1]).filter((x): x is string => Boolean(x));
const channels = new Map<string, string>();
for (let i = 0; i < ids.length; i += 50) {
  const j = await get<{ items?: { snippet?: { channelId?: string; channelTitle?: string } }[] }>('videos',
    { part: 'snippet', id: ids.slice(i, i + 50).join(',') });
  for (const it of j?.items ?? []) if (it.snippet?.channelId) channels.set(it.snippet.channelId, it.snippet.channelTitle ?? '');
}
// и каналы из списка владельца (src/mocks/sources.ts) — те, чьих роликов у нас ещё нет
for (const src of sources.filter((x) => x.platform === 'youtube' && x.role === 'voice')) {
  const j = await get<{ items?: { id?: string; snippet?: { title?: string } }[] }>('channels',
    { part: 'snippet', forHandle: `@${src.handle}` });
  const it = j?.items?.[0];
  if (it?.id) channels.set(it.id, it.snippet?.title ?? src.title);
  else console.error(`  ? канал @${src.handle} не нашёлся`);
}
console.error(`каналы: ${[...channels.values()].join(', ')}`);

// 2. Все загрузки каждого канала.
interface Video { id: string; title: string; description?: string; publishedAt?: string; channel: string }
const videos: Video[] = [];
for (const [id, title] of channels) {
  const c = await get<{ items?: { contentDetails?: { relatedPlaylists?: { uploads?: string } } }[] }>('channels',
    { part: 'contentDetails', id });
  const uploads = c?.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploads) continue;
  let page: string | undefined;
  let n = 0;
  do {
    const j = await get<{ items?: { snippet?: { title?: string; description?: string; publishedAt?: string; resourceId?: { videoId?: string } } }[]; nextPageToken?: string }>(
      'playlistItems', { part: 'snippet', playlistId: uploads, maxResults: '50', ...(page ? { pageToken: page } : {}) });
    for (const it of j?.items ?? []) {
      if (it.snippet?.title && it.snippet.resourceId?.videoId) {
        videos.push({ id: it.snippet.resourceId.videoId, title: it.snippet.title, description: it.snippet.description?.slice(0, 600), publishedAt: it.snippet.publishedAt?.slice(0, 10), channel: title });
      }
    }
    page = j?.nextPageToken;
    n += 1;
  // 40 страниц = 2 000 роликов, как в youtube-channels.mts. При 20 обход обрезал на тысяче
  // (25.09: КИНОЛИКБЕЗ, КИНОКРИТИКА 1 062, Клим Жуков 1 789), а плейлист идёт от новых к
  // старым — терялись как раз старые разборы.
  } while (page && n < 40);
  console.error(`  ${title}: ${videos.filter((v) => v.channel === title).length}`);
}

// 3. Сопоставление с нашими произведениями по названию.
const ours = worksIndex();

// Ручная разметка (tools/import-markup.py ← film_reviews.xlsx). Она сильнее догадки во всём:
// привязывает то, чего регексп не увидел, снимает то, что он привязал зря, и не спрашивает
// про длительность и улики — человек уже посмотрел. Файла нет — всё как раньше.
interface Verdict { key: string | null; why?: string; film?: string }
const vFile = new URL('./markup-verdicts.json', import.meta.url);
const human: Record<string, Verdict> = existsSync(vFile)
  ? (JSON.parse(readFileSync(vFile, 'utf8')).videos ?? {}) : {};
const byKey = new Map(ours.map((w) => [w.key, w]));

// названия-ловушки (tools/build-ordinary.mts): в заголовке ролика им нужен капс, кавычки или
// ярлык рядом — то же правило, что односложным, только список берётся из корпуса
const ordFile = new URL('../.cache/ordinary.json', import.meta.url);
const ordinary = existsSync(ordFile)
  ? new Set<string>(JSON.parse(readFileSync(ordFile, 'utf8')).names ?? []) : undefined;

const out: Record<string, ExternalAnalysis[]> = {};
const rows: string[] = [];
// каждый ролик привязывается к одному произведению — тому, чьё название совпало длиннее
const best = new Map<string, { key: string; work: typeof ours[number]['work']; len: number }>();
for (const { key, work, names } of ours) {
  for (const v of videos) {
    const len = Math.max(...names.map((n) => nameMatch(v.title, n, { loose: process.env.TITLE_LOOSE === '1', ordinary })));
    if (!len) continue;
    const prev = best.get(v.id);
    if (!prev || len > prev.len) best.set(v.id, { key, work, len });
  }
}
// поверх догадок — решения людей
let confirmed = 0;
let dropped = 0;
let added = 0;
for (const [videoId, v] of Object.entries(human)) {
  if (!videos.some((x) => x.id === videoId)) continue;   // ролик из другого дампа или канал сняли
  if (v.key == null) { if (best.delete(videoId)) dropped += 1; continue; }
  const w = byKey.get(v.key);
  if (!w) { console.error(`  ручная привязка на неизвестный ключ ${v.key} (ролик ${videoId})`); continue; }
  if (best.has(videoId)) confirmed += 1; else added += 1;
  best.set(videoId, { key: v.key, work: w.work, len: Number.POSITIVE_INFINITY });
}
if (Object.keys(human).length) console.error(`ручная разметка: подтвердила и поправила ${confirmed}, сняла ${dropped}, добавила ${added}`);

// длительность — только у совпавших: разбор короче пяти минут это не разбор, а шортс
const matched = [...best.keys()];
const durations = new Map<string, number>();
for (let i = 0; i < matched.length; i += 50) {
  const j = await get<{ items?: { id: string; contentDetails?: { duration?: string } }[] }>('videos',
    { part: 'contentDetails', id: matched.slice(i, i + 50).join(',') });
  for (const it of j?.items ?? []) {
    const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(it.contentDetails?.duration ?? '');
    if (m) durations.set(it.id, Number(m[1] ?? 0) * 60 + Number(m[2] ?? 0) + (Number(m[3] ?? 0) >= 30 ? 1 : 0));
  }
}
let short = 0;
let adaptations = 0;
let conflicts = 0;
for (const [videoId, { key, work }] of best) {
  const v = videos.find((x) => x.id === videoId)!;
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  if (known.some((a) => a.url === url)) continue;
  const minutes = durations.get(videoId);
  const said = Boolean(human[videoId]?.key);
  if (!said && minutes != null && minutes < 5) { short += 1; continue; }
  // к книге не привязываем разбор экранизации: это про фильм
  if (!said && key.startsWith('isbn:') && ADAPTATION.test(v.title)) { adaptations += 1; continue; }
  // улика в названии и описании ролика (В3): год, оригинальное название, ссылка на страницу
  // фильма; противоречие года — ролик про ремейк или тёзку, привязку снимаем.
  // Человека сторожа не перепроверяют: он смотрел ролик, а они читают заголовок
  const verdict = said ? 'human' as const : evidenceFor(work, `${v.title}\n${v.description ?? ''}`);
  if (verdict === 'conflict') { conflicts += 1; continue; }
  (out[key] ??= []).push({
    id: `yta-${videoId}`, title: v.title, author: v.channel, platform: 'youtube', url,
    language: 'ru', spoilerLevel: 2, ...(verdict ? { evidence: verdict } : { unverified: true }),
    previewUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    ...(minutes ? { durationMinutes: minutes } : {}),
    ...(v.publishedAt ? { publishedAt: v.publishedAt } : {}),
  });
  rows.push(`${verdict ? `[${verdict}] ` : ''}${work.title} (${work.year}) ← ${v.channel}: ${v.title}`);
}
console.error(`коротких (меньше пяти минут) отброшено: ${short}, разборов экранизаций под книгой: ${adaptations}, снято противоречием года: ${conflicts}`);
console.error(`с уликой: ${Object.values(out).flat().filter((a) => a.evidence).length} из ${Object.values(out).flat().length}`);
writeFileSync(new URL('../src/mocks/essaysAuto.ts', import.meta.url),
  `// Сгенерировано tools/build-essay-index.mts (${new Date().toISOString().slice(0, 10)}): разборы, найденные
// перебором загрузок тех же каналов, с привязкой по названию. Это догадка, а не разметка:
// в карточке они идут после присланных вручную, подтверждать их должна кураторская.
// Не править руками — перегенерировать.
import type { ExternalAnalysis } from '@/types/tmdf';

export const essaysAuto: Record<string, ExternalAnalysis[]> = ${JSON.stringify(out, null, 2)};
`);
console.error(`\n→ src/mocks/essaysAuto.ts: ${rows.length} совпадений к ${Object.keys(out).length} фильмам`);
console.error(rows.sort().join('\n'));
