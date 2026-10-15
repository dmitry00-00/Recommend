import { useEffect, useMemo, useRef, useState } from 'react';
import type { WorkCard } from '@/types/tmdf';
import { PASTED_LIST, type ExportFile } from '@/lib/import';
import { isZip, unzipTexts } from '@/lib/import/zip';
import {
  commitImport, importNeedsCheck, previewImport, searchWorks, undoImport,
  type ImportChoice, type ImportPreview, type ImportProgress, type ImportResult, type ImportRow,
} from '@/api';
import { Sheet } from './Sheet';
import { Button } from './Button';
import { cx } from '@/lib/cx';
import { isSeries } from '@/lib/media';
import ui from '@/i18n';

export interface ImportHistorySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** норма шкалы — в настройки до записи: от неё модель считает вкус и «понравилось» */
  onNorm?: (ratingNorm: number) => Promise<unknown>;
  /** импорт записан или отменён — экрану перечитать дневник и ленту */
  onChanged?: () => void;
}

const NORMS = [4, 5, 6, 7, 8, 9] as const;
const GUIDES = ['kinopoisk', 'letterboxd', 'imdb', 'trakt', 'books', 'list'] as const;
const SHOW_CHECK = 30;

/** Импорт истории (шторка; ДФ-11, 14.10). Разбор — на клиенте: файл выгрузки может содержать сессионные
 *  токены, наружу он не уходит ни при каких условиях. Шаги: откуда переносим (инструкция по источнику) →
 *  файлы или список названий → предпросмотр до записи: «нашли N из M», в чём не уверены — проверить и
 *  заменить, чего нет в каталоге — своей записью → запись с меткой → «Отменить импорт» на экране успеха.
 *  Норму шкалы спрашиваем: у владельца медиана оценок восьмёрка, а нормой он называет семёрку (22.09). */
