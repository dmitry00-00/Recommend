// Вкладка «Рост» общего пульта (tools/desk.mts, http://127.0.0.1:8721/growth/) — 16.10.
//
// Откуда приходят люди и что с ними дальше: источники с ценой (посевы, ПР-2), недели, первый вход свайпом
// против колоды (ДФ-2), вирусность. Данные — на сервере (GET /api/admin/growth, worker/growthRoute.ts →
// worker/growth.ts); пульт забирает их по ADMIN_TOKEN сам, токен в браузер не уходит. Посевы правятся отсюда же
// (PUT/DELETE /api/admin/seeding). TM_SERVER и TM_ADMIN_TOKEN — из .env.local. Ответ держится минуту.
//
// Рекламная кампания (23.10, .cache/outreach/ad-campaign-2310.md): поверх сводки сервера пульт сам считает
// `campaign` — метки tg_<канал> и tg_<канал>_v сводит в канал, охват и время выхода берёт из заметки посева
// («охват 7000; выход 19:00» — в таблице `seeding` дата без времени), а при `arrivals` от сервера — посты и приход
// по часам за 48 ч. Посевы списком: POST api/seeding/parse (разбор без записи), POST api/seeding/bulk (запись).
//
// Хост и заголовок x-desk проверяет общий пульт.
import type { IncomingMessage, ServerResponse } from 'node:http';
import { readFileSync } from 'node:fs';
import { loadEnvFile } from './env-file.mts';
import { wilson, type Growth, type Share, type SeedingRow } from '../worker/growth.ts';

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

// ── кампания (23.10): чистые функции, проверка — tools/growth-test.mts

/** метка — как в ссылке `--s<метка>` (worker/invite.ts) */
export const LABEL = /^[a-z0-9_]{1,24}$/;
/** Канал метки: `tg_x_v` (ссылка на страницу автора) — тот же канал, что `tg_x`. */
export const channelOf = (label: string): string => (label.length > 2 ? label.replace(/_v$/, '') : label);

/** Охват и время выхода из заметки посева: «охват ~7 000; выход 19:00». */
export function noteMeta(note: string | null | undefined): { reach: number | null; time: string | null } {
  const n = (note ?? '').replace(/[\u00a0\u202f]/g, ' ');
  const reach = /охват\s*[:=]?\s*~?\s*(\d[\d ]*)/i.exec(n)?.[1];
  const t = /(?:^|[^\d:])([01]?\d|2[0-3]):([0-5]\d)(?![\d:])/.exec(n);
  return { reach: reach ? Number(reach.replace(/ /g, '')) : null, time: t ? `${t[1].padStart(2, '0')}:${t[2]}` : null };
}
/** Выход поста, мс: дата посева + время из заметки, по Москве; без времени — полночь. */
export function postedMs(row: Pick<SeedingRow, 'posted_at' | 'note'>): number | null {
  if (!row.posted_at || !/^\d{4}-\d{2}-\d{2}$/.test(row.posted_at)) return null;
  return Date.parse(`${row.posted_at}T${noteMeta(row.note).time ?? '00:00'}:00+03:00`);
}

/** Вход по метке — от сервера (worker/growth.ts, `arrivals`): без id; d1/d7 — null, если день ещё не прошёл;
 *  rated — оценок в первые сутки (для «оценил ≥ 10 и получил ленту»). */
export interface Arrival { source: string; at: string; activated: boolean; rated?: number | null; d1: boolean | null; d7: boolean | null }
type Source = Growth['sources'][number];
const RATED = 10;
const HOURS = 48;
const sumShare = (xs: Share[]): Share => wilson(xs.reduce((a, s) => a + s.n, 0), xs.reduce((a, s) => a + s.of, 0));
const per = (cost: number | null, n: number) => (cost != null && n ? cost / n : null);

