// Подписи вариантов осей наклона и разбор фразы «Словами» (19.10, панель ленты v2). Отдельно от экрана — чтобы
// проверять разбор без браузера (tools/tilt-test.mts); в сборке — в ленивом куске панели.
import type { CognitiveOperation, Energy } from '@/types/tmdf';
import { operations } from '@/lib/operations';
import { TRAD_MAX, tiltAxes, type Tilt, type TiltAxis, type TiltPick, eraBucket } from '@/lib/tilt';
import ui from '@/i18n';

export interface AxisOptions { axis: TiltAxis; options: string[] }

type ShelfId = keyof typeof ui.collections.shelf;

export function optionLabel(axis: TiltAxis, id: string): string {
  switch (axis) {
    case 'want': return ui.tilt.want[id] ?? id;
    case 'trad': return ui.tilt.trad[id] ?? ui.collections.shelf[id as ShelfId]?.title ?? id;
    case 'op': return operations[id as CognitiveOperation]?.name ?? id;
    case 'form': return ui.tilt.form[id] ?? id;
    case 'len': return ui.tilt.len[id] ?? id;
    case 'era': return ui.tilt.decade(Number(id));
  }
}
export const optionNote = (axis: TiltAxis, id: string): string | undefined =>
  axis === 'op' ? operations[id as CognitiveOperation]?.line : axis === 'len' ? ui.tilt.lenNote[id] : undefined;

export function pickText(axis: TiltAxis, p: TiltPick): string {
  if (axis === 'era') return ui.tilt.decades(Number(p.v[0]), Number(p.v[1] ?? p.v[0]));
  return p.v.map((v) => optionLabel(axis, v)).join(' + ');
}
/** коротко — для ярлыка над лентой и названия сочетания: «японское · медленное, созерцательное» */
export function shortText(axis: TiltAxis, p: TiltPick): string {
  const t = pickText(axis, p);
  return (axis === 'trad' ? t.replace(/ кино| cinema/gi, '') : t).toLowerCase();
}
export function tiltText(t: Tilt, energy: Energy): string {
  return [...tiltAxes(t).map((a) => shortText(a, t[a]!)), ...(energy !== 'normal' ? [ui.energy[energy].short.toLowerCase()] : [])].join(' · ');
}

// ─── «Словами»: фраза расставляет оси ──────────────────────────────────────────────────────────────────────────────
const LETTER = 'a-zа-яё';
const stemsOf = (label: string): string[] => label.toLowerCase().replace(/ё/g, 'е').split(/[^a-zа-я0-9-]+/)
  .filter((w) => w.length >= 4 && !/^(?:кино|фильм|film|cinema|movie|чтобы|about)$/.test(w))
  .map((w) => w.slice(0, Math.max(4, w.length - 2)));
const hasStem = (text: string, stem: string): boolean => new RegExp(`(?:^|[^${LETTER}])${stem}`, 'i').test(text);

export interface Parsed { tilt: Tilt; energy?: Energy; hits: { axis: TiltAxis | 'effort'; text: string }[] }
/** Разбор фразы по подписям вариантов осей (основы слов) и синонимам из словаря; десятилетия — «2000-х», «70-х», «1960».
 *  Вариант с большим числом совпавших основ сильнее; второй берётся, только если совпал чем-то своим. */
export function parseWords(text: string, axes: readonly AxisOptions[], energyOn = true): Parsed {
  const q = ` ${text.toLowerCase().replace(/ё/g, 'е')} `;
  const tilt: Tilt = {};
  const hits: Parsed['hits'] = [];
  for (const { axis, options } of axes) {
    if (axis === 'era') continue;
    const syn = ui.tilt.syn[axis] ?? {};
    const scored = options.map((id) => {
      const own = stemsOf(optionLabel(axis, id));
      const extra = (syn[id] ?? '').split('|').filter(Boolean).map((s) => s.replace(/ё/g, 'е'));
      const found = [...own, ...extra].filter((s) => hasStem(q, s));
      return { id, found, score: found.length ? found.length + found.filter((s) => own.includes(s)).length / Math.max(1, own.length) : 0 };
    }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score);
    const used = new Set<string>();
    const take: string[] = [];
    for (const x of scored) {
      if (take.length >= (axis === 'trad' ? TRAD_MAX : 1)) break;
      if (x.found.every((s) => used.has(s))) continue;
      take.push(x.id);
      x.found.forEach((s) => used.add(s));
    }
    if (take.length) { tilt[axis] = { v: take }; hits.push({ axis, text: take.map((id) => optionLabel(axis, id)).join(' + ') }); }
  }
  const decades = axes.find((x) => x.axis === 'era')?.options.map(Number) ?? [];
  if (decades.length) {
    // «1970», «1970-х» — год целиком; «70-х», «70s» — только с пометкой десятилетия (иначе «90 минут» стали бы 1990-ми)
    const full = [...q.matchAll(/(?:^|[^0-9])(1[89]|20)([0-9])0(?![0-9])/g)].map((m) => Number(m[1]) * 100 + Number(m[2]) * 10);
    const short = [...q.matchAll(/(?:^|[^0-9])([0-9])0(?:-?[хе]|'?s)(?![a-zа-я])/g)].map((m) => {
      const d = Number(m[1]) * 10;
      return d <= 20 ? 2000 + d : 1900 + d;
    });
    const found = [...full, ...short].map(eraBucket).filter((d) => d >= decades[0] - 10 && d <= decades[decades.length - 1] + 10).sort((a, b) => a - b);
    if (found.length) {
      const near = (d: number) => decades.reduce((b, x) => (Math.abs(x - d) < Math.abs(b - d) ? x : b), decades[0]);
      const v = [near(found[0]), near(found[found.length - 1])];
      tilt.era = { v: v.map(String) };
      hits.push({ axis: 'era', text: ui.tilt.decades(v[0], v[1]) });
    }
  }
  let energy: Energy | undefined;
  if (energyOn) {
    for (const e of ['low', 'high'] as const) {
      const stems = [...stemsOf(ui.energy[e].short), ...ui.tilt.synEnergy[e].split('|')];
      if (stems.some((s) => hasStem(q, s))) { energy = e; hits.push({ axis: 'effort', text: ui.energy[e].short }); break; }
    }
  }
  return { tilt, ...(energy ? { energy } : {}), hits };
}

