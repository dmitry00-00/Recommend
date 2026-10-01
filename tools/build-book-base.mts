// Стартовый каталог книг через мост с кино (З2): не «все книги», а те, к которым у наших людей
// уже есть дорога — через фильм.
//   npx tsx tools/build-book-base.mts [--fresh] [--dry] [--top N]
// Четыре источника:
//   1. экранизации (связи Ж1, src/mocks/workRelations.ts): книги, по которым сняты фильмы и сериалы
//      нашего справочника. Чем больше наших экранизаций у книги, тем выше;
//   2. кино-эссеисты: книги, названные в их постах и роликах рядом с книжным словом («по роману
//      «…»», «книга «…»» — tools/book-bridge.mts). Кэши: .cache/telegram, .cache/youtube (только
//      ярус «эссе»). Одного упоминания мало: берём названное в двух каналах или с автором, которого
//      подтвердила Open Library;
//   3. книжные каналы (З6, `medium: 'book'` в src/mocks/sources.ts — ролики всех ярусов и посты):
//      там книжного слова рядом с названием нет, зато есть автор («"Собачье сердце" Булгакова»,
//      tools/book-bridge.mts `loose`). Книгу ищем в Wikidata по названию и берём ту, у которой автор
//      (P50) — та же фамилия (`sameSurname`: «Булгакова» и «Bulgakov»); не нашлось — Open Library;
//   4. заложенные вселенные (.cache/seed-books.json — пишет tools/seed-westeros.mts): книги, без которых
//      у вселенной нет героев через несколько произведений («Песнь льда и огня», «Пламя и кровь»).
// Карточка: Wikidata (метки, год P577, автор P50, Open Library ID P648) и Open Library (обложка, автор,
// год первой публикации). Ключ — произведение (`wd:`/`olw:`, З1). Кэш — .cache/book-base.json.
// Итог — src/mocks/bookBase.ts; всё найденное, включая отсеянное, — .cache/book-candidates.tsv.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { worksIndex } from './works-index.mts';
import { bookMentions, sameSurname, titleKey } from './book-bridge.mts';
import { isBookHandle } from './book-channels.mts';
import { readCache, search, sleep, wd, writeCache } from './wikidata-lib.mts';
import { relationEdges, relationNodes } from '../src/mocks/workRelations.ts';
import type { WorkCard } from '../src/types/tmdf.ts';

const args = process.argv.slice(2);
const FRESH = args.includes('--fresh'), DRY = args.includes('--dry');
const TOP = Number(args[args.indexOf('--top') + 1]) || 300;
const UA = 'transformative-media/0.1 (book index; contact via repository README)';

// ---------- 1. экранизации ----------
const ours = new Map(worksIndex({ all: true }).map((w) => [w.key, w]));
const byBook = new Map<string, { q: string; adaptedBy: string[] }>();
for (const [a, kind, b] of relationEdges) {
  if (kind !== 'adaptation_of' || relationNodes[b]?.k !== 'book') continue;
  const key = relationNodes[a]?.key;
  if (!key || !ours.has(key)) continue;
  const e = byBook.get(b) ?? { q: b, adaptedBy: [] };
  if (!e.adaptedBy.includes(key)) e.adaptedBy.push(key);
  byBook.set(b, e);
}
const graph = [...byBook.values()].sort((x, y) => y.adaptedBy.length - x.adaptedBy.length || (relationNodes[x.q].y ?? 9999) - (relationNodes[y.q].y ?? 9999));
console.error(`книг по экранизациям: ${graph.length}`);

// ---------- 2. эссеисты ----------
type Said = { title: string; author?: string; channels: Set<string>; context: string; book?: boolean;
  /** все названные авторы (книжные каналы): «"Западня" Как…» и «"Западня" Эмиль Золя» — одна книга */
  authors?: Set<string> };