export function campaignView(g: { sources: Source[]; seedingRows?: SeedingRow[]; arrivals?: Arrival[] }) {
  const rows = g.seedingRows ?? [];
  const arrivals = g.arrivals;
  const strictOf = (labels: string[]): Share | null => {
    if (!arrivals || !arrivals.some((a) => a.rated != null)) return null;
    const xs = arrivals.filter((a) => labels.includes(a.source));
    return wilson(xs.filter((a) => a.activated && (a.rated ?? 0) >= RATED).length, xs.length);
  };
  const reachOf = (labels: string[]) => {
    const rs = rows.filter((s) => labels.includes(s.label)).map((s) => noteMeta(s.note).reach).filter((x): x is number => x != null);
    return rs.length ? rs.reduce((a, b) => a + b, 0) : null;
  };
  // строка воронки — для метки и для канала одинаковая: охват → открыли → активированы → D1 → D7, ₽ на каждом шаге
  const line = (labels: string[], xs: Source[]) => {
    const joined = xs.reduce((a, s) => a + s.joined, 0);
    const costs = xs.map((s) => s.cost).filter((c): c is number => c != null);
    const cost = costs.length ? costs.reduce((a, b) => a + b, 0) : null;
    const activation = sumShare(xs.map((s) => s.activation)), d1 = sumShare(xs.map((s) => s.d1)), d7 = sumShare(xs.map((s) => s.d7));
    const reach = reachOf(labels);
    return {
      labels, posts: xs.reduce((a, s) => a + s.posts, 0), names: [...new Set(xs.flatMap((s) => s.channels))],
      reach, joined, openRate: reach ? joined / reach : null, activation, activationStrict: strictOf(labels), d1, d7,
      cost, perReach: per(cost, reach ?? 0), perJoined: per(cost, joined), perActivated: per(cost, activation.n), perD7: per(cost, d7.n),
    };
  };
  const tagged = g.sources.filter((s) => s.source !== 'organic' && s.source !== 'invited');
  const labels = tagged.map((s) => ({ label: s.source, channel: channelOf(s.source), ...line([s.source], [s]) }));
  const byChannel = new Map<string, Source[]>();
  for (const s of tagged) byChannel.set(channelOf(s.source), [...(byChannel.get(channelOf(s.source)) ?? []), s]);
  const channels = [...byChannel].map(([channel, xs]) => ({ channel, ...line(xs.map((s) => s.source).sort(), xs) }))
    .sort((a, b) => b.joined - a.joined || (b.cost ?? 0) - (a.cost ?? 0) || a.channel.localeCompare(b.channel));

  // посты: вход по любой метке канала — к последнему посту канала, вышедшему до входа; кривая — по часам от выхода
  const posts = rows.filter((s) => s.posted_at).map((s) => ({ s, at: postedMs(s)!, channel: channelOf(s.label) })).sort((a, b) => a.at - b.at);
  const postsView = posts.map(({ s, at, channel }) => {
    const meta = noteMeta(s.note);
    const next = posts.find((p) => p.channel === channel && p.at > at)?.at ?? Infinity;
    const base = { id: s.id, label: s.label, channel, name: s.channel, at: new Date(at).toISOString(), timeKnown: meta.time != null,
      price: s.price, currency: s.currency, reach: meta.reach };
    if (!arrivals) return { ...base, joined: null, joined48: null, activated48: null, hours: null, activatedHours: null, perJoined: null, byLabel: null };
    const mine = arrivals.filter((a) => channelOf(a.source) === channel).map((a) => ({ ...a, t: Date.parse(a.at) })).filter((a) => a.t >= at && a.t < next);
    const hours = Array<number>(HOURS).fill(0), activatedHours = Array<number>(HOURS).fill(0);
    for (const a of mine) { const h = Math.floor((a.t - at) / 3600e3); if (h < HOURS) { hours[h]++; if (a.activated) activatedHours[h]++; } }
    const byLabel: Record<string, number> = {};
    for (const a of mine) byLabel[a.source] = (byLabel[a.source] ?? 0) + 1;
    return { ...base, joined: mine.length, joined48: hours.reduce((a, b) => a + b, 0), activated48: activatedHours.reduce((a, b) => a + b, 0),
      hours, activatedHours, perJoined: per(s.price, mine.length), byLabel };
  }).reverse();
  return { arrivalsKnown: Boolean(arrivals), strictKnown: Boolean(arrivals?.some((a) => a.rated != null)), labels, channels, posts: postsView };
}

