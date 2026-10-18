// Язык интерфейса (ЗП-20, 07.10) — выбор без самих словарей (18.10, аудит скорости, волна 3А): его читает и вход
// (src/main.tsx, до приложения — грузит английский словарь отдельным куском), и src/i18n/index.ts.
export type Language = 'ru' | 'en';

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
// язык страницы — для переносов, озвучки и перевода браузером: в index.html стоит ru, английская сборка его меняет
if (typeof document !== 'undefined' && document.documentElement) document.documentElement.lang = language;
/** Локаль для дат и чисел. */
export const locale = language === 'ru' ? 'ru-RU' : 'en-US';

/** Сменить язык: запомнить и перезапустить приложение. С сервера (настройка «Язык») — тот же путь. */
export function switchLanguage(lang: Language) {
  if (lang === language) return;
  remember(lang);
  location.reload();
}

