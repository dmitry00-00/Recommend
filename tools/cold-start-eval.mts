// Холодный старт (23.10): как подбирать новичку с 5–20 оценками. Замер ленты (tools/taste-eval.mts) идёт на длинных
// историях, а живые люди приходят с 0–20 оценками. Здесь — офлайн-симуляция без vite и без приложения, только seeds/*.json:
// у каждого человека прячется пятая часть (тот же «случай» по имени, что в taste-eval / dump-add-itemsim), а из остального
// «видно» лишь N оценок (5, 10, 20, 40 и вся история) — случайные N или N самых известных (как после колоды оценок новичка:
// она из известного; известность — сколько других людей в seeds оценили фильм). Сигналы, которым приложение не нужно:
// «как оценили другие» (consensus.ts, без человека), «похожие фильмы» (itemSim.ts, таблица без человека), соседи по вкусу
// (neighbors.ts, перебор minCommon), «что смотрят все» (сколько людей оценили) и их смеси: (1−w)·общее + w·личное, где w —
// фиксированный или по правилу w = n/(n+k). Каждый сигнал — стандартизован по кандидатам человека (среднее 0, разброс 1).
// Меры: AUC любимое/нелюбимое (верх/низ 30% всей истории человека — метки не зависят от N) по спрятанному в пуле и hit@50/150
// — доля спрятанного любимого в первых K среди пула «что знают таблицы» (фильмы, которые оценили ≥ 3 других), без всего
// остального, что человек оценил (видимого и невидимого: он это смотрел). Один человек под несколькими историями — одна,
// самая длинная (tools/seed-identity.mts). В замер — только те, у кого неспрятанного ≥ 40: в каждой корзине N одни и те же люди.
//   npx tsx tools/cold-start-eval.mts [--min 20] [--ns 5,10,20,40] [--limit 0] [--detail pop+cons:is+nb2,cons:itemSim]
//   npx tsx tools/cold-start-eval.mts --tables .cache/eval/cold-start-<дата>.json   — только таблицы из готового итога
// Память ≈ 0,6–0,8 ГБ (суммы сходства, как в item-sim-eval), минуты. Итог — в консоль (только числа) и
// .cache/eval/cold-start-<дата>.json и -tables.md (вне git).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { SHRINK as C_SHRINK } from '../src/lib/model/consensus.ts';
import { ITEM_SIM, itemSimSums, itemSimTable, personZ as itemZ } from '../src/lib/model/itemSim.ts';
import { NEIGHBOR, buildPool, mineIn, neighborScores, personZ as nbZ } from '../src/lib/model/neighbors.ts';
import { peopleFilms, storiesRated } from './item-sim-data.mts';
import { identityOf } from './seed-identity.mts';

const argv = process.argv.slice(2);
const opt = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const MIN = Number(opt('--min') ?? 20);
const NS = (opt('--ns') ?? '5,10,20,40').split(',').map(Number);
const LIMIT = Number(opt('--limit') ?? 0);
const HOLDOUT = 0.2;
const MAXN = Math.max(...NS);
const COMMONS = [2, 3, 5, 8];
const KS_RULE = [3, 5, 10, 20, 50, 100];
const WS = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];
const HITK = [50, 150];

