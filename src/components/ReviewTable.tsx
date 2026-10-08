import type { AnnotationReviewItem } from '@/types/tmdf';
import { StatusTag } from './StatusTag';
import { FieldConfidence } from './FieldConfidence';
import { cx } from '@/lib/cx';
import ui, { plural, locale } from '@/i18n';
import { titleOf } from '@/lib/format';

export interface ReviewTableProps {
  items: AnnotationReviewItem[];
  caption?: string;
  onOpen?: (item: AnnotationReviewItem) => void;
}

const fmt = (n: number) => n.toLocaleString(locale);

/** Очередь аннотаций: произведение, статус, источник, уверенность, ошибки, знания модели,
 *  сигналы с провенансом (сверх бандла — колонка по образцу attribution у отображений),
 *  токены и время. Строка открывается по названию. */
export function ReviewTable({ items, caption, onOpen }: ReviewTableProps) {
  return (
    <div className="tm-table__wrap">
      <table className="tm-table">
        <caption>{caption ?? ui.curator.queueCaption}</caption>
        <thead>
          <tr>{ui.curator.queueCols.map((t) => <th key={t} scope="col">{t}</th>)}</tr>
        </thead>
        <tbody>
          {items.map((it) => {
            const tokens = it.usage.inputTokens + it.usage.outputTokens;
            const errors = it.validationErrors.length;
            const unsure = it.lowConfidenceFields.length;
            return (
              <tr key={it.annotationId} className={cx(it.isGold && 'tm-table__row--gold')}>
                <th scope="row">
                  {onOpen ? (
                    <button type="button" className="tm-table__work tm-table__open" onClick={() => onOpen(it)}>{titleOf(it.work)}</button>
                  ) : <span className="tm-table__work">{titleOf(it.work)}</span>}
                  <span className="tm-table__sub">{`${it.work.year} · ${it.work.creators.join(', ')}`}</span>
                  {it.isGold ? <span className="tm-table__gold">{ui.curator.gold}</span> : null}
                </th>
                <td><StatusTag status={it.status} /></td>
                <td>{ui.annotationProvider[it.provider]}<span className="tm-table__sub">{it.model}</span></td>
                <td><FieldConfidence confidence={it.overallConfidence} /></td>
                <td>
                  {errors ? <span className="tm-table__err">{`${errors} ${plural(errors, ...ui.curator.errorsN)}`}</span>
                    : unsure ? <span className="tm-table__sub">{`${unsure} ${plural(unsure, ...ui.curator.fieldsUnsure)}`}</span> : '—'}
                </td>
                <td>{ui.curator.knowledge[it.knowledgeSufficiency]}</td>
                <td>
                  {it.loop ? <span className="tm-table__err">{it.loop}</span> : null}
                  {it.signals?.length ? it.signals.map((s, i) => (
                    <span key={i} className="tm-table__sub" title={ui.curator.signalTitle(s.source, s.fetchedAt, s.license)}>
                      {`${ui.curator.signalKind[s.kind]} · ${s.source}`}
                    </span>
                  )) : it.loop ? null : ui.curator.signalsNone}
                </td>
                <td className="tm-table__num">
                  {tokens ? fmt(tokens) : '—'}
                  <span className="tm-table__sub">{it.usage.durationMs ? `${Math.round(it.usage.durationMs / 1000)} ${ui.curator.seconds}` : '—'}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
