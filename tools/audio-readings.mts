// Записи аудиоканалов (25.10, карточка аудиоканала — режим страницы голоса): что прочитано, кем, по авторам и циклам.
// Первый канал — @chitalnya5 («Читальня», своё прочтение). `AudioReading` — не карточка произведения: в подбор и
// оценки запись не идёт; с каталогом сводится только точным совпадением названия и фамилии автора.
//
// Откуда: посты канала из tg-gateway (.cache/audiobooks/<канал>-raw.json — имена файлов; .cache/telegram/<канал>.json —
// `media` с длительностью, исполнителем и названием, с 25.10). Автор и название — из исполнителя и названия аудио,
// иначе из имени файла («Автор_Название[_Часть_N_из_M|_Целиком].mp3» или «Автор - Название.mp3»), граница
// автор/название — по авторам из подписей («Автор - НАЗВАНИЕ»), иначе первые два слова. Подпись поста (своя) даёт
// жанр (#тег), вид и год («Рассказ, 1950 год»), цикл («цикл «…»») и аннотацию. Части одного романа — одна запись.
//   npx tsx tools/audio-readings.mts [--dry]
// Пишет src/mocks/audioReadings.ts (грузится лениво, со страницей голоса). Каналы — только своё прочтение (не pirate).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { bookBase } from '../src/mocks/bookBase.ts';
import type { Post } from './telegram-export.mts';

const CHANNELS = [{ u: 'chitalnya5', title: 'Читальня', reader: 'Александр Большешальский' }];

interface RawPost { id: number; date: string; text: string; attachments?: { mime: string; size?: number; file_name?: string | null }[] }
export interface AudioReading {
  post: number; parts?: number[]; date: string; author: string; title: string; original?: string;
  kind?: 'рассказ' | 'повесть' | 'роман' | 'сборник'; year?: number; cycle?: string; genre?: string; about?: string;
  minutes?: number; workId?: string;
}

const LAT: Record<string, string> = { a: 'а', c: 'с', e: 'е', o: 'о', p: 'р', x: 'х', y: 'у', A: 'А', C: 'С', E: 'Е', O: 'О', P: 'Р', X: 'Х', B: 'В', H: 'Н', K: 'К', M: 'М', T: 'Т' };
/** латиница-двойник внутри кириллического слова («Cтаyт») → кириллица */
const unLat = (s: string) => s.replace(/\S+/g, (w) => (/[а-яё]/i.test(w) ? w.replace(/[aceopxyACEOPXBHKMT]/g, (c) => LAT[c]) : w));
const cap = (w: string) => (w.length <= 1 ? w : w[0].toLocaleUpperCase('ru') + w.slice(1).toLocaleLowerCase('ru'));
/** «ЭРЛ СТЕНЛИ ГАРДНЕР» → «Эрл Стенли Гарднер», «П Г Вудхаус» → «П. Г. Вудхаус» */
export const normAuthor = (s: string) => unLat(s).replace(/\./g, ' ').split(/\s+/).filter(Boolean)
  .map((w) => (w.length === 1 ? `${w.toLocaleUpperCase('ru')}.` : /^[А-ЯЁA-Z-]+$/.test(w) || /^[а-яё]/.test(w) ? cap(w) : w)).join(' ');
/** заглавными — в обычный регистр: «БАРХАТНЫЕ КОГОТКИ» → «Бархатные коготки» */
export const normTitle = (s: string) => {
  const t = unLat(s).replace(/\s+/g, ' ').trim().replace(/[!.]+$/, '');
  // заглавными — большинство букв («КАПКАН и АБСОЛЮТНЫЙ СЛУХ»: союз набран строчными)
  const letters = t.replace(/[^А-ЯЁа-яёA-Za-z]/g, '');
  const upper = letters.replace(/[^А-ЯЁA-Z]/g, '').length;
  return letters.length > 3 && upper / letters.length > 0.8 ? cap(t) : t;
};
const surname = (a: string) => a.split(' ').at(-1)!.toLocaleLowerCase('ru').replace(/ё/g, 'е');
const key = (s: string) => s.toLocaleLowerCase('ru').replace(/ё/g, 'е').replace(/[^а-яa-z0-9]+/g, ' ').trim();

