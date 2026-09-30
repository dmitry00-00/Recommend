// Улики привязки (трек В, шаг В3): когда привязка разбора к фильму по названию подтверждается
// без человека. Название совпало — это догадка («Призрак» Полански и «Призрак в доспехах»).
// Догадка становится фактом, если рядом есть то, что у тёзки не совпадёт:
//
//   · link     — пост ссылается на страницу именно этого фильма: Кинопоиск, IMDb или TMDb по
//                тому же идентификатору. Сильнее не бывает;
//   · year     — рядом с названием стоит год выхода этого фильма. У тёзок годы разные, а
//                «Название (2012)» — обычная подпись разбора у каналов;
//   · original — в тексте есть и оригинальное название латиницей («Прочь / Get Out»).
//
// Чего правило не делает: не подтверждает по одному названию, как бы длинно оно ни было, и не
// опровергает — отсутствие улики значит «не знаем», а не «не тот фильм». Что осталось без
// улики, остаётся в очереди «тот ли это фильм».
import type { WorkCard } from '../src/types/tmdf.ts';
import { latinContinues } from './title-match.mts';

/** Слова с большой буквы после названия, которые не имя: «"Бессонница" Часть 2». */
const NOT_NAME = new Set(['часть', 'серия', 'сезон', 'эпизод', 'глава', 'фильм', 'сериал', 'обзор', 'разбор',
  'смысл', 'трейлер', 'тизер', 'рецензия', 'финал', 'новости', 'кино', 'выпуск', 'том', 'книга']);
const CYR_NAME = /[А-ЯЁа-яё]/;
const stem4 = (s: string) => s.toLowerCase().replace(/ё/g, 'е');

/** Чужой режиссёр сразу после названия в кавычках: «Легенда» (18+) Брайана Хелгеленда — это не
 *  «Легенда» Ридли Скотта, «Дракула» Люка Бессона — не Копполы, «Начало» Деа Кулумбегашвили —
 *  не Нолана. Каналы подписывают фильм режиссёром в родительном падеже; сравниваем начала слов
 *  (Андерсон/Андерсона, Ассаяс/Ассайаса, Дэв…/Дэвид — хватает четырёх букв). Только когда
 *  создатели у нас записаны кириллицей: у латинских («Chazelle» против «Шазелла») без транслитерации сравнивать нечем, а ложная тревога
 *  здесь стоит привязки. Замер 30.09 на 2 870 автопривязках: с кириллическими создателями
 *  сторож сработал 14 раз — все 14 тёзки или ремейки. Актёр после названия дал бы ложную
 *  тревогу, поэтому год фильма рядом с названием (улика `year`) проверяется раньше. */
export function foreignCreator(work: WorkCard, head: string): string | undefined {
  const creators = (work.creators ?? []).filter((c) => CYR_NAME.test(c));
  if (!creators.length || !work.title) return undefined;
  const esc = work.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ё/gi, '[её]');
  const m = new RegExp(`[«"„]${esc}[»"“]\\s*(?:\\(\\d+\\+\\)\\s*)?((?:[А-ЯЁ][а-яё]+(?:[-\\s](?=[А-ЯЁ]))?){1,3})(?![а-яёА-ЯЁ])`, 'u').exec(head);
  if (!m) return undefined;
  const words = m[1].split(/[\s-]+/).filter((w) => w && !NOT_NAME.has(w.toLowerCase()));
  if (!words.length || /^\s*\d/.test(head.slice(m.index + m[0].length))) return undefined;
  // подпись режиссёром — в родительном: «Брайана», «Алексея», «Деа», «Дэнни». Имя в именительном
  // — подлежащее следующей фразы, чаще актёр: «…таланта» Николас Кейдж дал интервью (замер 30.09)
  if (!/[аяиыоуеё]$/i.test(words[0])) return undefined;
  const known = creators.flatMap((c) => c.split(/[\s-]+/)).map(stem4).filter((w) => w.length >= 3);
  const same = (a: string, b: string) => { const n = Math.min(a.length, b.length, 4); return n >= 3 && a.slice(0, n) === b.slice(0, n); };
  return words.some((w) => known.some((k) => same(stem4(w), k))) ? undefined : m[1];
}

export type Evidence = 'link' | 'year' | 'original';
/** Противоречие: рядом с названием стоят годы, и ни один не похож на год этого фильма.
 *  Так выглядит ремейк или тёзка — «Хэллоуин 2007» при «Хэллоуине» 1978-го (замер 24.09:
 *  без этого правила оригинальное название подтверждало ремейки — у них оно общее). */
export type Verdict = Evidence | 'conflict' | undefined;

/** Сколько текста вокруг заголовка смотрим: подпись разбора — в начале поста или ролика. */
const HEAD = 400;

const kinopoiskId = (w: WorkCard): number | undefined =>
  w.externalIds?.kinopoisk ?? (/^u-kp(\d+)$/.exec(w.id) ? Number(/^u-kp(\d+)$/.exec(w.id)![1]) : undefined);

