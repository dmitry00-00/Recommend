import type { DiscussionPlace, WorkCard } from '@/types/tmdf';
import ru from '@/i18n/ru';

/** Авторы и каналы, чьи разборы показываем (21.09, список от владельца продукта). К каналам
 *  не обращаемся: ссылка ведёт в поиск по каналу в публичном превью Telegram
 *  (`t.me/s/<канал>?q=`) или в поиск по каналу YouTube — разбор откроется, если он там есть.
 *  Конкретные посты по произведениям появятся из кураторской (`DiscussionPlace` с прямой
 *  ссылкой) — тогда поисковые ссылки для этого произведения уходят вниз. */
export interface VoiceSource {
  id: string;
  title: string;
  handle: string;
  platform: 'telegram' | 'youtube';
  url: string;
  /** автор разборов (его ищем по названию фильма) или просто место, где говорят о кино */
  role: 'voice' | 'place';
  /** канал с публичным превью — по нему работает поиск; чат — только ссылка на сам чат;
   *  `unknown` — вид ещё не выяснен, тогда ведём в сам канал, а не в поиск по нему */
  kind?: 'channel' | 'chat' | 'unknown';
  /** разбирает или обозревает. Различие не про качество, а про аудиторию: обзорщик берёт то,
   *  что смотрят все, эссеист — то, о чём есть что сказать. Фильм, названный эссеистами и не
   *  замеченный обзорщиками, — это и есть «не нашёл своего зрителя», причём измеренное на
   *  русскоязычной публике, а не через Trakt (там нет нашего кино) и не через Википедию
   *  (она считает читающих, а не смотрящих). Деление 26.09 — со слов владельца. */
  tier?: 'essay' | 'review';
  /** о чём канал: кино или книги. Ярус обзорщика имеет смысл только внутри своего предмета —
   *  книжный обзорщик ничего не говорит о том, посмотрели фильм или нет, поэтому в ось
   *  «массовое внимание к фильму» идут только `medium: 'film'` (значение по умолчанию).
   *  Денис Чужой и bookspace — книги, поправка владельца 26.09. */
  medium?: 'film' | 'book';
}

