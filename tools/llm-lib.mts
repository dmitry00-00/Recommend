// Общее для разметки моделью (02.10): что шлём шлюзу, где лежит результат, как названия от
// модели становятся нашими ключами и где модель спорит с опознавателем по названию.
//
// Механизм пакетной разметки — не здесь: он в llm-gateway основы (~/core/services/llm-gateway,
// POST /v1/classify — пакеты, дробление пополам, предохранитель, кеш по элементу). Здесь только
// предметное: промпт (tools/prompts/media-label.md), тексты материалов и наш каталог.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { IndexedWork } from './works-index.mts';
import { isBookKey } from '../src/lib/keys.ts';
import { isSeries } from '../src/lib/media.ts';

// franchise / person — ролик о франшизе (цикле) и о человеке (режиссёре, писателе): категории
// владельца после разбора нескольких сотен роликов (02.10). Такие идут на страницу вселенной или
// человека (tools/about-lib.mts), а не к одному фильму
export const KINDS = ['one', 'several', 'list', 'news', 'franchise', 'person', 'other'] as const;
export type Kind = typeof KINDS[number];
export const KIND_RU: Record<Kind, string> = { one: 'разбор одного', several: 'несколько', list: 'подборка', news: 'новость',
  franchise: 'о франшизе', person: 'о человеке', other: 'не о произведении' };

export interface LlmWork { title: string; original?: string; year?: number; type?: string; season?: number }
/** о ком или о чём ролик, если не о произведении: франшиза, цикл, режиссёр, писатель */
export interface LlmSubject { name: string; original?: string; type?: string }
/** тема ролика без произведения или подборки: жанр, эпоха, страна… — копим статистику (жанры, 02.10) */
export interface LlmTopic { type?: string; name: string }
export interface Label {
  /** отпечаток текста, который видела модель: текст изменился — разметить заново */
  h: string;
  kind: Kind;
  works: LlmWork[];
  subject?: LlmSubject;
  topic?: LlmTopic;
  conf?: number;
  model: string;
  at: string;
  src: 'yt' | 'tg';
  /** для пульта и отчёта — чтобы им не грузить выгрузку роликов на 250 МБ */
  title?: string; channel?: string; date?: string; minutes?: number;
}
export interface LabelsFile { prompt: string; updated?: string; items: Record<string, Label> }

export const ROOT = new URL('../', import.meta.url);
/** TM_LLM_LABELS — другой файл (проверки без порчи настоящей разметки) */
export const LABELS_FILE = process.env.TM_LLM_LABELS ? pathToFileURL(process.env.TM_LLM_LABELS) : new URL('.cache/llm/labels.json', ROOT);
export const PROMPT_FILE = new URL('tools/prompts/media-label.md', ROOT);

export const sha = (s: string, n = 16): string => createHash('sha256').update(s).digest('hex').slice(0, n);
export const promptText = (): string => readFileSync(PROMPT_FILE, 'utf8');

export function readLabels(): LabelsFile {
  if (!existsSync(LABELS_FILE)) return { prompt: '', items: {} };
  return JSON.parse(readFileSync(LABELS_FILE, 'utf8')) as LabelsFile;
}
export function writeLabels(f: LabelsFile): void {
  mkdirSync(dirname(LABELS_FILE.pathname), { recursive: true });
  const tmp = `${LABELS_FILE.pathname}.tmp`;
  writeFileSync(tmp, JSON.stringify({ ...f, updated: new Date().toISOString() }));
  renameSync(tmp, LABELS_FILE.pathname);   // обрыв посреди записи не портит файл
}

// ─── тексты материалов ────────────────────────────────────────────────────────
/** Описание без мусора: ссылки, таймкоды, реклама, «подписывайтесь» — модели они только
 *  съедают окно, а про фильм в них ничего нет. */
export function cleanDescription(d: string, max = 700): string {
  const lines = d.split('\n').map((l) => l.trim()).filter((l) => l
    && !/^\d{1,2}:\d{2}/.test(l)                                   // таймкоды
    && !/https?:\/\//.test(l)
    && !/(?:подпис|поддерж|boosty|patreon|донат|промокод|реклам|erid|телеграм|telegram|vk\.com|вконтакте|instagram|tiktok|спонсор)/i.test(l));
  const s = lines.join(' ').replace(/\s+/g, ' ');
  return s.length > max ? `${s.slice(0, max).trimEnd()}…` : s;
}