export function ImportHistorySheet({ open, onOpenChange, onNorm, onChanged }: ImportHistorySheetProps) {
  const [guide, setGuide] = useState<(typeof GUIDES)[number] | null>(null);
  const [pasted, setPasted] = useState('');
  const [fileTexts, setFileTexts] = useState<ExportFile[]>([]);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [choices, setChoices] = useState<Record<number, ImportChoice>>({});
  const [norm, setNorm] = useState<number | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<ImportResult | null>(null);
  const [undone, setUndone] = useState<{ removed: number; unrated: number } | null>(null);
  const [showOwn, setShowOwn] = useState(false);
  const [showAllCheck, setShowAllCheck] = useState(false);
  const run = useRef(0);
  const pasteTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // закрыли шторку — следующий импорт начинается с чистого листа, а не с экрана прошлого успеха или отмены
  useEffect(() => {
    if (open) return;
    run.current += 1;
    clearTimeout(pasteTimer.current);
    setPasted(''); setFileTexts([]); setPreview(null); setProgress(null); setChoices({}); setNorm(undefined);
    setError(null); setDone(null); setUndone(null); setShowOwn(false); setShowAllCheck(false);
  }, [open]);

  const check = useMemo(() => preview?.rows.filter((r) => importNeedsCheck(r) && !r.already && !r.repeat) ?? [], [preview]);
  const ownRows = useMemo(() => preview?.rows.filter((r) => r.how === 'own' && !r.already && !r.repeat) ?? [], [preview]);
  const ratedRaw = useMemo(() => preview?.rows.map((r) => r.record.rating).filter((x): x is number => x != null && x > 0) ?? [], [preview]);
  const median = useMemo(() => {
    if (!ratedRaw.length) return undefined;
    const sorted = [...ratedRaw].sort((a, b) => a - b);
    return Math.round(sorted[Math.floor(sorted.length / 2)]);
  }, [ratedRaw]);
  const stats = useMemo(() => {
    if (!preview) return null;
    const rows = preview.rows;
    const dropped = rows.filter((r) => choices[r.i]?.drop).length;
    const already = rows.filter((r) => r.already && !choices[r.i]?.drop).length;
    const repeats = rows.filter((r) => r.repeat && !choices[r.i]?.drop).length;
    return {
      total: rows.length,
      found: rows.filter((r) => r.how !== 'own').length,
      already, repeats, dropped,
      toAdd: rows.length - already - repeats - dropped,
    };
  }, [preview, choices]);

  const analyze = async (texts: ExportFile[]) => {
    const id = ++run.current;
    setDone(null); setUndone(null); setError(null); setChoices({}); setShowOwn(false); setShowAllCheck(false);
    if (!texts.length) { setPreview(null); setProgress(null); return; }
    setPreview(null);
    setProgress({ stage: 'match', done: 0, total: 0 });
    try {
      const p = await previewImport(texts, (x) => { if (id === run.current) setProgress(x); });
      if (id !== run.current) return;
      setPreview(p ?? null);
      if (!p) setError(ui.importSheet.unrecognized(texts.length));
    } catch {
      if (id === run.current) setError(ui.importSheet.previewFailed);
    } finally {
      if (id === run.current) setProgress(null);
    }
  };

  const readFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    // с именем: watched.csv и watchlist.csv Letterboxd различает только оно (ЗП-25);
    // архив выгрузки (Letterboxd, Trakt) — раскрываем в его текстовые файлы
    const read1 = async (f: File): Promise<ExportFile[]> => {
      const bytes = new Uint8Array(await f.arrayBuffer());
      return isZip(bytes) ? unzipTexts(bytes) : [{ name: f.name, text: new TextDecoder('utf-8').decode(bytes) }];
    };
    const fromFiles = (await Promise.all([...files].map(read1))).flat();
    setFileTexts(fromFiles);
    await analyze([...fromFiles, ...(pasted.trim() ? [{ name: PASTED_LIST, text: pasted }] : [])]);
  };
  // список названий разбираем, когда человек перестал печатать: каждая буква — новый поиск по сети
  const onPaste = (text: string) => {
    setPasted(text);
    clearTimeout(pasteTimer.current);
    pasteTimer.current = setTimeout(() => void analyze([...fileTexts, ...(text.trim() ? [{ name: PASTED_LIST, text }] : [])]), 700);
  };

  const choose = (i: number, c: ImportChoice | null) => setChoices((prev) => {
    const next = { ...prev };
    if (c) next[i] = c; else delete next[i];
    return next;
  });

  const commit = async () => {
    if (!preview || busy) return;
    setBusy(true); setError(null);
    try {
      const n = norm ?? median;
      if (n && ratedRaw.length >= 5) await onNorm?.(n);
      const r = await commitImport(preview, choices);
      setDone(r);
      onChanged?.();
    } catch {
      setError(ui.importSheet.commitFailed);
    } finally {
      setBusy(false);
    }
  };
  const undo = async () => {
    if (!done || busy) return;
    setBusy(true); setError(null);
    try {
      setUndone(await undoImport(done.importId));
      onChanged?.();
    } catch {
      setError(ui.importSheet.undoFailed);
    } finally {
      setBusy(false);
    }
  };

  const progressText = progress
    ? progress.stage === 'resolve' ? ui.importSheet.resolving(progress.done, progress.total)
      : progress.stage === 'search' ? ui.importSheet.searching(progress.done, progress.total)
        : ui.importSheet.checking
    : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={ui.importSheet.title}>
      {done ? (
        <section className="tm-import__done" aria-live="polite">
          {undone ? (
            <p className="tm-body-sm">{ui.importSheet.undone(undone.removed, undone.unrated)}</p>
          ) : (
            <>
              <p className="tm-body-sm">{ui.importSheet.done(done.added, done.rated)}</p>
              {done.own ? <p className="tm-caption">{ui.importSheet.doneOwn(done.own)}</p> : null}
              {done.already ? <p className="tm-caption">{ui.importSheet.doneAlready(done.already)}</p> : null}
            </>
          )}
          {error ? <p className="tm-caption tm-import__error" role="alert">{error}</p> : null}
          <div className="tm-row tm-row--gap-2 tm-import__actions">
            {!undone ? <Button size="sm" loading={busy} disabled={busy} onClick={() => void undo()}>{ui.importSheet.undo}</Button> : null}
            <Button variant="primary" size="sm" onClick={() => onOpenChange(false)}>{ui.actions.close}</Button>
          </div>
        </section>
      ) : (
        <>
          <p className="tm-body-sm tm-import__lead">{ui.importSheet.lead}</p>

          <section className="tm-import__guide">
            <h3 className="tm-label">{ui.importSheet.guideTitle}</h3>
            <div className="tm-row tm-row--gap-2 tm-row--wrap">
              {GUIDES.map((g) => (
                <Button key={g} size="sm" variant="secondary" pressed={guide === g} onClick={() => setGuide(guide === g ? null : g)}>
                  {ui.importSheet.guides[g].name}
                </Button>
              ))}
            </div>
            {guide ? (
              <>
                <ol className="tm-import__steps">
                  {ui.importSheet.guides[guide].steps.map((s) => <li key={s} className="tm-body-sm">{s}</li>)}
                </ol>
                {guide !== 'list' ? <p className="tm-caption">{ui.importSheet.guideNote}</p> : null}
              </>
            ) : null}
          </section>

          <p className="tm-caption tm-import__privacy">{ui.importSheet.privacy}</p>
          {guide !== 'list' ? (
            <label className="tm-import__file">
              <span className="tm-label">{ui.importSheet.files}</span>
              <input type="file" multiple accept=".zip,.csv,.json,.html,.htm,.txt,.md" onChange={(e) => void readFiles(e.target.files)} />
            </label>
          ) : null}
          <label className="tm-import__paste">
            <span className="tm-label">{ui.importSheet.paste}</span>
            <textarea className="tm-refl__area" rows={4} value={pasted} placeholder={ui.importSheet.pastePlaceholder}
                      onChange={(e) => onPaste(e.target.value)} />
          </label>

          {progressText ? <p className="tm-caption tm-import__progress" aria-live="polite">{progressText}</p> : null}

          {preview && stats ? (
            <section className="tm-import__report" aria-live="polite">
              <p className="tm-body tm-import__summary"><b>{ui.importSheet.summary(stats.found, stats.total)}</b></p>
              <ul className="tm-import__list">
                {check.length ? <li>{ui.importSheet.toCheck(check.length)}</li> : null}
                {stats.already ? <li>{ui.importSheet.already(stats.already)}</li> : null}
                {stats.repeats ? <li>{ui.importSheet.repeats(stats.repeats)}</li> : null}
                {ownRows.length ? (
                  <li>
                    {ui.importSheet.own(ownRows.length)}{' '}
                    <button type="button" className="tm-coldstart__link" onClick={() => setShowOwn((v) => !v)}>
                      {showOwn ? ui.importSheet.hideOwn : ui.importSheet.showOwn}
                    </button>
                    {showOwn ? (
                      <ul className="tm-import__own">
                        {ownRows.map((r) => <li key={r.i} className="tm-caption">{ui.importSheet.row(r.record.title || r.record.originalTitle || '—', r.record.year)}</li>)}
                      </ul>
                    ) : null}
                  </li>
                ) : null}
                {ratedRaw.length ? <li>{ui.importSheet.rated(ratedRaw.length)}</li> : null}
                {preview.unrecognized ? <li className="tm-import__skip">{ui.importSheet.unrecognized(preview.unrecognized)}</li> : null}
              </ul>
              {preview.sources.length ? (
                <p className="tm-caption">{ui.importSheet.sources}{preview.sources.map((s) => ui.importSource[s as keyof typeof ui.importSource] ?? s).join(', ')}</p>
              ) : null}

              {check.length ? (
                <ul className="tm-import__check">
                  {(showAllCheck ? check : check.slice(0, SHOW_CHECK)).map((r) => (
                    <CheckRow key={r.i} row={r} choice={choices[r.i]} onChoose={(c) => choose(r.i, c)} />
                  ))}
                </ul>
              ) : null}
              {check.length > SHOW_CHECK && !showAllCheck ? (
                <Button variant="quiet" size="sm" onClick={() => setShowAllCheck(true)}>{ui.importSheet.more(check.length - SHOW_CHECK)}</Button>
              ) : null}
            </section>
          ) : null}

          {preview && ratedRaw.length >= 5 ? (
            <section className="tm-import__norm">
              <h3 className="tm-label">{ui.importSheet.normTitle}</h3>
              <p className="tm-caption tm-import__normwhy">{ui.importSheet.normWhy}</p>
              <div className="tm-row tm-row--gap-2 tm-row--wrap">
                {NORMS.map((n) => (
                  <Button key={n} size="sm" variant="secondary" pressed={(norm ?? median) === n} onClick={() => setNorm(n)}>
                    {String(n)}
                  </Button>
                ))}
              </div>
            </section>
          ) : null}

          {error ? <p className="tm-caption tm-import__error" role="alert">{error}</p> : null}

          <div className="tm-row tm-row--gap-2 tm-import__actions">
            <Button variant="primary" size="sm" loading={busy} disabled={!preview || !stats?.toAdd || busy || progress != null}
                    onClick={() => void commit()}>
              {stats && !stats.toAdd ? ui.importSheet.nothingToAdd : ui.importSheet.add(stats?.toAdd ?? 0)}
            </Button>
            <Button variant="quiet" size="sm" onClick={() => onOpenChange(false)}>{ui.actions.close}</Button>
          </div>
        </>
      )}
    </Sheet>
  );
}

