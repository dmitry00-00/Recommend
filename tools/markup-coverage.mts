/**
 * Покрытие разметкой (03.10): по каким фильмам и каналам решений людей нет или крайне мало —
 * чтобы проверять там, где это больше всего меняет индекс.
 *
 *   npx tsx tools/markup-coverage.mts [--top N]     → .cache/markup-coverage.json + отчёт
 *
 * Разметка — решения людей (tools/markup-verdicts.json, кроме догадок). Для каждого канала и
 * фильма считается:
 *   · привязок в индексе, из них решено человеком, подтверждено уликой, без подтверждения;
 *   · «ошибок, вероятно, в непроверенном» — Σ (1 − точность канала) по привязкам без человека и
 *     без улики. Точность — по каналу из .cache/link-precision.json (сжатая к общей: у канала с
 *     малым числом решений своя точность ещё ничего не значит). Это и есть мера, где проверка
 *     полезнее всего: много непроверенного × канал, который ошибается;
 *   · у фильма ещё — заметность (просмотры статьи в Википедии): ошибка в карточке, которую
 *     открывают часто, дороже.
 * Отдельно — популярные фильмы каталога без единого материала (разметке нечего проверять, но
 * это тоже пробел) и Telegram, где решений людей почти нет.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { worksIndex } from './works-index.mts';
import { readPrecision } from './link-precision.mts';
import type { ExternalAnalysis } from '../src/types/tmdf.ts';

const root = new URL('../', import.meta.url);
const read = <T,>(p: string, d: T): T => (existsSync(new URL(p, root)) ? JSON.parse(readFileSync(new URL(p, root), 'utf8')) as T : d);
const TOP = Number(process.argv[process.argv.indexOf('--top') + 1]) || 15;

type V = { key: string | null; from?: string; guess?: boolean; err?: string; why?: string };
const verdicts = read<{ videos?: Record<string, V> }>('tools/markup-verdicts.json', {}).videos ?? {};
const human = new Map(Object.entries(verdicts).filter(([, v]) => !v.guess));
const videos = read<{ id: string; channel?: string; channelId?: string; publishedAt?: string }[]>('.cache/youtube/videos.json', []);
const channels = read<Record<string, { title?: string; tier?: string; medium?: string; via?: string }>>('.cache/youtube/channels.json', {});
const attention = read<Record<string, { views?: number }>>('.cache/attention.json', {});
const prec = readPrecision();
const mod = async (p: string) => import(new URL(p, root).href);
const [{ essaysAuto }, { postsAuto }] = await Promise.all([mod('src/mocks/essaysAuto.ts'), mod('src/mocks/postsAuto.ts')]) as
  [{ essaysAuto: Record<string, ExternalAnalysis[]> }, { postsAuto: Record<string, ExternalAnalysis[]> }];
const title = new Map(worksIndex({ all: true }).map((w) => [w.key, `${w.work.title}${w.work.year ? ` (${w.work.year})` : ''}`]));

// ─── точность канала: своя, сжатая к общей (априорная масса — 30 решений) ──────
const global = (() => { const m = Object.values(prec?.method ?? {}); const r = m.reduce((s, x) => s + x.right, 0), w = m.reduce((s, x) => s + x.wrong, 0); return r + w ? r / (r + w) : 0.9; })();
const perChannel = new Map<string, { right: number; wrong: number }>();
for (const [k, s] of Object.entries(prec?.pair ?? {})) {
  const ch = k.slice(0, k.lastIndexOf('|'));
  const x = perChannel.get(ch) ?? { right: 0, wrong: 0 };
  x.right += s.right; x.wrong += s.wrong;
  perChannel.set(ch, x);
}
const PRIOR = 30;
const precisionOf = (ch: string) => { const x = perChannel.get(ch); return x ? (x.right + global * PRIOR) / (x.right + x.wrong + PRIOR) : global; };

// ─── каналы YouTube ───────────────────────────────────────────────────────────
interface ChannelRow { channel: string; tier?: string; /** наш источник, а не канал, заведённый из ссылок разметки */ source: boolean; dump: number; linked: number; human: number; evidence: number; none: number;
  verdicts: number; errorsFound: number; precision: number; measured: number; expectedErrors: number; status: 'нет' | 'мало' | 'есть' }