/** Строка списка посевов после разбора. note — только «прочее»: охват и время в заметку дописывает seedingBody. */
export interface ParsedSeeding {
  line: number; label: string | null; channel: string | null; posted_at: string | null; time: string | null;
  price: number | null; currency: string | null; reach: number | null; note: string | null; warnings: string[]; error?: string;
}
const CURRENCY: Record<string, string> = { '₽': 'RUB', 'р': 'RUB', 'руб': 'RUB', '₸': 'KZT', '$': 'USD', '€': 'EUR' };

/** Посевы списком (23.10): строка — пост. Понимает «@канал метка цена дата [время] [заметка]» в любом порядке через
 *  пробелы, `;`, табы (вставка из таблицы) или `|` (строки таблиц плана как есть). Метка — `tg_…`, в `обратных
 *  кавычках` или ссылкой с `--s`; нет метки — tg_<канал>. Цена — число с ₽ или первое голое число; «~7 000» и
 *  «охват 7000» — охват; «18,6 тыс.» (подписчики) — в заметку. Дата — 2026-10-25 или 25.10[.2026]. В таблице, у которой
 *  в заголовке «потолок», ₽ — не цена, а потолок цены из плана: он уходит в заметку, цену впишут после покупки. */
export function parseSeedingList(text: string, opts: { year: number; currency?: string }): ParsedSeeding[] {
  const out: ParsedSeeding[] = [];
  let ceiling = false;
  text.split(/\r?\n/).forEach((raw, i) => {
    let s = raw.replace(/[\u00a0\u202f]/g, ' ').trim();
    if (!s.startsWith('|')) ceiling = false;
    if (!s || /^\|?\s*:?-{3,}/.test(s) || s.startsWith('#')) return;
    // «5 600 ₽» → «5600₽», «~7 000» → «~7000», «18,6 тыс.» → «18,6тыс.», «охват 7000» → «охват:7000»
    s = s.replace(/(?<![\d.,:])\d{1,3}(?: \d{3})+(?![\d.:])/g, (m) => m.replace(/ /g, '')).replace(/(\d)\s*(₽|₸|\$|€|руб\.?|р\.)/g, '$1$2').replace(/(\d)\s+(тыс\.?)/g, '$1$2')
      .replace(/охват[а-яё]*\s*[:=]?\s*~?\s*(?=\d)/gi, 'охват:').replace(/(\d{4}-\d{2}-\d{2})T/, '$1 ');
    const cells = s.includes('|') ? s.split('|') : s.includes('\t') ? s.split('\t') : s.includes(';') ? s.split(';') : [s];
    const r: ParsedSeeding = { line: i + 1, label: null, channel: null, posted_at: null, time: null, price: null, currency: null, reach: null, note: null, warnings: [] };
    const rest: string[] = [];
    let plain: number[] = [];
    for (const cell of cells.map((c) => c.trim()).filter(Boolean)) {
      const left: string[] = [];
      for (const tok of cell.split(/\s+/)) {
        const t = tok.replace(/^`|`$/g, '').replace(/[,.]$/, (m) => (/\d[,.]$/.test(tok) ? m : ''));
        let m: RegExpExecArray | null;
        if ((m = /(?:startapp|start)=[^\s]*?--s([a-z0-9_]+)/.exec(t)) || (m = /^--s([a-z0-9_]+)$/.exec(t))) r.label = m[1];
        else if ((m = /^(?:https?:\/\/)?t\.me\/(?!.*start)([A-Za-z][A-Za-z0-9_]{3,31})\/?$/.exec(t)) || (m = /^@([A-Za-z][A-Za-z0-9_]{3,31})$/.exec(t))) r.channel = `@${m[1]}`;
        else if (/^tg_[a-z0-9_]+$/.test(t) || (/^`[a-z0-9_]+`$/.test(tok) && !r.label)) r.label = t;
        else if ((m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t))) r.posted_at = `${m[1]}-${m[2]}-${m[3]}`;
        else if ((m = /^(\d{1,2})\.(\d{1,2})(?:\.(\d{2}|\d{4}))?$/.exec(t)) && Number(m[2]) >= 1 && Number(m[2]) <= 12) {
          const y = m[3] ? (m[3].length === 2 ? `20${m[3]}` : m[3]) : String(opts.year);
          r.posted_at = `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
        } else if ((m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(t))) r.time = `${m[1].padStart(2, '0')}:${m[2]}`;
        else if ((m = /^(\d+(?:[.,]\d+)?)(₽|₸|\$|€|руб\.?|р\.)$/.exec(t))) { r.price = Number(m[1].replace(',', '.')); r.currency = CURRENCY[m[2].replace('.', '')] ?? null; }
        else if ((m = /^(?:~|охват:)(\d+)$/.exec(t))) r.reach = Number(m[1]);
        else if (/^\d+$/.test(t)) plain.push(Number(t));
        else left.push(tok.replace(/^(\d+(?:,\d+)?)(тыс\.?)$/, '$1 тыс. подписчиков'));
      }
      if (left.length) rest.push(left.join(' '));
    }
    if (r.price == null && plain.length) { r.price = plain[0]; plain = plain.slice(1); }
    if (r.reach == null && plain.length) { r.reach = plain[0]; plain = plain.slice(1); }
    if (plain.length) rest.push(plain.join(' '));
    // заголовок таблицы и прочие строки без единого поля — мимо, молча
    if (!r.label && !r.channel && r.price == null && !r.posted_at) { if (s.startsWith('|') && /потолок/i.test(s)) ceiling = true; return; }
    if (ceiling && r.price != null) { rest.unshift(`потолок ${r.price} ${r.currency === 'RUB' || !r.currency ? '₽' : r.currency}`); r.price = null; r.warnings.push('₽ из плана — потолок, не цена: цену впишите после покупки'); }
    if (!r.label && r.channel) { r.label = `tg_${r.channel.slice(1).toLowerCase()}`.slice(0, 24); r.warnings.push(`метка не указана — ${r.label}`); }
    if (r.label && r.label.length > 24) r.error = `метка длиннее 24 знаков (${r.label.length}) — сервер её не запишет`;
    else if (!r.label) r.error = 'нет ни метки, ни канала';
    else if (!LABEL.test(r.label)) r.error = 'метка: только латиница, цифры и _';
    const ms = r.posted_at ? Date.parse(`${r.posted_at}T00:00:00Z`) : 0;
    if (r.posted_at && (Number.isNaN(ms) || new Date(ms).toISOString().slice(0, 10) !== r.posted_at)) r.error = `нет такой даты: ${r.posted_at}`;
    if (!r.posted_at) r.warnings.push(r.time ? 'время без даты — не запишется' : 'дата выхода не указана');
    if (r.price == null && !ceiling) r.warnings.push('без цены');
    r.currency ??= opts.currency ?? 'RUB';
    r.note = rest.join('; ') || null;
    out.push(r);
  });
  const seen = new Map<string, number>();
  for (const r of out) {
    const k = `${r.label}|${r.posted_at ?? ''}`;
    if (seen.has(k)) r.warnings.push(`повтор строки ${seen.get(k)}`); else seen.set(k, r.line);
  }
  return out;
}

/** Тело PUT /api/admin/seeding: разобранная строка поверх записанного посева (тот же посев — та же метка и дата,
 *  либо записанный без даты). Пустое в строке не стирает записанное; охват и время — в заметку. */
export function seedingBody(r: ParsedSeeding, old?: SeedingRow) {
  const was = noteMeta(old?.note);
  const oldRest = (old?.note ?? '').split(/;\s*/).filter((x) => x && !/^охват(?![а-яё])/i.test(x) && !/^выход(?![а-яё])/i.test(x)).join('; ');
  const reach = r.reach ?? was.reach, time = r.posted_at ? (r.time ?? was.time) : was.time;
  const note = [reach != null ? `охват ${reach}` : null, time ? `выход ${time}` : null, r.note ?? (oldRest || null)].filter(Boolean).join('; ');
  return { ...(old ? { id: old.id } : {}), label: r.label, channel: r.channel ?? old?.channel ?? null, posted_at: r.posted_at ?? old?.posted_at ?? null,
    price: r.price ?? old?.price ?? null, currency: r.price != null ? r.currency : (old?.currency ?? r.currency), note: note || null };
}
/** Какой записанный посев правит строка: та же метка и дата; строка без даты или посев без даты — по метке. */
export function matchSeeding(r: ParsedSeeding, rows: SeedingRow[]): SeedingRow | undefined {
  const same = rows.filter((s) => s.label === r.label);
  return same.find((s) => r.posted_at && s.posted_at === r.posted_at) ?? (r.posted_at ? same.find((s) => !s.posted_at) : (same.length === 1 ? same[0] : same.find((s) => !s.posted_at)));
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
  if (path === '/api/data' && req.method === 'GET') {
    const r = await data(params, params.has('fresh'));
    if (r.code !== 200) return send(res, r.code, r.body);
    const body = r.body as Parameters<typeof campaignView>[0];
    return send(res, 200, { ...body, campaign: campaignView(body) });
  }
  // посевы списком (23.10): разбор без записи — для просмотра; запись — по строке, поверх записанного того же посева
  if ((path === '/api/seeding/parse' || path === '/api/seeding/bulk') && req.method === 'POST') {
    const b = JSON.parse((await readBody(req)) || '{}') as { text?: string; currency?: string };
    const parsed = parseSeedingList(String(b.text ?? ''), { year: new Date().getFullYear(), currency: b.currency });
    const now = await call('/api/admin/seeding');
    if (now.code !== 200) return send(res, now.code, now.body);
    const rows = (now.body as { seeding: SeedingRow[] }).seeding;
    const plan = parsed.map((r) => { const old = r.error ? undefined : matchSeeding(r, rows); return { ...r, update: old?.id ?? null, body: r.error ? null : seedingBody(r, old) }; });
    const twice = new Set(plan.map((p) => p.update).filter((id, i, xs) => id && xs.indexOf(id) !== i));
    for (const p of plan) if (p.update && twice.has(p.update)) p.warnings.push('ещё одна строка правит тот же посев — останется последняя');
    if (path === '/api/seeding/parse') return send(res, 200, { rows: plan });
    cache.clear();
    const done: { line: number; ok: boolean; id?: string; error?: string }[] = [];
    // по одному: сервер один, и ответ на каждую строку нужен в отчёте
    for (const p of plan) {
      if (!p.body) { done.push({ line: p.line, ok: false, error: p.error }); continue; }
      const w = await call('/api/admin/seeding', { method: 'PUT', body: JSON.stringify(p.body) });
      done.push({ line: p.line, ok: w.code === 200, ...(w.code === 200 ? { id: (w.body as { id: string }).id } : { error: (w.body as { error?: string; hint?: string }).hint ?? (w.body as { error?: string }).error }) });
    }
    return send(res, 200, { done });
  }
  // посевы: правка идёт на сервер, кэш сводки сбрасывается
  if (path === '/api/seeding' && req.method === 'PUT') { cache.clear(); const r = await call('/api/admin/seeding', { method: 'PUT', body: await readBody(req) }); return send(res, r.code, r.body); }
  const del = /^\/api\/seeding\/(sd-[0-9a-f]{12})$/.exec(path);
  if (del && req.method === 'DELETE') { cache.clear(); const r = await call(`/api/admin/seeding/${del[1]}`, { method: 'DELETE' }); return send(res, r.code, r.body); }
  return send(res, 404, { error: 'not_found' });
}