/** Строка «проверьте»: что было в выгрузке → какую карточку мы подставили; «Верно», другая карточка с тем же
 *  названием, поиск по каталогу, «Оставить как есть» (своя запись) или «Не добавлять». */
function CheckRow({ row, choice, onChoose }: { row: ImportRow; choice?: ImportChoice; onChoose: (c: ImportChoice | null) => void }) {
  const [searching, setSearching] = useState(false);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<WorkCard[] | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const r = row.record;
  const shown = choice?.work ?? row.work;
  const label = (w: WorkCard) => `${w.title}${w.year ? `, ${w.year}` : ''}${w.creators?.[0] ? ` · ${w.creators[0]}` : ''}`;
  const find = (text: string) => {
    setQ(text);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (!text.trim()) { setHits(null); return; }
      void searchWorks(text, 12).then((h) => setHits(h.map((x) => x.work)
        .filter((w) => (isSeries(w) ? 'series' : w.type) === r.type)
        // ближе к году из выгрузки — выше: поиск сам ставит новое первым («Сталкер» 2023 выше Тарковского)
        .sort((a, b) => (r.year != null ? Math.abs(a.year - r.year) - Math.abs(b.year - r.year) : 0))
        .slice(0, 6)));
    }, 250);
  };
  return (
    <li className={cx('tm-import__row', choice?.drop && 'tm-import__row--off')}>
      <p className="tm-body-sm tm-import__from">{ui.importSheet.row(r.title || r.originalTitle || '—', r.year)}</p>
      <p className="tm-caption tm-import__to">
        {choice?.drop ? ui.importSheet.rowDropped : choice?.own ? ui.importSheet.rowKept : <>{ui.importSheet.ours}: <b>{label(shown)}</b></>}
      </p>
      <div className="tm-row tm-row--gap-2 tm-row--wrap">
        <Button size="sm" variant="secondary" pressed={!choice} onClick={() => { onChoose(null); setSearching(false); }}>{ui.importSheet.rowOk}</Button>
        {row.alternatives.slice(0, 3).map((w) => (
          <Button key={w.id} size="sm" variant="secondary" pressed={choice?.work?.id === w.id} onClick={() => onChoose({ work: w })}>
            {`${w.title}${w.year ? `, ${w.year}` : ''}`}
          </Button>
        ))}
        <Button size="sm" variant="quiet" pressed={searching} onClick={() => setSearching((v) => !v)}>{ui.importSheet.rowOther}</Button>
        <Button size="sm" variant="quiet" pressed={Boolean(choice?.own)} onClick={() => onChoose({ own: true })}>{ui.importSheet.rowKeep}</Button>
        <Button size="sm" variant="quiet" pressed={Boolean(choice?.drop)} onClick={() => onChoose({ drop: true })}>{ui.importSheet.rowDrop}</Button>
      </div>
      {searching ? (
        <div className="tm-import__search">
          <input className="tm-input" type="search" value={q} placeholder={ui.importSheet.searchPlaceholder} autoFocus
                 onChange={(e) => find(e.target.value)} aria-label={ui.importSheet.searchPlaceholder} />
          {hits ? (
            hits.length ? (
              <div className="tm-row tm-row--gap-2 tm-row--wrap">
                {hits.map((w) => (
                  <Button key={w.id} size="sm" variant="secondary" pressed={choice?.work?.id === w.id}
                          onClick={() => { onChoose({ work: w }); setSearching(false); }}>
                    {label(w)}
                  </Button>
                ))}
              </div>
            ) : <p className="tm-caption">{ui.importSheet.searchNothing}</p>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
