// Реестр в базе приложения (06.10, решение владельца): каналы, которые читаем, и разметка «ролик → фильм»
// живут здесь, а не в файлах репозитория и не в таблице Google. Файлы (`src/mocks/sources.ts`,
// `tools/markup-verdicts.json`, `tools/telegram-channels.json`, `tools/channels-excluded.json`) — снимки,
// которые собирает отсюда `tools/registry-lib.mts`: так их читают тридцать скриптов сборщика, не зная о базе.
//
// Запись — одна на весь реестр: список правок `{kind, id, body | null}` от пульта, телефона (через
// owner-pull), разбора входящих ссылок. Каждая правка — в журнал `registry_log` (было → стало, кто, когда):
// откатить чужую правку можно по журналу, а номер последней записи — версия реестра, по ней сборщик
// понимает, что снимок устарел.
//
// Таблица Google — только форма ввода (лист «Ссылки»): tools/inbox.mts забирает строки в `registry_inbox`,
// и сервер отвечает, какие ссылки у него уже есть; их и только их задание в 16:00 стирает из формы.
import type { D1Database, Env } from './env';

const json = (body: unknown, status = 200) => Response.json(body, { status });
const iso = () => new Date().toISOString();

/** Виды записей. `doc` — пояснения в шапках файлов («//», «_»): без них снимок не совпал бы с файлом. */
export const KINDS = ['source', 'excluded', 'tgchannel', 'video', 'post', 'doc'] as const;
type Kind = typeof KINDS[number];
const isKind = (k: unknown): k is Kind => typeof k === 'string' && (KINDS as readonly string[]).includes(k);

const MAX_CHANGES = 20000;
const MAX_BODY = 16000;
const CHUNK = 400;
const LOG_DAYS = 365;

interface Change { kind: Kind; id: string; body: unknown | null; ord?: number }
interface Row { kind: Kind; id: string; body: string; ord: number | null; at: string; by: string | null }

async function version(db: D1Database): Promise<number> {
  const r = await db.prepare("SELECT v FROM registry_meta WHERE k = 'version'").first<{ v: number }>();
  return r?.v ?? 0;
}
const bump = (db: D1Database) => db.prepare(
  "INSERT INTO registry_meta (k, v) VALUES ('version', 1) ON CONFLICT (k) DO UPDATE SET v = registry_meta.v + 1");

/** Весь реестр или один вид — для снимка сборщика. Порядок — как в файлах (`ord`). */
export async function getRegistry(url: URL, env: Env): Promise<Response> {
  const kind = url.searchParams.get('kind');
  if (kind && !isKind(kind)) return json({ error: 'bad_kind' }, 400);
  const rows = kind
    ? await env.DB.prepare('SELECT kind, id, body, ord, at, by FROM registry WHERE kind = ? ORDER BY ord, id').bind(kind).all<Row>()
    : await env.DB.prepare('SELECT kind, id, body, ord, at, by FROM registry ORDER BY kind, ord, id').all<Row>();
  return json({
    version: await version(env.DB),
    at: iso(),
    rows: rows.results.map((r) => ({ kind: r.kind, id: r.id, ord: r.ord, at: r.at, by: r.by, body: JSON.parse(r.body) })),
  });
}

export async function getRegistryVersion(env: Env): Promise<Response> {
  return json({ version: await version(env.DB) });
}

/** Правки реестра. `body: null` — удалить запись. `by` — кто: check, desk, phone, inbox, import, ops9…
 *  Правка, которая ничего не меняет, в журнал не идёт. Перенос (`by: 'import'`) журнал не пишет —
 *  иначе в журнале лежала бы вторая копия всего реестра. */
