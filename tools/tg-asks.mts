// Просьбы «посоветуйте что посмотреть» из Telegram и ответы на них (ТВ-12а, 06.10).
// Находки собирает tg-gateway (`search posts recomend …`, таблица found). Здесь модель
// размечает каждый пост и комментарий: просьба, совет, впечатление или шум, названия,
// а у просьбы — что уже понравилось (якорь) и чего хочется. Названия сводятся к ключам
// справочника; получаются пары «понравилось → посоветовали» и счётчик советов.
//   npx tsx tools/tg-asks.mts [--minutes 60] [--model local-model]   — разметить новое и собрать
//   npx tsx tools/tg-asks.mts --report                               — только собрать по готовому
//   npx tsx tools/tg-asks.mts --match-only                           — только сопоставление (18.10): ни модели, ни шлюзов —
//     находки из снимка .cache/tg-asks/found.json (его пишет каждый прогон с шлюзом), разметка — labels.json
// Результат: .cache/tg-asks/labels.json (разметка), .cache/tg-asks/pairs.json (свод).
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { classify, gatewayUp, GATEWAY, sha, worksOf, type LlmWork } from './llm-lib.mts';
import { worksIndex } from './works-index.mts';
import { matcher, threadKinds, threadKey, commonWords, negated, offered, type Ctx, type Kind } from './tg-asks-match.mts';
import { fame as fameLevel } from '../src/mocks/fame.ts';
import { parseArgs, readExport } from './telegram-export.mts';

const argv = process.argv.slice(2);
const opt = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const MINUTES = Number(opt('--minutes') ?? 60);
const MODEL = opt('--model') ?? 'local-model';
// --match-only (18.10): пересчёт сопоставления по готовой разметке — без модели и без шлюза Telegram
const MATCH_ONLY = argv.includes('--match-only');
const REPORT = argv.includes('--report') || MATCH_ONLY;
const BATCH = 12;
const TG = (process.env.TG_GATEWAY_URL ?? 'http://127.0.0.1:8710').replace(/\/+$/, '');

const root = new URL('../', import.meta.url);
const DIR = new URL('.cache/tg-asks/', root);
const LABELS = new URL('labels.json', DIR);
const PAIRS = new URL('pairs.json', DIR);
const FOUND = new URL('found.json', DIR);
const prompt = readFileSync(new URL('tools/prompts/tg-ask.md', root), 'utf8');
const phash = sha(prompt, 12);

type AskKind = 'ask' | 'advice' | 'share' | 'other';
const KINDS: readonly AskKind[] = ['ask', 'advice', 'share', 'other'];
interface Found { id: number; kind: 'posts' | 'chat' | 'replies'; query?: string; channel: string; title?: string; msg_id: number; parent_id: number; date?: string; text: string; replies?: number }
interface AskLabel { h: string; kind: AskKind; works: LlmWork[]; liked?: LlmWork[]; want?: string; conf?: number; model: string; at: string }
interface LabelFile { prompt: string; items: Record<string, AskLabel> }

const file: LabelFile = existsSync(LABELS) ? JSON.parse(readFileSync(LABELS, 'utf8')) : { prompt: phash, items: {} };
const save = () => { mkdirSync(DIR, { recursive: true }); const tmp = `${LABELS.pathname}.tmp`; writeFileSync(tmp, JSON.stringify(file)); renameSync(tmp, LABELS.pathname); };

// ─── находки шлюза ───────────────────────────────────────────────────────────
async function found(): Promise<Found[]> {
  const out: Found[] = [];
  for (let after = 0; ;) {
    const r = await fetch(`${TG}/found?consumer=recomend&after=${after}&limit=500`);
    if (!r.ok) throw new Error(`tg-gateway: HTTP ${r.status}`);
    const page = ((await r.json()) as { found: Found[] }).found;
    out.push(...page);
    if (page.length < 500) return out;
    after = page[page.length - 1].id;
  }
}
const idOf = (f: Found) => `${f.channel}/${f.parent_id || f.msg_id}${f.parent_id ? `/${f.msg_id}` : ''}`;
const oneLine = (s: string, n: number) => s.replace(/\s+/g, ' ').trim().slice(0, n);

