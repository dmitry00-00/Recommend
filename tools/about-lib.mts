// Ролик может быть не о фильме, а о франшизе (циклe) или о человеке — режиссёре, писателе
// (категории владельца, 02.10). Такой ролик идёт на страницу вселенной (/universe/:id) или человека
// (/person/:id), а не к одному фильму. Здесь — справочник этих целей и узнавание по названию:
// вселенные — узлы связей Ж1 вида «франшиза» или «цикл» (src/mocks/workRelations.ts), люди —
// справочник авторов Д2 (src/mocks/people.ts). Ключ у обоих — элемент Wikidata.
import { relationEdges, relationNodes } from '../src/mocks/workRelations.ts';
import { workCredits } from '../src/mocks/workCredits.ts';
import { hubWeight, listLike } from '../src/lib/relations.ts';
import { people } from '../src/mocks/people.ts';
import { universeSeeds } from './universe-seeds.mts';

/** Как вселенную называют в роликах, а в Wikidata она под другим именем. Пополнять по ходу разметки. */
const ALIASES: Record<string, string> = {
  'песнь льда и пламени': 'Песнь льда и огня', 'игра престолов': 'Песнь льда и огня', 'вестерос': 'Песнь льда и огня',
  'властелин колец': 'Средиземье', 'толкин': 'Средиземье', 'хоббит': 'Средиземье',
  'марвел': 'Кинематографическая вселенная Marvel', 'mcu': 'Кинематографическая вселенная Marvel', 'квм': 'Кинематографическая вселенная Marvel',
};

export type AboutKind = 'universe' | 'person';
export interface AboutRef { kind: AboutKind; id: string; title: string; /** оригинальное имя человека */ sub?: string; label: string; /** вид узла вселенной */ k?: 'franchise' | 'cycle' }

const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е').replace(/[«»"“”„'’`]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
/** «вселенная Чужого», «франшиза "Пила"», «цикл Ведьмак» → голое название */
const bare = (s: string) => norm(s).replace(/^(?:вселенн\S*|франшиз\S*|цикл\S*|серия|сага|мир)\s+/u, '').replace(/\s+(?:франшиз\S*|вселенн\S*|цикл|сага)$/u, '').trim();

let built: { list: Record<AboutKind, AboutRef[]>; by: Record<AboutKind, Map<string, AboutRef[]>> } | undefined;
function index() {
  if (built) return built;
  const list: Record<AboutKind, AboutRef[]> = { universe: [], person: [] };
  const by: Record<AboutKind, Map<string, AboutRef[]>> = { universe: new Map(), person: new Map() };
  const put = (kind: AboutKind, name: string, ref: AboutRef) => {
    const k = kind === 'universe' ? bare(name) : norm(name);
    if (!k) return;
    const arr = by[kind].get(k) ?? [];
    if (!arr.some((r) => r.id === ref.id)) arr.push(ref);   // два узла одной вселенной — одна цель
    by[kind].set(k, arr);
  };
  for (const [q, n] of Object.entries(relationNodes)) {
    if (n.k !== 'franchise' && n.k !== 'cycle') continue;
    // страница вселенной есть только у средоточия: «Чужой против Хищника» ведёт во вселенную «Хищника»
    const ref: AboutRef = { kind: 'universe', id: universes().hubOfQ.get(q) ?? q, title: n.t, k: n.k, label: `${n.t} (${n.k === 'cycle' ? 'цикл' : 'франшиза'})` };
    list.universe.push(ref);
    put('universe', n.t, ref);
  }
  // другие имена той же вселенной: английское из заложенных (universe-seeds) и разговорные (ALIASES)
  const findU = (t: string) => by.universe.get(bare(t))?.find((r) => r.k === 'franchise') ?? by.universe.get(bare(t))?.[0];
  for (const seed of universeSeeds) { const r = findU(seed.ru); if (r && seed.en) put('universe', seed.en, r); }
  for (const [alias, t] of Object.entries(ALIASES)) { const r = findU(t); if (r) put('universe', alias, r); }
  for (const p of Object.values(people)) {
    const ref: AboutRef = { kind: 'person', id: p.id, title: p.name, ...(p.originalName ? { sub: p.originalName } : {}), label: p.originalName && p.originalName !== p.name ? `${p.name} (${p.originalName})` : p.name };
    list.person.push(ref);
    for (const name of [p.name, p.originalName].filter(Boolean) as string[]) {
      put('person', name, ref);
      // «Андрей Арсеньевич Тарковский» ловится и как «Андрей Тарковский», и по фамилии (ниже)
      const w = norm(name).split(' ');
      if (w.length > 2) put('person', `${w[0]} ${w[w.length - 1]}`, ref);
      if (w.length > 1) put('person', `#${w[w.length - 1]}`, ref);
    }
  }
  built = { list, by };
  return built;
}

