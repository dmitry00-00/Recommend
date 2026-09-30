// Карточки сериалов с черновой разметкой (Е2), которых нет в справочнике → src/mocks/seriesBase.ts.
//   npx tsx tools/build-series-base.mts
// Сериалы из присланных профилей живут в сидах на сервере, а у владельца (кураторская) их карточек
// нет — черновик некуда показать. Берём карточку из кэша сопоставления Кинопоиска
// (.cache/kinopoisk-resolve.json: название, год, постер, авторы — данные TMDb, личного там нет),
// иначе из сидов, и приводим к виду `type: 'series'`. Без сети.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { worksIndex, analysisKey } from './works-index.mts';
import { normalizeWork } from '../src/lib/media.ts';
import { seriesAnnotations } from '../src/mocks/seriesAnnotations.ts';
import { seriesBase } from '../src/mocks/seriesBase.ts';
import type { WorkCard } from '../src/types/tmdf.ts';

const cacheFile = new URL('../.cache/kinopoisk-resolve.json', import.meta.url);
const cache: Record<string, WorkCard | null> = existsSync(cacheFile) ? JSON.parse(readFileSync(cacheFile, 'utf8')) : {};
// справочник без прежнего seriesBase: иначе второй прогон считает свои же карточки «уже известными»
const own = new Set(seriesBase.map((w) => w.id));
const known = new Set(worksIndex({ all: true }).filter((w) => !own.has(w.work.id)).map((w) => w.key));
const byKey = new Map<string, WorkCard>();
for (const c of Object.values(cache)) {
  if (!c) continue;
  const w = normalizeWork(c);
  const k = w.type === 'series' ? analysisKey(w) : undefined;
  if (k && !byKey.has(k)) byKey.set(k, w);
}
// запасной источник — сиды (seeds/*.json, в git не уходят): оттуда только карточка произведения —
// кто прислал, не пишется. Нужен для сериалов, пришедших присланным списком, а не с Кинопоиска
const seeds = new URL('../seeds/', import.meta.url);
if (existsSync(seeds)) for (const f of readdirSync(seeds).filter((x) => x.endsWith('.json'))) {
  const seed = JSON.parse(readFileSync(new URL(f, seeds), 'utf8')) as { watched?: { work?: WorkCard }[] };
  for (const { work } of seed.watched ?? []) {
    const w = work && normalizeWork(work);
    const k = w?.type === 'series' ? analysisKey(w) : undefined;
    if (w && k && !byKey.has(k)) byKey.set(k, w);
  }
}
const cards: WorkCard[] = [];
const missing: string[] = [];
for (const key of Object.keys(seriesAnnotations)) {
  if (known.has(key)) continue;
  const w = byKey.get(key);
  if (w) cards.push(w); else missing.push(key);
}
cards.sort((a, b) => a.title.localeCompare(b.title, 'ru'));
writeFileSync(new URL('../src/mocks/seriesBase.ts', import.meta.url), `// Сгенерировано tools/build-series-base.mts (Е2) — руками не править.
// Сериалы с черновой разметкой, которых нет в справочнике: карточки из кэша сопоставления Кинопоиска.
import type { WorkCard } from '@/types/tmdf';

export const seriesBase: WorkCard[] = ${JSON.stringify(cards, null, 2)};
`);
console.error(`размечено сериалов: ${Object.keys(seriesAnnotations).length}; уже в справочнике: ${Object.keys(seriesAnnotations).filter((k) => known.has(k)).length}; карточек добавлено: ${cards.length}${missing.length ? `; без карточки: ${missing.join(', ')}` : ''}`);
console.error('→ src/mocks/seriesBase.ts');
