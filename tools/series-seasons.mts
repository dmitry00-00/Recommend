// Сезоны сериалов (ЗП-17, 07.10): какой сезон вышел последним и когда, что анонсировано. Сервер по этому
// справочнику пишет в утренней сводке «Вышел 3 сезон» тем, кто досмотрел прежние или следит за сериалом
// (worker/seasons.ts), приложение — помечает в дневнике.
//   npx tsx tools/series-seasons.mts [--limit 3000] [--dry]
// Сериалы — все карточки справочника с типом series и ключом IMDb (справочники фильмов, seriesBase, история
// владельца). TMDb: /find по IMDb → номер сериала (навсегда в кэше), /tv/{id} → сезоны с датами выхода.
// Кэш — .cache/series-seasons/raw.json: закончившийся сериал перепроверяется раз в 30 дней, идущий — каждые
// сутки, неизвестный — раз в неделю. Итог — .cache/series-seasons.json: `imdb:tt…` → { n, at, total, next?, end? }.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { loadEnvFile } from './env-file.mts';
import { filmBasePopular } from '../src/mocks/filmBasePopular.ts';
import { filmBaseWorld } from '../src/mocks/filmBaseWorld.ts';
import { filmBaseMarkup } from '../src/mocks/filmBaseMarkup.ts';
import { seriesBase } from '../src/mocks/seriesBase.ts';
import { userWorks } from '../src/mocks/userHistory.ts';
import { externalIds } from '../src/mocks/externalIds.ts';

loadEnvFile();
const argv = process.argv.slice(2);
const LIMIT = Number(argv[argv.indexOf('--limit') + 1]) || 3000;
const DRY = argv.includes('--dry');
const key = process.env.TMDB_API_KEY ?? process.env.VITE_TMDB_API_KEY;
if (!key) { console.error('нужен TMDB_API_KEY (или VITE_TMDB_API_KEY) в .env.local'); process.exit(2); }

const DIR = '.cache/series-seasons';
const RAW = `${DIR}/raw.json`;
const SEASONS_FILE = '.cache/series-seasons.json';
mkdirSync(DIR, { recursive: true });

interface Raw { tv?: number | null; at: string; status?: string; total?: number; seasons?: [number, string][]; next?: [number, string] }
/** Сезон в справочнике: n — последний вышедший, at — дата его выхода, total — всего по TMDb, next — анонс, end — закончен. */
interface SeasonInfo { n: number; at: string; total?: number; next?: { n: number; at: string }; end?: true }

const raw: Record<string, Raw> = existsSync(RAW) ? JSON.parse(readFileSync(RAW, 'utf8')) : {};
const day = 86400e3;
const today = new Date().toISOString().slice(0, 10);

const get = async <T,>(path: string, extra: Record<string, string> = {}): Promise<T | undefined> => {
  const bearer = key.includes('.');
  const qs = new URLSearchParams({ ...extra, ...(bearer ? {} : { api_key: key }) });
  for (let a = 0; a < 3; a++) {
    const r = await fetch(`https://api.themoviedb.org/3/${path}?${qs}`, bearer ? { headers: { Authorization: `Bearer ${key}` } } : undefined).catch(() => undefined);
    if (r?.ok) return await r.json() as T;
    if (r?.status === 404) return undefined;
    await new Promise((res) => setTimeout(res, 1000 * (a + 1)));
  }
  throw new Error(`tmdb ${path}: нет ответа`);
};

// ─── какие сериалы ────────────────────────────────────────────────────────────
const imdbs = new Set<string>();
for (const w of [...filmBasePopular, ...filmBaseWorld, ...filmBaseMarkup, ...seriesBase, ...userWorks]) {
  if (w.type !== 'series') continue;
  const imdb = (w.externalIds ?? externalIds[w.id])?.imdb;
  if (imdb && /^tt\d+$/.test(imdb)) imdbs.add(imdb);
}

const stale = (r: Raw | undefined) => {
  if (!r) return true;
  const age = Date.now() - Date.parse(r.at);
  if (r.tv === null) return age > 30 * day;   // TMDb не знает такого сериала
  if (r.status === 'Ended' || r.status === 'Canceled') return age > 30 * day;
  if (r.status === 'Returning Series' || r.status === 'In Production' || r.status === 'Planned') return age > 20 * 3600e3;
  return age > 7 * day;
};
const todo = [...imdbs].filter((id) => stale(raw[id])).slice(0, LIMIT);
console.error(`сериалов с IMDb: ${imdbs.size}, к запросу: ${todo.length}`);

interface Tv { status?: string; number_of_seasons?: number; seasons?: { season_number: number; air_date?: string | null }[]; next_episode_to_air?: { season_number: number; episode_number: number; air_date?: string } | null }
let asked = 0, failed = 0;
const save = () => { if (!DRY) writeFileSync(RAW, JSON.stringify(raw)); };
for (const imdb of todo) {
  try {
    let tv = raw[imdb]?.tv;
    if (tv === undefined) {
      const f = await get<{ tv_results?: { id: number }[] }>(`find/${imdb}`, { external_source: 'imdb_id' });
      tv = f?.tv_results?.[0]?.id ?? null;
    }
    if (tv === null) { raw[imdb] = { tv: null, at: new Date().toISOString() }; continue; }
    const t = await get<Tv>(`tv/${tv}`);
    asked += 1;
    if (!t) { raw[imdb] = { tv: null, at: new Date().toISOString() }; continue; }
    const seasons = (t.seasons ?? []).filter((s) => s.season_number > 0 && s.air_date).map((s) => [s.season_number, s.air_date!] as [number, string]);
    const n = t.next_episode_to_air;
    raw[imdb] = {
      tv, at: new Date().toISOString(), ...(t.status ? { status: t.status } : {}), ...(t.number_of_seasons ? { total: t.number_of_seasons } : {}),
      seasons, ...(n?.episode_number === 1 && n.air_date ? { next: [n.season_number, n.air_date] as [number, string] } : {}),
    };
  } catch (e) { failed += 1; console.error(`  ${imdb}: ${(e as Error).message}`); if (failed > 20) break; }
  if (asked % 100 === 0) save();
}
save();

// ─── справочник ───────────────────────────────────────────────────────────────
function seasonInfo(r: Raw | undefined, now = today): SeasonInfo | undefined {
  if (!r?.seasons?.length) return undefined;
  const aired = r.seasons.filter(([, at]) => at <= now).sort((a, b) => a[0] - b[0]);
  const last = aired.at(-1);
  if (!last) return undefined;
  const ahead = r.seasons.filter(([n, at]) => at > now && n > last[0]).sort((a, b) => a[0] - b[0])[0] ?? (r.next && r.next[1] > now ? r.next : undefined);
  return {
    n: last[0], at: last[1], ...(r.total ? { total: r.total } : {}),
    ...(ahead ? { next: { n: ahead[0], at: ahead[1] } } : {}),
    ...(r.status === 'Ended' || r.status === 'Canceled' ? { end: true as const } : {}),
  };
}
const out: Record<string, SeasonInfo> = {};
for (const imdb of imdbs) { const s = seasonInfo(raw[imdb]); if (s) out[`imdb:${imdb}`] = s; }
const fresh = Object.entries(out).filter(([, s]) => Date.now() - Date.parse(s.at) < 30 * day);
console.log(`сезоны: запрошено ${asked}, ошибок ${failed}; в справочнике ${Object.keys(out).length} сериалов, новый сезон за 30 дней — у ${fresh.length}, анонс — у ${Object.values(out).filter((s) => s.next).length}`);
if (!DRY) writeFileSync(SEASONS_FILE, JSON.stringify(out));
