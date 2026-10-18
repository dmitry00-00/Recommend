// Опознание названий из просьб Telegram (18.10): название от модели → ключ справочника, с оглядкой на текст сообщения
// и ветки. Прежде tg-asks брал общий узнаватель (tools/llm-lib.mts resolver): точное название и год, тёзки — по
// числу материалов (.cache/llm/lenses.json), а его почти ни у кого нет. Замер 17.10: из 301 ненайденного советуемого
// названия 80 есть в справочнике под тем же названием — почти все тёзки без года («Пленницы» 2013 и 1952, «Бэмби»
// 1942 и 2013, «Офис» 2005 и 2001), ещё 20 — под другим («Форест Гамп», «Лост», «Уэнсдей»), а «Извне» уходило к фильму
// 1986-го, хотя ветка — о сериале 2022-го. Здесь:
//   имена — название, оригинал, варианты индекса (без кавычек, латиница кириллицей) и альтернативные названия
//     (.cache/alt-titles.json, Wikidata); запасные ступени — без «сериал/фильм» впереди, по основам слов (опечатки
//     падежа: «Стажера», «Ста лет одиночества» — без морфологии, отрезаем окончание);
//   вид — сперва слово рядом с названием в самом сообщении («сериал пугало»), потом то же в других сообщениях ветки
//     («Извне и ОСД … оба сериала»), потом вид от модели, потом вид, о котором просят в посте; книги не берём вовсе;
//   год — как прежде (±1); год, которого нет в тексте (модель додумала), уступает режиссёру, названному в тексте;
//   тёзки — режиссёр в тексте, затем известность: разделы Википедии (.cache/fame-wd.json, как у tools/build-fame.mts),
//     уровень src/mocks/fame.ts, число материалов; первый должен заметно обгонять второго, иначе — никого;
//   ловушки — название из одного обычного слова («Офис», «Жить», «Пугало», «Извне»): засчитываем только с
//     подтверждением — кавычки, заглавная посреди фразы, слово вида рядом, вид просьбы совпал, режиссёр или год в тексте.
// Модуль без чтения файлов — данные передаёт tools/tg-asks.mts, проверка — tools/tg-asks-test.mts.
import type { IndexedWork } from './works-index.mts';
import type { LlmWork } from './llm-lib.mts';

export type Kind = 'film' | 'series';
export interface Cand { key: string; title: string; year?: number; kind: Kind; creators: string[]; score: number }
export interface Ctx {
  /** текст сообщения, из которого модель взяла название */
  text: string;
  /** пост-просьба (для ответа) — о чём просили: фильм, сериал */
  parent?: string;
  /** вид, который другие сообщения ветки называют рядом с этим же названием (`threadKinds`) */
  thread?: Kind;
  /** год сообщения — для свежести тёзок */
  year?: number;
}
export interface Match { key?: string; options: Cand[]; why: string }
export interface MatchData {
  /** альтернативные названия по ключу (.cache/alt-titles.json) */
  alt?: Record<string, string[]>;
  /** известность карточки: чем больше, тем громче (разделы Википедии; без них — уровень fame × 20) */
  fame?: (w: IndexedWork['work']) => number;
  /** сколько постов корпуса пишут слово строчными — мерило «обычного слова» (`commonWords`) */
  common?: (word: string) => number;
}

