// Вкладка «Проверка» общего пульта (tools/desk.mts, http://127.0.0.1:8721/check/) — 02.10.
//
// Таблица разметки и форма правки — одно и то же: строки те, что идут в Google-таблицу
// (непроверенные привязки индекса разборов), а решение пишется сразу в tools/markup-verdicts.json
// (`from: 'check'`) — без круга «выгрузка → таблица → pull → импорт». Google-таблица остаётся для
// тех, у кого пульта нет; её импорт решений «Проверки» не перетирает (tools/import-markup.py).
//
// Первыми идут спорные: где модель (tools/llm-label.mts через llm-gateway основы) не согласна с
// опознавателем по названию — другой фильм, не о фильме, несколько фильмов. Её подсказка — в
// строке, Enter принимает её. Дальше — непроверенные, потом ролики без привязки, где модель
// фильм нашла.
//
// Над таблицей — конвейер (tools/pipeline.mts): шаги от сбора каналов до архива для bothost,
// отметки, «устарел», кнопки и лог прогона.
import type { IncomingMessage, ServerResponse } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { worksIndex } from './works-index.mts';
import { filmOptions, matchFilm, type FilmOption } from './links-desk-lib.mts';
import { FLAG_RU, KIND_RU, readLabels, resolver, suggest, LABELS_FILE, TYPE_RU, type Flag, type MarkupError, type Suggestion } from './llm-lib.mts';
import { probeSheet, runState, startRun, staleIds, status, stopRun, STAGES } from './pipeline.mts';
import { excludedChannels, isExcluded } from './youtube-channels.mts';
import { aboutByLabel, resolveAbout, searchAbout, type AboutKind } from './about-lib.mts';
import { inFocusKey, readProfiles, PROFILES } from './channel-profile.mts';
import { readStop, stopMatcher, STOP_FILE, tokens, writeStop } from './stopwords-lib.mts';
import { pairKey, PRECISION, readPrecision } from './link-precision.mts';
import { saveVerdicts } from './registry-lib.mts';

const ROOT = new URL('../', import.meta.url);

/** Покрытие разметкой (tools/markup-coverage.mts): из кеша; нет кеша или просят свежее — пересчёт
 *  на месте (около трёх секунд), решения людей между тем могли прибавиться. */
const COVERAGE = new URL('.cache/markup-coverage.json', ROOT);
function coverage(fresh: boolean): unknown {
  if (fresh || !existsSync(COVERAGE)) {
    const r = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['--yes', 'tsx', 'tools/markup-coverage.mts'],
      { cwd: new URL('.', ROOT).pathname, encoding: 'utf8', timeout: 120_000 });
    if (r.status !== 0 && !existsSync(COVERAGE)) return { error: (r.stderr || r.stdout || 'не посчиталось').trim().split('\n').slice(-3).join(' ') };
  }
  try { return JSON.parse(readFileSync(COVERAGE, 'utf8')); } catch (e) { return { error: (e as Error).message }; }
}
/** TM_VERDICTS — другой файл решений (проверки пульта без порчи настоящей разметки) */
const VERDICTS = process.env.TM_VERDICTS ? pathToFileURL(process.env.TM_VERDICTS) : new URL('tools/markup-verdicts.json', ROOT);
const ESSAYS = new URL('src/mocks/essaysAuto.ts', ROOT);
const PAGE = new URL('./check-desk.html', import.meta.url);
const CANDS = new URL('.cache/stopword-candidates.json', ROOT);

