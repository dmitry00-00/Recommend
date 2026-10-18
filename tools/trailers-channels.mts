// Русские трейлеры с каналов прокатчиков (17.10): у 42 % фильмов (замер на 200) в TMDb есть только английский
// трейлер. Владелец подбирал русские руками (src/mocks/trailersOwn.ts: WBRussia, Централ Партнершип, Вольга) —
// здесь то же самое по загрузкам каналов прокатчиков, студий и онлайн-кинотеатров целиком.
//
//   npx tsx tools/trailers-channels.mts [--dry] [--fresh] [--tmdb-check[=300]]
//
// Загрузки — uploads-плейлист канала (1 единица квоты на 50 роликов), кэш .cache/trailers-channels/uploads.json:
// повторный прогон добирает только новое (плейлист идёт от новых к старым — листаем до первой знакомой страницы),
// --fresh — всё заново. Длительность и язык звука роликов-трейлеров — videos.list (1 единица на 50), кэш навсегда.
// Итог — .cache/trailers-channels.json `{ at, works: { 'tmdb:<n>' | 'tv:<n>': [{ k, l, t, n, ch }] } }`: его читает
// сборщик трейлеров (tools/trailers.mts); формат не менять. --dry — только замер и выборка, без записи итога.
// --tmdb-check — сколько фильмов, у которых в TMDb только английский трейлер, получают русский (ключ TMDb из .env.local).
//
// Сопоставление — только со справочником (tools/works-index.mts), без Wikidata: сегмент заголовка целиком равен
// названию (как в ~/recruit: границы закрыты, без морфологии и fuzzy), плюс год. Подробно — у match().
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { loadEnvFile } from './env-file.mts';
import { seasonRank } from './trailers-lib.mts';

/** Каналы с трейлерами. `agg` — агрегатор, не правообладатель: сопоставление строже (год в заголовке обязателен).
 *  Найдены 17.10 через channels.list?forHandle и страницу поиска YouTube; каналы Кинопоиска не берём (решение владельца).
 *  Не нашлись или пусты: Disney Россия (@disneyrussia — 0 роликов, вычищен в 2022), Ленфильм (только любительские),
 *  Кинодом, Атлантика, Monumental Pictures (@monumentalpictures — американская тёзка), Megogo Distribution (57 роликов
 *  2017-го, взят), A Company (@prolubov2015, 39 роликов до 2015-го, взят). UPI, Sony и WB встали в марте 2022-го —
 *  архив до 2022 жив и полезен. Central Partnership International — английские трейлеры русских фильмов, не берём.
 *  `old` — повторный прокат классики (Иноекино, реставрации Мосфильма): старый фильм и без слова «реставрация».
 *  `tv` — бывают и сериалы; у кинопрокатчиков без метки «сериал»/«сезон» — только фильмы («Легенды» Парадиза — не сериал). */
export const CHANNELS: Record<string, { n: string; agg?: true; tv?: true; old?: true }> = {
  // прокатчики и студии — правообладатели
  'UCuNBmYELgppqc9l94wseEeA': { n: 'WBRussia' },
  'UCoSZkP0mVJd1S5GUGALzdnA': { n: 'Централ Партнершип' },
  'UCtepcMKF1ykDS2A_2iXOTUw': { n: 'Вольга' },
  'UCuBTdBLoHfL4WEFdo3NAt9A': { n: 'КАРО.АРТ' },
  'UCzML2cPyKSodwiQD2PLmsLA': { n: 'Каро Премьер' },
  'UCkMH5IXRQJYxe2SGcN6WMKQ': { n: 'Пионер' },
  'UCAHWAi9EOjP_5W2JxYfmkwQ': { n: 'Экспонента' },
  'UCZLZXL7Qm9WNt6c2xnSineg': { n: 'Наше кино' },
  'UCrHeW5EfgJX-CDp3x6uOlKQ': { n: 'Universal Pictures Russia' },
  'UCdLZPkqjS_2MoxW248ggGgQ': { n: 'Universal Pictures Russia' },
  'UCKgFtx79Z1R61PQSB_XDUfA': { n: 'Sony Pictures Russia' },
  'UCwRvbLXj_kcAireIrqsBHCw': { n: 'Парадиз' },
  'UCnrx5k1vuxbALlR3xWnuCkg': { n: 'Атмосфера кино' },
  'UCe9_Cii0ujMJ0jiXJxki_jA': { n: 'Bazelevs' },
  'UCEK3tT7DcfWGWJpNEDBdWog': { n: 'Мосфильм', old: true },
  'UCQjejLy42aoY8cmyItEaolA': { n: 'Иноекино', old: true },
  'UC4sQc58s4WTXWISFBkAxfKg': { n: 'Капелла фильм' },
  'UCjxon0L4rK7OoNaKWaTncgQ': { n: 'Престиж Кино' },
  'UCHoVIRz40qXlT949XfYMHSQ': { n: 'Про:взгляд' },
  'UCaWVpjA0yZUtF6NrD1HpD6w': { n: 'Кинологистика' },
  'UCI1myVWNCRrp4JQK_W6UqxQ': { n: 'Megogo Distribution' },
  'UCQTbbs2hOVriTSLGPKMbr8Q': { n: 'A Company' },
  // онлайн-кинотеатры — правообладатели своих сериалов и дубляжа купленного
  'UCVq_U7ZYmaTNK5VPu0_VyBw': { n: 'PREMIER', tv: true },
  'UCRgbyMytcwJwT86rlbBHFzQ': { n: 'START', tv: true },
  'UC7a8hHrl1lrK92Ab91sOXdA': { n: 'Okko', tv: true },
  'UC3xFnRb30O9DVFbjwihizKQ': { n: 'Иви', tv: true },
  'UCDalvE0aK5bHg7W4HVoXPRg': { n: 'Wink', tv: true },
  'UCtJYgTuv37szD9vCxaQ9lAw': { n: 'KION', tv: true },
  // агрегаторы трейлеров на русском — не правообладатели; заголовки однозначные: «Название — Русский трейлер (Дубляж, 2026)»
  'UC6A-Z0jDKemh9-CwGbj5yog': { n: 'Kinoman', agg: true, tv: true },
  'UCbd7vzvz5wFe7r_KaW5tQUw': { n: 'FRESH Trailers', agg: true, tv: true },
  'UCNuQyDGBj28VwMRhCy_hTOw': { n: 'Киноафиша Трейлеры', agg: true, tv: true },
  'UCuahEjhZcUVKnxWrnYvQzlw': { n: 'Кино Трейлеры', agg: true, tv: true },
  'UCT2q7AEg3JjFpSD4JLdNWBw': { n: 'Трейлеры на русском языке', agg: true, tv: true },
  'UCC4j6vmFqFu01s2WnmlA-SA': { n: 'Русский Трейлер', agg: true, tv: true },
};

