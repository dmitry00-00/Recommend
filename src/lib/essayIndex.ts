// Индекс разборов для первой ленты (18.10, аудит скорости, волна 3А). Индексы разборов (essaysAuto, postsAuto, рубрики
// essayLenses) весят ~1,35 МБ brotli, а подбору из них нужно одно: есть ли у кандидата хоть один автор, которого человек
// увидит во вкладке «Обзоры» (`essays > 0` в src/lib/model/recommend.ts: бонус и «первые три с разбором»). Сборщик
// (tools/publish-reference.mts) кладёт на сервер рядом с полными файлами:
//   · `essayIndex` (~20 КБ) — по ключу произведения подписи видимых материалов («автор|язык»): по ним ответ «есть
//     разбор» тот же, что у полного расчёта (`visibleAuthors(analysesFor(…)) > 0` в src/api/index.ts). Ключи, где
//     дубль по адресу или названию с другой подписью (другой автор, язык, ярус, площадка) может снять материал, —
//     целиком, как в полном файле (`x`): у них расчёт идёт по самим материалам;
//   · `analyses-NN` — те же материалы долями по ключу: карточкам первой ленты, дневнику и странице фильма — только их доли.
// Полные файлы остаются как были — старые клиенты читают их, а новый догружает их после ленты.
import type { ExternalAnalysis } from '@/types/tmdf';
import { shardOf } from './shard';
import { groupByVoice, isAuthorKey, voiceKeyOf } from './voices';

/** Долей разборов: ~20 КБ brotli каждая — первой ленте нужно не больше семи. */
export const ANALYSIS_SHARDS = 64;
export const analysisShard = (key: string): string => shardOf(key, ANALYSIS_SHARDS);
export const analysisShardName = (shard: string): string => `analyses-${shard}`;

/** Ключ названия для склейки дублей — тот же, что у `analysesFor`. */
export const analysisTitleKey = (t: string): string => t.toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9]+/g, ' ').trim();

/** Язык материала, как его видит фильтр языков (`shownLanguage`). */
export const analysisLanguage = (a: Pick<ExternalAnalysis, 'language'>): 'ru' | 'en' => (a.language === 'en' ? 'en' : 'ru');

type Lists = Readonly<Record<string, readonly ExternalAnalysis[]>>;

/** Разборы произведения по его ключам (`analysesFor` в src/api/index.ts): сначала разборы деталей каталога, потом ручные
 *  (прислано владельцем, размечено), потом найденные — ролики, затем посты. На найденное накладывается вердикт участника:
 *  «про другое» — вон, «про это» — снимаем пометку «не проверено». Канал анонсирует свой же ролик его заголовком — в
 *  карточке это один и тот же разбор на двух площадках: из дублей по адресу или названию остаётся первый (подтверждённый
 *  ролик идёт раньше поста). В конце — языки, которые человек читает. */
export function collectAnalyses(keys: readonly string[], detail: readonly ExternalAnalysis[] | undefined, curated: Lists, found: Lists, posts: Lists,
  verdictOf: (url: string) => string | undefined, shown: (a: ExternalAnalysis) => boolean): ExternalAnalysis[] {
  const pick = (src: Lists) => keys.flatMap((k) => src[k] ?? []);
  const auto = [...pick(found), ...pick(posts)]
    .map((a) => ({ a, verdict: verdictOf(a.url) }))
    .filter(({ verdict }) => verdict !== 'other_work')
    .map(({ a, verdict }) => (verdict === 'about_this' ? { ...a, unverified: undefined } : a));
  const extra = [...pick(curated), ...auto];
  const haveUrl = new Set((detail ?? []).map((a) => a.url));
  const haveTitle = new Set((detail ?? []).map((a) => analysisTitleKey(a.title)));
  const out: ExternalAnalysis[] = [...(detail ?? [])];
  for (const a of extra) {
    const t = analysisTitleKey(a.title);
    if (haveUrl.has(a.url) || haveTitle.has(t)) continue;
    haveUrl.add(a.url);
    haveTitle.add(t);
    out.push(a);
  }
  return out.filter(shown);
}

/** Сколько авторов человек увидит во вкладке «Обзоры» (ТВ-2): та же группировка, что у карточки (`useVoices`) — только
 *  авторы, без яруса review и без постов (посты — во вкладке «Обсуждения»). */
export const visibleAuthorCount = (list: ExternalAnalysis[]): number =>
  groupByVoice(list).filter((g) => g.items.some((a) => a.platform !== 'telegram')).length;