// ─── нормализация ─────────────────────────────────────────────────────────────
/** как `norm` из llm-lib: регистр, ё/е, кавычки и знаки — прочь */
export const fold = (s: string): string => s.toLowerCase().replace(/ё/g, 'е')
  .replace(/[«»"“”„'’`]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
/** «сериал Джентельмены», «аниме Нана», «Офис 2 сезон» — вид и сезон вокруг названия модель иногда оставляет в нём */
const bare = (s: string): string => fold(s)
  .replace(/^(?:сериал|фильм|мультфильм|мультсериал|мультик|мульт|аниме|дорама|кино|док|документалка)\s+/u, '')
  .replace(/\s+(?:\d{1,2}\s+)?(?:сезон|часть|серия|сезоны)(?:\s+\d{1,2})?$/u, '').trim();
/** основа слова: окончание падежа прочь (без морфологии — грубо, поэтому только запасной ступенью) */
const stemWord = (w: string): string => (w.length >= 5 && /\p{Script=Cyrillic}/u.test(w) ? w.replace(/[аеиоуыэюяйь]{1,2}$/u, '') : w);
const stems = (s: string): string => fold(s).split(' ').map(stemWord).join(' ');

/** слова вида в речи: «сериал», «сезон», «серии» — сериал; «фильм», «кино», «мульт» — фильм */
const SERIES_RE = /(?<!\p{L})(?:сериал|мультсериал|сезон|серии|серий|сериях|серию|эпизод|дорам)\p{L}*/giu;
const FILM_RE = /(?<!\p{L})(?:фильм|кино(?!театр)|мультфильм|мульт(?!сериал)|полнометраж|короткометраж)\p{L}*/giu;
const kindsIn = (s: string): Set<Kind> => {
  const out = new Set<Kind>();
  if (s.match(SERIES_RE)) out.add('series');
  if (s.match(FILM_RE)) out.add('film');
  return out;
};
/** о чём просят в посте: только сериал или только фильм; «фильм или сериал» — ничего */
export function askKind(text: string | undefined): Kind | undefined {
  if (!text) return undefined;
  const k = kindsIn(text);
  return k.size === 1 ? [...k][0] : undefined;
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** где в тексте написано название — все места: слова по основам, левая граница закрыта (кириллица тоже), правая открыта
 *  под склонение — «Семьянина», «извне», «Пленницы» (в JS \w кириллицы не знает — граница через \p{L}). Все, а не
 *  первое: в «нехватка только времени … похожий на этот " Время"» первое «врем…» — обычное слово, а второе — название */
export function findTitles(text: string, title: string): { at: number; raw: string }[] {
  const words = fold(title).split(' ').filter(Boolean);
  if (!words.length) return [];
  const src = text.replace(/ё/g, 'е').replace(/Ё/g, 'Е');
  const re = new RegExp(`(?<![\\p{L}\\p{N}])${words.map((w) => esc(stemWord(w)) + '\\p{L}{0,4}').join('[\\s\\p{P}]{1,3}')}(?![\\p{L}\\p{N}])`, 'giu');
  return [...src.matchAll(re)].map((m) => ({ at: m.index!, raw: text.slice(m.index!, m.index! + m[0].length) }));
}
export const findTitle = (text: string, title: string) => findTitles(text, title)[0];

const KIND_WORD = /(?:сериал|мультсериал|фильм|кино|мультфильм|мульт|мультик|аниме|дорам)\p{L}*/u;
/** вид, названный рядом с названием: «сериал пугало корейский», «Извне и ОСД … оба сериала», «фильм «Жить»».
 *  До названия — слово вида вплотную («сериал Офис», «фильм "Жить"»): «сериал или фильм похожий на «Беспринципные»» —
 *  не про вид «Беспринципных». После — своя часть фразы до запятой: в «Проект конец света, Выход 8, мини сериал
 *  Исчезнувший» сериал — только последний; но «…, оба сериала» / «…, это сериал» — про сказанное до запятой. */
export function kindNear(text: string, title: string): Kind | undefined {
  const k = new Set<Kind>();
  for (const f of findTitles(text, title)) {
    const pre = text.slice(Math.max(0, f.at - 30), f.at);
    const m = new RegExp(`(${KIND_WORD.source})\\s*[«"„“'‘]?\\s*$`, 'iu').exec(pre);
    if (m) kindsIn(m[1]).forEach((x) => k.add(x));
    const clause = text.slice(f.at + f.raw.length, f.at + f.raw.length + 50).split(/[.!?\n;]/)[0] ?? '';
    const parts = clause.split(',');
    const after = parts[0] + (parts.length > 1 && /^\s*(?:оба|обе|все|это|тоже|тот|та|те)(?!\p{L})/iu.test(parts[1]) ? `,${parts[1]}` : '');
    kindsIn(after).forEach((x) => k.add(x));
  }
  return k.size === 1 ? [...k][0] : undefined;
}

/** сильная форма названия в тексте (хотя бы в одном месте): кавычки (и «,,гостья,,»), заглавная посреди фразы, капс,
 *  год рядом; пункт списка — название между запятыми, с новой строки, после номера («бумажный дом, Мерлин, мышь, 5:32»);
 *  сообщение целиком из названия («Вечность», «Бункер») */
export function strongForm(text: string, title: string): boolean {
  if (fold(text) === fold(title)) return true;
  for (const f of findTitles(text, title)) {
    const pre = text.slice(0, f.at);
    const post = text.slice(f.at + f.raw.length);
    if (/(?:[«"„“'‘]|,,)\s*$/u.test(pre) || /^\s*(?:[»"“”'’]|,,)/u.test(post)) return true;
    if (f.raw.length >= 3 && f.raw === f.raw.toUpperCase() && /\p{Lu}/u.test(f.raw)) return true;
    if (/^\s*\(?\s*(?:19|20)\d\d(?!\d)/.test(post)) return true;
    // заглавная не в начале фразы
    if (/^\p{Lu}/u.test(f.raw) && /\p{L}[\s,]*$/u.test(pre) && !/[.!?…\n]\s*$/u.test(pre)) return true;
    // пункт списка: слева начало, запятая, новая строка, номер или маркер; справа запятая, конец, скобка с пояснением
    if (/(?:^|[,;\n•·—-]|\d[.)])\s*(?:и\s+)?$/u.test(pre) && /^\s*(?:[,;\n()]|\s[—-]|[^\p{L}\p{N}]*$)/u.test(post) && (/[,;\n]/.test(pre + post.slice(0, 3)) || /\d[.)]\s*$/.test(pre))) return true;
  }
  return false;
}

/** отрицание рядом с названием в просьбе: «сумерки не надо!!!», «только не Сумерки», «кроме Офиса», «X не предлагать» —
 *  это не якорь «понравилось» (coordinator, 18.10) */
export function negated(text: string, title: string): boolean {
  // «кроме X» — мягкое отрицание: «кроме "сияние"» — не якорь, но если X в посте назван и без «кроме» («Дочь — фанатка
  // Гарри Поттера … что кроме Гарри Поттера посмотреть») — якорь. Твёрдое («не надо», «не предлагайте», «без») — всегда
  const marks = findTitles(text, title).map((f) => {
    const pre = text.slice(Math.max(0, f.at - 25), f.at);
    const post = text.slice(f.at + f.raw.length, f.at + f.raw.length + 80);
    // «кроме Гарри Поттера вообще ничего не читает» — «кроме … ничего» значит «только»
    if (/кроме\s*[«"„“']?\s*$/iu.test(pre) && /^[^.!?\n]{0,40}(?<!\p{L})(?:ничего|никого|ни\s)/iu.test(post)) return 'none';
    const hard = /(?:^|[^\p{L}])(?:только\s+не|но\s+не|без|не\s+надо|не\s+предлагать|не\s+предлагайте|не\s+советуйте|не\s+нужно|не\s+нравится|не\s+понравил\p{L}*|не\s+зашл\p{L}*)\s*[«"„“']?\s*$/iu.test(pre)
      // отрицание в конце перечня относится ко всему перечню: «декстер , ты , менталист , не предлагайте !!!»
      || /^\s*[»"“”']?(?:\s*(?:,|и\s)\s*[^,.!?\n]{1,25}?)*\s*[,!.]*\s*(?<!\p{L})(?:не\s+надо|не\s+предлагать|не\s+предлагайте|не\s+советуйте|не\s+нужно|не\s+понравил\p{L}*|не\s+зашл\p{L}*|не\s+люблю)(?!\p{L})/iu.test(post);
    if (hard) return 'hard';
    // и на весь перечень после «кроме»: «кроме «Пленницы», «Горбатая гора» и «Донни Дарко»»
    const wide = text.slice(Math.max(0, f.at - 90), f.at);
    return /(?:^|[^\p{L}])кроме(?:\s+[^\s,.!?]{1,15})?(?:\s*[«"„“']?[^,.!?\n«»"]{1,30}?[»"“”']?\s*(?:,|\sи\s))*\s*[«"„“']?\s*$/iu.test(wide) ? 'soft' : 'none';
  });
  return marks.includes('hard') || (marks.length > 0 && marks.every((m) => m === 'soft'));
}

/** совет автора просьбы, а не якорь: «Посмотрите сериал Невский, если ещё не смотрели» (анонимка, coordinator 18.10) */
export function offered(text: string, title: string): boolean {
  return findTitles(text, title).some((f) => /(?:посмотрите|посмотри|гляньте|глянь|советую|рекомендую|сами\s+посмотрите)(?!\p{L})[^.!?\n,]{0,25}$/iu.test(text.slice(Math.max(0, f.at - 40), f.at)));
}

// ─── режиссёр в тексте ───────────────────────────────────────────────────────
const CYR: Record<string, string> = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ж: 'zh', з: 'z', и: 'i', й: 'i', к: 'k', л: 'l', м: 'm',
  н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sh', ъ: '', ы: 'i', ь: '', э: 'e',
  ю: 'iu', я: 'ia' };
/** грубый скелет фамилии для сравнения кириллицы с латиницей: «Куросава» = «Kurosawa», «Рефн» = «Refn» */
const skeleton = (s: string): string => s.toLowerCase().replace(/ё/g, 'е').split('').map((c) => CYR[c] ?? c).join('')
  .replace(/w/g, 'v').replace(/y/g, 'i').replace(/kh/g, 'h').replace(/ck|c(?=[aou])|q/g, 'k').replace(/[^a-z]/g, '').replace(/(.)\1+/g, '$1');
const surname = (name: string): string => skeleton(name.trim().split(/\s+/).pop() ?? '');
function creatorInText(text: string, creators: string[]): boolean {
  const sk = creators.map(surname).filter((s) => s.length >= 4);
  if (!sk.length) return false;
  for (const m of text.matchAll(/\p{L}{4,}/gu)) {
    const w = skeleton(m[0]);
    if (sk.some((s) => w.startsWith(s) && w.length - s.length <= 3)) return true;
  }
  return false;
}

// ─── обычные слова ────────────────────────────────────────────────────────────
/** Сколько постов корпуса пишут слово строчными (слово целиком, ё → е). Корпус — каналы о кино (tools/telegram-channels.json):
 *  названия там пишут с заглавной или в кавычках, а повседневное слово — строчными. Замер 18.10 на 69 703 постах: «жить» 362,
 *  «офис» 125, «извне» 16, «пугало» 10, «ловушка» 10 — и «менталист» 0, «бэмби» 0, «пленницы» 2, «сумерки» 5. */
export function commonWords(texts: Iterable<string>): Map<string, number> {
  const c = new Map<string, number>();
  for (const t of texts) {
    const seen = new Set<string>();
    for (const m of t.replace(/ё/g, 'е').matchAll(/(?<!\p{L})\p{Ll}[\p{Ll}-]{2,}(?!\p{L})/gu)) seen.add(m[0]);
    for (const s of seen) c.set(s, (c.get(s) ?? 0) + 1);
  }
  return c;
}
/** порог ловушки: столько постов строчными (из 69 703) — и слово повседневное. 8: «пугало» 10, «паника» 9 — ловушки,
 *  «аватар» 7, «сумерки» 5, «служанка» 3 — нет */
export const COMMON_MIN = 8;

// ─── опознаватель ────────────────────────────────────────────────────────────
/** насколько первый тёзка должен обгонять второго по известности */
const LEAD = 1.5;
/** ниже этого (разделов Википедии) — «тихий»: тихого среди тёзок не выбираем, даже если второй ещё тише */
const QUIET = 20;
/** ловушку среди тёзок выбираем только громкую: «Связь» 1996 (20) под «фильм связи нет», «Жизнь» 2016 (16) — нет */
const TRAP_LOUD = 30;
/** чужое название тихой вещи часто — название другой, громкой: «Хелтер-Скелтер» — не «Кавардак» 1949-го (4), а фильм
 *  2012-го, которого у нас нет. Ниже этого — только с годом или у сериала */
const ALT_QUIET = 10;

export function matcher(index: IndexedWork[], data: MatchData = {}): (w: LlmWork, ctx: Ctx) => Match {
  const byName = new Map<string, Map<string, Cand>>();
  const byAlt = new Map<string, Map<string, Cand>>();
  const byStem = new Map<string, Map<string, Cand>>();
  const add = (m: Map<string, Map<string, Cand>>, name: string, c: Cand) => {
    if (!name) return;
    const g = m.get(name) ?? new Map<string, Cand>();
    if (!g.has(c.key)) g.set(c.key, c);
    m.set(name, g);
  };
  const seen = new Set<string>();
  for (const { key, work, names } of index) {
    // книги не берём: просьбы — о том, что смотреть («Извне» Лавкрафта, «Анатомия убийства» Трейвера мешали тёзкам)
    if (seen.has(key) || work.type === 'book' || key.startsWith('isbn:')) continue;
    seen.add(key);
    const c: Cand = { key, title: work.title, ...(work.year ? { year: work.year } : {}), kind: work.type === 'series' ? 'series' : 'film',
      creators: work.creators ?? [], score: data.fame?.(work) ?? 0 };
    const own = [work.title, work.originalTitle, ...names].filter((t): t is string => Boolean(t));
    for (const n of own) add(byName, fold(n), c);
    for (const n of data.alt?.[key] ?? []) add(byAlt, fold(n), c);
    // по основам — только названия из двух слов и длиннее: одно слово по основе слипается с чужим («Фотографии» → «Фотограф»)
    for (const n of [...own, ...(data.alt?.[key] ?? [])]) { const s = stems(n); if (s.length >= 5 && s.includes(' ')) add(byStem, s, c); }
  }
  const lookup = (w: LlmWork): { pool: Cand[]; how: string } => {
    const titles = [w.title, w.original].filter((t): t is string => Boolean(t));
    const from = (m: Map<string, Map<string, Cand>>, f: (s: string) => string) =>
      [...new Map(titles.flatMap((t) => [...(m.get(f(t))?.values() ?? [])]).map((c) => [c.key, c])).values()];
    // ступени по очереди: своё название побеждает чужое альтернативное («Генерал» — не «Генерал-паровоз»)
    for (const [m, f, how] of [[byName, fold, 'название'], [byName, bare, 'без вида'], [byAlt, fold, 'другое название'],
      [byAlt, bare, 'другое название'], [byStem, stems, 'по основам']] as const) {
      const pool = from(m, f);
      if (pool.length) return { pool, how };
    }
    return { pool: [], how: '' };
  };
  const isTrap = (w: LlmWork): boolean => {
    const t = bare(w.title);
    return !t.includes(' ') && /\p{Script=Cyrillic}/u.test(t) && (data.common?.(t) ?? 0) >= COMMON_MIN;
  };

  return (w, ctx) => {
    const { pool: found, how } = lookup(w);
    if (!found.length) return { options: [], why: 'нет в справочнике' };
    let pool = found;
    const why: string[] = [how];
    const trap = isTrap(w);
    // вид: слово рядом в сообщении → то же в ветке → модель → просьба
    const near = kindNear(ctx.text, w.title);
    const model: Kind | undefined = w.type === 'series' ? 'series' : w.type === 'film' || w.type === 'cartoon' ? 'film' : undefined;
    const asked = askKind(ctx.parent);
    const want = near ?? ctx.thread ?? model ?? (w.type === 'anime' ? undefined : asked);
    const firm = Boolean(near ?? ctx.thread);
    if (want) {
      const same = pool.filter((c) => c.kind === want);
      // вид модели не нашёлся, а сообщение говорит только о другом: «Анон посоветуйте фильм похожий на бегущий в лабиринте»
      // (модель — сериал)
      const own = !firm && !same.length ? askKind(ctx.text) : undefined;
      const other = own && own !== want ? pool.filter((c) => c.kind === own) : [];
      if (same.length) pool = same;
      else if (other.length && !trap) { pool = other; why.push('вид по сообщению'); }
      // Чужой вид — только «фильм» модели при одном сериале у нас: модель по просьбе «посоветуйте фильм» зовёт фильмом
      // и сериал («Ход королевы», «Шершни»). Наоборот — нет: у русских сериалов тёзки-фильмы («Анатомия убийства» 2013
      // и фильм 1959, «Новичок», «Жить» — сериалы из списка просмотренного), и «сериал» рядом с названием — твёрдо
      // («сериал пугало корейский» — не фильм «Пугало»). Ловушке чужой вид не даём вовсе.
      else if (want === 'film' && !firm && !trap && asked !== 'film') why.push('вид не тот');
      else return { options: found.slice(0, 6), why: `${firm ? 'в тексте' : 'по виду'} ${want === 'series' ? 'сериал' : 'фильм'}, а у нас другое` };
    }
    // аниме у нас — сериалом; фильм на месте аниме — только громкий: «Шарлотта» (аниме 2015) — не фильм «Шарлотта» 2021-го
    if (w.type === 'anime' && !pool.some((c) => c.kind === 'series') && !pool.some((c) => c.score >= QUIET)) {
      return { options: pool.slice(0, 6), why: 'аниме, а у нас тихий фильм' };
    }
    const textYear = (y: number) => new RegExp(`(?<!\\d)${y}(?!\\d)`).test(ctx.text);
    const anyYear = /(?<!\d)(?:19|20)\d\d(?!\d)/.test(ctx.text);
    const byCreator = (cs: Cand[]) => cs.filter((c) => creatorInText(ctx.text, c.creators));
    if (w.year) {
      const near1 = pool.filter((c) => c.year && Math.abs(c.year - w.year!) <= 1);
      if (!near1.length) {
        // год назван моделью, а в тексте его нет — модель могла его додумать («Дилер» Рефна — 1988); верим режиссёру в тексте
        const named = !textYear(w.year) ? byCreator(pool) : [];
        if (named.length === 1) return { key: named[0].key, options: pool.slice(0, 6), why: [...why, 'режиссёр в тексте'].join(', ') };
        // сериал идёт годами: «Беспринципные» (2020) моделью — 2026, год последнего сезона; в тексте года нет вовсе
        const running = pool.filter((c) => c.kind === 'series' && c.year && c.year < w.year!);
        if (!anyYear && !trap && running.length === 1 && pool.length === 1) return { key: running[0].key, options: pool, why: [...why, 'сериал, год сезона'].join(', ') };
        return { options: pool.slice(0, 6), why: 'год назван, у тёзок другой' };
      }
      const exact = near1.filter((c) => c.year === w.year);
      pool = exact.length === 1 ? exact : near1;
    }
    if (how.startsWith('другое') && !w.year && pool.every((c) => c.kind === 'film' && c.score < ALT_QUIET)) {
      return { options: pool.slice(0, 6), why: 'другое название тихого фильма' };
    }
    // второе название в скобках: «Неприкасаемые (1+1)» — это «1+1» 2011-го, а не «Неприкасаемые» 1987-го
    if (pool.length > 1) {
      for (const f of findTitles(ctx.text, w.title)) {
        const par = /^\s*\(([^()]{1,40})\)/u.exec(ctx.text.slice(f.at + f.raw.length))?.[1];
        const g = par && !/^\s*\d{4}\s*$/.test(par) ? byName.get(fold(par)) : undefined;
        if (g && g.size === 1) { const c = [...g.values()][0]; return { key: c.key, options: pool.slice(0, 6), why: [...why, 'второе название в скобках'].join(', ') }; }
      }
    }
    let pick: Cand | undefined;
    let confirmed = false;
    if (pool.length === 1) pick = pool[0];
    else {
      const named = byCreator(pool);
      const dated = pool.filter((c) => c.year && textYear(c.year));
      if (named.length === 1) { pick = named[0]; confirmed = true; why.push('режиссёр в тексте'); }
      else if (dated.length === 1) { pick = dated[0]; confirmed = true; why.push('год в тексте'); }
      else {
        // тёзки: известность. Свежее (год сообщения и прошлый) — в полтора раза громче: у новинки разделов Википедии ещё мало
        const fresh = (c: Cand) => (ctx.year && c.year && c.year >= ctx.year - 1 ? 1.5 : 1);
        const ranked = pool.map((c) => ({ c, s: c.score * fresh(c) })).sort((a, b) => b.s - a.s);
        const [a, b] = ranked;
        if (a.s >= (trap ? TRAP_LOUD : QUIET) && a.s >= LEAD * (b?.s ?? 0)) { pick = a.c; why.push('тёзки: известнее'); }
        else return { options: pool.slice(0, 6), why: 'тёзки не развелись' };
      }
    }
    // ловушка: обычное слово засчитываем только с подтверждением формы или вида. Вид подтверждён, если его назвали рядом,
    // в ветке, или модель и просьба говорят одно («пусть будет офис» под «посоветуйте сериал», модель — сериал)
    if (trap && !confirmed) {
      const second = pool.filter((c) => c !== pick).reduce((m, c) => Math.max(m, c.score), 0);
      const ok = strongForm(ctx.text, w.title) || (w.original && strongForm(ctx.text, w.original)) || (near && near === pick.kind) || (ctx.thread && ctx.thread === pick.kind)
        || (model === pick.kind && asked === pick.kind) || (pick.year && textYear(pick.year)) || creatorInText(ctx.text, pick.creators)
        // громкая вещь без тёзок, и модель назвала тот же вид: «А как тебе сверхъестественное?» под просьбой о сериалах
        // громкая вещь, у которой тёзки тихие, и модель назвала тот же вид: «Одиссея» Нолана (178) и фильм 2016-го (15)
        || (model === pick.kind && pick.score >= 80 && (found.length === 1 || pick.score >= 4 * second))
        // «The Odyssey» — оригинальное название латиницей в русском тексте обычным словом не бывает
        || Boolean(w.original && /^[A-Za-z]/.test(w.original) && findTitle(ctx.text, w.original));
      if (!ok) return { options: pool.slice(0, 6), why: 'обычное слово без подтверждения' };
      why.push('ловушка подтверждена');
    }
    return { key: pick.key, options: pool.slice(0, 6), why: why.join(', ') };
  };
}

/** Вид названия по ветке: сообщения, где рядом с названием написано «сериал» или «фильм». Ключ — `fold(title)`;
 *  разногласие — без вида. */
export function threadKinds(items: { text: string; titles: string[] }[]): Map<string, Kind> {
  const votes = new Map<string, Set<Kind>>();
  for (const it of items) for (const t of it.titles) {
    const k = kindNear(it.text, t);
    if (!k) continue;
    const s = votes.get(bare(t)) ?? new Set<Kind>();
    s.add(k);
    votes.set(bare(t), s);
  }
  return new Map([...votes].filter(([, s]) => s.size === 1).map(([t, s]) => [t, [...s][0]]));
}
export const threadKey = (title: string): string => bare(title);
