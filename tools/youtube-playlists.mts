// Плейлисты каналов как метка темы (02.10): автор сам раскладывает ролики — «Разборы Ведьмака»,
// «Тарковский», «Вселенная Marvel». Название плейлиста — его собственная подпись к ролику.
//   npx tsx tools/youtube-playlists.mts [--max-calls 1500] [--offline] [--full]
//
// Сбор (нужен YT_API_KEY, на Mac): у каждого канала нашей выборки (.cache/youtube/channels.json, без
// каналов из ссылок и убранных) — список плейлистов (1 единица на 50), а у плейлиста, где число роликов
// изменилось, — его ролики (1 единица на 50). Всё в .cache/youtube/playlists.json; повторный прогон
// спрашивает только изменившееся, список плейлистов канала — раз в неделю. Потолок запросов за прогон
// (--max-calls) бережёт суточную квоту: недоделанное доберётся завтра.
//
// Разбор (без сети, и с --offline): название плейлиста → цель. По порядку:
//   · вселенная (франшиза, цикл) или человек — tools/about-lib.mts;
//   · произведение — по названию из нашего каталога, однозначно.
// Общие слова («обзоры», «разборы», «фильмы», «сезон 2», «reviews») вырезаются; «Обзоры», «Shorts»,
// «Стримы» без предмета — без цели. Результат там же: у плейлиста `target`.
//
// Где работает (tools/playlists-lib.mts → match-videos, индекс разборов): улика `playlist`, если
// привязанное произведение — цель плейлиста, в её вселенной или у её человека; ролик без названия в
// заголовке, но в плейлисте одного произведения, — привязка к нему (без улики, на проверку).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { loadEnvFile } from './env-file.mts';
import { channelMeta, excludedChannels, isExcluded } from './youtube-channels.mts';
import { resolveAbout, universeHasKind, universeOfKey, universeTitle } from './about-lib.mts';
import { resolver } from './llm-lib.mts';
import { worksIndex } from './works-index.mts';
import { PLAYLISTS, type Playlist, type PlaylistFile } from './playlists-lib.mts';

loadEnvFile();
const argv = process.argv.slice(2);
const opt = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const MAX = Number(opt('--max-calls') ?? 1500);
const OFFLINE = argv.includes('--offline') || !process.env.YT_API_KEY;
const FULL = argv.includes('--full');
const WEEK = 7 * 86400e3;
const API = 'https://www.googleapis.com/youtube/v3';

const file: PlaylistFile = existsSync(PLAYLISTS) ? JSON.parse(readFileSync(PLAYLISTS, 'utf8')) as PlaylistFile : { channels: {} };

// ─── сбор ─────────────────────────────────────────────────────────────────────
let calls = 0, stopped = false;
const get = async <T,>(path: string, params: Record<string, string>): Promise<T | undefined> => {
  if (calls >= MAX) { stopped = true; return undefined; }
  calls += 1;
  const r = await fetch(`${API}/${path}?${new URLSearchParams({ ...params, key: process.env.YT_API_KEY! })}`).catch(() => undefined);
  if (!r?.ok) { console.error(`  ${path} ${r?.status ?? 'нет сети'}`); if (!r || r.status === 403) stopped = true; return undefined; }
  return await r.json() as T;
};

