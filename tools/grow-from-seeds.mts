// Пополнение справочника тем, что смотрят люди из присланных историй (22.10): истории seeds/*.json (Кинопоиск, Letterboxd,
// Trakt, Telegram) несут два вида пробелов — карточки `l-…` (импорт опознал вещь в TMDb, а в справочнике её нет — у
// подбора нет ни кандидата, ни разметки) и строки `unmatched`/`unmatchedKinopoisk` (опознать не удалось). Что смотрят
// несколько человек сразу, то и заводим первым.
//
//   npx tsx tools/grow-from-seeds.mts [--min 2] [--top 30] [--no-search] [--write]
//
// 1. Свод: по каждой вещи — у скольких людей она есть и средняя оценка (1–5, как в истории). Человек — имя файла без
//    приставки сервиса: kp_x, letterboxd-x, tg-x, trakt-x и просто x — один человек. Книги (b-…) мимо. «Уже есть» — по
//    справочнику без истории владельца (tools/base-have.mts) и по номеру Кинопоиска его карточек: справочник мог
//    вырасти после импорта. Порядок — по числу людей, затем по средней оценке. Весь список — .cache/grow-from-seeds.json.
// 2. Ключи для вещей от --min людей: элемент Wikidata из карточки, номер Кинопоиска, TMDb (у фильма), IMDb. Сериалу `l-tmdbtv`
//    без элемента и IMDb элемент ищем по TMDb TV (P4983); строке без номера Кинопоиска — поиском TMDb по названию и году
//    (api_key в адресе: Bearer отвечает 401; без --no-search, кэш .cache/grow-from-seeds.tmdb.json). Сайт Кинопоиска не
//    трогаем. Ключи — в .cache/grow-from-seeds.keys.json.
// 3. Заводит сам сборщик справочника — его режим `--from file:` (tools/grow-film-base.mts): Wikidata, те же отсевы (аниме
//    вне канона, игры и трейлеры, порно, невышедшее, убранное владельцем), фильм без TMDb — с ключом `wd:`. Модуль —
//    ленивый filmBaseMore, как у ночного «вышедшего за 90 дней»: прежние карточки остаются. Без --write — только замер
//    (.cache/grow-from-seeds.report.json; ночной замер .cache/grow-film-base.json не трогаем). С --write карточки
//    пишутся в src/mocks/filmBaseMore.ts — только локально; на сервер их уносит обычная публикация справочника.
// Разметку новые карточки получают обычным заходом (tools/markup-wave.mts queue: берёт всё без разметки).
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { loadEnvFile } from './env-file.mts';
import { baseHave, baseWorks } from './base-have.mts';
import type { WorkCard } from '../src/types/tmdf.ts';

const argv = process.argv.slice(2);
const opt = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const MIN = Number(opt('--min') ?? 2);
const TOP = Number(opt('--top') ?? 30);
const WRITE = argv.includes('--write');
const SEARCH = !argv.includes('--no-search');
loadEnvFile();
const root = new URL('../', import.meta.url);
const at = (p: string) => new URL(p, root);
const UA = 'recomend/0.1 (https://github.com/dmitry00-00/Recommend)';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const readJson = <T,>(p: string, d: T): T => (existsSync(at(p)) ? JSON.parse(readFileSync(at(p), 'utf8')) as T : d);

// ── 1. свод по историям ───────────────────────────────────────────────────────
type Ids = { qid?: string; kp?: number; tmdb?: number; tmdbtv?: number; imdb?: string };
type Gap = Ids & { key: string; kind: 'l' | 'unmatched'; type: 'film' | 'series'; title: string; original?: string; year?: number;
  people: Set<string>; marks: Map<string, number[]>; files: Set<string> };
const person = (file: string) => file.replace(/\.json$/, '').replace(/^(kp_|letterboxd-|tg-|trakt-)/, '').toLowerCase();
const have = baseHave();
// номер Кинопоиска — у карточек из --from kinopoisk: строка «не опознано» могла с тех пор попасть в справочник
const haveKp = new Set<number>();
for (const { work } of baseWorks({ aliases: true })) if (work.externalIds?.kinopoisk) haveKp.add(work.externalIds.kinopoisk);
const inBase = (x: Ids, type: 'film' | 'series') => Boolean((x.qid && have.has(x.qid)) || (x.imdb && have.has(`imdb:${x.imdb}`))
  || (type === 'film' && x.tmdb && have.has(`tmdb:${x.tmdb}`)) || (x.kp && haveKp.has(x.kp)));

