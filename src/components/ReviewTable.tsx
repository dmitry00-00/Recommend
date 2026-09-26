import type { AnnotationReviewItem } from '@/types/tmdf';
import { StatusTag } from './StatusTag';
import { FieldConfidence } from './FieldConfidence';
import { pluralRu } from '@/lib/format';
import { cx } from '@/lib/cx';
import ru from '@/i18n/ru';

export interface ReviewTableProps {
  items: AnnotationReviewItem[];
  caption?: string;
  onOpen?: (item: AnnotationReviewItem) => void;
}

const fmt = (n: number) => n.toLocaleString('ru');

/** Очередь аннотаций: произведение, статус, источник, уверенность, ошибки, знания модели,
 *  сигналы с провенансом (сверх бандла — колонка по образцу attribution у отображений),
 *  токены и время. Строка открывается по названию. */
export function ReviewTable({ items, caption, onOpen }: ReviewTableProps) {
  return (
    <div className="tm-table__wrap">
      <table className="tm-table">
        <caption>{caption ?? ru.curator.queueCaption}</caption>
        <thead>
          <tr>{ru.curator.queueCols.map((t) => <th key={t} scope="col">{t}</th>)}</tr>
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
                    <button type="button" className="tm-table__work tm-table__open" onClick={() => onOpen(it)}>{it.work.title}</button>
                  ) : <span className="tm-table__work">{it.work.title}</span>}
                  <span className="tm-table__sub">{`${it.work.year} · ${it.work.creators.join(', ')}`}</span>
                  {it.isGold ? <span className="tm-table__gold">{ru.curator.gold}</span> : null}
                </th>
                <td><StatusTag status={it.status} /></td>
                <td>{ru.annotationProvider[it.provider]}<span className="tm-table__sub">{it.model}</span></td>
                <td><FieldConfidence confidence={it.overallConfidence} /></td>
                <td>
                  {errors ? <span className="tm-table__err">{`${errors} ${pluralRu(errors, ...ru.curator.errorsN)}`}</span>
                    : unsure ? <span className="tm-table__sub">{`${unsure} ${pluralRu(unsure, ...ru.curator.fieldsUnsure)}`}</span> : '—'}
                </td>
                <td>{ru.curator.knowledge[it.knowledgeSufficiency]}</td>
                <td>
                  {it.signals?.length ? it.signals.map((s, i) => (
                    <span key={i} className="tm-table__sub" title={ru.curator.signalTitle(s.source, s.fetchedAt, s.license)}>
                      {`${ru.curator.signalKind[s.kind]} · ${s.source}`}
                    </span>
                  )) : ru.curator.signalsNone}
                </td>
                <td className="tm-table__num">
                  {tokens ? fmt(tokens) : '—'}
                  <span className="tm-table__sub">{it.usage.durationMs ? `${Math.round(it.usage.durationMs / 1000)} ${ru.curator.seconds}` : '—'}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
