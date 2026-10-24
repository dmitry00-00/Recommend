// Соседи по вкусу для ленты (23.10, опыт `neighbors`): GET /api/neighbors → по фильму «как оценили бы соседи» для этого
// участника. Расчёт — src/lib/model/neighbors.ts; здесь — набор соседей, кэш и ответ.
//
// Соседи — опорные истории (обезличенные z-оценки из файла вне репозитория, путь — окружение NEIGHBOR_ANCHORS_FILE на
// сервере bothost; решение владельца 23.10: держать их на сервере можно) и участники приложения со своими оценками
// (таблица rating). Наружу — только итог по фильму, и лишь по фильмам, которые оценили не меньше трёх соседей: ни кто
// соседи, ни их оценки клиент не видит. Соседей ищем, только если у участника не меньше NEIGHBOR.minRated оценок.
//
// Цена: набор (опорные + все участники с порогом оценок, одним запросом по rating) собирается раз в POOL_TTL и одной
// сборкой на всех — пары двойников P², на сотнях людей доли секунды. Ответ участнику — проход по набору (P × его оценки)
// и сложение 30 соседей; кэш на участника, пока не изменились его оценки (число и время последней) и набор. Без
// NEIGHBORS=1 в окружении ручка выключена: в ленте её зовёт только клиент с флагом.
import type { Env } from './env';
import { NEIGHBOR, anchorsFrom, buildPool, keysOfRating, mineIn, neighborScores, personZ, rawOf, toTable, type FilmZ, type Pool, type Rated } from '../src/lib/model/neighbors';

export interface NeighborEnv extends Env {
  /** «1» — ручка включена */
  NEIGHBORS?: string;
  /** чтение файла опорных историй (server/index.js: путь из NEIGHBOR_ANCHORS_FILE); нет — только участники приложения */
  NEIGHBOR_ANCHORS?: () => Promise<string | null>;
}

const POOL_TTL = 30 * 60e3;
const USER_CACHE = 500;

const json = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'private, no-store' } });

interface Row { user_id: string; work_id: string; rating: number; raw: number | null; type: string | null; tmdb: number | string | null; imdb: string | null }
// карточку целиком не тянем — только тип и внешние ключи; битый JSON в старой строке не роняет запрос
const COLS = `user_id, work_id, rating, raw,
  CASE WHEN json_valid(work) THEN json_extract(work, '$.type') END AS type,
  CASE WHEN json_valid(work) THEN json_extract(work, '$.externalIds.tmdb') END AS tmdb,
  CASE WHEN json_valid(work) THEN json_extract(work, '$.externalIds.imdb') END AS imdb`;
const ratedOf = (r: Row): Rated => ({
  keys: keysOfRating(r.work_id, { type: r.type, externalIds: { tmdb: r.tmdb, imdb: r.imdb } }),
  raw: rawOf(r.rating, r.raw),
});

// ─── набор соседей ─────────────────────────────────────────────────────────────

let pool: { at: number; version: number; value: Pool } | undefined;
let building: Promise<{ version: number; value: Pool }> | undefined;
let version = 0;

/** Оценки участника: сколько и когда последняя (подпись кэша ответа) и сами — z в его шкале */
export async function ratedHead(env: Env, userId: string): Promise<{ rated: number; at: string }> {
  const head = await env.DB.prepare('SELECT COUNT(*) AS n, MAX(at) AS at FROM rating WHERE user_id = ?').bind(userId).first<{ n: number; at: string | null }>();
  return { rated: head?.n ?? 0, at: head?.at ?? '' };
}
export async function myFilms(env: Env, userId: string): Promise<FilmZ[]> {
  const res = await env.DB.prepare(`SELECT ${COLS} FROM rating WHERE user_id = ?`).bind(userId).all<Row>();
  return personZ((res.results ?? []).map(ratedOf));
}

/** Набор (опорные + участники) — общий с EASE (worker/ease.ts, 24.10): одна сборка, один TTL; version растёт с каждой сборкой. */
export async function neighborPool(env: NeighborEnv): Promise<{ version: number; value: Pool }> {
  if (pool && Date.now() - pool.at < POOL_TTL) return pool;
  building ??= (async () => {
    const anchors = anchorsFrom(await env.NEIGHBOR_ANCHORS?.().catch((err) => { console.error('neighbors: опорные', err); return null; }));
    const res = await env.DB.prepare(`SELECT ${COLS} FROM rating
        WHERE user_id IN (SELECT user_id FROM rating GROUP BY user_id HAVING COUNT(*) >= ?)`).bind(NEIGHBOR.minRated).all<Row>();
    const byUser = new Map<string, Rated[]>();
    for (const r of res.results ?? []) {
      const list = byUser.get(r.user_id) ?? [];
      list.push(ratedOf(r));
      byUser.set(r.user_id, list);
    }
    const users = [...byUser].map(([id, list]) => ({ id: `u:${id}`, films: personZ(list) }));
    const value = buildPool([...anchors, ...users]);
    pool = { at: Date.now(), version: ++version, value };
    return pool;
  })().finally(() => { building = undefined; });
  return building;
}

// ─── ответ участнику ───────────────────────────────────────────────────────────

const cache = new Map<string, { sig: string; body: unknown }>();

/** GET /api/neighbors → `{ rated, neighbors, table: { ключ фильма: счёт } }`; оценок меньше порога — пустая таблица. */
export async function getNeighbors(userId: string, env: NeighborEnv): Promise<Response> {
  if (env.NEIGHBORS !== '1') return json({ error: 'not_found' }, 404);
  const { rated, at } = await ratedHead(env, userId);
  if (rated < NEIGHBOR.minRated) return json({ rated, neighbors: 0, table: {} });
  const p = await neighborPool(env);
  const sig = `${rated}|${at}|${p.version}`;
  const hit = cache.get(userId);
  if (hit?.sig === sig) { cache.delete(userId); cache.set(userId, hit); return json(hit.body); }

  const mine = mineIn(p.value, await myFilms(env, userId));
  const me = `u:${userId}`;
  const { scores, neighbors } = neighborScores(p.value, mine, { skip: (x) => x.id === me });
  // оценённое им самим — мимо: оно уже не в ленте, а по нему было бы видно, как его оценили соседи
  const body = { rated, neighbors, table: toTable(p.value, scores, { exclude: new Set(mine.keys()) }) };
  cache.set(userId, { sig, body });
  while (cache.size > USER_CACHE) cache.delete(cache.keys().next().value!);
  return json(body);
}

/** Забыть набор и кэш (проверки; после подмены файла опорных — само через POOL_TTL). */
export function forgetNeighbors(): void { pool = undefined; cache.clear(); }