// ─── таблицы markdown из итога (в конце прогона и отдельно: --tables <json> [--detail база:личное,…]) ──────────
interface OutRow { cfg: string; method: string; auc: number; aucPerPerson: number; se: number; people: number; hit50: number; hit150: number }
interface OutFile { rows: OutRow[]; coverage: Record<string, number> }
const DETAIL = (opt('--detail') ?? 'pop+cons:is+nb2,pop+cons:itemSim,cons:nb2,cons:is+nb2,cons:itemSim').split(',');
function tablesMd(d: OutFile): string {
  const R = new Map(d.rows.map((r) => [`${r.cfg}|${r.method}`, r]));
  const cfgs = new Set(d.rows.map((r) => r.cfg));
  const order = ['случ·5', 'изв·5', 'случ·10', 'изв·10', 'случ·20', 'изв·20', 'случ·40', 'изв·40', 'вся'].filter((c) => cfgs.has(c));
  const g = (c: string, m: string) => R.get(`${c}|${m}`);
  const f3 = (x?: number) => (x == null ? '—' : x.toFixed(3)), p1 = (x?: number) => (x == null ? '—' : (x * 100).toFixed(1));
  const out: string[] = [];
  const table = (title: string, methods: string[], val: (r?: OutRow) => number | undefined, fmt: (x?: number) => string) => {
    out.push(`### ${title}`, '', `| N | ${methods.join(' | ')} |`, `|---|${methods.map(() => '---').join('|')}|`);
    for (const c of order) {
      const vs = methods.map((m) => val(g(c, m)));
      const best = Math.max(...vs.filter((v): v is number => v != null));
      out.push(`| ${c} | ${vs.map((v) => (v === best ? `**${fmt(v)}**` : fmt(v))).join(' | ')} |`);
    }
    out.push('');
  };
  const singles = ['pop', 'cons', 'pop+cons', 'itemSim', 'nb2', 'nb3', 'nb5', 'nb8', 'is+nb2', 'is+nb3', 'is+nb5', 'is+nb8'];
  table('Отдельные сигналы: AUC по всем парам', singles, (r) => r?.auc, f3);
  table('Отдельные сигналы: AUC среднее по людям', singles.slice(0, 8), (r) => r?.aucPerPerson, f3);
  out.push('Ошибка среднего AUC по людям (cons / itemSim / nb3): ' + order.map((c) => `${c} ${f3(g(c, 'cons')?.se)}/${f3(g(c, 'itemSim')?.se)}/${f3(g(c, 'nb3')?.se)}`).join('; '), '');
  table('Отдельные сигналы: hit@50, %', singles, (r) => r?.hit50, p1);
  table('Отдельные сигналы: hit@150, %', singles, (r) => r?.hit150, p1);
  const covKeys = ['itemSim', 'nb2', 'nb3', 'nb5', 'nb8'];
  out.push('### Есть ли личный сигнал (доля меченого спрятанного, %) и сколько соседей', '', `| N | ${covKeys.join(' | ')} | соседей nb2/3/5/8 (среднее) |`, `|---|${covKeys.map(() => '---').join('|')}|---|`);
  for (const c of order) out.push(`| ${c} | ${covKeys.map((k) => p1(d.coverage[`${c}|${k}`])).join(' | ')} | ${COMMONS.map((m) => (d.coverage[`${c}|nb${m}:соседей`] ?? 0).toFixed(0)).join(' / ')} |`);
  out.push('');
  const mixRow = (c: string, b: string, p: string, w: number) => (w === 0 ? g(c, b) : w === 1 ? g(c, p) : g(c, `${b}→${p} w${w}`));
  const metr: Record<string, (r?: OutRow) => number> = { auc: (r) => r?.auc ?? NaN, hit150: (r) => r?.hit150 ?? NaN, hit50: (r) => r?.hit50 ?? NaN };
  const combos: [string, string][] = [];
  for (const b of ['pop', 'cons', 'pop+cons']) for (const p of ['itemSim', ...COMMONS.flatMap((m) => [`nb${m}`, `is+nb${m}`])]) combos.push([b, p]);
  const score = (b: string, p: string, m: string) => Math.max(...KS_RULE.map((k) => order.reduce((a, c) => a + metr[m](g(c, `${b}→${p} k${k}`)), 0) / order.length));
  for (const m of ['auc', 'hit150']) {
    const best = combos.map(([b, p]) => ({ b, p, s: score(b, p, m) })).sort((x, y) => y.s - x.s).slice(0, 8);
    out.push(`### Пары «общее → личное» по ${m} (среднее по корзинам при лучшем k)`, '', '| общее → личное | среднее |', '|---|---|', ...best.map((x) => `| ${x.b} → ${x.p} | ${m === 'auc' ? f3(x.s) : p1(x.s)} |`), '');
  }
  for (const pair of DETAIL) {
    const [b, p] = pair.split(':');
    for (const m of ['auc', 'hit150', 'hit50']) {
      const fm = m === 'auc' ? f3 : p1;
      out.push(`### ${b} → ${p}: ${m} — фиксированный w и правило w = n/(n+k)`, '', `| N | ${WS.map((w) => `w${w}`).join(' | ')} | лучший w | ${KS_RULE.map((k) => `k${k}`).join(' | ')} |`, `|---|${WS.map(() => '---').join('|')}|---|${KS_RULE.map(() => '---').join('|')}|`);
      const regret = KS_RULE.map(() => 0);
      for (const c of order) {
        const vs = WS.map((w) => metr[m](mixRow(c, b, p, w)));
        const bi = vs.indexOf(Math.max(...vs));
        const ks = KS_RULE.map((k) => metr[m](g(c, `${b}→${p} k${k}`)));
        ks.forEach((v, i) => { regret[i] += vs[bi] - v; });
        out.push(`| ${c} | ${vs.map((v, i) => (i === bi ? `**${fm(v)}**` : fm(v))).join(' | ')} | ${WS[bi]} | ${ks.map(fm).join(' | ')} |`);
      }
      out.push('', `Средняя потеря правила против лучшего фиксированного w в каждой корзине: ${KS_RULE.map((k, i) => `k${k} ${m === 'auc' ? f3(regret[i] / order.length) : `${p1(regret[i] / order.length)} пп`}`).join(', ')}`, '');
    }
  }
  const lb = ['LB', ...KS_RULE.flatMap((k) => [`LB r·k${k}`, `LB r·k${k} cons·(2−r)`]), 'LB+pop'];
  table('Часть обученного счёта (consensus + itemSim из LEARNED_B): AUC по всем парам', lb, (r) => r?.auc, f3);
  table('Часть обученного счёта: hit@150, %', lb, (r) => r?.hit150, p1);
  table('Часть обученного счёта: hit@50, %', lb, (r) => r?.hit50, p1);
  return out.join('\n');
}
if (opt('--tables')) {
  const file = opt('--tables')!;
  writeFileSync(file.replace(/\.json$/, '-tables.md'), tablesMd(JSON.parse(readFileSync(file, 'utf8')) as OutFile));
  console.error(`→ ${file.replace(/\.json$/, '-tables.md')}`);
  process.exit(0);
}
const mb = () => `${Math.round(process.memoryUsage().rss / 1e6)} МБ`;
// веса обученного счёта — из текста recommend.ts (импорт тянул бы операции, регистры и разметку — память и время)
const LB_SRC = readFileSync('src/lib/model/recommend.ts', 'utf8');
const lbNum = (re: RegExp) => { const m = re.exec(LB_SRC); if (!m) throw new Error(`LEARNED_B: нет ${re}`); return Number(m[1]); };
const LEARNED_B = {
  consensus: lbNum(/LEARNED_B = \{[^}]*?\bconsensus: (-?[\d.]+)/), itemSim: lbNum(/LEARNED_B = \{[^}]*?\bitemSim: (-?[\d.]+)/),
  missing: { itemSim: lbNum(/missing: \{[^}]*?\bitemSim: (-?[\d.]+)/) },
};

