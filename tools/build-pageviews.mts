// Просмотры статей Википедии как мера известности (23.10). Исследование (reports/Улучшение рекомендательного движка.md,
// research_notes/…/external_data.md) советует заменить популярность TMDb/IMDb — их условия не разрешают коммерческое
// использование без договора — на просмотры статей Википедии (данные Викимедиа, CC0): ru и en отдельно — «популярно у
// русскоязычных» и «популярно в мире». Здесь — сбор и сравнение с тем, что есть сейчас; в src/ ничего не пишется.
//
// 1. Ключи пула подбора — из готовых выгрузок .cache/eval/dump-frozen*/ (там по строке на каждого кандидата пула, ключи
//    те же, что у разборов: `tmdb:<id>` фильм, `imdb:<tt…>` сериал): dump-frozen — пул первой ленты (~14,5 тыс.),
//    dump-frozen-full — весь пул (~25 тыс.). Без vite и без src/mocks — лёгкий процесс.
// 2. Статьи ru/en — Wikidata SPARQL пачками (TMDb P4947, IMDb P345 → sitelinks). В Wikidata ходят и другие агенты:
//    не чаще запроса в 3 секунды, повторы с отступом, кэш ответов .cache/pageviews/wd-2310.json.
// 3. Просмотры — Wikimedia REST per-article, помесячно с 2015-07 (раньше данных нет) по последний полный месяц; кэш —
//    .cache/pageviews/monthly-{ru,en}.jsonl (строка на статью, прерванный прогон докачивает); старые файлы
//    .cache/pageviews/ru-<base64>.json (tools/trend-susceptibility.mts) тоже читаются. Вежливо: ≤ 6 запросов/с.
// 4. Сравнение по выгрузкам dump-frozen: покрытие, корреляции с popular и fame, AUC и попадания при ранжировании пула
//    по просмотрам против «что смотрят все»; пороги уровней 0–3 по просмотрам против нынешнего fame.
//   npx tsx tools/build-pageviews.mts [--stats] [--first] [--rate N] [--conc N]
//     --stats — без сети: только расчёт по кэшу; --first — просмотры только для пула первой ленты
// Выход: .cache/pageviews/pool-2310.json (ключ → статьи и суммы), отчёт .cache/eval/pageviews-2310.md.
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const opt = (n: string) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const STATS = args.includes('--stats');
const FIRST = args.includes('--first');
const RATE = Number(opt('--rate') ?? 6);
const CONC = Number(opt('--conc') ?? 4);
const DIR = '.cache/pageviews';
const WD = `${DIR}/wd-2310.json`;
const OUT = `${DIR}/pool-2310.json`;
const REPORT = '.cache/eval/pageviews-2310.md';
const DUMP_FIRST = '.cache/eval/dump-frozen';
const DUMP_FULL = '.cache/eval/dump-frozen-full';
// латиницей: заголовок — ByteString, кириллица роняет fetch; контакт — репозиторий проекта
const UA = 'recomend/0.1 (https://github.com/dmitry00-00/Recommend; pageviews research)';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const T0 = Date.now();
mkdirSync(DIR, { recursive: true });

