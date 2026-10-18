// Трейлеры заранее (17.10, владелец): чистая часть сборщика tools/trailers.mts — слияние источников, отбор роликов
// и разбор ответа YouTube. Без сети и файлов, чтобы её проверял tools/trailers-test.mts.
// Формат ролика — `TrailerItem` (worker/trailers.ts): его отдаёт клиенту GET /api/trailers.
import type { TrailerItem } from '../worker/trailers.ts';

export type Source = TrailerItem['s'];
/** Кандидат до проверки YouTube: то же, что ролик справочника. */
export type Candidate = TrailerItem;
/** Что знаем о ролике из YouTube Data API (videos.list). ok: 0 — удалён, закрыт, не встраивается или с возрастным
 *  ограничением (во встроенном плеере такой просит войти — для трейлера это то же, что «не играет»). */
export interface VideoMeta { at: string; ok: 0 | 1; ru?: 0; d?: string; l?: string; n?: string }

export const VIDEO_KEY = /^[\w-]{11}$/;
/** Порядок источников: свой (trailersOwn.ts) > канал прокатчика > TMDb (официальный выше) > Wikidata. */
const RANK: Record<Source, number> = { own: 0, ch: 1, tmdb: 2, wd: 4 };
const rank = (c: Candidate) => RANK[c.s] + (c.s === 'tmdb' && !c.o ? 1 : 0);
/** Сколько запасных держать на место (язык × вид) до проверки YouTube: лучший может оказаться удалённым. */
export const SPARE = 3;

/** Язык ролика в двух буквах: 'ru-RU' → 'ru', 'zxx'/'und' и пусто → ''. */
export const lang2 = (l: string | null | undefined): string => {
  const x = (l ?? '').toLowerCase().split(/[-_]/)[0];
  return /^[a-z]{2}$/.test(x) ? x : '';
};

/** Закрыт ли ролик в России: в запретных есть RU или список разрешённых есть, а RU в нём нет. */
export function blockedInRu(rr?: { allowed?: string[]; blocked?: string[] }): boolean {
  if (!rr) return false;
  if (rr.blocked?.includes('RU')) return true;
  return Array.isArray(rr.allowed) && !rr.allowed.includes('RU');
}

/** Ответ videos.list по одному ролику → что запомнить. */
export interface YtVideo {
  id: string;
  status?: { privacyStatus?: string; uploadStatus?: string; embeddable?: boolean };
  contentDetails?: { duration?: string; regionRestriction?: { allowed?: string[]; blocked?: string[] }; contentRating?: { ytRating?: string } };
  snippet?: { title?: string; publishedAt?: string; defaultAudioLanguage?: string; defaultLanguage?: string };
}
/** Длительность ISO 8601 (PT2M13S) в секундах; не разобрали — undefined. */
export function seconds(iso?: string): number | undefined {
  const m = iso?.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  return m ? ((+(m[1] ?? 0) * 24 + +(m[2] ?? 0)) * 60 + +(m[3] ?? 0)) * 60 + +(m[4] ?? 0) : undefined;
}
/** Короче — не трейлер, а рекламный ролик «смотрите в онлайн-кинотеатрах» (17.10: так было у «Дюны» в trailersOwn, 17 с). */
export const MIN_SECONDS = 30;
export function videoMeta(v: YtVideo, at: string): VideoMeta {
  const st = v.status ?? {};
  const alive = (st.privacyStatus === 'public' || st.privacyStatus === 'unlisted')
    && (st.uploadStatus === undefined || st.uploadStatus === 'processed')
    && st.embeddable !== false
    && v.contentDetails?.contentRating?.ytRating !== 'ytAgeRestricted'
    && (seconds(v.contentDetails?.duration) ?? MIN_SECONDS) >= MIN_SECONDS;
  if (!alive) return { at, ok: 0 };
  const l = lang2(v.snippet?.defaultAudioLanguage ?? v.snippet?.defaultLanguage);
  return {
    at, ok: 1,
    ...(blockedInRu(v.contentDetails?.regionRestriction) ? { ru: 0 as const } : {}),
    ...(v.snippet?.publishedAt ? { d: v.snippet.publishedAt.slice(0, 10) } : {}),
    ...(l ? { l } : {}),
    ...(v.snippet?.title ? { n: v.snippet.title.slice(0, 120) } : {}),
  };
}

/** Место ролика: русский и английский — свои места, остальные языки и неизвестный — общее «иное». */
const slotLang = (l: string) => (l === 'ru' || l === 'en' ? l : 'x');

/** Одинаковые ролики из разных источников — один: остаётся старший источник, недостающее (язык, название,
 *  «официальный», дата) берётся у младших. */
