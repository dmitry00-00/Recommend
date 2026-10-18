// Канон копий справочника → src/mocks/workAliases.ts (17.10, волна А проверки дублей; правило главной копии — владелец).
//
// Одна вещь лежит в справочнике несколькими карточками: история владельца (userHistory, u-kp…), присланный список
// (userWatched, l-tmdb…), кандидаты (c-…), каталог (w…), filmBase (f-tmdb…), filmBaseWiki (f-wd…). Поиск показывал две
// строки, «Видел» стоял на одной копии, а лента предлагала другую; вкус считал одну вещь дважды. Здесь копии склеиваются
// в группы и у группы выбирается главная: таблица «лишний id → главный id». По ней клиент (src/lib/canon.ts) сводит всё,
// что приходит по id, к главной копии, а сервер переносит записи людей (worker/workAliases.ts).
//
// Склейка — как у проверки дублей 17.10 (scratchpad dupes/find_dupes.py): общий элемент Wikidata, IMDb, TMDb внутри
// вида, Кинопоиск, работа Open Library / ISBN у книг; и название + год ±1 + тот же автор, если ключи не спорят.
// Не склеиваем: книгу с фильмом по одному элементу (ошибка резолва), издания с разными элементами книги (сборник ≠
// роман), группы, где спорят ключи, годы (разница больше года) или вид, — такие идут в отчёт, а не в таблицу.
//
// Главная копия (решение владельца 17.10): **общая**. Личная (userHistory, userWatched — карточки истории владельца) не
// бывает главной, если в группе есть общая: на сервере и у нового человека личных карточек нет. Среди общих — с
// разметкой (своя > разметка владельца > черновик), с разборами, прежняя главная (чтобы ночная пересборка не гоняла
// записи людей туда-обратно), с большим числом ключей, полнее, с картинкой, с авторами; дальше — порядок модулей.
// Ключи и разметку лишних копий главная получает на клиенте при загрузке справочника (src/api/index.ts, `foldCopies`).
//
// Таблица только растёт по вещам: лишний id, карточки которого больше нет нигде, остаётся (записи людей уже на
// главной, а старый клиент может прислать старый id). Лишний id, который снова отдельная вещь (ключи починили), уходит.
//
//   npx tsx tools/work-aliases.mts [--dry] [--compare <aliases.json>]
//
// Ночной сбор (tools/collect.mts) — шаг после роста справочника (expand-film-base / grow-from-channels / tv-programs),
// до индексов разборов: `step('канон копий', ...tsx('tools/work-aliases.mts'), { optional: true })`. Таблица едет со
// сборкой клиента и сервера (worker.cjs) — вступает в силу с выкладкой, сервер переносит записи при первом запросе.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// ─── вход: карточки и побочные справочники ─────────────────────────────────────────────────────────────────────
export interface AliasCard {
  src: string; id: string; type?: string; format?: string; title?: string; originalTitle?: string; year?: number;
  creators?: string[]; credits?: [string | undefined, string, string][];
  ext?: Ext; ops: number; level: number; img: boolean; blurb: boolean; countries: number; genres: number;
  runtime?: number; pages?: number; regs: number;
}
export interface Ext { tmdb?: number; imdb?: string; wikidata?: string; kinopoisk?: number; openLibrary?: string; isbn?: string[] }
export interface AliasSide {
  externalIds: Record<string, Ext>;
  bookWorks: Record<string, { olw?: string; wd?: string }>;
  workCredits: Record<string, string>;
  people: Record<string, [string?, string?]>;
  analyses: Record<string, number>;
  workDetailAnalyses: Record<string, number>;
  draftFilm: Set<string>; draftSeries: Set<string>; draftBook: Set<string>; userAnn: Set<string>;
  baseMedia: Record<string, boolean>; bookMedia: Record<string, boolean>; catalogMedia: Set<string>;
}

/** Порядок, в котором приложение кладёт карточки в knownWorks / filmBaseWiki (src/api/index.ts). */
export const ORDER = ['index.works', 'userHistory', 'candidates', 'userWatched', 'filmBase', 'filmBaseWiki', 'filmBaseMarkup',
  'filmBaseCurated', 'seriesBase', 'filmBasePopular', 'filmBaseWorld', 'filmBaseChannels', 'seriesBaseWiki',
  'filmBaseLinks', 'filmBaseTail', 'filmBaseMore', 'bookBase'];
