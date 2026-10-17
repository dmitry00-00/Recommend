import { useId, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Sheet } from './Sheet';
import { cx } from '@/lib/cx';
import ui from '@/i18n';

// Строки настроек (17.10, аудит удобства): вместо столбиков вариантов и абзацев под заголовками —
// одна строка «название слева — значение справа», выбор в нижнем листе, длинное пояснение — под «?»
// или в начале листа. Образец — решения владельца 17.10 (барабан оценки, тоггл кино/книги).

/** «?» у названия: раскрывает длинное пояснение под строкой. Кнопка внутри <label> переключатель не трогает. */
function Help({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button type="button" className="tm-srow__help" aria-expanded={open ? 'true' : 'false'} aria-label={ui.settings.more}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggle(); }}>?</button>
  );
}

export interface SettingRowProps {
  label: ReactNode;
  /** текущее значение — справа, приглушённо */
  value?: ReactNode;
  /** одна строка под названием */
  note?: ReactNode;
  /** длинное пояснение под «?» — только у строки без onClick/to */
  more?: ReactNode;
  onClick?: () => void;
  to?: string;
  disabled?: boolean;
  tone?: 'danger';
  /** справа — своё (кнопка), вместо значения и стрелки */
  aside?: ReactNode;
}

/** Строка настройки. С `onClick` или `to` — целиком цель касания со стрелкой «›»; без них — просто строка. */
export function SettingRow({ label, value, note, more, onClick, to, disabled, tone, aside }: SettingRowProps) {
  const [help, setHelp] = useState(false);
  const active = Boolean(onClick || to);
  // «?» — только у строки без действия: кнопка внутри кнопки или ссылки недопустима; у действия пояснение — там, куда ведёт
  const helpText = more && !active ? more : undefined;
  const inner = (
    <>
      <span className="tm-srow__text">
        <span className="tm-srow__label">{label}{helpText ? <Help open={help} onToggle={() => setHelp(!help)} /> : null}</span>
        {note ? <span className="tm-srow__note">{note}</span> : null}
      </span>
      {value != null && value !== '' ? <span className="tm-srow__value">{value}</span> : null}
      {active ? <span className="tm-srow__chev" aria-hidden="true">›</span> : null}
    </>
  );
  const cls = cx('tm-srow', active && 'tm-srow--tap', tone === 'danger' && 'tm-srow--danger');
  return (
    <div className="tm-srow__wrap">
      {to ? <Link className={cls} to={to}>{inner}</Link>
        : onClick ? <button type="button" className={cls} disabled={disabled} onClick={onClick}>{inner}</button>
        : <div className={cls}>{inner}{aside}</div>}
      {helpText && help ? <p className="tm-srow__more">{helpText}</p> : null}
    </div>
  );
}

/** Переключатель: название и строка пояснения слева, тумблер справа; вся строка — цель касания. */
export function SettingSwitch({ label, note, more, checked, disabled, onChange }: {
  label: ReactNode; note?: ReactNode; more?: ReactNode; checked: boolean; disabled?: boolean; onChange: (on: boolean) => void;
}) {
  const [help, setHelp] = useState(false);
  // htmlFor обязателен: без него меткой управляет первый «помечаемый» потомок — кнопка «?», а не тумблер
  const id = useId();
  return (
    <div className="tm-srow__wrap">
      <label className="tm-srow tm-srow--tap tm-srow--switch" htmlFor={id}>
        <span className="tm-srow__text">
          <span className="tm-srow__label">{label}{more ? <Help open={help} onToggle={() => setHelp(!help)} /> : null}</span>
          {note ? <span className="tm-srow__note">{note}</span> : null}
        </span>
        <input id={id} type="checkbox" role="switch" className="tm-srow__switch" checked={checked} disabled={disabled}
               onChange={(e) => onChange(e.target.checked)} />
      </label>
      {more && help ? <p className="tm-srow__more">{more}</p> : null}
    </div>
  );
}

