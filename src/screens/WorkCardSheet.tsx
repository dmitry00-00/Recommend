import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { DiscussionPlace, SpoilerLevel, WorkCard, WorkDetail } from '@/types/tmdf';
import { getDiscussions, getSettings, getWork } from '@/api';
import { FilmTabs, WorkSheet } from '@/components';
import { formatDuration } from '@/lib/format';
import { leadName } from '@/lib/credits';
import { WorkPlaces, placesCount } from './WorkPlaces';
import ui from '@/i18n';

export interface WorkCardSheetProps {
  /** что открыть; null — закрыто */
  work: WorkCard | null;
  onClose: () => void;
  /** видел ли человек: тогда разборы открыты без штриховки спойлеров */
  seen?: boolean;
  tag?: string;
  /** действия в углу под материалом: «смотрел», «смотрю», «в планы» — у каждого экрана свои */
  corner?: ReactNode;
  /** переход в онлайн-кинотеатр — экран может отметить «вероятно, смотрит» */
  onWatch?: () => void;
  /** где открыта: для сообщения о неточности */
  context?: string;
}

/** Карточка найденного и просмотренного (02.10, решение владельца) — того же вида, что карточка
 *  рекомендации в ленте и записи в архиве: кадр сверху, ниже статичные «Обзоры / Обсуждения /
 *  Смотреть». Разборы и места разговора приходят запросом при открытии: у строки поиска их нет.
 *  Полная страница произведения (связи, герои, приёмы, статистика) — ссылкой «Подробнее». */
export function WorkCardSheet({ work, onClose, seen, tag, corner, onWatch, context }: WorkCardSheetProps) {
  const [detail, setDetail] = useState<WorkDetail | null>(null);
  const [places, setPlaces] = useState<DiscussionPlace[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [spoilers, setSpoilers] = useState<SpoilerLevel>(0);
  useEffect(() => { getSettings().then((s) => setSpoilers(s.spoilerLevel)).catch(() => undefined); }, []);
  useEffect(() => {
    let alive = true;
    setDetail(null);
    setPlaces([]);
    setLoaded(false);
    if (!work) return;
    Promise.all([getWork(work.id), getDiscussions(work.id)])
      .then(([d, p]) => { if (alive) { setDetail(d ?? null); setPlaces(p); } })
      .catch(() => undefined)
      .finally(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
  }, [work?.id]);

  const shown = detail ?? work;
  const meta = shown ? [shown.year, leadName(shown), formatDuration(shown.durationMinutes)].filter(Boolean).join(' · ') : undefined;
  return (
    <WorkSheet work={shown} open={work != null} onOpenChange={(o) => { if (!o) onClose(); }} tag={tag} meta={meta}
               plot={detail?.synopsis || undefined} context={context}>
      {shown ? (
        <div className="tm-stream__panel tm-stream__panel--tabs">
          <FilmTabs key={`${shown.id}:${detail ? 1 : 0}`} workId={shown.id} analyses={detail?.externalAnalyses ?? []} workTitle={shown.title}
                    spoilerLevel={seen ? 2 : spoilers} watch={shown.watch} onWatch={onWatch}
                    book={shown.type === 'book' ? shown : undefined}
                    loading={!loaded}
                    discussionsCount={placesCount(places)}
                    discussions={<WorkPlaces places={places} finished={Boolean(seen)} />}
                    corner={(
                      <>
                        {corner}
                        <Link className="tm-btn tm-btn--quiet tm-btn--sm" to={`/works/${shown.id}`}>{ui.card.more}</Link>
                      </>
                    )} />
        </div>
      ) : null}
    </WorkSheet>
  );
}
