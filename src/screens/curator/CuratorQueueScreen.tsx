import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AnnotationProvider, AnnotationReviewItem, AnnotationStatus } from '@/types/tmdf';
import { getCuratorQueue } from '@/api';
import { EmptyState, ErrorState, ReviewTable, Skeleton } from '@/components';
import ru from '@/i18n/ru';

const STATUSES = Object.keys(ru.annotationStatus) as AnnotationStatus[];
const PROVIDERS = Object.keys(ru.annotationProvider) as AnnotationProvider[];

/** Очередь аннотаций (/curator): фильтры по статусу и источнику, таблица — самое
 *  неуверенное сначала, название ведёт в ревью. */
export function CuratorQueueScreen() {
  const navigate = useNavigate();
  const [items, setItems] = useState<AnnotationReviewItem[] | null>(null);
  const [status, setStatus] = useState<AnnotationStatus | ''>('');
  const [provider, setProvider] = useState<AnnotationProvider | ''>('');
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setFailed(false);
    getCuratorQueue({ status: status || undefined, provider: provider || undefined })
      .then((q) => alive && setItems(q))
      .catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, [status, provider, attempt]);

  return (
    <main className="tm-shell__main">
      <h1 className="tm-shell__title">{ru.curator.queueTitle}</h1>
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
      {failed ? <ErrorState title={ru.curator.errorLoad} text={ru.curator.errorText} onRetry={() => setAttempt(attempt + 1)} /> : null}
      {!items && !failed ? <div aria-busy="true"><Skeleton kind="block" style={{ height: 320 }} /></div> : null}
      {items && !items.length ? <EmptyState title={ru.curator.queueEmpty} text={ru.curator.queueEmptyText} /> : null}
      {items?.length ? <ReviewTable items={items} onOpen={(it) => navigate(`/curator/annotations/${it.annotationId}`)} /> : null}
    </main>
  );
}
