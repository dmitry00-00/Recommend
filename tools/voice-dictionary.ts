// Справочник авторов: кто есть кто среди тех, чьи разборы мы показываем. Составлен руками —
// автоматически это не выводится: на YouTube канал зовётся «4то за Персонаж?», в Telegram —
// «Что за персонаж?», а в постах попадаются пересланные названия («Искусство кино» внутри
// Cinemaholics), которые каналом не являются.
//
// Ключи привязки: `yt:<название канала ровно как в разборе>` и `tg:<handle>`. Материал из
// Telegram привязывается по handle из id поста (`tg-episodesfilm-95`), а не по полю `author`:
// там может стоять тот, у кого пост переслан.
//
// Чаты — те, что нашлись у каналов по MTProto (`tools/telegram-fetch.py --discussions`).
// У большинства нет публичного имени, поэтому ссылки на чат нет: обсуждение открывается
// комментариями под конкретным постом.
//
// Роли: `author` — тот, кто разбирает; `platform` — онлайн-кинотеатр, пишущий о своих
// премьерах; `studio` — трейлеры правообладателя. Показываем среди разборов только `author`.

export interface VoiceEntry {
  id: string;
  title: string;
  /** подпись под иконкой: одна строка */
  short: string;
  role: 'author' | 'platform' | 'studio';
  /** название ютуб-канала ровно так, как оно приходит в поле `author` */
  youtube?: string;
  /** любой ролик этого канала: по нему берём id канала и аватар через YouTube Data API */
  sampleVideo?: string;
  /** handle телеграм-канала */
  telegram?: string;
  chat?: { title: string; username?: string };
  /** прочие написания того же автора в данных */
  aliases?: string[];
}

