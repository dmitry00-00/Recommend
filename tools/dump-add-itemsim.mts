// Столбец itemSim в готовые выгрузки частей счёта (23.10): tools/taste-dump.mts пишет его пустым (null) — модуль «похожих
// фильмов» (src/lib/model/itemSim.ts) появился позже выгрузки, а повторять её (vite, полчаса на папку) ради одного столбца
// незачем: сходству приложение не нужно, только seeds/*.json. Таблица — без самого человека (itemSimTable(суммы, кто)),
// его z-оценки — только по НЕспрятанному; что спрятано — ровно как в taste-dump (тот же «случай» по имени, доля, seed,
// порядок оценок) и сверяется с файлом: hiddenTotal и метки строк. Не сошлось — файл не трогаем, пишем почему.
// Файлы моложе --age с (их, может, ещё пишет taste-dump) — мимо; --loop — проходить снова, пока такие есть или жив taste-dump.
//   npx tsx tools/dump-add-itemsim.mts [--dirs .cache/eval/dump-frozen,.cache/eval/dump-frozen-full] [--age 120] [--loop]
//        [--fresh] [--check 3]
// --check N — только N файлов первой папки, без записи: AUC столбца по меткам (сверка с tools/item-sim-eval.mts).
import { execSync } from 'node:child_process';
import { closeSync, existsSync, openSync, readdirSync, readFileSync, readSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { ITEM_SIM, itemSimScore, itemSimSums, itemSimTable, personZ } from '../src/lib/model/itemSim.ts';
import { peopleFilms, storiesRated } from './item-sim-data.mts';

const argv = process.argv.slice(2);
const opt = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const DIRS = (opt('--dirs') ?? '.cache/eval/dump-frozen,.cache/eval/dump-frozen-full').split(',');
const AGE = Number(opt('--age') ?? 120) * 1000;
const LOOP = argv.includes('--loop');
const FRESH = argv.includes('--fresh');
const CHECK = opt('--check') != null ? Number(opt('--check')) : 0;
const mb = () => `${Math.round(process.memoryUsage().rss / 1e6)} МБ`;
const r8 = (x: number | null) => (x == null ? null : Math.round(x * 1e8) / 1e8);

interface DumpFile {
  name: string; who: string; ok: boolean; holdout: { mode: string; share: number; seed: number };
  hiddenTotal: number; hiddenInPool: number; params: { min: number; share: number; seed: number; mode: string };
  feats: string[]; rows: (string | number | null)[][]; hiddenIds?: string[]; itemSimFill?: unknown; [k: string]: unknown;
}

// ─── как в taste-dump ──────────────────────────────────────────────────────────
function rng(seed: string) {
  let h = 2166136261; for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 2 ** 32; };
}
const quantile = (xs: number[], q: number) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
/** файл — как write() в taste-dump: шапка, потом строка на кандидата; через временный и переименование */
function write(file: string, d: DumpFile): void {
  const { rows, ...head } = d;
  const json = `${JSON.stringify(head).slice(0, -1)},"rows":[\n${rows.map((r) => JSON.stringify(r)).join(',\n')}\n]}\n`;
  writeFileSync(`${file}.itemsim.tmp`, json);
  renameSync(`${file}.itemsim.tmp`, file);
}

// ─── сходство: суммы — один раз на процесс (≈ 0,5 ГБ) ──────────────────────────
const t0 = Date.now();
// MIN у всех выгрузок пока 20; другой — свои суммы (держим одну пару: выгрузки с разным min в одной папке не бывают)
let simFor: { min: number; stories: ReturnType<typeof storiesRated>; sums: ReturnType<typeof itemSimSums>; alias: Map<string, string[]> } | undefined;
function sim(min: number) {
  if (simFor?.min === min) return simFor;
  simFor = undefined;
  const stories = storiesRated(min);
  const sums = itemSimSums(peopleFilms(min, stories));
  // у строки выгрузки один ключ (TMDb, нет — IMDb), а фильм в таблице может стоять под другим: связи ключей — из историй
  const alias = new Map<string, Set<string>>();
  for (const rs of stories.values()) for (const r of rs) if (r.keys.length > 1) for (const k of r.keys) {
    if (!alias.has(k)) alias.set(k, new Set());
    for (const o of r.keys) if (o !== k) alias.get(k)!.add(o);
  }
  simFor = { min, stories, sums, alias: new Map([...alias].map(([k, s]) => [k, [...s]])) };
  console.error(`суммы сходства (min ${min}): историй ${stories.size}, людей ${sums.people.size}, фильмов ${sums.m} · ${((Date.now() - t0) / 1000).toFixed(0)} с, ${mb()}`);
  return simFor;
}

function auc(pos: number[], neg: number[]): number | undefined {
  if (!pos.length || !neg.length) return undefined;
  let s = 0; for (const p of pos) for (const n of neg) s += p > n ? 1 : p === n ? 0.5 : 0;
  return s / (pos.length * neg.length);
}
const aucAcc = { s: 0, w: 0, sNN: 0, wNN: 0, sPop: 0, wPop: 0, files: 0 };

