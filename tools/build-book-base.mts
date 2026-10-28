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
//      у вселенной нет героев через несколько произведений («Песнь льда и огня», «Пламя и кровь»);
//   5. списки прочитанного читателей (11.10, .cache/book-lists/*.json: `{ why, books: [{ title, author }] }`) — тир-лист
//      автора канала, присланный список: без этих книг профиль читателя почти пуст (у «Ламполоджи» в справочнике было 13
//      из 245). Только название и автор — оценки остаются в seeds/. Поиск — как у книжных каналов: Wikidata по названию
//      с той же фамилией автора, иначе Open Library с проверкой автора;
//   6. что ищут (11.10, .cache/book-popular.json — пишет tools/grow-book-base.mts): книги из месячных топов русской
//      Википедии и канон (статьи во многих разделах) — «1984», «Ведьмак», «Горе от ума». Элемент Wikidata уже известен —
//      поиска по названию нет.
// Карточка: Wikidata (метки, год P577, автор P50, Open Library ID P648) и Open Library (обложка, автор,
// год первой публикации). Ключ — произведение (`wd:`/`olw:`, З1). Кэш — .cache/book-base.json.
// Итог — src/mocks/bookBase.ts; всё найденное, включая отсеянное, — .cache/book-candidates.tsv.
// 17.10 (волна В): книги «что ищут» больше не отбрасываются по `had` из book-popular — `had` считался по справочнику
// вместе с самим bookBase, и пересборка РР-2 выкинула 62 книги, что были в нём только через источник 6 («had» = «уже
// есть» = «у себя же»). Повторы и так снимает `have` в конце. Сведения, что не пришли (сбой сети, 429 подряд — так не
// заведены «Хаджи-Мурат», «Бегущий в лабиринте», «Тень над Иннсмутом»), спрашиваются ещё двумя кругами с паузой; у
// книги, что уже есть в прежнем bookBase, сведения берутся из её карточки — без сети. «Уже есть» — по справочнику без
// истории владельца и демо-каталога (tools/base-have.mts): «Мастер и Маргарита» и «Солярис» были только в моках.
// 27.10 (решение владельца): свои книги — tools/own-books.mts, современная русская проза, которой нет ни в Wikidata,
// ни в Open Library («Саспыга», «Квартирай»): карточка из списка без сети, ключ `own:` (src/lib/keys.ts), описание —
// своим пересказом в `blurb` (в «Сюжете» без ссылки на источник: текст наш). Появится элемент Wikidata — перевести
// строку в список читателей с `qid`, а разметку перенести на новый ключ.
//   --popular FILE — свой список «что ищут» (замер grow-book-base --out); --dry — без записи bookBase.ts, новые
//   карточки — в .cache/book-base.dry.json
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { worksIndex } from './works-index.mts';
import { baseHave } from './base-have.mts';
import { bookMentions, sameSurname, titleKey } from './book-bridge.mts';
import { isBookHandle } from './book-channels.mts';
import { OWN_BOOKS } from './own-books.mts';
import { readCache, search, sleep, wd, writeCache } from './wikidata-lib.mts';
import { relationEdges, relationNodes } from '../src/mocks/workRelations.ts';
import type { WorkCard } from '../src/types/tmdf.ts';
import { withheldWorks } from '../src/mocks/withheldWorks.ts';
import { bookBase as prevBookBase } from '../src/mocks/bookBase.ts';

