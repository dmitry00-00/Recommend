// Просьбы «посоветуйте что посмотреть» из Telegram и ответы на них (ТВ-12а, 06.10).
// Находки собирает tg-gateway (`search posts recomend …`, таблица found). Здесь модель
// размечает каждый пост и комментарий: просьба, совет, впечатление или шум, названия,
// а у просьбы — что уже понравилось (якорь) и чего хочется. Названия сводятся к ключам
// справочника; получаются пары «понравилось → посоветовали» и счётчик советов.
//   npx tsx tools/tg-asks.mts [--minutes 60] [--model local-model]   — разметить новое и собрать
//   npx tsx tools/tg-asks.mts --report                               — только собрать по готовому
// Результат: .cache/tg-asks/labels.json (разметка), .cache/tg-asks/pairs.json (свод).
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { classify, gatewayUp, GATEWAY, resolver, sha, worksOf, type LlmWork } from './llm-lib.mts';
import { worksIndex } from './works-index.mts';

const argv = process.argv.slice(2);
const opt = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const MINUTES = Number(opt('--minutes') ?? 60);
const MODEL = opt('--model') ?? 'local-model';
const REPORT = argv.includes('--report');
const BATCH = 12;
const TG = (process.env.TG_GATEWAY_URL ?? 'http://127.0.0.1:8710').replace(/\/+$/, '');

const root = new URL('../', import.meta.url);
const DIR = new URL('.cache/tg-asks/', root);
const LABELS = new URL('labels.json', DIR);
const PAIRS = new URL('pairs.json', DIR);
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

console.error('читаю находки tg-gateway…');
const all = await found();
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
const resolve = resolver(index);
// тёзки без года: берём того, о ком больше материалов (известнее), при равенстве — никого
const weight = new Map<string, number>();
const lensFile = new URL('.cache/llm/lenses.json', root);
if (existsSync(lensFile)) {
  for (const it of Object.values((JSON.parse(readFileSync(lensFile, 'utf8')) as { items: Record<string, { keys: string[] }> }).items)) {
    for (const k of it.keys) weight.set(k, (weight.get(k) ?? 0) + 1);
  }
}
const titleOf = new Map(index.map((w) => [w.key, w.work.year ? `${w.work.title} (${w.work.year})` : w.work.title]));
const SCREEN = new Set(['film', 'series', 'anime', 'cartoon', undefined]);
interface Ref { title: string; key?: string }
function ref(w: LlmWork): Ref | undefined {
  if (!SCREEN.has(w.type)) return undefined;
  const r = resolve({ ...w, ...(w.type === 'cartoon' ? { type: 'film' } : {}) });
  if (r.key) return { title: w.title, key: r.key };
  const ranked = r.options.map((o) => [o.key, weight.get(o.key) ?? 0] as const).sort((a, b) => b[1] - a[1]);
  if (ranked.length && ranked[0][1] > 0 && ranked[0][1] > (ranked[1]?.[1] ?? 0)) return { title: w.title, key: ranked[0][0] };
  return { title: w.title };
}

interface Ask { id: string; channel: string; msg_id: number; date?: string; text: string; replies?: number; want?: string; liked: Ref[]; advice: (Ref & { n: number })[]; answers: number }
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
  for (const c of thread) {
    const cl = file.items[idOf(c)];
    if (!cl || (cl.kind !== 'advice' && cl.kind !== 'share')) continue;
    answers += 1;
    const seen = new Set<string>();
    for (const w of cl.works) {
      const r = ref(w);
      note(r);
      if (!r) continue;
      const id = r.key ?? `?${r.title.toLowerCase()}`;
      if (seen.has(id)) continue;
      seen.add(id);
      const t = tally.get(id) ?? { ...r, n: 0 };
      t.n += 1;
      tally.set(id, t);
      if (r.key) advised.set(r.key, (advised.get(r.key) ?? 0) + 1);
    }
  }
  const liked = (l.liked ?? []).map(ref).filter((r): r is Ref => !!r);
  liked.forEach(note);
  asks.push({
    id: idOf(f), channel: f.channel, msg_id: f.msg_id, date: f.date, text: oneLine(f.text, 300), replies: f.replies,
    ...(l.want ? { want: l.want } : {}), liked, advice: [...tally.values()].sort((a, b) => b.n - a.n), answers,
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
console.log('не нашлись в справочнике:', [...unknown].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([t, n]) => `${t} ×${n}`).join(' · '));

// Какие ветки забрать (ТВ-12б): разговор под просьбой и есть ответ на неё, а забирает его шлюз
// по расписанию, понемногу за сутки (tg-gateway search_plan, очередь found_wanted). Просьба с
// якорем «понравилось X» — вперёд всех: из неё получается пара; дальше — самые обсуждаемые.
// Забранные ветки шлюз второй раз не берёт; без ответа шлюза — не беда, попросим в следующий раз.
if (!REPORT || argv.includes('--want')) {
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