export interface VideoLike { id: string; title: string; description?: string; tags?: string[]; channel?: string; publishedAt?: string; minutes?: number }

export function videoText(v: VideoLike, channelTitle: string | undefined, posts: string[] = []): string {
  const out = [`Канал: ${channelTitle ?? v.channel ?? '?'}`, `Заголовок: ${v.title}`];
  if (v.tags?.length) out.push(`Теги: ${v.tags.slice(0, 12).join(', ')}`);
  const d = cleanDescription(v.description ?? '');
  if (d) out.push(`Описание: ${d}`);
  for (const p of posts.slice(0, 1)) {
    const t = p.replace(/https?:\/\/\S+/g, ' ').replace(/\s+/g, ' ').trim();
    if (t && t !== v.title) out.push(`Пост в Telegram: ${t.length > 400 ? `${t.slice(0, 400)}…` : t}`);
  }
  return out.join('\n');
}

export function postText(text: string, channelTitle: string): string {
  const t = text.replace(/https?:\/\/\S+/g, ' ').replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n').trim();
  return `Канал Telegram: ${channelTitle}\nПост: ${t.length > 900 ? `${t.slice(0, 900)}…` : t}`;
}

// ─── шлюз ─────────────────────────────────────────────────────────────────────
export const GATEWAY = (process.env.LLM_GATEWAY_URL ?? 'http://127.0.0.1:8711').replace(/\/+$/, '').replace(/\/v1$/, '');

export interface GwResult { id: string; kind?: string; confidence?: number; extra?: { works?: unknown } | null; cached?: boolean; error?: string }
export interface GwStats { items: number; cached: number; labelled: number; failed: number; calls: number; cost_usd: number; model: string; stopped: string | null }

export async function gatewayUp(): Promise<boolean> {
  try { return (await fetch(`${GATEWAY}/health`, { signal: AbortSignal.timeout(4000) })).ok; } catch { return false; }
}

export async function classify(items: { id: string; text: string }[], opts: { prompt: string; model: string; batch: number; maxChars: number }): Promise<{ results: GwResult[]; stats: GwStats }> {
  const r = await fetch(`${GATEWAY}/v1/classify`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer recomend', 'x-priority': 'batch' },
    body: JSON.stringify({ model: opts.model, prompt: opts.prompt, labels: KINDS, items, batch: opts.batch, max_chars: opts.maxChars }),
  });
  if (!r.ok) throw new Error(`шлюз: HTTP ${r.status} ${(await r.text()).slice(0, 300)}`);
  return r.json() as Promise<{ results: GwResult[]; stats: GwStats }>;
}

const str = (x: unknown) => (typeof x === 'string' && x.trim() ? x.trim() : undefined);
export function subjectOf(extra: GwResult['extra']): LlmSubject | undefined {
  const s = (extra as { subject?: Record<string, unknown> } | null)?.subject;
  const name = str(s?.name);
  return name ? { name, ...(str(s?.original) ? { original: str(s?.original) } : {}), ...(str(s?.type) ? { type: str(s?.type) } : {}) } : undefined;
}
export function topicOf(extra: GwResult['extra']): LlmTopic | undefined {
  const t = (extra as { topic?: Record<string, unknown> } | null)?.topic;
  const name = str(t?.name);
  return name ? { name: name.toLowerCase(), ...(str(t?.type) ? { type: str(t?.type)!.toLowerCase() } : {}) } : undefined;
}

/** Поле works из ответа модели — в наш вид; мусор (без названия, год строкой) отбрасываем. */
export function worksOf(extra: GwResult['extra']): LlmWork[] {
  const raw = Array.isArray(extra?.works) ? extra!.works as Record<string, unknown>[] : [];
  return raw.filter((w) => w && typeof w.title === 'string' && w.title.trim()).slice(0, 6).map((w) => {
    const year = Number(w.year);
    const season = Number(w.season);
    return {
      title: String(w.title).trim(),
      ...(typeof w.original === 'string' && w.original.trim() && w.original.trim() !== String(w.title).trim() ? { original: w.original.trim() } : {}),
      ...(year > 1880 && year < 2100 ? { year } : {}),
      ...(typeof w.type === 'string' ? { type: w.type } : {}),
      ...(season > 0 && season < 60 ? { season } : {}),
    };
  });
}