// ─── как в taste-dump / item-sim-eval ──────────────────────────────────────────
function rng(seed: string) {
  let h = 2166136261; for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 2 ** 32; };
}
const quantile = (xs: number[], q: number) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
function auc(pos: number[], neg: number[]): number | undefined {
  if (!pos.length || !neg.length) return undefined;
  let s = 0; for (const p of pos) for (const n of neg) s += p > n ? 1 : p === n ? 0.5 : 0;
  return s / (pos.length * neg.length);
}

// ─── таблицы: один раз ─────────────────────────────────────────────────────────
const t0 = Date.now();
const stories = storiesRated(MIN);
const people = peopleFilms(MIN, stories);
const sums = itemSimSums(people);
const M = sums.m;
// «что смотрят все» и «как оценили другие» — по фильмам таблицы сходства (те же люди, те же z), без человека — вычитанием
const cnt = new Float64Array(M), zsum = new Float64Array(M);
for (const p of sums.people.values()) for (let x = 0; x < p.i.length; x++) { cnt[p.i[x]]++; zsum[p.i[x]] += p.z[x]; }
// соседи — набор из тех же людей (neighbors.ts), фильм таблицы → фильм набора
const pool = buildPool([...people].map(([id, films]) => ({ id, films })));
const nbFilm = Int32Array.from(sums.keys, (k) => pool.keyFilm.get(k) ?? -1);
console.error(`историй ${stories.size}, людей ${people.size}, фильмов в таблице ${M}, в наборе соседей ${pool.filmKeys.length} · ${((Date.now() - t0) / 1000).toFixed(0)} с, ${mb()}`);