if (!OFFLINE) {
  const excluded = excludedChannels();
  const chans = Object.entries(channelMeta()).filter(([id, m]) => !m.via && !isExcluded({ channelId: id, handle: m.handle, title: m.title }, excluded));
  // давно не обновлявшиеся — первыми: за несколько дней обходится всё
  chans.sort((a, b) => (file.channels[a[0]]?.at ?? '').localeCompare(file.channels[b[0]]?.at ?? ''));
  let listed = 0, walked = 0;
  for (const [channelId, meta] of chans) {
    if (stopped) break;
    const prev = file.channels[channelId];
    if (!FULL && prev && Date.now() - Date.parse(prev.at) < WEEK) continue;
    const lists: { id: string; title: string; count: number }[] = [];
    let page: string | undefined;
    do {
      const j = await get<{ items?: { id: string; snippet?: { title?: string }; contentDetails?: { itemCount?: number } }[]; nextPageToken?: string }>(
        'playlists', { part: 'snippet,contentDetails', channelId, maxResults: '50', ...(page ? { pageToken: page } : {}) });
      if (!j) break;
      for (const it of j.items ?? []) lists.push({ id: it.id, title: it.snippet?.title ?? '', count: it.contentDetails?.itemCount ?? 0 });
      page = j.nextPageToken;
    } while (page && !stopped);
    if (stopped && !lists.length) break;
    listed += 1;
    const old = new Map((prev?.playlists ?? []).map((p) => [p.id, p]));
    const next = [];
    for (const pl of lists) {
      const was = old.get(pl.id);
      if (was && was.count === pl.count && was.items) { next.push({ ...was, title: pl.title }); continue; }
      // большие плейлисты (всё подряд, «Видео») ничего не говорят о теме — не читаем
      if (pl.count > 400 || pl.count < 2) { next.push({ ...pl }); continue; }
      const items: string[] = [];
      let p2: string | undefined;
      do {
        const j = await get<{ items?: { contentDetails?: { videoId?: string } }[]; nextPageToken?: string }>(
          'playlistItems', { part: 'contentDetails', playlistId: pl.id, maxResults: '50', ...(p2 ? { pageToken: p2 } : {}) });
        if (!j) break;
        for (const it of j.items ?? []) if (it.contentDetails?.videoId) items.push(it.contentDetails.videoId);
        p2 = j.nextPageToken;
      } while (p2 && !stopped);
      if (stopped && !p2 && items.length < Math.min(pl.count, 50)) { if (was) next.push(was); continue; }
      walked += 1;
      next.push({ ...pl, items });
    }
    file.channels[channelId] = { title: meta.title, at: new Date().toISOString(), playlists: next };
  }
  console.error(`плейлисты: каналов обновлено ${listed}, плейлистов прочитано ${walked}, запросов ${calls}${stopped ? ' (потолок или отказ — остальное в следующий раз)' : ''}`);
}

// ─── разбор: название плейлиста → цель ────────────────────────────────────────
// Общие слова плейлистов: «обзор фильмов и персонажей», «теории, факты, мнения», «и всё, что с ним связано»
const GENERIC = /(?<![\p{L}\p{N}])(?:(?:детальный\s+)?(?:обзоры?|разборы?|рецензи[ияй]|эссе|анализ|теори[ияй]|факты|мнени[яе]|истори[ия]|ролики|видео|репортаж[иа]?|расследовани[яе]|подкаст[ыа]?|стрим[ыа]?|клип[ыа]?|новости|топ(?:ы|\s*\d+)?|подборк[иа])(?:\s+(?:на|о|об|по))?|фильм(?:ы|а|ов)?|кино|сериал(?:ы|а|ов)?|мультфильм(?:ы|а|ов)?|мультсериал(?:ы|а|ов)?|аниме|книг[иа]?|персонаж(?:и|а|ей)?|франшиз[ауы]|вселенн(?:ая|ой)|трилоги[ия]|экранизаци[ия]|все|вся|весь|серии|эпизоды|выпуски|сезон\s*\d*|часть\s*\d*|\d+\s*сезон|всё,?\s+что\s+с\s+(?:ним|ней|ними)\s+связано|в\s+кино|reviews?|analysis|explained|theories|movies?|films?|series|season\s*\d*|episodes?|lore|playlist|плейлист|про|о|об|по|и|с|на|the|of|and)(?![\p{L}\p{N}])/giu;
// «Oбитeли 3лa»: латиница и тройка внутри русского слова — подделка под кириллицу (обход фильтров)
const LAT: Record<string, string> = { a: 'а', e: 'е', o: 'о', p: 'р', c: 'с', x: 'х', y: 'у', k: 'к', m: 'м', t: 'т', h: 'н', b: 'в', A: 'А', E: 'Е', O: 'О', P: 'Р', C: 'С', X: 'Х', K: 'К', M: 'М', T: 'Т', H: 'Н', B: 'В' };
const decoy = (s: string): string => s.replace(/[\p{L}\d]+/gu, (w) => (/\p{Script=Cyrillic}/u.test(w) && /[a-zA-Z3]/.test(w)
  ? w.replace(/[a-zA-Z]/g, (c) => LAT[c] ?? c).replace(/3/g, (_, i: number) => (i === 0 || /\p{Script=Cyrillic}/u.test(w[i - 1]) ? 'З' : '3')) : w));
