// Заложенные герои Вестероса (к Ж3 и И1): персонажи «Песни льда и огня» из An API of Ice and Fire
// (anapioficeandfire.com — открытый, без ключа) — с книгами, где они есть, и сезонами «Игры престолов».
//   npx tsx tools/seed-westeros.mts [--fresh]
// Wikidata знает в основном главных героев и не всегда — в каких книгах они есть; API знает всех
// (больше двух тысяч) и по книгам. Что делаем:
//   1. книги API (и «Пламя и кровь» — по ней «Дом Дракона», в API её нет) → элемент Wikidata произведения:
//      поиск по английскому названию, автор — Мартин. Они уходят в каталог книг (tools/build-book-base.mts
//      читает .cache/seed-books.json), чтобы у героев было больше одного нашего произведения;
//   2. персонажи API — все страницы; с именем, книгами (books + povBooks) и сезонами сериала;
//   3. тем, у кого два и больше «произведений» (книги с элементом + сериал), — элемент Wikidata и русское
//      имя: поиск по английскому имени, из тёзок — с описанием про Вестерос.
// Итог — .cache/westeros-seed.json; героев из него берёт tools/resolve-characters.mts (И1) — вместе с
// героями Wikidata, с тем же правилом «назван в разборах». Повторный прогон спрашивает только новое.
import { readCache, sleep, wd, writeCache } from './wikidata-lib.mts';
import { sameSurname } from './book-bridge.mts';
import { appearances, EXTRA_BOOKS, NOT_STORY, westerosDescription, type SeedBook, type SeedCharacter, type WesterosSeed } from './westeros-lib.mts';

const FRESH = process.argv.includes('--fresh');
const API = 'https://anapioficeandfire.com/api';
const UA = 'transformative-media/0.1 (westeros seed; contact via repository README)';
const get = async <T,>(url: string): Promise<T> => {
  for (let attempt = 0; ; attempt++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA, accept: 'application/json' }, signal: AbortSignal.timeout(30000) });
      if (r.ok) return await r.json() as T;
      if (attempt >= 3 || (r.status !== 429 && r.status < 500)) throw new Error(`${r.status} ${url}`);
    } catch (e) { if (attempt >= 3) throw e; }
    await sleep(2000 * 2 ** attempt);
  }
};

const old: WesterosSeed | null = FRESH ? null : readCache<WesterosSeed | null>('westeros-seed.json', null);

// ---------- 1. книги ----------
type ApiBook = { url: string; name: string; released?: string; authors?: string[] };
const apiBooks = await get<ApiBook[]>(`${API}/books?pageSize=50`);
type Ent = { labels?: Record<string, { value: string }>; descriptions?: Record<string, { value: string }>; aliases?: Record<string, { value: string }[]>; claims?: Record<string, { mainsnak: { datavalue?: { value: unknown } } }[]> };
const ents = async (ids: string[], props: string) =>
  (await wd<{ entities?: Record<string, Ent> }>({ action: 'wbgetentities', ids: ids.join('|'), props, languages: 'ru|en' })).entities ?? {};

/** Произведение Мартина по английскому названию: из найденного — то, у кого автор (P50) — Мартин. */
async function bookQ(name: string): Promise<{ q: string; ru?: string } | undefined> {
  const hits = (await wd<{ search?: { id: string }[] }>({ action: 'wbsearchentities', search: name, language: 'en', type: 'item', limit: '7' })).search ?? [];
  if (!hits.length) return undefined;
  const e = await ents(hits.map((h) => h.id), 'labels|claims');
  const authors = [...new Set(hits.flatMap((h) => e[h.id]?.claims?.P50?.map((c) => (c.mainsnak.datavalue?.value as { id?: string })?.id).filter((x): x is string => Boolean(x)) ?? []))];
  const people = authors.length ? await ents(authors.slice(0, 50), 'labels') : {};
  const hit = hits.find((h) => (e[h.id]?.claims?.P50 ?? []).some((c) => {
    const a = (c.mainsnak.datavalue?.value as { id?: string })?.id;
    return a && [people[a]?.labels?.en?.value, people[a]?.labels?.ru?.value].some((n) => n && sameSurname('Martin', n));
  }));
  return hit ? { q: hit.id, ...(e[hit.id]?.labels?.ru ? { ru: e[hit.id].labels!.ru.value } : {}) } : undefined;
}
const books: SeedBook[] = [];
for (const b of [...apiBooks, ...EXTRA_BOOKS.map((name) => ({ url: `extra:${name}`, name }))]) {
  const known = old?.books.find((x) => x.url === b.url && x.q);
  if (known) { books.push(known); continue; }
  try {
    const f = await bookQ(b.name);
    books.push({ url: b.url, name: b.name, ...('released' in b && b.released ? { released: b.released.slice(0, 10) } : {}), ...(f ?? {}) });
  } catch (e) { console.error(`  книга ${b.name}: ${(e as Error).message}`); books.push({ url: b.url, name: b.name }); }
  await sleep(200);
}
console.error(`книг: ${books.length}, с элементом Wikidata: ${books.filter((b) => b.q).length}`);
for (const b of books) console.error(`  ${b.name} → ${b.q ?? '—'}${b.ru ? ` «${b.ru}»` : ''}`);
// в каталог книг (tools/build-book-base.mts, источник «заложенные вселенные»)
const seedBooks = readCache<{ q: string; why: string }[]>('seed-books.json', []).filter((x) => x.why !== 'Песнь льда и огня');
writeCache('seed-books.json', [...seedBooks, ...books.filter((b) => b.q && !NOT_STORY.has(b.name)).map((b) => ({ q: b.q!, why: 'Песнь льда и огня' }))]);

