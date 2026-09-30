// Сгенерировано tools/resolve-relations.mts (Ж1) — руками не править.
// Связи между произведениями по Wikidata: экранизация, сиквел, ремейк, часть цикла или франшизы.
// Узел — элемент Wikidata: t — название, y — год, k — вид, key — ключ произведения у нас.
import type { RelationKind, RelationNodeKind } from '@/types/tmdf';

export const relationNodes: Record<string, { t: string; y?: number; k: RelationNodeKind; key?: string }> = {
};

export const relationEdges: [string, RelationKind, string][] = [
];
