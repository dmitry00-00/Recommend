// Столбцы easeBin и easeLike в готовые выгрузки частей счёта (23.10), по образцу tools/dump-add-itemsim.mts: EASE
// (src/lib/model/ease.ts) — «что человек посмотрит» (матрица «оценил») и «что понравится» (матрица «оценил выше своей
// середины» или z-взвешенная, --like-kind). Модель — без самого человека (его строки в X нет: по Вудбери это пересчёт
// K⁻¹ на остальных, миллисекунды), вход — только НЕспрятанные оценки истории; что спрятано — ровно как в taste-dump (тот же
// «случай» по имени, доля, seed) и сверяется с файлом (hiddenTotal и метки строк). Не сошлось — файл не трогаем.
// Столбцы дописываются в конец feats (и строк); уже есть — переписываются на месте. Запись — через временный файл.
//   npx tsx tools/dump-add-ease.mts [--dirs .cache/eval/dump-frozen,.cache/eval/dump-frozen-full] [--age 120] [--fresh]
//        [--lambda-bin 200] [--lambda-like 200] [--like-kind like|zw] [--min-raters 3] [--limit N — первые N файлов]
//   --sweep 10,50,200,500 [--kinds bin,like,zw] — без записи: AUC любимое/нелюбимое и hit@10/50/150 каждого варианта
//        (меры — как в tools/taste-tune.mts) по обеим папкам, рядом — «что смотрят все», соседи, itemSim из тех же файлов,
//        и связь easeBin с popular (Спирмен по пулу человека, среднее). Итог — в .cache/eval/ease-sweep-<дата>.md.
import { readdirSync, readFileSync, renameSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { EASE, easeData, easeFit, easeInput, easeScores, type EaseData, type EaseFilm, type EaseKind, type EaseModel } from '../src/lib/model/ease.ts';
import { peopleFilms, storiesRated } from './item-sim-data.mts';

const argv = process.argv.slice(2);
const opt = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const DIRS = (opt('--dirs') ?? '.cache/eval/dump-frozen,.cache/eval/dump-frozen-full').split(',');
const AGE = Number(opt('--age') ?? 120) * 1000;
const FRESH = argv.includes('--fresh');
const SWEEP = opt('--sweep')?.split(',').map(Number);
const KINDS = (opt('--kinds') ?? 'bin,like,zw').split(',') as EaseKind[];
const LAMBDA_BIN = Number(opt('--lambda-bin') ?? EASE.lambda);
const LAMBDA_LIKE = Number(opt('--lambda-like') ?? EASE.lambda);
const LIKE_KIND = (opt('--like-kind') ?? 'like') as EaseKind;
const MIN_RATERS = Number(opt('--min-raters') ?? EASE.minRaters);
const KS = [10, 50, 150];
const mb = () => `${Math.round(process.memoryUsage().rss / 1e6)} МБ`;
const r8 = (x: number | null) => (x == null ? null : Math.round(x * 1e8) / 1e8);

type Row = (string | number | null)[];
interface DumpFile {
  name: string; who: string; ok: boolean; holdout: { mode: string; share: number; seed: number };
  ratingsTotal?: number; hiddenTotal: number; params: { min: number; share: number; seed: number; mode: string };
  feats: string[]; rows: Row[]; sum?: { fameMode?: string }; hiddenIds?: string[]; easeFill?: unknown; [k: string]: unknown;
}

// ─── как в taste-dump / dump-add-itemsim ───────────────────────────────────────
function rng(seed: string) {
  let h = 2166136261; for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 2 ** 32; };
}
const quantile = (xs: number[], q: number) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
function write(file: string, d: DumpFile): void {
  const { rows, ...head } = d;
  const json = `${JSON.stringify(head).slice(0, -1)},"rows":[\n${rows.map((r) => JSON.stringify(r)).join(',\n')}\n]}\n`;
  writeFileSync(`${file}.ease.tmp`, json);
  renameSync(`${file}.ease.tmp`, file);
}

// ─── данные: истории один раз на процесс ───────────────────────────────────────
const t0 = Date.now();
let base: { min: number; stories: ReturnType<typeof storiesRated>; data: Map<EaseKind, EaseData>; alias: Map<string, string[]> } | undefined;
function load(min: number) {
  if (base?.min === min) return base;
  const stories = storiesRated(min);
  const people = peopleFilms(min, stories);
  const data = new Map<EaseKind, EaseData>();
  for (const k of new Set([...(SWEEP ? KINDS : []), 'bin', LIKE_KIND] as EaseKind[])) data.set(k, easeData(people, k));
  const alias = new Map<string, Set<string>>();
  for (const rs of stories.values()) for (const r of rs) if (r.keys.length > 1) for (const k of r.keys) {
    if (!alias.has(k)) alias.set(k, new Set());
    for (const o of r.keys) if (o !== k) alias.get(k)!.add(o);
  }
  base = { min, stories, data, alias: new Map([...alias].map(([k, s]) => [k, [...s]])) };
  const b = data.get('bin')!;
  console.error(`EASE (min ${min}): людей ${b.who.length}, фильмов ${b.keys.length}, ненулевых X ${b.rows.reduce((a, r) => a + r.i.length, 0)} · ${((Date.now() - t0) / 1000).toFixed(1)} с, ${mb()}`);
  return base;
}