/** шапка файла — до первой строки кандидатов (64 КБ с запасом: предупреждений бывает много) */
function headOf(file: string): string {
  const fd = openSync(file, 'r');
  try { const buf = Buffer.alloc(65536); const n = readSync(fd, buf, 0, buf.length, 0); const s = buf.toString('utf8', 0, n); const i = s.indexOf('"rows":['); return i >= 0 ? s.slice(0, i) : s; } finally { closeSync(fd); }
}
/** один файл: 'filled' | 'young' | 'skip:<почему>' | 'bad:<почему>' */
function fill(file: string): string {
  const mtime = statSync(file).mtimeMs;
  // уже дописанное (отметка — в шапке, до строк) — мимо и без ожидания: свежий файл бывает и нашим только что записанным
  if (!FRESH && !CHECK && headOf(file).includes('"itemSimFill":')) return 'skip:уже';
  if (Date.now() - mtime < AGE) return 'young';
  const d = JSON.parse(readFileSync(file, 'utf8')) as DumpFile;
  if (d.itemSimFill && !FRESH && !CHECK) return 'skip:уже';
  const col = d.feats.indexOf('itemSim');
  if (col < 0) return 'bad:нет столбца itemSim';
  if (!d.rows.length) return 'skip:пустой (ok: false)';
  // список спрятанного в файле (taste-dump с 23.10) — берём его, «случай» не повторяем: так годится и recent
  if (!d.hiddenIds && d.holdout.mode !== 'random') return `bad:спрятано по «${d.holdout.mode}» — повторить не умею`;
  const { stories, sums, alias } = sim(d.params.min);
  const rated = stories.get(d.name);
  if (!rated) return 'bad:истории нет в seeds (или меньше min оценок)';
  // спрятанное — из файла, нет списка — как holdout() в taste-dump; сверка та же (из файла — сколько его среди оценок)
  const rand = d.hiddenIds ? undefined : rng(d.params.seed === 1 ? d.name : `${d.name}#${d.params.seed}`);
  const listed = d.hiddenIds && new Set(d.hiddenIds);
  const hidden = new Set(rated.filter((r) => (listed ? listed.has(r.workId) : rand!() < d.params.share)).map((r) => r.workId));
  if (hidden.size !== d.hiddenTotal) return `bad:спрятано ${hidden.size}, в файле ${d.hiddenTotal}`;
  // метки: строка с меткой — ключ спрятанной оценки, и метка та же (верх/низ 30% шкалы); строк с ключом видимой — нет
  const raws = rated.map((r) => r.raw);
  const hi = quantile(raws, 0.7), lo = quantile(raws, 0.3);
  const hidKey = new Map<string, number>(), visKey = new Set<string>();
  for (const r of rated) for (const k of [r.workId, ...r.keys]) {
    if (hidden.has(r.workId)) { if (!hidKey.has(k)) hidKey.set(k, r.raw >= hi && r.raw > lo ? 1 : r.raw <= lo && r.raw < hi ? -1 : 0); } else visKey.add(k);
  }
  let labeled = 0, labelMiss = 0, labelDiff = 0;
  for (const r of d.rows) {
    if (r[1] == null) continue;
    labeled++;
    const k = r[0] as string, want = hidKey.get(k);
    if (want == null) labelMiss++; else if (want !== r[1]) labelDiff++;
  }
  // одна и та же картина под двумя записями (спрятана одна, видна другая) — бывает; расхождение больше 2% — не наше спрятанное
  if (labelMiss + labelDiff > Math.max(1, 0.02 * labeled)) return `bad:метки не сходятся (${labelMiss} без спрятанного, ${labelDiff} другая метка из ${labeled})`;

  const simT = itemSimTable(sums, d.who);
  const mine = personZ(rated.filter((r) => !hidden.has(r.workId) && r.keys.length));
  let got = 0, inTable = 0;
  const pos: number[] = [], neg: number[] = [], posNN: number[] = [], negNN: number[] = [], posPop: number[] = [], negPop: number[] = [];
  const pi = 2 + d.feats.indexOf('popular');
  for (const r of d.rows) {
    const k = r[0] as string;
    const keys = [k, ...(alias.get(k) ?? [])];
    if (keys.some((x) => sums.index.has(x))) inTable++;
    const v = r8(itemSimScore(simT, keys, mine));
    if (v != null) got++;
    r[2 + col] = v;
    if (r[1] === 1 || r[1] === -1) {
      // как в item-sim-eval: нет сигнала — 0, ничья — «что смотрят все»
      const pop = Number(r[pi] ?? 0);
      (r[1] === 1 ? pos : neg).push((v ?? 0) + pop * 1e-6);
      (r[1] === 1 ? posPop : negPop).push(pop);
      if (v != null) (r[1] === 1 ? posNN : negNN).push(v);
    }
  }
  const a = auc(pos, neg), aNN = auc(posNN, negNN), aPop = auc(posPop, negPop);
  if (a != null) { aucAcc.s += a * pos.length * neg.length; aucAcc.w += pos.length * neg.length; aucAcc.files++; }
  if (aNN != null) { aucAcc.sNN += aNN * posNN.length * negNN.length; aucAcc.wNN += posNN.length * negNN.length; }
  if (aPop != null) { aucAcc.sPop += aPop * posPop.length * negPop.length; aucAcc.wPop += posPop.length * negPop.length; }
  const info = `спрятано ${hidden.size} ✓, меток ${labeled} (не сошлось ${labelMiss + labelDiff}), itemSim у ${got} из ${d.rows.length} (в таблице ${inTable})`
    + ` · AUC ${a?.toFixed(3) ?? '—'} (где есть ${aNN?.toFixed(3) ?? '—'}: ${posNN.length}+/${negNN.length}−; популярное ${aPop?.toFixed(3) ?? '—'})`;
  if (CHECK) return `check:${info}`;
  if (statSync(file).mtimeMs !== mtime) return 'young';  // пока считали, файл переписали — в следующий проход
  d.itemSimFill = { at: new Date().toISOString(), by: 'tools/dump-add-itemsim.mts', neighbors: ITEM_SIM.neighbors, shrink: ITEM_SIM.shrink,
    minCommon: ITEM_SIM.minCommon, prior: ITEM_SIM.prior, filled: got, inTable };
  write(file, d);
  return `filled:${info}`;
}

