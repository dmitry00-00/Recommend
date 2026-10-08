import type { AgreementReport } from '@/types/tmdf';
import { cx } from '@/lib/cx';
import ui from '@/i18n';

export interface AgreementMatrixProps {
  rows: AgreementReport[];
  caption?: string;
  example?: string;
}

const GROUPS: AgreementReport['raterGroup'][] = ['experts', 'community', 'all'];
const TONE: Record<AgreementReport['status'], 'ok' | 'wait' | 'stop'> = { reliable: 'ok', tentative: 'wait', unreliable: 'stop' };

/** Согласованность по полям: α Криппендорфа по группам оценщиков, со статусом и числом людей. */
export function AgreementMatrix({ rows, caption, example }: AgreementMatrixProps) {
  const fields = rows.reduce<string[]>((acc, r) => (acc.includes(r.field) ? acc : [...acc, r.field]), []);
  return (
    <div className="tm-table__wrap">
      <table className="tm-table tm-table--matrix">
        <caption>{caption ?? ui.curator.matrixCaption}</caption>
        <thead>
          <tr>
            <th scope="col">{ui.curator.matrixField}</th>
            {GROUPS.map((g) => <th key={g} scope="col">{ui.curator.raterGroup[g]}</th>)}
          </tr>
        </thead>
        <tbody>
          {fields.map((f) => (
            <tr key={f}>
              <th scope="row"><code>{f}</code></th>
              {GROUPS.map((g) => {
                const cell = rows.find((r) => r.field === f && r.raterGroup === g);
                if (!cell) return <td key={g} className="tm-table__num">—</td>;
                return (
                  <td key={g} className="tm-table__num">
                    <span className={cx('tm-alpha', `tm-alpha--${TONE[cell.status]}`)}>{cell.alpha.toFixed(2)}</span>
                    <span className="tm-table__sub">{`${ui.curator.agreementStatus[cell.status]} · ${cell.raters}`}</span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {example ? <p className="tm-matrix__example">{example}</p> : null}
    </div>
  );
}
