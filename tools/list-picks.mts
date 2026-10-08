// Каналы подборок «что посмотреть» (В-список, 06.10): Слава Киноман, KINO TIME, КиноСоветник —
// `lists: true` в src/mocks/sources.ts. Их ролики — не разбор одного фильма, а список, и в
// описании список лежит таймкодами: «01:10 19. Кёнсонское существо 2023/ Gyeongseong keuricheo
// КП: 7,3» у KINO TIME, «01:08 - 8 место | Последний дом IMDb: 5.4» у КиноСоветника. Из строк
// таймкодов берём название, год и оригинальное название, сводим к справочнику (resolver из
// llm-lib) — получается сигнал «советуют смотреть»: сколько раз и в скольких подборках фильм
// назван. Он для списка первых профилей (profile-deck) и, может быть, подбора — пока только данные.
//   npx tsx tools/list-picks.mts [--list]   → .cache/list-picks.json; --list — неопознанные строки
// Без сети: берёт выгрузку роликов (.cache/youtube/videos.json, стадия «Ролики YouTube»).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { sources } from '../src/mocks/sources.ts';
import { worksIndex } from './works-index.mts';
import { resolver } from './llm-lib.mts';

const root = new URL('../', import.meta.url);
const LIST = process.argv.includes('--list');
const VIDEOS = new URL('.cache/youtube/videos.json', root);
if (!existsSync(VIDEOS)) { console.error('нет .cache/youtube/videos.json — сначала стадия «Ролики YouTube»'); process.exit(2); }
type Video = { id: string; title: string; channel: string; description?: string; publishedAt?: string };
const videos = JSON.parse(readFileSync(VIDEOS, 'utf8')) as Video[];

// канал в выгрузке назван так, как его назвал автор («KINO TIME», «КиноСоветник»), в sources —
// как записал владелец; сравниваем без регистра и пробелов, ещё и по нику
const squash = (s: string) => s.toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]+/gu, '');
const listChannels = sources.filter((s) => s.platform === 'youtube' && (s as { lists?: boolean }).lists);
// канал мог переименоваться (@slavakinoman теперь «КиноТопище»): имя по нику — из кэша каналов
const CHANNELS = new URL('.cache/youtube/channels.json', root);
const titleByHandle = new Map<string, string>(existsSync(CHANNELS)
  ? Object.values(JSON.parse(readFileSync(CHANNELS, 'utf8')) as Record<string, { handle?: string; title?: string }>)
    .filter((c) => c.handle && c.title).map((c) => [c.handle!.toLowerCase(), c.title!])
  : []);
const namesOf = (s: { title: string; handle?: string }) => [s.title, s.handle ?? '', titleByHandle.get((s.handle ?? '').toLowerCase()) ?? ''].map(squash).filter(Boolean);
const wanted = new Set(listChannels.flatMap(namesOf));
const mine = videos.filter((v) => wanted.has(squash(v.channel)));

const TIMECODE = /^\s*(?:\d{1,2}:)?\d{1,2}:\d{2}\s*[-–—|.]?\s*/;
// служебные строки таймкодов: вступление, реклама, рубрики жанров у КиноСоветника
// без \b: в JS он не знает кириллицы («Вступление» опознавалось фильмом 1963 года)
const SERVICE = /^(вступление|старт|приветствие|начало|подписывайся|подпишись|итоги?|заключение|финал|бонус|реклама|интро|аутро|титры|концовка|спонсор)(?!\p{L})/iu;

