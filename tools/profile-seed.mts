// Профиль зрителя с открытого кино-сервиса (09.10) — то же, что импорт Кинопоиска, но без ручного сохранения
// страниц: у Letterboxd и Trakt история открыта сама. Для каналов, чей автор оставил ссылку на профиль
// (поиск шлюза по letterboxd.com / trakt.tv/users), и для участников, которые придут с этих сервисов.
//   letterboxd:<ник> — лента https://letterboxd.com/<ник>/rss/: последние 100 записей дневника; звёзды 0.5–5
//                      → raw 1–10 (как десятибалльная Кинопоиска), без звёзд — «видел»; повторный просмотр — тот же фильм;
//   letterboxd-zip:<путь> — выгрузка, которую автор пришлёт сам (Settings → Data → Export your data): ratings.csv
//                      (звёзды) и watched.csv — вся история, а не сотня записей; TMDb ID в ней нет — ищем по названию
//                      и году. Нужна, когда дневник пуст: многие отмечают фильмы без дат, а лента RSS — только дневник;
//                      страницы /films/ Letterboxd скриптам не отдаёт (Cloudflare, 403);
//   trakt:<ник>      — API (TRAKT_CLIENT_ID в .env.local): /ratings/movies (1–10) и /watched/movies (вся история).
// Фильм находится по TMDb ID: сначала в справочнике (ключ `tmdb:<id>`), иначе — по IMDb, иначе карточка из TMDb
// (`l-tmdb<id>`, без разметки: модель её не знает, но в подбор она уже не попадёт). Оценка 1–5 — round(raw/2),
// raw хранится: норму шкалы модель выводит сама (deriveScale).
// Выход — seeds/<сервис>-<ник>.json (UserSeed); дальше tools/seed-slate.mts и, с согласия автора, publish-seed.
//   npx tsx tools/profile-seed.mts letterboxd:davidehrlich trakt:<ник>
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { loadEnvFile } from './env-file.mts';
import { worksIndex } from './works-index.mts';
import { tmdbFromEnv } from '../src/lib/resolve/index.ts';
import type { WorkCard } from '../src/types/tmdf.ts';
import type { UserSeed } from '../worker/env.ts';

loadEnvFile();
const tmdb = tmdbFromEnv(process.env.TMDB_API_KEY || process.env.VITE_TMDB_API_KEY);
const args = process.argv.slice(2);
if (!args.length || args.some((a) => !/^((letterboxd|trakt):[\w.-]+|letterboxd-zip:.+)$/.test(a))) {
  console.error('чей профиль? npx tsx tools/profile-seed.mts letterboxd:<ник> letterboxd-zip:<файл.zip> trakt:<ник>');
  process.exit(2);
}

const index = worksIndex({ all: true });
const byKey = new Map(index.map((w) => [w.key, w.work]));
const byImdb = new Map(index.filter((w) => w.work.externalIds?.imdb).map((w) => [w.work.externalIds!.imdb!, w.work]));

/** запись сервиса: что за фильм и что о нём сказал зритель (raw 1–10; нет — только видел) */
interface Entry { title: string; year?: number; tmdb?: number; imdb?: string; raw?: number }

const blank = { primaryOperations: [], complexityLevel: 0, warnings: [], barriers: [], isNicheMasterpiece: false };