// ── месяцы ────────────────────────────────────────────────────────────────────────────────────────────
// с 2015-07 по последний полный месяц; «последние 24» — 24 месяца до него включительно
const now = new Date();
const lastFull = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
const ym = (d: Date) => `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
const MONTHS: string[] = [];
for (let d = new Date(Date.UTC(2015, 6, 1)); d <= lastFull; d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))) MONTHS.push(ym(d));
const LAST24 = MONTHS.length - 24;
const END = `${MONTHS.at(-1)}0100`;

// ── 1. ключи пула ─────────────────────────────────────────────────────────────────────────────────────
interface Dump { name: string; feats: string[]; rows: (string | number | null)[][] }
const dumpFiles = (dir: string) => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json')).sort().map((f) => `${dir}/${f}`) : []);
const keysOf = (dir: string) => {
  const out = new Set<string>();
  for (const f of dumpFiles(dir)) for (const r of (JSON.parse(readFileSync(f, 'utf8')) as Dump).rows) out.add(r[0] as string);
  return out;
};
const firstPool = keysOf(DUMP_FIRST);
const fullPool = keysOf(DUMP_FULL);
for (const k of firstPool) fullPool.add(k);
const allKeys = [...firstPool, ...[...fullPool].filter((k) => !firstPool.has(k))];
console.error(`пул первой ленты ${firstPool.size}, весь пул ${fullPool.size}`);

// ── 2. Wikidata: ключ → элемент и статьи ru/en ───────────────────────────────────────────────────────
interface Wd { q?: string; n?: number; ru?: string; en?: string }
const wd: Record<string, Wd> = existsSync(WD) ? JSON.parse(readFileSync(WD, 'utf8')) : {};
let lastWd = 0;
async function sparql(query: string): Promise<{ results: { bindings: Record<string, { value: string }>[] } }> {
  for (let attempt = 0; ; attempt++) {
    // не чаще запроса в 3 секунды — от конца прошлого ответа (параллельно в Wikidata ходят ещё агенты)
    await sleep(Math.max(0, lastWd + 3000 - Date.now()));
    try {
      const r = await fetch('https://query.wikidata.org/sparql', {
        method: 'POST', body: new URLSearchParams({ query }), signal: AbortSignal.timeout(120_000),
        headers: { 'user-agent': UA, accept: 'application/sparql-results+json', 'content-type': 'application/x-www-form-urlencoded' },
      });
      lastWd = Date.now();
      if (r.ok) return await r.json() as never;
      if (attempt >= 6) throw new Error(`Wikidata: ${r.status} после ${attempt + 1} попыток`);
      const after = Number(r.headers.get('retry-after') ?? 0) * 1000;
      await sleep(Math.max(after, 10_000 * (attempt + 1)));
    } catch (err) {
      lastWd = Date.now();
      if (attempt >= 6) throw err;
      await sleep(10_000 * (attempt + 1));
    }
  }
}
if (!STATS) {
  const todo = allKeys.filter((k) => !(k in wd));
  const kinds = [['tmdb', 'P4947'], ['imdb', 'P345']] as const;
  let done = 0;
  for (const [kind, prop] of kinds) {
    const part0 = todo.filter((k) => k.startsWith(`${kind}:`));
    for (let i = 0; i < part0.length; i += 250) {
      const part = part0.slice(i, i + 250);
      const vals = part.map((k) => `"${k.slice(kind.length + 1).replace(/[^\w]/g, '')}"`).join(' ');
      const res = await sparql(`SELECT ?t ?q ?n ?ru ?en WHERE { VALUES ?t { ${vals} } ?q wdt:${prop} ?t . ?q wikibase:sitelinks ?n .
        OPTIONAL { ?ra schema:about ?q ; schema:isPartOf <https://ru.wikipedia.org/> ; schema:name ?ru }
        OPTIONAL { ?ea schema:about ?q ; schema:isPartOf <https://en.wikipedia.org/> ; schema:name ?en } }`);
      for (const k of part) wd[k] = {};
      for (const b of res.results.bindings) {
        const k = `${kind}:${b.t.value}`;
        const n = Number(b.n.value);
        // у номера бывает два элемента (фильм и его перевыпуск, сериал и сезон) — берём тот, у кого больше разделов
        if ((wd[k].n ?? -1) >= n) continue;
        wd[k] = { q: b.q.value.split('/').pop()!, n, ...(b.ru ? { ru: b.ru.value } : {}), ...(b.en ? { en: b.en.value } : {}) };
      }
      done += part.length;
      writeFileSync(WD, JSON.stringify(wd));
      process.stderr.write(`\rWikidata ${done}/${todo.length}`);
    }
  }
  if (todo.length) console.error();
}

// ── 3. просмотры ──────────────────────────────────────────────────────────────────────────────────────
type Lang = 'ru' | 'en';
/** помесячные просмотры статьи с 2015-07 (индекс 0) по последний полный месяц; null — статьи нет в счётчике */
const views: Record<Lang, Map<string, number[] | null>> = { ru: new Map(), en: new Map() };
for (const lang of ['ru', 'en'] as Lang[]) {
  const f = `${DIR}/monthly-${lang}.jsonl`;
  if (!existsSync(f)) continue;
  for (const line of readFileSync(f, 'utf8').split('\n')) {
    if (!line) continue;
    try { const x = JSON.parse(line) as { t: string; v?: number[]; none?: true; end?: string }; if (x.end === END) views[lang].set(x.t, x.none ? null : x.v!); } catch { /* оборванная строка */ }
  }
}
// старые файлы tools/trend-susceptibility.mts: [["2015-07", n], …] — годятся, если доходят до нашего месяца
for (const f of readdirSync(DIR)) {
  const m = /^(ru|en)-(.+)\.json$/.exec(f);
  if (!m) continue;
  const title = Buffer.from(m[2], 'base64url').toString();
  if (views[m[1] as Lang].has(title)) continue;
  try {
    const pairs = JSON.parse(readFileSync(`${DIR}/${f}`, 'utf8')) as [string, number][];
    if (!pairs.some(([k]) => k.replace('-', '') === MONTHS.at(-1))) continue;
    const at = new Map(pairs.map(([k, v]) => [k.replace('-', ''), v]));
    views[m[1] as Lang].set(title, MONTHS.map((k) => at.get(k) ?? 0));
  } catch { /* битый файл */ }
}

