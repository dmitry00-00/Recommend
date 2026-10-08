// Рубрики роликов (ТВ-3): общее для разметки моделью (tools/llm-lens.mts) и ручной разметки
// (вкладка «Рубрики» пульта, tools/lens-desk.mts). Решение человека (tools/lens-verdicts.json)
// сильнее модели: в приложение уходит оно, и модель такой ролик больше не переразмечает.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';

export const LENSES = ['meaning', 'domain', 'specialist', 'facts', 'sins', 'compare', 'book', 'history', 'author', 'character', 'franchise', 'opinion', 'other'] as const;
export type Lens = typeof LENSES[number];
export const LENS_RU: Record<Lens, string> = {
  meaning: 'Смысл и толкование', domain: 'Философия, психология, культура', specialist: 'Глазами специалиста',
  facts: 'Факты и закулисье', sins: 'Грехи и ляпы', compare: 'Сравнение', book: 'Книга и фильм',
  history: 'Как было на самом деле', author: 'Об авторе', character: 'О персонаже', franchise: 'О франшизе', opinion: 'Мнение и отзыв', other: 'Другое',
};
export const isLens = (x: unknown): x is Lens => typeof x === 'string' && (LENSES as readonly string[]).includes(x);

const root = new URL('../', import.meta.url);
export const LENS_FILE = new URL('.cache/llm/lenses.json', root);
export const LENS_VERDICTS = new URL('tools/lens-verdicts.json', root);
const EXPORT = new URL('src/mocks/essayLenses.ts', root);

export interface LensLabel { h: string; lens: Lens; also?: Lens; conf?: number; model: string; at: string; title: string; channel?: string; tier?: string; keys: string[] }
export interface LensFile { prompt: string; items: Record<string, LensLabel> }
/** Решение человека по ролику (ключ — `yt:<id>`): рубрика и второй угол; `was` — что ставила модель. */
export interface LensVerdict { lens: Lens; also?: Lens; at: string; was?: Lens }

const readJson = <T,>(u: URL, d: T): T => { try { return existsSync(u) ? JSON.parse(readFileSync(u, 'utf8')) as T : d; } catch { return d; } };
const writeAtomic = (u: URL, text: string) => { const tmp = `${u.pathname}.tmp`; writeFileSync(tmp, text); renameSync(tmp, u.pathname); };

export const readLensFile = (): LensFile => readJson<LensFile>(LENS_FILE, { prompt: '', items: {} });
export const readLensVerdicts = (): Record<string, LensVerdict> => readJson<Record<string, LensVerdict>>(LENS_VERDICTS, {});
export function writeLensVerdicts(v: Record<string, LensVerdict>): void {
  const sorted = Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)));
  writeAtomic(LENS_VERDICTS, `${JSON.stringify(sorted, null, 1)}\n`);
}
export function writeLensFile(file: LensFile): void {
  mkdirSync(new URL('.cache/llm/', root), { recursive: true });
  writeAtomic(LENS_FILE, JSON.stringify(file));
}

/** Рубрики — в приложение (ТВ-3г): id ролика → «sins» или «sins/facts» (со вторым углом). Отдельным
 *  файлом, а не полем в индексе разборов: рубрики доразмечаются без пересборки индекса (25 минут) и
 *  достаются и роликам, присланным вручную (essays.ts). Решение человека — поверх модели. */
export function exportLenses(file = readLensFile(), verdicts = readLensVerdicts()): number {
  const out: Record<string, string> = {};
  for (const [id, l] of Object.entries(file.items)) {
    if (!id.startsWith('yt:')) continue;
    out[id.slice(3)] = l.also ? `${l.lens}/${l.also}` : l.lens;
  }
  for (const [id, v] of Object.entries(verdicts)) {
    if (!id.startsWith('yt:') || !isLens(v.lens)) continue;
    out[id.slice(3)] = v.also ? `${v.lens}/${v.also}` : v.lens;
  }
  const sorted = Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(EXPORT,
    `// Сгенерировано tools/llm-lens.mts и пультом «Рубрики» — не править руками. Рубрики роликов (ТВ-3): id ролика
// YouTube → рубрика или «рубрика/второй угол» (src/lib/lenses.ts). Размечает модель, решение человека
// (tools/lens-verdicts.json) — поверх неё.
export const essayLenses: Record<string, string> = ${JSON.stringify(sorted)};
`);
  return Object.keys(sorted).length;
}
