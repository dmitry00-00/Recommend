// Экспорты, которые человек скачивает сам из своего аккаунта. Форматы — по актуальным
// заголовкам файлов; определяются по заголовку, а не по имени файла.
import { parseCsv, type CsvTable } from './csv';
import type { ImportSource, ImportedRecord } from './types';

const num = (v: string | undefined): number | undefined => {
  const n = Number((v ?? '').replace(',', '.'));
  return v && Number.isFinite(n) ? n : undefined;
};
/** «2024/03/09», «2024-03-09», «09 Mar 2024» → ISO; иначе как есть. */
const iso = (v: string | undefined): string | undefined => {
  if (!v) return undefined;
  const m = v.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toISOString().slice(0, 10);
};
/** Goodreads отдаёт ISBN как ="0123456789" */
const isbn = (v: string | undefined): string | undefined => {
  const s = (v ?? '').replace(/[="\s-]/g, '');
  return s.length >= 10 ? s : undefined;
};

export function detectFormat(table: CsvTable): ImportSource | undefined {
  const h = new Set(table.header);
  if (h.has('Letterboxd URI')) return 'letterboxd';
  if (h.has('imdbID') || h.has('tmdbID') || h.has('Rating10')) return 'letterboxd_import';
  if (h.has('Const') && h.has('Title Type')) return 'imdb';
  if (h.has('Book Id') && h.has('Exclusive Shelf')) return 'goodreads';
  if (h.has('Read Status') && h.has('ISBN/UID')) return 'storygraph';
  return undefined;
}

function letterboxd(t: CsvTable): ImportedRecord[] {
  // ratings.csv, watched.csv, diary.csv — «просмотрено»; watchlist.csv — «в планах»
  const watchlist = !t.header.includes('Rating') && !t.header.includes('Watched Date') && t.header.length <= 4 && t.header.includes('Date')
    && !t.header.includes('Rewatch');
  return t.rows.map((r) => {
    const rating = num(r['Rating']);
    return {
      source: 'letterboxd', type: 'film',
      title: r['Name'], year: num(r['Year']),
      status: watchlist ? 'planned' : 'finished',
      rating: rating != null ? rating * 2 : undefined,
      date: iso(r['Watched Date'] || r['Date']),
      rewatch: r['Rewatch'] ? r['Rewatch'].toLowerCase() === 'yes' : undefined,
    };
  });
}

/** Импорт-формат Letterboxd: Title, Year, Rating или Rating10, WatchedDate, Rewatch, tmdbID,
 *  imdbID. Название может быть пустым (конвертер не нашёл латинского) — тогда держимся за ID. */
function letterboxdImport(t: CsvTable): ImportedRecord[] {
  return t.rows.map((r) => {
    const r10 = num(r['Rating10']);
    const r5 = num(r['Rating']);
    const tmdb = num(r['tmdbID']);
    const ids = { imdb: r['imdbID'] || undefined, tmdb: tmdb != null ? Math.trunc(tmdb) : undefined };
    return {
      source: 'letterboxd_import', type: 'film',
      title: r['Title'] ?? '', year: num(r['Year']),
      status: 'finished',
      rating: r10 ?? (r5 != null ? r5 * 2 : undefined),
      date: iso(r['WatchedDate']),
      rewatch: r['Rewatch'] ? r['Rewatch'].toLowerCase() === 'true' || r['Rewatch'].toLowerCase() === 'yes' : undefined,
      externalIds: ids.imdb || ids.tmdb != null ? ids : undefined,
    };
  });
}

const ENTITIES: Record<string, string> = { '&nbsp;': ' ', '&amp;': '&', '&quot;': '"', '&#39;': "'", '&lt;': '<', '&gt;': '>' };
const unescapeHtml = (s: string) =>
  s.replace(/&(nbsp|amp|quot|#39|lt|gt);/g, (m) => ENTITIES[m] ?? m).replace(/\s+/g, ' ').trim();

/** Страница «Оценки» профиля Кинопоиска, сохранённая из браузера («Сохранить как»). Каждая
 *  запись — `div.item`: ссылка /film/ID/ или /series/ID/, русское название с годом в скобках,
 *  оригинал в `.nameEng`, дата `дд.мм.гггг, чч:мм`, оценка — в `ur_data.push({film, rating})`.
 *  Токены сессии на странице парсер не читает и не сохраняет: наружу уходят только записи. */
export function parseKinopoiskHtml(text: string): ImportedRecord[] {
  const items = text.split(/<div class="item(?: even)?">/).slice(1);
  return items.flatMap((item) => {
    const link = item.match(/kinopoisk\.ru\/(film|series)\/(\d+)\/"[^>]*>([^<]*)<\/a>/);
    if (!link) return [];
    const kind = link[1];
    const kp = Number(link[2]);
    const heading = unescapeHtml(link[3]);
    // «Название (2015)» · «Название (сериал, 2017 – 2020)» · «Название (мини-сериал, 2017)»
    const tail = heading.match(/^(.*?)\s*\(([^()]*)\)\s*$/);
    const title = tail ? tail[1].trim() : heading;
    const inParens = tail ? tail[2] : '';
    const year = num(inParens.match(/\d{4}/)?.[0]);
    const series = kind === 'series' || /сериал/i.test(inParens);
    const eng = item.match(/<div class="nameEng">([\s\S]*?)<\/div>/);
    const originalTitle = eng ? unescapeHtml(eng[1]) : '';
    const date = item.match(/<div class="date">(\d{2})\.(\d{2})\.(\d{4})/);
    const vote = item.match(/ur_data\.push\(\{film: (\d+), rating: '(\d+)'/)
      ?? item.match(/myVote"[^>]*>(\d+)<\/div>/);
    const rating = vote ? num(vote[vote.length - 1]) : undefined;
    return [{
      source: 'kinopoisk',
      type: series ? 'series' : 'film',
      title,
      originalTitle: originalTitle || undefined,
      year,
      status: 'finished',
      rating,
      date: date ? `${date[3]}-${date[2]}-${date[1]}` : undefined,
      externalIds: { kinopoisk: kp },
    } satisfies ImportedRecord];
  });
}

/** Страница «Оценки и просмотры» нового профиля Кинопоиска (`/user/<id>/votes/`,
 *  категория `voted-watched`), сохранённая из браузера: по 20 карточек, у каждой ссылка
 *  `/film/ID/` или `/series/ID/` с постером, под постером — оценка (если человек её ставил;
 *  «просто просмотрено» — без неё), ниже подпись «Название» + «2014, фантастика». Оригинала
 *  и даты на этой странице нет. Классы и `data-tid` там хэшированные и меняются от сборки к
 *  сборке, поэтому разбор держится за структуру: ссылка с постером → ссылка-подпись с тем же
 *  ID. Ник, ID профиля и токены страницы парсер не читает. */
export function parseKinopoiskProfile(text: string): ImportedRecord[] {
  const poster = /<a href="\/(film|series)\/(\d+)\/"[^>]*>\s*<img\b[^>]*?\balt="([^"]*)"/g;
  const starts = Array.from(text.matchAll(poster));
  return starts.flatMap((m, i) => {
    const kind = m[1];
    const kp = Number(m[2]);
    const card = text.slice(m.index, starts[i + 1]?.index ?? m.index + 20000);
    // подпись — вторая ссылка на тот же фильм, скрытая от чтения с экрана
    const capAt = card.indexOf(`<a href="/${kind}/${kp}/"`, 1);
    const head = capAt > 0 ? card.slice(0, capAt) : card;
    const caption = capAt > 0 ? card.slice(capAt, card.indexOf('</a>', capAt)) : '';
    const texts = Array.from(caption.matchAll(/>([^<>]+)</g), (t) => unescapeHtml(t[1])).filter(Boolean);
    // запасной путь — alt постера: «Интерстеллар. 2014, фантастика»
    const alt = unescapeHtml(m[3]).match(/^(.*)\.\s+(\d{4})\b/);
    const title = texts[0] ?? alt?.[1] ?? '';
    const year = num((texts[1] ?? '').match(/\d{4}/)?.[0]) ?? num(alt?.[2]);
    // оценка — число 1–10 в плашке между постером и подписью; нет плашки — не оценивал
    const vote = Array.from(head.slice(head.indexOf('</a>')).matchAll(/>(\d{1,2})</g), (v) => Number(v[1]))
      .filter((v) => v >= 1 && v <= 10).pop();
    return [{
      source: 'kinopoisk',
      type: kind === 'series' ? 'series' : 'film',
      title,
      year,
      status: 'finished',
      rating: vote,
      externalIds: { kinopoisk: kp },
    } satisfies ImportedRecord];
  });
}

/** Текстовый список «не найдено» конвертера с Кинопоиска: блоки «## Название» и строки
 *  «Ключ: значение» по-русски. Год там обычно «—», зато есть ID Кинопоиска. */
export function parseKinopoiskText(text: string): ImportedRecord[] {
  const blocks = text.replace(/^\uFEFF/, '').split(/^##[ \t]*/m).slice(1);
  return blocks.map((block) => {
    const [titleLine = '', ...lines] = block.split(/\r?\n/);
    const get = (key: string) => lines.find((l) => l.startsWith(key + ':'))?.slice(key.length + 1).trim();
    const typeRaw = (get('Тип') ?? '').toLowerCase();
    const kp = num(get('Идентификатор на Кинопоиске'));
    return {
      source: 'kinopoisk',
      type: typeRaw.includes('series') || typeRaw.includes('сериал') ? 'series' : 'film',
      title: titleLine.trim(),
      year: num(get('Год выпуска')),
      status: 'finished',
      rating: num(get('Ваша оценка')),
      date: iso(get('Дата просмотра')),
      externalIds: kp != null ? { kinopoisk: Math.trunc(kp) } : undefined,
    } satisfies ImportedRecord;
  });
}

function imdb(t: CsvTable): ImportedRecord[] {
  const watchlist = t.header.includes('Position') && t.header.includes('Created');
  return t.rows
    // сериалы (tvSeries, tvMiniSeries, «TV Mini Series») — с Е5 свой вид; отдельные серии
    // (tvEpisode) и прочее не берём: оценка серии — не оценка сериала
    .filter((r) => /movie|video|tv\s*(mini\s*)?series/i.test(r['Title Type'] ?? '') || !r['Title Type'])
    .map((r) => ({
      source: 'imdb', type: /tv\s*(mini\s*)?series/i.test(r['Title Type'] ?? '') ? 'series' as const : 'film' as const,
      title: r['Title'], originalTitle: r['Original Title'] || undefined, year: num(r['Year']),
      status: watchlist && !r['Your Rating'] ? 'planned' : 'finished',
      rating: num(r['Your Rating']),
      date: iso(r['Date Rated'] || r['Created']),
      externalIds: r['Const'] ? { imdb: r['Const'] } : undefined,
    }));
}

function goodreads(t: CsvTable): ImportedRecord[] {
  const shelf: Record<string, ImportedRecord['status']> = { read: 'finished', 'currently-reading': 'in_progress', 'to-read': 'planned' };
  return t.rows.map((r) => {
    const rating = num(r['My Rating']);
    const ids = [isbn(r['ISBN13']), isbn(r['ISBN'])].filter((x): x is string => Boolean(x));
    return {
      source: 'goodreads', type: 'book',
      title: r['Title'].replace(/\s*\(.*?#\d+\)\s*$/, ''), // «Title (Series, #1)» → «Title»
      year: num(r['Original Publication Year']) ?? num(r['Year Published']),
      status: shelf[r['Exclusive Shelf']] ?? 'finished',
      rating: rating ? rating * 2 : undefined,
      date: iso(r['Date Read'] || r['Date Added']),
      rewatch: num(r['Read Count']) != null && Number(r['Read Count']) > 1 ? true : undefined,
      externalIds: ids.length ? { isbn: ids } : undefined,
    };
  });
}

function storygraph(t: CsvTable): ImportedRecord[] {
  const status: Record<string, ImportedRecord['status']> = { read: 'finished', 'currently-reading': 'in_progress', 'to-read': 'planned', 'did-not-finish': 'finished' };
  return t.rows.map((r) => {
    const rating = num(r['Star Rating']);
    const id = isbn(r['ISBN/UID']);
    return {
      source: 'storygraph', type: 'book',
      title: r['Title'],
      status: status[r['Read Status']] ?? 'finished',
      rating: rating ? rating * 2 : undefined,
      date: iso(r['Last Date Read'] || r['Date Added']),
      externalIds: id ? { isbn: [id] } : undefined,
    };
  });
}

// «кинопоиск» и «просто список» разбираются не таблицей, поэтому в карту не входят
const PARSERS: Record<Exclude<ImportSource, 'kinopoisk' | 'plain_list'>, (t: CsvTable) => ImportedRecord[]> = {
  letterboxd, letterboxd_import: letterboxdImport, imdb, goodreads, storygraph,
};

const usable = (r: ImportedRecord) => Boolean(r.title || r.externalIds);

/** Просто список названий: по одному в строке, год в конце необязателен. Ни оценок, ни дат —
 *  это свидетельство о выборе, а не о предпочтении. Годятся и «Маяк», и «Маяк 2019», и
 *  «Маяк, 2019»; маркеры списка («-», «—», «•», «1.») отбрасываются. */
export function parsePlainList(text: string): ImportedRecord[] {
  return text.replace(/^\uFEFF/, '').split(/\r?\n/)
    .map((l) => l.trim().replace(/^[-—•*]\s*|^\d{1,3}[.)]\s*/, '').trim())
    .filter(Boolean)
    .map((line) => {
      const m = /^(.*?)[\s,]*((?:18|19|20)\d{2})?$/.exec(line);
      const title = (m?.[1] ?? line).trim();
      const year = m?.[2] ? Number(m[2]) : undefined;
      return { source: 'plain_list', type: 'film', title, year, status: 'finished' } satisfies ImportedRecord;
    })
    .filter((r) => r.title.length > 1);
}

/** Похоже ли на список названий: короткие строки без разделителей таблицы. Проверяем строго —
 *  иначе сюда провалится любой нераспознанный CSV и молча станет «историей». */
function looksLikePlainList(text: string): boolean {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 3 || lines.length > 5000) return false;
  const tabular = lines.filter((l) => /[\t;]|,.*,/.test(l)).length;
  const long = lines.filter((l) => l.length > 80).length;
  return tabular / lines.length < 0.1 && long / lines.length < 0.1;
}

/** Текст файла → записи. Неизвестный формат — undefined, а не пустой список: это разные состояния. */
export function parseExport(text: string): { source: ImportSource; records: ImportedRecord[] } | undefined {
  if (/<div class="profileFilmsList"|ur_data\.push\(/.test(text)) {
    return { source: 'kinopoisk', records: parseKinopoiskHtml(text).filter(usable) };
  }
  if (/userVotedWatchedMovies|"category":"voted-(?:watched|only)"/.test(text)) {
    return { source: 'kinopoisk', records: parseKinopoiskProfile(text).filter(usable) };
  }
  if (/^##\s|Идентификатор на Кинопоиске:/m.test(text)) {
    return { source: 'kinopoisk', records: parseKinopoiskText(text).filter(usable) };
  }
  const table = parseCsv(text);
  const source = detectFormat(table);
  // «просто список» detectFormat не возвращает — он про таблицы; проверка нужна типам
  if (source && source !== 'kinopoisk' && source !== 'plain_list') {
    return { source, records: PARSERS[source](table).filter(usable) };
  }
  // формат не узнан таблицей — может быть просто список названий
  if (looksLikePlainList(text)) {
    const records = parsePlainList(text).filter(usable);
    if (records.length >= 3) return { source: 'plain_list', records };
  }
  return undefined;
}

/** Несколько файлов одного человека (страницы профиля, CSV + список «не найдено»): записи
 *  склеиваются, повторы по внешнему ID или названию с годом убираются — первый выигрывает. */
export function parseExports(texts: string[]): { sources: ImportSource[]; records: ImportedRecord[]; unrecognized: number } {
  const sources: ImportSource[] = [];
  const records: ImportedRecord[] = [];
  const seen = new Set<string>();
  let unrecognized = 0;
  for (const text of texts) {
    const parsed = parseExport(text);
    if (!parsed) { unrecognized++; continue; }
    if (!sources.includes(parsed.source)) sources.push(parsed.source);
    for (const r of parsed.records) {
      const keys = dedupKeys(r);
      if (keys.some((k) => seen.has(k))) continue;
      keys.forEach((k) => seen.add(k));
      records.push(r);
    }
  }
  return { sources, records, unrecognized };
}

/** Все признаки, по которым две записи считаются одним просмотром: внешние ID и пара
 *  «название + год» — как для русского названия, так и для оригинала (CSV конвертера
 *  с Кинопоиска и сохранённая страница называют один фильм по-разному). */
function dedupKeys(r: ImportedRecord): string[] {
  const ids = r.externalIds ?? {};
  const keys: string[] = [];
  if (ids.kinopoisk != null) keys.push(`kp:${ids.kinopoisk}`);
  if (ids.imdb) keys.push(`imdb:${ids.imdb}`);
  if (ids.tmdb != null) keys.push(`tmdb:${ids.tmdb}`);
  ids.isbn?.forEach((i) => keys.push(`isbn:${i}`));
  for (const t of [r.title, r.originalTitle]) {
    if (t) keys.push(`t:${r.type}:${t.toLowerCase().replace(/\s+/g, ' ').trim()}:${r.year ?? ''}`);
  }
  return keys;
}