const gaps = new Map<string, Gap>();
let files = 0, already = 0;
const norm = (s: string) => s.normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
function add(g: Omit<Gap, 'people' | 'marks' | 'files'>, who: string, file: string, mark?: number) {
  const e = gaps.get(g.key) ?? { ...g, people: new Set(), marks: new Map(), files: new Set() };
  for (const k of ['qid', 'kp', 'tmdb', 'tmdbtv', 'imdb', 'original', 'year'] as const) if (e[k] == null && g[k] != null) (e as Record<string, unknown>)[k] = g[k];
  e.people.add(who); e.files.add(file);
  if (mark) e.marks.set(who, [...(e.marks.get(who) ?? []), mark]);
  gaps.set(g.key, e);
}
for (const file of readdirSync(at('seeds/')).filter((f) => f.endsWith('.json')).sort()) {
  const d = JSON.parse(readFileSync(at(`seeds/${file}`), 'utf8')) as { watched?: { workId: string; work?: WorkCard }[];
    ratings?: { workId: string; rating?: number; work?: WorkCard }[]; unmatched?: string[]; unmatchedKinopoisk?: string[] };
  files++;
  const who = person(file);
  const mark = new Map((d.ratings ?? []).map((r) => [r.workId, r.rating]));
  const cards = new Map<string, WorkCard>();
  for (const w of [...(d.watched ?? []), ...(d.ratings ?? [])]) if (w.work && !cards.has(w.workId)) cards.set(w.workId, w.work);
  for (const [id, w] of cards) {
    const m = /^l-(tmdbtv|tmdb)(\d+)$/.exec(id);
    if (!m) continue;
    // `l-tmdbtv` — сериал, даже если в ранних импортах Кинопоиска карточка числится фильмом (21.10)
    const type = m[1] === 'tmdbtv' ? 'series' : 'film';
    const x = w.externalIds ?? {};
    const ids: Ids = { qid: x.wikidata, kp: x.kinopoisk, imdb: x.imdb, ...(type === 'film' ? { tmdb: Number(m[2]) } : { tmdbtv: Number(m[2]) }) };
    if (inBase(ids, type)) { already++; continue; }
    add({ ...ids, key: `${m[1]}:${m[2]}`, kind: 'l', type, title: w.title, original: w.originalTitle, year: w.year || undefined }, who, file, mark.get(id));
  }
  // «Название (2019) — kinopoisk.ru/film/123/» и «Title (2019)»; без года — «Марти Великолепный (США, реж. Д. Сэфди)»
  for (const line of [...(d.unmatched ?? []), ...(d.unmatchedKinopoisk ?? [])]) {
    const kp = /kinopoisk\.ru\/(film|series)\/(\d+)/.exec(line);
    const body = line.replace(/\s+—\s+kinopoisk\.ru\/.*$/, '').trim();
    const ty = /^(.*?)\s*\((\d{4})\)$/.exec(body) ?? /^(.*?)\s+(\d{4})$/.exec(body);
    const title = (ty?.[1] ?? body.replace(/\s*\([^()]*\)$/, '')).trim(), year = ty ? Number(ty[2]) : undefined;
    const type = kp?.[1] === 'series' ? 'series' : 'film';
    if (kp && haveKp.has(Number(kp[2]))) { already++; continue; }
    add({ key: kp ? `kp:${kp[2]}` : `t:${norm(title)}|${year ?? ''}`, kind: 'unmatched', type, title, year, ...(kp ? { kp: Number(kp[2]) } : {}) }, who, file);
  }
}
const avg = (g: Gap) => { const xs = [...g.marks.values()].map((v) => v.reduce((a, b) => a + b, 0) / v.length); return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : undefined; };
const ranked = [...gaps.values()].sort((a, b) => b.people.size - a.people.size || (avg(b) ?? 0) - (avg(a) ?? 0) || a.title.localeCompare(b.title));
const people = new Set(readdirSync(at('seeds/')).filter((f) => f.endsWith('.json')).map(person));
console.error(`историй ${files} (людей ${people.size}); пробелов ${ranked.length}: карточек l- ${ranked.filter((g) => g.kind === 'l').length}, не опознано ${ranked.filter((g) => g.kind === 'unmatched').length}; уже в справочнике ${already}`);
for (const n of [2, 3, 5]) console.error(`  у ${n}+ людей: ${ranked.filter((g) => g.people.size >= n).length}`);

