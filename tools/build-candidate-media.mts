// Внешние ID, картинки, описание и «где посмотреть» для пула кандидатов → src/mocks/candidateMedia.ts.
//   TMDB_API_KEY=… [KP_API_KEY=…] npx tsx tools/build-candidate-media.mts
// TMDb: поиск по оригинальному названию и году → карточка, кадр, кинотеатры RU; Кинопоиск,
// если задан ключ и не исчерпан лимит, — русское описание, кадр и площадки поверх TMDb.
import { writeFileSync } from 'node:fs';
import { candidateSeeds } from '../src/mocks/candidates.ts';
import { kinopoiskFromEnv, tmdbFromEnv } from '../src/lib/resolve/index.ts';
import type { WorkCard } from '../src/types/tmdf.ts';

const tmdb = tmdbFromEnv(process.env.TMDB_API_KEY);
const kp = kinopoiskFromEnv(process.env.KP_API_KEY);
if (!tmdb) { console.error('нужен TMDB_API_KEY'); process.exit(1); }
let kpDown = !kp;

const media: Record<string, Partial<WorkCard>> = {};
for (const s of candidateSeeds) {
  try {
    const found = await tmdb.search(s.originalTitle, s.year);
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
