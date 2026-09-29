// Справочник фильмов из мастер-списка владельца → src/mocks/filmBase.ts.
//   TMDB_API_KEY=… npx tsx tools/build-film-base.mts ~/Downloads/films_master_list_extended.md
// Вход — строки вида «- Title (Director, Year)». Разметки у этих карточек нет и не будет до
// кураторской: они нужны, чтобы разборы каналов было к чему привязывать. Замер 22.09 показал,
// что узкое место — не правила сопоставления, а наша база: в четырёх каналах речь о сотнях
// фильмов, а мы знали около двухсот.
import { readFileSync, writeFileSync } from 'node:fs';
import type { WorkCard } from '../src/types/tmdf.ts';

const file = process.argv[2]?.replace(/^~/, process.env.HOME ?? '~');
const key = process.env.TMDB_API_KEY;
if (!file || !key) { console.error('нужен файл списка и TMDB_API_KEY'); process.exit(1); }

/** В файле латиница с диакритикой сохранена дважды перекодированной: «Léon» лежит как
 *  «LÃ©on». Возвращаем как было, иначе TMDb такой фильм не находит. */
const fixMojibake = (s: string): string =>
  (/[ÃÂ][\u0080-\u00BF]/.test(s) ? Buffer.from(s, 'latin1').toString('utf8') : s);

const ENTRY = /^(.*?)\s*\(([^()]*?),\s*((?:1[89]|20)\d{2})\)\s*$/;
const entries = readFileSync(file, 'utf8').split('\n')
  .map((l) => l.trim())
  .filter((l) => l.startsWith('- '))
  .map((l) => ENTRY.exec(l.slice(2)))
  .filter((m): m is RegExpExecArray => Boolean(m))
  .map((m) => ({ title: fixMojibake(m[1].trim()), director: fixMojibake(m[2].trim()), year: Number(m[3]) }));

interface Found { id: number; title: string; original_title: string; release_date?: string }
const works: WorkCard[] = [];
const missed: string[] = [];
const seen = new Set<number>();
for (const e of entries) {
  const qs = new URLSearchParams({ api_key: key, language: 'ru-RU', query: e.title, year: String(e.year) });
  const r = await fetch(`https://api.themoviedb.org/3/search/movie?${qs}`);
  if (!r.ok) { missed.push(`${e.title} (${e.year}): tmdb ${r.status}`); continue; }
  const j = await r.json() as { results?: Found[] };
  // без года тоже пробуем: у старых фильмов год премьеры в базе часто на год позже
  let hit = j.results?.[0];
  if (!hit) {
    const alt = await fetch(`https://api.themoviedb.org/3/search/movie?${new URLSearchParams({ api_key: key, language: 'ru-RU', query: e.title })}`);
    hit = alt.ok ? ((await alt.json()) as { results?: Found[] }).results?.[0] : undefined;
  }
  if (!hit) { missed.push(`${e.title} (${e.year})`); continue; }
  if (seen.has(hit.id)) continue;
  seen.add(hit.id);
  works.push({
    id: `f-tmdb${hit.id}`,
    type: 'film',
    title: hit.title || hit.original_title,
    originalTitle: hit.original_title,
    year: Number(hit.release_date?.slice(0, 4)) || e.year,
    creators: [e.director],
    primaryOperations: [],
    complexityLevel: 0,
    warnings: [],
    barriers: [],
    isNicheMasterpiece: false,
    externalIds: { tmdb: hit.id },
  });
}

writeFileSync(new URL('../src/mocks/filmBase.ts', import.meta.url),
  `// Сгенерировано tools/build-film-base.mts (${new Date().toISOString().slice(0, 10)}) из мастер-списка
// владельца: справочник фильмов без разметки. Нужен, чтобы разборы каналов было к чему
// привязывать; в подбор эти карточки не идут — у них нет ни операций, ни уровня.
// Не править руками — перегенерировать.
import type { WorkCard } from '@/types/tmdf';

export const filmBase: WorkCard[] = ${JSON.stringify(works, null, 2)};
`);
console.error(`строк: ${entries.length}; в справочнике: ${works.length}; не нашлось: ${missed.length}`);
console.error(missed.slice(0, 20).map((m) => `  ? ${m}`).join('\n'));
