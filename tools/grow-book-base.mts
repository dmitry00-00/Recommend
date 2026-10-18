// Книги, которые ищут (книжный трек, 11.10): как tools/grow-film-base.mts для кино — чтобы человек, набрав в
// поиске три любимые книги, находил их. Справочник книг до сих пор рос только через мост с кино (экранизации,
// упоминания у эссеистов и книжных каналов) — школьная программа и громкие новинки в нём есть не всегда.
//
//   npx tsx tools/grow-book-base.mts [--min-links 60] [--fresh]
//
// Два сигнала, оба открытые и без ключа:
//   • спрос — месячные топ-1000 русской Википедии (.cache/wiki-top/ГГГГ-ММ.json, их скачивает grow-film-base):
//     статья о книге в топе месяца — то, что в тот месяц читали массово (школа, экранизация, новость);
//   • канон — книги с русской статьёй и статьями в --min-links разделах Википедии и больше (P31 — литературное
//     произведение, роман, повесть, рассказ, пьеса, поэма, сборник).
// Книга опознаётся в Wikidata (CC0, решение владельца 23.09: новое — только оттуда). Итог — .cache/book-popular.json:
// { at, books: [{ qid, title, author, year, views, months, links, had }] } по убыванию спроса; недостающие заводит
// tools/build-book-base.mts (источник 6). Кэш опознания — .cache/book-popular.wd.json.
//
// 17.10 (волна В): классы — не только прямой P31. Формы (роман, повесть, рассказ, пьеса, поэма, стихотворение) — с
// подклассами (P279*: «исторический роман», «драматическая поэма», «литературная сказка»), но без шума дерева: гимны,
// анекдоты, мюзиклы, телепьесы, инкунабулы — мимо (`CLASS_NOISE`). Добавлены драматическое произведение, повесть
// (Q12799318 — второй элемент «повести» в ru-разделе), поэмы, серия романов; сказка — только литературная, с автором
// (P50): народная без автора — не книга для подбора. Убрана «фильмография» Q1371849 — из-за неё в справочник книг
// попали 18 «Фильмографий» (Тома Круза, Де Ниро…, с канона от 10 разделов); после пересборки build-book-base их нет —
// bookBase перегенерируется целиком. Манга, комиксы, ранобэ — не берём (решение владельца 17.10): их классы с
// подклассами исключены и в запросе, и меткой класса после.
//   --out FILE — итог не в .cache/book-popular.json (замер, не трогая вход build-book-base); «у нас» (`had`) — по
// справочнику без истории владельца и демо-каталога (tools/base-have.mts)
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { baseHave } from './base-have.mts';
import { withheldWorks } from '../src/mocks/withheldWorks.ts';

const argv = process.argv.slice(2);
const opt = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const MIN_LINKS = Number(opt('--min-links') ?? 60);
const FRESH = argv.includes('--fresh');
const OUT = opt('--out') ?? '.cache/book-popular.json';
const UA = 'recomend/0.1 (https://github.com/dmitry00-00/Recommend)';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Классы письменного произведения (P31): литературное произведение, драматическое произведение, сборник рассказов и
 *  стихов, цикл, серия романов, книга — напрямую (их подклассы — рецензии, монографии, словари, комиксы); формы — с
 *  подклассами (`FORMS`, ниже). Голое «письменное произведение» не берём — так помечены и статьи, и законы.
 *  17.10: − Q1371849 «фильмография» (это список фильмов актёра, не книга). */
