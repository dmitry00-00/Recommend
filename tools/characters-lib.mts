// Чистая часть И1 (герои через несколько произведений): строки Wikidata → герой и наши произведения
// с ним, имена для поиска в разборах, текст мока. Сеть — в tools/resolve-characters.mts.
//
// Откуда герой у произведения: P674 (персонажи — у книг и фильмов), P1441 (присутствует в
// произведении — у самого героя) и роль актёра P161 → P453 (у фильмов и сериалов это самое полное:
// Холмс в фильме 2009-го записан ролью Дауни-младшего). Версия героя — отдельный элемент («Шерлок
// Холмс (Шерлок)» у BBC) с «основано на» (P144) → исходный герой: сводим к исходному, если он тоже
// вымышленный. Реальные люди в ролях (байопики) не герои — отсекаем по классу «вымышленный
// персонаж» (Q95074 и подклассы).

// имена и их поиск в заголовках — общие с приложением (страница героя, И2)
export { countSaid, nameForms, nameRegex, sharedWords } from '../src/lib/characters.ts';
import { nameForms, nameRegex, sharedWords } from '../src/lib/characters.ts';

export interface CharBinding { work: string; char: string }
export interface CharInfo { ru?: string; en?: string; aka?: string[]; root?: string; fictional: boolean }
export interface CharacterEntry { q: string; n: string; en?: string; aka?: string[]; w?: string[]; works: string[]; said: number }

const qid = (s: string) => s.split('/').pop()!;

/** Исходный герой: по «основано на» вверх, пока тот вымышленный и известен; до трёх шагов. */
export function rootOf(q: string, info: ReadonlyMap<string, CharInfo>): string {
  let cur = q;
  for (let i = 0; i < 3; i++) {
    const r = info.get(cur)?.root;
    if (!r || r === cur || !info.get(r)?.fictional) break;
    cur = r;
  }
  return cur;
}

/** Герой → наши произведения (ключи), версии сведены к исходному, только вымышленные. */
export function characterWorks(rows: CharBinding[], keysOfWork: ReadonlyMap<string, string[]>,
  info: ReadonlyMap<string, CharInfo>): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const r of rows) {
    const c = qid(r.char), w = qid(r.work);
    if (!info.get(c)?.fictional) continue;
    const keys = keysOfWork.get(w);
    if (!keys?.length) continue;
    const root = rootOf(c, info);
    const set = out.get(root) ?? out.set(root, new Set()).get(root)!;
    // одно произведение — один ключ: у книги их бывает несколько (произведение и старый ISBN)
    set.add(keys[0]);
  }
  return out;
}

/** Заложенные герои (tools/seed-westeros.mts) поверх героев Wikidata: с элементом — к нему (и к его
 *  исходному герою), без элемента — отдельным героем `aoiaf-<n>` с английским именем. Русское имя из
 *  заложенного дополняет элемент, у которого его нет. Возвращает, сколько пар «герой — произведение»
 *  прибавилось. */
export function mergeSeeded(byChar: Map<string, Set<string>>, info: Map<string, CharInfo>,
  heroes: { id: string; q?: string; en: string; ru?: string; aka?: string[]; works: string[] }[]): number {
  let added = 0;
  for (const h of heroes) {
    const id = h.q ? rootOf(h.q, info) : h.id;
    const known = info.get(id);
    if (!known) info.set(id, { ...(h.ru ? { ru: h.ru } : {}), en: h.en, ...(h.aka?.length ? { aka: h.aka } : {}), fictional: true });
    else {
      // элемент нашли по описанию «персонаж Вестероса» — он вымышленный, даже если класс записан иначе
      known.fictional = true;
      known.ru ??= h.ru;
      known.en ??= h.en;
      if (h.aka?.length && !known.aka?.length) known.aka = h.aka;
    }
    const set = byChar.get(id) ?? byChar.set(id, new Set()).get(id)!;
    for (const k of h.works) if (!set.has(k)) { set.add(k); added++; }
  }
  return added;
}

/** Разбор: ключ произведения, к которому он привязан, и заголовок. */
export interface TitledAnalysis { key: string; title: string }

const low = (s: string) => s.toLowerCase().replace(/ё/g, 'е');
/** Слово, которое в заголовках встречается и со строчной — обычное слово, а не имя: «король»,
 *  «один», «призрак», «охотник» (прогон 01.10: «Король» — 25 разборов, «Один» — 24). */
function commonWords(titles: string[], words: Set<string>): Set<string> {
  const count = new Map<string, number>();
  for (const t of titles) {
    for (const tok of t.split(/[^\p{L}-]+/u)) {
      if (!tok || !/^\p{Ll}/u.test(tok)) continue;
      const w = low(tok);
      for (const cut of [0, 1, 2, 3]) {
        const stem = w.slice(0, w.length - cut);
        if (stem.length >= 3 && words.has(stem)) count.set(stem, (count.get(stem) ?? 0) + 1);
      }
    }
  }
  return new Set([...count].filter(([, n]) => n >= 3).map(([w]) => w));
}

