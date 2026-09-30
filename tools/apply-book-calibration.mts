// Калибровка книг (З4): лист владельца → разметка книг и сравнение с моделью.
//   npx tsx tools/apply-book-calibration.mts [путь к CSV]   (по умолчанию .cache/markup/book_calibration.csv)
// 1. Строки с уровнем (и не «нет» в «Читал(а)») → src/mocks/bookAnnotations.ts — ручная разметка,
//    ключ — произведение из справочника (по названию и автору), а если книги у нас нет — `t:<название>`.
// 2. Сравнение с черновиками модели «вслепую» (tools/book-drafts-blind.mts) и с разметкой каталога
//    (w11–w17): средняя ошибка уровня, смещение (модель минус человек), доля «±1», совпадение операций.
//    Отчёт — .cache/book-calibration-report.md, числа — .cache/book-calibration.json: смещение потом
//    вычитается из уровня черновиков книг (tools/draft-annotate.mts, когда он научится книгам).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { calibrationBooks } from './book-calibration.mts';
import { blindDrafts } from './book-drafts-blind.mts';
import { worksIndex } from './works-index.mts';
import { titleKey } from './book-bridge.mts';
import { isBookKey } from '../src/lib/keys.ts';
import { operations, operationKeys } from '../src/lib/operations.ts';
import { works as catalog } from '../src/mocks/index.ts';
import type { CognitiveOperation, Confidence } from '../src/types/tmdf.ts';

const file = process.argv[2] ?? new URL('../.cache/markup/book_calibration.csv', import.meta.url).pathname;
if (!existsSync(file)) { console.error(`нет листа ${file} — сначала tools/book-calibration-sheet.mts`); process.exit(1); }

/** CSV с «;» и кавычками (так сохраняют Excel и Numbers по-русски); запятая тоже принимается. */
function parseCsv(text: string): string[][] {
  const t = text.replace(/^﻿/, '');
  const sep = (t.split('\n')[0].match(/;/g)?.length ?? 0) >= (t.split('\n')[0].match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [], cell = '', q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"' && t[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; continue; }
    if (c === '"') q = true;
    else if (c === sep) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim()));
}

const opByName = new Map<string, CognitiveOperation>();
for (const k of operationKeys) { opByName.set(k, k); opByName.set(operations[k].short.toLowerCase(), k); }
const CONF: Record<string, Confidence> = { высокая: 'high', средняя: 'medium', низкая: 'low', high: 'high', medium: 'medium', low: 'low' };
const num = (s: string) => Number(s.replace(',', '.').trim());

const [head, ...body] = parseCsv(readFileSync(file, 'utf8'));
const col = (name: string) => head.findIndex((h) => h.trim().startsWith(name));
const C = { id: col('id'), title: col('Книга'), author: col('Автор'), level: col('Уровень'), barriers: col('Барьеры'), what: col('Что делает'), conf: col('Уверенность'), read: col('Читал') };
const opCols = [1, 2, 3].map((n) => [col(`Операция ${n}`), col(`Сила ${n}`)]);

type Human = { ops: [CognitiveOperation, number][]; level: number; barriers: string[]; warnings: string[]; niche: boolean; confidence: Confidence; what: string };
const human = new Map<string, Human & { title: string; author: string }>();
const problems: string[] = [];
for (const r of body) {
  const id = r[C.id]?.trim();
  const level = num(r[C.level] ?? '');
  if (!id || !Number.isFinite(level) || !r[C.level]?.trim() || /^нет$/i.test(r[C.read]?.trim() ?? '')) continue;
  if (level < 1 || level > 10) { problems.push(`${id}: уровень ${r[C.level]} вне 1–10`); continue; }
  const ops: [CognitiveOperation, number][] = [];
  for (const [oc, sc] of opCols) {
    const name = r[oc]?.trim().toLowerCase();
    if (!name) continue;
    const op = opByName.get(name);
    if (!op) { problems.push(`${id}: операция «${r[oc]}» не опознана`); continue; }
    const s = num(r[sc] ?? '');
    ops.push([op, Number.isFinite(s) && s > 0 && s <= 1 ? s : 0.5]);
  }
  human.set(id, {
    title: r[C.title]?.trim() ?? id, author: r[C.author]?.trim() ?? '', ops, level,
    barriers: (r[C.barriers] ?? '').split(',').map((x) => x.trim()).filter(Boolean), warnings: [], niche: false,
    confidence: CONF[(r[C.conf] ?? '').trim().toLowerCase()] ?? 'medium', what: (r[C.what] ?? '').trim(),
  });
}
console.error(`размечено владельцем: ${human.size} из ${calibrationBooks.length}${problems.length ? `; замечания: ${problems.join('; ')}` : ''}`);

