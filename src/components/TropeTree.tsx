import { useMemo, useState, type CSSProperties } from 'react';
import type { TropeTreeNode } from '@/types/tmdf';
import { OperationGlyph } from './OperationGlyph';
import { cx } from '@/lib/cx';
import ui from '@/i18n';

export interface TropeTreeProps {
  tree: TropeTreeNode[];
}

/** Ветка, в которой есть совпадение с запросом, остаётся целиком; остальные уходят. */
function filter(nodes: TropeTreeNode[], q: string): TropeTreeNode[] {
  if (!q) return nodes;
  return nodes.flatMap((n) => {
    const children = filter(n.children ?? [], q);
    if (n.name.toLowerCase().includes(q)) return [n];
    return children.length ? [{ ...n, children }] : [];
  });
}

/** Таксономия приёмов: ось → категория → приём, счётчик произведений, глифы операций.
 *  Поиск — по названию, дерево сворачивается до найденного. */
export function TropeTree({ tree }: TropeTreeProps) {
  const [query, setQuery] = useState('');
  const shown = useMemo(() => filter(tree, query.trim().toLowerCase()), [tree, query]);
  const node = (n: TropeTreeNode, depth: number) => (
    <li key={n.name} className="tm-tree__node" style={{ '--depth': depth } as CSSProperties}>
      <div className="tm-tree__row">
        <span className={cx('tm-tree__name', depth === 0 && 'tm-tree__name--axis')}>{n.name}</span>
        {n.count != null ? <span className="tm-tree__count">{n.count}</span> : null}
        {(n.operations ?? []).map((o) => <OperationGlyph key={o} op={o} size={12} />)}
      </div>
      {n.children?.length ? <ul className="tm-tree__list">{n.children.map((c) => node(c, depth + 1))}</ul> : null}
    </li>
  );
  return (
    <div className="tm-tree">
      <input className="tm-input" type="search" placeholder={ui.curator.taxonomySearch} aria-label={ui.curator.taxonomySearch}
             value={query} onChange={(e) => setQuery(e.target.value)} />
      {shown.length ? <ul className="tm-tree__list">{shown.map((n) => node(n, 0))}</ul>
        : <p className="tm-tree__empty">{ui.curator.taxonomyEmpty}</p>}
    </div>
  );
}
