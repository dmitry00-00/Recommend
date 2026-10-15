// Подборки голосов (ЗП-45, шаг 3, 11.10): плейлист эссеиста как полка — «Абсолютные шедевры» и «Кино СССР» у
// КИНОЛИКБЕЗа, «Наше кино» у КАРО.Арт, «Мультипликация» у Nuke. Автор сам собрал фильмы под темой, и у каждого фильма
// на полке есть его же разбор — это то, чего нет у каталогов.
//   npx tsx tools/voice-playlists.mts [--list]
//
// Источники (без сети): плейлисты каналов (.cache/youtube/playlists.json, собирает tools/youtube-playlists.mts) и
// индекс разборов (src/mocks/essaysAuto.ts + essays.ts: ролик → произведение). Плейлист берётся, если в нём не меньше
// пяти фильмов с разбором и это тема, а не склад:
//   · без обзоров: ролики яруса «обзор» человек не видит (не больше трети плейлиста);
//   · без сборных названий — «Обзоры», «Movie Reviews», «Все видео», годы, «Стримы», «Подкаст», трейлеры, новинки;
//     имя канала в названии вырезается («КАРО.Арт / НАШЕ КИНО» → «НАШЕ КИНО»);
//   · не о произведении или франшизе (`target` work/universe): для них есть страницы вселенной и фильма. Плейлист о
//     человеке («Тарковский») — полка.
// Итог — .cache/voice-playlists.json (`VoicePlaylists`, src/lib/model/collections.ts), публикует publish-reference;
// приложение показывает полку, если в его пуле найдётся пять фильмов с видимым разбором (язык, ярус — свои правила).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { essaysAuto } from '../src/mocks/essaysAuto.ts';
import { essays } from '../src/mocks/essays.ts';
import type { VoicePlaylists } from '../src/lib/model/collections.ts';
import { universeSeeds } from './universe-seeds.mts';

const LIST = process.argv.includes('--list');
const MIN_FILMS = 5;
const SRC = '.cache/youtube/playlists.json';
const OUT = '.cache/voice-playlists.json';
if (!existsSync(SRC)) { console.error(`нет ${SRC} — сначала tools/youtube-playlists.mts`); process.exit(2); }

type Playlist = { id: string; title: string; count: number; items?: string[]; target?: { kind: string; title?: string } };
const cache = JSON.parse(readFileSync(SRC, 'utf8')) as { channels: Record<string, { title?: string; playlists?: Playlist[] }> };

// ролик → произведения и ярус
const byVideo = new Map<string, Set<string>>();
const review = new Set<string>();
for (const src of [essaysAuto, essays] as Record<string, { url?: string; tier?: string }[]>[]) {
  for (const [key, list] of Object.entries(src)) {
    if (!key.startsWith('tmdb:')) continue;   // полка — фильмы
    for (const a of list) {
      const m = /[?&]v=([\w-]{11})|youtu\.be\/([\w-]{11})/.exec(a.url ?? '');
      const v = m?.[1] ?? m?.[2];
      if (!v) continue;
      (byVideo.get(v) ?? byVideo.set(v, new Set()).get(v)!).add(key);
      if (a.tier === 'review') review.add(v);
    }
  }
}

const GENERIC = new RegExp([
  'обзор', 'review', 'разбор', 'рецензи', 'все видео', 'все ролики', 'all video', 'video essay', 'видео-?эссе', 'favou?rites', 'избранн',
  'стрим', 'livestream', 'podcast', 'подкаст', 'новинк', 'премьер', 'trailer', 'трейлер', 'shorts', 'интервью', 'interview',
  'мнение', 'ролики', 'breakdown', 'explained', 'commentar', 'easter egg', 'trivia', 'details', 'детал', 'секрет', 'update',
  'charts', 'editorial', 'reaction', 'реакци', 'глянул', 'сходил', 'коротенько', 'киночай', 'сезон', 'season', 'выпуск',
  'episode', 'netflix', 'disney', 'тнт', 'мастер-класс', 'встреч', 'тр[еэ]ш', 'плох', 'гибель', 'uploads', 'popular',
  '(?:19|20)\\d\\d', 'фильмы и сериалы', 'кино и сериалы', '^кино$', '^фильмы$', '^movies?$', '^films?$', '^сериалы$', '^анализ',
  'analysis', 'complete series', 'the deeper meaning', 'lessons from', 'новое от', 'live', 'эфир', 'аудио', 'подписчик',
  'старые видео', 'start here', 'film & tv', 'pop culture', 'explain', 'forum', 'content', 'dives', 'retrospective',
  'chronological', 'спойлер',
].join('|'), 'iu');
// франшиза — не тема: «DC Movie Content», «James Bond Content», «Star Trek Retrospective» (вселенные — tools/universe-seeds.mts)
const compact = (x: string) => x.toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]+/gu, '');
const FRANCHISE = [...new Set(universeSeeds.flatMap((u) => [u.ru, u.en]).filter((x): x is string => Boolean(x)).map(compact))].filter((x) => x.length >= 2);
const franchise = (t: string) => { const c = compact(t); return FRANCHISE.some((f) => c.includes(f)) || /(?<!\p{L})(?:dc|marvel|bond)(?!\p{L})/iu.test(t); };
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const theme = (title: string, channel: string): string =>
  title.replace(new RegExp(esc(channel), 'giu'), '').replace(/^[\s/|:—–-]+|[\s/|:—–-]+$/g, '').trim();

const out: VoicePlaylists = { at: new Date().toISOString(), lists: [] };
const skipped = new Map<string, number>();
const skip = (why: string) => skipped.set(why, (skipped.get(why) ?? 0) + 1);
for (const [channelId, c] of Object.entries(cache.channels)) {
  for (const p of c.playlists ?? []) {
    const items: [string, string][] = [];
    const seen = new Set<string>();
    let rev = 0;
    for (const v of p.items ?? []) {
      if (review.has(v)) rev += 1;
      for (const k of byVideo.get(v) ?? []) if (!seen.has(k)) { seen.add(k); items.push([v, k]); }
    }
    if (items.length < MIN_FILMS) { skip('меньше пяти фильмов'); continue; }
    if (rev > items.length / 3) { skip('обзоры'); continue; }
    if (p.target && p.target.kind !== 'person') { skip('о произведении или франшизе'); continue; }
    const t = theme(p.title, c.title ?? '');
    // остаток — часть имени канала («КИНО БЛОГ ЛАРЁК» — «БЛОГ ЛАРЁК»): плейлист всего канала
    if (!t || GENERIC.test(t) || compact(c.title ?? '').includes(compact(t))) { skip('сборное название'); continue; }
    if (franchise(t)) { skip('франшиза'); continue; }
    out.lists.push({ id: p.id, channelId, channel: c.title ?? '', title: t, items });
  }
}
out.lists.sort((a, b) => b.items.length - a.items.length);
console.log(`плейлистов — ${out.lists.length}; отсеяно: ${[...skipped].map(([k, n]) => `${k} ${n}`).join(', ')}`);
if (LIST) for (const l of out.lists) console.log(`  ${String(l.items.length).padStart(3)}  ${l.channel} — ${l.title}`);
writeFileSync(OUT, JSON.stringify(out));
console.log(`→ ${OUT}`);
