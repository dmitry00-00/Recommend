import type { UserSettings } from '@/types/tmdf';
import { webApp } from './telegram';

/** Тема из настроек → `data-theme` на <html>. «Как в Telegram» — colorScheme мессенджера,
 *  а вне его — системная схема. Явный выбор перекрывает и то и другое. */
export function applyTheme(theme: UserSettings['theme']): void {
  const scheme = webApp()?.colorScheme
    ?? (window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  document.documentElement.dataset.theme = theme === 'system' ? scheme : theme;
}
