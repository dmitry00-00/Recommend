import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { JourneyEntryData, ReflectionPromptData } from '@/types/tmdf';
import { getJourney, getReflectionPrompts, setBookProgress, setSeriesProgress } from '@/api';
import { Button, EmptyState, ErrorState, JourneyEntry, Skeleton, StateChangeNote, useToast } from '@/components';
import { isSeries } from '@/lib/media';
import { useMechanics } from '@/lib/settingsStore';
import ui from '@/i18n';

/** Экран «Запись дневника» (/journal/:entryId): запись, ваши ответы, что изменилось на карте. */
export function JournalEntryScreen() {
  const mechanics = useMechanics();
  const { entryId = '' } = useParams();
  const navigate = useNavigate();
  const [entry, setEntry] = useState<JourneyEntryData | null>(null);
  const [prompts, setPrompts] = useState<ReflectionPromptData[]>([]);
  const [missing, setMissing] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setEntry(null);
    setMissing(false);
    setFailed(false);
    Promise.all([getJourney(), getReflectionPrompts(entryId)])
      .then(([journal, p]) => {
        if (!alive) return;
        const found = journal.find((e) => e.id === entryId);
        if (!found) { setMissing(true); return; }
        setEntry(found);
        setPrompts(p);
      })
      .catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, [entryId, attempt]);

  if (failed) {
    return (
      <main className="tm-shell__main">
        <ErrorState title={ui.journal.errorOne} text={ui.journal.errorText} onRetry={() => setAttempt(attempt + 1)} />
      </main>
    );
  }
  if (missing) {
    return (
      <main className="tm-shell__main">
        <EmptyState title={ui.journal.notFound} text={ui.journal.notFoundText}
                    action={ui.nav.journal} onAction={() => navigate('/journal')} />
      </main>
    );
  }
  if (!entry) {
    return (
      <main className="tm-shell__main" aria-busy="true">
        <span className="tm-sr">{ui.journal.loading}</span>
        <div className="tm-entry">
          <Skeleton kind="cover" style={{ width: 84, height: 106 }} />
          <div style={{ flex: 1 }}>
            <Skeleton kind="title" style={{ width: '60%' }} />
            <Skeleton kind="line" style={{ width: '35%', marginTop: 8 }} />
          </div>
        </div>
      </main>
    );
  }

  const questionOf = (promptId: string) => prompts.find((p) => p.id === promptId)?.question;
  return (
    <main className="tm-shell__main">
      <JourneyEntry entry={entry} linkTo="work"
                    onFinish={() => navigate(`/journal/${entry.id}/check-in`)}
                    onAbandon={() => navigate(`/journal/${entry.id}/check-in?abandon=1`)} />
      <div className="tm-journal__sections">
        {entry.status === 'in_progress' && isSeries(entry.work) ? (
          <SeriesWhere entry={entry} onSaved={setEntry} />
        ) : null}
        {entry.status === 'in_progress' && entry.work.type === 'book' ? (
          <BookWhere entry={entry} onSaved={setEntry} />
        ) : null}
        <section className="tm-journal__section">
          <h2 className="tm-title-3">{ui.journal.reflections}</h2>
          {entry.reflections.length ? (
            <ul className="tm-journal__qa">
              {entry.reflections.map((r) => (
                <li key={r.promptId}>
                  {questionOf(r.promptId) ? <p className="tm-caption tm-journal__q">{questionOf(r.promptId)}</p> : null}
                  <p className="tm-body tm-journal__a">{r.answer}</p>
                </li>
              ))}
            </ul>
          ) : <p className="tm-caption tm-journal__hint">{entry.work.type === 'book' ? ui.journal.noReflectionsBook : ui.journal.noReflections}</p>}
        </section>
        {mechanics && entry.stateChanges.length ? (
          <section className="tm-journal__section">
            <h2 className="tm-title-3">{ui.journal.changes}</h2>
            {(['refined_estimate', 'observed_growth'] as const).map((kind) => {
              const ops = entry.stateChanges.filter((c) => c.changeType === kind).map((c) => c.op);
              return ops.length ? <StateChangeNote key={kind} changeType={kind} operations={ops} /> : null;
            })}
          </section>
        ) : null}
      </div>
    </main>
  );
}

/** «Где вы сейчас» у сериала (Е3): сезон и серия. Чек-ин — после сезона: кнопка «N сезон
 *  досмотрен» в записи ведёт в него, а здесь человек просто отмечает, докуда дошёл. */
