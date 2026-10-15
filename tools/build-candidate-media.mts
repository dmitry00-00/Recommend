// Внешние ID, картинки, описание и «где посмотреть» для пула кандидатов → src/mocks/candidateMedia.ts.
//   TMDB_API_KEY=… [KP_API_KEY=…] npx tsx tools/build-candidate-media.mts [--only c-burning,c-enemy]
// --only — пересобрать только эти карточки, остальные оставить как есть (данные Кинопоиска при исчерпанном
// лимите иначе потерялись бы у всех).
// TMDb: поиск по оригинальному названию и году → карточка, кадр, кинотеатры RU; Кинопоиск,
// если задан ключ и не исчерпан лимит, — русское описание, кадр и площадки поверх TMDb.
import { writeFileSync } from 'node:fs';
import { candidateMedia as prev } from '../src/mocks/candidateMedia.ts';
import { candidateSeeds } from '../src/mocks/candidates.ts';
import { kinopoiskFromEnv, tmdbFromEnv } from '../src/lib/resolve/index.ts';
import type { WorkCard } from '../src/types/tmdf.ts';

const tmdb = tmdbFromEnv(process.env.TMDB_API_KEY);
const kp = kinopoiskFromEnv(process.env.KP_API_KEY);
if (!tmdb) { console.error('нужен TMDB_API_KEY'); process.exit(1); }
let kpDown = !kp;

// поиск по названию промахивается: «Burning» (2018) — корейский «버닝», которого TMDb с русской локалью
// не ставит даже в первую шестёрку (впереди «Mississippi Burning» и короткий метр-тёзка)
const TMDB_ID: Record<string, { id: number; imdb: string }> = { 'c-burning': { id: 491584, imdb: 'tt7282468' } };
const argv = process.argv.slice(2);
const ONLY = argv.includes('--only') ? new Set(argv[argv.indexOf('--only') + 1].split(',')) : undefined;
const media: Record<string, Partial<WorkCard>> = ONLY ? { ...prev } : {};
for (const s of candidateSeeds) {
  if (ONLY && !ONLY.has(s.id)) continue;
  try {
    const found = TMDB_ID[s.id] ?? await tmdb.search(s.originalTitle, s.year);
    if (!found) { console.error(`  ${s.id}: не найдено в TMDb`); continue; }
    const t = await tmdb.movie(found.id);
    const watch = await tmdb.watch(found.id).catch(() => []);
    let m: Partial<WorkCard> = {
      coverUrl: t?.coverUrl, stillUrl: t?.stillUrl, imageSource: t?.imageSource, blurb: t?.blurb, watch,
      durationMinutes: t?.durationMinutes, countries: t?.countries,
      externalIds: { tmdb: found.id, ...(found.imdb ? { imdb: found.imdb } : {}) },
    };
    if (kp && !kpDown && found.imdb) {
      try {
        const kpId = await kp.findByImdb(found.imdb);
        if (kpId != null) {
          const f = await kp.film(kpId);
          const kw = await kp.watch(kpId).catch(() => undefined);
          m = { ...m, coverUrl: f?.coverUrl ?? m.coverUrl, stillUrl: f?.stillUrl ?? m.stillUrl, imageSource: f?.imageSource ?? m.imageSource,
            blurb: f?.blurb ?? m.blurb, watch: kw?.length ? kw : m.watch, externalIds: { ...m.externalIds, kinopoisk: kpId } };
        }
      } catch (e) { if ((e as Error).message.includes('quota')) { kpDown = true; console.error('  лимит Кинопоиска — дальше TMDb'); } }
    }
    media[s.id] = m;
    console.error(`  ${s.id} ${s.title}: ${m.stillUrl ? 'кадр' : '—'}${m.watch?.length ? `, кинотеатров ${m.watch.length}` : ''}${m.externalIds?.kinopoisk ? ', КП' : ''}`);
  } catch (e) {
    console.error(`  ${s.id}: ${(e as Error).message}`);
  }
}

const header = `// Сгенерировано tools/build-candidate-media.mts (${new Date().toISOString().slice(0, 10)}): внешние ID,
// картинки, описание и «где посмотреть» пула кандидатов. Не править руками — перегенерировать.
import type { WorkCard } from '@/types/tmdf';

export const candidateMedia: Record<string, Partial<WorkCard>> = `;
writeFileSync(new URL('../src/mocks/candidateMedia.ts', import.meta.url), header + JSON.stringify(media, null, 2) + ';\n');
console.error(`→ src/mocks/candidateMedia.ts: ${Object.keys(media).length} из ${candidateSeeds.length}`);
