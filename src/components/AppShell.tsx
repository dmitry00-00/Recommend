import { useEffect, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { initTelegram, isTelegram, showBackButton } from '@/lib/telegram';
import { ToastViewport } from './Toast';
import { cx } from '@/lib/cx';
import ru from '@/i18n/ru';

export type ShellVariant = 'mobile' | 'telegram';

export interface NavItem {
  id: string;
  to: string;
  label: string;
}

/** Глифы навигации — из бандла системы: лента, ломаная маршрута, кольца карты, тетрадь, профиль. */
const GLYPHS: Record<string, string[]> = {
  today: ['M4 6.8h12v8.7h-12z', 'M6.2 4.4h9.6', 'M7 10.4h6'],
  trajectories: ['M3.5 14.5 8 8 12 11 16.5 4'],
  map: ['M10 3.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13z', 'M10 6.6a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8z'],
  journal: ['M4.5 3.5h11v13h-11z', 'M7.5 7h5', 'M7.5 10h5', 'M7.5 13h3'],
  search: ['M9 3.6a5.4 5.4 0 1 0 0 10.8 5.4 5.4 0 0 0 0-10.8z', 'M12.9 12.9 16.5 16.5'],
  profile: ['M10 4.5a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6z', 'M4.5 16c1.2-2.8 3.2-4.2 5.5-4.2s4.3 1.4 5.5 4.2'],
};

function NavMark({ id, active }: { id: string; active: boolean }) {
  return (
    <svg className="tm-nav__glyph" width={20} height={20} viewBox="0 0 20 20" aria-hidden="true">
      {(GLYPHS[id] ?? []).map((d, i) => (
        <path key={i} d={d} fill="none" stroke="currentColor" strokeWidth={active ? 1.8 : 1.4}
              strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </svg>
  );
}

export interface AppShellProps {
  /** Не задан — определяется по среде: внутри Telegram → 'telegram'. */
  variant?: ShellVariant;
  nav: NavItem[];
  children: ReactNode;
}

/** Оболочка приложения: экран, тосты над навигацией и сама нижняя навигация с профилем
 *  справа. В варианте `telegram` шапку рисует мессенджер — здесь только контент, навигация
 *  над домашним индикатором и кнопка «Назад» в его шапке на вложенных экранах. Ни одного
 *  значения мимо токенов. */
export function AppShell({ variant, nav, children }: AppShellProps) {
  const inTelegram = variant ? variant === 'telegram' : isTelegram();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => (inTelegram ? initTelegram() : undefined), [inTelegram]);
  // Модальные окна рисуются порталом вне оболочки — ширину рамки они берут из переменной.
  useEffect(() => {
    document.documentElement.style.setProperty('--tm-frame', inTelegram ? 'none' : '420px');
  }, [inTelegram]);

  // Вложенный экран (не пункт навигации и не корень) — «Назад» в шапке мессенджера.
  const topLevel = location.pathname === '/' || location.pathname === '/settings'
    || nav.some((item) => item.to === location.pathname);
  useEffect(() => {
    if (!inTelegram || topLevel) return undefined;
    return showBackButton(() => navigate(-1));
  }, [inTelegram, topLevel, navigate]);

  return (
    <div className={cx('tm-shell', 'tm-shell--mobile', 'tm-shell--app', inTelegram && 'tm-shell--telegram')}>
      {children}
      <ToastViewport />
      <nav className="tm-nav tm-nav--mobile" aria-label={ru.shell.navLabel}>
        <ul className="tm-nav__list">
          {nav.map((item) => (
            <li key={item.id}>
              <NavLink
                to={item.to}
                className={({ isActive }) => cx('tm-nav__item', isActive && 'tm-nav__item--on')}
              >
                {({ isActive }) => (
                  <>
                    <NavMark id={item.id} active={isActive} />
                    <span>{item.label}</span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
        <NavLink to="/settings" aria-label={ru.nav.profile}
                 className={({ isActive }) => cx('tm-nav__item', 'tm-nav__item--profile', isActive && 'tm-nav__item--on')}>
          {({ isActive }) => <NavMark id="profile" active={isActive} />}
        </NavLink>
      </nav>
    </div>
  );
}