/** Материал сам по себе делает автора видимым во вкладке «Обзоры»: не обзор (они для подбора) и не пост Telegram. */
export const visibleKind = (a: Pick<ExternalAnalysis, 'platform' | 'tier'>): boolean => a.platform !== 'telegram' && a.tier !== 'review';

/** Всё, от чего зависит, сделает ли материал фильм «с разбором»: автор (его роль), язык, ярус и площадка. */
const signature = (a: ExternalAnalysis): string =>
  `${voiceKeyOf(a)}|${analysisLanguage(a)}|${a.platform === 'telegram' ? 't' : ''}${a.tier === 'review' ? 'r' : ''}`;

export interface EssayIndex {
  /** версия: доли с другой версией не годятся — тогда полный файл */
  v: string;
  /** число долей */
  n: number;
  /** ключ → видимые материалы подписью «автор|язык» (без повторов); ключа нет — видимых нет */
  k: Record<string, string[]>;
  /** ключи с рискованными дублями — для расчёта, не для показа: видимые материалы и материалы с дублями (только поля,
   *  которые читает `analysesFor`); `e` из essaysAuto, `p` из postsAuto */
  x: Record<string, { e?: ExternalAnalysis[]; p?: ExternalAnalysis[] }>;
  /** рубрики роликов из разборов деталей каталога (src/mocks/index.ts) — у них нет ключа доли */
  l: Record<string, string>;
}

export interface AnalysisShard {
  v: string;
  e: Record<string, ExternalAnalysis[]>;
  p: Record<string, ExternalAnalysis[]>;
  /** рубрики роликов этой доли — и ручных разборов её ключей */
  l: Record<string, string>;
}

/** Версия индекса по содержимому полных файлов: FNV-1a по их JSON. */
export function analysesVersion(...parts: string[]): string {
  let h = 0x811c9dc5;
  let n = 0;
  for (const s of parts) {
    n += s.length;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  }
  return `${n.toString(36)}-${h.toString(36)}`;
}

const videoId = (url: string): string | undefined => /(?:v=|youtu\.be\/|shorts\/|live\/)([A-Za-z0-9_-]{11})/.exec(url)?.[1];

/** Индекс и доли из полных файлов. `curated` — ручные разборы сборки по ключу (src/mocks/essays.ts), `detail` — разборы
 *  деталей каталога (src/mocks/index.ts): они стоят в списке раньше найденных и тоже склеивают дубли. */
