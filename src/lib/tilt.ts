// Наклон ленты (19.10, панель ленты v2, только админу и тестерам): оси, по которым человек наклоняет подбор на вечер, —
// «О чём» (желание главного героя), «Откуда» (полки стран и школ, ЗП-45), «Что сделает» (операции восприятия), «Когда»
// (десятилетия), «Как устроено» (барьеры формы из разметки), «Сколько времени». У каждой оси два режима: «больше такого» —
// подходящее поднимается в счёте, остальное остаётся; «только это» — отбор. Пустой наклон подбор не трогает вовсе.
// Здесь — чистые правила (без справочников): что у произведения по каждой оси и как наклон меняет пул и счёт. Справочники
// (желания героев, жанры TMDb) подаёт src/api/index.ts.
import type { CognitiveOperation, WorkCard } from '@/types/tmdf';
import { COLLECTIONS, inCollection, type Collection } from '@/lib/model/collections';
import { countryRu } from '@/lib/countries';
import { isSeries, isShortSeries } from '@/lib/media';
import { readingHours } from '@/lib/reading';

export type TiltAxis = 'want' | 'trad' | 'op' | 'era' | 'form' | 'len';
export const TILT_AXES: readonly TiltAxis[] = ['want', 'trad', 'op', 'era', 'form', 'len'];
/** выбранное на оси: варианты (у «Когда» — два десятилетия «от» и «до»), `only` — «только это» */
export interface TiltPick { v: string[]; only?: boolean }
export type Tilt = Partial<Record<TiltAxis, TiltPick>>;

/** Виды желания главного героя — tools/build-desire-axis.mts раскладывает по ним src/mocks/desires */
export const DESIRE_KINDS = ['home', 'redeem', 'escape', 'fame', 'protect', 'truth', 'revenge', 'love', 'survive', 'power'] as const;

const HOLLYWOOD = ['США', 'Великобритания'];
/** Кино стран — поверх полок школ (COLLECTIONS): то же правило «страна производства, без совместного с Голливудом» */
const COUNTRIES: readonly Collection[] = [
  { id: 'c-fr', countries: ['Франция'], notCountries: HOLLYWOOD },
  { id: 'c-it', countries: ['Италия'], notCountries: HOLLYWOOD },
  { id: 'c-de', countries: ['Германия', 'ФРГ', 'ГДР'], notCountries: HOLLYWOOD },
  { id: 'c-es', countries: ['Испания'], notCountries: HOLLYWOOD },
  { id: 'c-uk', countries: ['Великобритания'], notCountries: ['США'] },
  { id: 'c-us', countries: ['США'] },
  { id: 'c-jp', countries: ['Япония'], notCountries: HOLLYWOOD },
  { id: 'c-kr', countries: ['Южная Корея'], notCountries: HOLLYWOOD },
  { id: 'c-cn', countries: ['Китай', 'Тайвань'], notCountries: HOLLYWOOD },
  { id: 'c-in', countries: ['Индия'], notCountries: HOLLYWOOD },
  { id: 'c-su', countries: ['СССР'] },
  { id: 'c-ru', countries: ['Россия'], from: 1992 },
  { id: 'c-east', countries: ['Польша', 'Чехословакия', 'Чехия', 'Венгрия', 'Югославия', 'Румыния', 'Болгария', 'Сербия'], notCountries: HOLLYWOOD },
  { id: 'c-latam', countries: ['Мексика', 'Аргентина', 'Бразилия', 'Чили', 'Куба', 'Колумбия', 'Перу', 'Уругвай', 'Венесуэла'], notCountries: HOLLYWOOD },
];
export const TRADITIONS: readonly Collection[] = [...COLLECTIONS, ...COUNTRIES];
/** «Откуда» — до двух традиций сразу (как в макете) */
export const TRAD_MAX = 2;

/** «Как устроено» — по барьерам формы из разметки (строки разметки, не интерфейса). Плотного сюжета и «как документ»
 *  разметка не знает — таких вариантов нет */
export const FORM_GROUPS: Record<string, readonly string[]> = {
  slow: ['Медленный темп', 'Мало слов', 'Медленный разгон'],
  nonlinear: ['Нелинейное время', 'Фрагментарная структура', 'Смена рассказчиков без предупреждения'],
  unreal: ['Размытая граница реальности', 'Ненадёжный рассказчик'],
  noplot: ['Без сюжета в привычном смысле', 'Поток сознания'],
  talk: ['Разговорная форма', 'Одна комната', 'Театральная манера'],
  satire: ['Сатирическая условность', 'Условная актёрская манера'],
  many: ['Много линий', 'Много персонажей'],
  songs: ['Музыкальные номера'],
  bw: ['Чёрно-белое изображение', 'Немое кино'],
};

/** Операция «делает» вещь, если она ведущая или заметная (от 0,5) */
const OP_STRONG = 0.5;

/** Вес «больше такого» в счёте модели: всё совпало — +0,3 (разница уровня на шаг — около 0,1–0,2) */
export const TILT_WEIGHT = 0.3;
/** «Узко»: подходящих под «только» меньше стольких */
export const TILT_NARROW = 40;

/** Что у произведения по каждой оси — один раз на карточку пула */
export interface TiltFacts { want: readonly string[]; trad: readonly string[]; op: readonly string[]; year: number; form: readonly string[]; len: readonly string[] }

