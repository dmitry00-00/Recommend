// Разметка сериалов целиком — для инструментов (15.10, РР-4): seriesAnnotations.ts (в первой загрузке приложения) и
// seriesAnnotationsWiki.ts (сериалы из роста справочника, приложение грузит их лениво). Инструментам граница
// загрузки не важна: очередь разметки, желания героев, почерк, разрывы должны видеть все размеченные сериалы.
export * from '../src/mocks/seriesAnnotations.ts';
import { seriesAnnotations as base, type SeriesDraft } from '../src/mocks/seriesAnnotations.ts';
import { seriesAnnotationsWiki } from '../src/mocks/seriesAnnotationsWiki.ts';

export const seriesAnnotations: Record<string, SeriesDraft> = { ...base, ...seriesAnnotationsWiki };
