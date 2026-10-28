// Желания героев агентами (14.10): все размеченные для подбора произведения (фильмы, сериалы, книги) — герои,
// их явное и подавленное желание, модель желаний произведения (`CharacterDesire`, `DesireModel` в контракте).
//   npx tsx tools/desire-wave.mts queue <заход> [--size 60] [--limit N]
//   npx tsx tools/desire-wave.mts merge <заход> [--dry]
// Очереди и ответы — .cache/markup/desire-wave-<заход>/; правила разметчика — tools/desire-wave.spec.md.
// queue — порядок по числу разделов Википедии, к строке — «Сюжет» статьи (кэш .cache/wiki-plots/). Уже разобранное
// (src/mocks/desires/*.json) и пропущенное раньше (.cache/markup/desire-offered.json) второй раз не идёт.
// merge — проверка и раскладка по 64 кускам src/mocks/desires/NN.json (src/lib/desires.ts); приложение грузит кусок
// лениво на странице произведения.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { worksIndex } from './works-index.mts';
import { draftAnnotations } from './draft-annotations.mts';
import { seriesAnnotations } from './series-annotations.mts';
import { bookDrafts } from '../src/mocks/bookDrafts.ts';
import { bookAnnotations } from '../src/mocks/bookAnnotations.ts';
import { userAnnotations } from '../src/mocks/userAnnotations.ts';
import { userWorks } from '../src/mocks/userHistory.ts';
import { externalIds } from '../src/mocks/externalIds.ts';
import { draftReview } from '../src/mocks/draftReview.ts';
import { isHeldKey } from '../src/mocks/withheldWorks.ts';
import { isSeries } from '../src/lib/media.ts';
import { DESIRE_SHARDS, desireShard, type DesireRecord, type DesireTuple } from '../src/lib/desires.ts';
import { articles, qidsBy, readJson, sitelinks, tsv } from './wave-lib.mts';

const argv = process.argv.slice(2);
const opt = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const [cmd, wave] = argv;
if (!['queue', 'merge'].includes(cmd) || !wave) { console.error('npx tsx tools/desire-wave.mts queue|merge <заход>'); process.exit(1); }
const MARK = '.cache/markup/';
const DIR = `${MARK}desire-wave-${wave}/`;
const OUT = 'src/mocks/desires/';
mkdirSync(DIR, { recursive: true });
mkdirSync(OUT, { recursive: true });
const OFFERED = `${MARK}desire-offered.json`;
const offered = readJson<Record<string, string>>(OFFERED, {});

type Kind = 'film' | 'series' | 'book';
type Item = { key: string; type: Kind; title: string; year?: number; original?: string; creators: string[]; level?: number; n?: number; lang?: string; art?: string; plot?: string };

const shardFile = (s: string) => `${OUT}${s}.json`;
const loadShard = (s: string) => readJson<Record<string, DesireRecord>>(shardFile(s), {});
const have = new Set<string>();
for (let i = 0; i < DESIRE_SHARDS; i++) for (const k of Object.keys(loadShard(String(i).padStart(2, '0')))) have.add(k);

if (cmd === 'queue') await queue(); else merge();

async function queue() {
  const SIZE = Number(opt('--size') ?? 60);
  const LIMIT = Number(opt('--limit') ?? Infinity);
  const rejected = (id: string) => draftReview[id]?.status === 'rejected';
  const own = new Set<string>();
  for (const w of userWorks) { const t = (w.externalIds ?? externalIds[w.id])?.tmdb; if (t != null && userAnnotations[w.id]) own.add(`tmdb:${t}`); }
  const seen = new Set<string>();
  const todo: Item[] = [];
  for (const x of worksIndex({ all: true })) {
    if (seen.has(x.key) || have.has(x.key) || offered[x.key] || isHeldKey(x.key)) continue;
    seen.add(x.key);
    const w = x.work;
    const type: Kind = w.type === 'book' ? 'book' : isSeries(w) ? 'series' : 'film';
    // размечено для подбора, как в annotation-gap: разметка каталога, своя, черновик не ниже medium
    const a = type === 'book' ? (bookAnnotations[x.key] ?? (rejected(`draft:${x.key}`) ? undefined : bookDrafts[x.key]))
      : type === 'series' ? (rejected(`draft:${x.key}`) ? undefined : seriesAnnotations[x.key])
      : (rejected(`draft:${x.key}`) ? undefined : draftAnnotations[x.key]);
    const marked = (w.primaryOperations.length && w.complexityLevel) || own.has(x.key) || (a && a.confidence !== 'low');
    // own: — свои книги без Wikidata (27.10, tools/own-books.mts): описание — их `blurb`
    if (!marked || !/^(tmdb|imdb|wd|own):/.test(x.key)) continue;
    todo.push({ key: x.key, type, title: w.title, year: w.year || undefined, original: w.originalTitle && w.originalTitle !== w.title ? w.originalTitle : undefined,
      creators: (w.creators ?? []).slice(0, 2), level: w.complexityLevel || a?.level, ...(x.key.startsWith('own:') && w.blurb ? { plot: w.blurb } : {}) });
  }
  console.error(`размечено без желаний: ${todo.length} (фильмов ${todo.filter((x) => x.type === 'film').length}, сериалов ${todo.filter((x) => x.type === 'series').length}, книг ${todo.filter((x) => x.type === 'book').length})`);
  // элемент Wikidata: у книг — в ключе, у фильма — по TMDb, у сериала — по IMDb
  const films = await qidsBy('P4947', todo.filter((x) => x.key.startsWith('tmdb:')).map((x) => x.key.slice(5)));
  const shows = await qidsBy('P345', todo.filter((x) => x.key.startsWith('imdb:')).map((x) => x.key.slice(5)));
  const byQ = new Map<string, Item>();
  for (const x of todo) {
    const q = x.key.startsWith('wd:') ? x.key.slice(3) : x.key.startsWith('tmdb:') ? films.get(x.key.slice(5)) : shows.get(x.key.slice(5));
    if (q && !byQ.has(q)) byQ.set(q, x);
  }
  await sitelinks(byQ);
  todo.sort((a, b) => (b.n ?? 0) - (a.n ?? 0) || a.title.localeCompare(b.title, 'ru'));
  const take = todo.slice(0, LIMIT);
  await articles(take);
  const line = (x: Item) => tsv([x.key, x.type, x.title, x.year, x.original, x.creators.join(', '), x.level ? `уровень ${x.level}` : '', x.n ? `${x.n} разделов Википедии` : '', x.plot]);
  const files: string[] = [];
  for (let i = 0, b = 0; i < take.length; i += SIZE) {
    const f = `batch-${++b}.tsv`;
    writeFileSync(DIR + f, take.slice(i, i + SIZE).map(line).join('\n') + '\n');
    files.push(`${f}\t${take.slice(i, i + SIZE).length}\tразделов ${take[i].n ?? 0}…${take[Math.min(i + SIZE, take.length) - 1].n ?? 0}`);
  }
  writeFileSync(DIR + 'queue.json', JSON.stringify(take.map(({ plot: _p, art: _a, ...x }) => x)));
  console.log(`в очереди ${take.length}; пачек ${files.length}; с описанием от 200 знаков ${take.filter((x) => (x.plot ?? '').length >= 200).length}`);
  console.log(files.slice(0, 3).join('\n') + (files.length > 3 ? `\n… ${files.at(-1)}` : ''));
}