const DIRECT = ['Q7725634', 'Q116476516', 'Q1279564', 'Q12106333', 'Q277759', 'Q1667921', 'Q571', 'Q17518870'];
/** роман, повесть (два элемента), рассказ, пьеса, стихотворение, повествовательная поэзия, поэма-эпос */
const FORMS = ['Q8261', 'Q149537', 'Q12799318', 'Q49084', 'Q25379', 'Q5185279', 'Q474090', 'Q37484'];
/** манга, комикс, ранобэ (решение владельца 17.10: не берём) — с подклассами */
const COMIC_ROOTS = ['Q8274', 'Q21198342', 'Q1004', 'Q1760610', 'Q14406742', 'Q838795', 'Q213369', 'Q725377', 'Q747381', 'Q104213567'];
/** сказка: народная без автора — мимо, литературная (с P50) — книга */
const TALE_ROOT = 'Q699';
/** шум дерева подклассов (замер 17.10: у «стихотворения» 492 подкласса, у «пьесы» 199): гимны и песни, анекдоты,
 *  мюзиклы и скетчи, теле- и радиопьесы, инкунабулы и Библия Гутенберга, веб- и мобильные романы, манга */
const CLASS_NOISE = /hymn|anthem|song|chant|psalm|chorale|antiphon|motet|cantata|madrigal|theotokion|liturg|prayer|bible|gospel|incunab|block book|joke|anecdote|tunnel|passage|mirabilia|musical|opera|ballet|dance|sketch|skit|saturday night|monty python|television|radio|film|eiga|teleplay|festival|shadow|puppet|light novel|graphic novel|web novel|cell phone|blog|microblog|email novel|manga|comic|manhwa|webtoon|pornograph|housewife porn|lost |chronology of/i;
const CLASSES_FILE = '.cache/book-classes.json';
type Row = Record<string, { value: string } | undefined>;
async function sparql(query: string): Promise<Row[] | undefined> {
  for (let a = 0; a < 4; a++) {
    const r = await fetch('https://query.wikidata.org/sparql', {
      method: 'POST', body: new URLSearchParams({ query }),
      headers: { 'User-Agent': UA, Accept: 'application/sparql-results+json', 'Content-Type': 'application/x-www-form-urlencoded' },
    }).catch(() => undefined);
    if (r?.ok) { const j = await r.json().catch(() => undefined) as { results: { bindings: Row[] } } | undefined; if (j) return j.results.bindings; }
    await sleep(3000 * (a + 1));
  }
  return undefined;
}
const lit = (t: string) => `"${t.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"@ru`;
const qidOf = (u?: { value: string }) => u?.value.split('/').pop();

// ─── классы (17.10): формы с подклассами, без шума; манга и комиксы, народная сказка — отдельно ───────────
type Classes = { sig: string; allowed: string[]; comics: string[]; tales: string[] };
const SIG = JSON.stringify([DIRECT, FORMS, COMIC_ROOTS, TALE_ROOT, CLASS_NOISE.source]);
async function subclasses(root: string, noise?: RegExp): Promise<string[]> {
  const rows = await sparql(`SELECT DISTINCT ?c ?l WHERE { ?c wdt:P279* wd:${root}. OPTIONAL { ?c rdfs:label ?l FILTER(lang(?l) = 'en') } }`);
  if (!rows) throw new Error(`подклассы ${root} не получены`);
  await sleep(1000);
  // без английской метки — почти всегда шум (локальные жанры без описания); корень оставляем всегда
  return rows.filter((b) => qidOf(b.c) === root || (b.l && !(noise?.test(b.l.value)))).map((b) => qidOf(b.c)!);
}
let cls: Classes | undefined = !FRESH && existsSync(CLASSES_FILE) ? JSON.parse(readFileSync(CLASSES_FILE, 'utf8')) as Classes : undefined;
if (cls?.sig !== SIG) {
  const comics = new Set((await Promise.all(COMIC_ROOTS.map((r) => subclasses(r)))).flat());
  const tales = await subclasses(TALE_ROOT);
  const forms: string[] = [];
  for (const r of FORMS) forms.push(...await subclasses(r, CLASS_NOISE));
  const allowed = [...new Set([...DIRECT, ...forms])].filter((c) => !comics.has(c));
  cls = { sig: SIG, allowed, comics: [...comics], tales };
  writeFileSync(CLASSES_FILE, JSON.stringify(cls));
}
const BOOK = cls.allowed;
const COMICS = new Set(cls.comics), TALES = new Set(cls.tales), ALLOWED = new Set(BOOK);
console.error(`классов книги: ${BOOK.length} (напрямую ${DIRECT.length}, формы с подклассами); манга и комиксы — ${COMICS.size}, сказки — ${TALES.size}`);