// справочник: ярлыки как в таблице разметки и пульте ссылок
const all = worksIndex({ all: true });
const films = filmOptions(all);
const byKey = new Map(films.map((f) => [f.key, f]));
const byLabel = new Map(films.map((f) => [f.label.toLowerCase(), f]));
const resolve = resolver(all);
/** подсказки модели «о франшизе / о человеке» — к вселенным и людям нашего справочника */
const SOPTS = { about: resolveAbout };
const otherLabel = new Map(all.map((w) => [w.key, `${w.work.title}${w.work.year ? ` (${w.work.year})` : ''}`]));
const labelOf = (key: string | null | undefined): string | undefined => (key ? byKey.get(key)?.label ?? otherLabel.get(key) ?? key : undefined);
const searchable = films.map((f) => ({ f, n: f.label.toLowerCase().replace(/ё/g, 'е') }));

type Verdict = { key: string | null; why?: string; film?: string; from?: string; at?: string; guess?: boolean; err?: MarkupError; also?: string[]; alsoFilms?: string[]; title?: string;
  /** ролик о франшизе (вселенной) или человеке: элемент Wikidata цели и её название (02.10) */
  about?: string; aboutKind?: AboutKind; aboutTitle?: string };
type Analysis = { id: string; title: string; author: string; url: string; unverified?: boolean; evidence?: string; durationMinutes?: number; publishedAt?: string };

export interface Row {
  id: string; title: string; channel?: string; date?: string; minutes?: number;
  /** привязка индекса — то, что сделал опознаватель (или уже применённое решение) */
  key?: string; film?: string; evidence?: string;
  /** привязка вне преобладающей вселенной канала (профиль канала, 02.10) — на проверку */
  offFocus?: boolean;
  /** в заголовке стоп-слово владельца (tools/stopwords.json): при следующей сборке индекса привязки не будет */
  stop?: string;
  /** канал, где опознаватель этим способом часто ошибается: доля верных (tools/link-precision.mts) */
  weak?: number;
  verdict?: Verdict;
  llm?: { kind: string; kindRu: string; note: string; conf?: number; flag: Flag; flagRu: string; err?: MarkupError;
    key?: string; label?: string; also: { key: string; label: string }[]; typed?: string; model: string;
    about?: { kind: AboutKind; id?: string; title: string; label?: string }; topic?: string };
  /** spor — модель спорит; check — не проверено; gap — без привязки, модель нашла фильм;
   *  confirmed — подтверждено уликой, модель не спорит; done — решено человеком */
  group: 'spor' | 'check' | 'gap' | 'confirmed' | 'done';
}

// ─── строки ───────────────────────────────────────────────────────────────────
const mt = (u: URL) => { try { return statSync(u).mtimeMs; } catch { return 0; } };
let cache: { sig: string; rows: Row[] } | undefined;

function readVerdicts(): { body: Record<string, unknown>; videos: Record<string, Verdict> } {
  const body = existsSync(VERDICTS) ? JSON.parse(readFileSync(VERDICTS, 'utf8')) as Record<string, unknown> : {};
  return { body, videos: (body.videos ?? {}) as Record<string, Verdict> };
}

/** Очередь «Проверки» — она же пачка Google-таблицы (tools/markup-xlsx.mts, 06.10). */
export function checkRows(): Row[] { return rows(); }

