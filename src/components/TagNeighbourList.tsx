import { Link } from 'react-router-dom';
import type { TagNeighbour } from '@/types/tmdf';
import ru from '@/i18n/ru';

export interface TagNeighbourListProps {
  items: TagNeighbour[];
  /** сколько показывать: в карточке хватает пяти */
  limit?: number;
}

/** «Описывают похоже» — кому зрители MovieLens приписывают те же теги. Стоит рядом с «рядом
 *  называют» намеренно: один список про то, как о кино говорят русские каналы, другой — как
 *  его описывают англоязычные зрители, и расхождение между ними само по себе говорящее.
 *  Подпись обязана назвать источник: лицензия Tag Genome требует указания авторства. */
export function TagNeighbourList({ items, limit = 5 }: TagNeighbourListProps) {
  if (!items.length) return null;
  return (
    <section className="tm-tagnear">
      <h3 className="tm-title-3 tm-tagnear__title">{ru.tagNeighbours.title}</h3>
      <p className="tm-body-sm tm-tagnear__why">{ru.tagNeighbours.why}</p>
      <ul className="tm-tagnear__list">
        {items.slice(0, limit).map((t) => (
          <li key={t.key} className="tm-tagnear__item">
            <Link to={`/works/${t.workId}`} className="tm-link--plain">{t.title}</Link>
            {t.year ? <span className="tm-tagnear__year">{` ${t.year}`}</span> : null}
          </li>
        ))}
      </ul>
      <p className="tm-caption tm-tagnear__credit">{ru.tagNeighbours.credit}</p>
    </section>
  );
}