// ─── спрос: месячные топы русской Википедии ─────────────────────────────────
const views = new Map<string, { views: number; months: number }>();
for (const f of readdirSync('.cache/wiki-top').filter((f) => /^\d{4}-\d{2}\.json$/.test(f))) {
  for (const { article, views: v } of JSON.parse(readFileSync(`.cache/wiki-top/${f}`, 'utf8')) as { article: string; views: number }[]) {
    if (/^[^:_]+:[^_]/.test(article)) continue;   // служебные: «Служебная:Поиск», «Файл:…»
    const t = article.replace(/_/g, ' ');
    const p = views.get(t) ?? { views: 0, months: 0 };
    p.views += v; p.months += 1; views.set(t, p);
  }
}
// фильмы и сериалы из тех же топов grow-film-base уже опознал — книгами они не будут
const films = existsSync('.cache/grow-film-base.wd.json') ? JSON.parse(readFileSync('.cache/grow-film-base.wd.json', 'utf8')) as Record<string, { none?: true }> : {};
type Found = { qid: string; title: string; author?: string; year?: number; links: number };
const CACHE = '.cache/book-popular.wd.json';
const cache: Record<string, Found | { none: true }> = !FRESH && existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : {};
// классы сменились (17.10) — «не книга» спрашиваем заново: пьеса или поэма прежде были «не книгой»
const SIG_KEY = '_classes';
if ((cache as Record<string, unknown>)[SIG_KEY] !== SIG) for (const [t, c] of Object.entries(cache)) if ('none' in c) delete cache[t];
(cache as Record<string, unknown>)[SIG_KEY] = SIG;
const todo = [...views.keys()].filter((t) => !cache[t] && !(films[t] && !films[t].none));
console.error(`статей в топах: ${views.size}, к опознанию: ${todo.length}`);
const FIELDS = `OPTIONAL { ?f rdfs:label ?ru FILTER(lang(?ru) = 'ru') } OPTIONAL { ?f wdt:P50 ?au . ?au rdfs:label ?aun FILTER(lang(?aun) = 'ru') }
    OPTIONAL { ?f wdt:P577 ?date } ?f wikibase:sitelinks ?links`;
const read = (b: Row, prev?: Found): Found => {
  const year = Number(b.date?.value.slice(0, 4)) || undefined;
  return {
    qid: qidOf(b.f)!, title: prev?.title ?? b.ru?.value ?? b.t?.value ?? '', links: Number(b.links?.value ?? 0),
    author: prev?.author ?? b.aun?.value, year: prev?.year && year ? Math.min(prev.year, year) : prev?.year ?? year,
  };
};
for (let i = 0; i < todo.length; i += 200) {
  const batch = todo.slice(i, i + 200);
  const rows = await sparql(`SELECT ?t ?f ?ru ?aun ?date ?links WHERE {
    VALUES ?t { ${batch.map(lit).join(' ')} }
    ?a schema:name ?t; schema:isPartOf <https://ru.wikipedia.org/>; schema:about ?f.
    VALUES ?c { ${BOOK.map((q) => `wd:${q}`).join(' ')} } ?f wdt:P31 ?c. ${FIELDS} }`);
  if (!rows) { console.error(`  пачка ${i / 200} не получена`); continue; }
  const got = new Map<string, Found>();
  for (const b of rows) { const t = b.t!.value; got.set(t, read(b, got.get(t))); }
  for (const t of batch) cache[t] = got.get(t) ?? { none: true };
  writeFileSync(CACHE, JSON.stringify(cache));
  await sleep(1000);
}