const dumpBy = new Map<string, number>();
const chOfVideo = new Map<string, string>();
for (const v of videos) {
  const ch = v.channel ?? channels[v.channelId ?? '']?.title ?? '?';
  dumpBy.set(ch, (dumpBy.get(ch) ?? 0) + 1);
  chOfVideo.set(v.id, ch);
}
const tierOf = new Map(Object.values(channels).map((c) => [c.title ?? '', c.tier]));
const sourceOf = new Map(Object.values(channels).map((c) => [c.title ?? '', c.via !== 'links']));
const rows = new Map<string, ChannelRow>();
const row = (ch: string): ChannelRow => rows.get(ch) ?? rows.set(ch, { channel: ch, source: sourceOf.get(ch) ?? false, dump: dumpBy.get(ch) ?? 0, linked: 0, human: 0, evidence: 0, none: 0,
  verdicts: 0, errorsFound: 0, precision: precisionOf(ch), measured: (perChannel.get(ch)?.right ?? 0) + (perChannel.get(ch)?.wrong ?? 0), expectedErrors: 0, status: 'нет' }).get(ch)!;


interface FilmRow { key: string; title: string; videos: number; posts: number; human: number; evidence: number; none: number; views: number; expectedErrors: number; priority: number }
const films = new Map<string, FilmRow>();
const film = (key: string): FilmRow => films.get(key) ?? films.set(key, { key, title: title.get(key) ?? key, videos: 0, posts: 0, human: 0, evidence: 0, none: 0,
  views: attention[key]?.views ?? 0, expectedErrors: 0, priority: 0 }).get(key)!;

const seenVideo = new Set<string>();
for (const [key, list] of Object.entries(essaysAuto)) {
  for (const a of list) {
    const ch = a.author;
    const r = row(ch), f = film(key);
    f.videos++;
    const id = a.id.replace(/^yta-/, '');
    if (!seenVideo.has(id)) { seenVideo.add(id); r.linked++; }
    if (a.evidence === 'human') { r.human++; f.human++; }
    else if (a.evidence) { r.evidence++; f.evidence++; }
    else { r.none++; f.none++; const e = 1 - precisionOf(ch); r.expectedErrors += e; f.expectedErrors += e; }
  }
}
for (const [id, v] of human) {
  const ch = chOfVideo.get(id);
  if (!ch) continue;
  const r = row(ch);
  r.verdicts++;
  if (v.err || v.why === 'не про фильм' || v.why === 'нет у нас') r.errorsFound++;
}
for (const r of rows.values()) {
  r.tier = tierOf.get(r.channel);
  const share = r.linked ? r.verdicts / r.linked : 0;
  // «мало» — решений меньше четверти привязок и непроверенного хоть сколько-то: у канала с одной
  // привязкой и одним решением разметки достаточно
  r.status = r.verdicts === 0 ? 'нет' : share < 0.25 && r.none >= 3 ? 'мало' : 'есть';
}

// ─── фильмы ───────────────────────────────────────────────────────────────────
const tgBy = new Map<string, { posts: number; verified: number }>();
for (const [key, list] of Object.entries(postsAuto)) for (const a of list) {
  film(key).posts++;
  const h = /^tg-([^-]+)-/.exec(a.id)?.[1] ?? a.author;
  const t = tgBy.get(h) ?? { posts: 0, verified: 0 };
  t.posts++; if (a.evidence === 'human') t.verified++;
  tgBy.set(h, t);
}
// приоритет фильма: ожидаемые ошибки × заметность (log просмотров; без данных — как у медианного)
const viewsSorted = [...films.values()].map((f) => f.views).filter(Boolean).sort((a, b) => a - b);
const medianViews = viewsSorted[Math.floor(viewsSorted.length / 2)] ?? 1000;
for (const f of films.values()) f.priority = f.expectedErrors * Math.log10(10 + (f.views || medianViews));

// популярные фильмы каталога без материалов
const silent = Object.entries(attention).filter(([k, a]) => (a.views ?? 0) > 0 && !films.has(k) && title.has(k))
  .sort((a, b) => (b[1].views ?? 0) - (a[1].views ?? 0)).map(([k, a]) => ({ key: k, title: title.get(k) ?? k, views: a.views ?? 0 }));

// каналы, у которых в выгрузке много роликов, а привязок почти нет: не про кино, или опознаватель
// их не понимает (рубрики, игры, книги) — смотреть глазами
const quiet = [...dumpBy].map(([channel, dump]) => ({ channel, dump, linked: rows.get(channel)?.linked ?? 0, tier: tierOf.get(channel) }))
  .filter((c) => sourceOf.get(c.channel) && c.dump >= 50 && c.linked / c.dump < 0.01).sort((a, b) => b.dump - a.dump);