let nextSlot = 0, pausedUntil = 0, rate = RATE, refusals = 0;
async function slot() {
  for (;;) {
    const t = Date.now();
    if (t < pausedUntil) { await sleep(pausedUntil - t); continue; }
    const at = Math.max(t, nextSlot);
    nextSlot = at + 1000 / rate;
    if (at > t) await sleep(at - t);
    return;
  }
}
async function monthly(lang: Lang, title: string): Promise<number[] | null> {
  const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/${lang}.wikipedia/all-access/user/`
    + `${encodeURIComponent(title.replace(/ /g, '_'))}/monthly/2015070100/${END}`;
  for (let attempt = 0; ; attempt++) {
    await slot();
    const r = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/json' }, signal: AbortSignal.timeout(60_000) }).catch(() => undefined);
    if (r?.status === 404) return null;   // статью никто не открывал (или её нет под этим именем)
    if (r?.ok) {
      const body = await r.json() as { items?: { timestamp: string; views: number }[] };
      const at = new Map((body.items ?? []).map((x) => [x.timestamp.slice(0, 6), x.views]));
      return MONTHS.map((k) => at.get(k) ?? 0);
    }
    if (attempt >= 6) throw new Error(`${r?.status ?? 'сеть'} ${lang}:${title}`);
    // 429 — ждём, сколько сказано, и сбавляем темп всем потокам (на 24.09 четыре потока без паузы дали 973 отказа из 993)
    // (23.10: на 8/с за первые минуты было 6 отказов; деление темпа пополам роняло сбор до 1,5/с — сбавляем мягче)
    // отказы пачкой (все потоки разом) — одно снижение: пока стоим на паузе, второй раз не сбавляем
    if (r?.status === 429) { refusals++; if (Date.now() >= pausedUntil) rate = Math.max(1, Math.round(rate * 0.75 * 10) / 10); }
    const after = Number(r?.headers.get('retry-after') ?? 0) * 1000;
    pausedUntil = Math.max(pausedUntil, Date.now() + Math.max(after, 2000 * 2 ** attempt));
  }
}
if (!STATS) {
  const keys = FIRST ? allKeys.filter((k) => firstPool.has(k)) : allKeys;
  const jobs: [Lang, string][] = [];
  const queued = { ru: new Set<string>(), en: new Set<string>() };
  for (const k of keys) for (const lang of ['ru', 'en'] as Lang[]) {
    const t = wd[k]?.[lang];
    if (t && !views[lang].has(t) && !queued[lang].has(t)) { queued[lang].add(t); jobs.push([lang, t]); }
  }
  console.error(`просмотров спросить: ${jobs.length} (≈ ${Math.ceil(jobs.length / RATE / 60)} мин при ${RATE}/с)`);
  let i = 0, done = 0, failed = 0;
  const worker = async () => {
    while (i < jobs.length) {
      const [lang, t] = jobs[i++];
      try {
        const v = await monthly(lang, t);
        views[lang].set(t, v);
        appendFileSync(`${DIR}/monthly-${lang}.jsonl`, JSON.stringify(v ? { t, end: END, v } : { t, end: END, none: true }) + '\n');
      } catch (err) { failed++; console.error(`\n${(err as Error).message}`); }
      if (++done % 200 === 0) {
        const el = (Date.now() - T0) / 1000;
        process.stderr.write(`\rпросмотры ${done}/${jobs.length} · отказов 429: ${refusals} · темп ${rate}/с · ${Math.round(el / 60)} мин`);
      }
      // темп после отказа понемногу возвращаем
      if (done % 100 === 0 && rate < RATE) rate = Math.min(RATE, Math.round((rate + 0.2) * 10) / 10);
    }
  };
  await Promise.all(Array.from({ length: CONC }, worker));
  console.error(`\nпросмотры: спрошено ${done}, не вышло ${failed}, отказов 429 ${refusals}`);
}

// ── итог по ключам ────────────────────────────────────────────────────────────────────────────────────
const sum = (v: number[] | null | undefined, from = 0) => (v ? v.slice(from).reduce((a, b) => a + b, 0) : undefined);
interface Pv { ru24?: number; ruAll?: number; en24?: number; enAll?: number; hasRu: boolean; hasEn: boolean; fetched: boolean }
const pvOf = new Map<string, Pv>();
for (const k of allKeys) {
  const w = wd[k] ?? {};
  const vr = w.ru ? views.ru.get(w.ru) : undefined, ve = w.en ? views.en.get(w.en) : undefined;
  pvOf.set(k, {
    hasRu: !!w.ru, hasEn: !!w.en,
    fetched: (!w.ru || views.ru.has(w.ru)) && (!w.en || views.en.has(w.en)),
    ru24: w.ru ? sum(vr, LAST24) ?? (vr === null ? 0 : undefined) : 0, ruAll: w.ru ? sum(vr) ?? (vr === null ? 0 : undefined) : 0,
    en24: w.en ? sum(ve, LAST24) ?? (ve === null ? 0 : undefined) : 0, enAll: w.en ? sum(ve) ?? (ve === null ? 0 : undefined) : 0,
  });
}
writeFileSync(OUT, JSON.stringify({
  at: new Date().toISOString(), by: 'tools/build-pageviews.mts', months: { from: MONTHS[0], to: MONTHS.at(-1), last24from: MONTHS[LAST24] },
  cols: ['wikidata', 'ruTitle', 'enTitle', 'ru24', 'ruAll', 'en24', 'enAll', 'firstPool'],
  rows: Object.fromEntries(allKeys.map((k) => {
    const w = wd[k] ?? {}, p = pvOf.get(k)!;
    return [k, [w.q ?? null, w.ru ?? null, w.en ?? null, p.fetched ? p.ru24 ?? null : null, p.fetched ? p.ruAll ?? null : null,
      p.fetched ? p.en24 ?? null : null, p.fetched ? p.enAll ?? null : null, firstPool.has(k) ? 1 : 0]];
  })),
}));

// ── 4. сравнение по выгрузкам пула первой ленты ──────────────────────────────────────────────────────
const fNum = (x: number | undefined, d = 3) => (x == null || !Number.isFinite(x) ? '—' : x.toFixed(d));
const pct = (x: number) => `${(100 * x).toFixed(1)} %`;
const int = (x: number) => Math.round(x).toLocaleString('ru-RU');
const L = (x: number | undefined) => Math.log10(1 + (x ?? 0));

// по строке на фильм пула: popular — наибольшее по историям (выгрузка считает его без самого человека), fame — общий
const files = dumpFiles(DUMP_FIRST);
const popularMax = new Map<string, number>();
const fameOf = new Map<string, number>();
for (const f of files) {
  const d = JSON.parse(readFileSync(f, 'utf8')) as Dump;
  const iP = d.feats.indexOf('popular') + 2, iF = d.feats.indexOf('fame') + 2;
  for (const r of d.rows) {
    const k = r[0] as string;
    popularMax.set(k, Math.max(popularMax.get(k) ?? 0, (r[iP] as number) ?? 0));
    if (!fameOf.has(k)) fameOf.set(k, (r[iF] as number) ?? 0);
  }
}
const first = [...firstPool].filter((k) => pvOf.get(k)!.fetched);
const unfetchedFirst = firstPool.size - first.length;

// покрытие
const cover = (keys: string[]) => {
  const n = keys.length, ru = keys.filter((k) => pvOf.get(k)!.hasRu).length, en = keys.filter((k) => pvOf.get(k)!.hasEn).length;
  const any = keys.filter((k) => pvOf.get(k)!.hasRu || pvOf.get(k)!.hasEn).length, q = keys.filter((k) => wd[k]?.q).length;
  const both = keys.filter((k) => pvOf.get(k)!.hasRu && pvOf.get(k)!.hasEn).length;
  return { n, q, ru, en, any, both };
};
const kindOf = (k: string) => (k.startsWith('tmdb:') ? 'фильмы (tmdb:)' : 'сериалы и прочее (imdb:)');

// корреляции: Пирсон на log10(1+x) и Спирмен
const rankArr = (xs: number[]) => {
  const idx = xs.map((_, i) => i).sort((a, b) => xs[a] - xs[b]);
  const r = new Array<number>(xs.length);
  for (let i = 0; i < idx.length;) {
    let j = i; while (j + 1 < idx.length && xs[idx[j + 1]] === xs[idx[i]]) j++;
    for (let t = i; t <= j; t++) r[idx[t]] = (i + j) / 2;
    i = j + 1;
  }
  return r;
};
const pearson = (a: number[], b: number[]) => {
  const n = a.length; if (n < 3) return undefined;
  const ma = a.reduce((s, x) => s + x, 0) / n, mb = b.reduce((s, x) => s + x, 0) / n;
  let sab = 0, saa = 0, sbb = 0; for (let i = 0; i < n; i++) { sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) ** 2; sbb += (b[i] - mb) ** 2; }
  return saa && sbb ? sab / Math.sqrt(saa * sbb) : undefined;
};
const spearman = (a: number[], b: number[]) => pearson(rankArr(a), rankArr(b));
const series: Record<string, (k: string) => number> = {
  'log ru (24 мес.)': (k) => L(pvOf.get(k)!.ru24), 'log en (24 мес.)': (k) => L(pvOf.get(k)!.en24),
  'log ru (с 2015)': (k) => L(pvOf.get(k)!.ruAll), 'log en (с 2015)': (k) => L(pvOf.get(k)!.enAll),
  'log(ru/en), 24 мес.': (k) => L(pvOf.get(k)!.ru24) - L(pvOf.get(k)!.en24),
};
const targets: Record<string, (k: string) => number> = { 'popular (людей оценили)': (k) => popularMax.get(k) ?? 0, 'fame (0–3)': (k) => fameOf.get(k) ?? 0 };
const both = first.filter((k) => pvOf.get(k)!.hasRu && pvOf.get(k)!.hasEn);
const corrRows: string[] = [];
for (const [sn, sf] of Object.entries(series)) {
  const cells: string[] = [];
  for (const [, tf] of Object.entries(targets)) {
    const keys = sn.startsWith('log(ru/en)') ? both : first;
    const a = keys.map(sf), b = keys.map(tf);
    cells.push(`${fNum(pearson(a, b.map((x) => Math.log10(1 + x))), 2)} / ${fNum(spearman(a, b), 2)}`);
  }
  corrRows.push(`| ${sn} | ${cells.join(' | ')} |`);
}
const ruEn = { p: pearson(both.map(series['log ru (24 мес.)']), both.map(series['log en (24 мес.)'])), s: spearman(both.map((k) => pvOf.get(k)!.ru24!), both.map((k) => pvOf.get(k)!.en24!)) };
// popular у кого ≥ 1 оценки: внутри «кто-то смотрел»
const seenKeys = first.filter((k) => (popularMax.get(k) ?? 0) > 0);

// ранжирование пула: AUC любимое/нелюбимое и попадания@K по всем историям
const KS = [10, 50, 150];
type Score = (k: string, row: (string | number | null)[], ix: Record<string, number>) => number;
const pctRank = (vals: Map<string, number>) => {
  const ks = [...vals.keys()], r = rankArr(ks.map((k) => vals.get(k)!));
  return new Map(ks.map((k, i) => [k, r[i] / Math.max(1, ks.length - 1)]));
};
// смеси — средние места (доли), как в taste-eval: просмотры по всему пулу первой ленты
const pRu = pctRank(new Map(first.map((k) => [k, pvOf.get(k)!.ru24!])));
const pEn = pctRank(new Map(first.map((k) => [k, pvOf.get(k)!.en24!])));
const pRuAll = pctRank(new Map(first.map((k) => [k, pvOf.get(k)!.ruAll!])));
const pEnAll = pctRank(new Map(first.map((k) => [k, pvOf.get(k)!.enAll!])));
const pPop = pctRank(new Map(first.map((k) => [k, popularMax.get(k) ?? 0])));

// ── уровни известности по просмотрам ─────────────────────────────────────────────────────────────────
// уровень L, если ru за 24 месяца ≥ R_L или en ≥ E_L; R_L и E_L — на одном и том же месте (квантиле) внутри своего языка,
// место подобрано так, чтобы доля уровня ≥ L в пуле первой ленты была как у нынешнего fame — сравниваем расстановку, а не щедрость
const share = (L0: number) => first.filter((k) => (fameOf.get(k) ?? 0) >= L0).length / first.length;
const sortedRu = first.map((k) => pvOf.get(k)!.ru24!).sort((a, b) => b - a);
const sortedEn = first.map((k) => pvOf.get(k)!.en24!).sort((a, b) => b - a);
const round2 = (x: number) => { if (x < 100) return Math.round(x); const p = 10 ** (Math.floor(Math.log10(x)) - 1); return Math.round(x / p) * p; };
const thresholdsFor = (target: number) => {
  let lo = 0, hi = 1;
  for (let it = 0; it < 40; it++) {
    const q = (lo + hi) / 2;
    const R = sortedRu[Math.min(sortedRu.length - 1, Math.floor(q * sortedRu.length))], E = sortedEn[Math.min(sortedEn.length - 1, Math.floor(q * sortedEn.length))];
    const s = first.filter((k) => pvOf.get(k)!.ru24! >= R || pvOf.get(k)!.en24! >= E).length / first.length;
    if (s > target) hi = q; else lo = q;
  }
  const q = lo;
  return { R: round2(Math.max(1, sortedRu[Math.floor(q * sortedRu.length)])), E: round2(Math.max(1, sortedEn[Math.floor(q * sortedEn.length)])) };
};
const LV = [3, 2, 1].map((l) => ({ level: l, ...thresholdsFor(share(l)) }));
const pvLevel = (k: string) => { const p = pvOf.get(k)!; return LV.find((t) => p.ru24! >= t.R || p.en24! >= t.E)?.level ?? 0; };

const methods: Record<string, Score> = {
  '«что смотрят все» (popular)': (k, r, ix) => ((r[ix.popular] as number) ?? 0),
  'просмотры ru, 24 мес.': (k) => pvOf.get(k)!.ru24!,
  'просмотры en, 24 мес.': (k) => pvOf.get(k)!.en24!,
  'просмотры ru, с 2015': (k) => pvOf.get(k)!.ruAll!,
  'просмотры en, с 2015': (k) => pvOf.get(k)!.enAll!,
  'смесь ru+en, 24 мес.': (k) => (pRu.get(k)! + pEn.get(k)!) / 2,
  'смесь ru+en, с 2015': (k) => (pRuAll.get(k)! + pEnAll.get(k)!) / 2,
  'popular + смесь ru+en': (k) => (pPop.get(k)! + (pRu.get(k)! + pEn.get(k)!) / 2) / 2,
  'fame сейчас (0–3)': (k) => fameOf.get(k) ?? 0,
  'уровень по просмотрам (0–3)': (k) => pvLevel(k),
  'модель (столбец full)': (k, r, ix) => ((r[ix.full] as number) ?? 0),
};
const auc = (pos: number[], neg: number[]) => {
  if (!pos.length || !neg.length) return undefined;
  // по местам, а не попарно: O(n log n), равные — половина
  const all = [...pos.map((v) => [v, 1] as const), ...neg.map((v) => [v, 0] as const)];
  const r = rankArr(all.map((x) => x[0]));
  let s = 0; all.forEach((x, i) => { if (x[1]) s += r[i] + 1; });
  return (s - (pos.length * (pos.length + 1)) / 2) / (pos.length * neg.length);
};
interface Res { pure?: number; tie?: number; hit: number[] }
const per: { name: string; liked: number; disliked: number; pool: number; by: Record<string, Res> }[] = [];
for (const f of files) {
  const d = JSON.parse(readFileSync(f, 'utf8')) as Dump;
  const ix = Object.fromEntries(d.feats.map((n, i) => [n, i + 2]));
  const rows = d.rows.filter((r) => pvOf.get(r[0] as string)?.fetched);
  const by: Record<string, Res> = {};
  for (const [m, sc] of Object.entries(methods)) {
    const v = rows.map((r) => sc(r[0] as string, r, ix));
    // равные места разводим моделью, как taste-eval (там порядок модели — `i * 1e-9`): нужно для попаданий в широкие ничьи
    const full = rows.map((r) => (r[ix.full] as number) ?? 0);
    const order = rows.map((_, i) => i).sort((a, b) => v[b] - v[a] || full[b] - full[a]);
    const place = new Array<number>(rows.length); order.forEach((i, p) => { place[i] = p; });
    const li = rows.map((r, i) => (r[1] === 1 ? i : -1)).filter((i) => i >= 0), di = rows.map((r, i) => (r[1] === -1 ? i : -1)).filter((i) => i >= 0);
    by[m] = {
      pure: auc(li.map((i) => v[i]), di.map((i) => v[i])),
      tie: auc(li.map((i) => -place[i]), di.map((i) => -place[i])),
      hit: KS.map((K) => (li.length ? li.filter((i) => place[i] < K).length / li.length : 0)),
    };
  }
  per.push({ name: d.name, liked: rows.filter((r) => r[1] === 1).length, disliked: rows.filter((r) => r[1] === -1).length, pool: rows.length, by });
}
const pooledAuc = (m: string, f: 'pure' | 'tie') => {
  let s = 0, n = 0; for (const r of per) { const v = r.by[m][f]; if (v == null) continue; const w = r.liked * r.disliked; s += v * w; n += w; }
  return n ? s / n : undefined;
};
const meanAuc = (m: string) => { const v = per.map((r) => r.by[m].pure).filter((x): x is number => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : undefined; };
const totalLiked = per.reduce((s, r) => s + r.liked, 0);
const micro = (m: string, i: number) => (totalLiked ? per.reduce((s, r) => s + r.by[m].hit[i] * r.liked, 0) / totalLiked : 0);
const poolMean = per.reduce((s, r) => s + r.pool, 0) / Math.max(1, per.length);

// переходы уровней
const trans = Array.from({ length: 4 }, () => [0, 0, 0, 0]);
for (const k of first) trans[fameOf.get(k) ?? 0][pvLevel(k)]++;
const changed = first.filter((k) => (fameOf.get(k) ?? 0) !== pvLevel(k));
const titleOf = (k: string) => wd[k]?.ru ?? wd[k]?.en ?? k;
const ex = (from: number, to: number, n = 8) => first.filter((k) => (fameOf.get(k) ?? 0) === from && pvLevel(k) === to)
  .sort((a, b) => (to > from ? -1 : 1) * ((pvOf.get(a)!.ru24! + pvOf.get(a)!.en24!) - (pvOf.get(b)!.ru24! + pvOf.get(b)!.en24!)))
  .slice(0, n).map((k) => `${titleOf(k)} (${k}; ru ${int(pvOf.get(k)!.ru24!)}, en ${int(pvOf.get(k)!.en24!)}, разделов ${wd[k]?.n ?? 0}, оценили ${popularMax.get(k) ?? 0})`);

// ── отчёт ─────────────────────────────────────────────────────────────────────────────────────────────
const c1 = cover([...firstPool]), cAll = cover([...fullPool]);
const coverRow = (label: string, c: ReturnType<typeof cover>) => `| ${label} | ${int(c.n)} | ${pct(c.q / c.n)} | ${pct(c.ru / c.n)} | ${pct(c.en / c.n)} | ${pct(c.both / c.n)} | ${pct(c.any / c.n)} |`;
const byKind = (pool: Set<string>) => ['фильмы (tmdb:)', 'сериалы и прочее (imdb:)'].map((kd) => coverRow(`  ${kd}`, cover([...pool].filter((k) => kindOf(k) === kd))));
const viewsZero = (lang: Lang) => first.filter((k) => pvOf.get(k)![lang === 'ru' ? 'hasRu' : 'hasEn'] && !pvOf.get(k)![lang === 'ru' ? 'ru24' : 'en24']).length;
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };
const fetchedFull = [...fullPool].filter((k) => pvOf.get(k)!.fetched).length;
const md = [
  `# Просмотры Википедии как известность — ${new Date().toISOString().slice(0, 10)}`,
  '',
  `Собрано tools/build-pageviews.mts. Месяцы: ${MONTHS[0]}–${MONTHS.at(-1)}, «24 мес.» — с ${MONTHS[LAST24]}. Просмотры — люди (agent=user), все устройства.`,
  `Пул первой ленты (dump-frozen): ${int(firstPool.size)} ключей${unfetchedFirst ? `, без просмотров пока ${int(unfetchedFirst)}` : ''}; весь пул (dump-frozen-full): ${int(fullPool.size)}, просмотры собраны у ${int(fetchedFull)}.`,
  `Историй в сравнении: ${per.length}, любимых спрятанных ${totalLiked}, нелюбимых ${per.reduce((s, r) => s + r.disliked, 0)}, пул в среднем ${int(poolMean)}.`,
  '',
  '## Покрытие',
  '',
  '| | ключей | элемент Wikidata | статья ru | статья en | обе | хоть одна |', '|---|---|---|---|---|---|---|',
  coverRow('пул первой ленты', c1), ...byKind(firstPool), coverRow('весь пул', cAll), ...byKind(fullPool),
  '',
  `Статья есть, но за 24 месяца ни одного просмотра: ru ${viewsZero('ru')}, en ${viewsZero('en')}. Медиана просмотров за 24 мес. у тех, у кого статья есть: `
    + `ru ${int(median(first.filter((k) => pvOf.get(k)!.hasRu).map((k) => pvOf.get(k)!.ru24!)))}, en ${int(median(first.filter((k) => pvOf.get(k)!.hasEn).map((k) => pvOf.get(k)!.en24!)))}.`,
  '',
  // счётчик ведёт просмотры по названию: статью недавно переименовали — история осталась под старым именем (перенаправление),
  // и новое название видно только с даты переименования (23.10: «Белоснежка и семь гномов» — en 162 за 24 мес.)
  `Подозрение на переименование или чужую ссылку (у одного языка < 1 % от другого при ≥ 50 тыс. у другого): ${first.filter((k) => {
    const p = pvOf.get(k)!; return p.hasRu && p.hasEn && ((p.ru24! >= 5e4 && p.en24! < p.ru24! / 100) || (p.en24! >= 5e4 && p.ru24! < p.en24! / 100));
  }).length} фильмов — просмотры перенаправлений не суммируются.`,
  '',
  '## Корреляции (пул первой ленты)',
  '',
  'Пирсон на log10(1+x) / Спирмен. popular — наибольшее по выгрузкам (сколько людей из историй оценили, без самого человека); нет статьи — 0 просмотров.',
  'Отношение ru/en — только у фильмов с обеими статьями.',
  '',
  `| мера | ${Object.keys(targets).join(' | ')} |`, `|---|${Object.keys(targets).map(() => '---').join('|')}|`,
  ...corrRows,
  '',
  `ru и en между собой (у кого обе, ${int(both.length)}): Пирсон по log ${fNum(ruEn.p, 2)}, Спирмен ${fNum(ruEn.s, 2)}.`,
  `Только фильмы, которые хоть кто-то оценил (${int(seenKeys.length)}): Спирмен popular ~ ru ${fNum(spearman(seenKeys.map((k) => pvOf.get(k)!.ru24!), seenKeys.map((k) => popularMax.get(k)!)), 2)}, `
    + `~ en ${fNum(spearman(seenKeys.map((k) => pvOf.get(k)!.en24!), seenKeys.map((k) => popularMax.get(k)!)), 2)}, `
    + `~ ru/en ${fNum(spearman(seenKeys.filter((k) => pvOf.get(k)!.hasRu && pvOf.get(k)!.hasEn).map((k) => L(pvOf.get(k)!.ru24) - L(pvOf.get(k)!.en24)), seenKeys.filter((k) => pvOf.get(k)!.hasRu && pvOf.get(k)!.hasEn).map((k) => popularMax.get(k)!)), 2)}.`,
  '',
  '## Ранжирование пула: различение и попадания',
  '',
  'AUC — любимое спрятанное выше нелюбимого (верх/низ 30 %), по всем парам (вес истории = любимых × нелюбимых); «чистый» — ничьи по ½, «с разводкой» — ничьи разведены моделью (столбец full), как в taste-eval.',
  'Попадание@K — доля любимых спрятанных в первых K пула (ничьи разведены моделью). Случайно: ' + KS.map((K) => `@${K} ${pct(K / poolMean)}`).join(', ') + '.',
  '',
  `| порядок пула | AUC чистый | AUC с разводкой | AUC среднее по людям | ${KS.map((K) => `@${K}`).join(' | ')} |`, `|---|---|---|---|${KS.map(() => '---').join('|')}|`,
  ...Object.keys(methods).map((m) => `| ${m} | ${fNum(pooledAuc(m, 'pure'))} | ${fNum(pooledAuc(m, 'tie'))} | ${fNum(meanAuc(m))} | ${KS.map((_, i) => pct(micro(m, i))).join(' | ')} |`),
  '',
  '## Уровни известности по просмотрам',
  '',
  'Предложение: уровень L, если просмотров за 24 месяца в ru ≥ R или в en ≥ E (оба порога — на одном месте внутри своего языка; место подобрано так, чтобы доля уровня ≥ L в пуле первой ленты была как у нынешнего fame).',
  '',
  '| уровень | ru за 24 мес. ≥ | ≈ в месяц | en за 24 мес. ≥ | ≈ в месяц | доля ≥ уровня (сейчас fame) | доля ≥ уровня (по просмотрам) |', '|---|---|---|---|---|---|---|',
  ...LV.map((t) => `| ${t.level} | ${int(t.R)} | ${int(t.R / 24)} | ${int(t.E)} | ${int(t.E / 24)} | ${pct(share(t.level))} | ${pct(first.filter((k) => pvLevel(k) >= t.level).length / first.length)} |`),
  '',
  `Меняют уровень: ${int(changed.length)} из ${int(first.length)} (${pct(changed.length / first.length)}); на 2 и больше — ${int(changed.filter((k) => Math.abs((fameOf.get(k) ?? 0) - pvLevel(k)) >= 2).length)}.`,
  '',
  '| fame сейчас ↓ / по просмотрам → | 0 | 1 | 2 | 3 |', '|---|---|---|---|---|',
  ...trans.map((r, i) => `| ${i} | ${r.map(int).join(' | ')} |`),
  '',
  '### Примеры: были тихими, по просмотрам громкие (0 → 3)', '', ...ex(0, 3).map((x) => `- ${x}`),
  '', '### Были громкими, по просмотрам тихие (3 → 0)', '', ...ex(3, 0).map((x) => `- ${x}`),
  '', '### 3 → 1', '', ...ex(3, 1).map((x) => `- ${x}`),
  '', '### 1 → 3', '', ...ex(1, 3).map((x) => `- ${x}`),
  '',
  '## Время и данные',
  '',
  `Прогон: ${Math.round((Date.now() - T0) / 1000)} с${STATS ? ' (без сети, по кэшу)' : ''}. Отказов 429: ${refusals}.`,
  `- ${WD} — ключ → элемент Wikidata, число разделов, названия статей ru/en`,
  `- ${DIR}/monthly-ru.jsonl, monthly-en.jsonl — помесячные просмотры статьи с 2015-07 (строка на статью: t — название, v — месяцы, none — нет в счётчике)`,
  `- ${OUT} — ключ → [wikidata, ruTitle, enTitle, ru24, ruAll, en24, enAll, firstPool]`,
  '',
  'Повтор (кэш докачивает только новое): `npx tsx tools/build-pageviews.mts` (весь пул), `--first` — только первая лента, `--stats` — без сети.',
  '',
];
writeFileSync(REPORT, md.join('\n'));
console.error(`отчёт → ${REPORT} · ${Math.round((Date.now() - T0) / 1000)} с`);
