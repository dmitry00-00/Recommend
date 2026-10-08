// Вкладка «Поведение» общего пульта (tools/desk.mts, http://127.0.0.1:8721/behavior/) — 06.10.
//
// Что люди делают в приложении: открытия материалов (замер рубрик ТВ-3г: по рубрике, месту, полке,
// видели ли полки) и петля прогноза; с 07.10 (ЗП-3) — воронка и удержание против порогов беты
// (GET /api/admin/funnel, worker/funnel.ts). Данные — на сервере; пульт забирает их по ADMIN_TOKEN
// (GET /api/admin/behavior, worker/index.ts) сам, токен в браузер не уходит. TM_SERVER и
// TM_ADMIN_TOKEN — из .env.local, как у publish-reference. Ответ держится минуту.
//
// Хост и заголовок x-desk проверяет общий пульт.
import type { IncomingMessage, ServerResponse } from 'node:http';
import { readFileSync } from 'node:fs';
import { loadEnvFile } from './env-file.mts';

loadEnvFile();
const PAGE = new URL('./behavior-desk.html', import.meta.url);
const send = (res: ServerResponse, code: number, body: unknown, type = 'application/json; charset=utf-8') => {
  res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
};

const cache = new Map<string, { at: number; body: unknown }>();
async function data(withOwner: boolean, fresh: boolean): Promise<{ code: number; body: unknown }> {
  const key = withOwner ? '1' : '0';
  const hit = cache.get(key);
  if (hit && !fresh && Date.now() - hit.at < 60_000) return { code: 200, body: hit.body };
  const server = (process.env.TM_SERVER ?? 'https://bot-1791394986-4062-dmitriy-00.bothost.tech').replace(/\/+$/, '');
  const token = process.env.TM_ADMIN_TOKEN;
  if (!token) return { code: 500, body: { error: 'нет TM_ADMIN_TOKEN в .env.local' } };
  try {
    const r = await fetch(`${server}/api/admin/behavior?owner=${key}`, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20_000) });
    // старый сервер (без /api/admin/behavior, до 06.10) незнакомый адрес отправляет на проверку
    // сессии — и отвечает 401, а не 404
    if (r.status === 404 || r.status === 401) return { code: 502, body: { error: `сервер ответил ${r.status}: скорее всего, на нём ещё нет /api/admin/behavior — залейте архив bothost от 06.10 (deploy/tm-bothost.zip); если залит — проверьте TM_ADMIN_TOKEN` } };
    if (!r.ok) return { code: 502, body: { error: `сервер ответил ${r.status}` } };
    // воронка — отдельной ручкой: сервер до 07.10 её не знает, остальная вкладка от этого не страдает
    const f = await fetch(`${server}/api/admin/funnel?owner=${key}`, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20_000) })
      .catch((e: Error) => ({ ok: false, status: 0, statusText: e.message }) as Response);
    const funnel = f.ok ? await f.json() as object
      : { error: f.status === 401 || f.status === 404 ? 'на сервере ещё нет воронки (ЗП-3) — залейте архив bothost от 07.10' : `сервер ответил ${f.status} ${f.statusText}` };
    const body = { server, ...(await r.json() as object), funnel };
    cache.set(key, { at: Date.now(), body });
    return { code: 200, body };
  } catch (e) {
    return { code: 502, body: { error: `сервер не ответил: ${(e as Error).message}` } };
  }
}

export async function behaviorRoute(req: IncomingMessage, res: ServerResponse, path: string): Promise<void> {
  const params = new URL(req.url ?? '/', 'http://x').searchParams;
  if (req.method !== 'GET') return send(res, 404, { error: 'not_found' });
  if (path === '/' || path === '/index.html') return send(res, 200, readFileSync(PAGE, 'utf8'), 'text/html; charset=utf-8');
  if (path === '/api/data') { const r = await data(params.get('owner') === '1', params.has('fresh')); return send(res, r.code, r.body); }
  return send(res, 404, { error: 'not_found' });
}
