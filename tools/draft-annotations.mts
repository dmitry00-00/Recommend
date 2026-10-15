// Черновая разметка фильмов целиком — для инструментов (15.10, РР-5): draftAnnotations.ts (в первой загрузке
// приложения) и draftAnnotationsLinks.ts (фильмы из роста справочника, приложение грузит их лениво). Инструментам
// граница загрузки не важна: очередь разметки, желания героев, почерк, разрывы должны видеть все размеченные фильмы.
export * from '../src/mocks/draftAnnotations.ts';
import { draftAnnotations as base } from '../src/mocks/draftAnnotations.ts';
import { draftAnnotationsLinks } from '../src/mocks/draftAnnotationsLinks.ts';
import type { FirstPassAnnotation } from '../src/mocks/userAnnotations.ts';

export const draftAnnotations: Record<string, FirstPassAnnotation> = { ...base, ...draftAnnotationsLinks };
