// Проверка замеров на утечку (23.10): не подсказывает ли что-то человеку его же спрятанное. Без vite, по seeds/ и выгрузке:
//   1) двойники — разные «люди» (identityOf) с почти одинаковыми оценками: тогда второй — «другой» для consensus, popular,
//      itemSim, EASE и соседей, и подсказывает первому его спрятанное. Признак — большая доля общих фильмов и одинаковые z;
//   2) спрятанное под другим id — одна и та же картина в истории дважды (разные workId, общие ключи): одна запись спрятана,
//      другая видна приложению;
//   3) столбцы выгрузки consensus и popular у спрятанного — без человека, а не с ним. Точного равенства нет: «другие» —
//      все seeds/ на сегодня, а выгрузка — на день её сборки. Поэтому признак утечки — связь: если человек в consensus был,
//      сдвиг (столбец − пересчёт без него) растёт с его собственной z этого фильма; без утечки связи нет. У popular утечка —
//      столбец больше сегодняшнего числа других (людей с тех пор только прибавилось).
//   npx tsx tools/leak-check.mts [--dump .cache/eval/dump-frozen] [--min 20]
// Итог — в консоль (без имён, кроме найденных двойников: их надо свести в .cache/eval/seed-dupes.json).
import { readdirSync, readFileSync } from 'node:fs';
import { consensusFrom, consensusKeys } from '../src/lib/model/consensus.ts';
import { peopleZ } from './consensus-data.mts';
import { identityOf } from './seed-identity.mts';

const argv = process.argv.slice(2);
const opt = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const DUMP = opt('--dump') ?? '.cache/eval/dump-frozen';
const MIN = Number(opt('--min') ?? 20);

interface Rated { workId: string; raw?: number; work?: { type?: string; externalIds?: { tmdb?: number; imdb?: string } } }
// ключи записи — как keysOf в tools/consensus-data.mts
function keysOf(r: Rated): string[] {
  const type = r.work?.type ?? (/^l-tmdbtv|^tmdbtv:/.test(r.workId) ? 'series' : 'film');
  const ids = { ...r.work?.externalIds };
  const m = /^(?:l-)?tmdb(tv)?:?(\d+)$/.exec(r.workId);
  if (ids.tmdb == null && m) ids.tmdb = Number(m[2]);
  const im = /^imdb:(tt\d+)$/.exec(r.workId);
  if (!ids.imdb && im) ids.imdb = im[1];
  return consensusKeys(type, ids);
}

function rng(seed: string) {
  let h = 2166136261; for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 2 ** 32; };
}

// ─── 1. двойники ───────────────────────────────────────────────────────────────
const people = peopleZ(MIN);
const whos = [...people.keys()];
console.log(`людей (после свода двойников по seed-dupes.json) ${whos.length}`);
const films = new Map(whos.map((w) => [w, people.get(w)!]));
const twins: string[] = [];
for (let i = 0; i < whos.length; i++) for (let j = i + 1; j < whos.length; j++) {
  const A = films.get(whos[i])!, B = films.get(whos[j])!;
  const [S, L] = A.size < B.size ? [A, B] : [B, A];
  let common = 0, same = 0, sa = 0, sb = 0, sab = 0, saa = 0, sbb = 0;
  for (const [k, z] of S) {
    const y = L.get(k); if (y == null) continue;
    common++; if (Math.abs(z - y) < 0.05) same++;
    sa += z; sb += y; sab += z * y; saa += z * z; sbb += y * y;
  }
  if (common < 30) continue;
  const cover = common / S.size;
  const corr = (sab - (sa * sb) / common) / Math.sqrt(Math.max(1e-9, (saa - (sa * sa) / common) * (sbb - (sb * sb) / common)));
  // близкие разные люди на одинаковом составе дают corr ~0.6–0.8 и same ≪ 50%; двойник — оба высоко
  if ((cover >= 0.5 && corr >= 0.9) || same / common >= 0.6)
    twins.push(`${whos[i]} (${A.size}) ~ ${whos[j]} (${B.size}): общих ${common} (${(cover * 100).toFixed(0)}% меньшей), corr ${corr.toFixed(2)}, одинаковых z ${(same / common * 100).toFixed(0)}%`);
}
console.log(`1) двойники: ${twins.length}`); twins.forEach((t) => console.log(`   ${t}`));