// снимок находок (18.10): сопоставление пересчитывается без шлюза и на тех же находках, что видела разметка
let all: Found[];
if (MATCH_ONLY && existsSync(FOUND)) {
  all = JSON.parse(readFileSync(FOUND, 'utf8')) as Found[];
  console.error(`находки из снимка ${FOUND.pathname}: ${all.length}`);
} else {
  console.error('читаю находки tg-gateway…');
  all = await found();
  mkdirSync(DIR, { recursive: true });
  writeFileSync(`${FOUND.pathname}.tmp`, JSON.stringify(all));
  renameSync(`${FOUND.pathname}.tmp`, FOUND.pathname);
}
const posts = new Map(all.filter((f) => f.kind !== 'replies').map((f) => [`${f.channel}/${f.msg_id}`, f]));
const textOf = (f: Found) => f.kind === 'replies'
  ? `[ОТВЕТ] (${oneLine(posts.get(`${f.channel}/${f.parent_id}`)?.text ?? '', 90)}) ${oneLine(f.text, 500)}`
  : `[ПОСТ] ${oneLine(f.text, 900)}`;

if (!REPORT) {
  // сначала ветки с комментариями и их посты: пары «понравилось → посоветовали» только оттуда
  const threaded = new Set(all.filter((f) => f.kind === 'replies').map((f) => `${f.channel}/${f.parent_id}`));
  const first = (f: Found) => (f.kind === 'replies' || threaded.has(`${f.channel}/${f.msg_id}`) ? 0 : 1);
  const todo = all.filter((f) => f.text.trim() && file.items[idOf(f)]?.h !== sha(phash + textOf(f)))
    .sort((x, y) => first(x) - first(y));
  console.error(`находок ${all.length}, к разметке ${todo.length}`);
  if (todo.length && !(await gatewayUp())) { console.error(`llm-gateway не отвечает (${GATEWAY})`); process.exit(2); }
  const started = Date.now();
  let done = 0, failed = 0, stopped: string | null = null, size = BATCH, fails = 0;
  for (let i = 0; i < todo.length;) {
    if (Date.now() - started > MINUTES * 60e3) { stopped = `время (${MINUTES} мин)`; break; }
    const chunk = todo.slice(i, i + size);
    let res;
    try {
      res = await classify(chunk.map((f) => ({ id: idOf(f), text: textOf(f) })), { prompt, model: MODEL, batch: BATCH, maxChars: 1000, labels: KINDS });
      fails = 0;
    } catch (e) {
      // шлюз занят другой разметкой и не дождался ответа модели — пачку меньше и ещё раз
      const msg = (e as Error).message;
      if (/fetch failed|timeout|terminated|socket/i.test(msg) && fails < 3) { fails += 1; size = Math.max(1, Math.floor(chunk.length / 2)); continue; }
      stopped = msg;
      break;
    }
    i += chunk.length;
    const at = new Date().toISOString().slice(0, 10);
    for (const r of res.results) {
      const f = chunk.find((c) => idOf(c) === r.id)!;
      if (r.error || !r.kind || !(KINDS as readonly string[]).includes(r.kind)) { failed += 1; continue; }
      const extra = r.extra as { liked?: unknown; want?: unknown } | null;
      const liked = worksOf({ works: extra?.liked } as never);
      const want = typeof extra?.want === 'string' ? extra.want.trim() : '';
      file.items[r.id] = {
        h: sha(phash + textOf(f)), kind: r.kind as AskKind, works: worksOf(r.extra),
        ...(r.kind === 'ask' && liked.length ? { liked } : {}), ...(r.kind === 'ask' && want ? { want } : {}),
        ...(typeof r.confidence === 'number' ? { conf: Math.round(r.confidence * 100) / 100 } : {}),
        model: res.stats.model, at,
      };
      done += 1;
    }
    file.prompt = phash;
    save();
    console.error(`  ${Math.min(i, todo.length)}/${todo.length} · ошибок ${failed}`);
    if (res.stats.stopped) { stopped = res.stats.stopped === 'budget' ? 'кончился суточный бюджет recomend' : 'шлюз: отказы подряд'; break; }
  }
  save();
  if (stopped) console.error(`остановка: ${stopped}`);
  console.error(`размечено ${done}, ошибок ${failed}, ждут ${todo.length - done} · ${Math.round((Date.now() - started) / 1000)} с`);
}

