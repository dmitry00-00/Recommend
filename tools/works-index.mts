// Что мы вообще знаем — одним списком для генераторов разборов: каталог, история участника,
// присланное им просмотренное, пул кандидатов и справочник фильмов.
// Ключ разбора — не ID карточки, а внешний идентификатор произведения: одна и та же «Матрица»
// в истории, каталоге и пуле имеет разные ID, а разбор у неё общий. У фильма ключ `tmdb:<id>`,
// у книги — произведение: `wd:`/`olw:`, а без моста — `isbn:<isbn>` (src/lib/keys.ts, З1).
import { works as catalogWorks } from '../src/mocks/index.ts';
import { externalIds } from '../src/mocks/externalIds.ts';
import { catalogMedia } from '../src/mocks/catalogMedia.ts';
import { userWorks } from '../src/mocks/userHistory.ts';
import { watchedWorks } from '../src/mocks/userWatched.ts';
import { candidateSeeds, seedToCard } from '../src/mocks/candidates.ts';
import { candidateMedia } from '../src/mocks/candidateMedia.ts';
import { filmBase } from '../src/mocks/filmBase.ts';
import { filmBaseWiki } from '../src/mocks/filmBaseWiki.ts';
import { filmBaseMarkup } from '../src/mocks/filmBaseMarkup.ts';
import { filmBaseCurated } from '../src/mocks/filmBaseCurated.ts';
import { filmBasePopular } from '../src/mocks/filmBasePopular.ts';
import { seriesBaseWiki } from '../src/mocks/seriesBaseWiki.ts';
import { filmBaseLinks } from '../src/mocks/filmBaseLinks.ts';
import { filmBaseTail } from '../src/mocks/filmBaseTail.ts';
import { filmBaseMore } from '../src/mocks/filmBaseMore.ts';
import { filmBaseWorld } from '../src/mocks/filmBaseWorld.ts';
import { filmBaseChannels } from '../src/mocks/filmBaseChannels.ts';
import { tvPrograms } from '../src/mocks/tvPrograms.ts';
import { seriesBase } from '../src/mocks/seriesBase.ts';
import { bookBase } from '../src/mocks/bookBase.ts';
import type { WorkCard } from '../src/types/tmdf.ts';
import { isSeries } from '../src/lib/media.ts';
import { primaryKey, withBookWork, workKeys } from '../src/lib/keys.ts';
import { bookWorks } from '../src/mocks/bookWorks.ts';
import { withheldWorks } from '../src/mocks/withheldWorks.ts';
import { cyrillicBrands } from '../src/lib/brands.ts';
import { isAlias } from '../src/lib/canon.ts';
import { applyWorkFixes } from '../src/lib/workFixesTable.ts';

export interface IndexedWork {
  key: string;
  work: WorkCard;
  /** названия, по которым ловим произведение в чужом тексте: слишком короткое имя из одного
   *  слова даёт слишком много ложных совпадений («Игра», «Она») */
  names: string[];
  /** сериал из присланных профилей с названием в одно слово («Офис», «Счастье», «Топи»): такое
   *  слово слишком часто значит что-то другое, поэтому совпадение засчитывается, только если
   *  материал говорит о сериале (`talksSeries`, Е6) */
  needsSeriesTalk?: boolean;
  /** названия для книжных каналов (З6), когда они шире `names`: книги каталога через мост с кино
   *  в чужом тексте не ищутся, а в книжном канале — ищутся (tools/book-channels.mts) */
  bookNames?: string[];
  /** карточка из загрузок каналов студий и агрегаторов (tools/grow-from-channels.mts, 10.10): фильм малоизвестный,
   *  его название чаще значит другое. В заголовке совпадает только с меткой, как обычное слово (кавычки, «обзор»,
   *  год); тег берёт, только если тег не занят карточкой справочника («Dark Planet» — английское название
   *  «Обитаемого острова», а не фильм 1996-го; «Blood Moon» — отменённый приквел «Игры престолов») */
  minor?: boolean;
  /** телепередача — реалити, ток-шоу, конкурс (tools/tv-programs.mts, 11.10): ролик об эфире — не разбор, поэтому
   *  ни по названию, ни по тегам она не ищется («КАК ЗАГНИВАЕТ ШОУ ГОЛОС», «Битва экстрасенсов … | Обзор») */
  show?: boolean;
}

/** Внешние ключи карточки: свои, из медиа каталога или справочника; у книги — с мостом
 *  «ISBN → произведение» (src/mocks/bookWorks.ts, З1). */
export function idsOf(work: WorkCard): WorkCard['externalIds'] {
  return withBookWork(work.externalIds ?? catalogMedia[work.id]?.externalIds ?? externalIds[work.id], bookWorks);
}

/** Главный ключ произведения (src/lib/keys.ts): фильм — TMDb, сериал — IMDb (номера TMDb у фильмов
 *  и сериалов пересекаются, 28.09), книга — произведение (`wd:`, `olw:`), а без моста — ISBN. */
export function analysisKey(work: WorkCard): string | undefined {
  return primaryKey(work, idsOf(work));
}