const stem = (w: string) => (w.length > 4 ? w.replace(/(?:ами|ями|ого|его|ому|ему|ом|ем|ой|ей|ою|ая|яя|а|я|у|ю|е|ы|и)$/u, '') : w);
const soft = (w: string) => (w.length > 4 ? w.replace(/(?:а|я|у|ю|е|ом|ем)$/u, '') : w);
const clean = (s: string) => s.replace(/[«»"“”'‘’|:()[\]#№!?.,—–/]+|\s-\s/g, ' ').replace(GENERIC, ' ').replace(/\s+/g, ' ').trim();

/** Что пробовать по порядку: в кавычках → до двоеточия/черты → остальные части → всё название. */
function segments(title: string): string[] {
  const t = decoy(title);
  const quoted = [...t.matchAll(/[«"“'‘]([^«»"“”'‘’]{3,})[»"”'’]/gu)].map((m) => m[1]);
  const parts = t.split(/\s*(?:[:|/]|\s[-–—]\s|\s[-–—]|[-–—]\s)\s*/u);
  // целиком без чистки — раньше частей: «Аватар: Легенда об Аанге» — это одно название, а не «Аватар»
  const raw = t.replace(/[«»"“”'‘’|()[\]#№!?]+/g, ' ').replace(/\s+/g, ' ').trim();
  return [...new Set([...quoted.map(clean), raw, clean(t), ...parts.map(clean)].filter((x) => x.length >= 3))];
}

const resolve = resolver(worksIndex({ all: true }));
type Target = NonNullable<Playlist['target']>;
function targetOf(title: string): Target | undefined {
  const year = Number(title.match(/(?<!\d)(19[0-9]{2}|20[0-9]{2})(?!\d)/)?.[1]) || undefined;
  // «Бэтмен и всё, что с ним связано», «франшиза», «сага», «цикл» — плейлист о вселенной, а не о фильме:
  // нашлось произведение — берём его вселенную, вселенной нет — цели нет
  const broad = /всё,?\s+что\s+с\s+\S+\s+связано|франшиз|вселенн|(?<![\p{L}])саг[аиу]?(?![\p{L}])|(?<![\p{L}])цикл|(?<![\p{L}])(?:все|вся|весь)\s/iu.test(title);
  // «разбор сериала» — тёзку-фильм не берём («Пацаны» 1983 и «Пацаны» 2019)
  const type = /сериал/iu.test(title) && !/фильм/iu.test(title) ? 'series' : /фильм/iu.test(title) && !/сериал/iu.test(title) ? 'film' : undefined;
  const asWork = (key: string, label: string): Target | undefined => {
    if (!broad) return { kind: 'work', id: key, title: label };
    const hub = universeOfKey(key);
    return hub ? { kind: 'universe', id: hub, title: universeTitle(hub) ?? label } : undefined;
  };
  for (const seg of segments(title)) {
    const core = year ? seg.replace(String(year), ' ').replace(/\s+/g, ' ').trim() : seg;
    if (core.length < 3 || /^\d+$/.test(core)) continue;
    // «Разборы Ведьмака» → «Ведьмак»: падежные окончания — только после точного названия
    const words = core.split(' ');
    for (const v of [...new Set([core, words.map(stem).join(' '), words.map(soft).join(' ')])]) {
      const u = resolveAbout('universe', v);
      if (u && (!type || universeHasKind(u.id, type))) return { kind: 'universe', id: u.id, title: u.title };
      const p = resolveAbout('person', v);
      if (p) return { kind: 'person', id: p.id, title: p.title };
      const w = resolve({ title: v, ...(year ? { year } : {}), ...(type ? { type } : {}) });
      // тёзка другого вида не годится: у «сериала „Аватар“» фильм 2009 года — не он
      const kind = w.options.find((o) => o.key === w.key)?.kind;
      if (w.key && (!type || !kind || kind === type)) { const t = asWork(w.key, w.label ?? v); if (t) return t; }
    }
  }
  return undefined;
}

let withTarget = 0, total = 0;
for (const ch of Object.values(file.channels)) {
  for (const pl of ch.playlists) {
    total += 1;
    delete pl.target;
    const t = targetOf(pl.title);
    if (t) { pl.target = t; withTarget++; }
  }
}
if (!process.env.TM_PLAYLISTS) mkdirSync(new URL('../.cache/youtube/', import.meta.url), { recursive: true });
writeFileSync(PLAYLISTS, JSON.stringify(file));
console.log(`плейлисты: ${total} у ${Object.keys(file.channels).length} каналов, с целью ${withTarget}${OFFLINE ? ' (без сбора)' : ''}`);