export function evidenceFor(work: WorkCard, text: string, links: string[] = []): Verdict {
  const ids = work.externalIds ?? {};
  const kp = kinopoiskId(work);
  const hay = [text, ...links].join(' ');
  if (kp && new RegExp(`kinopoisk\\.ru/(?:film|series)/${kp}(?!\\d)`).test(hay)) return 'link';
  if (ids.imdb && new RegExp(`imdb\\.com/title/${ids.imdb}(?!\\d)`).test(hay)) return 'link';
  if (ids.tmdb != null && new RegExp(`themoviedb\\.org/(?:movie|tv)/${ids.tmdb}(?!\\d)`).test(hay)) return 'link';

  const head = text.slice(0, HEAD);
  const yearsIn = (s: string) => [...new Set([...s.matchAll(/(?<!\d)(19[0-9]{2}|20[0-4][0-9])(?!\d)/g)].map((m) => Number(m[1])))];
  const years = yearsIn(head);
  // ±1: фестивальный год и год проката у одного фильма часто разные;
  // подборка «лучшее 2010-х» с десятком годов — ни улика, ни противоречие
  if (work.year && years.length && years.length <= 2 && years.some((y) => Math.abs(y - work.year) <= 1)) return 'year';
  // Противоречие — только в заголовке (первая строка): «Хэллоуин 2007», «(Lembayung, 2024)».
  // Год дальше по тексту обычно про другое — «следующей работой режиссёра в 2021-м» (замер 24.09)
  // Противоречие-режиссёр: после названия в кавычках назван чужой создатель (30.09)
  if (foreignCreator(work, head)) return 'conflict';
  const title = head.split('\n').map((l) => l.trim()).find(Boolean)?.slice(0, 150) ?? '';
  const titleYears = yearsIn(title);
  if (work.year && titleYears.length && titleYears.length <= 2 && !titleYears.some((y) => Math.abs(y - work.year) <= 1)) return 'conflict';
  const orig = work.originalTitle?.trim();
  if (orig && orig.length >= 5 && /[A-Za-z]/.test(orig) && orig.toLowerCase() !== work.title.toLowerCase()) {
    const esc = orig.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    // и не внутри чужого, более длинного названия: «Legend» в «The Legend of Zelda» (30.09)
    for (const m of head.matchAll(new RegExp(`(?<![\\p{L}\\p{N}])${esc}(?![\\p{L}\\p{N}])`, 'giu'))) {
      if (!latinContinues(m[0], head.slice(0, m.index), head.slice(m.index + m[0].length))) return 'original';
    }
  }
  return undefined;
}

/** Материал вышел раньше фильма больше чем на год — он не про этот фильм: «Близко» 2022-го в
 *  ролике 2018-го, «Джокер» 2019-го в 2017-м. Год запаса — фестивальный показ и прокат; анонс
 *  за два года и больше — новость о проекте, а не разбор (замер 30.09: 65 привязок). */
export function tooEarly(work: WorkCard, publishedAt?: string): boolean {
  const pub = publishedAt ? Number(publishedAt.slice(0, 4)) : NaN;
  return Boolean(work.year) && Number.isFinite(pub) && pub < work.year - 1;
}

/** Слова, по которым материал говорит о сериале. «Веб-сериал» — рубрика канала «ЭПИЗОДЫ», не тема. */
const SERIES_TALK = /(?<!веб-)сериал|(?<!\p{L})сезон|(?<!\p{L})сери(?:я|и|ю|ей|ях)(?!\p{L})|шоураннер/iu;

/** Из тёзок с одинаково длинным совпадением названия — тот, о ком материал. Раньше побеждал
 *  первый по порядку справочников, и «Пацаны» 1983-го собирали всё о сериале The Boys, «Ведьмак»
 *  2001-го — о сериале Netflix, «Обитель зла» 2002-го — о сериале 2022-го (замер 30.09: 177
 *  материалов у тёзок). Порядок решений, от сильного к слабому:
 *   1. тёзка, вышедший позже материала больше чем на год, отпадает (`tooEarly`);
 *   2. у кого есть улика (ссылка, год, оригинальное название) — тот; у кого противоречие — отпадает;
 *   3. материал говорит о сериале — сериал, иначе — фильм;
 *   4. дальше как раньше — первый по порядку. Самого свежего не берём нарочно: эссеисты
 *      разбирают классику, и «ближайший по дате» уводил «Хэллоуин, 1978, реж. Карпентер» к
 *      ремейку 2018-го, а «Мастера» Пола Томаса Андерсона — к «Мастеру» 2025-го. */
export function pickNamesake<T extends { work: WorkCard }>(cands: T[], text: string, publishedAt?: string, links: string[] = []): T | undefined {
  if (cands.length < 2) return cands[0];
  let pool = cands.filter((c) => !tooEarly(c.work, publishedAt));
  if (pool.length < 2) return pool[0];
  const verdicts = pool.map((c) => evidenceFor(c.work, text, links));
  const withEvidence = pool.filter((_, i) => verdicts[i] && verdicts[i] !== 'conflict');
  if (withEvidence.length === 1) return withEvidence[0];
  const clean = pool.filter((_, i) => verdicts[i] !== 'conflict');
  if (clean.length) pool = clean;
  const series = SERIES_TALK.test(text);
  const typed = pool.filter((c) => (c.work.format === 'series') === series);
  return (typed.length ? typed : pool)[0];
}
