import { useEffect, useState } from 'react';
import { suggest } from '@/api';
import { Button } from './Button';
import { Sheet } from './Sheet';
import { useToast } from './Toast';
import { tap } from '@/lib/telegram';
import ui from '@/i18n';

export interface SuggestSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** фильм, которого нет в каталоге, или автор, которого нет в справочнике */
  kind: 'work' | 'voice';
  /** чем заполнить поле названия: поисковый запрос — это уже сказанное человеком */
  initial?: string;
  /** откуда пришла заявка — чтобы по очереди было видно, чего не хватило и где */
  context?: string;
}

/** «Нет нужного фильма» и «знаете, кто разбирал» — одна шторка на оба случая: заявка уходит
 *  владельцу в очередь (worker: таблица suggestion), а не в каталог. Разница только в словах
 *  и в том, что мы потом с ней делаем, поэтому и форма одна.
 *
 *  Второе поле не обязательно нарочно: требовать ссылку значит терять заявку от того, кто
 *  помнит только название. Пустая заявка всё равно полезнее молчания — по ней хотя бы видно,
 *  чего ищут и не находят. */
export function SuggestSheet({ open, onOpenChange, kind, initial, context }: SuggestSheetProps) {
  const toast = useToast();
  const [title, setTitle] = useState(initial ?? '');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  // запрос меняется, пока шторка закрыта: открываем — показываем то, что человек искал сейчас
  useEffect(() => { if (open) { setTitle(initial ?? ''); setNote(''); } }, [open, initial]);

  const send = () => {
    if (!title.trim() || busy) return;
    tap();
    setBusy(true);
    suggest(kind, title, note, context)
      .then((r) => {
        onOpenChange(false);
        toast({ text: r.ok ? ui.suggest.sent : ui.suggest.offline });
      })
      .catch(() => toast({ text: ui.suggest.failed }))
      .finally(() => setBusy(false));
  };

  const t = kind === 'work' ? ui.suggest.work : ui.suggest.voice;
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={t.title}>
      <p className="tm-body-sm">{t.lead}</p>
      <label className="tm-suggest__field">
        <span className="tm-label">{t.name}</span>
        <input className="tm-search__input" value={title} autoFocus
               placeholder={t.namePlaceholder} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label className="tm-suggest__field">
        <span className="tm-label">{ui.suggest.note}</span>
        <textarea className="tm-refl__area" rows={3} value={note} maxLength={500}
                  placeholder={t.notePlaceholder} onChange={(e) => setNote(e.target.value)} />
      </label>
      <p className="tm-caption">{ui.suggest.why}</p>
      <div className="tm-suggest__acts">
        <Button onClick={send} disabled={!title.trim() || busy}>{ui.suggest.send}</Button>
      </div>
    </Sheet>
  );
}
