import { imageSrc, useImageRetry } from '@/lib/images';

/** Фото героя или актёра; не загрузилось (TMDb и Commons бывают недоступны) — первая буква имени,
 *  а не пустая рамка со значком битой картинки. Страницы героя и автора. Фото TMDb — через свой сервер, после
 *  одного тихого повтора (ДФ-4). */
export function Face({ src, name, alt = '' }: { src: string; name: string; alt?: string }) {
  const img = useImageRetry(imageSrc(src, 'w185'));
  if (!img.src) return <span className="tm-hero__noface" aria-hidden="true">{name.trim().charAt(0).toUpperCase()}</span>;
  return <img ref={img.ref} src={img.src} alt={alt} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={img.onError} />;
}
