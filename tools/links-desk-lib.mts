// Пульт ссылок (tools/links-desk.mts), чистая часть: что в вставленном тексте — ролики к фильмам и
// каналы — и к какому фильму относится ролик. Сеть и запись — в links-desk.mts.
//
// Текст — как угодно накопленные заметки: ссылка с названием в одной строке («Дюна (2021) —
// https://youtu.be/…»), название строкой выше и ссылки под ним, просто ссылки подряд. Правила:
//   · строка с текстом и ссылками на ролики — фильм для этих роликов;
//   · строка только с текстом — фильм для роликов ниже, пока не встретится другой;
//   · строка-заголовок раздела («Обзорщики:», «Эссеисты», «Книжные каналы») — подсказка яруса
//     и предмета для каналов ниже, а фильм сбрасывается;
//   · ссылка на канал (@ник, /channel/, /c/, /user/) — канал; ролик без фильма — фильм угадаем по
//     названию ролика (links-desk.mts, тем же сопоставителем, что и индекс разборов).
import { normalizeTitle } from '../src/lib/import/match.ts';

/** Вид ошибки опознавателя (02.10, разметка владельца): заголовком раздела заметок («# не тот фильм»)
 *  или хэштегом у строки (#нетот, #нефильм, #несколько). Те же три значения — колонка «Ошибка» таблицы. */