// ─── свод: названия → ключи, пары «понравилось → посоветовали» ────────────────
const index = worksIndex({ all: true });
// Опознание (18.10, tools/tg-asks-match.mts): прежде — общий узнаватель llm-lib (точное название, год, тёзки по числу
// материалов), и из 301 ненайденного совета 80 были в справочнике под тем же названием (замер 17.10). Теперь — варианты
// и альтернативные названия, вид по тексту и ветке, тёзки по известности, ловушки из обычных слов — с подтверждением.
const readJson = <T,>(u: URL, d: T): T => (existsSync(u) ? JSON.parse(readFileSync(u, 'utf8')) as T : d);
// число материалов о вещи (.cache/llm/lenses.json) — прежнее мерило тёзок, теперь лишь добавка к известности
const weight = new Map<string, number>();
for (const it of Object.values(readJson<{ items: Record<string, { keys: string[] }> }>(new URL('.cache/llm/lenses.json', root), { items: {} }).items)) {
  for (const k of it.keys) weight.set(k, (weight.get(k) ?? 0) + 1);
}
// известность — разделы Википедии из кэша tools/build-fame.mts (элемент — из id карточки, Wikidata, IMDb или TMDb),
// без них — уровень src/mocks/fame.ts × 20
type FameWd = Record<string, { links?: number }> & { _imdb?: Record<string, string>; _tmdb?: Record<string, string> };
const fwd = readJson<FameWd>(new URL('.cache/fame-wd.json', root), {} as FameWd);
const att = readJson<Record<string, { views?: number }>>(new URL('.cache/attention.json', root), {});
const qidOf = (w: IndexedCard): string | undefined => {
  const ids = w.externalIds ?? {};
  const q = ids.wikidata ?? (/-wd(\d+)$/.exec(w.id)?.[1] ? `Q${/-wd(\d+)$/.exec(w.id)![1]}` : undefined);
  if (q) return q;
  if (ids.imdb && fwd._imdb?.[ids.imdb]) return fwd._imdb[ids.imdb];
  const tv = /-tmdbtv(\d+)$/.exec(w.id)?.[1];
  const t = ids.tmdb ?? Number(/-tmdb(\d+)$/.exec(w.id)?.[1]);
  return (tv ? fwd._tmdb?.[`tv:${tv}`] : t ? fwd._tmdb?.[`film:${t}`] : undefined) || undefined;
};
type IndexedCard = (typeof index)[number]['work'];
const keyOfCard = new Map(index.map((x) => [x.work.id, x.key]));
const famous = (w: IndexedCard): number => {
  const q = qidOf(w);
  const links = q ? (fwd[q] as { links?: number } | undefined)?.links : undefined;
  // о чём люди читают (.cache/attention.json: просмотры статьи русской Википедии) — у карточек разметки и каталога
  // («Чёрный лебедь» 2010, «Прибытие» 2016, «Маяк» 2019) раздела в кэше известности нет, а тёзка-старичок там есть
  const views = att[keyOfCard.get(w.id) ?? '']?.views;
  return Math.max(links ?? (fameLevel[w.id] ?? 0) * 20, views ? Math.min(100, views / 5000) : 0) + 2 * (weight.get(keyOfCard.get(w.id) ?? '') ?? 0);
};
// обычные слова — по корпусу каналов о кино (tools/telegram-channels.json), как названия-ловушки tools/build-ordinary.mts
const common = new Map<string, number>();
try {
  const texts = function* () { for (const a of parseArgs([])) for (const p of readExport(a.path).posts) yield p.text; };
  for (const [w, n] of commonWords(texts())) common.set(w, n);
} catch { console.error('корпус каналов не прочитан — ловушки из обычных слов не проверяются'); }
const altTitles = readJson<Record<string, string[]>>(new URL('.cache/alt-titles.json', root), {});
const match = matcher(index, { alt: altTitles, fame: famous, common: (w) => common.get(w) ?? 0 });
const titleOf = new Map(index.map((w) => [w.key, w.work.year ? `${w.work.title} (${w.work.year})` : w.work.title]));
const SCREEN = new Set(['film', 'series', 'anime', 'cartoon', undefined]);
interface Ref { title: string; key?: string }
const why = new Map<string, number>();
function ref(w: LlmWork, ctx: Ctx): Ref | undefined {
  if (!SCREEN.has(w.type)) return undefined;
  const m = match(w, ctx);
  why.set(m.why, (why.get(m.why) ?? 0) + 1);
  return m.key ? { title: w.title, key: m.key } : { title: w.title };
}
const yearOf = (f: Found) => (f.date ? Number(f.date.slice(0, 4)) : undefined);

