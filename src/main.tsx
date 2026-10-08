import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { App } from '@/App';
import '@/styles/theme.css';
import { language } from '@/i18n';
import { setTitlesEn } from '@/lib/format';

const render = () => createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* HashRouter, а не BrowserRouter: один и тот же билд открывается
        и с сервера, и двойным щелчком по dist/index.html. Под реальный
        хостинг меняется на BrowserRouter одной строкой. */}
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
);

// английские названия (ЗП-20) — до первого кадра, отдельным куском: русскому интерфейсу не грузятся
// (без await верхнего уровня — цель сборки по умолчанию его не знает)
if (language === 'en') import('@/mocks/titlesEn').then((m) => setTitlesEn(m.titlesEn), () => undefined).finally(render);
else render();
