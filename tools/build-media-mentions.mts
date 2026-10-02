/**
 * Упоминания произведений по разметке модели (02.10) → src/mocks/mediaMentions.ts.
 *
 * Опознаватель по названию видит одно произведение на ролик. Модель видит больше: подборки
 * («10 фильмов про одиночество»), ролики о нескольких сразу и новости. Здесь это копится
 * в счётчики для страницы статистики произведения и вселенной: «в подборках: 14».
 * Темы роликов без произведения (жанр, эпоха, страна) копятся отдельно — для будущей
 * страницы жанров.
 *
 *   npx tsx tools/build-media-mentions.mts
 */
import { writeFileSync } from 'node:fs';
import { readLabels, resolver, type Kind } from './llm-lib.mts';
import { worksIndex } from './works-index.mts';

const COUNTED: Kind[] = ['list', 'several', 'news'];
const file = readLabels();
const labels = Object.values(file.items);
const resolve = resolver(worksIndex({ all: true }));

const works: Record<string, { list?: number; several?: number; news?: number }> = {};
const topics = new Map<string, { name: string; type?: string; n: number }>();
let counted = 0, unresolved = 0;
for (const l of labels) {
  if (COUNTED.includes(l.kind)) {
    const keys = new Set<string>();
    for (const w of l.works) {
      const r = resolve(w);
      if (r.key) keys.add(r.key); else unresolved++;
    }
    for (const k of keys) {
      const x = (works[k] ??= {});
      const kind = l.kind as 'list' | 'several' | 'news';
      x[kind] = (x[kind] ?? 0) + 1;
    }
    if (keys.size) counted++;
  }
  if (l.topic?.name) {
    const id = `${l.topic.type ?? ''}|${l.topic.name}`;
    const t = topics.get(id) ?? { name: l.topic.name, ...(l.topic.type ? { type: l.topic.type } : {}), n: 0 };
    t.n++;
    topics.set(id, t);
  }
}
const topList = [...topics.values()].filter((t) => t.n >= 2).sort((a, b) => b.n - a.n).slice(0, 200);
const out = `// Сгенерировано tools/build-media-mentions.mts (${new Date().toISOString().slice(0, 10)}) из разметки модели
// (.cache/llm/labels.json): в скольких подборках, роликах о нескольких и новостях названо произведение;
// темы роликов без произведения. Это догадка модели, а не решение человека. Не править руками.
export interface MediaMentions { list?: number; several?: number; news?: number }

export const mediaMentions: { labels: number; works: Record<string, MediaMentions>; topics: { name: string; type?: string; n: number }[] } = ${JSON.stringify({ labels: labels.length, works, topics: topList }, null, 1)};
`;
writeFileSync(new URL('../src/mocks/mediaMentions.ts', import.meta.url), out);
console.log(`упоминания: разметок ${labels.length}, роликов с названными произведениями ${counted}, произведений ${Object.keys(works).length}, не опознано названий ${unresolved}, тем ${topList.length}`);
