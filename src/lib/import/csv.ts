// Разбор CSV по RFC 4180: кавычки, экранированные кавычки, переводы строк внутри поля.
// Экспорты Letterboxd, IMDb, Goodreads и StoryGraph — обычные CSV с заголовком.

export interface CsvTable { header: string[]; rows: Record<string, string>[] }

export function parseCsv(text: string): CsvTable {
  const lines: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((c) => c !== '')) lines.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some((c) => c !== '')) lines.push(row);
  const [header = [], ...body] = lines;
  const keys = header.map((h) => h.trim());
  return {
    header: keys,
    rows: body.map((cells) => Object.fromEntries(keys.map((k, i) => [k, (cells[i] ?? '').trim()]))),
  };
}
