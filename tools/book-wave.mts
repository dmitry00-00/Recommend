// Заходы черновой разметки книг (З4, 14.10) — как tools/markup-wave.mts у фильмов: очередь пачками и слияние ответов.
//   npx tsx tools/book-wave.mts queue <заход> [--size 60] [--limit N]
//   npx tsx tools/book-wave.mts merge <заход> [--dry]
// Очереди и ответы — в .cache/markup/book-wave-<заход>/; правила для разметчика — tools/book-wave.spec.md.
//
// queue — все книги bookBase с ключом Wikidata без разметки: без калибровки владельца (bookAnnotations, по ключу и
// по названию), черновика (bookDrafts), отклонённого куратором черновика и того, что разметчики уже пропускали
// (.cache/markup/book-offered.json). Порядок — по числу разделов Википедии. К строке — раздел «Сюжет» или
// вступление статьи (русской, если есть, иначе английской; кэш .cache/wiki-plots/ общий с фильмами), а нет статьи —
// вступление из bookBlurbs.
//
// merge — проверка ответов (ключ из очереди, словарь операций, книжных барьеров и предупреждений, уровень 1–10,
// строка 30–200 знаков) и дописывание разделом в конец bookDrafts.ts; уже размеченное не трогает. Пропущенное —
// в book-offered.json (второй раз не предлагается).
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { bookBase } from '../src/mocks/bookBase.ts';
import { bookDrafts } from '../src/mocks/bookDrafts.ts';
import { bookAnnotations } from '../src/mocks/bookAnnotations.ts';
import { bookBlurbs } from '../src/mocks/bookBlurbs.ts';
import { draftReview } from '../src/mocks/draftReview.ts';
import { BOOK_WAVE_BARRIERS } from './book-wave-barriers.mts';
import { heldWorks, withheldWorks } from '../src/mocks/withheldWorks.ts';

const argv = process.argv.slice(2);
const opt = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const [cmd, wave] = argv;
if (!['queue', 'merge'].includes(cmd) || !wave) { console.error('npx tsx tools/book-wave.mts queue|merge <заход>'); process.exit(1); }
const MARK = '.cache/markup/';
const DIR = `${MARK}book-wave-${wave}/`;
mkdirSync(DIR, { recursive: true });
const UA = 'recomend/0.1 (https://github.com/dmitry00-00/Recommend)';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const readJson = <T,>(p: string, d: T): T => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) as T : d);
const OFFERED = `${MARK}book-offered.json`;
const offered = readJson<Record<string, string>>(OFFERED, {});

type Item = { key: string; title: string; year: number; original?: string; authors: string[]; n?: number; lang?: string; art?: string; plot?: string };

if (cmd === 'queue') await queue(); else merge();

async function sparql(query: string): Promise<Record<string, { value: string }>[]> {
  for (let a = 0; a < 5; a++) {
    const r = await fetch('https://query.wikidata.org/sparql', {
      method: 'POST', body: new URLSearchParams({ query }),
      headers: { 'User-Agent': UA, Accept: 'application/sparql-results+json', 'Content-Type': 'application/x-www-form-urlencoded' },
    }).catch(() => undefined);
    const t = r?.ok ? await r.text() : '';
    try { return JSON.parse(t).results.bindings; } catch { await sleep(3000 * (a + 1)); }
  }
  throw new Error('wikidata: нет ответа');
}

/** «Сюжет» статьи, а нет — вступление; около 1200 знаков по концу предложения (как в markup-wave). */
function plotOf(text: string): string {
  const parts = text.split(/\n(?===+[^=\n]+=+\s*\n)/);
  const head = /^==+\s*(Сюжет|Содержание|Синопсис|Фабула|Описание сюжета|Plot|Synopsis|Premise|Summary|Plot summary)\s*==+/i;
  const plot = parts.find((p) => head.test(p.trim()))?.replace(head, '') ?? parts[0];
  const flat = plot.replace(/==+[^=\n]+==+/g, ' ').replace(/\s+/g, ' ').replace(/\t/g, ' ').trim();
  if (flat.length <= 1200) return flat;
  const cut = flat.slice(0, 1200);
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  return end > 400 ? cut.slice(0, end + 1) : `${cut.replace(/\s+\S*$/, '')}…`;
}

async function article(lang: string, title: string): Promise<string | undefined> {
  const file = `.cache/wiki-plots/${createHash('sha1').update(`${lang}:${title}`).digest('hex')}.json`;
  if (existsSync(file)) return (JSON.parse(readFileSync(file, 'utf8')) as { t?: string }).t;
  for (let a = 0; a < 4; a++) {
    const r = await fetch(`https://${lang}.wikipedia.org/w/api.php?${new URLSearchParams({ action: 'query', prop: 'extracts', explaintext: '1', redirects: '1', format: 'json', titles: title })}`,
      { headers: { 'User-Agent': UA } }).catch(() => undefined);
    if (r?.status === 429) { await sleep(5000 * (a + 1)); continue; }
    const j = r?.ok ? await r.json().catch(() => undefined) as { query?: { pages?: Record<string, { extract?: string }> } } | undefined : undefined;
    if (!j && a < 3) { await sleep(1500 * (a + 1)); continue; }
    const raw = Object.values(j?.query?.pages ?? {})[0]?.extract;
    const t = raw ? plotOf(raw.replace(/́/g, '')) : undefined;
    writeFileSync(file, JSON.stringify({ t }));
    return t;
  }
  return undefined;
}

