import { Suspense, useEffect } from 'react';
import { useLocation, useRoutes } from 'react-router-dom';
import { routes } from '@/routes';
import { AppShell } from '@/components/AppShell';
import { CuratorShell } from '@/components/CuratorShell';
import { ToastProvider } from '@/components/Toast';
import { loadSettings, useMechanics } from '@/lib/settingsStore';
import ru from '@/i18n/ru';

const NAV: { id: keyof typeof ru.nav; to: string }[] = [
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
  return <AppShell nav={nav.map((item) => ({ ...item, label: ru.nav[item.id] }))}>{children}</AppShell>;
}

export function App() {
  const element = useRoutes(routes);
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
