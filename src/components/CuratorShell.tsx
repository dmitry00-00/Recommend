import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { ToastViewport } from './Toast';
import { cx } from '@/lib/cx';
import ru from '@/i18n/ru';

export interface CuratorNavItem { id: keyof typeof ru.curator.nav; to: string }

export const CURATOR_NAV: CuratorNavItem[] = [
  { id: 'queue', to: '/curator' },
  { id: 'gold', to: '/curator/gold' },
  { id: 'runs', to: '/curator/runs' },
  { id: 'packets', to: '/curator/packets' },
  { id: 'taxonomy', to: '/curator/taxonomy' },
  { id: 'mappings', to: '/curator/mappings' },
  { id: 'sources', to: '/curator/sources' },
  { id: 'evaluation', to: '/curator/evaluation' },
  { id: 'agreement', to: '/curator/agreement' },
  { id: 'contributors', to: '/curator/contributors' },
];

/** Оболочка кураторской: десктопный вариант системы — боковая навигация слева, экран справа.
 *  Только десктоп; на телефоне не предполагается. Тосты — те же. */
export function CuratorShell({ children }: { children: ReactNode }) {
  return (
    <div className="tm-shell tm-shell--desktop tm-shell--app">
      <nav className="tm-nav tm-nav--desktop" aria-label={ru.curator.navLabel}>
        <p className="tm-nav__brand">{ru.curator.brand}</p>
        <ul className="tm-nav__list">
          {CURATOR_NAV.map((item) => (
            <li key={item.id}>
              <NavLink to={item.to} end={item.to === '/curator'}
                       className={({ isActive }) => cx('tm-nav__item', isActive && 'tm-nav__item--on')}>
                <span>{ru.curator.nav[item.id]}</span>
              </NavLink>
            </li>
          ))}
        </ul>
        <NavLink to="/today" className="tm-nav__item tm-curator__toapp">{ru.curator.toApp}</NavLink>
      </nav>
      <div className="tm-curator__body">
        {children}
        <ToastViewport />
      </div>
    </div>
  );
}
