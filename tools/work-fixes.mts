// Слой ручных правок справочника → src/mocks/workFixes.ts (17.10, волна Б проверки справочника; решение владельца 15.10).
//
// Вход — проверка замечаний разметчиков агентами по TMDb и Wikidata (15.10): .cache/markup/catalog-fixes/out-*.json,
// `fixes` — { key, field, value, evidence, confidence }; поля: title, originalTitle, year (0 — года нет), creators,
// dropPeople («элемент:роль»). Берём high и medium по видам (выборка 30 medium проверена 17.10: см. MEDIUM_FIELDS),
// плюс ручные правки этой волны (MANUAL_FIXES — попутные находки разбора подозрительных пар).
//
// Ключ — истина: поля правятся под вещь за ключом. Ключ правки сводится к главной копии (канон, src/mocks/workAliases.ts
// — читается файлом, после tools/work-aliases.mts): правка по лишней копии ложится на главную под её ключом. Правка по
// ключу, которого нет в справочнике, конфликт одного поля (разные значения) и правка, которая ничего не меняет (уже так,
// снимать некого), — в отчёт, не в таблицу. Снятый человек в главной роли уходит и из строк `creators` (иначе карточка без
// записи авторов показала бы его по имени) — правка `creators` выводится сама, если её не дали явно.
//
//   npx tsx tools/work-fixes.mts [--dry] [--medium all|none|<поля через запятую>]
//
// Отчёт — .cache/markup/catalog-fixes/work-fixes-report.json (что вошло, что нет и почему). Таблица едет со сборкой
// клиента ленивым куском (src/api/index.ts, `loadFixes`); сборщикам и индексам — `applyWorkFixes` (src/lib/workFixesTable.ts).
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { loadCatalog, readAliases, type AliasCard, type AliasSide, type Ext } from './work-aliases.mts';
import { canonIn } from '../src/lib/canon.ts';
import type { WorkFix } from '../src/lib/workFixes.ts';

export type Field = 'title' | 'originalTitle' | 'year' | 'creators' | 'dropPeople';
export const FIELDS: readonly Field[] = ['title', 'originalTitle', 'year', 'creators', 'dropPeople'];
export interface RawFix { key: string; field: Field; value: unknown; evidence?: string; confidence?: string; src?: string }

/** Какие правки medium берём (17.10): выборка 30 из 147 сверена с TMDb и Wikidata (порог — не больше 2 ошибок на 30).
 *  Названия, годы и авторы строкой — 18 из 18 верны (одна спорная — снята руками, MANUAL_REFUSE); снятие людей — 2
 *  ошибки и 8 спорных из 12, и все ошибки — роль d (режиссёры серий сериала: d у сериала — P57 Wikidata, все режиссёры
 *  серий, снять одного и оставить остальных непоследовательно; «Унесённые ветром» — Сэм Вуд снимал часть). Снятие medium
 *  берём только в ролях MEDIUM_DROP_ROLES (создатель — автор оригинала, а не ремейка; сценарист-тёзка): d — пока владелец
 *  не решит, что значит d у сериала. */
export const MEDIUM_FIELDS: readonly Field[] = ['title', 'originalTitle', 'year', 'creators', 'dropPeople'];
export const MEDIUM_DROP_ROLES: readonly string[] = ['c', 'w', 'a'];

/** Правки агентов, снятые руками после проверки (17.10). */
export const MANUAL_REFUSE: readonly { key: string; field: Field; why: string }[] = [
  { key: 'imdb:tt0086723', field: 'creators', why: '«Гостья из будущего»: Арсенов — режиссёр, Wikidata P170 = Булычёв, created_by TMDb пуст — спорно' },
];