interface Ask { id: string; channel: string; msg_id: number; date?: string; text: string; replies?: number; want?: string; liked: Ref[]; notWanted?: Ref[]; offered?: Ref[]; advice: (Ref & { n: number })[]; answers: number }
const asks: Ask[] = [];
const kinds: Record<string, number> = {};
const advised = new Map<string, number>();
const unknown = new Map<string, number>();
const note = (r: Ref | undefined) => { if (r && !r.key) unknown.set(r.title.toLowerCase(), (unknown.get(r.title.toLowerCase()) ?? 0) + 1); };
const byParent = new Map<string, Found[]>();
for (const f of all) if (f.kind === 'replies') byParent.set(`${f.channel}/${f.parent_id}`, [...(byParent.get(`${f.channel}/${f.parent_id}`) ?? []), f]);

for (const f of all) {
  const l = file.items[idOf(f)];
  if (!l) continue;
  kinds[`${f.kind === 'replies' ? 'ответ' : 'пост'}:${l.kind}`] = (kinds[`${f.kind === 'replies' ? 'ответ' : 'пост'}:${l.kind}`] ?? 0) + 1;
  if (f.kind === 'replies') continue;
  const thread = byParent.get(`${f.channel}/${f.msg_id}`) ?? [];
  // ветка просьбы или «чем впечатлились» (share-посты зовут советовать — их ответы тоже советы)
  if (l.kind !== 'ask' && !(l.kind === 'share' && thread.length)) continue;
  const tally = new Map<string, Ref & { n: number }>();
  let answers = 0;
  // вид названия по всей ветке: «Извне и ОСД … оба сериала» в одном ответе — и «извне» в соседнем ответе тоже сериал
  const tk = threadKinds([f, ...thread].map((m) => ({ text: m.text, titles: [...(file.items[idOf(m)]?.works ?? []), ...(file.items[idOf(m)]?.liked ?? [])].map((w) => w.title) })));
  const ctxOf = (m: Found, w: LlmWork): Ctx => ({ text: m.text, ...(m === f ? {} : { parent: f.text }), ...(tk.get(threadKey(w.title)) ? { thread: tk.get(threadKey(w.title)) as Kind } : {}), ...(yearOf(m) ? { year: yearOf(m) } : {}) });
  // Якорь «понравилось» (18.10, разбор пар после ночного прогона): модель кладёт в liked и то, что просят НЕ советовать
  // («сериал или фильм, сумерки не надо!!!» → `notWanted`), и то, что автор просьбы советует сам («Посмотрите сериал
  // Невский, если ещё не смотрели» → `offered`). Разметку не переделываем — разбираем по тексту поста.
  const likedRaw = (l.liked ?? []).map((w) => ({ w, r: ref(w, ctxOf(f, w)) })).filter((x): x is { w: LlmWork; r: Ref } => !!x.r);
  const notWanted = likedRaw.filter((x) => negated(f.text, x.w.title)).map((x) => x.r);
  const byAuthor = likedRaw.filter((x) => !negated(f.text, x.w.title) && offered(f.text, x.w.title)).map((x) => x.r);
  const liked = likedRaw.filter((x) => !notWanted.includes(x.r) && !byAuthor.includes(x.r)).map((x) => x.r);
  liked.forEach(note);
  // совет, повторяющий якорь («Посмотрел сериал «Захваченный рейс», мне зашло» — и в ответах он же), — не совет
  const anchor = new Set([...liked, ...notWanted, ...byAuthor].map((r) => r.key).filter(Boolean));
  for (const c of thread) {
    const cl = file.items[idOf(c)];
    if (!cl || (cl.kind !== 'advice' && cl.kind !== 'share')) continue;
    answers += 1;
    const seen = new Set<string>();
    for (const w of cl.works) {
      const r = ref(w, ctxOf(c, w));
      note(r);
      if (!r || (r.key && anchor.has(r.key))) continue;
      const id = r.key ?? `?${r.title.toLowerCase()}`;
      if (seen.has(id)) continue;
      seen.add(id);
      const t = tally.get(id) ?? { ...r, n: 0 };
      t.n += 1;
      tally.set(id, t);
      if (r.key) advised.set(r.key, (advised.get(r.key) ?? 0) + 1);
    }
  }
  asks.push({
    id: idOf(f), channel: f.channel, msg_id: f.msg_id, date: f.date, text: oneLine(f.text, 300), replies: f.replies,
    ...(l.want ? { want: l.want } : {}), liked, ...(notWanted.length ? { notWanted } : {}), ...(byAuthor.length ? { offered: byAuthor } : {}), advice: [...tally.values()].sort((a, b) => b.n - a.n), answers,
  });
}

