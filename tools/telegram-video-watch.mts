// Видео-авторы в Telegram: сколько их и как меняется (25.10, слово владельца: «даже если Telegram only блогеров пока
// недостаёт до критического минимума — смотреть динамику их количества и анализировать»).
//
// По выемкам каналов реестра (.cache/telegram/<канал>.json, `media` у постов — tg-gateway с 25.10; у постов до 25.10
// шлюз дописывает его понемногу) считаем по каналу и месяцу: постов, видео, длинных видео (от 10 мин), кружков, аудио,
// голосовых, платного медиа и ссылок на YouTube / VK Видео. Канал — «видео в Telegram», если за 90 дней в нём ≥ 3
// длинных видео; «только Telegram», если при этом длинных видео больше, чем ссылок на YouTube и VK Видео.
// Каналы, у которых медиа ещё не дописано (ни одного поста с `media` за 90 дней при постах), — отдельной строкой
// «медиа неизвестно»: их не считаем ни туда, ни сюда.
//
//   npx tsx tools/telegram-video-watch.mts
// Итог — .cache/eval/telegram-video-<ддмм>.md и снимок в .cache/telegram-video-history.json (по снимку на день:
// динамика числа видео-авторов). Пиратские каналы (категория pirate реестра) не считаются.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { Post } from './telegram-export.mts';

const DIR = '.cache/telegram';
const HISTORY = '.cache/telegram-video-history.json';
const LONG = 600;          // длинное видео — от 10 минут
const WINDOW = 90;         // окно «сейчас», дней
const MIN_LONG = 3;        // видео-автор — от трёх длинных видео за окно
const VIDEO_LINK = /(?:youtube\.com|youtu\.be|vkvideo\.ru|vk\.com\/video|rutube\.ru)/i;

const registry = JSON.parse(readFileSync('tools/telegram-channels.json', 'utf8')).channels as { username: string; category?: string; title?: string }[];
const meta = new Map(registry.map((c) => [c.username.toLowerCase(), c]));

interface Month { posts: number; media: number; video: number; long: number; round: number; audio: number; voice: number; paid: number; videoLinks: number; longMinutes: number }
const blank = (): Month => ({ posts: 0, media: 0, video: 0, long: 0, round: 0, audio: 0, voice: 0, paid: 0, videoLinks: 0, longMinutes: 0 });
const add = (a: Month, b: Month) => { for (const k of Object.keys(a) as (keyof Month)[]) a[k] += b[k]; };

const today = new Date().toISOString().slice(0, 10);
const since = new Date(Date.now() - WINDOW * 864e5).toISOString().slice(0, 10);
interface Row { u: string; title?: string; category?: string; window: Month; byMonth: Record<string, Month>; verdict: 'tg-only' | 'tg-video' | 'other' | 'unknown' }
const rows: Row[] = [];
for (const f of readdirSync(DIR).filter((x) => x.endsWith('.json') && x !== 'gateway.json')) {
  const u = f.replace(/\.json$/, '').toLowerCase();
  const m = meta.get(u);
  if (!m || m.category === 'pirate') continue;
  let data: { posts?: Post[] };
  try { data = JSON.parse(readFileSync(`${DIR}/${f}`, 'utf8')); } catch { continue; }
  const byMonth: Record<string, Month> = {};
  const win = blank();
  for (const p of data.posts ?? []) {
    if (!p.date) continue;
    const x = blank();
    x.posts = 1;
    const md = p.media;
    if (md) {
      x.media = 1;
      if (md.kind === 'video') { x.video = 1; if ((md.duration ?? 0) >= LONG) { x.long = 1; x.longMinutes = Math.round((md.duration ?? 0) / 60); } }
      if (md.kind === 'round') x.round = 1;
      if (md.kind === 'audio') x.audio = 1;
      if (md.kind === 'voice') x.voice = 1;
      if (md.kind === 'paid') x.paid = 1;
    }
    if ([...(p.links ?? []), ...(p.buttons ?? []), ...(p.preview ? [{ url: p.preview.url }] : [])].some((l) => VIDEO_LINK.test(l.url))) x.videoLinks = 1;
    add(byMonth[p.date.slice(0, 7)] ??= blank(), x);
    if (p.date >= since) add(win, x);
  }
  const verdict: Row['verdict'] = win.posts && !win.media ? 'unknown'
    : win.long >= MIN_LONG ? (win.long > win.videoLinks ? 'tg-only' : 'tg-video') : 'other';
  rows.push({ u, title: m.title, category: m.category, window: win, byMonth, verdict });
}

