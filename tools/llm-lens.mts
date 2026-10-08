// Рубрики роликов (06.10): с какой стороны автор смотрит на произведение — смысл, философия и
// психология, специалист по профессии, факты, грехи, сравнение, книга и фильм, реальная история,
// об авторе, о персонаже, о франшизе, мнение. Решение владельца: обзоры — не запас к эссе, а уже сложившиеся
// способы восприятия, и у каждого своё место в карточке. Сначала — замер, сколько чего есть.
//   npx tsx tools/llm-lens.mts [--limit 6000] [--minutes 60] [--model qwen|local-model|cheap] [--relabel] [--dry]
//   npx tsx tools/llm-lens.mts --new           — только ролики без метки (новые каналы, свежая пересборка индекса)
//   npx tsx tools/llm-lens.mts --new --channel 'КИНОТВ|Cut The Crap'  — только эти каналы; проверенные — первыми
//   npx tsx tools/llm-lens.mts --report        — только сводка по уже размеченному
//   npx tsx tools/llm-lens.mts --shelves       — полки, как их видит приложение (ЗП-2, 07.10): ролики индекса
//     по рубрикам из src/mocks/essayLenses.ts — русские всего, русские проверенные, английские; цель — от 50
//   npx tsx tools/llm-lens.mts --only history,author  — переразметить только ролики этих рубрик
//     (после правки промпта: весь корпус — часы, слабые рубрики — минуты)
//   npx tsx tools/llm-lens.mts --only meaning,opinion --match 'персонаж|character'  — и только ролики,
//     чей заголовок подходит под регулярку (без учёта регистра): новая рубрика — минуты, а не часы
//   npx tsx tools/llm-lens.mts --export        — только выгрузка в приложение (src/mocks/essayLenses.ts);
//     обычный прогон выгружает и сам, в конце
//
// Берём ролики индекса разборов (essaysAuto + essays): то, что уже привязано к произведениям и может
// попасть в карточку. Текст для модели — тот же, что у llm-label (канал, заголовок, теги, описание).
// Результат — .cache/llm/lenses.json: id ролика → рубрика, второй угол, уверенность, ярус канала.
import { existsSync, readFileSync } from 'node:fs';
import { exportLenses as exportToApp, LENSES, LENS_RU, readLensFile, readLensVerdicts, writeLensFile, type Lens, type LensFile } from './lens-lib.mts';
import { classify, gatewayUp, GATEWAY, sha, videoText, type VideoLike } from './llm-lib.mts';

export { LENSES, LENS_RU, type Lens } from './lens-lib.mts';

const argv = process.argv.slice(2);
const opt = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const LIMIT = Number(opt('--limit') ?? 6000);
const MINUTES = Number(opt('--minutes') ?? 60);
const MODEL = opt('--model') ?? 'qwen';
const RELABEL = argv.includes('--relabel');
// только ролики без метки (ЗП-2, 07.10): после правки промпта прежние метки считаются устаревшими целиком,
// а новым каналам нужна разметка сейчас, не через сутки переразметки корпуса
const NEW_ONLY = argv.includes('--new');
// только ролики каналов, чьё название подходит под регулярку (без учёта регистра): добор под рубрики
const CHANNEL = opt('--channel') ? new RegExp(opt('--channel')!, 'iu') : undefined;
const DRY = argv.includes('--dry');
const REPORT = argv.includes('--report');
const SHELVES = argv.includes('--shelves');
const EXPORT = argv.includes('--export');
const ONLY = new Set(opt('--only')?.split(',').filter(Boolean) ?? []);
const MATCH = opt('--match') ? new RegExp(opt('--match')!, 'iu') : null;
const BATCH = 8;

const root = new URL('../', import.meta.url);
const prompt = readFileSync(new URL('tools/prompts/media-lens.md', root), 'utf8');
const phash = sha(prompt, 12);

const file: LensFile = readLensFile();
if (!file.prompt) file.prompt = phash;
const save = () => writeLensFile(file);
// решения человека (пульт «Рубрики») — модель такие ролики не переразмечает
const human = readLensVerdicts();

function generated<T>(rel: string): T {
  const src = readFileSync(new URL(rel, root), 'utf8');
  return JSON.parse(src.slice(src.indexOf('= {') + 2, src.lastIndexOf(';'))) as T;
}

