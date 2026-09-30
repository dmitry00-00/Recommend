// Контрольные замеры ночного сборщика (tools/collect.mts): несколько чисел, по которым видно,
// что данные не потерялись по дороге, — и сравнение с прошлым снимком.
//   npx tsx tools/collect-metrics.mts                  замер, сравнение, снимок в историю
//   npx tsx tools/collect-metrics.mts --strict         то же, но с кодом 1, если есть предупреждения
//   npx tsx tools/collect-metrics.mts --dry            не сохранять снимок
//   npx tsx tools/collect-metrics.mts --src essaysAuto=/tmp/урезанный.ts [--src …]
//                                                      читать источник из другого файла (проверка
//                                                      самих замеров); с --src снимок не пишется,
//                                                      пока не задан --history <файл>
//   npx tsx tools/collect-metrics.mts --history <файл> другая история вместо .cache/collect-metrics.json
//
// Зачем. 29.09 в конвейере нашлось четыре тихие потери подряд: импорт таблицы разметки читал
// одну ссылку из восьми; ручные привязки к роликам чужих каналов молча выбрасывались (290 из
// 293); у 940 смотренных фильмов не было данных о внимании; Wikidata отвечала 429, и шаги
// отдавали пустоту без ошибки. Ни один шаг не падал — просто число на выходе становилось
// меньше, и замечали это случайно. Здесь такие числа собраны в одном месте и сравниваются с
// прошлым прогоном: падение видно в логе сборщика в то же утро.
//
// Что читаем. Выходы шагов сборщика: `.cache/telegram/*.json` (telegram-pull),
// `src/mocks/filmBaseWiki.ts` (expand-film-base), `postsAuto.ts` (build-telegram-index),
// `essaysAuto.ts` (build-essay-index), `sourcesAuto.ts` (build-source-index), `comentions.ts` и
// `.cache/mentions.json` (build-comention-index). И входы, которые сборщик не пишет, но от
// которых зависит его выход: `tools/markup-verdicts.json` (import-markup.py; его читает
// build-essay-index), `.cache/attention.json` (build-attention), `.cache/youtube/videos.json`
// (youtube-dump; по нему строится таблица разметки). Сеть не нужна: только файлы.
//
// Моки читаются как текст, а не импортом: так любой из них можно подменить через --src, не
// трогая настоящий, и один битый файл не роняет весь замер — у числа будет «нет данных».
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { userWorks } from '../src/mocks/userHistory.ts';
import { watchedWorks } from '../src/mocks/userWatched.ts';
import { analysisKey } from './works-index.mts';

const argv = process.argv.slice(2);
const opts = (n: string) => argv.flatMap((a, i) => (a === n && argv[i + 1] ? [argv[i + 1]] : []));
const STRICT = argv.includes('--strict');
const overrides = Object.fromEntries(opts('--src').map((s) => [s.slice(0, s.indexOf('=')), s.slice(s.indexOf('=') + 1)]));
const HISTORY = opts('--history')[0] ?? '.cache/collect-metrics.json';
// подменённый источник — это проверка замера, а не замер: в настоящую историю он не пишется
const DRY = argv.includes('--dry') || (Object.keys(overrides).length > 0 && !opts('--history').length);
const KEEP = 30;

const SRC: Record<string, string> = {
  essays: 'src/mocks/essays.ts',
  essaysAuto: 'src/mocks/essaysAuto.ts',
  postsAuto: 'src/mocks/postsAuto.ts',
  sourcesAuto: 'src/mocks/sourcesAuto.ts',
  comentions: 'src/mocks/comentions.ts',
  filmBaseWiki: 'src/mocks/filmBaseWiki.ts',
  mentions: '.cache/mentions.json',
  telegram: '.cache/telegram',
  verdicts: 'tools/markup-verdicts.json',
  attention: '.cache/attention.json',
  videos: '.cache/youtube/videos.json',
};
for (const k of Object.keys(overrides)) if (!(k in SRC)) { console.error(`неизвестный источник ${k}; есть: ${Object.keys(SRC).join(', ')}`); process.exit(2); }
const path = (k: string) => overrides[k] ?? SRC[k];

const problems: string[] = [];
/** Тело `export const x = <JSON>;` из сгенерированного мока. Генераторы пишут его через
 *  JSON.stringify(…, null, 2), поэтому корневая скобка закрывается в начале строки. */
