import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { JourneyEntryData } from '@/types/tmdf';
import { getJourney, startWork, unplanWork } from '@/api';
import { Button, EmptyState, ErrorState, FilmEdge, FilmTabs, Skeleton, WorkBanner, WorkSheet, useToast } from '@/components';
import { tap } from '@/lib/telegram';
import { formatDate } from '@/lib/format';
import ru from '@/i18n/ru';

/** Архив (/journal): всё просмотренное и прочитанное лентой баннеров, как архив чатов в
 *  Telegram; открывается из строки над лентой. Тап по записи — карточка в модальном окне
 *  (баннер сверху, описание, разборы, «где посмотреть» ниже), из неё — страница записи.
 *  Разборы здесь открыты: просмотр закончен, спойлеров бояться нечего. */
export function JournalScreen() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<JourneyEntryData[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    let alive = true;
    setEntries(null);
    setFailed(false);
    getJourney().then((e) => alive && setEntries(e)).catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, [attempt]);

  const meta = (e: JourneyEntryData) => [
    formatDate(e.finishedAt ?? e.startedAt),
    ru.journeyStatus[e.status].toLowerCase(),
    e.status === 'planned' && e.eagerness ? ru.feed.wantMeta(e.eagerness) : null,
    e.perceivedDifficulty ? ru.difficulty[e.perceivedDifficulty].toLowerCase() : null,
  ].filter(Boolean).join(' · ');

  const openEntry = entries?.find((e) => e.id === open) ?? null;
  // переход в кинотеатр из отложенного — «вероятно, смотрит», как в ленте; список перечитаем,
  // когда карточку закроют
  const [restart, setRestart] = useState(false);
  const close = () => { setOpen(null); if (restart) { setRestart(false); setAttempt((a) => a + 1); } };
  const watchFrom = (e: JourneyEntryData) => {
    if (e.status !== 'planned') return;
    startWork(e.work.id, undefined, { inferred: true })
      .then(() => { setRestart(true); toast({ text: ru.toast.watchInferred }); })
      .catch(() => undefined);
  };
  const unplan = (e: JourneyEntryData) => {
    tap();
    unplanWork(e.id)
      .then(() => { close(); setEntries((list) => list?.filter((x) => x.id !== e.id) ?? null); toast({ text: ru.toast.unplanned }); })
      .catch(() => toast({ text: ru.settings.errorSave }));
  };
  return (
    <main className="tm-shell__main tm-archive">
      <div className="tm-archive__head">
        <Link to="/today" className="tm-archive__back">{ru.feed.toFeed}</Link>
        <h1 className="tm-title-3 tm-archive__title">{ru.feed.archiveTitle}</h1>
      </div>
      <p className="tm-caption tm-archive__lead">{ru.feed.archiveLead}</p>

      {failed ? (
        <div className="tm-stream__pad">
          <ErrorState title={ru.journal.errorList} text={ru.journal.errorText} onRetry={() => setAttempt(attempt + 1)} />
        </div>
      ) : null}

      {!entries && !failed ? (
        <div aria-busy="true">
          <span className="tm-sr">{ru.journal.loading}</span>
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} kind="block" style={{ height: 110, marginTop: i ? 2 : 0 }} />)}
        </div>
      ) : null}

      {entries && !entries.length ? (
        <div className="tm-stream__pad">
          <EmptyState title={ru.state.emptyJournal} text={ru.state.emptyJournalText}
                      action={ru.nav.today} onAction={() => navigate('/today')} />
        </div>
      ) : null}

      {entries?.length ? <div className="tm-filmstrip">{entries.map((e, i) => (
        <div key={e.id} className="tm-archive__item">
          <FilmEdge work={e.work} no={i + 1} short />
          <WorkBanner work={e.work} size="sm" meta={meta(e)}
                      tag={e.status === 'in_progress' || e.status === 'planned' ? ru.journeyStatus[e.status] : undefined}
                      onClick={() => setOpen(e.id)} />
        </div>
      ))}</div> : null}

      <WorkSheet work={openEntry?.work ?? null} open={openEntry != null} onOpenChange={(o) => !o && close()}
                 meta={openEntry ? [openEntry.work.year, openEntry.work.creators[0],
                                    openEntry.status === 'planned' && openEntry.eagerness ? ru.feed.wantMeta(openEntry.eagerness) : null,
                                   ].filter(Boolean).join(' · ') : undefined}
                 tag={openEntry?.status === 'in_progress' || openEntry?.status === 'planned' ? ru.journeyStatus[openEntry.status] : undefined}>
        {openEntry ? (
          <div className="tm-stream__panel tm-stream__panel--tabs">
            <FilmTabs key={openEntry.id} analyses={openEntry.analyses ?? []} workTitle={openEntry.work.title} spoilerLevel={openEntry.status === 'finished' ? 2 : 0}
                      watch={openEntry.work.watch} onWatch={() => watchFrom(openEntry)}
                      book={openEntry.work.type === 'book' ? openEntry.work : undefined}
                      // Карточка архива статична (24.09): ни строки статуса, ни «Открыть запись»,
                      // ни «Начать смотреть». У отложенного — только «Убрать из планов», в углу
                      corner={openEntry.status === 'planned' ? (
                        <Button variant="quiet" size="sm" onClick={() => unplan(openEntry)}>{ru.feed.unplan}</Button>
                      ) : openEntry.status === 'in_progress' && (openEntry.work.type === 'book' || openEntry.work.type === 'series') ? (
                        // сериал и книга в процессе — сезон, часть, страница на странице записи (Е3, З5)
                        <Button variant="quiet" size="sm" onClick={() => navigate(`/journal/${openEntry.id}`)}>{ru.feed.whereNow}</Button>
                      ) : undefined} />
          </div>
        ) : null}
      </WorkSheet>
    </main>
  );
}