const RANK = new Map(ORDER.map((m, i) => [m, i]));
const rank = (src: string) => RANK.get(src) ?? 99;
/** Личные модули владельца: на сервере и у «чистого новичка» их нет в справочнике. */
export const PERSONAL = new Set(['userHistory', 'userWatched']);
const MARK_RANK = { own: 3, user: 2, draft: 1, '': 0 } as const;
type Mark = keyof typeof MARK_RANK;

// ─── нормализация названий и имён ──────────────────────────────────────────────────────────────────────────────
/** normalizeTitle из src/lib/import/match.ts: регистр, диакритика, ё, пунктуация, артикли. */
export function normTitle(s?: string): string {
  if (!s) return '';
  const t = s.normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]+/gu, ' ');
  return t.split(' ').filter((x) => x && !['the', 'a', 'an'].includes(x)).join(' ');
}
function nameKey(s?: string): string {
  const t = (s ?? '').toLowerCase().replace(/ё/g, 'е').replace(/й/g, '\u0001').normalize('NFD').replace(/\p{M}+/gu, '').replace(/\u0001/g, 'й');
  return t.replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}
const TR: Record<string, string> = Object.fromEntries([
  ...'абвгдезийклмнопрстуфхцы'.split('').map((ch, i) => [ch, ['a', 'b', 'v', 'g', 'd', 'e', 'z', 'i', 'y', 'k', 'l', 'm', 'n', 'o', 'p', 'r', 's', 't', 'u', 'f', 'kh', 'ts', 'y'][i]]),
  ['ж', 'zh'], ['ч', 'ch'], ['ш', 'sh'], ['щ', 'sh'], ['ъ', ''], ['ь', ''], ['э', 'e'], ['ю', 'yu'], ['я', 'ya'],
]);
const translit = (s: string) => [...s].map((ch) => TR[ch] ?? ch).join('');

// ─── произведения по id ────────────────────────────────────────────────────────────────────────────────────────
interface Work {
  id: string; kind: string; title: string; orig: string; year: number; srcs: string[]; ext: Ext; qid?: string;
  keys: string[]; pk?: string; pids: Set<string>; surn: Set<string>; names: Set<string>; mark: Mark; analyses: number;
  img: boolean; credits: boolean; full: number; nkeys: number;
}
const kindOf = (c: AliasCard) => (c.type === 'series' || c.format === 'series' ? 'series' : c.type || 'film');

function workKeysOf(kind: string, e: Ext): string[] {
  if (kind === 'series') return e.imdb ? [`imdb:${e.imdb}`] : [];
  if (kind === 'book') return [...(e.wikidata ? [`wd:${e.wikidata}`] : []), ...(e.openLibrary ? [`olw:${e.openLibrary}`] : []), ...(e.isbn ?? []).map((i) => `isbn:${i}`)];
  if (e.tmdb != null) return [`tmdb:${e.tmdb}`];
  return (e.isbn ?? []).map((i) => `isbn:${i}`);
}