function report(): void {
  const items = Object.values(file.items);
  const by = new Map<Lens, { all: number; essay: number; works: Set<string>; also: number }>();
  for (const it of items) {
    for (const [l, isAlso] of [[it.lens, false], ...(it.also ? [[it.also, true]] : [])] as [Lens, boolean][]) {
      const b = by.get(l) ?? { all: 0, essay: 0, works: new Set(), also: 0 };
      if (isAlso) b.also += 1; else { b.all += 1; if (it.tier !== 'review') b.essay += 1; }
      for (const k of it.keys) b.works.add(k);
      by.set(l, b);
    }
  }
  console.log(`роликов с рубрикой: ${items.length}`);
  console.log('рубрика                              роликов  из них эссе  вторым углом  произведений');
  for (const l of LENSES) {
    const b = by.get(l);
    if (!b) continue;
    console.log(`  ${LENS_RU[l].padEnd(34)} ${String(b.all).padStart(6)} ${String(b.essay).padStart(11)} ${String(b.also).padStart(13)} ${String(b.works.size).padStart(13)}`);
  }
}

function exportLenses(): void {
  console.error(`→ src/mocks/essayLenses.ts: ${exportToApp(file, readLensVerdicts())} роликов (решений человека ${Object.keys(readLensVerdicts()).length})`);
}

/** Полки (ЗП-2): ролик индекса считается у каждой своей рубрики (и второго угла) один раз; язык и
 *  «не проверено» — из индекса. Узкой рубрике нужно от 50 роликов, иначе полка в карточке пустеет. */
async function shelves(): Promise<void> {
  const SHELF_MIN = 50;
  const text = readFileSync(new URL('src/mocks/essayLenses.ts', root), 'utf8');
  const lenses = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)) as Record<string, string>;
  const auto = generated<Record<string, { url: string; language?: string; unverified?: boolean }[]>>('src/mocks/essaysAuto.ts');
  const manual = (await import('../src/mocks/essays.ts')).essays as Record<string, { url: string; language?: string; unverified?: boolean }[]>;
  const yid = (u: string) => /(?:v=|youtu\.be\/|shorts\/|live\/)([A-Za-z0-9_-]{11})/.exec(u)?.[1];
  const seen = new Map<string, { language?: string; unverified?: boolean }>();
  for (const src of [manual, auto]) for (const list of Object.values(src)) for (const a of list) { const id = yid(a.url ?? ''); if (id && !seen.has(id)) seen.set(id, a); }
  const c = new Map<string, { ru: number; ruOk: number; en: number }>();
  for (const [id, a] of seen) {
    const raw = lenses[id];
    if (!raw) continue;
    for (const l of new Set(raw.split('/'))) {
      const x = c.get(l) ?? { ru: 0, ruOk: 0, en: 0 };
      if ((a.language ?? 'ru') === 'en') x.en += 1; else { x.ru += 1; if (!a.unverified) x.ruOk += 1; }
      c.set(l, x);
    }
  }
  console.log(`роликов в индексе: ${seen.size}, с рубрикой: ${[...seen.keys()].filter((id) => lenses[id]).length}`);
  console.log('рубрика                              рус. всего  рус. проверено  англ.');
  for (const l of LENSES) {
    const x = c.get(l) ?? { ru: 0, ruOk: 0, en: 0 };
    const low = l !== 'meaning' && l !== 'opinion' && Math.min(x.ru, x.ruOk) < SHELF_MIN;
    console.log(`  ${LENS_RU[l].padEnd(34)} ${String(x.ru).padStart(10)} ${String(x.ruOk).padStart(15)} ${String(x.en).padStart(6)}${low ? `   ← меньше ${SHELF_MIN}` : ''}`);
  }
}

if (REPORT) { report(); process.exit(0); }
if (SHELVES) { await shelves(); process.exit(0); }
if (EXPORT) { exportLenses(); process.exit(0); }

// ─── очередь: ролики индекса разборов ─────────────────────────────────────────
console.error('читаю выгрузку роликов…');
const videos = existsSync(new URL('.cache/youtube/videos.json', root))
  ? JSON.parse(readFileSync(new URL('.cache/youtube/videos.json', root), 'utf8')) as VideoLike[] : [];
