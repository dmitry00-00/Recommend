import ru from '@/i18n/ru';

export interface ValidationListProps {
  errors: { path: string; message: string }[];
}

/** Ошибки валидации аннотации: путь ведёт к полю в разнице. Без ошибок — так и сказано. */
export function ValidationList({ errors }: ValidationListProps) {
  return (
    <div className="tm-valid">
      <h4 className="tm-valid__title">{ru.curator.validationTitle}</h4>
      {errors.length ? (
        <ul className="tm-valid__list">
          {errors.map((e, i) => (
            <li key={i}>
              <a className="tm-valid__path" href={`#${e.path}`}>{e.path}</a>
              <span className="tm-valid__msg">{e.message}</span>
            </li>
          ))}
        </ul>
      ) : <p className="tm-valid__ok">{ru.curator.validationOk}</p>}
    </div>
  );
}
