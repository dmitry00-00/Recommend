import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { App } from '@/App';
import '@/styles/theme.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* HashRouter, а не BrowserRouter: один и тот же билд открывается
        и с сервера, и двойным щелчком по dist/index.html. Под реальный
        хостинг меняется на BrowserRouter одной строкой. */}
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
);
