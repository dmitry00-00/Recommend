import { createContext, useContext, useSyncExternalStore } from 'react';

/** «Читать со спойлерами» (19.10, первый отзыв тестера): разборы одного произведения открываются, не отмечая его
 *  просмотренным, — оно остаётся в подборе. Помним на этом устройстве (localStorage), список — не больше 500 последних;
 *  хранилище недоступно — открыто до конца сеанса. */
const KEY = 'tm.spoilersOk';
const LIMIT = 500;

let ids: string[] | undefined;
const listeners = new Set<() => void>();

function read(): string[] {
  if (ids) return ids;
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? '[]'); ids = Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []; } catch { ids = []; }
  return ids;
}

export function allowSpoilers(workId: string): void {
  const now = read().filter((x) => x !== workId);
  now.push(workId);
  ids = now.slice(-LIMIT);
  try { localStorage.setItem(KEY, JSON.stringify(ids)); } catch { /* только на сеанс */ }
  for (const l of listeners) l();
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

/** Открыты ли спойлеры у этого произведения. */
export function useSpoilersOk(workId?: string): boolean {
  return useSyncExternalStore(subscribe, () => (workId ? read().includes(workId) : false), () => false);
}

/** Кнопка «Читать со спойлерами» у замка разбора: что открыть и как назвать замок (фильм или книга). */
export interface SpoilerUnlock { unlock: () => void; kind: 'film' | 'series' | 'book' }
export const SpoilerUnlockContext = createContext<SpoilerUnlock | null>(null);
export const useSpoilerUnlock = () => useContext(SpoilerUnlockContext);
