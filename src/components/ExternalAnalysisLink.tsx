import type { ExternalAnalysis, SpoilerLevel } from '@/types/tmdf';
import { Meta } from './Meta';
import { onExternalClick } from '@/lib/telegram';
import { cx } from '@/lib/cx';
import { formatDuration } from '@/lib/format';
import ru from '@/i18n/ru';

export interface ExternalAnalysisLinkProps {
  analysis: ExternalAnalysis;
  /** допустимый уровень спойлеров: разбор выше него закрыт до завершения */
  spoilerLevel?: SpoilerLevel;
}

/** Разбор другого автора: ссылка наружу с честной метой — кто, где, на каком языке,
 *  со спойлерами ли. Закрытая ссылка остаётся на месте, чтобы было видно, что откроется.
 *  Если у разбора есть превью (кадр ролика), оно показывается: стопка одинаковых
 *  прямоугольников читается как заглушка, кадр — как материал (замечание владельца 22.09).
 *  У закрытого превью поверх штриховка — видно, что там что-то есть, но не видно что. */
export function ExternalAnalysisLink({ analysis: a, spoilerLevel }: ExternalAnalysisLinkProps) {
  const blocked = spoilerLevel != null && a.spoilerLevel > spoilerLevel;
  return (
    <a
      className={cx('tm-extlink', a.previewUrl && 'tm-extlink--preview', blocked && 'tm-extlink--blocked')}
      href={blocked ? undefined : a.url}
      rel="noreferrer noopener"
      target="_blank"
      aria-disabled={blocked ? 'true' : undefined}
      onClick={blocked ? (e) => e.preventDefault() : onExternalClick(a.url)}
    >
      {a.previewUrl ? (
        <span className="tm-extlink__thumb">
          <img className="tm-extlink__img" src={a.previewUrl} alt="" loading="lazy" />
          {blocked ? <span className="tm-extlink__hatch" aria-hidden="true" /> : null}
        </span>
      ) : null}
      <span className="tm-extlink__title">{a.title}</span>
      <Meta items={[
        a.author,
        a.durationMinutes ? formatDuration(a.durationMinutes) : ru.platform[a.platform],
        // рубрика канала: «#спгс» объясняет, что это за пост, короче любого нашего описания
        a.tags?.length ? `#${a.tags[0]}` : undefined,
        a.language === 'ru' ? ru.lang.ru : ru.lang.en,
        a.spoilerLevel > 0 ? ru.spoilers.with : ru.spoilers.without,
      ]} />
      {blocked ? <span className="tm-extlink__lock">{ru.spoiler.lockedAnalysis}</span> : null}
    </a>
  );
}
