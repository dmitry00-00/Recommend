import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import type { MediaType, Session, SpoilerLevel, UserSettings } from '@/types/tmdf';
import { deleteAccount, followsAvailable, getFollows, getSession, getShelves, getTesters, importHistory, isOwnerSession, logout, onFollowsChange, setFollow, setTester, type Follow, type Tester } from '@/api';
import { loadSettings, saveSettings } from '@/lib/settingsStore';
import { Button, ConsentCard, Dialog, EnergySwitch, ErrorState, ImportHistorySheet, Skeleton, useToast } from '@/components';
import { applyTheme } from '@/lib/theme';
import { BOT_USERNAME, openExternal, shareUrl, writeAuthorUrl } from '@/lib/telegram';
import { cx } from '@/lib/cx';
import { legalComplete } from '@/lib/legal';
import ui from '@/i18n';

const THEMES: { value: UserSettings['theme']; label: string }[] = [
  { value: 'system', label: ui.settings.themeSystem },
  { value: 'dark', label: ui.settings.themeDark },
  { value: 'light', label: ui.settings.themeLight },
];
const MEDIA: { value: MediaType; label: string }[] = [
  { value: 'film', label: ui.settings.mediaFilm },
  { value: 'book', label: ui.settings.mediaBook },
];
const LANGS: { value: 'ru' | 'en'; label: string }[] = [
  { value: 'ru', label: ui.settings.langRu },
  { value: 'en', label: ui.settings.langEn },
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

/** Тестеры (ТВ-3в, 06.10): админ добавляет и убирает по нику Telegram. Тестер видит все полки
 *  рубрик, но не статистику и не механику. */
function TestersSection() {
  const T = ui.testers;
  const toast = useToast();
  const [list, setList] = useState<Tester[] | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { getTesters().then(setList).catch(() => setList([])); }, []);
  const change = (username: string, on: boolean) => {
    setBusy(true);
    setTester(username, on)
      .then((l) => { setList(l); if (on) setText(''); toast({ text: on ? T.added : T.removed }); })
      .catch(() => toast({ text: T.error }))
      .finally(() => setBusy(false));
  };
  const nick = text.trim().replace(/^@/, '');
  return (
    <section className="tm-settings__section">
      <h2 className="tm-title-3 tm-settings__h">{T.title}</h2>
      <p className="tm-body-sm tm-settings__note">{T.text}</p>
      {list === null ? <Skeleton kind="block" style={{ height: 48 }} /> : list.length ? (
        <ul className="tm-settings__list">
          {list.map((t) => (
            <li key={t.username} className="tm-row tm-row--gap-2">
              <span className="tm-body">@{t.username}</span>
              <Button size="sm" variant="quiet" disabled={busy} onClick={() => change(t.username, false)}>{T.remove}</Button>
            </li>
          ))}
        </ul>
      ) : <p className="tm-body-sm tm-settings__note">{T.empty}</p>}
      <form className="tm-row tm-row--gap-2" onSubmit={(e) => { e.preventDefault(); if (nick) change(nick, true); }}>
        <input className="tm-owner__input" type="text" value={text} placeholder={T.placeholder} autoCapitalize="off" autoCorrect="off"
               spellCheck={false} onChange={(e) => setText(e.target.value)} aria-label={T.placeholder} />
        <Button size="sm" disabled={busy || !/^[A-Za-z0-9_]{3,32}$/.test(nick)} onClick={() => change(nick, true)}>{T.add}</Button>
      </form>
    </section>
  );
}

