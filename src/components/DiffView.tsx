import type { AnnotationDiffRow } from '@/types/tmdf';
import { FieldConfidence } from './FieldConfidence';
import { cx } from '@/lib/cx';
import ru from '@/i18n/ru';

export interface DiffViewProps {
  rows: AnnotationDiffRow[];
  /** слепой режим: колонка черновика скрыта, пока куратор не сохранит свою версию */
  hideDraft?: boolean;
}

/** Черновик модели против опубликованной версии, поле за полем; изменившиеся — с кромкой. */
export function DiffView({ rows, hideDraft }: DiffViewProps) {
  return (
    <div className="tm-dv">
      <div className="tm-dv__col">
        <h4 className="tm-dv__title">{ru.curator.draft}</h4>
        {hideDraft ? <p className="tm-dv__ev">{ru.curator.draftHidden}</p> : rows.map((r, i) => (
          <div key={i} className={cx('tm-dv__row', r.changed && 'tm-dv__row--changed')}>
            <code className="tm-dv__path">{r.path}</code>
            <p className="tm-dv__val">{r.draft}</p>
            {r.confidence ? <FieldConfidence confidence={r.confidence} label={false} /> : null}
            {r.evidence ? <p className="tm-dv__ev">{`${ru.curator.evidence}: ${r.evidence}`}</p> : null}
          </div>
        ))}
      </div>
      <div className="tm-dv__col tm-dv__col--current">
        <h4 className="tm-dv__title">{ru.curator.published}</h4>
        {rows.map((r, i) => (
          <div key={i} className={cx('tm-dv__row', r.changed && 'tm-dv__row--changed')}>
            <code className="tm-dv__path">{r.path}</code>
            <p className="tm-dv__val">{r.current == null ? '—' : r.current}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
