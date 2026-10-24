// Выгрузка для опыта «классификатор разметки на текстовом энкодере» (23.10, tools/markup-encoder.py): фильмы с черновой
// разметкой агентов (draftAnnotations + draftAnnotationsLinks) и то, что о них известно без разметки, — название, год,
// жанры, страны, длительность, режиссёр, известность и текст сюжета. Только чтение, без сети; ~15 с, до 1 ГБ памяти.
//   npx tsx tools/markup-encoder-export.mts [--out .cache/eval/markup-encoder/films.json]
// Текст — тот, что будет и у нового фильма (по порядку):
//   batch    — описание из пачки заходов 17–19 (.cache/markup/wave-1{7,8,9}/*.tsv) — ровно то, что видел разметчик;
//   wiki-ru  — «Сюжет» или вступление статьи русской Википедии из кэша .cache/wiki-plots/ (статья — из .cache/fame-wd.json);
//   wiki-guess — тот же кэш, статья подобрана по названию («X», «X (фильм)», «X (фильм, ГГГГ)», en: «X (film)» …);
//   summary / cmu — длинные пересказы (.cache/plot-summaries.json, .cache/cmu-summaries.json), обрезает уже Python;
//   blurb    — короткое описание карточки или src/mocks/filmBlurbs.ts.
// Режиссёр — workCredits (роль d, элемент Wikidata), иначе первое имя в creators карточки, иначе столбец пачки.
// Связи для групп (франшиза, цикл, сиквел, ремейк, экранизация) — src/mocks/workRelations.ts; склейку делает Python.
// Регистры здесь — правило по жанрам (tools/register-tags.mts), а не агенты: только для сравнения.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { worksIndex } from './works-index.mts';
import { draftAnnotations } from '../src/mocks/draftAnnotations.ts';
import { draftAnnotationsLinks } from '../src/mocks/draftAnnotationsLinks.ts';
import { filmGenres } from '../src/mocks/filmGenres.ts';
import { filmGenresFill, filmCountries } from '../src/mocks/filmGenresFill.ts';
import { filmBlurbs } from '../src/mocks/filmBlurbs.ts';
import { workCredits } from '../src/mocks/workCredits.ts';
import { workRegisters } from '../src/mocks/workRegisters.ts';
import { baseMedia } from '../src/mocks/baseMedia.ts';
import { relationEdges, relationNodes } from '../src/mocks/workRelations.ts';
import { isSeries } from '../src/lib/media.ts';

const arg = (k: string, d: string) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const OUT = arg('--out', '.cache/eval/markup-encoder/films.json');
const J = <T,>(p: string, d: T): T => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) as T : d);

type A = { ops: [string, number][]; level: number; barriers: string[]; warnings: string[]; niche: boolean; confidence: string; what: string };
const D: Record<string, A & { src: string }> = {};
for (const [k, a] of Object.entries(draftAnnotations as Record<string, A>)) D[k] = { ...a, src: 'base' };
for (const [k, a] of Object.entries(draftAnnotationsLinks as Record<string, A>)) D[k] ??= { ...a, src: 'links' };

// по памяти или по описанию: известно только для заходов 17–19
const byPlot = J<Record<string, string>>('.cache/markup/by-plot.json', {});
const waveBy = new Map<string, { by: string; wave: string }>();
const batch = new Map<string, { plot: string; director: string; fame?: number; orig: string }>();
for (const w of ['17', '18', '19']) {
  const dir = `.cache/markup/wave-${w}/`;
  if (!existsSync(dir)) continue;
  for (const f of readdirSync(dir)) {
    if (/^out-\d+\.json$/.test(f)) {
      try { for (const x of JSON.parse(readFileSync(dir + f, 'utf8'))) if (x?.key) waveBy.set(x.key, { by: x.by ?? '?', wave: w }); } catch { /* битый ответ */ }
    } else if (f.endsWith('.tsv')) {
      for (const l of readFileSync(dir + f, 'utf8').split('\n')) {
        const c = l.split('\t');
        if (c.length < 8 || !c[7]) continue;
        const m = /(\d+) раздел/.exec(c[6] ?? '');
        batch.set(c[0], { plot: c[7], director: c[5] ?? '', fame: m ? Number(m[1]) : undefined, orig: c[4] ?? '' });
      }
    }
  }
}

const cards = new Map<string, any[]>();
for (const x of worksIndex({ all: true })) {
  if (x.work.type === 'book' || isSeries(x.work)) continue;
  if (!(x.key in D)) continue;
  (cards.get(x.key) ?? cards.set(x.key, []).get(x.key)!).push(x.work);
}
const tmdbTags = J<Record<string, { genres?: string[] }>>('.cache/tmdb-tags.json', {});
const fameWd = J<Record<string, { links?: number; ru?: string }>>('.cache/fame-wd.json', {});
const plotSum = J<Record<string, { text?: string; lang?: string }>>('.cache/plot-summaries.json', {});
const cmu = J<Record<string, { text?: string }>>('.cache/cmu-summaries.json', {});
const sha = (s: string) => createHash('sha1').update(s).digest('hex');
const wikiPlot = (lang: string, t: string): string | undefined => {
  const f = `.cache/wiki-plots/${sha(`${lang}:${t}`)}.json`;
  if (!existsSync(f)) return undefined;
  try { return (JSON.parse(readFileSync(f, 'utf8')) as { t?: string }).t || undefined; } catch { return undefined; }
};
const qidOfCard = (c: any): string | undefined => c.externalIds?.wikidata ?? (/^[a-z]-wd(\d+)$/.exec(c.id)?.[1] ? `Q${/^[a-z]-wd(\d+)$/.exec(c.id)![1]}` : undefined);

