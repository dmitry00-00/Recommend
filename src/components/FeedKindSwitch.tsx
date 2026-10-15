import type { FeedKind } from '@/types/tmdf';
import { cx } from '@/lib/cx';
import ui from '@/i18n';

const ORDER: FeedKind[] = ['screen', 'book'];

/** Кино или книги (11.10): что подбирает лента. Вид — как у переключателя силы рядом. */
export function FeedKindSwitch({ value, onChange }: { value: FeedKind; onChange?: (k: FeedKind) => void }) {
  return (
    <div className="tm-energy" role="radiogroup" aria-label={ui.a11y.feedKind}>
      {ORDER.map((id) => {
        const on = id === value;
        return (
          <button key={id} type="button" role="radio" aria-checked={on ? 'true' : 'false'}
                  className={cx('tm-energy__opt', on && 'tm-energy__opt--on')} onClick={() => onChange?.(id)}>
            <span className="tm-energy__tick" aria-hidden="true" />
            {ui.feed.kind[id]}
          </button>
        );
      })}
    </div>
  );
}
