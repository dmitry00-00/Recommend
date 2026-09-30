import type { CSSProperties, ReactNode } from 'react';
import type { WorkCard } from '@/types/tmdf';
import { opVar } from '@/lib/operations';
import { cx } from '@/lib/cx';
import ru from '@/i18n/ru';
import { isSeries } from '@/lib/media';

export interface WorkBannerProps {
  work: WorkCard;
  /** строка под названием: год и что угодно ещё словами */
  meta?: ReactNode;
  /** 'md' — лента, 'sm' — архив */
  size?: 'md' | 'sm';
  expanded?: boolean;
  /** подпись справа сверху: «следующий кадр», «завершено» */
  tag?: string;
  onClick?: () => void;
}

/** Фильм баннером во всю ширину: кадр (или обложка) под названием и годом, снизу —
 *  затемнение, чтобы текст читался на любом кадре. Без картинки — тёмный баннер с кромкой
 *  цвета главной операции, как у рамки кадра. Тап раскрывает подробности под баннером.
 *  Компонента в дизайн-системе нет (21.09, решение владельца продукта). */
export function WorkBanner({ work, meta, size = 'md', expanded, tag, onClick }: WorkBannerProps) {
  const image = work.stillUrl ?? work.coverUrl;
  const op = work.primaryOperations[0]?.op ?? 'synthesis';
  const style = { '--banner-line': opVar(op) } as CSSProperties;
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag type={onClick ? 'button' : undefined}
         className={cx('tm-banner', `tm-banner--${size}`, image && 'tm-banner--image', expanded && 'tm-banner--open')}
         style={style} onClick={onClick} aria-expanded={onClick ? (expanded ? 'true' : 'false') : undefined}>
      {image ? <img className="tm-banner__img" src={image} alt="" loading="lazy" decoding="async" /> : null}
      <span className="tm-banner__scrim" aria-hidden="true" />
      {tag ? <span className="tm-banner__tag">{tag}</span> : null}
      <span className="tm-banner__text">
        <span className="tm-banner__title">{work.title}</span>
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
  const kind = isSeries(work) ? ru.edge.series : work.type === 'book' ? ru.edge.book : ru.edge.film;
  const rest = short ? [work.year] : [kind, work.year, work.durationMinutes ? ru.edge.min(work.durationMinutes) : null];
  return (
    <span className="tm-edge" aria-hidden="true">
      <span><span className="tm-edge__no">{ru.edge.no(no)}</span>{rest.filter(Boolean).map((x) => ` · ${x}`).join('')}</span>
    </span>
  );
}
