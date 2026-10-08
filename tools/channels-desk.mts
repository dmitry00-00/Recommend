// Вкладка «Каналы» общего пульта (tools/desk.mts, http://127.0.0.1:8721/channels/) — 04.10.
//
// Список YouTube-каналов (реестр src/mocks/sources.ts + всё, что знает обход, .cache/youtube/channels.json)
// и страница профиля канала: что о нём известно (выгрузка, привязки, решения людей, точность, о чём
// говорит, рубрики, плейлисты, фильмы) и его статус — ярус (эссе / обзор), предмет, полноценный голос
// или «из ссылок», подборки, язык, фокус, причина решения. «Сохранить» пишет строку канала в
// sources.ts (как пульт ссылок) и сразу — в channels.json: индекс разборов читает ярус оттуда, и без
// этого правка ждала бы следующего обхода YouTube. В приложении ярус меняется после «Индекса
// разборов» (кнопка на странице) и публикации справочника.
//
// Хост и заголовок x-desk проверяет общий пульт.
import type { IncomingMessage, ServerResponse } from 'node:http';
import { existsSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { CHANNELS, excludedChannels, isExcluded, type ChannelMeta } from './youtube-channels.mts';
import { saveExcluded, saveSourcesText } from './registry-lib.mts';
import { readProfiles } from './channel-profile.mts';
import { readPrecision } from './link-precision.mts';
import { aboutTitle, searchAbout, aboutByLabel } from './about-lib.mts';
import { sourceLine } from './links-desk-lib.mts';
import { runState, startRun } from './pipeline.mts';

const ROOT = new URL('../', import.meta.url);
const at = (p: string) => new URL(p, ROOT);
const REGISTRY = at('src/mocks/sources.ts');
const EXCLUDED = at('tools/channels-excluded.json');
const DESK_MARK = '  // ── каналы из пульта ссылок: tools/links-desk.mts дописывает сюда ──';
const LINKS_MARK = '  // ── каналы из ссылок владельца: tools/register-link-channels.mts дописывает сюда ──';
const PAGE = new URL('./channels-desk.html', import.meta.url);

const mt = (u: URL) => { try { return statSync(u).mtimeMs; } catch { return 0; } };
const readJson = <T,>(u: URL, d: T): T => { try { return existsSync(u) ? JSON.parse(readFileSync(u, 'utf8')) as T : d; } catch { return d; } };
const writeAtomic = (u: URL, text: string) => { const tmp = new URL(`${u.href}.tmp`); writeFileSync(tmp, text); renameSync(tmp, u); };

// ─── реестр: строки YouTube из sources.ts ─────────────────────────────────────
type Tier = 'essay' | 'review';
interface RegLine {
  line: number; text: string; id?: string; title: string; handle: string;
  tier?: Tier; medium?: 'film' | 'book'; via?: 'links'; lists?: boolean; language?: 'en'; focus: string[]; note?: string;
}
const field = (l: string, f: string) => {
  const m = new RegExp(`\\b${f}: '((?:[^'\\\\]|\\\\.)*)'`).exec(l);
  return m ? m[1].replace(/\\(.)/g, '$1') : undefined;
};
function readRegistry(): RegLine[] {
  const out: RegLine[] = [];
  readFileSync(REGISTRY, 'utf8').split('\n').forEach((text, i) => {
    if (!/^\s*\{ id: /.test(text) || !text.includes("platform: 'youtube'")) return;
    const handle = field(text, 'handle');
    if (!handle) return;
    const note = /\},\s*\/\/\s*(.*)$/.exec(text)?.[1]?.trim();
    out.push({
      line: i + 1, text, id: field(text, 'id'), title: field(text, 'title') ?? handle, handle,
      ...(field(text, 'tier') ? { tier: field(text, 'tier') as Tier } : {}),
      ...(field(text, 'medium') ? { medium: field(text, 'medium') as 'film' | 'book' } : {}),
      ...(field(text, 'via') ? { via: 'links' as const } : {}),
      ...(/\blists: true/.test(text) ? { lists: true } : {}),
      ...(field(text, 'language') ? { language: 'en' as const } : {}),
      focus: [.../focus: \[([^\]]*)\]/.exec(text)?.[1].matchAll(/'(Q\d+)'/g) ?? []].map((m) => m[1]),
      ...(note ? { note } : {}),
    });
  });
  return out;
}

