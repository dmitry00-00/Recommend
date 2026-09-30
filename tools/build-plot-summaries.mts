// Пересказы сюжетов для будущей автоматической разметки — из Википедии, по точному ключу.
//   npx tsx tools/build-plot-summaries.mts [--limit N] [--pause МС] [--fresh]
// По умолчанию прогон продолжает предыдущий: уже собранные пересказы читаются из кеша, и в
// сеть идут только те фильмы, которых там нет. Первый полный прогон дал 948 из 1030, но
// 249 раз Википедия просто не ответила (очередь на быстрых запросах), и такие фильмы надо
// добрать, а не считать их «без сюжета». `--fresh` собирает всё заново.
// Почему не CMU Movie Summary Corpus, с которого начинали: он собран в 2013 и новее в нём
// нет ничего (замер: наших фильмов до 2013 года — 77%, после — 2%, всего 52%), а сводить
// его приходится по названию и году, потому что ни IMDb, ни TMDb там нет, а Freebase мёртв.
// При этом сами пересказы в нём — из Википедии. Значит, надо идти к источнику: Wikidata по
// нашему IMDb ID даёт статью точно, Википедия отдаёт текущий текст, в том числе по-русски
// и по фильмам 2024 года. Лицензия та же (CC BY-SA), поэтому тексты живут только в .cache
// и в репозиторий не попадают; наружу из них могут пойти признаки, но не пересказы.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { worksIndex } from './works-index.mts';
import { isScreen } from '../src/lib/media.ts';

// заголовок обязан быть из ASCII: кириллица в User-Agent роняет fetch
const UA = 'recomend-research/0.1 (local prototype; contact via project owner)';
const arg = (name: string) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : undefined);
const limit = Number(arg('--limit')) || 0;
const pause = Number(arg('--pause')) || 800;
const fresh = process.argv.includes('--fresh');
const outFile = new URL('../.cache/plot-summaries.json', import.meta.url);
const cacheFile = new URL('../.cache/imdb-by-tmdb.json', import.meta.url);
const imdbByTmdb: Record<string, string | null> = existsSync(cacheFile) ? JSON.parse(readFileSync(cacheFile, 'utf8')) : {};

const films: { key: string; title: string; year: number; imdb: string }[] = [];
const seen = new Set<string>();
for (const { key, work } of worksIndex()) {
  if (!isScreen(work)) continue;
  const imdb = work.externalIds?.imdb ?? (work.externalIds?.tmdb != null ? imdbByTmdb[String(work.externalIds.tmdb)] : null);
  if (!imdb || seen.has(imdb)) continue;
  seen.add(imdb);
  films.push({ key, title: work.title, year: work.year, imdb });
}
const work = limit ? films.slice(0, limit) : films;

interface Summary { key: string; title: string; year: number; lang: 'ru' | 'en'; article: string; chars: number; text: string }
const out: Record<string, Summary> = !fresh && existsSync(outFile)
  ? JSON.parse(readFileSync(outFile, 'utf8')) as Record<string, Summary>
  : {};
const todoFilms = work.filter((w) => !out[w.key]);
console.log(`фильмов с IMDb ID: ${work.length} | уже собрано: ${Object.keys(out).length} | добираем: ${todoFilms.length}`);
if (!todoFilms.length) { console.log('добирать нечего'); process.exit(0); }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const chunks = <T,>(xs: T[], n: number) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

