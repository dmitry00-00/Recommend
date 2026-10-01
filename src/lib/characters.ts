// Имя героя в тексте (И1, И2): формы имени и их поиск в заголовках разборов. Общее для сборки
// (tools/resolve-characters.mts — «назван ли в разборах») и приложения (страница героя — «разборы о нём»).

export interface HeroNames { ru?: string; en?: string; aka?: string[] }

/** Имена героя для поиска в заголовках разборов: русская метка и русские синонимы, и отдельные
 *  слова метки от пяти букв («Холмс», «Ганнибал»). Латиница — только английская метка целиком.
 *  `words: false` — без отдельных слов: в разборе чужого произведения «Шерлок» скорее «Шерлок в
 *  России», чем Холмс. */
export function nameForms(info: HeroNames, { words: withWords = true } = {}): string[] {
  const full = [info.ru, ...(info.aka ?? [])].filter((x): x is string => Boolean(x && x.length >= 4 && /^\p{Lu}/u.test(x)));
  const words = !withWords ? [] : (info.ru ?? '').split(/[\s-]+/).filter((w) => w.length >= 5 && /^\p{Lu}/u.test(w));
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