// ─── что известно о канале ────────────────────────────────────────────────────
interface Analysis { id: string; title: string; author: string; url: string; tier?: string; evidence?: string; unverified?: boolean; durationMinutes?: number; publishedAt?: string }
type Verdict = { key: string | null; why?: string; err?: string; guess?: boolean; from?: string; at?: string };

/** Привязки индекса по названию канала (как у ролика — `author`). */
let linkedCache: { sig: number; by: Map<string, { key: string; a: Analysis }[]> } | undefined;
function linkedBy(): Map<string, { key: string; a: Analysis }[]> {
  const f = at('src/mocks/essaysAuto.ts');
  if (linkedCache?.sig === mt(f)) return linkedCache.by;
  const src = existsSync(f) ? readFileSync(f, 'utf8') : '';
  const essays = src ? JSON.parse(src.slice(src.indexOf('= {') + 2, src.lastIndexOf(';'))) as Record<string, Analysis[]> : {};
  const by = new Map<string, { key: string; a: Analysis }[]>();
  for (const [key, list] of Object.entries(essays)) for (const a of list) (by.get(a.author) ?? by.set(a.author, []).get(a.author)!).push({ key, a });
  linkedCache = { sig: mt(f), by };
  return by;
}
const vidOf = (url: string) => /[?&]v=([A-Za-z0-9_-]{11})/.exec(url)?.[1];

/** Названия произведений по ключу: из подписей, которые индекс пишет в таблицу разметки, — дешевле, чем
 *  поднимать весь справочник; не нашлось — ключ как есть. */
let titles: Map<string, string> | undefined;
async function titleOf(key: string): Promise<string> {
  if (!titles) {
    const { worksIndex } = await import('./works-index.mts');
    titles = new Map(worksIndex({ all: true }).map((w) => [w.key, `${w.work.title}${w.work.year ? ` (${w.work.year})` : ''}`]));
  }
  return titles.get(key) ?? key;
}

