// Разметка роликов и постов моделью через llm-gateway основы (02.10).
//   npx tsx tools/llm-label.mts [--limit 300] [--minutes 20] [--model local-model|cheap]
//                               [--only yt|tg] [--ids id,id] [--days 30] [--relabel] [--dry]
//
// Что делает. Для каждого материала модель говорит, какой он (разбор одного произведения,
// несколько, подборка, новость, не о произведении) и какие произведения в нём названы, главное
// первым. Результат — .cache/llm/labels.json; из него пульт «Проверка» (tools/check-desk.mts)
// показывает, где модель спорит с опознавателем по названию, а замер (tools/markup-eval.mts)
// считает, насколько она права на ручной разметке.
//
// Очередь — по пользе, а не подряд: в выгрузке 160 тыс. роликов, а модель одна и локальная.
//   1. непроверенные привязки индекса разборов — это строки проверки;
//   2. ролики с ручным вердиктом — по ним меряем модель;
//   3. ролики, на которые ссылаются наши Telegram-каналы (пост анонса — подсказка модели);
//   4. свежие ролики каналов (--days);
//   5. посты, попавшие в индекс постов, и свежие посты.
// Размеченное с тем же текстом и тем же промптом не повторяется; шлюз к тому же кеширует
// каждый элемент сам. Модель по умолчанию — локальная (бесплатно, общая очередь с recruit,
// фоновый приоритет); `--model cheap` — DeepSeek в пределах суточного бюджета recomend ($0.5).
//
// Шлюз не отвечает — код 2: шаг необязательный, остальной конвейер идёт без него.
import { existsSync, readFileSync } from 'node:fs';
import { parseArgs, readExport } from './telegram-export.mts';
import { excludedChannels, isExcluded } from './youtube-channels.mts';
import {
  classify, gatewayUp, GATEWAY, KINDS, postText, promptText, readLabels, sha, subjectOf, topicOf, videoText, worksOf, writeLabels,
  type Kind, type Label, type VideoLike,
} from './llm-lib.mts';

const argv = process.argv.slice(2);
const opt = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const LIMIT = Number(opt('--limit') ?? 300);
const MINUTES = Number(opt('--minutes') ?? 20);
const MODEL = opt('--model') ?? process.env.LLM_LABEL_MODEL ?? 'local-model';
const ONLY = opt('--only') as 'yt' | 'tg' | undefined;
const DAYS = Number(opt('--days') ?? 30);
const IDS = opt('--ids')?.split(',').map((s) => s.trim()).filter(Boolean);
const RELABEL = argv.includes('--relabel');
const DRY = argv.includes('--dry');
const CHUNK = 40;       // элементов за запрос к шлюзу: обрыв теряет не больше этого
const BATCH = 8;        // элементов за вызов модели внутри шлюза