// ─── 2–3. по выгрузке ─────────────────────────────────────────────────────────
const withAll = consensusFrom(people);
const raters = new Map<string, Set<string>>();
for (const [w, zs] of people) for (const k of zs.keys()) { const s = raters.get(k); if (s) s.add(w); else raters.set(k, new Set([w])); }
let unmatched = 0, files = 0, dupHidden = 0, dupPeople = 0, hiddenTotal = 0;
const dNo: number[] = [], dAll: number[] = [], own: number[] = [];
let popLabeled = 0, popAbove = 0, popEq = 0;
for (const f of readdirSync(DUMP).filter((f) => f.endsWith('.json')).sort()) {
  const d = JSON.parse(readFileSync(`${DUMP}/${f}`, 'utf8')) as { name: string; who: string; ok: boolean; feats: string[]; rows: (string | number | null)[][];
    hiddenIds?: string[]; hiddenTotal: number; ratingsTotal?: number; holdout: { mode: string }; params: { share: number; seed: number } };
  if (!d.ok || !d.rows.length) continue;
  // что спрятано: список из файла, иначе тот же «случай», что в taste-dump (как в tools/dump-add-ease.mts: история могла вырасти —
  // пробуем первые и последние ratingsTotal; годится срез, где число спрятанного сошлось)
  const all = ((JSON.parse(readFileSync(`seeds/${d.name}.json`, 'utf8')) as { ratings?: Rated[] }).ratings ?? []).filter((r) => r.raw != null);
  const N = d.ratingsTotal ?? all.length;
  let rated: Rated[] | undefined, hidden: Set<string> | undefined;
  for (const cut of all.length > N ? [all.slice(0, N), all.slice(all.length - N)] : [all]) {
    const listed = d.hiddenIds && new Set(d.hiddenIds);
    if (!listed && d.holdout.mode !== 'random') break;
    const rand = rng(d.params.seed === 1 ? d.name : `${d.name}#${d.params.seed}`);
    const h = new Set(cut.filter((r) => (listed ? listed.has(r.workId) : rand() < d.params.share)).map((r) => r.workId));
    if (h.size === d.hiddenTotal) { rated = cut; hidden = h; break; }
  }
  if (!rated || !hidden) { unmatched++; continue; }
  files++;
  hiddenTotal += hidden.size;
  const visKeys = new Set(rated.filter((r) => !hidden!.has(r.workId)).flatMap(keysOf));
  const dup = rated.filter((r) => hidden!.has(r.workId) && keysOf(r).some((k) => visKeys.has(k))).length;
  dupHidden += dup; if (dup) dupPeople++;
  if (identityOf(d.name) !== d.who) console.log(`   ${d.name}: who в выгрузке ${d.who}, сейчас ${identityOf(d.name)} — выгрузка до свода двойников`);
  const without = consensusFrom(people, d.who);
  const ci = d.feats.indexOf('consensus') + 2, pi = d.feats.indexOf('popular') + 2;
  const mine = people.get(d.who);
  for (const r of d.rows) {
    if (r[1] == null) continue;
    const k = r[0] as string;
    const v = r[ci] as number | null, no = without.get(k), all = withAll.get(k), z = mine?.get(k);
    if (v != null && no != null && all != null && z != null) { dNo.push(v - no); dAll.push(v - all); own.push(z); }
    const s = raters.get(k), now = s ? s.size - (s.has(d.who) ? 1 : 0) : 0, p = r[pi] as number;
    popLabeled++; if (p > now) popAbove++; if (p === now) popEq++;
  }
}
console.log(`   выгрузок сверено ${files}, спрятанное не восстановилось у ${unmatched}`);
console.log(`2) спрятанное под другим id: ${dupHidden} из ${hiddenTotal} спрятанных, у ${dupPeople} из ${files} людей`);
const corr = (x: number[], y: number[]) => { const n = x.length, mx = x.reduce((a, b) => a + b, 0) / n, my = y.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0; for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2; }
  return sxy / Math.sqrt(sxx * syy); };
const mAbs = (x: number[]) => x.reduce((a, b) => a + Math.abs(b), 0) / x.length;
console.log(`3) consensus у меченых (есть в обоих пересчётах): ${own.length}; связь сдвига с его z: без него ${corr(dNo, own).toFixed(3)}, ` +
  `с ним ${corr(dAll, own).toFixed(3)} (утечка — первая заметно > 0); средний |сдвиг|: без него ${mAbs(dNo).toFixed(3)}, с ним ${mAbs(dAll).toFixed(3)}`);
console.log(`   popular у меченых: ${popLabeled}; больше сегодняшнего числа других ${popAbove}, равно ${popEq}`);