/** Все ключи произведения — главный и запасные (старые `isbn:` у книги). */
export function analysisKeys(work: WorkCard): string[] {
  return workKeys(work, idsOf(work));
}

/** Как название пишут в заголовках (OPS-9, 06.10): без кавычек внутри — «Поколение Ви» вместо
 *  «Поколение «Ви»»; английское без начального A/An, если после него хотя бы три слова — «Knight of
 *  the Seven Kingdoms». The не снимаем: «The Batman» → «Batman» — другое. */
function variants(name: string): string[] {
  const out = [name];
  const unquoted = name.replace(/[«»"“”„]/g, '').replace(/\s+/g, ' ').trim();
  if (unquoted !== name && unquoted.length >= 4) out.push(unquoted);
  // многоточие внутри — в заголовках его опускают: «Однажды в… Голливуде» пишут «Однажды в Голливуде»; без
  // варианта дословно совпадал тёзка «Однажды в Голливуде» (What Just Happened, 2008) и забирал ролики (12.10)
  const dotless = name.replace(/\s*(?:…|\.{3})\s*(?=\S)/g, ' ').replace(/\s+/g, ' ').trim();
  if (dotless !== name && !/(?:…|\.{3})$/.test(name)) out.push(dotless);
  const m =/^(?:A|An)\s+(.+)$/.exec(name);
  if (m && m[1].split(/\s+/).length >= 3) out.push(m[1]);
  // «Звёздные войны. Эпизод VI: Возвращение джедая» — каналы пишут «Эпизод 6 - Возвращение Джедая» или одно
  // «Возвращение джедая»: подзаголовок эпизода из двух слов и больше — тоже название (OPS-9, 10.10)
  const ep = /Эпизод\s+[IVX]+\s*[:.]\s*(.+)$/u.exec(name);
  if (ep && ep[1].trim().split(/\s+/).length >= 2) out.push(ep[1].trim());
  // латинская марка кириллицей: «Дьявол носит прада» (15.10, src/lib/brands.ts)
  const ru = cyrillicBrands(name);
  if (ru) out.push(ru);
  return out;
}

/** Все известные произведения без повторов: кто попал в список раньше, тот и остаётся.
 *  Справочник фильмов идёт последним — если фильм уже есть в истории или каталоге,
 *  побеждает он (у него есть разметка, у справочника её нет). */
export function worksIndex({ all: unnamed = false, isbnKeys = false }: {
  /** и те, у кого нет названия, годного для поиска в тексте («Фарго», «Душа»): им нужен ключ
   *  для ручной привязки и место в справочнике таблицы, а в чужом тексте их не ищут (`names` пуст) */
  all?: boolean;
  /** книги — по ISBN, без моста к произведению: так видит справочник сам мост
   *  (tools/resolve-book-works.mts), иначе ошибочный мост, склеивший две книги, прятал бы одну из них */
  isbnKeys?: boolean;
} = {}): IndexedWork[] {
  const all: WorkCard[] = [
    ...Object.values(catalogWorks).map((w) => ({ ...w, externalIds: w.externalIds ?? catalogMedia[w.id]?.externalIds ?? externalIds[w.id] })),
    ...userWorks, ...watchedWorks,
    ...candidateSeeds.map((s) => ({ ...seedToCard(s), ...candidateMedia[s.id] }) as WorkCard),
    ...filmBase,
    // то, о чём говорят каналы: опознано в Wikidata, разметки нет (23.09)
    ...filmBaseWiki,
    // вписано людьми в таблицу разметки и опознано в Wikidata (28.09)
    ...filmBaseMarkup,
    // с полок по просьбам людей, данные TMDb (29.09)
    ...filmBaseCurated,
    // сериалы с черновой разметкой из присланных профилей (Е2, 30.09); с одним словом в названии
    // ищутся только в разговоре о сериале (Е6): «Офис», «Счастье», «Начало» — обычные слова и тёзки фильмов
    ...seriesBase,
    // что люди ищут: месячные топы русской Википедии и классика, опознано в Wikidata (05.10)
    ...filmBasePopular,
    // сериалы со статьёй в русской Википедии от 10 разделов (РР-4, 15.10)
    ...seriesBaseWiki,
    // мировое кино со статьёй в русской Википедии от 10 разделов (РР-5, 15.10)
    ...filmBaseLinks,
    // остальное кино со статьёй в русской Википедии (до 10 разделов, РР-5): для поиска и страниц, заранее не размечаем
    ...filmBaseTail,
    // пополнение волны В (18.10): советская и российская анимация и короткий метр, история и импорт Кинопоиска, свежее,
    // мировой канон — ленивый модуль (tools/grow-film-base.mts --out filmBaseMore)
    ...filmBaseMore,
    // популярное в Индии и англоязычных странах: суточные топы Википедии по странам и классика (ЗП-22, 07.10)
    ...filmBaseWorld,
    // фильмы из загрузок каналов студий и агрегаторов, опознаны в Wikidata по режиссёру или году (10.10)
    ...filmBaseChannels,
    // книги через мост с кино (З2) — только с ключом: в чужом тексте их не ищем («Платформа», «Память»,
    // «Солярис» — тёзки фильмов и обычные слова); в книжных каналах — ищем (`bookNames`, З6)
    ...bookBase,
  ];
  const bookOnly = new Set(bookBase.map((w) => w.id));
  // английские и индийские названия в одно слово («Animal», «War», «Fighter», «Война») в русских текстах
  // чаще значат другое: такие карточки ищутся в тексте только по названию из двух значимых слов и длиннее
  // так же — фильмы из загрузок каналов: «Опекун», «Приезжая», «Небо» в чужом тексте чаще обычные слова
  // и фильмы из роста справочника (РР-5): малоизвестные «Небо», «Игра», «Мать» — тёзки обычных слов и известных вещей
  // и пополнение волны В (18.10): «Варежка», «Снегурочка», «Мама» из короткого метра — тоже тёзки обычных слов
  const worldOnly = new Set([...filmBaseWorld, ...filmBaseChannels, ...filmBaseLinks, ...filmBaseTail, ...filmBaseMore].map((w) => w.id));
  // хвост справочника (РР-5) — тоже «малое»: в очередь разметки не идёт (решение владельца 15.10 — заранее не размечать)
  const minorIds = new Set([...filmBaseChannels, ...filmBaseTail].map((w) => w.id));
  const showIds = new Set(tvPrograms);
  // артикль и номер части словом не считаются: «The Bear», «Война 2», «Stree 2» — по сути одно слово
  const worldNameOk = (t: string) => t.split(/\s+/).filter((x) => !/^(the|a|an|\d+)$/i.test(x)).length > 1;
  // сериалы из топов Википедии («Метод», «Кухня», «Мажор») — то же правило Е6, что у сериалов из профилей
  const fromProfiles = new Set([...seriesBase, ...filmBasePopular.filter((w) => w.type === 'series'), ...seriesBaseWiki].map((w) => w.id));
  // названия, которые чаще значат другое: группа, роман, другая экранизация того же романа
  // (замер 30.09 по дампу роликов: песни «Короля и Шута», разборы романа Достоевского и сериала
  // 2024-го, фильм «Граф Монте-Кристо» 2024-го уходили к сериалам из профилей)
  // 06.10: «гарри поттер» — сериал HBO 2026 из топов Википедии собирал ролики обо всей саге
  const ALSO_ELSEWHERE = new Set(['король и шут', 'преступление и наказание', 'граф монте-кристо', 'гарри поттер']);
  const out = new Map<string, IndexedWork>();
  // лишние копии (канон копий, src/mocks/workAliases.ts, 17.10) — после всех: ключ достаётся главной копии, а лишняя
  // лишь добирает ключ, которого у главной нет (их сводит загрузка справочника, src/lib/canon.ts aliasesOf). Прежде
  // ключ брала та, что раньше в списке, — карточка истории владельца, а не общая
  // правки справочника (волна Б, 17.10, src/mocks/workFixes.ts): название, год, авторы — до `variants`, чтобы в чужом тексте
  // искалось исправленное название
  const fixed = all.map((w) => applyWorkFixes(w, idsOf(w)));
  const ordered = [...fixed.filter((w) => !isAlias(w.id)), ...fixed.filter((w) => isAlias(w.id))];
  for (const work of ordered) {
    const key = isbnKeys ? primaryKey(work, work.externalIds ?? catalogMedia[work.id]?.externalIds ?? externalIds[work.id]) : analysisKey(work);
    // убранное владельцем (withheldWorks) — ни карточки, ни привязок; запись «… не книга» снимает только книжную карточку —
    // фильм без TMDb с тем же элементом (`wd:`, 18.10) остаётся (src/mocks/withheldWorks.ts isWithheld)
    if (!key || out.has(key) || (withheldWorks[key] && (work.type === 'book' || !/не книга/.test(withheldWorks[key])))) continue;
    const searchable = [...new Set([work.title, work.originalTitle].filter((t): t is string => Boolean(t)).flatMap(variants))]
      .filter((t) => t.split(/\s+/).length > 1 || t.length >= 6);
    const names = bookOnly.has(work.id) ? [] : worldOnly.has(work.id) ? searchable.filter(worldNameOk) : searchable;
    const bookNames = bookOnly.has(work.id) && searchable.length ? searchable : undefined;
    const needsSeriesTalk = fromProfiles.has(work.id)
      && (work.title.trim().split(/\s+/).length === 1 || ALSO_ELSEWHERE.has(work.title.trim().toLowerCase()));
    const minor = minorIds.has(work.id);
    const show = showIds.has(work.id);
    if (show) { out.set(key, { key, work, names: [], show }); continue; }
    if (names.length || bookNames || unnamed) out.set(key, { key, work, names, ...(needsSeriesTalk ? { needsSeriesTalk } : {}), ...(bookNames ? { bookNames } : {}), ...(minor ? { minor } : {}) });
  }
  return [...out.values()];
}