/** Подписки на разборы (06.10): за кем следит участник — с переходом на страницу и «Убрать». */
function FollowsSection() {
  const F = ui.follow;
  const toast = useToast();
  const [list, setList] = useState<Follow[] | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { void getFollows().then(setList); return onFollowsChange(setList); }, []);
  const remove = (f: Follow) => {
    setBusy(true);
    setFollow(f, false)
      .then(() => toast({ text: F.removed }))
      .catch(() => toast({ text: F.error }))
      .finally(() => setBusy(false));
  };
  const to = (f: Follow) => (f.kind === 'character' ? `/character/${f.ref}` : `/open/w-${f.ref.replace(':', '_')}`);
  return (
    <section className="tm-settings__section">
      <h2 className="tm-title-3 tm-settings__h">{F.title}</h2>
      <p className="tm-body-sm tm-settings__note">{F.text}</p>
      {list === null ? <Skeleton kind="block" style={{ height: 48 }} /> : list.length ? (
        <ul className="tm-settings__list">
          {list.map((f) => (
            <li key={`${f.kind}-${f.ref}`} className="tm-row tm-row--gap-2">
              <Link className="tm-body tm-link--plain" to={to(f)}>{f.title}</Link>
              <span className="tm-caption">{F.kind[f.kind]}</span>
              <Button size="sm" variant="quiet" disabled={busy} onClick={() => remove(f)}>{F.remove}</Button>
            </li>
          ))}
        </ul>
      ) : <p className="tm-body-sm tm-settings__note">{F.empty}</p>}
    </section>
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
  // удаление аккаунта (ЗП-5)
  const [erasing, setErasing] = useState(false);
  const [eraseBusy, setEraseBusy] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [consentLater, setConsentLater] = useState(false);
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

  const save = (patch: Partial<UserSettings>, note: string = ui.toast.saved) => {
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
        toast({ text: ui.settings.errorSave, action: ui.actions.retry, onAction: () => save(patch, note) });
      })
      .finally(() => setSaving(false));
  };

  if (failed) {
    return (
      <main className="tm-shell__main">
        <h1 className="tm-shell__title">{ui.settings.title}</h1>
        <ErrorState title={ui.settings.errorLoad} text={ui.assessment.errorText} onRetry={() => setAttempt(attempt + 1)} />
      </main>
    );
  }
  if (!settings) {
    return (
      <main className="tm-shell__main" aria-busy="true">
        <h1 className="tm-shell__title">{ui.settings.title}</h1>
        <span className="tm-sr">{ui.settings.loading}</span>
        <Skeleton kind="block" style={{ height: 120 }} />
        <Skeleton kind="block" style={{ height: 120, marginTop: 24 }} />
      </main>
    );
  }

  return (
    <main className="tm-shell__main tm-settings">
      <h1 className="tm-shell__title">{ui.settings.title}</h1>

      <section className="tm-settings__section">
        <h2 className="tm-title-3 tm-settings__h">{ui.settings.history}</h2>
        <p className="tm-body-sm tm-settings__note">{ui.settings.historyText}</p>
        <div className="tm-row tm-row--gap-2">
          <Button size="sm" onClick={() => setImporting(true)}>{ui.settings.historyImport}</Button>
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
          <h2 className="tm-title-3 tm-settings__h">{ui.loop.open}</h2>
          <p className="tm-body-sm tm-settings__note">{ui.loop.openHint}</p>
          <div className="tm-row tm-row--gap-2">
            <Button size="sm" onClick={() => navigate('/loop')}>{ui.loop.open}</Button>
          </div>
        </section>
      ) : null}

      {/* разметка владельца с телефона (06.10): очередь «Проверки» и «Рубрик» пульта */}
      {owner ? (
        <section className="tm-settings__section">
          <h2 className="tm-title-3 tm-settings__h">{ui.owner.open}</h2>
          <p className="tm-body-sm tm-settings__note">{ui.owner.openHint}</p>
          <div className="tm-row tm-row--gap-2">
            <Button size="sm" onClick={() => navigate('/owner')}>{ui.owner.open}</Button>
          </div>
        </section>
      ) : null}

      {/* полки рубрик (ТВ-3г): владелец смотрит интерфейс до выката — участникам его решает доля */}
      {owner ? (
        <section className="tm-settings__section">
          <label className="tm-settings__switch">
            <input type="checkbox" role="switch" checked={settings.lensShelves ?? true} disabled={saving}
                   onChange={(e) => save({ lensShelves: e.target.checked })} />
            <span>
              <span className="tm-title-3 tm-settings__h">{ui.lens.toggle}</span>
              <span className="tm-body-sm tm-settings__note">{ui.lens.toggleText}</span>
            </span>
          </label>
        </section>
      ) : null}

      {/* подписки на разборы (06.10): сводка от бота раз в день */}
      {followsAvailable() ? <FollowsSection /> : null}

      {/* тестеры (ТВ-3в): все полки, без статистики и механики; список ведёт админ */}
      {owner ? <TestersSection /> : null}

      {session ? (
        <section className="tm-settings__section">
          <h2 className="tm-title-3 tm-settings__h">{ui.login.account}</h2>
          <p className="tm-body tm-settings__note">{ui.login.signedIn(session.user.name)}</p>
          <div className="tm-row tm-row--gap-2">
            <Button size="sm" onClick={() => logout().then(() => navigate('/login'))}>{ui.login.signOut}</Button>
          </div>
        </section>
      ) : null}

      <section className="tm-settings__section">
        <h2 className="tm-title-3 tm-settings__h">{ui.settings.theme}</h2>
        <Choice label={ui.settings.theme} options={THEMES} value={settings.theme} disabled={saving}
                onPick={(theme) => save({ theme })} />
      </section>

      <section className="tm-settings__section">
        <h2 className="tm-title-3 tm-settings__h">{ui.settings.energy}</h2>
        <p className="tm-body-sm tm-settings__note">{ui.settings.energyText}</p>
        <EnergySwitch value={settings.energy ?? 'normal'} onChange={(energy) => save({ energy })} />
      </section>

      <section className="tm-settings__section">
        <label className="tm-settings__switch">
          <input type="checkbox" role="switch" checked={settings.diary ?? false} disabled={saving}
                 onChange={(e) => save({ diary: e.target.checked })} />
          <span>
            <span className="tm-title-3 tm-settings__h">{ui.settings.diary}</span>
            <span className="tm-body-sm tm-settings__note">{ui.settings.diaryText}</span>
          </span>
        </label>
      </section>

      {/* механика — данные трансформативного обучения, только админу (ТВ-3в) */}
      {owner ? (
      <section className="tm-settings__section">
        <label className="tm-settings__switch">
          <input type="checkbox" role="switch" checked={settings.showDetails} disabled={saving}
                 onChange={(e) => save({ showDetails: e.target.checked })} />
          <span>
            <span className="tm-title-3 tm-settings__h">{ui.settings.details}</span>
            <span className="tm-body-sm tm-settings__note">{ui.settings.detailsText}</span>
          </span>
        </label>
        {settings.showDetails ? (
          <Button size="sm" variant="quiet" onClick={() => navigate('/map')}>{ui.settings.openMap}</Button>
        ) : null}
      </section>
      ) : null}

      <section className="tm-settings__section">
        <h2 className="tm-title-3 tm-settings__h">{ui.settings.media}</h2>
        <div className="tm-achoice" role="group" aria-label={ui.settings.media}>
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
        <p className="tm-caption tm-settings__note">{ui.settings.mediaNote}</p>
      </section>

      <section className="tm-settings__section">
        <h2 className="tm-title-3 tm-settings__h">{ui.settings.langs}</h2>
        <p className="tm-body-sm tm-settings__note">{ui.settings.langsText}</p>
        <div className="tm-achoice" role="group" aria-label={ui.settings.langs}>
          {LANGS.map((l) => {
            const langs = settings.materialLanguages ?? ['ru'];
            const on = langs.includes(l.value);
            const last = on && langs.length === 1;
            return (
              <button key={l.value} type="button" aria-pressed={on ? 'true' : 'false'}
                      className={cx('tm-achoice__opt', on && 'tm-achoice__opt--on')} disabled={saving || last}
                      onClick={() => save({ materialLanguages: on ? langs.filter((x) => x !== l.value) : [...langs, l.value] })}>
                <span className="tm-achoice__mark" aria-hidden="true" />
                {l.label}
              </button>
            );
          })}
        </div>
      </section>

      {shelves.length ? (
        <section className="tm-settings__section">
          <h2 className="tm-title-3 tm-settings__h">{ui.settings.focus}</h2>
          <p className="tm-body-sm tm-settings__note">{ui.settings.focusText}</p>
          <div className="tm-achoice" role="group" aria-label={ui.settings.focus}>
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
          <p className="tm-caption tm-settings__note">{shelves.map((sh) => `${sh.title}: ${ui.settings.focusFilms(sh.films)}`).join(' · ')}</p>
        </section>
      ) : null}

      <section className="tm-settings__section">
        <h2 className="tm-title-3 tm-settings__h">{ui.settings.spoilers}</h2>
        <p className="tm-body-sm tm-settings__note">{ui.settings.spoilersText}</p>
        <Choice label={ui.settings.spoilers} value={settings.spoilerLevel} disabled={saving}
                options={SPOILERS.map((v) => ({ value: v, label: ui.settings.spoilerLevels[v] }))}
                onPick={(spoilerLevel) => save({ spoilerLevel })} />
      </section>

      <section className="tm-settings__section">
        <h2 className="tm-title-3 tm-settings__h">{ui.settings.warnings}</h2>
        {settings.excludedWarnings.length ? (
          <ul className="tm-settings__list">
            {settings.excludedWarnings.map((w) => (
              <li key={w}>
                <span>{w}</span>
                <Button size="sm" variant="quiet" disabled={saving}
                        onClick={() => save({ excludedWarnings: settings.excludedWarnings.filter((x) => x !== w) })}>
                  {ui.actions.remove}
                </Button>
              </li>
            ))}
          </ul>
        ) : <p className="tm-body-sm tm-settings__note">{ui.settings.warningsEmpty}</p>}
      </section>

      <section className="tm-settings__section">
        <h2 className="tm-title-3 tm-settings__h">{ui.settings.language}</h2>
        <Choice label={ui.settings.language} value={settings.language} disabled={saving}
                options={[{ value: 'ru', label: ui.settings.languageRu }, { value: 'en', label: ui.settings.languageEn }]}
                onPick={(language) => save({ language })} />
        <p className="tm-caption tm-settings__note">{ui.settings.languageNote}</p>
      </section>

      <section className="tm-settings__section">
        <h2 className="tm-title-3 tm-settings__h">{ui.settings.research}</h2>
        {settings.researchConsent ? (
          <>
            <p className="tm-body-sm tm-settings__note">{ui.settings.researchOn}</p>
            <Button size="sm" variant="quiet" onClick={() => setRevoking(true)}>{ui.settings.revoke}</Button>
            <Dialog open={revoking} onOpenChange={setRevoking} title={ui.settings.revokeTitle} destructive
                    confirm={ui.settings.revokeConfirm} busy={saving}
                    onConfirm={() => save({ researchConsent: false }, ui.settings.revoked).then(() => setRevoking(false))}>
              {ui.settings.revokeText}
            </Dialog>
          </>
        ) : (
          // «Не сейчас» (ТВ-9) — свернуть карточку и остаться в профиле, а не уводить в ленту
          consentLater ? (
            <>
              <p className="tm-body-sm tm-settings__note">{ui.settings.researchOff}</p>
              <Button size="sm" variant="quiet" onClick={() => setConsentLater(false)}>{ui.settings.researchJoin}</Button>
            </>
          ) : (
            <ConsentCard busy={saving} onAccept={() => save({ researchConsent: true }, ui.settings.consented)}
                         onLater={() => setConsentLater(true)} />
          )
        )}
      </section>

      <section className="tm-settings__section">
        <h2 className="tm-title-3 tm-settings__h">{ui.social.title}</h2>
        <p className="tm-body-sm tm-settings__note">{ui.social.text}</p>
        <div className="tm-row tm-row--gap-2 tm-row--wrap">
          <Button size="sm" onClick={() => openExternal(writeAuthorUrl)}>{ui.social.write}</Button>
          <Button size="sm" variant="quiet" onClick={() => navigate('/together')}>{ui.together.entryAction}</Button>
          <Button size="sm" variant="quiet" onClick={() => openExternal(shareUrl(ui.social.shareText))}>{ui.social.share}</Button>
        </div>
      </section>

      <section className="tm-settings__section">
        <h2 className="tm-title-3 tm-settings__h">{ui.settings.contributor}</h2>
        <p className="tm-body-sm tm-settings__note">{ui.settings.contributorText}</p>
        <div className="tm-row tm-row--gap-2 tm-row--wrap">
          <Button size="sm" onClick={() => navigate('/contribute')}>{ui.settings.contributorOpen}</Button>
          <Button size="sm" variant="quiet" onClick={() => openExternal(`https://t.me/${BOT_USERNAME}`)}>{ui.settings.bot}</Button>
        </div>
      </section>

      {/* документы и удаление аккаунта (ЗП-5): правила подбора (149-ФЗ), политика данных (152-ФЗ) */}
      <section className="tm-settings__section">
        <h2 className="tm-title-3 tm-settings__h">{ui.legal.docs}</h2>
        <p className="tm-body-sm tm-settings__note">{ui.legal.docsText}</p>
        {owner && !legalComplete ? <p className="tm-caption tm-settings__note tm-settings__warn">{ui.legal.missing}</p> : null}
        <div className="tm-row tm-row--gap-2 tm-row--wrap">
          <Button size="sm" variant="quiet" onClick={() => navigate('/legal/rules')}>{ui.legal.rules}</Button>
          <Button size="sm" variant="quiet" onClick={() => navigate('/legal/privacy')}>{ui.legal.privacy}</Button>
        </div>
        <p className="tm-body-sm tm-settings__note">{ui.legal.deleteText}</p>
        <div className="tm-row tm-row--gap-2">
          <Button size="sm" variant="danger" onClick={() => setErasing(true)}>{ui.legal.delete}</Button>
        </div>
        <Dialog open={erasing} onOpenChange={setErasing} title={ui.legal.deleteTitle} destructive
                confirm={ui.legal.deleteConfirm} busy={eraseBusy}
                onConfirm={() => {
                  setEraseBusy(true);
                  deleteAccount()
                    .then(() => {
                      toast({ text: ui.legal.deleted });
                      // с чистого листа: новая сессия заведёт новый аккаунт
                      setTimeout(() => { window.location.hash = '#/today'; window.location.reload(); }, 600);
                    })
                    .catch(() => { setEraseBusy(false); toast({ text: ui.legal.deleteFailed }); });
                }}>
          {ui.legal.deleteBody}
        </Dialog>
      </section>

      <section className="tm-settings__section">
        <h2 className="tm-title-3 tm-settings__h">{ui.settings.sources}</h2>
        <p className="tm-body-sm tm-settings__note">{ui.settings.sourcesText}</p>
        <ul className="tm-settings__list tm-settings__sources">
          <li className="tm-body-sm">{ui.settings.sourceWikidata}</li>
          <li className="tm-body-sm">{ui.settings.sourceTmdb}</li>
          <li className="tm-body-sm">{ui.settings.sourceKinopoisk}</li>
          <li className="tm-body-sm">{ui.settings.sourceOpenLibrary}</li>
        </ul>
        <p className="tm-caption tm-settings__note tm-settings__tmdb">{ui.settings.tmdbNotice}</p>
      </section>
    </main>
  );
}
