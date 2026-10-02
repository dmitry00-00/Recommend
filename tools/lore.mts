// Словарь вселенной как улика (02.10): имена героев в заголовке и описании ролика.
// «Daemon Targaryen explained» — ролик о «Доме Дракона», даже если названия сериала в нём нет;
// «Jon Snow — the King who was promised?» у канала о Вестеросе — не о фильме «Другие».
//
// Источники имён: герои И1 (src/mocks/characters.ts — имя, английское имя, другие имена, наши
// произведения) и заложенные герои Вестероса (.cache/westeros-seed.json, An API of Ice and Fire:
// книги и сезоны «Игры престолов»). Имя годится, если в нём два слова и больше или одно слово от 7 букв;
// одно слово засчитывается только с заглавной буквы в заголовке.
//
// Как работает в опознавателе (tools/match-videos.mts):
//   · улика `lore` — привязка к произведению, в котором герой есть: «Тирион» у «Игры престолов»;
//     внутри вселенной это и разводит: Деймон Таргариен не подтверждает «Игру престолов»;
//   · заголовок без названия, но с героем одного-единственного нашего произведения — привязка к
//     нему (без улики, на проверку).
import { existsSync, readFileSync } from 'node:fs';
import { characters } from '../src/mocks/characters.ts';
import { relationNodes } from '../src/mocks/workRelations.ts';
import { seededHeroes, type WesterosSeed } from './westeros-lib.mts';

export interface LoreName { name: string; re: RegExp; one: boolean; works: string[]; who: string }

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const B = '(?<![\\p{L}\\p{N}])', E = '(?![\\p{L}\\p{N}])';
/** обычные слова, которые бывают и именем: «Бран», «Ходор» как слово — нет, но «Король», «Маг» — да */
const COMMON = /^(?:король|королева|принц|принцесса|король ночи|рыцарь|ведьма|ведьмак|мать|отец|брат|сестра|дракон|волк|king|queen|prince|knight|witch|the|lord|lady)$/iu;

let built: LoreName[] | undefined;
export function loreNames(ourKeys?: ReadonlySet<string>): LoreName[] {
  if (built) return built;
  const byName = new Map<string, { works: Set<string>; who: string }>();
  // «Старк, Тони» → «Тони Старк»; одно слово — только главное имя героя (у «Железного человека»
  // «Старк» — другое имя, и он ловился бы в «Арье Старк»)
  const add = (name: string | undefined, works: string[], who: string, primary = false) => {
    const n = name?.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/^([^,]+),\s*(.+)$/, '$2 $1').trim();
    if (!n || COMMON.test(n)) return;
    const words = n.split(/\s+/);
    if (words.length < 2 && (n.length < 5 || !primary)) return;
    const k = n.toLowerCase().replace(/ё/g, 'е');
    const e = byName.get(k) ?? { works: new Set<string>(), who };
    for (const w of works) if (!ourKeys || ourKeys.has(w)) e.works.add(w);
    byName.set(k, e);
  };
  for (const c of Object.values(characters)) { add(c.n, c.works, c.n, true); add(c.en, c.works, c.n, true); for (const n of c.aka ?? []) add(n, c.works, c.n); }
  const seedFile = new URL('../.cache/westeros-seed.json', import.meta.url);
  if (existsSync(seedFile)) {
    const seed = JSON.parse(readFileSync(seedFile, 'utf8')) as WesterosSeed;
    const keysOfWork = new Map<string, string[]>();
    for (const [q, n] of Object.entries(relationNodes)) if (n.key) keysOfWork.set(q, [n.key]);
    const keys = new Set([...(ourKeys ?? []), 'imdb:tt0944947']);
    for (const h of seededHeroes(seed, keysOfWork, keys)) { add(h.en, h.works, h.ru ?? h.en, true); add(h.ru, h.works, h.ru ?? h.en, true); for (const n of h.aka ?? []) add(n, h.works, h.ru ?? h.en); }
  }
  // слово имени: кириллица склоняется («Джокера», «Тириона Ланнистера») — основа и до трёх букв окончания
  const word = (w: string) => /[а-я]/.test(w) && w.length >= 5 ? `${esc(w.replace(/[аяйьоеиыу]$/, ''))}\\p{L}{0,3}` : `${esc(w)}(?:'s|’s)?`;
  const cap = (w: string) => w[0].toUpperCase() + w.slice(1);
  built = [...byName].filter(([, e]) => e.works.size).map(([k, e]) => {
    const words = k.split(/\s+/);
    const one = words.length === 1;
    // одно слово — с заглавной в заголовке; фраза — без оглядки на регистр
    const re = one ? new RegExp(`${B}${word(cap(k)).replace(/^\\?/, '')}${E}`, 'u') : new RegExp(`${B}${words.map(word).join('\\s+')}${E}`, 'iu');
    return { name: k, re, one, works: [...e.works], who: e.who };
  });
  return built;
}

/** Герои, названные в тексте: имя и наши произведения, где он есть. */
export function loreHits(text: string, names = loreNames()): LoreName[] {
  const t = text.replace(/ё/g, 'е').replace(/Ё/g, 'Е');
  const seen = new Set<string>();
  return names.filter((n) => n.re.test(t) && !seen.has(n.who) && (seen.add(n.who), true));
}