// одна история на человека — самая длинная; неспрятанного ≥ MAXN
type Story = { name: string; rated: { workId: string; raw: number; keys: string[] }[] };
const byWho = new Map<string, Story>();
for (const [name, rated] of stories) {
  const w = identityOf(name), was = byWho.get(w);
  if (!was || rated.length > was.rated.length) byWho.set(w, { name, rated });
}

// сколько оценок видно при обучении LEARNED_B (выгрузка frozen: истории ≥ 20, видно 80%) — медиана, для поправки r(n)
const nTrain = (() => { const v = [...stories.values()].map((r) => Math.round(r.length * (1 - HOLDOUT))).sort((a, b) => a - b); return v[Math.floor(v.length / 2)]; })();
console.error(`видно при обучении (медиана): ${nTrain}`);

// ─── сигналы и смеси ───────────────────────────────────────────────────────────
type Sig = Float64Array;
function std(a: Sig): Sig {
  let m = 0; for (const x of a) m += x; m /= a.length || 1;
  let v = 0; for (const x of a) v += (x - m) ** 2; const sd = Math.sqrt(v / (a.length || 1)) || 1;
  return a.map((x) => (x - m) / sd);
}
const plus = (a: Sig, b: Sig) => std(a.map((x, i) => x + b[i]));
// смесь и счёт с ничьей — в общие буферы (сотни счетов на человека: без них память ходит пилой до 1,5 ГБ)
let mixBuf = new Float64Array(0), scBuf = new Float64Array(0);
const mix = (b: Sig, p: Sig, w: number) => {
  if (mixBuf.length !== b.length) mixBuf = new Float64Array(b.length);
  for (let i = 0; i < b.length; i++) mixBuf[i] = (1 - w) * b[i] + w * p[i];
  return mixBuf;
};

/** мера одного счёта у одного человека */
interface Acc { s: number; w: number; pp: number; pp2: number; np: number; hit: number[]; liked: number }
const acc = new Map<string, Acc>();
function measure(key: string, score: Sig, ctx: Ctx): void {
  if (scBuf.length !== score.length) scBuf = new Float64Array(score.length);
  const sc = scBuf;
  for (let i = 0; i < score.length; i++) sc[i] = score[i] + ctx.tie[i];
  const a = auc(ctx.pos.map((i) => sc[i]), ctx.neg.map((i) => sc[i]));
  let x = acc.get(key);
  if (!x) acc.set(key, (x = { s: 0, w: 0, pp: 0, pp2: 0, np: 0, hit: HITK.map(() => 0), liked: 0 }));
  if (a != null) { const w = ctx.pos.length * ctx.neg.length; x.s += a * w; x.w += w; x.pp += a; x.pp2 += a * a; x.np++; }
  // место любимого: сколько кандидатов выше (кандидаты — ctx.cand)
  if (ctx.target.length) {
    const t = ctx.target.map((i) => sc[i]).sort((p, q) => p - q);
    const above = new Int32Array(t.length + 1);
    for (const i of ctx.cand) {
      const v = sc[i];
      let lo = 0, hi = t.length; while (lo < hi) { const md = (lo + hi) >> 1; if (t[md] < v) lo = md + 1; else hi = md; }
      above[lo]++; // v выше целей t[0..lo-1]
    }
    // целей с местом < K: место t[j] = Σ above[l] при l > j
    let run = 0;
    for (let j = t.length - 1; j >= 0; j--) { run += above[j + 1]; HITK.forEach((k, ki) => { if (run < k) x!.hit[ki]++; }); }
    x.liked += t.length;
  }
}
interface Ctx { pos: number[]; neg: number[]; target: number[]; cand: Int32Array; tie: Sig }