async function resolve(e: Entry): Promise<{ work: WorkCard; via: string } | undefined> {
  if (!e.tmdb && !e.imdb && tmdb) {
    // выгрузка Letterboxd: только название и год (год TMDb иногда на единицу расходится)
    for (const y of [e.year, e.year ? e.year - 1 : undefined, e.year ? e.year + 1 : undefined]) {
      const hit = await tmdb.search(e.title, y).catch(() => undefined);
      if (hit) { e.tmdb = hit.id; e.imdb = hit.imdb; break; }
    }
  }
  const local = (e.tmdb && byKey.get(`tmdb:${e.tmdb}`)) || (e.imdb && byImdb.get(e.imdb));
  if (local) return { work: local, via: 'справочник' };
  if (!tmdb || !e.tmdb) return undefined;
  const t = await tmdb.movie(e.tmdb).catch(() => undefined);
  if (!t?.title) return undefined;
  return {
    via: 'TMDb',
    work: {
      id: `l-tmdb${e.tmdb}`, type: 'film', title: t.title, originalTitle: t.originalTitle, year: t.year ?? e.year ?? 0,
      creators: t.creators ?? [], countries: t.countries, coverUrl: t.coverUrl, stillUrl: t.stillUrl, imageSource: t.imageSource,
      blurb: t.blurb, durationMinutes: t.durationMinutes, ...blank, externalIds: { tmdb: e.tmdb, ...(e.imdb ? { imdb: e.imdb } : {}) },
    },
  };
}

const tag = (xml: string, name: string) => {
  const m = new RegExp(`<${name}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${name}>`).exec(xml);
  return m?.[1].trim();
};

/** дневник Letterboxd: новые записи сверху, поэтому оценка фильма — самая свежая */
async function letterboxd(user: string): Promise<Entry[]> {
  const res = await fetch(`https://letterboxd.com/${user}/rss/`, { headers: { 'user-agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`letterboxd ${user}: HTTP ${res.status}`);
  const xml = await res.text();
  const out: Entry[] = [];
  for (const [, item] of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const id = Number(tag(item, 'tmdb:movieId'));
    const title = tag(item, 'letterboxd:filmTitle');
    if (!id || !title) continue; // списки и прочие записи — без фильма
    const stars = Number(tag(item, 'letterboxd:memberRating'));
    out.push({ title, year: Number(tag(item, 'letterboxd:filmYear')) || undefined, tmdb: id, ...(stars ? { raw: Math.round(stars * 2) } : {}) });
  }
  return out;
}

/** CSV выгрузки Letterboxd: Date,Name,Year,Letterboxd URI[,Rating]; названия с запятой — в кавычках */
function csv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) { if (ch === '"' && text[i + 1] === '"') { cell += '"'; i += 1; } else if (ch === '"') quoted = false; else cell += ch; }
    else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell || row.length) rows.push([...row, cell]);
  const [head, ...body] = rows;
  return body.filter((r) => r.length > 1).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}