export const sources: VoiceSource[] = [
  { id: 'src-chtozapersonazh', title: 'Что за персонаж?', handle: 'chtozapersonazh', platform: 'telegram', url: 'https://t.me/chtozapersonazh', role: 'voice', kind: 'channel' },
  { id: 'src-episodesfilm', title: 'ЭПИЗОДЫ', handle: 'episodesfilm', platform: 'telegram', url: 'https://t.me/episodesfilm', role: 'voice', kind: 'channel' },
  { id: 'src-elcinemanew', title: 'elcinema', handle: 'elcinemanew', platform: 'telegram', url: 'https://t.me/elcinemanew', role: 'voice', kind: 'channel' },
  { id: 'src-nukedie', title: 'Nuke', handle: 'nukedie', platform: 'telegram', url: 'https://t.me/nukedie', role: 'voice', kind: 'channel' },
  { id: 'src-nuke', title: 'Nuke', handle: 'nukegovnuke', platform: 'youtube', url: 'https://youtube.com/@nukegovnuke', role: 'voice', kind: 'channel', tier: 'essay' },
  // Прислан владельцем 23.09: Дима Кунгуров, длинные разборы «почти документалки», 55 роликов.
  { id: 'src-16na9', title: 'ШЕСТНАДЦАТЬ НА ДЕВЯТЬ', handle: 'iamkungurov', platform: 'youtube', url: 'https://www.youtube.com/@iamkungurov', role: 'voice', kind: 'channel', tier: 'essay' },
  // Прислан владельцем 25.09: обзоры кино. Названия — из YouTube Data API (channels?forHandle).
  // Клим Жуков — в основном история (1 791 ролик): привязки у него реже и шумнее, отбор по
  // названию произведения их отсеивает. Денис Чужой обозревает книги (владелец, 26.09) —
  // он здесь как автор, но не как голос о кино.
  { id: 'src-badcomedian', title: 'BadComedian', handle: 'thebadcomedian', platform: 'youtube', url: 'https://www.youtube.com/@thebadcomedian', role: 'voice', kind: 'channel', tier: 'review' },
  { id: 'src-denischuzhoy', title: 'Денис Чужой', handle: 'denis_chuzhoy', platform: 'youtube', url: 'https://www.youtube.com/@denis_chuzhoy', role: 'voice', kind: 'channel', tier: 'review', medium: 'book' },
  { id: 'src-terlk', title: 'TerlKabot', handle: 'terlk', platform: 'youtube', url: 'https://www.youtube.com/@terlk', role: 'voice', kind: 'channel', tier: 'review' },
  { id: 'src-kinokritika', title: 'КИНОКРИТИКА', handle: 'kinokritika', platform: 'youtube', url: 'https://www.youtube.com/@kinokritika', role: 'voice', kind: 'channel', tier: 'review' },
  { id: 'src-sokoloff', title: 'SokoL[off] TV', handle: 'alexsokoloff', platform: 'youtube', url: 'https://www.youtube.com/@alexsokoloff', role: 'voice', kind: 'channel', tier: 'review' },
  { id: 'src-zhukov', title: 'Клим Жуков', handle: 'uzhukoffa', platform: 'youtube', url: 'https://www.youtube.com/@uzhukoffa', role: 'voice', kind: 'channel', tier: 'review' },
  { id: 'src-nerdface', title: 'ЧБУ', handle: 'nerdface', platform: 'youtube', url: 'https://www.youtube.com/@nerdface', role: 'voice', kind: 'channel', tier: 'review' },
  { id: 'src-skrsmysl', title: 'Скрытый смысл', handle: 'skrsmysl', platform: 'youtube', url: 'https://www.youtube.com/@skrsmysl', role: 'voice', kind: 'channel', tier: 'review' },
  { id: 'src-nevrotik', title: 'nevrotik.', handle: 'nevrotik', platform: 'youtube', url: 'https://www.youtube.com/@nevrotik', role: 'voice', kind: 'channel', tier: 'essay' },
  { id: 'src-redcynic', title: 'Red Cynic', handle: 'redcynicrc', platform: 'youtube', url: 'https://www.youtube.com/@redcynicrc', role: 'voice', kind: 'channel', tier: 'review' },
  { id: 'src-vslushivanie', title: 'Вслушивание', handle: 'Вслушивание', platform: 'youtube', url: 'https://www.youtube.com/@%D0%92%D1%81%D0%BB%D1%83%D1%88%D0%B8%D0%B2%D0%B0%D0%BD%D0%B8%D0%B5', role: 'voice', kind: 'channel', tier: 'essay' },
  // Книги (список владельца, 22.09). «Филолог всея Руси» ведёт и канал, и ютуб — в карточке
  // это один автор: поисковая ссылка остаётся одна, Telegram предпочтительнее.
  { id: 'src-filologofrus', title: 'Филолог всея Руси', handle: 'filologofrus', platform: 'telegram', url: 'https://t.me/filologofrus', role: 'voice', kind: 'channel', medium: 'book' },
  { id: 'src-poetische', title: 'Филолог всея Руси', handle: 'poetische', platform: 'youtube', url: 'https://www.youtube.com/@poetische', role: 'voice', kind: 'channel', tier: 'essay', medium: 'book' },
  { id: 'src-logovofilologa', title: 'Логово Филолога', handle: 'logovofilologa', platform: 'telegram', url: 'https://t.me/logovofilologa', role: 'voice', kind: 'channel', medium: 'book' },
  // Прислан владельцем 25.09: книги.
  { id: 'src-bookspace', title: 'bookspace', handle: 'anya.bookspace', platform: 'youtube', url: 'https://www.youtube.com/@anya.bookspace', role: 'voice', kind: 'channel', tier: 'review', medium: 'book' },
  { id: 'src-yaumamyfilolog', title: 'Я у мамы филолог', handle: 'ya_u_mamy_filolog', platform: 'youtube', url: 'https://www.youtube.com/@ya_u_mamy_filolog', role: 'voice', kind: 'channel', tier: 'essay', medium: 'book' },
  // Места, где о кино говорят (список владельца, 22.09): часть — каналы, часть — чаты.
  // Вид не выясняли: у чата нет публичного превью, поэтому пока ведём в само место, а не в
  // поиск по нему. Кто из них чат — размечает кураторская (или владелец одной строкой).
  { id: 'src-a-researcher', title: 'a_researcher', handle: 'a_researcher', platform: 'telegram', url: 'https://t.me/a_researcher', role: 'place', kind: 'unknown' },
  { id: 'src-cinemaholics', title: 'Cinemaholics', handle: 'cinemaholicsofficial', platform: 'telegram', url: 'https://t.me/cinemaholicsofficial', role: 'place', kind: 'unknown' },
  { id: 'src-kinopoisk', title: 'Кинопоиск', handle: 'kinopoisk', platform: 'telegram', url: 'https://t.me/kinopoisk', role: 'place', kind: 'channel' },
  { id: 'src-cutthechat', title: 'CutTheChat', handle: 'CutTheChat', platform: 'telegram', url: 'https://t.me/CutTheChat', role: 'place', kind: 'unknown' },
  { id: 'src-lazarenko', title: 'LazarenkoFantasy', handle: 'LazarenkoFantasy', platform: 'telegram', url: 'https://t.me/LazarenkoFantasy', role: 'place', kind: 'unknown' },
  { id: 'src-cinemysterium', title: 'cinemysterium', handle: 'cinemysterium', platform: 'telegram', url: 'https://t.me/cinemysterium', role: 'place', kind: 'unknown' },
  { id: 'src-cinema1909', title: 'cinema1909', handle: 'cinema1909', platform: 'telegram', url: 'https://t.me/cinema1909', role: 'place', kind: 'unknown' },
  { id: 'src-lifeisscarier', title: 'LifeIsScarier', handle: 'LifeIsScarier', platform: 'telegram', url: 'https://t.me/LifeIsScarier', role: 'place', kind: 'unknown' },
  { id: 'src-alarm-cassettes', title: 'alarm_cassettes', handle: 'alarm_cassettes', platform: 'telegram', url: 'https://t.me/alarm_cassettes', role: 'place', kind: 'unknown' },
];

