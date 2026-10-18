// Сгенерировано tools/grow-film-base.mts (2026-10-18): пополнение справочника, волна В (--out filmBaseMore). Модуль ленивый —
// не в первой загрузке (src/api/index.ts, loadFilmLinks). Не править руками — перегенерировать.
import type { ExternalIds, WorkCard } from '@/types/tmdf';

const c = (qid: string, type: 'film' | 'series', title: string, originalTitle: string, year: number, creators: string[], externalIds: ExternalIds): WorkCard => ({
  id: `f-wd${qid}`, type, title, ...(originalTitle ? { originalTitle } : {}), year, creators,
  primaryOperations: [], complexityLevel: 0, warnings: [], barriers: [], isNicheMasterpiece: false, externalIds,
});
void c;

export const filmBaseMore: WorkCard[] = [
];
