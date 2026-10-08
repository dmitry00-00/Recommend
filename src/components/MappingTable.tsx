import type { TvTropesMapping } from '@/types/tmdf';
import { StatusTag } from './StatusTag';
import ui from '@/i18n';

export interface MappingTableProps {
  rows: TvTropesMapping[];
}

/** Отображение TV Tropes → TMDF: троп-источник, наш троп, способ использования, статус,
 *  атрибуция (лицензия источника — обязательна). */
export function MappingTable({ rows }: MappingTableProps) {
  return (
    <div className="tm-table__wrap">
      <table className="tm-table">
        <caption>{ui.curator.mappingCaption}</caption>
        <thead><tr>{ui.curator.mappingCols.map((t) => <th key={t} scope="col">{t}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <th scope="row">{r.source}</th>
              <td>{r.target ?? <span className="tm-table__sub">{ui.curator.noMapping}</span>}</td>
              <td>{r.usage ? ui.tropeUsage[r.usage] : '—'}</td>
              <td><StatusTag status={r.status} /></td>
              <td><span className="tm-table__sub">{r.attribution}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
