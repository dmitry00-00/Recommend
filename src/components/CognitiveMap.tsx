import { Fragment } from 'react';
import { scaleLinear } from 'd3-scale';
import { curveLinearClosed, lineRadial, pointRadial } from 'd3-shape';
import type { CognitiveMapData, CognitiveOperation, DevelopmentTarget, OperationEstimate } from '@/types/tmdf';
import { OperationGlyph } from './OperationGlyph';
import { UncertaintyMark } from './UncertaintyMark';
import { operations as OPS, opVar } from '@/lib/operations';
import { cx } from '@/lib/cx';
import ru from '@/i18n/ru';
import { useMechanics } from '@/lib/settingsStore';

export interface CognitiveMapProps {
  map: CognitiveMapData;
  /** 'field' — поле изолиний (таблица остаётся для скринридера), 'list' — только таблица */
  mode?: 'field' | 'list';
  compact?: boolean;
  size?: number;
  showDetails?: boolean;
  onSelect?: (op: CognitiveOperation) => void;
}

const MAX = 10;
const RINGS = [2, 4, 6, 8, 10];

/** Слова вместо чисел, пока не включены подробности. */
function levelWord(level: number): string {
  const words = ru.map.levelWords;
  return words[Math.min(words.length - 1, Math.floor(level / (MAX / words.length)))];
}

/** Карта мышления: восемь осей, сплошная линия оценки, штриховка диапазона, засечки
 *  пройденных произведений. Геометрия — d3 (радиальные линии и шкала), разметка — SVG
 *  с классами системы; компонент ничего не считает, кроме координат. */