const said = new Map<string, Said>();
const note = (text: string, channel: string, book = false) => {
  for (const m of bookMentions(text, { loose: book })) {
    const k = titleKey(m.title);
    const e = said.get(k) ?? { title: m.title, channels: new Set<string>(), context: m.context };
    e.channels.add(channel);
    e.author ??= m.author;
    if (book) e.book = true;
    if (book && m.author) (e.authors ??= new Set()).add(m.author);
    said.set(k, e);
  }
};
const tg = new URL('../.cache/telegram/', import.meta.url);
if (existsSync(tg)) for (const f of readdirSync(tg).filter((x) => x.endsWith('.json'))) {
  const d = JSON.parse(readFileSync(new URL(f, tg), 'utf8')) as { username?: string; posts?: { text?: string }[] };
  for (const p of d.posts ?? []) note(p.text ?? '', `tg:${d.username}`, isBookHandle(d.username));
}
const chFile = new URL('../.cache/youtube/channels.json', import.meta.url);
const vFile = new URL('../.cache/youtube/videos.json', import.meta.url);
if (existsSync(chFile) && existsSync(vFile)) {
  const channels = JSON.parse(readFileSync(chFile, 'utf8')) as Record<string, { title: string; tier?: string; medium?: string }>;
  for (const v of JSON.parse(readFileSync(vFile, 'utf8')) as { channelId?: string; title: string; description?: string }[]) {
    const c = channels[v.channelId ?? ''];
    // книжный канал — любого яруса: ярус обзорщика про внимание к фильмам, а книги bookspace называет
    if (c?.medium === 'book') note(`${v.title}\n${v.description ?? ''}`, `yt:${c.title}`, true);
    else if (c?.tier === 'essay') note(`${v.title}\n${v.description ?? ''}`, `yt:${c.title}`);
  }
}
console.error(`книг, названных книжными каналами: ${[...said.values()].filter((s) => s.book).length}`);
console.error(`книг, названных эссеистами и книжными каналами: ${said.size} (в двух каналах и больше: ${[...said.values()].filter((s) => s.channels.size >= 2).length}, с автором: ${[...said.values()].filter((s) => s.author).length})`);

// ---------- 3. сведения ----------
type Info = { olw?: string; wd?: string; title?: string; en?: string; year?: number; authors?: string[]; cover?: number; miss?: true };
const cache: Record<string, Info> = FRESH ? {} : readCache('book-base.json', {});
const openLibrary = async (q: Record<string, string>): Promise<Info | undefined> => {
  const qs = new URLSearchParams({ ...q, fields: 'key,title,author_name,first_publish_year,cover_i', limit: '1' });
  const r = await fetch(`https://openlibrary.org/search.json?${qs}`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`open library ${r.status}`);
  const d = (await r.json() as { docs?: { key?: string; title?: string; author_name?: string[]; first_publish_year?: number; cover_i?: number }[] }).docs?.[0];
  if (!d?.key) return undefined;
  return { olw: d.key.split('/').pop(), title: d.title, ...(d.author_name ? { authors: d.author_name } : {}),
    ...(d.first_publish_year ? { year: d.first_publish_year } : {}), ...(d.cover_i ? { cover: d.cover_i } : {}) };
};
type Claim = { mainsnak: { datavalue?: { value: unknown } } };
type Ent = { labels?: Record<string, { value: string }>; claims?: Record<string, Claim[]> };
/** Сведения о книге из Wikidata (метки, год, автор, Open Library ID) и обложка из Open Library. */
async function wdInfo(q: string, fallbackTitle: string, e?: Ent): Promise<Info> {
  e ??= (await wd<{ entities?: Record<string, Ent> }>({ action: 'wbgetentities', ids: q, props: 'labels|claims', languages: 'ru|en' })).entities?.[q];
  const val = (p: string) => e?.claims?.[p]?.map((c) => c.mainsnak.datavalue?.value).filter(Boolean) ?? [];
  const authorIds = val('P50').map((v) => (v as { id: string }).id).slice(0, 3);
  const names = authorIds.length ? (await wd<{ entities?: Record<string, Ent> }>({ action: 'wbgetentities', ids: authorIds.join('|'), props: 'labels', languages: 'ru|en' })).entities ?? {} : {};
  const years = val('P577').map((v) => Number((v as { time: string }).time.slice(1, 5))).filter((y) => y > 0);
  const olid = val('P648').map(String).find((x) => /^OL\d+W$/.test(x));
  const info: Info = { wd: q, title: e?.labels?.ru?.value ?? e?.labels?.en?.value, en: e?.labels?.en?.value,
    ...(years.length ? { year: Math.min(...years) } : {}),
    authors: authorIds.map((id) => names[id]?.labels?.ru?.value ?? names[id]?.labels?.en?.value).filter((x): x is string => Boolean(x)),
    ...(olid ? { olw: olid } : {}) };
  // обложка — у Open Library: по английскому названию и автору
  const ol = await openLibrary({ title: info.en ?? info.title ?? fallbackTitle, ...(names[authorIds[0]]?.labels?.en ? { author: names[authorIds[0]].labels!.en.value } : {}) }).catch(() => undefined);
  if (ol) { info.olw ??= ol.olw; if (ol.cover) info.cover = ol.cover; info.year ??= ol.year; }
  return info;
}

