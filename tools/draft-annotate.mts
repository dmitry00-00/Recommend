// Черновая разметка новых фильмов списка первых оценок (трек Г4, 30.09).
//   npx tsx tools/draft-annotate.mts            — что ждёт разметки (список, без сети)
//   npx tsx tools/draft-annotate.mts --run [--limit 40] [--dry]
//                                                — разметить через Anthropic API: ключ ANTHROPIC_API_KEY
//                                                  в .env.local, модель — ANTHROPIC_MODEL (по умолчанию
//                                                  та же, что у черновиков, draftAnnotationMeta.model)
// Кто ждёт: фильмы из .cache/profile-deck.tsv (tools/profile-deck.mts — топ-300 и канон), у которых
// нет ни разметки, ни черновика, — новые профили и сборщик поднимают в топ новые фильмы. Отклонённые
// куратором (draftReview) тоже ждут: их черновик не используется.
// Как размечает: тем же способом, что первый и второй круг Г1 — по знанию фильма, без просмотра;
// шкала, словарь операций, барьеры и примеры берутся из уже размеченного. Ответ проверяется: неизвестная
// операция, интенсивность вне 0–1, уровень вне 1–10 — черновик отбрасывается. Прошедшие дописываются в
// src/mocks/draftAnnotations.ts отдельным разделом с датой; статус у всех — needs_review, дальше —
// подбор и петля (сигналы в кураторской).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { loadEnvFile } from './env-file.mts';
import { worksIndex } from './works-index.mts';
import { draftAnnotations, draftAnnotationMeta } from '../src/mocks/draftAnnotations.ts';
import { draftReview } from '../src/mocks/draftReview.ts';
import type { FirstPassAnnotation } from '../src/mocks/userAnnotations.ts';
import type { CognitiveOperation, Confidence } from '../src/types/tmdf.ts';

loadEnvFile();
const argv = process.argv.slice(2);
const RUN = argv.includes('--run');
const DRY = argv.includes('--dry');
const LIMIT = Number(argv[argv.indexOf('--limit') + 1]) || 40;
const BATCH = 20;

const TSV = '.cache/profile-deck.tsv';
if (!existsSync(TSV)) { console.error(`нет ${TSV} — сначала npx tsx tools/profile-deck.mts`); process.exit(1); }
const rows = readFileSync(TSV, 'utf8').trim().split('\n').slice(1).map((l) => l.split('\t'));
const index = worksIndex({ all: true }).filter((w) => w.key.startsWith('tmdb:'));
const byTitle = new Map(index.map((w) => [`${w.work.title}|${w.work.year}`, w]));
const todo = rows
  .filter((r) => r[8] !== 'да')
  .map((r) => byTitle.get(`${r[1]}|${r[2]}`))
  .filter((w): w is NonNullable<typeof w> => Boolean(w))
  .filter((w) => !draftAnnotations[w.key] || draftReview[`draft:${w.key}`]?.status === 'rejected');
console.error(`ждут черновой разметки: ${todo.length}`);
for (const w of todo.slice(0, 60)) console.error(`  ${w.key}  ${w.work.title} (${w.work.year})${w.work.originalTitle ? ` / ${w.work.originalTitle}` : ''}`);
if (!RUN || !todo.length) process.exit(0);

const key = process.env.ANTHROPIC_API_KEY;
if (!key) { console.error('для --run нужен ANTHROPIC_API_KEY в .env.local'); process.exit(1); }
const model = process.env.ANTHROPIC_MODEL ?? draftAnnotationMeta.model;

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

const done: [string, FirstPassAnnotation, string][] = [];
const queue = todo.slice(0, LIMIT);
for (let i = 0; i < queue.length; i += BATCH) {
  const chunk = queue.slice(i, i + BATCH);
  const films = chunk.map((w) => ({ key: w.key, title: w.work.title, original: w.work.originalTitle, year: w.work.year, creators: w.work.creators }));
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model, max_tokens: 8000, system, messages: [{ role: 'user', content: `Разметь:\n${JSON.stringify(films)}` }] }),
  });
  if (!r.ok) { console.error(`  API ${r.status}: ${(await r.text()).slice(0, 300)}`); break; }
  const j = await r.json() as { content?: { type: string; text?: string }[] };
  const text = (j.content ?? []).filter((c) => c.type === 'text').map((c) => c.text).join('');
  let parsed: Record<string, unknown>[] = [];
  try { parsed = JSON.parse(text.slice(text.indexOf('['), text.lastIndexOf(']') + 1)); } catch { console.error('  ответ не JSON — пачка пропущена'); continue; }
  for (const o of parsed) {
    const w = chunk.find((x) => x.key === o.key);
    const a = w && valid(o);
    if (!w || !a) { console.error(`  отброшено: ${String(o.key)}`); continue; }
    done.push([w.key, a, `${w.work.title} (${w.work.year})`]);
  }
  console.error(`  ${Math.min(i + BATCH, queue.length)}/${queue.length}, принято ${done.length}`);
}
for (const [k, a, t] of done) console.error(`+ ${t}: уровень ${a.level}, ${a.ops.map(([op, x]) => `${op} ${x}`).join(', ')} [${a.confidence}] — ${a.what}`);
if (DRY || !done.length) process.exit(0);

const q = (s: string) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, '’')}'`;
const section = `\n  // ── Г4: автоматическая черновая разметка (${new Date().toISOString().slice(0, 10)}, tools/draft-annotate.mts, ${model}) ──\n`
  + done.map(([k, a, t]) => `  // ${t}\n  ${q(k)}: a([${a.ops.map(([op, x]) => `[${q(op)}, ${x}]`).join(', ')}], ${a.level}, [${a.barriers.map(q).join(', ')}], [${a.warnings.map(q).join(', ')}], ${a.niche}, ${q(a.confidence)},\n    ${q(a.what)}),`).join('\n');
const file = new URL('../src/mocks/draftAnnotations.ts', import.meta.url);
const src = readFileSync(file, 'utf8');
const end = src.trimEnd().lastIndexOf('};');
writeFileSync(file, `${src.slice(0, end).trimEnd()}\n${section}\n};\n`);
console.error(`→ src/mocks/draftAnnotations.ts: +${done.length}. Дальше — npx tsx tools/profile-deck.mts (и --deck)`);
