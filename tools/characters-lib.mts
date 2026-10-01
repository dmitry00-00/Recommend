// Чистая часть И1 (герои через несколько произведений): строки Wikidata → герой и наши произведения
// с ним, имена для поиска в разборах, текст мока. Сеть — в tools/resolve-characters.mts.
//
// Откуда герой у произведения: P674 (персонажи — у книг и фильмов), P1441 (присутствует в
// произведении — у самого героя) и роль актёра P161 → P453 (у фильмов и сериалов это самое полное:
// Холмс в фильме 2009-го записан ролью Дауни-младшего). Версия героя — отдельный элемент («Шерлок
// Холмс (Шерлок)» у BBC) с «основано на» (P144) → исходный герой: сводим к исходному, если он тоже
// вымышленный. Реальные люди в ролях (байопики) не герои — отсекаем по классу «вымышленный
// персонаж» (Q95074 и подклассы).

export interface CharBinding { work: string; char: string }
export interface CharInfo { ru?: string; en?: string; aka?: string[]; root?: string; fictional: boolean }
export interface CharacterEntry { q: string; n: string; en?: string; aka?: string[]; works: string[]; said: number }

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

/** Имена героя для поиска в заголовках разборов: русская метка и русские синонимы, и отдельные
 *  слова метки от пяти букв («Холмс», «Ганнибал»). Латиница — только английская метка целиком. */
export function nameForms(info: CharInfo): string[] {
  const full = [info.ru, ...(info.aka ?? [])].filter((x): x is string => Boolean(x && x.length >= 4 && /^\p{Lu}/u.test(x)));
  const words = (info.ru ?? '').split(/[\s-]+/).filter((w) => w.length >= 5 && /^\p{Lu}/u.test(w));
  const en = info.en && info.en.length >= 5 ? [info.en] : [];
  return [...new Set([...full, ...words, ...en])];
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Слово имени с падежным окончанием: «Джокер» → Джокера, Джокеру; «Дракула» → Дракулы; «Холмс» →
 *  Холмса, но не «Холмы». С большой буквы или капсом — «воробей» и «джокер» как обычные слова не в счёт. */
const ENDINGS = '(?:а|я|у|ю|ом|ем|ём|е|ы|и|ой|ей|ою|ею|ам|ям|ами|ями|ах|ях|ов|ев|ь|й|о)?';
function wordPattern(w: string): string {
  const cyr = /\p{Script=Cyrillic}/u.test(w);
  // гласная, «ь», «й» на конце — часть окончания: «Дракул-а», «Игор-ь»
  const stem = cyr && /[аяоеёыиьй]$/i.test(w) ? w.slice(0, -1) : w;
  const up = stem.toLocaleUpperCase('ru');
  const yo = (x: string) => esc(x).replace(/[её]/g, '[её]').replace(/[ЕЁ]/g, '[ЕЁ]');
  const end = cyr ? ENDINGS : '';
  return `(?:${yo(stem)}${end}|${yo(up)}${end.toLocaleUpperCase('ru')})`;
}
export function nameRegex(forms: string[]): RegExp | undefined {
  if (!forms.length) return undefined;
  const alts = forms.map((f) => f.split(/\s+/).map(wordPattern).join('\\s+'));
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${alts.join('|')})(?![\\p{L}\\p{N}])`, 'u');
}

/** Сколько разборов называют героя в заголовке. */
export function countSaid(titles: string[], forms: string[]): number {
  const re = nameRegex(forms);
  return re ? titles.filter((t) => re.test(t)).length : 0;
}

/** Герои И1: в двух и больше наших произведениях и названные хотя бы в одном разборе. */
export function pickCharacters(byChar: ReadonlyMap<string, Set<string>>, info: ReadonlyMap<string, CharInfo>, titles: string[],
  { minWorks = 2, minSaid = 1 } = {}): { kept: CharacterEntry[]; dropped: (CharacterEntry & { why: string })[] } {
  const kept: CharacterEntry[] = [];
  const dropped: (CharacterEntry & { why: string })[] = [];
  for (const [q, works] of byChar) {
    const i = info.get(q);
    const n = i?.ru ?? i?.en;
    if (!i || !n || /^Q\d+$/.test(n)) continue;
    const said = works.size >= minWorks ? countSaid(titles, nameForms(i)) : 0;
    const e: CharacterEntry = { q, n, ...(i.en && i.en !== n ? { en: i.en } : {}), ...(i.aka?.length ? { aka: i.aka.slice(0, 6) } : {}), works: [...works].sort(), said };
    if (works.size < minWorks) dropped.push({ ...e, why: 'одно произведение' });
    else if (said < minSaid) dropped.push({ ...e, why: 'не назван в разборах' });
    else kept.push(e);
  }
  kept.sort((a, b) => b.said - a.said || b.works.length - a.works.length || a.n.localeCompare(b.n, 'ru'));
  return { kept, dropped };
}

/** Текст src/mocks/characters.ts. */
export function charactersSource(entries: CharacterEntry[]): string {
  return `// Сгенерировано tools/resolve-characters.mts (И1) — руками не править.
// Герои, проходящие через два и больше наших произведений и названные в разборах. Ключ — элемент
// Wikidata героя; n — имя, works — ключи наших произведений, said — сколько разборов называют его.
export interface CharacterRecord { n: string; en?: string; aka?: string[]; works: string[]; said: number }

export const characters: Record<string, CharacterRecord> = {
${entries.map(({ q, ...rest }) => `  ${q}: ${JSON.stringify(rest)},`).join('\n')}
};
`;
}
