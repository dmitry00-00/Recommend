// Чистая часть Ж1 (связи между произведениями): строки Wikidata → рёбра и узлы, текст мока.
// Сеть — в tools/resolve-relations.mts; здесь то, что проверяется без неё.
import type { RelationKind, RelationNodeKind } from '../src/types/tmdf.ts';
import { listLike } from '../src/lib/relations.ts';

/** Вид узла по P31 (экземпляр класса). Список — самые частые классы, без обхода P279: этого
 *  хватает, чтобы отличить роман от фильма, а для незнакомого класса честнее `other`. */
const CLASS: Record<string, RelationNodeKind> = {
  // фильм: художественный, анимационный, короткометражный, немой, телефильм, аниме-фильм, анимационный полнометражный
  Q11424: 'film', Q202866: 'film', Q24862: 'film', Q226730: 'film', Q506240: 'film', Q20650540: 'film', Q29168811: 'film',
  // сериал: телесериал, мини-сериал, аниме-сериал, мультсериал, веб-сериал, сезон
  Q5398426: 'series', Q1259759: 'series', Q63952888: 'series', Q581714: 'series', Q526877: 'series', Q117467246: 'series', Q3464665: 'series',
  // книга: литературное произведение, роман, книга, письменное произведение, рассказ, стихотворение, пьеса
  Q7725634: 'book', Q8261: 'book', Q571: 'book', Q47461344: 'book', Q49084: 'book', Q5185279: 'book', Q25379: 'book',
  // комикс: комикс, серия комиксов, манга-серия, манга, комикс-стрип
  Q1004: 'comic', Q14406742: 'comic', Q21198342: 'comic', Q8274: 'comic', Q838795: 'comic',
  Q7889: 'game',
  // цикл: киносерия, книжная серия, цикл романов, серия игр
  Q24856: 'cycle', Q277759: 'cycle', Q1667921: 'cycle', Q7058673: 'cycle',
  Q196600: 'franchise',
};
const PRIORITY: RelationNodeKind[] = ['film', 'series', 'book', 'comic', 'game', 'cycle', 'franchise', 'other'];
export function nodeKind(classes: string[]): RelationNodeKind {
  const kinds = new Set(classes.map((c) => CLASS[c]).filter(Boolean));
  return PRIORITY.find((k) => kinds.has(k)) ?? 'other';
}

export interface RelBinding { item: string; prop: string; target: string; ru?: string; en?: string; year?: string; cls?: string }
export interface RelNode { t: string; y?: number; k: RelationNodeKind }
export type RelEdge = [from: string, kind: RelationKind, to: string];

const qid = (s: string) => s.split('/').pop()!;

/** «Основано на» (P144) — экранизация, если источник не фильм; если фильм — ремейк (у Wikidata
 *  ремейк записан тем же свойством). Сериал по фильму и фильм по сериалу — экранизация. */
function basedOn(from: RelationNodeKind, to: RelationNodeKind): RelationKind {
  return to === 'film' && from === 'film' ? 'remake_of' : 'adaptation_of';
}

/** Строки SPARQL → узлы и рёбра. P155 (предыдущее) — ребро «это сиквел того»; P156 (следующее)
 *  — обратное ребро «то — сиквел этого»; P179 и P8345 — «часть». Узлы без названия отбрасываем:
 *  показать их нечем. `own` — вид наших произведений (по ключу), он надёжнее P31. */
export function parseRelations(rows: RelBinding[], own: ReadonlyMap<string, RelationNodeKind>): { nodes: Map<string, RelNode>; edges: RelEdge[] } {
  const classes = new Map<string, Set<string>>();
  const names = new Map<string, { ru?: string; en?: string; y?: number }>();
  for (const r of rows) {
    const t = qid(r.target);
    if (r.cls) (classes.get(t) ?? classes.set(t, new Set()).get(t)!).add(qid(r.cls));
    const n = names.get(t) ?? {};
    const y = r.year ? Number(r.year.slice(0, 4)) : undefined;
    names.set(t, { ru: n.ru ?? r.ru, en: n.en ?? r.en, y: n.y != null && y != null ? Math.min(n.y, y) : n.y ?? (y && y > 0 ? y : undefined) });
  }
  const kindOf = (q: string): RelationNodeKind => own.get(q) ?? nodeKind([...(classes.get(q) ?? [])]);
  const nodes = new Map<string, RelNode>();
  for (const [q, n] of names) {
    const t = n.ru ?? n.en;
    if (t && !/^Q\d+$/.test(t)) nodes.set(q, { t, ...(n.y ? { y: n.y } : {}), k: kindOf(q) });
  }
  const edges: RelEdge[] = [];
  const seen = new Set<string>();
  const add = (e: RelEdge) => { const k = e.join('|'); if (e[0] !== e[2] && !seen.has(k)) { seen.add(k); edges.push(e); } };
  for (const r of rows) {
    const item = qid(r.item), prop = qid(r.prop), t = qid(r.target);
    if (!nodes.has(t)) continue;
    if (prop === 'P144') add([item, basedOn(kindOf(item), kindOf(t)), t]);
    else if (prop === 'P155') add([item, 'sequel_of', t]);
    else if (prop === 'P156') add([t, 'sequel_of', item]);
    // «часть» перечня («100 величайших…», «список мультфильмов Pixar») — не цикл: не связь
    else if ((prop === 'P179' || prop === 'P8345') && !listLike(nodes.get(t)?.t)) add([item, 'part_of', t]);
  }
  return { nodes, edges };
}

/** Текст src/mocks/workRelations.ts. Узлы — все, что встречаются в рёбрах, плюс ключ нашего
 *  произведения, если он у нас есть: по нему приложение находит карточку. */
export function relationsSource(nodes: Map<string, RelNode & { key?: string }>, edges: RelEdge[]): string {
  const used = new Set(edges.flatMap(([a, , b]) => [a, b]));
  const sorted = [...nodes].filter(([q]) => used.has(q)).sort(([a], [b]) => Number(a.slice(1)) - Number(b.slice(1)));
  const es = [...edges].sort((a, b) => a.join('|').localeCompare(b.join('|')));
  return `// Сгенерировано tools/resolve-relations.mts (Ж1) — руками не править.
// Связи между произведениями по Wikidata: экранизация, сиквел, ремейк, часть цикла или франшизы.
// Узел — элемент Wikidata: t — название, y — год, k — вид, key — ключ произведения у нас.
import type { RelationKind, RelationNodeKind } from '@/types/tmdf';

export const relationNodes: Record<string, { t: string; y?: number; k: RelationNodeKind; key?: string }> = {
${sorted.map(([q, n]) => `  ${q}: ${JSON.stringify(n)},`).join('\n')}
};

export const relationEdges: [string, RelationKind, string][] = [
${es.map((e) => `  ${JSON.stringify(e)},`).join('\n')}
];
`;
}