export interface PickOption<T> {
  value: T;
  label: string;
  /** подпись в строке, если короче названия в листе */
  short?: string;
  /** пояснение под вариантом в листе */
  note?: string;
}

/** Один вариант из нескольких: строка со значением, касание — нижний лист со списком; выбор закрывает лист. */
export function SettingPicker<T extends string | number>({ label, value, options, onPick, note, intro, footer, disabled }: {
  label: string; value: T; options: PickOption<T>[]; onPick: (v: T) => void;
  note?: ReactNode; intro?: ReactNode; footer?: ReactNode; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const cur = options.find((o) => o.value === value);
  return (
    <>
      {/* строку на время сохранения не гасим — мигала бы на каждом выборе; закрыты только варианты в листе */}
      <SettingRow label={label} note={note} value={cur ? cur.short ?? cur.label : ''} onClick={() => setOpen(true)} />
      <Sheet open={open} onOpenChange={setOpen} title={label}>
        {intro ? <p className="tm-body-sm tm-srow__intro" id={id}>{intro}</p> : null}
        <div className="tm-achoice tm-srow__opts" role="radiogroup" aria-label={label} aria-describedby={intro ? id : undefined}>
          {options.map((o) => {
            const on = o.value === value;
            return (
              <button key={String(o.value)} type="button" role="radio" aria-checked={on ? 'true' : 'false'}
                      className={cx('tm-achoice__opt', on && 'tm-achoice__opt--on')} disabled={disabled}
                      onClick={() => { if (!on) onPick(o.value); setOpen(false); }}>
                <span className="tm-achoice__mark" aria-hidden="true" />
                <span className="tm-srow__opt">
                  <span>{o.label}</span>
                  {o.note ? <span className="tm-srow__optnote">{o.note}</span> : null}
                </span>
              </button>
            );
          })}
        </div>
        {footer}
      </Sheet>
    </>
  );
}

/** Несколько вариантов: строка со сводкой, в листе — флажки; каждое касание сохраняется сразу, лист остаётся. */
export function SettingMulti<T extends string>({ label, summary, values, options, onChange, note, intro, footer, disabled, min = 0 }: {
  label: string; summary: ReactNode; values: T[]; options: PickOption<T>[] | null; onChange: (next: T[]) => void;
  note?: ReactNode; intro?: ReactNode; footer?: ReactNode; disabled?: boolean; min?: number;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <SettingRow label={label} note={note} value={summary} onClick={() => setOpen(true)} />
      <Sheet open={open} onOpenChange={setOpen} title={label}>
        {intro ? <p className="tm-body-sm tm-srow__intro">{intro}</p> : null}
        <div className="tm-achoice tm-srow__opts" role="group" aria-label={label}>
          {(options ?? []).map((o) => {
            const on = values.includes(o.value);
            const last = on && values.length <= min;
            return (
              <button key={o.value} type="button" aria-pressed={on ? 'true' : 'false'}
                      className={cx('tm-achoice__opt', on && 'tm-achoice__opt--on')} disabled={disabled || last}
                      onClick={() => onChange(on ? values.filter((x) => x !== o.value) : [...values, o.value])}>
                <span className="tm-achoice__mark" aria-hidden="true" />
                <span className="tm-srow__opt">
                  <span>{o.label}</span>
                  {o.note ? <span className="tm-srow__optnote">{o.note}</span> : null}
                </span>
              </button>
            );
          })}
        </div>
        {footer}
      </Sheet>
    </>
  );
}

/** Заголовок группы с одной строкой пояснения; длинное — под «?». */
export function SettingHead({ title, note, more }: { title: ReactNode; note?: ReactNode; more?: ReactNode }) {
  const [help, setHelp] = useState(false);
  return (
    <>
      <h2 className="tm-title-3 tm-settings__h tm-srow__head">
        {title}{more ? <Help open={help} onToggle={() => setHelp(!help)} /> : null}
      </h2>
      {note ? <p className="tm-body-sm tm-settings__note tm-srow__headnote">{note}</p> : null}
      {more && help ? <p className="tm-srow__more">{more}</p> : null}
    </>
  );
}
