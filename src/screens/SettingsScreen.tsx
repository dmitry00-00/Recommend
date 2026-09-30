import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { MediaType, Session, SpoilerLevel, UserSettings } from '@/types/tmdf';
import { getSession, getShelves, importHistory, isOwnerSession, logout } from '@/api';
import { loadSettings, saveSettings } from '@/lib/settingsStore';
import { Button, ConsentCard, Dialog, EnergySwitch, ErrorState, ImportHistorySheet, Skeleton, useToast } from '@/components';
import { applyTheme } from '@/lib/theme';
import { BOT_USERNAME } from '@/lib/telegram';
import { cx } from '@/lib/cx';
import ru from '@/i18n/ru';

const THEMES: { value: UserSettings['theme']; label: string }[] = [
  { value: 'system', label: ru.settings.themeSystem },
  { value: 'dark', label: ru.settings.themeDark },
  { value: 'light', label: ru.settings.themeLight },
];
const MEDIA: { value: MediaType; label: string }[] = [
  { value: 'film', label: ru.settings.mediaFilm },
  { value: 'book', label: ru.settings.mediaBook },
];
const SPOILERS: SpoilerLevel[] = [0, 1, 2];

/** Группа взаимоисключающих вариантов на классах задания диагностики: те же кнопки-строки. */
function Choice<T extends string | number>({ label, options, value, onPick, disabled }: {
  label: string; options: { value: T; label: string; disabled?: boolean }[]; value: T; onPick: (v: T) => void; disabled?: boolean;
}) {
  return (
    <div className="tm-achoice" role="radiogroup" aria-label={label}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button key={String(o.value)} type="button" role="radio" aria-checked={on ? 'true' : 'false'}
                  className={cx('tm-achoice__opt', on && 'tm-achoice__opt--on')}
                  disabled={disabled || o.disabled} onClick={() => onPick(o.value)}>
            <span className="tm-achoice__mark" aria-hidden="true" />
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Экран «Профиль и настройки» (/settings). Каждое изменение уходит на сервер сразу и
 *  подтверждается тостом; отзыв согласия — через диалог, потому что данные удаляются. */
export function SettingsScreen() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [owner, setOwner] = useState(false);
  useEffect(() => { isOwnerSession().then(setOwner).catch(() => undefined); }, []);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [importing, setImporting] = useState(params.get('import') === '1');

  useEffect(() => { getSession().then((x) => setSession(x ?? null)).catch(() => setSession(null)); }, []);
  const [shelves, setShelves] = useState<Awaited<ReturnType<typeof getShelves>>>([]);
  useEffect(() => { getShelves().then(setShelves).catch(() => undefined); }, []);

  useEffect(() => {
    let alive = true;
    setSettings(null);
    setFailed(false);
    loadSettings().then((s) => alive && setSettings(s)).catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, [attempt]);

  const save = (patch: Partial<UserSettings>, note: string = ru.toast.saved) => {
    if (!settings) return Promise.resolve();
    const optimistic = { ...settings, ...patch };
    setSettings(optimistic);
    setSaving(true);
    return saveSettings(patch)
      .then((next) => {
        setSettings(next);
        if (patch.theme) applyTheme(next.theme);
        toast({ text: note });
      })
      .catch(() => {
        setSettings(settings);
        toast({ text: ru.settings.errorSave, action: ru.actions.retry, onAction: () => save(patch, note) });
      })
      .finally(() => setSaving(false));
  };

  if (failed) {
    return (
      <main className="tm-shell__main">
        <h1 className="tm-shell__title">{ru.settings.title}</h1>
        <ErrorState title={ru.settings.errorLoad} text={ru.assessment.errorText} onRetry={() => setAttempt(attempt + 1)} />
      </main>
    );
  }
  if (!settings) {
    return (
      <main className="tm-shell__main" aria-busy="true">
        <h1 className="tm-shell__title">{ru.settings.title}</h1>
        <span className="tm-sr">{ru.settings.loading}</span>
        <Skeleton kind="block" style={{ height: 120 }} />
        <Skeleton kind="block" style={{ height: 120, marginTop: 24 }} />
      </main>
    );
  }

  return (
    <main className="tm-shell__main tm-settings">
      <h1 className="tm-shell__title">{ru.settings.title}</h1>

      <section className="tm-settings__section">
        <h2 className="tm-title-3 tm-settings__h">{ru.settings.history}</h2>
        <p className="tm-body-sm tm-settings__note">{ru.settings.historyText}</p>
        <div className="tm-row tm-row--gap-2">
          <Button size="sm" onClick={() => setImporting(true)}>{ru.settings.historyImport}</Button>
        </div>
      </section>

      <ImportHistorySheet
        open={importing}
        onOpenChange={setImporting}
        onImport={async (texts, ratingNorm) => {
          // норма шкалы — часть настроек: от неё модель считает вкус и «понравилось»
          if (ratingNorm) await save({ ratingNorm });
          const r = await importHistory(texts);
          return r ? { added: r.entries.length, resolved: r.resolved } : undefined;
        }}
      />

      {owner ? (
        <section className="tm-settings__section">
          <h2 className="tm-title-3 tm-settings__h">{ru.loop.open}</h2>
          <p className="tm-body-sm tm-settings__note">{ru.loop.openHint}</p>
          <div className="tm-row tm-row--gap-2">
            <Button size="sm" onClick={() => navigate('/loop')}>{ru.loop.open}</Button>
          </div>
        </section>
      ) : null}

      {session ? (
        <section className="tm-settings__section">
          <h2 className="tm-title-3 tm-settings__h">{ru.login.account}</h2>
          <p className="tm-body tm-settings__note">{ru.login.signedIn(session.user.name)}</p>
          {/* пока бэкенда нет, подпись Telegram проверять некому — говорим об этом прямо */}
          {!session.verified ? <p className="tm-caption tm-settings__tmdb">{ru.login.unverified}</p> : null}
          <div className="tm-row tm-row--gap-2">
            <Button size="sm" onClick={() => logout().then(() => navigate('/login'))}>{ru.login.signOut}</Button>
          </div>
        </section>
      ) : null}

      <section className="tm-settings__section">
        <h2 className="tm-title-3 tm-settings__h">{ru.settings.theme}</h2>
        <Choice label={ru.settings.theme} options={THEMES} value={settings.theme} disabled={saving}
                onPick={(theme) => save({ theme })} />
      </section>

      <section className="tm-settings__section">
        <h2 className="tm-title-3 tm-settings__h">{ru.settings.energy}</h2>
        <p className="tm-body-sm tm-settings__note">{ru.settings.energyText}</p>
        <EnergySwitch value={settings.energy ?? 'normal'} onChange={(energy) => save({ energy })} />
      </section>

      <section className="tm-settings__section">
        <label className="tm-settings__switch">
          <input type="checkbox" role="switch" checked={settings.showDetails} disabled={saving}
                 onChange={(e) => save({ showDetails: e.target.checked })} />
          <span>
            <span className="tm-title-3 tm-settings__h">{ru.settings.details}</span>
            <span className="tm-body-sm tm-settings__note">{ru.settings.detailsText}</span>
          </span>
        </label>
        {settings.showDetails ? (
          <Button size="sm" variant="quiet" onClick={() => navigate('/map')}>{ru.settings.openMap}</Button>
        ) : null}
      </section>

      <section className="tm-settings__section">
        <h2 className="tm-title-3 tm-settings__h">{ru.settings.media}</h2>
        <div className="tm-achoice" role="group" aria-label={ru.settings.media}>
          {MEDIA.map((m) => {
            const on = settings.mediaTypes.includes(m.value);
            const last = on && settings.mediaTypes.length === 1;
            return (
              <button key={m.value} type="button" aria-pressed={on ? 'true' : 'false'}
                      className={cx('tm-achoice__opt', on && 'tm-achoice__opt--on')} disabled={saving || last}
                      onClick={() => save({ mediaTypes: on ? settings.mediaTypes.filter((t) => t !== m.value) : [...settings.mediaTypes, m.value] })}>
                <span className="tm-achoice__mark" aria-hidden="true" />
                {m.label}
              </button>
            );
          })}
        </div>
        <p className="tm-caption tm-settings__note">{ru.settings.mediaNote}</p>
      </section>

      {shelves.length ? (
        <section className="tm-settings__section">
          <h2 className="tm-title-3 tm-settings__h">{ru.settings.focus}</h2>
          <p className="tm-body-sm tm-settings__note">{ru.settings.focusText}</p>
          <div className="tm-achoice" role="group" aria-label={ru.settings.focus}>
            {shelves.map((sh) => {
              const chosen = settings.shelves ?? [];
              const on = chosen.includes(sh.id);
              return (
                <button key={sh.id} type="button" aria-pressed={on ? 'true' : 'false'} title={sh.why}
                        className={cx('tm-achoice__opt', on && 'tm-achoice__opt--on')} disabled={saving}
                        onClick={() => save({ shelves: on ? chosen.filter((x) => x !== sh.id) : [...chosen, sh.id] })}>
                  <span className="tm-achoice__mark" aria-hidden="true" />
                  {sh.title}
                </button>
              );
            })}
          </div>
          <p className="tm-caption tm-settings__note">{shelves.map((sh) => `${sh.title}: ${ru.settings.focusFilms(sh.films)}`).join(' · ')}</p>
        </section>
      ) : null}

      <section className="tm-settings__section">
        <h2 className="tm-title-3 tm-settings__h">{ru.settings.spoilers}</h2>
        <p className="tm-body-sm tm-settings__note">{ru.settings.spoilersText}</p>
        <Choice label={ru.settings.spoilers} value={settings.spoilerLevel} disabled={saving}
                options={SPOILERS.map((v) => ({ value: v, label: ru.settings.spoilerLevels[v] }))}
                onPick={(spoilerLevel) => save({ spoilerLevel })} />
      </section>

      <section className="tm-settings__section">
        <h2 className="tm-title-3 tm-settings__h">{ru.settings.warnings}</h2>
        {settings.excludedWarnings.length ? (
          <ul className="tm-settings__list">
            {settings.excludedWarnings.map((w) => (
              <li key={w}>
                <span>{w}</span>
                <Button size="sm" variant="quiet" disabled={saving}
                        onClick={() => save({ excludedWarnings: settings.excludedWarnings.filter((x) => x !== w) })}>
                  {ru.actions.remove}
                </Button>
              </li>
            ))}
          </ul>
        ) : <p className="tm-body-sm tm-settings__note">{ru.settings.warningsEmpty}</p>}
      </section>

      <section className="tm-settings__section">
        <h2 className="tm-title-3 tm-settings__h">{ru.settings.language}</h2>
        <Choice label={ru.settings.language} value={settings.language} disabled={saving}
                options={[{ value: 'ru', label: ru.settings.languageRu }, { value: 'en', label: ru.settings.languageEn, disabled: true }]}
                onPick={(language) => save({ language })} />
        <p className="tm-caption tm-settings__note">{ru.settings.languageNote}</p>
      </section>

      <section className="tm-settings__section">
        <h2 className="tm-title-3 tm-settings__h">{ru.settings.research}</h2>
        {settings.researchConsent ? (
          <>
            <p className="tm-body-sm tm-settings__note">{ru.settings.researchOn}</p>
            <Button size="sm" variant="quiet" onClick={() => setRevoking(true)}>{ru.settings.revoke}</Button>
            <Dialog open={revoking} onOpenChange={setRevoking} title={ru.settings.revokeTitle} destructive
                    confirm={ru.settings.revokeConfirm} busy={saving}
                    onConfirm={() => save({ researchConsent: false }, ru.settings.revoked).then(() => setRevoking(false))}>
              {ru.settings.revokeText}
            </Dialog>
          </>
        ) : (
          <ConsentCard busy={saving} onAccept={() => save({ researchConsent: true }, ru.settings.consented)}
                       onLater={() => navigate('/today')} />
        )}
      </section>

      <section className="tm-settings__section">
        <h2 className="tm-title-3 tm-settings__h">{ru.settings.contributor}</h2>
        <p className="tm-body-sm tm-settings__note">{ru.settings.contributorText}</p>
        <div className="tm-row tm-row--gap-2 tm-row--wrap">
          <Button size="sm" onClick={() => navigate('/contribute')}>{ru.settings.contributorOpen}</Button>
          <Button size="sm" variant="quiet" href={`https://t.me/${BOT_USERNAME}`}>{ru.settings.bot}</Button>
        </div>
      </section>

      <section className="tm-settings__section">
        <h2 className="tm-title-3 tm-settings__h">{ru.settings.sources}</h2>
        <p className="tm-body-sm tm-settings__note">{ru.settings.sourcesText}</p>
        <ul className="tm-settings__list tm-settings__sources">
          <li className="tm-body-sm">{ru.settings.sourceWikidata}</li>
          <li className="tm-body-sm">{ru.settings.sourceTmdb}</li>
          <li className="tm-body-sm">{ru.settings.sourceKinopoisk}</li>
          <li className="tm-body-sm">{ru.settings.sourceOpenLibrary}</li>
        </ul>
        <p className="tm-caption tm-settings__note tm-settings__tmdb">{ru.settings.tmdbNotice}</p>
      </section>
    </main>
  );
}
