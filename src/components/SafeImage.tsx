import type { ImgHTMLAttributes, ReactNode } from 'react';
import { useImageRetry } from '@/lib/images';

/** Картинка без значка битой ссылки (15.10, хвост ТВ-10): тот же тихий повтор, что у обложек
 *  (`useImageRetry`), а не вышло и тогда — `fallback` (по умолчанию ничего: виден фон кадра). */
export function SafeImage({ src, fallback = null, ...rest }: Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'onError'> & { src?: string; fallback?: ReactNode }) {
  const img = useImageRetry(src);
  return img.src ? <img {...rest} ref={img.ref} src={img.src} onError={img.onError} /> : <>{fallback}</>;
}