/** Попутные находки 17.10 (разбор подозрительных пар по Wikidata и TMDb) — тем же видом, что правки агентов. */
export const MANUAL_FIXES: readonly RawFix[] = [
  { key: 'imdb:tt0407362', field: 'year', value: 2004, evidence: 'Wikidata Q237072: сериал 2004–2009 (P580 2004-10-18); 2003 — минисериал Q746240', confidence: 'high' },
  { key: 'tmdb:28983', field: 'title', value: 'Амазонка в огне', evidence: 'Wikidata Q783590 «Fire on the Amazon» (1993): статья русской Википедии «Амазонка в огне»; «800 льё вниз по Амазонке» — ошибочная русская метка (тёзка Q19975516)', confidence: 'high' },
  { key: 'wd:Q4195088', field: 'year', value: 1943, evidence: 'Wikidata Q4195088: пьеса Кристи по роману 1939, первая постановка 1943; P577 нет, 1939 — год романа', confidence: 'high' },
  { key: 'imdb:tt0262985', field: 'dropPeople', value: ['Q361981:c'], evidence: 'Wikidata Q23619 — американо-канадская версия (P144 = британский Q23623 Дейвиса); TMDb tv/2902 created_by — Коуэн и Липман; правка агентов (medium) поднята руками: без неё верные создатели не видны за Дейвисом', confidence: 'high' },
  { key: 'tmdb:1301632', field: 'year', value: 2025, evidence: 'TMDb movie/1301632 «Bhool Chuk Maaf»: release_date 2025-05-23 (проверка medium 17.10)', confidence: 'high' },
  { key: 'imdb:tt0312109', field: 'originalTitle', value: 'Codename: Kids Next Door', evidence: 'TMDb tv «Codename: Kids Next Door» (2002): original_name; в карточке мусор «Amy Rose Dudley Squat» (проверка medium 17.10)', confidence: 'high' },
  // проверка P31 книг справочника (17.10): элемент — издание или смешанный элемент
  { key: 'wd:Q28137293', field: 'year', value: 0, evidence: 'Wikidata Q28137293 — издание (P31 Q3331189, P629 = Q273668 «Апология» Платона, IV в. до н. э.); 1863 — год издания перевода; по правилу для вещей до 1500 года year = 0', confidence: 'high' },
  { key: 'wd:Q132152', field: 'title', value: 'Бабар', evidence: 'Wikidata Q132152 — смешанный элемент (персонаж и серия детских книг, P1476 «Babar»); «(персонаж)» в названии книги лишнее', confidence: 'high' },
  { key: 'wd:Q132152', field: 'creators', value: ['Жан де Брюнофф'], evidence: 'Wikidata Q132152 P170: Жан де Брюнофф (автор и художник книг) и Сесиль де Брюнофф (сказка-основа); в карточке авторов нет', confidence: 'high' },
  { key: 'wd:Q15555061', field: 'year', value: 0, evidence: 'Wikidata Q15555061: поэма Низами (1188), 1979 — год издания Open Library; по правилу для вещей до 1500 года year = 0', confidence: 'high' },
];

// ─── справочник ────────────────────────────────────────────────────────────────────────────────────────────────
interface Card { id: string; src: string; kind: string; title: string; orig: string; year: number; creators: string[]; ext: Ext; keys: string[]; pk?: string; credits: string[] }
const kindOf = (c: AliasCard) => (c.type === 'series' || c.format === 'series' ? 'series' : c.type || 'film');
const ROLE: Record<string, string> = { director: 'd', writer: 'w', creator: 'c', author: 'a' };
/** Главная роль вида: её имена — строки `creators` (src/lib/credits.ts, `defaultRole`). */
const LEAD: Record<string, string> = { film: 'd', series: 'c', book: 'a' };

function keysOf(kind: string, e: Ext): string[] {
  if (kind === 'series') return e.imdb ? [`imdb:${e.imdb}`] : [];
  if (kind === 'book') return [...(e.wikidata ? [`wd:${e.wikidata}`] : []), ...(e.openLibrary ? [`olw:${e.openLibrary}`] : []), ...(e.isbn ?? []).map((i) => `isbn:${i}`)];
  if (e.tmdb != null) return [`tmdb:${e.tmdb}`];
  return (e.isbn ?? []).map((i) => `isbn:${i}`);
}

export function cardsOf(raw: AliasCard[], side: Pick<AliasSide, 'externalIds' | 'bookWorks'>): Map<string, Card> {
  const out = new Map<string, Card>();
  for (const c of raw) {
    if (out.has(c.id)) continue;
    const e: Ext = { ...(c.ext ?? side.externalIds[c.id] ?? {}) };
    if (e.isbn?.length && !(e.wikidata && e.openLibrary)) {
      const hit = e.isbn.map((i) => side.bookWorks[i]).find(Boolean);
      if (hit) { if (!e.openLibrary && hit.olw) e.openLibrary = hit.olw; if (!e.wikidata && hit.wd) e.wikidata = hit.wd; }
    }
    const kind = kindOf(c);
    const keys = keysOf(kind, e);
    out.set(c.id, {
      id: c.id, src: c.src, kind, title: c.title ?? '', orig: c.originalTitle ?? '', year: c.year ?? 0, creators: c.creators ?? [], ext: e,
      keys, pk: keys[0], credits: (c.credits ?? []).filter(([pid]) => pid).map(([pid, role]) => `${pid}:${ROLE[role] ?? role}`),
    });
  }
  return out;
}

