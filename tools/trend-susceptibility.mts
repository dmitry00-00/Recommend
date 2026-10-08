// Восприимчивость к трендам (ЗП-36, 07.10): смотрит ли человек то, что сейчас на пике внимания.
//   npx tsx tools/trend-susceptibility.mts [--wiki ru] [--peak 2]
// Кривая внимания к фильму — месячные просмотры его статьи в Википедии (Wikimedia Pageviews, открыто):
// «на пике» — месяц просмотра, когда к статье ходили в --peak раз больше обычного (медиана по всем
// месяцам с выхода). Так ловится и премьера, и старый фильм, которого подняло продолжение или сериал.
// Статья — по ключу TMDb через Wikidata (P4947). Человек — дневник владельца (userHistory.ts, finishedAt).
// Выход: доля «на пике» среди просмотров с датой и список — .cache/trend-susceptibility.json.
// Это замер на одном человеке; в подбор фактор пойдёт после беты, когда будет с чем сравнивать (BACKLOG ЗП-36).
// Премьера почти всегда «на пике» (07.10: 89% у владельца) — сама по себе она не тренд. Признак восприимчивости —
// доля премьер в просмотрах и доля старого, поднятого волной (продолжение, сериал, годовщина).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { userJournal } from '../src/mocks/userHistory.ts';
import { externalIds } from '../src/mocks/externalIds.ts';

const argv = process.argv.slice(2);
const opt = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const WIKI = opt('--wiki') ?? 'ru';
const PEAK = Number(opt('--peak') ?? 2);
const UA = 'recomend/0.1 (https://github.com/dmitry00-00/Recommend)';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const CACHE_DIR = '.cache/pageviews';
mkdirSync(CACHE_DIR, { recursive: true });

async function json<T>(url: string, form?: Record<string, string>): Promise<T | undefined> {
  for (let a = 0; a < 4; a++) {
    const r = await fetch(url, form
      ? { method: 'POST', body: new URLSearchParams(form), headers: { 'User-Agent': UA, accept: 'application/sparql-results+json', 'content-type': 'application/x-www-form-urlencoded' } }
      : { headers: { 'User-Agent': UA } }).catch(() => undefined);
    if (r?.ok) return await r.json() as T;
    if (r?.status === 404) return undefined;
    await sleep(1000 * (a + 1));
  }
  return undefined;
}

// 1. просмотры с датой и ключом TMDb
const seen = userJournal
  .filter((e) => e.finishedAt && (e.work.externalIds ?? externalIds[e.work.id])?.tmdb != null)
  .map((e) => ({ title: e.work.title, year: e.work.year, month: e.finishedAt!.slice(0, 7), tmdb: (e.work.externalIds ?? externalIds[e.work.id])!.tmdb! }))
  // одна вещь, записанная в дневник дважды в тот же месяц, — один просмотр
  .filter((s, i, all) => all.findIndex((x) => x.tmdb === s.tmdb && x.month === s.month) === i);
console.error(`просмотров с датой и ключом: ${seen.length}`);

// 2. статья по ключу TMDb
const ids = [...new Set(seen.map((s) => s.tmdb))];
const article = new Map<number, string>();
for (let i = 0; i < ids.length; i += 200) {
  const q = `SELECT ?t ?name WHERE { VALUES ?t { ${ids.slice(i, i + 200).map((x) => `"${x}"`).join(' ')} } ?f wdt:P4947 ?t.
    ?a schema:about ?f; schema:isPartOf <https://${WIKI}.wikipedia.org/>; schema:name ?name. }`;
  const r = await json<{ results: { bindings: { t: { value: string }; name: { value: string } }[] } }>('https://query.wikidata.org/sparql', { query: q });
  for (const b of r?.results.bindings ?? []) article.set(Number(b.t.value), b.name.value);
}

// 3. месячные просмотры статьи — с июля 2015 (раньше данных нет), кэш на статью
async function monthly(title: string): Promise<Map<string, number>> {
  const file = `${CACHE_DIR}/${WIKI}-${Buffer.from(title).toString('base64url')}.json`;
  if (existsSync(file)) return new Map(JSON.parse(readFileSync(file, 'utf8')));
  const end = new Date().toISOString().slice(0, 7).replace('-', '') + '0100';
  const r = await json<{ items?: { timestamp: string; views: number }[] }>(
    `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/${WIKI}.wikipedia/all-access/user/${encodeURIComponent(title.replace(/ /g, '_'))}/monthly/2015070100/${end}`);
  const m = (r?.items ?? []).map((x) => [`${x.timestamp.slice(0, 4)}-${x.timestamp.slice(4, 6)}`, x.views] as [string, number]);
  writeFileSync(file, JSON.stringify(m));
  await sleep(100);
  return new Map(m);
}

const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };
const rows: { title: string; year: number; month: string; ratio: number; peak: boolean; fresh: boolean }[] = [];
for (const s of seen) {
  const a = article.get(s.tmdb);
  if (!a) continue;
  const m = await monthly(a);
  const at = m.get(s.month);
  // месяц до июля 2015 или статьи тогда не было — мерить не по чему
  if (at === undefined) continue;
  // обычный уровень — медиана месяцев с года выхода (до выхода статьи часто нет или она — анонс)
  const base = median([...m].filter(([k]) => Number(k.slice(0, 4)) >= s.year).map(([, v]) => v));
  const ratio = base ? at / base : 0;
  rows.push({ title: s.title, year: s.year, month: s.month, ratio: Math.round(ratio * 100) / 100, peak: ratio >= PEAK, fresh: Number(s.month.slice(0, 4)) - s.year <= 1 });
}
const share = (xs: typeof rows) => (xs.length ? Math.round((100 * xs.filter((r) => r.peak).length) / xs.length) : 0);
const fresh = rows.filter((r) => r.fresh);
const old = rows.filter((r) => !r.fresh);
console.log(`измерено ${rows.length} из ${seen.length} (статья в ${WIKI}.wikipedia и просмотр не раньше 07.2015)`);
console.log(`на пике (в ${PEAK}× от обычного): ${share(rows)}% — премьеры (год выхода и следующий) ${share(fresh)}% из ${fresh.length}, старое ${share(old)}% из ${old.length}`);
console.log(`медиана отношения «месяц просмотра / обычный месяц»: ${median(rows.map((r) => r.ratio))}`);
console.log('\nстарое на пике (тренд поднял старый фильм):');
for (const r of old.filter((x) => x.peak).sort((a, b) => b.ratio - a.ratio).slice(0, 10)) console.log(`  ${r.title} (${r.year}) — ${r.month}, ×${r.ratio}`);
writeFileSync('.cache/trend-susceptibility.json', JSON.stringify({ at: new Date().toISOString(), wiki: WIKI, peak: PEAK, rows }, null, 1));
