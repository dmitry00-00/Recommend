import { Suspense, useEffect, useRef } from 'react';
import { useLocation, useNavigate, useRoutes } from 'react-router-dom';
import { ScreenLoading, routes } from '@/routes';
import { AppShell } from '@/components/AppShell';
import { CuratorShell } from '@/components/CuratorShell';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ToastProvider, useToast } from '@/components/Toast';
import { coldStartLeft, visitDays } from '@/api';
import { SESSION_STALE_EVENT } from '@/api/store';
import { loadSettings, saveSettings, useMechanics, useSettings } from '@/lib/settingsStore';
import { useFeature } from '@/lib/flags';
import { useLegalNotice } from '@/hooks/useLegalNotice';
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
  useLegalNotice(); // рекомендательные технологии (24.10, ст. 13.56 КоАП): один тост при первом запуске
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
    // страница автора (23.10, партнёрство с каналами): `v-<id из справочника>` (episodes) или `v-<handle канала>`
    // (episodesfilm, 5–32 знака по правилам Telegram) — handle VoiceScreen сводит к id сам. Хвост `--s<метка>` уже срезан
    else if (p && /^v-[A-Za-z0-9_]{2,32}$/.test(p)) navigate(`/voice/${p.slice(2)}`, { replace: true });
    // страница человека (24.10, сотрудничество с режиссёрами и писателями, tools/person-link.mts): `p-<элемент Wikidata>`;
    // вселенная — `u-<элемент>` (её страница открыта только с `pages`)
    else if (p && /^p-Q\d{1,12}$/.test(p)) navigate(`/person/${p.slice(2)}`, { replace: true });
    else if (p && /^u-Q\d{1,12}$/.test(p)) navigate(`/universe/${p.slice(2)}`, { replace: true });
  }, []);
}

/** Книжный вход (23.10, флаг bookEntry; .cache/outreach/book-onboarding-2310.md): `startapp=books` из поста книжного канала
 *  (хвост `--s<метка>` уже срезан) — лента книг и признак книжного входа в настройки, затем первые оценки с рядом книг
 *  первым; оценок уже хватает — сразу лента книг. Ждёт настроек: от них редакция (useFeature) и сохранение. Только startapp:
 *  /start в личке бота отвечает фильмами дня (worker/startPicks.ts). Отдельным узлом, а не в App: подписка на настройки
 *  не перерисовывает всё приложение на каждое их сохранение. */
function BookStart() {
  const navigate = useNavigate();
  const settings = useSettings();
  const bookEntry = useFeature('bookEntry');
  const bookChecked = useRef(false);
  useEffect(() => {
    if (!settings || bookChecked.current) return;
    bookChecked.current = true;
    if (!bookEntry || startParam() !== 'books') return;
    const go = (left: number) => navigate(left > 0 ? '/rate?books=1' : '/today', { replace: true });
    saveSettings({ feedKind: 'book', bookEntry: true }).catch(() => undefined)
      .then(() => coldStartLeft()).then(go, () => go(1));
  }, [settings, bookEntry]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
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
      <BookStart />
      {curator
        ? <CuratorShell><ErrorBoundary resetKey={screenKey}><Suspense fallback={null}>{element}</Suspense></ErrorBoundary></CuratorShell>
        : <Shell><ErrorBoundary resetKey={screenKey}><Suspense fallback={<ScreenLoading />}>{element}</Suspense></ErrorBoundary></Shell>}
    </ToastProvider>
  );
}
