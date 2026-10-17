// Перезагрузка после выкладки (17.10, аудит отказоустойчивости, пп. 1–2). Открытая до выкладки вкладка
// просит чанки прошлой сборки — сервер их уже не держит, ленивый экран падает с 404. Лечится одной перезагрузкой:
// index.html отдаётся с no-cache и приведёт к новым чанкам. Защита от цикла — метка времени в sessionStorage:
// не чаще раза в 30 с; без хранилища (приватное окно) сами не перезагружаем — человеку остаётся кнопка «Обновить».

const KEY = 'tm.chunkReload';
const PAUSE_MS = 30_000;

/** Ошибка незагрузившегося чанка: тексты Chrome/Android WebView, Safari/iOS, Firefox и старого webpack-стиля. */
const CHUNK = /Failed to fetch dynamically imported module|Importing a module script failed|ChunkLoadError|error loading dynamically imported module|Unable to preload CSS/i;
export function isChunkError(error: unknown): boolean {
  const e = error as { name?: string; message?: string } | null;
  return !!e && (e.name === 'ChunkLoadError' || CHUNK.test(String(e.message ?? error)));
}

let reloading = false;
/** перезагрузка уже пошла — экрану ошибки показываться незачем, через миг страница сменится */
export const reloadPending = (): boolean => reloading;
/** Одна перезагрузка страницы. true — перезагрузка пошла (или уже идёт), false — нельзя: только что
 *  перезагружались, хранилище недоступно или нет сети (без сети перезагрузка даст страницу ошибки браузера
 *  вместо нашего экрана «нет связи»). */
export function reloadOnce(): boolean {
  if (reloading) return true;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
  try {
    const last = Number(sessionStorage.getItem(KEY) ?? 0);
    if (last && Date.now() - last < PAUSE_MS) return false;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch { return false; }
  reloading = true;
  location.reload();
  return true;
}