/** спрятанное и сверка с файлом (как dump-add-itemsim); ошибка — строка «почему» */
function prepare(d: DumpFile): { films: EaseFilm[] } | string {
  if (!d.rows.length) return 'skip:пустой (ok: false)';
  // список спрятанного в файле (taste-dump с 23.10) — берём его, «случай» не повторяем: так годится и recent
  if (!d.hiddenIds && d.holdout.mode !== 'random') return `bad:спрятано по «${d.holdout.mode}» — повторить не умею`;
  const { stories, data } = load(d.params.min);
  const all = stories.get(d.name);
  if (!all) return 'bad:истории нет в seeds (или меньше min оценок)';
  if (!data.get('bin')!.who.includes(d.who)) return `bad:человека ${d.who} нет среди строк X`;
  // история выросла после выгрузки (23.10: Letterboxd по ночам кладёт новое в начало, дозаполнение Кинопоиска —
  // в конец): пробуем первые и последние ratingsTotal — что видела выгрузка; годится срез, который прошёл сверку
  const N = d.ratingsTotal ?? all.length;
  const tries = all.length > N ? [all.slice(0, N), all.slice(all.length - N)] : [all];
  let why = '';
  const listed = d.hiddenIds && new Set(d.hiddenIds);
  for (const rated of tries) {
    // из файла — сколько спрятанного среди оценок среза (сверка та же)
    const rand = listed ? undefined : rng(d.params.seed === 1 ? d.name : `${d.name}#${d.params.seed}`);
    const hidden = new Set(rated.filter((r) => (listed ? listed.has(r.workId) : rand!() < d.params.share)).map((r) => r.workId));
    if (hidden.size !== d.hiddenTotal) { why ||= `спрятано ${hidden.size}, в файле ${d.hiddenTotal}`; continue; }
    const raws = rated.map((r) => r.raw);
    const hi = quantile(raws, 0.7), lo = quantile(raws, 0.3);
    const hidKey = new Map<string, number>();
    for (const r of rated) if (hidden.has(r.workId)) for (const k of [r.workId, ...r.keys]) if (!hidKey.has(k)) hidKey.set(k, r.raw >= hi && r.raw > lo ? 1 : r.raw <= lo && r.raw < hi ? -1 : 0);
    let labeled = 0, bad = 0;
    for (const r of d.rows) { if (r[1] == null) continue; labeled++; const want = hidKey.get(r[0] as string); if (want == null || want !== r[1]) bad++; }
    if (bad > Math.max(1, 0.02 * labeled)) { why = `метки не сходятся (${bad} из ${labeled})`; continue; }
    // вход — НЕспрятанные оценки истории, z — по ним же (как personZ в itemSim)
    const vis = rated.filter((r) => !hidden.has(r.workId) && r.keys.length);
    const mean = vis.reduce((a, r) => a + r.raw, 0) / (vis.length || 1);
    const sd = Math.sqrt(vis.reduce((a, r) => a + (r.raw - mean) ** 2, 0) / (vis.length || 1)) || 1;
    return { films: vis.map((r) => ({ keys: r.keys, z: (r.raw - mean) / sd })) };
  }
  return `bad:${why}`;
}

/** значения столбца по строкам файла (null — фильма нет в X или мало оценивших) */
function column(d: DumpFile, data: EaseData, scores: Float64Array): (number | null)[] {
  const { alias } = load(d.params.min);
  return d.rows.map((r) => {
    const k = r[0] as string;
    for (const x of [k, ...(alias.get(k) ?? [])]) { const i = data.index.get(x); if (i != null) return Number.isNaN(scores[i]) ? null : scores[i]; }
    return null;
  });
}
const models = new Map<string, EaseModel>();
function scoresFor(kind: EaseKind, lambda: number, who: string, films: EaseFilm[]): { data: EaseData; s: Float64Array } {
  const data = load(base!.min).data.get(kind)!;
  const key = `${kind}|${lambda}|${who}`;
  let m = models.get(key);
  if (!m) { if (models.size > 64) models.clear(); m = easeFit(data, lambda, who); models.set(key, m); }
  return { data, s: easeScores(m, easeInput(data, films), MIN_RATERS) };
}

