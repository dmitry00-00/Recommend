// Книжные профили читателей (23.10, слово владельца «начинай»): то же, что tools/profile-seed.mts для Letterboxd, но для книг.
//   fantlab:<номер>   — открытый API Фантлаба (api.fantlab.ru/user/<номер>/marks, github.com/FantLab/FantLab-API): все оценки
//                       читателя, 1–10, с датой; постранично по 200, не чаще запроса в 1,2 с (crawl-delay сайта);
//   goodreads:<номер> — лента RSS полки «прочитано» (goodreads.com/review/list_rss/<номер>?shelf=read&page=N): 1–5 звёзд
//                       → raw 2–10, 0 — прочитано без оценки; страницы по 100, пауза 2 с. Официальная лента, страницы
//                       сайта не разбираем (как у Letterboxd).
// LiveLib сюда не входит: соглашение (п. 3.2.11) запрещает автоматизированный доступ — как Кинопоиск, скриптами не собираем.
// Книга находится через Wikidata (данные CC0): Фантлаб — номер произведения (P7439), Goodreads — ISBN по своей таблице
// src/mocks/bookWorks.ts, иначе номер издания (P2969; издание → произведение P629). Есть в каталоге (bookBase,
// `b-wd<Q>`) — оценка; нет — в `unmatched` с названием, автором и Q (для роста каталога, З2). Соответствия — в кэше
// .cache/books/wd-map.json. Оценка 1–5 — round(raw/2), raw хранится (норму шкалы модель выводит сама).
// Выход — seeds/books/<сервис>-<номер>.json — отдельной папкой: замеры и таблицы кино читают только seeds/*.json.
// Повторный прогон дописывает к прошлой истории (свежая оценка главнее) — как ночной profile-seed у Letterboxd.
// 23.10 (доля сопоставленных): кроме номеров — ISBN издания → Wikidata P212/P957 → P629; название + автор против каталога
// (свои названия и названия/псевдонимы из Wikidata, авторы — из каталога и P50 на ru/en/…); для оставшихся — поиск
// произведения в Wikidata по точной метке + автор (для роста каталога). Ложное хуже пропуска: всё, кроме номера издания/
// произведения, требует совпадения фамилии автора и одной-единственной книги. Номеров произведений Goodreads (P8383)
// в ленте RSS нет (только номер издания), а страницы сайта не разбираем — этим путём не идём.
// Запись в seeds/books хранит каждую книгу читателя (`matched` с `via` — каким путём, `unmatched` с `why`), так что
// сопоставление можно пересчитать без сайтов: --rematch. Несопоставленное у ≥2 читателей — .cache/books/missing-popular.json
// (только названия/авторы/число читателей — кандидаты в каталог), числа по путям — .cache/books/match-report.json.
//   npx tsx tools/book-profile-seed.mts fantlab:1 goodreads:155645880
//   npx tsx tools/book-profile-seed.mts --auto — находки шлюза (.cache/tg-asks/found.json и поиск по каналам
//        .cache/outreach/.channel-profiles-scan.json) и уже собранные в seeds/books/; ночью — из tools/collect.mts
//   npx tsx tools/book-profile-seed.mts --rematch — пересчитать сопоставление всех seeds/books/* без запросов к сайтам
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { bookBase } from '../src/mocks/bookBase.ts';
import { bookWorks } from '../src/mocks/bookWorks.ts';
import { viewerProfiles, type FoundPost } from './viewer-profiles.mts';

const DIR = 'seeds/books';
const MAP = '.cache/books/wd-map.json';
const ISBNS = '.cache/books/wd-isbn.json';       // ISBN-13 → Q произведения | null
const CAT_WD = '.cache/books/catalog-wd.json';   // Q каталога → { t: названия, a: имена авторов } из Wikidata
const LABELS = '.cache/books/wd-label.json';     // «en|Dune» → [{ w, a }] — произведения с такой меткой и их авторы
const MISSING = '.cache/books/missing-popular.json';
const REPORT = '.cache/books/match-report.json';
const FOUND = '.cache/tg-asks/found.json';
const SCAN = '.cache/outreach/.channel-profiles-scan.json';
const UA = 'recomend-books/0.1 (book recommendations; contact via @recomend_media_bot)';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const read = <T,>(f: string, d: T): T => { try { return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) as T : d; } catch { return d; } };

type Site = 'fantlab' | 'goodreads';
interface Entry { site: Site; id: string; title: string; author?: string; year?: number; isbn?: string; raw?: number; at?: string }
/** книга из истории читателя; ref — `<сервис>:<номер>` (номер издания Goodreads / произведения Фантлаба) */
interface Rec { ref: string; title: string; author?: string; year?: number; isbn?: string; raw?: number; at?: string }
/** via: id — номер в Wikidata (или таблица bookWorks), isbn — издание по ISBN, title — название каталога + автор,
 *  title-wd — название/псевдоним из Wikidata + автор (обычно перевод: англ. издание при русском названии), wd-label — поиск */
