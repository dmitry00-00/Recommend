// Одни и те же люди под разными историями (22.10): seeds/*.json собраны из Кинопоиска (kp_<профиль>, где профиль — номер
// или ник, и это может быть один человек), Letterboxd (последние ~50), Telegram, присланных списков. По имени видно не всё,
// поэтому сравниваем истории попарно по содержанию:
//   состав — общие фильмы (ключ: TMDb, иначе IMDb, иначе id записи). Два киномана и так делят известное, поэтому общее
//     сравнивается с ожидаемым у чужих людей: фильм k попадает в историю X с вероятностью min(1, |X|·(d+½)/T), где d —
//     в скольких ДРУГИХ историях он есть, T — их общий объём. lift = общее / ожидаемое; «сверх случая» =
//     (общее − ожидаемое) / (размер меньшей − ожидаемое): 0 — как у чужих, 1 — меньшая целиком внутри большей;
//   оценки — на общих оценённых: доля с разницей ≤ 1 по шкале 1–10, она же за вычетом случайного совпадения (у кого
//     все оценки 6–7, тот «совпадает» со всеми), доля точных совпадений и Спирмен.
// Пара — один человек по содержанию, если состав далеко за пределами чужих пар, а оценки (когда их есть с чем сравнить)
// не спорят; либо если оценки совпадают почти один в один на многих фильмах. Пороги — по распределению всех пар (в .md).
// К этому — подсказка по имени без приставки источника. Пары сливаются в группы (связность).
//   npx tsx tools/seed-dupes.mts
//   npx tsx tools/seed-dupes.mts --dry   — ничего не пишет, только группы и спорные в stdout (сверить правку, 24.10)
// Итог — .cache/eval/seed-dupes.json (группы — его читает tools/seed-identity.mts) и .md (вне git: там чужие истории).
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { stripName, type DupeGroup } from './seed-identity.mts';

// ─── пороги (обоснование — в .md рядом с распределением) ──────────────────────
/** состав: «сверх случая» и во сколько раз общего больше ожидаемого; не меньше стольких общих фильмов. Почти полное
 *  «сверх случая» хватает и без кратности: Letterboxd-50 одного человека внутри его же Кинопоиска на пять тысяч — это
 *  ×1,3 к ожидаемому (там и так почти всё известное), но сверх случая ≈ 1 */
const OVERLAP = { excess: 0.6, lift: 3, shared: 10, alone: 0.85 };
/** или меньшая история почти целиком в большей — для двух больших, где модель ожидания завышает общее */
const CONTAINED = { share: 0.95, shared: 30 };
/** оценки есть с чем сравнить — с этого числа общих оценённых; тогда они не должны спорить */
const RATED_MIN = 8;
const RATINGS_OK = { kappa: 0.6, rho: 0.6 };
/** оценки почти один в один на многих фильмах — один человек, даже если состав ничего не говорит */
const RATINGS_SAME = { rated: 30, exact: 0.75, kappa: 0.8 };

interface Entry { workId: string; raw?: number; work?: { type?: string; externalIds?: { tmdb?: number; imdb?: string } } }
/** фильм — по TMDb (из id записи или внешних ключей; сериалы отдельно: у TMDb свои номера), иначе IMDb, иначе id записи */
const canon = (e: Entry) => {
  const m = /tmdb(tv)?(\d+)/.exec(e.workId);
  if (m) return `${m[1] ? 'tmdbtv' : 'tmdb'}:${m[2]}`;
  const x = e.work?.externalIds;
  if (x?.tmdb != null) return `${e.work?.type === 'series' ? 'tmdbtv' : 'tmdb'}:${x.tmdb}`;
  return x?.imdb ? `imdb:${x.imdb}` : e.workId;
};