async function queue() {
  const SIZE = Number(opt('--size') ?? 60);
  const LIMIT = Number(opt('--limit') ?? Infinity);
  mkdirSync('.cache/wiki-plots', { recursive: true });
  const t = (s?: string) => s?.toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const seen = new Set<string>();
  const todo: Item[] = [];
  for (const w of bookBase) {
    const qid = w.externalIds?.wikidata;
    if (!qid) continue;
    const key = `wd:${qid}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (bookDrafts[key] || bookAnnotations[key] || [w.title, w.originalTitle].some((x) => x && bookAnnotations[`t:${t(x)}`])) continue;
    if (draftReview[`draft:${key}`] || offered[key]) continue;
    // убранное и отложенное владельцем (16.10: не-книги, религиозные тексты, эзотерика, Ленин) — не размечаем
    if (key in withheldWorks || key in heldWorks) continue;
    todo.push({ key, title: w.title, year: w.year, original: w.originalTitle && w.originalTitle !== w.title ? w.originalTitle : undefined, authors: (w.creators ?? []).slice(0, 2) });
  }
  console.error(`книг без разметки: ${todo.length}`);
  for (let i = 0; i < todo.length; i += 200) {
    const part = new Map(todo.slice(i, i + 200).map((x) => [x.key.slice(3), x]));
    const rows = await sparql(`SELECT ?b ?n ?ru ?en WHERE { VALUES ?b { ${[...part.keys()].map((q) => `wd:${q}`).join(' ')} }
      ?b wikibase:sitelinks ?n.
      OPTIONAL { ?ra schema:about ?b; schema:isPartOf <https://ru.wikipedia.org/>; schema:name ?ru }
      OPTIONAL { ?ea schema:about ?b; schema:isPartOf <https://en.wikipedia.org/>; schema:name ?en } }`);
    for (const r of rows) {
      const x = part.get(r.b.value.replace(/^.*\//, ''));
      if (!x) continue;
      x.n = Math.max(x.n ?? 0, Number(r.n.value));
      if (!x.lang && r.ru) { x.lang = 'ru'; x.art = r.ru.value; } else if (!x.lang && r.en) { x.lang = 'en'; x.art = r.en.value; }
    }
    await sleep(500);
  }
  todo.sort((a, b) => (b.n ?? 0) - (a.n ?? 0) || a.title.localeCompare(b.title, 'ru'));
  const take = todo.slice(0, LIMIT);
  const need = take.filter((x) => x.art);
  for (let i = 0; i < need.length; i += 16) {
    await Promise.all(need.slice(i, i + 16).map(async (x) => { x.plot = await article(x.lang!, x.art!); }));
    if (i % 320 === 0) console.error(`  описания: ${i} из ${need.length}`);
  }
  // статьи нет или пустая — вступление из bookBlurbs
  for (const x of take) if (!x.plot || x.plot.length < 80) x.plot = bookBlurbs[x.key]?.ru?.t ?? bookBlurbs[x.key]?.en?.t ?? x.plot;
  const line = (x: Item) => [x.key, x.title, x.year || '', x.original ?? '', x.authors.join(', '), x.n ? `${x.n} разделов Википедии` : '', x.plot ?? '']
    .map((v) => String(v).replace(/[\t\n]+/g, ' ')).join('\t');
  const files: string[] = [];
  for (let i = 0, b = 0; i < take.length; i += SIZE) {
    const f = `batch-${++b}.tsv`;
    writeFileSync(DIR + f, take.slice(i, i + SIZE).map(line).join('\n') + '\n');
    files.push(`${f}\t${take.slice(i, i + SIZE).length}\tразделов ${take[i].n ?? 0}…${take[Math.min(i + SIZE, take.length) - 1].n ?? 0}`);
  }
  writeFileSync(DIR + 'queue.json', JSON.stringify(take.map(({ plot: _p, art: _a, ...x }) => x)));
  const withPlot = take.filter((x) => x.plot && x.plot.length >= 200).length;
  console.log(`в очереди ${take.length}; с описанием от 200 знаков ${withPlot}; без описания ${take.filter((x) => !x.plot).length}`);
  console.log(files.join('\n'));
}

function merge() {
  const DRY = argv.includes('--dry');
  const queue = readJson<Item[]>(DIR + 'queue.json', []);
  const byKey = new Map(queue.map((q) => [q.key, q]));
  const OPS = new Set(['pattern_recognition', 'causal_reasoning', 'perspective_taking', 'analogical_thinking', 'synthesis', 'abstraction', 'metacognition', 'critical_analysis']);
  const BARRIERS = new Set(BOOK_WAVE_BARRIERS);
  const WARNINGS = new Set(['Насилие', 'Жестокость', 'Хоррор-образы', 'Сексуальные сцены', 'Нецензурная лексика', 'Насилие над детьми', 'Физиологические сцены', 'Сексуальное насилие', 'Самоубийство', 'Наркотики', 'Алкоголь', 'Жестокость к животным', 'Самоповреждение']);
  type Row = { key: string; ops: [string, number][]; level: number; barriers: string[]; warnings: string[]; niche: boolean; confidence: string; by?: string; what: string };
  const rows: Row[] = [], bad: string[] = [];
  const done = new Set<string>();
  for (const f of readdirSync(DIR).filter((f) => /^out-\d+\.json$/.test(f)).sort((a, b) => Number(/\d+/.exec(a)![0]) - Number(/\d+/.exec(b)![0]))) {
    let got: Row[];
    try { got = JSON.parse(readFileSync(DIR + f, 'utf8')); } catch (e) { bad.push(`${f}: не JSON — ${(e as Error).message}`); continue; }
    for (const r of got) {
      const why = !byKey.has(r.key) ? 'ключа нет в очереди'
        : done.has(r.key) ? 'повтор'
        : bookDrafts[r.key] ? 'уже размечено'
        : r.key in withheldWorks || r.key in heldWorks ? 'убрано или отложено владельцем'
        : !Array.isArray(r.ops) || !r.ops.length || r.ops.length > 3 || r.ops.some(([o, v]) => !OPS.has(o) || !(v > 0 && v <= 1)) ? 'операции'
        : !(r.level >= 1 && r.level <= 10) ? 'уровень'
        : (r.barriers ?? []).some((x) => !BARRIERS.has(x)) ? `барьер ${(r.barriers ?? []).filter((x) => !BARRIERS.has(x)).join(', ')}`
        : (r.warnings ?? []).some((x) => !WARNINGS.has(x)) ? `предупреждение ${(r.warnings ?? []).filter((x) => !WARNINGS.has(x)).join(', ')}`
        : !['high', 'medium', 'low'].includes(r.confidence) ? 'уверенность'
        : typeof r.what !== 'string' || r.what.length < 30 || r.what.length > 200 ? 'строка what'
        : undefined;
      if (why) { bad.push(`${f} ${r.key}: ${why}`); continue; }
      if (r.by === 'plot' && r.confidence === 'high') r.confidence = 'medium';
      done.add(r.key);
      rows.push(r);
    }
  }
  const conf = ['high', 'medium', 'low'].map((c) => `${c} ${rows.filter((x) => x.confidence === c).length}`).join(', ');
  const plot = rows.filter((r) => r.by === 'plot').length;
  console.log(`книг ${rows.length} (${conf}); по описанию ${plot}; отброшено ${bad.length}`);
  for (const b of bad.slice(0, 40)) console.log(`  ✗ ${b}`);
  const skipped = queue.filter((q) => !done.has(q.key));
  console.log(`не размечено из очереди: ${skipped.length}`);
  if (DRY || !rows.length) return;
  const str = (s: string) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  const entry = (r: Row) => {
    const q = byKey.get(r.key)!;
    return `  // ${q.title.replace(/\n/g, ' ')} (${q.year})\n  ${str(r.key)}: a(${JSON.stringify(r.ops.map(([o, v]) => [o, Math.round(v * 100) / 100])).replace(/"/g, "'")}, ${r.level}, ${JSON.stringify(r.barriers ?? []).replace(/"/g, "'")}, ${JSON.stringify(r.warnings ?? []).replace(/"/g, "'")}, ${Boolean(r.niche)}, '${r.confidence}',\n    ${str(r.what)}),`;
  };
  const file = 'src/mocks/bookDrafts.ts';
  const src = readFileSync(file, 'utf8');
  const at = src.lastIndexOf('\n};');
  if (at < 0) throw new Error(`${file}: не нашёл конец словаря`);
  const head = `\n  // ── З4, заход ${wave} (${new Date().toISOString().slice(0, 10)}, tools/book-wave.mts): ${rows.length} — bookBase без разметки по известности; по описанию из Википедии — ${plot}.`;
  writeFileSync(file, src.slice(0, at) + head + '\n' + rows.map(entry).join('\n') + src.slice(at));
  console.log(`→ ${file}: +${rows.length}`);
  writeFileSync(OFFERED, JSON.stringify({ ...offered, ...Object.fromEntries(skipped.map((q) => [q.key, wave])) }, null, 1));
  writeFileSync(DIR + 'skipped.json', JSON.stringify(skipped, null, 1));
  console.log(`пропущенное → ${OFFERED}`);
}