function readMock<T>(k: string): T | undefined {
  const p = path(k);
  try {
    const text = readFileSync(p, 'utf8');
    const eq = text.indexOf('=', text.indexOf('export const '));
    const start = text.slice(eq + 1).search(/[[{]/) + eq + 1;
    const body = text.slice(start);
    const end = /\n[\]}];?\s*(\n|$)/.exec(body);
    // пустой индекс JSON.stringify пишет в одну строку (`[];`) — тогда корневой скобки с новой строки нет
    return JSON.parse(end ? body.slice(0, end.index + 2) : body.replace(/;\s*$/, '')) as T;
  } catch (e) { problems.push(`${p}: не читается (${(e as Error).message.slice(0, 80)})`); return undefined; }
}
function readJson<T>(k: string): T | undefined {
  const p = path(k);
  // attention.json переписывает долгий build-attention: пойманный на полуслове файл — «нет данных»,
  // а не падение замера
  try { return JSON.parse(readFileSync(p, 'utf8')) as T; } catch (e) { problems.push(`${p}: не читается (${(e as Error).message.slice(0, 80)})`); return undefined; }
}

interface Item { id: string; author: string; url?: string; unverified?: boolean; evidence?: string }
type Index = Record<string, Item[]>;
const essays = readMock<Index>('essays');
const essaysAuto = readMock<Index>('essaysAuto');
const postsAuto = readMock<Index>('postsAuto');
const sourcesAuto = readMock<unknown[]>('sourcesAuto');
const comentions = readMock<Record<string, unknown[]>>('comentions');
const filmBaseWiki = readMock<unknown[]>('filmBaseWiki');
const mentions = readJson<Record<string, unknown>>('mentions');
const verdicts = readJson<{ videos?: Record<string, { key: string | null; guess?: boolean }> }>('verdicts')?.videos;
const attention = readJson<Record<string, { views?: number; trakt?: { watchers?: number } }>>('attention');
const videos = readJson<unknown[]>('videos');

// выемка Telegram: посты по каналам (gateway.json — курсор шлюза, не канал)
let tgPosts: Record<string, number> | undefined;
try {
  const dir = path('telegram');
  tgPosts = {};
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'gateway.json')) {
    try { tgPosts[f.slice(0, -5)] = (JSON.parse(readFileSync(join(dir, f), 'utf8')).posts ?? []).length; }
    catch { problems.push(`${join(dir, f)}: не читается`); }
  }
} catch { problems.push(`${path('telegram')}: нет папки`); tgPosts = undefined; }

const flat = (x?: Index) => (x ? Object.values(x).flat() : undefined);
const byAuthor = (x?: Index) => {
  if (!x) return undefined;
  const m: Record<string, number> = {};
  for (const a of Object.values(x).flat()) m[a.author] = (m[a.author] ?? 0) + 1;
  return m;
};
const size = (x?: object) => (x ? Object.keys(x).length : null);

// весь индекс разборов — как его видит tools/voices-report.mts (те же три источника)
const all = essays && essaysAuto && postsAuto ? [essays, essaysAuto, postsAuto] : undefined;
const allItems = all?.flatMap((x) => Object.values(x).flat());
const films = all ? new Set(all.flatMap((x) => Object.keys(x))).size : null;

// Ручные привязки, не дошедшие до индекса. Правило build-essay-index: слово человека (key есть,
// не guess) ставит ролик в essaysAuto как `yta-<id>`, если он уже не лежит в присланном
// вручную essays.ts. Остаток — ролики, которых нет в YouTube, и ключи, которых нет в
// справочнике: он не обязан быть нулём, но расти без причины не должен (29.09 он был 290).
let lostHuman: number | null = null;
if (verdicts && essaysAuto && essays) {
  const inAuto = new Set(flat(essaysAuto)!.map((a) => a.id));
  const inManual = new Set(flat(essays)!.map((a) => /v=([A-Za-z0-9_-]{11})/.exec(a.url ?? '')?.[1]));
  lostHuman = Object.entries(verdicts).filter(([id, v]) => v.key && !v.guess && !inAuto.has(`yta-${id}`) && !inManual.has(id)).length;
}

// Смотренные владельцем (история + присланный список) без данных о внимании: 29.09 их было
// 940 вместе с seeds/ — чужие профили сюда не берём, их тут не читаем
let watchedNoAttention: number | null = null;
if (attention) {
  const keys = new Set([...userWorks, ...watchedWorks].map(analysisKey).filter((k): k is string => Boolean(k?.startsWith('tmdb:'))));
  watchedNoAttention = [...keys].filter((k) => !attention[k]?.views && !attention[k]?.trakt?.watchers).length;
}

