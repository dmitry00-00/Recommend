// Где смотреть по подписке (ЗП-42, 10.10): площадки TMDb (данные JustWatch) по регионам — подписка, бесплатно,
// с рекламой, аренда, покупка. Приложение по этому справочнику ставит в ленте вперёд доступное без доплаты,
// фильтрует ленту по подпискам участника и пишет у карточки «есть в вашей подписке».
//   npx tsx tools/watch-providers.mts [--regions RU,KZ] [--limit 6000] [--dry]
// Фильмы — карточки справочников и каталога с ключом TMDb; сериалы (11.10) — по номеру /tv/, который нашёл
// tools/series-seasons.mts (.cache/series-seasons/raw.json, IMDb → TMDb): в справочнике они под ключом `imdb:tt…`.
// TMDb бесплатно, пока у приложения нет дохода; с первым доходом — коммерческая лицензия (ЗП-24); у каждого
// произведения — подпись «по данным JustWatch». Кэш — .cache/watch-providers/raw.json, перепроверка раз в 14 дней.
// Итог — .cache/watch-providers.json (`WatchProviders`, src/lib/cinemas.ts), публикует tools/publish-reference.mts.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { loadEnvFile } from './env-file.mts';
import { worksIndex } from './works-index.mts';
import { cinemaSlug, type RegionWatch, type WatchProviders } from '../src/lib/cinemas.ts';

loadEnvFile();
const argv = process.argv.slice(2);
const arg = (k: string) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
const REGIONS = (arg('--regions') ?? 'RU').split(',').map((r) => r.trim().toUpperCase()).filter(Boolean);
const LIMIT = Number(arg('--limit')) || 6000;
const DRY = argv.includes('--dry');
const key = process.env.TMDB_API_KEY ?? process.env.VITE_TMDB_API_KEY;
if (!key) { console.error('нужен TMDB_API_KEY (или VITE_TMDB_API_KEY) в .env.local'); process.exit(2); }

const DIR = '.cache/watch-providers';
const RAW = `${DIR}/raw.json`;
const OUT = '.cache/watch-providers.json';
mkdirSync(DIR, { recursive: true });

type Provider = { provider_name: string };
type TmdbRegion = { link?: string; flatrate?: Provider[]; free?: Provider[]; ads?: Provider[]; rent?: Provider[]; buy?: Provider[] };
/** Ответ TMDb по всем регионам, урезанный до имён: регионы потом можно добавить без новых запросов. */
interface Raw { at: string; r?: Record<string, { l?: string; s?: string[]; f?: string[]; a?: string[]; r?: string[]; b?: string[] }> }

const raw: Record<string, Raw> = existsSync(RAW) ? JSON.parse(readFileSync(RAW, 'utf8')) : {};
const day = 86400e3;

const get = async <T,>(path: string): Promise<T | undefined> => {
  const bearer = key.includes('.');
  const qs = bearer ? '' : `?api_key=${key}`;
  for (let a = 0; a < 3; a++) {
    const r = await fetch(`https://api.themoviedb.org/3/${path}${qs}`, bearer ? { headers: { Authorization: `Bearer ${key}` } } : undefined).catch(() => undefined);
    if (r?.ok) return await r.json() as T;
    if (r?.status === 404) return undefined;
    await new Promise((res) => setTimeout(res, 1000 * (a + 1)));
  }
  throw new Error(`tmdb ${path}: нет ответа`);
};

// ─── какие фильмы ─────────────────────────────────────────────────────────────
const films = new Set<number>();
for (const w of worksIndex({ all: true })) {
  if (w.work.type !== 'film' || !w.key.startsWith('tmdb:')) continue;
  const id = Number(w.key.slice(5));
  if (Number.isInteger(id) && id > 0) films.add(id);
}
// сериалы: IMDb → номер TMDb из кэша сезонов; в сырых ответах — под `tv:<номер>`, чтобы не спутать с фильмом
const seasonsRaw: Record<string, { tv?: number | null }> = existsSync('.cache/series-seasons/raw.json') ? JSON.parse(readFileSync('.cache/series-seasons/raw.json', 'utf8')) : {};
const series = new Map<string, number>();
for (const w of worksIndex({ all: true })) {
  if (w.work.type !== 'series' || !w.key.startsWith('imdb:')) continue;
  const tv = seasonsRaw[w.key.slice(5)]?.tv;
  if (tv) series.set(w.key, tv);
}
const stale = (r: Raw | undefined) => !r || Date.now() - Date.parse(r.at) > 14 * day;
// сериалы — первыми: подписку в Okko и Кинопоиске берут чаще ради них, а их всего две тысячи
const todo = [...[...new Set(series.values())].map((tv) => `tv:${tv}`), ...[...films].map((id) => String(id))].filter((id) => stale(raw[id])).slice(0, LIMIT);
console.error(`фильмов с TMDb: ${films.size}, сериалов: ${series.size}, к запросу: ${todo.length}`);