function rows(): Row[] {
  const sig = [mt(ESSAYS), mt(VERDICTS), mt(LABELS_FILE), mt(PROFILES), mt(STOP_FILE), mt(PRECISION)].join(':');
  if (cache?.sig === sig) return cache.rows;
  const src = existsSync(ESSAYS) ? readFileSync(ESSAYS, 'utf8') : '';
  const essays = src ? JSON.parse(src.slice(src.indexOf('= {') + 2, src.lastIndexOf(';'))) as Record<string, Analysis[]> : {};
  const linked = new Map<string, { key: string; a: Analysis }>();
  for (const [key, list] of Object.entries(essays)) {
    for (const a of list) {
      const vid = /[?&]v=([A-Za-z0-9_-]{11})/.exec(a.url)?.[1];
      if (vid && !linked.has(vid)) linked.set(vid, { key, a });
    }
  }
  const { videos } = readVerdicts();
  const labels = readLabels().items;
  const out: Row[] = [];
  // убранные каналы (tools/channels-excluded.json) не показываем, даже пока индекс не пересобран
  const excluded = excludedChannels();
  const gone = (title?: string) => Boolean(title) && isExcluded({ title }, excluded);
  const dominant = new Map(Object.entries(readProfiles()).filter(([, p]) => p.dominant?.length).map(([ch, p]) => [ch, p.dominant]));
  const offFocus = (ch: string, key: string) => Boolean(dominant.get(ch) && !inFocusKey(key, dominant.get(ch)!));
  const stopOf = stopMatcher();
  const prec = readPrecision();
  const weakP = (ch: string, ev?: string) => { const k = pairKey(ch, ev && ev !== 'channel' ? ev : 'title'); return prec?.weak.includes(k) ? prec.pair[k]?.p : undefined; };
  const llmOf = (s: Suggestion, lab: (typeof labels)[string]): Row['llm'] => ({
    kind: lab.kind, kindRu: KIND_RU[lab.kind], note: s.note, ...(lab.conf != null ? { conf: lab.conf } : {}), flag: s.flag, flagRu: FLAG_RU[s.flag],
    ...(s.err ? { err: s.err } : {}), ...(s.key ? { key: s.key, label: labelOf(s.key) } : {}), also: s.also.map((a) => ({ key: a.key, label: labelOf(a.key)! })),
    ...(s.typed ? { typed: s.typed } : {}), model: lab.model,
    ...(s.about ? { about: s.about } : {}), ...(lab.topic ? { topic: `${lab.topic.type ? `${TYPE_RU[lab.topic.type] ?? lab.topic.type}: ` : ''}${lab.topic.name}` } : {}),
  });
  const seen = new Set<string>();
  for (const [vid, { key, a }] of linked) {
    seen.add(vid);
    if (gone(a.author)) continue;
    const v = videos[vid];
    const lab = labels[`yt:${vid}`];
    // спорим с опознавателем, а не с уже применённым решением человека
    const s = lab ? suggest(v && !v.guess ? undefined : key, lab, resolve, SOPTS) : undefined;
    const decided = Boolean(v && !v.guess);
    const off = !decidedEarly(v) && !a.evidence?.startsWith('human') && offFocus(a.author, key);
    const stopHit = decidedEarly(v) ? undefined : stopOf(a.title, a.author);
    const weak = decidedEarly(v) ? undefined : weakP(a.author, a.evidence);
    const spor = off || Boolean(stopHit) || weak != null || (s && ['wrong', 'notfilm', 'several', 'unknown', 'franchise', 'person'].includes(s.flag));
    out.push({
      id: vid, title: a.title, channel: a.author, ...(a.publishedAt ? { date: a.publishedAt } : {}), ...(a.durationMinutes ? { minutes: a.durationMinutes } : {}),
      key, film: labelOf(key), ...(a.evidence ? { evidence: a.evidence } : {}), ...(off ? { offFocus: true } : {}), ...(stopHit ? { stop: stopHit } : {}), ...(weak != null ? { weak } : {}), ...(v ? { verdict: v } : {}),
      // решённое — модель сверяется с решением человека: видно, где она с людьми не согласна
      ...(lab && s && !decided ? { llm: llmOf(s, lab) } : lab && decided ? { llm: llmOf(suggest(v!.key ?? undefined, lab, resolve, SOPTS), lab) } : {}),
      group: decided ? 'done' : spor ? 'spor' : a.unverified ? 'check' : 'confirmed',
    });
  }
  // ролики без привязки, где модель фильм нашла
  for (const [id, lab] of Object.entries(labels)) {
    if (lab.src !== 'yt') continue;
    const vid = id.slice(3);
    if (seen.has(vid) || gone(lab.channel)) continue;
    const v = videos[vid];
    const s = suggest(undefined, lab, resolve, SOPTS);
    if (!v && !(s.flag === 'gap' || s.flag === 'franchise' || s.flag === 'person' || (s.flag === 'unknown' && lab.kind === 'one'))) continue;
    seen.add(vid);
    out.push({
      id: vid, title: lab.title ?? vid, ...(lab.channel ? { channel: lab.channel } : {}), ...(lab.date ? { date: lab.date } : {}), ...(lab.minutes ? { minutes: lab.minutes } : {}),
      ...(v ? { verdict: v } : {}), llm: llmOf(s, lab), group: v && !v.guess ? 'done' : 'gap',
    });
  }
  // решённое без строки индекса и без разметки модели — тоже видно в «Решено»
  for (const [vid, v] of Object.entries(videos)) {
    if (seen.has(vid) || v.from !== 'check') continue;
    out.push({ id: vid, title: v.title ?? vid, verdict: v, group: 'done' });
  }
  const rank: Record<Row['group'], number> = { spor: 0, check: 1, gap: 2, confirmed: 3, done: 4 };
  out.sort((a, b) => rank[a.group] - rank[b.group]
    || (a.group === 'done' ? (b.verdict?.at ?? '').localeCompare(a.verdict?.at ?? '') : 0)
    || (a.group === 'spor' || a.group === 'gap' ? (b.llm?.conf ?? 0) - (a.llm?.conf ?? 0) : 0)
    || (b.date ?? '').localeCompare(a.date ?? ''));
  cache = { sig, rows: out };
  return out;
}

