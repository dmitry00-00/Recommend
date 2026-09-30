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
// Описания Open Library не берём: их часто копируют с обложек издателей — лицензия неясна.
// Кэш — .cache/book-media.json; итог — src/mocks/bookMedia.ts (ключ произведения → поля карточки).
import { writeFileSync } from 'node:fs';
import { worksIndex, idsOf } from './works-index.mts';
import { pick } from './register-tags.mts';
import { readCache, sleep, wd, writeCache } from './wikidata-lib.mts';
import { isBookKey } from '../src/lib/keys.ts';
import type { Register, WorkCard } from '../src/types/tmdf.ts';

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
};
const cache: Record<string, Raw> = FRESH ? {} : readCache('book-media.json', {});

const books = worksIndex({ all: true }).filter((w) => w.work.type === 'book' || isBookKey(w.key));
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

// ---------- поля карточки ----------
const cyr = (s?: string) => Boolean(s && /[а-яё]/i.test(s));
const out: Record<string, Partial<WorkCard>> = {};
let covers = 0, registers = 0, ruTitles = 0;
for (const b of books) {
  const r = cache[b.key];
  if (!r) continue;
  const title = [r.wd?.ru, r.ol?.ruTitle].find(cyr);
  const original = r.wd?.original ?? r.wd?.en;
  const cover = r.ol?.ruCover ?? r.ol?.cover;
  const regs: Register[] = pick([], [...(r.wd?.genres ?? []), ...(r.ol?.subjects ?? [])]);
  const f: Partial<WorkCard> = {
    ...(title ? { title } : {}),
    ...(original && original !== title ? { originalTitle: original } : {}),
    ...(r.wd?.year ? { year: r.wd.year } : {}),
    ...(r.wd?.authors?.length ? { creators: r.wd.authors } : {}),
    ...(r.ol?.pages ? { pages: r.ol.pages } : {}),
    ...(cover ? { coverUrl: `${COVERS}/id/${cover}-L.jpg`, imageSource: 'open_library' as const } : {}),
    ...(regs.length ? { registers: regs } : {}),
  };
  if (Object.keys(f).length) out[b.key] = f;
  if (cover) covers++;
  if (regs.length) registers++;
  if (title) ruTitles++;
}
console.error(`с метаданными: ${Object.keys(out).length} из ${books.length}; обложка — ${covers}, русское название — ${ruTitles}, регистр — ${registers}`);
if (DRY) process.exit(0);
const rows = Object.entries(out).sort(([a], [b]) => a.localeCompare(b)).map(([k, f]) => `  ${JSON.stringify(k)}: ${JSON.stringify(f)},`);
writeFileSync(new URL('../src/mocks/bookMedia.ts', import.meta.url), `// Сгенерировано tools/build-book-media.mts (З3) — руками не править.
// Ключ произведения (wd:/olw:/isbn:) → метаданные книги из Wikidata и Open Library: русское и
// оригинальное название, год, авторы, страницы, обложка (русского издания, если есть), регистр.
import type { WorkCard } from '@/types/tmdf';

export const bookMedia: Record<string, Partial<WorkCard>> = {
${rows.join('\n')}
};
`);
console.error('→ src/mocks/bookMedia.ts');
