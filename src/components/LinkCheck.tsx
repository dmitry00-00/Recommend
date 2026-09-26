import type { ContributorAnswer, ContributorTask } from '@/types/tmdf';
import { Button } from './Button';
import { Meta } from './Meta';
import { onExternalClick } from '@/lib/telegram';
import { formatDuration } from '@/lib/format';
import ru from '@/i18n/ru';

export type LinkCheckTask = ContributorTask & { payload: Extract<ContributorTask['payload'], { kind: 'link_check' }> };
type Verdict = Extract<ContributorAnswer, { kind: 'link_check' }>['verdict'];

export interface LinkCheckProps {
  task: LinkCheckTask;
  onAnswer?: (verdict: Verdict) => void;
  onSkip?: () => void;
}

/** «Тот ли это фильм»: разбор, найденный автоматически по названию, против карточки
 *  произведения. Самое дешёвое задание в кабинете — но оно закрывает дыру, которую регексп
 *  закрыть не может: ролик про «Тёмного рыцаря» ловится на слово «Джокер». Ответ один, поэтому
 *  задание отправляет себя само, как сравнение пар. Сверх бандла: собрано на классах
 *  `ExternalAnalysisLink` и `PairwiseCompare`, своих стилей нет. */
export function LinkCheck({ task, onAnswer, onSkip }: LinkCheckProps) {
  const { work, analysis: a } = task.payload;
  return (
    <section className="tm-pairwise">
      <h3 className="tm-pairwise__q">{ru.contribute.linkQuestion(work.title, work.year)}</h3>
      <a className="tm-extlink tm-extlink--preview" href={a.url} target="_blank" rel="noreferrer noopener"
         onClick={onExternalClick(a.url)}>
        {a.previewUrl ? (
          <span className="tm-extlink__thumb"><img className="tm-extlink__img" src={a.previewUrl} alt="" loading="lazy" /></span>
        ) : null}
        <span className="tm-extlink__title">{a.title}</span>
        <Meta items={[a.author, a.durationMinutes ? formatDuration(a.durationMinutes) : ru.platform[a.platform]]} />
      </a>
      <p className="tm-caption tm-contribute__hint">{ru.contribute.linkHint}</p>
      <div className="tm-row tm-row--gap-2 tm-row--wrap tm-contribute__actions">
        <Button variant="primary" size="sm" onClick={() => onAnswer?.('about_this')}>{ru.contribute.linkYes}</Button>
        <Button size="sm" onClick={() => onAnswer?.('other_work')}>{ru.contribute.linkNo}</Button>
        <Button variant="quiet" size="sm" onClick={() => onAnswer?.('unsure')}>{ru.contribute.linkUnsure}</Button>
        <Button variant="quiet" size="sm" onClick={() => onSkip?.()}>{ru.actions.skip}</Button>
      </div>
    </section>
  );
}