// ─── решение ──────────────────────────────────────────────────────────────────
const undo = new Map<string, Verdict | null>();      // ролик → что было до решения в этом сеансе
let decidedNow = 0;

/** Название из поля: ярлык списка, иначе узнать (название и год), иначе — «нет у нас» как есть. */
function filmFrom(text: string): { key: string; film: string } | { key: null; film: string } | undefined {
  const t = text.trim();
  if (!t) return undefined;
  const f = byLabel.get(t.toLowerCase());
  if (f) return { key: f.key, film: f.label };
  const m = matchFilm(t.replace(/\s*\((?:сериал,\s*)?\d{4}\)$/, ''), Number(/(\d{4})\)?$/.exec(t)?.[1]) || undefined, films);
  if (m.pick) return { key: m.pick.key, film: m.pick.label };
  const r = resolve({ title: t.replace(/\s*\((?:сериал,\s*)?\d{4}\)$/, ''), ...(Number(/(\d{4})\)?$/.exec(t)?.[1]) ? { year: Number(/(\d{4})\)?$/.exec(t)![1]) } : {}) });
  if (r.key) return { key: r.key, film: labelOf(r.key)! };
  return { key: null, film: t.replace(/\s*\((?:сериал,?\s*)?((?:19|20)\d{2})?\)\s*$/i, (_, y) => (y ? ` (${y})` : '')).trim() };
}

export interface Decision { id: string; action: 'ok' | 'wrong' | 'notfilm' | 'several' | 'set' | 'franchise' | 'person' | 'undo' | 'clear'; film?: string; also?: string[] }

/** Решение по ролику. `from` — откуда оно: 'check' (пульт) или 'phone' (экран владельца в приложении,
 *  tools/owner-pull.mts); `clear` снимает решение целиком. */