// ─── вывод ────────────────────────────────────────────────────────────────────
const chList = [...rows.values()].filter((r) => r.linked > 0).sort((a, b) => b.expectedErrors - a.expectedErrors);
const fList = [...films.values()].sort((a, b) => b.priority - a.priority);
const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
const totalLinks = sum(chList.map((r) => r.human + r.evidence + r.none));
const out = {
  at: new Date().toISOString(), globalPrecision: Math.round(global * 1000) / 1000,
  totals: {
    channels: chList.length, noMarkup: chList.filter((r) => r.status === 'нет').length, little: chList.filter((r) => r.status === 'мало').length,
    links: totalLinks, human: sum(chList.map((r) => r.human)), evidence: sum(chList.map((r) => r.evidence)), none: sum(chList.map((r) => r.none)),
    expectedErrors: Math.round(sum(chList.map((r) => r.expectedErrors))),
    films: films.size, filmsNoHuman: fList.filter((f) => !f.human).length, filmsUnconfirmed: fList.filter((f) => !f.human && !f.evidence).length, silent: silent.length,
    tgPosts: sum([...tgBy.values()].map((t) => t.posts)), tgVerified: sum([...tgBy.values()].map((t) => t.verified)),
  },
  channels: chList.map((r) => ({ ...r, precision: Math.round(r.precision * 1000) / 1000, expectedErrors: Math.round(r.expectedErrors * 10) / 10 })),
  films: fList.filter((f) => f.none > 0).slice(0, 500).map((f) => ({ ...f, expectedErrors: Math.round(f.expectedErrors * 10) / 10, priority: Math.round(f.priority * 10) / 10 })),
  silent: silent.slice(0, 200),
  quiet,
  telegram: [...tgBy].map(([handle, t]) => ({ handle, ...t })).sort((a, b) => b.posts - a.posts),
};
writeFileSync(new URL('.cache/markup-coverage.json', root), JSON.stringify(out));

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '—');
const t = out.totals;
console.log(`привязок роликов ${t.links}: решено человеком ${t.human} (${pct(t.human, t.links)}), с уликой ${t.evidence} (${pct(t.evidence, t.links)}), без подтверждения ${t.none} (${pct(t.none, t.links)})`);
console.log(`ошибок, вероятно, в непроверенном: ~${t.expectedErrors} (общая точность опознавателя ${(global * 100).toFixed(1)}%)`);
console.log(`\nканалов с привязками ${t.channels}: без разметки ${t.noMarkup}, мало ${t.little}. Где проверка полезнее всего:`);
console.log('  канал                                привязок  решений  без подтв.  точность  ~ошибок  статус');
for (const r of chList.slice(0, TOP)) {
  console.log(`  ${r.channel.slice(0, 36).padEnd(36)} ${String(r.linked).padStart(8)} ${String(r.verdicts).padStart(8)} ${String(r.none).padStart(11)}  ${(r.precision * 100).toFixed(0).padStart(6)}%${r.measured < 10 ? '*' : ' '} ${r.expectedErrors.toFixed(1).padStart(7)}  ${r.status}`);
}
console.log('  * точность по малому числу решений — почти общая');
for (const [label, src] of [['наши каналы', true], ['каналы из ссылок разметки', false]] as const) {
  const none = chList.filter((r) => r.source === src && r.status !== 'есть').sort((a, b) => b.none - a.none);
  if (none.length) console.log(`\n${label} без разметки или с малой (по непроверенным): ${none.slice(0, TOP).map((r) => `${r.channel} ${r.verdicts}/${r.linked}${r.status === 'нет' ? ' (нет)' : ''}`).join(', ')}${none.length > TOP ? ` и ещё ${none.length - TOP}` : ''}`);
}

console.log(`\nфильмов с материалом ${t.films}: без решений человека ${t.filmsNoHuman}, из них совсем без подтверждения (ни человека, ни улики) ${t.filmsUnconfirmed}. Проверить первыми (ошибки × заметность):`);
for (const f of fList.slice(0, TOP)) {
  console.log(`  ${f.title.slice(0, 40).padEnd(40)} роликов ${String(f.videos).padStart(4)}  человеком ${String(f.human).padStart(3)}  без подтв. ${String(f.none).padStart(3)}  ~ошибок ${f.expectedErrors.toFixed(1)}${f.views ? `  вики ${Math.round(f.views / 1000)}k` : ''}`);
}
console.log(`\nпопулярные фильмы без единого материала (${t.silent}): ${silent.slice(0, TOP).map((s) => s.title).join(', ')}`);
if (quiet.length) console.log(`\nканалы, где почти ничего не опознано (роликов в выгрузке от 50, привязано меньше 1%): ${quiet.slice(0, TOP).map((c) => `${c.channel} ${c.linked}/${c.dump}`).join(', ')}`);
console.log(`\nTelegram: постов ${t.tgPosts}, решено человеком ${t.tgVerified} (${pct(t.tgVerified, t.tgPosts)}); больше всех: ${out.telegram.slice(0, 6).map((x) => `${x.handle} ${x.posts}`).join(', ')}`);
console.log(`покрытие: без разметки ${t.noMarkup} каналов из ${t.channels}, ~${t.expectedErrors} вероятных ошибок в непроверенном`);
