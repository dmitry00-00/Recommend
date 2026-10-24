// «Соседи по вкусу» (23.10, опыт `neighbors`, src/lib/model/experiments.ts). В замере (tools/taste-eval.mts) они различают
// любимое лучше всего (AUC 0,70 против 0,59–0,65 у модели): люди, которые оценили общее так же, как человек, и то, что они
// ставят выше своего обычного. Здесь — сам расчёт, чистый: его зовут сервер (worker/neighbors.ts — по опорным историям и
// участникам приложения) и замеры (tools/neighbors-eval.mts). Клиент чужих оценок не видит: ему уходит только итог по
// фильму («соседи оценили бы так-то»), и лишь по фильмам, которые оценили не меньше `minSupport` соседей.
//   · оценка — в шкале самого человека: z (сколько его разбросов от его же среднего);
//   · сходство — косинус z на общих фильмах (не меньше `minCommon`), сжатый к нулю: × n/(n + shrink);
//   · берём `k` самых похожих; счёт фильма — средняя z соседей с весом сходства, +1 в знаменателе (фильм одного соседа не
//     взлетает).
// Один фильм под разными ключами (`tmdb:`, `tmdbtv:`, `imdb:` — как в consensus.ts) сводится в один по любому общему ключу.
// Один человек в наборе дважды (опорная история и он же в приложении после импорта Кинопоиска) — «двойники»: почти тот же
// набор фильмов и те же оценки; из двойников в соседи идёт один, а двойник самого спрашивающего — не идёт вовсе.
// Без импортов: модуль собирают и esbuild воркера, и его проверка типов (tsconfig.worker.json не знает алиаса `@/`, а
// consensus.ts тянет `@/types/tmdf`) — поэтому ключи фильма здесь свои, ровно как consensusKeys в consensus.ts.

/** Ключи фильма, как consensusKeys (consensus.ts): у фильма TMDb и IMDb, у сериала — `tmdbtv:` и IMDb. */
function filmKeys(type: string, ids: { tmdb?: number; imdb?: string }): string[] {
  const series = type === 'series' || type === 'anime';
  return [...(ids.tmdb != null ? [series ? `tmdbtv:${ids.tmdb}` : `tmdb:${ids.tmdb}`] : []), ...(ids.imdb ? [`imdb:${ids.imdb}`] : [])];
}

export const NEIGHBOR = {
  /** сколько соседей: в taste-eval было 30, но с порогом minSupport 3 (личные данные) различение падает 0,731 → 0,677;
   *  80 соседей возвращают 0,701 (tools/neighbors-eval.mts, 23.10; дальше 80 почти не растёт — положительных соседей ~50) */
  k: 80,
  /** меньше общих фильмов — сходство не считаем */
  minCommon: 8,
  /** сжатие сходства: × n/(n + shrink) */
  shrink: 20,
  /** соседей ищем, только если у человека столько оценок (как порог историй в замере) */
  minRated: 20,
  /** фильм в итоге — только если его оценили столько соседей (агрегат не меньше чем по трём людям) */
  minSupport: 3,
  /** двойник: общих — не меньше этой доли от меньшей истории, и косинус не ниже `twinCos` (одна история в двух местах —
   *  0,99+; самые близкие разные люди — ниже: при 0,9 на синтетике отсекались и настоящие соседи) */
  twinShare: 0.8,
  twinCos: 0.97,
};
/** Короткая история (23.10, опыт shortHistory; .cache/eval/cold-start-2310.md): при minCommon 8 и minRated 20 у человека
 *  с < 20 оценками соседей нет вовсе, а на 5–20 оценках лучше всего minCommon 2–3 (AUC 0,66–0,73 против 0,62 у «что смотрят
 *  все»). При n < `below` — свои пороги. Флага модуль не знает (без импортов — см. выше): его проверяет вызывающий. */
