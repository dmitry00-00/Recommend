import type { DifficultyPrediction, PerceivedDifficulty } from '@/types/tmdf';
import ui from '@/i18n';

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
  const t = ui.prediction;
  const diff = ORDER[actual] - ORDER[prediction.expected];
  const text = diff === 0 ? t.hit(ui.difficulty[prediction.expected])
    : diff > 0 ? t.harder(ui.difficulty[prediction.expected])
    : t.easier(ui.difficulty[prediction.expected]);
  return (
    <p className="tm-prednote">
      {text}
      {showModel && prediction.model ? (
        <span className="tm-prednote__model">
          {prediction.model === actual ? t.modelHit : t.modelMiss(ui.difficulty[prediction.model])}
        </span>
      ) : null}
    </p>
  );
}
