// Пульт ссылок — вкладка «Ссылки» общего пульта (tools/desk.mts, http://127.0.0.1:8721/links/): вставляешь накопленные заметки со ссылками
// (сотни сразу: ролики к фильмам, каналы обзорщиков и эссеистов), пульт раскладывает их, угадывает
// фильм, показывает, что уже размечено, и по «Сохранить» пишет:
//   · ролики → tools/markup-verdicts.json (как ручная разметка из таблицы, `from: 'desk'`) — их
//     подхватывают индекс разборов и таблица разметки; фильм, которого у нас нет, — «нет у нас»
//     с названием: его опознает tools/resolve-markup-films.mts на следующем круге markup-sync;
//   · каналы → src/mocks/sources.ts (ярус и предмет — выбором на странице).
// Запуск двойным щелчком — deploy/desk.command (или deploy/links-desk.command — сразу на эту вкладку).
// Хост и заголовок x-desk проверяет общий пульт.
import type { IncomingMessage, ServerResponse } from 'node:http';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { loadEnvFile } from './env-file.mts';
import { worksIndex } from './works-index.mts';
import { bestByTitle } from './match-videos.mts';
import { oembed, recalled, videosApi, type VideoMeta } from './youtube.mts';
import { filmOptions, matchFilm, parsePaste, sourceLine, titleMentions } from './links-desk-lib.mts';
import { sources } from '../src/mocks/sources.ts';

loadEnvFile();
const YT = process.env.YT_API_KEY;
const VERDICTS = new URL('./markup-verdicts.json', import.meta.url);
const REGISTRY = new URL('../src/mocks/sources.ts', import.meta.url);
const DESK_MARK = '  // ── каналы из пульта ссылок: tools/links-desk.mts дописывает сюда ──';
const LINKS_MARK = '  // ── каналы из ссылок владельца: tools/register-link-channels.mts дописывает сюда ──';

const ours = worksIndex();
const films = filmOptions(worksIndex({ all: true }));
const byKey = new Map(films.map((f) => [f.key, f]));
const byLabel = new Map(films.map((f) => [f.label.toLowerCase(), f]));

type Verdict = { key: string | null; film?: string; why?: string; from?: string; guess?: boolean; at?: string; title?: string };
const readVerdicts = (): { body: Record<string, unknown>; videos: Record<string, Verdict> } => {
  const body = existsSync(VERDICTS) ? JSON.parse(readFileSync(VERDICTS, 'utf8')) as Record<string, unknown> : {};
  return { body, videos: (body.videos ?? {}) as Record<string, Verdict> };
};

// ─── состояние пульта ─────────────────────────────────────────────────────────
interface Item {
  id: string; url: string; line: number;
  /** что написано в заметках рядом со ссылкой */
  typed?: string; year?: number;
  /** выбранный фильм: ключ справочника или null — «нет у нас», тогда `film` — название как есть */
  key?: string | null; film?: string;
  how?: 'notes' | 'title' | 'manual' | 'none';
  options: { key: string; label: string }[];
  meta?: VideoMeta;
  /** уже в разметке */
  existing?: { key: string | null; film?: string };
  saved?: boolean;
}
interface Chan {
  id: string; handle?: string; channelId?: string; url: string; line: number;
  title?: string; tier: 'essay' | 'review'; medium: 'film' | 'book'; include: boolean;
  existing?: { title: string; tier?: string; medium?: string; via?: string };
  error?: string; saved?: boolean;
}
const items = new Map<string, Item>();
const chans = new Map<string, Chan>();
let metaBusy = 0;
let chanBusy = 0;

function placeFilm(it: Item): void {
  if (!it.typed) return;
  const m = matchFilm(it.typed, it.year, films);
  it.options = m.options.map((o) => ({ key: o.key, label: o.label }));
  if (m.pick) { it.key = m.pick.key; it.film = m.pick.label; it.how = 'notes'; }
  else { it.key = null; it.film = it.year ? `${it.typed} (${it.year})` : it.typed; it.how = 'notes'; }
}

/** Названия роликов: кэш, потом YouTube API (50 за запрос) или oEmbed по одному; и догадка фильма
 *  по названию у роликов, к которым в заметках фильма нет. */
