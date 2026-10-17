import type { AfterHook, AfterPace } from '@/types/tmdf';
import { PACES, HOOKS, type Extra } from '@/lib/model/afterword';
import { Button } from './Button';
import { tap } from '@/lib/telegram';
import ui from '@/i18n';

export interface AfterwordAskProps {
  /** какой вопрос: темп или что держало */
  kind: Extra;
  /** уже выбранный ответ (чек-ин: тот же ещё раз — снять) */
  value?: AfterPace | AfterHook;
  onPick: (value: AfterPace | AfterHook) => void;
  disabled?: boolean;
}

/** Один вопрос о человеке после просмотра (17.10, послесловие): короткий ряд из 3–4 вариантов, без пояснений.
 *  Необязателен: не ответили — вызывающий сворачивает ряд сам. */
export function AfterwordAsk({ kind, value, onPick, disabled }: AfterwordAskProps) {
  const q = kind === 'pace' ? ui.afterword.paceQ : ui.afterword.hookQ;
  const options: readonly (AfterPace | AfterHook)[] = kind === 'pace' ? PACES : HOOKS;
  const label = (v: AfterPace | AfterHook) => (kind === 'pace' ? ui.afterword.pace[v as AfterPace] : ui.afterword.hook[v as AfterHook]);
  return (
    <div className="tm-after" role="group" aria-label={q}>
      <p className="tm-after__q">{q}</p>
      <div className="tm-after__opts">
        {options.map((v) => (
          <Button key={v} size="sm" variant="quiet" pressed={value === v} disabled={disabled}
                  onClick={() => { tap(); onPick(v); }}>
            {label(v)}
          </Button>
        ))}
      </div>
    </div>
  );
}
