// Таблица «как фильм оценили другие» (23.10, опыт `consensus`, src/lib/model/consensus.ts) — из историй зрителей
// seeds/*.json: один человек под несколькими историями — один (tools/seed-identity.mts), z-оценка в его шкале, по фильму —
// сжатое среднее не меньше чем по MIN_PEOPLE людям. В таблицу идут только эти числа по фильмам — ни имён, ни оценок людей.
// Вторая таблица (23.10, опыт `twoStage`, src/lib/model/candidates.ts) — «сколько человек оценили» тех же фильмов (те же
// ключи: фильмы, оценённые не меньше чем MIN_PEOPLE людьми) — источник «что смотрят все» подбора в два шага.
//   npx tsx tools/build-consensus.mts [--min 20]   → src/mocks/consensus.ts и src/mocks/consensusCount.ts (подбор грузит их
//   лениво, как известность, каждую своим опытом)
import { writeFileSync } from 'node:fs';
import { ratedCountFrom } from '../src/lib/model/candidates.ts';
import { consensusFrom, MIN_PEOPLE, SHRINK } from '../src/lib/model/consensus.ts';
import { peopleZ } from './consensus-data.mts';

const argv = process.argv.slice(2);
const MIN = Number(argv[argv.indexOf('--min') + 1] || 20);

const people = peopleZ(MIN);
const table = consensusFrom(people);
const entries = [...table].sort(([a], [b]) => a.localeCompare(b));
const day = new Date().toISOString().slice(0, 10);
writeFileSync('src/mocks/consensus.ts', `// Сгенерировано tools/build-consensus.mts (${day}): как фильм оценили другие — сжатое среднее z-оценок зрителей
// (людей ${people.size}, у фильма не меньше ${MIN_PEOPLE}, сжатие ${SHRINK}). Ни имён, ни оценок людей — только число по фильму.
// Подбор берёт его опытом \`consensus\` (src/lib/model/consensus.ts). Не править руками — перегенерировать.
export const consensus: Record<string, number> = ${JSON.stringify(Object.fromEntries(entries))};
`);
console.log(`людей ${people.size}, фильмов в таблице ${entries.length} → src/mocks/consensus.ts`);

const counts = [...ratedCountFrom(people)].sort(([a], [b]) => a.localeCompare(b));
writeFileSync('src/mocks/consensusCount.ts', `// Сгенерировано tools/build-consensus.mts (${day}): сколько человек оценили фильм (людей ${people.size}, в таблице —
// оценённые не меньше чем ${MIN_PEOPLE} людьми). Ни имён, ни оценок — только число по фильму. Подбор в два шага берёт его
// опытом \`twoStage\` (источник «что смотрят все», src/lib/model/candidates.ts). Не править руками — перегенерировать.
export const consensusCount: Record<string, number> = ${JSON.stringify(Object.fromEntries(counts))};
`);
console.log(`фильмов в таблице «сколько оценили» ${counts.length} → src/mocks/consensusCount.ts`);
