// Массовое внимание к фильму → .cache/attention.json. Две независимые меры:
//   просмотры статьи в Википедии — сколько людей пошли про фильм читать;
//   зрители на Trakt — сколько отметили, что посмотрели (нужен TRAKT_CLIENT_ID в .env.local).
//   npx tsx tools/build-attention.mts [--months 24] [--fresh] [--no-trakt] [--no-wiki]
//
// Зачем. «Обделён вниманием» — это про массу, а массу мы до сих пор не мерили ничем.
// У TMDb для этого есть vote_count, но он за ключом; у Викимедиа счётчик открыт, без ключа и
// без лицензионных оговорок (CC0), а статью мы для каждого фильма уже нашли, когда собирали
// пересказы сюжета (.cache/plot-summaries.json).
//
// Что меряем в Википедии: суммарные просмотры за последние N полных месяцев, доступ `user` —
// роботы исключены самим API. Это не качество и не популярность фильма вообще: это сколько
// людей пошли про него читать. Для «зафорсился / не зафорсился» ближе, чем кассовые сборы:
// сборы говорят про рекламный бюджет, просмотры статьи — про интерес после.
//
// Зачем вторая мера. Просмотры статьи перекошены против всего, что смотрят, но не читают:
// мультфильмы («Райя», «Энканто», «Митчеллы против машин») попадали в «обделённые» только
// поэтому (замер 24.09). Зрители на Trakt такого не путают. Где две меры расходятся — это
// само по себе наблюдение: много зрителей и мало читателей значит «посмотрели и забыли».
//
// Про бережность: условия Trakt требуют кэшировать и не частить. Соответствие tmdb → trakt
// не меняется никогда, поэтому лежит отдельно (.cache/trakt-ids.json) и на втором прогоне
// экономит половину запросов; уже посчитанное не перезапрашивается вовсе.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { loadEnvFile } from './env-file.mts';

const argv = process.argv.slice(2);
const opt = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const MONTHS = Number(opt('--months') ?? 24);
const FRESH = argv.includes('--fresh');
const NO_TRAKT = argv.includes('--no-trakt');
const NO_WIKI = argv.includes('--no-wiki');

const src = new URL('../.cache/plot-summaries.json', import.meta.url);
const out = new URL('../.cache/attention.json', import.meta.url);
if (!existsSync(src)) { console.error('нужен .cache/plot-summaries.json — соберите tools/build-plot-summaries.mts'); process.exit(1); }

interface Summary { key: string; lang: 'ru' | 'en'; article: string }
interface TraktStats { id: number; slug: string; watchers: number; plays: number; votes: number; collectors: number }
interface Attention {
  article?: string; lang?: string; views?: number; months?: number; missing?: true;
  trakt?: TraktStats; traktMissing?: true;
}

const films = Object.values(JSON.parse(readFileSync(src, 'utf8')) as Record<string, Summary>);
const done: Record<string, Attention> = !FRESH && existsSync(out) ? JSON.parse(readFileSync(out, 'utf8')) : {};

const pad = (d: Date) => `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}0100`;
const now = new Date();
const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));   // первое число текущего месяца
const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - MONTHS, 1));

/** Викимедиа просит представляться: без внятного User-Agent запросы отбиваются. Строго
 *  латиницей — значение заголовка это ByteString, кириллица в нём роняет fetch. */
const UA = 'transformative-media/0.1 (film analysis index; contact via repository README)';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Счётчик Викимедиа отбивает напор: четыре потока подряд дали 973 отказа из 993 (замер
 *  24.09). Поэтому по одному запросу с паузой и с отступом при отказе — 993 фильма это
 *  всё равно пара минут, а повторять прогон из-за жадности дороже. */
