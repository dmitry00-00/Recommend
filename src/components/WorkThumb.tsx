import type { CSSProperties } from 'react';
import type { WorkCard } from '@/types/tmdf';
import { opVar } from '@/lib/operations';
import { titleOf } from '@/lib/format';
import { imageSrc, useImageRetry } from '@/lib/images';

/** Миниатюра произведения в строке списка (поиск, оценки, автор, человек, герой, вселенная).
 *  Без картинки — кадр-заглушка с перфорацией и первой буквой названия (ТВ-10, 06.10): пустая
 *  плитка в плёночном дизайне читалась как поломка. Само название стоит рядом в строке, повторять
 *  его внутри рамки незачем. Картинка не загрузилась — та же заглушка, а не значок битой ссылки (ДФ-4: после
 *  одного тихого повтора). Рамка 56×74: кадру хватает w342, постеру — w185. */
export function WorkThumb({ work }: { work: Pick<WorkCard, 'title' | 'stillUrl' | 'coverUrl' | 'primaryOperations'> }) {
  const { src, failed, onError, ref } = useImageRetry(work.stillUrl ? imageSrc(work.stillUrl, 'w342') : imageSrc(work.coverUrl, 'w185'));
  const letter = [...titleOf(work).replace(/[^\p{L}\p{N}]/gu, '')][0]?.toUpperCase() ?? '·';
  return (
    <span className="tm-search__thumb" style={{ '--thumb-line': opVar(work.primaryOperations?.[0]?.op ?? 'synthesis') } as CSSProperties}>
      {src && !failed
        ? <img ref={ref} src={src} alt="" loading="lazy" decoding="async" draggable={false} onError={onError} />
        : <span className="tm-search__thumbph" aria-hidden="true">{letter}</span>}
    </span>
  );
}