/** Выгрузка YouTube (250 МБ): читается один раз в фоне и сворачивается в сводку по каналу. */
interface DumpChan { n: number; first?: string; last?: string; minutes: number[]; recent: { id: string; title: string; date?: string; minutes?: number }[] }
let dump: { sig: number; by: Map<string, DumpChan>; chanOfVid: Map<string, string> } | undefined;
let dumpLoading: Promise<void> | undefined;
function loadDump(): void {
  const f = at('.cache/youtube/videos.json');
  if (dumpLoading || (dump && dump.sig === mt(f))) return;
  dumpLoading = (async () => {
    await new Promise((r) => setTimeout(r, 0));
    const verdictIds = new Set(Object.keys(readJson<{ videos?: Record<string, unknown> }>(at('tools/markup-verdicts.json'), {}).videos ?? {}));
    const by = new Map<string, DumpChan>();
    const chanOfVid = new Map<string, string>();
    const list = readJson<{ id: string; title: string; channelId?: string; publishedAt?: string; minutes?: number }[]>(f, []);
    for (const v of list) {
      if (!v.channelId) continue;
      const c = by.get(v.channelId) ?? by.set(v.channelId, { n: 0, minutes: [], recent: [] }).get(v.channelId)!;
      c.n++;
      const d = v.publishedAt?.slice(0, 10);
      if (d && (!c.first || d < c.first)) c.first = d;
      if (d && (!c.last || d > c.last)) c.last = d;
      if (v.minutes) c.minutes.push(v.minutes);
      c.recent.push({ id: v.id, title: v.title, ...(d ? { date: d } : {}), ...(v.minutes ? { minutes: v.minutes } : {}) });
      if (c.recent.length > 60) { c.recent.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')); c.recent.length = 30; }
      if (verdictIds.has(v.id)) chanOfVid.set(v.id, v.channelId);
    }
    for (const c of by.values()) c.recent = c.recent.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')).slice(0, 30);
    dump = { sig: mt(f), by, chanOfVid };
  })().finally(() => { dumpLoading = undefined; });
}

// ─── список каналов ───────────────────────────────────────────────────────────
interface Chan {
  id: string; channelId?: string; handle?: string; title: string; url: string;
  registry?: RegLine; tier: Tier; medium: 'film' | 'book'; via?: 'links'; lists?: boolean; language?: 'en'; focus: string[]; note?: string;
}
function channels(): Chan[] {
  const meta = readJson<Record<string, ChannelMeta>>(at(CHANNELS), {});
  const reg = readRegistry();
  const byHandle = new Map(reg.map((r) => [r.handle.toLowerCase(), r]));
  const excluded = excludedChannels();
  const out: Chan[] = [];
  const used = new Set<RegLine>();
  for (const [id, m] of Object.entries(meta)) {
    if (isExcluded({ channelId: id, handle: m.handle, title: m.title }, excluded)) continue;
    const r = m.handle ? byHandle.get(m.handle.toLowerCase()) : undefined;
    if (r) used.add(r);
    out.push(merge(id, m, r));
  }
  for (const r of reg) if (!used.has(r) && !isExcluded({ handle: r.handle, title: r.title }, excluded)) out.push(merge(undefined, undefined, r));
  return out;
}
function merge(channelId: string | undefined, m: ChannelMeta | undefined, r: RegLine | undefined): Chan {
  const handle = r?.handle ?? m?.handle;
  // ярус — из реестра; нет там — как его понимает обход (канал первого круга — эссеист)
  const tier: Tier = r ? r.tier ?? (r.via ? 'review' : 'essay') : m?.tier ?? 'essay';
  return {
    id: channelId ?? `h:${handle}`, ...(channelId ? { channelId } : {}), ...(handle ? { handle } : {}),
    title: m?.title ?? r?.title ?? handle ?? channelId ?? '?',
    url: handle ? `https://www.youtube.com/@${handle}` : `https://www.youtube.com/channel/${channelId}`,
    ...(r ? { registry: r } : {}), tier, medium: r?.medium ?? m?.medium ?? 'film',
    ...((r ? r.via : m?.via) ? { via: 'links' as const } : {}), ...(r?.lists ? { lists: true } : {}),
    ...((r?.language ?? m?.language) ? { language: 'en' as const } : {}), focus: r?.focus ?? [], ...(r?.note ? { note: r.note } : {}),
  };
}

type Cov = { channel: string; dump: number; linked: number; human: number; evidence: number; none: number; precision?: number; measured?: number; expectedErrors?: number; status?: string };
const coverageBy = () => new Map(readJson<{ channels?: Cov[] }>(at('.cache/markup-coverage.json'), {}).channels?.map((c) => [c.channel, c]) ?? []);

function list() {
  loadDump();
  const linked = linkedBy();
  const cov = coverageBy();
  const prec = readPrecision();
  const profiles = readProfiles();
  return {
    dumpReady: Boolean(dump), at: new Date().toISOString(),
    channels: channels().map((c) => {
      const l = linked.get(c.title) ?? [];
      const cv = cov.get(c.title);
      return {
        id: c.id, title: c.title, handle: c.handle, url: c.url, tier: c.tier, medium: c.medium, via: c.via, lists: c.lists, language: c.language,
        inRegistry: Boolean(c.registry), note: c.note,
        dump: dump?.by.get(c.channelId ?? '')?.n ?? cv?.dump, linked: l.length, shown: l.filter((x) => x.a.tier !== 'review').length,
        human: cv?.human, none: cv?.none, precision: cv?.precision, measured: cv?.measured, expectedErrors: cv?.expectedErrors,
        weak: prec?.weak.some((k) => k.startsWith(`${c.title}|`)) || undefined, trusted: prec?.trusted.some((k) => k.startsWith(`${c.title}|`)) || undefined,
        // какими способами опознаватель у канала ошибается — подсказка у числа точности (06.10)
        weakHow: prec?.weak.filter((k) => k.startsWith(`${c.title}|`)).map((k) => k.slice(c.title.length + 1)),
        focus: c.focus.length || (profiles[c.title]?.focus?.length ?? 0) ? true : undefined,
      };
    }),
  };
}

// ─── профиль канала ───────────────────────────────────────────────────────────
const VERDICT_RU = (v: Verdict): string => v.key ? (v.guess ? 'догадка пульта' : 'фильм верен') : v.why === 'не про фильм' ? 'не о фильме'
  : v.why === 'не тот фильм' ? 'не тот фильм' : v.why ?? 'снято';
async function profile(id: string) {
  loadDump();
  const c = channels().find((x) => x.id === id);
  if (!c) return undefined;
  const l = linkedBy().get(c.title) ?? [];
  const films = new Map<string, number>();
  for (const x of l) films.set(x.key, (films.get(x.key) ?? 0) + 1);
  const topFilms = await Promise.all([...films].sort((a, b) => b[1] - a[1]).slice(0, 24).map(async ([key, n]) => ({ key, title: await titleOf(key), n })));
  const ev = new Map<string, number>();
  for (const x of l) { const k = x.a.evidence ?? (x.a.unverified ? 'none' : 'human'); ev.set(k, (ev.get(k) ?? 0) + 1); }
  const prec = readPrecision();
  const pairs = Object.entries(prec?.pair ?? {}).filter(([k]) => k.startsWith(`${c.title}|`))
    .map(([k, s]) => ({ method: k.slice(c.title.length + 1), ...s, trusted: prec!.trusted.includes(k), weak: prec!.weak.includes(k) }));
  const p = readProfiles()[c.title];
  const named = (kind: 'universe' | 'person', xs: [string, number][] = []) => xs.map(([q, share]) => ({ id: q, kind, share, title: aboutTitle(kind, q) ?? q }));
  const rub = readJson<{ counts?: Record<string, Record<string, number>> }>(at('.cache/rubrics.json'), {}).counts?.[c.title] ?? {};
  const pl = readJson<{ channels?: Record<string, { at?: string; playlists?: { id: string; title: string; count: number; target?: { kind: string; title?: string } }[] }> }>(at('.cache/youtube/playlists.json'), {}).channels?.[c.channelId ?? ''];
  const d = dump?.by.get(c.channelId ?? '');
  const verdicts = readJson<{ videos?: Record<string, Verdict> }>(at('tools/markup-verdicts.json'), {}).videos ?? {};
  const linkedVid = new Map(l.map((x) => [vidOf(x.a.url), x]));
  const decided = new Map<string, number>();
  if (dump) for (const [vid, v] of Object.entries(verdicts)) {
    if (dump.chanOfVid.get(vid) !== c.channelId && !linkedVid.has(vid)) continue;
    const k = VERDICT_RU(v);
    decided.set(k, (decided.get(k) ?? 0) + 1);
  }
  const med = d?.minutes.length ? [...d.minutes].sort((a, b) => a - b)[Math.floor(d.minutes.length / 2)] : undefined;
  const recent = await Promise.all((d?.recent ?? []).slice(0, 20).map(async (r) => {
    const x = linkedVid.get(r.id);
    const v = verdicts[r.id];
    return { ...r, ...(x ? { film: await titleOf(x.key), tier: x.a.tier, evidence: x.a.evidence ?? (x.a.unverified ? 'none' : 'human') } : {}), ...(v ? { verdict: VERDICT_RU(v) } : {}) };
  }));
  return {
    channel: { ...c, registry: c.registry ? { line: c.registry.line } : undefined },
    focusTitles: c.focus.map((q) => ({ id: q, title: aboutTitle('universe', q) ?? aboutTitle('person', q) ?? q })),
    cov: coverageBy().get(c.title),
    dump: d ? { n: d.n, first: d.first, last: d.last, medianMinutes: med } : undefined, dumpReady: Boolean(dump),
    linked: l.length, shown: l.filter((x) => x.a.tier !== 'review').length, evidence: Object.fromEntries(ev), decided: Object.fromEntries(decided),
    pairs, topFilms,
    profile: p ? { n: p.n, universes: named('universe', p.universes), persons: named('person', p.persons), focus: p.focus ?? [], dominant: p.dominant ?? [] } : undefined,
    rubrics: Object.entries(rub).sort((a, b) => b[1] - a[1]).slice(0, 12),
    playlists: (pl?.playlists ?? []).slice(0, 40).map((x) => ({ id: x.id, title: x.title, count: x.count, target: x.target?.title })),
    playlistsAt: pl?.at,
    recent,
  };
}

// ─── сохранение статуса ───────────────────────────────────────────────────────
interface Patch { tier?: Tier; medium?: 'film' | 'book'; voice?: boolean; lists?: boolean; language?: boolean; focus?: string[]; note?: string }
/** Ник канала по id — у каналов первого круга (найдены по разборам) его в channels.json нет, а реестр
 *  держит каналы по нику. Ключ YouTube — из .env.local (его загружает pipeline.mts). */
async function handleOf(channelId: string): Promise<string | undefined> {
  const key = process.env.YT_API_KEY;
  if (!key) return undefined;
  const r = await fetch(`https://www.googleapis.com/youtube/v3/channels?${new URLSearchParams({ part: 'snippet', id: channelId, key })}`).catch(() => undefined);
  const j = r?.ok ? await r.json() as { items?: { snippet?: { customUrl?: string } }[] } : undefined;
  return j?.items?.[0]?.snippet?.customUrl?.replace(/^@/, '');
}

async function save(id: string, p: Patch): Promise<{ changed: boolean; added: boolean; error?: string }> {
  const c = channels().find((x) => x.id === id);
  if (!c) return { changed: false, added: false, error: 'канал не найден' };
  if (!c.handle && c.channelId) c.handle = await handleOf(c.channelId);
  if (!c.handle) return { changed: false, added: false, error: process.env.YT_API_KEY ? 'YouTube не назвал ник канала — строку в реестре по нему не завести' : 'у канала нет ника, а узнать его нужен YT_API_KEY в .env.local' };
  const tier = p.tier ?? c.tier;
  const medium = p.medium ?? c.medium;
  const via = (p.voice ?? !c.via) ? undefined : 'links';
  const lists = p.lists ?? Boolean(c.lists);
  const language = (p.language ?? c.language === 'en') ? 'en' : undefined;
  const focus = (p.focus ?? c.focus).filter((q) => /^Q\d+$/.test(q));
  const note = (p.note ?? c.note ?? '').replace(/\s+/g, ' ').trim();
  const q = (x: string) => `'${x.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  const tail = `, tier: '${tier}'${medium === 'book' ? ", medium: 'book'" : ''}${lists ? ', lists: true' : ''}${language ? ", language: 'en'" : ''}`
    + `${focus.length ? `, focus: [${focus.map(q).join(', ')}]` : ''}${via ? ", via: 'links'" : ''} },${note ? ` // ${note}` : ''}`;
  let src = readFileSync(REGISTRY, 'utf8');
  let added = false;
  if (c.registry) {
    const old = c.registry.text;
    const body = old.replace(/\s*\},\s*(\/\/.*)?$/, '')
      .replace(/,\s*tier: '(?:essay|review)'/, '').replace(/,\s*medium: '(?:film|book)'/, '').replace(/,\s*lists: true/, '')
      .replace(/,\s*language: '[a-z]+'/, '').replace(/,\s*focus: \[[^\]]*\]/, '').replace(/,\s*via: 'links'/, '');
    const line = `${body}${tail}`;
    if (line === old) return { changed: false, added: false };
    const lines = src.split('\n');
    if (lines[c.registry.line - 1] !== old) return { changed: false, added: false, error: 'sources.ts поменялся с тех пор, как открыта страница — обновите' };
    lines[c.registry.line - 1] = line;
    src = lines.join('\n');
  } else {
    if (!src.includes(DESK_MARK)) src = src.replace(LINKS_MARK, `${DESK_MARK}\n${LINKS_MARK}`);
    const line = sourceLine({ handle: c.handle, title: c.title, tier, medium }).replace(/\s*\},$/, '').replace(/, tier: '(?:essay|review)'(, medium: 'book')?/, '') + tail;
    src = src.replace(DESK_MARK, `${DESK_MARK}\n${line}`);
    added = true;
  }
  // реестр (06.10): в базу приложения и снимком в sources.ts — tools/registry-lib.mts
  await saveSourcesText(src, 'desk');
  // зеркало для индекса разборов: он берёт ярус из channels.json, а обход перепишет его тем же из реестра
  if (c.channelId) {
    const meta = readJson<Record<string, ChannelMeta>>(at(CHANNELS), {});
    const m = meta[c.channelId];
    if (m) {
      const next: ChannelMeta = { handle: c.handle, title: m.title, tier, medium, ...(via ? { via } : {}), ...(language ? { language } : {}) };
      meta[c.channelId] = next;
      writeAtomic(at(CHANNELS), JSON.stringify(meta, null, 1));
    }
  }
  return { changed: true, added };
}

/** Убрать канал из выборки совсем: строка в channels-excluded.json и удаление строки реестра. */
async function exclude(id: string, why: string): Promise<{ ok: boolean; error?: string }> {
  const c = channels().find((x) => x.id === id);
  if (!c) return { ok: false, error: 'канал не найден' };
  const body = readJson<{ channels?: { handle?: string; channelId?: string; title?: string; why?: string }[] } & Record<string, unknown>>(EXCLUDED, {});
  body.channels = [...(body.channels ?? []), { ...(c.handle ? { handle: c.handle } : {}), ...(c.channelId ? { channelId: c.channelId } : {}), title: c.title, why: why || 'убран в пульте' }];
  await saveExcluded(body, 'desk');
  if (c.registry) {
    const lines = readFileSync(REGISTRY, 'utf8').split('\n');
    if (lines[c.registry.line - 1] === c.registry.text) { lines.splice(c.registry.line - 1, 1); await saveSourcesText(lines.join('\n'), 'desk'); }
  }
  return { ok: true };
}

// ─── http ─────────────────────────────────────────────────────────────────────
const send = (res: ServerResponse, code: number, body: unknown, type = 'application/json; charset=utf-8') => {
  res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
};
const readBody = (req: IncomingMessage): Promise<string> => new Promise((ok, fail) => {
  const chunks: Buffer[] = [];
  req.on('data', (c: Buffer) => chunks.push(c));
  req.on('end', () => ok(Buffer.concat(chunks).toString('utf8')));
  req.on('error', fail);
});

/** Вкладка общего пульта: `path` — адрес внутри вкладки. Хост и x-desk проверил tools/desk.mts. */
export async function channelsRoute(req: IncomingMessage, res: ServerResponse, path: string): Promise<void> {
  // общий пульт передаёт путь без строки запроса — параметры берём из полного адреса
  const u = new URL(path, 'http://x');
  const params = new URL(req.url ?? '/', 'http://x').searchParams;
  if (req.method === 'GET') {
    if (u.pathname === '/') return send(res, 200, readFileSync(PAGE, 'utf8'), 'text/html; charset=utf-8');
    if (u.pathname === '/api/list') return send(res, 200, list());
    if (u.pathname === '/api/channel') {
      const p = await profile(params.get('id') ?? '');
      return p ? send(res, 200, p) : send(res, 404, { error: 'not_found' });
    }
    if (u.pathname === '/api/about') {
      const q = params.get('q') ?? '';
      return send(res, 200, [...searchAbout('universe', q, 8), ...searchAbout('person', q, 8)]);
    }
    if (u.pathname === '/api/run') return send(res, 200, { run: runState() });
    return send(res, 404, { error: 'not_found' });
  }
  const body = JSON.parse((await readBody(req)) || '{}') as Record<string, unknown>;
  if (u.pathname === '/api/save') {
    const focus = Array.isArray(body.focus) ? body.focus.map(String).map((x) => (/^Q\d+$/.test(x) ? x
      : aboutByLabel('universe', x)?.id ?? aboutByLabel('person', x)?.id ?? '')).filter(Boolean) : undefined;
    const patch: Patch = {
      ...(body.tier === 'essay' || body.tier === 'review' ? { tier: body.tier } : {}),
      ...(body.medium === 'film' || body.medium === 'book' ? { medium: body.medium } : {}),
      ...(typeof body.voice === 'boolean' ? { voice: body.voice } : {}), ...(typeof body.lists === 'boolean' ? { lists: body.lists } : {}),
      ...(typeof body.language === 'boolean' ? { language: body.language } : {}), ...(focus ? { focus } : {}),
      ...(typeof body.note === 'string' ? { note: body.note } : {}),
    };
    const r = await save(String(body.id ?? ''), patch);
    return send(res, r.error ? 400 : 200, r);
  }
  if (u.pathname === '/api/exclude') {
    const r = await exclude(String(body.id ?? ''), String(body.why ?? ''));
    return send(res, r.error ? 400 : 200, r);
  }
  if (u.pathname === '/api/reindex') {
    try { startRun(['index']).catch((e) => console.error('прогон:', (e as Error).message)); } catch (e) { return send(res, 409, { error: (e as Error).message }); }
    return send(res, 200, { run: runState() });
  }
  return send(res, 404, { error: 'not_found' });
}
