import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { ContributorProfile } from '@/types/tmdf';
import { getContributorProfile, updateContributorProfile } from '@/api';
import { Button, CreditSettings, ErrorState, Skeleton, useToast } from '@/components';
import ru from '@/i18n/ru';

/** Профиль участника (/contribute/profile): как подписывать вклад и ссылки на свои разборы.
 *  Сохраняется кнопкой — одним запросом, с тостом. */
export function ContributorProfileScreen() {
  const navigate = useNavigate();
  const toast = useToast();
  const [profile, setProfile] = useState<ContributorProfile | null>(null);
  const [patch, setPatch] = useState<Pick<ContributorProfile, 'creditConsent' | 'links'> | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setFailed(false);
    getContributorProfile().then((p) => alive && setProfile(p)).catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, [attempt]);

  const save = () => {
    if (!patch || busy) return;
    setBusy(true);
    const links = patch.links.filter((l) => l.url.trim()).map((l) => ({ label: l.label.trim() || l.url.trim(), url: l.url.trim() }));
    updateContributorProfile({ ...patch, links })
      .then(() => { toast({ text: ru.contribute.saved }); navigate('/contribute'); })
      .catch(() => toast({ text: ru.settings.errorSave, action: ru.actions.retry, onAction: save }))
      .finally(() => setBusy(false));
  };

  if (failed) {
    return (
      <main className="tm-shell__main">
        <ErrorState title={ru.settings.errorLoad} text={ru.assessment.errorText} onRetry={() => setAttempt(attempt + 1)} />
      </main>
    );
  }
  return (
    <main className="tm-shell__main tm-contribute">
      <Link to="/contribute" className="tm-contribute__back">{ru.contribute.toCabinet}</Link>
      <h1 className="tm-shell__title">{ru.contribute.profile}</h1>
      {profile ? (
        <>
          <CreditSettings contributor={profile} onChange={setPatch} />
          <div className="tm-row tm-row--gap-2 tm-contribute__actions">
            <Button variant="primary" size="sm" loading={busy} disabled={busy || !patch} onClick={save}>{ru.contribute.save}</Button>
            <Button variant="quiet" size="sm" disabled={busy} onClick={() => navigate('/contribute')}>{ru.dialog.cancel}</Button>
          </div>
        </>
      ) : (
        <div aria-busy="true"><Skeleton kind="block" style={{ height: 200 }} /></div>
      )}
    </main>
  );
}
