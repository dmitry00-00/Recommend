// Тональный регистр произведений мока — из жанров и ключевых слов TMDb.
//   TMDB_API_KEY=… TAGS_CACHE=/…/tmdb-tags.json npx tsx tools/build-registers.mts
// Это заглушка вместо разметки: в настоящем конвейере регистр ставит аннотатор, здесь он
// выводится механически, зато одинаково для истории, пула и присланного списка — иначе
// проверка на отложенной выборке подсматривала бы ответ. Пишет src/mocks/workRegisters.ts.
import { writeFileSync } from 'node:fs';
import { userWorks } from '../src/mocks/userHistory.ts';
import { works as catalogWorks } from '../src/mocks/index.ts';
import { externalIds } from '../src/mocks/externalIds.ts';
import { candidateSeeds, seedToCard } from '../src/mocks/candidates.ts';
import { candidateMedia } from '../src/mocks/candidateMedia.ts';
import { watchedWorks } from '../src/mocks/userWatched.ts';
import { filmBase } from '../src/mocks/filmBase.ts';
import { pick, tagSource } from './register-tags.mts';
import type { Register, WorkCard } from '../src/types/tmdf.ts';

const { tags, save } = tagSource();

const works: WorkCard[] = [
  ...userWorks,
  // каталог моков тоже в подборе — без регистра эти кадры выглядели бы нейтральными и
  // вытесняли бы размеченные; у книг TMDb-ID нет, они остаются без регистра честно
  ...Object.values(catalogWorks).map((w) => ({ ...w, externalIds: w.externalIds ?? externalIds[w.id] })),
  ...candidateSeeds.map((s) => ({ ...seedToCard(s), ...candidateMedia[s.id] }) as WorkCard),
  ...watchedWorks,
  // справочник тоже: без регистра у него нечем проверять граф соупоминаний (23.09) — пары
  // строятся в основном на справочных фильмах, и сравнивать их было не с чем
  ...filmBase,
];
const out: Record<string, Register[]> = {};
let missing = 0;
for (const w of works) {
  const id = w.externalIds?.tmdb;
  if (id == null) { missing += 1; continue; }
  const t = await tags(id);
  out[w.id] = pick(t.genres, t.keywords);
}
save();
writeFileSync(new URL('../src/mocks/workRegisters.ts', import.meta.url),
  `// Сгенерировано tools/build-registers.mts (${new Date().toISOString().slice(0, 10)}): тональный регистр
// произведений мока, выведенный из жанров и ключевых слов TMDb. Заглушка вместо разметки
// аннотатором — одинаковая для истории, пула и присланного списка. Не править руками.
import type { Register } from '@/types/tmdf';

export const workRegisters: Record<string, Register[]> = ${JSON.stringify(out, null, 2)};
`);
const counts: Record<string, number> = {};
for (const rs of Object.values(out)) for (const r of rs) counts[r] = (counts[r] ?? 0) + 1;
console.error(`→ src/mocks/workRegisters.ts: ${Object.keys(out).length} произведений, без TMDb ID ${missing}`);
console.error(Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([r, n]) => `  ${r.padEnd(16)}${n}`).join('\n'));