export function mergeCandidates(list: Candidate[]): Candidate[] {
  const by = new Map<string, Candidate>();
  for (const c of [...list].sort((a, b) => rank(a) - rank(b))) {
    if (!VIDEO_KEY.test(c.k)) continue;
    const had = by.get(c.k);
    if (!had) { by.set(c.k, { ...c }); continue; }
    if (!had.l && c.l) had.l = c.l;
    if (!had.n && c.n) had.n = c.n;
    if (!had.o && c.o) had.o = 1;
    if (!had.d && c.d) had.d = c.d;
    // тизер у одного и трейлер у другого — верим старшему
  }
  return [...by.values()];
}

/** Сезон по названию ролика (18.10, сквозная проверка 17.10: у «Игры престолов» главным выбирался «5 сезон. Трейлер 2»).
 *  Ключ порядка: 0 — первый сезон или без номера (общий), 1 — весь сериал разом («Official Series Trailer», «Seasons 1–7»,
 *  «все сезоны»: обычно нарезка из всех сезонов), N ≥ 2 — сезон N, 999 — «финальный»/«последний»/«новый сезон» (номера
 *  нет, но не первый), 1000 — серия, а не трейлер («1 сезон 1 серия короткая версия», «Episode 3», «S01E02»). Названия —
 *  у TMDb (`name`), каналов (заголовок), YouTube (для Викиданных — после проверки); нет названия — 0. Только для сериалов
 *  (ключ `tv:`/`imdb:`, isSeriesKey): у фильмов «Open Season 2», «Эпизод 4 – Новая надежда», «Vol. 2» — не сезоны. */
const ORD_RU = ['перв', 'втор', 'трет', 'четв', 'пят', 'шест', 'седьм', 'восьм', 'девят', 'десят'];
const ORD_EN = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'];
const NUM_EN = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
// границы слова — по буквам и цифрам, в Юникоде (в JS \b кириллицы не знает)
const B = '(?<![\\p{L}\\p{N}])';
const E = '(?![\\p{L}\\p{N}])';
const re = (src: string) => new RegExp(src, 'iu');
const EPISODE = [
  re(`${B}\\d{1,3}\\s*(?:-?(?:я|ая)\\s*)?серия${E}`), re(`${B}серия\\s*№?\\s*\\d`), re(`${B}(?:episode|эпизод)\\s*№?\\s*\\d`),
  re(`${B}s\\d{1,2}\\s*e\\d{1,3}${E}`), re(`${B}ep\\.?\\s*\\d{1,3}${E}`),
];
const RANGE = [
  re(`${B}(\\d{1,2})\\s*(?:[-–—]|по|и|&)\\s*\\d{1,2}\\s*(?:-?(?:й|ый)\\s*)?сезон`),
  re(`${B}(?:сезоны|seasons)\\s*(\\d{1,2})\\s*(?:[-–—,&]|и|and)\\s*\\d{1,2}${E}`),
];
const WHOLE = re(`${B}(?:(?:full|complete|entire|official)\\s+series|series\\s+trailer|все\\s+сезоны|полн\\p{L}*\\s+сериал)${E}`);
const LATER = re(`${B}(?:(?:финальн|последн|прощальн|нов|следующ)\\p{L}*\\s+сезон|(?:final|last|new|next)\\s+season)`);
const SEASON: [RegExp, (m: RegExpExecArray) => number][] = [
  [re(`${B}(\\d{1,2})\\s*(?:-?\\s*(?:й|ый|ий|ой)\\s*|-\\s*)?сезон`), (m) => +m[1]],
  [re(`${B}сезон\\p{L}*\\s*№?\\s*(\\d{1,2})(?!\\d)`), (m) => +m[1]],
  [re(`${B}(${ORD_RU.join('|')})\\p{L}*\\s+сезон`), (m) => ORD_RU.findIndex((o) => m[1].toLowerCase().startsWith(o)) + 1],
  [re(`${B}season\\s*№?\\s*(\\d{1,2})(?!\\d)`), (m) => +m[1]],
  [re(`${B}season\\s+(${NUM_EN.join('|')})${E}`), (m) => NUM_EN.indexOf(m[1].toLowerCase()) + 1],
  [re(`${B}(\\d{1,2})(?:st|nd|rd|th)\\s+season`), (m) => +m[1]],
  [re(`${B}(${ORD_EN.join('|')})\\s+season`), (m) => ORD_EN.indexOf(m[1].toLowerCase()) + 1],
  // британское «Series 2» (Top Gear, Шерлок), «S2»/«S02»; выпуски и части («Love, Death + Robots: Volume 3», «Part 2»)
  [re(`${B}series\\s+(\\d{1,2})${E}`), (m) => +m[1]],
  [re(`${B}s0?(\\d{1,2})${E}`), (m) => +m[1]],
  [re(`${B}(?:volume|vol\\.|part|часть)\\s*(\\d{1,2})${E}`), (m) => +m[1]],
  [re(`${B}(\\d{1,2})[-\\s]*(?:я\\s+)?часть${E}`), (m) => +m[1]],
];
const seasonMemo = new Map<string, number>();
export function seasonRank(name: string | undefined): number {
  if (!name) return 0;
  const had = seasonMemo.get(name);
  if (had !== undefined) return had;
  const t = name.replace(/\s+/g, ' ');
  let r = 0;
  const range = RANGE.map((x) => x.exec(t)).find(Boolean);
  if (EPISODE.some((x) => x.test(t))) r = 1000;
  else if (range) r = +range[1] <= 1 ? 1 : +range[1];
  else {
    const hit = SEASON.map(([x, n]) => { const m = x.exec(t); return m ? n(m) : 0; }).find((n) => n > 0);
    r = hit ? (hit <= 1 ? 0 : hit) : LATER.test(t) ? 999 : WHOLE.test(t) ? 1 : 0;
  }
  if (seasonMemo.size > 50_000) seasonMemo.clear();
  seasonMemo.set(name, r);
  return r;
}
/** Ключ справочника — сериал: `tv:<n>` (и двойник `imdb:tt…`). */
export const isSeriesKey = (key: string): boolean => /^(?:tv|imdb):/.test(key);
/** Сезон кандидата: свой (own) — как первый, его владелец выбрал руками. */
const seasonOf = (c: Candidate) => (c.s === 'own' ? 0 : seasonRank(c.n));
/** Первый сезон, общий или весь сериал — не спойлер последующих сезонов. */
const earlySeason = (c: Candidate): boolean => seasonOf(c) <= 1;

