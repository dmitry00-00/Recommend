// Вкладка «Запросы» общего пульта (tools/desk.mts, http://127.0.0.1:8721/asks/) — 21.10.
//
// Просьбы «посоветуйте что посмотреть» из Telegram (ТВ-12а): что люди просят, что им уже понравилось, что им
// советуют в ответах, каких названий нет в справочнике, и профили зрителей (Кинопоиск, Letterboxd, Trakt, Кинориум)
// — адресаты для личных подборок (ЗП-46). Данные — файлы tools/tg-asks.mts: .cache/tg-asks/pairs.json (свод),
// found.json (снимок находок шлюза). Отсюда же — пересчёт свода (`--match-only`: ни модели, ни шлюза) и полный
// прогон (находки шлюза → разметка локальной моделью → свод), по одному за раз; лог — .cache/tg-asks/desk-run.log.
//
// Хост и заголовок x-desk проверяет общий пульт.
import type { IncomingMessage, ServerResponse } from 'node:http';
import { spawn, type ChildProcess } from 'node:child_process';
import { createWriteStream, existsSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const DIR = new URL('../.cache/tg-asks/', import.meta.url);
const PAGE = new URL('./asks-desk.html', import.meta.url);
const LOG = new URL('desk-run.log', DIR);
const send = (res: ServerResponse, code: number, body: unknown, type = 'application/json; charset=utf-8') => {
  res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
};

interface Ref { title: string; key?: string }
interface Ask { id: string; channel: string; msg_id: number; date?: string; text: string; replies?: number; want?: string;
  liked: Ref[]; notWanted?: Ref[]; offered?: Ref[]; advice: (Ref & { n: number })[]; answers: number }
interface Pairs { built: string; kinds: Record<string, number>; asks: Ask[]; pairs: { liked: string; advised: string; n: number }[];
  advised: Record<string, number>; unknown: Record<string, number> }
interface Found { kind: string; query?: string; channel: string; title?: string; msg_id: number; parent_id?: number; date?: string; text?: string; replies?: number }

// файлы большие (found.json — мегабайты): перечитываем, только когда они поменялись
const memo = new Map<string, { stamp: string; value: unknown }>();
function readCached<T>(name: string): T | undefined {
  const url = new URL(name, DIR);
  if (!existsSync(url)) return undefined;
  const st = statSync(url);
  const stamp = `${st.mtimeMs}:${st.size}`;
  const hit = memo.get(name);
  if (hit?.stamp === stamp) return hit.value as T;
  const value = JSON.parse(readFileSync(url, 'utf8')) as T;
  memo.set(name, { stamp, value });
  return value;
}

const PROFILE = /https?:\/\/(?:www\.)?(?:kinopoisk\.ru\/user\/\d+|letterboxd\.com\/[\w.-]+|trakt\.tv\/users\/[\w.-]+|kinorium\.com\/user\/\d+)\/?/gi;
const site = (url: string) => /kinopoisk/.test(url) ? 'Кинопоиск' : /letterboxd/.test(url) ? 'Letterboxd' : /trakt/.test(url) ? 'Trakt' : 'Кинориум';

function data() {
  const p = readCached<Pairs>('pairs.json');
  if (!p) return { error: 'свода ещё нет: нажмите «Забрать новое и разметить» или запустите npx tsx tools/tg-asks.mts' };
  const found = readCached<Found[]>('found.json') ?? [];
  const labels = readCached<{ items: Record<string, unknown> }>('labels.json');
  // названия ключей — из самих просьб: у каждой ссылки на справочник есть и ключ, и название
  const title: Record<string, string> = {};
  for (const a of p.asks) for (const r of [...a.liked, ...a.advice, ...(a.offered ?? []), ...(a.notWanted ?? [])]) if (r.key && !title[r.key]) title[r.key] = r.title;
  // профили зрителей: один человек — один профиль, свежее сообщение главнее
  const profiles = new Map<string, { url: string; site: string; ru: boolean; channel: string; channelTitle?: string; date?: string; text: string; link: string }>();
  for (const f of found) {
    for (const m of (f.text ?? '').matchAll(PROFILE)) {
      const url = m[0].replace(/\/$/, '');
      // служебные разделы Letterboxd — не профиль человека: /film/…, /films/, /lists/ и т. п.
      if (/letterboxd\.com\/(?:film|films|lists?|journal|members|search|about|pro|tag|actor|director|crew|people|showdown|year)$/i.test(url)) continue;
      const prev = profiles.get(url.toLowerCase());
      if (prev && (prev.date ?? '') >= (f.date ?? '')) continue;
      // русскоязычный адресат: Кинопоиск и Кинориум — всегда, остальные — по кириллице в сообщении или названии канала
      const ru = /kinopoisk|kinorium/i.test(url) || /[а-яё]/i.test(`${f.text ?? ''} ${f.title ?? ''}`);
      profiles.set(url.toLowerCase(), { url, site: site(url), ru, channel: f.channel, channelTitle: f.title, date: f.date,
        text: (f.text ?? '').replace(/\s+/g, ' ').trim().slice(0, 240), link: link(f.channel, f.msg_id, f.parent_id) });
    }
  }
  const queries: Record<string, number> = {};
  for (const f of found) if (f.kind === 'posts' && f.query) queries[f.query] = (queries[f.query] ?? 0) + 1;
  return {
    built: p.built,
    foundAt: existsSync(new URL('found.json', DIR)) ? statSync(new URL('found.json', DIR)).mtime.toISOString() : null,
    counts: { found: found.length, labelled: labels ? Object.keys(labels.items).length : 0 },
    kinds: p.kinds,
    queries,
    asks: p.asks.map((a) => ({ ...a, link: link(a.channel, a.msg_id) })),
    pairs: p.pairs.map((x) => ({ ...x, likedTitle: title[x.liked] ?? x.liked, advisedTitle: title[x.advised] ?? x.advised })),
    advised: Object.entries(p.advised).sort((a, b) => b[1] - a[1]).slice(0, 80).map(([key, n]) => ({ key, title: title[key] ?? key, n })),
    unknown: Object.entries(p.unknown).sort((a, b) => b[1] - a[1]).slice(0, 120).map(([t, n]) => ({ title: t, n })),
    profiles: [...profiles.values()].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')),
    run: runState(),
  };
}

/** Ссылка на пост публичного канала; у комментария — на пост с открытым обсуждением. */
function link(channel: string, msg: number, parent?: number): string {
  return parent ? `https://t.me/${channel}/${parent}?comment=${msg}` : `https://t.me/${channel}/${msg}`;
}

// ─── прогон tools/tg-asks.mts ────────────────────────────────────────────────
let child: ChildProcess | undefined;
let run: { mode: string; startedAt: string; finishedAt?: string; code?: number | null } | undefined;
function runState() {
  const tail = existsSync(LOG) ? readFileSync(LOG, 'utf8').trimEnd().split('\n').slice(-6) : [];
  return { ...(run ?? {}), running: Boolean(child), tail };
}
function start(mode: 'match' | 'full'): { ok: boolean; error?: string } {
  if (child) return { ok: false, error: 'прогон уже идёт' };
  const args = ['tsx', 'tools/tg-asks.mts', ...(mode === 'match' ? ['--match-only'] : ['--minutes', '30'])];
  const out = createWriteStream(LOG);
  out.write(`# ${new Date().toISOString()} npx ${args.join(' ')}\n`);
  child = spawn('npx', args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout?.pipe(out, { end: false });
  child.stderr?.pipe(out, { end: false });
  run = { mode, startedAt: new Date().toISOString() };
  child.on('close', (code) => { run = { ...run!, finishedAt: new Date().toISOString(), code }; child = undefined; out.end(); });
  child.on('error', (e) => { out.write(`${e.message}\n`); });
  return { ok: true };
}

export async function asksRoute(req: IncomingMessage, res: ServerResponse, path: string): Promise<void> {
  if ((path === '/' || path === '/index.html') && req.method === 'GET') return send(res, 200, readFileSync(PAGE, 'utf8'), 'text/html; charset=utf-8');
  if (path === '/api/data' && req.method === 'GET') {
    try { return send(res, 200, data()); } catch (e) { return send(res, 500, { error: (e as Error).message }); }
  }
  if (path === '/api/run' && req.method === 'GET') return send(res, 200, runState());
  if (path === '/api/run' && req.method === 'POST') {
    const mode = new URL(req.url ?? '/', 'http://x').searchParams.get('mode') === 'full' ? 'full' : 'match';
    const r = start(mode);
    return send(res, r.ok ? 200 : 409, { ...r, run: runState() });
  }
  return send(res, 404, { error: 'not_found' });
}
