import { useEffect, useRef, useState, type ReactNode } from 'react';
import type {
  AgreementCeilingData, AgreementReport, AnnotationReviewItem, AnnotationRun, ContributorProfile, ID, PacketReport,
  QualityMetric, SourceCandidate, TropeTreeNode, TvTropesMapping,
} from '@/types/tmdf';
import {
  exportAnnotationPacket, getAgreement, getAgreementCeiling, getContributorReliability, getContributors, getCuratorQueue,
  getGoldSet, getQualityMetrics, getRuns, getSourceCandidates, getTaxonomy, getTvTropesMappings,
  importAnnotationResults,
} from '@/api';
import {
  AgreementCeiling, AgreementMatrix, Button, ContributorTable, EmptyState, ErrorState, MappingTable, MetricsTable,
  PacketExport, PacketImportReport, ReviewTable, RunProgress, Skeleton, SourceTable, TropeTree, useToast,
} from '@/components';
import type { PacketExportInput } from '@/components/PacketExport';
import { useNavigate } from 'react-router-dom';
import ru from '@/i18n/ru';

/** Загрузка одного набора данных для простого экрана: скелет, ошибка с повтором, содержимое. */
function useLoad<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const loadRef = useRef(load);
  loadRef.current = load;
  useEffect(() => {
    let alive = true;
    setFailed(false);
    loadRef.current().then((d) => alive && setData(d)).catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, [attempt]);
  return { data, failed, retry: () => setAttempt((a) => a + 1) };
}

function Page({ title, lead, failed, retry, ready, children }: {
  title: string; lead?: string; failed: boolean; retry: () => void; ready: boolean; children: ReactNode;
}) {
  return (
    <main className="tm-shell__main">
      <h1 className="tm-shell__title">{title}</h1>
      {lead ? <p className="tm-body-sm tm-curator__lead">{lead}</p> : null}
      {failed ? <ErrorState title={ru.curator.errorLoad} text={ru.curator.errorText} onRetry={retry} /> : null}
      {!ready && !failed ? <div aria-busy="true"><Skeleton kind="block" style={{ height: 280 }} /></div> : null}
      {ready ? children : null}
    </main>
  );
}

/** Таксономия (/curator/taxonomy). */
export function TaxonomyScreen() {
  const { data, failed, retry } = useLoad<TropeTreeNode[]>(getTaxonomy);
  return (
    <Page title={ru.curator.taxonomyTitle} lead={ru.curator.taxonomyLead} failed={failed} retry={retry} ready={!!data}>
      {data ? <TropeTree tree={data} /> : null}
    </Page>
  );
}

/** Прогоны (/curator/runs). */
export function RunsScreen() {
  const { data, failed, retry } = useLoad<AnnotationRun[]>(getRuns);
  return (
    <Page title={ru.curator.runsTitle} lead={ru.curator.runsLead} failed={failed} retry={retry} ready={!!data}>
      <div className="tm-curator__stack">{data?.map((r) => <RunProgress key={r.id} run={r} />)}</div>
    </Page>
  );
}

/** Пакеты (/curator/packets): выгрузка и загрузка результатов с отчётом. Файлы читаются на
 *  месте и уходят в `importAnnotationResults`; в моке отчёт — заготовленный. */
