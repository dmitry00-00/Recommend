import { Suspense, useEffect } from 'react';
import { useLocation, useNavigate, useRoutes } from 'react-router-dom';
import { ScreenLoading, routes } from '@/routes';
import { AppShell } from '@/components/AppShell';
import { CuratorShell } from '@/components/CuratorShell';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ToastProvider, useToast } from '@/components/Toast';
import { visitDays } from '@/api';
import { SESSION_STALE_EVENT } from '@/api/store';
import { loadSettings, useMechanics } from '@/lib/settingsStore';
import { useFeature } from '@/lib/flags';
import { addToHomeScreen, homeScreenMissed, startParam } from '@/lib/telegram';
import ui from '@/i18n';

const NAV: { id: keyof typeof ui.nav; to: string }[] = [
  { id: 'today', to: '/today' },
  { id: 'search', to: '/search' },
  { id: 'trajectories', to: '/trajectories' },
  { id: 'map', to: '/map' },
  { id: 'journal', to: '/journal' },
];

/** Ярлык на экран телефона (ДФ-3): с третьего дня захода, в Telegram 8.0+, если ярлыка ещё нет, — один раз тостом.
 *  Не сразу при открытии: сначала человек видит ленту, потом — предложение. */
const HOME_OFFERED = 'tm.homeScreenOffered';
function useHomeScreenOffer() {
  const toast = useToast();
  useEffect(() => {
    try { if (localStorage.getItem(HOME_OFFERED)) return; } catch { return; }
    let alive = true;
    const timer = setTimeout(() => {
      void visitDays().then(async (days) => {
        if (!alive || days < 3 || !(await homeScreenMissed()) || !alive) return;
        try { localStorage.setItem(HOME_OFFERED, new Date().toISOString()); } catch { /* приватное окно */ }
        toast({ text: ui.shell.homeScreen, action: ui.shell.homeScreenAdd, onAction: addToHomeScreen, duration: 10_000 });
      }).catch(() => undefined);
    }, 8000);
    return () => { alive = false; clearTimeout(timer); };
  }, []);
}

/** Вход протух (18.10, аудит, волна 2, п. 20): подпись Telegram старше часа, а своей сессии нет — сохранять нечем, и
 *  без слова об этом человек видел только «не сохранилось» на каждом действии. Один раз — тостом. */
function useStaleSession() {
  const toast = useToast();
  useEffect(() => {
    let shown = false;
    const on = () => { if (!shown) { shown = true; toast({ text: ui.shell.sessionStale, duration: 15_000 }); } };
    window.addEventListener(SESSION_STALE_EVENT, on);
    return () => window.removeEventListener(SESSION_STALE_EVENT, on);
  }, []);
}

function Shell({ children }: { children: React.ReactNode }) {
  // Без механики в меню лента и поиск (архив — над лентой, профиль — справа); маршруты
  // и карта — только с включённой механикой: пока это наш внутренний инструмент (21.09).
  // Поиск виден всегда: отметить просмотренное — то, ради чего человек сюда и приходит.
  // В минимальной редакции (10.10) поиска нет — в меню лента и профиль.
  const mechanics = useMechanics();
  const search = useFeature('search');
  useHomeScreenOffer();
  useStaleSession();
  const nav = NAV.filter((item) => item.id === 'today' || (item.id === 'search' && search) || (mechanics && item.id !== 'journal' && item.id !== 'search'));
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
    // собрать подборку для чата (команда /together, 11.10): `g-<ключ чата>`
    else if (p && /^g-[a-z0-9]{6,16}$/.test(p)) navigate(`/together?chat=${p.slice(2)}`, { replace: true });
  }, []);
}

export function App() {
  const element = useRoutes(routes);
  useSharedStart();
  // Кураторская — десктопная оболочка с боковой навигацией; всё остальное — телефонная.
  const location = useLocation();
  const curator = location.pathname.startsWith('/curator');
  useEffect(() => { loadSettings().catch(() => undefined); }, []);
  // граница — внутри оболочки (17.10): сбой одного экрана не снимает меню, переход на другой экран (новый
  // location.key) сбрасывает ошибку; путь — в придачу к ключу: переход простой ссылкой или правкой адреса, мимо
  // роутера, ключа не даёт (у всех таких 'default')
  const screenKey = `${location.key}:${location.pathname}`;
  return (
    <ToastProvider>
      {curator
        ? <CuratorShell><ErrorBoundary resetKey={screenKey}><Suspense fallback={null}>{element}</Suspense></ErrorBoundary></CuratorShell>
        : <Shell><ErrorBoundary resetKey={screenKey}><Suspense fallback={<ScreenLoading />}>{element}</Suspense></ErrorBoundary></Shell>}
    </ToastProvider>
  );
}
