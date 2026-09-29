import type { DifficultyPrediction, PerceivedDifficulty } from '@/types/tmdf';
import ru from '@/i18n/ru';

export interface PredictionNoteProps {
  prediction: DifficultyPrediction;
  actual?: PerceivedDifficulty;
  /** строку про модель показываем только с включённой механикой: это наша внутренняя сверка */
  showModel?: boolean;
}

const ORDER: Record<PerceivedDifficulty, number> = { too_easy: 0, just_right: 1, too_hard: 2 };

/** Сверка прогноза с тем, как оказалось. Про участника — без оценки: «ждали — вышло иначе»
 *  это факт о произведении и о дне, а не ошибка человека. Про модель — отдельной строкой и
 *  только для нас: мы обещали попадание, значит промах наш. */
export function PredictionNote({ prediction, actual, showModel }: PredictionNoteProps) {
  if (!actual) return null;
  const t = ru.prediction;
  const diff = ORDER[actual] - ORDER[prediction.expected];
  const text = diff === 0 ? t.hit(ru.difficulty[prediction.expected])
    : diff > 0 ? t.harder(ru.difficulty[prediction.expected])
    : t.easier(ru.difficulty[prediction.expected]);
  return (
    <p className="tm-prednote">
      {text}
      {showModel && prediction.model ? (
        <span className="tm-prednote__model">
          {prediction.model === actual ? t.modelHit : t.modelMiss(ru.difficulty[prediction.model])}
        </span>
      ) : null}
    </p>
  );
}