async function fetchMeta(ids: string[]): Promise<void> {
  metaBusy += ids.length;
  try {
    const got = recalled(ids);
    const rest = ids.filter((id) => !got.has(id));
    if (rest.length && YT) for (const [id, m] of await videosApi(rest, YT).catch(() => new Map<string, VideoMeta>())) got.set(id, m);
    const still = ids.filter((id) => !got.has(id));
    for (let i = 0; i < still.length; i += 8) {
      const batch = still.slice(i, i + 8);
      const ms = await Promise.all(batch.map((id) => oembed(id).catch(() => undefined)));
      batch.forEach((id, j) => { if (ms[j]) got.set(id, ms[j]!); });
    }
    for (const [id, m] of got) { const it = items.get(id); if (it) it.meta = m; }
    const blind = ids.map((id) => items.get(id)!).filter((it) => it && !it.typed && it.how === 'none' && it.meta);
    const guess = bestByTitle(blind.map((it) => ({ id: it.id, title: it.meta!.title })), ours);
    for (const it of blind) {
      const g = guess.get(it.id);
      const f = g ? byKey.get(g.key) : undefined;
      if (f) { it.key = f.key; it.film = f.label; it.how = 'title'; it.options = [{ key: f.key, label: f.label }]; }
    }
  } finally { metaBusy -= ids.length; }
}

const ytGet = async <T,>(path: string, params: Record<string, string>): Promise<T | undefined> => {
  if (!YT) return undefined;
  const r = await fetch(`https://www.googleapis.com/youtube/v3/${path}?${new URLSearchParams({ ...params, key: YT })}`).catch(() => undefined);
  return r?.ok ? await r.json() as T : undefined;
};
/** Название канала и ник (у ссылки /channel/UC… ника нет — реестр держит каналы по нику). */
async function describeChannel(c: Chan): Promise<void> {
  type Ch = { items?: { id: string; snippet?: { title?: string; customUrl?: string } }[] };
  const j = c.handle ? await ytGet<Ch>('channels', { part: 'snippet', forHandle: `@${c.handle}` })
    : await ytGet<Ch>('channels', { part: 'snippet', id: c.channelId! });
  const it = j?.items?.[0];
  if (it?.snippet?.title) c.title = it.snippet.title;
  if (!c.handle && it?.snippet?.customUrl) c.handle = it.snippet.customUrl.replace(/^@/, '');
  if (!c.handle) c.error = YT ? 'у канала нет ника — завести по ссылке нельзя' : 'ссылка без ника: нужен YT_API_KEY в .env.local, чтобы узнать ник';
  const ex = c.handle ? sources.find((s) => s.platform === 'youtube' && s.handle.toLowerCase() === c.handle!.toLowerCase()) : undefined;
  if (ex) {
    // без яруса в реестре: из ссылок — обзор, остальные — эссе (так считает tools/youtube-channels.mts)
    c.existing = { title: ex.title, tier: ex.tier ?? (ex.via ? 'review' : 'essay'), ...(ex.medium ? { medium: ex.medium } : {}), ...(ex.via ? { via: ex.via } : {}) };
    c.title ??= ex.title;
  }
}

function addText(text: string): { videos: number; channels: number; other: string[]; known: number } {
  const p = parsePaste(text);
  const { videos: done } = readVerdicts();
  const fresh: string[] = [];
  let known = 0;
  for (const v of p.videos) {
    if (items.has(v.id)) continue;
    const it: Item = { id: v.id, url: v.url, line: v.line, ...(v.film ? { typed: v.film } : {}), ...(v.year ? { year: v.year } : {}), how: 'none', options: [] };
    const ex = done[v.id];
    if (ex) { it.existing = { key: ex.key, ...(ex.film ? { film: ex.film } : {}) }; known++; }
    placeFilm(it);
    items.set(v.id, it);
    fresh.push(v.id);
  }
  if (fresh.length) void fetchMeta(fresh);
  for (const c of p.channels) {
    const id = (c.channelId ?? c.handle ?? '').toLowerCase();
    if (!id || chans.has(id)) continue;
    const ch: Chan = { id, ...(c.handle ? { handle: c.handle } : {}), ...(c.channelId ? { channelId: c.channelId } : {}), url: c.url, line: c.line,
      tier: c.tier ?? 'review', medium: c.medium ?? 'film', include: true };
    chans.set(id, ch);
    chanBusy++;
    void describeChannel(ch).catch(() => undefined).finally(() => { chanBusy--; }).then(() => {
      if (!ch.existing) return;
      // уже в реестре: заголовок раздела в заметках («Эссеисты») с другим ярусом — значит, его и хотят
      // поменять; иначе — его ярус, и не трогаем, пока не поменяют на странице
      const hinted = (c.tier && c.tier !== (ch.existing.tier ?? 'essay')) || (c.medium && c.medium !== (ch.existing.medium ?? 'film'));
      if (hinted) return;
      ch.tier = (ch.existing.tier as Chan['tier']) ?? 'essay';
      ch.medium = (ch.existing.medium as Chan['medium']) ?? 'film';
      ch.include = false;
    });
  }
  return { videos: fresh.length, channels: p.channels.length, other: p.other, known };
}

