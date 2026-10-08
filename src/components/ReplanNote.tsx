import type { ISODate } from '@/types/tmdf';
import ui from '@/i18n';

export interface ReplanNoteProps {
  at?: ISODate;
  /** причина перестроения приходит из данных — экран её не сочиняет */
  reason: string;
}

/** Перестроение маршрута — не ошибка, а запись в журнале: когда и почему. */
export function ReplanNote({ at, reason }: ReplanNoteProps) {
  return (
    <div className="tm-replan">
      <span className="tm-replan__mark" aria-hidden="true" />
      <div>
        <p className="tm-replan__title">{ui.trajectory.replannedAt + (at ?? '')}</p>
        <p className="tm-replan__text">{reason}</p>
      </div>
    </div>
  );
}
