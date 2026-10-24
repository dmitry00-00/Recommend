import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { FeedKind, JourneyEntryData, JourneyStatus } from '@/types/tmdf';
import { getJourney, startWork, unplanWork } from '@/api';
import { BackLink, Button, EmptyState, FilterMenu, KindFilter, ErrorState, FilmEdge, FilmTabs, QuickMark, Skeleton, WorkBanner, WorkSheet, useToast } from '@/components';
import { useDiary } from '@/lib/settingsStore';
import { tap } from '@/lib/telegram';
import { useBooks } from '@/lib/flags';
import { formatDate, titleOf } from '@/lib/format';
import { leadName } from '@/lib/credits';
import { WorkPlaces, placesCount, usePlaces } from './WorkPlaces';
import ui from '@/i18n';

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
  const diary = useDiary();
  const toast = useToast();
  // фильтры (11.10): в архиве вперемешку планы, начатое, законченное и брошенное, кино и книги — без фильтра
  // планы среди сотни записей не найти. Род — за флагом книг, как лента книг
  const booksOn = useBooks(); // книги: readShelf или книжный вход (23.10, src/lib/flags.ts)
  const [status, setStatus] = useState<JourneyStatus | null>(null);
  const [kind, setKind] = useState<FeedKind | null>(null);

  useEffect(() => {
    let alive = true;
    setEntries(null);
    setFailed(false);
    getJourney().then((e) => alive && setEntries(e)).catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, [attempt]);

  const meta = (e: JourneyEntryData) => [
    formatDate(e.finishedAt ?? e.startedAt),
    ui.journeyStatus[e.status].toLowerCase(),
    e.status === 'planned' && e.eagerness ? ui.feed.wantMeta(e.eagerness) : null,
    e.perceivedDifficulty ? ui.difficulty[e.perceivedDifficulty].toLowerCase() : null,
  ].filter(Boolean).join(' · ');

  const kindOf = (e: JourneyEntryData): FeedKind => (e.work.type === 'book' ? 'book' : 'screen');
  const count = <K extends string>(list: JourneyEntryData[], key: (e: JourneyEntryData) => K) =>
    list.reduce((m, e) => m.set(key(e), (m.get(key(e)) ?? 0) + 1), new Map<K, number>());
  // счётчики статусов — внутри выбранного рода: число в листе — сколько строка покажет
  const ofKind = (entries ?? []).filter((e) => !kind || kindOf(e) === kind);
  const byStatus = count(ofKind, (e) => e.status);
  const STATUSES: JourneyStatus[] = ['planned', 'in_progress', 'finished', 'abandoned'];
  // какие фильтры есть — по всему архиву, чтобы шапка не прыгала при выборе; числа — с учётом другого фильтра
  const all = entries ?? [];
  const statusChips = STATUSES.filter((s) => all.some((e) => e.status === s));
  const kindChips = booksOn ? (['screen', 'book'] as FeedKind[]).filter((k) => all.some((e) => kindOf(e) === k)) : [];
  const shown = (entries ?? []).filter((e) => (!status || e.status === status) && (!kind || kindOf(e) === kind));
  const openEntry = entries?.find((e) => e.id === open) ?? null;
  const places = usePlaces(openEntry?.work.id);
  // переход в кинотеатр из отложенного — «вероятно, смотрит», как в ленте; список перечитаем,
  // когда карточку закроют
  const [restart, setRestart] = useState(false);
  const close = () => { setOpen(null); if (restart) { setRestart(false); setAttempt((a) => a + 1); } };
  const watchFrom = (e: JourneyEntryData) => {
    if (e.status !== 'planned') return;
    startWork(e.work.id, undefined, { inferred: true })
      .then(() => { setRestart(true); toast({ text: ui.toast.watchInferred }); })
      .catch(() => undefined);
  };
  const unplan = (e: JourneyEntryData) => {
    tap();
    unplanWork(e.id)
      .then(() => { close(); setEntries((list) => list?.filter((x) => x.id !== e.id) ?? null); toast({ text: ui.toast.unplanned }); })
      .catch(() => toast({ text: ui.settings.errorSave }));
  };
  return (
    <main className="tm-shell__main tm-archive">
      {/* шапка (17.10): «‹ Лента» — только вне Telegram (там есть его «Назад»), вводный текст убран; фильтры — справа
          от заголовка: «Всё ▾» со статусами листом и тоггл рода вместо двух рядов чипов по 24 px */}
      <div className="tm-archive__head">
        <BackLink to="/today" label={ui.feed.toFeed} className="tm-archive__back" />
        <h1 className="tm-title-3 tm-archive__title">{ui.feed.archiveTitle}</h1>
        {statusChips.length > 1 ? (
          <FilterMenu<JourneyStatus> label={status ? ui.journal.statusFilter[status] : ui.journal.statusAll} title={ui.journal.filterStatus}
                      value={status} onChange={setStatus}
                      options={[{ key: null, label: ui.journal.statusAll, count: ofKind.length },
                                ...statusChips.map((s) => ({ key: s, label: ui.journal.statusFilter[s], count: byStatus.get(s) ?? 0 }))]} />
        ) : null}
        {kindChips.length > 1 ? <KindFilter value={kind} onChange={setKind} /> : null}
      </div>

      {failed ? (
        <div className="tm-stream__pad">
          <ErrorState title={ui.journal.errorList} text={ui.journal.errorText} onRetry={() => setAttempt(attempt + 1)} />
        </div>
      ) : null}

      {!entries && !failed ? (
        <div aria-busy="true">
          <span className="tm-sr">{ui.journal.loading}</span>
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} kind="block" style={{ height: 110, marginTop: i ? 2 : 0 }} />)}
        </div>
      ) : null}

      {entries && !entries.length ? (
        <div className="tm-stream__pad">
          <EmptyState title={ui.state.emptyJournal} text={ui.state.emptyJournalText}
                      action={ui.nav.today} onAction={() => navigate('/today')} />
        </div>
      ) : null}

      {entries?.length && !shown.length ? <p className="tm-caption tm-archive__lead">{ui.journal.filterEmpty}</p> : null}

      {shown.length ? <div className="tm-filmstrip">{shown.map((e, i) => (
        <div key={e.id} className="tm-archive__item">
          <FilmEdge work={e.work} no={i + 1} short />
          <WorkBanner work={e.work} size="sm" meta={meta(e)}
                      tag={e.status === 'in_progress' || e.status === 'planned' ? ui.journeyStatus[e.status] : undefined}
                      onClick={() => setOpen(e.id)} />
        </div>
      ))}</div> : null}

      <WorkSheet work={openEntry?.work ?? null} open={openEntry != null} onOpenChange={(o) => !o && close()}
                 context="архив"
                 meta={openEntry ? [openEntry.work.year, leadName(openEntry.work),
                                    openEntry.status === 'planned' && openEntry.eagerness ? ui.feed.wantMeta(openEntry.eagerness) : null,
                                   ].filter(Boolean).join(' · ') : undefined}
                 tag={openEntry?.status === 'in_progress' || openEntry?.status === 'planned' ? ui.journeyStatus[openEntry.status] : undefined}>
        {openEntry ? (
          <div className="tm-stream__panel tm-stream__panel--tabs">
            <FilmTabs key={openEntry.id} workId={openEntry.work.id} analyses={openEntry.analyses ?? []} workTitle={titleOf(openEntry.work)} spoilerLevel={openEntry.status === 'finished' ? 2 : 0}
                      seen={openEntry.status === 'finished'}
                      watch={openEntry.work.watch} onWatch={() => watchFrom(openEntry)}
                      discussionsCount={placesCount(places)} discussions={<WorkPlaces places={places} finished={openEntry.status === 'finished'} />}
                      book={openEntry.work.type === 'book' ? openEntry.work : undefined}
                      // Карточка архива статична (24.09): ни строки статуса, ни «Открыть запись»,
                      // ни «Начать смотреть». У отложенного — только «Убрать из планов», в углу
                      // облегчённый учёт (02.10): из планов и начатого — сразу «посмотрел» с оценкой или «бросил»
                      corner={!diary && (openEntry.status === 'planned' || openEntry.status === 'in_progress') ? (
                        <QuickMark work={openEntry.work} onDone={() => { setOpen(null); setAttempt((a) => a + 1); }}
                                   extra={openEntry.status === 'planned'
                                     ? <Button variant="quiet" size="sm" onClick={() => unplan(openEntry)}>{ui.feed.unplan}</Button> : undefined} />
                      ) : openEntry.status === 'planned' ? (
                        <Button variant="quiet" size="sm" onClick={() => unplan(openEntry)}>{ui.feed.unplan}</Button>
                      ) : openEntry.status === 'in_progress' && (openEntry.work.type === 'book' || openEntry.work.type === 'series') ? (
                        // сериал и книга в процессе — сезон, часть, страница на странице записи (Е3, З5)
                        <Button variant="quiet" size="sm" onClick={() => navigate(`/journal/${openEntry.id}`)}>{ui.feed.whereNow}</Button>
                      ) : undefined} />
          </div>
        ) : null}
      </WorkSheet>
    </main>
  );
}