// ---------- 2. персонажи ----------
type ApiChar = { url: string; name: string; aliases?: string[]; books?: string[]; povBooks?: string[]; tvSeries?: string[] };
const chars: ApiChar[] = [];
for (let page = 1; page < 200; page++) {
  const list = await get<ApiChar[]>(`${API}/characters?page=${page}&pageSize=50`);
  if (!list.length) break;
  chars.push(...list);
  await sleep(150);
}
const bookQByUrl = new Map(books.filter((b) => b.q && !NOT_STORY.has(b.name)).map((b) => [b.url, b.q!]));
const prev = new Map((old?.characters ?? []).map((c) => [c.id, c]));
const characters: SeedCharacter[] = chars.filter((c) => c.name).map((c) => ({
  id: `aoiaf-${c.url.split('/').pop()}`, name: c.name,
  ...(c.aliases?.filter(Boolean).length ? { aliases: c.aliases.filter(Boolean) } : {}),
  books: [...new Set([...(c.books ?? []), ...(c.povBooks ?? [])])],
  tv: (c.tvSeries ?? []).filter(Boolean).length,
}));
console.error(`персонажей: ${characters.length}; в двух и больше «произведениях»: ${characters.filter((c) => appearances(c, bookQByUrl) >= 2).length}`);

// ---------- 3. элемент и русское имя ----------
let asked = 0, found = 0;
for (const c of characters) {
  const p = prev.get(c.id);
  if (p && p.q !== undefined) { Object.assign(c, { ...(p.q ? { q: p.q } : {}), ...(p.ru ? { ru: p.ru } : {}), ...(p.ruAka ? { ruAka: p.ruAka } : {}) }); if (p.q) found++; continue; }
  if (appearances(c, bookQByUrl) < 2) continue;
  try {
    const hits = (await wd<{ search?: { id: string }[] }>({ action: 'wbsearchentities', search: c.name, language: 'en', type: 'item', limit: '5' })).search ?? [];
    const e = hits.length ? await ents(hits.map((h) => h.id), 'labels|descriptions|aliases') : {};
    const hit = hits.find((h) => westerosDescription(e[h.id]?.descriptions?.en?.value) || westerosDescription(e[h.id]?.descriptions?.ru?.value));
    // «искали» помечаем и при промахе (q: undefined в записи) — второй прогон не спрашивает
    c.q = hit?.id ?? null;
    if (hit) {
      found++;
      const ent = e[hit.id];
      if (ent?.labels?.ru) c.ru = ent.labels.ru.value;
      const aka = (ent?.aliases?.ru ?? []).map((a) => a.value).filter((a) => a !== c.ru);
      if (aka.length) c.ruAka = aka.slice(0, 6);
    }
  } catch (e) { console.error(`  ${c.name}: ${(e as Error).message}`); continue; }
  if (++asked % 50 === 0) { console.error(`  имена: ${asked}`); writeCache('westeros-seed.json', { at: new Date().toISOString(), books, characters }); }
  await sleep(150);
}
writeCache('westeros-seed.json', { at: new Date().toISOString(), books, characters } satisfies WesterosSeed);
console.error(`с элементом Wikidata: ${found}, из них с русским именем: ${characters.filter((c) => c.ru).length} → .cache/westeros-seed.json`);