// ── 2. ключи для вещей от --min людей ─────────────────────────────────────────
const chosen = ranked.filter((g) => g.people.size >= MIN);
const sparql = async (query: string) => {
  for (let a = 0; a < 5; a++) {
    const r = await fetch('https://query.wikidata.org/sparql', { method: 'POST', body: new URLSearchParams({ query }),
      headers: { 'User-Agent': UA, accept: 'application/sparql-results+json', 'content-type': 'application/x-www-form-urlencoded' } }).catch(() => undefined);
    if (r?.ok) return ((await r.json()) as { results: { bindings: Record<string, { value: string }>[] } }).results.bindings;
    await sleep(1000 * (a + 1));
  }
  return undefined;
};
// сериал без элемента и IMDb — элемент по номеру TMDb TV (P4983)
const tv = chosen.filter((g) => g.type === 'series' && !g.qid && !g.imdb && g.tmdbtv);
for (let i = 0; i < tv.length; i += 200) {
  const part = tv.slice(i, i + 200);
  const rows = await sparql(`SELECT ?v ?f WHERE { VALUES ?v { ${part.map((g) => JSON.stringify(String(g.tmdbtv))).join(' ')} } ?f wdt:P4983 ?v }`);
  for (const b of rows ?? []) for (const g of part) if (String(g.tmdbtv) === b.v.value) g.qid ??= b.f.value.split('/').pop();
  await sleep(1000);
}
// строка без номера Кинопоиска — поиск TMDb по названию и году (сначала фильм, затем сериал)
const SEARCHED = '.cache/grow-from-seeds.tmdb.json';
const searched = readJson<Record<string, { tmdb?: number; tmdbtv?: number; imdb?: string; title?: string } | null>>(SEARCHED, {});
const key = process.env.TMDB_API_KEY ?? process.env.VITE_TMDB_API_KEY;
const blind = chosen.filter((g) => g.kind === 'unmatched' && !g.kp);
if (SEARCH && blind.length && key) {
  const tmdb = async <T,>(path: string, q: Record<string, string> = {}) => {
    const r = await fetch(`https://api.themoviedb.org/3/${path}?${new URLSearchParams({ api_key: key, ...q })}`).catch(() => undefined);
    return r?.ok ? await r.json() as T : undefined;
  };
  for (const g of blind) {
    if (!(g.key in searched)) {
      type Hit = { id: number; title?: string; name?: string };
      const film = await tmdb<{ results: Hit[] }>('search/movie', { query: g.title, ...(g.year ? { year: String(g.year) } : {}) });
      const show = film?.results[0] ? undefined : await tmdb<{ results: Hit[] }>('search/tv', { query: g.title, ...(g.year ? { first_air_date_year: String(g.year) } : {}) });
      const hit = film?.results[0] ?? show?.results[0];
      const imdb = show?.results[0] ? (await tmdb<{ imdb_id?: string }>(`tv/${show.results[0].id}/external_ids`))?.imdb_id ?? undefined : undefined;
      searched[g.key] = hit ? { ...(film?.results[0] ? { tmdb: hit.id } : { tmdbtv: hit.id, imdb }), title: hit.title ?? hit.name } : null;
      await sleep(250);
    }
    const s = searched[g.key];
    if (s) { Object.assign(g, { tmdb: s.tmdb, tmdbtv: s.tmdbtv, imdb: s.imdb ?? g.imdb }); if (s.tmdbtv) g.type = 'series'; }
  }
  writeFileSync(at(SEARCHED), JSON.stringify(searched, null, 1));
} else if (SEARCH && blind.length) console.error(`без номера Кинопоиска ${blind.length}: нет TMDB_API_KEY — поиск пропущен`);
// уже в справочнике по найденному ключу (элемент сериала, поиск TMDb)
const fresh = chosen.filter((g) => !inBase(g, g.type));
const keys = fresh.filter((g) => g.qid || g.kp || g.tmdb || g.imdb)
  .map((g) => ({ ...(g.qid ? { qid: g.qid } : {}), ...(g.kp ? { kp: g.kp } : {}), ...(g.type === 'film' && g.tmdb ? { tmdb: g.tmdb } : {}), ...(g.imdb ? { imdb: g.imdb } : {}) }));
const KEYS = '.cache/grow-from-seeds.keys.json';
writeFileSync(at(KEYS), JSON.stringify(keys, null, 1));
console.error(`от ${MIN} людей: ${chosen.length}; уже в справочнике по найденному ключу ${chosen.length - fresh.length}; с ключом → ${KEYS}: ${keys.length}; без ключа ${fresh.length - keys.length}`);

// ── 3. заводит сборщик справочника ────────────────────────────────────────────
const REPORT = '.cache/grow-from-seeds.report.json';
const run = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['--yes', 'tsx', 'tools/grow-film-base.mts', '--from', `file:${KEYS}`,
  '--wd-keys', '--out', 'filmBaseMore', '--report', REPORT, ...(WRITE ? ['--write'] : [])], { cwd: root.pathname, stdio: ['ignore', 'pipe', 'inherit'], encoding: 'utf8' });
