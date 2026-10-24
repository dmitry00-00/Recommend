// Якорь вкуса новичка (09.10). Подбор ведут уровень, операции и регистр, но при пяти–двадцати
// оценках регистр почти молчит: у шести любимых мультфильмов регистры разные, и любителю анимации
// первая лента приходила из «Бэтмена» и «Шоушенка», а любителю отечественного — из «Робокопа»
// (прогон шести профилей, 09.10). Здесь — близость к тому, что человек оценил, по жанру TMDb,
// стране и авторам: «Отлично» притягивает, «Мимо» отталкивает. Вес большой на первых оценках и
// гаснет к `FADE_AT`: дальше подбор идёт «на шаг сложнее», а не «ещё того же».
import type { WorkCard } from '@/types/tmdf';
import { countryRu } from '@/lib/countries';
import { defaultRole, nameKey, shortName, workKey } from '@/lib/credits';
import { EXPERIMENTS } from '@/lib/model/experiments';

export interface TasteEntry { work: WorkCard; rating?: 1 | 2 | 3 | 4 | 5; raw?: number }
/** Сходство с оценённым по признаку: от −1 (не нравится) до 1 (нравится). */
export interface ContentTaste { genres: Record<string, number>; countries: Record<string, number>; creators: Record<string, number> }

/** Вес якоря при `MIN` оценках и сколько оценок до того, как он гаснет совсем. */
export const CONTENT_WEIGHT = 0.25;
export const FADE_AT = 50;

// Якорь у длинной истории (23.10, опыт `anchorKeep`, разбор .cache/eval/why-2026-10-22.md, п. 4–5). Без флага якорь гаснет
// к FADE_AT, а у историй длиннее 50 оценок — 94% замера — его нет вовсе; и сам он полуслепой: знак оценки — от нормы 7
// (она достаётся всем, а не только владельцу), автор сводится строкой — между карточкой истории («Томас Шламме» из
// Кинопоиска) и карточкой пула совпадает у 58% одной и той же картины. С флагом:
//  - вес не ниже ANCHOR_KEEP.floor — вкус к жанрам, странам и авторам остаётся слагаемым и у длинной истории;
//  - знак оценки — от шкалы самого человека: медиана и разброс его же оценок, а не общая норма;
//  - автор — по элементу Wikidata: `credits` карточки, а у карточки истории без них — запись workCredits по ключу
//    произведения (у карточек пула и истории так сводится 97% общих картин); нет элемента — имя без регистра и отчества;
//  - «Мимо» у автора тоже тянет вниз (без флага автор только притягивает), а признак, которого у кандидата нет, не
//    разбавляет остальные: жанров у пула ~30%, стран ~25%, а авторы — почти у всех.
// Переключатели ниже — для замера вариантов (taste-eval --exp anchorKeep): после решения владельца лишние уходят вместе с
// веткой, которую они выключают.
export const ANCHOR_KEEP = {
  /** вес якоря у истории от FADE_AT оценок; между MIN и FADE_AT — плавно от CONTENT_WEIGHT к нему */
  floor: 0.25,
  /** сколько разбросов человека от его медианы — «очень нравится» */
  spread: 1,
  /** доли признаков в близости; у кандидата без признака его доля делится на остальные */
  weights: { genre: 0.6, country: 0.3, creator: 0.1 },
  /** знак — от шкалы человека (иначе от нормы, как без флага) */
  scale: true,
  /** знак — местом оценки в своей шкале (−1 худшая, +1 лучшая), а не разбросами от медианы */
  rank: false,
  /** авторы по элементам Wikidata (иначе только по имени) */
  ids: true,
  /** новая близость: автор со знаком, признаки без голоса не разбавляют (иначе прежняя формула и строки авторов) */
  kept: true,
  /** сжатие автора к нулю: один фильм режиссёра с «Отлично» — 1/(1+prior) */
  creatorPrior: 1,
};

/** Один фильм жанра — ещё не вкус: сумма знаков делится на число фильмов плюс это. */
const PRIOR = 1;
const SIGN: Record<number, number> = { 1: -1, 2: -0.6, 3: 0, 4: 0.6, 5: 1 };

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/** Шкала человека (23.10, `anchorKeep`): медиана и разброс его собственных оценок. Меньше десяти — шкалы ещё нет. */
export function ownScale(raws: readonly number[]): { median: number; spread: number; sorted?: number[] } | undefined {
  if (raws.length < 10) return undefined;
  const s = [...raws].sort((a, b) => a - b);
  const median = s[Math.floor(s.length / 2)];
  const m = s.reduce((a, b) => a + b, 0) / s.length;
  const sd = Math.sqrt(s.reduce((a, b) => a + (b - m) ** 2, 0) / s.length);
  // у того, кто ставит почти одно и то же, разброс не меньше балла: иначе 7 и 8 — «ненавижу» и «обожаю»
  return { median, spread: Math.max(1, sd) * ANCHOR_KEEP.spread, sorted: s };
}