/** Книга из книжного канала — в Wikidata: поиск по названию (ru), из найденного — та, у которой
 *  автор (P50) носит названную фамилию. Нет такой — undefined (дальше Open Library). */
async function wdFind(title: string, authors: string[]): Promise<Info | undefined> {
  const hits = (await wd<{ search?: { id: string }[] }>({ action: 'wbsearchentities', search: title, language: 'ru', uselang: 'ru', type: 'item', limit: '7' })).search ?? [];
  if (!hits.length) return undefined;
  const ents = (await wd<{ entities?: Record<string, Ent> }>({ action: 'wbgetentities', ids: hits.map((h) => h.id).join('|'), props: 'labels|claims', languages: 'ru|en' })).entities ?? {};
  const authorOf = (e?: Ent) => e?.claims?.P50?.map((c) => (c.mainsnak.datavalue?.value as { id?: string } | undefined)?.id).filter((x): x is string => Boolean(x)) ?? [];
  const ids = [...new Set(hits.flatMap((h) => authorOf(ents[h.id]).slice(0, 3)))];
  if (!ids.length) return undefined;
  const people = (await wd<{ entities?: Record<string, Ent> }>({ action: 'wbgetentities', ids: ids.slice(0, 50).join('|'), props: 'labels', languages: 'ru|en' })).entities ?? {};
  const hit = hits.find((h) => authorOf(ents[h.id]).some((a) => [people[a]?.labels?.ru?.value, people[a]?.labels?.en?.value]
    .some((n) => n && authors.some((x) => sameSurname(x, n)))));
  return hit ? wdInfo(hit.id, title, ents[hit.id]) : undefined;
}

let asked = 0;
for (const g of graph.slice(0, TOP)) {
  if (cache[`wd:${g.q}`]) continue;
  try {
    cache[`wd:${g.q}`] = await wdInfo(g.q, relationNodes[g.q].t);
  } catch (e) { console.error(`  ${relationNodes[g.q].t}: ${(e as Error).message}`); continue; }
  if (++asked % 20 === 0) writeCache('book-base.json', cache);
  await sleep(300);
}
// заложенные вселенные: элементы уже известны — только сведения
const seeded = readCache<{ q: string; why: string }[]>('seed-books.json', []);
for (const { q } of seeded) {
  if (cache[`wd:${q}`]) continue;
  try { cache[`wd:${q}`] = await wdInfo(q, q); } catch (e) { console.error(`  ${q}: ${(e as Error).message}`); continue; }
  if (++asked % 20 === 0) writeCache('book-base.json', cache);
  await sleep(300);
}
for (const [k, s] of said) {
  if (cache[`said:${k}`]) continue;
  if (s.channels.size < 2 && !s.author) { cache[`said:${k}`] = { miss: true }; continue; }
  try {
    // книжный канал с автором — сначала Wikidata: там русские названия и автор проверяется
    const found = s.book && s.authors?.size ? await wdFind(s.title, [...s.authors].slice(0, 5)) : undefined;
    if (found) { cache[`said:${k}`] = found; if (++asked % 20 === 0) writeCache('book-base.json', cache); await sleep(300); continue; }
    const ol = await openLibrary({ title: s.title, ...(s.author ? { author: s.author } : {}) });
    if (!ol) { cache[`said:${k}`] = { miss: true }; continue; }
    ol.wd = (ol.olw ? await search(`P648=${ol.olw}`) : null) ?? undefined;
    cache[`said:${k}`] = ol;
  } catch (e) { console.error(`  ${s.title}: ${(e as Error).message}`); continue; }
  if (++asked % 20 === 0) writeCache('book-base.json', cache);
  await sleep(300);
}
writeCache('book-base.json', cache);