const out = run.stdout ?? '';
// из длинного отчёта сборщика — только своё: «нет у нас», «без ключа», «новых карточек», «по источникам», запись
console.log(out.split('\n').filter((l) => /^(без ключа|новых карточек|по источникам|→ src)/.test(l.trim())).join('\n'));
if (run.status) { console.error(`сборщик справочника вышел с кодом ${run.status}`); process.exit(run.status); }

// судьба каждой вещи: элемент — из кэша ключей сборщика, итог — из его замера
const kc = readJson<{ by: Record<string, string | null>; info: Record<string, { none?: true; links?: number }> }>('.cache/grow-film-base.keys.json', { by: {}, info: {} });
const rep = readJson<{ added: string[]; missing: { qid: string }[]; noKey: { qid: string }[] }>(REPORT, { added: [], missing: [], noKey: [] });
const added = new Set(rep.added), missing = new Set(rep.missing.map((r) => r.qid)), noKey = new Set(rep.noKey.map((r) => r.qid));
const prev = (await import(at('src/mocks/filmBaseMore.ts').href)).filmBaseMore as WorkCard[];
const qidOf = (g: Gap) => g.qid ?? (g.kp ? kc.by[`kp:${g.kp}`] : undefined) ?? (g.type === 'film' && g.tmdb ? kc.by[`tmdb:${g.tmdb}`] : undefined) ?? (g.imdb ? kc.by[`imdb:${g.imdb}`] : undefined) ?? undefined;
const how = (g: Gap): string => {
  const via = g.kind === 'l' ? (g.type === 'series' ? 'TMDb TV' : 'TMDb') : g.kp ? 'КП → P2603' : g.tmdb || g.tmdbtv ? 'поиск TMDb' : 'не опознано';
  if (g.people.size < MIN) return via;
  if (inBase(g, g.type)) return `${via}; уже в справочнике`;
  const q = qidOf(g);
  if (!q) return `${via}; нет элемента Wikidata`;
  const f = kc.info[q] as { none?: true; tmdb?: number; imdb?: string; type?: string } | undefined;
  if (f?.none) return `${via}; ${q} — не фильм/сериал`;
  if (added.has(q)) return `${via}; ${q} → ${WRITE ? 'заведён' : 'заведётся'}`;
  // элемент нашёлся только теперь — и он уже в справочнике (TMDb числит сериалом то, что в Wikidata фильм, и т. п.)
  if (have.has(q) || (f?.type === 'film' && f.tmdb && have.has(`tmdb:${f.tmdb}`)) || (f?.imdb && have.has(`imdb:${f.imdb}`))) return `${via}; ${q} — уже в справочнике`;
  if (prev.some((c) => c.id === `f-wd${q.slice(1)}`)) return `${via}; ${q} — уже в filmBaseMore`;
  if (noKey.has(q)) return `${via}; ${q} — без ключа (у сериала нет IMDb)`;
  if (missing.has(q)) return `${via}; ${q} — уже в filmBaseMore`;
  return `${via}; ${q} — отсеян сборщиком (аниме вне канона, порно, игра, убрано)`;
};
const rows = ranked.map((g) => ({ key: g.key, kind: g.kind, type: g.type, title: g.title, original: g.original, year: g.year, people: g.people.size,
  avg: avg(g) != null ? Math.round(avg(g)! * 100) / 100 : undefined, qid: qidOf(g), how: how(g), who: [...g.people] }));
writeFileSync(at('.cache/grow-from-seeds.json'), JSON.stringify({ at: new Date().toISOString(), min: MIN, write: WRITE, rows }, null, 1));
console.log(`\nпервые ${TOP} пробелов (весь список — .cache/grow-from-seeds.json):`);
for (const [i, r] of rows.slice(0, TOP).entries()) {
  console.log(`${String(i + 1).padStart(3)}. ${`${r.title}${r.year ? ` (${r.year})` : ''}`.padEnd(46)} ${r.type === 'series' ? 'сериал' : 'фильм '} людей ${r.people}  ${r.avg != null ? `оценка ${r.avg.toFixed(1)}` : 'оценки нет'}  ${r.how}`);
}
const fate = new Map<string, number>();
for (const r of rows.filter((r) => r.people >= MIN)) { const k = r.how.replace(/^[^;]*;\s*/, '').replace(/^Q\d+\s*(→|—)\s*/, ''); fate.set(k, (fate.get(k) ?? 0) + 1); }
console.log(`\nот ${MIN} людей (${rows.filter((r) => r.people >= MIN).length}): ${[...fate].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join('; ')}`);
