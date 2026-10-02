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
import { isDigest } from './title-match.mts';
import { adaptationIndex, judgeBookMatch } from './adaptation-guard.mts';
import { worksIndex } from './works-index.mts';
import { evidenceFor, tooEarly } from './evidence.mts';
import { seriesPart } from './series-part.mts';
import { isSeries } from '../src/lib/media.ts';
import { bestByTitle } from './match-videos.mts';
import { channelMeta, fetchChannelVideos } from './youtube-channels.mts';
import type { ExternalAnalysis } from '../src/types/tmdf.ts';
import { isBookKey } from '../src/lib/keys.ts';
import { bookChannelList, judgeInBookChannel, namesFor, sourceIndex } from './book-channels.mts';

const key = process.env.YT_API_KEY;
if (!key) { console.error('нужен YT_API_KEY'); process.exit(1); }
const API = 'https://www.googleapis.com/youtube/v3';
// YouTube не отвечает — индекс собирается из прежней выгрузки и прежних ответов (02.10): раньше
// выходили, ничего не записав, теперь вчерашнее и так лежит в кэше
let offline = false;
const get = async <T,>(path: string, params: Record<string, string>): Promise<T | undefined> => {
  if (offline) return undefined;
  const r = await fetch(`${API}/${path}?${new URLSearchParams({ ...params, key })}`).catch((e: Error & { cause?: { code?: string } }) => {
    console.error(`ВНИМАНИЕ: YouTube не отвечает (${e.cause?.code ?? e.message}) — дальше только из кэша`);
    offline = true;
    return undefined;
  });
  if (!r) return undefined;
  if (!r.ok) { console.error(`  ${path} ${r.status}`); return undefined; }
  return await r.json() as T;
};

// присланные вручную разборы (src/mocks/essays.ts) — ниже их не дублируем
const known = Object.values(essays).flat();

// 1–2. Каналы и их загрузки — из общей выгрузки (tools/youtube-channels.mts): она помнит, что уже
// получено, и спрашивает YouTube только о новом (02.10). Раньше индекс каждую ночь заново проходил
// все загрузки всех каналов — по 40 страниц на канал. Каналы из ссылок (`via: 'links'`) индекс
// по-прежнему не берёт. Сети нет — индекс собирается из прежней выгрузки.
const dump = await fetchChannelVideos(key, console.error, { links: false, full: process.argv.includes('--full') });
const channels = new Map<string, string>();
// ярус по названию канала, как оно приходит в ролике: обзорщиков помечаем в индексе, чтобы
// приложение их не показывало, а подбор — видел. Канала нет в sources.ts — это автор эссе
const reviewers = new Set<string>();
// книжные каналы (`medium: 'book'`, З6): в их роликах ищем книги, а не фильмы (tools/book-channels.mts)
const bookChannels = new Set<string>();
// англоязычные каналы (`language: 'en'` в sources.ts): их ролик помечаем «англ.» и сопоставляем
// по-английски (Title Case в заголовке — не продолжение названия, tools/title-match.mts)
const englishChannels = new Set<string>();
for (const [id, m] of Object.entries(channelMeta())) {
  if (m.via) continue;
  channels.set(id, m.title);
  if (m.tier === 'review') reviewers.add(m.title);
  if (m.medium === 'book') bookChannels.add(m.title);
  if (m.language === 'en') englishChannels.add(m.title);
}
interface Video { id: string; title: string; description?: string; publishedAt?: string; channel: string; book?: boolean; en?: boolean }
const videos: Video[] = dump.filter((v) => v.channelId && channels.has(v.channelId)).map((v) => ({
  id: v.id, title: v.title, description: v.description?.slice(0, 600), publishedAt: v.publishedAt, channel: v.channel,
  ...(bookChannels.has(v.channel) ? { book: true } : {}), ...(englishChannels.has(v.channel) ? { en: true } : {}),
}));
console.error(`каналов: ${channels.size}, роликов: ${videos.length}`);

// 3. Сопоставление с нашими произведениями по названию.
const ours = worksIndex();

// Ручная разметка (tools/import-markup.py ← film_reviews.xlsx). Она сильнее догадки во всём:
// привязывает то, чего регексп не увидел, снимает то, что он привязал зря, и не спрашивает
// про длительность и улики — человек уже посмотрел. Файла нет — всё как раньше.
interface Verdict { key: string | null; why?: string; film?: string; guess?: boolean }
const vFile = new URL('./markup-verdicts.json', import.meta.url);
const human: Record<string, Verdict> = existsSync(vFile)
  ? (JSON.parse(readFileSync(vFile, 'utf8')).videos ?? {}) : {};
