// Кинотеатры (ЗП-42, 10.10): одно имя на площадку, откуда бы ни пришло — TMDb (данные JustWatch) пишет
// «Kinopoisk», «More TV», «Ivi», неофициальный API Кинопоиска — «Кинопоиск», «more.tv», «Иви», «Кинотеатр Wink».
// Подписки участника хранятся этими именами (`UserSettings.subscriptions`), и пометка «есть в вашей подписке»
// сходится с любым источником.

/** Как фильм есть на площадке: по подписке, бесплатно, бесплатно с рекламой, аренда, покупка. */
export type WatchKind = 'subscription' | 'free' | 'ads' | 'rent' | 'buy';

/** Без доплаты сверх того, что у человека уже есть: подписка (если она его) и бесплатное. */
export const NO_EXTRA: readonly WatchKind[] = ['subscription', 'free', 'ads'];

const fold = (s: string) => s.toLowerCase().replace(/ё/g, 'е').replace(/^кинотеатр\s+/, '').replace(/\s+/g, ' ').trim();

const ALIASES: Record<string, string> = {
  'кинопоиск': 'kinopoisk', 'kinopoisk': 'kinopoisk', 'kinopoisk hd': 'kinopoisk', 'кинопоиск hd': 'kinopoisk',
  'иви': 'ivi', 'ivi': 'ivi', 'okko': 'okko', 'wink': 'wink', 'kion': 'kion', 'premier': 'premier', 'start': 'start',
  'амедиатека': 'amediateka', 'amediateka': 'amediateka', 'more tv': 'moretv', 'more.tv': 'moretv', 'moretv': 'moretv',
  'vk видео': 'vkvideo', 'vk video': 'vkvideo', 'смотрешка': 'smotreshka', 'smotreshka': 'smotreshka', '24тв': '24tv',
  'viju': 'viju', 'мегафон тв': 'megafontv', 'кино1тв': 'kino1tv', 'tvigle': 'tvigle',
};

/** Имя площадки для сравнения: «Кинотеатр Wink» и «Wink» — одно, «Kinopoisk» и «Кинопоиск» — одно. */
export function cinemaSlug(name: string): string {
  const f = fold(name);
  return ALIASES[f] ?? f.replace(/[^\p{L}\p{N}]+/gu, '');
}

/** Площадки России для выбора в настройках — по тому, у скольких фильмов справочника они есть (TMDb, RU). */
export const RU_CINEMAS: { slug: string; name: string }[] = [
  { slug: 'kinopoisk', name: 'Кинопоиск' }, { slug: 'okko', name: 'Okko' }, { slug: 'ivi', name: 'Иви' },
  { slug: 'wink', name: 'Wink' }, { slug: 'kion', name: 'KION' }, { slug: 'premier', name: 'PREMIER' },
  { slug: 'start', name: 'START' }, { slug: 'amediateka', name: 'Амедиатека' }, { slug: 'moretv', name: 'more.tv' },
  { slug: 'vkvideo', name: 'VK Видео' },
];

/** Справочник наличия (tools/watch-providers.mts → `watchProviders`): ключ произведения → регион → площадки
 *  по видам (имена — `cinemaSlug`) и ссылка TMDb на страницу «где смотреть». */
export interface RegionWatch { l?: string; s?: string[]; f?: string[]; a?: string[]; r?: string[]; b?: string[] }
/** `regions` — какие регионы в справочнике (с 11.10; у российского сервера — RU, у Global — свои, ЗП-26) */
export interface WatchProviders { at: string; names: Record<string, string>; works: Record<string, Record<string, RegionWatch>>; regions?: string[] }

const KIND_OF: [keyof RegionWatch, WatchKind][] = [['s', 'subscription'], ['f', 'free'], ['a', 'ads'], ['r', 'rent'], ['b', 'buy']];

/** Площадки региона с видом, лучший вид первым: одна площадка бывает и по подписке, и в аренде. */
export function regionOptions(r: RegionWatch): { slug: string; kind: WatchKind }[] {
  const out: { slug: string; kind: WatchKind }[] = [];
  for (const [k, kind] of KIND_OF) for (const slug of (r[k] as string[] | undefined) ?? []) if (!out.some((o) => o.slug === slug)) out.push({ slug, kind });
  return out;
}

/** Можно смотреть без доплаты: бесплатно — всем, по подписке — если подписка у человека есть. */
export function freeFor(options: { platform: string; kind?: WatchKind }[], subscriptions: readonly string[]): boolean {
  return options.some((o) => o.kind === 'free' || o.kind === 'ads' || (o.kind === 'subscription' && subscriptions.includes(cinemaSlug(o.platform))));
}
