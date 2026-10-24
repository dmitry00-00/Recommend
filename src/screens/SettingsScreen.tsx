import { useEffect, useState } from 'react';
import { useFeature } from '@/lib/flags';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import type { MediaType, Session, SpoilerLevel, UserSettings } from '@/types/tmdf';
import { noteShare, deleteAccount, diaryFile, diaryLink, followsAvailable, getCinemaChoices, getFollows, getSession, getShelves, getTesters, isOwnerSession, logout, onFollowsChange, setFollow, setTester, type Follow, type Tester } from '@/api';
import { loadSettings, saveSettings } from '@/lib/settingsStore';
import {
  Button, ConsentCard, Dialog, ErrorState, ImportHistorySheet, SettingHead, SettingMulti, SettingPicker, SettingRow, SettingSwitch,
  Sheet, Skeleton, useToast, type PickOption,
} from '@/components';
import { applyTheme } from '@/lib/theme';
import { BOT_USERNAME, confirmNative, openExternal, saveFile, shareUrl, writeAuthorUrl } from '@/lib/telegram';
import { legalComplete } from '@/lib/legal';
import { DIM_DEFAULT } from '@/lib/model/fame';
import ui from '@/i18n';

// 17.10 (аудит удобства, reports/ui-efficiency-1710.md): столбики вариантов → строки «название — значение» с выбором
// в нижнем листе (src/components/SettingRow.tsx); пояснения — в одну строку, длинное под «?» или в листе; «Уровень
// усилия» убран — он в панели повторного «Сегодня»; разделы владельца — одним раскрывающимся «Для владельца» внизу;
// тост — только на ошибку.

const THEMES: PickOption<UserSettings['theme']>[] = [
  { value: 'system', label: ui.settings.themeSystem },
  { value: 'dark', label: ui.settings.themeDark },
  { value: 'light', label: ui.settings.themeLight },
];
const DIM: PickOption<NonNullable<UserSettings['dimFamous']>>[] = [
  { value: 'off', label: ui.settings.dimOff },
  { value: 'soft', label: ui.settings.dimSoft },
  { value: 'strong', label: ui.settings.dimStrong },
];
type MediaPick = 'both' | 'film' | 'book';
const MEDIA: PickOption<MediaPick>[] = (['both', 'film', 'book'] as const).map((v) => ({ value: v, label: ui.settings.mediaValues[v] }));
const SPOILERS: PickOption<SpoilerLevel>[] = ([0, 1, 2] as const).map((v) => ({
  value: v, label: ui.settings.spoilerShort[v], note: ui.settings.spoilerNotes[v],
}));
const LANGUAGES: PickOption<UserSettings['language']>[] = [
  { value: 'ru', label: ui.settings.languageRu },
  { value: 'en', label: ui.settings.languageEn },
];

/** «Что рекомендовать» одним значением из трёх (17.10): прочие типы в списке (сериалы) сохраняются как были. */
const mediaPick = (types: MediaType[]): MediaPick =>
  types.includes('film') && types.includes('book') ? 'both' : types.includes('book') ? 'book' : 'film';
const mediaTypesFor = (types: MediaType[], pick: MediaPick): MediaType[] => [
  ...types.filter((t) => t !== 'film' && t !== 'book'),
  ...(pick === 'book' ? [] : ['film' as const]),
  ...(pick === 'film' ? [] : ['book' as const]),
];

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
    <div className="tm-settings__sub">
      <SettingHead title={T.title} note={ui.settings.testersShort} more={T.text} />
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
    </div>
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
      <SettingHead title={F.title} note={ui.settings.followsShort} more={F.text} />
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

/** Мои подписки (ЗП-42, 10.10): кинотеатры, за которые человек уже платит, и «только без доплаты» для ленты.
 *  Список — из справочника наличия (что там бывает по подписке), без него — общий список России.
 *  17.10: строка «Мои подписки — Кинопоиск, Okko ›» с выбором в листе вместо пяти строк-флажков. */
function SubscriptionsRows({ settings, saving, save }: { settings: UserSettings; saving: boolean; save: (patch: Partial<UserSettings>) => void }) {
  const [choices, setChoices] = useState<{ slug: string; name: string }[] | null>(null);
  useEffect(() => { getCinemaChoices().then(setChoices).catch(() => setChoices([])); }, []);
  const chosen = settings.subscriptions ?? [];
  const names = chosen.map((s) => choices?.find((c) => c.slug === s)?.name ?? s);
  return (
    <>
      <SettingMulti label={ui.settings.subs} note={ui.settings.subsShort} disabled={saving}
                    summary={names.length ? names.join(', ') : ui.settings.subsNone}
                    values={chosen} options={choices ? choices.map((c) => ({ value: c.slug, label: c.name })) : null}
                    onChange={(subscriptions) => save({ subscriptions })}
                    intro={ui.settings.subsText}
                    footer={<p className="tm-caption tm-settings__note tm-srow__foot">{ui.settings.subsNote}</p>} />
      {chosen.length ? (
        <SettingSwitch label={ui.settings.subsOnly} note={ui.settings.subsOnlyShort} more={ui.settings.subsOnlyText} checked={settings.subscriptionsOnly ?? false}
                       disabled={saving} onChange={(subscriptionsOnly) => save({ subscriptionsOnly })} />
      ) : null}
      <SettingRow label={ui.subsPlan.entry} to="/subscriptions" />
    </>
  );
}

