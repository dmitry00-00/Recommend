// Черновая разметка новых фильмов списка первых оценок (трек Г4, 30.09).
//   npx tsx tools/draft-annotate.mts            — что ждёт разметки (список, без сети)
//   npx tsx tools/draft-annotate.mts --weighted [--min-weight 1]
//                                                — кто без разметки, а о нём говорят: по весу записей
//                                                  (tools/annotation-gap.mts), а не по списку первых оценок
//   npx tsx tools/draft-annotate.mts --run [--limit 40] [--dry]
//                                                — разметить через Anthropic API: ключ ANTHROPIC_API_KEY
//                                                  в .env.local, модель — ANTHROPIC_MODEL (по умолчанию
//                                                  та же, что у черновиков, draftAnnotationMeta.model)
//   npx tsx tools/draft-annotate.mts --emit DIR [--limit 82] [--weighted]
//                                                — без API (18.10): записать пачки по 20 в DIR — batch-N.txt
//                                                  (ровно то, что ушло бы модели: подсказка + «Разметь:» + JSON
//                                                  карточек) и batch-N.json (карточки отдельно); размечает агент
//                                                  или человек, ответ — тот же JSON-массив, что ждёт --run
//   npx tsx tools/draft-annotate.mts --apply FILE… [--weighted] [--model claude-code-agent] [--dry]
//                                                — без API (18.10): прочитать ответы, проверить теми же проверками,
//                                                  что ответ модели в --run, и дописать прошедшие тем же разделом;
//                                                  объект {key, skip: "почему"} — честный пропуск (фильм не знаю),
//                                                  он не пишется и считается отдельно от отброшенных
// Кто ждёт: фильмы из .cache/profile-deck.tsv (tools/profile-deck.mts — топ-300 и канон), у которых
// нет ни разметки, ни черновика, — новые профили и сборщик поднимают в топ новые фильмы. Отклонённые
// куратором (draftReview) тоже ждут: их черновик не используется.
// Как размечает: тем же способом, что первый и второй круг Г1 — по знанию фильма, без просмотра;
// шкала, словарь операций, барьеры и примеры берутся из уже размеченного. Ответ проверяется: неизвестная
// операция, интенсивность вне 0–1, уровень вне 1–10 — черновик отбрасывается. Прошедшие дописываются в
// src/mocks/draftAnnotations.ts отдельным разделом с датой; статус у всех — needs_review, дальше —
// подбор и петля (сигналы в кураторской).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadEnvFile } from './env-file.mts';
import { worksIndex } from './works-index.mts';
// 18.10: вместе с draftAnnotationsLinks.ts — иначе очередь видит размеченное в росте справочника как неразмеченное
import { draftAnnotations, draftAnnotationMeta } from './draft-annotations.mts';
import { draftReview } from '../src/mocks/draftReview.ts';
import type { FirstPassAnnotation } from '../src/mocks/userAnnotations.ts';
import type { CognitiveOperation, Confidence } from '../src/types/tmdf.ts';

loadEnvFile();
const argv = process.argv.slice(2);
const RUN = argv.includes('--run');
const DRY = argv.includes('--dry');
const LIMIT = Number(argv[argv.indexOf('--limit') + 1]) || 40;
const BATCH = 20;
// без API (18.10): --emit DIR и --apply FILE… (файлы — подряд до следующего флага)
const EMIT = argv.includes('--emit') ? argv[argv.indexOf('--emit') + 1] : undefined;
const APPLY: string[] = [];
if (argv.includes('--apply')) for (const x of argv.slice(argv.indexOf('--apply') + 1)) { if (x.startsWith('--')) break; APPLY.push(x); }
if (argv.includes('--emit') && (!EMIT || EMIT.startsWith('--'))) { console.error('--emit DIR: куда писать пачки'); process.exit(1); }
if (argv.includes('--apply') && !APPLY.length) { console.error('--apply FILE…: файлы ответов'); process.exit(1); }