const count = (v: Row['verdict']) => rows.filter((r) => r.verdict === v).length;
const snapshot = { at: today, channels: rows.length, tgOnly: count('tg-only'), tgVideo: count('tg-video'), other: count('other'), unknown: count('unknown'),
  byCategory: Object.fromEntries([...new Set(rows.map((r) => r.category ?? '?'))].map((c) => [c, {
    n: rows.filter((r) => (r.category ?? '?') === c).length,
    video: rows.filter((r) => (r.category ?? '?') === c && (r.verdict === 'tg-only' || r.verdict === 'tg-video')).length }])) };
const history = existsSync(HISTORY) ? JSON.parse(readFileSync(HISTORY, 'utf8')) as typeof snapshot[] : [];
writeFileSync(HISTORY, JSON.stringify([...history.filter((h) => h.at !== today), snapshot], null, 1));

// по месяцам — все каналы с известным медиа: доля постов с видео и длинных видео
const months = [...new Set(rows.flatMap((r) => Object.keys(r.byMonth)))].sort().slice(-12);
const monthly = months.map((mo) => {
  const t = blank();
  for (const r of rows) if (r.byMonth[mo]) add(t, r.byMonth[mo]);
  return { mo, ...t };
});
const pc = (a: number, b: number) => (b ? `${Math.round((100 * a) / b)}%` : '—');
const top = rows.filter((r) => r.verdict === 'tg-only' || r.verdict === 'tg-video').sort((a, b) => b.window.long - a.window.long);
const md = [
  `# Видео-авторы в Telegram — ${today}`, '',
  `Каналов реестра (без пиратских): ${rows.length}. За ${WINDOW} дней: **только Telegram** (≥ ${MIN_LONG} длинных видео от ${LONG / 60} мин, их больше, чем ссылок на YouTube/VK) — ${snapshot.tgOnly}; **видео и в Telegram** — ${snapshot.tgVideo}; остальные — ${snapshot.other}; медиа ещё неизвестно — ${snapshot.unknown} (шлюз дописывает понемногу).`, '',
  '## Динамика (снимки)', '', '| дата | только Telegram | видео и в Telegram | медиа неизвестно |', '|---|---|---|---|',
  ...[...history.filter((h) => h.at !== today), snapshot].slice(-12).map((h) => `| ${h.at} | ${h.tgOnly} | ${h.tgVideo} | ${h.unknown} |`), '',
  '## По месяцам (посты с известным медиа)', '', '| месяц | постов | с медиа | видео | длинных | кружков | аудио | ссылок на видео |', '|---|---|---|---|---|---|---|---|',
  ...monthly.map((m) => `| ${m.mo} | ${m.posts} | ${pc(m.media, m.posts)} | ${m.video} | ${m.long} | ${m.round} | ${m.audio} | ${m.videoLinks} |`), '',
  '## Видео-авторы', '', '| канал | категория | длинных за окно | минут | кружков | ссылок на видео | вывод |', '|---|---|---|---|---|---|---|',
  ...top.map((r) => `| @${r.u} ${r.title ? `(${r.title})` : ''} | ${r.category ?? '—'} | ${r.window.long} | ${r.window.longMinutes} | ${r.window.round} | ${r.window.videoLinks} | ${r.verdict === 'tg-only' ? 'только Telegram' : 'и в Telegram'} |`),
].join('\n');
mkdirSync('.cache/eval', { recursive: true });
const tag = today.slice(8, 10) + today.slice(5, 7);
writeFileSync(`.cache/eval/telegram-video-${tag}.md`, md);
console.log(md.split('\n').slice(0, 3).join('\n'));
