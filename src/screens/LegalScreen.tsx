import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button } from '@/components';
import { LEGAL, LEGAL_DOCS, collabOn, isLegalDoc } from '@/lib/legal';
import { BOT_USERNAME, openExternal, writeAuthorUrl } from '@/lib/telegram';
import ui, { language } from '@/i18n';
import ru, { type Strings } from '@/i18n/ru';

/** Документы (ЗП-5): «Как работает подбор» (правила рекомендательных технологий), политика обработки данных и (24.10)
 *  согласие на обработку — отдельным документом. Тексты — ui.legal, владелец и почта — из сборки (src/lib/legal.ts). */
export function LegalScreen() {
  const { doc } = useParams();
  // правила — на русском (149-ФЗ, ст. 10.2-2), 24.10: в английском интерфейсе русская редакция — одной кнопкой;
  // русский словарь и так в основной сборке (src/i18n/index.ts), лишнего не грузим
  const [official, setOfficial] = useState(false);
  const L: Strings['legal'] = official ? ru.legal : ui.legal;
  if (!isLegalDoc(doc)) {
    return <main className="tm-shell__main tm-legal"><h1 className="tm-shell__title">{L.notFound}</h1></main>;
  }
  const title = { rules: L.rules, privacy: L.privacy, consent: L.consent };
  // разделы `collab` — только когда подбор учитывает чужие оценки (опыты, src/lib/model/experiments.ts)
  const collab = collabOn();
  const sections = (doc === 'rules' ? L.rulesDoc : doc === 'privacy' ? L.privacyDoc : L.consentDoc).filter((s) => collab || !s.collab);
  return (
    <main className="tm-shell__main tm-legal">
      <h1 className="tm-shell__title">{title[doc]}</h1>
      <p className="tm-caption tm-legal__edition">{L.edition(LEGAL.edition)}</p>
      {language !== 'ru' ? (
        <Button size="sm" variant="quiet" onClick={() => setOfficial(!official)}>{official ? L.backToUi : L.officialRu}</Button>
      ) : null}
      {sections.map((s) => (
        <section key={s.h} className="tm-legal__section">
          <h2 className="tm-title-3">{s.h}</h2>
          {/* имя бота в тексте — того контура, где открыто приложение (ЗП-26) */}
          {s.p.map((p) => <p key={p.slice(0, 40)} className="tm-body">{p.replaceAll('@recomend_media_bot', `@${BOT_USERNAME}`)}</p>)}
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
      <p className="tm-body-sm tm-legal__other">
        {LEGAL_DOCS.filter((d) => d !== doc).map((d, i) => (
          <span key={d}>{i ? ' · ' : null}<Link to={`/legal/${d}`}>{title[d]}</Link></span>
        ))}
      </p>
    </main>
  );
}
