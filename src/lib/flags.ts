import { useRole, useSettings } from './settingsStore';
import { webApp } from './telegram';

/** Поэтапный выкат (ТВ-3в, 06.10): новое в интерфейсе сначала видит доля людей, остальные —
 *  прежнее, и поведение сравнивается. Доля — здесь, в сборке: поменять её — выложить новую.
 *  Кто попал в долю, решает хэш id в Telegram и имени флага: один и тот же человек всегда в
 *  одной группе, а у разных флагов группы разные. Ручной переключатель в настройках (только
 *  у владельца) сильнее доли — им проверяют интерфейс до выката. */
export const ROLLOUT = {
  /** полки рубрик в карточке (ТВ-3г). Этап 0–1: никому — рубрики только в данных и в замере */
  lensShelves: 0,
} as const;
export type Flag = keyof typeof ROLLOUT;

/** Число 0…1 из id человека и имени флага (FNV-1a): стабильно между запусками и устройствами. */
export function bucket(userId: string | number, flag: string): number {
  let h = 0x811c9dc5;
  for (const ch of `${flag}:${userId}`) { h ^= ch.codePointAt(0)!; h = Math.imul(h, 0x01000193) >>> 0; }
  return h / 0x100000000;
}

export function inRollout(flag: Flag, userId = webApp()?.initDataUnsafe?.user?.id): boolean {
  const share = ROLLOUT[flag];
  if (share <= 0 || userId == null) return false;
  return share >= 1 || bucket(userId, flag) < share;
}

/** Полки рубрик: тестеру — всегда; админу — по умолчанию да, переключатель в настройках выключает;
 *  участнику — доля выката. До загрузки настроек — нет, чтобы карточка не мигала полками. */
export function useLensShelves(): boolean {
  const s = useSettings();
  const role = useRole();
  if (!s) return false;
  if (role === 'tester') return true;
  return s.lensShelves ?? (role === 'admin' || inRollout('lensShelves'));
}