function merge() {
  const DRY = argv.includes('--dry');
  const queue = readJson<Item[]>(DIR + 'queue.json', []);
  const byKey = new Map(queue.map((q) => [q.key, q]));
  type Hero = { character: string; explicit: string; suppressed?: string; visibility: number; spoiler: number; confidence: string };
  type Row = { key: string; model: string; characters: Hero[]; by?: string };
  const MODELS = new Set(['goal_driven', 'diffuse', 'none']);
  const ok = (s: unknown, lo: number, hi: number) => typeof s === 'string' && s.trim().length >= lo && s.trim().length <= hi;
  const got = new Map<string, DesireRecord>(), bad: string[] = [];
  let heroes = 0, hidden = 0, byPlot = 0;
  for (const f of readdirSync(DIR).filter((f) => /^out-\d+\.json$/.test(f))) {
    let rows: Row[];
    try { rows = JSON.parse(readFileSync(DIR + f, 'utf8')); } catch (e) { bad.push(`${f}: не JSON — ${(e as Error).message}`); continue; }
    for (const r of rows) {
      const hs = Array.isArray(r.characters) ? r.characters : [];
      const why = !byKey.has(r.key) ? 'ключа нет в очереди' : got.has(r.key) ? 'повтор' : have.has(r.key) ? 'уже разобрано'
        : !MODELS.has(r.model) ? `модель ${r.model}`
        : r.model !== 'none' && !hs.length ? 'нет героев'
        : hs.length > 4 ? 'героев больше четырёх'
        : hs.find((h) => !ok(h.character, 1, 60) || !ok(h.explicit, 8, 140) || (h.suppressed != null && h.suppressed !== '' && !ok(h.suppressed, 8, 140))
          || ![0, 1, 2].includes(h.visibility) || ![0, 1, 2].includes(h.spoiler) || !['high', 'medium', 'low'].includes(h.confidence)) ? 'поля героя'
        : undefined;
      if (why) { bad.push(`${f} ${r.key}: ${why}`); continue; }
      const plot = r.by === 'plot';
      if (plot) byPlot++;
      got.set(r.key, {
        m: r.model as DesireRecord['m'],
        c: hs.map((h) => {
          const conf = plot && h.confidence === 'high' ? 'medium' : h.confidence;
          if (h.suppressed) hidden++;
          return [h.character.trim(), h.explicit.trim(), (h.suppressed ?? '').trim(), h.visibility, h.spoiler, conf[0]] as DesireTuple;
        }),
      });
      heroes += hs.length;
    }
  }
  const models = ['goal_driven', 'diffuse', 'none'].map((m) => `${m} ${[...got.values()].filter((r) => r.m === m).length}`).join(', ');
  console.log(`произведений ${got.size} (${models}); героев ${heroes}, с подавленным желанием ${hidden}; по описанию ${byPlot}; отброшено ${bad.length}`);
  for (const b of bad.slice(0, 40)) console.log(`  ✗ ${b}`);
  const skipped = queue.filter((q) => !got.has(q.key));
  console.log(`не разобрано из очереди: ${skipped.length}`);
  if (DRY) return;
  const shards = new Map<string, Record<string, DesireRecord>>();
  for (const [k, r] of got) {
    const s = desireShard(k);
    const cur = shards.get(s) ?? shards.set(s, loadShard(s)).get(s)!;
    cur[k] = r;
  }
  for (const [s, rec] of shards) writeFileSync(shardFile(s), JSON.stringify(rec));
  writeFileSync(OFFERED, JSON.stringify({ ...offered, ...Object.fromEntries(skipped.map((q) => [q.key, wave])) }, null, 1));
  writeFileSync(DIR + 'skipped.json', JSON.stringify(skipped, null, 1));
  console.log(`→ ${OUT}: ${shards.size} кусков; пропущенное → ${OFFERED}`);
}
