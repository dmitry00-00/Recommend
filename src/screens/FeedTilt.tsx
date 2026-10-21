// Панель ленты v2 (19.10, владелец: «добавь настройки панели фильтров рекомендательной ленты; доступно только мне и
// тестерам»; макет «Панель ленты, версия 2»). Отдельный ленивый кусок: участникам он не грузится вовсе — у них прежняя
// панель «Сегодня». Оси и варианты — из настоящего пула ленты (`getTiltData`): вариант, у которого мало произведений,
// не показывается, ось без вариантов — тоже. Без объяснений «почему вам»: панель только наклоняет подбор.
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Energy, FeedKind, FeedPreset } from '@/types/tmdf';
import { getTiltData, type TiltData } from '@/api';
import { Button, FeedKindSwitch, Sheet } from '@/components';
import { pick, tap } from '@/lib/telegram';
import { cx } from '@/lib/cx';
import { TILT_NARROW, TRAD_MAX, tiltActive, tiltClean, tiltHasOnly, tiltKey, type Tilt, type TiltAxis, type TiltPick } from '@/lib/tilt';
import { optionLabel, optionNote, parseWords, pickText, tiltText } from '@/lib/tiltWords';
import ui from '@/i18n';
import '@/styles/tilt.css';

const MAIN: TiltAxis[] = ['want', 'trad', 'op'];
const MORE: TiltAxis[] = ['era', 'form', 'len'];
const ENERGIES: Energy[] = ['low', 'normal', 'high'];
/** сочетаний не больше стольких: настройки на сервере ограничены по размеру */
const PRESETS_MAX = 12;

function FilterGlyph() {
  return (
    <svg width={20} height={20} viewBox="0 0 20 20" aria-hidden="true">
      {['M3.5 6h13', 'M3.5 10h13', 'M3.5 14h13'].map((d) => <path key={d} d={d} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />)}
      {[[7, 6], [12.5, 10], [8.5, 14]].map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r={1.9} fill="var(--tm-color-surface-100)" stroke="currentColor" strokeWidth={1.5} />)}
    </svg>
  );
}

/** Шапка ленты (19.10, владелец: «видимая кнопка»): значок фильтров — всегда; наклон есть — ярлык «Наклон · …» с ×,
 *  который снимает его без панели. Полоса одна и та же с наклоном и без: лента под ней не прыгает. */
export function TiltBar({ tilt, energy, preset, onOpen, onClear }: {
  tilt: Tilt; energy: Energy; preset?: string; onOpen: () => void; onClear: () => void;
}) {
  const on = tiltActive(tilt) || energy !== 'normal';
  const open = () => { tap(); onOpen(); };
  return (
    <div className={cx('tm-tiltbar', on && 'tm-tiltbar--on')}>
      <span className="tm-tiltbar__l">{on ? ui.tilt.bar : ui.tilt.feed}</span>
      <button type="button" className="tm-tiltbar__v" onClick={open}>{on ? preset ?? tiltText(tilt, energy) : ui.tilt.none}</button>
      {on ? <button type="button" className="tm-tiltbar__x" aria-label={ui.tilt.clear} onClick={() => { tap(); onClear(); }}>×</button> : null}
      <button type="button" className="tm-tiltbar__open" aria-label={ui.tilt.open} aria-expanded="false" onClick={open}><FilterGlyph /></button>
    </div>
  );
}

export interface TiltPanelProps {
  kind: FeedKind; booksOn: boolean; onKind: (k: FeedKind) => void;
  energy: Energy; energyOn: boolean;
  tilt: Tilt;
  /** новый наклон (и усилие, если оно меняется вместе с ним: сочетание, «Словами», «Сбросить всё») */
  onApply: (t: Tilt, energy?: Energy) => void;
  presets: FeedPreset[]; onPresets: (list: FeedPreset[]) => void;
  /** «Только в моих подписках» — кнопка прежней панели */
  extra?: ReactNode;
  busy: boolean; bottom: number;
}

type SheetId = TiltAxis | 'effort' | 'words' | 'save';

