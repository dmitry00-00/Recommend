import type { ContributorProfile } from '@/types/tmdf';
import ui, { plural } from '@/i18n';

export interface ContributionSummaryProps {
  contributor: ContributorProfile;
}

/** Ваш вклад: сколько произведений и ответов, какие шкалы уточнены, как подписан. Ни очков,
 *  ни рейтингов, ни уровней — и это сказано прямо. */
export function ContributionSummary({ contributor: c }: ContributionSummaryProps) {
  const { worksCovered, tasksCompleted, scalesRefined } = c.contribution;
  return (
    <section className="tm-contrib">
      <h3 className="tm-contrib__title">{ui.contribute.yourContribution}</h3>
      <ul className="tm-contrib__list">
        <li><span className="tm-contrib__n">{worksCovered}</span>{` ${plural(worksCovered, ...ui.contribute.worksCovered)}`}</li>
        <li><span className="tm-contrib__n">{tasksCompleted}</span>{` ${plural(tasksCompleted, ...ui.contribute.answers)}`}</li>
        {scalesRefined.length ? <li>{`${ui.contribute.scalesRefined}: ${scalesRefined.join(', ')}`}</li> : null}
      </ul>
      <p className="tm-contrib__credit">
        {c.creditConsent === 'public_name' ? ui.contribute.creditPublic(c.displayName) : ui.contribute.creditAnonymous}
      </p>
      <p className="tm-contrib__no">{ui.contribute.noScores}</p>
    </section>
  );
}
