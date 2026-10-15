// Заходы черновой разметки справочника (ТВ-13, 13.10): очередь пачками и слияние ответов разметчиков.
//   npx tsx tools/markup-wave.mts queue <заход> [--size 60] [--limit N] [--calib 50 [--only-calib]]
//   npx tsx tools/markup-wave.mts merge <заход> [--dry]
// До 13.10 скрипты заходов жили во временной папке сессии и пропали вместе с ней — теперь здесь, а очереди и ответы —
// в .cache/markup/wave-<заход>/.
//
// queue — все фильмы и сериалы справочника без разметки: без своей разметки владельца, черновика, отклонённого
// куратором, убранного (withheldWorks) и отложенного владельцем (heldWorks; новое отложенное агентами копится в
// .cache/markup/gap-held-*.json до его решения), телепередач, карточек
// из каналов (их — после беты), новинок 2026 и того, что разметчики уже пропускали (.cache/markup/offered.json).
// Порядок — по числу разделов Википедии (известность в мире). К каждой строке — описание из Википедии: раздел
// «Сюжет» или вступление статьи, русской, если есть, иначе английской (кэш .cache/wiki-plots/). Так разметчик
// размечает и то, чего не знает сам (`by: plot`, уверенность не выше medium), — замер 12.10: в заходах 8–16
// пропущено ~750 советских и российских вещей «не знаю сюжета».
// --calib N — отдельная пачка calib.tsv: N советских фильмов, уже размеченных по памяти с уверенностью high, —
// разметить только по описанию и сравнить (уровень ±1, главная операция).
// Правила для разметчика — tools/markup-wave.spec.md. Ответ пачки — out-<n>.json.
//
// merge — проверка ответов (ключ из очереди, словарь операций, барьеров и предупреждений, уровень 1–10, строка
// 30–200 знаков) и дописывание разделом в конец draftAnnotations.ts / seriesAnnotations.ts (фильмы и сериалы из роста
// справочника — в draftAnnotationsLinks.ts / seriesAnnotationsWiki.ts, ленивые модули); уже размеченное не
// трогает. Размеченное по описанию — в .cache/markup/by-plot.json, пропущенное — в offered.json (второй раз не
// предлагается).
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { worksIndex } from './works-index.mts';
import { draftAnnotations } from './draft-annotations.mts';
import { seriesAnnotations } from './series-annotations.mts';
import { userAnnotations } from '../src/mocks/userAnnotations.ts';
import { userWorks } from '../src/mocks/userHistory.ts';
import { externalIds } from '../src/mocks/externalIds.ts';
import { draftReview } from '../src/mocks/draftReview.ts';
import { withheldWorks, heldWorks } from '../src/mocks/withheldWorks.ts';
import { tvPrograms } from '../src/mocks/tvPrograms.ts';
import { isSeries } from '../src/lib/media.ts';

const argv = process.argv.slice(2);
const opt = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const [cmd, wave] = argv;
if (!['queue', 'merge'].includes(cmd) || !wave) { console.error('npx tsx tools/markup-wave.mts queue|merge <заход>'); process.exit(1); }
const MARK = '.cache/markup/';
const DIR = `${MARK}wave-${wave}/`;
mkdirSync(DIR, { recursive: true });
const UA = 'recomend/0.1 (https://github.com/dmitry00-00/Recommend)';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const readJson = <T,>(p: string, d: T): T => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) as T : d);
const OFFERED = `${MARK}offered.json`;
const offered = readJson<Record<string, string>>(OFFERED, {});

type Item = { key: string; type: 'film' | 'series'; title: string; year: number; original?: string; creators: string[]; n?: number; lang?: string; plot?: string };

if (cmd === 'queue') await queue(); else await merge();

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