export function TiltPanel({ kind, booksOn, onKind, energy, energyOn, tilt, onApply, presets, onPresets, extra, busy, bottom }: TiltPanelProps) {
  const [data, setData] = useState<TiltData | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    setData(null);
    setFailed(false);
    getTiltData(kind).then((d) => alive && setData(d)).catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, [kind]);
  const [sheet, setSheet] = useState<SheetId | null>(null);
  const [more, setMore] = useState(() => MORE.some((a) => tilt[a]?.v.length));
  const options = (a: TiltAxis) => data?.axes.find((x) => x.axis === a)?.options ?? [];
  // ось видна, если у неё есть варианты — или в наклоне она уже выбрана (её надо уметь снять)
  const shown = (a: TiltAxis) => options(a).length > 0 || Boolean(tilt[a]?.v.length);
  const mine = presets.filter((p) => p.kind === kind);
  const key = tiltKey(tilt);
  const active = mine.find((p) => tiltKey(p.tilt) === key && (p.energy ?? 'normal') === energy);
  const anySet = tiltActive(tilt) || energy !== 'normal';
  const matched = data && tiltHasOnly(tilt) ? data.count(tilt) : undefined;
  const narrow = matched != null && matched < TILT_NARROW;
  useEffect(() => { if (MORE.some((a) => tilt[a]?.v.length)) setMore(true); }, [tilt]);

  const setAxis = (a: TiltAxis, p: TiltPick) => {
    pick();
    onApply(tiltClean({ ...tilt, [a]: p }));
  };
  const applyPreset = (p: FeedPreset) => {
    pick();
    if (active === p) onApply({}, 'normal');
    else onApply(tiltClean(p.tilt as Tilt), p.energy ?? 'normal');
  };
  const removePreset = (p: FeedPreset) => { tap(); onPresets(presets.filter((x) => x !== p)); };

  const row = (a: TiltAxis) => {
    const p = tilt[a];
    const set = Boolean(p?.v.length);
    return (
      <button key={a} type="button" className={cx('tm-tiltp__row', set && 'tm-tiltp__row--set')} disabled={!data && !set}
              onClick={() => { tap(); setSheet(a); }}>
        <span className="tm-tiltp__k">{ui.tilt.axes[a].k}</span>
        <span className="tm-tiltp__v">{set ? pickText(a, p!) : ui.tilt.any}</span>
        <span className="tm-tiltp__s">
          {set && p!.only ? <span className="tm-tiltp__lock">{ui.tilt.only}</span> : null}
          <span aria-hidden="true">›</span>
        </span>
      </button>
    );
  };
  const moreAxes = MORE.filter(shown);
  return (
    <div className="tm-tiltp" role="dialog" aria-label={ui.tilt.title} aria-busy={busy ? 'true' : undefined} style={{ bottom }}>
      <div className="tm-tiltp__head">
        {booksOn ? <FeedKindSwitch value={kind} onChange={onKind} /> : null}
        {narrow ? <p className="tm-tiltp__narrow" role="status">{ui.tilt.narrow(matched!)}<br />{ui.tilt.narrowHint}</p> : null}
      </div>
      {kind === 'book' ? <p className="tm-caption tm-tiltp__note">{ui.tilt.booksNote}</p> : null}
      <div className="tm-tiltp__chips" role="group" aria-label={ui.tilt.presets}>
        <button type="button" className="tm-tiltp__chip tm-tiltp__chip--act" disabled={!data} onClick={() => { tap(); setSheet('words'); }}>{ui.tilt.words}</button>
        {mine.map((p, i) => (
          <span key={`${p.name}-${i}`} className={cx('tm-tiltp__preset', active === p && 'tm-tiltp__preset--on')}>
            <button type="button" className="tm-tiltp__chip" aria-pressed={active === p} onClick={() => applyPreset(p)}>{p.name}</button>
            {active === p ? <button type="button" className="tm-tiltp__chipx" aria-label={ui.tilt.removePreset(p.name)} onClick={() => removePreset(p)}>×</button> : null}
          </span>
        ))}
        {anySet && !active ? <button type="button" className="tm-tiltp__chip tm-tiltp__chip--act" onClick={() => { tap(); setSheet('save'); }}>{ui.tilt.save}</button> : null}
      </div>
      <div className="tm-tiltp__rows">
        {!data && !failed ? <p className="tm-caption tm-tiltp__loading" aria-busy="true">{ui.tilt.loading}</p> : null}
        {MAIN.filter(shown).map(row)}
        {moreAxes.length ? (more ? moreAxes.map(row) : (
          <button type="button" className="tm-tiltp__row tm-tiltp__row--more" onClick={() => { tap(); setMore(true); }}>
            <span className="tm-tiltp__k">{ui.tilt.more}</span>
            <span className="tm-tiltp__v">{moreAxes.map((a) => ui.tilt.axes[a].k.toLowerCase()).join(' · ')}</span>
            <span className="tm-tiltp__s"><span aria-hidden="true">›</span></span>
          </button>
        )) : null}
        {energyOn ? (
          <button type="button" className={cx('tm-tiltp__row', energy !== 'normal' && 'tm-tiltp__row--set')} onClick={() => { tap(); setSheet('effort'); }}>
            <span className="tm-tiltp__k">{ui.tilt.effort}</span>
            <span className="tm-tiltp__v">{ui.energy[energy].short}</span>
            <span className="tm-tiltp__s"><span aria-hidden="true">›</span></span>
          </button>
        ) : null}
      </div>
      {extra || anySet ? (
        <div className="tm-tiltp__foot">
          {extra ?? <span />}
          {anySet ? <Button variant="quiet" size="sm" onClick={() => { pick(); onApply({}, 'normal'); }}>{ui.tilt.reset}</Button> : null}
        </div>
      ) : null}

      {sheet && sheet !== 'effort' && sheet !== 'words' && sheet !== 'save' ? (
        <AxisSheet axis={sheet} options={options(sheet)} value={tilt[sheet]} onClose={() => setSheet(null)}
                   onDone={(p) => { setSheet(null); setAxis(sheet, p); }} />
      ) : null}
      {sheet === 'effort' ? (
        <Sheet open onOpenChange={(o) => { if (!o) setSheet(null); }} title={ui.tilt.effortTitle}>
          <p className="tm-caption tm-tiltp__hint">{ui.tilt.effortHint}</p>
          <div className="tm-tiltp__opts" role="radiogroup" aria-label={ui.tilt.effortTitle}>
            {ENERGIES.map((e) => (
              <OptionButton key={e} on={e === energy} radio label={ui.energy[e].short} note={ui.energy[e].note}
                            onClick={() => { setSheet(null); if (e !== energy) { pick(); onApply(tilt, e); } }} />
            ))}
          </div>
        </Sheet>
      ) : null}
      {sheet === 'words' && data ? (
        <WordsSheet data={data} energyOn={energyOn} onClose={() => setSheet(null)}
                    onApply={(t, e) => { setSheet(null); pick(); onApply(t, e ?? energy); }} />
      ) : null}
      {sheet === 'save' ? (
        <SaveSheet suggested={tiltText(tilt, energy).split(' · ').slice(0, 3).join(' · ') || ui.tilt.nameDefault} onClose={() => setSheet(null)}
                   onSave={(name) => {
                     setSheet(null);
                     tap('medium');
                     const next: FeedPreset = { name, kind, tilt: tiltClean(tilt), ...(energy !== 'normal' ? { energy } : {}) };
                     onPresets([...presets, next].slice(-PRESETS_MAX));
                   }} />
      ) : null}
    </div>
  );
}

