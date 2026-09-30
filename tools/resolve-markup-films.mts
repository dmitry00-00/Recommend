// Опознание фильмов, вписанных в таблицу разметки руками без года (28.09).
//   npx tsx tools/resolve-markup-films.mts [--dry]
//
// Вход — .cache/markup/typed.json: его пишет tools/import-markup.py из строк, где в колонке
// «Фильм» стоит то, чего нет в справочнике («игра престолов», «Бэтмен 2022», «довод»).
// Выход:
//   tools/markup-resolved.json    — ролик → ключ произведения; импорт применяет его на следующем круге;
//   src/mocks/filmBaseMarkup.ts   — карточки того, чего в справочнике не было (дополняется, не затирается).
//
// Почему не по одному названию: в справочнике «Бегущий человек» — это 1987 год, а ролик про
// ремейк 2025-го; «Мастер» у нас Андерсона, а в ролике Стэйтем. Поэтому решает дата ролика: из
// тёзок берём вышедших не позже него, год в самой ячейке («Бэтмен 2022») обязателен, слово
// «сериал»/«фильм» в заголовке ролика выбирает между сериалом и фильмом. Из оставшихся — свежий,
// если он вышел не раньше чем за два года до ролика (обзор новинки), иначе самый известный (по
// числу статей в Википедиях). Выбор из нескольких помечается `sure: false` — в таблице его видно
// по году и его стоит глянуть.
//
// Источник — Wikidata (CC0), как у tools/expand-film-base.mts: решение владельца 23.09 — новые
// вещи не строить на некоммерческих источниках. Ключ фильма — `tmdb:<id>` (P4947), сериала —
// `imdb:<id>` (P345): номера TMDb у фильмов и сериалов пересекаются, у IMDb — нет.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { worksIndex } from './works-index.mts';
import { filmBaseMarkup } from '../src/mocks/filmBaseMarkup.ts';
import type { WorkCard } from '../src/types/tmdf.ts';
import { isSeries } from '../src/lib/media.ts';

const DRY = process.argv.includes('--dry');
// правила Wikimedia: в подписи — как с нами связаться; анонимные запросы ограничены по частоте
const UA = 'recomend-research/0.1 (https://github.com/dmitry00-00/Recommend)';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const root = new URL('..', import.meta.url);

const TYPED = new URL('.cache/markup/typed.json', root);
const CACHE = new URL('.cache/markup/wikidata.json', root);
const OUT = new URL('tools/markup-resolved.json', root);
const CARDS = new URL('src/mocks/filmBaseMarkup.ts', root);

if (!existsSync(TYPED)) { console.error('нет .cache/markup/typed.json — сначала tools/import-markup.py'); process.exit(1); }
const rows = (JSON.parse(readFileSync(TYPED, 'utf8')).rows ?? []) as { video: string; film: string; title: string }[];
const videos = JSON.parse(readFileSync(new URL('.cache/youtube/videos.json', root), 'utf8')) as { id: string; publishedAt?: string }[];
const published = new Map(videos.map((v) => [v.id, v.publishedAt]));

const norm = (s: string) => s.normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase()
  .replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/** «Бэтмен 2022» → название и год; «1917» — это название, а не год */
function parse(film: string): { title: string; year?: number } {
  const m = /^(.*\S)\s*[(,]?\s*((?:19|20)\d{2})\)?$/.exec(film.trim());
  return m && norm(m[1]) ? { title: m[1], year: Number(m[2]) } : { title: film.trim() };
}

// ── Wikidata ──────────────────────────────────────────────────────────────────
interface Claim { mainsnak?: { datavalue?: { value: unknown } } }
interface Entity {
  labels?: Record<string, { value: string }>;
  aliases?: Record<string, { value: string }[]>;
  claims?: Record<string, Claim[]>;
  sitelinks?: Record<string, unknown>;
}
/** Не чаще запроса в PACE мс; на 429 ждём ровно столько, сколько сервер просит в Retry-After.
 *  Первая версия (28.09) долбила повторами через 3 с и получала 429 на всё подряд. */
