import { useState } from 'react';
import type { RecommendationExplanation } from '@/types/tmdf';
import ru from '@/i18n/ru';

export interface ExplanationBlockProps {
  explanation: RecommendationExplanation;
  defaultOpen?: boolean;
  /** все четыре блока видны всегда, без кнопки */
  always?: boolean;
  /** «зачем сейчас» уехало в полосу склейки — не дублируем */
  omitWhyNow?: boolean;
}

function Block({ title, text }: { title: string; text: string }) {
  return (
    <div className="tm-expl__b">
      <h4 className="tm-expl__t">{title}</h4>
      <p className="tm-expl__p">{text}</p>
    </div>
  );
}

export function ExplanationBlock({ explanation, defaultOpen, always, omitWhyNow }: ExplanationBlockProps) {
  const [open, setOpen] = useState(Boolean(defaultOpen));
  const shown = open || always;
  return (
    <div className="tm-expl">
      <Block title={ru.explanation.what} text={explanation.what} />
      <Block title={ru.explanation.why} text={explanation.why} />
      {shown && !omitWhyNow ? <Block title={ru.explanation.whyNow} text={explanation.whyNow} /> : null}
      {shown ? <Block title={ru.explanation.whatNext} text={explanation.whatNext} /> : null}
      {always ? null : (
        <button type="button" className="tm-expl__more" aria-expanded={open ? 'true' : 'false'}
                onClick={() => setOpen(!open)}>
          <span>{open ? ru.actions.collapse : ru.actions.whatNext}</span>
          <span className="tm-expl__sign" aria-hidden="true">{open ? '−' : '+'}</span>
        </button>
      )}
    </div>
  );
}