// ─── меры — как tools/taste-tune.mts (measure/summarize) ───────────────────────
function auc(pos: number[], neg: number[]): number | undefined {
  if (!pos.length || !neg.length) return undefined;
  let s = 0; for (const p of pos) for (const n of neg) s += p > n ? 1 : p === n ? 0.5 : 0;
  return s / (pos.length * neg.length);
}
interface Acc { s: number; w: number; per: number[]; hit: number[]; liked: number; spear: number[] }
const accs = new Map<string, Acc>();
function account(dir: string, name: string, d: DumpFile, score: Float64Array): void {
  const key = `${dir}\t${name}`;
  const a = accs.get(key) ?? { s: 0, w: 0, per: [], hit: KS.map(() => 0), liked: 0, spear: [] };
  accs.set(key, a);
  const fi = d.feats.indexOf('fame');
  if (d.sum?.fameMode === 'strong' && fi >= 0) d.rows.forEach((r, i) => { if (r[2 + fi] === 3) score[i] = -1e9; });
  const order = Array.from({ length: score.length }, (_, i) => i).sort((x, y) => score[y] - score[x] || x - y);
  const rank = new Int32Array(score.length); order.forEach((idx, r) => { rank[idx] = r; });
  const byKey = new Map<string, number[]>();
  d.rows.forEach((r, i) => { const g = byKey.get(r[0] as string); if (g) g.push(i); else byKey.set(r[0] as string, [i]); });
  const liked: number[] = [], disliked: number[] = [];
  d.rows.forEach((r, i) => { if (r[1] === 1) liked.push(i); else if (r[1] === -1) disliked.push(i); });
  const best = (i: number) => Math.min(...byKey.get(d.rows[i][0] as string)!.map((x) => rank[x]));
  KS.forEach((k, n) => { a.hit[n] += liked.filter((i) => best(i) < k).length; });
  a.liked += liked.length;
  const v = auc(liked.map((i) => score[i]), disliked.map((i) => score[i]));
  if (v != null) { a.s += v * liked.length * disliked.length; a.w += liked.length * disliked.length; }
  a.per.push(v ?? NaN);
}
/** Спирмен двух столбцов по пулу (нет значения — 0) */
function spearman(x: Float64Array, y: Float64Array): number {
  const rk = (v: Float64Array) => { const o = Array.from(v.keys()).sort((a, b) => v[a] - v[b]); const r = new Float64Array(v.length);
    for (let i = 0; i < o.length;) { let j = i; while (j + 1 < o.length && v[o[j + 1]] === v[o[i]]) j++; for (let k = i; k <= j; k++) r[o[k]] = (i + j) / 2; i = j + 1; } return r; };
  const a = rk(x), b = rk(y), n = x.length, m = (n - 1) / 2;
  let sab = 0, saa = 0, sbb = 0; for (let i = 0; i < n; i++) { sab += (a[i] - m) * (b[i] - m); saa += (a[i] - m) ** 2; sbb += (b[i] - m) ** 2; }
  return sab / Math.sqrt(saa * sbb || 1);
}
const colOf = (d: DumpFile, f: string) => { const j = d.feats.indexOf(f); return Float64Array.from(d.rows, (r) => { const v = j >= 0 ? r[2 + j] : null; return v == null ? NaN : Number(v); }); };
const z0 = (c: Float64Array) => Float64Array.from(c, (v) => (Number.isNaN(v) ? 0 : v));

