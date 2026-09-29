// Собственная история участника → мок `src/mocks/userHistory.ts`.
//   npx tsx tools/build-user-history.mts <файлы экспорта...>
// Файлы: сохранённые страницы «Оценки» профиля Кинопоиска, CSV/список конвертера, экспорты
// Letterboxd / IMDb / Goodreads / StoryGraph — любые вперемешку. Наружу уходят только записи
// о произведениях: ни имени, ни токенов страницы. Wikidata — всегда; TMDb — если задан
// TMDB_API_KEY (постер и кадр). Сериалы в контракте пока нет — откладываются.
import { readFileSync, writeFileSync } from 'node:fs';
import { parseExports } from '../src/lib/import/index.ts';
import { kinopoiskFromEnv, resolveRecords, toWorkCard, tmdbFromEnv } from '../src/lib/resolve/index.ts';
import type { JourneyEntryData, WorkCard } from '../src/types/tmdf.ts';

const files = process.argv.slice(2);
if (!files.length) { console.error('нужны файлы экспорта'); process.exit(1); }

const parsed = parseExports(files.map((f) => readFileSync(f, 'utf8')));
const usable = parsed.records.filter((r) => r.type === 'film' || r.type === 'book');
const skipped = parsed.records.length - usable.length;
console.error(`записей ${parsed.records.length} (${parsed.sources.join(', ')}), в работу ${usable.length}, отложено ${skipped}`);

// Wikimedia просит у не-браузерных клиентов представляться; браузер это делает сам
const fetcher: typeof fetch = async (url, init) => {
  const t0 = Date.now();
  const res = await fetch(url, {
    ...init, headers: { ...(init?.headers as Record<string, string>), 'User-Agent': 'TransformativeMedia/0.1 (dev tool; history import)' },
  });
  console.error(`  ${new URL(String(url)).host} ${res.status} ${Date.now() - t0}ms`);
  return res;
};
const tmdb = tmdbFromEnv(process.env.TMDB_API_KEY, fetcher);
const kp = kinopoiskFromEnv(process.env.KP_API_KEY, fetcher);
const resolved = await resolveRecords(usable, { tmdb, kp, fetcher });

const works: WorkCard[] = [];
const journal: JourneyEntryData[] = [];
// Один фильм из двух файлов (страница «Оценки» и список конвертера) резолвится дважды —
// после резолва дубли видны по внешним ID; остаётся первый (у него оценка и дата).
const seenIds = new Set<string>();
let duplicates = 0;
resolved.forEach((w, i) => {
  const r = usable[i];
  const key = w.externalIds.kinopoisk != null ? `kp${w.externalIds.kinopoisk}`
    : w.externalIds.imdb ?? (w.externalIds.tmdb != null ? `tmdb${w.externalIds.tmdb}` : `n${i}`);
  const idKeys = [w.externalIds.kinopoisk != null && `kp:${w.externalIds.kinopoisk}`, w.externalIds.imdb && `imdb:${w.externalIds.imdb}`,
    w.externalIds.tmdb != null && `tmdb:${w.externalIds.tmdb}`].filter((k): k is string => Boolean(k));
  if (idKeys.some((k) => seenIds.has(k))) { duplicates++; return; }
  idKeys.forEach((k) => seenIds.add(k));
  const card = toWorkCard(w, `u-${key}`);
  if (!card.title) return;
  works.push(card);
  journal.push({
    id: `uj-${key}`,
    work: card,
    status: r.status,
    startedAt: r.status === 'planned' ? undefined : r.date,
    finishedAt: r.status === 'finished' ? r.date : undefined,
    reflections: [],
    stateChanges: [],
  });
});

const stats = {
  works: works.length,
  duplicates,
  wikidata: resolved.filter((w) => w.sources.includes('wikidata')).length,
  tmdb: resolved.filter((w) => w.sources.includes('tmdb')).length,
  kinopoisk: resolved.filter((w) => w.sources.includes('kinopoisk_unofficial')).length,
  withWatch: works.filter((w) => w.watch?.length).length,
  withCreators: works.filter((w) => w.creators.length).length,
  withImages: works.filter((w) => w.coverUrl || w.stillUrl).length,
  withImdb: works.filter((w) => w.externalIds?.imdb).length,
  withTmdb: works.filter((w) => w.externalIds?.tmdb != null).length,
};
console.error(JSON.stringify(stats));

const header = `// Сгенерировано tools/build-user-history.mts из собственного экспорта участника
// (${new Date().toISOString().slice(0, 10)}): ${stats.works} произведений, Wikidata ${stats.wikidata},
// TMDb ${stats.tmdb}. Разметки нет: primaryOperations пусты, complexityLevel 0 — это история,
// а не каталог. Не править руками — перегенерировать.
import type { JourneyEntryData, WorkCard } from '@/types/tmdf';

`;
// журнал ссылается на те же объекты карточек — в файле карточки один раз, записи по id
const journalLite = journal.map(({ work, ...rest }) => ({ ...rest, workId: work.id }));
const body = `export const userWorks: WorkCard[] = ${JSON.stringify(works, null, 2)};

const byId = new Map(userWorks.map((w) => [w.id, w]));
const entries: (Omit<JourneyEntryData, 'work'> & { workId: string })[] = ${JSON.stringify(journalLite, null, 2)};

export const userJournal: JourneyEntryData[] = entries.map(({ workId, ...e }) => ({ ...e, work: byId.get(workId)! }));
`;
writeFileSync(new URL('../src/mocks/userHistory.ts', import.meta.url), header + body);
console.error('→ src/mocks/userHistory.ts');