// ─── канон: книги с русской статьёй и статьями во многих разделах ─────────────
const canon = new Map<string, Found>();
// крупные классы — по одному, подклассы форм — пачками по 150 (их сотни, у большинства по нескольку книг)
const big = [...DIRECT, ...FORMS].filter((c) => ALLOWED.has(c));
const rest = BOOK.filter((c) => !big.includes(c));
const groups = [...big.map((c) => [c]), ...Array.from({ length: Math.ceil(rest.length / 150) }, (_, i) => rest.slice(i * 150, i * 150 + 150))];
// 18.10: крупный класс (литературное произведение от 10 разделов) под нагрузкой Wikidata не укладывается в минуту — ещё два
// круга с паузой в минуту; не получен и тогда — итог не пишем (без канона build-book-base выкинул бы из справочника тысячи
// книг: замер 18.10 — канон 425 вместо 4017). --allow-partial — писать всё равно
let canonLost = 0;
for (const g of groups) {
  const ask = () => sparql(`SELECT ?f ?ru ?aun ?date ?links WHERE {
    VALUES ?c { ${g.map((q) => `wd:${q}`).join(' ')} } ?f wdt:P31 ?c; wikibase:sitelinks ?links. FILTER(?links >= ${MIN_LINKS})
    ?a schema:about ?f; schema:isPartOf <https://ru.wikipedia.org/>. ${FIELDS} }`);
  let rows = await ask();
  for (let round = 0; !rows && round < 2; round++) { console.error(`  канон ${g[0]}: не получен, ещё раз через минуту`); await sleep(60000); rows = await ask(); }
  if (!rows) { canonLost++; console.error(`  канон ${g[0]}${g.length > 1 ? ` и ещё ${g.length - 1}` : ''} не получен`); continue; }
  for (const b of rows) { const q = qidOf(b.f)!; canon.set(q, read(b, canon.get(q))); }
  await sleep(1000);
}

// ─── итог: что из этого у нас есть ──────────────────────────────────────────
// «у нас» — справочник, что видят сервер и новичок: без истории владельца и демо-каталога (17.10)
const have = baseHave();
const books = new Map<string, Found & { views: number; months: number; had: boolean }>();
for (const [t, c] of Object.entries(cache)) {
  if (t === SIG_KEY || 'none' in c) continue;
  const v = views.get(t);
  if (!v) continue;
  const prev = books.get(c.qid);
  books.set(c.qid, { ...c, views: (prev?.views ?? 0) + v.views, months: Math.max(prev?.months ?? 0, v.months), had: have.has(`wd:${c.qid}`) });
}
for (const [q, c] of canon) if (!books.has(q)) books.set(q, { ...c, views: 0, months: 0, had: have.has(`wd:${q}`) });
// не литература для подбора: священные тексты и книги Библии, списки, пророчества и предсказания (эзотерика —
// отдельной категорией, решение владельца 11.10), манифесты и законы — по английским меткам классов (P31)
// 17.10: и гимны, молитвы, литургические секвенции — у «стихотворения» с подклассами их десятки («Lauda Sion», «Игдал»)
const NOT_FICTION = /relig|sacred|scripture|bible|gospel|epistle|biblical|torah|quran|sutra|veda|\blist\b|prophec|predict|manifesto|law|constitution|treaty|encyclop|dictionary|grimoire|occult|talmud|mishnah|record|almanac|reference work|yearbook|hymn|liturg|prayer|psalm|chant|antiphon/i;
// у части священных текстов класс голый «literary work» — по элементу: Талмуд
const NOT_FICTION_IDS = new Set(['Q43290']);
const classes = new Map<string, string[]>();
/** P31 элемента (id) и есть ли автор (P50) — для правил 17.10: манга и комиксы, народная сказка, «не книга» */
const p31 = new Map<string, string[]>(), authored = new Set<string>();
const ids = [...books.keys()];
for (let i = 0; i < ids.length; i += 200) {
  const part = ids.slice(i, i + 200).map((q) => `wd:${q}`).join(' ');
  const rows = await sparql(`SELECT ?f ?l WHERE { VALUES ?f { ${part} }
    { ?f wdt:P31 ?c } UNION { ?f wdt:P136 ?c } ?c rdfs:label ?l FILTER(lang(?l) = 'en') }`) ?? [];
  for (const b of rows) { const q = qidOf(b.f)!; classes.set(q, [...(classes.get(q) ?? []), b.l!.value]); }
  await sleep(800);
  const cs = await sparql(`SELECT ?f ?c ?au WHERE { VALUES ?f { ${part} } { ?f wdt:P31 ?c } UNION { ?f wdt:P50 ?au } }`) ?? [];
  for (const b of cs) {
    const q = qidOf(b.f)!;
    if (b.c) p31.set(q, [...(p31.get(q) ?? []), qidOf(b.c)!]);
    if (b.au) authored.add(q);
  }
  await sleep(800);
}
// манга, комиксы, ранобэ (решение владельца 17.10) — по классу P31 с подклассами. Не по меткам жанров (P136): «comic
// novel» — комический роман («Торговец пушками», «В основном безвредна», «Дневник Бриджит Джонс» отсеивались бы)
const comicOf = (q: string) => (p31.get(q) ?? []).some((c) => COMICS.has(c));
// сказка без автора — народная: «Колобок», «Репка» — не книга для подбора; литературная («Сказка о рыбаке и рыбке») — с P50
const folkTale = (q: string) => !authored.has(q) && (p31.get(q) ?? []).some((c) => TALES.has(c)) && !(p31.get(q) ?? []).some((c) => ALLOWED.has(c) && !TALES.has(c));
// старый кэш опознания знал прежние классы — книга должна остаться в нынешних («фильмография» Q1371849 — уже нет)
const outOfClass = (q: string) => p31.has(q) && !(p31.get(q) ?? []).some((c) => ALLOWED.has(c));
const why = (b: Found) => (classes.get(b.qid) ?? []).some((l) => NOT_FICTION.test(l)) || /^Список /.test(b.title) || NOT_FICTION_IDS.has(b.qid) || `wd:${b.qid}` in withheldWorks ? 'не литература'
  : comicOf(b.qid) ? 'манга и комиксы' : folkTale(b.qid) ? 'народная сказка' : outOfClass(b.qid) || /^Фильмография /.test(b.title) ? 'не тот класс' : undefined;