// ─── истории ───────────────────────────────────────────────────────────────────
interface Hist { name: string; keys: Set<string>; raw: Map<string, number> }
const hists: Hist[] = [];
for (const f of readdirSync('seeds').filter((f) => f.endsWith('.json')).sort()) {
  try {
    const s = JSON.parse(readFileSync(`seeds/${f}`, 'utf8')) as { watched?: Entry[]; ratings?: Entry[] };
    if (!Array.isArray(s.watched)) continue;
    const keys = new Set([...s.watched, ...(s.ratings ?? [])].map(canon));
    const raw = new Map((s.ratings ?? []).filter((r) => r.raw != null).map((r) => [canon(r), r.raw!]));
    if (keys.size) hists.push({ name: f.replace(/\.json$/, ''), keys, raw });
  } catch { /* не история */ }
}
const df = new Map<string, number>();
for (const h of hists) for (const k of h.keys) df.set(k, (df.get(k) ?? 0) + 1);
const total = hists.reduce((s, h) => s + h.keys.size, 0);
console.error(`историй ${hists.length}, фильмов ${df.size}, пар ${(hists.length * (hists.length - 1)) / 2}`);

// ─── пары ──────────────────────────────────────────────────────────────────────
const ranks = (v: number[]) => {
  const o = v.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]);
  const r = new Array<number>(v.length);
  for (let i = 0; i < o.length;) { let j = i; while (j < o.length && o[j][0] === o[i][0]) j++; for (let t = i; t < j; t++) r[o[t][1]] = (i + j - 1) / 2; i = j; }
  return r;
};
const pearson = (x: number[], y: number[]) => {
  const n = x.length, mx = x.reduce((a, b) => a + b, 0) / n, my = y.reduce((a, b) => a + b, 0) / n;
  let s = 0, a = 0, b = 0;
  for (let i = 0; i < n; i++) { s += (x[i] - mx) * (y[i] - my); a += (x[i] - mx) ** 2; b += (y[i] - my) ** 2; }
  return a && b ? s / Math.sqrt(a * b) : undefined;
};
const r2 = (x?: number) => (x == null ? undefined : Math.round(x * 100) / 100);

interface Pair {
  a: string; b: string; sizes: [number, number]; shared: number; contained: number; expected: number; lift: number; excess: number;
  rated: number; within1?: number; kappa?: number; exact?: number; rho?: number;
  byName: boolean; byContent?: 'состав' | 'оценки'; ratingsDisagree?: boolean; viaHub?: boolean;
}
const pairs: Pair[] = [];
for (let i = 0; i < hists.length; i++) for (let j = i + 1; j < hists.length; j++) {
  const A = hists[i], B = hists[j];
  const small = A.keys.size <= B.keys.size ? A : B, big = small === A ? B : A;
  let shared = 0;
  for (const k of small.keys) if (big.keys.has(k)) shared++;
  // ожидаемое общее у чужих людей таких размеров: известность фильма — по остальным историям
  const rest = total - A.keys.size - B.keys.size;
  let expected = 0;
  for (const [k, c] of df) {
    const p = (c - (A.keys.has(k) ? 1 : 0) - (B.keys.has(k) ? 1 : 0) + 0.5) / rest;
    expected += Math.min(1, A.keys.size * p) * Math.min(1, B.keys.size * p);
  }
  const xs: number[] = [], ys: number[] = [];
  for (const [k, x] of A.raw) { const y = B.raw.get(k); if (y != null) { xs.push(x); ys.push(y); } }
  const pair: Pair = {
    a: A.name, b: B.name, sizes: [A.keys.size, B.keys.size], shared, contained: shared / small.keys.size,
    expected, lift: shared / Math.max(expected, 0.5), excess: (shared - expected) / Math.max(1e-9, small.keys.size - expected),
    rated: xs.length, byName: stripName(A.name) === stripName(B.name),
  };
  if (xs.length) {
    const near = xs.filter((x, t) => Math.abs(x - ys[t]) <= 1).length / xs.length;
    // случайное совпадение: те же оценки обоих, перемешанные между фильмами
    let chance = 0; for (const x of xs) for (const y of ys) if (Math.abs(x - y) <= 1) chance++;
    chance /= xs.length ** 2;
    pair.within1 = near; pair.kappa = chance >= 1 ? 0 : (near - chance) / (1 - chance);
    pair.exact = xs.filter((x, t) => x === ys[t]).length / xs.length;
    pair.rho = xs.length >= 3 ? pearson(ranks(xs), ranks(ys)) : undefined;
  }
  const overlap = (shared >= OVERLAP.shared && (pair.excess >= OVERLAP.alone || (pair.excess >= OVERLAP.excess && pair.lift >= OVERLAP.lift)))
    || (pair.contained >= CONTAINED.share && shared >= CONTAINED.shared);
  const ratingsOk = pair.rated < RATED_MIN || ((pair.kappa ?? 0) >= RATINGS_OK.kappa && (pair.rho ?? 0) >= RATINGS_OK.rho);
  const ratingsSame = pair.rated >= RATINGS_SAME.rated && pair.exact! >= RATINGS_SAME.exact && pair.kappa! >= RATINGS_SAME.kappa;
  if (overlap && ratingsOk) pair.byContent = 'состав';
  else if (ratingsSame) pair.byContent = 'оценки';
  if (overlap && !ratingsOk) pair.ratingsDisagree = true;
  pairs.push(pair);
}