/** Герои И1: в двух и больше наших произведениях и названные хотя бы в одном разборе.
 *  Разбор своего произведения называет героя любым его именем — и словом метки («Холмса»), и
 *  синонимом. Разбор чужого — только «широким» именем (`wide`, оно же `w` в моке): из двух и больше
 *  слов («Шерлок Холмс», «Ганнибал Лектер») или одним словом метки у героя трёх и больше произведений
 *  («Джокер», «Бэтмен»), если это не обычное слово и не имя другого героя. Прогон 01.10 без этого
 *  правила: «Билли Нолан» — 37 разборов (Кристофер Нолан), «Майлз Моралес» — 43 (синоним
 *  «Человек-паук»), «Дик Грейсон» — 53 («Робин»), «Король», «Один», «Призрак» — обычные слова. */
export function pickCharacters(byChar: ReadonlyMap<string, Set<string>>, info: ReadonlyMap<string, CharInfo>, analyses: TitledAnalysis[],
  { minWorks = 2, minSaid = 1 } = {}): { kept: CharacterEntry[]; dropped: (CharacterEntry & { why: string })[] } {
  // «Ланнистер» одним словом — не Тирион: общие слова имён героев из поиска убираем
  const shared = sharedWords([...byChar.keys()].map((q) => info.get(q)?.ru));
  // одно и то же имя у двух героев (метка или синоним: «Человек-паук», «Призрак») — в чужих разборах не в счёт
  const owners = new Map<string, number>();
  for (const q of byChar.keys()) {
    const i = info.get(q);
    for (const f of new Set([i?.ru, i?.en, ...(i?.aka ?? [])].filter((x): x is string => Boolean(x)).map(low))) owners.set(f, (owners.get(f) ?? 0) + 1);
  }
  const titles = analyses.map((a) => a.title);
  const single = new Set([...byChar.keys()].map((q) => info.get(q)?.ru).filter((x): x is string => Boolean(x && !/\s/.test(x.trim())))
    .map((x) => { const w = low(x.trim()); return /[аяоеыиьй]$/.test(w) ? w.slice(0, -1) : w; }));
  const common = commonWords(titles, single);
  const kept: CharacterEntry[] = [];
  const dropped: (CharacterEntry & { why: string })[] = [];
  for (const [q, works] of byChar) {
    const i = info.get(q);
    const n = i?.ru ?? i?.en;
    if (!i || !n || /^Q\d+$/.test(n)) continue;
    const wide = wideForms(i, works.size, owners, common);
    let said = 0;
    if (works.size >= minWorks) {
      const own = nameRegex(nameForms(i, { shared }));
      const other = nameRegex(wide);
      said = analyses.filter((a) => (works.has(a.key) ? own : other)?.test(a.title)).length;
    }
    const e: CharacterEntry = { q, n, ...(i.en && i.en !== n ? { en: i.en } : {}), ...(i.aka?.length ? { aka: i.aka.slice(0, 6) } : {}),
      ...(wide.length ? { w: wide } : {}), works: [...works].sort(), said };
    if (works.size < minWorks) dropped.push({ ...e, why: 'одно произведение' });
    else if (said < minSaid) dropped.push({ ...e, why: 'не назван в разборах' });
    else kept.push(e);
  }
  kept.sort((a, b) => b.said - a.said || b.works.length - a.works.length || a.n.localeCompare(b.n, 'ru'));
  return { kept, dropped };
}

/** «Широкие» имена героя — те, по которым его можно узнать в разборе чужого произведения. */
export function wideForms(i: CharInfo, works: number, owners: ReadonlyMap<string, number>, common: ReadonlySet<string>): string[] {
  const unique = (f: string) => (owners.get(low(f)) ?? 0) <= 1;
  const multi = [i.ru, i.en, ...(i.aka ?? [])].filter((f): f is string => Boolean(f && /\S\s+\S/.test(f.trim()) && f.length >= 6 && unique(f)));
  const one = i.ru && !/\s/.test(i.ru.trim()) && works >= 3 && unique(i.ru) && i.ru.length >= 4
    && !common.has((() => { const w = low(i.ru!.trim()); return /[аяоеыиьй]$/.test(w) ? w.slice(0, -1) : w; })()) ? [i.ru.trim()] : [];
  return [...new Set([...multi, ...one])];
}

/** Текст src/mocks/characters.ts. */
export function charactersSource(entries: CharacterEntry[]): string {
  return `// Сгенерировано tools/resolve-characters.mts (И1) — руками не править.
// Герои, проходящие через два и больше наших произведений и названные в разборах. Ключ — элемент
// Wikidata героя; n — имя, w — имена, по которым он узнаётся в разборах чужих произведений, works —
// ключи наших произведений, said — сколько разборов называют его.
export interface CharacterRecord { n: string; en?: string; aka?: string[]; w?: string[]; works: string[]; said: number }

export const characters: Record<string, CharacterRecord> = {
${entries.map(({ q, ...rest }) => `  ${q}: ${JSON.stringify(rest)},`).join('\n')}
};
`;
}