export const NEIGHBOR_SHORT = { below: 40, minCommon: 3, minRated: 5 };
/** Пороги соседей для человека с `rated` оценками: `short` — опыт shortHistory включён у вызывающего. Без него — прежние. */
export function neighborGate(rated: number, short: boolean): { minRated: number; minCommon: number } {
  return short && rated < NEIGHBOR_SHORT.below
    ? { minRated: NEIGHBOR_SHORT.minRated, minCommon: NEIGHBOR_SHORT.minCommon }
    : { minRated: NEIGHBOR.minRated, minCommon: NEIGHBOR.minCommon };
}
/** вес в счёте ленты (счёт около 0…1, итог соседей — около −1…1), как CONSENSUS_WEIGHT; замер подбирает его сам */
export const NEIGHBOR_WEIGHT = { value: 0.3 };
export interface NeighborOpts { k?: number; minCommon?: number; shrink?: number; minSupport?: number }

/** одна оценка человека: ключи фильма и оценка в 10-балльной шкале */
export interface Rated { keys: string[]; raw: number }
/** один фильм человека в его шкале */
export interface FilmZ { keys: string[]; z: number }

/** Оценка из базы приложения в 10-балльной шкале: исходная из импорта (Кинопоиск, Letterboxd — 1…10), иначе 1–5 → 1,5…9,5
 *  (в историях 5 ↔ 9–10, 4 ↔ 7–8). Иначе у человека с импортом и ручными оценками смешались бы две шкалы. */
export const rawOf = (rating: number, raw?: number | null): number => (raw != null && raw > 0 ? raw : rating * 2 - 0.5);

/** Ключи записи по карточке, иначе по id записи (`tmdb:…`, `l-tmdbtv…`, `imdb:tt…`) — как tools/consensus-data.mts. */
export function keysOfRating(workId: string, card?: { type?: string | null; externalIds?: { tmdb?: number | string | null; imdb?: string | null } }): string[] {
  const type = card?.type ?? (/^l-tmdbtv|^tmdbtv:/.test(workId) ? 'series' : 'film');
  const t = card?.externalIds?.tmdb;
  const ids: { tmdb?: number; imdb?: string } = {};
  if (t != null && /^\d{1,12}$/.test(String(t))) ids.tmdb = Number(t);
  const im = card?.externalIds?.imdb;
  if (typeof im === 'string' && /^tt\d{3,12}$/.test(im)) ids.imdb = im;
  const m = /^(?:l-)?tmdb(tv)?:?(\d+)$/.exec(workId);
  if (ids.tmdb == null && m) ids.tmdb = Number(m[2]);
  const i = /^imdb:(tt\d+)$/.exec(workId);
  if (!ids.imdb && i) ids.imdb = i[1];
  return filmKeys(type, ids);
}

/** z-оценки человека по фильмам: одна оценка на фильм (повтор по любому ключу — мимо, первая главнее); разброс ноль — нули */
export function personZ(list: readonly Rated[]): FilmZ[] {
  const seen = new Set<string>();
  const films: Rated[] = [];
  for (const r of list) {
    if (!r.keys.length || !Number.isFinite(r.raw) || r.keys.some((k) => seen.has(k))) continue;
    r.keys.forEach((k) => seen.add(k));
    films.push(r);
  }
  if (!films.length) return [];
  const m = films.reduce((a, r) => a + r.raw, 0) / films.length;
  const sd = Math.sqrt(films.reduce((a, r) => a + (r.raw - m) ** 2, 0) / films.length) || 1;
  return films.map((r) => ({ keys: r.keys, z: (r.raw - m) / sd }));
}

export interface Person { id: string; group: number; z: Map<number, number> }
export interface Pool { keyFilm: Map<string, number>; filmKeys: string[][]; people: Person[] }

/** Набор соседей: фильмы — номерами (ключи сведены по любому общему), люди — z по номерам фильмов, двойники — одной группой.
 *  Двойники ищутся парами по всем (P² × фильмы): на 200 людях по ~700 фильмов — доли секунды, сервер собирает раз в полчаса. */