async function views(lang: string, article: string): Promise<{ views: number; months: number; missing?: true }> {
  const name = encodeURIComponent(article.replace(/ /g, '_'));
  const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/${lang}.wikipedia`
    + `/all-access/user/${name}/monthly/${pad(start)}/${pad(end)}`;
  for (let attempt = 0; ; attempt++) {
    const r = await fetch(url, { headers: { 'User-Agent': UA, accept: 'application/json' } });
    if (r.status === 404) return { views: 0, months: 0, missing: true };  // статью никто не открывал
    if (r.ok) {
      const body = await r.json() as { items?: { views: number }[] };
      const items = body.items ?? [];
      return { views: items.reduce((s, i) => s + i.views, 0), months: items.length };
    }
    if (attempt >= 5 || (r.status !== 429 && r.status < 500)) throw new Error(`${r.status} ${article}`);
    // 429 приходит с Retry-After — ждём столько, сколько сказано, а не сколько придумали:
    // на прогоне 25.09 своей выдержки не хватило и 69 фильмов остались без просмотров
    const after = Number(r.headers.get('retry-after') ?? 0) * 1000;
    await sleep(Math.max(after, 2000 * 2 ** attempt));
  }
}

if (!NO_WIKI) {
  const todo = films.filter((f) => done[f.key]?.views == null);
  console.error(`Википедия: фильмов со статьёй ${films.length}, посчитано ${films.length - todo.length}, осталось ${todo.length}`);
  let n = 0; let failed = 0;
  for (const f of todo) {
    try {
      const v = await views(f.lang, f.article);
      done[f.key] = { ...done[f.key], article: f.article, lang: f.lang, ...v };
    } catch (e) {
      failed += 1;
      if (failed < 6) console.error(`  ${f.article}: ${(e as Error).message}`);
    }
    n += 1;
    if (n % 100 === 0) { console.error(`  ${n}/${todo.length}`); writeFileSync(out, JSON.stringify(done)); }
    await sleep(250);
  }
  if (failed) console.error(`  не вышло: ${failed} — повторится на следующем прогоне`);
  writeFileSync(out, JSON.stringify(done));
}

// ---------- Trakt: сколько людей отметили, что посмотрели ----------
if (!NO_TRAKT) {
  loadEnvFile();
  const key = process.env.TRAKT_CLIENT_ID;
  if (!key) {
    console.error('Trakt: нет TRAKT_CLIENT_ID в .env.local — пропускаю (ось останется одна)');
  } else {
    // Cloudflare у Trakt отбивает запросы без User-Agent: Node его сам не ставит, и ответом
    // приходит их страница блокировки, а не отказ API (замер 25.09)
    const H = {
      'Content-Type': 'application/json',
      'trakt-api-version': '2',
      'trakt-api-key': key,
      'User-Agent': UA,
    };

    async function trakt<T>(path: string): Promise<T | null> {
      for (let attempt = 0; ; attempt++) {
        const r = await fetch(`https://api.trakt.tv${path}`, { headers: H });
        if (r.status === 404) return null;
        if (r.ok) return await r.json() as T;
        // 429 приходит с Retry-After; условия просят не частить, поэтому ждём столько, сколько сказано
        if (attempt >= 3 || (r.status !== 429 && r.status < 500)) throw new Error(`${r.status} ${path}`);
        await sleep(Math.max(1000 * 2 ** attempt, Number(r.headers.get('retry-after') ?? 0) * 1000));
      }
    }

    const idsFile = new URL('../.cache/trakt-ids.json', import.meta.url);
    const ids: Record<string, { id: number; slug: string } | null> = existsSync(idsFile)
      ? JSON.parse(readFileSync(idsFile, 'utf8')) : {};

    // считаем только то, о чём вообще говорят: лишние запросы здесь — это чужой ресурс
    const poolFile = new URL('../.cache/mentions.json', import.meta.url);
    const pool = existsSync(poolFile) ? Object.keys(JSON.parse(readFileSync(poolFile, 'utf8'))) : films.map((f) => f.key);
    const todo = pool.filter((k) => k.startsWith('tmdb:') && done[k]?.trakt == null && !done[k]?.traktMissing);
    console.error(`\nTrakt: в пуле ${pool.length}, осталось ${todo.length}`);

    let n = 0; let failed = 0; let missing = 0;
    for (const k of todo) {
      const tmdb = k.slice('tmdb:'.length);
      try {
        if (ids[k] === undefined) {
          const found = await trakt<{ movie?: { ids: { trakt: number; slug: string } } }[]>(`/search/tmdb/${tmdb}?type=movie`);
          ids[k] = found?.[0]?.movie ? { id: found[0].movie!.ids.trakt, slug: found[0].movie!.ids.slug } : null;
          await sleep(300);
        }
        const hit = ids[k];
        if (!hit) { done[k] = { ...done[k], traktMissing: true }; missing += 1; }
        else {
          const st = await trakt<Omit<TraktStats, 'id' | 'slug'>>(`/movies/${hit.id}/stats`);
          if (st) done[k] = { ...done[k], trakt: { ...hit, ...st } };
          else { done[k] = { ...done[k], traktMissing: true }; missing += 1; }
        }
      } catch (e) {
        failed += 1;
        if (failed < 6) console.error(`  ${k}: ${(e as Error).message}`);
      }
      n += 1;
      if (n % 100 === 0) {
        console.error(`  ${n}/${todo.length}`);
        writeFileSync(out, JSON.stringify(done));
        writeFileSync(idsFile, JSON.stringify(ids));
      }
      await sleep(300);
    }
    writeFileSync(idsFile, JSON.stringify(ids));
    console.error(`  нет на Trakt: ${missing}, ошибок: ${failed}`);
  }
}

writeFileSync(out, JSON.stringify(done));
const all = Object.values(done);
const med = (xs: number[]) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] : undefined);
const wiki = all.filter((a) => a.views != null).map((a) => a.views!);
const tr = all.filter((a) => a.trakt).map((a) => a.trakt!.watchers);
console.error(`\n→ .cache/attention.json: ${all.length} фильмов`);
console.error(`   Википедия: ${wiki.length}, медиана просмотров за ${MONTHS} мес ${med(wiki) ?? '—'}`);
console.error(`   Trakt:     ${tr.length}, медиана зрителей ${med(tr) ?? '—'}`);