function worksOf(cards: AliasCard[], side: AliasSide): Map<string, Work> {
  const byId = new Map<string, AliasCard[]>();
  for (const c of [...cards].sort((a, b) => rank(a.src) - rank(b.src))) byId.set(c.id, [...(byId.get(c.id) ?? []), c]);
  const extOf = (c: AliasCard): Ext => {
    const e: Ext = { ...(c.ext ?? side.externalIds[c.id] ?? {}) };
    if (e.isbn?.length && !(e.wikidata && e.openLibrary)) {
      const hit = e.isbn.map((i) => side.bookWorks[i]).find(Boolean);
      if (hit) {
        if (!e.openLibrary && hit.olw) e.openLibrary = hit.olw;
        if (!e.wikidata && hit.wd) e.wikidata = hit.wd;
      }
    }
    return e;
  };
  // разметка владельца по TMDb: присланный профиль (l-tmdb…) того же фильма — тоже «размечен владельцем»
  const userTmdb = new Set<number>();
  for (const id of side.userAnn) for (const c of byId.get(id) ?? []) { const t = extOf(c).tmdb; if (t != null) userTmdb.add(t); }
  const out = new Map<string, Work>();
  for (const [id, copies] of byId) {
    const c0 = copies[0];
    const kind = kindOf(c0);
    const e: Ext = {};
    for (const c of copies) for (const [k, v] of Object.entries(extOf(c))) if (v != null && (e as Record<string, unknown>)[k] == null) (e as Record<string, unknown>)[k] = v;
    const qid = e.wikidata ?? (/-wd(\d+)$/.exec(id) ? `Q${/-wd(\d+)$/.exec(id)![1]}` : undefined);
    const keys = workKeysOf(kind, e);
    const pk = keys[0];
    const pids = new Set<string>();
    const names = new Set<string>();
    for (const c of copies) {
      for (const [pid, role, nm] of c.credits ?? []) {
        if (role === 'director' || role === 'creator' || role === 'author') { if (pid) pids.add(pid); if (nm) names.add(nm); }
      }
      for (const nm of c.creators ?? []) names.add(nm);
    }
    for (const pair of (pk ? side.workCredits[pk] ?? '' : '').split(',')) {
      const [pid, code] = pair.split(':');
      if (pid && ['d', 'c', 'a'].includes(code)) pids.add(pid);
    }
    for (const pid of pids) for (const nm of side.people[pid] ?? []) if (nm) names.add(nm);
    const surn = new Set<string>();
    for (const nm of names) {
      const toks = nameKey(nm).split(' ').filter((t) => t.length >= 3);
      if (toks.length) { const last = toks[toks.length - 1]; surn.add(last); surn.add(translit(last).slice(0, 5)); }
    }
    const own = copies.some((c) => c.ops && c.level);
    const draft = kind === 'film' ? e.tmdb != null && side.draftFilm.has(`tmdb:${e.tmdb}`)
      : kind === 'series' ? Boolean(pk && side.draftSeries.has(pk)) : keys.some((k) => side.draftBook.has(k));
    const user = side.userAnn.has(id) || (kind === 'film' && e.tmdb != null && userTmdb.has(e.tmdb));
    const mark: Mark = own ? 'own' : user ? 'user' : draft ? 'draft' : '';
    const analyses = keys.reduce((n, k) => n + (side.analyses[k] ?? 0), 0) + (side.workDetailAnalyses[id] ?? 0);
    const img = copies.some((c) => c.img) || Boolean(side.baseMedia[id]) || Boolean(pk && side.bookMedia[pk]) || side.catalogMedia.has(id);
    const credits = copies.some((c) => c.credits?.length) || Boolean(pk && side.workCredits[pk]);
    const full = [c0.originalTitle, c0.year, c0.creators?.length, c0.countries, c0.genres, c0.runtime || c0.pages,
      copies.some((c) => c.blurb), img, c0.regs].filter(Boolean).length;
    out.set(id, {
      id, kind, title: c0.title ?? '', orig: c0.originalTitle ?? '', year: c0.year ?? 0, srcs: copies.map((c) => c.src), ext: e, qid,
      keys, pk, pids, surn, names, mark, analyses, img, credits, full,
      nkeys: [e.tmdb != null, e.imdb, qid].filter(Boolean).length,
    });
  }
  return out;
}

// ─── склейка ───────────────────────────────────────────────────────────────────────────────────────────────────
export interface AliasGroup { main: string; why: string; copies: string[]; issues: string[]; how: string[] }

// ─── ручной список «точно одна вещь» ───────────────────────────────────────────────────────────────────────────
/** Пары, которые склейка по ключам не берёт, а проверка показала одну вещь (17.10, волна Б: разбор 33 подозрительных
 *  пар «тот же автор, год ±1–3, ключи разные» по Wikidata и TMDb — scratchpad dupes/suspects.tsv; остальные 20 — тёзки:
 *  ремейки, версии на другом языке, сборник и рассказ). Обычно ключ одной копии ведёт на другую вещь (TMDb-тёзка) или
 *  элемент Wikidata — издание, а не произведение. Пара — [лишняя, главная, причина]: главная — копия с верным ключом,
 *  мимо общего правила (`pickMain` выбрал бы «Лейли и Меджнун» с элементом легенды — у обеих черновики); расхождение
 *  ключей в такой группе — не спор (оно и есть ошибка). Пополнять — сюда же, с причиной. */
