// Описание книги для «Сюжета» (книжный трек, 11.10): вводный абзац статьи Википедии о произведении. У фильмов
// «Сюжет» — описание TMDb; у книг его не было вовсе (в `blurb` стояла служебная подпись источника карточки).
//   npx tsx tools/book-blurbs.mts [--fresh]
// Статья — по элементу Wikidata книги (`wd:` ключ): русская Википедия, и отдельно английская — для английского
// интерфейса. Текст — `extract` из REST API Википедии (page/summary): вступление без разметки. Лицензия CC BY-SA:
// приложение ставит под описанием ссылку на статью и лицензию (src/components/WorkSheet.tsx).
// Длинное вступление режется по границе предложения около MAX знаков. Кэш ответов — .cache/book-blurbs/, итог —
// src/mocks/bookBlurbs.ts (подгружается, когда раскрывают «Сюжет» книги).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { worksIndex } from './works-index.mts';

const FRESH = process.argv.includes('--fresh');
const UA = 'recomend/0.1 (https://github.com/dmitry00-00/Recommend)';
const DIR = '.cache/book-blurbs';
const MAX = 700;
mkdirSync(DIR, { recursive: true });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const keys = [...new Set(worksIndex({ all: true }).filter((w) => w.work.type === 'book' && w.key.startsWith('wd:')).map((w) => w.key))].sort();
const qids = keys.map((k) => k.slice(3));

// статьи книги в русской и английской Википедии — одним запросом на пачку
type Row = Record<string, { value: string } | undefined>;
async function sparql(query: string): Promise<Row[]> {
  for (let a = 0; a < 4; a++) {
    const r = await fetch('https://query.wikidata.org/sparql', {
      method: 'POST', body: new URLSearchParams({ query }),
      headers: { 'User-Agent': UA, Accept: 'application/sparql-results+json', 'Content-Type': 'application/x-www-form-urlencoded' },
    }).catch(() => undefined);
    if (r?.ok) { const j = await r.json().catch(() => undefined) as { results: { bindings: Row[] } } | undefined; if (j) return j.results.bindings; }
    await sleep(3000 * (a + 1));
  }
  throw new Error('wikidata: нет ответа');
}
const articles = new Map<string, { ru?: string; en?: string }>();
for (let i = 0; i < qids.length; i += 200) {
  const rows = await sparql(`SELECT ?f ?a ?site WHERE { VALUES ?f { ${qids.slice(i, i + 200).map((q) => `wd:${q}`).join(' ')} }
    ?a schema:about ?f; schema:isPartOf ?site. FILTER(?site IN (<https://ru.wikipedia.org/>, <https://en.wikipedia.org/>)) }`);
  for (const r of rows) {
    const q = r.f!.value.split('/').pop()!;
    const lang = r.site!.value.includes('//ru.') ? 'ru' : 'en';
    articles.set(q, { ...articles.get(q), [lang]: r.a!.value });
  }
  await sleep(800);
}

/** Вступление статьи: из кэша или REST API Википедии. */
async function summary(url: string): Promise<string | undefined> {
  const file = `${DIR}/${encodeURIComponent(url).slice(-180)}.json`;
  if (!FRESH && existsSync(file)) return (JSON.parse(readFileSync(file, 'utf8')) as { t?: string }).t;
  const m = /^https:\/\/(ru|en)\.wikipedia\.org\/wiki\/(.+)$/.exec(url);
  if (!m) return undefined;
  const r = await fetch(`https://${m[1]}.wikipedia.org/api/rest_v1/page/summary/${m[2]}`, { headers: { 'User-Agent': UA } }).catch(() => undefined);
  const j = r?.ok ? await r.json().catch(() => undefined) as { extract?: string; type?: string } | undefined : undefined;
  // страница-неоднозначность — не описание книги
  // знаки ударения русской Википедии («Вокру́г Луны́») — для словаря, не для описания
  const t = j?.type === 'disambiguation' ? undefined : j?.extract?.replace(/\u0301/g, '').trim() || undefined;
  writeFileSync(file, JSON.stringify({ t }));
  await sleep(150);
  return t;
}
/** Около MAX знаков, по концу предложения. */
const cut = (t: string): string => {
  if (t.length <= MAX) return t;
  const head = t.slice(0, MAX);
  const end = Math.max(head.lastIndexOf('. '), head.lastIndexOf('! '), head.lastIndexOf('? '));
  return end > MAX / 3 ? head.slice(0, end + 1) : `${head.replace(/\s+\S*$/, '')}…`;
};

/** Описание: t — текст, u — статья (ссылка с лицензией под текстом). */
type Blurb = { t: string; u: string };
const out: Record<string, { ru?: Blurb; en?: Blurb }> = {};
let n = 0;
for (const q of qids) {
  const a = articles.get(q);
  if (!a) continue;
  for (const lang of ['ru', 'en'] as const) {
    const url = a[lang];
    if (!url) continue;
    const t = await summary(url);
    if (t && t.length >= 80) (out[`wd:${q}`] ??= {})[lang] = { t: cut(t), u: url };
  }
  if (++n % 50 === 0) console.error(`  ${n} из ${qids.length}`);
}
const ru = Object.values(out).filter((b) => b.ru).length, en = Object.values(out).filter((b) => b.en).length;
console.log(`книг: ${qids.length}; описание из русской Википедии — ${ru}, из английской — ${en}`);
writeFileSync('src/mocks/bookBlurbs.ts', `// Сгенерировано tools/book-blurbs.mts — руками не править.
// Ключ книги (wd:) → вступление статьи Википедии (ru и en) и ссылка на неё. Лицензия CC BY-SA: под текстом в «Сюжете»
// — ссылка на статью. Подгружается, когда раскрывают «Сюжет» книги (src/api, getPlot).
export type BookBlurb = { t: string; u: string };
export const bookBlurbs: Record<string, { ru?: BookBlurb; en?: BookBlurb }> = ${JSON.stringify(out, null, 1)};
`);
console.log('→ src/mocks/bookBlurbs.ts');
