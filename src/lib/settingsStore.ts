import { useSyncExternalStore } from 'react';
import type { UserSettings } from '@/types/tmdf';
import { getSettings, sessionRole, updateSettings, type Role } from '@/api';
import { applyTheme } from './theme';
import { chosenLanguage, language, switchLanguage } from '@/i18n';

/** Настройки участника, общие для всех экранов: один запрос при старте, дальше — кэш.
 *  `showDetails` здесь значит «показывать механику»: операции мышления, уровни, карту и
 *  что на ней меняется. По умолчанию выключено — подбор и маршруты работают молча, а
 *  снаружи остаются кадр, объяснение словами, разборы авторов и места разговора (21.09). */
let current: UserSettings | null = null;
let pending: Promise<UserSettings> | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function loadSettings(): Promise<UserSettings> {
  if (current) return Promise.resolve(current);
  // тема из настроек — сразу при старте (ТВ-10): раньше она применялась только на экране
  // настроек, и после перезапуска выбранная «Светлая» снова становилась тёмной
  pending ??= getSettings().then((s) => { current = s; if (s.theme) applyTheme(s.theme); syncLanguage(s); emit(); return s; }).finally(() => { pending = null; });
  return pending;
}

/** Язык (ЗП-20): выбор на этом устройстве — главнее и уходит на сервер; своего выбора нет, а на сервере
 *  английский (выбран на другом устройстве; по умолчанию там русский) — переключаемся. */
function syncLanguage(s: UserSettings) {
  const own = chosenLanguage();
  if (own && own !== s.language) updateSettings({ language: own }).then((next) => { current = next; emit(); }).catch(() => undefined);
  else if (!own && s.language === 'en' && language !== 'en') switchLanguage('en');
}

export async function saveSettings(patch: Partial<UserSettings>): Promise<UserSettings> {
  const next = await updateSettings(patch);
  current = next;
  if (patch.theme) applyTheme(next.theme);
  emit();
  // словарь выбирается при запуске — новый язык вступает через перезапуск
  if (patch.language) switchLanguage(next.language);
  return next;
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const snapshot = () => current;

export function useSettings(): UserSettings | null {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/** Подробный дневник или облегчённый учёт (02.10). До загрузки — облегчённый. */
export function useDiary(): boolean {
  return useSettings()?.diary ?? false;
}

/** Категория участника (ТВ-3в). До загрузки настроек — undefined: профиль приходит вместе с ними,
 *  и экран только для админа не должен успеть выгнать админа. */
export function useRole(): Role | undefined {
  return useSettings() ? sessionRole() : undefined;
}

/** Показывать ли механику. До загрузки настроек — нет: экран не должен мигать чипами. Не админу —
 *  всегда нет (getSettings отдаёт выключенной). */
export function useMechanics(): boolean {
  return useSettings()?.showDetails ?? false;
}
