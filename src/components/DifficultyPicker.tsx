import { useState } from 'react';
import type { PerceivedDifficulty } from '@/types/tmdf';
import { cx } from '@/lib/cx';
import ru from '@/i18n/ru';

export interface DifficultyPickerProps {
  value?: PerceivedDifficulty;
  label?: string;
  onPick?: (id: PerceivedDifficulty) => void;
}

const ORDER: PerceivedDifficulty[] = ['too_easy', 'just_right', 'too_hard'];

/** Три ступени: склон растёт слева направо. Ответ — данные о человеке, а не оценка произведения. */
export function DifficultyPicker({ value, label, onPick }: DifficultyPickerProps) {
  const [picked, setPicked] = useState<PerceivedDifficulty | null>(value ?? null);
  const text = label ?? ru.difficultyPicker.label;
  return (
    <div className="tm-diff" role="radiogroup" aria-label={text}>
      <p className="tm-diff__q">{text}</p>
      <div className="tm-row tm-row--gap-2">
        {ORDER.map((id, i) => {
          const on = picked === id;
          return (
            <button key={id} type="button" role="radio" aria-checked={on ? 'true' : 'false'}
                    className={cx('tm-diff__opt', on && 'tm-diff__opt--on')}
                    onClick={() => { setPicked(id); onPick?.(id); }}>
              <span className="tm-diff__slope" aria-hidden="true">
                {[0, 1, 2].map((k) => <span key={k} className={cx('tm-diff__b', k <= i && 'tm-diff__b--on')} />)}
              </span>
              {ru.difficulty[id]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
