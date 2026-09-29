import { useState } from 'react';
import type { AssessmentAnswer, AssessmentItemData, FamiliarityLevel, ID } from '@/types/tmdf';
import { AssessmentProgress, type AssessmentProgressProps } from './AssessmentProgress';
import { WorkCover } from './WorkCover';
import { cx } from '@/lib/cx';
import ru from '@/i18n/ru';

export interface AssessmentItemProps {
  item: AssessmentItemData;
  /** прогресс над заданием; `false` — без него (задание внутри другого потока) */
  progress?: AssessmentProgressProps | false;
  /** каждый ответ отдаётся наверх сразу; собранный ответ уходит по «Дальше» экрана */
  onChange?: (answer: AssessmentAnswer | null) => void;
}

/** Одно задание диагностики: шесть видов ответа под одним вопросом. Компонент хранит только
 *  черновик ответа; что считать ответом и куда идти дальше — решает экран. Задание меняется —
 *  экран перемонтирует компонент по `key={item.id}`. */
export function AssessmentItem({ item, progress, onChange }: AssessmentItemProps) {
  const r = item.response;
  const [choice, setChoice] = useState<ID | null>(null);
  const [choices, setChoices] = useState<ID[]>([]);
  const [order, setOrder] = useState(r.type === 'ordering' ? r.items : []);
  const [scale, setScale] = useState<number | null>(null);
  const [text, setText] = useState('');
  const [levels, setLevels] = useState<Record<ID, FamiliarityLevel>>({});

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    const next = order.slice();
    [next[i], next[j]] = [next[j], next[i]];
    setOrder(next);
    onChange?.({ type: 'ordering', order: next.map((it) => it.id) });
  };

  let body;
  if (r.type === 'familiarity_grid') {
    body = (
      <div className="tm-agrid">
        {r.works.map((w) => (
          <div key={w.id} className="tm-agrid__cell">
            <WorkCover work={w} size="sm" />
            <p className="tm-agrid__title">{w.title}</p>
            <div className="tm-agrid__levels" role="radiogroup" aria-label={w.title}>
              {r.levels.map((f) => {
                const on = levels[w.id] === f;
                return (
                  <button key={f} type="button" role="radio" aria-checked={on ? 'true' : 'false'}
                          className={cx('tm-agrid__lvl', on && 'tm-agrid__lvl--on')}
                          onClick={() => {
                            const next = { ...levels, [w.id]: f };
                            setLevels(next);
                            onChange?.({ type: 'familiarity_grid', levels: next });
                          }}>
                    {ru.familiarity[f]}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  } else if (r.type === 'single_choice' || r.type === 'multi_choice') {
    const multi = r.type === 'multi_choice';
    body = (
      <div className="tm-achoice">
        {r.options.map((o) => {
          const on = multi ? choices.includes(o.id) : choice === o.id;
          return (
            <button key={o.id} type="button" className={cx('tm-achoice__opt', on && 'tm-achoice__opt--on')}
                    aria-pressed={on ? 'true' : 'false'}
                    onClick={() => {
                      if (!multi) {
                        setChoice(o.id);
                        onChange?.({ type: 'single_choice', optionId: o.id });
                        return;
                      }
                      const next = on ? choices.filter((id) => id !== o.id) : [...choices, o.id];
                      setChoices(next);
                      onChange?.({ type: 'multi_choice', optionIds: next });
                    }}>
              <span className="tm-achoice__mark" aria-hidden="true" />
              {o.label}
            </button>
          );
        })}
      </div>
    );
  } else if (r.type === 'ordering') {
    body = (
      <ol className="tm-aorder">
        {order.map((it, i) => (
          <li key={it.id} className="tm-aorder__row">
            <span className="tm-aorder__n">{i + 1}</span>
            <span className="tm-aorder__label">{it.label}</span>
            <span className="tm-aorder__btns">
              <button type="button" className="tm-aorder__btn" aria-label={`${ru.assessment.up}: ${it.label}`}
                      disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
              <button type="button" className="tm-aorder__btn" aria-label={`${ru.assessment.down}: ${it.label}`}
                      disabled={i === order.length - 1} onClick={() => move(i, 1)}>↓</button>
            </span>
          </li>
        ))}
      </ol>
    );
  } else if (r.type === 'scale') {
    const steps = [];
    for (let v = r.min; v <= r.max; v++) {
      steps.push(
        <button key={v} type="button" role="radio" aria-checked={scale === v ? 'true' : 'false'}
                aria-label={`${ru.assessment.position} ${v} ${ru.assessment.of} ${r.max}`}
                className={cx('tm-ascale__p', scale === v && 'tm-ascale__p--on')}
                onClick={() => { setScale(v); onChange?.({ type: 'scale', value: v }); }} />,
      );
    }
    body = (
      <div className="tm-ascale">
        <div className="tm-ascale__row" role="radiogroup" aria-label={item.prompt}>{steps}</div>
        <div className="tm-row tm-ascale__ends">
          <span>{r.minLabel}</span>
          <span>{r.maxLabel}</span>
        </div>
      </div>
    );
  } else {
    body = (
      <div>
        <textarea className="tm-refl__area" rows={4} maxLength={r.maxLength}
                  placeholder={ru.assessment.textPlaceholder} value={text}
                  aria-label={item.prompt}
                  onChange={(e) => {
                    setText(e.target.value);
                    onChange?.(e.target.value.trim() ? { type: 'free_text', text: e.target.value } : null);
                  }} />
        <p className="tm-refl__count">{`${text.length} / ${r.maxLength}`}</p>
      </div>
    );
  }

  return (
    <section className="tm-aitem">
      {progress !== false && progress ? <AssessmentProgress {...progress} /> : null}
      <h2 className="tm-aitem__prompt">{item.prompt}</h2>
      {item.body ? <p className="tm-aitem__body">{item.body}</p> : null}
      {body}
    </section>
  );
}
