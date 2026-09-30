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
  /** Канал пришёл ссылками владельца на отдельные ролики (лист «Без разбора» таблицы
   *  разметки), а не списком голосов. В реестре — ради яруса и учёта; загрузки канала не
   *  обходим и в строку поиска карточки не ставим: таких каналов сотни (29.09 — 226), обход
   *  съел бы квоту YouTube, а поиск забил бы карточку. Ярус по умолчанию — обзор (владелец,
   *  29.09), уточняется по мере разбора. Сделать полноценным голосом — убрать `via`. */
  via?: 'links';
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
  // обзорщики кино — список владельца 28.09
  { id: 'src-mirymkrana', title: 'Миры Экрана', handle: 'kalininfilmschool', platform: 'youtube', url: 'https://www.youtube.com/@kalininfilmschool', role: 'voice', kind: 'channel', tier: 'review' },
  { id: 'src-kubrik', title: 'Кубрик', handle: 'kubrik1985', platform: 'youtube', url: 'https://www.youtube.com/@kubrik1985', role: 'voice', kind: 'channel', tier: 'review' },
  { id: 'src-akr', title: 'Уголок Акра', handle: 'Akr815', platform: 'youtube', url: 'https://www.youtube.com/@Akr815', role: 'voice', kind: 'channel', tier: 'review' },
  { id: 'src-woodmark', title: 'Woodmark', handle: 'WoodmarkChannel', platform: 'youtube', url: 'https://www.youtube.com/@WoodmarkChannel', role: 'voice', kind: 'channel', tier: 'review' },
  // второй список владельца 28.09; ярус — по роликам канала (кино на слуху → обзор, своё → эссе)
  { id: 'src-kultas', title: 'Культас', handle: 'Kultas', platform: 'youtube', url: 'https://www.youtube.com/@Kultas', role: 'voice', kind: 'channel', tier: 'review' },
  { id: 'src-usachev', title: 'Павел Усачёв', handle: 'pavelusachoff', platform: 'youtube', url: 'https://www.youtube.com/@pavelusachoff', role: 'voice', kind: 'channel', tier: 'review' },
  { id: 'src-blackcabinet', title: 'Чёрный кабинет', handle: 'BlackCabinet', platform: 'youtube', url: 'https://www.youtube.com/@BlackCabinet', role: 'voice', kind: 'channel', tier: 'review' },
  { id: 'src-greengrass', title: 'GreenGrass', handle: 'greengrassreal', platform: 'youtube', url: 'https://www.youtube.com/@greengrassreal', role: 'voice', kind: 'channel', tier: 'review' },
  { id: 'src-plaguevision', title: 'Обзор во время чумы', handle: 'PlagueVision', platform: 'youtube', url: 'https://www.youtube.com/@PlagueVision', role: 'voice', kind: 'channel', tier: 'review' },
  { id: 'src-radiodolin', title: 'Радио Долин', handle: 'radiodolin', platform: 'youtube', url: 'https://www.youtube.com/@radiodolin', role: 'voice', kind: 'channel', tier: 'essay' },
  { id: 'src-zharinov', title: 'Николай Жаринов', handle: 'NikolaiZharinov', platform: 'youtube', url: 'https://www.youtube.com/@NikolaiZharinov', role: 'voice', kind: 'channel', tier: 'essay', medium: 'book' },
  { id: 'src-kirichenko', title: 'Кирилл Кириченко', handle: 'KIRILL_KIRICHENKO', platform: 'youtube', url: 'https://www.youtube.com/@KIRILL_KIRICHENKO', role: 'voice', kind: 'channel', tier: 'essay', medium: 'book' },
  { id: 'src-kinokritika', title: 'КИНОКРИТИКА', handle: 'kinokritika', platform: 'youtube', url: 'https://www.youtube.com/@kinokritika', role: 'voice', kind: 'channel', tier: 'review' },
  { id: 'src-sokoloff', title: 'SokoL[off] TV', handle: 'alexsokoloff', platform: 'youtube', url: 'https://www.youtube.com/@alexsokoloff', role: 'voice', kind: 'channel', tier: 'review' },
  { id: 'src-zhukov', title: 'Клим Жуков', handle: 'uzhukoffa', platform: 'youtube', url: 'https://www.youtube.com/@uzhukoffa', role: 'voice', kind: 'channel', tier: 'review' },
  // Ярус — решение владельца (28.09): ЧБУ, Скрытый смысл и nevrotik — обзоры, не эссе, хоть и
  // выглядят разбором. ЧБУ выдаёт фанатские теории за разбор по существу; Скрытый смысл толкует
  // фильм в пределах увиденного, без интерпретации образов и проверки связей; nevrotik — только
  // субъективная оценка, без экспертизы.
  { id: 'src-nerdface', title: 'ЧБУ', handle: 'nerdface', platform: 'youtube', url: 'https://www.youtube.com/@nerdface', role: 'voice', kind: 'channel', tier: 'review' },
  { id: 'src-skrsmysl', title: 'Скрытый смысл', handle: 'skrsmysl', platform: 'youtube', url: 'https://www.youtube.com/@skrsmysl', role: 'voice', kind: 'channel', tier: 'review' },
  { id: 'src-nevrotik', title: 'nevrotik.', handle: 'nevrotik', platform: 'youtube', url: 'https://www.youtube.com/@nevrotik', role: 'voice', kind: 'channel', tier: 'review' },
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
  // ── каналы из ссылок владельца: tools/register-link-channels.mts дописывает сюда ──
  // ярус по умолчанию — обзор; поменять — tier: 'essay'; сделать полноценным голосом — убрать via
  { id: 'src-yt-15_minut_pro_kino', title: '15 минут про кино (чаще больше)', handle: '15_minut_pro_kino', platform: 'youtube', url: 'https://www.youtube.com/@15_minut_pro_kino', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 10 роликов: Снегирь (2023), Приключения Паддингтона 3 (2024) и ещё 8
  { id: 'src-yt-theninthson_', title: '9th Son', handle: 'theninthson_', platform: 'youtube', url: 'https://www.youtube.com/@theninthson_', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Падение империи (2024)
  { id: 'src-yt-ammosov', title: 'Александр Аммосов', handle: 'ammosov', platform: 'youtube', url: 'https://www.youtube.com/@ammosov', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Суспирия (2018)
  { id: 'src-yt-alexandrpotaturko', title: 'Александр Потатурко', handle: 'alexandrpotaturko', platform: 'youtube', url: 'https://www.youtube.com/@alexandrpotaturko', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Призрачная нить (2017)
  { id: 'src-yt-psyminsk', title: 'Александр Свищенков |Экзистенциальный КПТ психолог', handle: 'psyminsk', platform: 'youtube', url: 'https://www.youtube.com/@psyminsk', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Призрачная нить (2017)
  { id: 'src-yt-spgs_shaban', title: 'Александр Шебанов', handle: 'spgs_shaban', platform: 'youtube', url: 'https://www.youtube.com/@spgs_shaban', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 5 роликов: Падение империи (2024), Сядь за руль моей машины (2021) и ещё 3
  { id: 'src-yt-aleksandra_sceptica', title: 'Александра Sceptica', handle: 'aleksandra_sceptica', platform: 'youtube', url: 'https://www.youtube.com/@aleksandra_sceptica', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Грозовой перевал (2011)
  { id: 'src-yt-maxhal', title: 'Аниме на миллион', handle: 'maxhal', platform: 'youtube', url: 'https://www.youtube.com/@maxhal', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Любовное настроение (2000)
  { id: 'src-yt-speech3850', title: 'АНИМЕШНИКИ ЗА 30+', handle: 'speech3850', platform: 'youtube', url: 'https://www.youtube.com/@speech3850', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Лунный свет (2016)
  { id: 'src-yt-edgareriva1792', title: 'Апельсинка Дубляж', handle: 'edgareriva1792', platform: 'youtube', url: 'https://www.youtube.com/@edgareriva1792', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Грозовой перевал (2011)
  { id: 'src-yt-аризона-ю4ъ', title: 'Аризона', handle: 'аризона-ю4ъ', platform: 'youtube', url: 'https://www.youtube.com/@аризона-ю4ъ', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Суспирия (2018)
  { id: 'src-yt-arturpsixopat', title: 'Артур Психопат', handle: 'arturpsixopat', platform: 'youtube', url: 'https://www.youtube.com/@arturpsixopat', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Ведьма (2016)
  { id: 'src-yt-zanegina', title: 'Ася Занегина', handle: 'zanegina', platform: 'youtube', url: 'https://www.youtube.com/@zanegina', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Грозовой перевал (2011)
  { id: 'src-yt-aurairen', title: 'Аура И', handle: 'aurairen', platform: 'youtube', url: 'https://www.youtube.com/@aurairen', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Удачи, веселья, не сдохни (2025)
  { id: 'src-yt-bibaandbobashow', title: 'Биба и Боба Шоу', handle: 'bibaandbobashow', platform: 'youtube', url: 'https://www.youtube.com/@bibaandbobashow', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Падение империи (2024)
  { id: 'src-yt-братьялюмье', title: 'Братья Люмье', handle: 'братьялюмье', platform: 'youtube', url: 'https://www.youtube.com/@братьялюмье', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Ведьма (2016)
  { id: 'src-yt-wowleratv', title: 'Валера Телевизор', handle: 'wowleratv', platform: 'youtube', url: 'https://www.youtube.com/@wowleratv', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Падение империи (2024)
  { id: 'src-yt-sincerely_yours', title: 'Ваш Кинокритик', handle: 'sincerely_yours', platform: 'youtube', url: 'https://www.youtube.com/@sincerely_yours', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Солнце моё (2022)
  { id: 'src-yt-daokolo3192', title: 'ВОКРУГ da okolo', handle: 'daokolo3192', platform: 'youtube', url: 'https://www.youtube.com/@daokolo3192', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Девушка, подающая надежды (2020)
  { id: 'src-yt-theoscaruniverse', title: 'ВСЕЛЕННАЯ ОСКАРА', handle: 'theoscaruniverse', platform: 'youtube', url: 'https://www.youtube.com/@theoscaruniverse', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Вестсайдская История (2021)
  { id: 'src-yt-gameover_inc', title: 'Гамова', handle: 'gameover_inc', platform: 'youtube', url: 'https://www.youtube.com/@gameover_inc', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Кролик Джоджо (2019)
  { id: 'src-yt-senseguide', title: 'Гид по смыслам', handle: 'senseguide', platform: 'youtube', url: 'https://www.youtube.com/@senseguide', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Унесённые призраками (2001)
  { id: 'src-yt-tayleroriginal', title: 'ГИК ФРИК', handle: 'tayleroriginal', platform: 'youtube', url: 'https://www.youtube.com/@tayleroriginal', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: CODA: Ребенок глухих родителей (2021)
  { id: 'src-yt-давидчасовских-п5э', title: 'Давид Часовских', handle: 'давидчасовских-п5э', platform: 'youtube', url: 'https://www.youtube.com/@давидчасовских-п5э', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Лунный свет (2016)
  { id: 'src-yt-dariasivenkova', title: 'Дарья Сивенкова', handle: 'dariasivenkova', platform: 'youtube', url: 'https://www.youtube.com/@dariasivenkova', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Приключения Паддингтона 3 (2024)
  { id: 'src-yt-yarkovastyle____', title: 'ДАРЬЯ ЯРКОВА', handle: 'yarkova.style____', platform: 'youtube', url: 'https://www.youtube.com/@yarkova.style____', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Любовное настроение (2000)
  { id: 'src-yt-denisigorevichrepresent', title: 'Денис Игоревич представляет 📺🍿', handle: 'denisigorevichrepresent', platform: 'youtube', url: 'https://www.youtube.com/@denisigorevichrepresent', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Удачи, веселья, не сдохни (2025)
  { id: 'src-yt-дмитриигухманпсихология', title: 'Дмитрий Гухман Психолог', handle: 'дмитриигухманпсихология', platform: 'youtube', url: 'https://www.youtube.com/@дмитриигухманпсихология', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Грозовой перевал (2011)
  { id: 'src-yt-yekino', title: 'Ё-кино!', handle: 'yekino', platform: 'youtube', url: 'https://www.youtube.com/@yekino', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Удачи, веселья, не сдохни (2025)
  { id: 'src-yt-jewishmuseummsk', title: 'Еврейский музей и центр толерантности', handle: 'jewishmuseummsk', platform: 'youtube', url: 'https://www.youtube.com/@jewishmuseummsk', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Королевство полной луны (2012)
  { id: 'src-yt-bookishraccoon', title: 'Енот в Переплете', handle: 'bookishraccoon', platform: 'youtube', url: 'https://www.youtube.com/@bookishraccoon', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Грозовой перевал (2011)
  { id: 'src-yt-vika02032000', title: 'Есаул', handle: 'vika02032000', platform: 'youtube', url: 'https://www.youtube.com/@vika02032000', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Унесённые призраками (2001)
  { id: 'src-yt-zanimatelnayapovsednevnost', title: 'Занимательная повседневность', handle: 'zanimatelnayapovsednevnost', platform: 'youtube', url: 'https://www.youtube.com/@zanimatelnayapovsednevnost', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Ведьмы (2020)
  { id: 'src-yt-thestevnin', title: 'Иван Бочарников', handle: 'thestevnin', platform: 'youtube', url: 'https://www.youtube.com/@thestevnin', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 2 ролика: Оставленные (2023), Падение империи (2024)
  { id: 'src-yt-ivandidenko', title: 'Иван Диденко', handle: 'ivandidenko', platform: 'youtube', url: 'https://www.youtube.com/@ivandidenko', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 3 ролика: Мальчик и птица (2023), Унесённые призраками (2001) и ещё 1
  { id: 'src-yt-alisaantselevichlll', title: 'Истории от Алисы', handle: 'alisaantselevichlll', platform: 'youtube', url: 'https://www.youtube.com/@alisaantselevichlll', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Призрачная нить (2017)
  { id: 'src-yt-karofilmart', title: 'КАРО.АРТ', handle: 'karofilmart', platform: 'youtube', url: 'https://www.youtube.com/@karofilmart', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 5 роликов: После Янга (2021), Сядь за руль моей машины (2021) и ещё 3
  { id: 'src-yt-andrievskaya_katerina', title: 'Катерина о главном 🌞', handle: 'andrievskaya_katerina', platform: 'youtube', url: 'https://www.youtube.com/@andrievskaya_katerina', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Кролик Джоджо (2019)
  { id: 'src-yt-katebelokrylova', title: 'Катя Белокрылова', handle: 'katebelokrylova', platform: 'youtube', url: 'https://www.youtube.com/@katebelokrylova', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Унесённые призраками (2001)
  { id: 'src-yt-gmpr140', title: 'Кино Диван', handle: 'gmpr140', platform: 'youtube', url: 'https://www.youtube.com/@gmpr140', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Суспирия (2018)
  { id: 'src-yt-кинодлявсех-ы8п', title: 'Кино для всех', handle: 'кинодлявсех-ы8п', platform: 'youtube', url: 'https://www.youtube.com/@кинодлявсех-ы8п', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 2 ролика: Ведьмы (2020), Девушка, подающая надежды (2020)
  { id: 'src-yt-kinolove', title: 'Кино Love', handle: 'kinolove', platform: 'youtube', url: 'https://www.youtube.com/@kinolove', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Тик-так, бум! (2021)
  { id: 'src-yt-kinobalabolka', title: 'Кинобалаболка', handle: 'kinobalabolka', platform: 'youtube', url: 'https://www.youtube.com/@kinobalabolka', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Падение империи (2024)
  { id: 'src-yt-киноведы', title: 'Киноведы', handle: 'киноведы', platform: 'youtube', url: 'https://www.youtube.com/@киноведы', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 4 ролика: Любовное настроение (2000), Чунгкингский экспресс (1994)
  { id: 'src-yt-kinod-lk', title: 'КИНОДИССЕЯ', handle: 'kinod-lk', platform: 'youtube', url: 'https://www.youtube.com/@kinod-lk', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 2 ролика: Бедные-несчастные (2023), Прошлые жизни (2023)
  { id: 'src-yt-mykinokarma', title: 'Кинокарма', handle: 'mykinokarma', platform: 'youtube', url: 'https://www.youtube.com/@mykinokarma', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Реинкарнация (2018)
  { id: 'src-yt-kinolopaty', title: 'Кинолопаты', handle: 'kinolopaty', platform: 'youtube', url: 'https://www.youtube.com/@kinolopaty', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Реинкарнация (2018)
  { id: 'src-yt-kinonist', title: 'КИНОНИСТ', handle: 'kinonist', platform: 'youtube', url: 'https://www.youtube.com/@kinonist', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 2 ролика: CODA: Ребенок глухих родителей (2021), Девушка, подающая надежды (2020)
  { id: 'src-yt-киноразборка', title: 'КИНОРАЗБОРКА', handle: 'киноразборка', platform: 'youtube', url: 'https://www.youtube.com/@киноразборка', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Решение уйти (2022)
  { id: 'src-yt-kinosmotr666', title: 'Киносмотр', handle: 'kinosmotr666', platform: 'youtube', url: 'https://www.youtube.com/@kinosmotr666', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Приключения Паддингтона 3 (2024)
  { id: 'src-yt-kinosmysly', title: 'КИНОСМЫСЛЫ', handle: 'kinosmysly', platform: 'youtube', url: 'https://www.youtube.com/@kinosmysly', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Мелочи жизни (1970)
  { id: 'src-yt-alfakinosud', title: 'КИНОСУД проект АЛЬФА', handle: 'alfakinosud', platform: 'youtube', url: 'https://www.youtube.com/@alfakinosud', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Падение империи (2024)
  { id: 'src-yt-кинофакты-обзоры', title: 'КиноФакты', handle: 'кинофакты-обзоры', platform: 'youtube', url: 'https://www.youtube.com/@кинофакты-обзоры', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Удачи, веселья, не сдохни (2025)
  { id: 'src-yt-kinofarvater', title: 'КИНОФАРВАТЕР', handle: 'kinofarvater', platform: 'youtube', url: 'https://www.youtube.com/@kinofarvater', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Бедные-несчастные (2023)
  { id: 'src-yt-кинохомячок', title: 'КиноХомячок', handle: 'кинохомячок', platform: 'youtube', url: 'https://www.youtube.com/@кинохомячок', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Портрет девушки в огне (2019)
  { id: 'src-yt-kinoshiz00', title: 'КИНОШИЗА', handle: 'kinoshiz00', platform: 'youtube', url: 'https://www.youtube.com/@kinoshiz00', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 2 ролика: Ведьма (2016), Суспирия (2018)
  { id: 'src-yt-когдаантонионивстретилхичкока', title: 'Когда Антониони встретил Хичкока', handle: 'когдаантонионивстретилхичкока', platform: 'youtube', url: 'https://www.youtube.com/@когдаантонионивстретилхичкока', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Власть пса (2021)
  { id: 'src-yt-контрапункт-щ5ш', title: 'Контрапункт', handle: 'контрапункт-щ5ш', platform: 'youtube', url: 'https://www.youtube.com/@контрапункт-щ5ш', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Призрачная нить (2017)
  { id: 'src-yt-короткоокино', title: 'КОРОТКО О КИНО', handle: 'короткоокино', platform: 'youtube', url: 'https://www.youtube.com/@короткоокино', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Фабельманы (2022)
  { id: 'src-yt-redbirdjj', title: 'КРАСНЫЙ ДЯТЕЛ', handle: 'redbirdjj', platform: 'youtube', url: 'https://www.youtube.com/@redbirdjj', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Оставленные (2023)
  { id: 'src-yt-circles_on_the_moon', title: 'Круги на Луне', handle: 'circles_on_the_moon', platform: 'youtube', url: 'https://www.youtube.com/@circles_on_the_moon', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Удачи, веселья, не сдохни (2025)
  { id: 'src-yt-sashakroog69', title: 'Круглый Человек', handle: 'sashakroog69', platform: 'youtube', url: 'https://www.youtube.com/@sashakroog69', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 3 ролика: Суспирия (2018), Ведьма (2016) и ещё 1
  { id: 'src-yt-cinema-culture', title: 'Культура Кино', handle: 'cinema-culture', platform: 'youtube', url: 'https://www.youtube.com/@cinema-culture', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Чунгкингский экспресс (1994)
  { id: 'src-yt-лучше100разуслышать-окиноисери', title: 'Лучше 100 раз услышать - о кино и сериалах', handle: 'лучше100разуслышать-окиноисери', platform: 'youtube', url: 'https://www.youtube.com/@лучше100разуслышать-окиноисери', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 2 ролика: Власть пса (2021), CODA: Ребенок глухих родителей (2021)
  { id: 'src-yt-maxzemlyashow', title: 'МАКС ЗЕМЛЯ ШОУ | Кино и поп-культура', handle: 'maxzemlyashow', platform: 'youtube', url: 'https://www.youtube.com/@maxzemlyashow', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Любовное настроение (2000)
  { id: 'src-yt-markusrull29', title: 'Маркус Рулл', handle: 'markusrull29', platform: 'youtube', url: 'https://www.youtube.com/@markusrull29', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Лунный свет (2016)
  { id: 'src-yt-empathymachine_podcast', title: 'Машина эмпатии', handle: 'empathymachine_podcast', platform: 'youtube', url: 'https://www.youtube.com/@empathymachine_podcast', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 2 ролика: Падение империи (2024), Бедные-несчастные (2023)
  { id: 'src-yt-ministerstvo_uspeha', title: 'МИНИСТЕРСТВО УСПЕХА', handle: 'ministerstvo_uspeha', platform: 'youtube', url: 'https://www.youtube.com/@ministerstvo_uspeha', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Девушка, подающая надежды (2020)
  { id: 'src-yt-миружасов-б2ь', title: 'Мир Ужасов', handle: 'миружасов-б2ь', platform: 'youtube', url: 'https://www.youtube.com/@миружасов-б2ь', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Реинкарнация (2018)
  { id: 'src-yt-movietalkspodcast', title: 'МувиТокс - подкаст о кино', handle: 'movietalkspodcast', platform: 'youtube', url: 'https://www.youtube.com/@movietalkspodcast', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Снегирь (2023)
  { id: 'src-yt-мырасскажем-с8с', title: 'Мы расскажем', handle: 'мырасскажем-с8с', platform: 'youtube', url: 'https://www.youtube.com/@мырасскажем-с8с', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Кролик Джоджо (2019)
  { id: 'src-yt-neonuarkino', title: 'НЕОНУАР', handle: 'neonuarkino', platform: 'youtube', url: 'https://www.youtube.com/@neonuarkino', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 2 ролика: Грозовой перевал (2011), Бедные-несчастные (2023)
  { id: 'src-yt-novoetv', title: 'Новое Телевидение', handle: 'novoetv', platform: 'youtube', url: 'https://www.youtube.com/@novoetv', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Решение уйти (2022)
  { id: 'src-yt-kartavayanora', title: 'Нора', handle: 'kartavayanora', platform: 'youtube', url: 'https://www.youtube.com/@kartavayanora', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Прошлые жизни (2023)
  { id: 'src-yt-objektiv2or3', title: 'Объектив', handle: 'objektiv2or3', platform: 'youtube', url: 'https://www.youtube.com/@objektiv2or3', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Призрачная нить (2017)
  { id: 'src-yt-олегдорожинскии', title: 'Олег Дорожинский', handle: 'олегдорожинскии', platform: 'youtube', url: 'https://www.youtube.com/@олегдорожинскии', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 3 ролика: Призрачная нить (2017), Снегирь (2023) и ещё 1
  { id: 'src-yt-o5troika', title: 'ОПЯТЬ ТРОЙКА!', handle: 'o5troika', platform: 'youtube', url: 'https://www.youtube.com/@o5troika', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Ведьмы (2020)
  { id: 'src-yt-timkin', title: 'Остров Пасхи † православные видео', handle: 'timkin', platform: 'youtube', url: 'https://www.youtube.com/@timkin', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Снегирь (2023)
  { id: 'src-yt-ochkinaminuschetyre', title: 'Очки на минус четыре', handle: 'ochkinaminuschetyre', platform: 'youtube', url: 'https://www.youtube.com/@ochkinaminuschetyre', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 2 ролика: Падение империи (2024), Грозовой перевал (2011)
  { id: 'src-yt-podcastpomotivam', title: 'по мотивам', handle: 'podcastpomotivam', platform: 'youtube', url: 'https://www.youtube.com/@podcastpomotivam', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Кролик Джоджо (2019)
  { id: 'src-yt-kinopoisk-podcasts', title: 'Подкасты Кинопоиска', handle: 'kinopoisk-podcasts', platform: 'youtube', url: 'https://www.youtube.com/@kinopoisk-podcasts', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 4 ролика: Решение уйти (2022), Прошлые жизни (2023) и ещё 2
  { id: 'src-yt-попкасткиносериалы', title: 'ПОПКАСТ: Кино, сериалы', handle: 'попкасткиносериалы', platform: 'youtube', url: 'https://www.youtube.com/@попкасткиносериалы', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 2 ролика: Девушка, подающая надежды (2020), Минари (2021)
  { id: 'src-yt-popcornklub', title: 'Попкорновый клуб', handle: 'popcornklub', platform: 'youtube', url: 'https://www.youtube.com/@popcornklub', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 3 ролика: Унесённые призраками (2001), Реинкарнация (2018) и ещё 1
  { id: 'src-yt-shura_stone', title: 'Похититель Ароматов 2', handle: 'shura_stone', platform: 'youtube', url: 'https://www.youtube.com/@shura_stone', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Грозовой перевал (2011)
  { id: 'src-yt-противомнениемаксимгашев', title: 'Противомнение. Максим Гашев', handle: 'противомнение.максимгашев', platform: 'youtube', url: 'https://www.youtube.com/@противомнение.максимгашев', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: CODA: Ребенок глухих родителей (2021)
  { id: 'src-yt-marina-lebed', title: 'Психолог Лебедь', handle: 'marina-lebed', platform: 'youtube', url: 'https://www.youtube.com/@marina-lebed', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Грозовой перевал (2011)
  { id: 'src-yt-radiomariarussia', title: 'Радио Мария', handle: 'radiomariarussia', platform: 'youtube', url: 'https://www.youtube.com/@radiomariarussia', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Королевство полной луны (2012)
  { id: 'src-yt-сгрол', title: 'С .Грол', handle: 'с.грол', platform: 'youtube', url: 'https://www.youtube.com/@с.грол', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Реинкарнация (2018)
  { id: 'src-yt-samoe_vremya_', title: 'Самое Время', handle: 'samoe_vremya_', platform: 'youtube', url: 'https://www.youtube.com/@samoe_vremya_', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Девушка, подающая надежды (2020)
  { id: 'src-yt-svoyoimho', title: 'СВОЁ ИМХО!', handle: 'svoyoimho', platform: 'youtube', url: 'https://www.youtube.com/@svoyoimho', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Кролик Джоджо (2019)
  { id: 'src-yt-super-uralov', title: 'Семён Уралов', handle: 'super-uralov', platform: 'youtube', url: 'https://www.youtube.com/@super-uralov', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Снегирь (2023)
  { id: 'src-yt-shipboytv', title: 'Сергей Бевз', handle: 'shipboytv', platform: 'youtube', url: 'https://www.youtube.com/@shipboytv', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Лунный свет (2016)
  { id: 'src-yt-signalsdark', title: 'Сигналы тьмы', handle: 'signalsdark', platform: 'youtube', url: 'https://www.youtube.com/@signalsdark', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Суспирия (2018)
  { id: 'src-yt-slavmir337', title: 'Славмир', handle: 'slavmir337', platform: 'youtube', url: 'https://www.youtube.com/@slavmir337', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Королевство полной луны (2012)
  { id: 'src-yt-slovo_na_f', title: 'Слово на Ф', handle: 'slovo_na_f', platform: 'youtube', url: 'https://www.youtube.com/@slovo_na_f', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Кролик Джоджо (2019)
  { id: 'src-yt-sofitmedia', title: 'СОФИТ MEDIA', handle: 'sofitmedia', platform: 'youtube', url: 'https://www.youtube.com/@sofitmedia', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Решение уйти (2022)
  { id: 'src-yt-shron_y', title: 'СХРОН', handle: 'shron_y', platform: 'youtube', url: 'https://www.youtube.com/@shron_y', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Удачи, веселья, не сдохни (2025)
  { id: 'src-yt-tmndwatch', title: 'Таймнд', handle: 'tmndwatch', platform: 'youtube', url: 'https://www.youtube.com/@tmndwatch', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Унесённые призраками (2001)
  { id: 'src-yt-тахташоу', title: 'ТАХТА ШОУ', handle: 'тахташоу', platform: 'youtube', url: 'https://www.youtube.com/@тахташоу', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Кролик Джоджо (2019)
  { id: 'src-yt-токиискиидрифт-ч3р', title: 'Токийский Дрифт', handle: 'токиискиидрифт-ч3р', platform: 'youtube', url: 'https://www.youtube.com/@токиискиидрифт-ч3р', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Сядь за руль моей машины (2021)
  { id: 'src-yt-idee1st', title: 'ТОТ САМЫЙ', handle: 'idee1st', platform: 'youtube', url: 'https://www.youtube.com/@idee1st', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Реинкарнация (2018)
  { id: 'src-yt-trollevik', title: 'Троллевик Затейник', handle: 'trollevik', platform: 'youtube', url: 'https://www.youtube.com/@trollevik', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Падение империи (2024)
  { id: 'src-yt-djmrtwister', title: 'Уголок Твистера', handle: 'djmrtwister', platform: 'youtube', url: 'https://www.youtube.com/@djmrtwister', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 3 ролика: Кролик Джоджо (2019), Девушка, подающая надежды (2020) и ещё 1
  { id: 'src-yt-horrorcabinet', title: 'Ужасный Кабинет', handle: 'horrorcabinet', platform: 'youtube', url: 'https://www.youtube.com/@horrorcabinet', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Суспирия (2018)
  { id: 'src-yt-фальшивыикритик', title: 'Фальшивый Критик', handle: 'фальшивыикритик', platform: 'youtube', url: 'https://www.youtube.com/@фальшивыикритик', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Поезд в Пусан (2016)
  { id: 'src-yt-figury_rechi', title: 'Фигуры речи', handle: 'figury_rechi', platform: 'youtube', url: 'https://www.youtube.com/@figury_rechi', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Грозовой перевал (2011)
  { id: 'src-yt-xymmel-live', title: 'ХУММЕЛЬ', handle: 'xymmel-live', platform: 'youtube', url: 'https://www.youtube.com/@xymmel-live', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Призрачная нить (2017)
  { id: 'src-yt-целлулоидакусок', title: 'Целлулоида Кусок', handle: 'целлулоидакусок', platform: 'youtube', url: 'https://www.youtube.com/@целлулоидакусок', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Реинкарнация (2018)
  { id: 'src-yt-cynicaltheorist', title: 'Циничный Теоретик', handle: 'cynicaltheorist', platform: 'youtube', url: 'https://www.youtube.com/@cynicaltheorist', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Девушка, подающая надежды (2020)
  { id: 'src-yt-kakoekino', title: 'Что за кино?', handle: 'kakoekino', platform: 'youtube', url: 'https://www.youtube.com/@kakoekino', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Ведьмы (2020)
  { id: 'src-yt-grajdaninrejisser', title: 'Что Посмотреть', handle: 'grajdaninrejisser', platform: 'youtube', url: 'https://www.youtube.com/@grajdaninrejisser', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 3 ролика: CODA: Ребенок глухих родителей (2021), Фабельманы (2022) и ещё 1
  { id: 'src-yt-tatianazhakova', title: 'Что хотел сказать автор | Сторителлинг', handle: 'tatianazhakova', platform: 'youtube', url: 'https://www.youtube.com/@tatianazhakova', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 2 ролика: Грозовой перевал (2011), Бедные-несчастные (2023)
  { id: 'src-yt-6thriver', title: 'ШЕСТАЯ РЕКА', handle: '6thriver', platform: 'youtube', url: 'https://www.youtube.com/@6thriver', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Грозовой перевал (2011)
  { id: 'src-yt-shubinstream', title: 'Шубин Stream', handle: 'shubinstream', platform: 'youtube', url: 'https://www.youtube.com/@shubinstream', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Снегирь (2023)
  { id: 'src-yt-noiseanddraft', title: 'Шум и Драфт', handle: 'noiseanddraft', platform: 'youtube', url: 'https://www.youtube.com/@noiseanddraft', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Кролик Джоджо (2019)
  { id: 'src-yt-ekranizirovano', title: 'ЭКРАНИЗИРОВАНО', handle: 'ekranizirovano', platform: 'youtube', url: 'https://www.youtube.com/@ekranizirovano', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 2 ролика: Удачи, веселья, не сдохни (2025), Сядь за руль моей машины (2021)
  { id: 'src-yt-yancritic', title: 'ЯНЕРЕЖИССЁР', handle: 'yancritic', platform: 'youtube', url: 'https://www.youtube.com/@yancritic', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Реинкарнация (2018)
  { id: 'src-yt-alexzmey', title: 'Alex Zmey (OHLOS)', handle: 'alexzmey', platform: 'youtube', url: 'https://www.youtube.com/@alexzmey', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Кролик Джоджо (2019)
  { id: 'src-yt-alexandrbashkuev9504', title: 'Alexandr Bashkuev', handle: 'alexandrbashkuev9504', platform: 'youtube', url: 'https://www.youtube.com/@alexandrbashkuev9504', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Унесённые призраками (2001)
  { id: 'src-yt-allex_sandra', title: 'Allex Sandra', handle: 'allex_sandra', platform: 'youtube', url: 'https://www.youtube.com/@allex_sandra', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Грозовой перевал (2011)
  { id: 'src-yt-allmypodcasts', title: 'Allmypodcasts', handle: 'allmypodcasts', platform: 'youtube', url: 'https://www.youtube.com/@allmypodcasts', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Поезд в Пусан (2016)
  { id: 'src-yt-altaspera', title: 'ALTASPERA', handle: 'altaspera', platform: 'youtube', url: 'https://www.youtube.com/@altaspera', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Купе номер 6 (2021)
  { id: 'src-yt-zhuban', title: 'ANOIR', handle: 'zhuban', platform: 'youtube', url: 'https://www.youtube.com/@zhuban', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 2 ролика: Падение империи (2024), Реинкарнация (2018)
  { id: 'src-yt-babako-gf2iu', title: 'Babako', handle: 'babako-gf2iu', platform: 'youtube', url: 'https://www.youtube.com/@babako-gf2iu', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Фабельманы (2022)
  { id: 'src-yt-benditospoilereng', title: 'Bendito Spoiler', handle: 'benditospoilereng', platform: 'youtube', url: 'https://www.youtube.com/@benditospoilereng', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Удачи, веселья, не сдохни (2025)
  { id: 'src-yt-bigmixer1744', title: 'Big mixer', handle: 'bigmixer1744', platform: 'youtube', url: 'https://www.youtube.com/@bigmixer1744', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Удачи, веселья, не сдохни (2025)
  { id: 'src-yt-blexinfinity', title: 'BlexInfinity', handle: 'blexinfinity', platform: 'youtube', url: 'https://www.youtube.com/@blexinfinity', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Падение империи (2024)
  { id: 'src-yt-bloodbathandbeyond', title: 'Bloodbath and Beyond', handle: 'bloodbathandbeyond', platform: 'youtube', url: 'https://www.youtube.com/@bloodbathandbeyond', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Суспирия (2018)
  { id: 'src-yt-butinacinema2298', title: 'BUTINA CINEMA', handle: 'butinacinema2298', platform: 'youtube', url: 'https://www.youtube.com/@butinacinema2298', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Кролик Джоджо (2019)
  { id: 'src-yt-smokeintherabbithole', title: 'Caveman', handle: 'smokeintherabbithole', platform: 'youtube', url: 'https://www.youtube.com/@smokeintherabbithole', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Любовное настроение (2000)
  { id: 'src-yt-chillentano', title: 'Chillentano', handle: 'chillentano', platform: 'youtube', url: 'https://www.youtube.com/@chillentano', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Падение империи (2024)
  { id: 'src-yt-cinewacinema', title: 'CINEWA', handle: 'cinewacinema', platform: 'youtube', url: 'https://www.youtube.com/@cinewacinema', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Прошлые жизни (2023)
  { id: 'src-yt-filmcorto', title: 'Corto Film', handle: 'filmcorto', platform: 'youtube', url: 'https://www.youtube.com/@filmcorto', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Ведьма (2016)
  { id: 'src-yt-danyalordchannel', title: 'DanyaLord channel', handle: 'danyalordchannel', platform: 'youtube', url: 'https://www.youtube.com/@danyalordchannel', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Падение империи (2024)
  { id: 'src-yt-demetrioalbertini4', title: 'Demetrio Albertini', handle: 'demetrioalbertini4', platform: 'youtube', url: 'https://www.youtube.com/@demetrioalbertini4', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 2 ролика: Падение империи (2024), Удачи, веселья, не сдохни (2025)
  { id: 'src-yt-ykipolunin', title: 'DMITRY POLUNIN', handle: 'ykipolunin', platform: 'youtube', url: 'https://www.youtube.com/@ykipolunin', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Падение империи (2024)
  { id: 'src-yt-suslowsshow', title: 'DOOMEDGUY', handle: 'suslowsshow', platform: 'youtube', url: 'https://www.youtube.com/@suslowsshow', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Унесённые призраками (2001)
  { id: 'src-yt-dreamernocturne', title: 'Dreamer', handle: 'dreamernocturne', platform: 'youtube', url: 'https://www.youtube.com/@dreamernocturne', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Суспирия (2018)
  { id: 'src-yt-drumdumsofficial', title: 'Drumdums', handle: 'drumdumsofficial', platform: 'youtube', url: 'https://www.youtube.com/@drumdumsofficial', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Суспирия (2018)
  { id: 'src-yt-duenda', title: 'Duenda', handle: 'duenda', platform: 'youtube', url: 'https://www.youtube.com/@duenda', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Суспирия (2018)
  { id: 'src-yt-eifiorateam4012', title: 'eifiora team', handle: 'eifiorateam4012', platform: 'youtube', url: 'https://www.youtube.com/@eifiorateam4012', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Унесённые призраками (2001)
  { id: 'src-yt-ekaparf', title: 'Ekaterina Parfenenko', handle: 'ekaparf', platform: 'youtube', url: 'https://www.youtube.com/@ekaparf', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Снегирь (2023)
  { id: 'src-yt-ekaterinaprikhoda', title: 'Ekaterina Prikhoda', handle: 'ekaterinaprikhoda', platform: 'youtube', url: 'https://www.youtube.com/@ekaterinaprikhoda', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Минари (2021)
  { id: 'src-yt-elcinemaua', title: 'elcinema support', handle: 'elcinemaua', platform: 'youtube', url: 'https://www.youtube.com/@elcinemaua', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Реинкарнация (2018)
  { id: 'src-yt-fenestraclub3902', title: 'Fenestra', handle: 'fenestraclub3902', platform: 'youtube', url: 'https://www.youtube.com/@fenestraclub3902', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Любовное настроение (2000)
  { id: 'src-yt-filmcomicsexplained', title: 'FilmComicsExplained', handle: 'filmcomicsexplained', platform: 'youtube', url: 'https://www.youtube.com/@filmcomicsexplained', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Реинкарнация (2018)
  { id: 'src-yt-flat-tvnet', title: 'Flat TV', handle: 'flat-tvnet', platform: 'youtube', url: 'https://www.youtube.com/@flat-tvnet', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Призрачная нить (2017)
  { id: 'src-yt-fleabag1871', title: 'FLEA BAG', handle: 'fleabag1871', platform: 'youtube', url: 'https://www.youtube.com/@fleabag1871', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Минари (2021)
  { id: 'src-yt-karavan_goes', title: 'Garen Avanesian', handle: 'karavan_goes', platform: 'youtube', url: 'https://www.youtube.com/@karavan_goes', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Чунгкингский экспресс (1994)
  { id: 'src-yt-gasindm', title: 'gasindm', handle: 'gasindm', platform: 'youtube', url: 'https://www.youtube.com/@gasindm', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Грозовой перевал (2011)
  { id: 'src-yt-goodevening-i8l', title: 'GoodEvening', handle: 'goodevening-i8l', platform: 'youtube', url: 'https://www.youtube.com/@goodevening-i8l', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Грозовой перевал (2011)
  { id: 'src-yt-greatreview7060', title: 'Great Review', handle: 'greatreview7060', platform: 'youtube', url: 'https://www.youtube.com/@greatreview7060', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Лунный свет (2016)
  { id: 'src-yt-greenjek', title: 'GreenJek channel', handle: 'greenjek', platform: 'youtube', url: 'https://www.youtube.com/@greenjek', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Ведьмы (2020)
  { id: 'src-yt-grinngg', title: 'Grinn', handle: 'grinngg', platform: 'youtube', url: 'https://www.youtube.com/@grinngg', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Падение империи (2024)
  { id: 'src-yt-hairyicecream', title: 'Hairy Ice Cream', handle: 'hairyicecream', platform: 'youtube', url: 'https://www.youtube.com/@hairyicecream', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 2 ролика: Реинкарнация (2018), Решение уйти (2022)
  { id: 'src-yt-heavyspoilers', title: 'Heavy Spoilers', handle: 'heavyspoilers', platform: 'youtube', url: 'https://www.youtube.com/@heavyspoilers', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Суспирия (2018)
  { id: 'src-yt-horrorgeekchannel', title: 'Horror Geek Channel', handle: 'horrorgeekchannel', platform: 'youtube', url: 'https://www.youtube.com/@horrorgeekchannel', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Реинкарнация (2018)
  { id: 'src-yt-hozports', title: "HozPort's Secret Space Station", handle: 'hozports', platform: 'youtube', url: 'https://www.youtube.com/@hozports', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Суспирия (2018)
  { id: 'src-yt-incognitapictures', title: 'INCOGNITA pictures', handle: 'incognitapictures', platform: 'youtube', url: 'https://www.youtube.com/@incognitapictures', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Оторви и выбрось (2021)
  { id: 'src-yt-inspirit_studio', title: 'InspiriT studio', handle: 'inspirit_studio', platform: 'youtube', url: 'https://www.youtube.com/@inspirit_studio', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 3 ролика: Королевство полной луны (2012), Унесённые призраками (2001) и ещё 1
  { id: 'src-yt-jum_cut', title: 'JUMPCUT', handle: 'jum_cut', platform: 'youtube', url: 'https://www.youtube.com/@jum_cut', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Снегирь (2023)
  { id: 'src-yt-just_ilya', title: 'JUST ILYA', handle: 'just_ilya', platform: 'youtube', url: 'https://www.youtube.com/@just_ilya', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Падение империи (2024)
  { id: 'src-yt-kaliframe_jp', title: 'KALI FRAME | JP', handle: 'kaliframe_jp', platform: 'youtube', url: 'https://www.youtube.com/@kaliframe_jp', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Мальчик и птица (2023)
  { id: 'src-yt-maxshkaranda', title: 'KARANDASH', handle: 'maxshkaranda', platform: 'youtube', url: 'https://www.youtube.com/@maxshkaranda', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Прошлые жизни (2023)
  { id: 'src-yt-katyagolvinarchives', title: 'Katya Golvin Archives', handle: 'katyagolvinarchives', platform: 'youtube', url: 'https://www.youtube.com/@katyagolvinarchives', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Бедные-несчастные (2023)
  { id: 'src-yt-kescinema', title: 'Kes Cinema', handle: 'kescinema', platform: 'youtube', url: 'https://www.youtube.com/@kescinema', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Любовное настроение (2000)
  { id: 'src-yt-kinom6939', title: 'KINOM', handle: 'kinom6939', platform: 'youtube', url: 'https://www.youtube.com/@kinom6939', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 6 роликов: Призрачная нить (2017), CODA: Ребенок глухих родителей (2021) и ещё 4
  { id: 'src-yt-kinomuse', title: 'KINOMUSE', handle: 'kinomuse', platform: 'youtube', url: 'https://www.youtube.com/@kinomuse', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Кролик Джоджо (2019)
  { id: 'src-yt-kinotrech', title: 'kinotrech', handle: 'kinotrech', platform: 'youtube', url: 'https://www.youtube.com/@kinotrech', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Реинкарнация (2018)
  { id: 'src-yt-maxkrylaty', title: 'KRYLATY', handle: 'maxkrylaty', platform: 'youtube', url: 'https://www.youtube.com/@maxkrylaty', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Фабельманы (2022)
  { id: 'src-yt-lefterbots', title: 'lefterbots', handle: 'lefterbots', platform: 'youtube', url: 'https://www.youtube.com/@lefterbots', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Реинкарнация (2018)
  { id: 'src-yt-lemono-cv2nx', title: 'Lemono', handle: 'lemono-cv2nx', platform: 'youtube', url: 'https://www.youtube.com/@lemono-cv2nx', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Фабельманы (2022)
  { id: 'src-yt-leofilm91', title: 'Leofilm', handle: 'leofilm91', platform: 'youtube', url: 'https://www.youtube.com/@leofilm91', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Кролик Джоджо (2019)
  { id: 'src-yt-mariaskylark8612', title: 'Maria Skylark', handle: 'mariaskylark8612', platform: 'youtube', url: 'https://www.youtube.com/@mariaskylark8612', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Ведьмы (2020)
  { id: 'src-yt-maxslife1998duo', title: "Max's Life (Жизнь Макса) Live", handle: 'maxslife1998duo', platform: 'youtube', url: 'https://www.youtube.com/@maxslife1998duo', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Удачи, веселья, не сдохни (2025)
  { id: 'src-yt-merssinnaturezkaya', title: 'Mersin и мой blog', handle: 'merssinnaturezkaya', platform: 'youtube', url: 'https://www.youtube.com/@merssinnaturezkaya', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Удачи, веселья, не сдохни (2025)
  { id: 'src-yt-moviesiloveandsocanyou', title: 'Movies I Love (and so can you)', handle: 'moviesiloveandsocanyou', platform: 'youtube', url: 'https://www.youtube.com/@moviesiloveandsocanyou', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Призрачная нить (2017)
  { id: 'src-yt-mukeyka', title: 'mukeyka', handle: 'mukeyka', platform: 'youtube', url: 'https://www.youtube.com/@mukeyka', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Кролик Джоджо (2019)
  { id: 'src-yt-nani-de7jc', title: 'Nani', handle: 'nani-de7jc', platform: 'youtube', url: 'https://www.youtube.com/@nani-de7jc', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 2 ролика: Кролик Джоджо (2019)
  { id: 'src-yt-natiamakaridze', title: 'Natia Makaridze (азиатская культура)', handle: 'natiamakaridze', platform: 'youtube', url: 'https://www.youtube.com/@natiamakaridze', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Минари (2021)
  { id: 'src-yt-nicklipsing', title: 'Nick Lisping', handle: 'nicklipsing', platform: 'youtube', url: 'https://www.youtube.com/@nicklipsing', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Унесённые призраками (2001)
  { id: 'src-yt-ninaboninabrown', title: "Nina Bo'nina Brown", handle: 'ninaboninabrown', platform: 'youtube', url: 'https://www.youtube.com/@ninaboninabrown', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Ведьмы (2020)
  { id: 'src-yt-nnnproduction', title: 'NNN Production', handle: 'nnnproduction', platform: 'youtube', url: 'https://www.youtube.com/@nnnproduction', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Призрачная нить (2017)
  { id: 'src-yt-notscary', title: 'Not Scary', handle: 'notscary', platform: 'youtube', url: 'https://www.youtube.com/@notscary', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Реинкарнация (2018)
  { id: 'src-yt-oleksandrshtupun', title: 'Oleksandr.Shtupun', handle: 'oleksandr.shtupun', platform: 'youtube', url: 'https://www.youtube.com/@oleksandr.shtupun', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Удачи, веселья, не сдохни (2025)
  { id: 'src-yt-ontv576', title: 'On tv', handle: 'ontv576', platform: 'youtube', url: 'https://www.youtube.com/@ontv576', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: CODA: Ребенок глухих родителей (2021)
  { id: 'src-yt-originstudies7114', title: 'Origin Studies', handle: 'originstudies7114', platform: 'youtube', url: 'https://www.youtube.com/@originstudies7114', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Девушка, подающая надежды (2020)
  { id: 'src-yt-oscarobzor', title: 'OSCAR OBZOR', handle: 'oscarobzor', platform: 'youtube', url: 'https://www.youtube.com/@oscarobzor', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 6 роликов: Оставленные (2023), Прошлые жизни (2023) и ещё 4
  { id: 'src-yt-pavlovrun', title: 'Pavlov RUN', handle: 'pavlovrun', platform: 'youtube', url: 'https://www.youtube.com/@pavlovrun', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Девушка, подающая надежды (2020)
  { id: 'src-yt-philosophylg', title: 'PhilosophyLg', handle: 'philosophylg', platform: 'youtube', url: 'https://www.youtube.com/@philosophylg', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Королевство полной луны (2012)
  { id: 'src-yt-proreading', title: 'proчтение', handle: 'proreading', platform: 'youtube', url: 'https://www.youtube.com/@proreading', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Грозовой перевал (2011)
  { id: 'src-yt-ravenking', title: 'RavenCroft', handle: 'ravenking', platform: 'youtube', url: 'https://www.youtube.com/@ravenking', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Кролик Джоджо (2019)
  { id: 'src-yt-re-gm3yr', title: 'Re:конструкция', handle: 're-gm3yr', platform: 'youtube', url: 'https://www.youtube.com/@re-gm3yr', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Падение империи (2024)
  { id: 'src-yt-rengeekness', title: 'Ren Geekness', handle: 'rengeekness', platform: 'youtube', url: 'https://www.youtube.com/@rengeekness', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Тик-так, бум! (2021)
  { id: 'src-yt-ruthact', title: 'RuthAct', handle: 'ruthact', platform: 'youtube', url: 'https://www.youtube.com/@ruthact', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Любовное настроение (2000)
  { id: 'src-yt-sagranna4388', title: 'Sagranna', handle: 'sagranna4388', platform: 'youtube', url: 'https://www.youtube.com/@sagranna4388', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Кролик Джоджо (2019)
  { id: 'src-yt-54m3', title: 'SAME', handle: '54m3', platform: 'youtube', url: 'https://www.youtube.com/@54m3', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Реинкарнация (2018)
  { id: 'src-yt-seanchandlerplus', title: 'Sean Chandler Plus', handle: 'seanchandlerplus', platform: 'youtube', url: 'https://www.youtube.com/@seanchandlerplus', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Вестсайдская История (2021)
  { id: 'src-yt-sergeywolfram', title: 'Sergey Wolfram', handle: 'sergeywolfram', platform: 'youtube', url: 'https://www.youtube.com/@sergeywolfram', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Кролик Джоджо (2019)
  { id: 'src-yt-shadowmansama', title: 'Shadowman', handle: 'shadowmansama', platform: 'youtube', url: 'https://www.youtube.com/@shadowmansama', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Королевство полной луны (2012)
  { id: 'src-yt-hazard4ua', title: 'Shevtar', handle: 'hazard4ua', platform: 'youtube', url: 'https://www.youtube.com/@hazard4ua', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Кролик Джоджо (2019)
  { id: 'src-yt-shotthefilm6536', title: 'SHOT THE FILM', handle: 'shotthefilm6536', platform: 'youtube', url: 'https://www.youtube.com/@shotthefilm6536', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Призрачная нить (2017)
  { id: 'src-yt-flower-t9w', title: 'SmartTube', handle: 'flower-t9w', platform: 'youtube', url: 'https://www.youtube.com/@flower-t9w', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Приключения Паддингтона 3 (2024)
  { id: 'src-yt-isaevgametrigger', title: 'Special trigger', handle: 'isaevgametrigger', platform: 'youtube', url: 'https://www.youtube.com/@isaevgametrigger', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Реинкарнация (2018)
  { id: 'src-yt-spookyastronauts', title: 'spookyastronauts', handle: 'spookyastronauts', platform: 'youtube', url: 'https://www.youtube.com/@spookyastronauts', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Суспирия (2018)
  { id: 'src-yt-stonedgremlinproductions', title: 'Stoned Gremlin Productions', handle: 'stonedgremlinproductions', platform: 'youtube', url: 'https://www.youtube.com/@stonedgremlinproductions', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Суспирия (2018)
  { id: 'src-yt-storylinefilm-n2r', title: 'Storyline Film', handle: 'storylinefilm-n2r', platform: 'youtube', url: 'https://www.youtube.com/@storylinefilm-n2r', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Грозовой перевал (2011)
  { id: 'src-yt-straightchillingpodcast', title: 'Straight Chilling', handle: 'straightchillingpodcast', platform: 'youtube', url: 'https://www.youtube.com/@straightchillingpodcast', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Падение империи (2024)
  { id: 'src-yt-superintellectual1288', title: 'Super Intellectual', handle: 'superintellectual1288', platform: 'youtube', url: 'https://www.youtube.com/@superintellectual1288', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Грозовой перевал (2011)
  { id: 'src-yt-tapereviewchannel', title: 'TapeReviewChannel', handle: 'tapereviewchannel', platform: 'youtube', url: 'https://www.youtube.com/@tapereviewchannel', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Падение империи (2024)
  { id: 'src-yt-tarabandafilm', title: 'Tarabanda film', handle: 'tarabandafilm', platform: 'youtube', url: 'https://www.youtube.com/@tarabandafilm', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Кролик Джоджо (2019)
  { id: 'src-yt-theoscarexpert', title: 'The Oscar Expert', handle: 'theoscarexpert', platform: 'youtube', url: 'https://www.youtube.com/@theoscarexpert', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Солнце моё (2022)
  { id: 'src-yt-towaroved', title: 'towaroved', handle: 'towaroved', platform: 'youtube', url: 'https://www.youtube.com/@towaroved', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Лунный свет (2016)
  { id: 'src-yt-uldandub', title: 'Uldan Dub', handle: 'uldandub', platform: 'youtube', url: 'https://www.youtube.com/@uldandub', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Мальчик и птица (2023)
  { id: 'src-yt-vadimnazarov4265', title: 'Vadim Nazarov', handle: 'vadimnazarov4265', platform: 'youtube', url: 'https://www.youtube.com/@vadimnazarov4265', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Фабельманы (2022)
  { id: 'src-yt-visioncasttv', title: 'Visioncast: подкасты о кино!', handle: 'visioncasttv', platform: 'youtube', url: 'https://www.youtube.com/@visioncasttv', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Снегирь (2023)
  { id: 'src-yt-vladdosr', title: 'VLADDOSER', handle: 'vladdosr', platform: 'youtube', url: 'https://www.youtube.com/@vladdosr', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: CODA: Ребенок глухих родителей (2021)
  { id: 'src-yt-wabarostudio', title: 'WabaroStudio', handle: 'wabarostudio', platform: 'youtube', url: 'https://www.youtube.com/@wabarostudio', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Снегирь (2023)
  { id: 'src-yt-wallofcinema', title: 'Wall of Cinema', handle: 'wallofcinema', platform: 'youtube', url: 'https://www.youtube.com/@wallofcinema', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Лунный свет (2016)
  { id: 'src-yt-watchtwr', title: 'watchtower', handle: 'watchtwr', platform: 'youtube', url: 'https://www.youtube.com/@watchtwr', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Падение империи (2024)
  { id: 'src-yt-what4watchw4w', title: 'What 4 Watch', handle: 'what4watchw4w', platform: 'youtube', url: 'https://www.youtube.com/@what4watchw4w', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Реинкарнация (2018)
  { id: 'src-yt-whyitsgreat', title: "Why It's Great", handle: 'whyitsgreat', platform: 'youtube', url: 'https://www.youtube.com/@whyitsgreat', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Минари (2021)
  { id: 'src-yt-xoxostana', title: 'XoXo Stana', handle: 'xoxostana', platform: 'youtube', url: 'https://www.youtube.com/@xoxostana', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Грозовой перевал (2011)
  { id: 'src-yt-zaurkhubulov3962', title: 'ZAUR Khubulov Live', handle: 'zaurkhubulov3962', platform: 'youtube', url: 'https://www.youtube.com/@zaurkhubulov3962', role: 'voice', kind: 'channel', tier: 'review', via: 'links' }, // 1 ролик: Ведьмы (2020)
];

function searchUrl(src: VoiceSource, query: string): string {
  const q = encodeURIComponent(query);
  // поиск работает только по публичному превью канала; у чата и у невыясненного вида
  // ведём в само место — иначе ссылка откроет пустую страницу
  if (src.kind !== 'channel') return src.url;
  // адрес канала бывает кириллическим (@Вслушивание) — в ссылке он обязан быть закодирован
  return src.platform === 'telegram'
    ? `https://t.me/s/${src.handle}?q=${q}`
    // общий поиск «фильм + канал», а не поиск внутри канала: его приложение YouTube на
    // телефоне не понимает и открывает главную канала (замечание владельца 29.09)
    : `https://www.youtube.com/results?search_query=${encodeURIComponent(`${query} ${src.title}`)}`;
}

/** Поисковые ссылки по каналам для фильма — по одной на автора, а не на канал: у Nuke есть и
 *  Telegram, и YouTube, и строка «Nuke · Nuke» ничего не объясняет. Telegram предпочтительнее:
 *  ролики этих же авторов приходят в карточку отдельно, конкретными разборами. */
export function searchLinks(work: WorkCard, role: VoiceSource['role'] = 'voice'): DiscussionPlace[] {
  if (work.type !== 'film') return [];
  const byAuthor = new Map<string, VoiceSource>();
  // обзорщиков (скетчи, шутки, просто впечатление) человеку не показываем — ни материалом, ни
  // поиском: показываем эссеистов, и их должно хватать (владелец, 29.09)
  // и книжных авторов — строка ищет фильм, а у них разговор о книгах (medium: 'book')
  for (const src of sources.filter((s) => s.role === role && !s.via && s.tier !== 'review' && (s.medium ?? 'film') === 'film')) {
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
