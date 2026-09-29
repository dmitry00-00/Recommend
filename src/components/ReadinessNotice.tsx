import type { Readiness } from '@/types/tmdf';
import ru from '@/i18n/ru';

export interface ReadinessNoticeProps {
  readiness: Readiness;
}

/** Готовность приходит из данных: компонент только называет недостающее и показывает
 *  путь подготовки, если он есть. Ничего не вычисляет. */
export function ReadinessNotice({ readiness: r }: ReadinessNoticeProps) {
  if (r.ready) {
    return (
      <p className="tm-ready tm-ready--ok">
        <span className="tm-ready__mark" aria-hidden="true" />
        {ru.readiness.ready}
      </p>
    );
  }
  const labels = r.missing.map((m) => m.label);
  return (
    <div className="tm-ready tm-ready--wait">
      <p className="tm-ready__line">
        <span className="tm-ready__mark" aria-hidden="true" />
        {ru.readiness.easierAfter + labels.join(', ')}
      </p>
      {r.preparationPath?.length ? (
        <ol className="tm-ready__path">
          {r.preparationPath.map((s) => <li key={s.order}>{s.work.title}</li>)}
        </ol>
      ) : null}
    </div>
  );
}