// Ролики, которые человек принёс сам (лист «Без разбора»), чаще всего с чужих каналов: в
// загрузках наших их нет, и без этого шага ручная привязка молча пропадала (29.09: 290 из
// 293 присланных). Берём их по id — единица квоты на 50 роликов.
// Ответ YouTube по таким роликам храним (02.10): спрашиваем только о новых решениях
const OUTSIDE = new URL('../.cache/youtube/outside.json', import.meta.url);
type OutsideVideo = Video & { channelTitle?: string };
const outsideCache: Record<string, OutsideVideo | null> = existsSync(OUTSIDE) ? JSON.parse(readFileSync(OUTSIDE, 'utf8')) : {};
const inDump = new Set(videos.map((x) => x.id));
const outside = Object.entries(human).filter(([id, v]) => v.key && !inDump.has(id)).map(([id]) => id);
const addOutside = (it: OutsideVideo) => {
  videos.push(it);
  // ярус такого канала — из реестра (via: 'links', заводит tools/register-link-channels.mts);
  // канала там ещё нет — обзорщик: так решил владелец для всех, кого он приносит ссылками (29.09)
  const tier = sources.find((s) => s.platform === 'youtube' && s.title === it.channel)?.tier;
  if ((tier ?? 'review') === 'review' && ![...channels.values()].includes(it.channel)) reviewers.add(it.channel);
};
for (const id of outside) if (outsideCache[id]) addOutside(outsideCache[id]!);
const askOutside = outside.filter((id) => outsideCache[id] === undefined);
for (let i = 0; i < askOutside.length; i += 50) {
  const j = await get<{ items?: { id: string; snippet?: { title?: string; description?: string; publishedAt?: string; channelTitle?: string } }[] }>(
    'videos', { part: 'snippet', id: askOutside.slice(i, i + 50).join(',') });
  if (!j) continue;
  const got = new Set<string>();
  for (const it of j.items ?? []) {
    if (!it.snippet?.title) continue;
    const v: OutsideVideo = { id: it.id, title: it.snippet.title, description: it.snippet.description?.slice(0, 600), publishedAt: it.snippet.publishedAt?.slice(0, 10), channel: it.snippet.channelTitle ?? '' };
    outsideCache[it.id] = v;
    got.add(it.id);
    addOutside(v);
  }
  // удалённый или закрытый ролик — тоже ответ: второй раз не спрашиваем
  for (const id of askOutside.slice(i, i + 50)) if (!got.has(id)) outsideCache[id] = null;
}
if (askOutside.length) writeFileSync(OUTSIDE, JSON.stringify(outsideCache));
if (outside.length) console.error(`ролики с других каналов из ручной разметки: ${outside.length}, нашлось в YouTube ${videos.filter((v) => outside.includes(v.id)).length}`);
// ручная привязка может указать и на фильм с коротким названием, которого в `ours` нет
const byKey = new Map(worksIndex({ all: true }).map((w) => [w.key, w]));

// названия-ловушки (tools/build-ordinary.mts): в заголовке ролика им нужен капс, кавычки или
// ярлык рядом — то же правило, что односложным, только список берётся из корпуса
const ordFile = new URL('../.cache/ordinary.json', import.meta.url);
const ordinary = existsSync(ordFile)
  ? new Set<string>(JSON.parse(readFileSync(ordFile, 'utf8')).names ?? []) : undefined;

