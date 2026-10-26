// Рассказы аудиоканалов в Wikidata (25.10, слово владельца «подготовить список»): записи «Читальни» и других
// аудиоканалов без книги каталога (src/mocks/audioReadings.ts, workId нет) → элемент Wikidata произведения. Каталог не
// трогаем: это список на просмотр перед тем, как заводить рассказы отдельными вещами.
//   npx tsx tools/audio-wikidata.mts
//
// Как: автор записи → его элемент (поиск Wikidata по имени, только человек с P106 писатель/автор); его произведения
// (?w wdt:P50 автор) с русским и английским названием, другими названиями, видом (P31) и датой (P577). Совпадение —
// нормализованное название записи с русским названием или другим русским названием, или её оригинал с английским.
// Пауза 1,5 с, кэш .cache/audio-wikidata.json (авторы и их произведения). Итог — .cache/outreach/audio-wikidata-2510.{md,json}.
import { writeFileSync } from 'node:fs';
import { readCache, sleep, sparql, wd, writeCache } from './wikidata-lib.mts';
import { audioReadings } from '../src/mocks/audioReadings.ts';

type Work = { q: string; ru?: string; en?: string; alt: string[]; kind: string[]; year?: number };
type Cache = { authors: Record<string, string | null>; works: Record<string, Work[]> };
const cache = readCache<Cache>('audio-wikidata.json', { authors: {}, works: {} });

const norm = (s?: string) => (s ?? '').toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\p{N} ]/gu, ' ').replace(/\s+/g, ' ').trim();
const WRITER = new Set(['Q36180', 'Q482980', 'Q6625963', 'Q49757', 'Q18844224', 'Q4853732', 'Q214917', 'Q15949613', 'Q28389', 'Q11774202']);

// русское имя записи не находится поиском Wikidata (другое написание, инициалы) — ищем по-английски; соавторы — первым
const EN: Record<string, string> = {
  'П. Г. Вудхаус': 'P. G. Wodehouse', 'Буало Нарсежак': 'Pierre Boileau', 'Эрл Стенли Гарднер': 'Erle Stanley Gardner',
  'Дороти Л. Сэйерс': 'Dorothy L. Sayers', 'Илайджа Эллис': 'Elijah Ellis', 'Харолд Р. Даньелз': 'Harold R. Daniels',
  'X. А. Де Россо': 'H. A. DeRosso', 'Джон Кендрик Бэнгс': 'John Kendrick Bangs', 'Генри Кристофер Бейли': 'H. C. Bailey',
  'Том Годвин': 'Tom Godwin', 'Артур Рив': 'Arthur B. Reeve',
};

async function authorQ(name: string): Promise<string | null> {
  if (name in cache.authors && (cache.authors[name] || !EN[name])) return cache.authors[name];
  const r = await wd<{ search: { id: string }[] }>({ action: 'wbsearchentities', search: EN[name] ?? name, language: EN[name] ? 'en' : 'ru', type: 'item', limit: '7', format: 'json' });
  await sleep(1000);
  const ids = r.search.map((x) => x.id);
  let found: string | null = null;
  if (ids.length) {
    const q = await sparql<{ results: { bindings: { p: { value: string }; o: { value: string } }[] } }>(`SELECT ?p ?o WHERE {
      VALUES ?p { ${ids.map((i) => `wd:${i}`).join(' ')} } ?p wdt:P31 wd:Q5 ; wdt:P106 ?o }`);
    await sleep(1500);
    const writers = new Set(q.results.bindings.filter((b) => WRITER.has(b.o.value.split('/').pop()!)).map((b) => b.p.value.split('/').pop()!));
    found = ids.find((i) => writers.has(i)) ?? null;
  }
  cache.authors[name] = found;
  writeCache('audio-wikidata.json', cache);
  return found;
}

