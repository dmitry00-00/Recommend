import type { Eagerness } from '@/types/tmdf';
import { cx } from '@/lib/cx';

/** Оценка рядом звёзд: сколько горит, такая и оценка. Погасшие не рисуем — ряд растёт вместе
 *  с оценкой, и его длина сама по себе показатель, а под пальцем на свайпе места мало. Цифра
 *  рядом — чтобы не пересчитывать каждый раз, цвет — чтобы края шкалы различались боковым
 *  зрением: серое «так себе», синее «ничего», золотое «хочу». */
export function StarScale({ value, caption, className }: { value: Eagerness; caption?: string; className?: string }) {
  return (
    <span className={cx('tm-stars', `tm-stars--${value}`, className)}>
      <span className="tm-stars__line">
        <span className="tm-stars__row" aria-hidden="true">{'★'.repeat(value)}</span>
        <span className="tm-stars__num">{value}</span>
      </span>
      {caption ? <span className="tm-stars__cap">{caption}</span> : null}
    </span>
  );
}