export interface TiltSources {
  /** виды желания главного героя по карточке; нет данных — пусто */
  desires: (work: WorkCard) => readonly string[];
  /** жанры TMDb по-русски — полкам с правилом по жанрам */
  genres: (work: WorkCard) => readonly string[];
}

export function lengthOf(work: WorkCard): string[] {
  if (work.type === 'book') {
    const h = readingHours(work.pages);
    return h == null ? [] : [h <= 5 ? 'b-short' : h <= 12 ? 'b-mid' : 'b-long'];
  }
  if (isSeries(work)) return isShortSeries(work) ? ['mini', 'series'] : ['series'];
  const m = work.durationMinutes;
  if (!m) return [];
  return [m <= 95 ? 'short' : m <= 150 ? 'evening' : 'long'];
}

export function factsOf(work: WorkCard, src: TiltSources): TiltFacts {
  const ops = work.primaryOperations.filter((o, i) => i === 0 || o.intensity >= OP_STRONG).map((o) => o.op as CognitiveOperation);
  const barriers = new Set(work.barriers);
  // страны — по-русски один раз, а не на каждую полку
  const card = work.countries?.length ? { ...work, countries: work.countries.map(countryRu) } : work;
  const genres = src.genres(work);
  return {
    want: src.desires(work),
    trad: TRADITIONS.filter((c) => (c.genres || c.notGenres ? genres.length > 0 : true) && inCollection(c, card, genres)).map((c) => c.id),
    op: ops,
    year: work.year || 0,
    form: Object.entries(FORM_GROUPS).filter(([, list]) => list.some((b) => barriers.has(b))).map(([id]) => id),
    len: lengthOf(work),
  };
}

const setPick = (p: TiltPick | undefined): p is TiltPick => Boolean(p && p.v.length);
/** Оси, где что-то выбрано */
export const tiltAxes = (t: Tilt | undefined): TiltAxis[] => (t ? TILT_AXES.filter((a) => setPick(t[a])) : []);
export const tiltActive = (t: Tilt | undefined): t is Tilt => tiltAxes(t).length > 0;
export const tiltHasOnly = (t: Tilt | undefined): boolean => tiltAxes(t).some((a) => t![a]!.only);

/** Наклон без пустых осей, в одном порядке — чтобы сравнивать сочетания строкой */
export function tiltClean(t: Tilt | undefined): Tilt {
  const out: Tilt = {};
  for (const a of tiltAxes(t)) out[a] = { v: a === 'era' ? t![a]!.v.slice(0, 2) : [...t![a]!.v].sort(), ...(t![a]!.only ? { only: true } : {}) };
  return out;
}
export const tiltKey = (t: Tilt | undefined): string => JSON.stringify(tiltClean(t));

/** «Когда» (19.10, владелец): всё до 1900 года — один пункт барабана «до 1900» (значение ERA_OLD), дальше — десятилетия.
 *  У книг иначе барабан начинался с 1300-х и листался веками. */
export const ERA_OLD = 1800;
export const ERA_OLD_BEFORE = 1900;
export const eraBucket = (year: number): number => (year < ERA_OLD_BEFORE ? ERA_OLD : Math.floor(year / 10) * 10);

export function axisMatches(axis: TiltAxis, pick: TiltPick, f: TiltFacts): boolean {
  if (axis === 'era') {
    const from = Number(pick.v[0]);
    const to = Number(pick.v[1] ?? pick.v[0]);
    const b = eraBucket(f.year);
    return f.year > 0 && b >= from && b <= to;
  }
  const have = f[axis];
  return pick.v.some((v) => have.includes(v));
}

/** Проходит ли произведение все оси «только это» */
export function passesOnly(t: Tilt, f: TiltFacts): boolean {
  return tiltAxes(t).every((a) => !t[a]!.only || axisMatches(a, t[a]!, f));
}

/** Доля осей «больше такого», с которыми совпало: 0…1 */
export function moreFit(t: Tilt, f: TiltFacts): number {
  const more = tiltAxes(t).filter((a) => !t[a]!.only);
  if (!more.length) return 0;
  return more.filter((a) => axisMatches(a, t[a]!, f)).length / more.length;
}

/** Наклон пула: «только» — отбор, «больше» — надбавка к счёту и добор ленты без ограничений разнообразия, если отбор
 *  оставил мало. Пустой наклон — тот же массив и пустые настройки: подбор ровно прежний. */
export function applyTilt<C extends { work: WorkCard }>(pool: C[], t: Tilt | undefined, facts: (w: WorkCard) => TiltFacts): {
  pool: C[]; options: { boost?: { fit: (w: WorkCard) => number; weight: number }; fill?: boolean };
} {
  if (!tiltActive(t)) return { pool, options: {} };
  const only = tiltHasOnly(t);
  const more = tiltAxes(t).some((a) => !t[a]!.only);
  return {
    pool: only ? pool.filter((c) => passesOnly(t, facts(c.work))) : pool,
    options: {
      ...(more ? { boost: { fit: (w: WorkCard) => moreFit(t, facts(w)), weight: TILT_WEIGHT } } : {}),
      ...(only ? { fill: true } : {}),
    },
  };
}
