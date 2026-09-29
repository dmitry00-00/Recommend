// Чтение датасета TV Tropes (dhruvilgala/tvtropes, статья «Analyzing Gender Bias within
// Narrative Tropes», 2020): таблица «фильм ↔ приём» с IMDb ID.
// Контент TV Tropes — CC BY-NC-SA. Поэтому отсюда наружу идут только идентификаторы,
// названия приёмов и ссылки на вики: описания и примеры (колонки Description и Example)
// читаются, но никуда не сохраняются — ShareAlike заразил бы нашу собственную разметку.
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';

/** Разбор строки CSV с кавычками: поле «Example» содержит и запятые, и переводы строк,
 *  поэтому читаем посимвольно и склеиваем запись из нескольких строк файла. */
export function splitCsv(line: string): string[] {
  const out: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') { field += '"'; i += 1; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { out.push(field); field = ''; }
    else field += c;
  }
  out.push(field);
  return out;
}

const openQuotes = (s: string): boolean => (s.match(/"/g)?.length ?? 0) % 2 === 1;

/** Построчный обход таблицы: запись бывает разбита на несколько строк файла. */
export async function eachRow(file: string, fn: (cells: string[], header: string[]) => void): Promise<number> {
  let header: string[] | undefined;
  let buffer = '';
  let rows = 0;
  const rl = createInterface({ input: createReadStream(file, 'utf8'), crlfDelay: Infinity });
  for await (const line of rl) {
    buffer = buffer ? `${buffer}\n${line}` : line;
    if (openQuotes(buffer)) continue;
    const cells = splitCsv(buffer);
    buffer = '';
    if (!header) { header = cells; continue; }
    rows += 1;
    fn(cells, header);
  }
  return rows;
}

/** Написание приёма в датасете гуляет регистром (IncurableCoughOfDeath и InCurableCoughOfDeath),
 *  поэтому ключ — нижний регистр, а для показа берём самое частое написание. */
export const normTrope = (name: string): string => name.toLowerCase();

export interface TropeTable {
  rows: number;
  /** фильм (IMDb ID) → приёмы, по всем фильмам датасета, а не только нашим:
   *  частота приёма по всему корпусу нужна, чтобы отличить общее место от особенности */
  byFilm: Map<string, Set<string>>;
  /** ключ → как писать: самое частое написание в датасете */
  display: Map<string, string>;
  /** в скольких фильмах встречается приём */
  docFreq: Map<string, number>;
}

export async function readFilmTropes(file: string): Promise<TropeTable> {
  const byFilm = new Map<string, Set<string>>();
  const spellings = new Map<string, Map<string, number>>();
  const rows = await eachRow(file, (cells, header) => {
    const tconst = cells[header.indexOf('tconst')];
    const trope = cells[header.indexOf('Trope')];
    if (!tconst || !trope) return;
    const key = normTrope(trope);
    const set = byFilm.get(tconst) ?? byFilm.set(tconst, new Set()).get(tconst)!;
    set.add(key);
    const seen = spellings.get(key) ?? spellings.set(key, new Map()).get(key)!;
    seen.set(trope, (seen.get(trope) ?? 0) + 1);
  });
  const display = new Map<string, string>();
  for (const [key, seen] of spellings) {
    display.set(key, [...seen.entries()].sort((a, b) => b[1] - a[1])[0][0]);
  }
  const docFreq = new Map<string, number>();
  for (const set of byFilm.values()) for (const key of set) docFreq.set(key, (docFreq.get(key) ?? 0) + 1);
  return { rows, byFilm, display, docFreq };
}

/** Страница приёма на вики: показываем ссылку, а не их текст. */
export const wikiUrl = (name: string): string => `https://tvtropes.org/pmwiki/pmwiki.php/Main/${name}`;

/** «AbandonedArea» → «Abandoned Area»: в датасете имена слитные. */
export const spaced = (name: string): string =>
  name.replace(/([a-z\d])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