const out: Record<string, ExternalAnalysis[]> = {};
const rows: string[] = [];
// каждый ролик привязывается к одному произведению — тому, чьё название совпало длиннее; из тёзок
// выбирает pickNamesake. Правила общие с таблицей разметки — tools/match-videos.mts (HYG-3, 30.09):
// там же отбор кандидатов по началу слова, в двадцать раз быстрее перебора, результат тот же
// (проверено на 2,5 тыс. роликов дампа — ни одного расхождения)
const best = bestByTitle(videos, ours, { ordinary, loose: process.env.TITLE_LOOSE === '1' });
let early = 0;
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
// (02.10) длительность — из выгрузки и из прежних ответов: спрашиваем только о роликах без неё
const matched = [...best.keys()];
const DURATIONS = new URL('../.cache/youtube/durations.json', import.meta.url);
const durationCache: Record<string, number> = existsSync(DURATIONS) ? JSON.parse(readFileSync(DURATIONS, 'utf8')) : {};
const durations = new Map<string, number>();
for (const v of dump) if (v.minutes) durations.set(v.id, v.minutes);
for (const id of matched) if (!durations.has(id) && durationCache[id]) durations.set(id, durationCache[id]);
const askDur = matched.filter((id) => !durations.has(id));
for (let i = 0; i < askDur.length; i += 50) {
  const j = await get<{ items?: { id: string; contentDetails?: { duration?: string } }[] }>('videos',
    { part: 'contentDetails', id: askDur.slice(i, i + 50).join(',') });
  for (const it of j?.items ?? []) {
    const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(it.contentDetails?.duration ?? '');
    if (m) { const min = Number(m[1] ?? 0) * 60 + Number(m[2] ?? 0) + (Number(m[3] ?? 0) >= 30 ? 1 : 0); durations.set(it.id, min); durationCache[it.id] = min; }
  }
}
if (askDur.length) writeFileSync(DURATIONS, JSON.stringify(durationCache));
let short = 0;
let digests = 0;
let adaptations = 0;
let moved = 0;
let conflicts = 0;
let bookLists = 0, toBook = 0, outsideCatalog = 0;
// экранизации книг по связям Ж1 (Ж4): разбор фильма по книге переезжает к фильму, а не пропадает
const adIndex = adaptationIndex(worksIndex({ all: true }));
const bookCtx = { ad: adIndex, sources: sourceIndex(adIndex, worksIndex({ all: true })) };
for (const [videoId, found] of best) {
  let { key, work } = found;
  const v = videos.find((x) => x.id === videoId)!;
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  if (known.some((a) => a.url === url)) continue;
  const minutes = durations.get(videoId);
  // выбор опознавателя из тёзок (guess) — не слово человека: сторожа его проверяют, в карточке «не проверено»
  const said = Boolean(human[videoId]?.key) && !human[videoId]?.guess;
  if (!said && minutes != null && minutes < 5) { short += 1; continue; }
  // сборник, топ или новости (слова владельца, tools/title-match.mts DIGEST): не про один фильм
  if (!said && isDigest(v.title, byKey.get(key) ? namesFor(byKey.get(key)!, Boolean(v.book)) : [])) { digests += 1; continue; }
  // книжный канал (З6): сборник («ПРОЧИТАНО», «N книг») — нет; фильм без разговора о кино — к книге
  // по связям Ж1, а нет её у нас — мимо; книга — сторож экранизаций, как везде
  if (!said && v.book) {
    if (bookChannelList(v.title)) { bookLists += 1; continue; }
    const j = judgeInBookChannel(byKey.get(key) ?? { key, work, names: [] }, v.title, v.title, bookCtx, v.publishedAt);
    if (j.action === 'drop') { if (j.why === 'outside') outsideCatalog += 1; else adaptations += 1; continue; }
    if (j.action === 'move') { key = j.to!.key; work = j.to!.work; if (j.why === 'to_book') toBook += 1; else moved += 1; }
  } else if (!said && isBookKey(key)) {
    // к книге не привязываем разбор экранизации: это про фильм (Ж4 — по связям, без них — по словам)
    const j = judgeBookMatch(adIndex, key, v.title, v.publishedAt);
    if (j.action === 'drop') { adaptations += 1; continue; }
    if (j.action === 'move') { key = j.to!.key; work = j.to!.work; moved += 1; }
  }
  // улика в названии и описании ролика (В3): год, оригинальное название, ссылка на страницу
  // фильма; противоречие года — ролик про ремейк или тёзку, привязку снимаем.
  // Человека сторожа не перепроверяют: он смотрел ролик, а они читают заголовок
  const verdict = said ? 'human' as const : evidenceFor(work, `${v.title}\n${v.description ?? ''}`);
  if (verdict === 'conflict') { conflicts += 1; continue; }
  // ролик вышел раньше фильма больше чем на год — не про него
  if (!said && tooEarly(work, v.publishedAt)) { early += 1; continue; }
  (out[key] ??= []).push({
    id: `yta-${videoId}`, title: v.title, author: v.channel, platform: 'youtube', url,
    language: v.en || englishChannels.has(v.channel) ? 'en' : 'ru', spoilerLevel: 2, ...(verdict ? { evidence: verdict } : { unverified: true }),
    ...(reviewers.has(v.channel) ? { tier: 'review' as const } : {}),
    previewUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    ...(minutes ? { durationMinutes: minutes } : {}),
    ...(v.publishedAt ? { publishedAt: v.publishedAt } : {}),
    // разбор сезона или серии (Е6) — по названию ролика
    ...(isSeries(work) ? seriesPart(v.title) : {}),
  });
  rows.push(`${verdict ? `[${verdict}] ` : ''}${work.title} (${work.year}) ← ${v.channel}: ${v.title}`);
}
console.error(`коротких (меньше пяти минут) отброшено: ${short}, сборников и новостей: ${digests}, разборов экранизаций под книгой: ${adaptations} (переехали к экранизации: ${moved}), снято противоречием года: ${conflicts}, раньше фильма: ${early}`);
console.error(`книжные каналы: сборников ${bookLists}, фильм → книга ${toBook}, мимо (книга вне каталога) ${outsideCatalog}`);
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
