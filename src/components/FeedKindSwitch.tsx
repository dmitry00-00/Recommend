import type { FeedKind } from '@/types/tmdf';
import { cx } from '@/lib/cx';
import ui from '@/i18n';

/** Значки в духе нижнего меню: кадр плёнки и раскрытая книга, обводкой 20×20. */
export const GLYPHS: Record<FeedKind, string[]> = {
  screen: ['M3.5 4.5h13v11h-13z', 'M6.5 4.5v11', 'M13.5 4.5v11', 'M3.5 8h3', 'M3.5 12h3', 'M13.5 8h3', 'M13.5 12h3'],
  book: ['M10 5.8C8.2 4.6 6.2 4.1 3.8 4.2v11c2.4-.1 4.4.4 6.2 1.6', 'M10 5.8c1.8-1.2 3.8-1.7 6.2-1.6v11c-2.4-.1-4.4.4-6.2 1.6', 'M10 5.8v11'],
};

/** Кино или книги (11.10): что подбирает лента. 17.10 (владелец): одна кнопка-тоггл со значком вместо пары —
 *  показывает, что подбирается сейчас; нажатие переключает на другое. */
export function FeedKindSwitch({ value, onChange }: { value: FeedKind; onChange?: (k: FeedKind) => void }) {
  const next: FeedKind = value === 'book' ? 'screen' : 'book';
  return (
    <div className="tm-energy tm-kind">
      <button type="button" className={cx('tm-energy__opt', 'tm-energy__opt--on', 'tm-kind__opt')}
              aria-label={`${ui.a11y.feedKind}: ${ui.feed.kind[value]}`} onClick={() => onChange?.(next)}>
        <svg key={value} className="tm-kind__glyph" width={20} height={20} viewBox="0 0 20 20" aria-hidden="true">
          {GLYPHS[value].map((d, i) => (
            <path key={i} d={d} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
          ))}
        </svg>
        {ui.feed.kind[value]}
      </button>
    </div>
  );
}