const PACE = 1100;
let last = 0;
async function api<T>(params: Record<string, string>): Promise<T | undefined> {
  const url = `https://www.wikidata.org/w/api.php?${new URLSearchParams({ format: 'json', ...params })}`;
  for (let attempt = 0; attempt < 6; attempt++) {
    const wait = last + PACE - Date.now();
    if (wait > 0) await sleep(wait);
    last = Date.now();
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30_000) });
      if (res.ok) return await res.json() as T;
      if (res.status === 429) {
        const after = Number(res.headers.get('retry-after')) || 30;
        console.error(`  Wikidata просит подождать ${after} с`);
        await sleep(after * 1000 + 500);
        continue;
      }
    } catch { /* сеть дрогнула или таймаут */ }
    await sleep(2000 * (attempt + 1));
  }
  return undefined;
}
const FILM = new Set(['Q11424', 'Q506240', 'Q24869', 'Q202866', 'Q20650540', 'Q29168811']);
const SERIES = new Set(['Q5398426', 'Q1259759', 'Q581714', 'Q63952888', 'Q526877', 'Q117467246', 'Q15416']);
const qid = (c?: Claim) => (c?.mainsnak?.datavalue?.value as { id?: string } | undefined)?.id;
const str = (c?: Claim) => c?.mainsnak?.datavalue?.value as string | undefined;
const yearOf = (cs?: Claim[]) => Math.min(...(cs ?? []).map((c) =>
  Number((c.mainsnak?.datavalue?.value as { time?: string } | undefined)?.time?.slice(1, 5)) || 9999)) % 9999 || 0;

/** что узнали о кандидате — это и кладём в кэш, чтобы повторный круг не ходил в сеть */
interface Cand {
  qid: string; series: boolean; year: number; ru?: string; en?: string; names: string[];
  tmdb?: number; imdb?: string; links: number; director?: string; minutes?: number;
}
// кэш в два слоя: что нашёл поиск по названию и что мы узнали о каждом найденном (null — не
// фильм и не сериал). Пишется по ходу: оборвался круг — следующий продолжит, а не начнёт заново
interface Cache { search: Record<string, string[]>; full?: Record<string, string[]>; ents: Record<string, Cand | null> }
const cache: Cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : { search: {}, ents: {} };
const save = () => { mkdirSync(new URL('.cache/markup/', root), { recursive: true }); writeFileSync(CACHE, JSON.stringify(cache)); };

/** первый проход — только поиск: по запросу на название (и второй, английский, для латиницы) */
async function searchAll(titles: string[]) {
  const todo = titles.filter((t) => !cache.search[norm(t)]);
  console.error(`поиск в Wikidata: ${todo.length} названий (остальные в кэше)`);
  let n = 0;
  for (const title of todo) {
    const ids = new Set<string>();
    let ok = true;
    for (const language of /[a-z]/i.test(title) ? ['ru', 'en'] : ['ru']) {
      const r = await api<{ search?: { id: string }[] }>({ action: 'wbsearchentities', search: title, language, uselang: language, type: 'item', limit: '10' });
      if (!r) { ok = false; continue; }
      for (const h of r.search ?? []) ids.add(h.id);
    }
    if (ok) cache.search[norm(title)] = [...ids];
    if (++n % 50 === 0) { save(); console.error(`  ${n} из ${todo.length}`); }
  }
  save();
}