export const MANUAL_SAME: readonly (readonly [string, string, string])[] = [
  ['f-tmdb517104', 'f-wd51834363', '«Холодная война» Павликовского (2018): TMDb 517104 — американская комедия Cold War 2017 (tt5537300), у фильма — 440298 (tt6543652)'],
  ['f-tmdb817962', 'f-wd89186326', '«Коллектив» Нанау (2019): TMDb 817962 — лыжная документалка The Collective (tt11338786), у фильма — 618363 (tt10706602)'],
  ['b-wd70469944', 'b-wd28306', '«Танец с драконами»: Q70469944 — издание (P31 Q3331189, P629 = Q28306)'],
  ['b-wd673156', 'b-wd15555061', '«Лейли и Меджнун» Низами: Q673156 — легенда вообще (Низами ей не автор), поэма — Q15555061; Open Library общий'],
  // 18.10 (волна В): спорные группы после роста справочника
  ['f-wd97314140', 'f-wd30887826', '«Дело Сухово-Кобылина» Пчёлкина (1991): два элемента Wikidata на один фильм (общий IMDb tt0101079); главная — с TMDb 727720'],
  ['u-kp910353', 'f-wd20716882', '«Выстрел в пустоту» (Shot Caller, 2017): в истории владельца год 2015 — ошибка импорта; ключи TMDb 339692, IMDb, Кинопоиск 910353 общие'],
  ['b-wd188538', 'w16', '«Мастер и Маргарита»: в демо-каталоге год 1967 (первая публикация), в справочнике книг 1928 (начало работы) — одна книга; главная — с разметкой (own)'],
];

