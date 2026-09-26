import type { DiscussionPlace } from '@/types/tmdf';
import { Meta } from './Meta';
import { onExternalClick } from '@/lib/telegram';
import ru from '@/i18n/ru';

export interface DiscussionLinkProps {
  discussion: DiscussionPlace;
  /** до завершения — закрыто: в живом разговоре спойлеры неизбежны */
  locked?: boolean;
}

/** Маршрут в живой разговор: ссылка ведёт в конкретное место, рядом — «зачем идти»
 *  и когда там об этом говорили. Настоящее время не обещаем. */
export function DiscussionLink({ discussion: d, locked }: DiscussionLinkProps) {
  const body = (
    <>
      <span className="tm-disc__kind">{ru.discussionKind[d.kind] ?? ru.discussionKind.other}</span>
      <span className="tm-disc__title">{d.title}</span>
      <p className="tm-disc__why">{d.why}</p>
      <Meta items={[
        d.lastTalkedAt ? ru.discussion.talked + d.lastTalkedAt : null,
        d.language === 'ru' ? ru.lang.ru : ru.lang.en,
        d.spoilers ? ru.spoilers.with : ru.spoilers.without,
        d.curatedBy ? ru.discussion.broughtBy + d.curatedBy : null,
      ]} />
    </>
  );
  if (locked) {
    return (
      <div className="tm-disc tm-disc--locked">
        <span className="tm-disc__hatch" aria-hidden="true" />
        {body}
        <p className="tm-disc__lock">{ru.spoiler.lockedDiscussion}</p>
      </div>
    );
  }
  return (
    <a className="tm-disc" href={d.url} target="_blank" rel="noreferrer noopener"
       onClick={onExternalClick(d.url)}>
      {body}
      <span className="tm-disc__out" aria-hidden="true" />
      <span className="tm-sr">{ru.spoiler.externalLink}</span>
    </a>
  );
}
