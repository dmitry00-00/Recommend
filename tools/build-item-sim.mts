// Таблица «похожих фильмов» (23.10, опыт `itemSim`, src/lib/model/itemSim.ts) — из историй зрителей seeds/*.json:
// z-оценки людей (tools/item-sim-data.mts — правила peopleZ), сжатый косинус по общим людям (не меньше ITEM_SIM.minCommon),
// у фильма — N ближайших. В таблицу идут только пары фильмов и уровень сходства — ни имён, ни оценок людей.
//   npx tsx tools/build-item-sim.mts [--min 20] [--n 30] [--shrink 10] [--sizes 20,30,50]   → src/mocks/itemSim.ts
// --sizes — только напечатать размер таблицы при разных N (файл пишется для --n). Память ~1 ГБ (суммы по парам), ~5 с.
import { writeFileSync } from 'node:fs';
import { ITEM_SIM, itemSimSums, itemSimTable, limitItemSim, packItemSim, unpackItemSim } from '../src/lib/model/itemSim.ts';
import { peopleFilms } from './item-sim-data.mts';

const argv = process.argv.slice(2);
const opt = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const MIN = Number(opt('--min') ?? 20);
const N = Number(opt('--n') ?? ITEM_SIM.neighbors);
const SHRINK = Number(opt('--shrink') ?? ITEM_SIM.shrink);
const SIZES = opt('--sizes')?.split(',').map(Number) ?? [];

const people = peopleFilms(MIN);
const sums = itemSimSums(people);
const full = itemSimTable(sums, undefined, { neighbors: Math.max(N, ...SIZES), shrink: SHRINK });
const day = new Date().toISOString().slice(0, 10);
const source = (n: number) => {
  const t = n === Math.max(N, ...SIZES) ? full : limitItemSim(full, n);
  const p = packItemSim(t);
  const pairs = t.own!.reduce((s, o) => s + o.j.length, 0);
  // распаковка должна дать ровно те же взаимные списки (номера и уровни)
  const back = unpackItemSim(p), sig = (x: typeof t) => x.nb.map((r) => [...r.j].map((j, k) => `${j}:${r.s[k].toFixed(4)}`).sort().join(',')).join('|');
  if (sig(back) !== sig(t)) throw new Error(`N=${n}: распаковка не совпала с таблицей`);
  return { pairs, text: `// Сгенерировано tools/build-item-sim.mts (${day}): похожие фильмы — сжатый косинус z-оценок зрителей по общим людям
// (людей ${people.size}, фильмов ${sums.m}, у пары не меньше ${ITEM_SIM.minCommon} общих, сжатие n/(n+${SHRINK}), ближайших ${n}, пар ${pairs}).
// Ни имён, ни оценок людей — только пары фильмов и уровень сходства. Формат — packItemSim (src/lib/model/itemSim.ts).
// Подбор берёт её опытом \`itemSim\`. Не править руками — перегенерировать.
export const itemSim = ${JSON.stringify(p)};
` };
};
for (const n of SIZES) { const s = source(n); console.log(`N=${n}: пар ${s.pairs}, ${(Buffer.byteLength(s.text) / 1e6).toFixed(2)} МБ`); }
const out = source(N);
writeFileSync('src/mocks/itemSim.ts', out.text);
console.log(`людей ${people.size}, фильмов ${sums.m}, N=${N}: пар ${out.pairs}, ${(Buffer.byteLength(out.text) / 1e6).toFixed(2)} МБ → src/mocks/itemSim.ts`);
