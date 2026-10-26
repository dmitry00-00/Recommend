import type { WorkCard } from '@/types/tmdf';

/** Обложки следом (25.10, аудит карточек сущностей): страница голоса и героя не ждёт TMDb (до 6 с) — показывается
 *  со своими картинками, а пришедшие карточки (`got`, по id) подменяются во всех местах данных страницы: в списке,
 *  в «с чего начать», в «кто играл». Не тронутое — те же объекты, React перерисует только изменённое. */
export function swapWorks<T>(x: T, got: Map<string, WorkCard>): T {
  if (Array.isArray(x)) {
    let changed = false;
    const out = x.map((v) => { const n = swapWorks(v, got); if (n !== v) changed = true; return n; });
    return (changed ? out : x) as T;
  }
  if (x && typeof x === 'object') {
    const o = x as Record<string, unknown>;
    if (typeof o.id === 'string' && typeof o.type === 'string' && 'title' in o) return (got.get(o.id) ?? x) as T;
    let changed = false;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(o)) { const n = swapWorks(v, got); out[k] = n; if (n !== v) changed = true; }
    return (changed ? out : x) as T;
  }
  return x;
}
