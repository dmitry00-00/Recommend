import { useRole, useSettings } from './settingsStore';
import { webApp } from './telegram';

/** Поэтапный выкат (ТВ-3в, 06.10): новое в интерфейсе сначала видит доля людей, остальные —
 *  прежнее, и поведение сравнивается. Доля — здесь, в сборке: поменять её — выложить новую.
 *  Кто попал в долю, решает хэш id в Telegram и имени флага: один и тот же человек всегда в
 *  одной группе, а у разных флагов группы разные. Ручной переключатель в настройках (только
 *  у владельца) сильнее доли — им проверяют интерфейс до выката. */
export const ROLLOUT = {
  /** полки рубрик в карточке (ТВ-3г). Этап 0–1: никому — рубрики только в данных и в замере */
  lensShelves: 0,
  /** карточка по глубине (15.10): паспорт иконками и зоны «Мнения · Грехи · Разборы» вместо одной ленты авторов */
  depthCard: 0,
  // Функции поверх минимальной редакции (10.10): 0 — только в эталоне, дальше — доля участников.
  /** «Смотреть»: вкладка кинотеатров и главная кнопка Telegram в карточке */
  watch: 0,
  /** переключатель «Сколько сегодня сил» над лентой и в настройках */
  energy: 0,
  /** «В планы» и архив над лентой */
  plans: 0,
  /** подробный дневник: «смотрю сейчас», чек-ин с трудностью и рефлексией */
  diary: 0,
  /** поиск: пункт меню и «словами» над лентой */
  search: 0,
  /** «Выбрать вместе» */
  together: 0,
  /** подписки на разборы и героев, сводка от бота */
  follows: 0,
  /** страницы голосов, людей, вселенных, героев и полная страница фильма со всеми разделами */
  pages: 0,
  /** «Мои подписки» (ЗП-42): кинотеатры в настройках, доступное без доплаты — вперёд, пометка у карточки */
  subscriptions: 0,
  /** полка бесплатной легальной классики (ЗП-43): место в ленте и «Смотреть бесплатно» с источником */
  freeClassics: 0,
  /** полки вкуса новичка (ЗП-45, шаг 1): «что вам ближе» на экране первых оценок */
  tastePicks: 0,
  /** культурные подборки (ЗП-45, шаг 2): кино стран и школ, порядок от уровня человека вглубь */
  collections: 0,
  /** «Почитать» (книжный трек, 11.10): одна книга по силам в ленте, сверх фильмов */
  readShelf: 0,
} as const;
export type Flag = keyof typeof ROLLOUT;

/** Число 0…1 из id человека и имени флага (FNV-1a): стабильно между запусками и устройствами. */
export function bucket(userId: string | number, flag: string): number {
  let h = 0x811c9dc5;
  for (const ch of `${flag}:${userId}`) { h ^= ch.codePointAt(0)!; h = Math.imul(h, 0x01000193) >>> 0; }
  return h / 0x100000000;
}

export function inRollout(flag: Flag, userId = webApp()?.initDataUnsafe?.user?.id): boolean {
  const share = ROLLOUT[flag];
  if (share <= 0 || userId == null) return false;
  return share >= 1 || bucket(userId, flag) < share;
}

/** Редакция (10.10, решение владельца): участникам — минимум (лента, разборы, обсуждения, «видел» с
 *  оценкой), разрабатываемая версия — эталон, из которого функции включаются по одной, когда виден
 *  спрос. Админ и тестеры видят эталон; админ может переключиться на минимум в настройках. */
export type Edition = 'minimum' | 'full';
export type Feature = Exclude<Flag, 'lensShelves' | 'depthCard'>;

export function useEdition(): Edition {
  const s = useSettings();
  const role = useRole();
  // до загрузки настроек — минимум: лишнее не должно мелькнуть и пропасть
  if (!s || !role || role === 'user') return 'minimum';
  return s.edition ?? 'full';
}

/** Включена ли функция: в эталоне — всегда, в минимуме — если человек попал в долю выката. */
export function useFeature(feature: Feature): boolean {
  return useEdition() === 'full' || inRollout(feature);
}

/** Полки рубрик: тестеру — всегда; админу — по умолчанию да, переключатель в настройках выключает;
 *  участнику — доля выката. До загрузки настроек — нет, чтобы карточка не мигала полками. */
export function useLensShelves(): boolean {
  const s = useSettings();
  const role = useRole();
  const edition = useEdition();
  if (!s) return false;
  // минимальная редакция глазами участника: полки — только по доле выката
  if (edition === 'minimum') return inRollout('lensShelves');
  if (role === 'tester') return true;
  return s.lensShelves ?? (role === 'admin' || inRollout('lensShelves'));
}

/** Карточка по глубине (src/lib/depth.ts): тестеру — всегда; админу — по умолчанию да, переключатель в настройках
 *  возвращает прежнюю карточку для сравнения; участнику — доля выката. До загрузки настроек — прежняя. */
export function useDepthCard(): boolean {
  const s = useSettings();
  const role = useRole();
  const edition = useEdition();
  if (!s) return false;
  if (edition === 'minimum') return inRollout('depthCard');
  if (role === 'tester') return true;
  return s.depthCard ?? (role === 'admin' || inRollout('depthCard'));
}