export function PacketsScreen() {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const { data: queue, failed, retry } = useLoad<AnnotationReviewItem[]>(() => getCuratorQueue());
  const [report, setReport] = useState<PacketReport | null>(null);
  const [packetId, setPacketId] = useState<ID | null>(null);
  const [busy, setBusy] = useState<'export' | 'import' | null>(null);
  const counts = queue ? {
    needs: queue.filter((i) => i.status === 'queued').length,
    low: queue.filter((i) => i.overallConfidence === 'low').length,
    gold: queue.filter((i) => i.isGold).length,
  } : undefined;
  const pick = (input: PacketExportInput) => {
    const set = input.set === 'gold' ? queue?.filter((i) => i.isGold) : input.set === 'low'
      ? queue?.filter((i) => i.overallConfidence === 'low') : queue?.filter((i) => i.status === 'queued');
    return (set ?? []).map((i) => i.work.id);
  };
  const doExport = (input: PacketExportInput) => {
    setBusy('export');
    exportAnnotationPacket({ workIds: pick(input), layers: input.layers })
      .then((r) => { setPacketId(r.packetId); toast({ text: ru.curator.exported(r.packetId) }); })
      .catch(() => toast({ text: ru.settings.errorSave }))
      .finally(() => setBusy(null));
  };
  const doImport = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy('import');
    try {
      const texts = await Promise.all([...files].map((f) => f.text()));
      setReport(await importAnnotationResults(packetId ?? 'pk-2026-09-14', texts));
    } catch {
      toast({ text: ru.settings.errorSave });
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  };
  return (
    <Page title={ru.curator.packetsTitle} failed={failed} retry={retry} ready={!!queue}>
      <div className="tm-curator__stack">
        <PacketExport counts={counts} busy={busy === 'export'} onExport={doExport} onPreview={(i) => toast({ text: `${pick(i).length} · ${i.layers.join(', ')} · ${i.format}` })} />
        <section className="tm-packet">
          <h4 className="tm-packet__title">{ru.curator.importTitle}</h4>
          <p className="tm-body-sm tm-curator__lead">{ru.curator.importNote}</p>
          <input ref={fileRef} className="tm-curator__file" type="file" multiple accept=".json,.jsonl,application/json"
                 onChange={(e) => doImport(e.target.files)} />
          <Button size="sm" loading={busy === 'import'} disabled={busy != null} onClick={() => fileRef.current?.click()}>{ru.curator.importPick}</Button>
        </section>
        {report ? <PacketImportReport report={report} /> : null}
      </div>
    </Page>
  );
}

/** Эталонный набор (/curator/gold). */
export function GoldScreen() {
  const navigate = useNavigate();
  const { data, failed, retry } = useLoad<AnnotationReviewItem[]>(getGoldSet);
  return (
    <Page title={ru.curator.goldTitle} lead={ru.curator.goldLead} failed={failed} retry={retry} ready={!!data}>
      {data ? <ReviewTable items={data} caption={ru.curator.goldTitle} onOpen={(it) => navigate(`/curator/annotations/${it.annotationId}`)} /> : null}
    </Page>
  );
}

/** Качество (/curator/evaluation): метрики по слоям и потолок. */
export function EvaluationScreen() {
  const { data, failed, retry } = useLoad<[QualityMetric[], AgreementCeilingData]>(() => Promise.all([getQualityMetrics(), getAgreementCeiling()]));
  return (
    <Page title={ru.curator.evaluationTitle} failed={failed} retry={retry} ready={!!data}>
      {data ? <div className="tm-curator__stack"><MetricsTable rows={data[0]} /><AgreementCeiling {...data[1]} /></div> : null}
    </Page>
  );
}

/** Участники (/curator/contributors). */
export function ContributorsScreen() {
  const { data, failed, retry } = useLoad<[ContributorProfile[], Record<ID, string>]>(() => Promise.all([getContributors(), getContributorReliability()]));
  return (
    <Page title={ru.curator.contributorsTitle} failed={failed} retry={retry} ready={!!data}>
      {data ? <ContributorTable contributors={data[0]} reliability={data[1]} /> : null}
    </Page>
  );
}

/** Согласованность (/curator/agreement): матрица по полям и потолок. */
export function AgreementScreen() {
  const { data, failed, retry } = useLoad<[AgreementReport[], AgreementCeilingData]>(() => Promise.all([getAgreement(), getAgreementCeiling()]));
  return (
    <Page title={ru.curator.agreementTitle} failed={failed} retry={retry} ready={!!data}>
      {data ? <div className="tm-curator__stack"><AgreementMatrix rows={data[0]} example={ru.curator.matrixExample} /><AgreementCeiling {...data[1]} /></div> : null}
    </Page>
  );
}

/** Отображения TV Tropes (/curator/mappings). */
export function MappingsScreen() {
  const { data, failed, retry } = useLoad<TvTropesMapping[]>(getTvTropesMappings);
  return (
    <Page title={ru.curator.mappingsTitle} failed={failed} retry={retry} ready={!!data}>
      {data ? <MappingTable rows={data} /> : null}
    </Page>
  );
}

/** Кандидаты в источники (/curator/sources): кого читают те, кого читаем мы. */
export function SourcesScreen() {
  const { data, failed, retry } = useLoad<SourceCandidate[]>(getSourceCandidates);
  return (
    <Page title={ru.curator.sourcesTitle} lead={ru.curator.sourcesLead} failed={failed} retry={retry} ready={!!data}>
      {data && data.length ? <SourceTable rows={data} /> : null}
      {data && !data.length ? <EmptyState title={ru.curator.sourcesEmpty} text={ru.curator.sourcesEmptyText} /> : null}
    </Page>
  );
}