type Via = 'id' | 'isbn' | 'title' | 'title-wd' | 'wd-label';
interface Matched extends Rec { workId: string; via: Via; cut?: true }   // cut — по названию без подзаголовка/тома
/** why: wd — в Wikidata есть, в каталоге нет; author — автор в каталоге есть, название не совпало; none — не найдено */
interface Unmatched extends Rec { wd?: string; why?: 'wd' | 'author' | 'none' }
interface BookSeed {
  source: { site: Site; user: string }; resolvedAt: string;
  watched: { workId: string }[]; ratings: { workId: string; rating: 1 | 2 | 3 | 4 | 5; raw: number; at?: string }[];
  matched?: Matched[]; unmatched: Unmatched[];
}

/** «2026-09-01 13:12:09», «Wed, 21 Oct 2026 03:56:44 -0700» → «2026-09-01» */
const isoDay = (s?: string) => {
  if (!s?.trim()) return undefined;
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(s.trim());
  if (m) return m[1];
  const t = Date.parse(s);
  return Number.isFinite(t) ? new Date(t).toISOString().slice(0, 10) : undefined;
};
// 23.10: вне CDATA Goodreads отдаёт сущности («Childe Harold&apos;s Pilgrimage») — раскрываем, иначе название не совпадёт
const ENT: Record<string, string> = { amp: '&', apos: "'", quot: '"', lt: '<', gt: '>', nbsp: ' ' };
const unent = (s?: string) => s?.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (m, e: string) => e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : ENT[e.toLowerCase()] ?? m);
const tag = (xml: string, name: string) => unent(new RegExp(`<${name}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${name}>`).exec(xml)?.[1].trim());

async function get(url: string, tries = 3): Promise<Response> {
  for (let i = 0; ; i++) {
    const res = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(30_000) }).catch((e) => e as Error);
    if (res instanceof Response && (res.ok || res.status === 404)) return res;
    if (i + 1 >= tries) throw new Error(`${url}: ${res instanceof Response ? `HTTP ${res.status}` : res.message}`);
    await sleep(5000 * (i + 1));
  }
}

async function fantlab(user: string): Promise<Entry[]> {
  const out: Entry[] = [];
  for (let page = 1; page <= 100; page++) {
    const res = await get(`https://api.fantlab.ru/user/${user}/marks?page=${page}`);
    if (res.status === 404) { if (page === 1) throw new Error(`fantlab ${user}: нет такого читателя`); break; }
    const d = await res.json() as { items?: { work_id: number; mark: number; mark_date?: string; work_name?: string; work_name_orig?: string; work_author?: string; work_year?: number }[]; total_count?: number };
    for (const x of d.items ?? []) {
      if (!x.work_id) continue;
      out.push({ site: 'fantlab', id: String(x.work_id), title: x.work_name || x.work_name_orig || '', author: x.work_author || undefined, year: x.work_year || undefined,
        ...(x.mark ? { raw: x.mark } : {}), ...(isoDay(x.mark_date) ? { at: isoDay(x.mark_date) } : {}) });
    }
    if (!d.items?.length || out.length >= (d.total_count ?? 0)) break;
    await sleep(1200);
  }
  return out;
}

async function goodreads(user: string): Promise<Entry[]> {
  const out: Entry[] = [];
  for (let page = 1; page <= 60; page++) {
    const res = await get(`https://www.goodreads.com/review/list_rss/${user}?shelf=read&page=${page}`);
    if (res.status === 404) { if (page === 1) throw new Error(`goodreads ${user}: нет такого читателя или полка закрыта`); break; }
    const xml = await res.text();
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => m[1]);
    for (const it of items) {
      const id = tag(it, 'book_id');
      if (!id) continue;
      const stars = Number(tag(it, 'user_rating'));
      const at = isoDay(tag(it, 'user_read_at')) ?? isoDay(tag(it, 'user_date_added'));
      out.push({ site: 'goodreads', id, title: tag(it, 'title') ?? '', author: tag(it, 'author_name'), year: Number(tag(it, 'book_published')) || undefined,
        isbn: tag(it, 'isbn') || undefined, ...(stars ? { raw: stars * 2 } : {}), ...(at ? { at } : {}) });
    }
    if (items.length < 90) break;
    await sleep(2000);
  }
  return out;
}

