// Альтернативные названия из Wikidata для поиска (волна В, 17.10): «Две твердыни» и «Две крепости» — одна книга,
// «Форрест Гамп» ищут и как «Forrest Gump», а «Иван Васильевич» — без «меняет профессию». У элемента Wikidata есть
// синонимы (skos:altLabel) — их и берём, русские; русская метка (rdfs:label) — тоже, если она не совпадает с нашим
// названием (у части карточек название из TMDb или каталога). Данные — Wikidata, CC0 (решение владельца 23.09).
//
//   npx tsx tools/alt-titles.mts [--fresh] [--out .cache/alt-titles.json]
//
// Справочник — что видят сервер и новичок (tools/base-have.mts: без истории владельца и демо-каталога). Элемент — из id
// карточки (`f-wd…`, `b-wd…`), externalIds.wikidata, иначе из .cache/wikidata-ids.json и .cache/credits-ids.json (их
// копит resolve-credits). Итог — `{ "<ключ>": ["название", …] }`, только у тех, у кого есть что-то сверх названия и
// оригинального названия; кэш ответов — .cache/alt-titles.wd.json (повторный прогон спрашивает только новые элементы).
// 18.10: тот же итог — модулем src/mocks/altTitles.ts для поиска приложения (src/api/index.ts searchWorks, лениво, с первым
// поиском — в первую загрузку не входит). Ключ — главный ключ карточки (как `primaryKey` клиента).
import { writeFileSync } from 'node:fs';
import { baseWorks, qidOfCard } from './base-have.mts';
import { plainTitle, readCache, sleep, writeCache } from './wikidata-lib.mts';

const argv = process.argv.slice(2);
const opt = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const FRESH = argv.includes('--fresh');
const OUT = opt('--out') ?? '.cache/alt-titles.json';
const UA = 'transformative-media/0.1 (film analysis index; contact via repository README)';

const shared = { ...readCache<Record<string, string | null>>('wikidata-ids.json', {}), ...readCache<Record<string, string | null>>('credits-ids.json', {}) };
const byKey = new Map<string, { q: string; names: Set<string> }>();
for (const { work, keys } of baseWorks()) {
  const key = keys[0];
  if (!key) continue;
  const q = qidOfCard(work) ?? keys.map((k) => shared[k]).find(Boolean) ?? undefined;
  if (!q) continue;
  const e = byKey.get(key) ?? { q, names: new Set<string>() };
  for (const t of [work.title, work.originalTitle]) if (t) e.names.add(fold(t));
  byKey.set(key, e);
}
/** сравнение без регистра, ё/е и знаков: «Иван Васильевич меняет профессию» = «Иван Васильевич Меняет Профессию» */
function fold(s: string): string { return s.toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]+/gu, ' ').trim(); }

type Got = { ru?: string; alt: string[] };
const cache: Record<string, Got> = FRESH ? {} : readCache('alt-titles.wd.json', {});
const todo = [...new Set([...byKey.values()].map((e) => e.q))].filter((q) => !cache[q]);
console.error(`ключей с элементом Wikidata: ${byKey.size}; спросить: ${todo.length}`);
async function sparql(query: string): Promise<Record<string, { value: string }>[] | undefined> {
  for (let a = 0; a < 5; a++) {
    const r = await fetch('https://query.wikidata.org/sparql', { method: 'POST', body: new URLSearchParams({ query }),
      headers: { 'User-Agent': UA, Accept: 'application/sparql-results+json', 'Content-Type': 'application/x-www-form-urlencoded' },
      signal: AbortSignal.timeout(90000) }).catch(() => undefined);
    if (r?.ok) { const j = await r.json().catch(() => undefined) as { results: { bindings: Record<string, { value: string }>[] } } | undefined; if (j) return j.results.bindings; }
    // 429 — Wikidata просит подождать: минута, потом с запасом
    await sleep(r?.status === 429 ? 60000 : 3000 * (a + 1));
  }
  return undefined;
}
let failed = 0;
for (let i = 0; i < todo.length; i += 300) {
  const part = todo.slice(i, i + 300);
  const rows = await sparql(`SELECT ?f ?ru ?alt WHERE { VALUES ?f { ${part.map((q) => `wd:${q}`).join(' ')} }
    OPTIONAL { ?f rdfs:label ?ru FILTER(lang(?ru) = 'ru') } OPTIONAL { ?f skos:altLabel ?alt FILTER(lang(?alt) = 'ru') } }`);
  if (!rows) { failed += part.length; console.error(`  пачка ${i / 300} не получена`); continue; }
  for (const q of part) cache[q] = { alt: [] };
  for (const b of rows) {
    const g = cache[b.f.value.split('/').pop()!];
    if (b.ru) g.ru = b.ru.value;
    if (b.alt && !g.alt.includes(b.alt.value)) g.alt.push(b.alt.value);
  }
  if ((i / 300) % 10 === 9) { writeCache('alt-titles.wd.json', cache); console.error(`  ${i + part.length} из ${todo.length}`); }
  await sleep(1000);
}
writeCache('alt-titles.wd.json', cache);

const out: Record<string, string[]> = {};
let n = 0;
for (const [key, { q, names }] of byKey) {
  const g = cache[q];
  if (!g) continue;
  const extra: string[] = [];
  const seen = new Set(names);
  // уточнение в скобках в конце — как у статьи Википедии («Невеста любой ценой (фильм)», «Столп огненный (роман)»): снимаем
  for (const raw of [g.ru, ...g.alt]) {
    const t = raw && plainTitle(raw).replace(/\s*\([^()]*\)$/u, '').trim();
    if (!t || t.length < 2 || /^Q\d+$/.test(t)) continue;
    const f = fold(t);
    if (!f || seen.has(f)) continue;
    seen.add(f); extra.push(t);
  }
  if (extra.length) { out[key] = extra; n += extra.length; }
}
writeFileSync(OUT, JSON.stringify(out));
// модуль для поиска приложения (18.10): строка на ключ, ключи по порядку — дифф читается
const sorted = Object.keys(out).sort();
writeFileSync(new URL('../src/mocks/altTitles.ts', import.meta.url), `// Сгенерировано tools/alt-titles.mts (${new Date().toISOString().slice(0, 10)}): другие русские названия произведений справочника из
// Wikidata (синонимы и русская метка элемента, CC0) — для поиска: «Форест Гамп», «Две твердыни». Ключ — главный ключ карточки.
// Грузится лениво, с первым поиском (src/api/index.ts, searchWorks). Не править руками — перегенерировать.
export const altTitles: Record<string, string[]> = {
${sorted.map((k) => `  ${JSON.stringify(k)}: ${JSON.stringify(out[k])},`).join('\n')}
};
`);
console.error(`с другими названиями: ${Object.keys(out).length} из ${byKey.size} (названий ${n})${failed ? `; не получено ${failed} — спросятся в следующий раз` : ''} → ${OUT}`);
for (const k of ['wd:Q15228', 'tmdb:13', 'tmdb:121']) if (out[k]) console.error(`  ${k}: ${out[k].join(' · ')}`);
