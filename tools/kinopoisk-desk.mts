// Пульт импорта с Кинопоиска — вкладка «Оценки Кинопоиска» общего пульта (tools/desk.mts,
// http://127.0.0.1:8721/kinopoisk/): бросаешь страницы профилей
// (сразу от нескольких людей, можно папками), пульт раскладывает их по профилям, ты вписываешь
// ник Telegram, «Собрать» → seeds/<ник>.json, «Отправить» → сервер. Запуск двойным щелчком —
// deploy/desk.command (или deploy/kinopoisk-desk.command — сразу на эту вкладку).
// Слушает только 127.0.0.1; меняющие запросы — только со своей страницы (заголовок x-desk и
// Host) — это проверяет общий пульт: чужой сайт в браузере не отправит сид от имени владельца.
// Сырые страницы в память не кладутся: из запроса сразу разбор, дальше — только записи.
// Ник для профиля Кинопоиска запоминается (.cache/kinopoisk-profiles.json, вне git): кто
// прислал страницы второй раз, узнаётся сам.
import type { IncomingMessage, ServerResponse } from 'node:http';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import {
  buildSeed, mergeRecords, pagesReport, publishSeed, readPage, SEEDS, seedSummary, validNick,
  type Page, type Progress, type Published, type SeedResult,
} from './kinopoisk-seed.mts';

const PROFILES = '.cache/kinopoisk-profiles.json';
const remembered: Record<string, string> = existsSync(PROFILES) ? JSON.parse(readFileSync(PROFILES, 'utf8')) : {};
const remember = (profile: string, nick: string) => {
  remembered[profile] = nick;
  mkdirSync('.cache', { recursive: true });
  writeFileSync(PROFILES, JSON.stringify(remembered, null, 2));
};

type Status = 'new' | 'queued' | 'running' | 'built' | 'publishing' | 'published' | 'error';
interface Group {
  id: string;
  profile?: string;
  /** подпись для глаз: имя из заголовка сохранённой страницы («Адо 3 — Оценки…» → «Адо») */
  label: string;
  pages: Page[];
  nick: string;
  status: Status;
  message?: string;
  progress?: Progress;
  result?: SeedResult;
  published?: Published;
}
const groups = new Map<string, Group>();
let seq = 0;

const labelOf = (file: string) =>
  file.replace(/\.[a-z]+$/i, '').replace(/\s+—.*$/, '').replace(/[\s_-]*\d+$/, '').trim() || file;

function addFiles(files: { name: string; text: string }[]): { added: number; unrecognized: string[] } {
  const unrecognized: string[] = [];
  let loose: Group | undefined; // файлы без профиля (старая страница, CSV) — одной кучкой на загрузку
  let added = 0;
  for (const f of files) {
    const page = readPage(f.name, f.text);
    if (!page) { unrecognized.push(f.name); continue; }
    added++;
    let g: Group | undefined;
    if (page.profile) {
      g = groups.get(`p:${page.profile}`);
      if (!g) {
        g = { id: `p:${page.profile}`, profile: page.profile, label: labelOf(f.name), pages: [], nick: remembered[page.profile] ?? '', status: 'new' };
        groups.set(g.id, g);
      }
    } else {
      if (!loose) { loose = { id: `f:${++seq}`, label: labelOf(f.name), pages: [], nick: '', status: 'new' }; groups.set(loose.id, loose); }
      g = loose;
    }
    // та же страница второй раз (пересохранили) — заменяет прежнюю
    const same = g.pages.findIndex((p) => (page.page != null && p.page === page.page) || p.name === page.name);
    if (same >= 0) g.pages[same] = page; else g.pages.push(page);
    if (g.status !== 'queued' && g.status !== 'running') { g.status = 'new'; g.result = undefined; g.published = undefined; g.message = undefined; }
  }
  return { added, unrecognized };
}

// ─── очередь сборки: по одному, Wikidata и так ограничена разом в секунду ─────
const queue: Group[] = [];
let busy = false;
async function pump() {
  if (busy) return;
  busy = true;
  while (queue.length) {
    const g = queue.shift()!;
    if (!groups.has(g.id)) continue;
    g.status = 'running'; g.message = undefined; g.progress = undefined;
    try {
      g.result = await buildSeed(g.nick, mergeRecords(g.pages), { progress: (p) => { g.progress = p; } });
      g.status = 'built';
      if (g.profile) remember(g.profile, g.nick);
    } catch (err) {
      g.status = 'error'; g.message = (err as Error).message;
    }
    g.progress = undefined;
  }
  busy = false;
}
function enqueue(g: Group): string | undefined {
  if (!validNick(g.nick)) return 'нужен ник Telegram: латиница, цифры, подчёркивание';
  const clash = [...groups.values()].find((o) => o !== g && o.nick.toLowerCase() === g.nick.toLowerCase());
  if (clash) return `этот ник уже у «${clash.label}»`;
  if (g.status === 'queued' || g.status === 'running') return undefined;
  g.status = 'queued'; g.message = undefined;
  queue.push(g);
  void pump();
  return undefined;
}
async function publish(g: Group) {
  g.status = 'publishing'; g.message = undefined;
  try { g.published = await publishSeed(g.nick); g.status = 'published'; } catch (err) { g.status = 'error'; g.message = (err as Error).message; }
}

