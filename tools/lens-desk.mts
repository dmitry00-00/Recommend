// Вкладка «Рубрики» общего пульта (tools/desk.mts, http://127.0.0.1:8721/lens/) — 06.10, ТВ-3б.
//
// Ручная разметка рубрик роликов: слабые рубрики (как было на самом деле, об авторе, книга и фильм,
// специалист, философия) локальная модель держит на 30–70% — владелец размечает их сам. Список —
// ролики индекса разборов с рубрикой модели (.cache/llm/lenses.json); решение — в
// tools/lens-verdicts.json, сразу же выгрузка в приложение (src/mocks/essayLenses.ts): решение человека
// поверх модели, и модель такой ролик больше не переразмечает. Сводка — согласие модели с человеком
// по рубрикам: по ней же сравниваются модели (какая держит рубрики лучше).
//
// Хост и заголовок x-desk проверяет общий пульт.
import type { IncomingMessage, ServerResponse } from 'node:http';
import { readFileSync, statSync } from 'node:fs';
import { exportLenses, isLens, LENSES, LENS_RU, readLensFile, readLensVerdicts, writeLensVerdicts, type Lens, type LensLabel } from './lens-lib.mts';

const PAGE = new URL('./lens-desk.html', import.meta.url);
export const WEAK: Lens[] = ['character', 'history', 'author', 'book', 'specialist', 'domain'];

const send = (res: ServerResponse, code: number, body: unknown, type = 'application/json; charset=utf-8') => {
  res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
};
const readBody = (req: IncomingMessage): Promise<unknown> => new Promise((ok, fail) => {
  let s = '';
  req.on('data', (c) => { s += c; if (s.length > 1e5) req.destroy(); });
  req.on('end', () => { try { ok(s ? JSON.parse(s) : {}); } catch (e) { fail(e); } });
  req.on('error', fail);
});

// разметка модели — 1,7 МБ: перечитываем, только если файл изменился
let cache: { sig: number; items: Record<string, LensLabel> } | undefined;
function labels(): Record<string, LensLabel> {
  let sig = 0;
  try { sig = statSync(new URL('../.cache/llm/lenses.json', import.meta.url)).mtimeMs; } catch { /* нет файла */ }
  if (!cache || cache.sig !== sig) cache = { sig, items: readLensFile().items };
  return cache.items;
}

let titles: Map<string, string> | undefined;
async function titleOf(key: string): Promise<string> {
  if (!titles) {
    const { worksIndex } = await import('./works-index.mts');
    titles = new Map(worksIndex({ all: true }).map((w) => [w.key, `${w.work.title}${w.work.year ? ` (${w.work.year})` : ''}`]));
  }
  return titles.get(key) ?? key;
}

const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е');

async function rows(q: URLSearchParams) {
  const want = new Set((q.get('lens') ?? '').split(',').filter(isLens));
  const src = q.get('src') ?? 'todo';            // todo — не проверено мной, done — проверено, all
  const text = norm(q.get('q') ?? '');
  const per = Math.min(Number(q.get('per') ?? 40), 200);
  const page = Math.max(1, Number(q.get('page') ?? 1));
  const human = readLensVerdicts();
  // счётчики у рубрик в панели фильтров — по той же выборке и поиску, но без фильтра рубрик (06.10)
  const byLens: Record<string, number> = {};
  const bySrc = { todo: 0, done: 0, all: 0 };
  const all = Object.entries(labels()).filter(([id, l]) => {
    const h = human[id];
    if (text && !norm(`${l.title} ${l.channel ?? ''}`).includes(text)) return false;
    bySrc.all++; bySrc[h ? 'done' : 'todo']++;
    if (src === 'todo' && h) return false;
    if (src === 'done' && !h) return false;
    byLens[l.lens] = (byLens[l.lens] ?? 0) + 1;
    // фильтр рубрики — по рубрике модели (что проверяем) или по решению, если оно есть
    if (want.size && !want.has(l.lens) && !(h && want.has(h.lens))) return false;
    return true;
  });
  // сначала то, в чём модель меньше уверена: там ошибок больше всего
  all.sort(([, a], [, b]) => (a.conf ?? 1) - (b.conf ?? 1) || a.title.localeCompare(b.title));
  const slice = all.slice((page - 1) * per, page * per);
  return {
    total: all.length, page, per, byLens, bySrc,
    rows: await Promise.all(slice.map(async ([id, l]) => ({
      id, vid: id.slice(3), title: l.title, channel: l.channel, tier: l.tier, model: l.model, conf: l.conf,
      lens: l.lens, also: l.also, human: human[id],
      works: await Promise.all(l.keys.slice(0, 3).map(titleOf)), more: Math.max(0, l.keys.length - 3),
    }))),
  };
}

function summary() {
  const items = labels();
  const human = readLensVerdicts();
  const by = Object.fromEntries(LENSES.map((l) => [l, { model: 0, checked: 0, agree: 0, gained: 0 }]));
  for (const [id, l] of Object.entries(items)) {
    const b = by[l.lens];
    b.model++;
    const h = human[id];
    if (!h) continue;
    b.checked++;
    if ((h.was ?? l.lens) === h.lens) b.agree++;
  }
  // сколько роликов человек перенёс в рубрику из других — что модель там пропускает
  for (const [id, h] of Object.entries(human)) {
    const was = h.was ?? items[id]?.lens;
    if (was && was !== h.lens && by[h.lens]) by[h.lens].gained++;
  }
  const models = new Map<string, number>();
  for (const l of Object.values(items)) models.set(l.model, (models.get(l.model) ?? 0) + 1);
  return {
    lenses: LENSES.map((l) => ({ id: l, name: LENS_RU[l], weak: WEAK.includes(l), ...by[l] })),
    checked: Object.keys(human).length, total: Object.keys(items).length,
    models: Object.fromEntries([...models].sort((a, b) => b[1] - a[1])),
  };
}

export async function verdict(body: { id?: string; lens?: string; also?: string | null; clear?: boolean }) {
  const id = body.id;
  if (!id || !/^yt:[A-Za-z0-9_-]{11}$/.test(id)) return { error: 'id' };
  const human = readLensVerdicts();
  if (body.clear) {
    delete human[id];
  } else {
    if (!isLens(body.lens)) return { error: 'lens' };
    const also = isLens(body.also) && body.also !== body.lens ? body.also : undefined;
    const was = labels()[id]?.lens;
    human[id] = { lens: body.lens, ...(also ? { also } : {}), at: new Date().toISOString().slice(0, 10), ...(was ? { was } : {}) };
  }
  writeLensVerdicts(human);
  const exported = exportLenses(undefined, human);
  return { ok: true, verdict: human[id] ?? null, exported, checked: Object.keys(human).length };
}

export async function lensRoute(req: IncomingMessage, res: ServerResponse, sub: string): Promise<void> {
  const u = new URL(req.url ?? '/', 'http://x');
  if (sub === '/' || sub === '/index.html') return send(res, 200, readFileSync(PAGE, 'utf8'), 'text/html; charset=utf-8');
  if (sub === '/api/meta') return send(res, 200, { lenses: LENSES.map((l) => ({ id: l, name: LENS_RU[l] })), weak: WEAK });
  if (sub === '/api/summary') return send(res, 200, summary());
  if (sub === '/api/rows') return send(res, 200, await rows(u.searchParams));
  if (sub === '/api/verdict' && req.method === 'POST') {
    const r = await verdict(await readBody(req) as never);
    return send(res, 'error' in r ? 400 : 200, r);
  }
  return send(res, 404, { error: 'not_found' });
}
