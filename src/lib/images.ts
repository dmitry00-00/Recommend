import { useCallback, useEffect, useRef, useState } from 'react';
import { apiBase, onServer } from '@/api/store';

/** Обложки Open Library — через свой сервер (книжный трек, 11.10). covers.openlibrary.org отдаёт старые обложки
 *  перенаправлением в хранилище Internet Archive: у 333 из 371 книги оно отвечало десятки секунд или не отвечало
 *  вовсе, а в России archive.org бывает закрыт. Сервер берёт обложку один раз и дальше отдаёт сам
 *  (`/api/cover/<id>`, worker/index.ts). Без сервера — прямая ссылка, как было. */
const OPEN_LIBRARY = /^https:\/\/covers\.openlibrary\.org\/b\/id\/(\d{1,10})-[SML]\.jpg$/;

/** Картинки TMDb (ДФ-4, 14.10) — через свой сервер: `/img/tmdb/<размер>/<файл>` (server/index.js, кеш на диске,
 *  immutable на год). Только когда страницу отдал наш сервер: API на том же адресе (`VITE_API_URL=/`) и страница по
 *  http(s). Из файла (standalone, file://) и в dev без сервера — напрямую в image.tmdb.org, как раньше. */
const TMDB = /^https:\/\/image\.tmdb\.org\/t\/p\/(w\d+|original)\/([A-Za-z0-9]{1,64}\.(?:jpg|png|webp))$/;
const TMDB_SIZES = [92, 185, 342, 500, 780] as const;
const viaServer = onServer && apiBase === '' && typeof location !== 'undefined' && /^https?:$/.test(location.protocol);

/** Кадры Кинопоиска (avatars.mds.yandex.net/get-ott/…/orig) — оригинал до 3 МБ: на «Медленном 4G» один такой кадр
 *  в первом баннере грузился 20 с. У того же адреса есть готовые уменьшенные копии — берём их (проверено на всех 106
 *  кадрах из моков 14.10). Сервис российский, ходить к нему напрямую можно. */
const KP_OTT = /^(https:\/\/avatars\.mds\.yandex\.net\/get-ott\/\d+\/[0-9a-f]+)\/orig$/;

/** Нужная ширина: w780 — баннер во всю ширину, w342 — миниатюра кадра в строке, w185 — постер в строке, лицо. */
export type ImageWidth = 'w185' | 'w342' | 'w780';

/** Адрес картинки для отрисовки: свой сервер вместо чужого, где он есть, и не больше нужного размера. `width` только
 *  уменьшает: сохранённый w342 баннеру не превратится в w780. */
export const imageSrc = (url?: string, width?: ImageWidth): string | undefined => {
  if (!url) return url;
  const ol = onServer ? OPEN_LIBRARY.exec(url) : null;
  if (ol) return `${apiBase}/api/cover/${ol[1]}`;
  const tm = TMDB.exec(url);
  if (tm) {
    const want = width ? Number(width.slice(1)) : Infinity;
    const have = tm[1] === 'original' ? Infinity : Number(tm[1].slice(1));
    let size = tm[1];
    if (want < have) size = `w${want}`;
    // размер вне белого списка сервера (original, w300…) — ближайший из списка не меньше нужного
    else if (viaServer && !(TMDB_SIZES as readonly number[]).includes(have)) size = `w${TMDB_SIZES.find((s) => s >= Math.min(want, have)) ?? 780}`;
    return viaServer ? `/img/tmdb/${size}/${tm[2]}` : `https://image.tmdb.org/t/p/${size}/${tm[2]}`;
  }
  const kp = KP_OTT.exec(url);
  if (kp) return `${kp[1]}/${width === 'w780' || !width ? '1344x756' : '672x378'}`;
  return url;
};

/** Тихий повтор (ДФ-4): картинка оборвалась — через секунду пробуем ещё раз с меткой в адресе (иначе браузер вернёт
 *  ту же ошибку), не вышло и тогда — `failed`, и компонент рисует свою заглушку. На новый адрес счёт заново. */
export function useImageRetry(src?: string): { src?: string; failed: boolean; onError: () => void; ref: (img: HTMLImageElement | null) => void } {
  const [state, setState] = useState<{ of?: string; tries: number }>({ of: src, tries: 0 });
  const tries = state.of === src ? state.tries : 0;
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), [src]);
  const onError = useCallback(() => {
    if (tries >= 1) { setState({ of: src, tries: 2 }); return; }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState({ of: src, tries: 1 }), 1000);
  }, [src, tries]);
  // Отказ, пришедший раньше, чем React подключил картинку (заблокированный или сразу оборванный адрес, пока длинный
  // список ещё рисуется), до onError не доходит: событие элемента, которого ещё нет в дереве, React теряет. Найдено
  // 14.10 (ТВ-10): битые обложки на страницах героя и автора так и оставались значком. Поэтому при подключении
  // смотрим сами: загрузка закончилась, а картинки нет — это та же ошибка.
  const ref = useCallback((img: HTMLImageElement | null) => {
    if (img?.complete && img.naturalWidth === 0 && img.getAttribute('src')) onError();
  }, [onError]);
  if (!src || tries >= 2) return { src: undefined, failed: Boolean(src), onError, ref };
  return { src: tries === 1 ? `${src}${src.includes('?') ? '&' : '?'}retry=1` : src, failed: false, onError, ref };
}
