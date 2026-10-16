// Вкладка «Рост» общего пульта (tools/desk.mts, http://127.0.0.1:8721/growth/) — 16.10.
//
// Откуда приходят люди и что с ними дальше: источники с ценой (посевы, ПР-2), недели, первый вход свайпом
// против колоды (ДФ-2), вирусность. Данные — на сервере (GET /api/admin/growth, worker/growthRoute.ts →
// worker/growth.ts); пульт забирает их по ADMIN_TOKEN сам, токен в браузер не уходит. Посевы правятся отсюда же
// (PUT/DELETE /api/admin/seeding). TM_SERVER и TM_ADMIN_TOKEN — из .env.local. Ответ держится минуту.
//
// Хост и заголовок x-desk проверяет общий пульт.
import type { IncomingMessage, ServerResponse } from 'node:http';
import { readFileSync } from 'node:fs';
import { loadEnvFile } from './env-file.mts';

loadEnvFile();
const PAGE = new URL('./growth-desk.html', import.meta.url);
const send = (res: ServerResponse, code: number, body: unknown, type = 'application/json; charset=utf-8') => {
  res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
};
const readBody = (req: IncomingMessage): Promise<string> => new Promise((ok) => {
  let s = '';
  req.on('data', (c) => { s += c; if (s.length > 1e5) req.destroy(); });
  req.on('end', () => ok(s));
});

const server = () => (process.env.TM_SERVER ?? 'https://bot-1791394986-4062-dmitriy-00.bothost.tech').replace(/\/+$/, '');
async function call(path: string, init: { method?: string; body?: string } = {}): Promise<{ code: number; body: unknown }> {
  const token = process.env.TM_ADMIN_TOKEN;
  if (!token) return { code: 500, body: { error: 'нет TM_ADMIN_TOKEN в .env.local' } };
  try {
    const r = await fetch(`${server()}${path}`, { ...init, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, signal: AbortSignal.timeout(20_000) });
    // старый сервер незнакомый адрес отправляет на проверку сессии и отвечает 401, а не 404
    if (r.status === 404 || r.status === 401) return { code: 502, body: { error: `сервер ответил ${r.status}: скорее всего, на нём ещё нет /api/admin/growth — выложите сборку от 16.10` } };
    const body = await r.json().catch(() => ({ error: `сервер ответил ${r.status}` }));
    return { code: r.ok ? 200 : 502, body: r.ok ? body : { error: (body as { error?: string }).error ?? `сервер ответил ${r.status}`, ...(body as object) } };
  } catch (e) {
    return { code: 502, body: { error: `сервер не ответил: ${(e as Error).message}` } };
  }
}

const cache = new Map<string, { at: number; body: unknown }>();
async function data(qs: URLSearchParams, fresh: boolean): Promise<{ code: number; body: unknown }> {
  const key = `${qs.get('internal') === '1' ? 1 : 0}${qs.get('tg') === '1' ? 1 : 0}`;
  const hit = cache.get(key);
  if (hit && !fresh && Date.now() - hit.at < 60_000) return { code: 200, body: hit.body };
  const r = await call(`/api/admin/growth?internal=${key[0]}&tg=${key[1]}`);
  if (r.code === 200) cache.set(key, { at: Date.now(), body: { server: server(), ...(r.body as object) } });
  return r.code === 200 ? { code: 200, body: cache.get(key)!.body } : r;
}

export async function growthRoute(req: IncomingMessage, res: ServerResponse, path: string): Promise<void> {
  const params = new URL(req.url ?? '/', 'http://x').searchParams;
  if ((path === '/' || path === '/index.html') && req.method === 'GET') return send(res, 200, readFileSync(PAGE, 'utf8'), 'text/html; charset=utf-8');
  if (path === '/api/data' && req.method === 'GET') { const r = await data(params, params.has('fresh')); return send(res, r.code, r.body); }
  // посевы: правка идёт на сервер, кэш сводки сбрасывается
  if (path === '/api/seeding' && req.method === 'PUT') { cache.clear(); const r = await call('/api/admin/seeding', { method: 'PUT', body: await readBody(req) }); return send(res, r.code, r.body); }
  const del = /^\/api\/seeding\/(sd-[0-9a-f]{12})$/.exec(path);
  if (del && req.method === 'DELETE') { cache.clear(); const r = await call(`/api/admin/seeding/${del[1]}`, { method: 'DELETE' }); return send(res, r.code, r.body); }
  return send(res, 404, { error: 'not_found' });
}
