import { Link } from 'react-router-dom';
import type { CoMention } from '@/types/tmdf';
import ui from '@/i18n';

export interface CoMentionListProps {
  items: CoMention[];
  /** сколько показывать: в карточке хватает пяти */
  limit?: number;
}

/** «Рядом называют» — кого упоминают в одном посте с этим произведением. Это не похожесть и
 *  не рекомендация: так говорят о кино. Подпись обязана это сказать, иначе строка читается
 *  как «похожее», а она чаще означает «тот же автор» или «тот же наградной сезон». */
export function CoMentionList({ items, limit = 5 }: CoMentionListProps) {
  if (!items.length) return null;
  return (
    <section className="tm-nearby">
      <h3 className="tm-title-3 tm-nearby__title">{ui.nearby.title}</h3>
      <p className="tm-body-sm tm-nearby__why">{ui.nearby.why}</p>
      <ul className="tm-nearby__list">
        {items.slice(0, limit).map((c) => (
          <li key={c.key} className="tm-nearby__item">
            <Link to={`/works/${c.workId}`} className="tm-link--plain">{c.title}</Link>
            {c.year ? <span className="tm-nearby__year">{` ${c.year}`}</span> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
