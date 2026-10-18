// Приложение (18.10, аудит скорости, волна 3А): раньше это был сам вход, теперь его грузит src/main.tsx — после словаря
// языка: строки читаются уже при загрузке модулей, а английский словарь — отдельный кусок.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { App } from '@/App';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { language } from '@/i18n';
import { setTitlesEn } from '@/lib/format';
import { isTelegram } from '@/lib/telegram';

// внутри Telegram текст — системным шрифтом, как у экранов самого мессенджера (ДФ-20, 15.10): отметка на корне до
// первого кадра — иначе браузер успеет скачать IBM Plex; шторки рисуются порталом вне оболочки, поэтому не класс оболочки
if (isTelegram()) document.documentElement.dataset.tg = '';

// onCaughtError/onUncaughtError (17.10): ошибки, пойманные границами, тоже в консоль — со стеком компонентов
const report = (kind: string) => (error: unknown, info: { componentStack?: string }) =>
  console.error(`[${kind}]`, error, info.componentStack ?? '');
const render = () => createRoot(document.getElementById('root')!, {
  onCaughtError: report('caught'),
  onUncaughtError: report('uncaught'),
}).render(
  <StrictMode>
    {/* верхняя граница (17.10) — на сбой самой оболочки или роутера; ошибки экранов ловит граница в App */}
    <ErrorBoundary scope="app">
      {/* HashRouter, а не BrowserRouter: один и тот же билд открывается
          и с сервера, и двойным щелчком по dist/index.html. Под реальный
          хостинг меняется на BrowserRouter одной строкой. */}
      <HashRouter>
        <App />
      </HashRouter>
    </ErrorBoundary>
  </StrictMode>,
);

// английские названия (ЗП-20) — до первого кадра, отдельным куском: русскому интерфейсу не грузятся
// (без await верхнего уровня — цель сборки по умолчанию его не знает)
if (language === 'en') import('@/mocks/titlesEn').then((m) => setTitlesEn(m.titlesEn), () => undefined).finally(render);
else render();
