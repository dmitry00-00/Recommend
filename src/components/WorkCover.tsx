import type { CSSProperties } from 'react';
import type { WorkCard } from '@/types/tmdf';
import { opVar } from '@/lib/operations';
import { seedOf, titleOf } from '@/lib/format';
import { cx } from '@/lib/cx';
import { imageSrc, useImageRetry } from '@/lib/images';

export interface WorkCoverProps {
  work: WorkCard;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/** Кадр плёнки вместо постера: рамка, название, год, номер кадра, кромка главной операции.
 *  Если у произведения есть кадр (TMDb) или обложка (Open Library), он ложится в рамку под
 *  название; без него рамка остаётся пустой — это тоже по замыслу системы. Стиль слоя
 *  `.tm-cover__still` пока в `app.css`: в системе варианта с изображением нет. */
export function WorkCover({ work, size = 'md', className }: WorkCoverProps) {
  const seed = seedOf(work.title + work.year);
  const op = work.primaryOperations[0]?.op ?? 'synthesis';
  const width = size === 'lg' ? 196 : size === 'sm' ? 84 : 124;
  const height = Math.round(width * (size === 'sm' ? 1.26 : 1.3));
  const style = { width, height, '--cover-line': opVar(op) } as CSSProperties;
  // кадр под названием: не загрузился и после повтора — рамка пустая, как без картинки
  const still = useImageRetry(imageSrc(work.stillUrl ?? work.coverUrl, 'w780'));
  return (
    <div className={cx('tm-cover', `tm-cover--${size}`, `tm-cover--${work.type}`, className)}
         style={style} role="img" aria-label={`${titleOf(work)}, ${work.year}`}>
      {still.src ? (
        <img ref={still.ref} className="tm-cover__still" src={still.src} alt="" loading="lazy" decoding="async" onError={still.onError} />
      ) : null}
      {size === 'lg' ? (
        <span className="tm-cover__edge" aria-hidden="true">
          {Array.from({ length: 9 }, (_, i) => <span key={i} className="tm-cover__hole" />)}
        </span>
      ) : null}
      <span className="tm-cover__title">{titleOf(work)}</span>
      <span className="tm-cover__foot">
        <span>{work.year}</span>
        {size !== 'sm' ? (
          <span className="tm-cover__frameno">{(seed % 90) + 10}{seed % 3 ? 'A' : 'B'}</span>
        ) : null}
      </span>
    </div>
  );
}