function OptionButton({ on, radio, label, note, onClick }: { on: boolean; radio?: boolean; label: string; note?: string; onClick: () => void }) {
  return (
    <button type="button" role={radio ? 'radio' : 'checkbox'} aria-checked={on} className={cx('tm-tiltp__opt', on && 'tm-tiltp__opt--on')} onClick={onClick}>
      <span className="tm-tiltp__optt">
        {label}
        {note ? <small>{note}</small> : null}
      </span>
      <span className="tm-tiltp__mark" aria-hidden="true" />
    </button>
  );
}

function AxisSheet({ axis, options, value, onDone, onClose }: {
  axis: TiltAxis; options: string[]; value?: TiltPick; onDone: (p: TiltPick) => void; onClose: () => void;
}) {
  const [draft, setDraft] = useState<TiltPick>(() => ({ v: [...(value?.v ?? [])], ...(value?.only ? { only: true } : {}) }));
  // выбранное, которого в пуле больше нет (виденное, сменился вид ленты), — тоже в списке: его надо уметь снять
  const list = useMemo(() => [...options, ...(value?.v ?? []).filter((v) => !options.includes(v) && axis !== 'era')], [options, value, axis]);
  const multi = axis === 'trad' ? TRAD_MAX : 1;
  const toggle = (id: string) => {
    pick();
    setDraft((d) => {
      if (!id) return { ...d, v: [] };
      if (multi === 1) return { ...d, v: d.v[0] === id ? [] : [id] };
      return { ...d, v: d.v.includes(id) ? d.v.filter((x) => x !== id) : [...d.v, id].slice(-multi) };
    });
  };
  return (
    <Sheet open onOpenChange={(o) => { if (!o) onClose(); }} title={ui.tilt.axes[axis].title}>
      <p className="tm-caption tm-tiltp__hint">{ui.tilt.axes[axis].hint}</p>
      {axis === 'era' ? (
        <Eras decades={options.map(Number)} value={draft.v.map(Number)} onChange={(v) => setDraft((d) => ({ ...d, v: v.map(String) }))} />
      ) : (
        <div className="tm-tiltp__opts" role={multi === 1 ? 'radiogroup' : 'group'} aria-label={ui.tilt.axes[axis].title}>
          <OptionButton on={draft.v.length === 0} radio={multi === 1} label={ui.tilt.anyOption} onClick={() => toggle('')} />
          {list.map((id) => (
            <OptionButton key={id} on={draft.v.includes(id)} radio={multi === 1} label={optionLabel(axis, id)} note={optionNote(axis, id)} onClick={() => toggle(id)} />
          ))}
        </div>
      )}
      <div className="tm-tiltp__sfoot">
        <div>
          <div className="tm-caption tm-tiltp__powerl">{ui.tilt.power}</div>
          <Button size="sm" pressed={Boolean(draft.only)} className={cx('tm-tiltp__power', draft.only && 'tm-tiltp__power--only')}
                  onClick={() => { pick(); setDraft((d) => ({ ...d, only: !d.only })); }}>
            {draft.only ? ui.tilt.powerOnly : ui.tilt.powerMore}
          </Button>
        </div>
        <Button variant="primary" onClick={() => onDone({ v: draft.v, ...(draft.only ? { only: true } : {}) })}>{ui.tilt.done}</Button>
      </div>
    </Sheet>
  );
}

