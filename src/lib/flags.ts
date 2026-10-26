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
  /** «В планы» и архив над лентой. 20.10 (владелец): кнопка — всем, с ней архив, иначе планы негде найти */
  plans: 1,
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
  /** страница автора /voice/:id отдельно от `pages` (23.10, партнёрство с каналами): автор даёт у себя ссылку
   *  `startapp=v-<id>` — она должна открываться, даже когда остальные страницы закрыты */
  voicePage: 0,
  /** канал автора на странице /person/:id (24.10, слово владельца): его Telegram и посты о своих работах; и ссылка
   *  `startapp=p-<Q>` открывает страницу человека, даже когда остальные страницы закрыты (как `voicePage`) */
  personChannel: 0,
  /** «Мои подписки» (ЗП-42): кинотеатры в настройках, доступное без доплаты — вперёд, пометка у карточки */
  subscriptions: 0,
  /** полка бесплатной легальной классики (ЗП-43): место в ленте и «Смотреть бесплатно» с источником */
  freeClassics: 0,
  /** первый вход свайпом (ДФ-2, 16.10): «видел / хочу / не моё» по 12 фильмам и «четыре любимых» вместо колоды /rate;
   *  при 0–4 оценках лента общая, с подписью «пока общая». Сравнение с колодой — события `onboard` */
  swipeStart: 0,
  /** заставка-плёнка «Сегодня» (16.10): раз за сессию, пока грузится лента, бежит плёнка с кадрами и встаёт на её карточках */
  reel: 0,
  /** полки вкуса новичка (ЗП-45, шаг 1): «что вам ближе» на экране первых оценок */
  tastePicks: 0,
  /** культурные подборки (ЗП-45, шаг 2): кино стран и школ, порядок от уровня человека вглубь */
  collections: 0,
  /** «Почитать» (книжный трек, 11.10): одна книга по силам в ленте, сверх фильмов */
  readShelf: 0,
  /** книжный вход (23.10, .cache/outreach/book-onboarding-2310.md): ссылка `startapp=books--s<метка>` из книжного канала — лента
   *  книг в настройки и первые оценки с рядом книг первым (ручная колода src/mocks/bookRatingDeck.ts); книги видны такому
   *  человеку и при readShelf = 0, у карточки книги — «Читать» и тексты пустых вкладок по виду произведения */
  bookEntry: 0,
  /** «Поддержать автора» на странице голоса (25.10): сервисы донатов, найденные у самого автора (описание канала,
   *  собственные посты; tools/voice-support.mts), — без сумм и цен; не нашли — панели нет */
  support: 0,
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

/** Книги человеку (23.10, книжный вход): «Почитать» по доле выката — или флаг bookEntry и человек пришёл по книжной ссылке
 *  (`bookEntry` в настройках, App.tsx) либо выбрал ленту книг. Остальным — как было: только readShelf. */
export function useBooks(): boolean {
  const s = useSettings();
  const shelf = useFeature('readShelf');
  const entry = useFeature('bookEntry');
  return shelf || (entry && Boolean(s && (s.feedKind === 'book' || s.bookEntry)));
}

/** Книжный вход в силе (23.10): флаг bookEntry и лента книг выбрана — первые оценки с книг, книжные тексты холодного старта. */
export function useBookFirst(): boolean {
  const s = useSettings();
  return useFeature('bookEntry') && s?.feedKind === 'book';
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
