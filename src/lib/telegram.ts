// Оболочка Telegram Mini App: тонкий типизированный слой над window.Telegram.WebApp.
// Скрипт telegram-web-app.js подключён в index.html. Вне Telegram (обычный браузер,
// dist/standalone.html без сети) объекта нет — всё здесь становится no-op, и
// приложение живёт как обычная страница. Правила — раздел «Telegram Mini App»
// дизайн-системы и HANDOFF.md:
//   · colorScheme мессенджера переключает data-theme, палитра themeParams не подмешивается;
//   · шапку рисует мессенджер, поэтому её цвета берутся из наших токенов, а не наоборот;
//   · безопасные зоны и высота вьюпорта приходят событиями, а не env() — внутри
//     WebView env(safe-area-inset-*) часто нули.

type SafeArea = { top: number; bottom: number; left: number; right: number };

export type TelegramEvent =
  | 'themeChanged' | 'viewportChanged' | 'safeAreaChanged' | 'contentSafeAreaChanged';

export interface TelegramWebApp {
  initData: string;
  /** то же самое, уже разобранное самим Telegram: показывать можно, доверять — нет */
  initDataUnsafe?: { user?: { id: number; first_name?: string; username?: string } };
  platform: string;
  version: string;
  colorScheme: 'light' | 'dark';
  viewportHeight: number;
  viewportStableHeight: number;
  isExpanded: boolean;
  /** Bot API 8.0+: вырезы и домашний индикатор устройства */
  safeAreaInset?: SafeArea;
  /** Bot API 8.0+: то, что занято интерфейсом самого Telegram */
  contentSafeAreaInset?: SafeArea;
  ready(): void;
  expand(): void;
  isVersionAtLeast(version: string): boolean;
  setHeaderColor(color: string): void;
  setBackgroundColor(color: string): void;
  setBottomBarColor?(color: string): void;
  disableVerticalSwipes?(): void;
  openLink(url: string, options?: { try_instant_view?: boolean }): void;
  openTelegramLink(url: string): void;
  onEvent(event: TelegramEvent, handler: () => void): void;
  offEvent(event: TelegramEvent, handler: () => void): void;
  /** Bot API 6.1+: отклик вибрацией. У старых клиентов объекта нет, поэтому всё опционально */
  HapticFeedback?: {
    impactOccurred(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void;
    notificationOccurred(type: 'error' | 'success' | 'warning'): void;
    selectionChanged(): void;
  };
  BackButton: {
    isVisible: boolean;
    show(): void;
    hide(): void;
    onClick(handler: () => void): void;
    offClick(handler: () => void): void;
  };
}

declare global {
  interface Window { Telegram?: { WebApp?: TelegramWebApp } }
}

/** Объект WebApp, если страница открыта внутри Telegram. Скрипт создаёт его и в
 *  обычном браузере — с platform 'unknown' и пустым initData; такой не считается. */
export function webApp(): TelegramWebApp | undefined {
  const wa = window.Telegram?.WebApp;
  if (!wa) return undefined;
  return wa.initData !== '' || wa.platform !== 'unknown' ? wa : undefined;
}

export const isTelegram = (): boolean => webApp() !== undefined;

/** Строка `initData` для входа: её приложение отдаёт серверу как есть, ничего не меняя. */
export const initData = (): string => webApp()?.initData ?? '';

/** Бот, внутри которого живёт мини-приложение: ссылки на него — `https://t.me/recomend_media_bot`. */
export const BOT_USERNAME = 'recomend_media_bot';

const root = () => document.documentElement;

/** Цвет токена в виде #rrggbb: Telegram принимает только шесть знаков, а минификатор
 *  CSS сжимает #ffffff до #fff. */
function readToken(name: string): string {
  const value = getComputedStyle(root()).getPropertyValue(name).trim();
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(value);
  return short ? `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}` : value;
}

/** Тема: colorScheme → data-theme. dark — «Лента», light — «Просмотровая». */
function applyColorScheme(wa: TelegramWebApp) {
  root().dataset.theme = wa.colorScheme;
  // Шапку и подложку рисует мессенджер — красим их в наши поверхности, чтобы
  // граница между его хромом и нашим экраном не читалась.
  if (wa.isVersionAtLeast('6.1')) {
    wa.setHeaderColor(readToken('--tm-color-surface-100'));
    wa.setBackgroundColor(readToken('--tm-color-surface-100'));
  }
  if (wa.isVersionAtLeast('7.10')) wa.setBottomBarColor?.(readToken('--tm-color-surface-card'));
}

/** Безопасные зоны: сумма зоны устройства и зоны интерфейса Telegram. На клиентах
 *  без Bot API 8.0 полей нет — остаётся env() из components.css. */
function applySafeArea(wa: TelegramWebApp) {
  const device = wa.safeAreaInset;
  const content = wa.contentSafeAreaInset;
  if (!device && !content) return;
  const top = (device?.top ?? 0) + (content?.top ?? 0);
  const bottom = (device?.bottom ?? 0) + (content?.bottom ?? 0);
  root().style.setProperty('--tm-safe-top', `${top}px`);
  root().style.setProperty('--tm-safe-bottom', `${bottom}px`);
}

/** Высота вьюпорта в переменной — для того, что должно знать видимую часть окна. Высоту
 *  оболочки по ней не задаём: на Android до раскрытия она бывает около 100 px. */
function applyViewport(wa: TelegramWebApp) {
  const height = wa.viewportStableHeight || wa.viewportHeight;
  if (height) root().style.setProperty('--tm-viewport-height', `${height}px`);
}

/** Поднимает мини-приложение: тема, зоны, высота, подписки. Возвращает отписку.
 *  Вне Telegram ничего не делает и возвращает пустую функцию. */
export function initTelegram(): () => void {
  const wa = webApp();
  if (!wa) return () => {};

  const onTheme = () => applyColorScheme(wa);
  const onViewport = () => applyViewport(wa);
  const onSafeArea = () => applySafeArea(wa);

  applyColorScheme(wa);
  applySafeArea(wa);
  applyViewport(wa);
  wa.onEvent('themeChanged', onTheme);
  wa.onEvent('viewportChanged', onViewport);
  wa.onEvent('safeAreaChanged', onSafeArea);
  wa.onEvent('contentSafeAreaChanged', onSafeArea);

  // Лента листается внутри оболочки; свайп вниз по документу не должен сворачивать окно.
  if (wa.isVersionAtLeast('7.7')) wa.disableVerticalSwipes?.();
  wa.expand();
  wa.ready();

  return () => {
    wa.offEvent('themeChanged', onTheme);
    wa.offEvent('viewportChanged', onViewport);
    wa.offEvent('safeAreaChanged', onSafeArea);
    wa.offEvent('contentSafeAreaChanged', onSafeArea);
  };
}

const TELEGRAM_LINK = /^(https?:\/\/(t\.me|telegram\.me|telegram\.dog)\/|tg:\/\/)/i;

/** Внешняя ссылка средствами Telegram: внутренние (t.me, tg://) — в мессенджере,
 *  остальные — во внешнем браузере. Вне Telegram — новая вкладка. */
export function openExternal(url: string) {
  const wa = webApp();
  if (!wa) {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }
  if (TELEGRAM_LINK.test(url)) wa.openTelegramLink(url);
  else wa.openLink(url);
}

/** Кнопка «Назад» в шапке мессенджера. Возвращает отписку; вне Telegram — no-op. */
export function showBackButton(onBack: () => void): () => void {
  const wa = webApp();
  if (!wa) return () => {};
  wa.BackButton.onClick(onBack);
  wa.BackButton.show();
  return () => {
    wa.BackButton.offClick(onBack);
    wa.BackButton.hide();
  };
}

/** onClick для `<a target="_blank">`: в браузере ссылка ведёт себя как ссылка (средняя
 *  кнопка, «копировать адрес» работают), внутри Telegram переход перехватывается и
 *  открывается средствами мессенджера — иначе WebView откроет его поверх приложения. */
export function onExternalClick(url: string) {
  return (event: { preventDefault(): void }) => {
    if (!isTelegram()) return;
    event.preventDefault();
    openExternal(url);
  };
}

/** Короткий отклик на действие: нажали кнопку, отметили просмотренным, отправили чек-ин.
 *  Вне Telegram и на старых клиентах — ничего не делает, звать можно откуда угодно. */
export function tap(style: 'light' | 'medium' = 'light'): void {
  webApp()?.HapticFeedback?.impactOccurred(style);
}

/** Смена выбора: переключили автора в строке, сменили фильтр. Отличается от `tap` тем,
 *  что это не действие, а перебор — и мессенджер отзывается тише. */
export function pick(): void {
  webApp()?.HapticFeedback?.selectionChanged();
}

/** Итог операции: сохранили, не смогли сохранить. */
export function outcome(type: 'success' | 'error' | 'warning'): void {
  webApp()?.HapticFeedback?.notificationOccurred(type);
}
