// Английские названия (ЗП-20, 08.10): английский интерфейс показывает оригинальное название (`titleOf`), но у
// 1 860 карточек оригинала нет вовсе (справочник из Wikidata), у сотни он не латиницей — «기생충»,
// «君たちはどう生きるか», «Сталкер», — а французский или немецкий оригинал англоязычному зрителю незнаком
// («Le Pacte des loups» — «Brotherhood of the Wolf»). Здесь — название из TMDb (language=en-US): по ID TMDb,
// без него — через ID IMDb (/find). Кэш — .cache/titles-en.json, второй прогон в сеть не ходит.
//   npx tsx --env-file=.env.local tools/titles-en.mts   → src/mocks/titlesEn.ts
// Ключ — `m<tmdb>` (фильм) или `t<tmdb>` (сериал); без ID TMDb — `imdb:tt…`. Читает src/lib/format.ts (titleOf).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { worksIndex } from './works-index.mts';
import { filmBase } from '../src/mocks/filmBase.ts';
import { filmBaseWiki } from '../src/mocks/filmBaseWiki.ts';
import { userWorks } from '../src/mocks/userHistory.ts';
import { watchedWorks } from '../src/mocks/userWatched.ts';
import { enTitleKey } from '../src/lib/format.ts';
import type { WorkCard } from '../src/types/tmdf.ts';

const CACHE = new URL('../.cache/titles-en.json', import.meta.url);
const cache: Record<string, string | null> = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : {};
const token = process.env.VITE_TMDB_API_KEY ?? process.env.TMDB_API_KEY;
if (!token) { console.error('нет VITE_TMDB_API_KEY в .env.local'); process.exit(1); }
const bearer = token.length > 40;
const LATIN = /^[\p{Script=Latin}\p{N}\p{P}\p{Zs}\p{S}]+$/u;
/** Оригинал годится для английского интерфейса: есть и написан латиницей. */
export const latinOriginal = (w: Pick<WorkCard, 'originalTitle'>): boolean => Boolean(w.originalTitle && LATIN.test(w.originalTitle));

async function tmdb(path: string, params: Record<string, string> = {}): Promise<Record<string, unknown> | undefined> {
  const url = new URL(`https://api.themoviedb.org/3/${path}`);
  url.searchParams.set('language', 'en-US');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  if (!bearer) url.searchParams.set('api_key', token!);
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, { headers: bearer ? { authorization: `Bearer ${token}` } : {} }).catch(() => undefined);
    if (res?.status === 429) { await new Promise((r) => setTimeout(r, 1500)); continue; }
    return res?.ok ? await res.json() as Record<string, unknown> : undefined;
  }
  return undefined;
}

async function englishTitle(w: WorkCard): Promise<string | null> {
  const t = w.externalIds?.tmdb;
  const tv = w.type === 'series';
  if (t != null) {
    const body = await tmdb(`${tv ? 'tv' : 'movie'}/${t}`);
    return (body?.[tv ? 'name' : 'title'] as string | undefined) ?? null;
  }
  const imdb = w.externalIds?.imdb;
  if (!imdb) return null;
  const body = await tmdb(`find/${imdb}`, { external_source: 'imdb_id' });
  const hit = ((body?.movie_results ?? []) as { title?: string }[])[0]?.title ?? ((body?.tv_results ?? []) as { name?: string }[])[0]?.name;
  return hit ?? null;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const all = [...worksIndex({ all: true }).map((x) => x.work), ...filmBase, ...filmBaseWiki, ...userWorks, ...watchedWorks];
  const todo = new Map<string, WorkCard>();
  for (const w of all) {
    if (w.type === 'book') continue;
    const key = enTitleKey(w);
    if (key && !todo.has(key)) todo.set(key, w);
  }
  const ask = [...todo].filter(([k]) => !(k in cache));
  console.error(`без английского названия ${todo.size}, спросить TMDb ${ask.length}`);
  let i = 0, done = 0;
  await Promise.all(Array.from({ length: 8 }, async () => {
    while (i < ask.length) {
      const [k, w] = ask[i++];
      cache[k] = await englishTitle(w);
      if (++done % 200 === 0) { writeFileSync(CACHE, JSON.stringify(cache)); console.error(`  ${done}/${ask.length}`); }
    }
  }));
  writeFileSync(CACHE, JSON.stringify(cache));
  // в файл — только латинские английские названия, отличные от того, что titleOf покажет и без них
  // (латинский оригинал, иначе название карточки)
  const shown = (w: WorkCard) => (latinOriginal(w) ? w.originalTitle! : w.title);
  const out = Object.fromEntries([...todo].map(([k, w]) => [k, cache[k]] as const)
    .filter((e): e is readonly [string, string] => Boolean(e[1] && LATIN.test(e[1]) && e[1] !== shown(todo.get(e[0])!)))
    .sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(new URL('../src/mocks/titlesEn.ts', import.meta.url), `// Сгенерировано tools/titles-en.mts (${new Date().toISOString().slice(0, 10)}): английские названия для карточек, у
// которых английское название не совпадает с оригиналом (TMDb, language=en-US). Читает titleOf в английском интерфейсе.
// Не править руками — перегенерировать.
export const titlesEn: Record<string, string> = ${JSON.stringify(out, null, 0).replace(/","/g, '",\n  "').replace(/^\{/, '{\n  ').replace(/\}$/, ',\n}')};
`);
  console.error(`→ src/mocks/titlesEn.ts: ${Object.keys(out).length} названий`);
}