interface Line { video: string; raw: string; title: string; original?: string; year?: number; series: boolean }
function parse(v: Video): Line[] {
  const series = /сериал/i.test(v.title);
  const out: Line[] = [];
  for (const rawLine of (v.description ?? '').split('\n')) {
    if (!TIMECODE.test(rawLine)) continue;
    let t = rawLine.replace(TIMECODE, '')
      .replace(/^\d{1,2}\s*место\s*[|:.\-–—]?\s*/i, '').replace(/^\d{1,2}\s*[.)]\s*/, '')
      .replace(/\s*(?:КП|IMDb|Кинопоиск|КиноПоиск)\s*:?\s*\d+(?:[.,]\d+)?/gi, '')
      .replace(/\(\s*\d+\s*(?:-?й)?\s*сезон[^)]*\)/gi, '').replace(/\((?:мини-)?сериал\)/gi, '').replace(/[«»"“”]/g, '').replace(/\s+/g, ' ').trim();
    if (!t || SERVICE.test(t)) continue;
    // заголовок жанра капсом без года («ФЭНТЕЗИ», «СУПЕРГЕРОЙСКИЙ ФИЛЬМ») — не фильм
    if (t === t.toUpperCase() && !/\d/.test(t) && t.split(' ').length <= 3) continue;
    const [ruPart, ...rest] = t.split(/\s*\/\s*/);
    // «2024/23» режется косой чертой: хвост из одних цифр — не оригинальное название
    // год бывает и после русского названия, и после оригинального: «Мать / The Mother 2023»
    const YEAR = /\s((?:19|20)\d{2})(?:\s*[-–]\s*(?:(?:19|20)?\d{2}))?\s*$/;
    let original = rest.join(' / ').replace(/^\d{2,4}\s*/, '').trim() || undefined;
    const ym = YEAR.exec(` ${ruPart}`);
    const yo = original ? YEAR.exec(` ${original}`) : null;
    if (yo) original = ` ${original}`.slice(0, yo.index).trim() || undefined;
    const year = ym?.[1] ?? yo?.[1];
    const title = (ym ? ` ${ruPart}`.slice(0, ym.index) : ruPart).trim();
    if (title.length < 2) continue;
    out.push({ video: v.id, raw: rawLine.trim(), title, ...(original ? { original } : {}), ...(year ? { year: Number(year) } : {}), series });
  }
  return out;
}

const resolve = resolver(worksIndex({ all: true }));
const works = new Map<string, { key: string; label: string; n: number; videos: Set<string>; channels: Set<string> }>();
const unknown = new Map<string, number>();
let lines = 0, resolved = 0, ambiguous = 0, withList = 0;
const channelOf = new Map(mine.map((v) => [v.id, v.channel]));
for (const v of mine) {
  const ls = parse(v);
  if (ls.length >= 3) withList++;
  for (const l of ls) {
    lines++;
    const r = resolve({ title: l.title, ...(l.original ? { original: l.original } : {}), ...(l.year ? { year: l.year } : {}), type: l.series ? 'series' : 'film' } as never);
    if (r.key) {
      resolved++;
      const w = works.get(r.key) ?? { key: r.key, label: r.label ?? r.key, n: 0, videos: new Set(), channels: new Set() };
      w.n++; w.videos.add(v.id); w.channels.add(channelOf.get(v.id)!);
      works.set(r.key, w);
    } else {
      if (r.options.length) ambiguous++;
      const name = `${l.title}${l.year ? ` ${l.year}` : ''}${l.original ? ` / ${l.original}` : ''}`;
      unknown.set(name, (unknown.get(name) ?? 0) + 1);
    }
  }
}

const top = [...works.values()].sort((a, b) => b.videos.size - a.videos.size || b.channels.size - a.channels.size);
mkdirSync(new URL('.cache/', root), { recursive: true });
writeFileSync(new URL('.cache/list-picks.json', root), JSON.stringify({
  generatedAt: new Date().toISOString(),
  channels: [...new Set(mine.map((v) => v.channel))],
  videos: mine.length, withList, lines, resolved,
  works: Object.fromEntries(top.map((w) => [w.key, { label: w.label, lists: w.videos.size, channels: w.channels.size }])),
  unknown: Object.fromEntries([...unknown].sort((a, b) => b[1] - a[1]).slice(0, 500)),
}, null, 1));

const missing = listChannels.filter((s) => !mine.some((v) => namesOf(s).includes(squash(v.channel))));
console.log(`каналов подборок ${listChannels.length}, в выгрузке ${listChannels.length - missing.length}${missing.length ? ` (нет: ${missing.map((s) => s.title).join(', ')})` : ''}`);
console.log(`роликов ${mine.length}, со списком в описании ${withList}; строк ${lines}, опознано ${resolved} (${Math.round((resolved / Math.max(1, lines)) * 100)}%), тёзки без решения ${ambiguous}`);
console.log(`произведений ${works.size}; чаще всего советуют: ${top.slice(0, 15).map((w) => `${w.label} ×${w.videos.size}`).join(', ')}`);
if (LIST) console.log([...unknown].sort((a, b) => b[1] - a[1]).slice(0, 80).map(([n, c]) => `  ${c}× ${n}`).join('\n'));
console.log(`→ .cache/list-picks.json`);
