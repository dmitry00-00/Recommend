import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AnnotationProvider, AnnotationReviewItem, AnnotationStatus } from '@/types/tmdf';
import { exportReviewDecisions, getCuratorQueue, getReviewProgress, type ReviewProgress } from '@/api';
import { Button, EmptyState, ErrorState, ReviewTable, Skeleton, useToast } from '@/components';
import ru from '@/i18n/ru';

const STATUSES = Object.keys(ru.annotationStatus) as AnnotationStatus[];
const PROVIDERS = Object.keys(ru.annotationProvider) as AnnotationProvider[];

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
      if (!count) { toast({ text: ru.curator.noDecisions }); return; }
      const url = URL.createObjectURL(new Blob([file], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `annotation-review-${new Date().toLocaleDateString('sv')}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ text: ru.curator.exportedDecisions(count) });
    });
  };

  const openLeft = items?.some((i) => i.status === 'needs_review');
  return (
    <main className="tm-shell__main">
      <h1 className="tm-shell__title">{ru.curator.queueTitle}</h1>
      <div className="tm-row tm-row--gap-2">
        <Button variant={today ? 'primary' : 'secondary'} size="sm" onClick={() => setToday(true)}>{ru.curator.batchToday}</Button>
        <Button variant={today ? 'secondary' : 'primary'} size="sm" onClick={() => setToday(false)}>{ru.curator.batchAll}</Button>
        <Button variant="secondary" size="sm" onClick={download}>{ru.curator.exportDecisions}</Button>
      </div>
      {progress ? (
        <p className="tm-meta">
          {`${ru.curator.batchProgress(progress.today, progress.daily, progress.left)} · ${ru.curator.batchTotals(progress.approved, progress.rejected)}`}
        </p>
      ) : null}
      {!today ? (
        <div className="tm-curator__filters">
          <label className="tm-curator__filter">
            <span className="tm-label">{ru.curator.filterStatus}</span>
            <select className="tm-input" value={status} onChange={(e) => setStatus(e.target.value as AnnotationStatus | '')}>
              <option value="">{ru.curator.anyStatus}</option>
              {STATUSES.map((s) => <option key={s} value={s}>{ru.annotationStatus[s]}</option>)}
            </select>
          </label>
          <label className="tm-curator__filter">
            <span className="tm-label">{ru.curator.filterProvider}</span>
            <select className="tm-input" value={provider} onChange={(e) => setProvider(e.target.value as AnnotationProvider | '')}>
              <option value="">{ru.curator.anyProvider}</option>
              {PROVIDERS.map((p) => <option key={p} value={p}>{ru.annotationProvider[p]}</option>)}
            </select>
          </label>
        </div>
      ) : null}
      {failed ? <ErrorState title={ru.curator.errorLoad} text={ru.curator.errorText} onRetry={() => setAttempt(attempt + 1)} /> : null}
      {!items && !failed ? <div aria-busy="true"><Skeleton kind="block" style={{ height: 320 }} /></div> : null}
      {items && today && !openLeft ? <EmptyState title={ru.curator.batchDone} text={ru.curator.batchDoneText} /> : null}
      {items && !today && !items.length ? <EmptyState title={ru.curator.queueEmpty} text={ru.curator.queueEmptyText} /> : null}
      {items?.length ? <ReviewTable items={items} onOpen={(it) => navigate(`/curator/annotations/${encodeURIComponent(it.annotationId)}`)} /> : null}
    </main>
  );
}
