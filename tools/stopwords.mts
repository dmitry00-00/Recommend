// Кандидаты в стоп-слова (02.10): какие слова заголовка чаще бывают в ошибочных привязках, чем в верных.
//   npx tsx tools/stopwords.mts      → .cache/stopword-candidates.json, итог — последней строкой
//
// Опознаватель прогоняется по роликам с вердиктом людей без стоп-слов. Привязка ошибочна, если человек
// выбрал другой фильм или «не фильм». Для каждого слова (и пары соседних слов) заголовка — сколько
// раз оно стояло в ошибочных и в верных привязках. Слова названий — выбранного опознавателем и
// верного по человеку — не считаются: иначе наверху оказались бы названия. Кандидат — от трёх ошибок и ошибочных больше половины; если почти все
// ошибки на одном канале — предлагается правило только для него. Уже решённое владельцем (принято
// или отклонено) не предлагается. Тут же — что сделал бы принятый список: сколько ошибок снимает и
// сколько верных привязок теряет.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { worksIndex } from './works-index.mts';
import { matchVideos } from './match-videos.mts';
import { readStop, stopMatcher, tokens } from './stopwords-lib.mts';
import { readRubrics, segments } from './rubrics.mts';
import { isBookKey } from '../src/lib/keys.ts';

const root = new URL('../', import.meta.url);
const read = <T,>(p: string, d: T): T => existsSync(new URL(p, root)) ? JSON.parse(readFileSync(new URL(p, root), 'utf8')) as T : d;
type V = { key: string | null; why?: string; from?: string; guess?: boolean };
const human = read<{ videos?: Record<string, V> }>('tools/markup-verdicts.json', {}).videos ?? {};
const videos = read<{ id: string; title: string; channel?: string; channelId?: string }[]>('.cache/youtube/videos.json', []);
const channels = read<Record<string, { medium?: string }>>('.cache/youtube/channels.json', {});
const ordinary = new Set<string>(read<{ names?: string[] }>('.cache/ordinary.json', {}).names ?? []);
const byId = new Map(videos.map((v) => [v.id, v]));
const all = worksIndex();
const ours = all.filter((w) => !isBookKey(w.key));
const namesOf = new Map(all.map((w) => [w.key, new Set(w.names.flatMap(tokens))]));

const truth = Object.entries(human).filter(([id, v]) => !v.guess && v.from !== 'desk' && byId.has(id) && (v.key || v.why));
const set = truth.map(([id]) => ({ ...byId.get(id)!, book: channels[byId.get(id)!.channelId ?? '']?.medium === 'book' }));
const got = matchVideos(set, ours, ordinary, { noStop: true });

interface Stat { wrong: number; right: number; ch: Map<string, number>; ex: string[] }
const stats = new Map<string, Stat>();
let wrongAll = 0, rightAll = 0;
const examples: { id: string; title: string; channel?: string; bad: boolean }[] = [];
for (const [id, v] of truth) {
  const g = got.get(id);
  if (!g) continue;
  const bad = g.key !== v.key;
  if (bad) wrongAll++; else rightAll++;
  const vid = byId.get(id)!;
  examples.push({ id, title: vid.title, channel: vid.channel, bad });
  // слова названий — и того, что выбрал опознаватель, и того, что выбрал человек: они про фильм, а не стоп
  const film = new Set([...(namesOf.get(g.key) ?? []), ...(v.key ? namesOf.get(v.key) ?? [] : [])]);
  const t = tokens(vid.title).filter((x) => !film.has(x) && x.length >= 3 && !/^\d+$/.test(x));
  const grams = new Set([...t, ...t.slice(1).map((x, i) => `${t[i]} ${x}`)]);
  for (const w of grams) {
    const s = stats.get(w) ?? { wrong: 0, right: 0, ch: new Map<string, number>(), ex: [] as string[] };
    if (bad) { s.wrong++; s.ch.set(vid.channel ?? '?', (s.ch.get(vid.channel ?? '?') ?? 0) + 1); if (s.ex.length < 4) s.ex.push(vid.title); } else s.right++;
    stats.set(w, s);
  }
}

