// Имя франшизы на первом фильме (ЗП-23, 07.10): «Star Wars» — это и фильм 1977 года, и слово, которым
// английский ролик называет всю вселенную («THE BAD BATCH Episode 4 … STAR WARS Easter Eggs», «How to
// Start Watching Star Trek»). Голова франшизы — произведение, чьё латинское имя начинает имена ещё хотя бы
// двух других («Star Wars: The Last Jedi», «Spider-Man 2», «Dragon Ball Z»). Поздний ролик о такой голове
// без улики о самом фильме (год, словарь вселенной, плейлист) — про франшизу, а не про фильм.
// Выборка 07.10 (200 английских привязок): 11 из 28 ошибок этого класса.
import type { IndexedWork } from './works-index.mts';

const LATIN = /^[\p{Script=Latin}\p{N}\p{P}\p{Zs}&'’]+$/u;
const norm = (s: string) => s.toLowerCase().replace(/[’']/g, '').replace(/\s+/g, ' ').trim();

/** Ключи голов франшиз и латинское имя, по которому они головы. */
export function franchiseHeads(index: IndexedWork[]): Map<string, string> {
  const names = index.flatMap((w) => w.names.filter((n) => LATIN.test(n)).map((n) => ({ key: w.key, n: norm(n) })));
  const heads = new Map<string, string>();
  for (const { key, n } of names) {
    if (n.length < 4) continue;
    const others = new Set<string>();
    for (const o of names) if (o.key !== key && o.n.length > n.length && o.n.startsWith(n) && /^[\s:\-–—\d]/.test(o.n.slice(n.length))) others.add(o.key);
    if (others.size >= 2) heads.set(key, n);
  }
  return heads;
}

// признаки другой части франшизы или разговора о франшизе целиком: сезон и эпизод сериала, трейлер, каст
// и слухи о будущем фильме, рейтинг частей, игра. Эссе о самом фильме («Analyzing Evil: Hans Gruber From
// Die Hard», «Why The Matrix Still Looks Like a Billion Bucks») таких слов не содержит — его не трогаем
const OTHER_ENTRY = /(?<![\p{L}\p{N}])(?:seasons?|episodes?|ep\s?\d|series|shows?|tv|trailers?|teasers?|footage|cast|casting|rumou?rs?|leaks?|updates?|news|slate|announced|announcement|upcoming|timeline|franchise|saga|trilogy|ranked|ranking|tier list|sequel|prequel|spin-?off|games?|vol|volume|part|chapter|marvel|mcu|dceu|watch order|how to (?:start )?watch(?:ing)?|subscribers)(?![\p{L}])/iu;
// сразу за именем — номер, римская цифра, буква или «& / vs»: «Mortal Kombat 2», «Dragon Ball Z», «Deadpool & Wolverine»
const NEXT_ENTRY = /^\s*[:\-–—]?\s*(?:\d{1,2}|[IVX]{1,4}|(?!A(?![\p{L}]))[A-Z]{1,2}|&|vs\.?|x)(?![\p{L}\p{N}])/u;

/** Поздний ролик называет голову франшизы, но говорит о другой её части или о франшизе целиком
 *  («THE BAD BATCH Episode 4 … STAR WARS Easter Eggs», «STAR WARS Full Slate: Mandalorian & Grogu (2026)»).
 *  Год самого фильма в тексте — ролик о нём. */
export function franchiseTalk(head: string, year: number | undefined, title: string, description: string, publishedAt?: string): boolean {
  const pub = publishedAt ? Number(publishedAt.slice(0, 4)) : NaN;
  if (!year || !Number.isFinite(pub) || pub - year < 5) return false;
  if (new RegExp(`\\b${year}\\b`).test(`${title}\n${description}`)) return false;
  const at = norm(title).indexOf(head);
  if (at < 0) return false;
  // другой год в заголовке — другая часть: «Mandalorian & Grogu (2026)»
  if ((title.match(/\b(?:19|20)\d\d\b/g) ?? []).some((y) => Math.abs(Number(y) - year) >= 2)) return true;
  if (NEXT_ENTRY.test(title.replace(/[’']/g, '').slice(at + head.length))) return true;
  return OTHER_ENTRY.test(title);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { worksIndex } = await import('./works-index.mts');
  const ix = worksIndex({ all: true });
  const heads = franchiseHeads(ix);
  const by = new Map(ix.map((w) => [w.key, w.work]));
  console.log(`голов франшиз: ${heads.size}`);
  console.log([...heads].map(([k, n]) => `${n} (${by.get(k)?.year})`).join('; '));
}