/** «Сюжет» статьи, а нет — вступление; около 1200 знаков по концу предложения. */
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
  const CALIB = Number(opt('--calib') ?? 0);
  mkdirSync('.cache/wiki-plots', { recursive: true });
  const own = new Set<string>();
  for (const w of userWorks) { const t = (w.externalIds ?? externalIds[w.id])?.tmdb; if (t != null && userAnnotations[w.id]) own.add(`tmdb:${t}`); }
  const held = new Set(readdirSync(MARK).filter((f) => /^gap-held-.*\.json$/.test(f)).flatMap((f) => readJson<{ key: string }[]>(MARK + f, []).map((h) => h.key)));
  const tv = new Set(tvPrograms as string[]);
  const seen = new Set<string>();
  const index = worksIndex({ all: true });
  const todo: Item[] = [];
  for (const w of index) {
    if (seen.has(w.key)) continue;
    seen.add(w.key);
    const work = w.work;
    if (work.type === 'book' || work.primaryOperations.length || draftAnnotations[w.key] || seriesAnnotations[w.key] || own.has(w.key)) continue;
    if (draftReview[`draft:${w.key}`] || w.key in withheldWorks || w.key in heldWorks || held.has(w.key) || offered[w.key] || tv.has(work.id) || w.minor) continue;
    if (!work.year || work.year >= 2026 || !/^(tmdb|imdb):/.test(w.key)) continue;
    todo.push({ key: w.key, type: isSeries(work) ? 'series' : 'film', title: work.title, year: work.year, original: work.originalTitle, creators: (work.creators ?? []).slice(0, 2) });
  }
  console.error(`без разметки: ${todo.length} (фильмов ${todo.filter((x) => x.type === 'film').length}, сериалов ${todo.filter((x) => x.type === 'series').length})`);

  // калибровка: советские фильмы, размеченные по памяти уверенно, — разметить по описанию и сравнить
  const calib: Item[] = [];
  if (CALIB) {
    const pool = index.filter((w) => draftAnnotations[w.key]?.confidence === 'high' && w.key.startsWith('tmdb:') && /[А-Яа-яЁё]/.test(w.work.title)
      && w.work.year && w.work.year < 1992 && w.work.year > 1930 && !w.work.primaryOperations.length);
    // советские — по стране производства в Wikidata (P495 — СССР): русское название есть у любого фильма
    const soviet = new Set<string>();
    for (let i = 0; i < pool.length; i += 300) {
      const rows = await sparql(`SELECT ?id WHERE { VALUES ?id { ${pool.slice(i, i + 300).map((w) => JSON.stringify(w.key.slice(5))).join(' ')} } ?f wdt:P4947 ?id; wdt:P495 wd:Q15180. }`);
      for (const r of rows) soviet.add(`tmdb:${r.id.value}`);
    }
    const sov = pool.filter((w) => soviet.has(w.key));
    const step = Math.max(1, Math.floor(sov.length / CALIB));
    for (let i = 0; i < sov.length && calib.length < CALIB; i += step) {
      const w = sov[i];
      calib.push({ key: w.key, type: 'film', title: w.work.title, year: w.work.year!, original: w.work.originalTitle, creators: (w.work.creators ?? []).slice(0, 2) });
    }
  }

  // известность и статьи: Wikidata по ключу TMDb (фильм) или IMDb (сериал)
  const all = [...todo, ...calib];
  for (const [prop, type] of [['P4947', 'film'], ['P345', 'series']] as const) {
    const xs = all.filter((x) => x.type === type);
    for (let i = 0; i < xs.length; i += 200) {
      const part = xs.slice(i, i + 200);
      const ids = new Map(part.map((x) => [x.key.slice(5), x]));
      const rows = await sparql(`SELECT ?id ?n ?ru ?en WHERE { VALUES ?id { ${[...ids.keys()].map((k) => JSON.stringify(k)).join(' ')} }
        ?f wdt:${prop} ?id; wikibase:sitelinks ?n.
        OPTIONAL { ?ra schema:about ?f; schema:isPartOf <https://ru.wikipedia.org/>; schema:name ?ru }
        OPTIONAL { ?ea schema:about ?f; schema:isPartOf <https://en.wikipedia.org/>; schema:name ?en } }`);
      for (const r of rows) {
        const x = ids.get(r.id.value);
        if (!x) continue;
        x.n = Math.max(x.n ?? 0, Number(r.n.value));
        if (!x.lang && r.ru) { x.lang = 'ru'; (x as Item & { art?: string }).art = r.ru.value; }
        else if (!x.lang && r.en) { x.lang = 'en'; (x as Item & { art?: string }).art = r.en.value; }
      }
      await sleep(500);
    }
  }
  const line = (x: Item) => [x.key, x.type, x.title, x.year, x.original ?? '', x.creators.join(', '), x.n ? `${x.n} разделов Википедии` : '', x.plot ?? '']
    .map((v) => String(v).replace(/[\t\n]+/g, ' ')).join('\t');
  todo.sort((a, b) => (b.n ?? 0) - (a.n ?? 0) || a.title.localeCompare(b.title, 'ru'));
  if (argv.includes('--only-calib')) {
    for (const x of calib) if ((x as Item & { art?: string }).art) x.plot = await article(x.lang!, (x as Item & { art?: string }).art!);
    writeFileSync(DIR + 'calib.tsv', calib.map(line).join('\n') + '\n');
    console.log(`калибровка: ${calib.length} → ${DIR}calib.tsv`);
    return;
  }
  const take = todo.slice(0, LIMIT);
  // описания — по 16 разом (Википедия отдаёт полный текст статьи по секунде-три)
  const need = [...take, ...calib].filter((x) => (x as Item & { art?: string }).art);
  for (let i = 0; i < need.length; i += 16) {
    await Promise.all(need.slice(i, i + 16).map(async (x) => { x.plot = await article(x.lang!, (x as Item & { art?: string }).art!); }));
    if (i % 320 === 0) console.error(`  описания: ${i} из ${need.length}`);
  }
  const files: string[] = [];
  let b = 0;
  for (const type of ['film', 'series'] as const) {
    const part = take.filter((x) => x.type === type);
    for (let i = 0; i < part.length; i += SIZE) {
      const f = `batch-${++b}.tsv`;
      writeFileSync(DIR + f, part.slice(i, i + SIZE).map(line).join('\n') + '\n');
      files.push(`${f}\t${type}\t${part.slice(i, i + SIZE).length}\tразделов ${part[i].n ?? 0}…${part[Math.min(i + SIZE, part.length) - 1].n ?? 0}`);
    }
  }
  if (calib.length) writeFileSync(DIR + 'calib.tsv', calib.map(line).join('\n') + '\n');
  writeFileSync(DIR + 'queue.json', JSON.stringify(take.map(({ plot: _p, ...x }) => x)));
  const withPlot = take.filter((x) => x.plot && x.plot.length >= 200).length;
  console.log(`в очереди ${take.length}: фильмов ${take.filter((x) => x.type === 'film').length}, сериалов ${take.filter((x) => x.type === 'series').length}; с описанием от 200 знаков ${withPlot}${calib.length ? `; калибровка ${calib.length}` : ''}`);
  console.log(files.join('\n'));
}

