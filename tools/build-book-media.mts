// Метаданные и обложки книг (З3): Wikidata и Open Library — обе без NC-оговорки (Wikidata CC0,
// данные Open Library — общественное достояние). Для всех книг справочника: каталог, история,
// каталог через мост с кино (З2).
//   npx tsx tools/build-book-media.mts [--fresh] [--dry]
// Что берём:
//   · Wikidata (элемент произведения): название по-русски, оригинальное (P1476), год (P577), авторы
//     (P50), жанр (P136) и тема (P921) — английскими метками, для регистра;
//   · Open Library (работа): обложка (`covers`), темы (`subjects`), а по изданиям (`/editions.json`) —
//     медиана страниц и русское издание: его название и обложка (человек видел книгу такой);
//   · регистр — `pick` из tools/register-tags.mts по английским жанрам и темам (как у фильмов по
//     ключевым словам TMDb).
//   · Wikimedia Commons (11.10) — если у Open Library обложки нет: изображение элемента произведения (P18), чаще
//     всего обложка или титул первого издания, у сказок — старая иллюстрация. Только общественное достояние и CC0:
//     под CC BY пришлось бы подписывать автора у каждой плитки, а это обычно фото спектакля или чужой обложки.
// Описания Open Library не берём: их часто копируют с обложек издателей — лицензия неясна.
// Кэш — .cache/book-media.json; итог — src/mocks/bookMedia.ts (ключ произведения → поля карточки).
import { writeFileSync } from 'node:fs';
import { worksIndex, idsOf } from './works-index.mts';
import { pickBook } from './register-tags.mts';
import { readCache, sleep, wd, writeCache } from './wikidata-lib.mts';
import { isBookEntry } from '../src/lib/keys.ts';
import type { Register, WorkCard } from '../src/types/tmdf.ts';
import { relationEdges, relationNodes } from '../src/mocks/workRelations.ts';
import { baseMedia } from '../src/mocks/baseMedia.ts';
import { workRegisters } from '../src/mocks/workRegisters.ts';
import { seriesRegisters } from '../src/mocks/seriesRegisters.ts';

const args = process.argv.slice(2);
const FRESH = args.includes('--fresh'), DRY = args.includes('--dry');
const UA = 'transformative-media/0.1 (book index; contact via repository README)';
const COVERS = 'https://covers.openlibrary.org/b';

