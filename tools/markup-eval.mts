// Замер на ручной разметке (02.10): насколько прав опознаватель по названию и насколько —
// модель. Шаг конвейера после сборки индекса: так регрессия видна в тот же прогон.
//   npx tsx tools/markup-eval.mts [--list]     --list — показать ошибки опознавателя
//
// Опознаватель (tools/match-videos.mts) прогоняется заново по роликам с вердиктом — индекс
// для этого не годится, в нём вердикты уже применены. Правда — вердикты людей без пометки
// «догадка» и не из пульта ссылок (там фильм часто взят из заметок по названию, без просмотра);
// вердикты вкладки «Проверка» — правда: человек смотрел на ролик.
//
// Модель (.cache/llm/labels.json) — на тех же роликах: согласна ли её главная работа с
// вердиктом, сколько ошибок опознавателя она бы поймала и сколько верных привязок оспорила
// зря. Виды ошибок — ещё и по спискам владельца (.cache/markup/errors-*.md, разделы
// «# не фильм / # не тот фильм / # несколько фильмов»).
//
// Итог — строкой в .cache/pipeline/eval.tsv (история) и последней строкой вывода (её
// показывает пульт).
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { worksIndex } from './works-index.mts';
import { matchVideos } from './match-videos.mts';
import { parsePaste } from './links-desk-lib.mts';
import { readLabels, resolver, suggest, type MarkupError } from './llm-lib.mts';
import { resolveAbout } from './about-lib.mts';
import { isBookKey } from '../src/lib/keys.ts';

const root = new URL('../', import.meta.url);
const read = <T,>(p: string, d: T): T => existsSync(new URL(p, root)) ? JSON.parse(readFileSync(new URL(p, root), 'utf8')) as T : d;
const LIST = process.argv.includes('--list');

type V = { key: string | null; film?: string; why?: string; from?: string; guess?: boolean; err?: MarkupError; also?: string[]; about?: string; aboutTitle?: string };
const human = read<{ videos?: Record<string, V> }>('tools/markup-verdicts.json', {}).videos ?? {};
const videos = read<{ id: string; title: string; channelId?: string; description?: string; tags?: string[] }[]>('.cache/youtube/videos.json', []);
const channels = read<Record<string, { medium?: string }>>('.cache/youtube/channels.json', {});
const ordinary = new Set<string>(read<{ names?: string[] }>('.cache/ordinary.json', {}).names ?? []);
const byId = new Map(videos.map((v) => [v.id, v]));
const ours = worksIndex().filter((w) => !isBookKey(w.key));
const label = new Map(worksIndex({ all: true }).map((w) => [w.key, `${w.work.title}${w.work.year ? ` (${w.work.year})` : ''}`]));

const truth = Object.entries(human).filter(([id, v]) => !v.guess && v.from !== 'desk' && byId.has(id) && (v.key || v.why === 'не про фильм'));
const set = truth.map(([id]) => ({ ...byId.get(id)!, book: channels[byId.get(id)!.channelId ?? '']?.medium === 'book' }));
const t0 = Date.now();
const got = matchVideos(set, ours, ordinary);

let ok = 0, wrong = 0, miss = 0, fp = 0, tn = 0;
const wrongs: string[] = [];
for (const [id, v] of truth) {
  const g = got.get(id)?.key;
  if (v.key) {
    if (g === v.key) ok++;
    else if (g) { wrong++; wrongs.push(`  ✗ ${id} ${byId.get(id)!.title} → ${label.get(g)} (верно ${v.film})`); }
    else miss++;
  } else if (g) { fp++; wrongs.push(`  ✗ ${id} ${byId.get(id)!.title} → ${label.get(g)} (не про фильм)`); } else tn++;
}

// профиль канала (02.10): совпадение вне фокуса канала уходит без улики — сколько из них ошибки
let offN = 0, offWrong = 0, inWrong = 0;
for (const [id, v] of truth) {
  const g = got.get(id);
  if (!g) continue;
  const bad = g.key !== v.key;
  if (g.offFocus) { offN++; if (bad) offWrong++; } else if (bad) inWrong++;
}
if (offN) console.log(`профиль канала: вне фокуса ${offN} привязок, из них ошибочных ${offWrong} (остальные ошибки — ${inWrong} — в фокусе или у каналов без фокуса)`);