// ─── состояние для страницы ───────────────────────────────────────────────────
function state() {
  return {
    env: {
      tmdb: Boolean(process.env.TMDB_API_KEY || process.env.VITE_TMDB_API_KEY),
      admin: Boolean(process.env.TM_ADMIN_TOKEN),
      server: (process.env.TM_SERVER ?? 'https://bot-1791394986-4062-dmitriy-00.bothost.tech').replace(/\/+$/, ''),
    },
    groups: [...groups.values()].map((g) => {
      const records = mergeRecords(g.pages);
      return {
        id: g.id, label: g.label, nick: g.nick, status: g.status, message: g.message, progress: g.progress,
        files: g.pages.length, report: pagesReport(g.pages),
        records: records.length,
        films: records.filter((r) => r.type === 'film').length,
        series: records.filter((r) => r.type === 'series').length,
        rated: records.filter((r) => r.rating).length,
        result: g.result, published: g.published,
        seed: validNick(g.nick) ? seedSummary(g.nick) : undefined,
      };
    }),
    seeds: existsSync(SEEDS)
      ? readdirSync(SEEDS).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).sort((a, b) => a.localeCompare(b))
        .map((nick) => ({ nick, ...seedSummary(nick)! }))
      : [],
  };
}

// ─── http ─────────────────────────────────────────────────────────────────────
const send = (res: ServerResponse, code: number, body: unknown, type = 'application/json; charset=utf-8') => {
  res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
};
const readBody = (req: IncomingMessage): Promise<string> => new Promise((ok, fail) => {
  const chunks: Buffer[] = [];
  let size = 0;
  req.on('data', (c: Buffer) => { size += c.length; if (size > 200 * 1024 * 1024) req.destroy(new Error('слишком много')); else chunks.push(c); });
  req.on('end', () => ok(Buffer.concat(chunks).toString('utf8')));
  req.on('error', fail);
});
const PAGE = new URL('./kinopoisk-desk.html', import.meta.url);

/** Вкладка общего пульта: `path` — адрес внутри вкладки («/», «/api/state»…). Хост и заголовок x-desk
 *  уже проверил tools/desk.mts. */
export async function kinopoiskRoute(req: IncomingMessage, res: ServerResponse, path: string): Promise<void> {
  const url = { pathname: path };
  if (req.method === 'GET' && url.pathname === '/') return send(res, 200, readFileSync(PAGE, 'utf8'), 'text/html; charset=utf-8');
  if (req.method === 'GET' && url.pathname === '/api/state') return send(res, 200, state());
  if (req.method !== 'POST') return send(res, 404, { error: 'not_found' });

  try {
    const body = JSON.parse((await readBody(req)) || '{}') as Record<string, unknown>;
    if (url.pathname === '/api/files') {
      return send(res, 200, { ...addFiles(body.files as { name: string; text: string }[]), state: state() });
    }
    if (url.pathname === '/api/build-all') {
      const errors = [...groups.values()].filter((g) => g.status === 'new' || g.status === 'error')
        .map((g) => { const e = enqueue(g); return e && `${g.label}: ${e}`; }).filter(Boolean);
      return send(res, 200, { errors, state: state() });
    }
    if (url.pathname === '/api/publish-all') {
      await Promise.all([...groups.values()].filter((g) => g.status === 'built').map(publish));
      return send(res, 200, { state: state() });
    }
    const seedMatch = url.pathname.match(/^\/api\/seed\/([A-Za-z0-9_]+)\/publish$/);
    if (seedMatch) {
      try { return send(res, 200, { published: await publishSeed(seedMatch[1]), state: state() }); }
      catch (err) { return send(res, 200, { error: (err as Error).message, state: state() }); }
    }
    const m = url.pathname.match(/^\/api\/group\/([^/]+)\/(nick|build|publish|remove)$/);
    const g = m ? groups.get(decodeURIComponent(m[1])) : undefined;
    if (!m || !g) return send(res, 404, { error: 'not_found' });
    let error: string | undefined;
    if (m[2] === 'nick') {
      const nick = String(body.nick ?? '').trim().replace(/^@/, '');
      if (g.nick !== nick) { g.nick = nick; if (g.status !== 'queued' && g.status !== 'running') { g.status = 'new'; g.result = undefined; g.published = undefined; } }
    } else if (m[2] === 'build') error = enqueue(g);
    else if (m[2] === 'publish') await publish(g);
    else if (g.status !== 'running') groups.delete(g.id);
    return send(res, 200, { error, state: state() });
  } catch (err) {
    return send(res, 400, { error: (err as Error).message });
  }
}
