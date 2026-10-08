import { useEffect, useState } from 'react';
import type { DiscussionPlace } from '@/types/tmdf';
import { getDiscussions } from '@/api';
import { DiscussionLink } from '@/components';
import { onExternalClick, tap } from '@/lib/telegram';
import ui from '@/i18n';

/** Места разговора о произведении для вкладки «Обсуждения» шторки (ТВ-5г, 06.10): то же, что
 *  блок «Где об этом говорили» на полной странице. Лента получает их вместе с подборкой,
 *  остальные шторки (смотрю сейчас, архив) — спрашивают сами при открытии. */
export function usePlaces(workId: string | undefined): DiscussionPlace[] {
  const [places, setPlaces] = useState<DiscussionPlace[]>([]);
  useEffect(() => {
    let alive = true;
    setPlaces([]);
    if (workId) getDiscussions(workId).then((p) => { if (alive) setPlaces(p); }).catch(() => undefined);
    return () => { alive = false; };
  }, [workId]);
  return places;
}

/** Конкретные ветки — блоками (о финале — под замком до конца просмотра), поиск по каналам и
 *  чаты — одной строкой внизу. */
export function WorkPlaces({ places, finished }: { places: DiscussionPlace[]; finished: boolean }) {
  const near = places.filter((d) => !d.search);
  const searches = places.filter((d) => d.search);
  return (
    <>
      {near.length ? (
        <section className="tm-stream__group">
          <h3 className="tm-label tm-stream__grouplabel">{ui.feed.telegram}</h3>
          {near.map((d) => <DiscussionLink key={d.id} discussion={d} locked={d.spoilers && !finished} />)}
        </section>
      ) : null}
      {searches.length ? <SearchLine places={searches} /> : null}
    </>
  );
}

/** Сколько конкретных веток — для счётчика на вкладке. */
export const placesCount = (places: DiscussionPlace[]): number => places.filter((d) => !d.search).length;

/** Две строки внизу карточки: поиск по каналам авторов (способ найти разбор) и места, где
 *  о кино говорят вообще (список владельца, 22.09). Ни то, ни другое не разбор, поэтому
 *  строками, а не блоками. Экран «Произведение» показывает их же под местами разговора. */
/** сколько каналов в строке видно сразу: тридцать названий через точку не читают (28.09) */
const SEARCH_SHOWN = 6;

export function SearchLine({ places }: { places: DiscussionPlace[] }) {
  const [all, setAll] = useState(false);
  const groups: { label: string; items: DiscussionPlace[] }[] = [
    { label: ui.discussion.searchLine, items: places.filter((d) => d.kind !== 'telegram_chat') },
    { label: ui.discussion.chatsLine, items: places.filter((d) => d.kind === 'telegram_chat') },
  ];
  return (
    <>
      {groups.filter((g) => g.items.length).map((g) => {
        const shown = all ? g.items : g.items.slice(0, SEARCH_SHOWN);
        const hidden = g.items.length - shown.length;
        return (
          <p key={g.label} className="tm-caption tm-stream__search">
            {g.label}
            {shown.map((d, i) => (
              <span key={d.id}>
                {i ? ' · ' : ' '}
                <a href={d.url} target="_blank" rel="noreferrer noopener" onClick={onExternalClick(d.url)}>{d.title}</a>
              </span>
            ))}
            {hidden > 0 ? <>{' · '}<button type="button" className="tm-search__link" onClick={() => { tap(); setAll(true); }}>{ui.feed.more(hidden)}</button></> : null}
          </p>
        );
      })}
    </>
  );
}