const byVideo = new Map(videos.map((v) => [v.id, v]));
const ytId = (url: string) => /(?:v=|youtu\.be\/|shorts\/|live\/)([A-Za-z0-9_-]{11})/.exec(url)?.[1];
type Mat = { url: string; title: string; author: string; tier?: string; durationMinutes?: number; publishedAt?: string; unverified?: boolean };
const auto = generated<Record<string, Mat[]>>('src/mocks/essaysAuto.ts');
const manual = (await import('../src/mocks/essays.ts')).essays as Record<string, Mat[]>;
const queue = new Map<string, { id: string; text: string; title: string; channel?: string; tier?: string; keys: Set<string>; unverified?: boolean }>();
for (const [key, list] of [...Object.entries(auto), ...Object.entries(manual)]) {
  for (const m of list) {
    const vid = ytId(m.url ?? '');
    if (!vid) continue;
    const id = `yt:${vid}`;
    const q = queue.get(id);
    if (q) { q.keys.add(key); continue; }
    const v = byVideo.get(vid) ?? { id: vid, title: m.title, channel: m.author };
    queue.set(id, { id, text: videoText(v, m.author), title: m.title, channel: m.author, tier: m.tier, keys: new Set([key]), ...(m.unverified ? { unverified: true } : {}) });
  }
}
const todo = [...queue.values()].filter((it) => {
  if (human[it.id]) return false;
  if (MATCH && !MATCH.test(it.title)) return false;
  if (CHANNEL && !CHANNEL.test(it.channel ?? '')) return false;
  const l = file.items[it.id];
  // --only с --relabel — заново и размеченное этим промптом (смена модели: локальная → cheap)
  if (NEW_ONLY) return !l;
  if (ONLY.size) return !l || (ONLY.has(l.lens) && (RELABEL || l.h !== sha(phash + it.text)));
  return RELABEL || l?.h !== sha(phash + it.text);
});
// проверенные привязки — первыми: они видны в карточке без пометки и считаются в полках (ЗП-2)
todo.sort((a, b) => Number(Boolean(a.unverified)) - Number(Boolean(b.unverified)));
// у уже размеченного обновляем привязки — ролик мог прибавить произведение
for (const it of queue.values()) { const l = file.items[it.id]; if (l) { l.keys = [...it.keys]; l.tier = it.tier; } }
console.error(`роликов в индексе ${queue.size}, к разметке ${todo.length}${todo.length > LIMIT ? ` (сейчас ${LIMIT})` : ''}`);
if (DRY) { for (const it of todo.slice(0, 3)) console.log(`--- ${it.id}\n${it.text}`); process.exit(0); }
if (!(await gatewayUp())) { console.error(`llm-gateway не отвечает (${GATEWAY})`); process.exit(2); }

const started = Date.now();
const take = todo.slice(0, LIMIT);
let done = 0, failed = 0, stopped: string | null = null, size = BATCH, fails = 0;
for (let i = 0; i < take.length;) {
  if (Date.now() - started > MINUTES * 60e3) { stopped = `время (${MINUTES} мин)`; break; }
  const chunk = take.slice(i, i + size);
  let res;
  try {
    res = await classify(chunk.map((it) => ({ id: it.id, text: it.text })), { prompt, model: MODEL, batch: BATCH, maxChars: 1600, labels: LENSES });
    fails = 0;
  } catch (e) {
    const msg = (e as Error).message;
    if (/fetch failed|timeout|terminated|socket/i.test(msg) && fails < 3) { fails += 1; size = Math.max(1, Math.floor(chunk.length / 2)); continue; }
    stopped = msg;
    break;
  }
  i += chunk.length;
  const at = new Date().toISOString().slice(0, 10);
  for (const r of res.results) {
    const it = chunk.find((c) => c.id === r.id)!;
    if (r.error || !r.kind || !(LENSES as readonly string[]).includes(r.kind)) { failed += 1; continue; }
    const also = (r.extra as { also?: string } | null)?.also;
    file.items[it.id] = {
      h: sha(phash + it.text), lens: r.kind as Lens,
      ...(also && also !== r.kind && (LENSES as readonly string[]).includes(also) ? { also: also as Lens } : {}),
      ...(typeof r.confidence === 'number' ? { conf: Math.round(r.confidence * 100) / 100 } : {}),
      model: res.stats.model, at, title: it.title, ...(it.channel ? { channel: it.channel } : {}),
      ...(it.tier ? { tier: it.tier } : {}), keys: [...it.keys],
    };
    done += 1;
  }
  file.prompt = phash;
  save();
  const rate = done / Math.max(1, (Date.now() - started) / 60e3);
  console.error(`  ${Math.min(i, take.length)}/${take.length} · ${Math.round(rate)} в минуту · ошибок ${failed}`);
  if (res.stats.stopped) { stopped = res.stats.stopped === 'budget' ? 'кончился суточный бюджет recomend' : 'шлюз: отказы подряд'; break; }
}
save();
if (stopped) console.error(`остановка: ${stopped}`);
console.log(`рубрики: ${done} размечено, ошибок ${failed}, ждут ${todo.length - done} · ${Math.round((Date.now() - started) / 1000)} с`);
report();
exportLenses();
