// Почерк автора агентами (14.10): режиссёры, создатели сериалов и писатели (роли d, c, a в workCredits) — типичный
// диапазон уровня, фирменные операции и барьеры, одна строка «что его вещи делают со зрителем или читателем».
// Для страницы автора (/person/:id) и подбора «по автору».
//   npx tsx tools/person-wave.mts queue <заход> [--size 60] [--limit N]
//   npx tsx tools/person-wave.mts merge <заход> [--dry]
// Очереди и ответы — .cache/markup/person-wave-<заход>/; правила — tools/person-wave.spec.md; итог —
// src/mocks/personStyles.ts (грузится лениво, вместе с peopleInfo). К строке человека — его произведения у нас с
// уровнем и строкой разметки: по ним агент видит почерк и тогда, когда сам человека не знает (`by: works`).
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { worksIndex } from './works-index.mts';
import { workCredits } from './credits-all.mts';
import { people } from './credits-all.mts';
import { peopleInfo } from '../src/mocks/peopleInfo.ts';
import { draftAnnotations } from './draft-annotations.mts';
import { seriesAnnotations } from './series-annotations.mts';
import { bookDrafts } from '../src/mocks/bookDrafts.ts';
import { isSeries } from '../src/lib/media.ts';
import { BOOK_WAVE_BARRIERS } from './book-wave-barriers.mts';
import { readJson, sitelinks, tsv } from './wave-lib.mts';

const argv = process.argv.slice(2);
const opt = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const [cmd, wave] = argv;
if (!['queue', 'merge'].includes(cmd) || !wave) { console.error('npx tsx tools/person-wave.mts queue|merge <заход>'); process.exit(1); }
const MARK = '.cache/markup/';
const DIR = `${MARK}person-wave-${wave}/`;
const FILE = 'src/mocks/personStyles.ts';
mkdirSync(DIR, { recursive: true });
const OFFERED = `${MARK}person-offered.json`;
const offered = readJson<Record<string, string>>(OFFERED, {});

export type StyleRecord = { lo: number; hi: number; ops: [string, number][]; barriers: string[]; what: string; confidence: 'high' | 'medium' | 'low'; by: 'memory' | 'works' };
const current = (): Record<string, StyleRecord> => {
  if (!existsSync(FILE)) return {};
  const m = /export const personStyles: Record<string, PersonStyle> = (\{[\s\S]*\});\s*$/.exec(readFileSync(FILE, 'utf8'));
  return m ? JSON.parse(m[1]) : {};
};
const have = current();

type Item = { id: string; name: string; original?: string; about?: string; years?: string; roles: string; works: string[]; n?: number; lang?: string; art?: string };
/** Не больше `n` произведений — равномерно по годам: у Чаплина первые 14 по году — одни короткометражки 1914–1915. */
const spread = <T,>(xs: T[], n: number): T[] => (xs.length <= n ? xs : Array.from({ length: n }, (_, i) => xs[Math.round((i * (xs.length - 1)) / (n - 1))]));
const ROLE: Record<string, string> = { d: 'режиссёр', c: 'создатель сериала', a: 'автор книги' };

if (cmd === 'queue') await queue(); else merge();

async function queue() {
  const SIZE = Number(opt('--size') ?? 60);
  const LIMIT = Number(opt('--limit') ?? Infinity);
  const index = new Map(worksIndex({ all: true }).map((x) => [x.key, x.work]));
  const byPerson = new Map<string, { roles: Set<string>; keys: Set<string> }>();
  for (const [key, line] of Object.entries(workCredits)) {
    for (const part of line.split(',')) {
      const [q, role] = part.split(':');
      if (!/^Q\d+$/.test(q) || !/^[dca]$/.test(role ?? '')) continue;
      const p = byPerson.get(q) ?? byPerson.set(q, { roles: new Set(), keys: new Set() }).get(q)!;
      p.roles.add(role);
      p.keys.add(key);
    }
  }
  const todo: Item[] = [];
  for (const [q, p] of byPerson) {
    // главные авторы — те, у кого есть страница (peopleInfo): режиссёры отдельных серий сериалов сюда не идут
    if (have[q] || offered[q] || !people[q] || !peopleInfo[q]) continue;
    const works = [...p.keys].map((k) => {
      const w = index.get(k);
      if (!w) return undefined;
      const a = draftAnnotations[k] ?? seriesAnnotations[k] ?? bookDrafts[k];
      const level = w.complexityLevel || a?.level;
      const kind = w.type === 'book' ? 'книга' : isSeries(w) ? 'сериал' : 'фильм';
      const what = a && a.confidence !== 'low' ? a.what : undefined;
      return { y: w.year ?? 0, s: `${w.title}${w.year ? ` (${w.year})` : ''}, ${kind}${level ? `, ур. ${level}` : ''}${what ? `: ${what}` : ''}` };
    }).filter((x): x is { y: number; s: string } => Boolean(x)).sort((a, b) => a.y - b.y).map((x) => x.s);
    if (!works.length) continue;
    const info = peopleInfo[q];
    todo.push({ id: q, name: people[q].name, original: people[q].originalName, about: info?.d,
      years: info?.b ? `${info.b}–${info.x ?? ''}` : undefined, roles: [...p.roles].map((r) => ROLE[r]).join(', '), works: spread(works, 14) });
  }
  console.error(`авторов с произведениями у нас: ${todo.length}`);
  await sitelinks(new Map(todo.map((x) => [x.id, x])));
  // сначала известные в мире, при равенстве — у кого больше произведений у нас
  todo.sort((a, b) => (b.n ?? 0) - (a.n ?? 0) || b.works.length - a.works.length);
  const take = todo.slice(0, LIMIT);
  const line = (x: Item) => tsv([x.id, x.name, x.original, x.roles, x.years, x.about, x.n ? `${x.n} разделов Википедии` : '', x.works.join(' | ')]);
  const files: string[] = [];
  for (let i = 0, b = 0; i < take.length; i += SIZE) {
    const f = `batch-${++b}.tsv`;
    writeFileSync(DIR + f, take.slice(i, i + SIZE).map(line).join('\n') + '\n');
    files.push(f);
  }
  writeFileSync(DIR + 'queue.json', JSON.stringify(take.map(({ works: _w, art: _a, lang: _l, ...x }) => x)));
  console.log(`в очереди ${take.length}; пачек ${files.length}`);
}