/** Цель по названию: точное (без «вселенная», «франшиза»), у людей ещё имя-фамилия и одна фамилия,
 *  если такая фамилия у нас одна. Не развелось — undefined: человек выберет сам. */
export function resolveAbout(kind: AboutKind, name: string): AboutRef | undefined {
  const { by } = index();
  const exact = by[kind].get(kind === 'universe' ? bare(name) : norm(name));
  if (exact?.length === 1) return exact[0];
  // «Звёздные войны» — и франшиза, и цикл фильмов: ролик «о вселенной» — о франшизе
  const fr = exact?.filter((r) => r.k === 'franchise');
  if (fr?.length === 1) return fr[0];
  if (kind === 'person') {
    const w = norm(name).split(' ');
    const two = w.length > 2 ? by.person.get(`${w[0]} ${w[w.length - 1]}`) : undefined;
    if (two?.length === 1) return two[0];
    const last = by.person.get(`#${w[w.length - 1]}`);
    if (last?.length === 1 && (w.length === 1 || !exact)) return last[0];
  }
  return undefined;
}

/** Ярлык из списка подсказок («Звёздные войны (франшиза)», «Андрей Тарковский (Andrei Tarkovsky)») → цель. */
export function aboutByLabel(kind: AboutKind, label: string): AboutRef | undefined {
  const l = label.trim().toLowerCase();
  return index().list[kind].find((r) => r.label.toLowerCase() === l) ?? resolveAbout(kind, label.replace(/\s*\([^)]*\)\s*$/, ''));
}

/** Подсказки для поля ввода: сначала совпадение с начала, потом внутри. */
export function searchAbout(kind: AboutKind, q: string, n = 20): string[] {
  const t = norm(q);
  if (t.length < 2) return [];
  const starts: string[] = [], has: string[] = [];
  for (const r of index().list[kind]) {
    const hay = norm(`${r.title} ${r.sub ?? ''}`);
    if (hay.startsWith(t) || (r.sub && norm(r.sub).startsWith(t))) starts.push(r.label); else if (hay.includes(t)) has.push(r.label);
    if (starts.length >= n) break;
  }
  return [...starts, ...has].slice(0, n);
}

export const aboutTitle = (kind: AboutKind, id: string): string | undefined => index().list[kind].find((r) => r.id === id)?.title;

// ─── произведение → вселенная и люди (для профиля канала) ─────────────────────
/** Вселенные — связные куски графа связей, средоточие — франшиза, иначе цикл, иначе самый связный
 *  узел; то же правило, что у страницы вселенной в приложении (src/api universeIndex). Вселенная —
 *  от трёх узлов. */
