// Данные для ручной разметки «ролик → фильм»: что смотреть человеку и из чего выбирать.
// Пишет .cache/markup/film-reviews.json, из которого tools/markup-xlsx.py собирает
// film_reviews.xlsx (выпадающий список в Excel — это уже не наша часть, её делает openpyxl).
//   npx tsx tools/markup-xlsx.mts [--batch 1500 | --full] [--min-minutes 5] [--books] [--limit N] [--all-links]
//
// Пачка (по умолчанию, 06.10). Таблица — задание, а не реестр: в листы разметки идут только первые
// --batch строк очереди вкладки «Проверка» (спорные, непроверенные, без привязки с находкой модели — тем
// же порядком), с подсказкой модели в колонке «Модель». Целиком (48 тысяч строк, 25 МБ листа) таблица
// на телефоне не открывалась. Решённое в таблицу не возвращается — оно в tools/markup-verdicts.json, а
// строк, которых в листе нет, импорт не касается. «Без разбора» — первые 500 по упоминаниям и все со
// ссылками. Прежняя таблица со всеми роликами — --full.
// Ролики берём из .cache/youtube/videos.json (его наполняет tools/youtube-dump.mts),
// предмет и ярус канала — из .cache/youtube/channels.json: книжные каналы в таблицу про кино
// не идут, а обзорщики и эссеисты разъезжаются по разным листам (просьба владельца 26.09:
// это разная работа — у обзорщика фильм в заголовке, у эссеиста он бывает только в теле).
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { worksIndex } from './works-index.mts';
import { matchVideos } from './match-videos.mts';
import { essays } from '../src/mocks/essays.ts';
import { essaysAuto } from '../src/mocks/essaysAuto.ts';
import { postsAuto } from '../src/mocks/postsAuto.ts';
import { voices, voiceKeys } from '../src/mocks/voices.ts';
import type { ExternalAnalysis } from '../src/types/tmdf.ts';
import { isSeries } from '../src/lib/media.ts';
import { isBookKey } from '../src/lib/keys.ts';

const arg = (name: string, def: string): string => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
};
const flag = (name: string): boolean => process.argv.includes(`--${name}`);

const MIN_MINUTES = Number(arg('min-minutes', '5'));
const FULL = flag('full');
const BATCH = Number(arg('batch', '1500'));
const MISSING_TOP = 500;
const LIMIT = Number(arg('limit', '0'));

interface Video { id: string; title: string; description?: string; publishedAt?: string; channel: string; channelId?: string; minutes?: number }
type Channel = { title: string; tier?: 'essay' | 'review'; medium?: 'film' | 'book'; via?: 'links'; language?: 'en' };

const root = new URL('..', import.meta.url);
const videos = JSON.parse(readFileSync(new URL('.cache/youtube/videos.json', root), 'utf8')) as Video[];
const channels = JSON.parse(readFileSync(new URL('.cache/youtube/channels.json', root), 'utf8')) as Record<string, Channel>;

// 1. Из чего выбирать: все фильмы, которые мы знаем. Книги (isbn:) не предлагаем — таблица
// про киноролики. Ярлык «Название (год)» обязан быть уникальным: он же и есть значение ячейки,
// по нему разметку читают обратно, а «Солярис» без года — это два разных фильма.
const seen = new Map<string, number>();
const films = worksIndex({ all: true })
  .filter((w) => w.key.startsWith('tmdb:') || w.key.startsWith('imdb:'))
  .map((w) => ({ key: w.key, title: w.work.title, year: w.work.year, series: isSeries(w.work) }))
  .sort((a, b) => a.title.localeCompare(b.title, 'ru') || (a.year ?? 0) - (b.year ?? 0))
  .map((f) => {
    // то же правило подписи — в tools/resolve-markup-films.mts
    const base = f.series ? (f.year ? `${f.title} (сериал, ${f.year})` : `${f.title} (сериал)`) : f.year ? `${f.title} (${f.year})` : f.title;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return { key: f.key, label: n === 1 ? base : `${base} #${n}`, title: f.title, year: f.year };
  });
const labelOf = new Map(films.map((f) => [f.key, f.label]));

// 2. Что уже угадал сопоставитель — этим заполняем колонку «Фильм» заранее: человеку остаётся
// подтвердить или поправить, а не искать фильм в списке из полутора тысяч.
const guess = new Map<string, string>();
// второй фильм ролика (OPS-8, 02.10) — догадкой в колонку «Ещё фильмы»
const guessAlso = new Map<string, string[]>();
for (const [key, list] of Object.entries(essaysAuto)) {
  for (const a of list) {
    const id = /v=([A-Za-z0-9_-]{11})/.exec(a.url)?.[1];
    if (!id) continue;
    if (!guess.has(id)) guess.set(id, key);
    else if (guess.get(id) !== key) guessAlso.set(id, [...(guessAlso.get(id) ?? []), key]);
  }
}