export function SettingsScreen() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [owner, setOwner] = useState(false);
  // редакция (10.10): в минимуме нет подробного дневника и подписок
  const diaryOn = useFeature('diary');
  const follows = useFeature('follows');
  const subsOn = useFeature('subscriptions');
  useEffect(() => { isOwnerSession().then(setOwner).catch(() => undefined); }, []);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [revoking, setRevoking] = useState(false);
  // удаление аккаунта (ЗП-5)
  const [erasing, setErasing] = useState(false);
  const [eraseBusy, setEraseBusy] = useState(false);
  const erase = () => {
    setEraseBusy(true);
    deleteAccount()
      .then(() => {
        toast({ text: ui.legal.deleted });
        // с чистого листа: новая сессия заведёт новый аккаунт
        setTimeout(() => { window.location.hash = '#/today'; window.location.reload(); }, 600);
      })
      .catch(() => { setEraseBusy(false); toast({ text: ui.legal.deleteFailed }); });
  };
  const [exporting, setExporting] = useState<'csv' | 'json' | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  // выгрузка дневника (ДФ-14): файл собирается здесь, в Telegram скачивается по ссылке сервера
  const exportDiary = (format: 'csv' | 'json') => {
    setExporting(format);
    diaryFile(format)
      .then(async (file) => {
        if (!file.count) { toast({ text: ui.legal.exportEmpty }); return; }
        if (await saveFile(file, () => diaryLink(file))) { toast({ text: ui.legal.exportDone(file.count) }); setExportOpen(false); }
      })
      .catch(() => toast({ text: ui.legal.exportFailed }))
      .finally(() => setExporting(null));
  };
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

  /** Сохранение сразу, с откатом на ошибке. 17.10: тост «Сохранено» на каждое переключение убран — новое значение и так
   *  видно в строке; тост — на ошибку и там, где передан свой текст (согласие, отзыв). */
  const save = (patch: Partial<UserSettings>, note?: string) => {
    if (!settings) return Promise.resolve();
    const optimistic = { ...settings, ...patch };
    setSettings(optimistic);
    setSaving(true);
    return saveSettings(patch)
      .then((next) => {
        setSettings(next);
        if (patch.theme) applyTheme(next.theme);
        if (note) toast({ text: note });
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

  // новичок до загрузки ядра получает настройки без умолчаний (getSettings → newcomer): не падаем на пустых списках
  const mediaTypes = settings.mediaTypes ?? ['film', 'book'];
  const warnings = settings.excludedWarnings ?? [];
  const langs = settings.materialLanguages ?? ['ru'];
  const focus = settings.shelves ?? [];

  return (
    <main className="tm-shell__main tm-settings">
      <h1 className="tm-shell__title">{ui.settings.title}</h1>

      {/* подбор: что, сколько громкого, спойлеры, языки разборов, подписки, история */}
      <section className="tm-settings__section">
        <SettingHead title={ui.settings.groupPicks} />
        <SettingRow label={ui.settings.historyImport} note={ui.settings.historyShort}
                    onClick={() => setImporting(true)} />
        <SettingPicker label={ui.settings.media} value={mediaPick(mediaTypes)} options={MEDIA} disabled={saving}
                       onPick={(pick) => save({ mediaTypes: mediaTypesFor(mediaTypes, pick) })} />
        {/* засветка топами (17.10, src/lib/model/fame.ts) */}
        <SettingPicker label={ui.settings.dimFamous} value={settings.dimFamous ?? DIM_DEFAULT} options={DIM} disabled={saving}
                       intro={ui.settings.dimFamousText} onPick={(dimFamous) => save({ dimFamous })} />
        <SettingPicker label={ui.settings.spoilers} value={settings.spoilerLevel} options={SPOILERS} disabled={saving}
                       intro={ui.settings.spoilersText} onPick={(spoilerLevel) => save({ spoilerLevel })} />
        {/* язык разборов (17.10): русские есть всегда, английские — тумблером; сохранённое «только английские» не теряем */}
        <SettingSwitch label={ui.settings.langsEn} checked={langs.includes('en')} disabled={saving}
                       note={langs.includes('ru') ? ui.settings.langsEnNote : ui.settings.langsOnlyEn} more={ui.settings.langsText}
                       onChange={(on) => save({ materialLanguages: on ? [...langs.filter((x) => x !== 'en'), 'en'] : ['ru'] })} />
        {shelves.length ? (
          <SettingMulti label={ui.settings.focus} disabled={saving}
                        summary={focus.length ? shelves.filter((sh) => focus.includes(sh.id)).map((sh) => sh.title).join(', ') || focus.length : ui.settings.focusNone}
                        values={focus} options={shelves.map((sh) => ({ value: sh.id, label: sh.title, note: ui.settings.focusFilms(sh.films) }))}
                        intro={ui.settings.focusText} onChange={(next) => save({ shelves: next })} />
        ) : null}
        {subsOn ? <SubscriptionsRows settings={settings} saving={saving} save={save} /> : null}
        {diaryOn ? (
          <SettingSwitch label={ui.settings.diary} note={ui.settings.diaryShort} more={ui.settings.diaryText}
                         checked={settings.diary ?? false} disabled={saving} onChange={(diary) => save({ diary })} />
        ) : null}
        {warnings.length ? (
          <>
            <SettingRow label={ui.settings.warnings} />
            <ul className="tm-settings__list">
              {warnings.map((w) => (
                <li key={w}>
                  <span>{w}</span>
                  <Button size="sm" variant="quiet" disabled={saving}
                          onClick={() => save({ excludedWarnings: warnings.filter((x) => x !== w) })}>
                    {ui.actions.remove}
                  </Button>
                </li>
              ))}
            </ul>
          </>
        ) : <SettingRow label={ui.settings.warnings} value={ui.settings.warningsNone} more={ui.settings.warningsHint} />}
      </section>

      <ImportHistorySheet
        open={importing}
        onOpenChange={setImporting}
        // норма шкалы — часть настроек: от неё модель считает вкус и «понравилось»
        onNorm={(ratingNorm) => save({ ratingNorm })}
      />

      <section className="tm-settings__section">
        <SettingHead title={ui.settings.groupApp} />
        <SettingPicker label={ui.settings.theme} value={settings.theme} options={THEMES} disabled={saving}
                       onPick={(theme) => save({ theme })} />
        {/* язык меню перезапускает приложение — поэтому выбор в листе, а не тумблер от случайного касания */}
        <SettingPicker label={ui.settings.language} value={settings.language} options={LANGUAGES} disabled={saving}
                       intro={ui.settings.languageNote} onPick={(language) => save({ language })} />
        {session ? (
          <SettingRow label={ui.login.signedIn(session.user.name)}
                      aside={<Button size="sm" variant="quiet" onClick={() => logout().then(() => navigate('/login'))}>{ui.login.signOut}</Button>} />
        ) : null}
      </section>

      {/* подписки на разборы (06.10): сводка от бота раз в день */}
      {follows && followsAvailable() ? <FollowsSection /> : null}

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

      {/* обратная связь; «Выбрать вместе» убрано 17.10 — вход есть в ленте */}
      <section className="tm-settings__section">
        <SettingHead title={ui.social.title} note={ui.settings.socialShort} more={ui.social.text} />
        <div className="tm-row tm-row--gap-2 tm-row--wrap">
          <Button size="sm" onClick={() => openExternal(writeAuthorUrl)}>{ui.social.write}</Button>
          <Button size="sm" variant="quiet" onClick={() => { noteShare('friend', 'telegram'); openExternal(shareUrl(ui.social.shareText)); }}>{ui.social.share}</Button>
        </div>
      </section>

      <section className="tm-settings__section">
        <SettingRow label={ui.settings.contributor} note={ui.settings.contributorShort} onClick={() => navigate('/contribute')} />
        <SettingRow label={ui.settings.bot} onClick={() => openExternal(`https://t.me/${BOT_USERNAME}`)} />
      </section>

      {/* документы, данные, удаление аккаунта (ЗП-5): правила подбора (149-ФЗ), политика данных (152-ФЗ) */}
      <section className="tm-settings__section">
        <SettingHead title={ui.legal.docs} />
        {/* уведомление о рекомендательных технологиях (24.10, ст. 13.56 КоАП) — здесь всегда, тост — один раз */}
        <p className="tm-caption tm-settings__note">{ui.legal.recTech}</p>
        {owner && !legalComplete ? <p className="tm-caption tm-settings__note tm-settings__warn">{ui.legal.missing}</p> : null}
        {/* дневник файлом (ДФ-14): одна строка «Выгрузить»; CSV — главное, JSON — вторым вариантом в листе (17.10) */}
        <SettingRow label={ui.legal.export} note={ui.settings.exportShort} onClick={() => setExportOpen(true)} />
        <Sheet open={exportOpen} onOpenChange={setExportOpen} title={ui.legal.export}>
          <p className="tm-body-sm tm-srow__intro">{ui.legal.exportText}</p>
          <div className="tm-srow__actions">
            <Button block variant="primary" loading={exporting === 'csv'} disabled={exporting !== null} onClick={() => exportDiary('csv')}>{ui.legal.exportCsv}</Button>
            <Button block variant="quiet" loading={exporting === 'json'} disabled={exporting !== null} onClick={() => exportDiary('json')}>{ui.settings.exportOther}</Button>
          </div>
        </Sheet>
        <SettingRow label={ui.legal.rules} onClick={() => navigate('/legal/rules')} />
        <SettingRow label={ui.legal.privacy} onClick={() => navigate('/legal/privacy')} />
        <SettingRow label={ui.legal.consent} onClick={() => navigate('/legal/consent')} />
        {/* откуда данные (17.10): одна строка, список — в листе; строка TMDb видна всегда — так требуют условия TMDb */}
        <SettingRow label={ui.settings.sources} note={ui.settings.sourcesShort} onClick={() => setSourcesOpen(true)} />
        <Sheet open={sourcesOpen} onOpenChange={setSourcesOpen} title={ui.settings.sources}>
          <p className="tm-body-sm tm-srow__intro">{ui.settings.sourcesText}</p>
          <ul className="tm-settings__list tm-settings__sources">
            <li className="tm-body-sm">{ui.settings.sourceWikidata}</li>
            <li className="tm-body-sm">{ui.settings.sourceTmdb}</li>
            <li className="tm-body-sm">{ui.settings.sourceKinopoisk}</li>
            <li className="tm-body-sm">{ui.settings.sourceOpenLibrary}</li>
          </ul>
          <p className="tm-caption tm-settings__note tm-settings__tmdb">{ui.settings.tmdbNotice}</p>
        </Sheet>
        <p className="tm-caption tm-settings__note tm-settings__tmdb">{ui.settings.tmdbNotice}</p>
        {/* полный текст последствий — в окне подтверждения (deleteBody), на экране только строка */}
        <SettingRow label={ui.legal.delete} tone="danger" onClick={() => {
          // в Telegram — его окно (ДФ-3): оно выглядит как остальной мессенджер, и его не спутать с нашим экраном
          const native = confirmNative(ui.legal.deleteTitle, ui.legal.deleteBody, ui.legal.deleteConfirm);
          if (native) void native.then((yes) => { if (yes) erase(); });
          else setErasing(true);
        }} />
        <Dialog open={erasing} onOpenChange={setErasing} title={ui.legal.deleteTitle} destructive
                confirm={ui.legal.deleteConfirm} busy={eraseBusy}
                onConfirm={erase}>
          {ui.legal.deleteBody}
        </Dialog>
      </section>

      {/* разделы владельца (17.10): одним раскрывающимся внизу — участнику их не видно, владельцу не мешают сверху */}
      {owner ? (
        <section className="tm-settings__section">
        <details className="tm-settings__owner">
          <summary className="tm-title-3 tm-settings__ownerhead">{ui.settings.owner}</summary>
          <SettingRow label={ui.loop.open} note={ui.loop.openHint} onClick={() => navigate('/loop')} />
          {/* разметка владельца с телефона (06.10): очередь «Проверки» и «Рубрик» пульта */}
          <SettingRow label={ui.owner.open} note={ui.owner.openHint} onClick={() => navigate('/owner')} />
          {/* полки рубрик (ТВ-3г): владелец смотрит интерфейс до выката — участникам его решает доля */}
          <SettingSwitch label={ui.lens.toggle} more={ui.lens.toggleText} checked={settings.lensShelves ?? true} disabled={saving}
                         onChange={(lensShelves) => save({ lensShelves })} />
          {/* карточка по глубине (15.10): владелец сравнивает с прежней до выката */}
          <SettingSwitch label={ui.depth.toggle} more={ui.depth.toggleText} checked={settings.depthCard ?? true} disabled={saving}
                         onChange={(depthCard) => save({ depthCard })} />
          {/* редакция (10.10): владелец смотрит минимум глазами участника */}
          <SettingSwitch label={ui.settings.edition} more={ui.settings.editionText} checked={settings.edition === 'minimum'} disabled={saving}
                         onChange={(on) => save({ edition: on ? 'minimum' : 'full' })} />
          {/* механика — данные трансформативного обучения, только админу (ТВ-3в) */}
          <SettingSwitch label={ui.settings.details} more={ui.settings.detailsText} checked={settings.showDetails} disabled={saving}
                         onChange={(showDetails) => save({ showDetails })} />
          {settings.showDetails ? <SettingRow label={ui.settings.openMap} onClick={() => navigate('/map')} /> : null}
          {/* тестеры (ТВ-3в): все полки, без статистики и механики; список ведёт админ */}
          <TestersSection />
        </details>
        </section>
      ) : null}
    </main>
  );
}
