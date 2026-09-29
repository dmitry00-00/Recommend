import { useState } from 'react';
import { Button } from './Button';
import ru from '@/i18n/ru';

export interface ConsentCardProps {
  title?: string;
  /** четыре пункта: что измеряем, зачем, как хранится, как отказаться */
  points?: readonly string[];
  checkLabel?: string;
  busy?: boolean;
  onAccept?: () => void;
  onLater?: () => void;
}

/** Согласие на участие в исследовании: четыре ответа до галочки, кнопка закрыта без неё. */
export function ConsentCard({
  title = ru.consent.title, points = ru.consent.points, checkLabel = ru.consent.check, busy, onAccept, onLater,
}: ConsentCardProps) {
  const [on, setOn] = useState(false);
  return (
    <section className="tm-consent">
      <h3 className="tm-consent__title">{title}</h3>
      <div className="tm-consent__body">
        {points.map((t, i) => <p key={i} className="tm-consent__p">{t}</p>)}
      </div>
      <label className="tm-consent__check">
        <input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} />
        <span>{checkLabel}</span>
      </label>
      <div className="tm-row tm-row--gap-2">
        <Button variant="primary" disabled={!on || busy} loading={busy} onClick={onAccept}>{ru.consent.accept}</Button>
        <Button variant="quiet" disabled={busy} onClick={onLater}>{ru.consent.later}</Button>
      </div>
    </section>
  );
}
