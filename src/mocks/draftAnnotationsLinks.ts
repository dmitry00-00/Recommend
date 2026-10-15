// Черновая разметка фильмов из роста справочника (РР-5, 15.10): фильмы filmBaseLinks.ts (мировое кино со статьёй в
// русской Википедии от 10 разделов). Отдельно от draftAnnotations.ts — не в первой загрузке: приложение подмешивает её
// вместе с карточками этих фильмов (`loadFilmLinks`, src/api/index.ts); инструменты видят обе части через
// tools/draft-annotations.mts. markup-wave дописывает сюда разметку фильмов этого модуля. Формат и шкала — как в
// draftAnnotations.ts. Не править руками — перегенерировать.
import type { CognitiveOperation, Confidence } from '@/types/tmdf';
import type { FirstPassAnnotation } from './userAnnotations';

const a = (
  ops: [CognitiveOperation, number][], level: number, barriers: string[], warnings: string[], niche: boolean,
  confidence: Confidence, what: string,
): FirstPassAnnotation => ({ ops, level, barriers, warnings, niche, confidence, what });

export const draftAnnotationsLinks: Record<string, FirstPassAnnotation> = {
};