const films: unknown[] = [];
const counts: Record<string, number> = {};
for (const [key, a] of Object.entries(D)) {
  const cs = cards.get(key) ?? [];
  const bp = batch.get(key);
  const title = cs.find((c) => c.title)?.title ?? '';
  const orig = cs.find((c) => c.originalTitle)?.originalTitle ?? bp?.orig ?? '';
  const year = cs.find((c) => c.year)?.year ?? 0;
  const qid = cs.map(qidOfCard).find(Boolean) ?? (key.startsWith('wd:') ? key.slice(3) : undefined);
  const tmdbN = key.startsWith('tmdb:') ? key.slice(5) : undefined;
  const genres: string[] = filmGenres[key] ?? filmGenresFill[key] ?? (tmdbN ? tmdbTags[tmdbN]?.genres : undefined) ?? [];
  const countries: string[] = cs.find((c) => c.countries?.length)?.countries ?? filmCountries[key] ?? [];
  const dur = cs.map((c) => c.durationMinutes ?? baseMedia[c.id]?.durationMinutes).find((x) => x) ?? 0;
  const cred = (workCredits[key] ?? '').split(',').filter(Boolean).map((s) => s.split(':'));
  const directors = cred.filter((x) => x[1] === 'd').map((x) => x[0]);
  const writers = cred.filter((x) => x[1] === 'w').map((x) => x[0]);
  const creatorName = cs.find((c) => c.creators?.length)?.creators?.[0] ?? bp?.director ?? '';
  const fame = (qid ? fameWd[qid]?.links : undefined) ?? bp?.fame ?? null;
  // текст по порядку источников
  let text = ''; let textSrc = '';
  const ruArt = qid ? fameWd[qid]?.ru : undefined;
  if (bp?.plot) { text = bp.plot; textSrc = 'batch'; }
  if (!text && ruArt) { const t = wikiPlot('ru', ruArt); if (t) { text = t; textSrc = 'wiki-ru'; } }
  if (!text && title) for (const s of ['', ' (фильм)', ` (фильм, ${year})`, ' (мультфильм)']) { const t = wikiPlot('ru', title + s); if (t) { text = t; textSrc = 'wiki-guess'; break; } }
  if (!text && orig) for (const s of ['', ' (film)', ` (${year} film)`]) { const t = wikiPlot('en', orig + s); if (t) { text = t; textSrc = 'wiki-guess'; break; } }
  if (!text && plotSum[key]?.text) { text = plotSum[key].text!; textSrc = 'summary'; }
  if (!text && cmu[key]?.text) { text = cmu[key].text!; textSrc = 'cmu'; }
  if (!text) { const b = cs.find((c) => c.blurb)?.blurb ?? (qid ? filmBlurbs[`wd:${qid}`]?.ru?.t : undefined) ?? filmBlurbs[key]?.ru?.t; if (b) { text = b; textSrc = 'blurb'; } }
  const registers = [...new Set(cs.flatMap((c) => [...(c.registers ?? []), ...(workRegisters[c.id] ?? []), ...((baseMedia[c.id]?.registers as string[] | undefined) ?? [])]))];
  counts[textSrc || 'нет'] = (counts[textSrc || 'нет'] ?? 0) + 1;
  films.push({
    key, card: cs.length > 0, title, orig, year, genres, countries, dur, qid: qid ?? null, directors, writers, creatorName, fame,
    text, textSrc, registers,
    label: { level: a.level, ops: a.ops, warnings: a.warnings, barriers: a.barriers, niche: a.niche, confidence: a.confidence, src: a.src,
      by: waveBy.get(key)?.by ?? (key in byPlot ? 'plot' : null), wave: waveBy.get(key)?.wave ?? byPlot[key] ?? null },
  });
}
// связи — только нужных видов; узлы без нашего ключа тоже нужны (цикл, франшиза, книга-первоисточник)
const edges = (relationEdges as [string, string, string][]).filter((e) => e[1] !== 'adaptation_of' || relationNodes[e[2]]?.k !== 'other');
const nodeKind = Object.fromEntries(Object.entries(relationNodes as Record<string, { k: string; key?: string }>).map(([q, n]) => [q, n.k]));
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify({ at: new Date().toISOString(), by: 'tools/markup-encoder-export.mts', films, edges, nodeKind }));
console.error(`фильмов ${films.length}, с карточкой ${films.filter((f: any) => f.card).length}; текст: ${JSON.stringify(counts)}; связей ${edges.length} → ${OUT}`);
