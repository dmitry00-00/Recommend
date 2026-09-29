import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { AnnotationDiffRow, AnnotationReviewItem } from '@/types/tmdf';
import { getAnnotation, getAnnotationDiff, reviewAnnotation } from '@/api';
import {
  BlindAnnotationToggle, Button, DiffView, EmptyState, ErrorState, FieldConfidence, Skeleton, StatusTag, ValidationList, useToast,
} from '@/components';
import { formatDate } from '@/lib/format';
import ru from '@/i18n/ru';

/** Ревью аннотации (/curator/annotations/:id): шапка с фактами о прогоне, слепой режим,
 *  ошибки валидации, разница черновика и публикации, решение. Для эталона слепой режим
 *  включён по умолчанию — черновик модели скрыт. */
export function AnnotationReviewScreen() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [item, setItem] = useState<AnnotationReviewItem | null>(null);
  const [rows, setRows] = useState<AnnotationDiffRow[]>([]);
  const [blind, setBlind] = useState(false);
  const [missing, setMissing] = useState(false);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setItem(null); setMissing(false); setFailed(false);
    Promise.all([getAnnotation(id), getAnnotationDiff(id)])
      .then(([it, diff]) => {
        if (!alive) return;
        if (!it) { setMissing(true); return; }
        setItem(it); setRows(diff); setBlind(it.isGold);
      })
      .catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, [id, attempt]);

  const decide = (decision: 'approve' | 'reject') => {
    if (!item || busy) return;
    setBusy(true);
    reviewAnnotation(item.annotationId, decision)
      .then(() => { toast({ text: decision === 'approve' ? ru.curator.approved : ru.curator.rejected }); navigate('/curator'); })
      .catch(() => toast({ text: ru.settings.errorSave, action: ru.actions.retry, onAction: () => decide(decision) }))
      .finally(() => setBusy(false));
  };

  if (failed) {
    return <main className="tm-shell__main"><ErrorState title={ru.curator.errorLoad} text={ru.curator.errorText} onRetry={() => setAttempt(attempt + 1)} /></main>;
  }
  if (missing) {
    return (
      <main className="tm-shell__main">
        <EmptyState title={ru.curator.notFound} text={ru.curator.notFoundText} action={ru.curator.nav.queue} onAction={() => navigate('/curator')} />
      </main>
    );
  }
  if (!item) {
    return <main className="tm-shell__main" aria-busy="true"><Skeleton kind="block" style={{ height: 320 }} /></main>;
  }

  const tokens = item.usage.inputTokens + item.usage.outputTokens;
  const decided = item.status === 'approved' || item.status === 'published' || item.status === 'rejected';
  return (
    <main className="tm-shell__main">
      <Link to="/curator" className="tm-curator__back">{ru.curator.toQueue}</Link>
      <div className="tm-curator__head">
        <h1 className="tm-shell__title">{item.work.title}</h1>
        <span className="tm-meta">{`${item.work.year} · ${item.work.creators.join(', ')}`}</span>
        <StatusTag status={item.status} />
        {item.isGold ? <span className="tm-table__gold">{ru.curator.gold}</span> : null}
      </div>
      <dl className="tm-curator__facts">
        <div><dt className="tm-label">{ru.curator.filterProvider}</dt><dd>{ru.annotationProvider[item.provider]}</dd></div>
        <div><dt className="tm-label">{ru.curator.model}</dt><dd>{`${item.model} · ${ru.curator.tier[item.modelTier]} · TMDF ${item.tmdfVersion}`}</dd></div>
        <div><dt className="tm-label">{ru.curator.knowledgeLabel}</dt><dd>{ru.curator.knowledge[item.knowledgeSufficiency]}</dd></div>
        <div><dt className="tm-label">{ru.curator.queueCols[3]}</dt><dd><FieldConfidence confidence={item.overallConfidence} /></dd></div>
        <div>
          <dt className="tm-label">{ru.curator.queueCols[7]}</dt>
          <dd>{tokens ? ru.curator.usage(tokens.toLocaleString('ru'), Math.round(item.usage.durationMs / 1000), `$${item.usage.costUsd.toFixed(2)}`) : '—'}</dd>
        </div>
        <div><dt className="tm-label">{ru.curator.created}</dt><dd>{formatDate(item.createdAt)}</dd></div>
        <div>
          <dt className="tm-label">{ru.curator.queueCols[6]}</dt>
          <dd>{item.signals?.length ? item.signals.map((s) => `${ru.curator.signalKind[s.kind]} · ${s.source} (${s.license})`).join(', ') : ru.curator.signalsNone}</dd>
        </div>
      </dl>

      <div className="tm-curator__stack">
        <BlindAnnotationToggle blind={blind} onChange={setBlind} />
        <ValidationList errors={item.validationErrors} />
        <DiffView rows={rows} hideDraft={blind} />
      </div>

      {!decided ? (
        <div className="tm-row tm-row--gap-2 tm-curator__actions">
          <Button variant="primary" size="sm" loading={busy} disabled={busy || item.validationErrors.length > 0} onClick={() => decide('approve')}>{ru.curator.approve}</Button>
          <Button variant="danger" size="sm" disabled={busy} onClick={() => decide('reject')}>{ru.curator.reject}</Button>
        </div>
      ) : null}
    </main>
  );
}
