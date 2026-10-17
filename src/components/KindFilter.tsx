import type { FeedKind } from '@/types/tmdf';
import { pick } from '@/lib/telegram';
import { GLYPHS } from './FeedKindSwitch';
import ui from '@/i18n';

const ORDER: (FeedKind | null)[] = [null, 'screen', 'book'];

/** Фильтр рода в списках (17.10) — в духе FeedKindSwitch: одна кнопка со значком показывает, что видно сейчас, нажатие —
 *  следующее по кругу: «Кино и книги» → «Кино» → «Книги». Ряд из трёх чипов на его месте был громоздким. */
export function KindFilter({ value, onChange }: { value: FeedKind | null; onChange: (k: FeedKind | null) => void }) {
  const next = ORDER[(ORDER.indexOf(value) + 1) % ORDER.length];
  const label = value ? ui.feed.kind[value] : ui.journal.kindAll;
  return (
    <div className="tm-energy tm-kind tm-kindf">
      <button type="button" className="tm-energy__opt tm-energy__opt--on tm-kind__opt"
              aria-label={`${ui.journal.filterKind}: ${label}`} onClick={() => { pick(); onChange(next); }}>
        {value ? (
          <svg key={value} className="tm-kind__glyph" width={20} height={20} viewBox="0 0 20 20" aria-hidden="true">
            {GLYPHS[value].map((d, i) => (
              <path key={i} d={d} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
            ))}
          </svg>
        ) : null}
        {label}
      </button>
    </div>
  );
}