export function CognitiveMap({ map, mode = 'field', compact, size, showDetails, onSelect }: CognitiveMapProps) {
  // Механика выключена в настройках — знака нет вовсе, не пустая рамка (21.09).
  const mechanics = useMechanics();
  if (!mechanics) return null;
  const ops = map.state.operations;
  const n = ops.length;
  const targets = new Map<CognitiveOperation, DevelopmentTarget>();
  for (const t of map.targets) for (const op of t.operations) targets.set(op, t);

  const table = (
    <table className={cx('tm-maplist', mode === 'field' && 'tm-sr')}>
      <caption>{ru.map.caption}</caption>
      <thead>
        <tr>
          <th scope="col">{ru.map.colOperation}</th>
          <th scope="col">{ru.map.colLevel}</th>
          <th scope="col">{ru.map.colRange}</th>
          <th scope="col">{ru.map.colData}</th>
        </tr>
      </thead>
      <tbody>
        {ops.map((o) => (
          <tr key={o.op} className={targets.has(o.op) ? 'tm-maplist__row--target' : undefined}>
            <th scope="row">
              <div className="tm-row tm-row--gap-1">
                <OperationGlyph op={o.op} size={16} title={false} />
                {OPS[o.op].name}
                {targets.has(o.op) ? <span className="tm-maplist__focus">{ru.map.focus}</span> : null}
              </div>
            </th>
            <td>{showDetails ? o.level.toFixed(1) : levelWord(o.level)}</td>
            <td><UncertaintyMark level={o.level} range={o.range} confidence={o.confidence} op={o.op} note={false} /></td>
            <td>{ru.map.dataAmount[o.confidence]}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  if (mode === 'list') return <div className="tm-map tm-map--list">{table}</div>;

  // ---- геометрия поля ----
  const S = size ?? (compact ? 232 : 420);
  const c0 = S / 2;
  const R = S / 2 - (compact ? 18 : 34);
  const angle = (i: number) => (i * 2 * Math.PI) / n;
  const radius = scaleLinear().domain([0, MAX]).range([0, R]);
  const clamp = (v: number) => Math.max(0, Math.min(MAX, v));
  const at = (i: number, level: number) => pointRadial(angle(i), radius(clamp(level)));

  const ringOf = (level: number) =>
    lineRadial<number>().angle((_, i) => angle(i)).radius(radius(level)).curve(curveLinearClosed)(ops.map(() => 0)) ?? '';
  const contourOf = (pick: (o: OperationEstimate) => number) =>
    lineRadial<OperationEstimate>().angle((_, i) => angle(i)).radius((o) => radius(clamp(pick(o))))
      .curve(curveLinearClosed)(ops) ?? '';
  // полоса диапазона: внешний контур минус внутренний
  const band = contourOf((o) => o.range[1]) + ' ' + contourOf((o) => o.range[0]);

  const legend = (
    <ul className="tm-map__key">
      {ops.map((o) => (
        <li key={o.op} className={cx('tm-map__keyitem', targets.has(o.op) && 'tm-map__keyitem--target')}>
          <OperationGlyph op={o.op} size={14} />
          <span>{OPS[o.op].short}</span>
          {targets.has(o.op) ? <span className="tm-map__keyfocus">{ru.map.focus}</span> : null}
        </li>
      ))}
    </ul>
  );

  return (
    <div className={cx('tm-map', compact && 'tm-map--compact')}>
      <svg className="tm-map__svg" width={S} height={S} viewBox={`0 0 ${S} ${S}`} role="img"
           aria-label={ru.map.ariaField}>
        <defs>
          <pattern id="tm-hatch" width={5} height={5} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1={0} y1={0} x2={0} y2={5} className="tm-map__hatchline" />
          </pattern>
        </defs>
        <g transform={`translate(${c0} ${c0})`}>
          {RINGS.map((lv) => (
            <path key={lv} className={cx('tm-map__grid', lv === MAX && 'tm-map__grid--edge')} d={ringOf(lv)} />
          ))}
          {ops.map((o, i) => {
            const [x, y] = at(i, MAX);
            return <line key={`ax-${o.op}`} x1={0} y1={0} x2={x} y2={y}
                         className={cx('tm-map__axis', targets.has(o.op) && 'tm-map__axis--target')} />;
          })}
          <path className="tm-map__band" fillRule="evenodd" d={band} />
          <path className="tm-map__bandedge" d={contourOf((o) => o.range[1])} />
          <path className="tm-map__bandedge" d={contourOf((o) => o.range[0])} />
          {/* следы: каждое пройденное произведение — короткая засечка поперёк оси */}
          {ops.map((o, i) => map.traces.map((tr, k) => tr.operations.filter((oi) => oi.op === o.op).map((oi) => {
            const [x, y] = pointRadial(angle(i), R * Math.max(0.12, oi.intensity) * 0.96);
            const len = Math.hypot(x, y) || 1;
            const nx = (-y / len) * 4.5, ny = (x / len) * 4.5;
            return <line key={`tr-${o.op}-${k}`} x1={x + nx} y1={y + ny} x2={x - nx} y2={y - ny} className="tm-map__trace" />;
          })))}
          {ops.map((a, i) => {
            const b = ops[(i + 1) % n];
            const [x1, y1] = at(i, a.level);
            const [x2, y2] = at((i + 1) % n, b.level);
            const soft = a.confidence === 'low' || b.confidence === 'low';
            return <line key={`sg-${a.op}`} x1={x1} y1={y1} x2={x2} y2={y2}
                         className={cx('tm-map__contour', soft && 'tm-map__contour--soft')} />;
          })}
          {ops.map((o, i) => {
            const [x, y] = at(i, o.level);
            const target = targets.has(o.op);
            return (
              <Fragment key={`s-${o.op}`}>
                <circle cx={x} cy={y} r={target ? 5 : 3.4} className="tm-map__stake" style={{ fill: opVar(o.op) }} />
                {target ? <circle cx={x} cy={y} r={8.5} className="tm-map__stakering" /> : null}
              </Fragment>
            );
          })}
          {ops.map((o, i) => {
            const [x, y] = pointRadial(angle(i), R + (compact ? 11 : 18));
            const target = targets.has(o.op);
            return (
              <g key={`l-${o.op}`} className={cx('tm-map__label', target && 'tm-map__label--target')}
                 onClick={onSelect ? () => onSelect(o.op) : undefined}
                 style={{ color: opVar(o.op, 'ink'), cursor: onSelect ? 'pointer' : 'default' }}
                 role={onSelect ? 'button' : undefined} tabIndex={onSelect ? 0 : undefined}
                 aria-label={onSelect ? OPS[o.op].name : undefined}
                 onKeyDown={onSelect ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(o.op); } } : undefined}>
                {target ? <circle cx={x} cy={y} r={12} className="tm-map__labelring" /> : null}
                <g transform={`translate(${x - 8} ${y - 8})`}>
                  <OperationGlyph op={o.op} size={16} tone="inherit" title={false} />
                </g>
              </g>
            );
          })}
        </g>
      </svg>
      {compact ? null : legend}
      {compact ? null : (
        <p className="tm-map__legend">
          {map.state.overallConfidence === 'low' ? ru.map.legendLow : ru.map.legend}
        </p>
      )}
      {table}
    </div>
  );
}