// ─── распределение (для порогов) ───────────────────────────────────────────────
const QS = [0.5, 0.9, 0.95, 0.99, 1];
const quant = (xs: (number | undefined)[]) => {
  const v = xs.filter((x): x is number => x != null && Number.isFinite(x)).sort((a, b) => a - b);
  return v.length ? QS.map((q) => r2(v[Math.min(v.length - 1, Math.floor(q * v.length))])!) : [];
};
const strangers = pairs.filter((p) => !p.byName && !p.byContent);
const ratedPairs = strangers.filter((p) => p.rated >= RATED_MIN);
const kappaQ = quant(ratedPairs.map((p) => p.kappa)), exactQ = quant(strangers.filter((p) => p.rated >= RATINGS_SAME.rated).map((p) => p.exact));
const calibration = {
  quantiles: QS, pairs: pairs.length, strangers: strangers.length,
  excess: quant(strangers.map((p) => p.excess)), lift: quant(strangers.map((p) => p.lift)), contained: quant(strangers.map((p) => p.contained)),
  [`kappa (общих оценённых ≥ ${RATED_MIN})`]: kappaQ, [`rho (общих оценённых ≥ ${RATED_MIN})`]: quant(ratedPairs.map((p) => p.rho)),
  [`exact (общих оценённых ≥ ${RATINGS_SAME.rated})`]: exactQ,
};

const excess99 = calibration.excess[QS.indexOf(0.99)];