// 2а. Каналы из ссылок владельца (`via: 'links'`) индекс разборов не обходит — догадку по их
// роликам считаем здесь, теми же правилами (tools/match-videos.mts). Без неё ~62 тысячи строк
// приходили с пустым «Фильмом» (30.09).
const fromLinks = (v: Video) => channels[v.channelId ?? '']?.via === 'links';
// в пачку ролики каналов из ссылок без привязки не идут (очередь «Проверки» — из индекса и разметки
// модели), а угадывание по 185 тысячам роликов — почти три минуты: только для --full
if (FULL) {
  const ordFile = new URL('.cache/ordinary.json', root);
  const ordinary = existsSync(ordFile) ? new Set<string>(JSON.parse(readFileSync(ordFile, 'utf8')).names ?? []) : undefined;
  const todo = videos.filter((v) => fromLinks(v) && (v.minutes ?? 0) >= MIN_MINUTES && !guess.has(v.id));
  const t = Date.now();
  // книги (isbn:) не предлагаем — таблица про киноролики, и ярлыка у них в списке нет
  const found = matchVideos(todo.map((v) => (channels[v.channelId ?? '']?.language === 'en' ? { ...v, en: true } : v)), worksIndex().filter((w) => !isBookKey(w.key)), ordinary);
  for (const [id, g] of found) { guess.set(id, g.key); if (g.also?.length) guessAlso.set(id, g.also); }
  console.log(`каналы из ссылок: роликов ${todo.length}, угадан фильм у ${found.size} (${Math.round((Date.now() - t) / 1000)} с)`);
}

// 2б. Что уже решили люди (tools/markup-verdicts.json, его пишет import-markup.py). Решение
// сильнее догадки: таблица уходит обратно в Google, и если заполнить её одними догадками,
// заливка сотрёт всё, что там разметили. Строка с решением приходит с «Проверено» = «да».
const NOT_A_FILM = '— не про фильм —';
interface Verdict { key: string | null; why?: string; film?: string; from?: string; guess?: boolean; err?: string; also?: string[]; alsoFilms?: string[] }
const vFile = new URL('tools/markup-verdicts.json', root);
const human: Record<string, Verdict> = existsSync(vFile)
  ? (JSON.parse(readFileSync(vFile, 'utf8')).videos ?? {}) : {};
const humanLabel = (v: Verdict): string =>
  v.key ? (labelOf.get(v.key) ?? v.film ?? '') : v.why === 'не про фильм' ? NOT_A_FILM : (v.film ?? '');
// фильмы, которым люди нашли материал, и ссылки, принесённые со стороны фильма
const humanKeys = new Set(Object.values(human).map((v) => v.key).filter((k): k is string => Boolean(k)));
// все ссылки фильма, а не первая: владелец кладёт их в ряд, до восьми на фильм (29.09: 293 ссылки к
// 37 фильмам), и при пересборке в листе оставалась одна — остальные жили только в markup-verdicts.json
// (01.10). Порядок — как в файле решений
const gapLink = new Map<string, string[]>();
for (const [id, v] of Object.entries(human)) {
  if (v.from === 'gap' && v.key) (gapLink.get(v.key) ?? gapLink.set(v.key, []).get(v.key)!).push(`https://www.youtube.com/watch?v=${id}`);
}

// 3. У каких фильмов материала нет вовсе. Считаем так же, как tools/overlooked.mts: площадки
// не в счёт, книжные каналы тоже, разбор эссеиста и обзор — врозь.
const reviewTitles = new Set(Object.values(channels)
  .filter((c) => c.tier === 'review' && (c.medium ?? 'film') === 'film').map((c) => c.title));
const bookTitles = new Set(Object.values(channels).filter((c) => c.medium === 'book').map((c) => c.title));
const byId = new Map(voices.map((v) => [v.id, v]));
const vid = (a: ExternalAnalysis) => {
  const h = /^tg-([^-]+)-/.exec(a.id)?.[1];
  const k = h ? `tg:${h}` : `yt:${a.author}`;
  return voiceKeys[k] ?? k;
};
const hasEssay = new Map<string, number>();
const hasReview = new Map<string, number>();
for (const src of [essays, essaysAuto, postsAuto]) {
  for (const [k, list] of Object.entries(src)) for (const a of list) {
    if (byId.get(vid(a))?.role === 'platform') continue;
    if (bookTitles.has(a.author)) continue;
    const to = reviewTitles.has(a.author) ? hasReview : hasEssay;
    to.set(k, (to.get(k) ?? 0) + 1);
  }
}
const mentionsFile = new URL('.cache/mentions.json', root);
const mentions: Record<string, { author?: number }> = existsSync(mentionsFile)
  ? JSON.parse(readFileSync(mentionsFile, 'utf8')) : {};