const pairs: { liked: string; advised: string; n: number }[] = [];
for (const a of asks) for (const lk of a.liked) for (const ad of a.advice) if (lk.key && ad.key && lk.key !== ad.key) pairs.push({ liked: lk.key, advised: ad.key, n: ad.n });
const top = [...advised].sort((a, b) => b[1] - a[1]);
mkdirSync(DIR, { recursive: true });
writeFileSync(PAIRS, JSON.stringify({ built: new Date().toISOString(), prompt: phash, kinds, asks, pairs, advised: Object.fromEntries(top), unknown: Object.fromEntries([...unknown].sort((a, b) => b[1] - a[1])) }, null, 1));

const threads = asks.filter((a) => a.answers);
const refs = threads.flatMap((a) => a.advice);
console.log(`виды: ${Object.entries(kinds).map(([k, n]) => `${k} ${n}`).join(', ')}`);
console.log(`просьб ${asks.filter((a) => file.items[a.id]?.kind === 'ask').length}, из них с якорем «понравилось» ${asks.filter((a) => a.liked.length).length}; веток с советами ${threads.length}`);
console.log(`советов-названий ${refs.reduce((s, r) => s + r.n, 0)}, опознано ${refs.filter((r) => r.key).reduce((s, r) => s + r.n, 0)}; разных произведений ${advised.size}; пар «понравилось → посоветовали» ${pairs.length} — из веток с якорем и ответами: ${asks.filter((a) => a.liked.length && a.answers).length}`);
console.log('чаще всего советуют:', top.slice(0, 25).map(([k, n]) => `${titleOf.get(k) ?? k} ×${n}`).join(' · '));
console.log('почему так:', [...why].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ×${n}`).join(' · '));
console.log('не нашлись в справочнике:', [...unknown].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([t, n]) => `${t} ×${n}`).join(' · '));

// Какие ветки забрать (ТВ-12б): разговор под просьбой и есть ответ на неё, а забирает его шлюз
// по расписанию, понемногу за сутки (tg-gateway search_plan, очередь found_wanted). Просьба с
// якорем «понравилось X» — вперёд всех: из неё получается пара; дальше — самые обсуждаемые.
// Забранные ветки шлюз второй раз не берёт; без ответа шлюза — не беда, попросим в следующий раз.
if (!MATCH_ONLY && (!REPORT || argv.includes('--want'))) {
  const items = asks.filter((a) => (a.replies ?? 0) > 0 && !a.answers && file.items[a.id]?.kind === 'ask')
    .map((a) => ({ channel: a.channel, msg_id: a.msg_id, priority: (a.liked.length ? 100 : 0) + Math.min(a.replies ?? 0, 99) }));
  if (items.length) {
    const r = await fetch(`${TG}/found/wanted`, { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ consumer: 'recomend', items }) }).catch(() => undefined);
    const j = r?.ok ? await r.json() as { added: number; wanted: number; done: number; failed: number } : undefined;
    console.log(j ? `ветки в очередь шлюза: новых ${j.added} (всего ${j.wanted}, забрано ${j.done}, не вышло ${j.failed}); с якорем ${items.filter((i) => i.priority >= 100).length}`
      : `ветки в очередь шлюза: шлюз не ответил (${r?.status ?? 'нет связи'}) — попросим в следующий раз`);
  }
}

