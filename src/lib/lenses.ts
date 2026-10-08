import type { ExternalAnalysis, MaterialLens } from '@/types/tmdf';

/** Рубрики роликов (ТВ-3, 06.10): с какой стороны автор смотрит на произведение. Список общий
 *  с разметкой (tools/llm-lens.mts); порядок — порядок полок в карточке. Он постоянный и не
 *  зависит от того, чего у фильма больше: рубрики равноправны, без рейтинга и «престижных»
 *  мест (владелец 06.10) — иначе карточка либо станет каталогом грехообзоров, которых больше
 *  всех, либо закрепит иерархию «эссе выше трэша». */
export const LENSES = ['meaning', 'domain', 'specialist', 'facts', 'sins', 'compare', 'book', 'history', 'author', 'character', 'franchise', 'opinion', 'other'] as const satisfies readonly MaterialLens[];

/** Ролик YouTube → его рубрика из src/mocks/essayLenses.ts («sins» или «sins/facts» — со вторым
 *  углом). Ключ — id ролика: он один на все произведения, к которым ролик привязан. */
export const youtubeId = (url: string): string | undefined => /(?:v=|youtu\.be\/|shorts\/|live\/)([A-Za-z0-9_-]{11})/.exec(url)?.[1];

export function lensOf(raw: string | undefined): { lens?: MaterialLens; lensAlso?: MaterialLens } {
  if (!raw) return {};
  const [lens, also] = raw.split('/') as [MaterialLens, MaterialLens | undefined];
  return { lens, ...(also ? { lensAlso: also } : {}) };
}

/** Проставить рубрики материалам: у кого рубрика уже есть, тех не трогаем. */
export function attachLenses(list: ExternalAnalysis[], map: Record<string, string>): void {
  for (const a of list) {
    if (a.lens || a.platform !== 'youtube') continue;
    const id = youtubeId(a.url);
    const raw = id ? map[id] : undefined;
    if (raw) Object.assign(a, lensOf(raw));
  }
}

export const inLens = (a: ExternalAnalysis, lens: MaterialLens): boolean => a.lens === lens || a.lensAlso === lens;