let uni: { hubOfKey: Map<string, string>; hubOfQ: Map<string, string>; size: Map<string, number> } | undefined;
function universes() {
  if (uni) return uni;
  const parent = new Map<string, string>();
  const find = (x: string): string => { let r = x; while (parent.get(r) !== r) r = parent.get(r) ?? (parent.set(r, r), r); parent.set(x, r); return r; };
  const degree = new Map<string, number>();
  for (const [a, kind, b] of relationEdges) {
    if (kind === 'part_of' && listLike(relationNodes[b]?.t)) continue;
    for (const x of [a, b]) { if (!parent.has(x)) parent.set(x, x); degree.set(x, (degree.get(x) ?? 0) + 1); }
    parent.set(find(a), find(b));
  }
  const groups = new Map<string, string[]>();
  for (const x of parent.keys()) (groups.get(find(x)) ?? groups.set(find(x), []).get(find(x))!).push(x);
  const weight = (q: string) => hubWeight(relationNodes[q]);
  const hubOfKey = new Map<string, string>();
  const hubOfQ = new Map<string, string>();
  const size = new Map<string, number>();
  for (const list of groups.values()) {
    if (list.length < 3) continue;
    const hub = [...list].sort((a, b) => weight(b) - weight(a) || (degree.get(b) ?? 0) - (degree.get(a) ?? 0)
      || (relationNodes[a]?.y ?? 9999) - (relationNodes[b]?.y ?? 9999))[0];
    size.set(hub, list.length);
    for (const q of list) { hubOfQ.set(q, hub); const k = relationNodes[q]?.key; if (k) hubOfKey.set(k, hub); }
  }
  uni = { hubOfKey, hubOfQ, size };
  return uni;
}
/** Вселенная произведения по его ключу (tmdb:…, imdb:…, wd:…) — элемент Wikidata средоточия. */
export const universeOfKey = (key: string): string | undefined => universes().hubOfKey.get(key);
/** Люди произведения: режиссёр, создатель сериала, автор книги (сценаристов не берём — их много и
 *  о них не снимают ролики). */
export function peopleOfKey(key: string): string[] {
  const raw = workCredits[key];
  if (!raw) return [];
  return [...new Set(raw.split(',').filter((x) => /:(d|c|a)$/.test(x)).map((x) => x.split(':')[0]))];
}
export const universeTitle = (q: string): string | undefined => relationNodes[q]?.t;

/** Все люди произведения, со сценаристами — для «ядра» вселенной. */
const allPeopleOfKey = (key: string): string[] => [...new Set((workCredits[key] ?? '').split(',').filter(Boolean).map((x) => x.split(':')[0]))];
/** Ядро вселенной — люди, которые есть хотя бы в двух её произведениях: у «Песни льда и огня» это
 *  Джордж Мартин (сценарист «Игры престолов», создатель «Дома дракона»). По ядру к вселенной
 *  причисляется и то, чего граф связей не знает: «Рыцарь Семи Королевств» — тоже Мартин. */
let cores: Map<string, Set<string>> | undefined;
export function universeCore(hub: string): ReadonlySet<string> {
  if (!cores) {
    const count = new Map<string, Map<string, number>>();
    for (const n of Object.values(relationNodes)) {
      const h = n.key ? universes().hubOfKey.get(n.key) : undefined;
      if (!h) continue;
      const m = count.get(h) ?? count.set(h, new Map()).get(h)!;
      for (const p of allPeopleOfKey(n.key!)) m.set(p, (m.get(p) ?? 0) + 1);
    }
    cores = new Map([...count].map(([h, m]) => [h, new Set([...m].filter(([, c]) => c >= 2).map(([p]) => p))]));
  }
  return cores.get(hub) ?? new Set();
}
/** Принадлежит ли произведение вселенной: по графу связей или по её ядру людей. */
export const inUniverse = (key: string, hub: string): boolean =>
  universeOfKey(key) === hub || allPeopleOfKey(key).some((p) => universeCore(hub).has(p));
/** Есть ли во вселенной произведение такого вида: «2-й сезон сериала „Аватар“» — не о вселенной
 *  Кэмерона, где сериалов нет. */
export const universeHasKind = (hub: string, kind: string): boolean =>
  Object.entries(relationNodes).some(([q, n]) => n.k === kind && universes().hubOfQ.get(q) === hub);