function SeriesWhere({ entry, onSaved }: { entry: JourneyEntryData; onSaved: (e: JourneyEntryData) => void }) {
  const toast = useToast();
  const [season, setSeason] = useState(entry.seriesProgress?.season ?? 1);
  const [episode, setEpisode] = useState(entry.seriesProgress?.episode ?? 0);
  const [busy, setBusy] = useState(false);
  const maxSeason = entry.work.series?.seasons ?? 99;
  const changed = season !== (entry.seriesProgress?.season ?? 1) || episode !== (entry.seriesProgress?.episode ?? 0);
  const save = () => {
    setBusy(true);
    setSeriesProgress(entry.id, season, episode || undefined)
      .then((e) => { if (e) { onSaved(e); toast({ text: ui.seriesDiary.saved }); } })
      .catch(() => toast({ text: ui.settings.errorSave }))
      .finally(() => setBusy(false));
  };
  const stepper = (label: string, value: number, set: (n: number) => void, min: number, max: number) => (
    <div className="tm-row tm-row--gap-2 tm-serieswhere__row">
      <span className="tm-label tm-serieswhere__label">{label}</span>
      <Button size="sm" variant="quiet" aria-label={`${label}: ${ui.seriesDiary.less}`} disabled={value <= min} onClick={() => set(value - 1)}>−</Button>
      <span className="tm-title-3 tm-serieswhere__value" aria-live="polite">{value || '—'}</span>
      <Button size="sm" variant="quiet" aria-label={`${label}: ${ui.seriesDiary.more}`} disabled={value >= max} onClick={() => set(value + 1)}>+</Button>
    </div>
  );
  return (
    <section className="tm-journal__section tm-serieswhere">
      <h2 className="tm-title-3">{ui.seriesDiary.whereTitle}</h2>
      <p className="tm-caption tm-journal__hint">{ui.seriesDiary.whereHint}</p>
      {stepper(ui.seriesDiary.season, season, (n) => { setSeason(n); setEpisode(0); }, 1, maxSeason)}
      {stepper(ui.seriesDiary.episode, episode, setEpisode, 0, 999)}
      <Button size="sm" disabled={!changed} loading={busy} onClick={save}>{ui.seriesDiary.save}</Button>
    </section>
  );
}

/** «Где вы сейчас» у книги (З5): часть — если книга делится и хочется чек-ин после каждой;
 *  страница — просто закладка. Часть 0 = «не отмечаю части», тогда чек-ин один, в конце. */
function BookWhere({ entry, onSaved }: { entry: JourneyEntryData; onSaved: (e: JourneyEntryData) => void }) {
  const toast = useToast();
  const bp = entry.bookProgress;
  const [part, setPart] = useState(bp?.part ?? 0);
  const [page, setPage] = useState(bp?.page ?? 0);
  const [busy, setBusy] = useState(false);
  const pages = entry.work.pages;
  const changed = part !== (bp?.part ?? 0) || page !== (bp?.page ?? 0);
  const save = () => {
    setBusy(true);
    setBookProgress(entry.id, { part: part || undefined, page: page || undefined })
      .then((e) => { if (e) { onSaved(e); toast({ text: ui.seriesDiary.saved }); } })
      .catch(() => toast({ text: ui.settings.errorSave }))
      .finally(() => setBusy(false));
  };
  return (
    <section className="tm-journal__section tm-serieswhere">
      <h2 className="tm-title-3">{ui.bookDiary.whereTitle}</h2>
      <p className="tm-caption tm-journal__hint">{ui.bookDiary.whereHint}</p>
      <div className="tm-row tm-row--gap-2 tm-serieswhere__row">
        <span className="tm-label tm-serieswhere__label">{ui.bookDiary.part}</span>
        <Button size="sm" variant="quiet" aria-label={`${ui.bookDiary.part}: ${ui.seriesDiary.less}`} disabled={part <= 0} onClick={() => setPart(part - 1)}>−</Button>
        <span className="tm-title-3 tm-serieswhere__value" aria-live="polite">{part || '—'}</span>
        <Button size="sm" variant="quiet" aria-label={`${ui.bookDiary.part}: ${ui.seriesDiary.more}`} disabled={part >= 99} onClick={() => setPart(part + 1)}>+</Button>
      </div>
      <label className="tm-row tm-row--gap-2 tm-serieswhere__row">
        <span className="tm-label tm-serieswhere__label">{ui.bookDiary.page}</span>
        <input className="tm-input tm-serieswhere__page" type="number" inputMode="numeric" min={0} max={pages ?? 99999}
               value={page || ''} placeholder="—"
               onChange={(ev) => { const n = Math.max(0, Math.min(pages ?? 99999, Math.floor(Number(ev.target.value) || 0))); setPage(n); }} />
        {pages ? <span className="tm-caption">{ui.bookDiary.pageOf(pages)}</span> : null}
      </label>
      <Button size="sm" disabled={!changed} loading={busy} onClick={save}>{ui.seriesDiary.save}</Button>
    </section>
  );
}