const skipped = [...books.values()].map((b) => ({ b, why: why(b) })).filter((x) => x.why);
for (const { b } of skipped) books.delete(b.qid);
const byWhy = new Map<string, Found[]>();
for (const { b, why: w } of skipped) byWhy.set(w!, [...(byWhy.get(w!) ?? []), b]);
for (const [w, bs] of byWhy) console.error(`${w}: ${bs.length} — ${bs.slice(0, 12).map((b) => b.title).join(', ')}…`);
const list = [...books.values()].filter((b) => b.title && !/^Q\d+$/.test(b.title))
  .sort((a, b) => b.views - a.views || b.links - a.links);
const top = list.filter((b) => b.views > 0), cn = list.filter((b) => b.views === 0);
console.log(`книги в топах русской Википедии: ${top.length}, у нас ${top.filter((b) => b.had).length}; канон (от ${MIN_LINKS} разделов): ${cn.length}, у нас ${cn.filter((b) => b.had).length}`);
console.log('нет у нас, по спросу:'); for (const b of top.filter((b) => !b.had).slice(0, 25)) console.log(`  ${b.title} — ${b.author ?? '?'} (${b.year ?? '?'}): ${Math.round(b.views / 1000)} тыс., ${b.months} мес.`);
console.log('нет у нас, канон:'); for (const b of cn.filter((b) => !b.had).slice(0, 15)) console.log(`  ${b.title} — ${b.author ?? '?'} (${b.year ?? '?'}): ${b.links} разделов`);
if (canonLost && !argv.includes('--allow-partial')) {
  console.error(`канон получен не весь (${canonLost} из ${groups.length} запросов) — ${OUT} не пишу; повторить позже или --allow-partial`);
  process.exit(2);
}
writeFileSync(OUT, JSON.stringify({ at: new Date().toISOString(), books: list }));
console.log(`→ ${OUT}`);