const WEIGHTED = argv.includes('--weighted');
const MIN_WEIGHT = argv.includes('--min-weight') ? Number(argv[argv.indexOf('--min-weight') + 1]) : 1;
// фильм — `tmdb:`, без TMDb — `wd:` (решение владельца 17.10; 18.10): у книги тот же префикс, поэтому по виду карточки
const index = worksIndex({ all: true }).filter((w) => w.key.startsWith('tmdb:') || (w.key.startsWith('wd:') && w.work.type === 'film'));
const waiting = (w: (typeof index)[number]) => !draftAnnotations[w.key] || draftReview[`draft:${w.key}`]?.status === 'rejected';
let todo: typeof index;
if (WEIGHTED) {
  // 04.10: о ком говорят, а разметки нет — подбор их не видит вовсе (оценка 0 без уровня и операций)
  const { annotationGap } = await import('./annotation-gap.mts');
  const byKey = new Map(index.map((w) => [w.key, w]));
  todo = annotationGap().rows.filter((r) => r.kind === 'film' && r.weight >= MIN_WEIGHT)
    .map((r) => byKey.get(r.key)).filter((w): w is NonNullable<typeof w> => Boolean(w)).filter(waiting);
} else {
  const TSV = '.cache/profile-deck.tsv';
  if (!existsSync(TSV)) { console.error(`нет ${TSV} — сначала npx tsx tools/profile-deck.mts`); process.exit(1); }
  const rows = readFileSync(TSV, 'utf8').trim().split('\n').slice(1).map((l) => l.split('\t'));
  const byTitle = new Map(index.map((w) => [`${w.work.title}|${w.work.year}`, w]));
  todo = rows
    .filter((r) => r[8] !== 'да')
    .map((r) => byTitle.get(`${r[1]}|${r[2]}`))
    .filter((w): w is NonNullable<typeof w> => Boolean(w))
    .filter(waiting);
}
console.error(`ждут черновой разметки: ${todo.length}`);
for (const w of todo.slice(0, 60)) console.error(`  ${w.key}  ${w.work.title} (${w.work.year})${w.work.originalTitle ? ` / ${w.work.originalTitle}` : ''}`);
if (!(RUN || EMIT || APPLY.length) || !todo.length) process.exit(0);

const OPS: Record<CognitiveOperation, string> = {
  pattern_recognition: 'замечать повторы, рифмы и скрытую структуру',
  causal_reasoning: 'прослеживать, что к чему привело и почему',
  perspective_taking: 'удерживать несколько точек зрения на одно событие',
  analogical_thinking: 'переносить устройство одной истории на другую ситуацию',
  synthesis: 'связывать разрозненные фрагменты в общую картину',
  abstraction: 'видеть за частным случаем общую модель',
  metacognition: 'ловить, как ты сам интерпретируешь и где ошибаешься',
  critical_analysis: 'проверять допущения, аргументы и собственные выводы',
};
// словари барьеров и предупреждений — из уже размеченного, чтобы новые черновики говорили тем же языком
const all = Object.values(draftAnnotations);
const vocab = (pick: (a: FirstPassAnnotation) => string[]) => [...new Set(all.flatMap(pick))].sort();
const example = (k: string) => ({ key: k, ...draftAnnotations[k] });
const examples = ['tmdb:953', 'tmdb:120', 'tmdb:43680', 'tmdb:1398'].filter((k) => draftAnnotations[k]).map(example);