// Фильм, которому люди нашли разбор, из списка уходит — кроме тех, кому разбор принесли
// прямо из этого листа: иначе ссылка исчезла бы оттуда, куда её вписали, и выглядело бы,
// что она потерялась
const missing = films
  .filter((f) => (!hasEssay.get(f.key) && !hasReview.get(f.key) && !humanKeys.has(f.key)) || gapLink.has(f.key))
  .map((f) => ({ label: f.label, title: f.title, year: f.year ?? '', talk: mentions[f.key]?.author ?? 0, key: f.key,
    link: gapLink.get(f.key)?.[0] ?? '', links: gapLink.get(f.key) ?? [] }))
  // сначала те, о ком говорят: это и есть очередь на разбор, а не алфавит
  .sort((a, b) => b.talk - a.talk || a.title.localeCompare(b.title, 'ru'));

// 3б. Корпус (01.10): самые обсуждаемые фильмы — топ-300 по упоминаниям в постах авторов, — у которых
// роликов мало (до двух): их владелец наполняет ссылками. Ролики фильма — YouTube из индексов разборов
// (без площадок и книжных каналов) и из решений людей. Ссылки, вписанные в этом листе (from: 'corpus'),
// остаются в нём при пересборке, даже если роликов стало больше двух — как в «Без разбора».
const CORPUS_TOP = 300, CORPUS_MAX = 2;
const ytId = (url: string) => /(?:[?&]v=|youtu\.be\/)([\w-]{11})/.exec(url)?.[1];
const videosOf = new Map<string, { all: Set<string>; review: Set<string> }>();
const addVideo = (k: string, id: string, review = false) => {
  const e = videosOf.get(k) ?? videosOf.set(k, { all: new Set(), review: new Set() }).get(k)!;
  e.all.add(id);
  if (review) e.review.add(id);
};
for (const src of [essays, essaysAuto, postsAuto]) {
  for (const [k, list] of Object.entries(src)) for (const a of list) {
    if (byId.get(vid(a))?.role === 'platform' || bookTitles.has(a.author)) continue;
    const id = a.platform === 'youtube' ? ytId(a.url) : undefined;
    if (id) addVideo(k, id, reviewTitles.has(a.author));
  }
}
for (const [id, v] of Object.entries(human)) if (v.key) addVideo(v.key, id);
const corpusLink = new Map<string, string[]>();
for (const [id, v] of Object.entries(human)) {
  if (v.from === 'corpus' && v.key) (corpusLink.get(v.key) ?? corpusLink.set(v.key, []).get(v.key)!).push(`https://www.youtube.com/watch?v=${id}`);
}
const corpus = films
  .map((f) => ({ label: f.label, title: f.title, year: f.year ?? '', key: f.key, talk: mentions[f.key]?.author ?? 0,
    have: videosOf.get(f.key)?.all.size ?? 0, reviews: videosOf.get(f.key)?.review.size ?? 0, links: corpusLink.get(f.key) ?? [] }))
  .filter((f) => f.talk > 0)
  .sort((a, b) => b.talk - a.talk || a.title.localeCompare(b.title, 'ru'))
  .slice(0, CORPUS_TOP)
  .filter((f) => f.have <= CORPUS_MAX || f.links.length);

