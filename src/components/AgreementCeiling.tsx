import type { AgreementCeilingData } from '@/types/tmdf';
import { cx } from '@/lib/cx';
import ru from '@/i18n/ru';

export type AgreementCeilingProps = AgreementCeilingData;

/** Потолок согласованности: α повторной разметки эталона и отметки источников на шкале.
 *  Выше потолка подняться нельзя — это предел измерения, а не модели. Подписи соседних
 *  отметок разведены по высоте (`--alt`, стиль в app.css) — иначе на широкой шкале слипаются. */
export function AgreementCeiling({ selfAgreement, ceiling, weeks, marks }: AgreementCeilingProps) {
  const cap = ceiling ?? selfAgreement;
  return (
    <div className="tm-ceiling">
      <h4 className="tm-ceiling__title">{ru.curator.ceilingTitle}</h4>
      <p className="tm-ceiling__text">{ru.curator.ceilingText(weeks, selfAgreement.toFixed(2))}</p>
      <div className="tm-ceiling__scale">
        <span className="tm-ceiling__cap" style={{ left: `${cap * 100}%` }}>
          <span className="tm-ceiling__caplabel">{ru.curator.ceilingCap(cap.toFixed(2))}</span>
        </span>
        {[...marks].sort((a, b) => a.alpha - b.alpha).map((m, i) => (
          <span key={m.label} className={cx('tm-ceiling__mark', i % 2 === 1 && 'tm-ceiling__mark--alt')} style={{ left: `${m.alpha * 100}%` }}>
            <span className="tm-ceiling__marklabel">{`${m.label} ${m.alpha.toFixed(2)}`}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