/** второй проход — карточки найденного пачками по 50: так запросов вдесятеро меньше */
async function fetchEntities() {
  const need = [...new Set([...Object.values(cache.search), ...Object.values(cache.full ?? {})].flat())].filter((id) => !(id in cache.ents));
  console.error(`карточки: ${need.length} (пачками по 50)`);
  for (let i = 0; i < need.length; i += 50) {
    const batch = need.slice(i, i + 50);
    const got = await api<{ entities?: Record<string, Entity> }>({ action: 'wbgetentities', ids: batch.join('|'), props: 'labels|aliases|claims|sitelinks', languages: 'ru|en' });
    if (!got) continue;
    for (const id of batch) {
      const e = got.entities?.[id];
      const kinds = (e?.claims?.P31 ?? []).map((c) => qid(c)).filter((x): x is string => Boolean(x));
      const series = kinds.some((x) => SERIES.has(x));
      if (!series && !kinds.some((x) => FILM.has(x))) { cache.ents[id] = null; continue; }
      const names = [e?.labels?.ru?.value, e?.labels?.en?.value, ...(e?.aliases?.ru ?? []).map((a) => a.value), ...(e?.aliases?.en ?? []).map((a) => a.value)]
        .filter((x): x is string => Boolean(x)).map(norm);
      const dur = e?.claims?.P2047?.[0]?.mainsnak?.datavalue?.value as { amount?: string; unit?: string } | undefined;
      cache.ents[id] = {
        qid: id, series,
        year: series ? (yearOf(e?.claims?.P580) || yearOf(e?.claims?.P577)) : yearOf(e?.claims?.P577),
        ru: e?.labels?.ru?.value, en: e?.labels?.en?.value, names: [...new Set(names)],
        tmdb: Number(str(e?.claims?.P4947?.[0])) || undefined, imdb: str(e?.claims?.P345?.[0]),
        links: Object.keys(e?.sitelinks ?? {}).length, director: qid(e?.claims?.P57?.[0]),
        minutes: dur?.unit?.endsWith('/Q7727') && dur.amount ? Math.round(Number(dur.amount)) : undefined,
      };
    }
    if ((i / 50) % 5 === 4) { save(); console.error(`  ${Math.min(i + 50, need.length)} из ${need.length}`); }
  }
  save();
}

/** Второй поиск — полнотекстовый и только среди фильмов и сериалов — для тех, кого не нашёл
 *  первый. Поиск по названию ищет с начала строки и спотыкается о «ё» («освобожденный»), о
 *  пропущенное двоеточие («аватар путь воды») и о неполное название («кольца власти»). */
const TYPES = [...FILM, ...SERIES].map((q) => `P31=${q}`).join('|');
async function searchFull(titles: string[]) {
  cache.full ??= {};
  const todo = titles.filter((t) => !cache.full![norm(t)]);
  console.error(`полнотекстовый поиск: ${todo.length} названий`);
  let n = 0;
  for (const title of todo) {
    const r = await api<{ query?: { search?: { title: string }[] } }>({ action: 'query', list: 'search', srsearch: `${title} haswbstatement:${TYPES}`, srlimit: '10', srnamespace: '0' });
    if (r) cache.full[norm(title)] = (r.query?.search ?? []).map((h) => h.title);
    if (++n % 50 === 0) { save(); console.error(`  ${n} из ${todo.length}`); }
  }
  save();
}

const candidates = (title: string, full = false): Cand[] =>
  ((full ? cache.full?.[norm(title)] : cache.search[norm(title)]) ?? []).map((id) => cache.ents[id]).filter((c): c is Cand => Boolean(c));

const keyOf = (c: Cand) => (c.series ? (c.imdb ? `imdb:${c.imdb}` : undefined) : (c.tmdb ? `tmdb:${c.tmdb}` : undefined));