/** имя файла → автор, название, часть, «целиком»; `authors` — известные авторы (из подписей), самые длинные первыми */
export function parseFileName(file: string, authors: string[]): { author: string; title: string; part?: [number, number]; whole: boolean } | undefined {
  let s = file.replace(/\.mp\d?$/i, '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  const part = /\s+Часть\s+(\d+)\s+из\s+(\d+)$/i.exec(s);
  if (part) s = s.slice(0, part.index);
  const whole = /\s+(?:Роман\s+)?целиком!?$/i.test(s);
  s = s.replace(/\s+(?:Роман\s+)?целиком!?$/i, '');
  let author: string | undefined, title: string | undefined;
  const dash = /^(.+?)\s+[-—]\s+(.+)$/.exec(s);
  // тире внутри названия («Альфред Бестер ВРЕМЯ — ПРЕДАТЕЛЬ»): слева от тире — известный автор и ещё слова
  const known = dash && authors.find((a) => key(unLat(dash[1])).startsWith(`${key(a)} `));
  // слово заглавными после имени и фамилии — уже название («Альфред Бестер ВРЕМЯ — ПРЕДАТЕЛЬ»)
  const lw = dash ? dash[1].split(' ') : [];
  const capsAt = lw.findIndex((w, i) => i >= 2 && w.length > 1 && /^[А-ЯЁA-Z]+$/.test(unLat(w)));
  if (dash && capsAt > 0) { author = lw.slice(0, capsAt).join(' '); title = `${lw.slice(capsAt).join(' ')} — ${dash[2]}`; }
  else if (dash && !known) { author = dash[1]; title = dash[2]; } else {
    const low = key(unLat(s));
    const hit = authors.find((a) => low.startsWith(`${key(a)} `));
    if (hit) { const n = hit.replace(/\./g, ' ').split(/\s+/).filter(Boolean).length; const w = s.replace(/\./g, '. ').split(/\s+/).filter(Boolean); author = w.slice(0, n).join(' '); title = w.slice(n).join(' '); }
    else { const w = s.split(' '); if (w.length < 3) return undefined; author = w.slice(0, 2).join(' '); title = w.slice(2).join(' '); }
  }
  if (!author || !title) return undefined;
  return { author: normAuthor(author), title: normTitle(title), ...(part ? { part: [Number(part[1]), Number(part[2])] as [number, number] } : {}), whole };
}

/** подпись поста: жанр, вид, год, цикл, оригинал, аннотация */
export function parseCaption(text: string): Partial<AudioReading> & { author?: string } {
  const out: Partial<AudioReading> & { author?: string } = {};
  const genre = /#([А-Яа-яЁё]+)/.exec(text)?.[1]?.toLocaleLowerCase('ru');
  if (genre && !/подборка/.test(genre)) out.genre = genre.replace('дететкив', 'детектив');
  const body = text.split(/\n_{2,}\n/)[0];
  const lines = body.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  // начало строки — до первой буквы (эмодзи, «👽 »); \W в JS считает кириллицу «не словом» и съедал имя
  const head = /^[^\p{L}]*(\p{Lu}[^-—\n]{2,40}?)\s+[-—]\s+(.+)$/u.exec(lines[0] ?? '');
  let rest = lines;
  if (head) {
    out.author = normAuthor(head[1]);
    const orig = /\(([A-Za-z][^)]+)\)/.exec(head[2]);
    if (orig) out.original = orig[1].trim();
    out.title = normTitle(head[2].replace(/\([^)]*\)/g, '').replace(/[\p{Extended_Pictographic}️]/gu, ''));
    rest = lines.slice(1);
  }
  for (const l of rest.slice(0, 3)) {
    const kind = /^(рассказ|повесть|роман|сборник)/i.exec(l)?.[1]?.toLocaleLowerCase('ru') as AudioReading['kind'] | undefined;
    const year = /(1[89]\d\d|20[0-2]\d)\s*год/.exec(l)?.[1];
    const cycle = /цикл[а-я]*\s*[«"]([^»"]+)[»"]/i.exec(l)?.[1];
    if (kind || year || cycle) {
      if (kind) out.kind = kind;
      if (year) out.year = Number(year);
      if (cycle) out.cycle = cycle;
      rest = rest.filter((x) => x !== l);
    } else if (!out.original && /^[A-Za-z][A-Za-z ,.'’:!?-]{3,}$/.test(l)) { out.original = l; rest = rest.filter((x) => x !== l); }
  }
  // служебное в подписи — не аннотация: «Другие названия: …», «[п/п H.B.Ogden]» (подстрочник)
  const about = rest.filter((l) => !/^(другие названия|\[п\/п)/i.test(l)).join(' ').replace(/\[п\/п[^\]]*\]\s*/gi, '').replace(/\s+/g, ' ').trim();
  if (about && head) out.about = about.slice(0, 400);
  return out;
}

const books = bookBase.map((b) => ({ id: b.id, t: key(b.title), o: b.originalTitle ? key(b.originalTitle) : undefined, s: new Set((b.creators ?? []).map(surname)) }));
/** точное совпадение названия (или оригинала) и фамилии автора — без «цикл вместо вещи» */
const workOf = (r: AudioReading): string | undefined => {
  const t = key(r.title), o = r.original ? key(r.original) : undefined, s = surname(r.author);
  return books.find((b) => b.s.has(s) && (b.t === t || (o && b.o === o)))?.id;
};
// рассказы, найденные в Wikidata (tools/audio-wikidata.mts) и заведенные книгами 26.10 (слово владельца «заводи»,
// .cache/book-lists/chitalnya-2610.json): запись сводится с книгой по элементу, когда название разошлось с переводом
const ids = new Set(bookBase.map((b) => b.id));
const byPost = new Map<string, string>();
if (existsSync('.cache/outreach/audio-wikidata-2510.json')) {
  for (const x of JSON.parse(readFileSync('.cache/outreach/audio-wikidata-2510.json', 'utf8')) as { channel: string; post: number; q?: string }[]) {
    if (x.q && ids.has(`b-wd${x.q.slice(1)}`)) byPost.set(`${x.channel}:${x.post}`, `b-wd${x.q.slice(1)}`);
  }
}

const out: Record<string, { reader?: string; title?: string; readings: AudioReading[] }> = {};
for (const ch of CHANNELS) {
  const rawPath = `.cache/audiobooks/${ch.u}-raw.json`;
  if (!existsSync(rawPath)) { console.error(`${ch.u}: нет ${rawPath}`); continue; }
  const raw = JSON.parse(readFileSync(rawPath, 'utf8')) as RawPost[];
  const exp = existsSync(`.cache/telegram/${ch.u}.json`) ? JSON.parse(readFileSync(`.cache/telegram/${ch.u}.json`, 'utf8')) as { name?: string; posts: Post[] } : undefined;
  const media = new Map((exp?.posts ?? []).filter((p) => p.media).map((p) => [p.id, p.media!]));
  const audio = raw.filter((p) => p.attachments?.some((a) => a.mime.startsWith('audio/')));
  const caps = new Map(audio.filter((p) => p.text).map((p) => [p.id, parseCaption(p.text)]));
  // известные авторы — из подписей и из имён файлов с дефисом («П.Г. Вудхаус - День Лютика.mp3»): по ним режем «П_Г_Вудхаус_…»
  const dashed = audio.flatMap((p) => p.attachments!.filter((a) => a.mime.startsWith('audio/') && a.file_name && /\s[-—]\s/.test(a.file_name))
    .map((a) => parseFileName(a.file_name!, [])?.author));
  const authors = [...new Set([...[...caps.values()].map((c) => c.author), ...dashed].filter((a): a is string => Boolean(a) && a!.includes(' ')))]
    .sort((a, b) => b.length - a.length);
  const items: (AudioReading & { part?: [number, number] })[] = [];
  let skipped = 0;
  for (const p of audio) {
    const file = p.attachments!.find((a) => a.mime.startsWith('audio/'))!;
    const m = media.get(p.id);
    const fromFile = file.file_name ? parseFileName(file.file_name, authors) : undefined;
    const c = caps.get(p.id) ?? {};
    // исполнитель и название аудио (шлюз, 25.10) — у этого канала исполнитель — чтец, поэтому только название
    const author = c.author ?? fromFile?.author;
    const title = c.title ?? fromFile?.title ?? (m?.title ? normTitle(m.title) : undefined);
    if (!author || !title) { skipped++; continue; }
    items.push({
      post: p.id, date: p.date.slice(0, 10), author, title,
      ...(c.original ? { original: c.original } : {}), ...(c.kind ? { kind: c.kind } : fromFile?.whole || fromFile?.part ? { kind: 'роман' as const } : {}),
      ...(c.year ? { year: c.year } : {}), ...(c.cycle ? { cycle: c.cycle } : {}), ...(c.genre ? { genre: c.genre } : {}),
      ...(c.about ? { about: c.about } : {}), ...(m?.duration ? { minutes: Math.round(m.duration / 60) } : {}),
      ...(fromFile?.part ? { part: fromFile.part } : {}),
    });
  }
  // авторы — одно написание на фамилию (самое частое): «Рекс Стаут» и «Рекс Cтаyт» — один человек
  const forms = new Map<string, Map<string, number>>();
  for (const r of items) { const f = forms.get(surname(r.author)) ?? new Map(); f.set(r.author, (f.get(r.author) ?? 0) + 1); forms.set(surname(r.author), f); }
  const canon = new Map([...forms].map(([s, f]) => [s, [...f].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)[0][0]]));
  // части романа — одна запись: пост первой части, остальные — `parts`, длительность — сумма
  const readings: AudioReading[] = [];
  const multi = new Map<string, AudioReading>();
  for (const r of items.sort((a, b) => a.post - b.post)) {
    r.author = canon.get(surname(r.author)) ?? r.author;
    const { part, ...rest } = r;
    if (part) {
      const k = `${surname(r.author)}|${key(r.title)}`;
      const head = multi.get(k);
      if (head) { head.parts = [...(head.parts ?? [head.post]), r.post]; if (rest.minutes) head.minutes = (head.minutes ?? 0) + rest.minutes; continue; }
      const first = { ...rest, parts: [r.post] };
      multi.set(k, first); readings.push(first); continue;
    }
    readings.push(rest);
  }
  for (const r of readings) { if (r.parts?.length === 1) delete r.parts; const w = workOf(r) ?? byPost.get(`${ch.u}:${r.post}`); if (w) r.workId = w; }
  out[ch.u] = { reader: ch.reader, title: ch.title, readings };
  const byAuthor = new Map<string, number>();
  for (const r of readings) byAuthor.set(r.author, (byAuthor.get(r.author) ?? 0) + 1);
  console.log(`${ch.u}: аудио ${audio.length}, записей ${readings.length} (частями ${readings.filter((r) => r.parts).length}), без автора/названия ${skipped}, с длительностью ${readings.filter((r) => r.minutes).length}, в каталоге ${readings.filter((r) => r.workId).length}, авторов ${byAuthor.size}`);
  console.log('  ' + [...byAuthor].sort((a, b) => b[1] - a[1]).slice(0, 14).map(([a, n]) => `${a} ${n}`).join(' · '));
}
if (!process.argv.includes('--dry')) {
  writeFileSync(new URL('../src/mocks/audioReadings.ts', import.meta.url),
    `// Сгенерировано tools/audio-readings.mts — руками не править. Записи аудиоканалов (своё прочтение): канал → чтец и
// записи (пост, части, автор, название, вид, год, цикл, жанр, аннотация, минуты, workId — книга каталога при точном
// совпадении). В подбор не идут; грузится лениво, со страницей голоса (25.10).
export interface AudioReading {
  post: number; parts?: number[]; date: string; author: string; title: string; original?: string;
  kind?: 'рассказ' | 'повесть' | 'роман' | 'сборник'; year?: number; cycle?: string; genre?: string; about?: string;
  minutes?: number; workId?: string;
}

export const audioReadings: Record<string, { reader?: string; title?: string; readings: AudioReading[] }> = ${JSON.stringify(out)};
`);
}
