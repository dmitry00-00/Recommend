import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { JourneyEntryData, ReflectionPromptData } from '@/types/tmdf';
import { getJourney, getReflectionPrompts } from '@/api';
import { EmptyState, ErrorState, JourneyEntry, Skeleton, StateChangeNote } from '@/components';
import { useMechanics } from '@/lib/settingsStore';
import ru from '@/i18n/ru';

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
        <ErrorState title={ru.journal.errorOne} text={ru.journal.errorText} onRetry={() => setAttempt(attempt + 1)} />
      </main>
    );
  }
  if (missing) {
    return (
      <main className="tm-shell__main">
        <EmptyState title={ru.journal.notFound} text={ru.journal.notFoundText}
                    action={ru.nav.journal} onAction={() => navigate('/journal')} />
      </main>
    );
  }
  if (!entry) {
    return (
      <main className="tm-shell__main" aria-busy="true">
        <span className="tm-sr">{ru.journal.loading}</span>
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
        <section className="tm-journal__section">
          <h2 className="tm-title-3">{ru.journal.reflections}</h2>
          {entry.reflections.length ? (
            <ul className="tm-journal__qa">
              {entry.reflections.map((r) => (
                <li key={r.promptId}>
                  {questionOf(r.promptId) ? <p className="tm-caption tm-journal__q">{questionOf(r.promptId)}</p> : null}
                  <p className="tm-body tm-journal__a">{r.answer}</p>
                </li>
              ))}
            </ul>
          ) : <p className="tm-caption tm-journal__hint">{ru.journal.noReflections}</p>}
        </section>
        {mechanics && entry.stateChanges.length ? (
          <section className="tm-journal__section">
            <h2 className="tm-title-3">{ru.journal.changes}</h2>
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
