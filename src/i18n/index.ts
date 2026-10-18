// Язык интерфейса (ЗП-20, 07.10). Словарь выбирается один раз при запуске — строки читаются прямо при
// загрузке модулей (`ui.nav.today` в разметке и в константах), поэтому смена языка = перезагрузка.
// Откуда язык: явный выбор (`?lang=en` в адресе, настройка «Язык» — её копия в localStorage `tm.lang`),
// иначе — по умолчанию сборки `VITE_DEFAULT_LANG`: 'ru' (как сейчас), 'en' или 'auto' — по языку Telegram
// и браузера. «auto» — для контура Global (ЗП-26): у русских участников Telegram часто по-английски, и
// угадывать язык им нельзя.
import ru, { type Strings } from './ru';
import { language } from './language';

export { chosenLanguage, language, locale, switchLanguage, type Language } from './language';

/** Число с выбором формы: по-русски три (1 / 2–4 / 5), по-английски две (1 / остальное). */
export function plural(n: number, one: string, few: string, many: string): string {
  if (language === 'en') return n === 1 ? one : many;
  const tail = n % 10;
  const teen = n % 100 >= 10 && n % 100 <= 20;
  return !teen && tail === 1 ? one : !teen && tail > 1 && tail < 5 ? few : many;
}

/** Словарь этого запуска. Русский — в сборке; английский (~37 КБ brotli) — отдельным куском (18.10, аудит скорости,
 *  волна 3А): его до приложения грузит вход (src/main.tsx) и кладёт сюда через `globalThis.__tmStrings` — строки читаются
 *  уже при загрузке модулей. Не пришёл (сеть, инструменты в node) — русский. */
const ui: Strings = language === 'en' ? ((globalThis as { __tmStrings?: Strings }).__tmStrings ?? ru) : ru;
export default ui;
