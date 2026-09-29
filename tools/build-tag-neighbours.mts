// «Описывают похоже»: ближайшие фильмы в пространстве 1084 тегов Tag Genome.
//   npx tsx tools/build-tag-neighbours.mts
// Вход — .cache/taggenome.json (tools/build-taggenome.mts).
// Третий независимый сигнал похожести рядом с графом соупоминаний: тот показывает, кого
// называют вместе русские каналы, этот — кому зрители MovieLens приписывают те же теги.
// Проверено: с графом соупоминаний согласуется (p < 5·10⁻⁵), с формой по субтитрам —
// независим (ρ = −0.03), то есть источники не дублируют друг друга.
// Лицензия Tag Genome — CC BY-NC 3.0 (Kotkov et al. 2021; Vig et al. 2012): указание
// авторства обязательно и стоит в подписи к блоку, коммерческое использование запрещено.
import { readFileSync, writeFileSync } from 'node:fs';
import type { TagNeighbour } from '../src/types/tmdf.ts';
import { worksIndex } from './works-index.mts';

const PER_FILM = 5;
const FLOOR = 0.25; // ниже этого «похоже» уже не читается как похожесть

interface Film { key: string; title: string; year: number; scores: number[] }
const data: { tags: string[]; films: Record<string, Film> } = JSON.parse(readFileSync(new URL('../.cache/taggenome.json', import.meta.url), 'utf8'));
const films = Object.values(data.films);
const n = data.tags.length;

const workId = new Map<string, string>();
for (const { key, work } of worksIndex()) if (!workId.has(key)) workId.set(key, work.id);

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const sd = (xs: number[]) => Math.sqrt(mean(xs.map((x) => (x - mean(xs)) ** 2)));
// теги приводим к общему масштабу: «этот тег относится к фильму сильнее обычного» —
// иначе близость определяют самые популярные теги, применимые ко всему подряд
const mu: number[] = [];
const sg: number[] = [];
for (let i = 0; i < n; i++) { const c = films.map((f) => f.scores[i]); mu.push(mean(c)); sg.push(sd(c) || 1); }
const vecs = films.map((f) => {
  const v = new Float64Array(n);
  let sum = 0;
  for (let i = 0; i < n; i++) { const z = (f.scores[i] - mu[i]) / sg[i]; v[i] = z; sum += z * z; }
  const len = Math.sqrt(sum) || 1;
  for (let i = 0; i < n; i++) v[i] /= len;
  return v;
});

const out: Record<string, TagNeighbour[]> = {};
let kept = 0;
for (let a = 0; a < films.length; a++) {
  const near: { j: number; sim: number }[] = [];
  for (let b = 0; b < films.length; b++) {
    if (a === b) continue;
    let dot = 0;
    for (let i = 0; i < n; i++) dot += vecs[a][i] * vecs[b][i];
    if (dot >= FLOOR) near.push({ j: b, sim: dot });
  }
  near.sort((x, y) => y.sim - x.sim);
  const list = near.slice(0, PER_FILM)
    .map(({ j, sim }) => ({
      key: films[j].key,
      workId: workId.get(films[j].key) ?? '',
      title: films[j].title,
      ...(films[j].year ? { year: films[j].year } : {}),
      similarity: Number(sim.toFixed(3)),
    }))
    .filter((x) => x.workId);
  if (!list.length) continue;
  out[films[a].key] = list;
  kept++;
}

const sorted = Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
const header = `// Сгенерировано tools/build-tag-neighbours.mts (${new Date().toISOString().slice(0, 10)}): кому
// зрители MovieLens приписывают те же теги. Близость — косинус в пространстве 1084 тегов
// Tag Genome 2021 после приведения тегов к общему масштабу; в списке до ${PER_FILM} соседей
// с близостью не ниже ${FLOOR}.
// Источник: Tag Genome 2021, GroupLens — Kotkov, Maslov, Neovius (SIGIR 2021) и
// Vig, Sen, Riedl (TiiS 2012), лицензия CC BY-NC 3.0. Некоммерческое использование.
// Не править руками — перегенерировать.
import type { TagNeighbour } from '@/types/tmdf';

export const tagNeighbours: Record<string, TagNeighbour[]> = `;
writeFileSync(new URL('../src/mocks/tagNeighbours.ts', import.meta.url), `${header}${JSON.stringify(sorted, null, 1)};\n`);
console.log(`фильмов с тегами: ${films.length} | с соседями выше ${FLOOR}: ${kept}`);
console.log('→ src/mocks/tagNeighbours.ts');