const configs: { mode: 'random' | 'popular' | 'all'; n: number }[] = [
  ...NS.flatMap((n) => [{ mode: 'random' as const, n }, { mode: 'popular' as const, n }]), { mode: 'all', n: 0 },
];
const cfgName = (c: (typeof configs)[number]) => (c.mode === 'all' ? 'вся' : `${c.mode === 'random' ? 'случ' : 'изв'}·${c.n}`);
const coverage = new Map<string, { s: number; t: number }>();
const cov = (k: string, s: number, t: number) => { const x = coverage.get(k) ?? { s: 0, t: 0 }; x.s += s; x.t += t; coverage.set(k, x); };
const nVisible: number[] = [];

let done = 0;
for (const [me, { name, rated }] of byWho) {
  if (LIMIT && done >= LIMIT) break;
  const rand = rng(name);
  const hidden = new Set(rated.filter(() => rand() < HOLDOUT).map((r) => r.workId));
  const visibleAll = rated.filter((r) => !hidden.has(r.workId) && r.keys.length);
  if (visibleAll.length < MAXN) continue;
  const t1 = Date.now();
  const mine = sums.people.get(me);
  const idx = (keys: string[]) => { for (const k of keys) { const i = sums.index.get(k); if (i != null) return i; } return -1; };
  // без человека
  const popO = Float64Array.from(cnt), zO = Float64Array.from(zsum);
  if (mine) for (let x = 0; x < mine.i.length; x++) { popO[mine.i[x]]--; zO[mine.i[x]] -= mine.z[x]; }
  // кандидаты: ≥ 3 других, без всего, что человек оценил не спрятанным
  const seenIdx = new Set(rated.filter((r) => !hidden.has(r.workId)).map((r) => idx(r.keys)).filter((i) => i >= 0));
  const candList: number[] = [];
  for (let i = 0; i < M; i++) if (popO[i] >= 3 && !seenIdx.has(i)) candList.push(i);
  const cand = Int32Array.from(candList);
  const C = cand.length, pos2c = new Map(candList.map((i, c) => [i, c]));
  // метки — по всей истории (не по видимому): верх/низ 30%
  const raws = rated.map((r) => r.raw), hi = quantile(raws, 0.7), lo = quantile(raws, 0.3);
  const pos: number[] = [], neg: number[] = [];
  const lab = new Set<number>();
  for (const r of rated) {
    if (!hidden.has(r.workId)) continue;
    const c = pos2c.get(idx(r.keys));
    if (c == null || lab.has(c)) continue;
    lab.add(c);
    if (r.raw >= hi && r.raw > lo) pos.push(c); else if (r.raw <= lo && r.raw < hi) neg.push(c);
  }
  if (!pos.length || !neg.length) continue;
  nVisible.push(visibleAll.length);
  const cIdx = Int32Array.from({ length: C }, (_, c) => c);
  const ctx: Ctx = { pos, neg, target: pos, cand: cIdx, tie: new Float64Array(C) };
  // общие сигналы (от N не зависят)
  const popRaw = Float64Array.from(cand, (i) => Math.log1p(popO[i]));
  const consRaw = Float64Array.from(cand, (i) => Math.round((zO[i] / (popO[i] + C_SHRINK)) * 100) / 100);
  const sPop = std(popRaw), sCons = std(consRaw), sPC = plus(sPop, sCons);
  ctx.tie = sPop.map((x) => x * 1e-6);
  const simT = itemSimTable(sums, me);
  // порядок видимого: случайный (тот же, что «·10» в item-sim-eval) и по известности (среди других)
  const sr = rng(`${name}#short`);
  const byRand = visibleAll.map((r) => ({ r, x: sr() })).sort((a, b) => a.x - b.x).map((x) => x.r);
  const popOf = (r: { keys: string[] }) => { const i = idx(r.keys); return i >= 0 ? popO[i] : 0; };
  const pr = rng(`${name}#pop`);
  const byPop = visibleAll.map((r) => ({ r, p: popOf(r), x: pr() })).sort((a, b) => b.p - a.p || a.x - b.x).map((x) => x.r);

  for (const cf of configs) {
    const vis = cf.mode === 'all' ? visibleAll : (cf.mode === 'random' ? byRand : byPop).slice(0, cf.n);
    const n = vis.length, tag = cfgName(cf);
    // похожие фильмы: как itemSimScore, по номерам таблицы
    const z = itemZ(vis);
    const mz = new Map<number, number>();
    for (const [k, v] of z) { const i = simT.index.get(k); if (i != null && !mz.has(i)) mz.set(i, v); }
    const isRaw = new Float64Array(C), isHas = new Uint8Array(C);
    for (let c = 0; c < C; c++) {
      const { j, s } = simT.nb[cand[c]];
      let num = 0, den = 0;
      for (let q = 0; q < j.length; q++) { const v = mz.get(j[q]); if (v == null) continue; num += s[q] * v; den += s[q]; }
      if (den) { isRaw[c] = num / (den + ITEM_SIM.prior); isHas[c] = 1; }
    }
    const lc = (h: Uint8Array) => [...pos, ...neg].filter((c) => h[c]).length;
    cov(`${tag}|itemSim`, lc(isHas), pos.length + neg.length);
    const sIs = std(isRaw);
    // соседи по вкусу
    const nbMine = mineIn(pool, nbZ(vis));
    const sNb: Record<number, Sig> = {};
    for (const mc of COMMONS) {
      const { scores, neighbors } = neighborScores(pool, nbMine, { minCommon: mc, skip: (p) => p.id === me });
      const raw = new Float64Array(C), has = new Uint8Array(C);
      for (let c = 0; c < C; c++) { const f = nbFilm[cand[c]]; const v = f >= 0 ? scores.get(f) : undefined; if (v != null) { raw[c] = v; has[c] = 1; } }
      cov(`${tag}|nb${mc}`, lc(has), pos.length + neg.length);
      cov(`${tag}|nb${mc}:соседей`, neighbors, 1);
      sNb[mc] = std(raw);
    }
    const personal: Record<string, Sig> = { itemSim: sIs };
    for (const mc of COMMONS) { personal[`nb${mc}`] = sNb[mc]; personal[`is+nb${mc}`] = plus(sIs, sNb[mc]); }
    const bases: Record<string, Sig> = { pop: sPop, cons: sCons, 'pop+cons': sPC };
    for (const [b, s] of Object.entries(bases)) measure(`${tag}|${b}`, s, ctx);
    for (const [p, s] of Object.entries(personal)) measure(`${tag}|${p}`, s, ctx);
    for (const [b, bs] of Object.entries(bases)) for (const [p, ps] of Object.entries(personal)) {
      for (const w of WS) if (w > 0 && w < 1) measure(`${tag}|${b}→${p} w${w}`, mix(bs, ps, w), ctx);
      for (const k of KS_RULE) measure(`${tag}|${b}→${p} k${k}`, mix(bs, ps, n / (n + k)), ctx);
    }
    // часть обученного счёта ленты (LEARNED_B): consensus и itemSim в своих шкалах, «нет значения» — свой вес; поправка
    // для короткой истории — множитель r = [n/(n+k)] / [n̄/(n̄+k)] (n̄ — сколько видно при обучении) на вес itemSim и его «нет»
    const learned = (r: number, rc = 1) => Float64Array.from({ length: C }, (_, c) =>
      LEARNED_B.consensus * rc * consRaw[c] + (isHas[c] ? LEARNED_B.itemSim * r * isRaw[c] : (LEARNED_B.missing.itemSim ?? 0) * r));
    measure(`${tag}|LB`, learned(1), ctx);
    for (const k of KS_RULE) {
      const r = Math.min(1, (n / (n + k)) / (nTrain / (nTrain + k)));
      measure(`${tag}|LB r·k${k}`, learned(r), ctx);
      measure(`${tag}|LB r·k${k} cons·(2−r)`, learned(r, 2 - r), ctx);
    }
    // для справки: часть обученного счёта + «что смотрят все» (известность в LEARNED_B — уровни, здесь — log числа людей)
    measure(`${tag}|LB+pop`, learned(1).map((x, c) => x + 0.2 * sPop[c]), ctx);
  }
  done++;
  if (done % 10 === 0 || done === 1) console.error(`${done}: ${rated.length} оценок, кандидатов ${C}, ${pos.length}+/${neg.length}− · ${((Date.now() - t1) / 1000).toFixed(1)} с, ${mb()}`);
}

