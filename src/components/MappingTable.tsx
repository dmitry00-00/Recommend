import type { TvTropesMapping } from '@/types/tmdf';
import { StatusTag } from './StatusTag';
import ru from '@/i18n/ru';

export interface MappingTableProps {
  rows: TvTropesMapping[];
}

/** Отображение TV Tropes → TMDF: троп-источник, наш троп, способ использования, статус,
 *  атрибуция (лицензия источника — обязательна). */
export function MappingTable({ rows }: MappingTableProps) {
  return (
    <div className="tm-table__wrap">
      <table className="tm-table">
        <caption>{ru.curator.mappingCaption}</caption>
        <thead><tr>{ru.curator.mappingCols.map((t) => <th key={t} scope="col">{t}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <th scope="row">{r.source}</th>
              <td>{r.target ?? <span className="tm-table__sub">{ru.curator.noMapping}</span>}</td>
              <td>{r.usage ? ru.tropeUsage[r.usage] : '—'}</td>
              <td><StatusTag status={r.status} /></td>
              <td><span className="tm-table__sub">{r.attribution}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