// ─── проход по папкам ──────────────────────────────────────────────────────────
// итог — по файлу (последний исход); своё только что записанное (mtime — наш) «молодым» не считается
const status = new Map<string, { kind: string; mine?: number }>();
/** пишет ли выгрузку taste-dump прямо сейчас: на тяжёлой истории он молчит дольше --age (3 мин на 5 тыс. оценок) */
const writerAlive = () => { try { return execSync('pgrep -f "tools/[t]aste-dump[.]mts"', { encoding: 'utf8' }).trim() !== ''; } catch { return false; } };
for (let pass = 1; ; pass++) {
  let young = 0;
  for (const dir of CHECK ? DIRS.slice(0, 1) : DIRS) {
    // папки ещё нет — не ждём её, если выгрузку никто не пишет; появится — запустить ещё раз
    if (!existsSync(dir)) { if (pass === 1) console.error(`${dir}: папки нет`); continue; }
    const files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
    for (const f of CHECK ? files.slice(0, CHECK) : files) {
      const file = `${dir}/${f}`, was = status.get(file);
      if (was?.mine != null && statSync(file).mtimeMs === was.mine) continue;
      const t1 = Date.now();
      let res: string;
      try { res = fill(file); } catch (err) { res = `bad:${err instanceof Error ? err.message : String(err)}`; }
      const [kind, ...rest] = res.split(':');
      const why = rest.join(':');
      status.set(file, { kind: kind === 'skip' && why === 'уже' ? 'done' : kind, ...(kind !== 'young' ? { mine: statSync(file).mtimeMs } : {}) });
      if (kind === 'young') { young++; continue; }
      if (kind === 'skip') { if (why !== 'уже') console.error(`${file}: мимо — ${why}`); continue; }
      console.error(`${file}: ${kind === 'bad' ? 'НЕ ТРОНУТ — ' : ''}${why} · ${((Date.now() - t1) / 1000).toFixed(1)} с, ${mb()}`);
    }
  }
  const alive = LOOP && !CHECK && writerAlive();
  if (CHECK || !LOOP || (!young && !alive)) break;
  console.error(`проход ${pass}: моложе ${AGE / 1000} с — ${young}${alive ? ', taste-dump ещё пишет' : ''}; жду минуту`);
  await new Promise((r) => setTimeout(r, 60_000));
}
for (const dir of CHECK ? DIRS.slice(0, 1) : DIRS) {
  const c: Record<string, number> = {};
  for (const [file, { kind }] of status) if (file.startsWith(`${dir}/`)) c[kind] = (c[kind] ?? 0) + 1;
  console.error(`${dir}: дописано сейчас ${c.filled ?? 0}, уже было ${c.done ?? 0}, мимо ${c.skip ?? 0}, не сошлось ${c.bad ?? 0}, моложе ${AGE / 1000} с ${c.young ?? 0}`);
}
if (aucAcc.w) console.error(`AUC itemSim по меткам (все пары, ${aucAcc.files} файлов): ${(aucAcc.s / aucAcc.w).toFixed(3)} · где есть значение ${(aucAcc.sNN / aucAcc.wNN).toFixed(3)} · популярное ${(aucAcc.sPop / aucAcc.wPop).toFixed(3)}`);
console.error(`всего ${((Date.now() - t0) / 1000).toFixed(0)} с, память ${mb()}`);
