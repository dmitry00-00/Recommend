import type { TropeInsightData } from '@/types/tmdf';
import { OperationChip } from './OperationChip';
import { cx } from '@/lib/cx';
import ui from '@/i18n';

export interface TropeInsightProps {
  insight: TropeInsightData;
  /** путь по таксономии — для кураторской и разбора, не для ленты */
  showPath?: boolean;
}

/** Приём в произведении: имя, как использован, объяснение простыми словами, операции. */
export function TropeInsight({ insight: t, showPath }: TropeInsightProps) {
  return (
    <article className="tm-trope">
      <div className="tm-trope__head">
        <h4 className="tm-trope__name">{t.name}</h4>
        <span className="tm-trope__usage">{ui.tropeUsage[t.usage]}</span>
        {t.charge ? (
          <span className={cx('tm-trope__charge', `tm-trope__charge--${t.charge}`)} title={ui.chargeNote[t.charge]}>
            {ui.charge[t.charge]}
            <span className="tm-sr">{` — ${ui.chargeNote[t.charge]}`}</span>
          </span>
        ) : null}
      </div>
      <p className="tm-trope__text">{t.plainExplanation}</p>
      <div className="tm-row tm-row--wrap tm-row--gap-1">
        {t.operations.map((op) => <OperationChip key={op} op={op} size="sm" short />)}
      </div>
      {showPath && t.tropePath.length ? (
        <p className="tm-trope__path">{t.tropePath.join(' → ')}</p>
      ) : null}
    </article>
  );
}