export async function decide(d: Decision, from = 'check'): Promise<{ ok: true; verdict?: Verdict } | { ok: false; error: string }> {
  if (!/^[A-Za-z0-9_-]{11}$/.test(d.id)) return { ok: false, error: 'id ролика' };
  const { body, videos } = readVerdicts();
  const row = rows().find((r) => r.id === d.id);
  const today = new Date().toISOString().slice(0, 10);
  const title = row?.title;
  let v: Verdict | null;
  if (d.action === 'clear') {
    v = null;
  } else if (d.action === 'undo') {
    if (!undo.has(d.id)) return { ok: false, error: 'в этом сеансе решения по ролику не было' };
    v = undo.get(d.id)!;
    undo.delete(d.id);
    decidedNow = Math.max(0, decidedNow - 1);
  } else {
    if (!undo.has(d.id)) { undo.set(d.id, videos[d.id] ?? null); decidedNow += 1; }
    const base = { from, at: today };
    const also = (d.also ?? []).map(filmFrom).filter(Boolean) as { key: string | null; film: string }[];
    const alsoPart = also.length ? {
      ...(also.some((x) => x.key) ? { also: also.filter((x) => x.key).map((x) => x.key!) } : {}),
      ...(also.some((x) => !x.key) ? { alsoFilms: also.filter((x) => !x.key).map((x) => x.film) } : {}),
    } : {};
    if (d.action === 'ok') {
      if (!row?.key) return { ok: false, error: 'у ролика нет привязки — нечего подтверждать' };
      v = { key: row.key, film: labelOf(row.key), ...base };
    } else if (d.action === 'notfilm') {
      v = { key: null, why: 'не про фильм', err: 'не фильм', ...base };
    } else if (d.action === 'franchise' || d.action === 'person') {
      // о франшизе или человеке: к фильму не привязываем; цель — вселенная или человек из справочника,
      // незнакомое название остаётся названием (`aboutTitle`) — индекс попробует узнать его снова
      const kind: AboutKind = d.action === 'franchise' ? 'universe' : 'person';
      const why = d.action === 'franchise' ? 'о франшизе' as const : 'о человеке' as const;
      const text = (d.film ?? '').trim();
      if (!text) return { ok: false, error: d.action === 'franchise' ? 'какая франшиза?' : 'о ком ролик?' };
      const ref = aboutByLabel(kind, text);
      v = { key: null, why, ...(row?.key ? { err: why } : {}), aboutKind: kind, ...(ref ? { about: ref.id } : {}), aboutTitle: ref?.title ?? text,
        ...(title ? { title } : {}), ...base };
    } else {
      const f = filmFrom(d.film ?? '') ?? (d.action === 'several' && row?.key ? { key: row.key, film: labelOf(row.key)! } : undefined);
      const err: MarkupError | undefined = d.action === 'wrong' ? 'не тот фильм' : d.action === 'several' || also.length ? 'несколько фильмов' : undefined;
      if (!f) v = { key: null, why: 'не тот фильм', ...(err ? { err } : {}), ...base };
      else if (f.key) v = { key: f.key, film: f.film, ...(err ? { err } : {}), ...alsoPart, ...base };
      else v = { key: null, why: 'нет у нас', film: f.film, ...(err ? { err } : {}), ...(title ? { title } : {}), ...alsoPart, ...base };
    }
  }
  if (v) videos[d.id] = v; else delete videos[d.id];
  body.updated = today;
  body.videos = Object.fromEntries(Object.entries(videos).sort(([a], [b]) => a.localeCompare(b)));
  // реестр (06.10): в базу приложения и снимком в файл — tools/registry-lib.mts
  await saveVerdicts(body, from);
  cache = undefined;
  return { ok: true, ...(v ? { verdict: v } : {}) };
}

// ─── http ─────────────────────────────────────────────────────────────────────
const send = (res: ServerResponse, code: number, body: unknown, type = 'application/json; charset=utf-8') => {
  res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
};
const readBody = (req: IncomingMessage): Promise<string> => new Promise((ok, fail) => {
  const chunks: Buffer[] = [];
  req.on('data', (c: Buffer) => chunks.push(c));
  req.on('end', () => ok(Buffer.concat(chunks).toString('utf8')));
  req.on('error', fail);
});

// ─── выборка: фильтры, сортировка, страницы ────────────────────────────────────
/** Каждый фильтр — функция «строка проходит?»; панель фильтров на странице строится из `facets`:
 *  счётчик значения считается по строкам, прошедшим все остальные фильтры (как в каталогах). */
