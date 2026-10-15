import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { WorkCard } from '@/types/tmdf';
import { getPrerequisite, type PrevPart } from '@/api';
import { hurdlesOf } from '@/lib/hurdles';
import { titleOf } from '@/lib/format';
import { tap } from '@/lib/telegram';
import ui from '@/i18n';

/** «Что может мешать» в шторке (ДФ-7, 14.10): свёрнутая строка с короткими словами («неспешный · чёрно-белый ·
 *  2 ч 50 мин»), по тапу — предметно, по пункту в строке, и предупреждения о содержании. Над ней — предыдущая часть,
 *  если её не видели: «Лучше после „Чужого“ (1979), можно и без» — это не барьер, а совет, поэтому видна сразу.
 *  Нечего сказать — ничего не рисует. */
export function Hurdles({ work }: { work: WorkCard }) {
  const [open, setOpen] = useState(false);
  const [prev, setPrev] = useState<PrevPart>();
  const { form, warnings } = useMemo(() => hurdlesOf(work), [work]);
  useEffect(() => {
    let alive = true;
    setOpen(false);
    setPrev(undefined);
    getPrerequisite(work).then((p) => { if (alive) setPrev(p); }).catch(() => undefined);
    return () => { alive = false; };
  }, [work.id]);
  const summary = [...form.map((h) => h.short), ...warnings].join(' · ');
  if (!prev && !summary) return null;
  const prevTitle = prev ? `«${prev.work ? titleOf(prev.work) : prev.title}»` : '';
  return (
    <section className="tm-hurdles">
      {prev ? (
        <p className="tm-caption tm-hurdles__prev">
          {`${ui.hurdles.after} `}
          {prev.work ? <Link to={`/works/${prev.work.id}`}>{prevTitle}</Link> : prevTitle}
          {`${prev.year ? ` (${prev.year})` : ''}, ${ui.hurdles.afterTail}`}
        </p>
      ) : null}
      {summary ? (
        <>
          <button type="button" className="tm-hurdles__toggle" aria-expanded={open} onClick={() => { tap(); setOpen(!open); }}>
            <span className="tm-hurdles__title">{ui.hurdles.title}</span>
            {open ? null : <span className="tm-hurdles__sum">{summary}</span>}
            <span className="tm-hurdles__chevron" aria-hidden="true">{open ? '▴' : '▾'}</span>
          </button>
          {open ? (
            <ul className="tm-hurdles__list">
              {form.map((h) => <li key={h.text}>{h.text}</li>)}
              {warnings.length ? <li className="tm-hurdles__content">{ui.hurdles.content(warnings.join(', '))}</li> : null}
            </ul>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