export const voiceDictionary: VoiceEntry[] = [
  // --- авторы с обеими площадками ---
  {
    id: 'episodes', title: 'ЭПИЗОДЫ', short: 'Эпизоды', role: 'author',
    youtube: 'ЭПИЗОДЫ', sampleVideo: 'ljInptINgVk',
    telegram: 'episodesfilm', chat: { title: 'ЭПИЗОДЫ Chat' },
  },
  {
    id: 'chtozapersonazh', title: 'Что за персонаж?', short: 'Что за персонаж', role: 'author',
    youtube: '4то за Персонаж?', sampleVideo: 'm-C48XyTpCY',
    telegram: 'chtozapersonazh', chat: { title: 'ЧЗП-чат' },
  },
  {
    id: 'elcinema', title: 'elcinema', short: 'elcinema', role: 'author',
    youtube: 'elcinema', sampleVideo: 'kXIW4i-STs0',
    telegram: 'elcinemanew', chat: { title: 'elcinema chat', username: 'elcinema' },
  },
  {
    id: 'nuke', title: 'Nuke', short: 'Nuke', role: 'author',
    youtube: 'Nuke', sampleVideo: 'SyPYbB3tFec',
    telegram: 'nukedie', chat: { title: 'NukeComments' }, aliases: ['nukerrr'],
  },
  {
    id: 'filologrus', title: 'Филолог всея Руси', short: 'Филолог всея Руси', role: 'author',
    youtube: 'Филолог всея Руси', sampleVideo: 'O-2BBGjr4Lk', telegram: 'filologofrus',
  },
  {
    id: 'alarm', title: 'Тревожные кассеты', short: 'Тревожные кассеты', role: 'author',
    youtube: 'Тревожные кассеты', sampleVideo: 'ulSVg5Um1kQ',
    telegram: 'alarm_cassettes', chat: { title: 'Тревожность' },
  },

  // --- только YouTube ---
  // Прислан владельцем 23.09. Ролики длинные, по году работы, зато названия прямо называют
  // фильм — сопоставление по названию дало шесть привязок и ни одной чужой.
  { id: 'shestnadtsat', title: 'ШЕСТНАДЦАТЬ НА ДЕВЯТЬ', short: '16 на 9', role: 'author', youtube: 'ШЕСТНАДЦАТЬ НА ДЕВЯТЬ', sampleVideo: '8NUz4a5hP_w' },
  { id: 'kinolikbez', title: 'КИНОЛИКБЕЗ', short: 'Киноликбез', role: 'author', youtube: 'КИНОЛИКБЕЗ KINOLIKBEZ', sampleVideo: 'n4Virf3u2l4' },
  { id: 'yaumamy', title: 'Я у мамы филолог', short: 'Я у мамы филолог', role: 'author', youtube: 'Я у мамы филолог', sampleVideo: 'vWzJB7LtlGI' },
  { id: 'vslushivanie', title: 'Вслушивание', short: 'Вслушивание', role: 'author', youtube: 'Вслушивание', sampleVideo: 'MFwMwzyX5KM' },
  { id: 'rezhupravlenie', title: 'РЕЖУПРАВЛЕНИЕ Жоры Крыжовникова', short: 'Режуправление', role: 'author', youtube: 'РЕЖУПРАВЛЕНИЕ Жоры Крыжовникова', sampleVideo: 'Xiq1GpJ4T9U' },
  { id: 'shebanov', title: 'Александр Шебанов', short: 'Шебанов', role: 'author', youtube: 'Александр Шебанов', sampleVideo: 'WbqWAN5veJM' },
  { id: 'zagudaev', title: 'Андрей Загудаев', short: 'Загудаев', role: 'author', youtube: 'Андрей Загудаев', sampleVideo: 'NeuBEDBOGyM' },
  { id: 'dolin', title: 'Радио Долин', short: 'Радио Долин', role: 'author', youtube: 'Радио Долин', sampleVideo: 'SESCSiE5yY0' },
  { id: 'kinoteatr', title: 'Кино-Театр.Ру', short: 'Кино-Театр.Ру', role: 'author', youtube: 'Кино-Театр.Ру', sampleVideo: 'ep_DOUkw8FE' },

  // --- только Telegram ---
  { id: 'aresearcher', title: 'R⁴²', short: 'R⁴²', role: 'author', telegram: 'a_researcher' },
  { id: 'cinemaholics', title: 'Cinemaholics', short: 'Cinemaholics', role: 'author', telegram: 'cinemaholicsofficial', chat: { title: 'Клуб анонимных киноголиков' } },
  { id: 'logovofilologa', title: 'Логово Филолога', short: 'Логово Филолога', role: 'author', telegram: 'logovofilologa' },
  { id: 'abramacabre', title: 'Abramacabre!', short: 'Abramacabre!', role: 'author', telegram: 'cinemysterium', chat: { title: 'Заброшенный кинотеатр', username: 'cinemysterium_chat' } },
  { id: 'dramatmin', title: 'Драма Тмин', short: 'Драма Тмин', role: 'author', telegram: 'LazarenkoFantasy' },
  { id: 'hudozhestvenny', title: 'Кинотеатр «Художественный»', short: 'Художественный', role: 'author', telegram: 'cinema1909' },
  { id: 'lifeisscarier', title: 'Жизнь страшнее', short: 'Жизнь страшнее', role: 'author', telegram: 'LifeIsScarier', chat: { title: 'Жизнь страшнее', username: 'lifeisscarierchat' } },
  { id: 'terminatarkovsky', title: 'Terminatarkovsky', short: 'Terminatarkovsky', role: 'author', telegram: 'terminatarkovsky' },
  { id: 'cutthechat', title: 'Cut The Chat', short: 'Cut The Chat', role: 'author', telegram: 'CutTheChat' },

  // --- площадки: пишут о своих премьерах, среди разборов не показываются ---
  {
    id: 'kinopoisk', title: 'Кинопоиск', short: 'Кинопоиск', role: 'platform',
    youtube: 'Кинопоиск', sampleVideo: 'oVQUZ0I5aYw', telegram: 'kinopoisk',
    chat: { title: 'Обсуждаем фильмы и сериалы', username: 'kinopoiskchat' },
    aliases: ['Кинопоиск | Фильмы и сериалы', 'Кинопоиск Экстра', 'Кинопоиск | Индустрия', 'Кинопоиск | Новости', 'Плюс Медиа'],
  },
  { id: 'okko', title: 'Okko Кино', short: 'Okko', role: 'platform', telegram: 'okkomovies' },
  { id: 'kion', title: 'КИОН', short: 'КИОН', role: 'platform', telegram: 'kionru' },
  { id: 'wink', title: 'Wink', short: 'Wink', role: 'platform', telegram: 'WinkRussia' },
  { id: 'viju', title: 'viju', short: 'viju', role: 'platform', telegram: 'viju_kino' },

  // --- студии: трейлеры правообладателя ---
  { id: 'paramount', title: 'Paramount Pictures', short: 'Paramount', role: 'studio', youtube: 'Paramount Pictures' },
  { id: 'searchlight', title: 'Searchlight Pictures', short: 'Searchlight', role: 'studio', youtube: 'SearchlightPictures' },
];