const system = `Ты размечаешь фильмы для рекомендательной платформы, которая подбирает кино под развитие способов мышления. Разметка — черновик по знанию фильма, без просмотра; её потом проверяют люди.
Для каждого фильма верни:
- ops: 1–4 когнитивные операции, которые фильм тренирует у зрителя, с интенсивностью 0.1–0.9. Операции: ${Object.entries(OPS).map(([k, v]) => `${k} — ${v}`).join('; ')}.
- level: сложность 1–10. Опоры: детское и чистый аттракцион 1, массовое развлечение 2–3, умное массовое 4, авторское с доступным входом 5–6, ненадёжный рассказчик и сложная форма 6–7, медленное авторское 7–8, 9–10 — редкие предельные случаи.
- barriers: барьеры формы (пусто, если нет). Предпочтительно из словаря: ${vocab((a) => a.barriers).join(', ')}.
- warnings: предупреждения о содержании. Предпочтительно из словаря: ${vocab((a) => a.warnings).join(', ')}.
- niche: true только для нишевого шедевра, который массовый зритель не знает.
- confidence: high — фильм знаешь хорошо; medium — в общих чертах; low — только по завязке или не знаешь.
- what: одна строка по-русски без спойлеров — что фильм делает с восприятием, в духе примеров.
Отвечай только JSON-массивом объектов {key, ops, level, barriers, warnings, niche, confidence, what}, без пояснений.
Примеры: ${JSON.stringify(examples)}`;

const isOp = (x: unknown): x is CognitiveOperation => typeof x === 'string' && x in OPS;
const isConf = (x: unknown): x is Confidence => x === 'low' || x === 'medium' || x === 'high';
function valid(o: Record<string, unknown>): FirstPassAnnotation | undefined {
  const ops = Array.isArray(o.ops) ? o.ops : [];
  if (!ops.length || ops.length > 4 || !ops.every((p) => Array.isArray(p) && isOp(p[0]) && typeof p[1] === 'number' && p[1] > 0 && p[1] < 1)) return undefined;
  if (typeof o.level !== 'number' || o.level < 1 || o.level > 10) return undefined;
  const strs = (x: unknown) => (Array.isArray(x) && x.every((s) => typeof s === 'string') ? x as string[] : undefined);
  const barriers = strs(o.barriers); const warnings = strs(o.warnings);
  if (!barriers || !warnings || typeof o.niche !== 'boolean' || !isConf(o.confidence) || typeof o.what !== 'string' || o.what.length < 10) return undefined;
  return { ops: ops.map((p) => [p[0], Math.round(p[1] * 10) / 10]) as [CognitiveOperation, number][], level: Math.round(o.level), barriers, warnings, niche: o.niche, confidence: o.confidence, what: o.what.trim() };
}

const filmsOf = (chunk: typeof todo) => chunk.map((w) => ({ key: w.key, title: w.work.title, original: w.work.originalTitle, year: w.work.year, creators: w.work.creators }));
const userPrompt = (chunk: typeof todo) => `Разметь:\n${JSON.stringify(filmsOf(chunk))}`;
const parseAnswer = (text: string): Record<string, unknown>[] | undefined => {
  try { const x = JSON.parse(text.slice(text.indexOf('['), text.lastIndexOf(']') + 1)); return Array.isArray(x) ? x : undefined; } catch { return undefined; }
};

const done: [string, FirstPassAnnotation, string][] = [];
const skipped: [string, string][] = [];
const dropped: string[] = [];
// общий приём ответа (18.10): и для --run, и для --apply — одни проверки; ключ должен ждать разметки (из `pool`),
// повтор ключа не принимается
function accept(parsed: Record<string, unknown>[], pool: typeof todo) {
  for (const o of parsed) {
    const w = pool.find((x) => x.key === o.key);
    if (w && typeof o.skip === 'string' && !('ops' in o)) { skipped.push([`${w.key}  ${w.work.title} (${w.work.year})`, o.skip]); continue; }
    const a = w && !done.some(([k]) => k === w.key) && valid(o);
    if (!w || !a) { dropped.push(String(o.key)); console.error(`  отброшено: ${String(o.key)}`); continue; }
    done.push([w.key, a, `${w.work.title} (${w.work.year})`]);
  }
}

