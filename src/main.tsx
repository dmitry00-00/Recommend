// Вход (18.10, аудит скорости, волна 3А): стили, язык и сразу приложение (src/boot.tsx). Оба словаря раньше ехали во
// входном куске; теперь в нём только русский — английский (~37 КБ brotli) грузится отдельно и до приложения: строки
// читаются уже при загрузке модулей (`ui.nav.today` в константах), поэтому словарь должен быть на месте раньше них.
// Кусок приложения сборка заранее ставит в index.html (`modulepreload`, vite.config.ts) — второго круга по сети нет.
import '@/styles/theme.css';
import { language } from '@/i18n/language';
import { reloadOnce } from '@/lib/reload';

// чанк прошлой выкладки (17.10): Vite сообщает о незагрузившемся ленивом модуле или его стилях событием — сразу одна
// перезагрузка за новым index.html. Если перезагрузиться нельзя (только что были, нет сети, нет хранилища), событие
// не гасим: ошибка дойдёт до границы экрана, и человек увидит «Обновить», а не пустоту
window.addEventListener('vite:preloadError', (e) => { if (reloadOnce()) e.preventDefault(); });

const strings: Promise<void> = language === 'en'
  ? import('@/i18n/en').then((m) => { (globalThis as { __tmStrings?: unknown }).__tmStrings = m.default; }, () => undefined)
  : Promise.resolve();
// не загрузился сам кусок приложения (выкладка сменила файлы, оборвалась сеть) — одна перезагрузка; нельзя — заставка
// index.html через 20 с скажет «Не загрузилось» и даст «Обновить»
void strings.then(() => import('./boot')).catch(() => { reloadOnce(); });