// ─── сохранение ───────────────────────────────────────────────────────────────
function save(): { videos: number; unknown: number; channels: number; changed: number; skipped: string[] } {
  const today = new Date().toISOString().slice(0, 10);
  const { body, videos } = readVerdicts();
  let saved = 0, unknown = 0;
  for (const it of items.values()) {
    if (it.saved || it.key === undefined || !it.film) continue;
    // «нет у нас» — в виде, который поймёт опознаватель (resolve-markup-films.mts): «Название (год)»;
    // «сериал» из ярлыка и название ролика — в `title`, по ним он выбирает между фильмом и сериалом
    const series = /\(сериал/i.test(it.film);
    const plain = it.film.replace(/\s*\((?:сериал,?\s*)?((?:19|20)\d{2})?\)\s*$/i, (_, y) => (y ? ` (${y})` : '')).trim();
    const v: Verdict = it.key ? { key: it.key, film: it.film, from: 'desk', at: today }
      : { key: null, why: 'нет у нас', film: plain, from: 'desk', at: today,
        ...(it.meta?.title || series ? { title: `${it.meta?.title ?? ''}${series ? ' сериал' : ''}`.trim() } : {}) };
    const ex = videos[it.id];
    if (ex && ex.key === v.key && (ex.key || ex.film === v.film)) { it.saved = true; continue; }
    videos[it.id] = v;
    it.saved = true;
    it.existing = { key: v.key, film: v.film };
    saved++;
    if (!v.key) unknown++;
  }
  if (saved) {
    body.updated = today;
    body.videos = Object.fromEntries(Object.entries(videos).sort(([a], [b]) => a.localeCompare(b)));
    writeFileSync(VERDICTS, JSON.stringify(body, null, 1) + '\n');
  }

  // каналы: новые — строкой в реестр, известные — ярус и предмет в своей строке
  let src = readFileSync(REGISTRY, 'utf8');
  if (!src.includes(DESK_MARK)) src = src.replace(LINKS_MARK, `${DESK_MARK}\n${LINKS_MARK}`);
  let added = 0, changed = 0;
  const skipped: string[] = [];
  for (const c of chans.values()) {
    if (c.saved || !c.include) continue;
    if (!c.handle) { skipped.push(c.url); continue; }
    const esc = c.handle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const line = new RegExp(`^.*handle: '${esc}'.*platform: 'youtube'.*$`, 'mi');
    const m = line.exec(src);
    if (m) {
      let l = m[0].replace(/,\s*tier: '(?:essay|review)'/, '').replace(/,\s*medium: '(?:film|book)'/, '');
      // эссеист из ссылок становится полноценным голосом: загрузки обходим, в поиск ставим
      if (c.tier === 'essay') l = l.replace(/,\s*via: 'links'/, '');
      l = l.replace(/\s*},\s*(\/\/.*)?$/, (_, tail) => `, tier: '${c.tier}'${c.medium === 'book' ? ", medium: 'book'" : ''} },${tail ? ` ${tail}` : ''}`);
      if (l !== m[0]) { src = src.replace(m[0], l); changed++; }
    } else {
      src = src.replace(DESK_MARK, `${DESK_MARK}\n${sourceLine({ handle: c.handle, title: c.title ?? c.handle, tier: c.tier, medium: c.medium })}`);
      added++;
    }
    c.saved = true;
  }
  if (added || changed) writeFileSync(REGISTRY, src);
  return { videos: saved, unknown, channels: added, changed, skipped };
}