const queue = todo.slice(0, LIMIT);
let model = process.env.ANTHROPIC_MODEL ?? draftAnnotationMeta.model;
if (EMIT) {
  mkdirSync(EMIT, { recursive: true });
  for (let i = 0; i < queue.length; i += BATCH) {
    const chunk = queue.slice(i, i + BATCH); const n = i / BATCH + 1;
    writeFileSync(join(EMIT, `batch-${n}.txt`), `${system}\n\n${userPrompt(chunk)}\n`);
    writeFileSync(join(EMIT, `batch-${n}.json`), `${JSON.stringify(filmsOf(chunk), null, 1)}\n`);
  }
  console.error(`→ ${EMIT}: ${Math.ceil(queue.length / BATCH)} пачек, ${queue.length} фильмов. Ответы — JSON-массив, затем --apply`);
  process.exit(0);
} else if (APPLY.length) {
  model = argv.includes('--model') ? argv[argv.indexOf('--model') + 1] : 'claude-code-agent';
  for (const f of APPLY) {
    const parsed = parseAnswer(readFileSync(f, 'utf8'));
    if (!parsed) { console.error(`  ${f}: не JSON-массив — файл пропущен`); continue; }
    accept(parsed, todo);
    console.error(`  ${f}: принято всего ${done.length}`);
  }
} else {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) { console.error('для --run нужен ANTHROPIC_API_KEY в .env.local'); process.exit(1); }
  for (let i = 0; i < queue.length; i += BATCH) {
    const chunk = queue.slice(i, i + BATCH);
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model, max_tokens: 8000, system, messages: [{ role: 'user', content: userPrompt(chunk) }] }),
    });
    if (!r.ok) { console.error(`  API ${r.status}: ${(await r.text()).slice(0, 300)}`); break; }
    const j = await r.json() as { content?: { type: string; text?: string }[] };
    const parsed = parseAnswer((j.content ?? []).filter((c) => c.type === 'text').map((c) => c.text).join(''));
    if (!parsed) { console.error('  ответ не JSON — пачка пропущена'); continue; }
    accept(parsed, chunk);
    console.error(`  ${Math.min(i + BATCH, queue.length)}/${queue.length}, принято ${done.length}`);
  }
}
for (const [k, a, t] of done) console.error(`+ ${t}: уровень ${a.level}, ${a.ops.map(([op, x]) => `${op} ${x}`).join(', ')} [${a.confidence}] — ${a.what}`);
for (const [t, why] of skipped) console.error(`- пропущено: ${t} — ${why}`);
console.error(`принято ${done.length}, пропущено ${skipped.length}, отброшено проверкой ${dropped.length}`);
if (DRY || !done.length) process.exit(0);

const q = (s: string) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, '’')}'`;
const how = APPLY.length ? `tools/draft-annotate.mts --apply, ${model}, без API — по знанию фильма` : `tools/draft-annotate.mts, ${model}`;
const section = `\n  // ── ${WEIGHTED ? 'по весу записей' : 'Г4'}: ${APPLY.length ? '' : 'автоматическая '}черновая разметка (${new Date().toISOString().slice(0, 10)}, ${how}) ──\n`
  + (skipped.length ? `  // пропущены (не знаю фильм — не выдумываю): ${skipped.map(([t]) => t.replace(/^\S+\s+/, '')).join('; ')}\n` : '')
  + done.map(([k, a, t]) => `  // ${t}\n  ${q(k)}: a([${a.ops.map(([op, x]) => `[${q(op)}, ${x}]`).join(', ')}], ${a.level}, [${a.barriers.map(q).join(', ')}], [${a.warnings.map(q).join(', ')}], ${a.niche}, ${q(a.confidence)},\n    ${q(a.what)}),`).join('\n');
const file = new URL('../src/mocks/draftAnnotations.ts', import.meta.url);
const src = readFileSync(file, 'utf8');
const end = src.trimEnd().lastIndexOf('};');
writeFileSync(file, `${src.slice(0, end).trimEnd()}\n${section}\n};\n`);
console.error(`→ src/mocks/draftAnnotations.ts: +${done.length}. Дальше — npx tsx tools/profile-deck.mts (и --deck)`);
