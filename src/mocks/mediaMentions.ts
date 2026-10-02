// Сгенерировано tools/build-media-mentions.mts (2026-10-02) из разметки модели
// (.cache/llm/labels.json): в скольких подборках, роликах о нескольких и новостях названо произведение;
// темы роликов без произведения. Это догадка модели, а не решение человека. Не править руками.
export interface MediaMentions { list?: number; several?: number; news?: number }

export const mediaMentions: { labels: number; works: Record<string, MediaMentions>; topics: { name: string; type?: string; n: number }[] } = {
 "labels": 0,
 "works": {},
 "topics": []
};
