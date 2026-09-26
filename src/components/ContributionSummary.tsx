import type { ContributorProfile } from '@/types/tmdf';
import { pluralRu } from '@/lib/format';
import ru from '@/i18n/ru';

export interface ContributionSummaryProps {
  contributor: ContributorProfile;
}

/** Ваш вклад: сколько произведений и ответов, какие шкалы уточнены, как подписан. Ни очков,
 *  ни рейтингов, ни уровней — и это сказано прямо. */
export function ContributionSummary({ contributor: c }: ContributionSummaryProps) {
  const { worksCovered, tasksCompleted, scalesRefined } = c.contribution;
  return (
    <section className="tm-contrib">
      <h3 className="tm-contrib__title">{ru.contribute.yourContribution}</h3>
      <ul className="tm-contrib__list">
        <li><span className="tm-contrib__n">{worksCovered}</span>{` ${pluralRu(worksCovered, ...ru.contribute.worksCovered)}`}</li>
        <li><span className="tm-contrib__n">{tasksCompleted}</span>{` ${pluralRu(tasksCompleted, ...ru.contribute.answers)}`}</li>
        {scalesRefined.length ? <li>{`${ru.contribute.scalesRefined}: ${scalesRefined.join(', ')}`}</li> : null}
      </ul>
      <p className="tm-contrib__credit">
        {c.creditConsent === 'public_name' ? ru.contribute.creditPublic(c.displayName) : ru.contribute.creditAnonymous}
      </p>
      <p className="tm-contrib__no">{ru.contribute.noScores}</p>
    </section>
  );
}