// ── разбор заголовка ─────────────────────────────────────────────────────────
export type Kind = 'T' | 'S';
export interface Parsed {
  /** трейлер или тизер; undefined — не трейлер (обзор, фрагмент, ТВ-ролик, шортс) */
  kind?: Kind;
  /** ru — дубляж или русский фильм; en — оригинал, с субтитрами */
  lang: 'ru' | 'en';
  /** варианты названия — целые сегменты заголовка */
  names: string[];
  /** год из заголовка: «(2026)», «Фильм 2023», «(Дубляж, 4K, 2027)»; не год проката «в кино с 1 мая 2026» */
  year?: number;
  /** ролик к повторному прокату — реставрация, юбилей, «снова в кино»: год не сверяется с датой ролика */
  rerelease: boolean;
  /** номер сезона: «2 сезон», «Второй сезон», «Сезон 3» */
  season?: number;
  /** о сериале: «сериал», «сезон»; о фильме: «в кино», «фильм» */
  series?: boolean;
  film?: boolean;
  /** без слова «трейлер» — только «в кино с …» у правообладателя: берётся при длительности трейлера */
  soft?: boolean;
  /** дорожка не русская и не английская: украинская, казахская — не берём */
  other?: boolean;
  /** своя озвучка, не дубляж — агрегатору не засчитывается */
  amateur?: boolean;
}

// Тизер (17.10): «тизер», «teaser», «тизер-трейлер» → S. ТВ-ролик и ТВ-спот (15–30 секунд, нарезка для эфира) — не
// трейлер: в карточке смотрится обрывком, а у фильма почти всегда есть и полный — пропускаем.
const TEASER = /(?<!\p{L})(?:тизер\p{L}*|teaser)(?!\p{L})/iu;
const TRAILER = /(?<!\p{L})(?:трейлер\p{L}*|трэйлер\p{L}*|trailer)(?!\p{L})/iu;
// не трейлер, даже если слово есть: «Как снимали», «обзор трейлера», «реакция на трейлер», «фрагмент», «интервью»
const NOT_TRAILER = new RegExp([
  // «разбор» — не «Разборки в Пусане»; «клип» — не «Клипмейкеры»; «песня» не берём вовсе: «Лебединая песня», «Зимняя песня»
  'обзор', 'разбор(?!к)', 'реакци', 'фрагмент', 'отрыв[оу]к', '[сc]цен[аы]\\s+из', 'интервью', 'клип(?:а|ы|ов)?(?!\\p{L})', 'саундтрек',
  'фичуретк', 'featurette', 'как\\s+снимал', 'создание\\s+(?:фильма|сериала)', 'истори[яи]\\s+создания', 'о\\s+создании', 'со\\s+съ[её]мочной',
  'видео\\s+со\\s+съ[её]мок', 'тв[-\\s]?(?:спот|ролик)', 'tv\\s*spot', 'промо(?![-\\s]?трейлер)', 'спецролик', 'специальный\\s+ролик',
'пародия', 'reaction', 'review', 'behind', 'interview', 'clip', 'scene', 'recap', 'пересказ',
  'вс[её]\\s+что\\s+нужно\\s+знать', 'смысл\\s+(?:фильма|сериала|концовки)', 'пасхалк', 'объяснени', 'концовк', 'киноляп',
  'ошибки\\s+в\\s+фильме', 'топ[-\\s]*\\d', '\\d+\\s+лучших\\s+(?:фильм|сериал|трейлер)',
  'трейлеры\\s+(?:недели|месяца|года|фильмов)', 'лучшие\\s+трейлеры', 'новые\\s+трейлеры', 'подборк', 'дайджест', 'премьеры\\s+(?:недели|месяца)',
  'нарезк', 'шортс', '#shorts', 'blu-?ray', 'dvd', 'трейлер\\s+игры', 'игровой\\s+трейлер', 'геймплейн', 'gameplay', 'геймплей', 'лекци',
  'встреч[аи]\\s+со?\\s+(?:зрител|режисс|актер|актёр|создател|съ[её]мочн)', 'пресс-конференц', 'премьер[аеуы]\\s+фильма\\s+(?:в|на)\\s+(?!kion|okko|wink|иви|start|premier)',
  'красн(?:ая|ой)\\s+дорожк', 'бэкстейдж', 'backstage', 'бонус', 'удал[её]нн', 'тизер\\s+о\\s+съ[её]мках', 'анонс\\s+(?:выпуск|передач)',
  // «Режиссер Клим Шипенко о фильме «Холоп 2» | Уже в кино» — рассказ о фильме, не трейлер (выборка 17.10)
  'о\\s+(?:фильме|сериале|мультфильме|съ[её]мках|героях|персонаж)', 'рассказыва', 'делится', 'вспоминают', 'поздравля',
  // «Аутсорс | Тизер-сцена» — сцена; «в переводе Гоблина» — шуточный перевод, не дубляж (выборка 17.10)
  'тизер[-\\s]сцен', 'гоблин', '(?:премьера|анонс)\\s+трейлера',
  'серия\\s*\\d', '\\d+\\s*(?:-?я\\s+)?серия', 'эпизод\\s*\\d+\\s*(?:\\||$)', 'в\\s+следующих\\s+сериях', 'шоу(?!\\p{L})', 'реалити',
].join('|'), 'iu');
// оригинальная дорожка: русские субтитры, «оригинальный трейлер», «на английском». «English subs» — наоборот: русский
// сериал с английскими субтитрами, звук русский (Wink, «Трудные подростки | Troubled Teens | Trailer (English Subs)»)
const SUBS = /\((?:en|eng)\)|(?<!\p{L})(?:субтитр\p{L}*|с\s+рус(?:ск\p{L}*)?\.?\s+суб\p{L}*|оригинальн\p{L}*\s+(?:трейлер|тизер|язык|озвучк)\p{L}*|на\s+английском|original\s+(?:trailer|version)|в\s+оригинале|без\s+перевода)(?!\p{L})/iu;
// любительская озвучка у агрегаторов — не официальная, пропускаем
// озвучка у агрегатора — чья-то своя («Озвучка Пётр Гланц»), не дубляж прокатчика: агрегатору не засчитываем.
// У правообладателя «трейлер с озвучкой Данилы Поперечного», «звёздная озвучка», «закадровое озвучание» — официальные
const AMATEUR = /(?<!\p{L})(?:озвучк\p{L}*|любительск\p{L}*|фанатск\p{L}*|многоголос\p{L}*|одноголос\p{L}*|авторск\p{L}*\s+перевод)/iu;
// повторный прокат: «4К-реставрация», «снова в кино», «в честь 35-летия», «возвращается на большие экраны»
const RERELEASE = /реставрац|ремастер|снова\s+в\s+(?:кино|прокат)|возвращ\p{L}*\s+(?:в\s+кино|на\s+(?:большие\s+)?экран)|в\s+честь\s+\d+[-\s]?лети|юбиле|повторн\p{L}*\s+прокат|re-?release|restor/iu;
// украинская или казахская дорожка: «Трейлер на украинском языке», заголовок с і, ї, є, ґ, қ, ә (выборка 17.10)
const OTHER_LANG = /украинск|українськ|казахск|қазақ|белорусск|[іїєґқәңғүұһө]/iu;
const SERIES_MARK = /(?<!\p{L})(?:сериал\p{L}*|мини-сериал|сезон\p{L}*|season|series|все\s+серии|первые\s+серии|новые\s+серии|аниме-сериал)(?!\p{L})/iu;
// «в кино с», «в прокате», «в кинотеатрах», «скоро в кино» — у прокатчика это и есть трейлер, когда слова «трейлер» нет
const FILM_MARK = /(?<!\p{L})(?:в\s+кино(?!\p{L})|в\s+прокат\p{L}*|в\s+кинотеатр\p{L}*|на\s+больших\s+экранах|на\s+большом\s+экране|фильм(?:а|е)?(?!\p{L})|мультфильм\p{L}*|movie|film)/iu;
const SOFT = /(?<!\p{L})(?:(?:уже\s+|скоро\s+|только\s+)?в\s+кино(?:\s+(?:с|со|в|уже|до))?|в\s+прокат\p{L}*\s+с|в\s+кинотеатрах|на\s+больших\s+экранах)(?!\p{L})/iu;