// рубрики каналов (tools/rubrics.mts): исход привязок у роликов с рубрикой — кандидат «только канал»
const rubrics = readRubrics();
const rub = new Map<string, { wrong: number; right: number; ex: string[] }>();
for (const e of examples) {
  const set = new Set(rubrics[e.channel ?? ''] ?? []);
  if (!set.size) continue;
  for (const [, n] of segments(e.title)) {
    if (!set.has(n)) continue;
    const k = `${e.channel}|${n}`;
    const s = rub.get(k) ?? { wrong: 0, right: 0, ex: [] };
    if (e.bad) { s.wrong++; if (s.ex.length < 4) s.ex.push(e.title); } else s.right++;
    rub.set(k, s);
  }
}

const decided = new Set([...readStop().words, ...readStop().rejected].map((s) => `${s.w}|${s.channel ?? ''}`));
const base = wrongAll / Math.max(1, wrongAll + rightAll);
const cands = [...stats].filter(([, s]) => (s.wrong >= 3 && s.wrong > s.right) || (s.wrong >= 2 && s.right === 0))
  .map(([w, s]) => {
    const [topCh, topN] = [...s.ch].sort((a, b) => b[1] - a[1])[0] ?? ['', 0];
    const channel = topN / s.wrong >= 0.8 && s.ch.size === 1 ? topCh : undefined;
    return { w, wrong: s.wrong, right: s.right, rate: Math.round((s.wrong / (s.wrong + s.right)) * 100) / 100,
      lift: Math.round(((s.wrong + 0.5) / (s.wrong + s.right + 1) / Math.max(base, 0.01)) * 10) / 10, ...(channel ? { channel } : {}), examples: s.ex };
  })
  .filter((c) => !decided.has(`${c.w}|${c.channel ?? ''}`) && !decided.has(`${c.w}|`))
  .sort((a, b) => b.wrong * b.rate - a.wrong * a.rate)
  // пара слов, у которой то же число ошибок, что у её слова, — дубль: оставляем короткое
  .filter((c, _, arr) => !(c.w.includes(' ') && arr.some((o) => !o.w.includes(' ') && c.w.split(' ').includes(o.w) && o.wrong === c.wrong)))
  .slice(0, 60);
// рубрика как кандидат: фраза без чисел («киночай #n» → «киночай»), только для своего канала
for (const [k, s] of rub) {
  if (!((s.wrong >= 2 && s.wrong > s.right) || (s.wrong >= 3 && s.wrong >= s.right))) continue;
  const [channel, n] = [k.slice(0, k.indexOf('|')), k.slice(k.indexOf('|') + 1)];
  const w = tokens(n.replace(/#?n\b/g, ' ')).join(' ');
  if (!w || decided.has(`${w}|${channel}`) || decided.has(`${w}|`) || cands.some((c) => c.w === w)) continue;
  cands.push({ w, wrong: s.wrong, right: s.right, rate: Math.round((s.wrong / (s.wrong + s.right)) * 100) / 100, lift: 0, channel, examples: s.ex, rubric: true } as typeof cands[number]);
}

// что делает принятый список
const stop = stopMatcher();
let cut = 0, lost = 0;
for (const e of examples) if (stop(e.title, e.channel)) { if (e.bad) cut++; else lost++; }

mkdirSync(new URL('.cache/', root), { recursive: true });
writeFileSync(new URL('.cache/stopword-candidates.json', root), JSON.stringify({
  at: new Date().toISOString(), truth: truth.length, wrong: wrongAll, right: rightAll, effect: { cut, lost }, candidates: cands,
}, null, 1));
for (const c of cands.slice(0, 15)) console.error(`  ${c.w}${c.channel ? ` [${c.channel}]` : ''}: ошибок ${c.wrong}, верных ${c.right}`);
console.log(`стоп-слова: кандидатов ${cands.length}; принятые снимают ${cut} из ${wrongAll} ошибок, теряют ${lost} из ${rightAll} верных`);