const ol = async <T,>(path: string): Promise<T | undefined> => {
  const r = await fetch(`https://openlibrary.org${path}`, { headers: { 'User-Agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(20000) });
  if (r.status === 404) return undefined;
  if (!r.ok) throw new Error(`open library ${r.status} ${path}`);
  return await r.json() as T;
};

type Raw = {
  wd?: { ru?: string; en?: string; original?: string; year?: number; authors?: string[]; genres?: string[] };
  ol?: { cover?: number; subjects?: string[]; pages?: number; ruTitle?: string; ruCover?: number };
  /** изображение из Commons: file — имя файла, thumb — уменьшенная копия, license — краткая лицензия */
  commons?: { file?: string; thumb?: string; license?: string };
};
const cache: Record<string, Raw> = FRESH ? {} : readCache('book-media.json', {});

const books = worksIndex({ all: true }).filter((w) => isBookEntry(w));
console.error(`книг: ${books.length}`);

type Claim = { mainsnak: { datavalue?: { value: unknown } } };
type Ent = { labels?: Record<string, { value: string }>; claims?: Record<string, Claim[]> };
const entities = async (ids: string[], props = 'labels|claims') =>
  ids.length ? (await wd<{ entities?: Record<string, Ent> }>({ action: 'wbgetentities', ids: ids.join('|'), props, languages: 'ru|en' })).entities ?? {} : {};

let asked = 0;
for (const b of books) {
  if (cache[b.key]) continue;
  const ids = idsOf(b.work);
  const raw: Raw = {};
  try {
    if (ids?.wikidata) {
      const e = (await entities([ids.wikidata]))[ids.wikidata];
      const val = (p: string) => e?.claims?.[p]?.map((c) => c.mainsnak.datavalue?.value).filter(Boolean) ?? [];
      const item = (p: string) => val(p).map((v) => (v as { id: string }).id).slice(0, 5);
      const refs = await entities([...item('P50'), ...item('P136'), ...item('P921')], 'labels');
      const label = (id: string, lang: 'ru' | 'en') => refs[id]?.labels?.[lang]?.value ?? refs[id]?.labels?.en?.value;
      const years = val('P577').map((v) => Number((v as { time: string }).time.slice(1, 5))).filter((y) => y > 0);
      const original = val('P1476').map((v) => (v as { text: string }).text)[0];
      raw.wd = {
        ru: e?.labels?.ru?.value, en: e?.labels?.en?.value, ...(original ? { original } : {}),
        ...(years.length ? { year: Math.min(...years) } : {}),
        authors: item('P50').map((id) => label(id, 'ru')).filter((x): x is string => Boolean(x)),
        genres: [...item('P136'), ...item('P921')].map((id) => label(id, 'en')).filter((x): x is string => Boolean(x)),
      };
      await sleep(200);
    }
    let olw = ids?.openLibrary;
    if (!olw && ids?.isbn?.[0]) olw = (await ol<{ works?: { key: string }[] }>(`/isbn/${ids.isbn[0]}.json`))?.works?.[0]?.key.split('/').pop();
    // нет ни Open Library в Wikidata, ни ISBN (книги, опознанные пачкой по названию, 11.10) — поиск по названию и
    // автору: английское название точнее (так книга заведена в Open Library), автор — фамилией
    if (!olw && (raw.wd?.en || raw.wd?.original || b.work.title)) {
      const author = raw.wd?.authors?.[0]?.split(/\s+/).pop();
      const qs = new URLSearchParams({ title: raw.wd?.en ?? raw.wd?.original ?? b.work.title, ...(author ? { author } : {}), fields: 'key', limit: '1' });
      olw = (await ol<{ docs?: { key?: string }[] }>(`/search.json?${qs}`))?.docs?.[0]?.key?.split('/').pop();
    }
    if (olw) {
      const work = await ol<{ covers?: number[]; subjects?: string[] }>(`/works/${olw}.json`);
      const eds = await ol<{ entries?: { title?: string; covers?: number[]; number_of_pages?: number; languages?: { key: string }[] }[] }>(`/works/${olw}/editions.json?limit=50`);
      const pages = (eds?.entries ?? []).map((x) => x.number_of_pages).filter((n): n is number => Boolean(n && n > 20)).sort((x, y) => x - y);
      const ru = (eds?.entries ?? []).find((x) => x.languages?.some((l) => l.key === '/languages/rus') && x.title);
      raw.ol = {
        ...(work?.covers?.find((c) => c > 0) ? { cover: work.covers.find((c) => c > 0) } : {}),
        subjects: (work?.subjects ?? []).slice(0, 30),
        ...(pages.length ? { pages: pages[Math.floor(pages.length / 2)] } : {}),
        ...(ru?.title ? { ruTitle: ru.title } : {}),
        ...(ru?.covers?.find((c) => c > 0) ? { ruCover: ru.covers.find((c) => c > 0) } : {}),
      };
      await sleep(300);
    }
  } catch (e) {
    console.error(`  ${b.work.title}: ${(e as Error).message}`);
    continue;
  }
  cache[b.key] = raw;
  if (++asked % 20 === 0) writeCache('book-media.json', cache);
}
writeCache('book-media.json', cache);

// ---------- обложка из Commons, если у Open Library её нет ----------
const FREE = /^(public domain|cc0)/i;
const COMMONS_UA = 'recomend/0.1 (https://github.com/dmitry00-00/Recommend)';
const bare = books.filter((b) => cache[b.key] && !b.work.coverUrl && !cache[b.key].ol?.cover && !cache[b.key].ol?.ruCover && !cache[b.key].commons && idsOf(b.work)?.wikidata);
for (let i = 0; i < bare.length; i += 50) {
  const part = bare.slice(i, i + 50);
  const ents = await entities(part.map((b) => idsOf(b.work)!.wikidata!), 'claims');
  for (const b of part) {
    const file = ents[idsOf(b.work)!.wikidata!]?.claims?.P18?.[0]?.mainsnak.datavalue?.value as string | undefined;
    if (!file) { cache[b.key].commons = {}; continue; }
    try {
      // Commons отказывает частым запросам без контакта в User-Agent — ссылка на репозиторий и пауза при отказе
      let r: Response | undefined;
      for (let a = 0; a < 4; a++) {
        r = await fetch(`https://commons.wikimedia.org/w/api.php?${new URLSearchParams({ action: 'query', titles: `File:${file}`, prop: 'imageinfo', iiprop: 'url|extmetadata', iiurlwidth: '600', format: 'json', maxlag: '5' })}`,
          { headers: { 'User-Agent': COMMONS_UA }, signal: AbortSignal.timeout(20000) });
        if (r.ok && (r.headers.get('content-type') ?? '').includes('json')) break;
        await sleep(5000 * (a + 1));
      }
      const page = Object.values((await r!.json() as { query?: { pages?: Record<string, { imageinfo?: { thumburl?: string; extmetadata?: Record<string, { value: string }> }[] }> } }).query?.pages ?? {})[0];
      const ii = page?.imageinfo?.[0];
      cache[b.key].commons = { file, ...(ii?.thumburl ? { thumb: ii.thumburl.replace(/\?.*$/, '') } : {}), ...(ii?.extmetadata?.LicenseShortName ? { license: ii.extmetadata.LicenseShortName.value } : {}) };
    } catch (e) { console.error(`  commons ${file}: ${(e as Error).message}`); }
    await sleep(1000);
  }
}
writeCache('book-media.json', cache);

// ---------- регистр от экранизаций ----------
// Жанры Wikidata и темы Open Library дают регистр не всем книгам (235 из 428 на 11.10), а без него «подобрать словами»
// среди книг держится на одних словах темы. Тон книги и её экранизации обычно один: книге без своего регистра — регистр
// её экранизаций (Wikidata P144 → `adaptation_of`, tools/resolve-relations.mts), общий для них или единственный.
const filmRegs = new Map<string, Register[]>();
for (const w of worksIndex({ all: true })) {
  if (w.work.type === 'book') continue;
  const r = w.work.registers?.length ? w.work.registers : baseMedia[w.work.id]?.registers ?? workRegisters[w.work.id] ?? seriesRegisters[w.key];
  if (r?.length && !filmRegs.has(w.key)) filmRegs.set(w.key, r);
}
const adaptedRegs = (bookKey: string): Register[] => {
  const q = bookKey.startsWith('wd:') ? bookKey.slice(3) : undefined;
  if (!q) return [];
  const lists = relationEdges.filter(([, kind, b]) => kind === 'adaptation_of' && b === q)
    .map(([a]) => relationNodes[a]?.key).map((k) => (k ? filmRegs.get(k) : undefined)).filter((r): r is Register[] => Boolean(r?.length));
  if (!lists.length) return [];
  const count = new Map<Register, number>();
  for (const l of lists) for (const r of l) count.set(r, (count.get(r) ?? 0) + 1);
  // у одной экранизации — её регистр; у нескольких — то, что есть хотя бы у половины (не больше двух)
  return [...count].filter(([, n]) => n * 2 >= lists.length).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([r]) => r);
};
let fromAdaptations = 0;

// ---------- поля карточки ----------
const cyr = (s?: string) => Boolean(s && /[а-яё]/i.test(s));
const out: Record<string, Partial<WorkCard>> = {};
let covers = 0, fromCommons = 0, registers = 0, ruTitles = 0;
for (const b of books) {
  const r = cache[b.key];
  if (!r) continue;
  const title = [r.wd?.ru, r.ol?.ruTitle].find(cyr);
  const original = r.wd?.original ?? r.wd?.en;
  const cover = r.ol?.ruCover ?? r.ol?.cover;
  const commons = !cover && !b.work.coverUrl && r.commons?.thumb && FREE.test(r.commons.license ?? '') ? r.commons.thumb.replace(/\?.*$/, '') : undefined;  // без utm-хвоста Commons
  // жанры Wikidata и темы Open Library — `pickBook` (целым словом, жанры — в жанры словаря)
  let regs: Register[] = pickBook([...(r.wd?.genres ?? []), ...(r.ol?.subjects ?? [])]);
  if (!regs.length && !b.work.registers?.length) { regs = adaptedRegs(b.key); if (regs.length) fromAdaptations++; }
  const f: Partial<WorkCard> = {
    ...(title ? { title } : {}),
    ...(original && original !== title ? { originalTitle: original } : {}),
    ...(r.wd?.year ? { year: r.wd.year } : {}),
    ...(r.wd?.authors?.length ? { creators: r.wd.authors } : {}),
    ...(r.ol?.pages ? { pages: r.ol.pages } : {}),
    ...(cover ? { coverUrl: `${COVERS}/id/${cover}-L.jpg`, imageSource: 'open_library' as const } : {}),
    ...(commons ? { coverUrl: commons, imageSource: 'wikimedia_commons' as const } : {}),
    ...(regs.length ? { registers: regs } : {}),
  };
  if (Object.keys(f).length) out[b.key] = f;
  if (cover || commons) covers++;
  if (commons) fromCommons++;
  if (regs.length) registers++;
  if (title) ruTitles++;
}
console.error(`с метаданными: ${Object.keys(out).length} из ${books.length}; обложка — ${covers} (из Commons ${fromCommons}), русское название — ${ruTitles}, регистр — ${registers} (от экранизаций ${fromAdaptations})`);
if (DRY) process.exit(0);
const rows = Object.entries(out).sort(([a], [b]) => a.localeCompare(b)).map(([k, f]) => `  ${JSON.stringify(k)}: ${JSON.stringify(f)},`);
writeFileSync(new URL('../src/mocks/bookMedia.ts', import.meta.url), `// Сгенерировано tools/build-book-media.mts (З3) — руками не править.
// Ключ произведения (wd:/olw:/isbn:) → метаданные книги из Wikidata и Open Library: русское и
// оригинальное название, год, авторы, страницы, обложка (русского издания, если есть; иначе — из Commons), регистр.
import type { WorkCard } from '@/types/tmdf';

export const bookMedia: Record<string, Partial<WorkCard>> = {
${rows.join('\n')}
};
`);
console.error('→ src/mocks/bookMedia.ts');
