// Список просмотренного, присланный участником владельцу (с согласия участника), → профиль
// участника на сервере. Вход — seeds/<ник>.txt, выход — seeds/<ник>.json (UserSeed из
// worker/env.ts); на сервер его кладёт tools/publish-seed.mts, в профиль он ложится при
// следующем входе участника в приложение (worker/index.ts, applyUserSeed).
//   npx tsx tools/resolve-seed.mts            — все seeds/*.txt, у которых .json старше
//   npx tsx tools/resolve-seed.mts <ник>      — один список, заново
// Формат .txt: строка — название, год в конце желателен (с ним поиск не промахнётся на ремейк).
// Разделы `[фильмы]` и `[сериалы]`; строки с `#` — комментарии. Лучше всего ищется оригинальное
// название. Поиск по TMDb, ключ — TMDB_API_KEY или VITE_TMDB_API_KEY из .env.local.
// Папка seeds/ — чужие личные данные: она в .gitignore и в репозиторий не уходит.
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { loadEnvFile } from './env-file.mts';
import { tmdbFromEnv } from '../src/lib/resolve/index.ts';
import type { WorkCard } from '../src/types/tmdf.ts';
import type { UserSeed } from '../worker/env.ts';

loadEnvFile();
const tmdb = tmdbFromEnv(process.env.TMDB_API_KEY || process.env.VITE_TMDB_API_KEY);
if (!tmdb) { console.error('нужен TMDB_API_KEY (или VITE_TMDB_API_KEY) в .env.local'); process.exit(1); }

const DIR = 'seeds';
const only = process.argv[2]?.replace(/^@/, '');
const names = existsSync(DIR)
  ? readdirSync(DIR).filter((f) => f.endsWith('.txt')).map((f) => f.slice(0, -4))
    .filter((n) => (only ? n.toLowerCase() === only.toLowerCase()
      : !existsSync(`${DIR}/${n}.json`) || statSync(`${DIR}/${n}.json`).mtimeMs < statSync(`${DIR}/${n}.txt`).mtimeMs))
  : [];
if (!names.length) { console.error(only ? `нет ${DIR}/${only}.txt` : 'новых списков нет'); process.exit(only ? 1 : 0); }

const blank = { primaryOperations: [], complexityLevel: 0, warnings: [], barriers: [], isNicheMasterpiece: false };

for (const name of names) {
  const text = readFileSync(`${DIR}/${name}.txt`, 'utf8');
  const watched: UserSeed['watched'] = [];
  const unmatched: string[] = [];
  let section: 'film' | 'series' = 'film';
  console.error(`\n@${name}`);
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    if (/^\[сериалы\]$/i.test(line)) { section = 'series'; continue; }
    if (/^\[фильмы\]$/i.test(line)) { section = 'film'; continue; }
    const m = /^(.*?)[\s,]*((?:19|20)\d{2})?$/.exec(line);
    const title = (m?.[1] ?? line).trim();
    const year = m?.[2] ? Number(m[2]) : undefined;
    try {
      const find = section === 'series' ? tmdb.searchTv.bind(tmdb) : tmdb.search.bind(tmdb);
      const hit = (await find(title, year)) ?? (year ? await find(title) : undefined);
      const t = hit && (section === 'series' ? await tmdb.tv(hit.id) : await tmdb.movie(hit.id));
      if (!hit || !t?.title) { unmatched.push(line); console.error(`  ✗ ${line}`); continue; }
      const work: WorkCard = {
        // у сериалов TMDb свои номера: в id и во внешних ключах их с фильмами не смешиваем
        id: section === 'series' ? `l-tmdbtv${hit.id}` : `l-tmdb${hit.id}`,
        type: section === 'series' ? 'series' : 'film',
        ...(section === 'series' && t.series ? { series: t.series } : {}),
        title: t.title, originalTitle: t.originalTitle, year: t.year ?? year ?? 0,
        creators: t.creators ?? [], countries: t.countries, coverUrl: t.coverUrl, stillUrl: t.stillUrl,
        imageSource: t.imageSource, blurb: t.blurb, durationMinutes: t.durationMinutes, ...blank,
        externalIds: section === 'series'
          ? (hit.imdb ? { imdb: hit.imdb } : {})
          : { tmdb: hit.id, ...(hit.imdb ? { imdb: hit.imdb } : {}) },
      };
      watched.push({
        workId: work.id, work,
        ...(section === 'film' ? { tmdb: hit.id } : {}), ...(hit.imdb ? { imdb: hit.imdb } : {}),
      });
      const flag = year && t.year && Math.abs(t.year - year) > 1 ? '  ← год не совпал, проверить' : '';
      console.error(`  ${line} → ${t.title} (${t.year ?? '?'}) ${t.creators?.[0] ?? ''}${flag}`);
    } catch (err) {
      unmatched.push(line);
      console.error(`  ✗ ${line}: ${(err as Error).message}`);
    }
  }
  // импорт с Кинопоиска (tools/import-kinopoisk.mts) в том же файле — его записи и оценки остаются
  const prevPath = `${DIR}/${name}.json`;
  const prev = existsSync(prevPath) ? JSON.parse(readFileSync(prevPath, 'utf8')) as UserSeed & { unmatchedKinopoisk?: string[] } : undefined;
  const own = new Set(watched.map((w) => w.workId));
  const fromKp = (prev?.watched ?? []).filter((w) => w.from === 'kinopoisk' && !own.has(w.workId));
  const body = { watched: [...watched, ...fromKp], ...(prev?.ratings?.length ? { ratings: prev.ratings } : {}) };
  const version = createHash('sha1').update(JSON.stringify(body)).digest('hex').slice(0, 12);
  const seed: UserSeed & { username: string; unmatched: string[]; resolvedAt: string } = {
    username: name, version, ...body, unmatched,
    ...(prev?.unmatchedKinopoisk ? { unmatchedKinopoisk: prev.unmatchedKinopoisk } : {}), resolvedAt: new Date().toISOString(),
  };
  writeFileSync(`${DIR}/${name}.json`, JSON.stringify(seed, null, 2));
  const films = watched.filter((w) => !(w.work as WorkCard).format).length;
  console.error(`→ ${DIR}/${name}.json: фильмов ${films}, сериалов ${watched.length - films}, не нашлось ${unmatched.length}`);
}
