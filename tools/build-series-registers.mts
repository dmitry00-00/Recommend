// Регистр сериалов (11.10): у фильмов тональный регистр выводится из жанров и ключевых слов TMDb
// (tools/register-tags.mts, build-base-media.mts), а сериалы туда не шли — номера TMDb у сериалов свои, и
// `/movie/<id>` отдал бы чужой фильм. Без регистра у сериала «подобрать словами» работает вслепую, образец
// «в стиле „Твин Пикса“» не даёт ничего, фильтры своего списка и якорь вкуса сериалов не видят.
//   npx tsx tools/build-series-registers.mts [--dry]
// Сериал — по ключу `imdb:` (у карточек справочника другого номера нет; у `l-tmdbtv<id>` номер сериала — в id):
// IMDb → `/find` → номер сериала TMDb → `/tv/<id>` с ключевыми словами. Жанры сериалов у TMDb составные
// («Боевик и Приключения», «НФ и Фэнтези», «Война и Политика») — раскладываются на жанры фильмов, дальше — тот же
// `pick`, что у всех. Кэш — .cache/tmdb-tv-tags.json, итог — src/mocks/seriesRegisters.ts (ключ `imdb:` → регистры);
// приложение накладывает его на все карточки сериалов при загрузке, откуда бы карточка ни пришла.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { loadEnvFile } from './env-file.mts';
import { worksIndex } from './works-index.mts';
import { pick } from './register-tags.mts';
import { seriesBase } from '../src/mocks/seriesBase.ts';
import { isSeries } from '../src/lib/media.ts';
import type { Register } from '../src/types/tmdf.ts';

loadEnvFile();
const key = process.env.TMDB_API_KEY ?? process.env.VITE_TMDB_API_KEY;
if (!key) { console.error('нужен TMDB_API_KEY (или VITE_TMDB_API_KEY) в .env.local'); process.exit(1); }
const DRY = process.argv.includes('--dry');
const CACHE = '.cache/tmdb-tv-tags.json';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** imdb → номер сериала TMDb, жанры (как у фильмов) и ключевые слова; `none` — TMDb сериала не знает */
type Tags = { tv?: number; genres: string[]; keywords: string[]; none?: true };
const cache: Record<string, Tags> = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : {};

/** Составной жанр сериала → жанры фильмов, которые знает `pick`. */
const GENRE: Record<string, string[]> = {
  'боевик и приключения': ['боевик', 'приключения'],
  'нф и фэнтези': ['фантастика', 'фэнтези'],
  'война и политика': ['военный'],
};
const genresOf = (names: string[]) => names.map((n) => n.toLowerCase()).flatMap((n) => GENRE[n] ?? [n]);

const api = async <T,>(path: string): Promise<T | undefined> => {
  for (let a = 0; a < 3; a++) {
    const r = await fetch(`https://api.themoviedb.org/3${path}${path.includes('?') ? '&' : '?'}api_key=${key}`).catch(() => undefined);
    if (r?.status === 404) return undefined;
    if (r?.ok) return await r.json() as T;
    await sleep(1500 * (a + 1));
  }
  return undefined;
};

// сериалы: справочник (ключ imdb:) и карточки l-tmdbtv… — у них номер сериала уже есть
const tvOf = new Map<string, number>();
for (const w of seriesBase) {
  const imdb = w.externalIds?.imdb, tv = /^l-tmdbtv(\d+)$/.exec(w.id)?.[1];
  if (imdb && tv) tvOf.set(imdb, Number(tv));
}
const imdbs = [...new Set([
  ...worksIndex({ all: true }).filter((w) => isSeries(w.work)).map((w) => w.work.externalIds?.imdb),
  ...seriesBase.map((w) => w.externalIds?.imdb),
].filter((x): x is string => Boolean(x && /^tt\d+$/.test(x))))].sort();
const todo = imdbs.filter((i) => !cache[i]);
console.error(`сериалов: ${imdbs.length}, спросить TMDb: ${todo.length}`);

let n = 0;
for (const imdb of todo) {
  let tv = tvOf.get(imdb);
  if (!tv) tv = (await api<{ tv_results?: { id: number }[] }>(`/find/${imdb}?external_source=imdb_id`))?.tv_results?.[0]?.id;
  if (!tv) { cache[imdb] = { genres: [], keywords: [], none: true }; continue; }
  const t = await api<{ genres?: { name: string }[]; keywords?: { results?: { name: string }[] } }>(`/tv/${tv}?language=ru-RU&append_to_response=keywords`);
  cache[imdb] = { tv, genres: genresOf((t?.genres ?? []).map((g) => g.name)), keywords: (t?.keywords?.results ?? []).map((k) => k.name) };
  if (++n % 100 === 0) { console.error(`  ${n}/${todo.length}`); writeFileSync(CACHE, JSON.stringify(cache)); }
  await sleep(60);
}
writeFileSync(CACHE, JSON.stringify(cache));

const out: Record<string, Register[]> = {};
for (const imdb of imdbs) {
  const t = cache[imdb];
  if (!t || t.none) continue;
  const regs = pick(t.genres, t.keywords);
  if (regs.length) out[`imdb:${imdb}`] = regs;
}
const counts: Record<string, number> = {};
for (const rs of Object.values(out)) for (const r of rs) counts[r] = (counts[r] ?? 0) + 1;
console.log(`с регистром: ${Object.keys(out).length} из ${imdbs.length} (TMDb не знает ${imdbs.filter((i) => cache[i]?.none).length})`);
console.log(Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([r, c]) => `  ${r.padEnd(16)}${c}`).join('\n'));
if (DRY) process.exit(0);
writeFileSync(new URL('../src/mocks/seriesRegisters.ts', import.meta.url), `// Сгенерировано tools/build-series-registers.mts (${new Date().toISOString().slice(0, 10)}) — руками не править.
// Тональный регистр сериалов из жанров и ключевых слов TMDb (тот же \`pick\`, что у фильмов). Ключ — \`imdb:\`:
// приложение накладывает его на все карточки сериалов при загрузке.
import type { Register } from '@/types/tmdf';

export const seriesRegisters: Record<string, Register[]> = ${JSON.stringify(Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b))))};
`);
console.log('→ src/mocks/seriesRegisters.ts');
