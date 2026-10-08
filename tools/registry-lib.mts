// Реестр в базе приложения (06.10): клиент для пультов и сборщика. Правда — в базе (worker/registry.ts),
// файлы — снимки, которые тридцать скриптов читают как раньше:
//   src/mocks/sources.ts            — каналы реестра (массив `sources`; код и типы файла остаются в репозитории)
//   tools/markup-verdicts.json      — разметка «ролик → фильм» (videos, posts)
//   tools/telegram-channels.json    — Telegram-каналы для индексов
//   tools/channels-excluded.json    — каналы, убранные из выборки
//
// Пишущие (пульт, owner-pull, разбор входящих ссылок, регистрация каналов) по-прежнему собирают новое
// содержимое файла как привыкли — текстом sources.ts, объектом разметки — и отдают его сюда: `save*`
// сравнивает его со снимком, шлёт на сервер только разницу и, когда сервер её принял, кладёт файл.
//
// Режим — `REGISTRY_MODE` в .env.local: `files` (до переноса — правда в файлах, сервер не трогаем) или
// `server` (после). Сервер — `TM_REGISTRY_SERVER`, иначе `TM_SERVER`; токен — `TM_ADMIN_TOKEN`.
//   npx tsx tools/registry-lib.mts pull        — снимок с сервера в файлы
//   npx tsx tools/registry-lib.mts check       — разбор файлов и сборка обратно байт в байт (проверка)
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadEnvFile } from './env-file.mts';

loadEnvFile(fileURLToPath(new URL('../.env.local', import.meta.url)));

const at = (p: string) => new URL(`../${p}`, import.meta.url);
export const FILES = {
  sources: at('src/mocks/sources.ts'),
  verdicts: at('tools/markup-verdicts.json'),
  telegram: at('tools/telegram-channels.json'),
  excluded: at('tools/channels-excluded.json'),
} as const;
const SNAPSHOT = at('.cache/registry/snapshot.json');

export type Kind = 'source' | 'excluded' | 'tgchannel' | 'video' | 'post' | 'doc';
export interface Entry { kind: Kind; id: string; body: Record<string, unknown>; ord: number }
export interface Change { kind: Kind; id: string; body: Record<string, unknown> | null; ord?: number }

export const mode = (): 'server' | 'files' => (process.env.REGISTRY_MODE === 'server' ? 'server' : 'files');
const server = () => (process.env.TM_REGISTRY_SERVER ?? process.env.TM_SERVER ?? 'https://bot-1791394986-4062-dmitriy-00.bothost.tech').replace(/\/+$/, '');
const token = () => process.env.TM_ADMIN_TOKEN;

const writeAtomic = (u: URL, text: string) => { const tmp = new URL(`${u.href}.tmp`); writeFileSync(tmp, text); renameSync(tmp, u); };

// ─── sources.ts: массив строками ─────────────────────────────────────────────

const OPEN = 'export const sources: VoiceSource[] = [\n';
const CLOSE = '\n];\n';

interface SourcesText { head: string; tail: string; entries: Entry[]; end: string[] }

/** Разбор массива `sources`: строка — запись `{ … },` с комментарием в конце или без; строки-комментарии
 *  перед записью — её `_before` (шапки разделов и пояснения), комментарий в конце строки — `_after`.
 *  Комментарии после последней записи — `end`. Что-то другое внутри массива — ошибка: молча терять нельзя. */