// ─── Wikidata: номер сервиса → Q произведения ──────────────────────────────────
const wdMap = read<Record<string, string | null>>(MAP, {});
const isbnMap = read<Record<string, string | null>>(ISBNS, {});
const catWd = read<Record<string, { t: string[]; a: string[] }>>(CAT_WD, {});
const labelMap = read<Record<string, { w: string; a: string[] }[]>>(LABELS, {});
const save = (f: string, d: unknown) => { mkdirSync('.cache/books', { recursive: true }); writeFileSync(`${f}.tmp`, JSON.stringify(d)); renameSync(`${f}.tmp`, f); };
type Row = { [k: string]: { value: string } };
// 23.10: POST (пачка ISBN во всех расстановках дефисов не влезает в адрес), строго по одному запросу и 3 с между ними;
// 429 — ждём сколько попросят
async function sparql(query: string): Promise<Row[]> {
  for (let i = 0; ; i++) {
    const res = await fetch('https://query.wikidata.org/sparql', { method: 'POST', body: new URLSearchParams({ query }), signal: AbortSignal.timeout(120_000),
      headers: { 'user-agent': UA, accept: 'application/sparql-results+json' } }).catch((e) => e as Error);
    if (res instanceof Response && res.ok) { const out = ((await res.json()) as { results: { bindings: Row[] } }).results.bindings; await sleep(3000); return out; }
    if (i >= 2) throw new Error(`Wikidata: ${res instanceof Response ? `HTTP ${res.status}` : res.message}`);
    await sleep(res instanceof Response && res.status === 429 ? 1000 * (Number(res.headers.get('retry-after')) || 60) : 10_000 * (i + 1));
  }
}
const qOfUri = (u: string) => u.replace(/^.*\//, '');
const idKey = (ref: string) => `${ref.startsWith('fantlab:') ? 'fl' : 'gr'}:${ref.slice(ref.indexOf(':') + 1)}`;

/** ключ кэша: fl:<работа>, gr:<издание>; null — в Wikidata нет */
async function mapToWd(recs: Rec[]): Promise<void> {
  for (const [site, prop, pfx] of [['fantlab', 'P7439', 'fl'], ['goodreads', 'P2969', 'gr']] as const) {
    const ids = [...new Set(recs.filter((r) => r.ref.startsWith(`${site}:`)).map((r) => idKey(r.ref).slice(3)))].filter((id) => !(`${pfx}:${id}` in wdMap));
    for (let i = 0; i < ids.length; i += 200) {
      const part = ids.slice(i, i + 200);
      // издание Goodreads — обычно элемент издания: берём произведение (P629), а если элемент сам произведение — его
      const rows = await sparql(`SELECT ?id ?w WHERE { VALUES ?id { ${part.map((x) => JSON.stringify(x)).join(' ')} } ?e wdt:${prop} ?id. OPTIONAL { ?e wdt:P629 ?ed } BIND(COALESCE(?ed, ?e) AS ?w) }`);
      // 23.10 (ревью): у сборника/однотомника несколько P629, или номер у двух элементов — не угадываем, null (как у ISBN)
      const found = new Map<string, Set<string>>();
      for (const r of rows) found.set(r.id.value, (found.get(r.id.value) ?? new Set()).add(qOfUri(r.w.value)));
      for (const id of part) { const ws = found.get(id); wdMap[`${pfx}:${id}`] = ws?.size === 1 ? [...ws][0] : null; }
      save(MAP, wdMap);
    }
  }
}

// ─── ISBN издания → P212/P957 → произведение (23.10) ──────────────────────────
// В Wikidata ISBN записан с дефисами, а где они стоят, зависит от диапазонов агентства: перебираем все расстановки
// (группа 1–5 цифр, издательство 1–7, номер — остаток): цифры те же, значит, и совпадение — то же издание.
const isbnDigits = (s?: string) => (s ?? '').toUpperCase().replace(/[^0-9X]/g, '');
const to13 = (s?: string): string | undefined => {
  const d = isbnDigits(s);
  if (/^97[89]\d{10}$/.test(d)) return d;
  if (!/^\d{9}[\dX]$/.test(d)) return undefined;
  const b = `978${d.slice(0, 9)}`;
  let sum = 0; for (let i = 0; i < 12; i++) sum += Number(b[i]) * (i % 2 ? 3 : 1);
  return b + ((10 - (sum % 10)) % 10);
};
const to10 = (d13: string): string | undefined => {
  if (!d13.startsWith('978')) return undefined;
  const b = d13.slice(3, 12);
  let sum = 0; for (let i = 0; i < 9; i++) sum += Number(b[i]) * (10 - i);
  const c = (11 - (sum % 11)) % 11;
  return b + (c === 10 ? 'X' : String(c));
};
const hyphenations = (core: string, pre: string, check: string): string[] => {
  const out = [`${pre}${core}${check}`];
  for (let g = 1; g <= 5; g++) for (let p = 1; p <= 7 && g + p < core.length; p++)
    out.push(`${pre ? `${pre}-` : ''}${core.slice(0, g)}-${core.slice(g, g + p)}-${core.slice(g + p)}-${check}`);
  return out;
};
const isbnForms = (d13: string): string[] => {
  const d10 = to10(d13);
  return [...hyphenations(d13.slice(3, 12), d13.slice(0, 3), d13[12]), ...(d10 ? hyphenations(d10.slice(0, 9), '', d10[9]) : [])];
};
async function mapIsbn(recs: Rec[]): Promise<void> {
  const want = [...new Set(recs.map((r) => to13(r.isbn)).filter((x): x is string => !!x))].filter((i) => !(i in isbnMap));
  for (let i = 0; i < want.length; i += 20) {
    const part = want.slice(i, i + 20);
    const rows = await sparql(`SELECT ?i ?w WHERE { VALUES ?i { ${part.flatMap(isbnForms).map((x) => JSON.stringify(x)).join(' ')} }
      { ?e wdt:P212 ?i } UNION { ?e wdt:P957 ?i } OPTIONAL { ?e wdt:P629 ?ed } BIND(COALESCE(?ed, ?e) AS ?w) }`);
    const found = new Map<string, Set<string>>();
    for (const r of rows) { const k = to13(r.i.value); if (k) found.set(k, (found.get(k) ?? new Set()).add(qOfUri(r.w.value))); }
    // один ISBN у двух произведений (сборник, ошибка) — не берём
    for (const k of part) { const s = found.get(k); isbnMap[k] = s?.size === 1 ? [...s][0] : null; }
    save(ISBNS, isbnMap);
  }
}

// ─── каталог: названия и авторы из Wikidata (23.10) ───────────────────────────
// В каталоге названия русские (+ оригинальное), авторы — по-русски; у Goodreads — английские издания и латиница.
// Берём метки и псевдонимы произведения на ru/en, P1476 (название на языке оригинала), имена авторов (P50).
async function ensureCatalogWd(): Promise<void> {
  const want = bookBase.map((w) => /^b-wd(\d+)$/.exec(w.id)?.[1]).filter((x): x is string => !!x).map((x) => `Q${x}`).filter((q) => !(q in catWd));
  if (want.length) console.error(`Wikidata: названия и авторы для ${want.length} книг каталога (раз, потом из кэша)`);
  for (let i = 0; i < want.length; i += 150) {
    const part = want.slice(i, i + 150), vals = part.map((q) => `wd:${q}`).join(' ');
    const titles = await sparql(`SELECT ?w ?t WHERE { VALUES ?w { ${vals} }
      { ?w rdfs:label ?t FILTER(LANG(?t) IN ("ru", "en")) } UNION { ?w skos:altLabel ?t FILTER(LANG(?t) IN ("ru", "en")) } UNION { ?w wdt:P1476 ?t } }`);
    const names = await sparql(`SELECT ?w ?n WHERE { VALUES ?w { ${vals} } ?w wdt:P50 ?a.
      { ?a rdfs:label ?n } UNION { ?a skos:altLabel ?n } FILTER(LANG(?n) IN ("ru", "en", "uk", "de", "fr", "es", "it", "pl")) }`);
    for (const q of part) catWd[q] = { t: [], a: [] };
    for (const r of titles) catWd[qOfUri(r.w.value)].t.push(r.t.value);
    for (const r of names) catWd[qOfUri(r.w.value)].a.push(r.n.value);
    save(CAT_WD, catWd);
  }
}

// ─── сравнение названий и авторов ─────────────────────────────────────────────
const fold = (s?: string) => (s ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/ё/g, 'е');
const norm = (s?: string) => fold(s).replace(/\(.*?\)|\[.*?\]|[«»"'“”„.,:;!?…–—\-/#]/g, ' ').replace(/\s+/g, ' ').trim();
/** «Метро 2034 (Метро #2)», «Outlast: The Murkoff Account», «Золотой ключик, или Приключения Буратино» →
 *  целиком, до двоеточия, до «, или/or» — серия в скобках у Goodreads не часть названия */
const titleVariants = (t?: string): string[] => {
  const s = (t ?? '').replace(/\(.*?\)|\[.*?\]/g, ' ');
  return [...new Set([s, s.split(/:\s/)[0], s.split(/,?\s+(?:или|or)\s+/i)[0]].map(norm).filter((x) => x.length >= 2))];
};
/** у читателя ещё и без номера тома: «Человек-бензопила. Кн.1. Пес и бензопила», «チェンソーマン 12», «Saga, Vol. 3» →
 *  произведение целиком (в каталоге манга/комикс — одна карточка на серию). Только со стороны читателя: каталог так не режем */
const volumeVariants = (t?: string): string[] => {
  const s = (t ?? '').replace(/\(.*?\)|\[.*?\]/g, ' ').trim();
  const cut = s.replace(/[.,:]?\s*(?:том|кн\.?|книга|часть|vol\.?|volume|part|#)\s*\d+[\s\S]*$/i, '').replace(/\s+\d{1,2}$/, '').trim();
  return cut && cut !== s ? titleVariants(cut) : [];
};
const LAT: Record<string, string> = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ж: 'zh', з: 'z', и: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
  с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sh', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'u', я: 'a', і: 'i', ї: 'i', є: 'e', ґ: 'g' };
/** скелет фамилии по согласным: «Достоевский» и «Dostoyevsky» → dstvsk, «Хаксли» и «Huxley» → hksl, «Коллинз» и «Collins» → klns */
const skeleton = (tok: string) => [...tok].map((c) => LAT[c] ?? c).join('')
  .replace(/sch/g, 'sh').replace(/kh/g, 'h').replace(/x/g, 'ks').replace(/ck/g, 'k').replace(/ph/g, 'f').replace(/th/g, 't').replace(/w/g, 'v')
  .replace(/tz|ts/g, 'c').replace(/c(?!h)/g, 'k').replace(/q/g, 'k').replace(/z(?!h)/g, 's').replace(/[aeiouyj]/g, '').replace(/(.)\1+/g, '$1');
const nameToks = (s?: string) => fold(s).split(/[^\p{L}]+/u).filter((x) => x.length >= 2);
/** фамилия — последнее слово имени, а у «Le Guin, Ursula K.» — последнее до запятой. Сверяем только фамилии: по словам
 *  целиком «Peter David» совпал бы с «David Pinner» (23.10) */
const surname = (n?: string) => { const t = nameToks((n ?? '').includes(',') ? n!.split(',')[0] : n); return t[t.length - 1] ?? ''; };
const sameSurname = (a: string, b: string) => a === b || (a.length >= 3 && b.length >= 3 && skeleton(a).length >= 3 && skeleton(a) === skeleton(b));
/** фамилия читателя совпала с фамилией одного из авторов книги — буквально или по скелету (≥3 согласных) */
function authorOk(author: string | undefined, names: string[]): boolean {
  const last = surname(author);
  return last.length >= 3 && names.some((n) => sameSurname(last, surname(n)));
}

const inCatalog = new Set(bookBase.map((w) => w.id));
const qToId = (q?: string) => (q ? `b-wd${q.slice(1)}` : undefined);
let byTitle = new Map<string, Map<string, boolean>>();   // вариант названия → книга → «своё» (true) или из Wikidata
// те же слова в другом порядке (перевод: «Баллада о змеях и певчих птицах» / «…о певчих птицах и змеях»), от трёх слов
const bag = (v: string) => { const w = v.split(' '); return w.length >= 3 ? `≈${[...w].sort().join(' ')}` : undefined; };
const authorsOf = new Map<string, string[]>();
const bySurname = new Map<string, Set<string>>();   // фамилия и её скелет → книги каталога
function buildIndex(): void {
  byTitle = new Map();
  for (const w of bookBase) {
    const wd = catWd[`Q${w.id.slice(4)}`];
    authorsOf.set(w.id, [...(w.creators ?? []), ...(wd?.a ?? [])]);
    for (const t of authorsOf.get(w.id)!.map(surname)) if (t.length >= 3)
      for (const k of [t, `~${skeleton(t)}`]) if (k.length >= 4 || k === t) bySurname.set(k, (bySurname.get(k) ?? new Set()).add(w.id));
    const add = (t: string, own: boolean) => { for (const v of titleVariants(t).flatMap((x) => [x, bag(x)])) if (v) { const m = byTitle.get(v) ?? new Map<string, boolean>(); m.set(w.id, own || !!m.get(w.id)); byTitle.set(v, m); } };
    for (const t of [w.title, w.originalTitle]) if (t) add(t, true);
    for (const t of wd?.t ?? []) add(t, false);
  }
}
/** книги каталога автора с такой фамилией */
const booksOf = (a?: string) => { const l = surname(a); return l.length < 3 ? new Set<string>() : new Set([...(bySurname.get(l) ?? []), ...(skeleton(l).length >= 3 ? bySurname.get(`~${skeleton(l)}`) ?? [] : [])]); };
/** одна-единственная книга каталога с таким названием и фамилией автора. Сначала название целиком; обрезанное (до
 *  двоеточия, без тома) — только если у автора в каталоге одна книга: «Дюна: Мессия Дюны» не должна стать «Дюной» (23.10) */
function titleHit(r: Rec): { workId: string; own: boolean; cut: boolean } | undefined {
  const full = titleVariants(r.title)[0];
  const cutVs = [...titleVariants(r.title).slice(1), ...volumeVariants(r.title)];
  const fullBag = full ? bag(full) : undefined;
  for (const [vs, isCut] of [[full ? [full] : [], false], [fullBag ? [fullBag] : [], false], [cutVs, true]] as const) {
    if (isCut && booksOf(r.author).size !== 1) break;
    const hits = new Map<string, boolean>();
    for (const v of vs) for (const [id, own] of byTitle.get(v) ?? []) if (authorOk(r.author, authorsOf.get(id) ?? [])) hits.set(id, own || !!hits.get(id));
    if (hits.size === 1) return { workId: [...hits.keys()][0], own: [...hits.values()][0], cut: isCut };
    if (hits.size > 1) return undefined;
  }
  return undefined;
}

// ─── поиск произведения по точной метке (23.10) ───────────────────────────────
// Для книг, которых не нашли ни номером, ни ISBN: метка ru/en + автор → Q. В каталоге таких почти нет (их названия
// уже в индексе) — это задел для роста каталога и сведения одинаковых книг разных читателей.
const rawVariants = (t: string) => { const s = t.replace(/\s*\(.*?\)|\s*\[.*?\]/g, '').replace(/\s+/g, ' ').trim(); return [...new Set([s, s.split(/:\s/)[0].trim()])].filter((x) => x.length >= 2); };
const labelKeys = (t: string) => rawVariants(t).map((v) => `${/[а-яё]/i.test(v) ? 'ru' : 'en'}|${v}`);
async function searchLabels(recs: Rec[]): Promise<void> {
  const want = [...new Set(recs.flatMap((r) => labelKeys(r.title)))].filter((k) => !(k in labelMap));
  for (let i = 0; i < want.length; i += 40) {
    const part = want.slice(i, i + 40);
    const rows = await sparql(`SELECT ?t ?w (GROUP_CONCAT(DISTINCT ?an; separator="|") AS ?as) WHERE {
      VALUES ?t { ${part.map((k) => `${JSON.stringify(k.slice(3))}@${k.slice(0, 2)}`).join(' ')} }
      ?x rdfs:label ?t; wdt:P50 ?a. OPTIONAL { ?x wdt:P629 ?ed } BIND(COALESCE(?ed, ?x) AS ?w)
      ?a rdfs:label ?an FILTER(LANG(?an) IN ("en", "ru")) } GROUP BY ?t ?w`);
    for (const k of part) labelMap[k] = [];
    for (const r of rows) { const k = `${/[а-яё]/i.test(r.t.value) ? 'ru' : 'en'}|${r.t.value}`; (labelMap[k] ??= []).push({ w: qOfUri(r.w.value), a: r.as.value.split('|') }); }
    save(LABELS, labelMap);
  }
}
/** то же правило: метка целиком, а обрезанная до двоеточия — только если она не ведёт в каталог к автору с несколькими книгами */
const labelQ = (r: Rec): string | undefined => {
  const [full, ...cutKs] = labelKeys(r.title);
  for (const ks of [full ? [full] : [], cutKs]) {
    const ws = new Set(ks.flatMap((k) => labelMap[k] ?? []).filter((x) => authorOk(r.author, x.a)).map((x) => x.w));
    if (ws.size > 1) return undefined;
    if (ws.size === 1) { const q = [...ws][0]; return ks === cutKs && inCatalog.has(qToId(q)!) && booksOf(r.author).size !== 1 ? undefined : q; }
  }
  return undefined;
};

// ─── решение по книге ─────────────────────────────────────────────────────────
interface Verdict { workId?: string; via?: Via; wd?: string; rejected?: Via[]; cut?: true }
/** номер/ISBN → Q; в каталоге — берём, если фамилия автора сходится (или имени нет с одной стороны); иначе — название + автор */
function resolve(r: Rec): Verdict {
  const byId = (r.ref.startsWith('goodreads:') && r.isbn && bookWorks[isbnDigits(r.isbn)]?.wd) || wdMap[idKey(r.ref)] || undefined;
  const byIsbn = to13(r.isbn) ? isbnMap[to13(r.isbn)!] ?? undefined : undefined;
  const rejected: Via[] = [];
  for (const [q, via] of [[byId, 'id'], [byIsbn, 'isbn']] as const) {
    const id = qToId(q);
    if (!id || !inCatalog.has(id)) continue;
    const names = authorsOf.get(id) ?? [];
    if (!r.author || !names.length || authorOk(r.author, names)) return { workId: id, via, wd: q };
    rejected.push(via);
  }
  const t = titleHit(r);
  if (t) return { workId: t.workId, via: t.own ? 'title' : 'title-wd', wd: `Q${t.workId.slice(4)}`, ...(t.cut ? { cut: true } : {}), ...(rejected.length ? { rejected } : {}) };
  // 23.10 (ревью): номер/ISBN, отбракованный выше по автору, сюда не пускаем — иначе он вернулся бы совпадением без
  // проверки; номер вне каталога нужен только для `unmatched.wd`, совпадение здесь — лишь поиском с проверкой автора
  const q = labelQ(r) ?? [byId, byIsbn].find((x) => x && !inCatalog.has(qToId(x)!));
  if (q && inCatalog.has(qToId(q)!)) return { workId: qToId(q), via: 'wd-label', wd: q, ...(rejected.length ? { rejected } : {}) };
  return { wd: q, ...(rejected.length ? { rejected } : {}) };
}
/** есть ли в каталоге хоть одна книга автора с такой фамилией (для разбора причин: «название не совпало») */
const authorKnown = (a?: string) => booksOf(a).size > 0;

type FileReport = { books: number; matched: number; via: Partial<Record<Via, number>>; unmatched: Record<'wd' | 'author' | 'none', number>; rejected: number; dropped: number };
const report = read<Record<string, FileReport>>(REPORT, {});

async function match(file: string, site: Site, user: string, fresh: Rec[] | undefined): Promise<string> {
  const prev = read<BookSeed | undefined>(file, undefined);
  // прошлая история + свежая: по книге (ref) главнее свежая запись. Старый формат (до 23.10, без `matched`) хранил
  // сопоставленное только номером каталога — его не перепроверить, берём из свежей ленты (она отдаёт всю полку)
  const recs = new Map<string, Rec>();
  for (const x of [...(prev?.matched ?? []), ...(prev?.unmatched ?? [])]) {
    const { workId: _w, via: _v, wd: _q, why: _y, cut: _c, ...r } = x as Matched & Unmatched;
    recs.set(r.ref, { ...r, title: unent(r.title) ?? '', ...(r.author ? { author: unent(r.author) } : {}) });
  }
  for (const r of fresh ?? []) recs.set(r.ref, r);
  const all = [...recs.values()];
  await mapToWd(all);
  await mapIsbn(all.filter((r) => r.isbn));
  buildIndex();
  await searchLabels(all.filter((r) => !resolve(r).workId && !resolve(r).wd));
  const matched: Matched[] = [], unmatched: Unmatched[] = [];
  const via: FileReport['via'] = {}, why = { wd: 0, author: 0, none: 0 };
  let rejected = 0;
  for (const r of all) {
    const v = resolve(r);
    if (v.rejected) rejected++;
    if (v.workId) { matched.push({ ...r, workId: v.workId, via: v.via!, ...(v.cut ? { cut: true } : {}) }); via[v.via!] = (via[v.via!] ?? 0) + 1; continue; }
    const w = v.wd ? 'wd' : authorKnown(r.author) ? 'author' : 'none';
    why[w]++;
    unmatched.push({ ...r, ...(v.wd ? { wd: v.wd } : {}), why: w });
  }
  // оценка книги — по самой свежей записи (два издания одной книги — одна оценка)
  const rated = new Map<string, BookSeed['ratings'][number]>();
  for (const m of [...matched].sort((a, b) => (a.at ?? '').localeCompare(b.at ?? ''))) if (m.raw)
    rated.set(m.workId, { workId: m.workId, rating: Math.min(5, Math.max(1, Math.round(m.raw / 2))) as 1 | 2 | 3 | 4 | 5, raw: m.raw, ...(m.at ? { at: m.at } : {}) });
  const seed: BookSeed = { source: { site, user }, resolvedAt: new Date().toISOString(),
    watched: [...new Set(matched.map((m) => m.workId))].map((workId) => ({ workId })), ratings: [...rated.values()], matched, unmatched };
  const dropped = (prev?.watched ?? []).filter((w) => !seed.watched.some((x) => x.workId === w.workId)).length;
  mkdirSync(DIR, { recursive: true });
  writeFileSync(`${file}.tmp`, `${JSON.stringify(seed, null, 1)}\n`);
  renameSync(`${file}.tmp`, file);
  report[`${site}-${user}`] = { books: all.length, matched: matched.length, via, unmatched: why, rejected, dropped };
  const viaS = Object.entries(via).map(([k, n]) => `${k} ${n}`).join(', ');
  return `→ ${file}: книг ${all.length}, в каталоге ${matched.length} (${viaS}), оценок ${seed.ratings.length}; вне каталога ${unmatched.length}`
    + ` (в Wikidata ${why.wd}, автор в каталоге ${why.author}, не найдено ${why.none}); отбраковано по автору ${rejected}, ушло из прошлых ${dropped}`;
}

async function collect(site: Site, user: string): Promise<string> {
  const entries = site === 'fantlab' ? await fantlab(user) : await goodreads(user);
  const fresh = entries.map(({ site: s, id, ...e }): Rec => ({ ref: `${s}:${id}`, ...e }));
  return match(`${DIR}/${site}-${user}.json`, site, user, fresh);
}

/** несопоставленное у ≥2 читателей — кандидаты в каталог; только книги (название, автор, Q) и число читателей */
function missingPopular(): number {
  const groups = new Map<string, { keys: Set<string>; files: Set<string>; recs: Unmatched[] }>();
  const keyOwner = new Map<string, string>();
  for (const f of existsSync(DIR) ? readdirSync(DIR).filter((x) => x.endsWith('.json')) : []) {
    for (const u of read<BookSeed | undefined>(`${DIR}/${f}`, undefined)?.unmatched ?? []) {
      const sur = skeleton(surname(u.author));
      const keys = [...(u.wd ? [u.wd] : []), ...titleVariants(u.title).slice(0, 1).map((t) => `${t}|${sur}`)];
      // склейка групп: одна книга у одного читателя с Q, у другого только названием
      const owners = [...new Set(keys.map((k) => keyOwner.get(k)).filter((x): x is string => !!x))];
      const id = owners[0] ?? keys[0];
      const g = groups.get(id) ?? { keys: new Set<string>(), files: new Set<string>(), recs: [] };
      for (const o of owners.slice(1)) { const h = groups.get(o)!; h.keys.forEach((k) => g.keys.add(k)); h.files.forEach((x) => g.files.add(x)); g.recs.push(...h.recs); groups.delete(o); }
      keys.forEach((k) => g.keys.add(k)); g.files.add(f); g.recs.push(u);
      groups.set(id, g);
      for (const k of g.keys) keyOwner.set(k, id);
    }
  }
  const out = [...groups.values()].filter((g) => g.files.size >= 2).map((g) => {
    const top = <T,>(xs: (T | undefined)[]) => [...xs.reduce((m, x) => (x === undefined ? m : m.set(x, (m.get(x) ?? 0) + 1)), new Map<T, number>())].sort((a, b) => b[1] - a[1])[0]?.[0];
    return { title: top(g.recs.map((r) => r.title)), author: top(g.recs.map((r) => r.author)), year: top(g.recs.map((r) => r.year)), wd: top(g.recs.map((r) => r.wd)), readers: g.files.size };
  }).sort((a, b) => b.readers - a.readers || String(a.title).localeCompare(String(b.title)));
  save(MISSING, out);
  return out.length;
}

// ─── кого собирать ─────────────────────────────────────────────────────────────
const refOf = (url: string): string | undefined => {
  const f = /fantlab\.ru\/user(\d+)/i.exec(url); if (f) return `fantlab:${f[1]}`;
  const g = /goodreads\.com\/user\/show\/(\d+)/i.exec(url); if (g) return `goodreads:${g[1]}`;
  return undefined;
};
function auto(): string[] {
  const found = viewerProfiles(read<FoundPost[]>(FOUND, [])).map((p) => refOf(p.url));
  const scan = Object.values(read<{ channels?: Record<string, { profiles: { url: string }[] }> }>(SCAN, {}).channels ?? {}).flatMap((c) => c.profiles.map((p) => refOf(p.url)));
  const known = (existsSync(DIR) ? readdirSync(DIR) : []).map((f) => /^(fantlab|goodreads)-(\d+)\.json$/.exec(f)).filter(Boolean).map((m) => `${m![1]}:${m![2]}`);
  return [...new Set([...found, ...scan, ...known].filter((x): x is string => !!x))];
}

// --rematch (23.10): пересчёт сопоставления по сохранённым книгам, без запросов к Фантлабу/Goodreads (Wikidata — да,
// для новых номеров/ISBN/названий). Файлы старого формата (без `matched`) так не пересчитать — им нужен обычный сбор.
if (process.argv.includes('--rematch')) {
  await ensureCatalogWd();
  for (const f of (existsSync(DIR) ? readdirSync(DIR) : []).sort()) {
    const m = /^(fantlab|goodreads)-(\d+)\.json$/.exec(f);
    if (!m) continue;
    if (!read<BookSeed | undefined>(`${DIR}/${f}`, undefined)?.matched) { console.error(`${f}: старый формат — нужен сбор: npx tsx tools/book-profile-seed.mts ${m[1]}:${m[2]}`); continue; }
    console.log(await match(`${DIR}/${f}`, m[1] as Site, m[2], undefined));
  }
  save(REPORT, report);
  console.log(`несопоставленное у ≥2 читателей: ${missingPopular()} → ${MISSING}`);
  process.exit(0);
}
const args = process.argv.includes('--auto') ? auto() : process.argv.slice(2);
if (!args.length) { console.error(process.argv.includes('--auto') ? 'книжных профилей в находках нет' : 'чей профиль? npx tsx tools/book-profile-seed.mts fantlab:<номер> goodreads:<номер>'); process.exit(process.argv.includes('--auto') ? 0 : 2); }
let failed = 0;
for (const a of args) {
  const m = /^(fantlab|goodreads):(\d+)$/.exec(a);
  if (!m) { console.error(`не понял «${a}»: fantlab:<номер> или goodreads:<номер>`); failed++; continue; }
  try { await ensureCatalogWd(); console.log(await collect(m[1] as Site, m[2])); } catch (err) { console.error(`${a}: ${(err as Error).message}`); failed++; }
}
save(REPORT, report);
try { console.log(`несопоставленное у ≥2 читателей: ${missingPopular()} → ${MISSING}`); } catch (err) { console.error(`missing-popular: ${(err as Error).message}`); }
process.exit(failed && failed === args.length ? 1 : 0);