export function buildPool(people: readonly { id: string; films: readonly FilmZ[] }[]): Pool {
  // ключи одного фильма — в одно множество
  const parent = new Map<string, string>();
  const find = (k: string): string => { let r = k; while (parent.get(r) !== r) r = parent.get(r)!; let x = k; while (x !== r) { const n = parent.get(x)!; parent.set(x, r); x = n; } return r; };
  for (const p of people) for (const f of p.films) {
    for (const k of f.keys) if (!parent.has(k)) parent.set(k, k);
    for (const k of f.keys.slice(1)) { const a = find(f.keys[0]), b = find(k); if (a !== b) parent.set(b, a); }
  }
  const keyFilm = new Map<string, number>();
  const filmKeys: string[][] = [];
  const rootFilm = new Map<string, number>();
  for (const k of parent.keys()) {
    const r = find(k);
    let i = rootFilm.get(r);
    if (i == null) { i = filmKeys.length; rootFilm.set(r, i); filmKeys.push([]); }
    filmKeys[i].push(k);
    keyFilm.set(k, i);
  }
  const list: Person[] = people.map((p, i) => {
    const z = new Map<number, number>();
    for (const f of p.films) { const film = keyFilm.get(f.keys[0])!; if (!z.has(film)) z.set(film, f.z); }
    return { id: p.id, group: i, z };
  });
  // двойники — в группу первого из них
  const g = list.map((_, i) => i);
  const root = (i: number): number => { while (g[i] !== i) i = g[i] = g[g[i]]; return i; };
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    if (twins(list[i].z, list[j].z)) { const a = root(i), b = root(j); if (a !== b) g[Math.max(a, b)] = Math.min(a, b); }
  }
  list.forEach((p, i) => { p.group = root(i); });
  return { keyFilm, filmKeys, people: list };
}

/** косинус на общих и их число */
function overlap(a: Map<number, number>, b: Map<number, number>): { n: number; cos: number } {
  const [s, l] = a.size <= b.size ? [a, b] : [b, a];
  let dot = 0, x = 0, y = 0, n = 0;
  for (const [k, za] of s) { const zb = l.get(k); if (zb == null) continue; dot += za * zb; x += za * za; y += zb * zb; n++; }
  return { n, cos: x && y ? dot / Math.sqrt(x * y) : 0 };
}
/** двойник — та же история под другой записью (пороги — NEIGHBOR.twinShare/twinCos); EASE на сервере вынимает и его */
export function twins(a: Map<number, number>, b: Map<number, number>, o = overlap(a, b)): boolean {
  return o.n >= NEIGHBOR.minCommon && o.n >= NEIGHBOR.twinShare * Math.min(a.size, b.size) && o.cos >= NEIGHBOR.twinCos;
}

/** z человека — номерами фильмов набора (фильмов, которых в наборе нет, ни с кем не общих, — мимо) */
export function mineIn(pool: Pool, films: readonly FilmZ[]): Map<number, number> {
  const out = new Map<number, number>();
  for (const f of films) for (const k of f.keys) { const i = pool.keyFilm.get(k); if (i != null) { if (!out.has(i)) out.set(i, f.z); break; } }
  return out;
}

/** Счёт соседей: номер фильма → «как оценили бы соседи» (около −1…1), только фильмы с `minSupport` соседями и больше.
 *  `skip` — кого не брать (сам спрашивающий по id; замер — тот же человек под другими историями). */
export function neighborScores(pool: Pool, mine: Map<number, number>, opts: NeighborOpts & { skip?: (p: Person) => boolean } = {}):
  { scores: Map<number, number>; neighbors: number } {
  const k = opts.k ?? NEIGHBOR.k, minCommon = opts.minCommon ?? NEIGHBOR.minCommon, shrink = opts.shrink ?? NEIGHBOR.shrink;
  const minSupport = opts.minSupport ?? NEIGHBOR.minSupport;
  const sims: { p: Person; sim: number }[] = [];
  for (const p of pool.people) {
    if (opts.skip?.(p)) continue;
    // как в замере: косинус по общим, нормы — тоже по общим
    const o = overlap(mine, p.z);
    if (o.n < minCommon || o.cos <= 0) continue;
    if (twins(mine, p.z, o)) continue; // он же сам, под другой записью
    sims.push({ p, sim: o.cos * (o.n / (o.n + shrink)) });
  }
  sims.sort((a, b) => b.sim - a.sim || a.p.id.localeCompare(b.p.id));
  const groups = new Set<number>();
  const chosen: typeof sims = [];
  for (const s of sims) {
    if (chosen.length >= k) break;
    if (groups.has(s.p.group)) continue;
    groups.add(s.p.group);
    chosen.push(s);
  }
  const num = new Map<number, number>(), den = new Map<number, number>(), cnt = new Map<number, number>();
  for (const { p, sim } of chosen) for (const [f, z] of p.z) {
    num.set(f, (num.get(f) ?? 0) + sim * z); den.set(f, (den.get(f) ?? 0) + sim); cnt.set(f, (cnt.get(f) ?? 0) + 1);
  }
  const scores = new Map<number, number>();
  for (const [f, c] of cnt) if (c >= minSupport) scores.set(f, num.get(f)! / (den.get(f)! + 1));
  return { scores, neighbors: chosen.length };
}