// ─── числа ────────────────────────────────────────────────────────────────────
/** bad — в какую сторону движение плохо; share — доля в процентах (порог в пунктах, не в %) */
interface Metric { id: string; label: string; value: number | null; bad: 'down' | 'up'; share?: true }
const pctOf = (x: number, n: number) => (n ? Math.round((x / n) * 1000) / 10 : 0);
const metrics: Metric[] = [
  { id: 'tg.posts', label: 'постов в выемке Telegram', value: tgPosts ? Object.values(tgPosts).reduce((s, n) => s + n, 0) : null, bad: 'down' },
  { id: 'tg.channels', label: 'каналов в выемке Telegram', value: size(tgPosts), bad: 'down' },
  { id: 'films', label: 'фильмов с материалом', value: films, bad: 'down' },
  { id: 'items', label: 'материалов всего', value: allItems?.length ?? null, bad: 'down' },
  { id: 'unverified', label: 'доля «не проверено», %', value: allItems ? pctOf(allItems.filter((a) => a.unverified).length, allItems.length) : null, bad: 'up', share: true },
  { id: 'yt.links', label: 'привязок роликов (essaysAuto)', value: flat(essaysAuto)?.length ?? null, bad: 'down' },
  { id: 'yt.authors', label: 'каналов с привязками роликов', value: size(byAuthor(essaysAuto)), bad: 'down' },
  { id: 'yt.human', label: 'ручных привязок роликов в индексе', value: flat(essaysAuto)?.filter((a) => a.evidence === 'human').length ?? null, bad: 'down' },
  { id: 'tg.links', label: 'привязок постов (postsAuto)', value: flat(postsAuto)?.length ?? null, bad: 'down' },
  { id: 'tg.authors', label: 'каналов с привязками постов', value: size(byAuthor(postsAuto)), bad: 'down' },
  { id: 'wiki.cards', label: 'карточек из Wikidata', value: filmBaseWiki?.length ?? null, bad: 'down' },
  { id: 'comentions', label: 'фильмов с соседями по соупоминанию', value: size(comentions), bad: 'down' },
  { id: 'mentions', label: 'фильмов, упомянутых в постах', value: size(mentions), bad: 'down' },
  { id: 'sources', label: 'кандидатов в источники', value: sourcesAuto?.length ?? null, bad: 'down' },
  { id: 'verdicts', label: 'решений в markup-verdicts', value: size(verdicts), bad: 'down' },
  { id: 'verdicts.lost', label: 'ручных привязок мимо индекса', value: lostHuman, bad: 'up' },
  { id: 'att.wiki', label: 'фильмов с просмотрами Википедии', value: attention ? Object.values(attention).filter((a) => a.views).length : null, bad: 'down' },
  { id: 'att.trakt', label: 'фильмов со зрителями Trakt', value: attention ? Object.values(attention).filter((a) => a.trakt?.watchers).length : null, bad: 'down' },
  { id: 'att.watchedMissing', label: 'смотренных без данных о внимании', value: watchedNoAttention, bad: 'up' },
  { id: 'yt.videos', label: 'роликов в дампе YouTube', value: videos?.length ?? null, bad: 'down' },
];
// по каналам — отдельно от таблицы: их десятки, и нужны они только чтобы заметить пропавший
const channels = { 'ролики': byAuthor(essaysAuto), 'посты': byAuthor(postsAuto), 'выемка': tgPosts };

// ─── история и сравнение ─────────────────────────────────────────────────────
interface Snapshot { at: string; metrics: Record<string, number | null>; channels: Record<string, Record<string, number> | undefined> }
let history: Snapshot[] = [];
if (existsSync(HISTORY)) {
  try { history = JSON.parse(readFileSync(HISTORY, 'utf8')).snapshots ?? []; }
  catch { problems.push(`${HISTORY}: история не читается — сравнивать не с чем`); }
}
const prev = history.at(-1);
// время и день — местные: сборщик ходит в 06:30 по часам машины, а в UTC это ещё «вчера»
const local = (iso: string) => new Date(iso).toLocaleString('sv-SE').slice(0, 16);
const now: Snapshot = { at: new Date().toISOString(), metrics: Object.fromEntries(metrics.map((m) => [m.id, m.value])), channels };

