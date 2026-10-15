import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { WorkCard } from '@/types/tmdf';
import { getPrerequisite, getWorkLinks, type PrevPart, type WorkLinks } from '@/api';
import { hurdlesOf } from '@/lib/hurdles';
import { isSeries } from '@/lib/media';
import { titleOf } from '@/lib/format';
import { useFeature } from '@/lib/flags';
import { tap } from '@/lib/telegram';
import ui from '@/i18n';

interface Chip { icon: string; text: string; to?: string }

/** Паспорт карточки по глубине (15.10): первый уровень — посмотреть и понять, что это за вещь, ничего не читая.
 *  Только факты о произведении, не о материалах (их счёт — на переключателе зон): длина, форма («неспешный»,
 *  «чёрно-белый»), предупреждения, откуда оно (книга, комикс, ремейк), вселенная, а тому, что ещё предлагают, —
 *  предыдущая часть. «Подробнее» раскрывает форму и предупреждения словами (то же, что «Что может мешать», ДФ-7).
 *  Нечего сказать — ничего не рисует. */
export function Passport({ work, hurdles }: { work: WorkCard; hurdles?: boolean }) {
  const pages = useFeature('pages');
  const [links, setLinks] = useState<WorkLinks>({});
  const [prev, setPrev] = useState<PrevPart>();
  const [open, setOpen] = useState(false);
  const { form, warnings } = useMemo(() => hurdlesOf(work), [work]);
  useEffect(() => {
    let alive = true;
    setLinks({}); setPrev(undefined); setOpen(false);
    getWorkLinks(work).then((l) => { if (alive) setLinks(l); }).catch(() => undefined);
    if (hurdles) getPrerequisite(work).then((p) => { if (alive) setPrev(p); }).catch(() => undefined);
    return () => { alive = false; };
  }, [work.id, hurdles]); // eslint-disable-line react-hooks/exhaustive-deps

  const chips: Chip[] = [];
  const minutes = !isSeries(work) && work.type !== 'book' ? work.durationMinutes : undefined;
  if (minutes) chips.push({ icon: '⏱', text: ui.hurdles.hm(Math.floor(minutes / 60), minutes % 60) });
  if (isSeries(work) && work.series?.seasons) chips.push({ icon: '⏱', text: ui.depth.seasons(work.series.seasons) });
  if (work.type === 'book' && work.pages) chips.push({ icon: '⏱', text: ui.units.pages(work.pages) });
  // долгий хронометраж уже в длине — второй раз не называем
  for (const h of form) if (!(minutes && h.short === chips[0]?.text)) chips.push({ icon: '◐', text: h.short });
  if (warnings.length) chips.push({ icon: '⚠', text: warnings.join(', ') });
  if (links.basedOn) chips.push({ icon: '📖', text: ui.depth.basedOn(links.basedOn.kind, links.basedOn.title), to: links.basedOn.workId && `/works/${links.basedOn.workId}` });
  if (links.remakeOf) chips.push({ icon: '↺', text: ui.depth.remake(links.remakeOf.title), to: links.remakeOf.workId && `/works/${links.remakeOf.workId}` });
  if (links.universe) chips.push({ icon: '✦', text: ui.depth.universe(links.universe.title), to: pages ? `/universe/${links.universe.id}` : undefined });
  if (prev) chips.push({ icon: '⏮', text: ui.depth.after(prev.work ? titleOf(prev.work) : prev.title), to: prev.work && `/works/${prev.work.id}` });
  if (!chips.length) return null;

  const details = form.length > 0 || warnings.length > 0;
  const chip = (c: Chip): ReactNode => {
    const body = <><span className="tm-passport__icon" aria-hidden="true">{c.icon}</span>{c.text}</>;
    return (
      <li key={`${c.icon}${c.text}`} className="tm-passport__chip">
        {c.to ? <Link to={c.to} className="tm-passport__link">{body}</Link> : body}
      </li>
    );
  };
  return (
    <section className="tm-passport" aria-label={ui.depth.passport}>
      <ul className="tm-passport__row">
        {chips.map(chip)}
        {details ? (
          <li className="tm-passport__chip tm-passport__more">
            <button type="button" aria-expanded={open} onClick={() => { tap(); setOpen(!open); }}>{ui.depth.more} {open ? '▴' : '▾'}</button>
          </li>
        ) : null}
      </ul>
      {open ? (
        <ul className="tm-hurdles__list">
          {form.map((h) => <li key={h.text}>{h.text}</li>)}
          {warnings.length ? <li className="tm-hurdles__content">{ui.hurdles.content(warnings.join(', '))}</li> : null}
        </ul>
      ) : null}
    </section>
  );
}