/** Год из заголовка — не дата проката («в кино с 21 января 2027 года», «с 13 августа»): та — год показа в России. */
function yearOf(s: string): number | undefined {
  const cleaned = s.replace(/(?:в\s+(?:кино|прокат\p{L}*|кинотеатр\p{L}*|онлайн-кинотеатр\p{L}*)|с|со|до|от)\s+\d{1,2}\s+\p{L}+\s+((?:19|20)\d{2})(?:\s*г(?:ода|\.)?)?/giu, ' ')
    .replace(/\p{L}+\s+((?:19|20)\d{2})\s*г(?:ода|\.)/giu, ' ')
    .replace(/(?:в\s+кино|в\s+прокат\p{L}*|в\s+кинотеатр\p{L}*)\s*[-–—]?\s*\p{L}*\s*((?:19|20)\d{2})/giu, ' ');
  const m = /(?:^|[^\p{L}\d])((?:19[2-9]|20[0-3])\d)(?![\p{L}\d])/u.exec(cleaned);
  return m ? Number(m[1]) : undefined;
}

// Хвост и обвязка, которую срезаем с сегмента: «Официальный трейлер», «в кино с 3 декабря», «(Дубляж, 4K, 2026)», «HD»
// «в кино с 3 декабря», «уже в онлайн-кинотеатрах»; бывает частью названия — «Братья Супер Марио в кино», «Соник 3 в кино»
const IN_CINEMA = /(?<!\p{L})(?:(?:уже\s+|скоро\s+|только\s+)?в\s+(?:кино|прокат\p{L}*|кинотеатр\p{L}*|онлайн-кинотеатр\p{L}*|okko|wink|kion|premier|start|иви)(?:\s+(?:с|со|в|уже|до|только))?(?:\s+\d{1,2}(?:[-–]\d{1,2})?\s+\p{L}+)?(?:\s+(?:19|20)\d{2})?(?:\s*(?:года|г\.))?(?:\s*г(?!\p{L}))?)(?!\p{L})/giu;
const STRIP = [
  /\((?:[^()]*?)(?:дубляж|субтитр|4k|4к|hd|\d{4})[^()]*\)/giu,
  /\[[^\]]*\]/gu,
  // «в кино с 26.08.21», «с 05.03.2020» (Иноекино)
  /(?<!\p{L})(?:в\s+(?:кино|прокат\p{L}*|кинотеатр\p{L}*)\s+)?(?:с\s+)?\d{1,2}\.\d{1,2}\.(?:\d{4}|\d{2})(?!\d)/giu,
  /(?<![\p{L}\d])(?:3d|imax|hd\d{3,4}p?)(?![\p{L}\d])/giu,
  /(?<!\p{L})премьера\s+(?:в\s+росси\p{L}*|на\s+\p{L}+)(?:\s*[-–—:]?\s*(?:с\s+)?\d{1,2}\s+\p{L}+)?(?:\s+(?:19|20)\d{2})?/giu,
  IN_CINEMA,
  // обвязка только по краям сегмента: «Новый Человек-паук», «Скоро», «Только вперёд» — названия
  /^(?:\s*(?:смотрите|смотри|только|уже|скоро|онлайн|эксклюзивно|премьера|новинка|все\s+серии|первые\s+серии)(?!\p{L}))+|(?:(?<!\p{L})(?:смотрите|только|уже|скоро|онлайн|эксклюзивно|премьера|новинка)\s*)+$/giu,
  /(?<!\p{L})(?:(?:официальн\p{L}*|основн\p{L}*|финальн\p{L}*|полн\p{L}*|русск\p{L}*|дублированн\p{L}*|международн\p{L}*|прокатн\p{L}*|первый|второй|третий|новый|финальный|главный|дубляж\p{L}*|субтитр\p{L}*|рус\.?\s*суб\p{L}*)\s+)+(?=(?:тизер|трейлер|трэйлер))/giu,
  /(?<!\p{L})(?:тизер[-\s]?трейлер\p{L}*|тизер\p{L}*|трейлер\p{L}*|трэйлер\p{L}*|teaser|trailer|official|final|ролик\p{L}*)(?:\s*(?:№\s*)?\d+)?(?!\p{L})/giu,
  /(?<!\p{L})(?:4k|4к|ultra|hd|full\s*hd|1080p?|uhd)(?!\p{L})/giu,
  /(?<!\p{L})(?:(?:с|в|на)\s+(?:русск\p{L}*\s+|английск\p{L}*\s+)?(?:субтитр\p{L}*|озвучк\p{L}*|дубляж\p{L}*)|дубляж\p{L}*|субтитр\p{L}*|на\s+русском(?:\s+языке)?|на\s+английском)(?!\p{L})/giu,
];
const GENRE_TAIL = /(?<!\p{L})(?:боевик|триллер|криминал|мелодрама|комедия|драма|фэнтези|фантастика|ужасы|хоррор|детектив|мюзикл|приключения|семейный|мультфильм|аниме|документальный|биография|военный|исторический|вестерн|спорт|романтическая|анимация|netflix|hbo|disney\+?|apple\s*tv\+?|amazon|prime\s+video)(?!\p{L})/iu;

/** Сегменты заголовка, каждый — кандидат в название целиком. Разделители — «|», «//», « / », « — », « - », «--»,
 *  эмодзи, скобки; «:» и «. » — нет: «Дюна: Часть вторая», «Мстители. Финал» — одно название. Кавычки «…» —
 *  отдельный кандидат. Название с режиссёром и подписью канала («КАРО.АРТ»: «Мементо» / Кристофер Нолан / лектор)
 *  даёт кандидатов и из подписей — они отсеются: такого названия нет. */