function choose(c: Cand[], typed: { title: string; year?: number }, videoYear: number, videoTitle: string, words = false) {
  const want = norm(typed.title);
  let pool = c.filter((x) => keyOf(x) && x.names.includes(want));
  // точного имени нет — принимаем название, которое начинается с вписанного, но только одно
  if (!pool.length) {
    const loose = c.filter((x) => keyOf(x) && x.names.some((n) => n.startsWith(`${want} `)));
    if (loose.length === 1) pool = loose;
  }
  // после полнотекстового поиска — все слова вписанного есть в названии («кольца власти» →
  // «Властелин колец: Кольца власти»); номер части не обязателен: «звездные войны 7
  // пробуждение силы» → «Звёздные войны: Пробуждение силы». Не меньше двух слов, одно — ловушка
  let byWords = false;
  if (!pool.length && words) {
    byWords = true;
    const need = want.split(' ').filter((w) => !/^\d+$/.test(w));
    if (need.length >= 2) {
      pool = c.filter((x) => keyOf(x) && x.names.some((n) => { const have = new Set(n.split(' ')); return need.every((w) => have.has(w)); }));
      if (pool.length > 1) return undefined;
    }
  }
  if (typed.year) pool = pool.filter((x) => Math.abs(x.year - typed.year!) <= 1);
  else if (videoYear) pool = pool.filter((x) => !x.year || x.year <= videoYear);
  const series = /сериал|сезон|серия|серии|эпизод/i.test(videoTitle);
  // не \b: в JS он не знает кириллицы
  const film = /(^|[^\p{L}])(фильм|кино)/iu.test(videoTitle);
  if (series && pool.some((x) => x.series)) pool = pool.filter((x) => x.series);
  else if (film && !series && pool.some((x) => !x.series)) pool = pool.filter((x) => !x.series);
  if (!pool.length) return undefined;
  // совпадение по словам — всегда на проверку: название совпало не целиком
  if (pool.length === 1) return { cand: pool[0], sure: !byWords };
  const newest = pool.reduce((a, b) => (b.year > a.year ? b : a));
  if (videoYear && newest.year && videoYear - newest.year <= 2) return { cand: newest, sure: false };
  return { cand: pool.reduce((a, b) => (b.links > a.links ? b : a)), sure: false };
}

// ── круг ──────────────────────────────────────────────────────────────────────
const known = new Map(worksIndex({ all: true }).map((w) => [w.key, w.work]));
const prevCards = new Map(filmBaseMarkup.map((w) => [isSeries(w) ? `imdb:${w.externalIds?.imdb}` : `tmdb:${w.externalIds?.tmdb}`, w]));
const prev = existsSync(OUT) ? (JSON.parse(readFileSync(OUT, 'utf8')).videos ?? {}) as Record<string, unknown> : {};
const result: Record<string, { typed: string; key: string; label: string; sure: boolean }> = { ...(prev as Record<string, never>) };
const newCards = new Map<string, { card: WorkCard; director?: string }>();
const missed = new Map<string, number>();
let sure = 0, guessed = 0;
const titles = new Set(rows.map((r) => norm(parse(r.film).title)));
console.error(`строк без справочника: ${rows.length}, разных названий: ${titles.size}`);

const videoYearOf = (r: { video: string }) => Number(published.get(r.video)?.slice(0, 4)) || 0;
/** «Бэтмен 2022» — год, а «Бегущий по лезвию 2049» — название: год не может быть позже ролика */
const typedOf = (r: { video: string; film: string }) => {
  const t = parse(r.film);
  const vy = videoYearOf(r);
  return t.year && vy && t.year > vy + 1 ? { title: r.film.trim() } : t;
};
const pickFor = (r: typeof rows[number]) => {
  const typed = typedOf(r);
  return choose(candidates(typed.title), typed, videoYearOf(r), r.title)
    ?? choose(candidates(typed.title, true), typed, videoYearOf(r), r.title, true);
};

