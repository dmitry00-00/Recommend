import { useSyncExternalStore } from 'react';
import type { UserSettings } from '@/types/tmdf';
import { getSettings, updateSettings } from '@/api';

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
  pending ??= getSettings().then((s) => { current = s; emit(); return s; }).finally(() => { pending = null; });
  return pending;
}

export async function saveSettings(patch: Partial<UserSettings>): Promise<UserSettings> {
  const next = await updateSettings(patch);
  current = next;
  emit();
  return next;
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const snapshot = () => current;

export function useSettings(): UserSettings | null {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/** Показывать ли механику. До загрузки настроек — нет: экран не должен мигать чипами. */
export function useMechanics(): boolean {
  return useSettings()?.showDetails ?? false;
}
