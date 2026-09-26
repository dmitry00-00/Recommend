import type { TropeMention } from '@/types/tmdf';
import ru from '@/i18n/ru';

export interface TropeMentionListProps {
  items: TropeMention[];
}

/** Приёмы, отмеченные на TV Tropes. Не `TropeInsight`: там утверждение о том, как приём
 *  работает в произведении, а здесь только «на вики он у фильма отмечен». Разница
 *  принципиальная, поэтому и вид другой — список со ссылками, без операций и без «как
 *  использован», и с оговоркой, что человеком это не подтверждено. */
export function TropeMentionList({ items }: TropeMentionListProps) {
  if (!items.length) return null;
  return (
    <ul className="tm-tropemention">
      {items.map((t) => (
        <li key={t.tropeId} className="tm-tropemention__item">
          <a className="tm-tropemention__name" href={t.url} target="_blank" rel="noreferrer noopener">
            {t.name}
            <span className="tm-sr">{ru.tropeMentions.linkNote}</span>
          </a>
          <span className="tm-tropemention__text">{t.explanation}</span>
        </li>
      ))}
    </ul>
  );
}
