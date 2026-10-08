import { useState } from 'react';

/** Фото героя или актёра; не загрузилось (TMDb и Commons бывают недоступны) — первая буква имени,
 *  а не пустая рамка со значком битой картинки. Страницы героя и автора. */
export function Face({ src, name, alt = '' }: { src: string; name: string; alt?: string }) {
  const [broken, setBroken] = useState(false);
  if (broken) return <span className="tm-hero__noface" aria-hidden="true">{name.trim().charAt(0).toUpperCase()}</span>;
  return <img src={src} alt={alt} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setBroken(true)} />;
}