await searchAll([...new Set(rows.map((r) => typedOf(r).title))]);
await fetchEntities();
const misses = rows.filter((r) => !choose(candidates(typedOf(r).title), typedOf(r), videoYearOf(r), r.title));
await searchFull([...new Set(misses.map((r) => typedOf(r).title))]);
await fetchEntities();
for (const r of rows) {
  const typed = typedOf(r);
  const pick = pickFor(r);
  if (!pick) { missed.set(r.film, (missed.get(r.film) ?? 0) + 1); continue; }
  const key = keyOf(pick.cand)!;
  const have = known.get(key) ?? prevCards.get(key) ?? newCards.get(key)?.card;
  const title = have?.title ?? pick.cand.ru ?? pick.cand.en ?? typed.title;
  const year = have?.year ?? pick.cand.year;
  if (!have) {
    newCards.set(key, {
      director: pick.cand.director,
      card: {
        id: `f-wd${pick.cand.qid.slice(1)}`, type: pick.cand.series ? 'series' : 'film',
        title, ...(pick.cand.en && pick.cand.en !== title ? { originalTitle: pick.cand.en } : {}),
        year, creators: [], primaryOperations: [], complexityLevel: 0, warnings: [], barriers: [],
        isNicheMasterpiece: false, ...(pick.cand.minutes ? { durationMinutes: pick.cand.minutes } : {}),
        // у сериала номер TMDb в карточку не кладём: клиент строит из него ключ `tmdb:`, а это
        // пространство фильмов
        externalIds: pick.cand.series ? { imdb: pick.cand.imdb } : { tmdb: pick.cand.tmdb, ...(pick.cand.imdb ? { imdb: pick.cand.imdb } : {}) },
      } as WorkCard,
    });
  }
  // подпись — по тому же правилу, что в справочнике таблицы (tools/markup-xlsx.mts): иначе импорт
  // каждый круг видит «правку» там, где различается только подпись. Года нет — его и не пишем
  const label = pick.cand.series ? (year ? `${title} (сериал, ${year})` : `${title} (сериал)`) : year ? `${title} (${year})` : title;
  result[r.video] = { typed: r.film, key, label, sure: pick.sure };
  if (pick.sure) sure += 1; else guessed += 1;
}
save();

// режиссёры новых фильмов — одним заходом по QID
const dirs = [...new Set([...newCards.values()].map((x) => x.director).filter((x): x is string => Boolean(x)))];
const dirName = new Map<string, string>();
for (let i = 0; i < dirs.length; i += 50) {
  const got = await api<{ entities?: Record<string, Entity> }>({ action: 'wbgetentities', ids: dirs.slice(i, i + 50).join('|'), props: 'labels', languages: 'ru|en' });
  for (const d of dirs.slice(i, i + 50)) {
    const n = got?.entities?.[d]?.labels?.ru?.value ?? got?.entities?.[d]?.labels?.en?.value;
    if (n) dirName.set(d, n);
  }
  await sleep(250);
}
const cards = [...filmBaseMarkup, ...[...newCards.values()].map(({ card, director }) =>
  (director && dirName.get(director) ? { ...card, creators: [dirName.get(director)!] } : card))];

console.error(`опознано строк: ${sure} уверенно, ${guessed} выбором из тёзок; не опознано: ${[...missed.values()].reduce((a, b) => a + b, 0)} (${missed.size} названий)`);
console.error(`новых карточек: ${newCards.size} (сериалов ${[...newCards.values()].filter((x) => isSeries(x.card)).length})`);
if (missed.size) console.error(`не нашлось: ${[...missed.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30).map(([t, n]) => (n > 1 ? `${t} ×${n}` : t)).join(', ')}`);
if (DRY) process.exit(0);

writeFileSync(OUT, `${JSON.stringify({
  '//': 'Ролик → произведение для названий, вписанных в таблицу без года. Пишет tools/resolve-markup-films.mts,'
    + ' читает tools/import-markup.py. sure: false — выбор из тёзок по дате ролика, стоит проверить.',
  updated: new Date().toISOString().slice(0, 10),
  videos: Object.fromEntries(Object.entries(result).sort(([a], [b]) => a.localeCompare(b))),
}, null, 1)}\n`);
writeFileSync(CARDS, `// Сгенерировано tools/resolve-markup-films.mts: фильмы и сериалы, которые люди вписали в таблицу
// разметки и которых не было в справочнике; опознаны в Wikidata (CC0). Разметки нет, в подбор не
// идут — нужны, чтобы разборы было к чему привязать. Дополняется от круга к кругу, не затирается.
// Не править руками — перегенерировать.
import type { WorkCard } from '@/types/tmdf';

export const filmBaseMarkup: WorkCard[] = ${JSON.stringify(cards, null, 2)};
`);
