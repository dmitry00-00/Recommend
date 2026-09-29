// Задания «тот ли это фильм» — из разборов, найденных автоматически: ролики (essaysAuto.ts)
// и посты каналов (postsAuto.ts).
// Регексп привязал ролик к фильму по названию; подтвердить или снять привязку должен человек.
// Текст задания — здесь, а не в слое данных: слой данных текстов не сочиняет.
import type { ContributorTask, ExternalAnalysis, WorkCard } from '@/types/tmdf';
import { essaysAuto } from './essaysAuto';
import { postsAuto } from './postsAuto';

const INSTRUCTIONS = 'Посмотрите на кадр и название ролика: он разбирает именно это произведение или просто упоминает его?';

/** По заданию на каждый непроверенный разбор; `works` — карточки по ключу разбора
 *  («tmdb:<id>» у фильма, «isbn:<isbn>» у книги).
 *  Порядок: сначала то, что участник видел сам или что стоит у него в подборе — эти разборы
 *  он увидит в карточках сегодня; справочник (959 фильмов из мастер-списка) — потом.
 *  `ownIds` — какие карточки считать своими. */
export function linkCheckTasks(works: Map<string, WorkCard>, ownIds?: Set<string>,
  /** индексы разборов: по умолчанию запечённые, с сервера — свежие (трек В1) */
  sources: Record<string, ExternalAnalysis[]>[] = [essaysAuto, postsAuto]): ContributorTask[] {
  const tasks: ContributorTask[] = [];
  const found: Record<string, typeof essaysAuto[string]> = {};
  for (const src of sources) {
    for (const [key, list] of Object.entries(src)) found[key] = [...(found[key] ?? []), ...list];
  }
  for (const [key, list] of Object.entries(found)) {
    const work = works.get(key);
    if (!work) continue;
    for (const analysis of list) {
      // подтверждённое уликой (год, ссылка, оригинальное название — tools/evidence.mts) людям
      // не отдаём: вопрос «тот ли это фильм» там уже решён
      if (!analysis.unverified) continue;
      tasks.push({
        id: `lc-${analysis.id}`,
        kind: 'link_check',
        instructions: INSTRUCTIONS,
        estimatedSeconds: 20,
        payload: { kind: 'link_check', work, analysis },
      });
    }
  }
  if (!ownIds) return tasks;
  const own = (t: ContributorTask) => (t.payload.kind === 'link_check' && ownIds.has(t.payload.work.id) ? 0 : 1);
  return tasks.sort((a, b) => own(a) - own(b));
}
