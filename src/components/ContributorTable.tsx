import type { ContributorProfile, ID } from '@/types/tmdf';
import ru from '@/i18n/ru';

export interface ContributorTableProps {
  contributors: ContributorProfile[];
  /** надёжность против эталона — видна только куратору */
  reliability?: Record<ID, string>;
}

/** Участники: роль, как подписан вклад, объём, надёжность. Надёжность — служебная, участнику не показывается. */
export function ContributorTable({ contributors, reliability }: ContributorTableProps) {
  return (
    <div className="tm-table__wrap">
      <table className="tm-table">
        <caption>{ru.curator.contributorsCaption}</caption>
        <thead><tr>{ru.curator.contributorsCols.map((t) => <th key={t} scope="col">{t}</th>)}</tr></thead>
        <tbody>
          {contributors.map((c) => (
            <tr key={c.id}>
              <th scope="row">{c.displayName}{c.bio ? <span className="tm-table__sub">{c.bio}</span> : null}</th>
              <td>{ru.curator.role[c.role]}</td>
              <td>{ru.curator.credit[c.creditConsent]}</td>
              <td className="tm-table__num">{c.contribution.tasksCompleted}</td>
              <td className="tm-table__num">{c.contribution.worksCovered}</td>
              <td className="tm-table__num">
                <span className="tm-table__private">{reliability?.[c.id] ?? '—'}</span>
                <span className="tm-table__sub">{ru.curator.curatorOnly}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
