import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import * as RT from '@radix-ui/react-toast';
import ui from '@/i18n';

export interface ToastProps {
  text: string;
  action?: string;
  onAction?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** мс; по умолчанию — из провайдера */
  duration?: number;
}

/** Короткое подтверждение внизу экрана. Одно действие, без иконок и цветов состояния:
 *  тост — это подпись к тому, что уже произошло. Живёт внутри `ToastProvider`. */
export function Toast({ text, action, onAction, open, onOpenChange, duration }: ToastProps) {
  return (
    <RT.Root className="tm-toast" open={open} onOpenChange={onOpenChange} duration={duration}>
      <RT.Description className="tm-toast__text">{text}</RT.Description>
      {action ? (
        <RT.Action altText={action} asChild>
          <button type="button" className="tm-toast__action" onClick={onAction}>{action}</button>
        </RT.Action>
      ) : null}
    </RT.Root>
  );
}

export interface ToastOptions {
  text: string;
  action?: string;
  onAction?: () => void;
  duration?: number;
}

type Show = (toast: ToastOptions) => void;
const ToastContext = createContext<Show>(() => undefined);

/** Место, где тосты появляются: оболочка ставит его прямо над нижней навигацией. */
export function ToastViewport() {
  return <RT.Viewport className="tm-toastview" hotkey={['F8']} label={ui.toast.viewport} />;
}

/** Очередь тостов; `useToast()` отдаёт `show`. Тост живёт четыре секунды или до свайпа
 *  вниз; с действием — пока на него не нажали или не истёк срок. Сам провайдер ничего не
 *  рисует: `ToastViewport` рендерит оболочка, чтобы тосты стояли над навигацией. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<(ToastOptions & { id: number })[]>([]);
  const seq = useRef(0);
  const show = useCallback<Show>((toast) => {
    seq.current += 1;
    setItems((xs) => [...xs, { ...toast, id: seq.current }]);
  }, []);
  const remove = (id: number) => setItems((xs) => xs.filter((x) => x.id !== id));

  return (
    <ToastContext.Provider value={show}>
      <RT.Provider swipeDirection="down" duration={4000} label={ui.toast.label}>
        {children}
        {items.map((t) => (
          <Toast key={t.id} text={t.text} action={t.action} duration={t.duration}
                 onAction={() => { t.onAction?.(); remove(t.id); }}
                 onOpenChange={(open) => { if (!open) remove(t.id); }} />
        ))}
      </RT.Provider>
    </ToastContext.Provider>
  );
}

export const useToast = (): Show => useContext(ToastContext);
