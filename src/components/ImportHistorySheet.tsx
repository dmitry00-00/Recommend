import { useMemo, useState } from 'react';
import type { ImportedRecord } from '@/lib/import';
import { parseExports, type ExportFile } from '@/lib/import';
import { isZip, unzipTexts } from '@/lib/import/zip';
import { Sheet } from './Sheet';
import { Button } from './Button';
import ui from '@/i18n';

export interface ImportHistorySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** отдаёт тексты файлов слою данных; возвращает, сколько записей легло и сколько нашлось вовне */
  onImport: (texts: ExportFile[], ratingNorm?: number) => Promise<{ added: number; resolved: number } | undefined>;
}

interface Preview {
  texts: ExportFile[];
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

  const [fileTexts, setFileTexts] = useState<ExportFile[]>([]);

  const read = async (files: FileList | null, text = pasted) => {
    // с именем: watched.csv и watchlist.csv Letterboxd различает только оно (ЗП-25)
    // архив выгрузки (Letterboxd, Trakt) — раскрываем в его текстовые файлы
    const read1 = async (f: File): Promise<ExportFile[]> => {
      const bytes = new Uint8Array(await f.arrayBuffer());
      return isZip(bytes) ? unzipTexts(bytes) : [{ name: f.name, text: new TextDecoder('utf-8').decode(bytes) }];
    };
    const fromFiles = files ? (await Promise.all([...files].map(read1))).flat() : fileTexts;
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
    <Sheet open={open} onOpenChange={onOpenChange} title={ui.importSheet.title}>
      <p className="tm-body-sm tm-import__lead">{ui.importSheet.lead}</p>
      <p className="tm-caption tm-import__privacy">{ui.importSheet.privacy}</p>

      <label className="tm-import__file">
        <span className="tm-label">{ui.importSheet.files}</span>
        <input type="file" multiple accept=".zip,.csv,.json,.html,.htm,.txt,.md" onChange={(e) => void read(e.target.files)} />
      </label>

      <label className="tm-import__paste">
        <span className="tm-label">{ui.importSheet.paste}</span>
        {/* разбираем сразу при вводе, а не по потере фокуса: иначе «Импортировать» остаётся
            неактивной ровно в тот момент, когда человек вставил список и тянется к кнопке */}
        <textarea className="tm-refl__area" rows={4} value={pasted} placeholder={ui.importSheet.pastePlaceholder}
                  onChange={(e) => { setPasted(e.target.value); void read(null, e.target.value); }} />
      </label>

      {preview ? (
        <section className="tm-import__report">
          <p className="tm-body-sm">{ui.importSheet.found(preview.records.length)}</p>
          <ul className="tm-import__list">
            {films ? <li>{ui.importSheet.films(films)}</li> : null}
            {books ? <li>{ui.importSheet.books(books)}</li> : null}
            {series ? <li>{ui.importSheet.series(series)}</li> : null}
            {rated.length ? <li>{ui.importSheet.rated(rated.length)}</li> : null}
            {preview.unrecognized ? <li className="tm-import__skip">{ui.importSheet.unrecognized(preview.unrecognized)}</li> : null}
          </ul>
          {preview.sources.length ? (
            <p className="tm-caption">{ui.importSheet.sources}{preview.sources.map((s) => ui.importSource[s as keyof typeof ui.importSource] ?? s).join(', ')}</p>
          ) : null}
        </section>
      ) : null}

      {rated.length >= 5 ? (
        <section className="tm-import__norm">
          <h3 className="tm-label">{ui.importSheet.normTitle}</h3>
          <p className="tm-caption tm-import__normwhy">{ui.importSheet.normWhy}</p>
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
        <p className="tm-body-sm tm-import__done">{ui.importSheet.done(done.added, done.resolved)}</p>
      ) : null}

      <div className="tm-row tm-row--gap-2 tm-import__actions">
        <Button variant="primary" size="sm" loading={busy} disabled={!preview || busy} onClick={run}>
          {ui.importSheet.run}
        </Button>
        <Button variant="quiet" size="sm" onClick={() => onOpenChange(false)}>{ui.actions.close}</Button>
      </div>
    </Sheet>
  );
}