const args = process.argv.slice(2);
const FRESH = args.includes('--fresh'), DRY = args.includes('--dry');
// --cached-said (11.10): названия из каналов — только уже опознанные; новых не спрашивать. Опознание идёт часами
// (до шести запросов на название, паузы при отказах), а книги из топов Википедии и списков читателей, стоящие после
// него, ждали бы до конца. Полный прогон без ключа — потом
const CACHED_SAID = args.includes('--cached-said');
const TOP = Number(args[args.indexOf('--top') + 1]) || 300;
const POPULAR = args.includes('--popular') ? args[args.indexOf('--popular') + 1] : undefined;
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
// год из даты Wikidata (24.10, правки карточек): знак «до н. э.» не теряем (−0600 → −600, а не 600); вещам до 1500 года —
// год 0, как в слое правок (BOOK_YEAR_ZERO_2410): точной даты у них нет, а год перевода из Open Library хуже нуля
const DATE_PROPS = ['P577', 'P571', 'P1191'];
const wdYear = (time: string): number => Number(/^([+-]?\d+)-/.exec(time)?.[1] ?? NaN);
const bookYear = (ys: number[]): number | undefined => {
  const y = ys.filter((x) => Number.isFinite(x) && x !== 0);
  return y.length ? (Math.min(...y) < 1500 ? 0 : Math.min(...y)) : undefined;
};
type Ent = { labels?: Record<string, { value: string }>; claims?: Record<string, Claim[]> };
/** Сведения о книге из Wikidata (метки, год, автор, Open Library ID) и обложка из Open Library. */
async function wdInfo(q: string, fallbackTitle: string, e?: Ent): Promise<Info> {
  e ??= (await wd<{ entities?: Record<string, Ent> }>({ action: 'wbgetentities', ids: q, props: 'labels|claims', languages: 'ru|en' })).entities?.[q];
  const val = (p: string) => e?.claims?.[p]?.map((c) => c.mainsnak.datavalue?.value).filter(Boolean) ?? [];
  const authorIds = val('P50').map((v) => (v as { id: string }).id).slice(0, 3);
  const names = authorIds.length ? (await wd<{ entities?: Record<string, Ent> }>({ action: 'wbgetentities', ids: authorIds.join('|'), props: 'labels', languages: 'ru|en' })).entities ?? {} : {};
  const year = bookYear(DATE_PROPS.flatMap((p) => val(p)).map((v) => wdYear((v as { time: string }).time)));
  const olid = val('P648').map(String).find((x) => /^OL\d+W$/.test(x));
  const info: Info = { wd: q, title: e?.labels?.ru?.value ?? e?.labels?.en?.value, en: e?.labels?.en?.value,
    ...(year !== undefined ? { year } : {}),
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
/** не пришедшие сведения — ещё два круга в конце (17.10): прежде сбой оставлял книгу без карточки до следующей пересборки */
const failed: { key: string; what: string; run: () => Promise<Info> }[] = [];
const fail = (key: string, what: string, run: () => Promise<Info>, e: unknown) => { console.error(`  ${what}: ${(e as Error).message}`); failed.push({ key, what, run }); };
for (const g of graph.slice(0, TOP)) {
  if (cache[`wd:${g.q}`]) continue;
  try {
    cache[`wd:${g.q}`] = await wdInfo(g.q, relationNodes[g.q].t);
  } catch (e) { fail(`wd:${g.q}`, relationNodes[g.q].t, () => wdInfo(g.q, relationNodes[g.q].t), e); continue; }
  if (++asked % 20 === 0) writeCache('book-base.json', cache);
  await sleep(300);
}
// заложенные вселенные: элементы уже известны — только сведения
const seeded = readCache<{ q: string; why: string }[]>('seed-books.json', []);
for (const { q } of seeded) {
  if (cache[`wd:${q}`]) continue;
  try { cache[`wd:${q}`] = await wdInfo(q, q); } catch (e) { fail(`wd:${q}`, q, () => wdInfo(q, q), e); continue; }
  if (++asked % 20 === 0) writeCache('book-base.json', cache);
  await sleep(300);
}
// Пачками (11.10): опознание по одному названию — до шести запросов с паузами, ~200 в час, а каналы называют ~6900
// книг. SPARQL на 150 названий разом: произведение, у которого русская метка или синоним совпадает с названием (как
// написано и с заглавной), есть автор с той же фамилией, и это не отдельное издание; из нескольких — с бо́льшим числом
// статей. На 300 уже опознанных старым путём: найдено 203, та же книга — 201 (другая — цикл вместо романа). Не нашлось
// пачкой — старый путь (поиск Wikidata с проверкой автора, затем Open Library) только у названных двумя каналами и
// больше: у остальных он почти ничего не давал (Open Library — 4 книги из 1535).
const sparqlRows = async (query: string): Promise<Record<string, { value: string } | undefined>[]> => {
  for (let a = 0; a < 4; a++) {
    const r = await fetch('https://query.wikidata.org/sparql', { method: 'POST', body: new URLSearchParams({ query }),
      headers: { 'User-Agent': UA, Accept: 'application/sparql-results+json' }, signal: AbortSignal.timeout(90000) }).catch(() => undefined);
    if (r?.ok) { const j = await r.json().catch(() => undefined) as { results: { bindings: Record<string, { value: string }>[] } } | undefined; if (j) return j.results.bindings; }
    await sleep(3000 * (a + 1));
  }
  throw new Error('wikidata sparql: нет ответа');
};
const lit = (t: string) => `"${t.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"@ru`;
const qidOf = (u?: { value: string }) => u?.value.split('/').pop();
const namedAuthors = (s: Said) => [...(s.authors ?? []), ...(s.author ? [s.author] : [])];
if (!CACHED_SAID) {
  const pending = [...said].filter(([k, s]) => !cache[`said:${k}`] && (s.channels.size >= 2 || s.author) && namedAuthors(s).length);
  console.error(`названий из каналов к опознанию: ${pending.length} — пачками по 150`);
  let batchFound = 0;
  for (let i = 0; i < pending.length; i += 150) {
    const part = pending.slice(i, i + 150);
    const variants = (raw: string) => { const t = raw.replace(/\s+/g, " ").trim(); return t ? [...new Set([t, t[0].toUpperCase() + t.slice(1)])] : []; };
    let rows: Record<string, { value: string } | undefined>[];
    try {
      rows = await sparqlRows(`SELECT ?t ?f ?links ?au ?auRu ?auEn WHERE {
        VALUES ?t { ${part.flatMap(([, s]) => variants(s.title)).map(lit).join(' ')} }
        { ?f rdfs:label ?t } UNION { ?f skos:altLabel ?t }
        ?f wdt:P50 ?au ; wikibase:sitelinks ?links . FILTER NOT EXISTS { ?f wdt:P31 wd:Q3331189 }
        OPTIONAL { ?au rdfs:label ?auRu FILTER(lang(?auRu) = 'ru') } OPTIONAL { ?au rdfs:label ?auEn FILTER(lang(?auEn) = 'en') } }`);
    } catch (e) { console.error(`  пачка ${i / 150}: ${(e as Error).message}`); continue; }
    const picked = new Map<string, string>();
    for (const [k, s] of part) {
      const names = namedAuthors(s);
      const cand = rows.filter((b) => titleKey(b.t!.value) === k && names.some((a) => [b.auRu?.value, b.auEn?.value].some((n) => n && sameSurname(a, n))));
      const best = cand.sort((a, b) => Number(b.links!.value) - Number(a.links!.value))[0];
      if (best) picked.set(k, qidOf(best.f)!);
    }
    // сведения о найденных — вторым запросом: метки, год, Open Library, авторы
    const qs = [...new Set(picked.values())];
    const info = new Map<string, Info>();
    if (qs.length) {
      const det = await sparqlRows(`SELECT ?f ?ru ?en ?date ?olid ?au ?auRu ?auEn WHERE { VALUES ?f { ${qs.map((q) => `wd:${q}`).join(' ')} }
        OPTIONAL { ?f rdfs:label ?ru FILTER(lang(?ru) = 'ru') } OPTIONAL { ?f rdfs:label ?en FILTER(lang(?en) = 'en') }
        OPTIONAL { VALUES ?dp { wdt:P577 wdt:P571 wdt:P1191 } ?f ?dp ?date } OPTIONAL { ?f wdt:P648 ?olid }
        OPTIONAL { ?f wdt:P50 ?au . OPTIONAL { ?au rdfs:label ?auRu FILTER(lang(?auRu) = 'ru') } OPTIONAL { ?au rdfs:label ?auEn FILTER(lang(?auEn) = 'en') } } }`).catch(() => []);
      for (const b of det) {
        const q = qidOf(b.f)!;
        const x = info.get(q) ?? { wd: q, authors: [] };
        x.title ??= b.ru?.value ?? b.en?.value; x.en ??= b.en?.value;
        const y = b.date ? bookYear([wdYear(b.date.value), ...(x.year ? [x.year] : [])]) : undefined;
        if (y !== undefined && (x.year === undefined || x.year !== 0)) x.year = y;
        if (b.olid && /^OL\d+W$/.test(b.olid.value)) x.olw ??= b.olid.value;
        const name = b.auRu?.value ?? b.auEn?.value;
        if (name && !x.authors!.includes(name) && x.authors!.length < 3) x.authors!.push(name);
        info.set(q, x);
      }
    }
    for (const [k, s] of part) {
      const q = picked.get(k);
      if (q && info.get(q)?.title) { cache[`said:${k}`] = info.get(q)!; batchFound++; }
      else if (s.channels.size < 2) cache[`said:${k}`] = { miss: true };
    }
    writeCache('book-base.json', cache);
    console.error(`  ${Math.min(i + 150, pending.length)} из ${pending.length}: найдено ${batchFound}`);
    await sleep(1000);
  }
}
for (const [k, s] of said) {
  if (cache[`said:${k}`] || CACHED_SAID) continue;
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
// списки читателей
// 24.10: у строки списка может быть готовый элемент Wikidata (`qid`) — список отобран и проверен заранее (произведение, не
// издание; автор, год): тогда поиска по названию нет, сведения — как у «что ищут», под ключом `wd:` (так строка списка и
// книга из топов Википедии — одна запись кэша). Так заведено пополнение книжного каталога для читателей книжных каналов
// (.cache/book-lists/reader-gaps-2410.json)
type ListBook = { title: string; author?: string; qid?: string; why: string };
const listDir = new URL('../.cache/book-lists/', import.meta.url);
const listed: ListBook[] = existsSync(listDir) ? readdirSync(listDir).filter((f) => f.endsWith('.json')).flatMap((f) => {
  const d = JSON.parse(readFileSync(new URL(f, listDir), 'utf8')) as { why?: string; books?: { title: string; author?: string; qid?: string }[] };
  return (d.books ?? []).filter((b) => b.title).map((b) => ({ ...b, why: d.why ?? f }));
}) : [];
const listKey = (b: ListBook) => (b.qid ? `wd:${b.qid}` : `list:${titleKey(b.title)}|${(b.author ?? '').toLowerCase()}`);
console.error(`книг из списков читателей: ${listed.length} (с готовым элементом Wikidata: ${listed.filter((b) => b.qid).length})`);
for (const b of listed) {
  const k = listKey(b);
  if (cache[k]) continue;
  if (b.qid) {
    const q = b.qid;
    try { cache[k] = await wdInfo(q, b.title); } catch (e) { fail(k, b.title, () => wdInfo(q, b.title), e); continue; }
    if (++asked % 20 === 0) writeCache('book-base.json', cache);
    await sleep(300);
    continue;
  }
  try {
    const authors = (b.author ?? '').split(/\s+и\s+|,\s*|\s*&\s*/).map((x) => x.trim()).filter(Boolean);
    const found = authors.length ? await wdFind(b.title, authors) : undefined;
    if (found) { cache[k] = found; if (++asked % 20 === 0) writeCache('book-base.json', cache); await sleep(300); continue; }
    const ol = await openLibrary({ title: b.title, ...(authors[0] ? { author: authors[0] } : {}) });
    if (!ol) { cache[k] = { miss: true }; continue; }
    ol.wd = (ol.olw ? await search(`P648=${ol.olw}`) : null) ?? undefined;
    cache[k] = ol;
  } catch (e) { console.error(`  ${b.title}: ${(e as Error).message}`); continue; }
  if (++asked % 20 === 0) writeCache('book-base.json', cache);
  await sleep(300);
}
// что ищут: элемент Wikidata известен — сразу сведения
type Popular = { qid: string; title: string; views: number; links: number; had: boolean };
const popularFile = POPULAR ? new URL(POPULAR, `file://${process.cwd()}/`) : new URL('../.cache/book-popular.json', import.meta.url);
// без отсева по `had` (17.10): повторы снимает `have` ниже
const popular: Popular[] = existsSync(popularFile)
  ? (JSON.parse(readFileSync(popularFile, 'utf8')) as { books: Popular[] }).books.filter((b) => !withheldWorks[`wd:${b.qid}`]) : [];
console.error(`книг, которые ищут в Википедии, и канона: ${popular.length} (прежде отсеивались ${popular.filter((b) => b.had).length} с had)`);
// уже есть в прежнем bookBase — сведения из карточки, без сети: иначе снятие отсева по had стоило бы ~570 запросов
const prevByQ = new Map(prevBookBase.filter((w) => w.externalIds?.wikidata).map((w) => [w.externalIds!.wikidata!, w]));
const fromCard = (w: WorkCard): Info => ({ wd: w.externalIds?.wikidata, title: w.title, ...(w.originalTitle ? { en: w.originalTitle } : {}),
  ...(w.year ? { year: w.year } : {}), authors: w.creators, ...(w.externalIds?.openLibrary ? { olw: w.externalIds.openLibrary } : {}),
  ...(/\/b\/id\/(\d+)-/.exec(w.coverUrl ?? '')?.[1] ? { cover: Number(/\/b\/id\/(\d+)-/.exec(w.coverUrl!)![1]) } : {}) });
let fromPrev = 0;
for (const b of popular) {
  if (cache[`wd:${b.qid}`]) continue;
  const prev = prevByQ.get(b.qid);
  if (prev) { cache[`wd:${b.qid}`] = fromCard(prev); fromPrev++; continue; }
  try { cache[`wd:${b.qid}`] = await wdInfo(b.qid, b.title); } catch (e) { fail(`wd:${b.qid}`, b.title, () => wdInfo(b.qid, b.title), e); continue; }
  if (++asked % 20 === 0) writeCache('book-base.json', cache);
  await sleep(300);
}
if (fromPrev) console.error(`сведения из прежнего bookBase: ${fromPrev}`);
// повтор не пришедшего: два круга, пауза перед кругом — 30 и 90 с (429 у Wikidata — минута-другая)
for (let round = 1; round <= 2 && failed.length; round++) {
  const todo = failed.splice(0);
  console.error(`повтор ${round}: ${todo.length} — пауза ${round === 1 ? 30 : 90} с`);
  await sleep(round === 1 ? 30000 : 90000);
  for (const f of todo) {
    if (cache[f.key]) continue;
    try { cache[f.key] = await f.run(); } catch (e) { if (round === 2) console.error(`  не пришло и со второго повтора: ${f.what}`); failed.push(f); }
    await sleep(1000);
  }
}
if (failed.length) console.error(`без сведений: ${failed.length} (${failed.slice(0, 10).map((f) => f.what).join(', ')}) — спросятся при следующем прогоне`);
writeCache('book-base.json', cache);

// ---------- 4. карточки ----------
const card = (info: Info, _why: string): WorkCard | undefined => {
  if (!info.title || (!info.wd && !info.olw)) return undefined;
  return {
    id: info.wd ? `b-wd${info.wd.slice(1)}` : `b-${info.olw}`, type: 'book', title: info.title,
    ...(info.en && info.en !== info.title ? { originalTitle: info.en } : {}),
    year: info.year ?? 0, creators: info.authors ?? [],
    ...(info.cover ? { coverUrl: `https://covers.openlibrary.org/b/id/${info.cover}-L.jpg`, imageSource: 'open_library' as const } : {}),
    // откуда книга (`why`) — только в .cache/book-candidates.tsv: `blurb` приложение показывает как «Сюжет», и там
    // стояло «Экранизации у нас: Расёмон» вместо описания (11.10)
    primaryOperations: [], complexityLevel: 0, warnings: [], barriers: [], isNicheMasterpiece: false,
    externalIds: { ...(info.wd ? { wikidata: info.wd } : {}), ...(info.olw ? { openLibrary: info.olw } : {}) },
  };
};
const cards = new Map<string, WorkCard>();
/** откуда карточка — для итоговой строки: подпись больше не едет в карточке */
const sourceOf = new Map<string, string>();
const put = (c: WorkCard | undefined, src: string) => { if (c && !cards.has(c.id)) { cards.set(c.id, c); sourceOf.set(c.id, src); } };
const rows = ['источник\tназвание\tавтор\tгод\tключ\tпочему\tв каталог'];
for (const g of graph.slice(0, TOP)) {
  const info = cache[`wd:${g.q}`];
  const titles = g.adaptedBy.map((k) => ours.get(k)!.work.title);
  const c = info && card(info, `Экранизации у нас: ${titles.slice(0, 3).join(', ')}${titles.length > 3 ? ` и ещё ${titles.length - 3}` : ''}`);
  put(c, 'экранизации');
  rows.push(['экранизация', relationNodes[g.q].t, info?.authors?.join(', ') ?? '', info?.year ?? '', `wd:${g.q}`, titles.join('; '), c ? 'да' : 'нет'].join('\t'));
}
for (const { q, why } of seeded) {
  const info = cache[`wd:${q}`];
  const c = info && card(info, `Заложенная вселенная: ${why}`);
  put(c, 'заложенные вселенные');
  rows.push(['заложенная вселенная', info?.title ?? q, info?.authors?.join(', ') ?? '', info?.year ?? '', `wd:${q}`, why, c ? 'да' : 'нет'].join('\t'));
}
for (const [k, s] of said) {
  const info = cache[`said:${k}`];
  // автор из текста должен сойтись с автором Open Library — иначе это тёзка
  const named = s.authors?.size ? [...s.authors] : s.author ? [s.author] : [];
  const authorOk = !named.length || !info?.authors?.length || info.authors.some((a) => named.some((x) => sameSurname(x, a)));
  const c = info && !info.miss && authorOk && (s.channels.size >= 2 || s.author) ? card(info, `${s.book ? 'Называют книжные каналы' : 'Называют эссеисты'}: ${[...s.channels].slice(0, 3).map((x) => x.slice(3)).join(', ')}`) : undefined;
  put(c, s.book ? 'книжные каналы' : 'эссеисты');
  rows.push([s.book ? 'книжные каналы' : 'эссеисты', s.title, s.author ?? info?.authors?.join(', ') ?? '', info?.year ?? '', info?.wd ? `wd:${info.wd}` : info?.olw ? `olw:${info.olw}` : '', `${s.channels.size} кан.: ${s.context.slice(0, 80)}`, c ? 'да' : 'нет'].join('\t'));
}
for (const b of listed) {
  const info = cache[listKey(b)];
  const named = (b.author ?? '').split(/\s+и\s+|,\s*|\s*&\s*/).map((x) => x.trim()).filter(Boolean);
  // с готовым элементом автор проверен при отборе (24.10): «Марина и Сергей Дяченко» разбивались бы на имена
  const authorOk = Boolean(b.qid) || !named.length || !info?.authors?.length || info.authors.some((a) => named.some((x) => sameSurname(x, a)));
  const c = info && !info.miss && authorOk ? card(info, `Из списков читателей: ${b.why}`) : undefined;
  put(c, 'списки читателей');
  rows.push(['списки читателей', b.title, b.author ?? info?.authors?.join(', ') ?? '', info?.year ?? '', info?.wd ? `wd:${info.wd}` : info?.olw ? `olw:${info.olw}` : '', b.why, c ? 'да' : 'нет'].join('\t'));
}
for (const b of popular) {
  const info = cache[`wd:${b.qid}`];
  const c = info && !info.miss ? card(info, b.views ? `Ищут в Википедии: ${Math.round(b.views / 1000)} тыс. просмотров` : `Классика: статьи в ${b.links} разделах Википедии`) : undefined;
  put(c, 'ищут в Википедии и канон');
  rows.push(['ищут в Википедии', b.title, info?.authors?.join(', ') ?? '', info?.year ?? '', `wd:${b.qid}`, b.views ? `${b.views} просмотров` : `${b.links} разделов`, c ? 'да' : 'нет'].join('\t'));
}
// свои книги (27.10): сведения — из списка, сети нет
for (const b of OWN_BOOKS) {
  put({ id: `b-own${b.own}`, type: 'book', title: b.title, ...(b.originalTitle ? { originalTitle: b.originalTitle } : {}), year: b.year ?? 0, creators: b.authors,
    ...(b.blurb ? { blurb: b.blurb } : {}),
    primaryOperations: [], complexityLevel: 0, warnings: [], barriers: [], isNicheMasterpiece: false, externalIds: { own: b.own } }, 'свои книги');
  rows.push(['свои книги', b.title, b.authors.join(', '), b.year ?? '', `own:${b.own}`, b.why, 'да'].join('\t'));
}
// убранное владельцем (withheldWorks.ts) — не заводим
for (const [id, c] of cards) if (c.externalIds?.wikidata && withheldWorks[`wd:${c.externalIds.wikidata}`]) cards.delete(id);
writeFileSync(new URL('../.cache/book-candidates.tsv', import.meta.url), rows.join('\n') + '\n');
// уже есть в справочнике под тем же ключом — не дублируем
// сам bookBase тоже в индексе: «уже есть» — без него, иначе перезапись оставляла только новые книги и выкидывала
// все прежние (11.10: 421 книга ушла бы с первым же повторным прогоном)
// 17.10: по справочнику без истории владельца и демо-каталога (tools/base-have.mts) — карточка «Мастера и Маргариты»
// в моках не повод не заводить книгу для всех
const have = baseHave({ except: ['bookBase'] });
const fresh = [...cards.values()].filter((c) => !have.has(c.externalIds?.wikidata ? `wd:${c.externalIds.wikidata}` : c.externalIds?.own ? `own:${c.externalIds.own}` : `olw:${c.externalIds?.openLibrary}`));
const bySource = new Map<string, number>();
for (const c of fresh) bySource.set(sourceOf.get(c.id) ?? '?', (bySource.get(sourceOf.get(c.id) ?? '?') ?? 0) + 1);
console.error(`\nкарточек книг: ${fresh.length} (${[...bySource].map(([k, n]) => `${k} ${n}`).join(', ')}); все кандидаты — .cache/book-candidates.tsv`);
if (DRY) {
  const before = new Set(prevBookBase.map((w) => w.id));
  writeFileSync(new URL('../.cache/book-base.dry.json', import.meta.url), JSON.stringify({ at: new Date().toISOString(),
    added: fresh.filter((c) => !before.has(c.id)).map((c) => ({ ...c, source: sourceOf.get(c.id) })),
    dropped: prevBookBase.filter((w) => !fresh.some((c) => c.id === w.id)).map((w) => ({ id: w.id, title: w.title, year: w.year })) }));
  console.error(`замер: новых ${fresh.filter((c) => !before.has(c.id)).length}, ушло бы ${prevBookBase.filter((w) => !fresh.some((c) => c.id === w.id)).length} → .cache/book-base.dry.json`);
  process.exit(0);
}
// Кусками по 1000 со своим типом (27.10): одним литералом на 5935 карточек TypeScript падал с TS2590 («union type too
// complex») — каждая новая форма карточки (свои книги с `blurb` и `externalIds.own`) множит объединение типов элементов
const parts = (all: WorkCard[]): string => {
  const names: string[] = [], out: string[] = [];
  for (let i = 0; i < all.length; i += 1000) {
    names.push(`p${names.length}`);
    out.push(`const ${names.at(-1)}: WorkCard[] = ${JSON.stringify(all.slice(i, i + 1000), null, 2)};`);
  }
  return `${out.join('\n')}\n\nexport const bookBase: WorkCard[] = [${names.map((n) => `...${n}`).join(', ')}];`;
};
writeFileSync(new URL('../src/mocks/bookBase.ts', import.meta.url), `// Сгенерировано tools/build-book-base.mts (З2) — руками не править.
// Стартовый каталог книг через мост с кино: книги по фильмам и сериалам справочника и книги,
// которые называют кино-эссеисты и книжные каналы (З6), книги из списков читателей и те, что ищут в Википедии. Разметки нет — в подбор не идут до З4.
import type { WorkCard } from '@/types/tmdf';

${parts(fresh)}
`);
console.error('→ src/mocks/bookBase.ts');