function merge() {
  const DRY = argv.includes('--dry');
  const queue = readJson<Item[]>(DIR + 'queue.json', []);
  const byId = new Map(queue.map((q) => [q.id, q]));
  const OPS = new Set(['pattern_recognition', 'causal_reasoning', 'perspective_taking', 'analogical_thinking', 'synthesis', 'abstraction', 'metacognition', 'critical_analysis']);
  const BARRIERS = new Set([...BOOK_WAVE_BARRIERS, 'Медленный темп', 'Сатирическая условность', 'Хоррор-образы', 'Нелинейное время', 'Размытая граница реальности', 'Без сюжета в привычном смысле', 'Долгий хронометраж', 'Разговорная форма', 'Нарастающий дискомфорт', 'Фрагментарная структура', 'Одна комната', 'Театральная манера', 'Непривычная мифология', 'Мало слов', 'Много линий', 'Ненадёжный рассказчик', 'Условная актёрская манера', 'Смена жанра', 'Смена рассказчиков без предупреждения', 'Найденная плёнка', 'Архаичная речь', 'Кукольная эстетика', 'Чёрно-белое изображение', 'Немое кино', 'Музыкальные номера']);
  type Row = { id: string; level: [number, number]; ops: [string, number][]; barriers?: string[]; what: string; confidence: string; by?: string };
  const got: Record<string, StyleRecord> = {}, bad: string[] = [];
  for (const f of readdirSync(DIR).filter((f) => /^out-\d+\.json$/.test(f))) {
    let rows: Row[];
    try { rows = JSON.parse(readFileSync(DIR + f, 'utf8')); } catch (e) { bad.push(`${f}: не JSON — ${(e as Error).message}`); continue; }
    for (const r of rows) {
      const [lo, hi] = Array.isArray(r.level) ? r.level : [NaN, NaN];
      const why = !byId.has(r.id) ? 'нет в очереди' : got[r.id] ? 'повтор' : have[r.id] ? 'уже размечен'
        : !(lo >= 1 && hi <= 10 && lo <= hi) ? 'уровень'
        : !Array.isArray(r.ops) || !r.ops.length || r.ops.length > 3 || r.ops.some(([o, v]) => !OPS.has(o) || !(v > 0 && v <= 1)) ? 'операции'
        : (r.barriers ?? []).some((x) => !BARRIERS.has(x)) ? `барьер ${(r.barriers ?? []).filter((x) => !BARRIERS.has(x)).join(', ')}`
        : !['high', 'medium', 'low'].includes(r.confidence) ? 'уверенность'
        : typeof r.what !== 'string' || r.what.length < 30 || r.what.length > 220 ? 'строка what'
        : undefined;
      if (why) { bad.push(`${f} ${r.id}: ${why}`); continue; }
      const by = r.by === 'works' ? 'works' : 'memory';
      got[r.id] = { lo, hi, ops: r.ops.map(([o, v]) => [o, Math.round(v * 100) / 100]), barriers: r.barriers ?? [], what: r.what.trim(),
        confidence: (by === 'works' && r.confidence === 'high' ? 'medium' : r.confidence) as StyleRecord['confidence'], by };
    }
  }
  const all = Object.values(got);
  console.log(`авторов ${all.length} (${['high', 'medium', 'low'].map((c) => `${c} ${all.filter((x) => x.confidence === c).length}`).join(', ')}); по произведениям ${all.filter((x) => x.by === 'works').length}; отброшено ${bad.length}`);
  for (const b of bad.slice(0, 40)) console.log(`  ✗ ${b}`);
  const skipped = queue.filter((q) => !got[q.id]);
  console.log(`не размечено из очереди: ${skipped.length}`);
  if (DRY) return;
  const merged = { ...have, ...got };
  writeFileSync(FILE, `// Сгенерировано tools/person-wave.mts — руками не править. Почерк автора (элемент Wikidata): диапазон уровня его вещей,
// фирменные операции и барьеры, строка «что его вещи делают со зрителем». Черновики агентов (14.10), как черновики
// разметки произведений: by — memory (знает автора) или works (вывел из наших произведений). Грузится лениво — странице автора.
import type { CognitiveOperation } from '@/types/tmdf';

export interface PersonStyle { lo: number; hi: number; ops: [CognitiveOperation, number][]; barriers: string[]; what: string; confidence: 'high' | 'medium' | 'low'; by: 'memory' | 'works' }

export const personStyles: Record<string, PersonStyle> = ${JSON.stringify(merged, null, 0).replace(/\},"/g, '},\n"')};
`);
  writeFileSync(OFFERED, JSON.stringify({ ...offered, ...Object.fromEntries(skipped.map((q) => [q.id, wave])) }, null, 1));
  console.log(`→ ${FILE}: ${Object.keys(merged).length}`);
}