// ---------- ключи книг ----------
const books = worksIndex({ all: true }).filter((w) => isBookKey(w.key) || w.work.type === 'book');
const surname = (a: string) => a.split(/\s+/).pop()?.toLowerCase().replace(/ё/g, 'е').slice(0, 5) ?? '';
const keyFor = (h: { title: string; author: string }): string => {
  const t = titleKey(h.title);
  const hit = books.find((b) => [b.work.title, b.work.originalTitle].some((x) => x && titleKey(x) === t)
    && (!h.author || b.work.creators.some((c) => surname(c) === surname(h.author)) || !b.work.creators.length));
  return hit?.key ?? `t:${t}`;
};
const out: Record<string, Human> = {};
for (const [, h] of human) { const { title: _t, author: _a, ...rest } = h; out[keyFor(h)] = rest; }
writeFileSync(new URL('../src/mocks/bookAnnotations.ts', import.meta.url), `// Сгенерировано tools/apply-book-calibration.mts (З4) — руками не править; источник — лист владельца
// .cache/markup/book_calibration.csv. Ручная разметка книг: ключ — произведение из справочника,
// а если книги у нас нет — \`t:<название>\` (приложение сверяет и по названию).
import type { FirstPassAnnotation } from './userAnnotations';

export const bookAnnotationMeta = { provider: 'human' as const, by: 'owner', status: 'approved' as const, createdAt: '${new Date().toISOString().slice(0, 10)}' };

export const bookAnnotations: Record<string, FirstPassAnnotation> = ${JSON.stringify(out, null, 2)};
`);

// ---------- сравнение ----------
const catalogLevel = new Map(Object.values(catalog).filter((w) => w.type === 'book').map((w) => [titleKey(w.title), w]));
type Row = { id: string; title: string; human: number; model: number; catalog?: number; jac: number };
const rows: Row[] = [];
for (const [id, h] of human) {
  const m = blindDrafts[id];
  if (!m) continue;
  const hs = new Set(h.ops.map(([o]) => o)), ms = new Set(m.ops.map(([o]) => o));
  const inter = [...hs].filter((o) => ms.has(o)).length, uni = new Set([...hs, ...ms]).size;
  rows.push({ id, title: h.title, human: h.level, model: m.level, catalog: catalogLevel.get(titleKey(h.title))?.complexityLevel, jac: uni ? inter / uni : 1 });
}
const n = rows.length;
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const round = (x: number) => Math.round(x * 100) / 100;
const bias = round(mean(rows.map((r) => r.model - r.human)));
const mae = round(mean(rows.map((r) => Math.abs(r.model - r.human))));
const within1 = round(rows.filter((r) => Math.abs(r.model - r.human) <= 1).length / (n || 1));
const jac = round(mean(rows.map((r) => r.jac)));
const cat = rows.filter((r) => r.catalog != null);
const catBias = round(mean(cat.map((r) => r.catalog! - r.human)));
writeFileSync(new URL('../.cache/book-calibration.json', import.meta.url), JSON.stringify({ n, bias, mae, within1, opsJaccard: jac, catalogBias: catBias, at: new Date().toISOString() }, null, 1));
const verdict = n < 10 ? 'Мало книг для вывода: нужно хотя бы 10 размеченных.'
  : Math.abs(bias) >= 0.75 ? `Модель ${bias > 0 ? 'завышает' : 'занижает'} уровень книг в среднем на ${Math.abs(bias)} — эту поправку черновики книг будут вычитать.`
  : mae > 1.5 ? 'Систематического сдвига нет, но разброс большой — черновикам книг нужна проверка куратором поштучно.'
  : 'Модель размечает книги близко к вам: черновики можно запускать, проверяя выборочно.';
const md = `# Калибровка разметки книг (З4)

${new Date().toISOString().slice(0, 10)} · размечено владельцем: ${human.size}, в сравнении: ${n}

- средняя ошибка уровня модели: **${mae}**, смещение (модель − вы): **${bias > 0 ? '+' : ''}${bias}**
- в пределах ±1: **${Math.round(within1 * 100)}%**
- совпадение операций (Жаккар): **${jac}**
${cat.length ? `- разметка каталога (w11–w17) против вашей: смещение ${catBias > 0 ? '+' : ''}${catBias} на ${cat.length} книгах\n` : ''}
**${verdict}**

| Книга | Вы | Модель | Каталог | Разница | Операции |
|---|---|---|---|---|---|
${rows.sort((a, b) => Math.abs(b.model - b.human) - Math.abs(a.model - a.human)).map((r) => `| ${r.title} | ${r.human} | ${r.model} | ${r.catalog ?? ''} | ${r.model - r.human > 0 ? '+' : ''}${r.model - r.human} | ${Math.round(r.jac * 100)}% |`).join('\n')}
`;
writeFileSync(new URL('../.cache/book-calibration-report.md', import.meta.url), md);
console.error(`сравнение на ${n} книгах: ошибка ${mae}, смещение ${bias}, ±1 — ${Math.round(within1 * 100)}%, операции ${jac}`);
console.error(verdict);
console.error('→ src/mocks/bookAnnotations.ts, .cache/book-calibration-report.md');
