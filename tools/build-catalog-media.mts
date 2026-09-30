// Картинки, описание и «где посмотреть» для каталога моков → src/mocks/catalogMedia.ts.
//   KP_API_KEY=… npx tsx tools/build-catalog-media.mts
// Один прогон — по три запроса на фильм (поиск по IMDb, карточка, кинотеатры) и один на книгу
// (Open Library); дальше приложение читает файл и ничего не запрашивает. Перегенерировать,
// когда меняется каталог или протухают ссылки на картинки.
import { writeFileSync } from 'node:fs';
import { externalIds } from '../src/mocks/externalIds.ts';
import { works } from '../src/mocks/index.ts';
import { kinopoiskFromEnv, lookupBook, tmdbFromEnv } from '../src/lib/resolve/index.ts';
import type { WorkCard } from '../src/types/tmdf.ts';
import { isScreen } from '../src/lib/media.ts';

const kp = kinopoiskFromEnv(process.env.KP_API_KEY);
const tmdb = tmdbFromEnv(process.env.TMDB_API_KEY);
if (!kp && !tmdb) { console.error('нужен KP_API_KEY и/или TMDB_API_KEY'); process.exit(1); }
let kpDown = !kp;

const media: Record<string, Partial<WorkCard>> = {};
for (const work of Object.values(works)) {
  const ids = externalIds[work.id];
  try {
    if (work.type === 'book' && ids?.isbn?.[0]) {
      const b = await lookupBook(ids.isbn[0]);
      if (b?.coverUrl) media[work.id] = { coverUrl: b.coverUrl, imageSource: 'open_library' };
    } else if (isScreen(work) && ids?.imdb) {
      let m: Partial<WorkCard> = {};
      if (kp && !kpDown) {
        try {
          const kpId = ids.kinopoisk ?? (await kp.findByImdb(ids.imdb));
          if (kpId != null) {
            const f = await kp.film(kpId);
            const watch = await kp.watch(kpId).catch(() => undefined);
            m = { coverUrl: f?.coverUrl, stillUrl: f?.stillUrl, imageSource: f?.imageSource, blurb: f?.blurb, watch, externalIds: { ...ids, kinopoisk: kpId } };
          }
        } catch (e) { if ((e as Error).message.includes('quota')) { kpDown = true; console.error('  лимит Кинопоиска — дальше TMDb'); } }
      }
      if (tmdb && (!m.stillUrl || !m.watch?.length)) {
        const id = ids.tmdb ?? (await tmdb.findByImdb(ids.imdb));
        if (id != null) {
          const t = await tmdb.movie(id);
          const watch = m.watch?.length ? m.watch : await tmdb.watch(id).catch(() => undefined);
          m = { ...m, coverUrl: m.coverUrl ?? t?.coverUrl, stillUrl: m.stillUrl ?? t?.stillUrl, imageSource: m.imageSource ?? t?.imageSource,
            blurb: m.blurb ?? t?.blurb, watch, externalIds: { ...ids, ...m.externalIds, tmdb: id } };
        }
      }
      if (Object.keys(m).length) media[work.id] = m;
    }
    console.error(`  ${work.id} ${work.title}: ${media[work.id]?.stillUrl ? 'кадр' : media[work.id]?.coverUrl ? 'обложка' : '—'}${media[work.id]?.watch?.length ? `, кинотеатров ${media[work.id]!.watch!.length}` : ''}`);
  } catch (e) {
    console.error(`  ${work.id} ${work.title}: ${(e as Error).message}`);
    if ((e as Error).message.includes('quota') && !tmdb) break;
  }
}

const header = `// Сгенерировано tools/build-catalog-media.mts (${new Date().toISOString().slice(0, 10)}): картинки,
// описание и «где посмотреть» каталога моков. Не править руками — перегенерировать.
import type { WorkCard } from '@/types/tmdf';

export const catalogMedia: Record<string, Partial<WorkCard>> = `;
writeFileSync(new URL('../src/mocks/catalogMedia.ts', import.meta.url), header + JSON.stringify(media, null, 2) + ';\n');
console.error(`→ src/mocks/catalogMedia.ts: ${Object.keys(media).length} произведений`);
