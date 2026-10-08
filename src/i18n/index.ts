// Язык интерфейса (ЗП-20, 07.10). Словарь выбирается один раз при запуске — строки читаются прямо при
// загрузке модулей (`ui.nav.today` в разметке и в константах), поэтому смена языка = перезагрузка.
// Откуда язык: явный выбор (`?lang=en` в адресе, настройка «Язык» — её копия в localStorage `tm.lang`),
// иначе — по умолчанию сборки `VITE_DEFAULT_LANG`: 'ru' (как сейчас), 'en' или 'auto' — по языку Telegram
// и браузера. «auto» — для контура Global (ЗП-26): у русских участников Telegram часто по-английски, и
// угадывать язык им нельзя.
import ru, { type Strings } from './ru';
import en from './en';

export type Language = 'ru' | 'en';
export const dictionaries: Record<Language, Strings> = { ru, en };

const KEY = 'tm.lang';
const isLanguage = (x: unknown): x is Language => x === 'ru' || x === 'en';
// языки, где по-русски читают свободнее, чем по-английски
const RU_READERS = /^(?:ru|uk|be|kk|ky|uz|tg|hy|az|ka)\b/i;

function stored(): Language | undefined {
  try {
    const v = localStorage.getItem(KEY);
    return isLanguage(v) ? v : undefined;
  } catch { return undefined; }
}

function guess(): Language {
  const tg = (globalThis as { Telegram?: { WebApp?: { initDataUnsafe?: { user?: { language_code?: string } } } } })
    .Telegram?.WebApp?.initDataUnsafe?.user?.language_code;
  const codes = [tg, ...(typeof navigator !== 'undefined' ? navigator.languages ?? [navigator.language] : [])].filter(Boolean) as string[];
  return codes.length && !RU_READERS.test(codes[0]) ? 'en' : 'ru';
}

function detect(): Language {
  if (typeof location !== 'undefined') {
    const fromUrl = new URLSearchParams(location.search).get('lang');
    if (isLanguage(fromUrl)) { remember(fromUrl); return fromUrl; }
  }
  const own = stored();
  if (own) return own;
  // вне Vite (инструменты в Node импортируют src/lib) import.meta.env нет
  const def = import.meta.env?.VITE_DEFAULT_LANG;
  return def === 'auto' ? guess() : isLanguage(def) ? def : 'ru';
}

function remember(lang: Language) {
  try { localStorage.setItem(KEY, lang); } catch { /* приватный режим — язык держится до перезагрузки */ }
}

/** Язык, который человек выбрал сам (настройка или `?lang=`), — без догадки и умолчания сборки. */
export const chosenLanguage = (): Language | undefined => stored();

/** Язык этого запуска. */
export const language: Language = detect();
/** Локаль для дат и чисел. */
export const locale = language === 'ru' ? 'ru-RU' : 'en-US';

/** Сменить язык: запомнить и перезапустить приложение. С сервера (настройка «Язык») — тот же путь. */
export function switchLanguage(lang: Language) {
  if (lang === language) return;
  remember(lang);
  location.reload();
}

/** Число с выбором формы: по-русски три (1 / 2–4 / 5), по-английски две (1 / остальное). */
export function plural(n: number, one: string, few: string, many: string): string {
  if (language === 'en') return n === 1 ? one : many;
  const tail = n % 10;
  const teen = n % 100 >= 10 && n % 100 <= 20;
  return !teen && tail === 1 ? one : !teen && tail > 1 && tail < 5 ? few : many;
}

const ui: Strings = dictionaries[language];
export default ui;