export async function postRegistry(req: Request, env: Env): Promise<Response> {
  let input: { by?: unknown; changes?: unknown };
  try { input = await req.json(); } catch { return json({ error: 'bad_json' }, 400); }
  const by = typeof input.by === 'string' && /^[\w.:-]{1,40}$/.test(input.by) ? input.by : undefined;
  if (!by) return json({ error: 'bad_by' }, 400);
  if (!Array.isArray(input.changes) || input.changes.length > MAX_CHANGES) return json({ error: 'bad_changes' }, 400);
  const changes: Change[] = [];
  for (const c of input.changes as Record<string, unknown>[]) {
    if (!c || !isKind(c.kind) || typeof c.id !== 'string' || !c.id || c.id.length > 400) return json({ error: 'bad_change', change: c }, 400);
    if (c.body !== null && (typeof c.body !== 'object' || Array.isArray(c.body))) return json({ error: 'bad_body', id: c.id }, 400);
    if (c.body !== null && JSON.stringify(c.body).length > MAX_BODY) return json({ error: 'body_too_long', id: c.id }, 400);
    changes.push({ kind: c.kind, id: c.id, body: c.body, ...(typeof c.ord === 'number' && Number.isFinite(c.ord) ? { ord: c.ord } : {}) });
  }
  const at = iso();
  const quiet = by === 'import';
  let applied = 0;
  for (let i = 0; i < changes.length; i += CHUNK) {
    const part = changes.slice(i, i + CHUNK);
    const before = new Map<string, { body: string; ord: number | null }>();
    // прежние значения — одним запросом на вид, чтобы журнал знал «было» и пустые правки отсеялись
    for (const kind of new Set(part.map((c) => c.kind))) {
      const ids = part.filter((c) => c.kind === kind).map((c) => c.id);
      for (let j = 0; j < ids.length; j += 90) {
        const slice = ids.slice(j, j + 90);
        const r = await env.DB.prepare(`SELECT id, body, ord FROM registry WHERE kind = ? AND id IN (${slice.map(() => '?').join(',')})`)
          .bind(kind, ...slice).all<{ id: string; body: string; ord: number | null }>();
        for (const row of r.results) before.set(`${kind}\u0000${row.id}`, { body: row.body, ord: row.ord });
      }
    }
    const stmts = [];
    for (const c of part) {
      const old = before.get(`${c.kind}\u0000${c.id}`);
      const text = c.body === null ? null : JSON.stringify(c.body);
      if (text === null && !old) continue;
      if (text !== null && old && old.body === text && (c.ord === undefined || c.ord === old.ord)) continue;
      if (text === null) stmts.push(env.DB.prepare('DELETE FROM registry WHERE kind = ? AND id = ?').bind(c.kind, c.id));
      else stmts.push(env.DB.prepare(
        `INSERT INTO registry (kind, id, body, ord, at, by) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (kind, id) DO UPDATE SET body = excluded.body, ord = COALESCE(?, registry.ord), at = excluded.at, by = excluded.by`,
      ).bind(c.kind, c.id, text, c.ord ?? old?.ord ?? null, at, by, c.ord ?? null));
      if (!quiet) stmts.push(env.DB.prepare('INSERT INTO registry_log (kind, id, before, after, at, by) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(c.kind, c.id, old?.body ?? null, text, at, by));
      applied += 1;
    }
    if (stmts.length) await env.DB.batch([...stmts, bump(env.DB)]);
  }
  if (applied && !quiet) {
    const cut = new Date(Date.now() - LOG_DAYS * 86400e3).toISOString();
    await env.DB.prepare('DELETE FROM registry_log WHERE at < ?').bind(cut).run();
  }
  return json({ ok: true, applied, version: await version(env.DB) });
}

/** Журнал правок: по записи или последние. */
export async function getRegistryLog(url: URL, env: Env): Promise<Response> {
  const kind = url.searchParams.get('kind');
  const id = url.searchParams.get('id');
  const limit = Math.min(Number(url.searchParams.get('limit')) || 100, 1000);
  const r = kind && id
    ? await env.DB.prepare('SELECT seq, kind, id, before, after, at, by FROM registry_log WHERE kind = ? AND id = ? ORDER BY seq DESC LIMIT ?').bind(kind, id, limit).all()
    : await env.DB.prepare('SELECT seq, kind, id, before, after, at, by FROM registry_log ORDER BY seq DESC LIMIT ?').bind(limit).all();
  return json({ rows: r.results });
}

/** Каналы реестра для приложения: строка поиска по каналам в карточке (`searchLinks`). Это и раньше уходило
 *  каждому клиенту — отдельным куском сборки; теперь правка канала не требует пересборки. Пояснения из
 *  файла (`_before`, `_after`) клиенту не нужны. */
export async function getSources(env: Env): Promise<Response> {
  const r = await env.DB.prepare("SELECT body FROM registry WHERE kind = 'source' ORDER BY ord, id").all<{ body: string }>();
  if (!r.results.length) return json({ error: 'empty' }, 404);
  const list = r.results.map((x) => {
    const { _before, _after, ...rest } = JSON.parse(x.body) as Record<string, unknown>;
    void _before; void _after;
    return rest;
  });
  return new Response(JSON.stringify(list), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=600' } });
}

// ─── входящие ссылки из формы ────────────────────────────────────────────────

interface InboxRow { url: string; film?: string; note?: string; sheetAt?: string }
const normUrl = (u: string) => u.trim();

/** Ссылки из формы. Повтор той же ссылки не заводит вторую строку. В ответе — какие из присланных
 *  теперь лежат в базе: только их задание стирает из формы. */
export async function postInbox(req: Request, env: Env): Promise<Response> {
  let input: { rows?: unknown };
  try { input = await req.json(); } catch { return json({ error: 'bad_json' }, 400); }
  if (!Array.isArray(input.rows) || input.rows.length > 5000) return json({ error: 'bad_rows' }, 400);
  const rows: InboxRow[] = [];
  for (const r of input.rows as Record<string, unknown>[]) {
    const url = typeof r?.url === 'string' ? normUrl(r.url) : '';
    if (!/^https?:\/\/\S{3,500}$/.test(url)) continue;
    const s = (v: unknown, n: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, n) : undefined);
    rows.push({ url, film: s(r.film, 300), note: s(r.note, 1000), sheetAt: s(r.sheetAt, 40) });
  }
  const at = iso();
  const stmts = rows.map((r) => env.DB.prepare(
    `INSERT INTO registry_inbox (url, film, note, sheet_at, taken_at, status) VALUES (?, ?, ?, ?, ?, 'new')
     ON CONFLICT (url) DO UPDATE SET film = COALESCE(excluded.film, registry_inbox.film), note = COALESCE(excluded.note, registry_inbox.note)`,
  ).bind(r.url, r.film ?? null, r.note ?? null, r.sheetAt ?? null, at));
  for (let i = 0; i < stmts.length; i += CHUNK) await env.DB.batch(stmts.slice(i, i + CHUNK));
  const held = new Set<string>();
  const urls = rows.map((r) => r.url);
  for (let i = 0; i < urls.length; i += 90) {
    const slice = urls.slice(i, i + 90);
    const r = await env.DB.prepare(`SELECT url FROM registry_inbox WHERE url IN (${slice.map(() => '?').join(',')})`).bind(...slice).all<{ url: string }>();
    for (const x of r.results) held.add(x.url);
  }
  return json({ ok: true, held: [...held] });
}

export async function getInbox(url: URL, env: Env): Promise<Response> {
  const status = url.searchParams.get('status');
  const r = status
    ? await env.DB.prepare('SELECT * FROM registry_inbox WHERE status = ? ORDER BY taken_at, url').bind(status).all<Record<string, unknown>>()
    : await env.DB.prepare('SELECT * FROM registry_inbox ORDER BY taken_at DESC, url LIMIT 2000').all<Record<string, unknown>>();
  return json({ rows: r.results.map((x) => ({ ...x, result: typeof x.result === 'string' ? JSON.parse(x.result) : x.result })) });
}

/** Итог разбора ссылки: `done` (заведено), `skip` (уже было, не наше), `error` (разобрать не вышло — повторим). */
export async function postInboxResult(req: Request, env: Env): Promise<Response> {
  let input: { items?: unknown };
  try { input = await req.json(); } catch { return json({ error: 'bad_json' }, 400); }
  if (!Array.isArray(input.items) || input.items.length > 5000) return json({ error: 'bad_items' }, 400);
  const at = iso();
  const stmts = [];
  for (const it of input.items as Record<string, unknown>[]) {
    if (typeof it?.url !== 'string' || !['done', 'skip', 'error', 'new'].includes(String(it.status))) continue;
    const result = it.result === undefined ? null : JSON.stringify(it.result).slice(0, MAX_BODY);
    stmts.push(env.DB.prepare('UPDATE registry_inbox SET status = ?, result = ?, done_at = ? WHERE url = ?').bind(String(it.status), result, at, it.url));
  }
  for (let i = 0; i < stmts.length; i += CHUNK) await env.DB.batch(stmts.slice(i, i + CHUNK));
  return json({ ok: true, updated: stmts.length });
}
