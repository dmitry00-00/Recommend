import type { PacketReport } from '@/types/tmdf';
import { cx } from '@/lib/cx';
import ru from '@/i18n/ru';

export interface PacketImportReportProps {
  report: PacketReport;
}

/** Отчёт о загрузке пакета: сколько файлов прошли, по каждому — результат и что дальше. */
export function PacketImportReport({ report: r }: PacketImportReportProps) {
  return (
    <section className="tm-import">
      <div className="tm-row tm-row--gap-2 tm-import__head">
        <h4 className="tm-import__title">{ru.curator.packet(r.packetId)}</h4>
        <span className="tm-import__sum">{ru.curator.filesPassed(r.passed, r.files)}</span>
      </div>
      <div className="tm-table__wrap">
        <table className="tm-table">
          <thead><tr>{ru.curator.importCols.map((t) => <th key={t} scope="col">{t}</th>)}</tr></thead>
          <tbody>
            {r.rows.map((row) => (
              <tr key={row.file}>
                <th scope="row"><code>{row.file}</code></th>
                <td><span className={cx('tm-verdict', row.status === 'ok' ? 'tm-verdict--ok' : 'tm-verdict--stop')}>{row.status === 'ok' ? ru.curator.accepted : ru.curator.rejectedFile}</span></td>
                <td>{row.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
