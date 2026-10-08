import { Link, useParams } from 'react-router-dom';
import { Button } from '@/components';
import { LEGAL, isLegalDoc } from '@/lib/legal';
import { openExternal, writeAuthorUrl } from '@/lib/telegram';
import ui from '@/i18n';

/** Документы (ЗП-5): «Как работает подбор» (правила рекомендательных технологий) и политика обработки данных.
 *  Тексты — ui.legal, владелец и почта — из сборки (src/lib/legal.ts). */
export function LegalScreen() {
  const { doc } = useParams();
  const L = ui.legal;
  if (!isLegalDoc(doc)) {
    return <main className="tm-shell__main tm-legal"><h1 className="tm-shell__title">{L.notFound}</h1></main>;
  }
  const sections = doc === 'rules' ? L.rulesDoc : L.privacyDoc;
  const other = doc === 'rules' ? 'privacy' : 'rules';
  return (
    <main className="tm-shell__main tm-legal">
      <h1 className="tm-shell__title">{doc === 'rules' ? L.rules : L.privacy}</h1>
      <p className="tm-caption tm-legal__edition">{L.edition(LEGAL.edition)}</p>
      {sections.map((s) => (
        <section key={s.h} className="tm-legal__section">
          <h2 className="tm-title-3">{s.h}</h2>
          {s.p.map((p) => <p key={p.slice(0, 40)} className="tm-body">{p}</p>)}
        </section>
      ))}
      <section className="tm-legal__section">
        <h2 className="tm-title-3">{L.operator}</h2>
        <p className="tm-body">{LEGAL.operator ?? L.pendingOperator}</p>
        <h2 className="tm-title-3">{L.email}</h2>
        {LEGAL.email
          ? <p className="tm-body"><a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a></p>
          : (
            <>
              <p className="tm-body">{L.pendingEmail}</p>
              <Button size="sm" onClick={() => openExternal(writeAuthorUrl)}>{L.writeAuthor}</Button>
            </>
          )}
      </section>
      <p className="tm-body-sm tm-legal__other"><Link to={`/legal/${other}`}>{L.other[doc]}</Link></p>
    </main>
  );
}