function groupsOf(works: Map<string, Work>, manual: readonly (readonly [string, string, string])[] = MANUAL_SAME): AliasGroup[] {
  const parent = new Map<string, string>([...works.keys()].map((k) => [k, k]));
  const members = new Map<string, string[]>([...works.keys()].map((k) => [k, [k]]));
  const find = (x: string): string => {
    let r = x;
    while (parent.get(r) !== r) r = parent.get(r)!;
    while (parent.get(x) !== r) { const n = parent.get(x)!; parent.set(x, r); x = n; }
    return r;
  };
  const how = new Map<string, Set<string>>();
  const union = (a: string, b: string, why: string) => {
    const k = a < b ? `${a}\t${b}` : `${b}\t${a}`;
    how.set(k, (how.get(k) ?? new Set()).add(why));
    const ra = find(a), rb = find(b);
    if (ra === rb) return;
    parent.set(rb, ra);
    members.set(ra, [...members.get(ra)!, ...members.get(rb)!]);
    members.delete(rb);
  };
  const idx = new Map<string, string[]>();
  const put = (k: string, id: string) => idx.set(k, [...(idx.get(k) ?? []), id]);
  for (const w of works.values()) {
    const e = w.ext;
    if (w.qid) put(`a\t${w.qid}`, w.id);
    if (e.imdb) put(`b\t${e.imdb}`, w.id);
    if (e.tmdb != null && (w.kind === 'film' || w.kind === 'series')) put(`c\t${w.kind}\t${e.tmdb}`, w.id);
    if (e.kinopoisk != null) put(`kp\t${e.kinopoisk}`, w.id);
    if (w.kind === 'book') {
      if (e.openLibrary) put(`book\tolw\t${e.openLibrary}`, w.id);
      for (const i of e.isbn ?? []) put(`book\tisbn\t${i}`, w.id);
    }
  }
  for (const [k, raw] of idx) {
    const ids = [...new Set(raw)].sort();
    if (ids.length < 2) continue;
    const kinds = new Set(ids.map((i) => works.get(i)!.kind));
    // элемент Wikidata у фильма и книги — ошибка резолва, не одна вещь
    if (kinds.has('book') && kinds.size > 1) continue;
    // издания с разными элементами книги (сборник и роман из него) — не склеиваем
    if (k.startsWith('book\t') && new Set(ids.map((i) => works.get(i)!.qid).filter(Boolean)).size > 1) continue;
    for (const x of ids.slice(1)) union(ids[0], x, k.split('\t')[0]);
  }
  // ручной список «точно одна вещь» (17.10, волна Б)
  const manualIds = new Set<string>();
  for (const [a, b] of manual) if (works.has(a) && works.has(b)) { union(a, b, 'm'); manualIds.add(a).add(b); }
  const compKeys = (ms: string[]) => ({
    t: new Set(ms.map((m) => works.get(m)!).filter((w) => w.kind !== 'book' && w.ext.tmdb != null).map((w) => w.ext.tmdb)),
    i: new Set(ms.map((m) => works.get(m)!.ext.imdb).filter(Boolean)),
    q: new Set(ms.map((m) => works.get(m)!.qid).filter(Boolean)),
  });
  const disjoint = <T,>(a: Set<T>, b: Set<T>) => a.size > 0 && b.size > 0 && ![...a].some((x) => b.has(x));
  const conflict = (ma: string[], mb: string[]) => {
    const A = compKeys(ma), B = compKeys(mb);
    return disjoint(A.t, B.t) || disjoint(A.i, B.i) || disjoint(A.q, B.q);
  };
  // (г) название + год ±1 + автор, внутри вида
  const byTitle = new Map<string, Set<string>>();
  for (const w of works.values()) {
    for (const t of new Set([normTitle(w.title), normTitle(w.orig)])) {
      if (!t) continue;
      const k = `${w.kind}\t${t}`;
      byTitle.set(k, (byTitle.get(k) ?? new Set()).add(w.id));
    }
  }
  for (const set of byTitle.values()) {
    if (set.size < 2 || set.size > 60) continue;
    const ids = [...set].sort();
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const A = works.get(ids[i])!, B = works.get(ids[j])!;
        if (find(A.id) === find(B.id)) continue;
        if (!A.year || !B.year || Math.abs(A.year - B.year) > 1) continue;
        if (conflict(members.get(find(A.id))!, members.get(find(B.id))!)) continue;
        const same = [...A.pids].some((p) => B.pids.has(p)) || [...A.surn].some((s) => B.surn.has(s));
        if (same) union(A.id, B.id, 'd');
      }
    }
  }
  const out: AliasGroup[] = [];
  for (const ms of members.values()) {
    if (ms.length < 2) continue;
    const g = [...ms].sort((a, b) => rank(works.get(a)!.srcs[0]) - rank(works.get(b)!.srcs[0]) || (a < b ? -1 : 1));
    const { t, i, q } = compKeys(g);
    const years = g.map((x) => works.get(x)!.year).filter(Boolean);
    const issues: string[] = [];
    // в ручной группе ключи расходятся по определению: ключ одной копии и есть ошибка
    const byHand = g.some((x) => manualIds.has(x));
    if (t.size > 1 && !byHand) issues.push('tmdb≠');
    if (i.size > 1 && !byHand) issues.push('imdb≠');
    if (q.size > 1 && !byHand) issues.push('qid≠');
    // 18.10: и годы — ручная пара проверена человеком («Мастер и Маргарита»: 1928 — начало работы, 1967 — публикация)
    if (!byHand && years.length && Math.max(...years) - Math.min(...years) > 1) issues.push(`годы ${Math.min(...years)}–${Math.max(...years)}`);
    if (new Set(g.map((x) => works.get(x)!.kind)).size > 1) issues.push('вид≠');
    const hows = new Set<string>();
    for (const a of g) for (const b of g) if (a < b) for (const h of how.get(`${a}\t${b}`) ?? []) hows.add(h);
    out.push({ main: '', why: '', copies: g, issues, how: [...hows].sort() });
  }
  return out;
}

// ─── главная копия ─────────────────────────────────────────────────────────────────────────────────────────────
export interface MainFacts { id: string; srcs: string[]; mark: Mark; analyses: number; nkeys: number; full: number; img: boolean; credits: boolean }