// 4. Строки разметки, врозь по ярусу канала
let lost = 0;
const row = (v: Video) => {
  const url = `https://www.youtube.com/watch?v=${v.id}`;
  const base = { url, title: v.title, channel: v.channel, date: v.publishedAt ?? '' };
  const h = human[v.id];
  // догадка опознавателя (фильм вписан без года, выбран из тёзок) — с годом, но не проверена
  // вид ошибки и «ещё фильмы» (02.10) возвращаются в таблицу как были
  if (h) return { ...base, film: humanLabel(h), checked: !h.guess, err: h.err ?? '',
    also: [...(h.also ?? []).map((k) => labelOf.get(k) ?? k), ...(h.alsoFilms ?? [])].join('; ') };
  const key = guess.get(v.id);
  const film = key ? labelOf.get(key) : undefined;
  if (key && !film) lost++;   // догадка есть, а фильма в индексе уже нет — пустая строка честнее
  const also = (guessAlso.get(v.id) ?? []).map((k) => labelOf.get(k)).filter(Boolean).join('; ');
  return { ...base, film: film ?? '', checked: false, ...(also ? { also } : {}) };
};
// Каналы из ссылок — только ролики с догадкой или решением человека: остальное — десятки тысяч
// строк, которые вручную не разметить (30.09). Все подряд — --all-links.
let skippedLinks = 0;
const keepLink = (v: Video) => {
  if (!fromLinks(v) || flag('all-links') || human[v.id] || guess.has(v.id)) return true;
  skippedLinks += 1;
  return false;
};
const pick = (tier: 'essay' | 'review') => {
  const rows = videos
    .filter((v) => (channels[v.channelId ?? '']?.medium ?? 'film') === 'film' || flag('books'))
    .filter((v) => (channels[v.channelId ?? '']?.tier ?? 'essay') === tier)
    .filter((v) => (v.minutes ?? 0) >= MIN_MINUTES)
    .filter(keepLink)
    .sort((a, b) => a.channel.localeCompare(b.channel, 'ru') || (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''))
    .map(row);
  return LIMIT > 0 ? rows.slice(0, LIMIT) : rows;
};
// Пачка: очередь «Проверки» по порядку, ярус — по каналу ролика
async function batch(): Promise<{ review: ReturnType<typeof row>[]; essay: ReturnType<typeof row>[] }> {
  const { checkRows } = await import('./check-desk.mts');
  const byVid = new Map(videos.map((v) => [v.id, v]));
  const tierOf = (v: Video | undefined, channel?: string) =>
    (v ? channels[v.channelId ?? '']?.tier : undefined) ?? (channel && reviewTitles.has(channel) ? 'review' : 'essay');
  const out = { review: [] as ReturnType<typeof row>[], essay: [] as ReturnType<typeof row>[] };
  let n = 0;
  for (const r of checkRows()) {
    if (n >= BATCH) break;
    if (r.group !== 'spor' && r.group !== 'check' && r.group !== 'gap') continue;
    const v = byVid.get(r.id) ?? { id: r.id, title: r.title, channel: r.channel ?? '', publishedAt: r.date };
    const x = row(v);
    // без привязки — фильм модели в «Фильм» догадкой («да» в «Проверено» её подтверждает)
    const modelFilm = r.llm?.key ? labelOf.get(r.llm.key) : undefined;
    if (!x.film && modelFilm) x.film = modelFilm;
    const hint = r.llm ? `${r.llm.flagRu}${r.llm.label ? `: ${r.llm.label}` : r.llm.typed ? `: ${r.llm.typed}` : ''}${r.llm.note ? ` — ${r.llm.note}` : ''}` : '';
    out[tierOf(byVid.get(r.id), r.channel) === 'review' ? 'review' : 'essay'].push({ ...x, ...(hint ? { hint } : {}) });
    n++;
  }
  return out;
}
const { review, essay } = FULL ? { review: pick('review'), essay: pick('essay') } : await batch();
if (!FULL) {
  const keep = new Set(missing.slice(0, MISSING_TOP).map((m) => m.key));
  const before = missing.length;
  missing.splice(0, missing.length, ...missing.filter((m) => keep.has(m.key) || m.links.length));
  console.log(`пачка: ${review.length + essay.length} строк из очереди «Проверки» (--batch ${BATCH}); «Без разбора» ${missing.length} из ${before}`);
}

mkdirSync(new URL('.cache/markup/', root), { recursive: true });
writeFileSync(new URL('.cache/markup/film-reviews.json', root), JSON.stringify({ films, review, essay, missing, corpus }));
const withGuess = (rows: typeof review) => rows.filter((r) => r.film && !r.checked).length;
const decided = (rows: typeof review) => rows.filter((r) => r.checked).length;
console.log(`обзоры ${review.length} строк (догадок ${withGuess(review)}, решено людьми ${decided(review)}), эссе ${essay.length} (догадок ${withGuess(essay)}, решено ${decided(essay)})`);
if (skippedLinks) console.log(`каналы из ссылок: без догадки и решения в таблицу не вошло ${skippedLinks} (все подряд — --all-links)`);
console.log(`решений в tools/markup-verdicts.json: ${Object.keys(human).length}`);
console.log(`фильмов в списке ${films.length}${lost ? `, потеряно догадок ${lost}` : ''}; без разбора и обзора ${missing.length}, из них названы в постах ${missing.filter((m) => m.talk > 0).length}`);
console.log(`корпус: из ${CORPUS_TOP} самых обсуждаемых роликов до ${CORPUS_MAX} у ${corpus.length} (совсем без роликов ${corpus.filter((c) => !c.have).length})`);
console.log('→ .cache/markup/film-reviews.json');
