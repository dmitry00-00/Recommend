import { Suspense, useEffect } from 'react';
import { useLocation, useNavigate, useRoutes } from 'react-router-dom';
import { routes } from '@/routes';
import { AppShell } from '@/components/AppShell';
import { CuratorShell } from '@/components/CuratorShell';
import { ToastProvider } from '@/components/Toast';
import { loadSettings, useMechanics } from '@/lib/settingsStore';
import { startParam } from '@/lib/telegram';
import ui from '@/i18n';

const NAV: { id: keyof typeof ui.nav; to: string }[] = [
  { id: 'today', to: '/today' },
  { id: 'search', to: '/search' },
  { id: 'trajectories', to: '/trajectories' },
  { id: 'map', to: '/map' },
  { id: 'journal', to: '/journal' },
];

function Shell({ children }: { children: React.ReactNode }) {
  // Без механики в меню лента и поиск (архив — над лентой, профиль — справа); маршруты
  // и карта — только с включённой механикой: пока это наш внутренний инструмент (21.09).
  // Поиск виден всегда: отметить просмотренное — то, ради чего человек сюда и приходит.
  const mechanics = useMechanics();
  const nav = NAV.filter((item) => item.id === 'today' || item.id === 'search' || (mechanics && item.id !== 'journal'));
  return <AppShell nav={nav.map((item) => ({ ...item, label: ui.nav[item.id] }))}>{children}</AppShell>;
}

/** Запуск по ссылке «Поделиться» (05.10): Telegram передаёт `startapp` в start_param — один раз
 *  при старте уводим на /open/<параметр>, тот найдёт карточку. Другие параметры не трогаем. */
function useSharedStart() {
  const navigate = useNavigate();
  useEffect(() => {
    const p = startParam();
    if (p && /^[wc]-[A-Za-z0-9_-]+$/.test(p)) navigate(`/open/${p}`, { replace: true });
    // приглашение голосовать (ЗП-11): `t-<сессия>`
    else if (p && /^t-[a-z0-9]{6,16}$/.test(p)) navigate(`/together/${p.slice(2)}`, { replace: true });
  }, []);
}

export function App() {
  const element = useRoutes(routes);
  useSharedStart();
  // Кураторская — десктопная оболочка с боковой навигацией; всё остальное — телефонная.
  const curator = useLocation().pathname.startsWith('/curator');
  useEffect(() => { loadSettings().catch(() => undefined); }, []);
  return (
    <ToastProvider>
      {curator
        ? <CuratorShell><Suspense fallback={null}>{element}</Suspense></CuratorShell>
        : <Shell><Suspense fallback={null}>{element}</Suspense></Shell>}
    </ToastProvider>
  );
}