/** Главная копия группы по правилу владельца (17.10): общая > личная; среди общих — разметка, разборы, прежняя главная,
 *  ключи, полнота, картинка, авторы, порядок модулей. `prev` — прежняя главная (липкость: ночная пересборка не гоняет
 *  записи людей с копии на копию, пока у новой нет лучшей разметки или разборов). */
export function pickMain(group: MainFacts[], prev?: string): { main: string; why: string } {
  const score = (w: MainFacts): number[] => [
    w.srcs.every((s) => PERSONAL.has(s)) ? 0 : 1,
    w.srcs.includes('userWatched') ? 0 : 1,
    MARK_RANK[w.mark],
    w.analyses > 0 ? 1 : 0,
    w.id === prev ? 1 : 0,
    w.nkeys, w.full, w.img ? 1 : 0, w.credits ? 1 : 0,
    -rank(w.srcs[0]), -w.id.length,
  ];
  const cmp = (a: number[], b: number[]) => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i]; return 0; };
  let best = group[0];
  for (const w of group.slice(1)) if (cmp(score(w), score(best)) > 0) best = w;
  const others = group.filter((w) => w !== best);
  const personal = (w: MainFacts) => w.srcs.every((s) => PERSONAL.has(s));
  const maxMark = Math.max(...others.map((o) => MARK_RANK[o.mark]));
  const why = !personal(best) && others.some(personal) && MARK_RANK[best.mark] <= maxMark && others.some((o) => o.nkeys >= best.nkeys)
    ? 'общая (личная копия — не главная)'
    : MARK_RANK[best.mark] > maxMark ? `разметка (${best.mark})`
      : best.analyses > 0 && others.some((o) => !o.analyses) ? 'разборы'
        : best.id === prev ? 'прежняя главная'
          : others.every((o) => best.nkeys > o.nkeys) ? 'больше ключей'
            : others.every((o) => best.full > o.full) ? 'полнее' : 'порядок модулей';
  return { main: best.id, why };
}

// ─── таблица ───────────────────────────────────────────────────────────────────────────────────────────────────
export interface AliasResult { aliases: Record<string, string>; version: string; groups: AliasGroup[]; review: AliasGroup[]; kept: string[] }

/** Хэш таблицы — версия для миграции записей на сервере (worker/workAliases.ts): та же таблица — тот же хэш. */
export function aliasVersion(aliases: Record<string, string>): string {
  const sorted = Object.keys(aliases).sort().map((k) => [k, aliases[k]]);
  return createHash('sha256').update(JSON.stringify(sorted)).digest('hex').slice(0, 12);
}

export function buildAliases(cards: AliasCard[], side: AliasSide, prev: Record<string, string> = {},
  manual: readonly (readonly [string, string, string])[] = MANUAL_SAME): AliasResult {
  const works = worksOf(cards, side);
  const all = groupsOf(works, manual);
  const handMain = new Set(manual.map(([, m]) => m));
  const prevMain = new Map<string, string>();
  for (const [a, m] of Object.entries(prev)) { prevMain.set(a, m); prevMain.set(m, m); }
  const aliases: Record<string, string> = {};
  const groups: AliasGroup[] = [];
  const review: AliasGroup[] = [];
  for (const g of all) {
    const facts = g.copies.map((x) => works.get(x)!);
    const prevOf = g.copies.map((x) => prevMain.get(x)).find((m) => m && g.copies.includes(m));
    const hand = g.copies.find((x) => handMain.has(x));
    const { main, why } = hand ? { main: hand, why: 'ручная пара (верный ключ)' } : pickMain(facts, prevOf);
    g.main = main; g.why = why;
    if (g.issues.length) { review.push(g); continue; }
    groups.push(g);
    for (const x of g.copies) if (x !== main) aliases[x] = main;
  }
  // лишний id, карточки которого больше нет нигде: записи людей уже перенесены, старый клиент может прислать его —
  // остаётся, на главную по новой таблице
  const kept: string[] = [];
  const resolve = (id: string) => { let x = id; for (let n = 0; aliases[x] && n < 10; n++) x = aliases[x]; return x; };
  for (const [a, m] of Object.entries(prev)) {
    if (works.has(a) || aliases[a]) continue;
    const to = resolve(m);
    if (to !== a && works.has(to)) { aliases[a] = to; kept.push(a); }
  }
  // главная не бывает лишней: цепочки сворачиваем
  for (const a of Object.keys(aliases)) aliases[a] = resolve(aliases[a]);
  const sorted = Object.fromEntries(Object.keys(aliases).sort().map((k) => [k, aliases[k]]));
  return { aliases: sorted, version: aliasVersion(sorted), groups, review, kept };
}