// ─── модель ───────────────────────────────────────────────────────────────────
const labels = readLabels().items;
const resolve = resolver(worksIndex({ all: true }));
let n = 0, agree = 0, disagree = 0, unresolved = 0, notfilmOk = 0;
let caught = 0, errs = 0, falseAlarm = 0, oks = 0, gapFound = 0, gaps = 0;
for (const [id, v] of truth) {
  const lab = labels[`yt:${id}`];
  if (!lab) continue;
  n++;
  const r = lab.works[0] ? resolve(lab.works[0]) : undefined;
  if (!v.key) { if (lab.kind === 'other' || !lab.works.length) notfilmOk++; else disagree++; }
  else if (r?.key === v.key || lab.works.some((w) => resolve(w).key === v.key)) agree++;
  else if (r && !r.key) unresolved++;
  else disagree++;
  // как судья опознавателя: на его ошибках и на его верных привязках
  const g = got.get(id)?.key;
  const s = suggest(g, lab, resolve);
  const flagged = s.flag === 'wrong' || s.flag === 'notfilm' || s.flag === 'unknown';
  if (g && g !== v.key) { errs++; if (flagged || (s.flag === 'several' && v.key && s.also.every((a) => a.key !== v.key))) caught++; }
  if (g && g === v.key) { oks++; if (flagged) falseAlarm++; }
  if (!g && v.key) { gaps++; if (s.key === v.key) gapFound++; }
}

// виды ошибок — по спискам владельца и по вердиктам с «Ошибкой»
const cats = new Map<string, MarkupError>();
for (const f of existsSync(new URL('.cache/markup/', root)) ? readdirSync(new URL('.cache/markup/', root)) : []) {
  if (!/^errors-.*\.md$/.test(f)) continue;
  for (const p of parsePaste(readFileSync(new URL(`.cache/markup/${f}`, root), 'utf8')).videos) if (p.err) cats.set(p.id, p.err);
}
for (const [id, v] of Object.entries(human)) if (v.err) cats.set(id, v.err);
let catN = 0, catHit = 0;
const confusion = new Map<string, number>();
for (const [id, err] of cats) {
  const lab = labels[`yt:${id}`];
  if (!lab) continue;
  catN++;
  const s = suggest(human[id]?.key ?? 'tmdb:0', lab, resolve);   // опознаватель что-то привязал — иначе ошибки бы не было
  if (s.err === err) catHit++;
  const k = `${err} → ${s.err ?? 'нет'}`;
  confusion.set(k, (confusion.get(k) ?? 0) + 1);
}

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '—');
console.log(`опознаватель на ${truth.length} вердиктах (${Math.round((Date.now() - t0) / 1000)} с): верно ${ok}, не тот ${wrong}, пропущено ${miss}, лишних ${fp}, верно «не фильм» ${tn}`);
if (LIST) console.log(wrongs.join('\n'));
if (n) {
  console.log(`модель на ${n} из них: согласна ${agree} (${pct(agree, agree + disagree + unresolved)}), не согласна ${disagree}, не узнала в каталоге ${unresolved}, «не фильм» верно ${notfilmOk}`);
  console.log(`  как судья: ловит ${caught} из ${errs} ошибок опознавателя, зря спорит с ${falseAlarm} из ${oks} верных, находит ${gapFound} из ${gaps} пропусков`);
}
if (catN) {
  console.log(`  вид ошибки по спискам: угадан ${catHit} из ${catN} (${pct(catHit, catN)})`);
  for (const [k, c] of [...confusion].sort((a, b) => b[1] - a[1])) console.log(`    ${k}: ${c}`);
}

