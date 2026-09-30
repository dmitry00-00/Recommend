// Лист калибровки книг (З4) для владельца: .cache/markup/book_calibration.csv и памятка рядом.
//   npx tsx tools/book-calibration-sheet.mts        (или deploy/book-calibration.command)
// CSV — UTF-8 с BOM и «;» — открывается в Excel и Numbers по-русски. Заполнить: уровень, до трёх
// операций с силой, барьеры, одну строку «что делает», уверенность; книгу, которую не читали, —
// пометить «нет» в последней колонке. Черновиков модели в листе нет нарочно: сначала своё мнение.
// Уже заполненный лист не перетирается — дописываются только новые книги списка.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { calibrationBooks, BOOK_BARRIERS } from './book-calibration.mts';
import { operations, operationKeys } from '../src/lib/operations.ts';

const dir = new URL('../.cache/markup/', import.meta.url);
mkdirSync(dir, { recursive: true });
const file = new URL('book_calibration.csv', dir);
export const HEADER = ['id', 'Книга', 'Автор', 'Год', 'Уровень 1–10', 'Операция 1', 'Сила 1', 'Операция 2', 'Сила 2', 'Операция 3', 'Сила 3',
  'Барьеры через запятую', 'Что делает — одной строкой', 'Уверенность', 'Читал(а)'];
const cell = (s: string | number) => { const t = String(s); return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };

const have = new Set<string>();
let rows: string[] = [];
if (existsSync(file)) {
  rows = readFileSync(file, 'utf8').replace(/^﻿/, '').split(/\r?\n/).filter(Boolean);
  for (const r of rows.slice(1)) have.add(r.split(';')[0]);
} else rows = [HEADER.join(';')];
let added = 0;
for (const b of calibrationBooks) {
  if (have.has(b.id)) continue;
  rows.push([b.id, b.title, b.author, b.year, '', '', '', '', '', '', '', '', '', '', ''].map(cell).join(';'));
  added++;
}
writeFileSync(file, '﻿' + rows.join('\n') + '\n');

const readme = `Калибровка разметки книг (З4)

Разметьте книги так же, как фильмы: уровень, операции, барьеры. Черновиков модели здесь нет нарочно —
сначала ваше мнение, потом сравнение (tools/apply-book-calibration.mts покажет, где модель смещается).

Уровень 1–10 — та же шкала, что у фильмов:
  1 — детское и чистый аттракцион; 2–3 — массовое развлечение; 4 — умное массовое;
  5–6 — авторское с доступным входом; 6–7 — ненадёжный рассказчик, сложная форма;
  7–8 — медленное авторское; 9 — предельная форма (поток сознания, комментарий вместо сюжета).
  Объём — не уровень: длинный простой роман остаётся простым, «Большой объём» — барьер.

Операции (до трёх, сила 0,1–1 — насколько книга этого требует):
${operationKeys.map((k) => `  ${operations[k].short} — ${operations[k].line}`).join('\n')}

Барьеры (через запятую; можно свои):
  ${BOOK_BARRIERS.join(', ')}

Уверенность: высокая / средняя / низкая. Не читали — «нет» в колонке «Читал(а)», остальное пусто.
Когда закончите: сохраните файл на том же месте (CSV) и запустите deploy/book-calibration.command ещё раз.
`;
writeFileSync(new URL('book_calibration_README.txt', dir), readme);
console.error(`→ .cache/markup/book_calibration.csv (${calibrationBooks.length} книг, новых строк ${added}) и памятка book_calibration_README.txt`);