async function letterboxdZip(path: string): Promise<{ user: string; entries: Entry[] }> {
  const read = (name: string) => { try { return execFileSync('unzip', ['-p', path, name], { encoding: 'utf8', maxBuffer: 64 << 20 }); } catch { return ''; } };
  const user = csv(read('profile.csv'))[0]?.Username || path.replace(/^.*\//, '').replace(/^letterboxd-|-\d{4}-.*$|\.zip$/g, '');
  const entry = (r: Record<string, string>, raw?: number): Entry => ({ title: r.Name, year: Number(r.Year) || undefined, ...(raw ? { raw } : {}) });
  const rated = csv(read('ratings.csv')).map((r) => entry(r, Math.round(Number(r.Rating) * 2)));
  if (!rated.length && !read('watched.csv')) throw new Error(`в ${path} нет ratings.csv / watched.csv — это выгрузка Letterboxd?`);
  return { user, entries: [...rated, ...csv(read('watched.csv')).map((r) => entry(r))] };
}

async function trakt(user: string): Promise<Entry[]> {
  const key = process.env.TRAKT_CLIENT_ID;
  if (!key) throw new Error('нет TRAKT_CLIENT_ID в .env.local');
  type Movie = { title: string; year?: number; ids: { tmdb?: number; imdb?: string } };
  const get = async <T,>(path: string): Promise<T> => {
    const res = await fetch(`https://api.trakt.tv/users/${user}/${path}`, {
      headers: { 'user-agent': 'recomend/1.0', 'content-type': 'application/json', 'trakt-api-version': '2', 'trakt-api-key': key },
    });
    // без своего user-agent Cloudflare перед API отвечает 403 и на открытые профили
    if (!res.ok) throw new Error(`trakt ${user}/${path}: HTTP ${res.status}${res.status === 401 || res.status === 403 ? ' (профиль закрыт)' : ''}`);
    return res.json() as Promise<T>;
  };
  const rated = await get<{ rating: number; movie: Movie }[]>('ratings/movies');
  const watched = await get<{ movie: Movie }[]>('watched/movies');
  const entry = (m: Movie, raw?: number): Entry => ({ title: m.title, year: m.year, tmdb: m.ids.tmdb, imdb: m.ids.imdb, ...(raw ? { raw } : {}) });
  return [...rated.map((r) => entry(r.movie, r.rating)), ...watched.map((w) => entry(w.movie))];
}

for (const arg of args) {
  const [kind, rest] = [arg.slice(0, arg.indexOf(':')), arg.slice(arg.indexOf(':') + 1)];
  const service = kind === 'trakt' ? 'trakt' : 'letterboxd';
  let user = rest;
  let entries: Entry[];
  try {
    if (kind === 'letterboxd-zip') ({ user, entries } = await letterboxdZip(rest));
    else entries = kind === 'letterboxd' ? await letterboxd(user) : await trakt(user);
  } catch (err) { console.error(`✗ ${arg}: ${(err as Error).message}`); continue; }
  console.error(`\n${arg}: записей ${entries.length}, с оценкой ${entries.filter((e) => e.raw).length}`);
  if (!entries.length && kind === 'letterboxd') {
    console.error('  дневник пуст: фильмы отмечены без дат, а RSS отдаёт только дневник — попросить выгрузку (Settings → Data → Export your data) и запустить letterboxd-zip:<файл>');
    continue;
  }

  const watched: UserSeed['watched'] = [];
  const ratings: NonNullable<UserSeed['ratings']> = [];
  const unmatched: string[] = [];
  const seen = new Set<string>();
  const counts = { справочник: 0, TMDb: 0 } as Record<string, number>;
  for (const e of entries) {
    const r = await resolve(e);
    if (!r) { unmatched.push(`${e.title} (${e.year ?? '?'})`); continue; }
    if (seen.has(r.work.id)) continue; // повторный просмотр или «видел» после оценки
    seen.add(r.work.id);
    counts[r.via] += 1;
    const ids = { ...(r.work.externalIds?.tmdb ? { tmdb: r.work.externalIds.tmdb } : {}), ...(r.work.externalIds?.imdb ? { imdb: r.work.externalIds.imdb } : {}) };
    watched.push({ workId: r.work.id, work: r.work, ...ids });
    if (e.raw) ratings.push({ workId: r.work.id, rating: Math.min(5, Math.max(1, Math.round(e.raw / 2))), raw: e.raw, work: r.work });
  }

  const body = { watched, ratings };
  const version = createHash('sha1').update(JSON.stringify(body)).digest('hex').slice(0, 12);
  mkdirSync('seeds', { recursive: true });
  const name = `${service}-${user.toLowerCase()}`;
  const out = `seeds/${name}.json`;
  writeFileSync(out, JSON.stringify({ username: name, version, ...body, unmatched, source: { service, user, ...(kind === 'letterboxd-zip' ? { export: true } : {}) }, resolvedAt: new Date().toISOString() }, null, 2));
  const raws = ratings.map((x) => x.raw!).sort((a, b) => a - b);
  console.error(`→ ${out}: видел ${watched.length} (справочник ${counts['справочник']}, TMDb ${counts.TMDb}), с оценкой ${ratings.length}, не нашлось ${unmatched.length}`);
  if (raws.length) console.error(`  оценки 1…10: медиана ${raws[Math.floor(raws.length / 2)]}`);
}
