import type { ContributorTask } from '@/types/tmdf';
import { Button } from './Button';
import ui from '@/i18n';
import { titleOf } from '@/lib/format';

export interface TaskFeedProps {
  tasks: ContributorTask[];
  title?: string;
  onlyMine?: boolean;
  onOnlyMine?: (value: boolean) => void;
  onOpen?: (task: ContributorTask) => void;
}

/** Строка задания: вид, о чём, сколько займёт. */
function taskWork(task: ContributorTask): string {
  const p = task.payload;
  return p.kind === 'pairwise' ? `${p.left.title} / ${p.right.title}` : titleOf(p.work);
}

/** Лента заданий участника: коллега коллеге, без очков и чужих ответов. Фильтр «только то,
 *  что я разбирал(а)» — для тех, кто пришёл со своим списком. */
export function TaskFeed({ tasks, title, onlyMine = false, onOnlyMine, onOpen }: TaskFeedProps) {
  return (
    <div className="tm-feed">
      <div className="tm-feed__head">
        <h3 className="tm-feed__title">{title ?? ui.contribute.tasks}</h3>
        <label className="tm-feed__filter">
          <input type="checkbox" checked={onlyMine} onChange={(e) => onOnlyMine?.(e.target.checked)} />
          <span>{ui.contribute.onlyMine}</span>
        </label>
      </div>
      <ul className="tm-feed__list">
        {tasks.map((t) => (
          <li key={t.id} className="tm-feed__item">
            <div>
              <p className="tm-feed__kind">{ui.contributorTaskKind[t.kind]}</p>
              <p className="tm-feed__work">{taskWork(t)}</p>
              <p className="tm-feed__est">{`≈ ${t.estimatedSeconds} ${ui.contribute.seconds}`}</p>
            </div>
            <Button size="sm" onClick={() => onOpen?.(t)}>{ui.contribute.open}</Button>
          </li>
        ))}
      </ul>
      <p className="tm-feed__stop">{ui.contribute.stopAnytime}</p>
    </div>
  );
}
