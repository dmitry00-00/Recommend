import type { CSSProperties, ReactNode } from 'react';
import type { WorkCard } from '@/types/tmdf';
import { opVar } from '@/lib/operations';
import { cx } from '@/lib/cx';
import ui from '@/i18n';
import { isSeries } from '@/lib/media';
import { titleOf } from '@/lib/format';
import { imageSrc, useImageRetry } from '@/lib/images';

export interface WorkBannerProps {
  work: WorkCard;
  /** строка под названием: год и что угодно ещё словами */
  meta?: ReactNode;
  /** 'md' — лента, 'sm' — архив */
  size?: 'md' | 'sm';
  expanded?: boolean;
  /** подпись справа сверху: «следующий шаг», «завершено» */
  tag?: string;
  /** подпись строкой над названием, а не в углу: в шторке верх кадра занят кнопками */
  tagAbove?: boolean;
  onClick?: () => void;
  /** первый баннер ленты (ДФ-21): это и есть LCP — грузим сразу и первым, а не лениво */
  priority?: boolean;
}

/** Фильм баннером во всю ширину: кадр (или обложка) под названием и годом, снизу —
 *  затемнение, чтобы текст читался на любом кадре. Без картинки — тёмный баннер с кромкой
 *  цвета главной операции, как у рамки кадра. Тап раскрывает подробности под баннером.
 *  Компонента в дизайн-системе нет (21.09, решение владельца продукта). */
export function WorkBanner({ work, meta, size = 'md', expanded, tag, tagAbove, onClick, priority }: WorkBannerProps) {
  // картинка не загрузилась и после тихого повтора (ДФ-4) — баннер без кадра, а не значок битой ссылки (ТВ-10)
  const { src: image, onError, ref } = useImageRetry(imageSrc(work.stillUrl ?? work.coverUrl, 'w780'));
  // книга (11.10): обложка вертикальная — во всю ширину от неё осталась бы полоса из середины. Обложка целиком
  // справа, под ней та же обложка размытым фоном
  const book = Boolean(image && !work.stillUrl && work.type === 'book');
  const op = work.primaryOperations[0]?.op ?? 'synthesis';
  const style = { '--banner-line': opVar(op) } as CSSProperties;
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag type={onClick ? 'button' : undefined}
         className={cx('tm-banner', `tm-banner--${size}`, image && 'tm-banner--image', book && 'tm-banner--book', expanded && 'tm-banner--open')}
         style={style} onClick={onClick} aria-expanded={onClick ? (expanded ? 'true' : 'false') : undefined}>
      {image ? <img ref={ref} className="tm-banner__img" src={image} alt="" loading={priority ? 'eager' : 'lazy'} decoding="async"
                        fetchPriority={priority ? 'high' : undefined} onError={onError} /> : null}
      <span className="tm-banner__scrim" aria-hidden="true" />
      {book ? <img className="tm-banner__cover" src={image} alt="" loading={priority ? 'eager' : 'lazy'} decoding="async" fetchPriority={priority ? 'high' : undefined} /> : null}
      {tag && !tagAbove ? <span className="tm-banner__tag">{tag}</span> : null}
      <span className="tm-banner__text">
        {tag && tagAbove ? <span className="tm-banner__tag tm-banner__tag--above">{tag}</span> : null}
        <span className="tm-banner__title">{titleOf(work)}</span>
        <span className="tm-banner__meta">{meta ?? work.year}</span>
      </span>
    </Tag>
  );
}

/** Надпечатка по кромке плёнки (28.09, вариант Б из сравнения «Лента на плёнке»): номер кадра,
 *  тип, год, длина — одним форматом для всех медиа. Живёт в дорожке `.tm-filmstrip` слева от
 *  кадра и при свайпе остаётся на месте — уезжает кадр, а не плёнка. Для экранного диктора
 *  скрыта: всё это уже есть в строке под названием. `short` — для низких баннеров архива. */
export function FilmEdge({ work, no, short }: { work: WorkCard; no: number; short?: boolean }) {
  const kind = isSeries(work) ? ui.edge.series : work.type === 'book' ? ui.edge.book : ui.edge.film;
  const rest = short ? [work.year] : [kind, work.year, work.durationMinutes ? ui.edge.min(work.durationMinutes) : null];
  return (
    <span className="tm-edge" aria-hidden="true">
      <span><span className="tm-edge__no">{ui.edge.no(no)}</span>{rest.filter(Boolean).map((x) => ` · ${x}`).join('')}</span>
    </span>
  );
}