const root = new URL('../', import.meta.url);
const prompt = promptText();
const phash = sha(prompt, 12);
const since = new Date(Date.now() - DAYS * 86400e3).toISOString().slice(0, 10);
const ytId = /(?:youtube\.com\/(?:watch\?(?:[^ ]*&)?v=|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/g;

/** Сгенерированные моки — JSON после «= » до последней «;»: читаем как данные, без импорта модуля. */
function generated<T>(file: string): T {
  const p = new URL(file, root);
  if (!existsSync(p)) return {} as T;
  const src = readFileSync(p, 'utf8');
  return JSON.parse(src.slice(src.indexOf('= {') + 2, src.lastIndexOf(';'))) as T;
}

// ─── материалы ────────────────────────────────────────────────────────────────
console.error('читаю выгрузку роликов…');
const videos = existsSync(new URL('.cache/youtube/videos.json', root))
  ? JSON.parse(readFileSync(new URL('.cache/youtube/videos.json', root), 'utf8')) as (VideoLike & { channelId?: string })[] : [];
const channels = existsSync(new URL('.cache/youtube/channels.json', root))
  ? JSON.parse(readFileSync(new URL('.cache/youtube/channels.json', root), 'utf8')) as Record<string, { title?: string; medium?: string }> : {};
const byVideo = new Map(videos.map((v) => [v.id, v]));
const essaysAuto = generated<Record<string, { id: string; unverified?: boolean; publishedAt?: string }[]>>('src/mocks/essaysAuto.ts');
const postsAuto = generated<Record<string, { id: string }[]>>('src/mocks/postsAuto.ts');
const verdicts = existsSync(new URL('tools/markup-verdicts.json', root))
  ? (JSON.parse(readFileSync(new URL('tools/markup-verdicts.json', root), 'utf8')).videos ?? {}) as Record<string, unknown> : {};

console.error('читаю каналы Telegram…');
const tgPosts = new Map<string, { channel: string; title: string; text: string; date?: string }>();
const announces = new Map<string, string[]>();            // ролик → тексты постов, что на него ссылаются
for (const { username, path } of parseArgs([])) {
  let read;
  try { read = readExport(path); } catch { continue; }
  const name = read.title ?? username;
  for (const p of read.posts) {
    if (!p.text?.trim()) continue;
    tgPosts.set(`tg:${username.toLowerCase()}/${p.id}`, { channel: username, title: name, text: p.text, ...(p.date ? { date: p.date } : {}) });
    const urls = [p.text, ...p.links.map((l) => l.url), p.preview?.url ?? ''].join(' ');
    for (const m of urls.matchAll(ytId)) announces.set(m[1], [...(announces.get(m[1]) ?? []), p.text]);
  }
}

// ─── очередь ──────────────────────────────────────────────────────────────────
interface Item { id: string; text: string; src: 'yt' | 'tg'; title: string; channel?: string; date?: string; minutes?: number; why: string }
const queue = new Map<string, Item>();
const excluded = excludedChannels();
const ytItem = (vid: string, why: string) => {
  const v = byVideo.get(vid);
  if (!v || queue.has(`yt:${vid}`) || isExcluded({ channelId: v.channelId, title: v.channel }, excluded)) return;
  const ch = channels[v.channelId ?? '']?.title ?? v.channel;
  queue.set(`yt:${vid}`, { id: `yt:${vid}`, src: 'yt', why, title: v.title, channel: ch, date: v.publishedAt, ...(v.minutes ? { minutes: v.minutes } : {}),
    text: videoText(v, ch, announces.get(vid)) });
};
const tgItem = (id: string, why: string) => {
  const p = tgPosts.get(id);
  if (!p || queue.has(id)) return;
  const first = p.text.replace(/https?:\/\/\S+/g, ' ').split('\n').map((l) => l.trim()).find(Boolean) ?? '';
  queue.set(id, { id, src: 'tg', why, title: first.slice(0, 120), channel: p.title, date: p.date, text: postText(p.text, p.title) });
};

if (IDS) {
  for (const id of IDS) { if (id.startsWith('tg:')) tgItem(id, 'ids'); else ytItem(id.replace(/^yt:/, ''), 'ids'); }
} else {
  const yt = ONLY !== 'tg', tg = ONLY !== 'yt';
  if (yt) {
    const unverified = Object.values(essaysAuto).flat().filter((a) => a.unverified)
      .sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''));
    for (const a of unverified) ytItem(a.id.replace(/^yta-/, ''), 'проверка');
    for (const vid of Object.keys(verdicts)) ytItem(vid, 'вердикт');
    for (const vid of announces.keys()) ytItem(vid, 'telegram');
    for (const v of videos) if ((v.publishedAt ?? '') >= since) ytItem(v.id, 'свежее');
  }
  if (tg) {
    for (const a of Object.values(postsAuto).flat()) {
      const m = /^tg-(.+)-(\d+)$/.exec(a.id);
      if (m) tgItem(`tg:${m[1].toLowerCase()}/${m[2]}`, 'индекс постов');
    }
    for (const [id, p] of tgPosts) if ((p.date ?? '') >= since) tgItem(id, 'свежее');
  }
}