// ---------- 4. карточки ----------
const card = (info: Info, why: string): WorkCard | undefined => {
  if (!info.title || (!info.wd && !info.olw)) return undefined;
  return {
    id: info.wd ? `b-wd${info.wd.slice(1)}` : `b-${info.olw}`, type: 'book', title: info.title,
    ...(info.en && info.en !== info.title ? { originalTitle: info.en } : {}),
    year: info.year ?? 0, creators: info.authors ?? [],
    ...(info.cover ? { coverUrl: `https://covers.openlibrary.org/b/id/${info.cover}-L.jpg`, imageSource: 'open_library' as const } : {}),
    blurb: why,
    primaryOperations: [], complexityLevel: 0, warnings: [], barriers: [], isNicheMasterpiece: false,
    externalIds: { ...(info.wd ? { wikidata: info.wd } : {}), ...(info.olw ? { openLibrary: info.olw } : {}) },
  };
};
const cards = new Map<string, WorkCard>();
const rows = ['источник\tназвание\tавтор\tгод\tключ\tпочему\tв каталог'];
for (const g of graph.slice(0, TOP)) {
  const info = cache[`wd:${g.q}`];
  const titles = g.adaptedBy.map((k) => ours.get(k)!.work.title);
  const c = info && card(info, `Экранизации у нас: ${titles.slice(0, 3).join(', ')}${titles.length > 3 ? ` и ещё ${titles.length - 3}` : ''}`);
  if (c && !cards.has(c.id)) cards.set(c.id, c);
  rows.push(['экранизация', relationNodes[g.q].t, info?.authors?.join(', ') ?? '', info?.year ?? '', `wd:${g.q}`, titles.join('; '), c ? 'да' : 'нет'].join('\t'));
}
for (const { q, why } of seeded) {
  const info = cache[`wd:${q}`];
  const c = info && card(info, `Заложенная вселенная: ${why}`);
  if (c && !cards.has(c.id)) cards.set(c.id, c);
  rows.push(['заложенная вселенная', info?.title ?? q, info?.authors?.join(', ') ?? '', info?.year ?? '', `wd:${q}`, why, c ? 'да' : 'нет'].join('\t'));
}
for (const [k, s] of said) {
  const info = cache[`said:${k}`];
  // автор из текста должен сойтись с автором Open Library — иначе это тёзка
  const named = s.authors?.size ? [...s.authors] : s.author ? [s.author] : [];
  const authorOk = !named.length || !info?.authors?.length || info.authors.some((a) => named.some((x) => sameSurname(x, a)));
  const c = info && !info.miss && authorOk && (s.channels.size >= 2 || s.author) ? card(info, `${s.book ? 'Называют книжные каналы' : 'Называют эссеисты'}: ${[...s.channels].slice(0, 3).map((x) => x.slice(3)).join(', ')}`) : undefined;
  if (c && !cards.has(c.id)) cards.set(c.id, c);
  rows.push([s.book ? 'книжные каналы' : 'эссеисты', s.title, s.author ?? info?.authors?.join(', ') ?? '', info?.year ?? '', info?.wd ? `wd:${info.wd}` : info?.olw ? `olw:${info.olw}` : '', `${s.channels.size} кан.: ${s.context.slice(0, 80)}`, c ? 'да' : 'нет'].join('\t'));
}
writeFileSync(new URL('../.cache/book-candidates.tsv', import.meta.url), rows.join('\n') + '\n');
// уже есть в справочнике под тем же ключом — не дублируем
const have = new Set([...ours.keys()]);
const fresh = [...cards.values()].filter((c) => !have.has(c.externalIds?.wikidata ? `wd:${c.externalIds.wikidata}` : `olw:${c.externalIds?.openLibrary}`));
console.error(`\nкарточек книг: ${fresh.length} (по экранизациям ${fresh.filter((c) => c.blurb?.startsWith('Экранизации')).length}, от эссеистов ${fresh.filter((c) => c.blurb?.startsWith('Называют эссеисты')).length}, от книжных каналов ${fresh.filter((c) => c.blurb?.startsWith('Называют книжные')).length}, из заложенных вселенных ${fresh.filter((c) => c.blurb?.startsWith('Заложенная')).length}); все кандидаты — .cache/book-candidates.tsv`);
if (DRY) process.exit(0);
writeFileSync(new URL('../src/mocks/bookBase.ts', import.meta.url), `// Сгенерировано tools/build-book-base.mts (З2) — руками не править.
// Стартовый каталог книг через мост с кино: книги по фильмам и сериалам справочника и книги,
// которые называют кино-эссеисты и книжные каналы (З6). Разметки нет — в подбор не идут до З4.
import type { WorkCard } from '@/types/tmdf';

export const bookBase: WorkCard[] = ${JSON.stringify(fresh, null, 2)};
`);
console.error('→ src/mocks/bookBase.ts');
