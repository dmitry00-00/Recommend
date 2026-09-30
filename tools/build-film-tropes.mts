// Приёмы из TV Tropes в карточку произведения.
//   npx tsx tools/build-film-tropes.mts <путь к film_imdb_match.csv>
// Отбор — по белому списку (tools/trope-dictionary.ts), а не по частоте: замер 23.09 показал,
// что и частые, и редкие приёмы у фильмов — это производственная мелочь («Oscar Bait»,
// «Career Resurrection», «Director's Cut»), а приёмы повествования тонут. Внутри списка
// порядок задаёт длина разбора на вики: где написан абзац, приём разобран всерьёз, где
// строчка — проставлен мимоходом. Саму длину считаем, текст не сохраняем.
// Лицензия TV Tropes — CC BY-NC-SA: наружу идут идентификатор, английское имя и ссылка.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import type { SpoilerLevel, TropeMention } from '../src/types/tmdf.ts';
import { eachRow, normTrope, wikiUrl } from './tvtropes.mts';
import { tropeDictionary } from './trope-dictionary.ts';
import { worksIndex } from './works-index.mts';
import { isScreen } from '../src/lib/media.ts';

const PER_FILM = 5;
const file = process.argv[2];
if (!file || !existsSync(file)) { console.error('нужен путь к film_imdb_match.csv'); process.exit(1); }

const known = new Map(tropeDictionary.map((t) => [normTrope(t.slug), t]));
const cacheFile = new URL('../.cache/imdb-by-tmdb.json', import.meta.url);
const imdbByTmdb: Record<string, string | null> = existsSync(cacheFile) ? JSON.parse(readFileSync(cacheFile, 'utf8')) : {};
const ours = new Map<string, { key: string; title: string }>();
for (const { key, work } of worksIndex()) {
  if (!isScreen(work)) continue;
  const imdb = work.externalIds?.imdb ?? (work.externalIds?.tmdb != null ? imdbByTmdb[String(work.externalIds.tmdb)] : null);
  if (imdb && !ours.has(imdb)) ours.set(imdb, { key, title: work.title });
}

const picked = new Map<string, Map<string, number>>();
let films = 0;
const seenFilms = new Set<string>();
const rows = await eachRow(file, (cells, header) => {
  const tconst = cells[header.indexOf('tconst')];
  const trope = cells[header.indexOf('Trope')];
  if (!tconst || !trope) return;
  if (!seenFilms.has(tconst)) { seenFilms.add(tconst); films += 1; }
  if (!ours.has(tconst)) return;
  const entry = known.get(normTrope(trope));
  if (!entry) return;
  // длину разбора считаем сами; сам текст никуда не попадает
  const length = (cells[header.indexOf('Example')] ?? '').trim().length;
  const m = picked.get(tconst) ?? picked.set(tconst, new Map()).get(tconst)!;
  m.set(entry.slug, Math.max(m.get(entry.slug) ?? 0, length));
});
console.log(`строк в таблице: ${rows}, фильмов в датасете: ${films}`);
console.log(`наших фильмов: ${ours.size}, с приёмами из словаря: ${picked.size}`);

const bySlug = new Map(tropeDictionary.map((t) => [t.slug, t]));
const out: Record<string, TropeMention[]> = {};
const used = new Map<string, number>();
for (const [imdb, m] of picked) {
  const meta = ours.get(imdb)!;
  const list = [...m.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, PER_FILM)
    .map(([slug]) => {
      const entry = bySlug.get(slug)!;
      used.set(slug, (used.get(slug) ?? 0) + 1);
      return {
        tropeId: `tvtropes:${entry.slug}`,
        name: entry.name,
        explanation: entry.explanation,
        url: wikiUrl(entry.slug),
        spoilerLevel: entry.spoilerLevel as SpoilerLevel,
      };
    });
  // «Немое кино» лежит в словаре двумя написаниями — в карточке оно должно быть одно
  const seen = new Set<string>();
  out[meta.key] = list.filter((t) => !seen.has(t.name) && seen.add(t.name));
}
const counts = Object.values(out).map((l) => l.length);
console.log(`приёмов на фильм: медиана ${counts.sort((a, b) => a - b)[Math.floor(counts.length / 2)]}, ≥2 у ${counts.filter((n) => n >= 2).length}`);
console.log('чаще всего:', [...used.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([s, n]) => `${s}·${n}`).join(', '));
console.log('из словаря не пригодилось:', tropeDictionary.filter((t) => !used.has(t.slug)).length, 'из', tropeDictionary.length);

const sorted = Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
const header = `// Сгенерировано tools/build-film-tropes.mts (${new Date().toISOString().slice(0, 10)}): приёмы,
// отмеченные на TV Tropes, — по белому списку tools/trope-dictionary.ts. Это не наша разметка:
// как приём работает в этом фильме, никто не проверял, поэтому в карточке блок стоит
// отдельно и с оговоркой. Названия и объяснения свои; из датасета — идентификатор, имя
// приёма и ссылка на вики (TV Tropes, CC BY-NC-SA, некоммерческое использование).
// Не править руками — перегенерировать.
import type { TropeMention } from '@/types/tmdf';

export const filmTropes: Record<string, TropeMention[]> = `;
writeFileSync(new URL('../src/mocks/filmTropes.ts', import.meta.url), `${header}${JSON.stringify(sorted, null, 1)};\n`);
console.log('→ src/mocks/filmTropes.ts:', Object.keys(sorted).length, 'фильмов');