// ─── названия модели → наши ключи ─────────────────────────────────────────────
export const norm = (s: string): string => s.toLowerCase().replace(/ё/g, 'е')
  .replace(/[«»"“”„'’`]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

export interface Ref { key: string; label: string; year?: number; kind: 'film' | 'series' | 'book' }
export interface Resolved { key?: string; label?: string; options: Ref[] }

const labelOf = (w: IndexedWork['work'], kind: Ref['kind']): string =>
  kind === 'series' ? (w.year ? `${w.title} (сериал, ${w.year})` : `${w.title} (сериал)`)
    : kind === 'book' ? (w.year ? `${w.title} (книга, ${w.year})` : `${w.title} (книга)`)
      : w.year ? `${w.title} (${w.year})` : w.title;

/** Узнаватель: название (русское или оригинальное) и год от модели → ключ нашего каталога.
 *  Тёзки разводятся годом (±1) и видом («сериал», «книга»); не развелись — варианты человеку. */
export function resolver(works: IndexedWork[]): (w: LlmWork) => Resolved {
  const by = new Map<string, Ref[]>();
  const seen = new Set<string>();
  for (const { key, work } of works) {
    if (seen.has(key)) continue;
    seen.add(key);
    const kind: Ref['kind'] = isBookKey(key) ? 'book' : isSeries(work) ? 'series' : 'film';
    const ref: Ref = { key, label: labelOf(work, kind), ...(work.year ? { year: work.year } : {}), kind };
    for (const name of new Set([work.title, work.originalTitle].filter(Boolean).map((s) => norm(s!)))) {
      if (!name) continue;
      by.set(name, [...(by.get(name) ?? []), ref]);
    }
  }
  return (w) => {
    let pool = [...new Map([w.title, w.original].filter(Boolean).flatMap((n) => by.get(norm(n!)) ?? []).map((r) => [r.key, r])).values()];
    if (!pool.length) return { options: [] };
    const want: Ref['kind'] | undefined = w.type === 'book' ? 'book' : w.type === 'series' ? 'series' : w.type ? 'film' : undefined;
    if (want) {
      const same = pool.filter((r) => r.kind === want || (want === 'film' && r.kind === 'series' && w.type === 'anime'));
      if (same.length) pool = same;
    }
    if (w.year) {
      const near = pool.filter((r) => r.year && Math.abs(r.year - w.year!) <= 1);
      if (!near.length) return { options: pool.slice(0, 6) };   // год назван, а у тёзок другой — не они
      const exact = near.filter((r) => r.year === w.year);
      pool = exact.length === 1 ? exact : near;
    }
    return pool.length === 1 ? { key: pool[0].key, label: pool[0].label, options: pool } : { options: pool.slice(0, 6) };
  };
}

// ─── спор с опознавателем по названию ─────────────────────────────────────────
export type MarkupError = 'не тот фильм' | 'не фильм' | 'несколько фильмов' | 'о франшизе' | 'о человеке';
export type Flag = 'agree' | 'wrong' | 'notfilm' | 'several' | 'gap' | 'unknown' | 'franchise' | 'person' | 'none';
export const FLAG_RU: Record<Flag, string> = {
  agree: 'согласна', wrong: 'другой фильм', notfilm: 'не о фильме', several: 'несколько',
  gap: 'нашла фильм', unknown: 'нет у нас?', franchise: 'о франшизе', person: 'о человеке', none: '—',
};
/** виды субъекта и темы от модели — по-русски для пульта */
export const TYPE_RU: Record<string, string> = { franchise: 'франшиза', cycle: 'цикл', director: 'режиссёр', writer: 'писатель', actor: 'актёр',
  genre: 'жанр', theme: 'тема', era: 'эпоха', country: 'страна', industry: 'индустрия' };
export type AboutResolve = (kind: 'universe' | 'person', name: string) => { id: string; title: string; label: string } | undefined;
export interface Suggestion {
  flag: Flag;
  err?: MarkupError;
  /** главный фильм по модели — наш ключ, если узнали */
  key?: string; label?: string;
  /** остальные узнанные произведения */
  also: { key: string; label: string }[];
  /** главное название модели, если в каталоге не нашлось (кандидат «нет у нас») */
  typed?: string;
  /** ролик о франшизе или человеке: цель (id — если узнали у нас) */
  about?: { kind: 'universe' | 'person'; id?: string; title: string; label?: string };
  note: string;
}

const show = (w: LlmWork): string => `«${w.title}»${w.year ? ` (${w.year})` : ''}${w.season ? `, ${w.season} сезон` : ''}`;

/** Что сказать человеку по одному ролику: где опознаватель (regexKey) и модель расходятся.
 *  Порог уверенности — `minConf`: неуверенная модель не спорит, только подсказывает. */
export function suggest(regexKey: string | undefined, label: Label, resolve: (w: LlmWork) => Resolved,
  opts: { minConf?: number; about?: AboutResolve } | number = {}): Suggestion {
  const { minConf = 0.6, about } = typeof opts === 'number' ? { minConf: opts } : opts;
  const got = label.works.map((w) => ({ w, r: resolve(w) }));
  const keys = got.filter((g) => g.r.key).map((g) => ({ key: g.r.key!, label: g.r.label! }));
  const main = got[0];
  const subj = label.subject ? `: ${label.subject.name}${label.subject.type ? ` (${TYPE_RU[label.subject.type] ?? label.subject.type})` : ''}` : '';
  const topic = label.topic ? ` · ${label.topic.type ? `${TYPE_RU[label.topic.type] ?? label.topic.type}: ` : ''}${label.topic.name}` : '';
  const note = label.kind === 'franchise' || label.kind === 'person'
    ? `${KIND_RU[label.kind]}${subj}${topic}`
    : `${KIND_RU[label.kind]}${label.works.length ? `: ${label.works.slice(0, 4).map(show).join(', ')}${label.works.length > 4 ? '…' : ''}` : ''}${topic}`;
  const sure = (label.conf ?? 1) >= minConf;
  const others = (k?: string) => keys.filter((x) => x.key !== k);
  // о франшизе или человеке: цель — вселенная или человек, привязка к фильму снимается
  if ((label.kind === 'franchise' || label.kind === 'person') && label.subject) {
    const kind = label.kind === 'franchise' ? 'universe' as const : 'person' as const;
    const ref = about?.(kind, label.subject.name) ?? (label.subject.original ? about?.(kind, label.subject.original) : undefined);
    if (!sure) return { flag: 'none', also: [], note };
    return { flag: label.kind, ...(regexKey ? { err: label.kind === 'franchise' ? 'о франшизе' as const : 'о человеке' as const } : {}),
      about: { kind, ...(ref ? { id: ref.id, label: ref.label } : {}), title: ref?.title ?? label.subject.name }, also: keys, note };
  }
  if (label.kind === 'other') {
    return regexKey && sure ? { flag: 'notfilm', err: 'не фильм', also: [], note } : { flag: 'none', also: [], note };
  }
  const many = label.kind === 'several' || label.kind === 'list' || (label.kind === 'news' && label.works.length > 1);
  if (many) {
    if (regexKey && sure) return { flag: 'several', err: 'несколько фильмов', key: regexKey, also: others(regexKey), note };
    if (!regexKey && keys.length) return { flag: 'gap', err: 'несколько фильмов', key: keys[0].key, label: keys[0].label, also: others(keys[0].key), note };
    return { flag: 'none', also: [], note };
  }
  // один фильм (или новость об одном)
  if (!main) return regexKey && sure ? { flag: 'notfilm', err: 'не фильм', also: [], note } : { flag: 'none', also: [], note };
  if (main.r.key) {
    if (main.r.key === regexKey) return { flag: 'agree', key: regexKey, label: main.r.label, also: others(regexKey), note };
    if (!regexKey) return { flag: 'gap', key: main.r.key, label: main.r.label, also: others(main.r.key), note };
    // опознаватель поймал второстепенное произведение из перечисленных моделью
    return sure ? { flag: 'wrong', err: 'не тот фильм', key: main.r.key, label: main.r.label, also: others(main.r.key), note }
      : { flag: 'none', also: [], note };
  }
  // главного в каталоге нет (или тёзки не развелись)
  const typed = `${main.w.title}${main.w.year ? ` (${main.w.year})` : ''}`;
  if (regexKey && main.r.options.some((o) => o.key === regexKey)) return { flag: 'agree', key: regexKey, also: others(regexKey), note };
  return sure ? { flag: 'unknown', ...(regexKey ? { err: 'не тот фильм' as const } : {}), typed, also: keys, note } : { flag: 'none', also: [], note };
}