// ─── итог ──────────────────────────────────────────────────────────────────────
const rows = [...acc].map(([key, x]) => {
  const [cfg, method] = key.split('|');
  const m = x.pp / x.np;
  return { cfg, method, auc: x.s / x.w, aucPerPerson: m, se: Math.sqrt(Math.max(0, x.pp2 / x.np - m * m) / x.np), people: x.np,
    hit50: x.hit[0] / (x.liked || 1), hit150: x.hit[1] / (x.liked || 1) };
});
const covOut = Object.fromEntries([...coverage].map(([k, v]) => [k, v.s / (v.t || 1)]));
nVisible.sort((a, b) => a - b);
console.log(`людей ${done}, неспрятанного: медиана ${nVisible[Math.floor(nVisible.length / 2)]}, от ${nVisible[0]} до ${nVisible.at(-1)} · ${((Date.now() - t0) / 1000).toFixed(0)} с, ${mb()}`);
const f3 = (x: number) => x.toFixed(3), p1 = (x: number) => (x * 100).toFixed(1);
for (const cf of configs) {
  const tag = cfgName(cf);
  console.log(`\n── ${tag} ──  AUC пары · AUC люди ±se · hit@50 · hit@150`);
  for (const r of rows.filter((r) => r.cfg === tag && !/ w0\.| k\d/.test(r.method))) console.log(`${r.method.padEnd(28)} ${f3(r.auc)} ${f3(r.aucPerPerson)}±${f3(r.se)} ${p1(r.hit50).padStart(5)} ${p1(r.hit150).padStart(5)}`);
}
mkdirSync('.cache/eval', { recursive: true });
const day = new Date().toISOString().slice(0, 10);
const result = { at: new Date().toISOString(), min: MIN, ns: NS, people: done,
  visible: { median: nVisible[Math.floor(nVisible.length / 2)], min: nVisible[0], max: nVisible.at(-1) },
  itemSim: ITEM_SIM, neighbor: NEIGHBOR, coverage: covOut, rows };
writeFileSync(`.cache/eval/cold-start-${day}.json`, JSON.stringify(result, null, 1));
writeFileSync(`.cache/eval/cold-start-${day}-tables.md`, tablesMd(result));
console.error(`всего ${((Date.now() - t0) / 1000).toFixed(0)} с, память ${mb()} → .cache/eval/cold-start-${day}.json, -tables.md`);