// ─── запросы: по шесть сразу, у TMDb потолок около 40 в секунду ──────────────
const names = (list?: Provider[]) => (list?.length ? list.map((p) => p.provider_name) : undefined);
let asked = 0, failed = 0;
const save = () => { if (!DRY) writeFileSync(RAW, JSON.stringify(raw)); };
const queue = [...todo];
await Promise.all(Array.from({ length: 6 }, async () => {
  for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
    if (failed > 20) return;
    try {
      const p = await get<{ results?: Record<string, TmdbRegion> }>(id.startsWith('tv:') ? `tv/${id.slice(3)}/watch/providers` : `movie/${id}/watch/providers`);
      const r: Raw['r'] = {};
      for (const [region, x] of Object.entries(p?.results ?? {})) {
        const e = { l: x.link, s: names(x.flatrate), f: names(x.free), a: names(x.ads), r: names(x.rent), b: names(x.buy) };
        r[region] = Object.fromEntries(Object.entries(e).filter(([, v]) => v !== undefined));
      }
      raw[id] = { at: new Date().toISOString(), ...(Object.keys(r).length ? { r } : {}) };
      asked += 1;
      if (asked % 200 === 0) { save(); console.error(`  ${asked}/${todo.length}`); }
    } catch (e) { failed += 1; console.error(`  ${id}: ${(e as Error).message}`); }
  }
}));
save();

// ─── справочник ───────────────────────────────────────────────────────────────
const out: WatchProviders = { at: new Date().toISOString(), names: {}, works: {} };
const count = new Map<string, number>();
const slugs = (list?: string[]) => {
  if (!list?.length) return undefined;
  const s = [...new Set(list.map((n) => { const slug = cinemaSlug(n); out.names[slug] ??= n; return slug; }))];
  for (const x of s) count.set(x, (count.get(x) ?? 0) + 1);
  return s;
};
const entries: [string, string, string][] = [
  ...[...films].map((id): [string, string, string] => [`tmdb:${id}`, String(id), `movie/${id}`]),
  ...[...series].map(([k, tv]): [string, string, string] => [k, `tv:${tv}`, `tv/${tv}`]),
];
for (const [workKey, rawKey, page] of entries) {
  const r = raw[rawKey]?.r;
  if (!r) continue;
  const byRegion: Record<string, RegionWatch> = {};
  for (const region of REGIONS) {
    const x = r[region];
    if (!x) continue;
    // ссылка на страницу «где смотреть» есть почти всегда; у сериала без неё приложению не из чего её собрать
    const e: RegionWatch = { l: x.l ?? `https://www.themoviedb.org/${page}/watch?locale=${region}` };
    for (const k of ['s', 'f', 'a', 'r', 'b'] as const) { const v = slugs(x[k]); if (v) e[k] = v; }
    if (Object.keys(e).some((k) => k !== 'l')) byRegion[region] = e;
  }
  if (Object.keys(byRegion).length) out.works[workKey] = byRegion;
}
const n = Object.keys(out.works).length;
const subs = Object.values(out.works).filter((w) => REGIONS.some((g) => w[g]?.s?.length || w[g]?.f?.length || w[g]?.a?.length)).length;
const nSeries = Object.keys(out.works).filter((k) => k.startsWith('imdb:')).length;
console.log(`наличие: запрошено ${asked}, ошибок ${failed}; регионы ${REGIONS.join(', ')} — есть у ${n - nSeries} из ${films.size} фильмов и ${nSeries} из ${series.size} сериалов, без доплаты (подписка или бесплатно) — у ${subs}`);
console.log(`площадки: ${[...count].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([s, c]) => `${out.names[s]} ${c}`).join(', ')}`);
if (!DRY) writeFileSync(OUT, JSON.stringify(out));
