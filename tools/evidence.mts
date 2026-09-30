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
import { isSeries } from '../src/lib/media.ts';

/** Слова с большой буквы после названия, которые не имя: «"Бессонница" Часть 2». */
const NOT_NAME = new Set(['часть', 'серия', 'сезон', 'эпизод', 'глава', 'фильм', 'сериал', 'обзор', 'разбор',
  'смысл', 'трейлер', 'тизер', 'рецензия', 'финал', 'новости', 'кино', 'выпуск', 'том', 'книга',
  // студии и площадки в родительном — не режиссёр: «Ведьмак Нетфликса», «Мулан Диснея»
  'нетфликса', 'диснея', 'пиксара', 'марвел', 'марвела', 'амазона', 'апла', 'кинопоиска', 'окко', 'иви']);
const CYR_NAME = /[А-ЯЁа-яё]/;
const stem4 = (s: string) => s.toLowerCase().replace(/ё/g, 'е');

/** Фамилия в общий «звуковой» вид, чтобы сравнить «Шазелла» с «Chazelle»: кириллица —
 *  транслитом, латиница — с поправками на то, как её передают по-русски (c/q → k, w → v,
 *  j → dzh, y → i, th → t, ph → f; диакритика снята, двойные буквы — одна). */
const TRANSLIT: Record<string, string> = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z',
  и: 'i', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h',
  ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sh', ъ: '', ы: 'i', ь: '', э: 'e', ю: 'iu', я: 'ia' };
export const sound = (w: string): string => [...w.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')]
  .map((c) => TRANSLIT[c] ?? c).join('')
  .replace(/ph/g, 'f').replace(/th/g, 't').replace(/ck/g, 'k').replace(/c(?!h)/g, 'k').replace(/q/g, 'k')
  .replace(/w/g, 'v').replace(/x/g, 'ks').replace(/j/g, 'dzh').replace(/y/g, 'i')
  .replace(/[^a-z]/g, '').replace(/(.)\1+/g, '$1');

const levenshtein = (a: string, b: string): number => {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
};

/** Чужой режиссёр сразу после названия: «Легенда» (18+) Брайана Хелгеленда — это не «Легенда»
 *  Ридли Скотта, «Дракула» Люка Бессона — не Копполы, «Начало» Деа Кулумбегашвили — не Нолана.
 *  Каналы подписывают фильм режиссёром в родительном падеже. Два вида подписи: название в
 *  кавычках («Дракула» Люка Бессона) и название капсом без кавычек («ДРАКУЛА Бессона» — так
 *  пишет «Я у мамы филолог»); капс нужен, чтобы «Дракула Брэма Стокера» в обычном тексте не
 *  читалась как чужой режиссёр.
 *  Создатели кириллицей — сравниваем начала слов (Андерсон/Андерсона, Ассаяс/Ассайаса,
 *  Дэв…/Дэвид — хватает четырёх букв); замер 30.09 на 2 870 автопривязках: сторож сработал 14
 *  раз — все 14 тёзки или ремейки. Создатели латиницей — сравниваем звучание (`sound`) и
 *  противоречие ставим, только если имя далеко от всех создателей (расстояние больше 60%
 *  длины): «Шазелла»/«Chazelle» и «Джармуша»/«Jarmusch» близки, «Шазелла»/«Iñárritu» — нет,
 *  а сомнительная середина — ни то ни другое. Актёр после названия дал бы ложную тревогу,
 *  поэтому год фильма рядом (улика `year`) проверяется раньше, а имя в именительном —
 *  подлежащее следующей фразы — не считается. */
export function foreignCreator(work: WorkCard, head: string): string | undefined {
  const all = (work.creators ?? []).filter(Boolean);
  if (!all.length || !work.title) return undefined;
  const esc = work.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ё/gi, '[её]');
  // имя — до трёх слов с большой буквы, между ними частицы: «Ларса фон Триера», «Гильермо дель Торо»
  const NAME = '((?:[А-ЯЁ][а-яё]+(?:(?:\\s+(?:фон|де|ван|дер|дель|ди|ле|да|ла))?[-\\s](?=[А-ЯЁ]))?){1,3})(?![а-яёА-ЯЁ])';
  const quoted = new RegExp(`[«"„]${esc}[»"“]\\s*(?:\\(\\d+\\+\\)\\s*)?${NAME}`, 'u').exec(head);
  const capsTitle = work.title.toLocaleUpperCase('ru').replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/Ё/g, '[ЕЁ]');
  // без кавычек имя должно закрывать подпись: дальше тире, черта, скобка или конец —
  // «ДРАКУЛА Бессона - (ПЕРЕ)СКАЗКА», а не «ГРОМОВЕРЖЦЫ* Звездочка имеет значение»
  const bare = quoted ? undefined : new RegExp(`(?<![\\p{L}])${capsTitle}\\s+${NAME}(?=\\s*(?:$|[-–—|/(),.:!?]))`, 'u').exec(head);
  const m = quoted ?? bare;
  if (!m) return undefined;
  const words = m[1].split(/[\s-]+/).filter((w) => w && /^[А-ЯЁ]/.test(w) && !NOT_NAME.has(w.toLowerCase()));
  if (!words.length || /^\s*\d/.test(head.slice(m.index + m[0].length))) return undefined;
  // подпись режиссёром — в родительном: «Брайана», «Алексея», «Деа», «Дэнни». Имя в именительном
  // — подлежащее следующей фразы, чаще актёр: «…таланта» Николас Кейдж дал интервью (замер 30.09)
  // (-о, -е — чаще несклоняемое имя в именительном: «Леонардо ДиКаприо играет»)
  if (!/[аяиы]$/i.test(words[0])) return undefined;
  const cyr = all.filter((c) => CYR_NAME.test(c));
  if (cyr.length) {
    const known = cyr.flatMap((c) => c.split(/[\s-]+/)).map(stem4).filter((w) => w.length >= 3);
    const same = (a: string, b: string) => { const n = Math.min(a.length, b.length, 4); return n >= 3 && a.slice(0, n) === b.slice(0, n); };
    return words.some((w) => known.some((k) => same(stem4(w), k))) ? undefined : m[1];
  }
  const known = all.flatMap((c) => c.split(/[\s-]+/)).map(sound).filter((w) => w.length >= 3);
  if (!known.length) return undefined;
  const far = words.map(sound).filter((w) => w.length >= 3)
    .every((w) => known.every((k) => levenshtein(w, k) > 0.6 * Math.max(w.length, k.length)));
  return far ? m[1] : undefined;
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
  const typed = pool.filter((c) => isSeries(c.work) === series);
  return (typed.length ? typed : pool)[0];
}
