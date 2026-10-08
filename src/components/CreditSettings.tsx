import { useState } from 'react';
import type { ContributorProfile } from '@/types/tmdf';
import { Button } from './Button';
import { cx } from '@/lib/cx';
import ui from '@/i18n';

type Consent = ContributorProfile['creditConsent'];
type Link = ContributorProfile['links'][number];

export interface CreditSettingsProps {
  contributor: ContributorProfile;
  onChange?: (patch: Pick<ContributorProfile, 'creditConsent' | 'links'>) => void;
}

/** Как подписывать вклад: именем или анонимно, плюс ссылки на свои разборы. Каждое
 *  изменение отдаётся наверх целиком — экран решает, когда сохранять. */
export function CreditSettings({ contributor: c, onChange }: CreditSettingsProps) {
  const [consent, setConsent] = useState<Consent>(c.creditConsent);
  const [links, setLinks] = useState<Link[]>(c.links);
  const emit = (nextConsent: Consent, nextLinks: Link[]) => onChange?.({ creditConsent: nextConsent, links: nextLinks });
  const pick = (v: Consent) => { setConsent(v); emit(v, links); };
  const setLink = (i: number, patch: Partial<Link>) => {
    const next = links.map((l, j) => (j === i ? { ...l, ...patch } : l));
    setLinks(next); emit(consent, next);
  };
  const addLink = () => { const next = [...links, { label: '', url: '' }]; setLinks(next); emit(consent, next); };
  const removeLink = (i: number) => { const next = links.filter((_, j) => j !== i); setLinks(next); emit(consent, next); };
  const options: { id: Consent; label: string; note: string }[] = [
    { id: 'public_name', label: ui.contribute.byName, note: c.displayName },
    { id: 'anonymous', label: ui.contribute.anonymous, note: ui.contribute.noMention },
  ];
  return (
    <section className="tm-credit">
      <h3 className="tm-credit__title">{ui.contribute.howToCredit}</h3>
      <div className="tm-credit__opts" role="radiogroup" aria-label={ui.contribute.creditLabel}>
        {options.map((o) => {
          const on = consent === o.id;
          return (
            <button key={o.id} type="button" role="radio" aria-checked={on ? 'true' : 'false'}
                    className={cx('tm-credit__opt', on && 'tm-credit__opt--on')} onClick={() => pick(o.id)}>
              <span className="tm-credit__label">{o.label}</span>
              <span className="tm-credit__note">{o.note}</span>
            </button>
          );
        })}
      </div>
      <div className="tm-credit__links">
        <p className="tm-credit__sub">{ui.contribute.yourLinks}</p>
        {links.map((l, i) => (
          <div key={i} className="tm-row tm-row--gap-2">
            <input className="tm-input" value={l.label} placeholder={ui.contribute.linkLabel} aria-label={ui.contribute.linkLabel}
                   onChange={(e) => setLink(i, { label: e.target.value })} />
            <input className="tm-input" type="url" value={l.url} placeholder="https://" aria-label={ui.contribute.linkUrl}
                   onChange={(e) => setLink(i, { url: e.target.value })} />
            <Button variant="quiet" size="sm" onClick={() => removeLink(i)}>{ui.actions.remove}</Button>
          </div>
        ))}
        <div><Button variant="quiet" size="sm" onClick={addLink}>{ui.contribute.addLink}</Button></div>
      </div>
    </section>
  );
}