const file = readLabels();
const fresh = (it: Item) => !RELABEL && file.items[it.id]?.h === sha(phash + it.text);
const todo = [...queue.values()].filter((it) => !fresh(it));
const byWhy = (list: Item[]) => [...list.reduce((m, it) => m.set(it.why, (m.get(it.why) ?? 0) + 1), new Map<string, number>())]
  .map(([w, n]) => `${w} ${n}`).join(', ');
console.error(`в очереди ${queue.size}, размечено раньше ${queue.size - todo.length}, ждут ${todo.length} (${byWhy(todo) || '—'})`);

if (DRY) {
  for (const it of todo.slice(0, 3)) console.log(`\n── ${it.id} [${it.why}]\n${it.text}`);
  console.log(`\nждут разметки: ${todo.length}`);
  process.exit(0);
}
if (!todo.length) { console.log('разметка: всё размечено, ждут 0'); process.exit(0); }
if (!(await gatewayUp())) {
  console.log(`разметка: шлюз ${GATEWAY} не отвечает — пропускаю, ждут ${todo.length}`);
  process.exit(2);
}

// ─── разметка ─────────────────────────────────────────────────────────────────
const started = Date.now();
const take = todo.slice(0, LIMIT);
let labelled = 0, cached = 0, failed = 0, cost = 0, model = MODEL, stopped: string | null = null;
const kinds = new Map<Kind, number>();
for (let i = 0; i < take.length; i += CHUNK) {
  if (Date.now() - started > MINUTES * 60e3) { stopped = `время (${MINUTES} мин)`; break; }
  const chunk = take.slice(i, i + CHUNK);
  let res;
  try {
    res = await classify(chunk.map((it) => ({ id: it.id, text: it.text })), { prompt, model: MODEL, batch: BATCH, maxChars: 1600 });
  } catch (e) {
    stopped = (e as Error).message;
    break;
  }
  const at = new Date().toISOString().slice(0, 10);
  model = res.stats.model;
  cost += res.stats.cost_usd;
  for (const r of res.results) {
    const it = chunk.find((c) => c.id === r.id)!;
    if (r.error || !r.kind || !(KINDS as readonly string[]).includes(r.kind)) { failed += 1; continue; }
    const lab: Label = {
      h: sha(phash + it.text), kind: r.kind as Kind, works: worksOf(r.extra),
      ...(subjectOf(r.extra) ? { subject: subjectOf(r.extra) } : {}), ...(topicOf(r.extra) ? { topic: topicOf(r.extra) } : {}),
      ...(typeof r.confidence === 'number' ? { conf: Math.round(r.confidence * 100) / 100 } : {}),
      model: res.stats.model, at, src: it.src, title: it.title,
      ...(it.channel ? { channel: it.channel } : {}), ...(it.date ? { date: it.date } : {}), ...(it.minutes ? { minutes: it.minutes } : {}),
    };
    file.items[it.id] = lab;
    kinds.set(lab.kind, (kinds.get(lab.kind) ?? 0) + 1);
    if (r.cached) cached += 1; else labelled += 1;
  }
  file.prompt = phash;
  writeLabels(file);
  const done = Math.min(i + CHUNK, take.length);
  const rate = (labelled + cached) / Math.max(1, (Date.now() - started) / 60e3);
  console.error(`  ${done}/${take.length} · ${Math.round(rate)} в минуту · ошибок ${failed}${res.stats.cost_usd ? ` · $${res.stats.cost_usd.toFixed(4)}` : ''}`);
  if (res.stats.stopped) { stopped = res.stats.stopped === 'budget' ? 'кончился суточный бюджет recomend' : 'шлюз: отказы подряд (предохранитель)'; break; }
}

const left = todo.length - labelled - cached;
console.error(`виды: ${[...kinds].map(([k, n]) => `${k} ${n}`).join(', ') || '—'}`);
if (stopped) console.error(`остановка: ${stopped}`);
console.log(`разметка: ${labelled} новых, ${cached} из кеша, ошибок ${failed}, ждут ${left} · ${model}${cost ? ` · $${cost.toFixed(3)}` : ''} · ${Math.round((Date.now() - started) / 1000)} с`);
process.exit(stopped && !labelled && !cached ? 1 : 0);