async function merge() {
  const DRY = argv.includes('--dry');
  const queue = readJson<Item[]>(DIR + 'queue.json', []);
  const byKey = new Map(queue.map((q) => [q.key, q]));
  const OPS = new Set(['pattern_recognition', 'causal_reasoning', 'perspective_taking', 'analogical_thinking', 'synthesis', 'abstraction', 'metacognition', 'critical_analysis']);
  const BARRIERS = new Set(['Медленный темп', 'Сатирическая условность', 'Хоррор-образы', 'Нелинейное время', 'Размытая граница реальности', 'Без сюжета в привычном смысле', 'Долгий хронометраж', 'Разговорная форма', 'Нарастающий дискомфорт', 'Фрагментарная структура', 'Одна комната', 'Театральная манера', 'Непривычная мифология', 'Мало слов', 'Много линий', 'Ненадёжный рассказчик', 'Условная актёрская манера', 'Смена жанра', 'Смена рассказчиков без предупреждения', 'Найденная плёнка', 'Архаичная речь', 'Кукольная эстетика', 'Чёрно-белое изображение', 'Немое кино', 'Музыкальные номера']);
  const WARNINGS = new Set(['Насилие', 'Жестокость', 'Хоррор-образы', 'Сексуальные сцены', 'Нецензурная лексика', 'Насилие над детьми', 'Физиологические сцены', 'Сексуальное насилие', 'Самоубийство', 'Наркотики', 'Алкоголь', 'Жестокость к животным', 'Самоповреждение']);
  type Row = { key: string; ops: [string, number][]; level: number; barriers: string[]; warnings: string[]; niche: boolean; confidence: string; by?: string; what: string };
  const films: Row[] = [], series: Row[] = [], bad: string[] = [];
  const done = new Set<string>();
  for (const f of readdirSync(DIR).filter((f) => /^out-\d+\.json$/.test(f)).sort((a, b) => Number(/\d+/.exec(a)![0]) - Number(/\d+/.exec(b)![0]))) {
    let rows: Row[];
    try { rows = JSON.parse(readFileSync(DIR + f, 'utf8')); } catch (e) { bad.push(`${f}: не JSON — ${(e as Error).message}`); continue; }
    for (const r of rows) {
      const q = byKey.get(r.key);
      const why = !q ? 'ключа нет в очереди'
        : done.has(r.key) ? 'повтор'
        : draftAnnotations[r.key] || seriesAnnotations[r.key] ? 'уже размечено'
        : !Array.isArray(r.ops) || !r.ops.length || r.ops.length > 3 || r.ops.some(([o, v]) => !OPS.has(o) || !(v > 0 && v <= 1)) ? 'операции'
        : !(r.level >= 1 && r.level <= 10) ? 'уровень'
        : (r.barriers ?? []).some((x) => !BARRIERS.has(x)) ? `барьер ${(r.barriers ?? []).filter((x) => !BARRIERS.has(x)).join(', ')}`
        : (r.warnings ?? []).some((x) => !WARNINGS.has(x)) ? `предупреждение ${(r.warnings ?? []).filter((x) => !WARNINGS.has(x)).join(', ')}`
        : !['high', 'medium', 'low'].includes(r.confidence) ? 'уверенность'
        : typeof r.what !== 'string' || r.what.length < 30 || r.what.length > 200 ? 'строка what'
        : undefined;
      if (why) { bad.push(`${f} ${r.key}: ${why}`); continue; }
      // по описанию — не выше medium
      if (r.by === 'plot' && r.confidence === 'high') r.confidence = 'medium';
      done.add(r.key);
      (q!.type === 'series' ? series : films).push(r);
    }
  }
  const conf = (xs: Row[]) => ['high', 'medium', 'low'].map((c) => `${c} ${xs.filter((x) => x.confidence === c).length}`).join(', ');
  const plot = [...films, ...series].filter((r) => r.by === 'plot');
  console.log(`фильмов ${films.length} (${conf(films)}), сериалов ${series.length} (${conf(series)}); по описанию ${plot.length}; отброшено ${bad.length}`);
  for (const b of bad.slice(0, 30)) console.log(`  ✗ ${b}`);
  const skipped = queue.filter((q) => !done.has(q.key));
  console.log(`не размечено из очереди: ${skipped.length}`);
  if (DRY) return;
  const str = (s: string) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  const entry = (r: Row) => {
    const q = byKey.get(r.key)!;
    return `  // ${q.title.replace(/\n/g, ' ')} (${q.year})\n  ${str(r.key)}: a(${JSON.stringify(r.ops.map(([o, v]) => [o, Math.round(v * 100) / 100])).replace(/"/g, "'")}, ${r.level}, ${JSON.stringify(r.barriers ?? []).replace(/"/g, "'")}, ${JSON.stringify(r.warnings ?? []).replace(/"/g, "'")}, ${Boolean(r.niche)}, '${r.confidence}',\n    ${str(r.what)}),`;
  };
  const date = new Date().toISOString().slice(0, 10);
  // фильмы и сериалы из роста справочника (РР-4, РР-5) — в ленивые модули разметки рядом с их карточками: в
  // draftAnnotations.ts / seriesAnnotations.ts (первая загрузка) они ломают бюджет сборки
  const keysOf = async (mod: string, name: string, id: 'tmdb' | 'imdb') => {
    const url = new URL(`../src/mocks/${mod}.ts`, import.meta.url);
    if (!existsSync(url)) return new Set<string>();
    const ws = (await import(url.href))[name] as { externalIds?: { tmdb?: number; imdb?: string } }[];
    return new Set(ws.flatMap((w) => (w.externalIds?.[id] != null ? [`${id}:${w.externalIds[id]}`] : [])));
  };
  const filmLinks = await keysOf('filmBaseLinks', 'filmBaseLinks', 'tmdb');
  const seriesWiki = await keysOf('seriesBaseWiki', 'seriesBaseWiki', 'imdb');
  const targets: [string, Row[]][] = [
    ['src/mocks/draftAnnotations.ts', films.filter((r) => !filmLinks.has(r.key))],
    ['src/mocks/draftAnnotationsLinks.ts', films.filter((r) => filmLinks.has(r.key))],
    ['src/mocks/seriesAnnotations.ts', series.filter((r) => !seriesWiki.has(r.key))],
    ['src/mocks/seriesAnnotationsWiki.ts', series.filter((r) => seriesWiki.has(r.key))],
  ];
  for (const [file, rows] of targets) {
    if (!rows.length) continue;
    const src = readFileSync(file, 'utf8');
    // раздел — перед закрывающей скобкой словаря разметки (у seriesAnnotations после неё ещё функции)
    const at = file.endsWith('seriesAnnotations.ts') ? src.indexOf('\n};\n\n/** Разметка сезона') : src.lastIndexOf('\n};');
    if (at < 0) throw new Error(`${file}: не нашёл конец словаря`);
    const head = `\n  // ── ТВ-13, заход ${wave} (${date}, tools/markup-wave.mts): ${rows.length} — справочник без разметки по известности; по описанию из Википедии — ${rows.filter((r) => r.by === 'plot').length}.`;
    writeFileSync(file, src.slice(0, at) + head + '\n' + rows.map(entry).join('\n') + src.slice(at));
    console.log(`→ ${file}: +${rows.length}`);
  }
  const BY_PLOT = `${MARK}by-plot.json`;
  writeFileSync(BY_PLOT, JSON.stringify({ ...readJson<Record<string, string>>(BY_PLOT, {}), ...Object.fromEntries(plot.map((r) => [r.key, wave])) }, null, 1));
  writeFileSync(OFFERED, JSON.stringify({ ...offered, ...Object.fromEntries(skipped.map((q) => [q.key, wave])) }, null, 1));
  writeFileSync(DIR + 'skipped.json', JSON.stringify(skipped, null, 1));
  console.log(`по описанию → ${BY_PLOT}; пропущенное → ${OFFERED}`);
}