const lower = (s: string) => s.toLowerCase().replace(/ё/g, 'е');
const evOf = (r: Row) => (r.verdict && !r.verdict.guess ? 'human' : r.stop ? 'stopword' : r.offFocus ? 'offfocus' : r.weak != null ? 'weakch' : r.evidence ?? (r.key ? 'title' : 'none'));
const decidedEarly = (v?: Verdict) => Boolean(v && !v.guess);
const vdOf = (r: Row): string => {
  const v = r.verdict;
  if (!v || v.guess) return 'none';
  if (v.why === 'нет у нас') return 'unknown';
  if (v.why === 'о франшизе' || v.err === 'о франшизе') return 'franchise';
  if (v.why === 'о человеке' || v.err === 'о человеке') return 'person';
  if (v.err === 'не фильм' || v.why === 'не про фильм') return 'notfilm';
  if (v.err === 'несколько фильмов' || v.also?.length || v.alsoFilms?.length) return 'several';
  if (v.err === 'не тот фильм' || v.why === 'не тот фильм') return 'wrong';
  return 'ok';
};
type Dim = 'g' | 'ch' | 'flag' | 'kind' | 'ev' | 'vd' | 'topic' | 'rest';
const DIMS: Exclude<Dim, 'rest'>[] = ['g', 'ch', 'flag', 'kind', 'ev', 'vd', 'topic'];
const valueOf: Record<Exclude<Dim, 'rest'>, (r: Row) => string> = {
  g: (r) => r.group, ch: (r) => r.channel ?? '—', flag: (r) => r.llm?.flag ?? 'nolabel', kind: (r) => r.llm?.kind ?? 'nolabel', ev: evOf, vd: vdOf,
  // тема ролика по модели (жанр, эпоха…): копим статистику для жанров (02.10)
  topic: (r) => r.llm?.topic ?? 'none',
};

function filters(p: URLSearchParams): Record<Dim, (r: Row) => boolean> {
  const set = (k: string) => { const v = p.get(k); return v ? new Set(v.split(',').filter(Boolean)) : undefined; };
  // g=open — всё нерешённое без улики: спорные и без проверки (из «Покрытия», 03.10)
  const g = p.get('g');
  const sets = Object.fromEntries(DIMS.map((d) => [d, d === 'g' ? (g === 'open' ? new Set(['spor', 'check']) : g && g !== 'all' ? new Set([g]) : undefined) : set(d)]));
  const q = lower(p.get('q') ?? '').trim();
  const dmin = Number(p.get('dmin')) || 0, dmax = Number(p.get('dmax')) || 0;
  const from = p.get('from') ?? '', to = p.get('to') ?? '';
  const cmin = Number(p.get('cmin')) || 0;
  // фильтры столбцов таблицы: ролик (название или канал), привязка (фильм), модель (что назвала)
  const ft = lower(p.get('ft') ?? '').trim(), ff = lower(p.get('ff') ?? '').trim(), fn = lower(p.get('fn') ?? '').trim();
  const out = Object.fromEntries(DIMS.map((d) => [d, (r: Row) => !sets[d] || sets[d]!.has(valueOf[d](r))])) as Record<Dim, (r: Row) => boolean>;
  out.rest = (r) => (!q || lower(`${r.title} ${r.channel ?? ''} ${r.film ?? ''} ${r.llm?.note ?? ''} ${r.verdict?.film ?? ''} ${r.verdict?.aboutTitle ?? ''} ${r.id}`).includes(q))
    && (!dmin || (r.minutes ?? 0) >= dmin) && (!dmax || (r.minutes ?? Infinity) <= dmax)
    && (!from || (r.date ?? '') >= from) && (!to || (r.date ?? '9999') <= to)
    && (!cmin || (r.llm?.conf ?? 0) >= cmin)
    && (!ft || lower(`${r.title} ${r.channel ?? ''}`).includes(ft))
    && (!ff || lower(`${r.film ?? ''} ${r.verdict?.film ?? ''} ${r.verdict?.aboutTitle ?? ''}`).includes(ff))
    && (!fn || lower(`${r.llm?.note ?? ''} ${r.llm?.label ?? ''} ${r.llm?.typed ?? ''}`).includes(fn));
  return out;
}

