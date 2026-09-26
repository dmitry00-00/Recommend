import type { CSSProperties } from 'react';
import type { FilmForm } from '@/types/tmdf';
import { pluralRu } from '@/lib/format';
import ru from '@/i18n/ru';

export interface FilmFormNoteProps {
  form: FilmForm;
}

/** Дробное число по-русски всегда идёт с родительным единственного: «8,4 минуты», а не
 *  «8,4 минут». Целое согласуется по обычному правилу. */
function withUnit(n: number, one: string, few: string, many: string): string {
  const text = n.toLocaleString('ru-RU');
  return `${text} ${Number.isInteger(n) ? pluralRu(n, one, few, many) : few}`;
}

/** Шкала с меткой: где этот фильм среди измеренных. Не оценка — линейка, поэтому у неё
 *  подписаны оба края, а не «хорошо / плохо». Числа остаются строкой ниже: картинка отвечает
 *  на «это много или мало», строка — на «сколько именно». */
function Scale({ label, percentile, low, high }: { label: string; percentile: number; low: string; high: string }) {
  return (
    <div className="tm-form__scale">
      <span className="tm-label tm-form__scalelabel">{label}</span>
      <span className="tm-form__track" role="img" aria-label={`${label}: ${ru.filmForm.scaleHere(percentile)}`}>
        <span className="tm-form__mark" style={{ '--at': `${Math.min(98, Math.max(2, percentile))}%` } as CSSProperties} />
      </span>
      <span className="tm-form__ends">
        <span>{low}</span>
        <span>{high}</span>
      </span>
    </div>
  );
}

/** Темп речи и тишины, посчитанный по субтитрам. Показываем число и место среди измеренных —
 *  и ничего не выводим: «сложно» из плотности речи не следует, а вот «сегодня я не вытяну
 *  два часа, где две трети времени молчат» — следует, и это решение человека, не наше.
 *  Оговорка внизу обязательна: без неё строка читается как оценка сложности. */
export function FilmFormNote({ form }: FilmFormNoteProps) {
  const speed = `${withUnit(form.wordsPerMinute, 'слово', 'слова', 'слов')} в минуту`;
  const longest = form.longestSilenceMinutes >= 1
    ? withUnit(form.longestSilenceMinutes, 'минута', 'минуты', 'минут')
    : withUnit(Math.round(form.longestSilenceMinutes * 60), 'секунда', 'секунды', 'секунд');
  const sources = form.sources === 1 ? ru.filmForm.oneSource : ru.filmForm.manySources(String(form.sources));
  const spread = form.sources > 1 && form.spreadWordsPerMinute != null
    ? `${withUnit(form.spreadWordsPerMinute, 'слово', 'слова', 'слов')} в минуту`
    : undefined;
  return (
    <section className="tm-form">
      <h3 className="tm-title-3 tm-form__title">{ru.filmForm.title}</h3>
      <Scale label={ru.filmForm.scaleSpeechLabel} percentile={form.speechPercentile}
             low={ru.filmForm.scaleSpeechLow} high={ru.filmForm.scaleSpeechHigh} />
      <Scale label={ru.filmForm.scaleSilenceLabel} percentile={form.silencePercentile}
             low={ru.filmForm.scaleSilenceLow} high={ru.filmForm.scaleSilenceHigh} />
      <p className="tm-body-sm tm-form__line">{ru.filmForm.speech(speed, form.speechPercentile)}</p>
      <p className="tm-body-sm tm-form__line">
        {ru.filmForm.silence(Math.round(form.silentShare * 100), longest, form.silencePercentile)}
      </p>
      <p className="tm-caption tm-form__note">
        {ru.filmForm.source(sources, spread)} {ru.filmForm.caveat}
      </p>
    </section>
  );
}
