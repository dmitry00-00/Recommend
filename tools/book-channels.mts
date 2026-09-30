// Книжные каналы (З6): их ролики и посты обходятся под книги, а не под фильмы.
// Каналы с `medium: 'book'` в src/mocks/sources.ts обходились и раньше, но искали в них фильмы:
// «Война и мир» уходила к фильму 1956 года, «Властелин колец» — к мультфильму 1978-го, «Премия» —
// к фильму 1975-го из «ГАЙДА ПО НОБЕЛЕВСКОЙ ПРЕМИИ». Книги каталога через мост с кино (З2) в
// чужом тексте не искали вовсе — у них названия-тёзки фильмов и обычные слова. Здесь правила
// для книжного канала:
//   · книги ищутся по названию (`IndexedWork.bookNames`), и из равных совпадений побеждает книга;
//   · фильм остаётся фильмом, только если разговор о кино: слово о кино или фамилия режиссёра
//     («АНТИХРИСТ — кино о природе зла», ««Одиссея» Нолана»); сравнение «книга vs фильм» — к книге,
//     если она у нас есть;
//   · без разговора о кино совпавший фильм — это книга: к ней по связям Ж1 («по роману»), а нет
//     её у нас — ролик пропускаем (книга вне каталога, а не фильм);
//   · совпавшая книга — сторож экранизаций Ж4 как везде: «ОБЗОР фильма «…»» переезжает к фильму;
//   · «ПРОЧИТАНО», «ЧИТАЮ СЕЙЧАС», «КНИЖНЫЕ ПЛАНЫ», «N книг…» и перечисление через запятую — сборник.
import { sources } from '../src/mocks/sources.ts';
import { ADAPTATION } from './title-match.mts';
import { BOOK_TALK, judgeBookMatch, type adaptationIndex } from './adaptation-guard.mts';
import type { IndexedWork } from './works-index.mts';
import { isBookKey } from '../src/lib/keys.ts';
import { sound } from './evidence.mts';

/** Книжные каналы по имени (@handle YouTube, username Telegram) — src/mocks/sources.ts. */
export const bookHandles = new Set(sources.filter((s) => s.medium === 'book').map((s) => s.handle.toLowerCase()));
export const isBookHandle = (handle?: string): boolean => Boolean(handle && bookHandles.has(handle.replace(/^@/, '').toLowerCase()));

/** Названия, по которым произведение ищется в канале: в книжном — и книги каталога через мост. */
export const namesFor = (w: IndexedWork, book: boolean): string[] => (book ? w.bookNames ?? w.names : w.names);

/** Из равных совпадений в книжном канале — книги, если они среди них есть. */
export function preferBooks<T extends { work: IndexedWork['work'] }>(tied: T[]): T[] {
  const books = tied.filter((t) => t.work.type === 'book');
  return books.length ? books : tied;
}

// сборники книжных каналов — по выборке 1 777 роликов шести каналов (30.09)
const LIST = /прочитан|читаю\s+(?:сейчас|в\s|со\s+мной)|читай\s+со\s+мной|книжн\p{L}*\s+(?:план|покупк|полк|марафон|новинк|итог|переезд|клуб)|недел\p{L}*\s+чтения|распаков|(?<![\p{L}\p{N}])\d+\s+(?:книг|роман|фильм)|коллекци|стрим|трансляц|vlog|влог|ожидаем|(?<!\p{L})и\s+друг(?:ие|их)|(?<!\p{L})и\s+ещ[её]\s+\d/iu;

/** Сборник книжного канала по заголовку. `commas` — перечисление названий через запятую тоже
 *  сборник: два и больше пунктов после запятой с большой буквы («ЧУЖАК, ГРОЗОВОЙ ПЕРЕВАЛ, БОЛОТНИЦА»),
 *  а не «Смысл, подтекст, значение концовки». У постов первая строка — обычная речь, там не смотрим. */
export function bookChannelList(title: string, { commas = true } = {}): boolean {
  if (LIST.test(title)) return true;
  if (!commas) return false;
  const items = title.split(',').slice(1).filter((x) => /^[^\p{L}]*\p{Lu}/u.test(x));
  return items.length >= 2;
}

const SCREEN = new RegExp(`${ADAPTATION.source}|(?<!\\p{L})кино|мульт|аниме|pixar|пиксар|disney|дисне|marvel|марвел|хоррор|ужастик|трейлер|сыграл|сыграет|(?<!\\p{L})реж\\.|(?<!\\p{L})сн(?:ял|яла|яли|ять|имать|имает|имают|ято)(?!\\p{L})`, 'iu');

/** Разговор о кино: слово о кино или фамилия создателя фильма в любом падеже и алфавите
 *  (««Одиссея» Нолана», «Меланхолия Ларса фон Триера» при создателе «von Trier»). */
export function talksScreen(text: string, work: IndexedWork['work']): boolean {
  if (SCREEN.test(text)) return true;
  const said = text.split(/[^\p{L}]+/u).filter((w) => w.length >= 4).map(sound);
  return work.creators.some((c) => {
    const last = sound(c.trim().split(/\s+/).pop() ?? '');
    if (last.length < 4) return false;
    const stem = last.slice(0, Math.max(4, last.length - 2));
    return said.some((w) => w.startsWith(stem));
  });
}

/** Фильм или сериал → книга, по которой он снят (связи Ж1), если книга у нас есть. */
export function sourceIndex(ad: ReturnType<typeof adaptationIndex>, ours: IndexedWork[]): Map<string, IndexedWork> {
  const byKey = new Map(ours.map((w) => [w.key, w]));
  const out = new Map<string, IndexedWork>();
  for (const [bookKey, list] of ad) {
    const book = byKey.get(bookKey);
    if (!book) continue;
    for (const a of list) if (a.work && !out.has(a.work.key)) out.set(a.work.key, book);
  }
  return out;
}

export interface ChannelVerdict {
  action: 'keep' | 'drop' | 'move';
  to?: IndexedWork;
  /** экранизация (книга → фильм, Ж4), к книге (фильм → книга), вне каталога (фильм без разговора о кино) */
  why?: 'adaptation' | 'to_book' | 'outside';
}

/** Решение по совпадению в книжном канале. `head` — заголовок (для сторожа Ж4, как у остальных),
 *  `text` — где искать разговор о кино и о книге: у ролика — только заголовок (в описаниях книжных
 *  каналов — ссылки и рубрики «смотрите также», замер 30.09: «МРАЧНЫЕ КНИГИ НА ХЭЛЛОУИН» оставались
 *  фильму «Хэллоуин» из-за описания), у поста — начало поста. */
export function judgeInBookChannel(pick: IndexedWork, head: string, text: string,
  ctx: { ad: ReturnType<typeof adaptationIndex>; sources: Map<string, IndexedWork> }, publishedAt?: string): ChannelVerdict {
  if (isBookKey(pick.key)) {
    const j = judgeBookMatch(ctx.ad, pick.key, head, publishedAt);
    return j.action === 'keep' ? { action: 'keep' } : { action: j.action, ...(j.to ? { to: j.to } : {}), why: 'adaptation' };
  }
  const book = ctx.sources.get(pick.key);
  if (talksScreen(text, pick.work) && !(book && BOOK_TALK.test(text))) return { action: 'keep' };
  return book ? { action: 'move', to: book, why: 'to_book' } : { action: 'drop', why: 'outside' };
}