// ─── сборка таблицы ────────────────────────────────────────────────────────────────────────────────────────────
export interface Refusal { key: string; field: Field; value: unknown; why: string; confidence?: string; src?: string; main?: string }
export interface FixesResult {
  fixes: Record<string, WorkFix>;
  taken: (RawFix & { target: string; main: string; moved?: boolean })[];
  refused: Refusal[];
  derived: { key: string; creators: string[]; from: string[]; dropped: string[] }[];
  hidden: { key: string; creators: string[]; credits: string[] }[];
}

const nameKey = (s: string) => s.toLowerCase().replace(/ё/g, 'е').normalize('NFD').replace(/\p{M}+/gu, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
/** Совпадает ли строка `creators` с человеком: полное имя, имя без отчества или фамилия (последнее слово) + первая
 *  буква имени — «Глен А. Ларсон» и «Глен Ларсон», «MiloÅ¡ Forman» не ловится (это и правят строкой). */
/** Имя словами в порядке «Имя Фамилия»: русская метка Wikidata бывает «Фамилия, Имя Отчество» (как `shortName` в
 *  src/lib/credits.ts), отчество не в счёт. */
function nameWords(s: string): string[] {
  let n = s.trim();
  const inv = /^([^,]+),\s*(.+)$/u.exec(n);
  if (inv) n = `${inv[2]} ${inv[1]}`;
  const w = nameKey(n).split(' ').filter(Boolean);
  return w.length === 3 && /(?:ович|евич|ьич|овна|евна|ична|инична)$/u.test(w[1]) ? [w[0], w[2]] : w;
}
function sameName(str: string, names: readonly (string | undefined)[]): boolean {
  const a = nameWords(str);
  if (!a.length) return false;
  return names.some((n) => {
    const b = nameWords(n ?? '');
    if (!b.length) return false;
    if (a.join(' ') === b.join(' ')) return true;
    return a.length > 1 && b.length > 1 && a[a.length - 1] === b[b.length - 1] && a[0][0] === b[0][0];
  });
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function buildFixes(raw: RawFix[], cards: Map<string, Card>, side: Pick<AliasSide, 'workCredits' | 'people'>,
  aliases: Readonly<Record<string, string>>, opts: { medium?: readonly Field[]; mediumDropRoles?: readonly string[]; refuse?: typeof MANUAL_REFUSE } = {}): FixesResult {
  const medium = new Set(opts.medium ?? MEDIUM_FIELDS);
  const byKey = new Map<string, string[]>();
  const bySecondary = new Map<string, string[]>();
  const put = (m: Map<string, string[]>, k: string, id: string) => m.set(k, [...(m.get(k) ?? []), id]);
  for (const c of cards.values()) {
    if (c.pk) put(byKey, c.pk, c.id);
    // запасные: IMDb у фильма, элемент Wikidata у фильма и сериала, TMDb у сериала (агенты писали ключ, как нашли)
    if (c.ext.imdb && c.kind !== 'series') put(bySecondary, `imdb:${c.ext.imdb}`, c.id);
    if (c.ext.wikidata && c.kind !== 'book') put(bySecondary, `wd:${c.ext.wikidata}`, c.id);
    for (const k of c.keys.slice(1)) put(bySecondary, k, c.id);
  }
  const refused: Refusal[] = [];
  const taken: FixesResult['taken'] = [];
  const no = (x: RawFix, why: string, main?: string) => refused.push({ key: x.key, field: x.field, value: x.value, why, confidence: x.confidence, src: x.src, ...(main ? { main } : {}) });
  // 1. отбор по уверенности и сведение ключа к главной копии
  const want = new Map<string, Map<Field, (RawFix & { target: string; main: string; moved?: boolean })[]>>();
  for (let x of raw) {
    if (!FIELDS.includes(x.field)) { no(x, `поле ${x.field} не правится`); continue; }
    if (x.confidence !== 'high' && !(x.confidence === 'medium' && medium.has(x.field))) { no(x, `уверенность ${x.confidence ?? '—'}`); continue; }
    if (x.field === 'dropPeople' && x.confidence === 'medium' && Array.isArray(x.value)) {
      const roles = opts.mediumDropRoles ?? MEDIUM_DROP_ROLES;
      const keep = (x.value as string[]).filter((p) => roles.includes(p.slice(p.lastIndexOf(':') + 1)));
      if (!keep.length) { no(x, 'уверенность medium (снятие в роли d)'); continue; }
      x = { ...x, value: keep };
    }
    const hand = (opts.refuse ?? MANUAL_REFUSE).find((m) => m.key === x.key && m.field === x.field);
    if (hand) { no(x, `снято руками: ${hand.why}`); continue; }
    const ids = byKey.get(x.key) ?? bySecondary.get(x.key);
    if (!ids?.length) { no(x, 'ключа нет в справочнике'); continue; }
    const mains = [...new Set(ids.map((id) => canonIn(aliases, id)))].filter((m) => cards.has(m));
    const targets = [...new Set(mains.map((m) => cards.get(m)!.pk).filter((k): k is string => Boolean(k)))];
    if (targets.length !== 1) { no(x, targets.length ? `ключ ведёт на разные вещи: ${targets.join(', ')}` : 'у главной копии нет ключа'); continue; }
    const target = targets[0];
    const main = mains.find((m) => cards.get(m)!.pk === target)!;
    const t = { ...x, target, main, ...(target !== x.key ? { moved: true } : {}) };
    const f = want.get(target) ?? new Map();
    f.set(x.field, [...(f.get(x.field) ?? []), t]);
    want.set(target, f);
  }
  // 2. по полю: конфликт, «уже так», снимать некого
  const fixes: Record<string, WorkFix> = {};
  const derived: FixesResult['derived'] = [];
  const hidden: FixesResult['hidden'] = [];
  const copiesOf = (main: string) => [main, ...Object.entries(aliases).filter(([, m]) => m === main).map(([a]) => a)].filter((id) => cards.has(id));
  for (const [key, fields] of want) {
    const fix: WorkFix = {};
    const mainId = [...fields.values()][0][0].main;
    const card = cards.get(mainId)!;
    const copies = copiesOf(mainId).map((id) => cards.get(id)!);
    // авторы вещи: карточки (все копии) и запись резолва по ключам копий
    const credits = new Set<string>([...copies.flatMap((c) => c.credits), ...copies.flatMap((c) => (c.pk ? side.workCredits[c.pk] ?? '' : '').split(',')).filter(Boolean)]);
    for (const field of FIELDS) {
      const list = fields.get(field);
      if (!list?.length) continue;
      if (field === 'dropPeople') {
        const drop = [...new Set(list.flatMap((x) => (Array.isArray(x.value) ? x.value as string[] : [])))].filter((p) => /^Q\d+:[dwca]$/.test(p));
        const real = drop.filter((p) => credits.has(p));
        for (const x of list) {
          const vs = (Array.isArray(x.value) ? x.value as string[] : []);
          if (!vs.length || vs.every((p) => !real.includes(p))) no(x, 'снимать некого: человека в этой роли у вещи нет', mainId);
          else taken.push(x);
        }
        if (real.length) fix.dropPeople = real.sort();
        continue;
      }
      const values = [...new Map(list.map((x) => [JSON.stringify(x.value), x.value])).values()];
      if (values.length > 1) { for (const x of list) no(x, `конфликт: ${values.map((v) => JSON.stringify(v)).join(' ≠ ')}`, mainId); continue; }
      const v = values[0];
      const bad = field === 'year' ? !(Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 2100)
        : field === 'creators' ? !(Array.isArray(v) && v.length && v.every((s) => typeof s === 'string' && s.trim()))
          : !(typeof v === 'string' && v.trim());
      if (bad) { for (const x of list) no(x, `значение не годится: ${JSON.stringify(v)}`, mainId); continue; }
      const now = field === 'title' ? card.title : field === 'originalTitle' ? card.orig : field === 'year' ? card.year : card.creators;
      if (same(now, v)) { for (const x of list) no(x, 'уже так', mainId); continue; }
      (fix as Record<string, unknown>)[field] = field === 'creators' ? (v as string[]).map((s) => s.trim()) : typeof v === 'string' ? v.trim() : v;
      taken.push(...list);
    }
    // снятый в главной роли — и из строк `creators` (если их не правили явно)
    const lead = LEAD[card.kind];
    const leadDropped = (fix.dropPeople ?? []).filter((p) => p.endsWith(`:${lead}`));
    if (leadDropped.length && !fix.creators) {
      const names = leadDropped.map((p) => side.people[p.split(':')[0]] ?? []);
      const kept = card.creators.filter((s) => !names.some((n) => sameName(s, n)));
      if (kept.length !== card.creators.length) {
        fix.creators = kept;
        derived.push({ key, creators: kept, from: card.creators, dropped: leadDropped });
      }
    }
    // `creators` не виден, если у карточки есть авторы-элементы главной роли и среди них нет никого из новых строк
    if (fix.creators) {
      const leadCredits = [...credits].filter((p) => p.endsWith(`:${lead}`) && !(fix.dropPeople ?? []).includes(p));
      const leadNames = leadCredits.map((p) => side.people[p.split(':')[0]] ?? []);
      if (fix.creators.length && leadCredits.length && !fix.creators.some((s) => leadNames.some((n) => sameName(s, n)))) {
        hidden.push({ key, creators: fix.creators, credits: leadCredits.map((p) => `${p} ${side.people[p.split(':')[0]]?.[0] ?? '?'}`) });
      }
    }
    if (Object.keys(fix).length) fixes[key] = fix;
  }
  const sorted = Object.fromEntries(Object.keys(fixes).sort().map((k) => [k, fixes[k]]));
  return { fixes: sorted, taken, refused, derived, hidden };
}

export function renderFixes(r: FixesResult): string {
  const n = (f: Field) => Object.values(r.fixes).filter((x) => x[f] !== undefined).length;
  const lines = Object.entries(r.fixes).map(([k, f]) => `  ${JSON.stringify(k)}: ${JSON.stringify(f)},`);
  return `// Сгенерировано tools/work-fixes.mts — руками не править (слой правок справочника, 17.10, волна Б; решение владельца 15.10).
// Ключ произведения (фильм tmdb:, сериал imdb:, книга wd:) главной копии → правка: название, оригинальное название, год
// (0 — года нет), главные авторы строкой, снятые люди «элемент:роль». Источник — проверка замечаний разметчиков агентами
// по TMDb и Wikidata (.cache/markup/catalog-fixes/out-*.json). Накладывает src/lib/workFixes.ts; клиенту — ленивым куском.
// Вещей: ${Object.keys(r.fixes).length}; title ${n('title')}, originalTitle ${n('originalTitle')}, year ${n('year')}, creators ${n('creators')}, dropPeople ${n('dropPeople')}.
import type { WorkFixes } from '../lib/workFixes';

export const workFixes: WorkFixes = {
${lines.join('\n')}
};
`;
}

/** Правки агентов из out-*.json (с пометкой, откуда). */
export function readRawFixes(dir: URL): RawFix[] {
  const out: RawFix[] = [];
  for (const f of readdirSync(dir).filter((x) => /^out-\d+\.json$/.test(x)).sort((a, b) => parseInt(a.slice(4)) - parseInt(b.slice(4)))) {
    const d = JSON.parse(readFileSync(new URL(f, dir), 'utf8')) as { fixes?: RawFix[] };
    (d.fixes ?? []).forEach((x, i) => out.push({ ...x, src: `${f}#${i}` }));
  }
  return out;
}

async function main(): Promise<void> {
  const OUT = new URL('../src/mocks/workFixes.ts', import.meta.url);
  const DIR = new URL('../.cache/markup/catalog-fixes/', import.meta.url);
  const dry = process.argv.includes('--dry');
  const at = process.argv.indexOf('--medium');
  const arg = at > 0 ? process.argv[at + 1] : undefined;
  const medium = arg === 'all' ? FIELDS : arg === 'none' ? [] : arg ? arg.split(',') as Field[] : MEDIUM_FIELDS;
  if (!existsSync(DIR)) throw new Error(`нет ${DIR.pathname} — проверка агентами не прогнана`);
  const raw = [...readRawFixes(DIR), ...MANUAL_FIXES.map((x, i) => ({ ...x, src: `MANUAL_FIXES#${i}` }))];
  const { cards: rawCards, side } = await loadCatalog();
  const aliases = readAliases(new URL('../src/mocks/workAliases.ts', import.meta.url));
  const r = buildFixes(raw, cardsOf(rawCards, side), side, aliases, { medium });
  const count = (xs: { field: Field; confidence?: string }[]) => {
    const o: Record<string, number> = {};
    for (const x of xs) o[`${x.field}/${x.confidence ?? '—'}`] = (o[`${x.field}/${x.confidence ?? '—'}`] ?? 0) + 1;
    return o;
  };
  const whys: Record<string, number> = {};
  for (const x of r.refused) { const w = x.why.replace(/:.*$/, ''); whys[w] = (whys[w] ?? 0) + 1; }
  console.log(`правок на входе ${raw.length}; вошло ${r.taken.length} (на ${Object.keys(r.fixes).length} вещей; по главной копии с другим ключом ${r.taken.filter((x) => x.moved).length}), отказано ${r.refused.length}`);
  console.log('вошло —', count(r.taken));
  console.log('отказано —', whys);
  console.log(`creators выведено из снятых: ${r.derived.length}; creators не виден за авторами-элементами: ${r.hidden.length}`);
  writeFileSync(new URL('work-fixes-report.json', DIR), JSON.stringify({ medium, taken: r.taken, refused: r.refused, derived: r.derived, hidden: r.hidden }, null, 1));
  if (!dry) writeFileSync(OUT, renderFixes(r));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main();
