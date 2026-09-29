import type { QualityMetric } from '@/types/tmdf';
import { cx } from '@/lib/cx';
import ru from '@/i18n/ru';

export interface MetricsTableProps {
  rows: QualityMetric[];
  caption?: string;
}

/** Качество по слоям и источникам против эталона: α, потолок человека, пригоден или нет. */
export function MetricsTable({ rows, caption }: MetricsTableProps) {
  return (
    <div className="tm-table__wrap">
      <table className="tm-table tm-table--metrics">
        <caption>{caption ?? ru.curator.metricsCaption}</caption>
        <thead><tr>{ru.curator.metricsCols.map((t) => <th key={t} scope="col">{t}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <th scope="row">{r.layer}</th>
              <td>{ru.annotationProvider[r.provider] ?? r.provider}</td>
              <td className="tm-table__num">{r.alpha.toFixed(2)}</td>
              <td className="tm-table__num">{r.ceiling.toFixed(2)}</td>
              <td><span className={cx('tm-verdict', r.fit ? 'tm-verdict--ok' : 'tm-verdict--stop')}>{r.fit ? ru.curator.fit : ru.curator.unfit}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