function searchUrl(src: VoiceSource, query: string): string {
  const q = encodeURIComponent(query);
  // поиск работает только по публичному превью канала; у чата и у невыясненного вида
  // ведём в само место — иначе ссылка откроет пустую страницу
  if (src.kind !== 'channel') return src.url;
  // адрес канала бывает кириллическим (@Вслушивание) — в ссылке он обязан быть закодирован
  return src.platform === 'telegram'
    ? `https://t.me/s/${src.handle}?q=${q}`
    : `https://www.youtube.com/@${encodeURIComponent(src.handle)}/search?query=${q}`;
}

/** Поисковые ссылки по каналам для фильма — по одной на автора, а не на канал: у Nuke есть и
 *  Telegram, и YouTube, и строка «Nuke · Nuke» ничего не объясняет. Telegram предпочтительнее:
 *  ролики этих же авторов приходят в карточку отдельно, конкретными разборами. */
export function searchLinks(work: WorkCard, role: VoiceSource['role'] = 'voice'): DiscussionPlace[] {
  if (work.type !== 'film') return [];
  const byAuthor = new Map<string, VoiceSource>();
  for (const src of sources.filter((s) => s.role === role)) {
    const kept = byAuthor.get(src.title);
    if (!kept || (kept.platform !== 'telegram' && src.platform === 'telegram')) byAuthor.set(src.title, src);
  }
  return [...byAuthor.values()].map((src) => ({
    id: `${src.id}-${work.id}`,
    workId: work.id,
    // место для разговора — это чат, даже когда технически канал: разговор там не про
    // конкретный фильм, а вообще, и ссылка ведёт в само место
    kind: role === 'place' ? 'telegram_chat' : src.platform === 'telegram' ? 'telegram_channel' : 'youtube_channel',
    title: src.title,
    why: role === 'place' ? ru.discussion.placeWhy : ru.discussion.searchWhy,
    url: searchUrl(src, work.title),
    language: 'ru',
    spoilers: true,
    search: true,
  }));
}
