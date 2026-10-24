// Оценки людей по фильмам для «похожих фильмов» (23.10, опыт `itemSim`, src/lib/model/itemSim.ts) — те же правила, что
// у peopleZ (tools/consensus-data.mts): один человек под несколькими историями — один (tools/seed-identity.mts), первая
// встреченная история главнее, z-оценка — по фильмам в шкале самого человека. Отличие одно: фильм остаётся записью со
// всеми своими ключами ({ keys, z }), а не россыпью ключей — сходству нужен один фильм, а не два (TMDb и IMDb) с одной оценкой.
//   import { peopleFilms, storiesRated } from './item-sim-data.mts';
import { readdirSync, readFileSync } from 'node:fs';
import { consensusKeys, zScores } from '../src/lib/model/consensus.ts';
import type { RatedFilm } from '../src/lib/model/itemSim.ts';
import { identityOf } from './seed-identity.mts';

export interface Rated { workId: string; raw?: number; work?: { type?: string; externalIds?: { tmdb?: number; imdb?: string } } }
/** ключи записи истории: по карточке, иначе по id записи (`tmdb:…`, `l-tmdbtv…`) — как keysOf в consensus-data.mts */
export function keysOf(r: Rated): string[] {
  const type = r.work?.type ?? (/^l-tmdbtv|^tmdbtv:/.test(r.workId) ? 'series' : 'film');
  const ids = { ...r.work?.externalIds };
  const m = /^(?:l-)?tmdb(tv)?:?(\d+)$/.exec(r.workId);
  if (ids.tmdb == null && m) ids.tmdb = Number(m[2]);
  const im = /^imdb:(tt\d+)$/.exec(r.workId);
  if (!ids.imdb && im) ids.imdb = im[1];
  return consensusKeys(type, ids);
}

/** истории seeds/*.json с оценками (не меньше `min`), по имени — в порядке файлов; карточки отброшены (память).
 *  `dir` — другой набор историй (замер --seeds) */
export function storiesRated(min = 20, dir = 'seeds'): Map<string, { workId: string; raw: number; keys: string[] }[]> {
  const out = new Map<string, { workId: string; raw: number; keys: string[] }[]>();
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
    let ratings: Rated[];
    try { ratings = (JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')) as { ratings?: Rated[] }).ratings ?? []; } catch { continue; }
    // не история (_meta.json набора MovieLens: ratings там — счётчик)
    if (!Array.isArray(ratings)) continue;
    ratings = ratings.filter((r) => r.raw != null);
    if (ratings.length < min) continue;
    out.set(f.replace(/\.json$/, ''), ratings.map((r) => ({ workId: r.workId, raw: r.raw!, keys: keysOf(r) })));
  }
  return out;
}

/** человек → его фильмы { ключи, z-оценка }; истории меньше `min` оценок — мимо. `stories` — уже прочитанные (замер) */
export function peopleFilms(min = 20, stories = storiesRated(min)): Map<string, RatedFilm[]> {
  const films = new Map<string, { keys: string[]; raw: number }[]>();
  for (const [name, ratings] of stories) {
    const who = identityOf(name);
    const mine = films.get(who) ?? [];
    const seen = new Set(mine.flatMap((x) => x.keys));
    for (const r of ratings) {
      if (!r.keys.length || r.keys.some((k) => seen.has(k))) continue;
      r.keys.forEach((k) => seen.add(k));
      mine.push({ keys: r.keys, raw: r.raw });
    }
    films.set(who, mine);
  }
  return new Map([...films].map(([who, list]) => {
    const z = zScores(new Map(list.map((x, i) => [String(i), x.raw])));
    return [who, list.map((x, i) => ({ keys: x.keys, z: z.get(String(i))! }))];
  }));
}
