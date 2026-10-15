// Последняя лента на устройстве (ДФ-3): при обрыве связи «Сегодня» открывается с ней, а не пустым экраном ошибки.
// Своя у каждого вида ленты (кино, книги) и у каждого аккаунта Telegram на устройстве.
import type { RecommendationSlate } from '@/types/tmdf';
import { deviceGet, deviceSet, webApp } from './telegram';

export interface CachedSlate { at: string; slate: RecommendationSlate }

const key = (kind: string) => `tm.lastSlate.${webApp()?.initDataUnsafe?.user?.id ?? 'web'}.${kind}`;

export function saveSlate(kind: string, slate: RecommendationSlate): void {
  if (slate.coldStart || !slate.items.length) return;
  try { deviceSet(key(kind), JSON.stringify({ at: new Date().toISOString(), slate })); } catch { /* не сериализуется — без кэша */ }
}

export async function lastSlate(kind: string): Promise<CachedSlate | undefined> {
  const raw = await deviceGet(key(kind));
  if (!raw) return undefined;
  try {
    const c = JSON.parse(raw) as CachedSlate;
    return Array.isArray(c?.slate?.items) && c.slate.items.length ? c : undefined;
  } catch { return undefined; }
}