/** Знак оценки. Десятибалльная — от нормы участника: три балла выше нормы — «очень нравится». */
export function ratingSign(rating?: number, raw?: number, norm = 7, scale?: { median: number; spread: number; sorted?: number[] }): number | undefined {
  if (raw != null && scale?.sorted && ANCHOR_KEEP.rank) {
    const xs = scale.sorted; let lo = 0, eq = 0;
    for (const x of xs) { if (x < raw) lo++; else if (x === raw) eq++; }
    return clamp(2 * (lo + eq / 2) / xs.length - 1, -1, 1);
  }
  if (raw != null) return scale ? clamp((raw - scale.median) / scale.spread, -1, 1) : clamp((raw - norm) / 3, -1, 1);
  return rating == null ? undefined : SIGN[rating];
}

/** Полки вкуса новичка (ЗП-45, шаг 1, 11.10): на экране первых оценок — «что вам ближе», 2–3 полки. Полка —
 *  жанры TMDb или страна; выбор весит как `PICK_FILMS` оценок «Отлично» с этими признаками и гаснет вместе
 *  с якорем. Не подборка и не объяснение — только с чего начать. */
export interface TasteShelf { id: string; genres?: string[]; countries?: string[] }
export const TASTE_SHELVES: readonly TasteShelf[] = [
  { id: 'animation', genres: ['мультфильм'] },
  { id: 'home', countries: ['Россия'] },
  { id: 'scifi', genres: ['фантастика'] },
  { id: 'fantasy', genres: ['фэнтези', 'приключения'] },
  { id: 'horror', genres: ['ужасы'] },
  { id: 'crime', genres: ['криминал', 'детектив'] },
  { id: 'comedy', genres: ['комедия'] },
  { id: 'drama', genres: ['драма'] },
  { id: 'romance', genres: ['мелодрама'] },
  { id: 'war', genres: ['военный', 'история'] },
  { id: 'korea', countries: ['Южная Корея'] },
  { id: 'japan', countries: ['Япония'] },
  { id: 'india', countries: ['Индия'] },
];
const PICK_FILMS = 2;
const shelfById = new Map(TASTE_SHELVES.map((s) => [s.id, s]));

/** Россия и СССР — одна полка «отечественное»: человек, которому нравится «Брат», не делит их. */
const countryKey = (c: string): string => { const ru = countryRu(c); return ru === 'СССР' ? 'Россия' : ru; };
/** Страны карточки — без флага anchorFill (23.10) единственный источник; с ним src/api подставляет свои: у карточки без
 *  стран — из Wikidata по ключу. Последним необязательным параметром — чтобы прежние вызовы (и замеры) не менялись. */
export type CountriesOf = (w: WorkCard) => readonly string[];
const ownCountries: CountriesOf = (w) => w.countries ?? [];

/** Кто снял (23.10, `anchorKeep`): авторы главной роли — режиссёр фильма, создатель сериала. Записи резолва авторов
 *  (src/mocks/workCredits.ts) — тот же кусок, что грузит справочник: здесь он не качается второй раз. Не успел прийти —
 *  авторы сводятся по имени, как без него. */
let creditIndex: Record<string, string> | undefined;
let creditLoad: Promise<void> | undefined;
export function loadAnchorCredits(): Promise<void> {
  creditLoad ??= import('@/mocks/workCredits').then((m) => { creditIndex = m.workCredits; }).catch(() => { creditLoad = undefined; });
  return creditLoad;
}
const LEAD_CODE: Record<string, string> = { director: 'd', creator: 'c', author: 'a', writer: 'w' };
const MAX_CREATORS = 3;
/** Ключи авторов: `q:` — элемент Wikidata, `n:` — имя без регистра, диакритики и отчества. */
function creatorKeys(w: WorkCard): { ids: string[]; names: string[] } {
  const role = defaultRole(w);
  const lead = (w.credits ?? []).filter((c) => c.role === role);
  let ids = ANCHOR_KEEP.ids ? lead.map((c) => c.personId) : [];
  if (!ids.length && creditIndex && ANCHOR_KEEP.ids) {
    const key = workKey(w);
    const code = LEAD_CODE[role];
    ids = (creditIndex[key ?? ''] ?? '').split(',').flatMap((pair) => { const [q, r] = pair.split(':'); return q && r === code ? [q] : []; });
  }
  const names = [...w.creators.slice(0, 2), ...lead.map((c) => c.name)].filter(Boolean).map((n) => `n:${nameKey(shortName(n))}`);
  return { ids: [...new Set(ids)].slice(0, MAX_CREATORS).map((q) => `q:${q}`), names: [...new Set(names)] };
}