export function renderAliases(r: AliasResult): string {
  const lines = Object.entries(r.aliases).map(([a, m]) => `  ${JSON.stringify(a)}: ${JSON.stringify(m)},`);
  return `// Сгенерировано tools/work-aliases.mts — руками не править (канон копий, 17.10, правило главной копии — владелец).
// Лишний id карточки → id главной копии той же вещи. Главная — общая карточка справочника; личная (история владельца
// u-kp…, присланный список l-tmdb…) главной не бывает, если есть общая. Клиент сводит по ней всё, что приходит по id
// (src/lib/canon.ts), сервер переносит записи людей на главную (worker/workAliases.ts) — по версии ниже, один раз.
// Групп: ${r.groups.length}, лишних копий: ${Object.keys(r.aliases).length}${r.kept.length ? ` (из них ${r.kept.length} — карточек больше нет)` : ''}; спорных групп (не в таблице): ${r.review.length}; ручных пар «точно одна вещь» (MANUAL_SAME): ${MANUAL_SAME.length}.
export const workAliasesVersion = ${JSON.stringify(r.version)};
export const workAliases: Readonly<Record<string, string>> = {
${lines.join('\n')}
};
`;
}

/** Прежняя таблица — из файла (без импорта модуля: сборщик мог его ещё не создать). */
export function readAliases(file: URL): Record<string, string> {
  try {
    const text = readFileSync(file, 'utf8');
    const out: Record<string, string> = {};
    for (const m of text.matchAll(/^\s*"([^"]+)":\s*"([^"]+)",?$/gm)) out[m[1]] = m[2];
    return out;
  } catch { return {}; }
}

