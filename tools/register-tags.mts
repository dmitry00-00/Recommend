// Общее для генераторов: как из жанров и ключевых слов TMDb получается тональный регистр.
// Это заглушка вместо разметки аннотатором — механическая, зато одинаковая для истории,
// пула, присланного списка и базовой частоты по миру.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { registerKeys } from '../src/lib/registers.ts';
import type { Register } from '../src/types/tmdf.ts';

export interface Tags { genres: string[]; keywords: string[] }

/** Жанры и ключевые слова TMDb с кешем в файле (путь — в TAGS_CACHE): один фильм — один запрос,
 *  а спрашивают о них три генератора. */
export function tagSource(apiKey = process.env.TMDB_API_KEY, cacheFile = process.env.TAGS_CACHE) {
  const cache: Record<string, Tags> = cacheFile && existsSync(cacheFile) ? JSON.parse(readFileSync(cacheFile, 'utf8')) : {};
  let added = 0;
  return {
    async tags(id: number): Promise<Tags> {
      if (cache[id]) return cache[id];
      if (!apiKey) throw new Error('нужен TMDB_API_KEY либо заполненный TAGS_CACHE');
      const r = await fetch(`https://api.themoviedb.org/3/movie/${id}?api_key=${apiKey}&language=ru-RU&append_to_response=keywords`);
      if (!r.ok) return { genres: [], keywords: [] };
      const j = await r.json() as { genres?: { name: string }[]; keywords?: { keywords?: { name: string }[] } };
      cache[id] = { genres: (j.genres ?? []).map((g) => g.name), keywords: (j.keywords?.keywords ?? []).map((k) => k.name) };
      added += 1;
      return cache[id];
    },
    save() { if (cacheFile && added) writeFileSync(cacheFile, JSON.stringify(cache)); },
  };
}

export const KEYWORDS: Record<Register, string[]> = {
  folk_gothic: ['witch', 'witchcraft', 'occult', 'demon', 'possession', 'exorcism', 'ritual', 'folklore', 'folk horror',
    'curse', 'vampire', 'gothic', 'medieval', 'haunted house', 'ghost', 'satanism', 'cult', 'paganism', 'black magic',
    'devil', 'supernatural', 'superstition', 'legend', 'monster', 'werewolf', 'forest', 'village', 'inquisition'],
  body_visceral: ['gore', 'body horror', 'cannibalism', 'mutation', 'torture', 'splatter', 'surgery', 'blood',
    'zombie', 'transformation', 'dismemberment', 'disease', 'plastic surgery', 'self-harm', 'slasher'],
  cold_clinical: ['experiment', 'laboratory', 'scientist', 'psychiatric hospital', 'mental hospital', 'hospital',
    'isolation', 'surveillance', 'corporation', 'bureaucracy', 'prison', 'institution', 'quarantine', 'observation'],
  genre_idea: ['time loop', 'time travel', 'artificial intelligence', 'transhumanism', 'cyberpunk', 'virtual reality',
    'dystopia', 'robot', 'clone', 'simulation', 'space travel', 'future', 'android', 'parallel universe', 'technology'],
  puzzle_noir: ['detective', 'investigation', 'murder', 'serial killer', 'mystery', 'police', 'crime', 'film noir',
    'kidnapping', 'missing person', 'whodunit', 'heist', 'conspiracy', 'private detective', 'twist ending'],
  absurd_satire: ['black comedy', 'satire', 'dark humor', 'parody', 'absurd', 'class differences', 'social satire'],
  quiet_realism: ['family relationships', 'marriage', 'loneliness', 'grief', 'coming of age', 'friendship',
    'father son relationship', 'mother daughter relationship', 'love', 'depression'],
  myth_adventure: ['sword', 'quest', 'hero', 'adventure', 'epic', 'knight', 'pirate', 'mythology', 'treasure', 'war'],
};
// Жанр весит меньше слова: он говорит о полке, а не о тоне.
const GENRES: Record<Register, string[]> = {
  folk_gothic: ['ужасы', 'фэнтези'],
  body_visceral: ['ужасы'],
  cold_clinical: [],
  genre_idea: ['фантастика'],
  puzzle_noir: ['детектив', 'криминал', 'триллер'],
  absurd_satire: ['комедия'],
  quiet_realism: ['драма', 'мелодрама'],
  myth_adventure: ['приключения', 'боевик', 'история', 'военный', 'вестерн'],
};
const FALLBACK: [string, Register][] = [['ужасы', 'folk_gothic'], ['фантастика', 'genre_idea'], ['детектив', 'puzzle_noir'],
  ['криминал', 'puzzle_noir'], ['триллер', 'puzzle_noir'], ['комедия', 'absurd_satire'], ['приключения', 'myth_adventure'],
  ['боевик', 'myth_adventure'], ['фэнтези', 'myth_adventure'], ['драма', 'quiet_realism']];

export function pick(genres: string[], keywords: string[]): Register[] {
  const kw = keywords.map((k) => k.toLowerCase());
  const scored = registerKeys
    .map((r) => ({
      r,
      score: KEYWORDS[r].filter((k) => kw.some((x) => x === k || x.includes(k))).length + 0.5 * GENRES[r].filter((g) => genres.includes(g)).length,
    }))
    .filter((x) => x.score >= 1)
    .sort((a, b) => b.score - a.score);
  // второй регистр только если он почти столь же силён: два ярлыка на всё — уже не регистр
  const out = scored.slice(0, 1).map((x) => x.r);
  if (scored[1] && scored[1].score >= Math.max(1.5, scored[0].score * 0.6)) out.push(scored[1].r);
  if (out.length) return out;
  const f = FALLBACK.find(([g]) => genres.includes(g));
  return f ? [f[1]] : [];
}
