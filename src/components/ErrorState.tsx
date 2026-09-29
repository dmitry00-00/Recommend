import { Button } from './Button';
import { cx } from '@/lib/cx';
import ru from '@/i18n/ru';

export interface ErrorStateProps {
  title?: string;
  text?: string;
  action?: string;
  onRetry?: () => void;
  secondary?: string;
  onSecondary?: () => void;
  className?: string;
}

/** Ошибка как карточка с меткой «стоп»: что случилось, что делать. Без причин не бывает:
 *  тексты по умолчанию — про соединение и последнее сохранённое. */
export function ErrorState({
  title = ru.state.errorSlate, text = ru.state.errorSlateText, action = ru.actions.retry,
  onRetry, secondary, onSecondary, className,
}: ErrorStateProps) {
  return (
    <div className={cx('tm-error', className)} role="alert">
      <span className="tm-error__mark" aria-hidden="true" />
      <div>
        <p className="tm-error__title">{title}</p>
        <p className="tm-error__text">{text}</p>
        <div className="tm-row tm-row--gap-2">
          <Button size="sm" variant="primary" onClick={onRetry}>{action}</Button>
          {secondary ? <Button size="sm" variant="quiet" onClick={onSecondary}>{secondary}</Button> : null}
        </div>
      </div>
    </div>
  );
}
