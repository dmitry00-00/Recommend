import { useState } from 'react';
import type { ContributorProfile } from '@/types/tmdf';
import { Button } from './Button';
import { cx } from '@/lib/cx';
import ru from '@/i18n/ru';

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
    { id: 'public_name', label: ru.contribute.byName, note: c.displayName },
    { id: 'anonymous', label: ru.contribute.anonymous, note: ru.contribute.noMention },
  ];
  return (
    <section className="tm-credit">
      <h3 className="tm-credit__title">{ru.contribute.howToCredit}</h3>
      <div className="tm-credit__opts" role="radiogroup" aria-label={ru.contribute.creditLabel}>
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
        <p className="tm-credit__sub">{ru.contribute.yourLinks}</p>
        {links.map((l, i) => (
          <div key={i} className="tm-row tm-row--gap-2">
            <input className="tm-input" value={l.label} placeholder={ru.contribute.linkLabel} aria-label={ru.contribute.linkLabel}
                   onChange={(e) => setLink(i, { label: e.target.value })} />
            <input className="tm-input" type="url" value={l.url} placeholder="https://" aria-label={ru.contribute.linkUrl}
                   onChange={(e) => setLink(i, { url: e.target.value })} />
            <Button variant="quiet" size="sm" onClick={() => removeLink(i)}>{ru.actions.remove}</Button>
          </div>
        ))}
        <div><Button variant="quiet" size="sm" onClick={addLink}>{ru.contribute.addLink}</Button></div>
      </div>
    </section>
  );
}
