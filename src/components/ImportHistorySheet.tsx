import { useMemo, useState } from 'react';
import type { ImportedRecord } from '@/lib/import';
import { parseExports } from '@/lib/import';
import { Sheet } from './Sheet';
import { Button } from './Button';
import ru from '@/i18n/ru';

export interface ImportHistorySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** отдаёт тексты файлов слою данных; возвращает, сколько записей легло и сколько нашлось вовне */
  onImport: (texts: string[], ratingNorm?: number) => Promise<{ added: number; resolved: number } | undefined>;
}

interface Preview {
  texts: string[];
  sources: string[];
  records: ImportedRecord[];
  unrecognized: number;
}

const NORMS = [4, 5, 6, 7, 8, 9] as const;

/** Импорт истории (шторка). Разбор — на клиенте: файл выгрузки может содержать сессионные
 *  токены, наружу он не уходит ни при каких условиях. Три входа: файлы выгрузок, просто
 *  список названий и то и другое вместе. Перед импортом показываем, что именно поняли, и
 *  спрашиваем норму шкалы — угадывать её нельзя: у владельца медиана оценок восьмёрка, а
 *  нормой он называет семёрку (22.09). Компоненты в дизайн-системе нет; собрана на классах
 *  `Sheet`, `PacketImportReport` и поле заметки (`tm-refl__area`). */
export function ImportHistorySheet({ open, onOpenChange, onImport }: ImportHistorySheetProps) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [pasted, setPasted] = useState('');
  const [norm, setNorm] = useState<number | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ added: number; resolved: number } | null>(null);

  const rated = useMemo(() => preview?.records.filter((r) => r.rating != null).map((r) => r.rating!) ?? [], [preview]);
  const median = useMemo(() => {
    if (!rated.length) return undefined;
    const sorted = [...rated].sort((a, b) => a - b);
    return Math.round(sorted[Math.floor(sorted.length / 2)]);
  }, [rated]);

  const [fileTexts, setFileTexts] = useState<string[]>([]);

  const read = async (files: FileList | null, text = pasted) => {
    const fromFiles = files ? await Promise.all([...files].map((f) => f.text())) : fileTexts;
    if (files) setFileTexts(fromFiles);
    const texts = [...fromFiles, ...(text.trim() ? [text] : [])];
    if (!texts.length) { setPreview(null); return; }
    const parsed = parseExports(texts);
    setPreview({ texts, sources: parsed.sources, records: parsed.records, unrecognized: parsed.unrecognized });
    setDone(null);
  };

  const films = preview?.records.filter((r) => r.type === 'film').length ?? 0;
  const books = preview?.records.filter((r) => r.type === 'book').length ?? 0;
  const series = preview?.records.filter((r) => r.type === 'series').length ?? 0;

  const run = () => {
    if (!preview || busy) return;
    setBusy(true);
    onImport(preview.texts, norm ?? median)
      .then((r) => setDone(r ?? { added: 0, resolved: 0 }))
      .finally(() => setBusy(false));
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={ru.importSheet.title}>
      <p className="tm-body-sm tm-import__lead">{ru.importSheet.lead}</p>
      <p className="tm-caption tm-import__privacy">{ru.importSheet.privacy}</p>

      <label className="tm-import__file">
        <span className="tm-label">{ru.importSheet.files}</span>
        <input type="file" multiple accept=".csv,.html,.htm,.txt,.md" onChange={(e) => void read(e.target.files)} />
      </label>

      <label className="tm-import__paste">
        <span className="tm-label">{ru.importSheet.paste}</span>
        {/* разбираем сразу при вводе, а не по потере фокуса: иначе «Импортировать» остаётся
            неактивной ровно в тот момент, когда человек вставил список и тянется к кнопке */}
        <textarea className="tm-refl__area" rows={4} value={pasted} placeholder={ru.importSheet.pastePlaceholder}
                  onChange={(e) => { setPasted(e.target.value); void read(null, e.target.value); }} />
      </label>

      {preview ? (
        <section className="tm-import__report">
          <p className="tm-body-sm">{ru.importSheet.found(preview.records.length)}</p>
          <ul className="tm-import__list">
            {films ? <li>{ru.importSheet.films(films)}</li> : null}
            {books ? <li>{ru.importSheet.books(books)}</li> : null}
            {series ? <li>{ru.importSheet.series(series)}</li> : null}
            {rated.length ? <li>{ru.importSheet.rated(rated.length)}</li> : null}
            {preview.unrecognized ? <li className="tm-import__skip">{ru.importSheet.unrecognized(preview.unrecognized)}</li> : null}
          </ul>
          {preview.sources.length ? (
            <p className="tm-caption">{ru.importSheet.sources}{preview.sources.map((s) => ru.importSource[s as keyof typeof ru.importSource] ?? s).join(', ')}</p>
          ) : null}
        </section>
      ) : null}

      {rated.length >= 5 ? (
        <section className="tm-import__norm">
          <h3 className="tm-label">{ru.importSheet.normTitle}</h3>
          <p className="tm-caption tm-import__normwhy">{ru.importSheet.normWhy}</p>
          <div className="tm-row tm-row--gap-2 tm-row--wrap">
            {NORMS.map((n) => (
              <Button key={n} size="sm" variant={(norm ?? median) === n ? 'primary' : undefined} onClick={() => setNorm(n)}>
                {String(n)}
              </Button>
            ))}
          </div>
        </section>
      ) : null}

      {done ? (
        <p className="tm-body-sm tm-import__done">{ru.importSheet.done(done.added, done.resolved)}</p>
      ) : null}

      <div className="tm-row tm-row--gap-2 tm-import__actions">
        <Button variant="primary" size="sm" loading={busy} disabled={!preview || busy} onClick={run}>
          {ru.importSheet.run}
        </Button>
        <Button variant="quiet" size="sm" onClick={() => onOpenChange(false)}>{ru.actions.close}</Button>
      </div>
    </Sheet>
  );
}