// ─── загрузка справочника — теми же модулями, что грузит приложение ────────────────────────────────────────────
type Raw = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
/** Справочник для генераторов по копиям — и для правок справочника (tools/work-fixes.mts, 17.10). */
export async function loadCatalog(): Promise<{ cards: AliasCard[]; side: AliasSide }> {
  const { createServer } = await import('vite');
  const ROOT = new URL('..', import.meta.url).pathname;
  const vite = await createServer({ root: ROOT, server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' });
  try {
    const load = async (f: string): Promise<Raw> => vite.ssrLoadModule(`/src/mocks/${f}.ts`);
    const cards: AliasCard[] = [];
    const add = (src: string, list: Raw[]) => {
      for (const w of list) {
        cards.push({
          src, id: w.id, type: w.type, format: w.format, title: w.title, originalTitle: w.originalTitle, year: w.year,
          creators: w.creators, credits: (w.credits ?? []).map((c: Raw) => [c.personId, c.role, c.name]),
          ext: w.externalIds, ops: w.primaryOperations?.length ?? 0, level: w.complexityLevel ?? 0,
          img: Boolean(w.coverUrl || w.stillUrl), blurb: Boolean(w.blurb), countries: w.countries?.length ?? 0,
          genres: w.genres?.length ?? 0, runtime: w.runtimeMinutes ?? w.runtime, pages: w.pages, regs: w.registers?.length ?? 0,
        });
      }
    };
    for (const f of ['filmBase', 'filmBaseWiki', 'filmBaseMarkup', 'filmBasePopular', 'filmBaseWorld', 'filmBaseLinks', 'filmBaseTail', 'filmBaseMore',
      'filmBaseCurated', 'filmBaseChannels', 'seriesBase', 'seriesBaseWiki', 'bookBase']) add(f, (await load(f))[f]);
    const idx = await load('index');
    const cmedia = (await load('catalogMedia')).catalogMedia as Record<string, Raw>;
    add('index.works', Object.values(idx.works as Record<string, Raw>).map((w) => ({ ...w, externalIds: w.externalIds ?? cmedia[w.id]?.externalIds })));
    add('userHistory', (await load('userHistory')).userWorks);
    add('userWatched', (await load('userWatched')).watchedWorks);
    const cs = await load('candidates');
    const cm = (await load('candidateMedia')).candidateMedia as Record<string, Raw>;
    add('candidates', cs.candidateSeeds.map((s: Raw) => ({ ...cs.seedToCard(s), ...cm[s.id] })));
    const keys = (o: Record<string, unknown>) => Object.keys(o);
    const analyses: Record<string, number> = {};
    for (const f of ['essays', 'essaysAuto', 'postsAuto']) {
      for (const [k, v] of Object.entries((await load(f))[f] as Record<string, unknown[]>)) analyses[k] = (analyses[k] ?? 0) + v.length;
    }
    const workDetailAnalyses: Record<string, number> = {};
    try {
      const wd = await load('workDetails');
      for (const c of cards) { const n = wd.workDetail(c.id)?.externalAnalyses?.length; if (n) workDetailAnalyses[c.id] = n; }
    } catch (err) { console.warn('workDetails не загрузились — разборы каталога не в счёт', String(err)); }
    const people = Object.fromEntries(Object.entries({ ...(await load('peopleMore')).peopleMore, ...(await load('people')).people } as Record<string, Raw>)
      .map(([k, v]) => [k, [v.name, v.originalName]]));
    const pics = (m: Record<string, Raw>) => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, Boolean(v.coverUrl || v.stillUrl)]));
    const side: AliasSide = {
      externalIds: (await load('externalIds')).externalIds,
      bookWorks: (await load('bookWorks')).bookWorks,
      workCredits: { ...(await load('workCreditsMore')).workCreditsMore, ...(await load('workCredits')).workCredits },
      people,
      analyses, workDetailAnalyses,
      draftFilm: new Set([...keys((await load('draftAnnotations')).draftAnnotations), ...keys((await load('draftAnnotationsLinks')).draftAnnotationsLinks)]),
      draftSeries: new Set([...keys((await load('seriesAnnotations')).seriesAnnotations), ...keys((await load('seriesAnnotationsWiki')).seriesAnnotationsWiki)]),
      draftBook: new Set([...keys((await load('bookDrafts')).bookDrafts), ...keys((await load('bookAnnotations')).bookAnnotations)]),
      userAnn: new Set(keys((await load('userAnnotations')).userAnnotations)),
      baseMedia: pics((await load('baseMedia')).baseMedia), bookMedia: pics((await load('bookMedia')).bookMedia),
      catalogMedia: new Set(keys(cmedia)),
    };
    return { cards, side };
  } finally {
    await vite.close();
  }
}

async function main(): Promise<void> {
  const OUT = new URL('../src/mocks/workAliases.ts', import.meta.url);
  const dry = process.argv.includes('--dry');
  const cmpAt = process.argv.indexOf('--compare');
  const prev = readAliases(OUT);
  const { cards, side } = await loadCatalog();
  const r = buildAliases(cards, side, prev);
  const changed = Object.entries(r.aliases).filter(([a, m]) => prev[a] !== m).length + Object.keys(prev).filter((a) => !r.aliases[a]).length;
  const whys: Record<string, number> = {};
  for (const g of r.groups) whys[g.why] = (whys[g.why] ?? 0) + 1;
  console.log(`карточек ${cards.length}; групп ${r.groups.length}, лишних ${Object.keys(r.aliases).length}, спорных групп ${r.review.length}; версия ${r.version}; против прежней таблицы изменений ${changed}`);
  console.log('главная —', whys);
  for (const g of r.review) console.log('  спорная:', g.issues.join(','), g.copies.join(' '));
  if (cmpAt > 0) {
    const other = JSON.parse(readFileSync(process.argv[cmpAt + 1], 'utf8')) as Record<string, string>;
    const diff = Object.keys({ ...other, ...r.aliases }).filter((a) => other[a] !== r.aliases[a]);
    console.log(`сравнение с ${process.argv[cmpAt + 1]}: расходятся ${diff.length}`);
    for (const a of diff) console.log(`  ${a}: было ${other[a] ?? '—'} → стало ${r.aliases[a] ?? '—'}`);
  }
  if (!dry) writeFileSync(OUT, renderAliases(r));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main();