export function segments(title: string): string[] {
  const out = new Set<string>();
  let s = title.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]+/gu, ' | ').replace(/#\S+/g, ' ');
  const clean = (g: string, light = false) => {
    let x = g;
    for (const re of STRIP) if (!light || re !== IN_CINEMA) x = x.replace(re, ' ');
    return x.replace(/\s+/g, ' ').replace(/^[\s,.:;!?№–—-]+|[\s,.:;!?№–—-]+$/gu, '').trim();
  };
  // кавычки — название, если перед ними в том же куске пусто или родовое слово: «Сериал «Полураспад»», «Трейлер
  // фильма «Решение о ликвидации»», «Новый фильм Гая Ричи «Жена и Пёс»». «Координаты «Цитадель»» и «Проект
  // «Самоизоляция»» — кавычки внутри названия: «Цитадель» уходила к сериалу (выборка 17.10)
  const quoted: string[] = [];
  for (const m of s.matchAll(/[«"“„]([^»"”“]{1,90})[»"”“]/gu)) {
    quoted.push(fold(m[1]));
    const before = clean(s.slice(0, m.index).split(/\||\/\/|\s\/\s|\(|\)|\[|\]|\s[—–-]{1,2}\s/u).pop() ?? '');
    if (!before || /(?:фильм|сериал|мультфильм|мультсериал|к\/ф|м\/ф|аниме|комеди|драм|триллер|боевик|хоррор|ужас|мелодрам|детектив|картин|лент|фэнтези|документальн|сказк|спектакл|реставрац)/iu.test(before)) out.add(m[1]);
  }
  // «БЭТМЕН I Третий трейлер I Смотрите в кинотеатрах» — WBRussia и UPI разделяют латинской I
  s = s.replace(/[«»"“”„]/g, ' ').replace(/\s+I\s+(?=\p{Lu}|\p{Ll}+\s)/gu, ' | ');
  // «в фильме ПЛЕТЁНЫЙ МУЖ», «в сериале «Полураспад»», «Новый фильм Гая Ричи «Жена и Пёс»»
  // «БОЛЬШОЙ ВСПЛЕСК. Официальный трейлер. Премьера в России» — точка перед обвязкой тоже разделитель
  const wrap = /\.\s+(?=(?:официальн|основн|финальн|дублирован|русск|тизер|трейлер|премьер|в\s+кино|в\s+прокат|скоро|смотрите|уже\s+в)\p{L}*)/iu;
  // два уровня: крупные куски — по «|», «//», « / », скобкам; внутри — по тире. Тире бывает частью названия
  // («Мой сосед — монстр», «Любовь — всё, что тебе нужно»): если по обе стороны тире осталось содержательное, кусок
  // целиком — кандидат, а из частей — только первая и только из двух слов и длиннее («Телохранитель киллера - GreenBand»);
  // «Монстр» и «Любовь» из таких заголовков уходили к тёзкам (выборка 17.10)
  const pieces: string[] = [];
  for (const big of s.split(new RegExp(`\\s*(?:\\|{1,2}|\\/\\/|\\s\\/\\s|\\(|\\)|\\[|\\]|${wrap.source})\\s*`, 'iu'))) {
    const parts = big.split(/\s*(?:\s[—–]\s|\s-{1,2}\s|--|[—–](?=\s*\p{Lu})|_(?=\p{L}))\s*/u).map((x) => clean(x)).filter((x) => /\p{L}{3}|\d/u.test(x));
    if (/(?<!\p{L})в\s+кино(?!\p{L})/iu.test(big)) pieces.push(clean(big, true));
    if (parts.length <= 1) { pieces.push(...parts); continue; }
    pieces.push(clean(big));
    if (parts[0].split(' ').length >= 2) pieces.push(parts[0]);
  }
  for (const x of pieces) {
    if (!x) continue;
    // кусок названия в кавычках — не название: «Осторожно – любовь» не даёт «Любовь» (KION, выборка 17.10)
    const fx = fold(x);
    if (quoted.some((q) => q !== fx && ` ${q} `.includes(` ${fx} `))) continue;
    out.add(x);
    // «Норвег 2015 | Промо трейлер», «8 ЛУЧШИХ СВИДАНИЙ 2016» — год в хвосте; «Ёлки 1914» — часть названия, поэтому оба
    const ny = /^(.+?)\s+(?:19|20)\d{2}(?:\s*г\.?)?$/u.exec(x);
    if (ny) out.add(ny[1]);
    // «Оливия Колман и Александр Скарсгард в фильме ПЛЕТЁНЫЙ МУЖ» → хвост капсом
    const caps = /((?:[\p{Lu}\d][\p{Lu}\d:,.!?'’-]*\s*){1,9})$/u.exec(x);
    if (caps && caps[1].trim() !== x && /\p{Lu}{3}/u.test(caps[1])) out.add(caps[1].trim().replace(/[.,!?]+$/, ''));
    const after = /(?:^|\s)(?:в\s+(?:\p{L}+\s+)?(?:фильме|сериале|мультфильме|боевике|комедии|драме|триллере|хорроре|мелодраме|детективе|фэнтези)|(?:новый\s+|новом\s+)?фильм(?:а|е)?|сериал(?:а|е)?|мультфильм(?:а|е)?)\s+(.+)$/iu.exec(x);
    if (after) out.add(after[1].trim());
    // «Фильм Меню», «Сериал Полураспад» — родовое слово впереди
    const lead = /^(?:фильм|сериал|мультфильм|мультсериал|аниме|к\/ф|м\/ф)\s+(.+)$/iu.exec(x);
    if (lead) out.add(lead[1]);
    // хвост жанров у агрегаторов: «Сводные сестры Мультфильм, фэнтези» → до жанра
    const genre = GENRE_TAIL.exec(x);
    if (genre && genre.index > 2) out.add(x.slice(0, genre.index).replace(/[\s,.]+$/, ''));
  }
  return [...out].map((n) => n.replace(/\s+/g, ' ').trim()).filter((n) => n.length >= 2 && n.length <= 90);
}

// латиница вперемешку с кириллицей: «Город воров | The Town - Tрейлер», «БЭТМЕН I Cцена из фильма» (17.10)
const LOOK: Record<string, string> = { A: 'А', B: 'В', C: 'С', E: 'Е', H: 'Н', K: 'К', M: 'М', O: 'О', P: 'Р', T: 'Т', X: 'Х', a: 'а', c: 'с', e: 'е', o: 'о', p: 'р', x: 'х', y: 'у' };
const unmix = (s: string) => s.replace(/(?<=\p{Script=Cyrillic})[ABCEHKMOPTXaceopxy]|[ABCEHKMOPTXaceopxy](?=\p{Script=Cyrillic})/gu, (c) => LOOK[c]);

export function parse(title: string): Parsed {
  const t = unmix(title.replace(/\s+/g, ' '));
  const teaser = TEASER.test(t);
  const trailer = TRAILER.test(t);
  // «Невероятный Халк. Русский ролик», «Тюльпанная лихорадка -- русский ролик №4» — так прокатчики до 2012-го звали
  // трейлер; ТВ-ролик, промо-, спец- и рекламный ролик — нет. Как и «в кино с …» — мягкий: длительность трейлера и одно название
  const roll = /(?<!\p{L})ролик(?:\s*№?\s*\d+)?(?!\p{L})/iu.test(t) && !/(?:тв|tv|рекламн\p{L}*|промо|спец\p{L}*|вирусн\p{L}*|специальн\p{L}*)[-\s]*ролик/iu.test(t);
  const soft = !teaser && !trailer && (SOFT.test(t) || roll);
  const not = NOT_TRAILER.test(t);
  const kind: Kind | undefined = not ? undefined : teaser ? 'S' : trailer || soft ? 'T' : undefined;
  // заголовок целиком латиницей («Scarpetta — Official Trailer (2026)», «FIRE trailer english dub») — ролик английский
  const subs = (SUBS.test(t) && !/(?<!\p{L})(?:дубляж|дублированн)/iu.test(t)) || !/\p{Script=Cyrillic}/u.test(t);
  const series = SERIES_MARK.test(t) || undefined;
  const sm = /(?<!\p{L})(?:(\d{1,2})[-\s]*(?:й\s+)?сезон|сезон\s*(\d{1,2})|(перв|втор|трет|четв[её]рт|пят|шест|седьм|восьм|девят|десят)\p{L}*\s+сезон|season\s*(\d{1,2}))/iu.exec(t);
  const ORD = ['перв', 'втор', 'трет', 'четв', 'пят', 'шест', 'седьм', 'восьм', 'девят', 'десят'];
  const season = sm ? Number(sm[1] ?? sm[2] ?? sm[4]) || ORD.findIndex((o) => sm[3]?.toLowerCase().startsWith(o)) + 1 || undefined : undefined;
  const film = !series && FILM_MARK.test(t) ? true : undefined;
  return {
    ...(kind ? { kind } : {}), ...(AMATEUR.test(t) && !/(?<!\p{L})(?:дубляж|дублированн)/iu.test(t) ? { amateur: true } : {}),
    lang: subs ? 'en' : 'ru', names: segments(t), year: yearOf(t), rerelease: RERELEASE.test(t), ...(season ? { season } : {}),
    ...(OTHER_LANG.test(t) ? { other: true } : {}),
    ...(series ? { series } : {}), ...(film ? { film } : {}), ...(soft ? { soft } : {}),
  };
}

// ── сопоставление ────────────────────────────────────────────────────────────
/** Свёртка для сравнения: регистр, ё, пунктуация, римские номера частей («Рокки II» = «Рокки 2»), «&» = «и». */
const ROMAN: Record<string, string> = { ii: '2', iii: '3', iv: '4', vi: '6', vii: '7', viii: '8', ix: '9' };
export const fold = (s: string): string => s.toLowerCase().replace(/ё/g, 'е').replace(/&/g, ' и ').replace(/[’'`]/g, '')
  .replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(' ').map((w) => ROMAN[w] ?? w).join(' ');

export interface Work { key: string; title: string; orig?: string; year: number; series: boolean; by?: string[] }
export interface Video { id: string; t: string; p: string; ch: string }
export interface Hit { work: Work; via: string }

/** Индекс справочника: свёрнутое название → работы (русское и оригинальное, без кавычек и многоточий). */
export function buildIndex(works: Work[]): Map<string, Work[]> {
  const m = new Map<string, Work[]>();
  for (const w of works) {
    const names = new Set<string>();
    for (const n of [w.title, w.orig]) {
      if (!n) continue;
      names.add(fold(n));
      names.add(fold(n.replace(/\s*(?:…|\.{3})\s*/g, ' ')));
      // «Звёздные войны. Эпизод V: Империя наносит ответный удар» — каналы пишут подзаголовок
      const ep = /Эпизод\s+[IVX\d]+\s*[:.]\s*(.+)$/u.exec(n);
      if (ep && ep[1].split(/\s+/).length >= 2) names.add(fold(ep[1]));
    }
    for (const n of names) if (n) m.set(n, [...(m.get(n) ?? []), w]);
  }
  return m;
}

// Слова, которые в заголовке чаще значат не название: одно короткое слово-сегмент («Трейлер», «Кино», «Сериал»)
const GENERIC = new Set(['кино', 'фильм', 'сериал', 'трейлер', 'тизер', 'премьера', 'скоро', 'новинка', 'мультфильм', 'okko', 'иви', 'ivi',
  'wink', 'kion', 'premier', 'start', 'paradise', 'дубляж', 'субтитры', 'официальный', 'русский', 'netflix', 'hbo', 'disney', 'marvel', 'dc']);

// служебное в заголовке повторного проката: что после него осталось — уже не обвязка, а подпись (режиссёр, жанр)
const RERELEASE_WRAP = /^(?:трейлер\p{L}*|тизер\p{L}*|русск\p{L}*|официальн\p{L}*|дублирован\p{L}*|новый|в|во|к|с|со|на|и|кино|прокат\p{L}*|снова|впервые|реставрац\p{L}*|4к|4k|hd|г|год|года|честь|\d+|лети\p{L}*|режисс[её]рск\p{L}*|верси\p{L}*|фильм\p{L}*|к\/ф|кинотеатр\p{L}*|уже|скоро|только|больш\p{L}*|экран\p{L}*|возвраща\p{L}*|юбиле\p{L}*|январ\p{L}*|феврал\p{L}*|март\p{L}*|апрел\p{L}*|ма[яй]|июн\p{L}*|июл\p{L}*|август\p{L}*|сентябр\p{L}*|октябр\p{L}*|ноябр\p{L}*|декабр\p{L}*|мосфильм|cinema|trailer|смотрите|премьера|paradise|ролик\p{L}*|субтитр\p{L}*|№)$/u;
const stem = (n: string) => fold(n).slice(0, Math.max(4, Math.min(5, fold(n).length - 1)));
/** В заголовке только название и обвязка — или ещё фамилия режиссёра работы (основа, без падежа). Нужно там, где
 *  год ролика не сторожит: повторный прокат («Аниме «За облаками» Макото Синкая» — не «За облаками» Антониони,
 *  единственный тёзка в справочнике) и ролики без слова «трейлер» («Тёща | Откровения Тёщи и Зятя | Уже в кино»,
 *  «ЛЕГЕНДА О ЗЕЛЕНОМ РЫЦАРЕ | История легенды» — промо, не трейлер; выборка 17.10). */
export function onlyName(title: string, w: Work, names: string[]): boolean {
  let rest = ` ${fold(title)} `;
  for (const n of names.sort((a, b) => b.length - a.length)) rest = rest.replace(` ${n} `, ' ');
  const words = rest.trim().split(' ').filter((x) => x && !RERELEASE_WRAP.test(x));
  if (!words.length) return true;
  const sur = (w.by ?? []).map((c) => c.trim().split(/\s+/).pop() ?? '').filter((x) => x.length >= 3).map(stem);
  return sur.some((st) => words.some((x) => x.startsWith(st)));
}

/** Ролик → работа справочника. Правила (17.10, по выборке):
 *  · сегмент заголовка свёрнут и РАВЕН названию — не подстрока: «Дюна» не ловит «Дюна: Часть вторая» и наоборот,
 *    «Ёлки 9» не ловит «Ёлки»; номер части — часть названия;
 *  · год: из заголовка — год работы ±1 (у нас год мировой премьеры, в заголовке бывает год проката); без года —
 *    по дате ролика: трейлер выходит за 0–12 месяцев до премьеры, а до России фильм доходит до года позже —
 *    год работы от года ролика −1 до +1 (сериал с «сезоном» — начат не позже года ролика +1, до 15 лет раньше);
 *  · повторный прокат («реставрация», «снова в кино») — год ролика не сверяется, но название — единственное во всём
 *    справочнике и работа старше ролика на 3 года и больше;
 *  · единственный тёзка в справочнике вне окна лет — не он: ремейк или фильм, которого у нас нет («Нечто» 2011-го
 *    не отдаём «Нечто» 1982-го);
 *  · агрегатор: год в заголовке обязателен и сходится с датой ролика (−1…+1), либо оригинальное название в
 *    заголовке указывает на ту же работу;
 *  · несколько кандидатов после всех сит — молчим; название из одного слова короче 4 букв — только с годом в заголовке. */
export function match(v: Video, p: Parsed, index: Map<string, Work[]>, { agg = false, tv = false, old = false }: { agg?: boolean; tv?: boolean; old?: boolean } = {}): Hit | undefined {
  if ((agg && p.amateur) || p.other) return undefined;
  const py = Number(v.p.slice(0, 4));
  const found = new Map<string, { w: Work; names: Set<string> }>();
  for (const name of p.names) {
    const f = fold(name);
    if (!f || GENERIC.has(f) || /^\d+$/.test(f)) continue;
    for (const w of index.get(f) ?? []) {
      const e = found.get(w.key) ?? { w, names: new Set<string>() };
      e.names.add(f);
      found.set(w.key, e);
    }
  }
  if (!found.size) return undefined;
  let cand = [...found.values()];
  // сериал или фильм по метке
  if (p.series) cand = cand.filter((c) => c.w.series);
  else if (p.film || !tv) cand = cand.filter((c) => !c.w.series);
  const inWindow = (w: Work): boolean => {
    // сезон N выходит не раньше чем через N−1 лет после первого: «Бывшие. Второй сезон» 2019-го — не «The Exes» 2011-го;
    // год в заголовке у сезона — год сезона («Дом Дракона (3 сезон) … 2026»)
    if (w.series && p.season) {
      const ref = p.year ?? py;
      return w.year <= ref + 1 && w.year >= ref - 2 * p.season && (!agg || (p.year != null && p.year >= py - 1 && p.year <= py + 1));
    }
    if (p.year) return Math.abs(w.year - p.year) <= 1 && (!agg || (p.year >= py - 1 && p.year <= py + 1));
    if (agg) return false;
    // прокат классики выпускает уже вышедшее: «5 сантиметров в секунду» Иноекино в 2024-м — аниме 2007-го, не фильм 2025-го
    return w.year >= py - 1 && w.year <= py + (old ? 0 : 1);
  };

  let pick = cand.filter((c) => inWindow(c.w));
  let via = p.year ? 'год в заголовке' : 'год ролика';
  // агрегатор без года: оригинальное название в заголовке тоже указывает на эту работу
  if (agg && !pick.length && !p.year) {
    const both = cand.filter((c) => c.w.orig && c.names.has(fold(c.w.orig)) && c.names.has(fold(c.w.title)) && fold(c.w.orig) !== fold(c.w.title)
      && c.w.year >= py - 1 && c.w.year <= py + 1);
    if (both.length === 1) { pick = both; via = 'два названия'; }
  }
  if (!pick.length && (p.rerelease || old) && !agg && found.size === 1 && cand.length === 1 && cand[0].w.year <= py - 3
    && onlyName(v.t, cand[0].w, [...cand[0].names])) { pick = cand; via = 'повторный прокат'; }
  // из оставшихся: совпало больше названий (русское и оригинальное), потом самое длинное — «Ёлки 9» сильнее «Ёлки»
  if (pick.length > 1) {
    const most = Math.max(...pick.map((c) => c.names.size));
    pick = pick.filter((c) => c.names.size === most);
    const len = (c: { names: Set<string> }) => Math.max(...[...c.names].map((n) => n.length));
    const longest = Math.max(...pick.map(len));
    pick = pick.filter((c) => len(c) === longest);
  }
  if (pick.length !== 1) return undefined;
  const [c] = pick;
  if (p.soft && !onlyName(v.t, c.w, [...c.names])) return undefined;
  // короткое название из одного слова — только с годом в заголовке
  const best = [...c.names].sort((a, b) => b.length - a.length)[0];
  if (!best.includes(' ') && best.length < 4 && !p.year) return undefined;
  // онлайн-кинотеатр, название из одного слова, год только по ролику — год ролика и есть год работы: у них свои фильмы
  // одного года с роликом, а тёзки на год раньше или позже — чужие («Надежда» START 2020-го с Исаковой — не норвежская
  // «Надежда» 2019-го, «Волны» PREMIER 2023-го — не «Waves» 2024-го; выборка 17.10)
  if (tv && !agg && !best.includes(' ') && via === 'год ролика' && c.w.year !== py) return undefined;
  return { work: c.w, via };
}

// ── прогон ───────────────────────────────────────────────────────────────────
/** Порядок роликов у работы (в итог идут первые четыре): русский раньше; у сериала — первый сезон или без номера
 *  раньше, потом по номеру сезона, серии — в конце (18.10, seasonRank из trailers-lib.mts — тот же, что у сборщика:
 *  раньше «5 сезон» правообладателя вытеснял общий трейлер агрегатора, а номер сезона шёл после вида и канала);
 *  трейлер раньше тизера, правообладатель раньше агрегатора, твёрдый трейлер раньше мягкого, потом новее. */
export function hitOrder(a: { v: Video & { parsed: Parsed }; h: Hit }, b: { v: Video & { parsed: Parsed }; h: Hit }): number {
  const rank = (x: { v: Video & { parsed: Parsed }; h: Hit }) => [x.v.parsed.lang === 'ru' ? 0 : 1, x.h.work.series ? seasonRank(x.v.t) : 0,
    x.v.parsed.kind === 'T' ? 0 : 1, CHANNELS[x.v.ch]?.agg ? 1 : 0, x.v.parsed.soft ? 1 : 0];
  const ra = rank(a), rb = rank(b);
  for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) return ra[i] - rb[i];
  return b.v.p.localeCompare(a.v.p);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();

async function main(): Promise<void> {
  loadEnvFile();
  const argv = process.argv.slice(2);
  const DRY = argv.includes('--dry');
  const FRESH = argv.includes('--fresh');
  const CHECK = argv.find((a) => a.startsWith('--tmdb-check'));
  const key = process.env.YT_API_KEY;
  if (!key) { console.error('нужен YT_API_KEY в .env.local'); process.exit(2); }
  const root = new URL('../', import.meta.url);
  const DIR = new URL('.cache/trailers-channels/', root);
  mkdirSync(DIR, { recursive: true });
  let units = 0;
  const yt = async <T,>(path: string, q: Record<string, string>): Promise<T | undefined> => {
    for (let a = 0; a < 3; a++) {
      units += 1;
      const r = await fetch(`https://www.googleapis.com/youtube/v3/${path}?${new URLSearchParams({ ...q, key })}`, { signal: AbortSignal.timeout(20000) })
        .then(async (x) => (x.ok ? x.json() : { error: x.status })).catch(() => undefined) as (T & { error?: unknown }) | undefined;
      if (r && !r.error) return r;
      if (r?.error === 403) { console.error('  квота YouTube кончилась или ключ не пускают — стоп'); return undefined; }
      await new Promise((ok) => setTimeout(ok, 2000 * (a + 1)));
    }
    return undefined;
  };

  // 1. загрузки каналов
  type Up = { id: string; t: string; p: string };
  const UPLOADS = new URL('uploads.json', DIR);
  const uploads: Record<string, { at: string; items: Up[] }> = !FRESH && existsSync(UPLOADS) ? JSON.parse(readFileSync(UPLOADS, 'utf8')) : {};
  for (const [ch, { n }] of Object.entries(CHANNELS)) {
    const had = uploads[ch];
    if (had && Date.now() - Date.parse(had.at) < 20 * 3600e3) continue;
    const known = new Set(had?.items.map((i) => i.id) ?? []);
    const fresh: Up[] = [];
    let page = '';
    let stop = false;
    do {
      const r = await yt<{ items?: { snippet: { title: string; publishedAt: string; resourceId?: { videoId?: string } } }[]; nextPageToken?: string }>('playlistItems', {
        part: 'snippet', playlistId: `UU${ch.slice(2)}`, maxResults: '50', fields: 'nextPageToken,items(snippet(title,publishedAt,resourceId/videoId))', ...(page ? { pageToken: page } : {}),
      });
      if (!r) { console.error(`  ${n}: нет ответа`); stop = true; break; }
      const got = (r.items ?? []).map((i) => ({ id: i.snippet.resourceId?.videoId ?? '', t: i.snippet.title, p: i.snippet.publishedAt })).filter((i) => i.id);
      fresh.push(...got.filter((i) => !known.has(i.id)));
      // страница целиком знакомая — дальше старое
      if (known.size && got.every((i) => known.has(i.id))) break;
      page = r.nextPageToken ?? '';
    } while (page);
    if (stop && !had) continue;
    uploads[ch] = { at: new Date().toISOString(), items: [...fresh, ...(had?.items.filter((i) => !fresh.some((f) => f.id === i.id)) ?? [])] };
    writeFileSync(UPLOADS, JSON.stringify(uploads));
    console.error(`  ${n}: ${uploads[ch].items.length} (новых ${fresh.length})`);
  }

  // 2. разбор и длительность
  const videos: (Video & { parsed: Parsed })[] = Object.entries(uploads).filter(([ch]) => CHANNELS[ch])
    .flatMap(([ch, u]) => u.items.map((i) => ({ ...i, ch, parsed: parse(i.t) })));
  const trailers = videos.filter((v) => v.parsed.kind);
  const META = new URL('videos.json', DIR);
  // s — длительность, с (−1 — удалён или скрыт); a — язык звука по YouTube (ненадёжен, только для разбора);
  // ok — встраивается и не закрыт в России (у сопоставленных)
  const meta: Record<string, { s: number; a?: string; ok?: boolean }> = existsSync(META) ? JSON.parse(readFileSync(META, 'utf8')) : {};
  const need = trailers.map((v) => v.id).filter((id) => !meta[id]);
  for (let i = 0; i < need.length; i += 50) {
    const ids = need.slice(i, i + 50);
    const r = await yt<{ items?: { id: string; contentDetails?: { duration?: string }; snippet?: { defaultAudioLanguage?: string } }[] }>('videos', {
      part: 'contentDetails,snippet', id: ids.join(','), maxResults: '50', fields: 'items(id,contentDetails/duration,snippet/defaultAudioLanguage)',
    });
    if (!r) break;
    for (const id of ids) meta[id] = { s: -1 }; // удалён или скрыт
    for (const it of r.items ?? []) {
      const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(it.contentDetails?.duration ?? '') ?? [];
      meta[it.id] = { s: Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0), ...(it.snippet?.defaultAudioLanguage ? { a: it.snippet.defaultAudioLanguage } : {}) };
    }
    if ((i / 50) % 20 === 19) writeFileSync(META, JSON.stringify(meta));
  }
  writeFileSync(META, JSON.stringify(meta));
  // длительность трейлера: 40 с – 5 мин; без слова «трейлер» («в кино с …») — 75 с – 4 мин, короче — ТВ-ролик или шортс
  const okLen = (v: Video & { parsed: Parsed }) => { const s = meta[v.id]?.s ?? 0; return v.parsed.soft ? s >= 75 && s <= 240 : s >= 40 && s <= 300; };
  const usable = trailers.filter(okLen);

  // 3. справочник
  const { worksIndex, idsOf } = await import('./works-index.mts');
  const { isSeries } = await import('../src/lib/media.ts');
  const seasons: Record<string, { tv?: number | null }> = existsSync(new URL('.cache/series-seasons/raw.json', root))
    ? JSON.parse(readFileSync(new URL('.cache/series-seasons/raw.json', root), 'utf8')) : {};
  const works: Work[] = [];
  for (const { work } of worksIndex({ all: true })) {
    if (work.type === 'book' || !work.year) continue;
    const ser = isSeries(work);
    const ids = idsOf(work);
    // сериал — номер из ряда /tv/: из ID карточки («l-tmdbtv1433») или кэша сезонов по IMDb (tools/series-seasons.mts)
    const tv = ser ? Number(/-tmdbtv(\d+)$/.exec(work.id)?.[1] ?? (ids?.imdb ? seasons[ids.imdb]?.tv : 0) ?? 0) : 0;
    const k = ser ? (tv ? `tv:${tv}` : '') : ids?.tmdb != null ? `tmdb:${ids.tmdb}` : '';
    if (k) works.push({ key: k, title: work.title, ...(work.originalTitle ? { orig: work.originalTitle } : {}), year: work.year, series: ser, ...(work.creators?.length ? { by: work.creators } : {}) });
  }
  const index = buildIndex(works);

  // 4. сопоставление
  type Out = { k: string; l: 'ru' | 'en'; t: Kind; n: string; ch: string };
  const matched: { v: Video & { parsed: Parsed }; h: Hit }[] = [];
  for (const v of usable) {
    const h = match(v, v.parsed, index, CHANNELS[v.ch]);
    if (h) matched.push({ v, h });
  }
  // у сопоставленных — можно ли встроить и не закрыт ли ролик в России (status, regionRestriction; 1 единица на 50)
  const needSt = matched.map((x) => x.v.id).filter((id) => meta[id] && meta[id].ok === undefined);
  for (let i = 0; i < needSt.length; i += 50) {
    const ids = needSt.slice(i, i + 50);
    const r = await yt<{ items?: { id: string; status?: { embeddable?: boolean }; contentDetails?: { regionRestriction?: { blocked?: string[]; allowed?: string[] } } }[] }>('videos', {
      part: 'status,contentDetails', id: ids.join(','), maxResults: '50', fields: 'items(id,status/embeddable,contentDetails/regionRestriction)',
    });
    if (!r) break;
    for (const id of ids) meta[id].ok = false;
    for (const it of r.items ?? []) {
      const rr = it.contentDetails?.regionRestriction;
      meta[it.id].ok = it.status?.embeddable !== false && !rr?.blocked?.includes('RU') && !(rr?.allowed && !rr.allowed.includes('RU'));
    }
  }
  if (needSt.length) writeFileSync(META, JSON.stringify(meta));
  // «дубляж» агрегатора у зарубежного фильма, вышедшего после ухода студий (март 2022), — неофициальный (17.10, владелец:
  // агрегатор — запасной, когда нет правообладателя, но без такого дубляжа). Зарубежный — оригинальное название латиницей
  const unofficial = (x: (typeof matched)[number]) => CHANNELS[x.v.ch].agg && x.v.parsed.lang === 'ru' && x.h.work.year >= 2022
    && x.v.p >= '2022-03' && /[a-z]/i.test(x.h.work.orig ?? '') && !/[а-яё]/i.test(x.h.work.orig ?? '');
  const dubs = matched.filter(unofficial).length;
  const hits = matched.filter((x) => meta[x.v.id]?.ok !== false && !unofficial(x));
  const closed = matched.filter((x) => meta[x.v.id]?.ok === false).length;
  const byWork = new Map<string, typeof hits>();
  for (const x of hits) byWork.set(x.h.work.key, [...(byWork.get(x.h.work.key) ?? []), x]);
  const out: Record<string, Out[]> = {};
  for (const [k, xs] of byWork) {
    xs.sort(hitOrder);
    out[k] = xs.slice(0, 4).map(({ v }) => ({ k: v.id, l: v.parsed.lang, t: v.parsed.kind!, n: v.t, ch: CHANNELS[v.ch].n }));
  }

  // 5. сводка
  const ruWorks = Object.values(out).filter((xs) => xs.some((x) => x.l === 'ru')).length;
  console.log(`роликов ${videos.length}, трейлеров по заголовку ${trailers.length}, по длительности ${usable.length}, сопоставлено ${matched.length}, из них не встраиваются или закрыты в России ${closed}, неофициальный дубляж агрегаторов ${dubs}`);
  console.log(`работ с трейлером ${Object.keys(out).length} (фильмов ${Object.keys(out).filter((k) => k.startsWith('tmdb:')).length}, сериалов ${Object.keys(out).filter((k) => k.startsWith('tv:')).length}), из них с русским ${ruWorks}`);
  const perCh = new Map<string, [number, number, number]>();
  for (const v of videos) { const c = perCh.get(CHANNELS[v.ch].n) ?? [0, 0, 0]; c[0] += 1; if (v.parsed.kind && okLen(v)) c[1] += 1; perCh.set(CHANNELS[v.ch].n, c); }
  for (const { v } of hits) perCh.get(CHANNELS[v.ch].n)![2] += 1;
  for (const [n, [a, b, c]] of [...perCh].sort((x, y) => y[1][2] - x[1][2])) console.log(`  ${n.padEnd(28)} роликов ${String(a).padStart(5)}, трейлеров ${String(b).padStart(5)}, сопоставлено ${String(c).padStart(5)}`);
  const via = new Map<string, number>();
  for (const { h } of hits) via.set(h.via, (via.get(h.via) ?? 0) + 1);
  console.log(`  по: ${[...via].map(([k, n]) => `${k} ${n}`).join(', ')}`);

  // выборка для проверки глазами: 40 случайных с разных каналов (зерно — день, чтобы повтор давал ту же)
  let seed = Number(argv.find((a) => a.startsWith('--seed='))?.slice(7) ?? new Date().toISOString().slice(0, 10).replace(/-/g, ''));
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const byCh = new Map<string, typeof hits>();
  for (const x of hits) byCh.set(x.v.ch, [...(byCh.get(x.v.ch) ?? []), x]);
  const sample: typeof hits = [];
  const pools = [...byCh.values()].map((xs) => [...xs].sort(() => rnd() - 0.5));
  for (let i = 0; sample.length < 40 && i < 200; i++) for (const p of pools) if (p[i] && sample.length < 40) sample.push(p[i]);
  writeFileSync(new URL('sample.tsv', DIR), ['канал\tролик\tдата\tработа\tгод\tключ\tпо\tl\tt', ...sample.map(({ v, h }) =>
    [CHANNELS[v.ch].n, v.t, v.p.slice(0, 10), h.work.title + (h.work.orig ? ` / ${h.work.orig}` : ''), h.work.year, h.work.key, h.via, v.parsed.lang, v.parsed.kind].join('\t'))].join('\n') + '\n');
  // все сопоставления — для проверки глазами и разбора спорного
  writeFileSync(new URL('hits.tsv', DIR), hits.map(({ v, h }) => [CHANNELS[v.ch].n, v.t, v.p.slice(0, 10), h.work.title + (h.work.orig ? ` / ${h.work.orig}` : ''),
    h.work.year, h.work.key, h.via, v.parsed.lang, v.parsed.kind].join('\t')).join('\n') + '\n');
  if (!DRY) writeFileSync(new URL('.cache/trailers-channels.json', root), JSON.stringify({ at: new Date().toISOString(), works: out }));
  console.log(`${DRY ? 'замер' : '→ .cache/trailers-channels.json'}; выборка — .cache/trailers-channels/sample.tsv; квота YouTube: ${units} единиц`);

  // 6. замер на фильмах, где в TMDb только английский трейлер
  if (CHECK) await tmdbCheck(Number(CHECK.split('=')[1] ?? 300), works, out, DIR);
}

/** Сколько фильмов с одним английским трейлером в TMDb получают русский: случайные фильмы основного справочника
 *  (filmBase — размеченное, filmBasePopular — что ищут), /movie/{id}/videos (кэш .cache/trailers-channels/tmdb.json),
 *  пока не наберётся `n` таких. Для сравнения — столько же по всему справочнику (там много старого и редкого). */
async function tmdbCheck(n: number, works: Work[], out: Record<string, { l: string }[]>, DIR: URL): Promise<void> {
  const key = process.env.VITE_TMDB_API_KEY ?? process.env.TMDB_API_KEY;
  if (!key) { console.error('нет ключа TMDb'); return; }
  const CACHE = new URL('tmdb.json', DIR);
  const cache: Record<string, { ru: boolean; en: boolean }> = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : {};
  const { filmBase } = await import('../src/mocks/filmBase.ts');
  const { filmBasePopular } = await import('../src/mocks/filmBasePopular.ts');
  const main = new Set([...filmBase, ...filmBasePopular].filter((w) => w.type === 'film' && w.externalIds?.tmdb != null).map((w) => `tmdb:${w.externalIds!.tmdb}`));
  const films = works.filter((w) => !w.series);
  for (const [label, pool] of [['основной справочник', films.filter((w) => main.has(w.key))], ['весь справочник', films]] as const) {
    let seed = 1710;
    const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
    const enOnly: Work[] = [];
    let asked = 0;
    for (const w of [...pool].sort(() => rnd() - 0.5)) {
      if (enOnly.length >= n) break;
      const id = w.key.slice(5);
      if (!cache[id]) {
        const bearer = key.length > 40;
        const get = (lang: string) => fetch(`https://api.themoviedb.org/3/movie/${id}/videos?language=${lang}${bearer ? '' : `&api_key=${key}`}`,
          { ...(bearer ? { headers: { Authorization: `Bearer ${key}` } } : {}), signal: AbortSignal.timeout(15000) })
          .then((r) => (r.ok ? r.json() : { results: [] })).then((b: { results?: { site: string; type: string }[] }) =>
            (b.results ?? []).some((v) => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser'))).catch(() => false);
        cache[id] = { ru: await get('ru-RU'), en: await get('en-US') };
      }
      asked += 1;
      if (!cache[id].ru && cache[id].en) enOnly.push(w);
    }
    writeFileSync(CACHE, JSON.stringify(cache));
    const got = (ws: Work[]) => ws.filter((w) => out[w.key]?.some((x) => x.l === 'ru')).length;
    console.log(`TMDb, ${label}: опрошено ${asked} фильмов, только английский трейлер у ${enOnly.length} (${Math.round(100 * enOnly.length / Math.max(1, asked))} %); русский с каналов получили ${got(enOnly)} (${Math.round(100 * got(enOnly) / Math.max(1, enOnly.length))} %)`);
    for (const [a, b] of [[0, 1999], [2000, 2009], [2010, 2021], [2022, 2100]]) {
      const ws = enOnly.filter((w) => w.year >= a && w.year <= b);
      console.log(`  ${a}–${b > 2050 ? '…' : b}: ${ws.length}, получили ${got(ws)}`);
    }
  }
}
