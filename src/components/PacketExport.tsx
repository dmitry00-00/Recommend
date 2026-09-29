import { useState } from 'react';
import { Button } from './Button';
import ru from '@/i18n/ru';

export type PacketSet = 'needs' | 'low' | 'gold';
export type PacketFormat = 'json' | 'jsonl';
export interface PacketExportInput { set: PacketSet; layers: string[]; format: PacketFormat }

export interface PacketExportProps {
  /** сколько произведений в каждом наборе — подпись в списке */
  counts?: Partial<Record<PacketSet, number>>;
  busy?: boolean;
  onExport?: (input: PacketExportInput) => void;
  onPreview?: (input: PacketExportInput) => void;
}

const LAYERS = Object.keys(ru.curator.layers) as (keyof typeof ru.curator.layers)[];
const SETS = Object.keys(ru.curator.packetSets) as PacketSet[];
const FORMATS = Object.keys(ru.curator.formats) as PacketFormat[];

/** Выгрузить пакет на разметку: какой набор, какие слои, в каком формате. */
export function PacketExport({ counts, busy, onExport, onPreview }: PacketExportProps) {
  const [set, setSet] = useState<PacketSet>('needs');
  const [layers, setLayers] = useState<string[]>(['tropes', 'operations']);
  const [format, setFormat] = useState<PacketFormat>('json');
  const input = (): PacketExportInput => ({ set, layers, format });
  const toggle = (l: string) => setLayers(layers.includes(l) ? layers.filter((x) => x !== l) : [...layers, l]);
  return (
    <section className="tm-packet">
      <h4 className="tm-packet__title">{ru.curator.packetTitle}</h4>
      <div className="tm-packet__grid">
        <label className="tm-packet__field">
          <span>{ru.curator.packetWorks}</span>
          <select className="tm-input" value={set} onChange={(e) => setSet(e.target.value as PacketSet)}>
            {SETS.map((s) => (
              <option key={s} value={s}>{counts?.[s] != null ? `${ru.curator.packetSets[s]} (${counts[s]})` : ru.curator.packetSets[s]}</option>
            ))}
          </select>
        </label>
        <div className="tm-packet__field">
          <span>{ru.curator.packetLayers}</span>
          <div className="tm-packet__layers">
            {LAYERS.map((l) => (
              <label key={l} className="tm-packet__layer">
                <input type="checkbox" checked={layers.includes(l)} onChange={() => toggle(l)} />
                {ru.curator.layers[l]}
              </label>
            ))}
          </div>
        </div>
        <label className="tm-packet__field">
          <span>{ru.curator.packetFormat}</span>
          <select className="tm-input" value={format} onChange={(e) => setFormat(e.target.value as PacketFormat)}>
            {FORMATS.map((f) => <option key={f} value={f}>{ru.curator.formats[f]}</option>)}
          </select>
        </label>
      </div>
      <div className="tm-row tm-row--gap-2">
        <Button variant="primary" size="sm" loading={busy} disabled={busy || !layers.length} onClick={() => onExport?.(input())}>{ru.curator.export}</Button>
        <Button variant="quiet" size="sm" disabled={busy} onClick={() => onPreview?.(input())}>{ru.curator.preview}</Button>
      </div>
    </section>
  );
}
