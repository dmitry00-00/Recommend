import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AnnotationProvider, AnnotationReviewItem, AnnotationStatus } from '@/types/tmdf';
import { exportReviewDecisions, getCuratorQueue, getReviewProgress, type ReviewProgress } from '@/api';
import { Button, EmptyState, ErrorState, ReviewTable, Skeleton, useToast } from '@/components';
import ui from '@/i18n';

const STATUSES = Object.keys(ui.annotationStatus) as AnnotationStatus[];
const PROVIDERS = Object.keys(ui.annotationProvider) as AnnotationProvider[];

/** Очередь аннотаций (/curator). По умолчанию — «Сегодня» (трек Г3): порция из 20 черновиков,
 *  сначала фильмы колоды /rate; «Вся очередь» — прежняя таблица с фильтрами. Название ведёт в
 *  ревью. «Скачать решения» — файл для tools/apply-review.mts. */
export function CuratorQueueScreen() {
  const navigate = useNavigate();
  const toast = useToast();
  const [items, setItems] = useState<AnnotationReviewItem[] | null>(null);
  const [progress, setProgress] = useState<ReviewProgress | null>(null);
  const [today, setToday] = useState(true);
  const [status, setStatus] = useState<AnnotationStatus | ''>('');
  const [provider, setProvider] = useState<AnnotationProvider | ''>('');
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setFailed(false);
    setItems(null);
    Promise.all([
      getCuratorQueue(today ? { today: true } : { status: status || undefined, provider: provider || undefined }),
      getReviewProgress(),
    ])
      .then(([q, p]) => { if (alive) { setItems(q); setProgress(p); } })
      .catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, [today, status, provider, attempt]);

  const download = () => {
    exportReviewDecisions().then(({ file, count }) => {
      if (!count) { toast({ text: ui.curator.noDecisions }); return; }
      const url = URL.createObjectURL(new Blob([file], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `annotation-review-${new Date().toLocaleDateString('sv')}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ text: ui.curator.exportedDecisions(count) });
    });
  };

  const openLeft = items?.some((i) => i.status === 'needs_review');
  return (
    <main className="tm-shell__main">
      <h1 className="tm-shell__title">{ui.curator.queueTitle}</h1>
      <div className="tm-row tm-row--gap-2">
        <Button variant={today ? 'primary' : 'secondary'} size="sm" onClick={() => setToday(true)}>{ui.curator.batchToday}</Button>
        <Button variant={today ? 'secondary' : 'primary'} size="sm" onClick={() => setToday(false)}>{ui.curator.batchAll}</Button>
        <Button variant="secondary" size="sm" onClick={download}>{ui.curator.exportDecisions}</Button>
      </div>
      {progress ? (
        <p className="tm-meta">
          {`${ui.curator.batchProgress(progress.today, progress.daily, progress.left)} · ${ui.curator.batchTotals(progress.approved, progress.rejected)}`}
        </p>
      ) : null}
      {!today ? (
        <div className="tm-curator__filters">
          <label className="tm-curator__filter">
            <span className="tm-label">{ui.curator.filterStatus}</span>
            <select className="tm-input" value={status} onChange={(e) => setStatus(e.target.value as AnnotationStatus | '')}>
              <option value="">{ui.curator.anyStatus}</option>
              {STATUSES.map((s) => <option key={s} value={s}>{ui.annotationStatus[s]}</option>)}
            </select>
          </label>
          <label className="tm-curator__filter">
            <span className="tm-label">{ui.curator.filterProvider}</span>
            <select className="tm-input" value={provider} onChange={(e) => setProvider(e.target.value as AnnotationProvider | '')}>
              <option value="">{ui.curator.anyProvider}</option>
              {PROVIDERS.map((p) => <option key={p} value={p}>{ui.annotationProvider[p]}</option>)}
            </select>
          </label>
        </div>
      ) : null}
      {failed ? <ErrorState title={ui.curator.errorLoad} text={ui.curator.errorText} onRetry={() => setAttempt(attempt + 1)} /> : null}
      {!items && !failed ? <div aria-busy="true"><Skeleton kind="block" style={{ height: 320 }} /></div> : null}
      {items && today && !openLeft ? <EmptyState title={ui.curator.batchDone} text={ui.curator.batchDoneText} /> : null}
      {items && !today && !items.length ? <EmptyState title={ui.curator.queueEmpty} text={ui.curator.queueEmptyText} /> : null}
      {items?.length ? <ReviewTable items={items} onOpen={(it) => navigate(`/curator/annotations/${encodeURIComponent(it.annotationId)}`)} /> : null}
    </main>
  );
}
