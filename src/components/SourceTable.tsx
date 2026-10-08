import type { SourceCandidate } from '@/types/tmdf';
import { formatDate } from '@/lib/format';
import { onExternalClick } from '@/lib/telegram';
import ui from '@/i18n';

export interface SourceTableProps {
  rows: SourceCandidate[];
}

/** Кандидаты в источники: кого репостят и на кого ссылаются те, кого мы уже читаем.
 *  Репост стоит перед ссылкой, потому что он дороже: чужой текст поставили к себе в ленту.
 *  Строка поста показана целиком — по ней видно, в каком разговоре канал встретился, а это
 *  и есть то, что человеку надо решить: он про кино или попал за компанию. */
export function SourceTable({ rows }: SourceTableProps) {
  return (
    <div className="tm-table__wrap">
      <table className="tm-table">
        <caption>{ui.curator.sourcesCaption}</caption>
        <thead><tr>{ui.curator.sourceCols.map((t) => <th key={t} scope="col">{t}</th>)}</tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <th scope="row">
                {r.url
                  ? <a href={r.url} target="_blank" rel="noreferrer noopener" onClick={onExternalClick(r.url)}>{r.title}</a>
                  : r.title}
                {r.handle ? null : <span className="tm-table__sub"> {ui.curator.sourceNoHandle}</span>}
                {r.sample ? <span className="tm-table__sub">{r.sample}</span> : null}
              </th>
              <td>{r.reposts || '—'}</td>
              <td>{r.mentions || '—'}</td>
              <td><span className="tm-table__sub">{r.by.join(', ')}</span></td>
              <td>{formatDate(r.lastAt) ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
