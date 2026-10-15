// Общее для заходов разметки агентами (14.10): Wikidata SPARQL и описание из Википедии — «Сюжет» статьи или её
// вступление (кэш .cache/wiki-plots/ общий у всех заходов). То же, что внутри tools/markup-wave.mts.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

export const UA = 'recomend/0.1 (https://github.com/dmitry00-00/Recommend)';
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
export const readJson = <T,>(p: string, d: T): T => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) as T : d);

export async function sparql(query: string): Promise<Record<string, { value: string }>[]> {
  for (let a = 0; a < 5; a++) {
    const r = await fetch('https://query.wikidata.org/sparql', {
      method: 'POST', body: new URLSearchParams({ query }),
      headers: { 'User-Agent': UA, Accept: 'application/sparql-results+json', 'Content-Type': 'application/x-www-form-urlencoded' },
    }).catch(() => undefined);
    // обрыв посреди ответа бросает из text() — это тот же повтор, а не падение всего захода
    const t = r?.ok ? await r.text().catch(() => '') : '';
    try { return JSON.parse(t).results.bindings; } catch { await sleep(3000 * (a + 1)); }
  }
  throw new Error('wikidata: нет ответа');
}

/** «Сюжет» статьи, а нет — вступление; около `max` знаков по концу предложения. */
export function plotOf(text: string, max = 1200): string {
  const parts = text.split(/\n(?===+[^=\n]+=+\s*\n)/);
  const head = /^==+\s*(Сюжет|Содержание|Синопсис|Фабула|Описание сюжета|Plot|Synopsis|Premise|Summary|Plot summary)\s*==+/i;
  const plot = parts.find((p) => head.test(p.trim()))?.replace(head, '') ?? parts[0];
  const flat = plot.replace(/==+[^=\n]+==+/g, ' ').replace(/\s+/g, ' ').replace(/\t/g, ' ').trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  return end > max / 3 ? cut.slice(0, end + 1) : `${cut.replace(/\s+\S*$/, '')}…`;
}

/** Описание из статьи Википедии; кэш — по языку и названию статьи (одна статья — одно описание на все заходы). */
export async function article(lang: string, title: string): Promise<string | undefined> {
  mkdirSync('.cache/wiki-plots', { recursive: true });
  const file = `.cache/wiki-plots/${createHash('sha1').update(`${lang}:${title}`).digest('hex')}.json`;
  if (existsSync(file)) return (JSON.parse(readFileSync(file, 'utf8')) as { t?: string }).t;
  for (let a = 0; a < 4; a++) {
    const r = await fetch(`https://${lang}.wikipedia.org/w/api.php?${new URLSearchParams({ action: 'query', prop: 'extracts', explaintext: '1', redirects: '1', format: 'json', titles: title })}`,
      { headers: { 'User-Agent': UA } }).catch(() => undefined);
    if (r?.status === 429) { await sleep(5000 * (a + 1)); continue; }
    const j = r?.ok ? await r.json().catch(() => undefined) as { query?: { pages?: Record<string, { extract?: string }> } } | undefined : undefined;
    if (!j && a < 3) { await sleep(1500 * (a + 1)); continue; }
    const raw = Object.values(j?.query?.pages ?? {})[0]?.extract;
    const t = raw ? plotOf(raw.replace(/́/g, '')) : undefined;
    writeFileSync(file, JSON.stringify({ t }));
    return t;
  }
  return undefined;
}

/** Статьи о многом разом: по 16 параллельно, с отчётом каждые 320. */
export async function articles<T extends { lang?: string; art?: string; plot?: string }>(xs: T[]): Promise<void> {
  const need = xs.filter((x) => x.lang && x.art);
  for (let i = 0; i < need.length; i += 16) {
    await Promise.all(need.slice(i, i + 16).map(async (x) => { x.plot = await article(x.lang!, x.art!); }));
    if (i % 640 === 0) console.error(`  описания: ${i} из ${need.length}`);
  }
}

/** Известность и статья по элементам Wikidata: `ids` — QID → запись. */
export async function sitelinks<T extends { n?: number; lang?: string; art?: string }>(ids: Map<string, T>): Promise<void> {
  const qs = [...ids.keys()];
  for (let i = 0; i < qs.length; i += 200) {
    const rows = await sparql(`SELECT ?x ?n ?ru ?en WHERE { VALUES ?x { ${qs.slice(i, i + 200).map((q) => `wd:${q}`).join(' ')} }
      ?x wikibase:sitelinks ?n.
      OPTIONAL { ?ra schema:about ?x; schema:isPartOf <https://ru.wikipedia.org/>; schema:name ?ru }
      OPTIONAL { ?ea schema:about ?x; schema:isPartOf <https://en.wikipedia.org/>; schema:name ?en } }`);
    for (const r of rows) {
      const x = ids.get(r.x.value.replace(/^.*\//, ''));
      if (!x) continue;
      x.n = Math.max(x.n ?? 0, Number(r.n.value));
      if (!x.lang && r.ru) { x.lang = 'ru'; x.art = r.ru.value; } else if (!x.lang && r.en) { x.lang = 'en'; x.art = r.en.value; }
    }
    await sleep(400);
  }
}

/** QID произведения по TMDb (фильм, P4947) и IMDb (сериал, P345). */
export async function qidsBy(prop: 'P4947' | 'P345', values: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (let i = 0; i < values.length; i += 300) {
    const rows = await sparql(`SELECT ?id ?f WHERE { VALUES ?id { ${values.slice(i, i + 300).map((v) => JSON.stringify(v)).join(' ')} } ?f wdt:${prop} ?id. }`);
    for (const r of rows) if (!out.has(r.id.value)) out.set(r.id.value, r.f.value.replace(/^.*\//, ''));
    await sleep(400);
  }
  return out;
}

/** Строка TSV: табы и переводы строк внутри полей — пробелом. */
export const tsv = (cells: unknown[]) => cells.map((v) => String(v ?? '').replace(/[\t\n]+/g, ' ')).join('\t');