// ─── о франшизе и о человеке (категории владельца 02.10): решения людей против модели ───
let aboutN = 0, aboutKindOk = 0, aboutIdOk = 0, aboutWithId = 0;
for (const [id, v] of Object.entries(human)) {
  if (v.key || (v.why !== 'о франшизе' && v.why !== 'о человеке')) continue;
  const lab = labels[`yt:${id}`];
  if (!lab) continue;
  aboutN++;
  if (lab.kind !== (v.why === 'о франшизе' ? 'franchise' : 'person')) continue;
  aboutKindOk++;
  if (!v.about) continue;
  aboutWithId++;
  if (suggest(undefined, lab, resolve, { about: resolveAbout }).about?.id === v.about) aboutIdOk++;
}
if (aboutN) console.log(`о франшизе и о человеке: модель узнала вид в ${aboutKindOk} из ${aboutN}, цель — в ${aboutIdOk} из ${aboutWithId} (где цель у нас есть)`);
// темы без произведения (жанр, эпоха…): копим статистику для будущих жанров (02.10)
const topics = new Map<string, number>();
for (const l of Object.values(labels)) if (l.topic) { const k = `${l.topic.type ? `${l.topic.type}: ` : ''}${l.topic.name}`; topics.set(k, (topics.get(k) ?? 0) + 1); }
if (topics.size) console.log(`темы по модели (${[...topics.values()].reduce((a, b) => a + b, 0)} роликов): ${[...topics].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([k, n]) => `${k} ${n}`).join(', ')}`);

// ─── посты: индекс постов против модели (ручной разметки постов нет — только расхождения) ───
const postsSrc = existsSync(new URL('src/mocks/postsAuto.ts', root)) ? readFileSync(new URL('src/mocks/postsAuto.ts', root), 'utf8') : '';
const postsAuto = postsSrc ? JSON.parse(postsSrc.slice(postsSrc.indexOf('= {') + 2, postsSrc.lastIndexOf(';'))) as Record<string, { id: string }[]> : {};
const postFlags = new Map<string, number>();
let postsN = 0, postsAll = 0;
for (const [key, list] of Object.entries(postsAuto)) {
  for (const a of list) {
    postsAll++;
    const m = /^tg-(.+)-(\d+)$/.exec(a.id);
    const lab = m ? labels[`tg:${m[1].toLowerCase()}/${m[2]}`] : undefined;
    if (!lab) continue;
    postsN++;
    const f = suggest(key, lab, resolve).flag;
    postFlags.set(f, (postFlags.get(f) ?? 0) + 1);
  }
}
if (postsN) console.log(`посты индекса: модель разметила ${postsN} из ${postsAll} — ${[...postFlags].sort((a, b) => b[1] - a[1]).map(([f, c]) => `${f} ${c}`).join(', ')}`);

const dir = process.env.TM_PIPELINE_DIR ?? new URL('.cache/pipeline/', root).pathname;
mkdirSync(dir, { recursive: true });
const hist = `${dir.replace(/\/$/, '')}/eval.tsv`;
if (!existsSync(hist)) writeFileSync(hist, 'когда\tвердиктов\tверно\tне тот\tпропущено\tлишних\tмодель_n\tмодель_согласна\tловит\tошибок\tзря\tверных\n');
const prev = readFileSync(hist, 'utf8').trim().split('\n').slice(1).at(-1)?.split('\t');
appendFileSync(hist, `${new Date().toISOString().slice(0, 16)}\t${truth.length}\t${ok}\t${wrong}\t${miss}\t${fp}\t${n}\t${agree}\t${caught}\t${errs}\t${falseAlarm}\t${oks}\n`);
const delta = (now: number, i: number) => { const was = Number(prev?.[i]); return prev && Number.isFinite(was) && was !== now ? ` (${now - was > 0 ? '+' : ''}${now - was})` : ''; };
console.log(`замер: верно ${ok}${delta(ok, 2)} · не тот ${wrong}${delta(wrong, 3)} · пропущено ${miss}${delta(miss, 4)} из ${truth.length}${n ? ` · модель ловит ${caught}/${errs}, зря ${falseAlarm}/${oks}` : ''}`);