const SORTS: Record<string, (a: Row, b: Row) => number> = {
  date: (a, b) => (b.date ?? '').localeCompare(a.date ?? ''),
  'date-asc': (a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999'),
  conf: (a, b) => (b.llm?.conf ?? -1) - (a.llm?.conf ?? -1),
  dur: (a, b) => (b.minutes ?? -1) - (a.minutes ?? -1),
  'dur-asc': (a, b) => (a.minutes ?? Infinity) - (b.minutes ?? Infinity),
  channel: (a, b) => (a.channel ?? '').localeCompare(b.channel ?? '', 'ru') || (b.date ?? '').localeCompare(a.date ?? ''),
  decided: (a, b) => (b.verdict?.at ?? '').localeCompare(a.verdict?.at ?? ''),
  'decided-asc': (a, b) => (a.verdict?.at ?? '9999').localeCompare(b.verdict?.at ?? '9999'),
  'conf-asc': (a, b) => (a.llm?.conf ?? 2) - (b.llm?.conf ?? 2),
  film: (a, b) => (a.film ?? a.verdict?.film ?? '\uffff').localeCompare(b.film ?? b.verdict?.film ?? '\uffff', 'ru'),
  'film-desc': (a, b) => (b.film ?? b.verdict?.film ?? '').localeCompare(a.film ?? a.verdict?.film ?? '', 'ru'),
};

function select(p: URLSearchParams) {
  const all = rows();
  const f = filters(p);
  const pass = (r: Row, skip?: Dim) => (Object.keys(f) as Dim[]).every((d) => d === skip || f[d](r));
  const facets = Object.fromEntries(DIMS.map((d) => {
    const m = new Map<string, number>();
    for (const r of all) if (pass(r, d)) { const v = valueOf[d](r); m.set(v, (m.get(v) ?? 0) + 1); }
    const list = [...m].sort((a, b) => b[1] - a[1]);
    return [d, d === 'ch' ? list.slice(0, 400) : d === 'topic' ? Object.fromEntries(list.slice(0, 60)) : Object.fromEntries(list)];
  }));
  const list = all.filter((r) => pass(r));
  const sort = SORTS[p.get('sort') ?? ''];
  if (sort) list.sort(sort);                      // иначе — порядок rows(): спорные, непроверенные, …
  const per = Math.min(200, Math.max(1, Number(p.get('per')) || 20));
  const pages = Math.max(1, Math.ceil(list.length / per));
  const page = Math.min(pages, Math.max(1, Number(p.get('page')) || 1));
  return { rows: list.slice((page - 1) * per, page * per), total: list.length, page, pages, per, facets };
}

function pipeline() {
  return { stages: status(), run: runState(), stale: staleIds(), order: STAGES.map((s) => s.id) };
}

/** Вкладка общего пульта: `path` — адрес внутри вкладки. Хост и x-desk проверил tools/desk.mts. */
export async function checkRoute(req: IncomingMessage, res: ServerResponse, path: string): Promise<void> {
  // общий пульт отдаёт сюда только путь — параметры запроса берём из самого запроса
  const url = { pathname: path, searchParams: new URL(req.url ?? '/', 'http://x').searchParams };
  if (req.method === 'GET' && url.pathname === '/') return send(res, 200, readFileSync(PAGE, 'utf8'), 'text/html; charset=utf-8');
  if (req.method === 'GET' && url.pathname === '/api/rows') {
    const labels = readLabels();
    return send(res, 200, { ...select(url.searchParams), decidedNow, labelled: Object.keys(labels.items).length, labelsAt: labels.updated });
  }
  if (req.method === 'GET' && url.pathname === '/api/films') {
    const q = (url.searchParams.get('q') ?? '').toLowerCase().replace(/ё/g, 'е').trim();
    if (q.length < 2) return send(res, 200, []);
    const starts: FilmOption[] = [], has: FilmOption[] = [];
    for (const { f, n } of searchable) { if (n.startsWith(q)) starts.push(f); else if (n.includes(q)) has.push(f); if (starts.length >= 20) break; }
    return send(res, 200, [...starts, ...has].slice(0, 20).map((f) => f.label));
  }
  if (req.method === 'GET' && url.pathname === '/api/stopwords') {
    const c = existsSync(CANDS) ? JSON.parse(readFileSync(CANDS, 'utf8')) as Record<string, unknown> : {};
    return send(res, 200, { ...c, ...readStop() });
  }
  if (req.method === 'GET' && url.pathname === '/api/about') {
    const kind = url.searchParams.get('kind') === 'person' ? 'person' : 'universe';
    return send(res, 200, searchAbout(kind, url.searchParams.get('q') ?? ''));
  }
  // покрытие разметкой (03.10): tools/markup-coverage.mts; ?fresh — пересчитать сейчас (секунды)
  if (req.method === 'GET' && url.pathname === '/api/coverage') return send(res, 200, coverage(url.searchParams.has('fresh')));
  if (req.method === 'GET' && url.pathname === '/api/pipeline') return send(res, 200, pipeline());
  if (req.method === 'GET' && url.pathname === '/api/sheet') return send(res, 200, probeSheet(url.searchParams.has('force')));
  if (req.method !== 'POST') return send(res, 404, { error: 'not_found' });
  try {
    const body = JSON.parse((await readBody(req)) || '{}') as Record<string, unknown>;
    if (url.pathname === '/api/verdict') {
      const r = await decide(body as unknown as Decision);
      if (!r.ok) return send(res, 400, r);
      return send(res, 200, { ...r, decidedNow });
    }
    if (url.pathname === '/api/pipeline/run') {
      const ids = body.ids === 'stale' ? staleIds() : Array.isArray(body.ids) ? body.ids.map(String) : [];
      if (!ids.length) return send(res, 400, { error: 'устаревшего нет' });
      try {
        startRun(ids).then(() => { cache = undefined; }, (e) => console.error('прогон:', (e as Error).message));
      } catch (e) { return send(res, 409, { error: (e as Error).message }); }
      return send(res, 200, pipeline());
    }
    if (url.pathname === '/api/stopwords') {
      // принять, отклонить, убрать — решение владельца; применится при следующей сборке индекса
      const w = tokens(String(body.w ?? '')).join(' ');
      if (!w) return send(res, 400, { error: 'пустое слово' });
      const channel = typeof body.channel === 'string' && body.channel.trim() ? body.channel.trim() : undefined;
      const f = readStop();
      const same = (x: { w: string; channel?: string }) => x.w === w && (x.channel ?? '') === (channel ?? '');
      f.words = f.words.filter((x) => !same(x));
      f.rejected = f.rejected.filter((x) => !same(x));
      const item = { w, ...(channel ? { channel } : {}), at: new Date().toISOString().slice(0, 10) };
      if (body.action === 'add') f.words.push(item);
      else if (body.action === 'reject') f.rejected.push(item);
      else if (body.action !== 'remove') return send(res, 400, { error: 'action: add | reject | remove' });
      writeStop(f);
      cache = undefined;
      return send(res, 200, readStop());
    }
    if (url.pathname === '/api/pipeline/stop') return send(res, 200, { stopped: stopRun(), ...pipeline() });
    return send(res, 404, { error: 'not_found' });
  } catch (err) {
    return send(res, 400, { error: (err as Error).message });
  }
}