// ─── группы ────────────────────────────────────────────────────────────────────
const parent = new Map(hists.map((h) => [h.name, h.name]));
const root = (x: string): string => (parent.get(x) === x ? x : root(parent.get(x)!));
// узел (23.10): короткая история без оценок из одного известного (60 фильмов «Ван Хельсинг», «Эквилибриум»…) проходит
// «по составу» почти с каждым киноманом, и через неё в одну группу склеились 10 разных людей. Звено по составу без сверки
// оценок — не звено (в .md — среди спорных), если у одного из концов таких звеньев два и больше, а другие их концы не
// связаны между собой сверенным звеном (оценки или имя). Прежде снимали только при HUB = 3: история с двумя такими звеньями
// (к A и к B, чужим) склеивала A и B в одного человека (ревью 23.10, п. 4). Одно звено — принимаем, как раньше
const unchecked = (p: Pair) => p.byContent === 'состав' && p.rated < RATED_MIN && !p.byName;
const checked = new Map(hists.map((h) => [h.name, h.name]));
const rootC = (x: string): string => (checked.get(x) === x ? x : rootC(checked.get(x)!));
for (const p of pairs) if ((p.byName || p.byContent) && !unchecked(p)) checked.set(rootC(p.a), rootC(p.b));
const uncheckedOf = new Map<string, string[]>();
for (const p of pairs.filter(unchecked)) for (const [x, y] of [[p.a, p.b], [p.b, p.a]]) uncheckedOf.set(x, [...(uncheckedOf.get(x) ?? []), y]);
/** все звенья без сверки у x ведут в одного человека по сверенным звеньям (или звено одно) */
const oneBehind = (x: string) => new Set(uncheckedOf.get(x)!.map(rootC)).size === 1;
for (const p of pairs) if (unchecked(p) && !(oneBehind(p.a) && oneBehind(p.b))) { p.byContent = undefined; p.viaHub = true; }
const linked = pairs.filter((p) => p.byName || p.byContent);
for (const p of linked) parent.set(root(p.a), root(p.b));
const members = new Map<string, string[]>();
for (const h of hists) { const r = root(h.name); if (!members.has(r)) members.set(r, []); members.get(r)!.push(h.name); }
const statOf = (p: Pair) => ({
  a: p.a, b: p.b, by: [...(p.byName ? ['имя'] : []), ...(p.byContent ? [p.byContent] : [])], sizes: p.sizes, shared: p.shared,
  contained: r2(p.contained), expected: r2(p.expected), lift: r2(p.lift), excess: r2(p.excess),
  rated: p.rated, within1: r2(p.within1), kappa: r2(p.kappa), exact: r2(p.exact), rho: r2(p.rho),
});
/** ключ человека: общее имя без приставки; разные — первое не-номер (ник понятнее номера профиля), короче, по алфавиту */
const idOf = (people: string[]) => [...new Set(people.map(stripName))].sort((x, y) => Number(/^\d+$/.test(x)) - Number(/^\d+$/.test(y)) || x.length - y.length || x.localeCompare(y))[0];
const groups = [...members.values()].filter((m) => m.length > 1).map((people) => {
  const inside = pairs.filter((p) => people.includes(p.a) && people.includes(p.b));
  const why = [...new Set(inside.filter((p) => p.byName || p.byContent).flatMap((p) => [
    ...(p.byName ? ['одно имя без приставки источника'] : []),
    ...(p.byName && !p.byContent ? [`${p.a} ~ ${p.b} по составу: сверх случая ${p.excess.toFixed(2)} при 99% чужих пар ≤ ${excess99} — `
      + `${p.excess > excess99 ? 'больше, чем у чужих, но ниже порога' : 'не подтверждает'}`] : []),
    ...(p.byContent === 'состав' ? [`состав: ${p.a} ~ ${p.b} — общих ${p.shared} при ожидаемых ${p.expected.toFixed(1)} (×${p.lift.toFixed(1)}), сверх случая ${p.excess.toFixed(2)}${p.rated >= RATED_MIN ? `, оценки сходятся (κ ${p.kappa!.toFixed(2)}, ρ ${p.rho!.toFixed(2)})` : ''}`] : []),
    ...(p.byContent === 'оценки' ? [`оценки: ${p.a} ~ ${p.b} — ${p.rated} общих оценённых, точно совпало ${(p.exact! * 100).toFixed(0)}%`] : []),
  ]))];
  return { id: idOf(people), people: people.sort(), why, pairs: inside.map(statOf) };
}) satisfies (DupeGroup & { pairs: unknown[] })[];
// ближайшие из несвязанных — чтобы видеть запас до порога; и пары, где состав «за порогом», но оценки против
const near = [...strangers].sort((x, y) => y.excess - x.excess).slice(0, 10).map(statOf);
const disputed = pairs.filter((p) => (p.ratingsDisagree || p.viaHub) && !p.byName).map(statOf);

if (process.argv.includes('--dry')) {
  console.log(JSON.stringify({ groups: groups.map(({ id, people }) => ({ id, people })), disputed: disputed.map(({ a, b, by, rated }) => ({ a, b, by, rated })) }, null, 1));
  process.exit(0);
}
mkdirSync('.cache/eval', { recursive: true });
writeFileSync('.cache/eval/seed-dupes.json', JSON.stringify({
  at: new Date().toISOString(), thresholds: { OVERLAP, CONTAINED, RATED_MIN, RATINGS_OK, RATINGS_SAME }, calibration, groups, disputed, near,
}, null, 1));

