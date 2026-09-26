// История владельца для сервера на bothost: то, что до сервера знал только фронтенд
// (моки из его собственного экспорта), в виде, который воркер кладёт в профиль при первом
// входе (worker/index.ts, seedOwner). Запускается из tools/build-bothost.mjs, руками не нужен.
import { userJournal } from '@/mocks/userHistory';
import { userRatings } from '@/mocks/userRatings';
import { watchedWorks } from '@/mocks/userWatched';

const seed = {
  journal: userJournal.map((e) => ({
    entryId: e.id, workId: e.work.id, work: e.work, status: e.status,
    ...(e.startedAt ? { startedAt: e.startedAt } : {}), ...(e.finishedAt ? { finishedAt: e.finishedAt } : {}),
  })),
  ratings: Object.entries(userRatings).map(([workId, r]) => ({ workId, rating: r.rating, raw: r.raw })),
  watched: watchedWorks.map((w) => ({
    workId: w.id, work: w,
    ...(w.externalIds?.tmdb != null ? { tmdb: w.externalIds.tmdb } : {}), ...(w.externalIds?.imdb ? { imdb: w.externalIds.imdb } : {}),
  })),
};
process.stdout.write(JSON.stringify(seed));
