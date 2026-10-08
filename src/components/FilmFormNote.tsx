import type { CSSProperties } from 'react';
import type { FilmForm } from '@/types/tmdf';
import ui, { locale, plural } from '@/i18n';

export interface FilmFormNoteProps {
  form: FilmForm;
}

/** Дробное число по-русски всегда идёт с родительным единственного: «8,4 минуты», а не
 *  «8,4 минут» (по-английски «few» — то же множественное). Целое согласуется по обычному правилу. */
function withUnit(n: number, [one, few, many]: readonly [string, string, string]): string {
  const text = n.toLocaleString(locale);
  return `${text} ${Number.isInteger(n) ? plural(n, one, few, many) : few}`;
}

/** Шкала с меткой: где этот фильм среди измеренных. Не оценка — линейка, поэтому у неё
 *  подписаны оба края, а не «хорошо / плохо». Числа остаются строкой ниже: картинка отвечает
 *  на «это много или мало», строка — на «сколько именно». */
function Scale({ label, percentile, low, high }: { label: string; percentile: number; low: string; high: string }) {
  return (
    <div className="tm-form__scale">
      <span className="tm-label tm-form__scalelabel">{label}</span>
      <span className="tm-form__track" role="img" aria-label={`${label}: ${ui.filmForm.scaleHere(percentile)}`}>
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
  const speed = ui.units.perMinute(withUnit(form.wordsPerMinute, ui.units.word));
  const longest = form.longestSilenceMinutes >= 1
    ? withUnit(form.longestSilenceMinutes, ui.units.minute)
    : withUnit(Math.round(form.longestSilenceMinutes * 60), ui.units.second);
  const sources = form.sources === 1 ? ui.filmForm.oneSource : ui.filmForm.manySources(String(form.sources));
  const spread = form.sources > 1 && form.spreadWordsPerMinute != null
    ? ui.units.perMinute(withUnit(form.spreadWordsPerMinute, ui.units.word))
    : undefined;
  return (
    <section className="tm-form">
      <h3 className="tm-title-3 tm-form__title">{ui.filmForm.title}</h3>
      <Scale label={ui.filmForm.scaleSpeechLabel} percentile={form.speechPercentile}
             low={ui.filmForm.scaleSpeechLow} high={ui.filmForm.scaleSpeechHigh} />
      <Scale label={ui.filmForm.scaleSilenceLabel} percentile={form.silencePercentile}
             low={ui.filmForm.scaleSilenceLow} high={ui.filmForm.scaleSilenceHigh} />
      <p className="tm-body-sm tm-form__line">{ui.filmForm.speech(speed, form.speechPercentile)}</p>
      <p className="tm-body-sm tm-form__line">
        {ui.filmForm.silence(Math.round(form.silentShare * 100), longest, form.silencePercentile)}
      </p>
      <p className="tm-caption tm-form__note">
        {ui.filmForm.source(sources, spread)} {ui.filmForm.caveat}
      </p>
    </section>
  );
}
