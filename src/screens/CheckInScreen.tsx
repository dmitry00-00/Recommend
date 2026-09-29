import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { CheckInRequest, CheckInResult, DiscussionPlace, JourneyEntryData, ReflectionPromptData } from '@/types/tmdf';
import { checkIn, getDiscussions, getJourney, getReflectionPrompts } from '@/api';
import {
  Button, CheckInFlow, EmptyState, ErrorState, RecommendationCard, ReplanNote, Skeleton,
} from '@/components';
import { useMechanics } from '@/lib/settingsStore';
import { outcome } from '@/lib/telegram';
import ru from '@/i18n/ru';

interface Loaded { entry: JourneyEntryData; prompts: ReflectionPromptData[]; discussions: DiscussionPlace[] }

/** Экран «После просмотра» (/journal/:entryId/check-in). Поток собирает ответы, сервер
 *  возвращает разбор, изменение карты, следующий кадр и, если было, перестроение маршрута. */
export function CheckInScreen() {
  const { entryId = '' } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [data, setData] = useState<Loaded | null>(null);
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [missing, setMissing] = useState(false);
  const [failed, setFailed] = useState<'load' | 'submit' | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [lastRequest, setLastRequest] = useState<CheckInRequest | null>(null);
  const mechanics = useMechanics();

  useEffect(() => {
    let alive = true;
    setData(null);
    setMissing(false);
    setFailed(null);
    getJourney()
      .then(async (journal) => {
        const entry = journal.find((e) => e.id === entryId);
        if (!entry) { if (alive) setMissing(true); return; }
        const [prompts, discussions] = await Promise.all([getReflectionPrompts(entryId), getDiscussions(entry.work.id)]);
        if (alive) setData({ entry, prompts, discussions });
      })
      .catch(() => alive && setFailed('load'));
    return () => { alive = false; };
  }, [entryId, attempt]);

  const submit = (request: CheckInRequest) => {
    setLastRequest(request);
    setFailed(null);
    checkIn(entryId, request)
      .then((r) => { outcome('success'); setResult(r); })
      .catch(() => { outcome('error'); setFailed('submit'); });
  };

  if (failed) {
    return (
      <main className="tm-shell__main">
        <ErrorState title={failed === 'submit' ? ru.journal.errorCheckIn : ru.journal.errorOne} text={ru.journal.errorText}
                    onRetry={() => (failed === 'submit' && lastRequest ? submit(lastRequest) : setAttempt(attempt + 1))} />
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
  if (!data) {
    return (
      <main className="tm-shell__main" aria-busy="true">
        <span className="tm-sr">{ru.journal.loading}</span>
        <Skeleton kind="title" style={{ width: '60%' }} />
        <Skeleton kind="block" style={{ height: 120, marginTop: 24 }} />
      </main>
    );
  }

  const { entry, prompts, discussions } = data;
  const changed = result?.entry.stateChanges.map((c) => c.op) ?? [];
  return (
    <main className="tm-shell__main">
      <h1 className="tm-shell__title">{entry.work.title}</h1>
      <CheckInFlow work={entry.work} prompts={prompts} discussions={discussions}
                   step={params.get('abandon') ? 9 : 0} debrief={result?.debrief}
                   prediction={result?.entry.prediction ?? entry.prediction} showModel={mechanics}
                   changedOperations={changed} onSubmit={submit} />
      {result ? (
        <div className="tm-checkinscreen__after">
          {result.trajectoryUpdate?.replanned && result.trajectoryUpdate.reason ? (
            <ReplanNote reason={result.trajectoryUpdate.reason} />
          ) : null}
          {result.nextRecommendation ? (
            <>
              <h2 className="tm-title-3">{ru.checkin.nextFrame}</h2>
              <RecommendationCard recommendation={result.nextRecommendation} variant="compact" />
            </>
          ) : null}
          <div className="tm-row tm-row--gap-2 tm-row--wrap">
            <Button onClick={() => navigate('/journal')}>{ru.checkin.toJournal}</Button>
            <Button variant="quiet" onClick={() => navigate('/map')}>{ru.checkin.toMap}</Button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
