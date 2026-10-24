// z-оценки людей по историям seeds/*.json (23.10) — для таблицы «как фильм оценили другие» (tools/build-consensus.mts)
// и для замера (tools/taste-eval.mts, где таблица каждому собирается без него самого). Один человек под несколькими
// историями — один (tools/seed-identity.mts); у фильма одна оценка, сколько бы ключей у него ни было.
import { readdirSync, readFileSync } from 'node:fs';
import { consensusKeys, zScores } from '../src/lib/model/consensus.ts';
import { identityOf } from './seed-identity.mts';

interface Rated { workId: string; raw?: number; work?: { type?: string; externalIds?: { tmdb?: number; imdb?: string } } }
/** ключи записи истории: по карточке, иначе по id записи (`tmdb:…`, `l-tmdbtv…`) */
function keysOf(r: Rated): string[] {
  const type = r.work?.type ?? (/^l-tmdbtv|^tmdbtv:/.test(r.workId) ? 'series' : 'film');
  const ids = { ...r.work?.externalIds };
  const m = /^(?:l-)?tmdb(tv)?:?(\d+)$/.exec(r.workId);
  if (ids.tmdb == null && m) ids.tmdb = Number(m[2]);
  const im = /^imdb:(tt\d+)$/.exec(r.workId);
  if (!ids.imdb && im) ids.imdb = im[1];
  return consensusKeys(type, ids);
}

/** человек → (ключ фильма → z-оценка); истории меньше `min` оценок — мимо. `dir` — другой набор историй (замер --seeds) */
export function peopleZ(min = 20, dir = 'seeds'): Map<string, Map<string, number>> {
  // человек → его оценки по фильмам: ключи фильма и сырая оценка (первая встреченная история главнее)
  const films = new Map<string, { keys: string[]; raw: number }[]>();
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    let ratings: Rated[];
    try { ratings = (JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')) as { ratings?: Rated[] }).ratings ?? []; } catch { continue; }
    // не история (_meta.json набора MovieLens: ratings там — счётчик)
    if (!Array.isArray(ratings)) continue;
    ratings = ratings.filter((r) => r.raw != null);
    if (ratings.length < min) continue;
    const who = identityOf(f.replace(/\.json$/, ''));
    const mine = films.get(who) ?? [];
    const seen = new Set(mine.flatMap((x) => x.keys));
    for (const r of ratings) {
      const keys = keysOf(r);
      if (!keys.length || keys.some((k) => seen.has(k))) continue;
      keys.forEach((k) => seen.add(k));
      mine.push({ keys, raw: r.raw! });
    }
    films.set(who, mine);
  }
  // z — по фильмам, а не по ключам: у фильма два ключа, а в среднем и разбросе человека он один
  return new Map([...films].map(([who, list]) => {
    const z = zScores(new Map(list.map((x, i) => [String(i), x.raw])));
    return [who, new Map(list.flatMap((x, i) => x.keys.map((k) => [k, z.get(String(i))!] as [string, number])))];
  }));
}