/** «Когда»: два барабана десятилетий, «от» не позже «до»; «Любое время» — снять */
function Eras({ decades, value, onChange }: { decades: number[]; value: number[]; onChange: (v: number[]) => void }) {
  const set = value.length > 0;
  const from = set ? value[0] : decades[Math.max(0, decades.indexOf(1950))] ?? decades[0];
  const to = set ? value[1] ?? value[0] : decades[Math.max(0, decades.indexOf(1990))] ?? decades[decades.length - 1];
  return (
    <>
      <div className="tm-tiltp__eras">
        <Wheel label={ui.tilt.from} decades={decades} value={from} active={set}
               onChange={(d) => onChange([d, Math.max(d, to)])} />
        <Wheel label={ui.tilt.to} decades={decades} value={to} active={set}
               onChange={(d) => onChange([Math.min(from, d), d])} />
      </div>
      <div className="tm-tiltp__opts">
        <OptionButton on={!set} radio label={ui.tilt.anyTime} onClick={() => { pick(); onChange([]); }} />
      </div>
    </>
  );
}

const WHEEL_ROW = 44;
function Wheel({ label, decades, value, active, onChange }: { label: string; decades: number[]; value: number; active: boolean; onChange: (d: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const quiet = useRef(true);
  const timer = useRef<number | undefined>(undefined);
  const index = Math.max(0, decades.indexOf(value));
  // положение барабана — по значению (и когда второй барабан подвинул этот)
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || Math.round(el.scrollTop / WHEEL_ROW) === index) return;
    quiet.current = true;
    el.scrollTop = index * WHEEL_ROW;
    requestAnimationFrame(() => requestAnimationFrame(() => { quiet.current = false; }));
  }, [index]);
  useEffect(() => { requestAnimationFrame(() => { quiet.current = false; }); return () => window.clearTimeout(timer.current); }, []);
  const onScroll = () => {
    if (quiet.current) return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const el = ref.current;
      if (!el) return;
      const i = Math.max(0, Math.min(decades.length - 1, Math.round(el.scrollTop / WHEEL_ROW)));
      if (decades[i] !== value || !active) { pick(); onChange(decades[i]); }
    }, 90);
  };
  const move = (i: number) => ref.current?.scrollTo({ top: i * WHEEL_ROW, behavior: 'smooth' });
  return (
    <div className="tm-tiltp__era">
      <span className="tm-caption">{label}</span>
      <div ref={ref} className={cx('tm-tiltp__wheel', active && 'tm-tiltp__wheel--on')} tabIndex={0} role="spinbutton" aria-label={label}
           aria-valuenow={value} aria-valuetext={ui.tilt.decade(value)} onScroll={onScroll}
           onKeyDown={(e) => {
             if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
             e.preventDefault();
             const i = Math.max(0, Math.min(decades.length - 1, index + (e.key === 'ArrowDown' ? 1 : -1)));
             move(i);
             onChange(decades[i]);
           }}>
        <ol>
          {decades.map((d, i) => (
            <li key={d} className={cx(d === value && 'tm-tiltp__wheelon')} onClick={() => { move(i); onChange(d); }}>{ui.tilt.decade(d)}</li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function WordsSheet({ data, energyOn, onApply, onClose }: { data: TiltData; energyOn: boolean; onApply: (t: Tilt, e?: Energy) => void; onClose: () => void }) {
  const [text, setText] = useState('');
  const parsed = useMemo(() => parseWords(text, data.axes, energyOn), [text, data, energyOn]);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.focus(); }, []);
  const apply = () => { if (parsed.hits.length) onApply(parsed.tilt, parsed.energy); else input.current?.focus(); };
  return (
    <Sheet open onOpenChange={(o) => { if (!o) onClose(); }} title={ui.tilt.wordsTitle}>
      <p className="tm-caption tm-tiltp__hint">{ui.tilt.wordsHint}</p>
      <label className="tm-tiltp__field">
        <span className="tm-caption">{ui.tilt.wordsLabel}</span>
        <input ref={input} className="tm-input" maxLength={80} value={text} placeholder={ui.tilt.wordsPlaceholder}
               onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') apply(); }} />
      </label>
      <div className="tm-tiltp__examples">
        {ui.tilt.wordsExamples.map((x) => (
          <button key={x} type="button" className="tm-tiltp__chip" onClick={() => { tap(); setText(x); }}>{x}</button>
        ))}
      </div>
      <div className="tm-tiltp__parsed" aria-live="polite">
        {parsed.hits.length
          ? parsed.hits.map((h) => <span key={h.axis}>{h.axis === 'effort' ? ui.tilt.effort : ui.tilt.axes[h.axis].k}: <b>{h.text}</b></span>)
          : <span className="tm-tiltp__none">{ui.tilt.wordsNone}</span>}
      </div>
      <div className="tm-tiltp__sfoot">
        <span />
        <Button variant="primary" disabled={!parsed.hits.length} onClick={apply}>{ui.tilt.apply}</Button>
      </div>
    </Sheet>
  );
}

function SaveSheet({ suggested, onSave, onClose }: { suggested: string; onSave: (name: string) => void; onClose: () => void }) {
  const [name, setName] = useState(suggested);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.focus(); input.current?.select(); }, []);
  const save = () => onSave(name.trim() || suggested);
  return (
    <Sheet open onOpenChange={(o) => { if (!o) onClose(); }} title={ui.tilt.saveTitle}>
      <p className="tm-caption tm-tiltp__hint">{ui.tilt.saveHint}</p>
      <label className="tm-tiltp__field">
        <span className="tm-caption">{ui.tilt.name}</span>
        <input ref={input} className="tm-input" maxLength={32} value={name} onChange={(e) => setName(e.target.value)}
               onKeyDown={(e) => { if (e.key === 'Enter') save(); }} />
      </label>
      <div className="tm-tiltp__sfoot">
        <span />
        <Button variant="primary" onClick={save}>{ui.tilt.saveDo}</Button>
      </div>
    </Sheet>
  );
}