/** Итог для клиента: ключ фильма → счёт (2 знака), без уже оценённого человеком. Ключ — один на фильм: TMDb (у сериала
 *  `tmdbtv:`), нет его — IMDb; клиент ищет по consensusOf (src/lib/model/consensus.ts), он пробует все ключи карточки.
 *  `limit` — самые заметные по модулю: остальные около нуля, их отсутствие и есть «как обычно». */
export function toTable(pool: Pool, scores: Map<number, number>, { exclude, limit = 6000 }: { exclude?: Set<number>; limit?: number } = {}): Record<string, number> {
  const list = [...scores].filter(([f, v]) => !exclude?.has(f) && Math.round(v * 100) !== 0)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]) || a[0] - b[0]).slice(0, limit);
  const out: Record<string, number> = {};
  for (const [f, v] of list) {
    const keys = pool.filmKeys[f];
    const key = keys.find((x) => x.startsWith('tmdb:') || x.startsWith('tmdbtv:')) ?? keys.find((x) => x.startsWith('imdb:')) ?? keys[0];
    out[key] = Math.round(v * 100) / 100;
  }
  return out;
}

// ─── файл опорных историй (tools/neighbor-anchors.mts → сервер, путь из окружения) ──────────────────────────────────
// Решение владельца 23.10: обезличенные z-оценки опорных историй на сервере держать можно. Без имён: люди — под
// случайными id, фильмы — таблицей ключей, у человека — пары [номер фильма, z × 100].
export interface AnchorFile { v: 1; at: string; films: string[][]; people: { id: string; r: number[] }[] }

export function anchorFileOf(people: readonly { films: readonly FilmZ[] }[], idOf: () => string, at = new Date().toISOString()): AnchorFile {
  const pool = buildPool(people.map((p, i) => ({ id: String(i), films: p.films })));
  return { v: 1, at, films: pool.filmKeys, people: pool.people.map((p) => ({ id: idOf(), r: [...p.z].flatMap(([f, z]) => [f, Math.round(z * 100)]) })) };
}

const KEY = /^(?:tmdb|tmdbtv|imdb):[A-Za-z0-9]{1,24}$/;
/** Файл → люди для buildPool; кривой файл — пусто (сервер живёт без опорных, на участниках приложения). */
export function anchorsFrom(text: string | null | undefined): { id: string; films: FilmZ[] }[] {
  if (!text) return [];
  let f: AnchorFile;
  try { f = JSON.parse(text) as AnchorFile; } catch { return []; }
  if (!f || f.v !== 1 || !Array.isArray(f.films) || !Array.isArray(f.people)) return [];
  const films = f.films.map((keys) => (Array.isArray(keys) ? keys.filter((k): k is string => typeof k === 'string' && KEY.test(k)) : []));
  const out: { id: string; films: FilmZ[] }[] = [];
  for (const p of f.people) {
    if (!p || typeof p.id !== 'string' || !Array.isArray(p.r)) continue;
    const list: FilmZ[] = [];
    for (let i = 0; i + 1 < p.r.length; i += 2) {
      const keys = films[p.r[i]], z = p.r[i + 1];
      if (keys?.length && typeof z === 'number' && Number.isFinite(z)) list.push({ keys, z: z / 100 });
    }
    if (list.length) out.push({ id: `a:${p.id}`, films: list });
  }
  return out;
}