export type MarkupError = 'не тот фильм' | 'не фильм' | 'несколько фильмов';
export function errorOf(text: string): MarkupError | undefined {
  const t = text.toLowerCase().replace(/ё/g, 'е');
  if (/не\s*тот|#нетот/.test(t)) return 'не тот фильм';
  if (/не\s*фильм|не\s*про\s*фильм|#нефильм/.test(t)) return 'не фильм';
  if (/несколько|#несколько|#многофильм/.test(t)) return 'несколько фильмов';
  return undefined;
}
/** строка-раздел вида ошибки: «# не фильм», «## Несколько фильмов», «#нетот» */
const ERROR_SECTION = /^#+\s*(?:не\s*тот|не\s*фильм|не\s*про\s*фильм|несколько)|^#(?:нетот|нефильм|несколько)\b/iu;

export interface PastedVideo { id: string; url: string; film?: string; year?: number; line: number; err?: MarkupError }
export interface PastedChannel { handle?: string; channelId?: string; url: string; tier?: 'essay' | 'review'; medium?: 'film' | 'book'; line: number }
export interface Pasted { videos: PastedVideo[]; channels: PastedChannel[]; other: string[] }

const URL_RE = /https?:\/\/[^\s<>"'«»)\]]+/giu;
const VIDEO = /(?:youtube\.com\/(?:watch\?(?:[^#\s]*&)?v=|shorts\/|live\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/i;
const CHANNEL = /youtube\.com\/(?:@([^/?#\s]+)|channel\/(UC[\w-]{22})|c\/([^/?#\s]+)|user\/([^/?#\s]+))/i;
// заголовок раздела: короткая строка про каналы, а не про фильм
const SECTION = /^(?:ещ[её]\s+)?(?:\d+\s+)?(?:топ\p{L}*|лучш\p{L}*|фильмы|сериалы|подборк\p{L}*|список|каналы?|обзорщик\p{L}*|эссеист\p{L}*|разборщик\p{L}*|блогер\p{L}*|книжн\p{L}*|авторы?)(?:\s+\p{L}+){0,4}\s*:?$/iu;

/** Текст строки без ссылок и украшений: «1. Дюна (2021) — » → «Дюна (2021)». */
const cleanText = (line: string): string => line.replace(URL_RE, ' ')
  .replace(/^[\s>*•·\-–—\d.)]+/u, '').replace(/[\s:–—\-|,;]+$/u, '').replace(/\s+/g, ' ').trim();

/** «Дюна (2021)», «Дюна 2021», «Дюна, 2021» → название и год. */
export function splitYear(text: string): { title: string; year?: number } {
  const m = /^(.*?)[\s,(]+((?:19|20)\d{2})\)?$/u.exec(text.trim());
  return m && m[1].trim() ? { title: m[1].trim(), year: Number(m[2]) } : { title: text.trim() };
}

function sectionHint(text: string): Pick<PastedChannel, 'tier' | 'medium'> {
  return {
    ...(/обзор/i.test(text) ? { tier: 'review' as const } : /эссе|разбор/i.test(text) ? { tier: 'essay' as const } : {}),
    ...(/книж|книг|литератур/i.test(text) ? { medium: 'book' as const } : {}),
  };
}

export function parsePaste(text: string): Pasted {
  const out: Pasted = { videos: [], channels: [], other: [] };
  let film: string | undefined;
  let hint: Pick<PastedChannel, 'tier' | 'medium'> = {};
  let err: MarkupError | undefined;
  const seenV = new Set<string>(), seenC = new Set<string>();
  text.split(/\r?\n/).forEach((raw, i) => {
    const urls = [...raw.matchAll(URL_RE)].map((m) => m[0]);
    // строка, скопированная из таблицы разметки (ссылка, фильм, заголовок, канал, дата через табуляцию):
    // фильм — первая ячейка после ссылки; без табуляции — «Название (год)» в начале текста
    const cells = raw.split('\t').map((c) => c.trim()).filter((c) => c && !/^https?:\/\//i.test(c));
    const fromTable = urls.length && cells.length >= 2 ? cells[0] : undefined;
    const lead = urls.length && !fromTable ? /^(.+?\((?:сериал,\s*)?(?:19|20)\d{2}\))/u.exec(cleanText(raw))?.[1] : undefined;
    const words = fromTable ?? lead ?? cleanText(raw);
    const tagged = urls.length ? errorOf(raw.replace(URL_RE, ' ').match(/#\p{L}+/gu)?.join(' ') ?? '') : undefined;
    if (!urls.length) {
      if (!words) return;
      if (ERROR_SECTION.test(raw.trim())) { err = errorOf(raw); film = undefined; return; }
      if (SECTION.test(words)) { hint = sectionHint(words); film = undefined; return; }
      film = words;
      return;
    }
    const lineFilm = words && !SECTION.test(words) ? words : undefined;
    // «Носферату 2024: ссылка», а под ней ссылки без названия — тоже к «Носферату»
    if (lineFilm && urls.some((u) => VIDEO.test(u))) film = lineFilm;
    for (const url of urls) {
      const v = VIDEO.exec(url);
      if (v) {
        if (seenV.has(v[1])) continue;
        seenV.add(v[1]);
        const name = lineFilm ?? film;
        // ярлык сериала из таблицы («Дом Дракона (сериал, 2022)») — целиком: matchFilm узнаёт его как есть
        const { title, year } = !name ? { title: undefined, year: undefined }
          : /\(сериал,\s*(?:19|20)\d{2}\)$/u.test(name) ? { title: name, year: undefined } : splitYear(name);
        const e = tagged ?? err;
        out.videos.push({ id: v[1], url: `https://www.youtube.com/watch?v=${v[1]}`, ...(title ? { film: title } : {}), ...(year ? { year } : {}), line: i + 1, ...(e ? { err: e } : {}) });
        continue;
      }
      const c = CHANNEL.exec(url);
      if (c) {
        const handle = c[1] ? decodeURIComponent(c[1]) : c[3] ?? c[4];
        const key = (c[2] ?? handle ?? '').toLowerCase();
        if (!key || seenC.has(key)) continue;
        seenC.add(key);
        out.channels.push({ ...(handle ? { handle } : {}), ...(c[2] ? { channelId: c[2] } : {}),
          url: c[2] ? `https://www.youtube.com/channel/${c[2]}` : `https://www.youtube.com/@${handle}`, ...hint, line: i + 1 });
        continue;
      }
      out.other.push(url);
    }
  });
  return out;
}

export interface FilmOption { key: string; label: string; title: string; year?: number }

/** Фильм по названию из заметок: точный ярлык («Дюна (2021)»), иначе название (и год, если есть).
 *  Один кандидат — он; несколько — `options`, человек выберет. */
export function matchFilm(name: string, year: number | undefined, films: FilmOption[]): { pick?: FilmOption; options: FilmOption[] } {
  const exact = films.find((f) => f.label.toLowerCase() === name.toLowerCase() || (year && f.label.toLowerCase() === `${name} (${year})`.toLowerCase()));
  if (exact) return { pick: exact, options: [exact] };
  const n = normalizeTitle(name);
  if (!n) return { options: [] };
  let same = films.filter((f) => normalizeTitle(f.title) === n);
  if (year) {
    // год назван, а у тёзок он другой — это не они («Неуязвимый» 2021-го — сериал, а у нас фильм 2000-го)
    const near = same.filter((f) => f.year && Math.abs(f.year - year) <= 1);
    if (!near.length) return { options: same.slice(0, 8) };
    same = near;
  }
  if (same.length === 1) return { pick: same[0], options: same };
  if (same.length) return { options: same.slice(0, 8) };
  const starts = films.filter((f) => normalizeTitle(f.title).startsWith(n) || n.startsWith(normalizeTitle(f.title) || '\u0000'));
  return { options: starts.slice(0, 8) };
}

/** Список фильмов и сериалов с ярлыками «Название (год)» / «Название (сериал, год)» — то же правило,
 *  что у таблицы разметки (tools/markup-xlsx.mts) и опознавателя (resolve-markup-films.mts). */
export function filmOptions(works: { key: string; work: { title: string; year?: number; type: string } }[]): FilmOption[] {
  const seen = new Map<string, number>();
  return works.filter((w) => w.key.startsWith('tmdb:') || w.key.startsWith('imdb:'))
    .map((w) => ({ key: w.key, title: w.work.title, year: w.work.year || undefined, series: w.work.type === 'series' }))
    .sort((a, b) => a.title.localeCompare(b.title, 'ru') || (a.year ?? 0) - (b.year ?? 0))
    .map((f) => {
      const base = f.series ? (f.year ? `${f.title} (сериал, ${f.year})` : `${f.title} (сериал)`) : f.year ? `${f.title} (${f.year})` : f.title;
      const n = (seen.get(base) ?? 0) + 1;
      seen.set(base, n);
      return { key: f.key, label: n === 1 ? base : `${base} #${n}`, title: f.title, ...(f.year ? { year: f.year } : {}) };
    });
}

/** Строка реестра src/mocks/sources.ts для нового канала. */
export function sourceLine(c: { handle: string; title: string; tier: 'essay' | 'review'; medium?: 'film' | 'book' }): string {
  // ник кириллицей («глаз_дракона») — транслитом: иначе id выходил общий «src-channel» (01.10)
  const TR: Record<string, string> = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'i', к: 'k', л: 'l',
    м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '',
    э: 'e', ю: 'yu', я: 'ya' };
  const slug = [...c.handle.toLowerCase()].map((ch) => TR[ch] ?? ch).join('').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    || `channel-${[...c.handle].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7).toString(36)}`;
  const q = (x: string) => `'${x.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  return `  { id: ${q(`src-${slug}`)}, title: ${q(c.title.trim())}, handle: ${q(c.handle)}, platform: 'youtube', url: ${q(`https://www.youtube.com/@${c.handle}`)}, role: 'voice', kind: 'channel', tier: '${c.tier}'${c.medium === 'book' ? ", medium: 'book'" : ''} },`;
}

/** Названо ли произведение в заголовке ролика — для пометки «проверьте»: фильм взят из заметок
 *  строкой выше, а ролик, похоже, про другое. Сравниваются основы слов названия длиннее трёх букв. */
export function titleMentions(videoTitle: string, filmTitle: string): boolean {
  const words = (s: string) => normalizeTitle(s).split(' ').filter((w) => w.length > 3).map((w) => w.slice(0, Math.max(4, w.length - 2)));
  const want = words(filmTitle);
  if (!want.length) return true;
  const have = normalizeTitle(videoTitle);
  return want.some((w) => have.includes(w));
}