/** Порядок внутри места: открытый в России раньше закрытого (ru:0 годится только не-русским зрителям, а сервер
 *  один на все языки), у сериала — сезон (18.10: первый или общий раньше, дальше по номеру, серии — в самом конце),
 *  потом источник, потом новее. */
const better = (series: boolean) => (a: Candidate, b: Candidate) =>
  Number(a.ru === 0) - Number(b.ru === 0) || (series ? seasonOf(a) - seasonOf(b) : 0) || rank(a) - rank(b) || (b.d ?? '').localeCompare(a.d ?? '');

/** Кандидаты, которые стоит проверить в YouTube: до SPARE лучших на каждое место (у сериала — ранние сезоны вперёд). */
export function toCheck(list: Candidate[], series = false): Candidate[] {
  const slots = new Map<string, Candidate[]>();
  for (const c of mergeCandidates(list)) {
    const k = `${slotLang(c.l)}|${c.t}`;
    (slots.get(k) ?? slots.set(k, []).get(k)!).push(c);
  }
  return [...slots.values()].flatMap((s) => s.sort(better(series)).slice(0, SPARE));
}

/** Применить проверку YouTube: мёртвые — прочь, закрытые в России — ru:0, язык и дату — из YouTube, если своих нет.
 *  Не проверенный (нет ключа API, кончилась квота) — как есть: TMDb обычно прав. Свой (own) не выкидываем — его
 *  владелец подобрал руками; закрытость в России пометим. */
export function applyMeta(list: Candidate[], meta: Record<string, VideoMeta | undefined>): Candidate[] {
  const out: Candidate[] = [];
  for (const c of list) {
    const m = meta[c.k];
    if (!m) { out.push(c); continue; }
    if (!m.ok && c.s !== 'own') continue;
    out.push({
      ...c,
      ...(!c.l && m.l ? { l: m.l } : {}),
      ...(!c.d && m.d ? { d: m.d } : {}),
      ...(!c.n && m.n ? { n: m.n } : {}),
      ...(m.ru === 0 ? { ru: 0 as const } : {}),
    });
  }
  return out;
}

/** Отбор: не больше четырёх — лучший трейлер и лучший тизер на русском и на английском. Ролики на других языках
 *  и с неизвестным языком — только если английского нет вовсе: фильм с одним японским трейлером лучше показать с
 *  ним, чем без трейлера. Порядок в ответе: русские, английские, иные; трейлер раньше тизера.
 *
 *  Сериал (18.10, `series` — ключ `tv:`/`imdb:`, isSeriesKey): есть открытый в России ролик первого сезона или общий (на русском или английском; на ином языке —
 *  когда английского нет) — роликов поздних сезонов и серий в ответе нет вовсе. Клиент (pickTrailer в src/api/index.ts)
 *  выбирает по языку, потом по виду (уровень спойлеров 0 — тизер, иначе трейлер) и сезонов не знает: оставь мы
 *  «5 сезон. Трейлер» рядом с тизером первого — при спойлерах > 0 он выбрал бы трейлер пятого сезона, а русскому
 *  зрителю — русский пятого сезона вместо английского общего. Так при любом уровне главный — первый сезон или общий;
 *  поздние идут в ход, только когда ничего раннего нет. */