// ─── проход ────────────────────────────────────────────────────────────────────
const names = readdirSync(DIRS[0]).filter((f) => f.endsWith('.json')).sort().slice(0, Number(opt('--limit') ?? Infinity));
let done = 0;
for (const f of names) {
  const t1 = Date.now();
  for (const dir of DIRS) {
    const file = `${dir}/${f}`;
    if (!existsSync(file)) continue;
    const mtime = statSync(file).mtimeMs;
    if (!SWEEP && Date.now() - mtime < AGE) { console.error(`${file}: моложе ${AGE / 1000} с — мимо`); continue; }
    const d = JSON.parse(readFileSync(file, 'utf8')) as DumpFile;
    if (!SWEEP && d.easeFill && !FRESH) continue;
    const prep = prepare(d);
    if (typeof prep === 'string' && (SWEEP || prep.startsWith('skip'))) { if (!prep.startsWith('skip')) console.error(`${file}: мимо — ${prep.slice(4)}`); continue; }
    // спрятанное не повторить — столбцы пустые (null): тюнеру нужны одни и те же столбцы во всех файлах
    if (SWEEP && typeof prep !== 'string') {
      const pop = colOf(d, 'popular'), nb = colOf(d, 'neighbors'), sim = colOf(d, 'itemSim');
      // как builtins в taste-tune: «что смотрят все» — popular + i·1e-9, соседи и itemSim — ?? 0 (+ popular·1e-6 у соседей)
      account(dir, '«что смотрят все»', d, Float64Array.from(pop, (v, i) => (Number.isNaN(v) ? 0 : v) + i * 1e-9));
      account(dir, 'соседи по вкусу', d, Float64Array.from(nb, (v, i) => (Number.isNaN(v) ? 0 : v) + ((Number.isNaN(pop[i]) ? 0 : pop[i]) + i * 1e-9) * 1e-6));
      account(dir, 'itemSim', d, z0(sim));
      for (const kind of KINDS) for (const lambda of SWEEP) {
        const { data, s } = scoresFor(kind, lambda, d.who, prep.films);
        const c = Float64Array.from(column(d, data, s), (v) => v ?? NaN);
        const name = `${kind} λ=${lambda}`;
        account(dir, name, d, z0(c));
        accs.get(`${dir}\t${name}`)!.spear.push(spearman(z0(c), z0(pop)));
      }
      continue;
    }
    let cb: (number | null)[], cl: (number | null)[];
    if (typeof prep === 'string') { console.error(`${file}: столбцы пустые — ${prep.slice(4)}`); cb = cl = d.rows.map(() => null); } else {
      const bin = scoresFor('bin', LAMBDA_BIN, d.who, prep.films), like = scoresFor(LIKE_KIND, LAMBDA_LIKE, d.who, prep.films);
      cb = column(d, bin.data, bin.s); cl = column(d, like.data, like.s);
    }
    for (const [feat, vals] of [['easeBin', cb], ['easeLike', cl]] as const) {
      let j = d.feats.indexOf(feat);
      if (j < 0) { j = d.feats.length; d.feats.push(feat); }
      d.rows.forEach((r, i) => { while (r.length < 2 + d.feats.length) r.push(null); r[2 + j] = r8(vals[i]); });
    }
    if (statSync(file).mtimeMs !== mtime) { console.error(`${file}: переписан, пока считали — мимо, запустить ещё раз`); continue; }
    d.easeFill = { at: new Date().toISOString(), by: 'tools/dump-add-ease.mts', bin: { kind: 'bin', lambda: LAMBDA_BIN }, like: { kind: LIKE_KIND, lambda: LAMBDA_LIKE },
      minRaters: MIN_RATERS, ...(typeof prep === 'string' ? { empty: prep.slice(4) } : {}), filledBin: cb.filter((v) => v != null).length, filledLike: cl.filter((v) => v != null).length };
    write(file, d);
    done++;
  }
  if (!SWEEP) console.error(`${f}: ${((Date.now() - t1) / 1000).toFixed(1)} с, ${mb()}`);
}

if (SWEEP) {
  const fmt = (x: number | undefined) => (x == null || Number.isNaN(x) ? '—' : x.toFixed(3));
  const pc = (x: number) => `${(x * 100).toFixed(1)}%`;
  const lines = [`# EASE: перебор λ и вида матрицы — ${new Date().toISOString().slice(0, 10)}`, '',
    `Выгрузки ${DIRS.join(', ')}; модель без самого человека, вход — его НЕспрятанные оценки; minRaters ${MIN_RATERS}; меры — как tools/taste-tune.mts (нет значения → 0).`, ''];
  for (const dir of DIRS) {
    lines.push(`## ${dir}`, '', '| вариант | людей | AUC по всем парам | AUC среднее по людям | hit@10 | hit@50 | hit@150 | Спирмен с popular |', '|---|---|---|---|---|---|---|---|');
    for (const [key, a] of accs) {
      const [dd, name] = key.split('\t'); if (dd !== dir) continue;
      const per = a.per.filter((x) => !Number.isNaN(x));
      lines.push(`| ${name} | ${a.per.length} | ${fmt(a.s / a.w)} | ${fmt(per.reduce((x, y) => x + y, 0) / per.length)} | ${a.hit.map((h) => pc(h / a.liked)).join(' | ')} | ${a.spear.length ? fmt(a.spear.reduce((x, y) => x + y, 0) / a.spear.length) : ''} |`);
    }
    lines.push('');
  }
  const out = `.cache/eval/ease-sweep-${new Date().toISOString().slice(0, 10)}.md`;
  writeFileSync(out, lines.join('\n'));
  console.log(lines.join('\n'));
  console.error(`→ ${out}`);
} else console.error(`дописано файлов ${done}`);
console.error(`всего ${((Date.now() - t0) / 1000).toFixed(0)} с, память ${mb()}`);