// ─── .md ───────────────────────────────────────────────────────────────────────
const f2 = (x?: number) => (x == null ? '—' : x.toFixed(2));
const row = (p: ReturnType<typeof statOf>) => `| ${p.a} ~ ${p.b} | ${p.by.join(', ') || '—'} | ${p.sizes.join(' / ')} | ${p.shared} | ${f2(p.expected)} | ${f2(p.lift)} | ${f2(p.excess)} | ${p.rated} | ${f2(p.within1)} | ${f2(p.kappa)} | ${f2(p.exact)} | ${f2(p.rho)} |`;
const head = ['| пара | связь | размеры | общих | ожидалось | × | сверх случая | общих оценённых | ≤1 | κ | точно | ρ |', '|---|---|---|---|---|---|---|---|---|---|---|---|'];
const day = new Date().toISOString().slice(0, 10);
const md = [
  `# Одни и те же люди в историях — ${day}`, '',
  `Историй ${hists.length}, пар ${pairs.length}. Групп ${groups.length}: ${groups.map((g) => `**${g.id}** (${g.people.join(', ')})`).join('; ') || '—'}.`, '',
  '## Пороги и распределение', '',
  `Квантили ${QS.map((q) => `${q * 100}%`).join(' / ')} по ${strangers.length} несвязанным парам:`, '',
  ...Object.entries(calibration).filter(([, v]) => Array.isArray(v) && v !== QS).map(([k, v]) => `- ${k}: ${(v as number[]).join(' / ')}`), '',
  `Один человек по составу (≥ ${OVERLAP.shared} общих): сверх случая ≥ ${OVERLAP.alone}, или ≥ ${OVERLAP.excess} при ×${OVERLAP.lift} к ожидаемому — или меньшая история `
    + `≥ ${CONTAINED.share * 100}% внутри большей при ≥ ${CONTAINED.shared} общих; при ≥ ${RATED_MIN} общих оценённых ещё и κ ≥ ${RATINGS_OK.kappa}, ρ ≥ ${RATINGS_OK.rho}. `
    + `По оценкам: ≥ ${RATINGS_SAME.rated} общих оценённых, точно совпало ≥ ${RATINGS_SAME.exact * 100}%, κ ≥ ${RATINGS_SAME.kappa}.`,
  `Почему так: «сверх случая» ${OVERLAP.excess} — вдвое выше 99-го процентиля чужих пар (${excess99}), но и его одного мало: Letterboxd `
    + 'отдаёт последние ~50 фильмов, у всех там новинки, а большая история Кинопоиска содержит почти всё известное — ожидание этого не знает '
    + `(у чужих бывает до ${calibration.excess.at(-1)}). Поэтому где есть оценки, они обязаны сходиться: один человек одинаковые фильмы `
    + 'оценивает одинаково. κ — согласие «±1» за вычетом случайного (у кого все оценки 6–7, тот «совпадает» со всеми); на 8–15 общих он '
    + `шумит (у чужих бывает до ${kappaQ.at(-1)}), поэтому сам по себе не доказательство, только запрет. Точных совпадений на ${RATINGS_SAME.rated}+ общих у чужих `
    + `не больше ${exactQ.at(-1)}.`, '',
  '## Группы', '',
  ...groups.flatMap((g) => [`**${g.id}**: ${g.people.join(', ')}`, '', ...g.why.map((w) => `- ${w}`), '', ...head, ...g.pairs.map(row), '']),
  '## Состав за порогом, но оценки против или звено через узел (у конца два и больше звеньев без сверки оценок к разным людям, не слиты)', '', ...(disputed.length ? [...head, ...disputed.map(row)] : ['—']), '',
  '## Ближайшие из несвязанных (по «сверх случая»)', '', ...head, ...near.map(row),
].join('\n');
writeFileSync('.cache/eval/seed-dupes.md', `${md}\n`);
console.log(md.split('\n').slice(0, 3).join('\n'));
