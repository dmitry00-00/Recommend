import type { AnnotationRun } from '@/types/tmdf';
import { StatusTag } from './StatusTag';
import { Meta } from './Meta';
import ui, { locale } from '@/i18n';

export interface RunProgressProps {
  run: AnnotationRun;
}

/** Прогон разметки: полоса, сколько из скольких, источник, токены, время, стоимость, ошибки. */
export function RunProgress({ run: r }: RunProgressProps) {
  const pct = r.total ? Math.round((r.done / r.total) * 100) : 0;
  return (
    <div className="tm-run">
      <div className="tm-row tm-row--gap-2 tm-run__head">
        <h4 className="tm-run__title">{r.title}</h4>
        <StatusTag status={r.status} />
      </div>
      <div className="tm-run__bar" role="progressbar" aria-valuemin={0} aria-valuemax={r.total} aria-valuenow={r.done}>
        <span className="tm-run__fill" style={{ width: `${pct}%` }} />
      </div>
      <Meta items={[
        ui.curator.runOf(r.done, r.total),
        ui.annotationProvider[r.provider],
        r.tokens ? `${r.tokens.toLocaleString(locale)} ${ui.curator.tokens}` : null,
        r.seconds ? `${r.seconds} ${ui.curator.seconds}` : null,
        r.costUsd ? `$${r.costUsd.toFixed(2)}` : null,
      ]} />
      {r.errors?.length ? <ul className="tm-run__errors">{r.errors.map((e, i) => <li key={i}>{e}</li>)}</ul> : null}
    </div>
  );
}
