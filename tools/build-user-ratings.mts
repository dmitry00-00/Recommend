// Оценки участника из его же экспорта → мок `src/mocks/userRatings.ts`. Без сети: тот же
// разбор, что у build-user-history.mts, но наружу — только id карточки и оценка 1–5
// (шкала источника 0–10 делится пополам). В интерфейсе оценки не показываются — это
// сигнал для модели пользователя.
//   npx tsx tools/build-user-ratings.mts <файлы экспорта...>
import { readFileSync, writeFileSync } from 'node:fs';
import { parseExports } from '../src/lib/import/index.ts';
import { userWorks } from '../src/mocks/userHistory.ts';

const files = process.argv.slice(2);
if (!files.length) { console.error('нужны файлы экспорта'); process.exit(1); }

const parsed = parseExports(files.map((f) => readFileSync(f, 'utf8')));
const byKp = new Map(userWorks.filter((w) => w.externalIds?.kinopoisk != null).map((w) => [w.externalIds!.kinopoisk!, w.id]));
const byTitle = new Map(userWorks.map((w) => [`${w.title.toLowerCase()}|${w.year}`, w.id]));

const ratings: Record<string, { rating: 1 | 2 | 3 | 4 | 5; raw: number }> = {};
let matched = 0;
for (const r of parsed.records) {
  if (r.rating == null || r.rating <= 0) continue;
  const id = (r.externalIds?.kinopoisk != null ? byKp.get(r.externalIds.kinopoisk) : undefined)
    ?? byTitle.get(`${r.title.toLowerCase()}|${r.year}`);
  if (!id) continue;
  const rating = Math.min(5, Math.max(1, Math.round(r.rating / 2))) as 1 | 2 | 3 | 4 | 5;
  ratings[id] = { rating, raw: r.rating };
  matched++;
}

const dist = [1, 2, 3, 4, 5].map((v) => `${v}: ${Object.values(ratings).filter((x) => x.rating === v).length}`).join(', ');
const header = `// Сгенерировано tools/build-user-ratings.mts (${new Date().toISOString().slice(0, 10)}): оценки участника
// из его экспорта, приведённые к 1–5 (raw — шкала источника 0–10). Не показываются в
// интерфейсе; сигнал для модели пользователя. Не править руками — перегенерировать.

export const userRatings: Record<string, { rating: 1 | 2 | 3 | 4 | 5; raw: number }> = `;
writeFileSync(new URL('../src/mocks/userRatings.ts', import.meta.url), header + JSON.stringify(ratings, null, 2) + ';\n');
console.error(`→ src/mocks/userRatings.ts: ${matched} оценок (${dist})`);