async function worksOf(a: string): Promise<Work[]> {
  if (cache.works[a]) return cache.works[a];
  type B = Record<string, { value: string } | undefined>;
  const r = await sparql<{ results: { bindings: B[] } }>(`SELECT ?w ?ru ?en ?alt ?k ?d WHERE {
    ?w wdt:P50 wd:${a} .
    OPTIONAL { ?w rdfs:label ?ru FILTER(LANG(?ru) = "ru") }
    OPTIONAL { ?w rdfs:label ?en FILTER(LANG(?en) = "en") }
    OPTIONAL { ?w skos:altLabel ?alt FILTER(LANG(?alt) = "ru") }
    OPTIONAL { ?w wdt:P31 ?k }
    OPTIONAL { ?w wdt:P577 ?d }
  }`);
  await sleep(1500);
  const m = new Map<string, Work>();
  for (const b of r.results.bindings) {
    const q = b.w!.value.split('/').pop()!;
    const w = m.get(q) ?? { q, alt: [], kind: [] };
    if (b.ru) w.ru = b.ru.value;
    if (b.en) w.en = b.en.value;
    if (b.alt && !w.alt.includes(b.alt.value)) w.alt.push(b.alt.value);
    const k = b.k?.value.split('/').pop();
    if (k && !w.kind.includes(k)) w.kind.push(k);
    const y = b.d ? Number(b.d.value.slice(0, 4)) : undefined;
    if (y && (!w.year || y < w.year)) w.year = y;
    m.set(q, w);
  }
  cache.works[a] = [...m.values()];
  writeCache('audio-wikidata.json', cache);
  return cache.works[a];
}

// виды, которые не вещь для чтения: издание и перевод (Q3331189, Q53731850); сборник оставляем
const EDITION = new Set(['Q3331189', 'Q53731850']);
type Row = { channel: string; post: number; author: string; title: string; original?: string; year?: number; kind?: string;
  q?: string; label?: string; wyear?: number; by?: 'ru' | 'alt' | 'en'; authorQ?: string | null; many?: number };
const rows: Row[] = [];
for (const [channel, ch] of Object.entries(audioReadings)) {
  for (const r of ch.readings) {
    if (r.workId) continue;
    const row: Row = { channel, post: r.post, author: r.author, title: r.title, original: r.original, year: r.year, kind: r.kind };
    rows.push(row);
    const a = await authorQ(r.author);
    row.authorQ = a;
    if (!a) continue;
    const works = (await worksOf(a)).filter((w) => !w.kind.every((k) => EDITION.has(k)) || !w.kind.length);
    const t = norm(r.title), o = norm(r.original);
    const hit = (by: Row['by'], f: (w: Work) => boolean) => { const h = works.filter(f); return h.length ? { by, h } : undefined; };
    const m = hit('ru', (w) => norm(w.ru) === t) ?? hit('alt', (w) => w.alt.some((x) => norm(x) === t)) ?? (o ? hit('en', (w) => norm(w.en) === o) : undefined);
    if (!m) continue;
    // несколько — ближе по году записи, иначе самый ранний
    const best = m.h.sort((x, y) => (r.year ? Math.abs((x.year ?? 9999) - r.year) - Math.abs((y.year ?? 9999) - r.year) : (x.year ?? 9999) - (y.year ?? 9999)))[0];
    Object.assign(row, { q: best.q, label: best.ru ?? best.en, wyear: best.year, by: m.by, ...(m.h.length > 1 ? { many: m.h.length } : {}) });
  }
}

const found = rows.filter((r) => r.q);
const noAuthor = [...new Set(rows.filter((r) => r.authorQ === null).map((r) => r.author))];
writeFileSync('.cache/outreach/audio-wikidata-2510.json', JSON.stringify(rows, null, 1));
const md = [
  `# Записи аудиоканалов без книги каталога → Wikidata (25.10)`, '',
  `Записей без книги: ${rows.length}. Нашлось произведение в Wikidata: ${found.length} (по русскому названию ${found.filter((r) => r.by === 'ru').length}, по другому названию ${found.filter((r) => r.by === 'alt').length}, по оригиналу ${found.filter((r) => r.by === 'en').length}). Не нашлось: ${rows.length - found.length}.`,
  `Автор не опознан в Wikidata: ${noAuthor.length ? noAuthor.join(', ') : 'все опознаны'}.`, '',
  `## Нашлись`, '', '| автор | запись | год | элемент | название в Wikidata | год | как |', '|---|---|---|---|---|---|---|',
  ...found.sort((a, b) => a.author.localeCompare(b.author, 'ru')).map((r) => `| ${r.author} | ${r.title} | ${r.year ?? ''} | ${r.q} | ${r.label ?? ''} | ${r.wyear ?? ''} | ${r.by}${r.many ? ` (из ${r.many})` : ''} |`), '',
  `## Не нашлись`, '', '| автор | запись | оригинал | год |', '|---|---|---|---|',
  ...rows.filter((r) => !r.q).sort((a, b) => a.author.localeCompare(b.author, 'ru')).map((r) => `| ${r.author} | ${r.title} | ${r.original ?? ''} | ${r.year ?? ''} |`), '',
];
writeFileSync('.cache/outreach/audio-wikidata-2510.md', md.join('\n'));
console.log(md.slice(0, 4).join('\n'));