export function parseSources(text: string): SourcesText {
  const a = text.indexOf(OPEN);
  const b = text.indexOf(CLOSE, a);
  if (a < 0 || b < 0) throw new Error('sources.ts: не нашёл массив sources');
  const head = text.slice(0, a + OPEN.length);
  const tail = text.slice(b + 1);
  const lines = text.slice(a + OPEN.length, b).split('\n');
  const entries: Entry[] = [];
  let pending: string[] = [];
  for (const line of lines) {
    if (/^\s*\/\//.test(line) || line.trim() === '') { pending.push(line); continue; }
    const parsed = objectLine(line);
    if (!parsed) throw new Error(`sources.ts: не разобрал строку\n${line}`);
    const body: Record<string, unknown> = { ...parsed.obj };
    if (pending.length) body._before = pending;
    if (parsed.comment) body._after = parsed.comment;
    if (typeof body.id !== 'string') throw new Error(`sources.ts: запись без id\n${line}`);
    entries.push({ kind: 'source', id: body.id, body, ord: entries.length + 1 });
    pending = [];
  }
  return { head, tail, entries, end: pending };
}

/** `  { id: 'x', … }, // заметка` → объект и заметка. Ищем ту `},`, после которой — только комментарий. */
function objectLine(line: string): { obj: Record<string, unknown>; comment?: string } | undefined {
  const m = /^ {2}\{/.exec(line);
  if (!m) return undefined;
  for (let i = line.indexOf('},'); i >= 0; i = line.indexOf('},', i + 1)) {
    const rest = line.slice(i + 2);
    const cm = /^(\s*)(\/\/.*)?$/.exec(rest);
    if (!cm) continue;
    try {
      // eslint-disable-next-line no-new-func
      const obj = new Function(`return (${line.slice(2, i + 1)});`)() as Record<string, unknown>;
      if (obj && typeof obj === 'object') return { obj, ...(cm[2] ? { comment: `${cm[1]}${cm[2]}` } : {}) };
    } catch { /* следующая «},» */ }
  }
  return undefined;
}

const lit = (v: unknown): string => {
  // с апострофом — в двойных кавычках, как пишет регистрация каналов: "Why It's Great"
  if (typeof v === 'string') return v.includes("'") && !v.includes('"') ? JSON.stringify(v) : `'${v.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  if (Array.isArray(v)) return `[${v.map(lit).join(', ')}]`;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  throw new Error(`sources.ts: не умею записать ${JSON.stringify(v)}`);
};

export function renderSources(head: string, tail: string, entries: Entry[], end: string[]): string {
  const out: string[] = [];
  for (const e of entries) {
    const { _before, _after, ...obj } = e.body as Record<string, unknown> & { _before?: string[]; _after?: string };
    if (_before) out.push(..._before);
    out.push(`  { ${Object.entries(obj).map(([k, v]) => `${k}: ${lit(v)}`).join(', ')} },${_after ?? ''}`);
  }
  out.push(...end);
  return `${head}${out.join('\n')}\n${tail}`;
}

// ─── JSON-файлы ──────────────────────────────────────────────────────────────

const readJson = <T,>(u: URL, d: T): T => (existsSync(u) ? JSON.parse(readFileSync(u, 'utf8')) as T : d);
const excludedId = (c: Record<string, unknown>) => String(c.channelId ?? c.handle ?? c.title ?? '');

/** Состояние реестра из файлов — для переноса и для сравнения перед правкой. */
export function readFiles(): Entry[] {
  const out: Entry[] = [];
  const src = parseSources(readFileSync(FILES.sources, 'utf8'));
  out.push(...src.entries, { kind: 'doc', id: 'sources', body: { end: src.end }, ord: 0 });
  out.push(...jsonEntries('verdicts', readJson(FILES.verdicts, {})));
  out.push(...jsonEntries('telegram', readJson(FILES.telegram, {})));
  out.push(...jsonEntries('excluded', readJson(FILES.excluded, {})));
  return out;
}

type FileName = 'verdicts' | 'telegram' | 'excluded';
/** Коллекции файла → виды записей; остальное верхнего уровня (пояснения «//», «_», дата) — `doc`. */
const COLLECTIONS: Record<FileName, { field: string; kind: Kind; id?: (x: Record<string, unknown>) => string }[]> = {
  verdicts: [{ field: 'videos', kind: 'video' }, { field: 'posts', kind: 'post' }],
  telegram: [{ field: 'channels', kind: 'tgchannel', id: (x) => String(x.username) }],
  excluded: [{ field: 'channels', kind: 'excluded', id: excludedId }],
};

function jsonEntries(file: FileName, body: Record<string, unknown>): Entry[] {
  const out: Entry[] = [];
  const doc: Record<string, unknown> = {};
  const keys = Object.keys(body);
  for (const k of keys) {
    const col = COLLECTIONS[file].find((c) => c.field === k);
    if (!col) { doc[k] = body[k]; continue; }
    const v = body[k];
    const items: [string, Record<string, unknown>][] = Array.isArray(v)
      ? (v as Record<string, unknown>[]).map((x) => [col.id!(x), x])
      : Object.entries(v as Record<string, Record<string, unknown>>);
    items.forEach(([id, x], i) => out.push({ kind: col.kind, id, body: x, ord: i + 1 }));
  }
  out.push({ kind: 'doc', id: file, body: { keys, values: doc }, ord: 0 });
  return out;
}

function jsonBody(file: FileName, entries: Entry[]): Record<string, unknown> {
  const doc = entries.find((e) => e.kind === 'doc' && e.id === file)?.body as { keys?: string[]; values?: Record<string, unknown> } | undefined;
  const keys = doc?.keys ?? [...Object.keys(doc?.values ?? {}), ...COLLECTIONS[file].map((c) => c.field)];
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    const col = COLLECTIONS[file].find((c) => c.field === k);
    if (!col) { out[k] = doc?.values?.[k]; continue; }
    // словарь по id (разметка) — в порядке id, как пишет пульт; список (каналы) — в своём порядке
    const items = entries.filter((e) => e.kind === col.kind).sort((a, b) => (col.id ? a.ord - b.ord : a.id.localeCompare(b.id)));
    out[k] = col.id ? items.map((e) => e.body) : Object.fromEntries(items.map((e) => [e.id, e.body]));
  }
  return out;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Снимок → файлы. JSON переписываем, только если содержимое другое: у двух файлов ручное
 *  форматирование, и оно не должно скакать от каждого снимка. */
export function writeFiles(entries: Entry[]): string[] {
  const touched: string[] = [];
  const cur = parseSources(readFileSync(FILES.sources, 'utf8'));
  const end = (entries.find((e) => e.kind === 'doc' && e.id === 'sources')?.body.end as string[] | undefined) ?? cur.end;
  const text = renderSources(cur.head, cur.tail, entries.filter((e) => e.kind === 'source').sort((a, b) => a.ord - b.ord), end);
  if (text !== readFileSync(FILES.sources, 'utf8')) { writeAtomic(FILES.sources, text); touched.push('sources.ts'); }
  for (const file of ['verdicts', 'telegram', 'excluded'] as const) {
    const body = jsonBody(file, entries);
    // сравнение — в том же порядке, что снимок: файл, записанный не по порядку id, — то же содержимое
    if (same(body, jsonBody(file, jsonEntries(file, readJson(FILES[file], {}))))) continue;
    writeAtomic(FILES[file], file === 'verdicts' ? JSON.stringify(body, null, 1) : `${JSON.stringify(body, null, 2)}\n`);
    touched.push(FILES[file].pathname.split('/').pop()!);
  }
  return touched;
}

// ─── разница и сервер ────────────────────────────────────────────────────────

const keyOf = (e: { kind: Kind; id: string }) => `${e.kind}\u0000${e.id}`;

/** Правки, превращающие `before` в `after` одного вида. Порядок — дробными номерами: вставка строки
 *  не сдвигает номера остальных (иначе каждая новая строка реестра переписывала бы сотни записей). */
/** Виды-словари: порядок записей не значит ничего (в снимке они по id), его не храним и не сравниваем. */
const UNORDERED: ReadonlySet<Kind> = new Set(['video', 'post']);

export function diff(before: Entry[], after: Omit<Entry, 'ord'>[], kinds: Kind[]): Change[] {
  const changes: Change[] = [];
  for (const kind of kinds) {
    const old = new Map(before.filter((e) => e.kind === kind).map((e) => [e.id, e]));
    const next = after.filter((e) => e.kind === kind);
    const seen = new Set<string>();
    if (UNORDERED.has(kind)) {
      for (const e of next) {
        seen.add(e.id);
        const o = old.get(e.id);
        if (!o || !same(o.body, e.body)) changes.push({ kind, id: e.id, body: e.body });
      }
      for (const id of old.keys()) if (!seen.has(id)) changes.push({ kind, id, body: null });
      continue;
    }
    let prev = 0;
    for (let i = 0; i < next.length; i++) {
      const e = next[i];
      seen.add(e.id);
      const o = old.get(e.id);
      let ord: number;
      if (o && o.ord > prev) ord = o.ord;
      else {
        // следующий известный с номером больше предыдущего — новая запись встаёт между ними
        let nextOrd = Infinity;
        for (let j = i + 1; j < next.length; j++) { const n = old.get(next[j].id); if (n && n.ord > prev) { nextOrd = n.ord; break; } }
        ord = nextOrd === Infinity ? prev + 1 : (prev + nextOrd) / 2;
      }
      if (!o || !same(o.body, e.body) || o.ord !== ord) changes.push({ kind, id: e.id, body: e.body, ...(o?.ord !== ord ? { ord } : {}) });
      prev = ord;
    }
    for (const id of old.keys()) if (!seen.has(id)) changes.push({ kind, id, body: null });
  }
  return changes;
}

async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  const t = token();
  if (!t) throw new Error('нет TM_ADMIN_TOKEN в .env.local — до реестра на сервере не достучаться');
  const r = await fetch(`${server()}${path}`, {
    method,
    headers: { Authorization: `Bearer ${t}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(60_000),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`реестр: ${method} ${path} → ${r.status} ${text.slice(0, 300)}`);
  return JSON.parse(text) as T;
}

export const registryApi = call;

/** Правки на сервер (в режиме `server`) и в файлы. В режиме `files` — только в файлы, как раньше. */
export async function commit(changes: Change[], by: string): Promise<{ applied: number; files: string[] }> {
  if (!changes.length) return { applied: 0, files: [] };
  const state = readFiles();
  let applied = changes.length;
  if (mode() === 'server') {
    const r = await call<{ applied: number; version: number }>('POST', '/api/admin/registry', { by, changes });
    applied = r.applied;
  }
  const map = new Map(state.map((e) => [keyOf(e), e]));
  for (const c of changes) {
    const k = keyOf(c);
    if (c.body === null) { map.delete(k); continue; }
    const old = map.get(k);
    map.set(k, { kind: c.kind, id: c.id, body: c.body, ord: c.ord ?? old?.ord ?? Number.MAX_SAFE_INTEGER });
  }
  const files = writeFiles([...map.values()]);
  if (mode() === 'server') saveSnapshot();
  return { applied, files };
}

function saveSnapshot(): void {
  mkdirSync(new URL('.', SNAPSHOT), { recursive: true });
  writeFileSync(SNAPSHOT, JSON.stringify({ at: new Date().toISOString(), entries: readFiles() }));
}

/** Снимок с сервера в файлы — в начале ночного сбора и по кнопке пульта. Сервер недоступен — файлы
 *  остаются прежними (сбор идёт по вчерашнему снимку), об этом — в ответе. */
export async function pull(): Promise<{ ok: boolean; version?: number; files: string[]; error?: string }> {
  if (mode() !== 'server') return { ok: true, files: [] };
  try {
    const r = await call<{ version: number; rows: { kind: Kind; id: string; ord: number | null; body: Record<string, unknown> }[] }>('GET', '/api/admin/registry');
    if (!r.rows.some((x) => x.kind === 'source')) return { ok: false, files: [], error: 'на сервере пустой реестр — перенос не сделан?' };
    const files = writeFiles(r.rows.map((x) => ({ kind: x.kind, id: x.id, body: x.body, ord: x.ord ?? 0 })));
    saveSnapshot();
    return { ok: true, version: r.version, files };
  } catch (err) {
    return { ok: false, files: [], error: (err as Error).message };
  }
}

// ─── для пишущих: новое содержимое файла → правки ─────────────────────────────

/** Новый текст sources.ts (пульт ссылок, пульт каналов, регистрация каналов из ссылок). */
export async function saveSourcesText(text: string, by: string) {
  const next = parseSources(text);
  const cur = parseSources(readFileSync(FILES.sources, 'utf8'));
  if (next.head !== cur.head || next.tail !== cur.tail) throw new Error('sources.ts: менять можно только массив sources — код файла правится в репозитории');
  const before = readFiles();
  const changes = diff(before, next.entries, ['source']);
  if (!same(next.end, cur.end)) changes.push({ kind: 'doc', id: 'sources', body: { end: next.end } });
  return commit(changes, by);
}

/** Новый объект разметки (пульт «Проверка», пульт ссылок, owner-pull, apply-typed). */
export async function saveVerdicts(body: Record<string, unknown>, by: string) {
  return saveJson('verdicts', body, by);
}
export async function saveExcluded(body: Record<string, unknown>, by: string) {
  return saveJson('excluded', body, by);
}
export async function saveTelegram(body: Record<string, unknown>, by: string) {
  return saveJson('telegram', body, by);
}

async function saveJson(file: FileName, body: Record<string, unknown>, by: string) {
  const before = readFiles();
  const next = jsonEntries(file, body);
  const kinds = COLLECTIONS[file].map((c) => c.kind);
  const changes = diff(before, next.filter((e) => e.kind !== 'doc'), kinds);
  const doc = next.find((e) => e.kind === 'doc')!;
  const oldDoc = before.find((e) => e.kind === 'doc' && e.id === file);
  if (!oldDoc || !same(oldDoc.body, doc.body)) changes.push({ kind: 'doc', id: file, body: doc.body });
  return commit(changes, by);
}

// ─── командная строка ────────────────────────────────────────────────────────

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const cmd = process.argv[2];
  if (cmd === 'check') {
    const text = readFileSync(FILES.sources, 'utf8');
    const p = parseSources(text);
    const back = renderSources(p.head, p.tail, p.entries, p.end);
    const entries = readFiles();
    const counts: Record<string, number> = {};
    for (const e of entries) counts[e.kind] = (counts[e.kind] ?? 0) + 1;
    const json = (['verdicts', 'telegram', 'excluded'] as const).map((f) => [f, same(jsonBody(f, entries), jsonBody(f, jsonEntries(f, readJson(FILES[f], {}))))] as const);
    console.log(JSON.stringify({ sourcesRoundTrip: back === text, json: Object.fromEntries(json), counts }, null, 1));
    process.exit(back === text && json.every(([, ok]) => ok) ? 0 : 1);
  } else if (cmd === 'pull') {
    const r = await pull();
    console.log(JSON.stringify(r));
    process.exit(r.ok ? 0 : 1);
  } else {
    console.error('npx tsx tools/registry-lib.mts check | pull');
    process.exit(2);
  }
}