export function pickTrailers(list: Candidate[], series = false): TrailerItem[] {
  let all = mergeCandidates(list);
  const anyEn = all.some((c) => c.l === 'en');
  const counts = (c: Candidate) => c.ru !== 0 && (c.l === 'ru' || c.l === 'en' || !anyEn);
  if (series && all.some((c) => counts(c) && earlySeason(c))) all = all.filter(earlySeason);
  const best = (l: string, t: 'T' | 'S') => all.filter((c) => slotLang(c.l) === l && c.t === t).sort(better(series))[0];
  const hasEn = all.some((c) => c.l === 'en');
  const langs = hasEn ? ['ru', 'en'] : ['ru', 'en', 'x'];
  const out: TrailerItem[] = [];
  for (const l of langs) for (const t of ['T', 'S'] as const) { const c = best(l, t); if (c) out.push(compact(c)); }
  return out.slice(0, 4);
}

/** Ролик без пустых полей: справочник на десятки тысяч работ, лишние ключи — мегабайты. */
export function compact(c: Candidate): TrailerItem {
  return {
    k: c.k, l: c.l, t: c.t, s: c.s,
    ...(c.n ? { n: c.n.slice(0, 120) } : {}),
    ...(c.o ? { o: 1 as const } : {}),
    ...(c.d ? { d: c.d } : {}),
    ...(c.ru === 0 ? { ru: 0 as const } : {}),
  };
}

/** Видео TMDb → кандидат: только YouTube, трейлер или тизер, ключ из 11 знаков. */
export interface TmdbVideo { key?: string; site?: string; type?: string; official?: boolean; iso_639_1?: string | null; name?: string; published_at?: string }
export function fromTmdb(v: TmdbVideo): Candidate | undefined {
  if (v.site !== 'YouTube' || !v.key || !VIDEO_KEY.test(v.key) || (v.type !== 'Trailer' && v.type !== 'Teaser')) return undefined;
  return {
    k: v.key, l: lang2(v.iso_639_1), t: v.type === 'Trailer' ? 'T' : 'S', s: 'tmdb',
    ...(v.name ? { n: v.name.slice(0, 120) } : {}),
    ...(v.official ? { o: 1 as const } : {}),
    ...(v.published_at ? { d: v.published_at.slice(0, 10) } : {}),
  };
}

/** Проверять ли ролик в YouTube этой ночью: новый — всегда; известный — в свою седьмую часть недели (по хэшу id,
 *  чтобы проверка шла ровно, а не всей пачкой раз в семь дней) и не чаще раза в трое суток. */
export function dueForCheck(id: string, m: VideoMeta | undefined, now = Date.now()): boolean {
  if (!m) return true;
  if (now - Date.parse(m.at) < 3 * 86400e3) return false;
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 7 === Math.floor(now / 86400e3) % 7 || now - Date.parse(m.at) > 10 * 86400e3;
}

/** Трейлеры фильмов без TMDb (ключ `wd:Q…`, решение владельца 17.10; 18.10): YouTube (P1651) с ролью «трейлер»
 *  (P3831 = Q622550) прямо по элементам Wikidata — номера TMDb (P4947), по которому ищет общий запрос, у них нет.
 *  Язык — квалификатор P407 с кодом ISO 639-1 (P218), как у общего запроса. */
export const WD_QID = /^Q\d{1,12}$/;
export function wdTrailerQuery(qids: readonly string[]): string {
  const values = qids.filter((q) => WD_QID.test(q)).map((q) => `wd:${q}`).join(' ');
  return `SELECT ?f ?x ?code WHERE { VALUES ?f { ${values} } ?f p:P1651 ?st . ?st ps:P1651 ?x ; pq:P3831 wd:Q622550 .
  OPTIONAL { ?st pq:P407 ?lq . ?lq wdt:P218 ?code } }`;
}
/** Ответ запроса выше → ролики по ключу `wd:Q…`; всем спрошенным — запись, у кого роликов нет — пустая. */
export function wdTrailerRows(qids: readonly string[], bindings: Record<string, { value: string } | undefined>[]): Record<string, { k: string; l: string }[]> {
  const out: Record<string, { k: string; l: string }[]> = Object.fromEntries(qids.filter((q) => WD_QID.test(q)).map((q) => [q, []]));
  for (const b of bindings) {
    const q = b.f?.value.replace(/^.*\//, '') ?? '';
    const k = b.x?.value ?? '';
    if (!out[q] || !VIDEO_KEY.test(k) || out[q].some((x) => x.k === k)) continue;
    out[q].push({ k, l: lang2(b.code?.value) });
  }
  return out;
}