export function buildEssayIndex(essaysAuto: Lists, postsAuto: Lists, lenses: Readonly<Record<string, string>>, curated: Lists,
  detail: readonly ExternalAnalysis[]): { index: EssayIndex; shards: Record<string, AnalysisShard> } {
  const v = analysesVersion(JSON.stringify(essaysAuto), JSON.stringify(postsAuto), JSON.stringify(lenses));
  // Порядок в `analysesFor`: разборы деталей, ручные, essaysAuto, postsAuto; из дублей (тот же адрес или название)
  // остаётся первый, и только его адрес и название ловят следующие. Материал без дублей ни на кого не влияет, и его
  // не снимет никто: видимому такому хватает подписи (`k`). Материалы с дублями идут в `x` сами — между собой и с
  // загруженным (ручные, детали, пришедшие доли) клиент решает их по тому же порядку, что `analysesFor`.
  // «Дубль» — другой вариант (адрес, название, подпись) с тем же адресом или названием: точные копии одного материала под
  // разными ключами друг другу не мешают — какая ни останется, адрес и название те же
  const variant = (a: ExternalAnalysis) => `${a.url}\u0000${a.title}\u0000${signature(a)}`;
  const byUrl = new Map<string, Set<string>>();
  const byTitle = new Map<string, Set<string>>();
  const note = (a: ExternalAnalysis) => {
    const v = variant(a);
    (byUrl.get(a.url) ?? byUrl.set(a.url, new Set()).get(a.url)!).add(v);
    const t = analysisTitleKey(a.title);
    (byTitle.get(t) ?? byTitle.set(t, new Set()).get(t)!).add(v);
  };
  detail.forEach(note);
  for (const src of [curated, essaysAuto, postsAuto]) for (const list of Object.values(src)) list.forEach(note);
  const lensOf = (list: readonly ExternalAnalysis[] | undefined, out: Record<string, string>) => {
    for (const a of list ?? []) {
      const id = a.platform === 'youtube' ? videoId(a.url) : undefined;
      if (id && lenses[id]) out[id] = lenses[id];
    }
  };
  const colliding = (a: ExternalAnalysis) => byUrl.get(a.url)!.size > 1 || byTitle.get(analysisTitleKey(a.title))!.size > 1;
  /** для расчёта в `x` — поля, которые читает `analysesFor` */
  const lean = (a: ExternalAnalysis): ExternalAnalysis => ({ id: a.id, title: a.title, author: a.author, platform: a.platform, url: a.url,
    language: a.language, ...(a.tier ? { tier: a.tier } : {}) }) as ExternalAnalysis;
  const index: EssayIndex = { v, n: ANALYSIS_SHARDS, k: {}, x: {}, l: {} };
  const shards: Record<string, AnalysisShard> = {};
  for (let i = 0; i < ANALYSIS_SHARDS; i++) shards[String(i).padStart(2, '0')] = { v, e: {}, p: {}, l: {} };
  const shard = (key: string) => shards[analysisShard(key)];
  for (const key of new Set([...Object.keys(essaysAuto), ...Object.keys(postsAuto)])) {
    const e = essaysAuto[key];
    const p = postsAuto[key];
    const sh = shard(key);
    if (e) sh.e[key] = [...e];
    if (p) sh.p[key] = [...p];
    lensOf(e, sh.l); lensOf(p, sh.l);
    const all = [...(e ?? []), ...(p ?? [])];
    const sure = [...new Set(all.filter((a) => visibleKind(a) && !colliding(a)).map((a) => `${voiceKeyOf(a)}|${analysisLanguage(a)}`))];
    if (sure.length) index.k[key] = sure;
    const ce = (e ?? []).filter(colliding).map(lean);
    const cp = (p ?? []).filter(colliding).map(lean);
    if (ce.length || cp.length) index.x[key] = { ...(ce.length ? { e: ce } : {}), ...(cp.length ? { p: cp } : {}) };
  }
  // рубрики ручных разборов — в долю их ключа; разборов деталей каталога (их мало, ключа у них нет) — в индекс
  for (const [key, list] of Object.entries(curated)) lensOf(list, shard(key).l);
  lensOf(detail, index.l);
  return { index, shards };
}

/** Есть ли по индексу видимый материал у ключа: язык из показанных, автор — не площадка и не студия. */
export function indexHasVisible(index: EssayIndex, key: string, shown: (lang: 'ru' | 'en') => boolean, isAuthor: (voiceKey: string) => boolean): boolean {
  for (const s of index.k[key] ?? []) {
    const at = s.lastIndexOf('|');
    if (shown(s.slice(at + 1) === 'en' ? 'en' : 'ru') && isAuthor(s.slice(0, at))) return true;
  }
  return false;
}

/** Сколько авторов у произведения во вкладке «Обзоры» — для подбора (src/api/index.ts, `essaysOf`). Без индекса — по
 *  самим разборам (`loaded` — все). С индексом (разборы пришли не все) — ответ «есть ли»: точный расчёт по ключам, чьи
 *  материалы на месте (`keyLoaded`), и по материалам с дублями из индекса (`x`), а у остальных ключей — подписи индекса
 *  (`k`). Тогда число может быть меньше настоящего, но ноль — только когда и настоящий ноль (tools/essay-index-test.mts). */
export function essayCount(keys: readonly string[], detail: readonly ExternalAnalysis[] | undefined, curated: Lists,
  loaded: { e: Lists; p: Lists }, index: EssayIndex | undefined, keyLoaded: (key: string) => boolean,
  verdictOf: (url: string) => string | undefined, languages: readonly string[]): number {
  const shown = (a: ExternalAnalysis) => languages.includes(analysisLanguage(a));
  if (!index) return visibleAuthorCount(collectAnalyses(keys, detail, curated, loaded.e, loaded.p, verdictOf, shown));
  const e: Record<string, readonly ExternalAnalysis[]> = {};
  const p: Record<string, readonly ExternalAnalysis[]> = {};
  for (const k of keys) {
    const src = keyLoaded(k) ? { e: loaded.e[k], p: loaded.p[k] } : index.x[k];
    if (src?.e) e[k] = src.e;
    if (src?.p) p[k] = src.p;
  }
  const n = visibleAuthorCount(collectAnalyses(keys, detail, curated, e, p, verdictOf, shown));
  if (n) return n;
  return keys.some((k) => !keyLoaded(k) && indexHasVisible(index, k, (l) => languages.includes(l), isAuthorKey)) ? 1 : 0;
}