// ── 1. статья в Википедии по IMDb ID ──────────────────────────────────────────
const article = new Map<string, { ru?: string; en?: string }>();
for (const part of chunks(todoFilms, 150)) {
  const query = `SELECT ?imdb ?ru ?en WHERE {
    VALUES ?imdb { ${part.map((w) => `"${w.imdb}"`).join(' ')} }
    ?film wdt:P345 ?imdb .
    OPTIONAL { ?ru schema:about ?film ; schema:isPartOf <https://ru.wikipedia.org/> }
    OPTIONAL { ?en schema:about ?film ; schema:isPartOf <https://en.wikipedia.org/> }
  }`;
  const res = await fetch(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`,
    { headers: { 'User-Agent': UA, Accept: 'application/sparql-results+json' } });
  if (!res.ok) { console.error(`Wikidata ответила ${res.status} — останавливаемся, уже собранное сохраним`); break; }
  const rows = (await res.json()).results.bindings as Record<string, { value: string }>[];
  for (const r of rows) {
    const got = article.get(r.imdb.value) ?? {};
    const name = (url: string) => decodeURIComponent(url.split('/wiki/')[1] ?? '').replace(/_/g, ' ');
    if (r.ru) got.ru = name(r.ru.value);
    if (r.en) got.en = name(r.en.value);
    article.set(r.imdb.value, got);
  }
  process.stdout.write(`  статей найдено: ${article.size}\n`);
  await sleep(1000);
}

// ── 2. текст статьи и из него раздел о сюжете ─────────────────────────────────
/** Раздел «Сюжет» — то, что нужно; вся статья тащит за собой прокат, награды и критику. */
const PLOT: Record<'ru' | 'en', RegExp> = {
  ru: /\n==+\s*(?:Сюжет|Содержание|В основе сюжета|Краткое содержание)[^=\n]*==+\n([\s\S]*?)(?=\n==[^=]|$)/,
  en: /\n==+\s*(?:Plot|Plot summary|Synopsis|Story)[^=\n]*==+\n([\s\S]*?)(?=\n==[^=]|$)/,
};

/** Текст статьи целиком — по одной за запрос: для полного текста API отдаёт ровно одну
 *  страницу, сколько ни проси («exlimit was too large for a whole article extracts request»).
 *  Поэтому ходим последовательно, с паузой и с отступом при отказе: на быстрой очереди
 *  Викимедиа начинает отвечать «слишком много запросов», и молча считать это отсутствием
 *  сюжета нельзя — иначе замер покрытия соврёт. */
async function extract(lang: 'ru' | 'en', title: string): Promise<{ text?: string; failed?: boolean }> {
  const url = `https://${lang}.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&redirects=1&format=json&formatversion=2&titles=${encodeURIComponent(title)}`;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA } });
      if (res.ok) {
        const body = await res.text();
        if (body.startsWith('{')) {
          const data = JSON.parse(body) as { query?: { pages?: { title: string; extract?: string }[] } };
          return { text: data.query?.pages?.[0]?.extract };
        }
      }
    } catch { /* сеть дрогнула — подождём и повторим */ }
    await sleep(2000 * (attempt + 1));
  }
  return { failed: true };
}

let noArticle = 0;
let noPlot = 0;
// отказ Википедии — не «нет сюжета»: такие фильмы считаем отдельно, иначе замер покрытия врёт
const failedKeys = new Set<string>();
for (const lang of ['ru', 'en'] as const) {
  const todo = todoFilms.filter((w) => !out[w.key] && article.get(w.imdb)?.[lang]);
  console.log(`${lang}: статей к чтению ${todo.length}`);
  let done = 0;
  for (const w of todo) {
    const name = article.get(w.imdb)![lang]!;
    const got = await extract(lang, name);
    if (got.failed) failedKeys.add(w.key); else failedKeys.delete(w.key);
    const plot = got.text ? PLOT[lang].exec(`\n${got.text}`)?.[1]?.trim() : undefined;
    if (plot && plot.length >= 400) {
      out[w.key] = { key: w.key, title: w.title, year: w.year, lang, article: name, chars: plot.length, text: plot };
    }
    if (++done % 100 === 0) {
      process.stdout.write(`  ${lang}: ${done}/${todo.length}, собрано ${Object.keys(out).length}, отказов ${failedKeys.size}\n`);
      // пишем по дороге: прогон длинный, и обрыв не должен стоить всей работы
      writeFileSync(outFile, JSON.stringify(out));
    }
    await sleep(pause);
  }
}
for (const w of work) {
  if (out[w.key] || failedKeys.has(w.key)) continue;
  if (!article.get(w.imdb) && todoFilms.includes(w)) noArticle += 1; else noPlot += 1;
}
const n = Object.keys(out).length;
const lens = Object.values(out).map((s) => s.chars).sort((a, b) => a - b);
console.log(`\nпересказ найден: ${n} из ${work.length} (${Math.round((100 * n) / work.length)}%)`);
console.log(`  по-русски ${Object.values(out).filter((s) => s.lang === 'ru').length}, по-английски ${Object.values(out).filter((s) => s.lang === 'en').length}`);
console.log(`  нет статьи в Википедии: ${noArticle}; статья есть, раздела о сюжете нет: ${noPlot}; Википедия не ответила: ${failedKeys.size}`);
console.log(`длина: медиана ${lens[Math.floor(lens.length / 2)]} знаков, 10% ${lens[Math.floor(lens.length * 0.1)]}, 90% ${lens[Math.floor(lens.length * 0.9)]}`);
const recent = Object.values(out).filter((s) => s.year >= 2013).length;
console.log(`фильмов 2013 года и новее: ${recent} (у CMU таких 8)`);
writeFileSync(outFile, JSON.stringify(out));
console.log('→ .cache/plot-summaries.json (в репозиторий не идёт: CC BY-SA)');