// ─── состояние для страницы ───────────────────────────────────────────────────
function state() {
  const list = [...items.values()];
  return {
    env: { yt: Boolean(YT) },
    loading: metaBusy + chanBusy,
    films: films.length,
    counts: {
      videos: list.length, placed: list.filter((i) => i.key).length, unknown: list.filter((i) => i.key === null && i.film).length,
      empty: list.filter((i) => i.key === undefined).length, existing: list.filter((i) => i.existing && !i.saved).length,
      unsaved: list.filter((i) => !i.saved && i.film && i.key !== undefined).length,
    },
    // фильм из заметок, а в названии ролика его нет — пометка «проверьте» (ролики под одним названием
    // в заметках могли быть и про другое)
    items: list.map((i) => ({ ...i, check: Boolean(i.key && i.meta && i.how === 'notes' && !titleMentions(i.meta.title, byKey.get(i.key)?.title ?? '')) })),
    channels: [...chans.values()],
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
  req.on('data', (c: Buffer) => { size += c.length; if (size > 20 * 1024 * 1024) req.destroy(new Error('слишком много')); else chunks.push(c); });
  req.on('end', () => ok(Buffer.concat(chunks).toString('utf8')));
  req.on('error', fail);
});
const PAGE = new URL('./links-desk.html', import.meta.url);

/** Вкладка общего пульта: `path` — адрес внутри вкладки. Хост и x-desk проверил tools/desk.mts. */
export async function linksRoute(req: IncomingMessage, res: ServerResponse, path: string): Promise<void> {
  const url = { pathname: path };
  if (req.method === 'GET' && url.pathname === '/') return send(res, 200, readFileSync(PAGE, 'utf8'), 'text/html; charset=utf-8');
  if (req.method === 'GET' && url.pathname === '/api/state') return send(res, 200, state());
  if (req.method === 'GET' && url.pathname === '/api/films') return send(res, 200, films.map((f) => f.label));
  if (req.method !== 'POST') return send(res, 404, { error: 'not_found' });
  try {
    const body = JSON.parse((await readBody(req)) || '{}') as Record<string, unknown>;
    if (url.pathname === '/api/text') return send(res, 200, { added: addText(String(body.text ?? '')), state: state() });
    if (url.pathname === '/api/save') return send(res, 200, { saved: save(), state: state() });
    if (url.pathname === '/api/clear-saved') {
      for (const [id, it] of items) if (it.saved) items.delete(id);
      for (const [id, c] of chans) if (c.saved) chans.delete(id);
      return send(res, 200, { state: state() });
    }
    const vm = url.pathname.match(/^\/api\/video\/([A-Za-z0-9_-]{11})\/(film|remove)$/);
    if (vm) {
      const it = items.get(vm[1]);
      if (!it) return send(res, 404, { error: 'not_found' });
      if (vm[2] === 'remove') items.delete(it.id);
      else {
        const text = String(body.film ?? '').trim();
        const f = byLabel.get(text.toLowerCase());
        if (!text) { it.key = undefined; it.film = undefined; }
        else if (f) { it.key = f.key; it.film = f.label; }
        else {
          // вписали название, а не ярлык из списка — попробуем узнать, иначе «нет у нас» как есть
          const m = matchFilm(text.replace(/\s*\((?:сериал,\s*)?\d{4}\)$/, ''), Number(/(\d{4})\)?$/.exec(text)?.[1]) || undefined, films);
          if (m.pick) { it.key = m.pick.key; it.film = m.pick.label; } else { it.key = null; it.film = text; }
          it.options = m.options.map((o) => ({ key: o.key, label: o.label }));
        }
        it.how = 'manual';
        it.saved = false;
      }
      return send(res, 200, { state: state() });
    }
    const cm = url.pathname.match(/^\/api\/channel\/([^/]+)$/);
    if (cm) {
      const c = chans.get(decodeURIComponent(cm[1]));
      if (!c) return send(res, 404, { error: 'not_found' });
      if (body.remove) chans.delete(c.id);
      else {
        if (body.tier === 'essay' || body.tier === 'review') c.tier = body.tier;
        if (body.medium === 'film' || body.medium === 'book') c.medium = body.medium;
        if (typeof body.include === 'boolean') c.include = body.include;
        c.saved = false;
      }
      return send(res, 200, { state: state() });
    }
    return send(res, 404, { error: 'not_found' });
  } catch (err) {
    return send(res, 400, { error: (err as Error).message });
  }
}