export function deriveContentTaste(entries: TasteEntry[], genresOf: (w: WorkCard) => string[], norm?: number, picks: readonly string[] = [], countriesOf: CountriesOf = ownCountries): ContentTaste | undefined {
  const sums = { genres: new Map<string, [number, number]>(), countries: new Map<string, [number, number]>(), creators: new Map<string, [number, number]>() };
  const add = (m: Map<string, [number, number]>, k: string, s: number) => { const v = m.get(k) ?? [0, 0]; m.set(k, [v[0] + s, v[1] + 1]); };
  let n = 0;
  const keep = EXPERIMENTS.anchorKeep;
  const scale = keep && ANCHOR_KEEP.scale ? ownScale(entries.flatMap((e) => (e.raw != null ? [e.raw] : []))) : undefined;
  for (const e of entries) {
    const s = ratingSign(e.rating, e.raw, norm, scale);
    if (s == null) continue;
    n += 1;
    for (const g of new Set(genresOf(e.work))) add(sums.genres, g, s);
    for (const c of new Set(countriesOf(e.work).map(countryKey))) add(sums.countries, c, s);
    if (keep && ANCHOR_KEEP.kept) {
      const { ids, names } = creatorKeys(e.work);
      for (const k of new Set([...ids, ...names])) add(sums.creators, k, s);
    } else for (const p of e.work.creators.slice(0, 2)) add(sums.creators, p, s);
  }
  for (const id of new Set(picks)) {
    const shelf = shelfById.get(id);
    if (!shelf) continue;
    n += 1;
    for (let i = 0; i < PICK_FILMS; i++) {
      for (const g of shelf.genres ?? []) add(sums.genres, g, 1);
      for (const c of shelf.countries ?? []) add(sums.countries, c, 1);
    }
  }
  if (!n) return undefined;
  const fold = (m: Map<string, [number, number]>, prior = PRIOR) => Object.fromEntries([...m].map(([k, [s, c]]) => [k, s / (c + prior)]));
  return { genres: fold(sums.genres), countries: fold(sums.countries), creators: fold(sums.creators, keep ? ANCHOR_KEEP.creatorPrior : PRIOR) };
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** Близость кандидата к оценённому: жанр — главное, страна — вторым, автор — подсказкой. */
export function contentFit(taste: ContentTaste, work: WorkCard, genresOf: (w: WorkCard) => string[], countriesOf: CountriesOf = ownCountries): number {
  if (EXPERIMENTS.anchorKeep && ANCHOR_KEEP.kept) return keptFit(taste, work, genresOf, countriesOf);
  const genre = mean(genresOf(work).map((g) => taste.genres[g] ?? 0));
  const country = mean([...new Set(countriesOf(work).map(countryKey))].map((c) => taste.countries[c] ?? 0));
  const creator = Math.max(0, ...work.creators.slice(0, 2).map((p) => taste.creators[p] ?? 0));
  return clamp(0.6 * genre + 0.3 * country + 0.1 * creator, -1, 1);
}

/** Близость с флагом `anchorKeep` (23.10): у признака, которого у кандидата нет, нет и голоса — вес делится на
 *  известные; автор — средним по известным в истории (и «Отлично», и «Мимо»), по элементу Wikidata, а без него — по имени. */
function keptFit(taste: ContentTaste, work: WorkCard, genresOf: (w: WorkCard) => string[], countriesOf: CountriesOf): number {
  const w = ANCHOR_KEEP.weights;
  const genres = genresOf(work);
  const countries = [...new Set(countriesOf(work).map(countryKey))];
  const { ids, names } = creatorKeys(work);
  const known = (ids.length ? ids : names).flatMap((k) => (k in taste.creators ? [taste.creators[k]] : []));
  let sum = 0, weight = 0;
  if (genres.length) { sum += w.genre * mean(genres.map((g) => taste.genres[g] ?? 0)); weight += w.genre; }
  if (countries.length) { sum += w.country * mean(countries.map((c) => taste.countries[c] ?? 0)); weight += w.country; }
  if (known.length) { sum += w.creator * mean(known); weight += w.creator; }
  return weight ? clamp(sum / weight, -1, 1) : 0;
}

/** Вес якоря: полный при первых оценках, к `FADE_AT` — ноль; с флагом `anchorKeep` (23.10) — к `FADE_AT` ANCHOR_KEEP.floor.
 *  С флагом здесь же — запрос авторов по элементам: вес спрашивают до подбора, и к его счёту они обычно уже пришли. */
export function contentWeight(rated: number, min = 5): number {
  const t = clamp(1 - (rated - min) / (FADE_AT - min), 0, 1);
  if (!EXPERIMENTS.anchorKeep) return CONTENT_WEIGHT * t;
  void loadAnchorCredits();
  // от веса новичка к полу: у длинной истории якорь посчитан по сотням оценок, ему можно верить не меньше
  return CONTENT_WEIGHT * t + ANCHOR_KEEP.floor * (1 - t);
}

/** Фильм с выбранной полки вкуса — для порядка колоды первых оценок: узнаваемое из своего — вперёд. */
export function onPickedShelf(work: WorkCard, picks: readonly string[], genresOf: (w: WorkCard) => string[], countriesOf: CountriesOf = ownCountries): boolean {
  if (!picks.length) return false;
  const genres = new Set(genresOf(work));
  const countries = new Set(countriesOf(work).map(countryKey));
  return picks.some((id) => {
    const shelf = shelfById.get(id);
    return Boolean(shelf && ((shelf.genres ?? []).some((g) => genres.has(g)) || (shelf.countries ?? []).some((c) => countries.has(c))));
  });
}