const DROP = 0.10;        // падение счётчика больше чем на 10% — предупреждение
const SHARE_PP = 5;       // доля выросла больше чем на 5 пунктов
const warnings: string[] = [...problems];
const fmt = (v: number | null | undefined) => (v == null ? '—' : v.toLocaleString('ru-RU'));
const rows: string[][] = [];
for (const m of metrics) {
  const was = prev?.metrics[m.id];
  const d = m.value != null && was != null ? m.value - was : null;
  const sign = (x: number) => (x > 0 ? '+' : '');
  const rel = d && was ? `${sign(d)}${Math.round((d / was) * 100)}%` : '';
  const delta = d == null ? '' : d === 0 ? '=' : m.share ? `${sign(d)}${fmt(Math.round(d * 10) / 10)} п.` : `${sign(d)}${fmt(d)}${rel ? ` (${rel})` : ''}`;
  let mark = '';
  if (m.value == null) mark = '!';
  else if (was != null && d != null) {
    const worse = m.bad === 'down' ? -d : d;
    if (m.bad === 'down' && was > 0 && m.value === 0) { mark = '!'; warnings.push(`${m.label}: упало до нуля (было ${fmt(was)})`); }
    else if (m.share ? worse > SHARE_PP : m.bad === 'down' ? worse > was * DROP : worse > Math.max(was * DROP, 5)) {
      mark = '!';
      warnings.push(`${m.label}: ${fmt(was)} → ${fmt(m.value)} (${m.share ? delta : rel})`);
    }
  }
  rows.push([mark, m.label, fmt(was), fmt(m.value), delta]);
}
const empty = metrics.filter((m) => m.value == null).map((m) => m.label);
if (empty.length) warnings.push(`нет данных: ${empty.join('; ')}`);
// канал пропал целиком или сдулся вдвое — видно даже тогда, когда общий итог почти не сдвинулся
if (prev) for (const [what, cur] of Object.entries(channels)) {
  const old = prev.channels[what];
  if (!old || !cur) continue;
  for (const [ch, n] of Object.entries(old)) {
    const c = cur[ch] ?? 0;
    if (c === 0 && n >= 3) warnings.push(`${what}: канал «${ch}» пропал (было ${n})`);
    else if (n >= 20 && c < n / 2) warnings.push(`${what}: канал «${ch}» ${n} → ${c}`);
  }
}

// ─── вывод ───────────────────────────────────────────────────────────────────
const w = [1, ...[1, 2, 3, 4].map((i) => Math.max(...rows.map((r) => r[i].length), ['', 'число', 'было', 'стало', 'разница'][i].length))];
const line = (r: string[]) => `${r[0] || ' '} ${r[1].padEnd(w[1])}  ${r[2].padStart(w[2])}  ${r[3].padStart(w[3])}  ${r[4]}`;
console.log(`контрольные замеры${prev ? ` — сравнение со снимком ${local(prev.at)}` : ' — первый снимок, сравнивать не с чем'}${Object.keys(overrides).length ? ` (подменено: ${Object.keys(overrides).join(', ')})` : ''}`);
console.log(line(['', 'число', 'было', 'стало', 'разница']));
for (const r of rows) console.log(line(r));
if (prev && rows.every((r) => r[4] === '=')) console.log('без изменений');
if (warnings.length) {
  console.log(`\nПРЕДУПРЕЖДЕНИЯ (${warnings.length}):`);
  for (const s of warnings) console.log(`  ! ${s}`);
} else console.log('\nпредупреждений нет');

if (!DRY) {
  // один снимок на день: повторный прогон в тот же день заменяет утренний, чтобы ручные
  // перезапуски не вытесняли из истории прошлые дни
  if (prev && local(prev.at).slice(0, 10) === local(now.at).slice(0, 10)) history.pop();
  history.push(now);
  mkdirSync(dirname(HISTORY), { recursive: true });
  writeFileSync(HISTORY, JSON.stringify({ '//': 'Контрольные замеры сборщика (tools/collect-metrics.mts), снимок на день, последние 30.', snapshots: history.slice(-KEEP) }, null, 1));
  console.log(`снимок → ${HISTORY} (${Math.min(history.length, KEEP)} в истории)`);
} else console.log('снимок не сохранён (--dry или подменённый источник)');

process.exit(STRICT && warnings.length ? 1 : 0);
