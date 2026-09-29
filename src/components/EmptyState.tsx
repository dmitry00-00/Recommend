import { Button } from './Button';

export interface EmptyStateProps {
  title: string;
  text?: string;
  action?: string;
  onAction?: () => void;
}

/** Пустое место на ленте: три пустых кадра, последний — пунктиром, «дальше будет». */
export function EmptyState({ title, text, action, onAction }: EmptyStateProps) {
  return (
    <div className="tm-empty">
      <span className="tm-empty__field" aria-hidden="true">
        <svg viewBox="0 0 168 52" width={168} height={52}>
          {[0, 1, 2].map((i) => (
            <g key={i}>
              <rect x={6 + i * 54} y={10} width={46} height={32} fill="none" stroke="currentColor" strokeWidth={1}
                    strokeDasharray={i === 2 ? '3 4' : undefined} />
              <rect x={10 + i * 54} y={3} width={6} height={4} fill="currentColor" />
              <rect x={42 + i * 54} y={3} width={6} height={4} fill="currentColor" />
              <rect x={10 + i * 54} y={45} width={6} height={4} fill="currentColor" />
              <rect x={42 + i * 54} y={45} width={6} height={4} fill="currentColor" />
            </g>
          ))}
        </svg>
      </span>
      <p className="tm-empty__title">{title}</p>
      {text ? <p className="tm-empty__text">{text}</p> : null}
      {action ? <Button variant="primary" onClick={onAction}>{action}</Button> : null}
    </div>
  );
}
